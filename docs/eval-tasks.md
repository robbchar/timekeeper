# Evaluation Tasks

This document defines the **task suite** used to evaluate an LLM as a coding partner in this repo.

## Protocol prompt (copy/paste into a new chat)

Use this as the first message for each task. Replace the **Task** / **Constraints** / **Success criteria** sections.

---

We’re working in a **single-package, multi-layer TypeScript codebase** (Electron + React + SQLite).

**Task:**

- **Task statement**: <replace>

**Constraints:**

- **Scope**: <replace>
- **Non-goals**: <replace>
- **Compatibility**: keep existing behavior unless explicitly requested

**Success criteria:**

- **Behavior**: <replace>
- **Type-level / contracts**: <replace>

**Methodology:**

- **Git**: create a new branch for your work using branch `eval-c` as the base; commit in small, focused commits. Don't worry about creating a PR.
- **Before edits**: list the files you will inspect first (**max 8**) and where you think the source-of-truth is.
- **Design**: propose a **3–5 step plan** and call out suspected near-duplicates.
- **During implementation**: make small, focused changes; avoid sweeping rewrites.
- **Evidence at end**: tests run (**commands + result**) _or_ explicitly say “tests not run” and why.
- **Docs**: if you introduce new concepts/contracts, update docs as needed. If anything is commented to be done, prefix it with `TODO`.

**Initial context bundle (entry points):**

- Architecture: `ARCHITECTURE.md`
- Renderer entry: `src/main.tsx`, `src/App.tsx`
- Renderer DB boundary: `src/contexts/DatabaseContext.tsx`, `src/state/services/databaseService.ts`
- Shared DB contract types: `src/types/database.ts`, `src/types/database-response.ts`
- Electron entry: `electron/main.ts`, `electron/preload.ts`
- IPC mapping: `electron/helpers.ts`
- DB + migrations: `electron/database/database.ts`, `electron/database/db-migrate.ts`, `electron/database/migrations/`
- Tests: `vitest.config.ts`, `vitest.electron.config.ts`, `vitest.database.config.ts`

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
- **Tests** (optional depending on your methodology):
  - Typical: `npm run test:all`
  - Electron-only focus: `npm run test:electron -- --run`
  - DB-focused: `npm run test:db -- --run`
- **Suggested initial files** (optional):

Copy/paste prompt skeleton:

```text
We’re working in a single-package, multi-layer TypeScript codebase (Electron + React + SQLite).

Task:
- Task statement: <replace>

Constraints:
- Scope: <replace>
- Non-goals: <replace>
- Compatibility: keep existing behavior unless explicitly requested

Success criteria:
- Behavior: <replace>
- Type-level / contracts: <replace>

Methodology:
- Git: create a new branch for your work using branch eval-c as the base; commit in small, focused commits. Don't worry about creating a PR.
- Before edits: list the files you will inspect first (max 8) and where you think the source-of-truth is.
- Design: propose a 3–5 step plan and call out suspected near-duplicates.
- During implementation: make small, focused changes; avoid sweeping rewrites.
- Evidence at end: tests run (commands + result) or explicitly say “tests not run” and why.

Initial context bundle (entry points):
- Architecture: ARCHITECTURE.md
- Renderer entry: src/main.tsx, src/App.tsx
- Renderer DB boundary: src/contexts/DatabaseContext.tsx, src/state/services/databaseService.ts
- Shared DB contract types: src/types/database.ts, src/types/database-response.ts
- Electron entry: electron/main.ts, electron/preload.ts
- IPC mapping: electron/helpers.ts
- DB + migrations: electron/database/database.ts, electron/database/db-migrate.ts, electron/database/migrations/
- Tests: vitest.config.ts, vitest.electron.config.ts, vitest.database.config.ts
```

## Proposed task suite (draft)

These are designed so the “shortest good solution” requires **reusing existing abstractions**, reconciling **near-duplicates**, and touching **multiple call sites/layers**.

### Task 2: Align docs and architecture with reality (lightweight)

Copy/paste prompt:

```text
We’re working in a single-package, multi-layer TypeScript codebase (Electron + React + SQLite).

Task:
- Task statement: Add a short ARCHITECTURE.md that documents the renderer↔IPC↔DB boundaries and where the canonical types/contracts live.

Constraints:
- Scope: docs-only (no behavior changes)
- Non-goals: re-architecting code
- Compatibility: keep existing behavior

Success criteria:
- Behavior: unchanged
- Type-level / contracts: N/A (docs-only)

Methodology:
- Git: create a new branch for your work using branch eval-c as the base; commit in small, focused commits. Don't worry about creating a PR.
- Before edits: list the files you will inspect first (max 8) and where you think the source-of-truth is.
- Design: propose a 3–5 step plan and call out suspected near-duplicates.
- During implementation: make small, focused changes; avoid sweeping rewrites.
- Evidence at end: tests run (commands + result) or explicitly say “tests not run” and why.
- Docs: if you introduce new concepts/contracts, update docs as needed. If anything is commented to be done, prefix it with TODO.

Context: you are not given an entry-point bundle; you must request files as needed.
```

### Task 3: Extract and reuse Tag mapping helpers (near-duplicate consolidation)

Copy/paste prompt:

```text
We’re working in a single-package, multi-layer TypeScript codebase (Electron + React + SQLite).

Task:
- Task statement: Consolidate repeated “DB Tag ↔ UI Tag” transformations into a shared helper (or small module) and reuse it across DatabaseContext.

Constraints:
- Scope: DatabaseContext mapping code only; do not change DB schema.
- Non-goals: UI redesign.
- Compatibility: keep existing behavior

Success criteria:
- Behavior: unchanged for tag creation, listing, updating, project-tag listing.
- Type-level / contracts: mapping is type-safe and lives in one place.

Methodology:
- Git: create a new branch for your work using branch eval-c as the base; commit in small, focused commits. Don't worry about creating a PR.
- Before edits: list the files you will inspect first (max 8) and where you think the source-of-truth is.
- Design: propose a 3–5 step plan and call out suspected near-duplicates.
- During implementation: make small, focused changes; avoid sweeping rewrites.
- Evidence at end: tests run (commands + result) or explicitly say “tests not run” and why.
- Docs: if you introduce new concepts/contracts, update docs as needed. If anything is commented to be done, prefix it with TODO.

Context: you are not given an entry-point bundle; you must request files as needed.
```

### Task 4: Introduce a single “changes-only” response shape in renderer (contract convergence)

Copy/paste prompt:

```text
We’re working in a single-package, multi-layer TypeScript codebase (Electron + React + SQLite).

Task:
- Task statement: Normalize how “writes that only need { changes }” are represented/returned in renderer code (actions + DatabaseContext + state service), without breaking IPC.

Constraints:
- Scope: renderer interfaces and call sites; keep Electron IPC return values as-is unless needed.
- Non-goals: changing underlying DB queries.
- Compatibility: keep existing behavior

Success criteria:
- Behavior: unchanged.
- Type-level / contracts: fewer ad-hoc { changes: result.changes } conversions; no any.

Methodology:
- Git: create a new branch for your work using branch eval-c as the base; commit in small, focused commits. Don't worry about creating a PR.
- Before edits: list the files you will inspect first (max 8) and where you think the source-of-truth is.
- Design: propose a 3–5 step plan and call out suspected near-duplicates.
- During implementation: make small, focused changes; avoid sweeping rewrites.
- Evidence at end: tests run (commands + result) or explicitly say “tests not run” and why.
- Docs: if you introduce new concepts/contracts, update docs as needed. If anything is commented to be done, prefix it with TODO.

Context: you are not given an entry-point bundle; you must request files as needed.
```

### Task 5: Add a `getProject(projectId)` IPC call (cross-layer addition)

Copy/paste prompt:

```text
We’re working in a single-package, multi-layer TypeScript codebase (Electron + React + SQLite).

Task:
- Task statement: Add an IPC-backed getProject(projectId) method so the renderer can fetch a single project without fetching all projects and filtering.

Constraints:
- Scope: update DatabaseAPI type, preload (makeDbShape), Electron handler, and DatabaseContext.
- Non-goals: changing UI flows beyond eliminating unnecessary getProjects() calls.
- Compatibility: keep existing behavior

Success criteria:
- Behavior: DatabaseContext.getProject performs a single-project fetch via IPC.
- Type-level / contracts: src/types/database.ts matches electron/helpers.ts exposed shape and electron/database/database.ts handlers.

Methodology:
- Git: create a new branch for your work using branch eval-c as the base; commit in small, focused commits. Don't worry about creating a PR.
- Before edits: list the files you will inspect first (max 8) and where you think the source-of-truth is.
- Design: propose a 3–5 step plan and call out suspected near-duplicates.
- During implementation: make small, focused changes; avoid sweeping rewrites.
- Evidence at end: tests run (commands + result) or explicitly say “tests not run” and why.
- Docs: if you introduce new concepts/contracts, update docs as needed. If anything is commented to be done, prefix it with TODO.

Context: you are not given an entry-point bundle; you must request files as needed.
```

### Task 6: Split `setupDatabaseHandlers` into focused modules (meaty extraction)

Copy/paste prompt:

```text
We’re working in a single-package, multi-layer TypeScript codebase (Electron + React + SQLite).

Task:
- Task statement: Refactor electron/database/database.ts to reduce file size and improve boundaries by splitting IPC handlers into modules (projects/sessions/tags/settings handlers, or similar).

Constraints:
- Scope: refactor only (no behavior changes).
- Non-goals: changing IPC channel names.
- Compatibility: keep existing behavior

Success criteria:
- Behavior: unchanged.
- Type-level / contracts: boundaries are clearer (each module exports a registerXHandlers(...) function; setupDatabaseHandlers() remains the single entry point).

Methodology:
- Git: create a new branch for your work using branch eval-c as the base; commit in small, focused commits. Don't worry about creating a PR.
- Before edits: list the files you will inspect first (max 8) and where you think the source-of-truth is.
- Design: propose a 3–5 step plan and call out suspected near-duplicates.
- During implementation: make small, focused changes; avoid sweeping rewrites.
- Evidence at end: tests run (commands + result) or explicitly say “tests not run” and why.
- Docs: if you introduce new concepts/contracts, update docs as needed. If anything is commented to be done, prefix it with TODO.

Context: you are not given an entry-point bundle; you must request files as needed.
```

### Task 7: Reduce cross-layer “stringly typed” IPC channel usage (contract hardening)

Copy/paste prompt:

```text
We’re working in a single-package, multi-layer TypeScript codebase (Electron + React + SQLite).

Task:
- Task statement: Centralize IPC channel names into a single const object/shared module and reuse it in both Electron and renderer boundary layers (keep the strings stable; do not rename channels).

Constraints:
- Scope: only IPC channel naming/access; keep channel strings stable (no rename).
- Non-goals: changing runtime wiring semantics.
- Compatibility: keep existing behavior

Success criteria:
- Behavior: unchanged.
- Type-level / contracts: channel names are referenced from one place; fewer typos possible.

Methodology:
- Git: create a new branch for your work using branch eval-c as the base; commit in small, focused commits. Don't worry about creating a PR.
- Before edits: list the files you will inspect first (max 8) and where you think the source-of-truth is.
- Design: propose a 3–5 step plan and call out suspected near-duplicates.
- During implementation: make small, focused changes; avoid sweeping rewrites.
- Evidence at end: tests run (commands + result) or explicitly say “tests not run” and why.
- Docs: if you introduce new concepts/contracts, update docs as needed. If anything is commented to be done, prefix it with TODO.

Context: you are not given an entry-point bundle; you must request files as needed.
```

### Task 8: Consolidate time utilities (near-duplicate consolidation + call-site updates)

Copy/paste prompt:

```text
We’re working in a single-package, multi-layer TypeScript codebase (Electron + React + SQLite).

Task:
- Task statement: Identify and consolidate overlapping time utilities in src/utils/time.ts and src/test-utils/time.ts (or other near-duplicates) so production code uses one canonical utility, and tests use either the same functions or explicit test helpers.

Constraints:
- Scope: time helpers only.
- Non-goals: changing displayed UI text/format unless explicitly required.
- Compatibility: keep existing behavior

Success criteria:
- Behavior: unchanged.
- Type-level / contracts: clear split between production utilities and test-only helpers (no accidental coupling).

Methodology:
- Git: create a new branch for your work using branch eval-c as the base; commit in small, focused commits. Don't worry about creating a PR.
- Before edits: list the files you will inspect first (max 8) and where you think the source-of-truth is.
- Design: propose a 3–5 step plan and call out suspected near-duplicates.
- During implementation: make small, focused changes; avoid sweeping rewrites.
- Evidence at end: tests run (commands + result) or explicitly say “tests not run” and why.
- Docs: if you introduce new concepts/contracts, update docs as needed. If anything is commented to be done, prefix it with TODO.

Context: you are not given an entry-point bundle; you must request files as needed.
```

### Task 9: Tighten error boundaries in `databaseService.persistAction` (core logic refactor)

Copy/paste prompt:

```text
We’re working in a single-package, multi-layer TypeScript codebase (Electron + React + SQLite).

Task:
- Task statement: Improve the type discipline and clarity in src/state/services/databaseService.ts (make return types more intentional, keep DatabaseError semantics intact).

Constraints:
- Scope: service logic + types; do not rewrite reducers.
- Non-goals: new features.
- Compatibility: keep existing behavior

Success criteria:
- Behavior: unchanged.
- Type-level / contracts: less unknown-as and fewer broad unions.

Methodology:
- Git: create a new branch for your work using branch eval-c as the base; commit in small, focused commits. Don't worry about creating a PR.
- Before edits: list the files you will inspect first (max 8) and where you think the source-of-truth is.
- Design: propose a 3–5 step plan and call out suspected near-duplicates.
- During implementation: make small, focused changes; avoid sweeping rewrites.
- Evidence at end: tests run (commands + result) or explicitly say “tests not run” and why.
- Docs: if you introduce new concepts/contracts, update docs as needed. If anything is commented to be done, prefix it with TODO.

Context: you are not given an entry-point bundle; you must request files as needed.
```

### Task 10: Normalize Date handling at the boundary (contract convergence)

Copy/paste prompt:

```text
We’re working in a single-package, multi-layer TypeScript codebase (Electron + React + SQLite).

Task:
- Task statement: Make the “string-from-SQLite” vs “Date-in-UI” boundary explicit and consistent. Decide where conversion happens and enforce it (ideally in one place).

Constraints:
- Scope: boundary contracts + mapping layer(s) only.
- Non-goals: DB schema changes.
- Compatibility: keep existing behavior

Success criteria:
- Behavior: unchanged.
- Type-level / contracts: no ambiguous Date | string types leaking across layers.

Methodology:
- Git: create a new branch for your work using branch eval-c as the base; commit in small, focused commits. Don't worry about creating a PR.
- Before edits: list the files you will inspect first (max 8) and where you think the source-of-truth is.
- Design: propose a 3–5 step plan and call out suspected near-duplicates.
- During implementation: make small, focused changes; avoid sweeping rewrites.
- Evidence at end: tests run (commands + result) or explicitly say “tests not run” and why.
- Docs: if you introduce new concepts/contracts, update docs as needed. If anything is commented to be done, prefix it with TODO.

Context: you are not given an entry-point bundle; you must request files as needed.
```
