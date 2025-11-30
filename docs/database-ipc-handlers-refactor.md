# Database IPC handlers refactor (Electron main process)

## Problem statement

`electron/database/database.ts` currently contains all IPC handler registrations inline in `setupDatabaseHandlers()`, making the file large and blurring boundaries between distinct domains (projects, sessions, tags, settings).

This refactor splits handler registration into small modules while preserving:

- **All IPC channel names**
- **All SQL queries and behavior**
- **`setupDatabaseHandlers()` as the single public entry point**

## Source of truth

- Main-process behavior is defined by what gets registered via `ipcMain.handle(...)`.
- Renderer-side call sites live behind `window.database` in `electron/helpers.ts` (`makeDbShape`) and types in `src/types/database.ts`.

## Target module structure

New folder: `electron/database/handlers/`

- `projectsHandlers.ts`
  - registers: `database:createProject`, `database:updateProject`, `database:getProjects`, `database:getProject`, `database:deleteProject`
- `sessionsHandlers.ts`
  - registers: `database:createSession`, `database:endSession`, `database:getSessions`, `database:getSessionsForProject`,
    `database:updateSessionNotes`, `database:updateSessionDuration`, `database:deleteSession`
- `tagsHandlers.ts`
  - registers: `database:createTag`, `database:getTags`, `database:updateTag`, `database:deleteTag`
- `projectTagsHandlers.ts`
  - registers: `database:getTagsForProject`, `database:setProjectTags`
- `settingsHandlers.ts`
  - registers: `database:getSetting`, `database:setSetting`
- `testHandlers.ts`
  - registers: `database:reset`

Each module exports a single function:

- `registerXHandlers(db: sqlite3.Database): void`

`electron/database/database.ts` will:

- keep `handlersRegistered` guard
- call each `registerXHandlers(db)` once

## No-behavior-change strategy

- Move code **without altering** SQL strings, parameter order, `new Date().toISOString()` usage, or transaction behavior.
- Keep all channel names identical (these are consumed by `makeDbShape` and renderer code).
- Avoid changing types; move type imports to the module that uses them.

## Testing / confidence signals

- Run existing unit tests (`vitest`) including Electron DB tests.
- Grep for `database:` channel strings to confirm no renames.
