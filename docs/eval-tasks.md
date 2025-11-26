# Evaluation Tasks

This document defines the **task suite** used to evaluate an LLM as a coding partner in this repo.

## Protocol prompt (copy/paste into a new chat)

Use this as the _system/user prompt_ (or the first message) for each task. Replace the **Task** section.

---

We’re working in a **single-package, multi-layer TypeScript codebase** (Electron + React + SQLite).

**Process requirements (strict):**

- **Exploration first**: ask to open any files you need before changing things.
- **Source of truth**: tell me where you believe the canonical implementation/types live.
- **Design before edits**: propose a short plan (3–6 steps) and call out suspected near-duplicates.
- **Incremental implementation**: make small, focused changes; avoid sweeping rewrites.
- **Git hygiene**: work on the existing shared branch for this evaluation run (cumulative), commit often (small commits).
- **Tests**: run relevant tests and report results (at minimum `npm run test:all`).
- **Docs**: if you introduce new concepts/contracts, update docs as needed. If anything is commented to be done, prefix it with `TODO`.

**Initial context bundle (entry points):**

- Renderer entry: `src/main.tsx`, `src/App.tsx`
- Renderer DB boundary: `src/contexts/DatabaseContext.tsx`, `src/state/services/databaseService.ts`
- Shared DB contract types: `src/types/database.ts`, `src/types/database-response.ts`
- Electron entry: `electron/main.ts`, `electron/preload.ts`
- IPC mapping: `electron/helpers.ts`
- DB + migrations: `electron/database/database.ts`, `electron/database/db-migrate.ts`, `electron/database/migrations/`
- Tests: `vitest.config.ts`, `vitest.electron.config.ts`, `vitest.database.config.ts`

**Task:**
<paste task statement + constraints here>

**Success criteria:**
<paste success criteria here>

**What I want from you right now:**

1. Tell me which files you want to inspect first (and why).
2. State where you think the source-of-truth code lives.
3. Propose a 3–6 step plan.
   Then wait for confirmation before making edits.

---

## Task template (for designing new tasks)

### Task N: <short name>

- **Task statement**:
- **Constraints**:
  - **Scope**:
  - **Non-goals**:
  - **Compatibility**:
- **Success criteria**:
  - **Behavior**:
  - **Type-level / contracts**:
  - **Tests**:
    - Required: `npm run test:all`
    - If touching Electron-only code: `npm run test:electron -- --run`
    - If touching DB-focused tests: `npm run test:db -- --run`
- **Suggested initial files** (optional):

## Proposed task suite (draft)

These are designed so the “shortest good solution” requires **reusing existing abstractions**, reconciling **near-duplicates**, and touching **multiple call sites/layers**.

### Task 2: Align docs and architecture with reality (lightweight)

- **Task statement**: Add a short `ARCHITECTURE.md` that documents the renderer↔IPC↔DB boundaries and where the canonical types/contracts live.
- **Constraints**:
  - **Scope**: docs-only (no behavior changes)
  - **Non-goals**: re-architecting code
- **Success criteria**:
  - **Behavior**: unchanged
  - **Docs**: `ARCHITECTURE.md` exists and is 1–2 paragraphs + a small bullet list of “source of truth” files.
  - **Tests**: optional, but repo remains green.

### Task 3: Extract and reuse Tag mapping helpers (near-duplicate consolidation)

- **Task statement**: Consolidate repeated “DB Tag ↔ UI Tag” transformations into a shared helper (or small module) and reuse it across `DatabaseContext`.
- **Constraints**:
  - **Scope**: `DatabaseContext` mapping code only; do not change DB schema.
  - **Non-goals**: UI redesign.
- **Success criteria**:
  - **Behavior**: unchanged for tag creation, listing, updating, project-tag listing.
  - **Type-level / contracts**: mapping is type-safe and lives in one place.
  - **Tests**: `npm run test:all` passes (and any tag-focused tests remain meaningful).

### Task 4: Introduce a single “changes-only” response shape in renderer (contract convergence)

- **Task statement**: Normalize how “writes that only need `{ changes }`” are represented/returned in renderer code (actions + `DatabaseContext` + state service), without breaking IPC.
- **Constraints**:
  - **Scope**: renderer interfaces and call sites; keep Electron IPC return values as-is unless needed.
  - **Non-goals**: changing underlying DB queries.
- **Success criteria**:
  - **Behavior**: unchanged.
  - **Type-level / contracts**: fewer ad-hoc `{ changes: result.changes }` conversions; no `any`.
  - **Tests**: `npm run test:all` passes.

### Task 5: Add a `getProject(projectId)` IPC call (cross-layer addition)

- **Task statement**: Add an IPC-backed `getProject(projectId)` method so the renderer can fetch a single project without fetching all projects and filtering.
- **Constraints**:
  - **Scope**: update `DatabaseAPI` type, preload (`makeDbShape`), Electron handler, and `DatabaseContext`.
  - **Non-goals**: changing UI flows beyond eliminating unnecessary `getProjects()` calls.
- **Success criteria**:
  - **Behavior**: `DatabaseContext.getProject` performs a single-project fetch via IPC.
  - **Contracts**: `src/types/database.ts` matches `electron/helpers.ts` exposed shape and `electron/database/database.ts` handlers.
  - **Tests**: `npm run test:all` and `npm run test:electron -- --run` pass.

### Task 6: Split `setupDatabaseHandlers` into focused modules (meaty extraction)

- **Task statement**: Refactor `electron/database/database.ts` to reduce file size and improve boundaries by splitting IPC handlers into modules:
  - `projects.handlers.ts`, `sessions.handlers.ts`, `tags.handlers.ts`, `settings.handlers.ts` (or similar).
- **Constraints**:
  - **Scope**: refactor only (no behavior changes).
  - **Non-goals**: changing IPC channel names.
- **Success criteria**:
  - **Behavior**: unchanged (tests prove it).
  - **Architecture**: each module exports a `registerXHandlers(...)` function; `setupDatabaseHandlers()` remains the single entry point.
  - **Tests**: `npm run test:electron -- --run` and `npm run test:all` pass.

### Task 7: Reduce cross-layer “stringly typed” IPC channel usage (contract hardening)

- **Task statement**: Centralize IPC channel names into a single `const` object/shared module and reuse it in both Electron and renderer boundary layers.
- **Constraints**:
  - **Scope**: only IPC channel naming/access; keep channel strings stable (no rename).
  - **Non-goals**: changing runtime wiring semantics.
- **Success criteria**:
  - **Type-level / contracts**: channel names are referenced from one place; fewer typos possible.
  - **Tests**: `npm run test:all` and `npm run test:electron -- --run` pass.

### Task 8: Consolidate time utilities (near-duplicate consolidation + call-site updates)

- **Task statement**: Identify and consolidate overlapping time utilities in `src/utils/time.ts` and `src/test-utils/time.ts` (or other near-duplicates) so production code uses one canonical utility, and tests use either the same functions or explicit test helpers.
- **Constraints**:
  - **Scope**: time helpers only.
  - **Non-goals**: changing displayed UI text/format unless explicitly required.
- **Success criteria**:
  - **Behavior**: unchanged.
  - **Architecture**: clear split between production utilities and test-only helpers (no accidental coupling).
  - **Tests**: `npm run test:all` passes.

### Task 9: Tighten error boundaries in `databaseService.persistAction` (core logic refactor)

- **Task statement**: Improve the type discipline and clarity in `src/state/services/databaseService.ts`:
  - make return types more intentional (e.g. a discriminated union or per-action mapping),
  - keep `DatabaseError` semantics intact.
- **Constraints**:
  - **Scope**: service logic + types; do not rewrite reducers.
  - **Non-goals**: new features.
- **Success criteria**:
  - **Behavior**: unchanged.
  - **Type-level**: less `unknown as` and fewer broad unions.
  - **Tests**: `npm run test:all` passes.

### Task 10: Normalize Date handling at the boundary (contract convergence)

- **Task statement**: Make the “string-from-SQLite” vs “Date-in-UI” boundary explicit and consistent. Decide where conversion happens and enforce it (ideally in one place).
- **Constraints**:
  - **Scope**: boundary contracts + mapping layer(s) only.
  - **Non-goals**: DB schema changes.
- **Success criteria**:
  - **Behavior**: unchanged.
  - **Contracts**: no ambiguous `Date | string` types leaking across layers.
  - **Tests**: `npm run test:all` and `npm run test:electron -- --run` pass.
