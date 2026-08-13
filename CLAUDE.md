# TimeKeeper

A desktop time-tracking application for keeping time against the different contract projects I work on. Electron main process + React renderer in a single TypeScript package, with SQLite for storage.

Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing anything that crosses the renderer↔main boundary. Longer design notes live in [docs/](docs/).

## Package manager

**This project uses npm, not yarn** — `package-lock.json` is committed and every script assumes npm. This overrides the global "prefer yarn" preference.

## Hard rules

- **The renderer never imports `sqlite3`, `electron`, or any Node built-in.** All database access goes through `window.database`, exposed by `electron/preload.ts`. The only exceptions are type-only imports in `src/test-utils/`.
- **Renderer code must not import from `src/test-utils/*`.** Production time helpers live in `src/utils/time.ts`; `src/test-utils/time.ts` re-exports them for tests.
- Use the `now()` helper from `src/utils/time.ts` rather than calling `Date.now()` directly, so time can be controlled in tests.

## Adding a database operation

Five files, in order. Skipping the handler still typechecks — it fails at runtime:

1. `src/types/ipcChannels.ts` — channel name
2. `src/types/database.ts` — method on `DatabaseAPI`
3. `electron/helpers.ts` — wire into `makeDbShape`
4. `electron/database/handlers/*.handlers.ts` — `ipcMain.handle`
5. `src/contexts/DatabaseContext.tsx` — expose it, mapping rows to domain types via `src/contexts/mappers/`

## Adding a migration

Adding a file to `electron/database/migrations/` is **not** enough — it must also be imported in `db-migrate.ts` with an `if (currentVersion < N)` block, and `CURRENT_SCHEMA_VERSION` bumped. If it changes a table, mirror the change in `createTablesSchema` so new databases match. `db-migrate.test.ts` guards the registration step.

Two rules that have already caused bugs:

- Await every statement and let errors propagate. A bare `db.run(sql)` with no callback swallows failures and the following `COMMIT` still succeeds, marking a migration applied when it did nothing. Copy the promisified `run` + `ROLLBACK` shape from 002/003.
- SQLite rejects `ALTER TABLE ... ADD COLUMN ... DEFAULT CURRENT_TIMESTAMP`. Rebuild the table instead (rename → create → copy → drop), as 003 does.

Note that `runMigrations` skips everything when `NODE_ENV === 'test'`.

## Testing

Vitest defaults to watch mode — always pass `--run`. Three configs, one per layer:

```bash
npm test -- --run          # renderer (jsdom)
npm run test:db -- --run   # renderer↔DB integration
npm run test:electron -- --run  # main process + migrations (node)
```

`npm run test:all` runs all three once. Tests live alongside the file they cover (`Feature.tsx` → `Feature.test.tsx`).

## Path aliases

`@/` → `src/`, `@electron/` → `electron/`. Both are configured in `vite.config.ts` and each Vitest config.
