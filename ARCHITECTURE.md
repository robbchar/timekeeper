# Architecture: Renderer ↔ IPC ↔ DB

This app is a single TypeScript package with a layered runtime split between the **renderer** (React UI) and the **Electron main** process (IPC handlers + SQLite). The renderer does **not** access Node/SQLite directly; instead it consumes a narrow database contract via `window.database` (exposed by `electron/preload.ts` using `contextBridge`). That renderer-facing API is created by `makeDbShape(...)` (in `electron/helpers.ts`) and implemented as a set of `ipcRenderer.invoke(...)` calls on `database:*` channels.

On the main-process side, `electron/main.ts` initializes the database and registers the IPC handlers. `electron/database/database.ts` remains the single entry point (`setupDatabaseHandlers()`), which delegates handler registration to small modules under `electron/database/handlers/` (each exporting a `registerXHandlers(db)` function that calls `ipcMain.handle('database:*', ...)`). These handlers perform all SQLite work (including migrations via `electron/database/db-migrate.ts` and `electron/database/migrations/`). Response envelopes for CRUD operations (e.g. `CreateResponse`, `UpdateResponse`) are standardized in shared types so the renderer and main process agree on a stable contract.

## Renderer layers

Above `window.database` the renderer stacks four layers. A component never calls `window.database` directly:

```
Component
  → useProjects / useSessions / useTags / useSettings / useUI   (src/state/hooks/useAppState.tsx)
  → AppProvider + appReducer + per-slice reducers               (src/contexts/AppProvider.tsx, src/state/reducers/)
  → createDatabaseService().persistAction                       (src/state/services/databaseService.ts)
  → useDatabase / DatabaseProvider                              (src/contexts/DatabaseContext.tsx)
  → window.database                                             (preload boundary)
```

Two boundaries in that stack matter more than the rest:

- **Row shape → domain shape.** `DatabaseContext` is where SQLite row types (`ProjectDatabase`, `SessionDatabase`, `TagDatabase`) become domain types (`Project`, `Session`, `Tag`), via the mappers in `src/contexts/mappers/`. Below this line, code speaks in DB rows; above it, only in domain types.
- **Write failures.** `persistAction` performs the DB call _before_ the reducer dispatch and throws `DatabaseError` carrying `oldState`, so a failed write cannot leave the reducer holding optimistic state.

### Session durability

A running session's elapsed time lives in refs inside `SessionControls`, so it only reaches SQLite when something writes it. Three mechanisms do:

- **Checkpointing** — while the timer runs, `SessionControls` writes the elapsed seconds every 30s (`CHECKPOINT_INTERVAL_MS`) via `updateSessionDuration`. That handler sets `duration` only, leaving `endTime` NULL, so a checkpointed session still reads as unfinished. This bounds how much tracked time an abnormal exit can lose.
- **The unload handler** — a `beforeunload` listener ends the session on a clean quit. It is best-effort only: `beforeunload` cannot await, so the write races the window tearing down. Checkpointing, not this, is what makes the time durable.
- **Editing while paused** — `TimerControls` offers the clock for editing only when the timer is not running, so there is never a run in progress to reconcile. Saving from `ElapsedTimeEditor` replaces the accumulated seconds outright and writes them via `updateSessionDuration`.

Notes are edited in place through `ActiveSessionNotes` → `updateSessionNotes`. Both `UPDATE_SESSION_NOTES` and `UPDATE_SESSION_DURATION` apply the change to `currentSession` as well as any listed copy: a session started in this run is not in `sessions` at all, so updating only the list used to report "Session not found" on every checkpoint.

A session becomes the current one through `RESTORE_SESSION` by either of two routes:

- **Automatically**, when the previous run left it unfinished. `restoreSession` only dispatches; the row is already open.
- **On request**, when a finished session is continued from the recent-sessions list. `continueSession` first calls `reopenSession` to clear `endTime`, then dispatches. Clearing it matters: an in-progress session must satisfy `endTime IS NULL`, or its own crash recovery would not find it. `startTime` is deliberately left at the original — it records when the work first began, so a continued session's duration keeps accumulating while its start stays put.

Because `appReducer` routes to slice reducers from an explicit `case` list, a session action missing from that list is silently dropped — which is how `RESTORE_SESSION` first shipped inert. `appReducer.test.ts` now asserts the routing contract for every session action.

On startup `TimerPage` looks for a session with no `endTime`, selects its project, and dispatches `RESTORE_SESSION`. That sets `currentSession` **and** `restoredSessionId`; `SessionControls` resumes counting from the stored duration only for the session matching that id. The flag is what distinguishes "left running by a previous run" from "active but the user deliberately stopped the timer" — without it, remounting the component would restart a timer the user had stopped.

Callbacks handed to the unload listener and the checkpoint interval go through `useEventCallback` (`src/state/hooks/useEventCallback.ts`), which keeps a stable identity while reading current state. `useSessions()` returns fresh closures every render, so passing its functions to a long-lived subscription directly forces a choice between a stale closure and resubscribing every render — which for an interval means it never fires.

## Schema and migrations

New databases are created from `createTablesSchema` (in `electron/database/database.ts`), which always reflects the **current** schema. Existing databases are brought forward by `runMigrations` in `electron/database/db-migrate.ts`.

### Which version a database starts at

`initializeDatabase` counts the user tables **before** running `createTablesSchema`, and stamps `schema_version` accordingly:

- **No tables** → brand new database. It is built from the current schema, so it is stamped at `CURRENT_SCHEMA_VERSION` and has nothing to migrate.
- **Tables but no version stamp** → predates versioning. It is stamped `1` and replays the whole migration chain.

The distinction matters in both directions. Stamping a new database `1` makes it replay migrations against a schema that is already current (which used to crash the app on first launch); stamping a legacy database at the current version would skip the migrations it actually needs.

### Adding a migration

**Adding the file is not enough** — all three steps are required:

1. Add `electron/database/migrations/00N_description.ts` exporting `up(db)`.
2. Import it in `db-migrate.ts`, add an `if (currentVersion < N)` block, and bump `CURRENT_SCHEMA_VERSION` to `N`.
3. If it adds or changes a table, mirror the change in `createTablesSchema` so new databases match.

Step 2 was missed for `004_add_project_tags`, which shipped but never ran. The `migration registration` test in `db-migrate.test.ts` now asserts `CURRENT_SCHEMA_VERSION` matches the highest migration file on disk, so the next omission fails the suite.

Two constraints that have already caused bugs here:

- **Every statement must be awaited and its error propagated.** A bare `db.run(sql)` with no callback swallows failures, and the subsequent `COMMIT` then succeeds — recording a migration as applied when it did nothing. Migrations 002 and 003 use a promisified `run` with `ROLLBACK` on failure; follow that shape.
- **SQLite cannot `ALTER TABLE ... ADD COLUMN ... DEFAULT CURRENT_TIMESTAMP`** ("Cannot add a column with non-constant default"). Adding a timestamp column means rebuilding the table (rename → create → copy → drop), as 003 does. Rebuilding is also what keeps a migrated schema byte-identical to `createTablesSchema`; a plain `ADD COLUMN` would leave new rows with no default.

Two behaviors worth knowing:

- **Migrations are skipped entirely when `NODE_ENV === 'test'`** — `runMigrations` just stamps `schema_version` at the current version. Tests that need the real migration path must override `NODE_ENV` (see `db-migrate.test.ts`).
- **`session_tags` has no IPC surface.** The table exists in the schema and is handled by migration 002 and the test reset handler, but there is no channel, handler, or `DatabaseAPI` method for it. Only `project_tags` is reachable from the renderer. It is currently unused.

## Adding a database operation

A new operation touches five files, in this order. Missing the handler typechecks clean and fails at runtime:

1. `src/types/ipcChannels.ts` — add the channel name
2. `src/types/database.ts` — add the method to `DatabaseAPI`
3. `electron/helpers.ts` — wire it in `makeDbShape`
4. `electron/database/handlers/*.handlers.ts` — register the `ipcMain.handle`
5. `src/contexts/DatabaseContext.tsx` — expose it, mapping rows to domain types

## Sources of truth

- **Renderer↔IPC contract types**: `src/types/database.ts`, `src/types/database-response.ts`
- **IPC channel names**: `src/types/ipcChannels.ts`
- **IPC channel mapping (renderer call shape)**: `electron/helpers.ts` (`makeDbShape`)
- **Preload boundary (what renderer can call)**: `electron/preload.ts` (`contextBridge.exposeInMainWorld('database', ...)`)
- **Main-process handler registration**: `electron/main.ts`, `electron/database/database.ts` (`setupDatabaseHandlers` → `electron/database/handlers/*`)
- **SQLite schema + migrations**: `electron/database/database.ts` (`createTablesSchema`), `electron/database/db-migrate.ts`, `electron/database/migrations/`
- **Database file location**: `electron/database/database-config.ts` (`:memory:` under test, `dev-db.sqlite` in development, `userData/timekeeper.db` in production)
- **DB row → domain type mapping**: `src/contexts/mappers/`
- **Renderer state**: `src/state/reducers/` (slices), `src/state/hooks/useAppState.tsx` (consumer hooks)
- **Production time utilities**: `src/utils/time.ts` (production-safe helpers; renderer code must not import from `src/test-utils/*`)
- **Test-only time helpers**: `src/test-utils/time.ts` (may re-export production helpers and/or provide explicit test helpers)
- **Not canonical (build outputs)**: `dist/` (renderer), `dist-electron/` (main + preload)
- **Orphaned, safe to delete**: `electron/dist/` — a stale June 2025 `tsc` output from when `database.ts` lived at `electron/database.ts`. Nothing builds it; `npm run clean` does not remove it.

## Test topology

Three Vitest configs, each covering one layer. All default to watch mode — pass `--run` for a single pass.

| Config                      | Command                 | Covers                                       |
| --------------------------- | ----------------------- | -------------------------------------------- |
| `vitest.config.ts`          | `npm test`              | Renderer components, hooks, reducers (jsdom) |
| `vitest.database.config.ts` | `npm run test:db`       | Renderer↔DB integration                     |
| `vitest.electron.config.ts` | `npm run test:electron` | Main-process DB and migrations (node)        |

`npm run test:all` runs all three once, CI-style.
