# Architecture (Renderer ↔ IPC ↔ DB)

This app is a single-package TypeScript codebase with three runtime “zones”:

- **Renderer**: React UI (Vite).
- **Main**: Electron main process (owns the database and IPC handlers).
- **DB**: SQLite accessed **only** from the main process.

The key boundary is that the renderer never imports or uses Node/Electron/SQLite APIs directly; it talks to the main process through a narrow IPC surface exposed as a typed `window.database` API.

## Data flow at a glance

1. **Renderer** calls `window.database.*()` (async).
2. **Preload** forwards that call via `ipcRenderer.invoke(channel, ...args)`.
3. **Main** receives it via `ipcMain.handle(channel, handler)` and executes SQL.
4. **Main** returns plain JSON-ish values back across IPC.
5. **Renderer** maps DB rows (when needed) into domain-friendly types for UI/state.

## Layer boundaries and responsibilities

### Renderer (React)

**Responsibilities**

- UI, user interaction, client-side orchestration.
- Consumes a typed database API via `window.database`.
- Performs **domain mapping** where appropriate (e.g. converting DB timestamps to `Date` objects for UI models).

**Key files**

- `src/contexts/DatabaseContext.tsx`
  - Provides app-facing methods like `createProject`, `getSessionsForProject`, `createTag`, etc.
  - This is the main “adapter” that turns `window.database` responses into shapes the UI wants.
- `src/components/**`, `src/state/**`

**Rule of thumb**

- Renderer code should treat `window.database` as the **only** entry point to persistence.

### Preload (IPC bridge)

**Responsibilities**

- Safely expose a minimal API from the main process to the renderer using Electron’s context isolation.
- Provide the implementation of `window.database` by forwarding to IPC.

**Key files**

- `electron/preload.ts`
  - Uses `contextBridge.exposeInMainWorld('database', ...)`.
  - Defines `window.database: DatabaseAPI` on the `Window` type.
- `electron/helpers.ts`
  - `makeDbShape(invoke)` builds the `DatabaseAPI` implementation by mapping each method to an IPC channel.

**Invariants**

- `contextIsolation: true`, `nodeIntegration: false` are set in `electron/main.ts` to keep renderer isolated.

### Main process (Electron main + DB)

**Responsibilities**

- Own the SQLite connection lifecycle.
- Define and register IPC handlers.
- Execute SQL and return plain data back to the renderer.

**Key files**

- `electron/main.ts`
  - Initializes the database, registers IPC handlers, and creates the BrowserWindow.
- `electron/database/database.ts`
  - `initializeDatabase()` opens SQLite, enables foreign keys, creates tables, and runs migrations.
  - `setupDatabaseHandlers()` is the single entry point that registers all `ipcMain.handle('database:…')` handlers (composed from `electron/database/handlers/*`).
- `electron/database/handlers/*`
  - Focused IPC registration modules (projects/sessions/tags/settings/test) exporting `register*Handlers({ db })`.
- `electron/database/migrations/**`, `electron/database/db-migrate.ts`
  - Migration execution and schema versioning.

## Canonical types / contracts (source of truth)

There are a few “contract surfaces” that should stay in sync:

- **Window DB API contract**: `src/types/database.ts`
  - The canonical TypeScript interface for `window.database` (what the renderer can call).
- **IPC response shapes**: `src/types/database-response.ts`
  - Canonical response wrappers for create/update/delete operations (e.g. `CreateResponse<T>`, `UpdateResponse<T>`).
- **Domain types** (renderer-facing models): `src/types/*` (e.g. `project.ts`, `session.ts`, `tag.ts`)
  - Used by UI/state and (sometimes) returned by IPC handlers depending on row shape.
- **DB row types** (SQLite rows): sometimes explicitly modeled (e.g. `TagDatabase` in `src/types/tag.ts`)
  - These are “database-shaped” (column-named) representations of rows as returned from SQL.

When adding new DB capabilities, update the canonical contract in `src/types/database.ts` first, then implement the matching IPC handler and preload mapping.

## IPC channels (naming convention)

IPC handlers follow a `database:*` naming convention. Examples include:

- `database:getProjects`
- `database:createProject`
- `database:getSessionsForProject`
- `database:setSetting`

The authoritative list of channel names lives in `src/ipc/channels.ts` (`IPC_CHANNELS`). The preload mapping in `electron/helpers.ts` (`makeDbShape`) and the handler registrations in `electron/database/handlers/*` both reference those constants.

## Error/response conventions

- IPC should return **serializable** data (plain objects, arrays, strings, numbers).
- Create/update/delete operations typically include a `changes: number` count.
- “Record-returning” helpers exist in `electron/helpers.ts`:
  - `getRecordAfterInsert`
  - `getRecordAfterWrite`
  - `getRecordBeforeDelete`

## Where to make changes (common tasks)

- **Add a new DB operation**

  1. Add a method to `DatabaseAPI` in `src/types/database.ts`.
  2. Add the channel mapping in `electron/helpers.ts` (`makeDbShape`).
  3. Register an IPC handler in `electron/database/database.ts` (`ipcMain.handle('database:…', ...)`).
  4. Expose/unwrap it for UI usage via `src/contexts/DatabaseContext.tsx`.
  5. Add/adjust tests (Vitest) for the relevant layer.

- **Change schema**
  - Add a migration in `electron/database/migrations/**` and update migration wiring in `electron/database/db-migrate.ts`.

## Related deeper notes (near-duplicates)

- `docs/db-interface-cleanup.md` contains a longer refactoring-oriented discussion about DB/IPC contracts and response shapes.
  - This file (`ARCHITECTURE.md`) intentionally stays **short** and focuses on boundaries and “where things live”.
