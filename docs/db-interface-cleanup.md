## Database Interface Cleanup Plan

### Context

The current database layer has grown organically and now has a few rough edges:

- **Three layers of indirection**

  - Electron main process (SQLite + IPC handlers in `electron/database/database.ts`)
  - Preload (`window.database` via `makeDbShape` and `DatabaseAPI`)
  - React side (`DatabaseContext` + `databaseService.persistAction` + hooks like `useSessions`)

- **Inconsistent response shapes**

  - Helpers (`getRecordAfterInsert`, `getRecordAfterWrite`, `getRecordBeforeDelete`) return a generic `DatabaseResponse<T>`:
    - `CreateResponse<T>`, `UpdateResponse<T>`, `DeleteResponse<T>`
    - Fields: `itemId?`, `changes`, `record?`, `deleted?`
  - Some IPC handlers return full responses with `record`/`deleted`, others return only `{ changes }`.
  - `DatabaseContext` sometimes unwraps the `record` (e.g. `createProject` → `Project`), sometimes rewraps into `{ changes }`.
  - `DatabaseAPI` types don’t always match the runtime shape (e.g. `deleteTag` is typed as `UpdateResponse` but the IPC handler actually returns a `DeleteResponse` with `deleted`).

- **Domain vs DB shape confusion**

  - `TagDatabase` vs `Tag`:
    - DB uses `tagId`, app uses `id`.
    - `getAllTags` currently fakes `createdAt`/`updatedAt` as `new Date()` instead of using DB data.
  - Sessions and projects sometimes use DB fields directly, sometimes a more domain‑friendly shape.

- **Mixed query responsibility**
  - There is an IPC handler `database:getSessionsForProject`, but `DatabaseContext.getSessionsForProject` currently calls `getSessions()` and filters client‑side.

### Decisions & Conventions

- **Domain vs DB mapping boundary**

  - IPC/SQLite layer and `window.database` stay in **DB shape** (e.g. `project_id`, `tag_id`, snake_case as appropriate).
  - `DatabaseContext` is the **single mapping boundary**: DB rows ↔ domain models.
  - Domain models and state always use **explicit, domain-friendly naming** (e.g. `projectId`, `tagId`, `createdAt`, `updatedAt`) rather than ambiguous `id`.

- **`DatabaseContext` contract**

  - Components and hooks only see **domain models and simple metadata**, never raw `DatabaseResponse`.
  - CRUD helpers return:
    - Creates: the created **domain object** (`Project`, `Session`, `Tag`, etc.).
    - Reads/queries: arrays or single domain objects (throwing if a required record is missing).
    - Updates/deletes: either the **updated/deleted domain object** or `{ changes: number }`, depending on the operation’s needs.
  - If an operation targets a specific existing record and the DB reports no change (e.g. `changes === 0` when deleting an existing object), we treat that as an **error and throw**, not as a silent no-op.

- **Response shapes (edge cases)**

  - Normal operations always expose **`changes: number`** in some form for write operations.
  - For “we don’t care about the old record” paths (e.g. some settings), we standardize on returning `{ changes: number }` rather than a `*Response<T | null>`.
  - For operations where the previous value is important (e.g. some deletes/updates in the Electron layer), we keep `DeleteResponse<T>` / `UpdateResponse<T>` at the IPC boundary but map to domain types in `DatabaseContext`.

- **Error handling & validation**

  - **Client-side validation** is used for UX and early feedback.
  - **Server/DB-side validation** still happens just before data is persisted or used, to guard against spoofed/invalid clients.
  - DB and IPC errors are normalized into a **small, predictable set of error types** (e.g. `DatabaseError`) so the React side doesn’t need to know about SQLite specifics.

- **Naming & API consistency**
  - Operation naming follows a consistent pattern: `getX`, `getXById`, `getXsForY`, `createX`, `updateX`, `deleteX`.
  - IDs in domain types are explicit and descriptive where helpful (e.g. `projectId`, `tagId`), while DB/IPC can use the conventional column naming for the schema.
  - `databaseService.persistAction` is kept as the orchestration layer for state + DB side effects, but its **return type is narrowed per action**, rather than a single broad union.
  - `databaseService.persistAction` uses a **local action→result mapping type** so call sites can rely on inference (avoiding `as unknown as ...`).

### Goals

1. **Consistent operation contracts**

   - For each DB operation, it should be clear:
     - What arguments it takes.
     - What shape it returns (record, `{ changes }`, or both).
   - The type system should reflect this so the React side doesn’t have to guess or cast.

2. **Single mapping boundary**

   - Have one clear place where “DB row → domain model” and “domain model → DB row” is handled.
   - Avoid sprinkling small, ad‑hoc conversions across `DatabaseContext`, hooks, and reducers.

3. **Align types with runtime behavior**

   - Ensure `DatabaseAPI` and `DatabaseResponse` types match what IPC handlers actually return.
   - Clean up mislabelled types (e.g. `deleteTag` returning `DeleteResponse` but typed as `UpdateResponse`).

4. **Push filtering and aggregation into SQL where reasonable**
   - Prefer using `getSessionsForProject` at the DB/IPC layer instead of “get everything then filter in JS”.
   - Keep performance reasonable while still prioritizing clarity.

### Proposed Changes (High-Level)

#### 1. Normalize IPC handler return types

- **Create operations**
  - Always return `CreateResponse<T>` with:
    - `itemId: number`
    - `changes: number`
    - `record: T`
- **Update operations**
  - For “update & return row” operations, always use `UpdateResponse<T>` with:
    - `changes: number`
    - `record: T`
  - For “update where we only care about whether it happened” (e.g. some settings), either:
    - Still return `UpdateResponse<T | null>` with `record` optional, or
    - Have a separate, clearly typed operation that only returns `{ changes }`.
- **Delete operations**
  - For deletes where the previous value is useful, always use `DeleteResponse<T>` with `deleted: T`.
  - For simple deletes (where we don’t care about the old record), just return `{ changes }` under a separate, clearly named operation.

#### 2. Tighten `DatabaseAPI` and `DatabaseContext`

- **`DatabaseAPI`**

  - Update signatures so they reflect concrete response types:
    - Example:
      - `createProject: (...) => Promise<CreateResponse<Project>>`
      - `updateProject: (...) => Promise<UpdateResponse<Project>>`
      - `deleteProject: (...) => Promise<DeleteResponse<Project>>` or `Promise<{ changes: number }>` depending on needs.
  - Fix mismatches like `deleteTag` returning `DeleteResponse` but being typed as `UpdateResponse`.

- **`DatabaseContext`**
  - Decide on a consistent pattern:
    - Option A: Always unwrap to domain types (`Project`, `Session`, `Tag`) and strongly typed metadata, so components never see `DatabaseResponse`.
    - Option B: Expose both record and raw response where necessary, but in a consistent, documented way.
  - Centralize mapping:
    - E.g. `TagDatabase` → `Tag` mapping and ID conversions live here, not scattered in hooks or components.

#### 3. Simplify `databaseService.persistAction`

- Replace the broad union return type:

  ProjectUpdate | ProjectCreate | SessionCreate | { changes: number } | null | undefined
  with **per‑action return types**:

  - `persistAction<CreateProjectAction>` returns `Project`.
  - `persistAction<CreateSessionAction>` returns `Session`.
  - `persistAction<DeleteSessionAction>` returns `{ changes: number }` (or `void` if state is updated purely via dispatch).

- Option: split out “side‑effect only” actions that don’t need to return anything and document them as such.

#### 4. Align query usage

- Update `DatabaseContext.getSessionsForProject` to call the IPC handler `database:getSessionsForProject` instead of filtering `getSessions()` results in JS.
- Review other places where we might be doing in‑memory filtering that could be more idiomatically handled in SQL.

### Migration Strategy

1. **Phase 1: Type and handler alignment**

   - Update IPC handlers, `DatabaseResponse` usage, and `DatabaseAPI` types to be consistent.
   - Add tests around the Electron DB layer to lock in the new response shapes.

2. **Phase 2: Context and hooks cleanup**

   - Refactor `DatabaseContext` to apply a single mapping strategy (e.g., always return domain models).
   - Adjust hooks (`useProjects`, `useSessions`, `useTags`, `useSettings`) to use the normalized APIs.

3. **Phase 3: Remove legacy patterns**

   - Remove any client‑side filtering that duplicates DB work (e.g. `getSessionsForProject`).
   - Remove dead code paths and outdated type aliases.

4. **Phase 4: Documentation and code comments**
   - Document the final contract:
     - For each operation: input params, output shape, and where domain mapping happens.
   - Add inline comments where behavior is non‑obvious (e.g. why some deletes return `deleted` records and others don’t).

### Implementation Checklist

- **Phase 1 – IPC & response normalization**

  - [x] Normalize `CreateResponse`, `UpdateResponse`, and `DeleteResponse` shapes in `electron/database/database.ts` and `electron/helpers.ts` so they always match the rules in this document.
  - [x] Ensure each IPC handler either returns a full response (`record` / `deleted`) or `{ changes }` under a clearly named channel.
  - [x] Align `DatabaseAPI` types with actual IPC return shapes in `src/types/database.ts` and `src/types/database-response.ts`.

- **Phase 2 – `DatabaseContext` mapping & queries**

  - [x] Make `DatabaseContext` the single mapping boundary (DB row ↔ domain) for projects, sessions, tags, and settings.
  - [x] Update `getSessionsForProject` to use the `database:getSessionsForProject` IPC handler instead of in-memory filtering.
  - [x] Fix tag mapping so `createdAt` / `updatedAt` come from the database, not `new Date()`.

- **Phase 3 – `databaseService.persistAction` return contracts**

  - [x] For each `ActionType.*` handled in `persistAction`, implement a clear, per-action return type:
    - [x] `CREATE_PROJECT` → `Project`
    - [x] `UPDATE_PROJECT` → `Project`
    - [x] `DELETE_PROJECT` → `{ changes: number }`
    - [x] `ADD_TAG` → `Tag`
    - [x] `UPDATE_TAG` → `Tag`
    - [x] `DELETE_TAG` → `{ changes: number }`
    - [x] `UPDATE_SETTINGS` → `{ changes: number }` total over all `setSetting` calls
    - [x] `CREATE_SESSION` → `Session`
    - [x] `END_SESSION` → `{ changes: number }`
    - [x] `UPDATE_SESSION_NOTES` → `{ changes: number }`
    - [x] `UPDATE_SESSION_DURATION` → `{ changes: number }`
    - [x] `DELETE_SESSION` → `{ changes: number }`
  - [x] Update `useAppState` and `AppProvider` so they rely on these narrowed return types instead of the broad union.

- **Phase 4 – Tests & cleanup**
  - [x] Add/extend tests for the Electron DB layer (e.g. `electron/database/database.test.ts`) to lock in IPC/helper response shapes.
  - [x] Add tests for `DatabaseContext` mapping (domain ↔ DB shape) for projects, sessions, tags, and settings.
  - [x] Remove any remaining client-side filtering that duplicates DB work (e.g. `getSessionsForProject` now calls the IPC handler).
  - [x] Remove outdated type aliases and any remaining references to the old `DatabaseResponse` unions where they are no longer needed.
  - [x] Revisit and update this document to reflect the final contract and any deviations made during implementation.

### Notes

- The goal is **not** to rewrite the entire DB layer, but to:
  - Make responses predictable.
  - Have one clear mapping boundary.
  - Make hooks and components consume simple, well‑typed domain objects.
- This document should be revisited and updated as we make concrete changes to the DB code.

### Entry points section (where to start in the code):

- electron/database/database.ts (IPC handlers + raw SQL).
- electron/helpers.ts (getRecordAfter\*, makeDbShape).
- src/types/database.ts + src/types/database-response.ts (type contracts).
- src/contexts/DatabaseContext.tsx and src/state/services/databaseService.ts (mapping and persistAction).

### Non-goals / out of scope (for this pass):

- Not changing the DB schema or migrations.
- Not changing consumer components’ behavior beyond adapting to cleaner types.
- Not adding new features, only refactoring / clarifying.
