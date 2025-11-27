# Architecture: Renderer ↔ IPC ↔ DB

This app is a single TypeScript package with a layered runtime split between the **renderer** (React UI) and the **Electron main** process (IPC handlers + SQLite). The renderer does **not** access Node/SQLite directly; instead it consumes a narrow database contract via `window.database` (exposed by `electron/preload.ts` using `contextBridge`). That renderer-facing API is created by `makeDbShape(...)` (in `electron/helpers.ts`) and implemented as a set of `ipcRenderer.invoke(...)` calls on `database:*` channels.

On the main-process side, `electron/main.ts` initializes the database and registers the IPC handlers. `electron/database/database.ts` remains the single entry point (`setupDatabaseHandlers()`), which delegates handler registration to small modules under `electron/database/handlers/` (each exporting a `registerXHandlers(db)` function that calls `ipcMain.handle('database:*', ...)`). These handlers perform all SQLite work (including migrations via `electron/database/db-migrate.ts` and `electron/database/migrations/`). Response envelopes for CRUD operations (e.g. `CreateResponse`, `UpdateResponse`) are standardized in shared types so the renderer and main process agree on a stable contract.

- **Source of truth: renderer↔IPC contract types**: `src/types/database.ts`, `src/types/database-response.ts`
- **Source of truth: IPC channel mapping (renderer call shape)**: `electron/helpers.ts` (`makeDbShape`)
- **Source of truth: preload boundary (what renderer can call)**: `electron/preload.ts` (`contextBridge.exposeInMainWorld('database', ...)`)
- **Source of truth: main-process handler registration**: `electron/main.ts`, `electron/database/database.ts` (`setupDatabaseHandlers` → `electron/database/handlers/*`)
- **Source of truth: SQLite schema + migrations**: `electron/database/database.ts` (`createTablesSchema`), `electron/database/db-migrate.ts`, `electron/database/migrations/`
- **Not canonical (build outputs)**: `dist/`, `dist-electron/`, `electron/dist/`
