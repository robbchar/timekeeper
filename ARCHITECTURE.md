# Architecture

TimeKeeper is a single-package TypeScript app made of three layers:

- **Renderer (React UI)**: `src/` (runs in the Electron renderer process)
- **IPC boundary**: `electron/preload.ts` exposes a safe API to the renderer via `contextBridge`
- **Main process DB (SQLite)**: `electron/database/` (runs in the Electron main process and owns the SQLite connection)

This document focuses on the **renderer ↔ IPC ↔ database** boundaries and on **where the canonical contracts/types live**.

## Process model and trust boundaries

- **Renderer process**

  - Runs React and all UI state (`src/`).
  - **Does not** have direct Node/Electron access (`nodeIntegration: false`).
  - Talks to the DB only via `window.database` (see “IPC contract” below).

- **Preload script**

  - Runs with access to Electron APIs.
  - With `contextIsolation: true`, it is the only place we intentionally expose functionality to the renderer.
  - Exposes a _narrow_ “database API” surface as `window.database` (see `electron/preload.ts`).

- **Main process**
  - Owns application lifecycle, window creation, and the SQLite connection.
  - Registers IPC handlers (via `ipcMain.handle`) that implement the DB operations.

## End-to-end data flow (read/write)

Typical “call path” looks like:

1. **React component / hook** calls into a service/context (commonly `DatabaseContext` in `src/contexts/DatabaseContext.tsx`).
2. `DatabaseContext` calls **`window.database.<method>`** (typed by `DatabaseAPI`).
3. `window.database.<method>` is implemented in preload via `makeDbShape(ipcRenderer.invoke)` (see `electron/helpers.ts`).
4. `ipcRenderer.invoke(channel, ...args)` crosses the IPC boundary to the main process.
5. The main process handles the request via **`ipcMain.handle(channel, handler)`** (see `electron/database/database.ts`), performs SQL against SQLite, and returns results to the renderer.

## Canonical contracts and types (source of truth)

The **canonical IPC contract** is defined by these files:

- **`src/types/database.ts`**
  - Defines `DatabaseAPI` (the methods available on `window.database`).
  - This is the _public contract_ the renderer compiles against.
- **`src/types/database-response.ts`**
  - Defines shared response envelopes like `CreateResponse<T>`, `UpdateResponse<T>`, `DeleteResponse<T>`, `ChangesOnlyResponse`.
- **`electron/helpers.ts`**
  - Implements `makeDbShape(...)`, mapping each `DatabaseAPI` method to an IPC channel string (e.g. `database:createProject`).
  - This is where the **channel names** are centralized.
- **`electron/database/database.ts`**
  - Implements the actual handler logic and SQL for each channel.

The **canonical domain models** live in `src/types/` (e.g. `Project`, `Session`, `Tag`).

### Domain vs DB shapes

Some types represent **DB-row shapes** (e.g. `TagDatabase` uses `tagId`, timestamps as strings), while UI/components may prefer **domain-friendly shapes** (e.g. `Tag` might use `id` and `Date` objects).

Today, the mapping is primarily performed in the renderer layer (notably `src/contexts/DatabaseContext.tsx`), while the SQLite/IPC layer tends to return row-like objects.

Concretely:

- Sessions crossing IPC use **`SessionDatabase`** (`startTime` / `endTime` are ISO strings from SQLite).
- Renderer/state code uses **`Session`** (`startTime` / `endTime` are real `Date` objects).
- The conversion happens in one place via `dbSessionToSession` (see `src/utils/session-mappers.ts`), called from `DatabaseContext`.

## Where boundaries are enforced in code

### Renderer → Preload (`window.database`)

- Preload exposes `window.database`:
  - `electron/preload.ts` uses `contextBridge.exposeInMainWorld('database', ...)`
  - The exposed value is produced by `makeDbShape(...)` in `electron/helpers.ts`

This keeps the renderer from importing `electron` directly and limits access to the methods we explicitly allow.

### Preload → Main process (IPC channels)

- IPC is invoked with `ipcRenderer.invoke(channel, ...args)` (indirectly via `makeDbShape`).
- IPC is handled with `ipcMain.handle(channel, handler)` (in `electron/database/database.ts`).

**Security note:** only channels implemented in the main process can be called successfully; the preload surface should remain narrow and explicit.

### Main process → SQLite

- SQLite connection is initialized in `initializeDatabase()` (see `electron/database/database.ts`).
- Schema is created with `createTablesSchema` (same file), then migrations run via `runMigrations(...)`.
- Database location is configured in `electron/database/database-config.ts`:
  - `development`: `dev-db.sqlite` in the project root
  - `production`: `%APPDATA%/…/timekeeper.db` via Electron `app.getPath('userData')`
  - `test`: in-memory `:memory:`

## Migrations

- Migrations live in `electron/database/migrations/`.
- `electron/database/db-migrate.ts` runs migrations sequentially and tracks `schema_version` in the `settings` table.

## How to add / change a DB operation (checklist)

When adding a new database operation, keep the layers consistent:

1. **Define the contract** in `DatabaseAPI` (`src/types/database.ts`).
2. **Add a channel mapping** in `makeDbShape` (`electron/helpers.ts`).
3. **Implement the handler** in the main process (`ipcMain.handle(...)` in `electron/database/database.ts`).
4. **Consume it in the renderer** (often via `src/contexts/DatabaseContext.tsx`), keeping any domain↔DB mapping in one place.

If you change an existing operation, ensure `DatabaseAPI` types still match the runtime return shape.

## Testing strategy (what covers what)

- **Renderer tests** live in `src/**.test.tsx` (Vitest + React Testing Library).
- **Electron / DB tests** live under `electron/` (see `README.md` for the commands and configs).

This separation intentionally mirrors the architectural boundary: UI tests validate user-visible behavior; DB tests validate SQL + IPC handler behavior.

## Shared utilities (renderer)

### Time utilities

- **Canonical production helpers** live in `src/utils/time.ts` (e.g. formatting and `now()`).
- **Test helpers** live in `src/test-utils/`. If a test needs a production time helper, prefer importing it from `src/utils/time.ts` (or via `src/test-utils/time.ts` when a test-specific facade is intentionally provided).
