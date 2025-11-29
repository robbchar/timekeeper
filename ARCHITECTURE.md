# TimeKeeper Architecture

TimeKeeper is a single-package TypeScript app with **three runtime layers**:

- **Renderer (React)**: UI + state management (no direct Node/SQLite access)
- **Preload (Electron context bridge)**: the only place the renderer gets a DB API
- **Main (Electron) + SQLite**: owns persistence, schema, and migrations

This document focuses on **renderer ↔ IPC ↔ DB boundaries** and where the **canonical contracts/types** live.

## High-level data flow

1. React code calls `window.database.*(...)` (renderer).
2. Preload routes the call via `ipcRenderer.invoke(channel, ...args)` (IPC request).
3. Main process handles it via `ipcMain.handle(channel, handler)` and executes SQL (DB).
4. A typed response is returned back to the renderer.

## Boundaries (and what belongs where)

### Renderer (React)

- **Entry points**: `src/main.tsx`, `src/App.tsx`
- **DB boundary in renderer**: `src/contexts/DatabaseContext.tsx`
  - Consumes `window.database`
  - Maps DB-ish shapes into domain shapes where needed (e.g. tag date parsing)
- **State persistence orchestration**: `src/state/services/databaseService.ts`
  - Drives DB writes based on state actions

Renderer code **must not**:

- import Electron modules (`electron`, `ipcRenderer`, etc.)
- talk to SQLite directly

### Preload (context bridge)

- **Entry**: `electron/preload.ts`
- Exposes `window.database` via `contextBridge.exposeInMainWorld(...)`.

This is the **security and API boundary**. The app runs with `contextIsolation: true` and `nodeIntegration: false` (see `electron/main.ts`), so preload is the safe way to provide a constrained API to the renderer.

### IPC surface (channel mapping)

- **Channel mapping**: `electron/helpers.ts` (`makeDbShape`)
  - Maps `DatabaseAPI` methods to channel names like `database:createProject`.
  - Channel names are centralized in `src/types/ipc-channels.ts` (`IPC_CHANNELS`) and reused across layers.

Rule of thumb:

- `DatabaseAPI` defines **what methods exist**
- `makeDbShape` defines **what channels they call**
- `ipcMain.handle` defines **what the channels do**

### Main process + SQLite

- **App entry**: `electron/main.ts`
  - Initializes the DB (`initializeDatabase()`)
  - Registers IPC handlers (`setupDatabaseHandlers()`)
  - Creates the BrowserWindow
- **SQLite + IPC handlers**: `electron/database/database.ts`
  - Owns schema + migrations + the single handler entry point (`setupDatabaseHandlers()`)
  - Delegates to focused handler modules in `electron/database/handlers/*` (each exports `registerXHandlers(...)`)
- **Migrations**: `electron/database/db-migrate.ts`, `electron/database/migrations/`

## Canonical contracts and types (source of truth)

If you’re looking for “the contract”, start here:

- **Renderer-facing DB API**: `src/types/database.ts` (`DatabaseAPI`)
  - This is the canonical interface of `window.database`.
- **Standard response shapes**: `src/types/database-response.ts`
  - `CreateResponse<T>`, `UpdateResponse<T>`, `DeleteResponse<T>`, `ChangesOnlyResponse`
- **Domain types used by renderer/state**:
  - `src/types/project.ts`, `src/types/session.ts`, `src/types/tag.ts`, `src/types/state.ts`

Implementation must remain aligned across layers:

- `src/types/database.ts` ↔ `electron/helpers.ts` ↔ `electron/database/database.ts` ↔ `electron/preload.ts`

For deeper notes on response-shape conventions and layer responsibilities, see `docs/db-interface-cleanup.md`.

## Example (Create Project)

- Renderer calls `window.database.createProject(name, description?, color?)`.
- Preload forwards to `ipcRenderer.invoke(IPC_CHANNELS.database.createProject, ...)` (string value remains `'database:createProject'`).
- Main handles `ipcMain.handle(IPC_CHANNELS.database.createProject, ...)` and runs an `INSERT`.
- Response crosses back as `CreateResponse<Project>` (see `src/types/database-response.ts`), and the renderer may unwrap `record` in `DatabaseContext`.

## Adding a new DB operation (checklist)

1. **Define the contract**:
   - Add/adjust method signature in `src/types/database.ts` (and any response types in `src/types/database-response.ts`).
2. **Expose it through preload**:
   - Add the channel name in `src/types/ipc-channels.ts` (`IPC_CHANNELS.database`).
   - Add the channel mapping in `electron/helpers.ts` (`makeDbShape`).
3. **Implement it in the main process**:
   - Register an `ipcMain.handle('database:yourChannel', ...)` in `electron/database/database.ts`.
4. **Schema changes (only if needed)**:
   - Add a migration in `electron/database/migrations/` and ensure it runs via `electron/database/db-migrate.ts`.
5. **Use it from React**:
   - Prefer calling it through `src/contexts/DatabaseContext.tsx` (to keep a single renderer-side boundary).
6. **Tests**:
   - Renderer tests: `vitest.config.ts`
   - Electron/main-process tests: `vitest.electron.config.ts`
   - DB-focused tests: `vitest.database.config.ts`
