# Evaluation Log

This file is a running log for the LLM-as-coding-partner evaluation tasks in this repository.

## How to use

- **One row per task**.
- Record the **commit(s)** produced for the task (or the PR number) so diffs are easy to review.
- Score each dimension **0–2**:
  - \(0\): missed / incorrect / not demonstrated
  - \(1\): partial / mixed quality
  - \(2\): strong / correct / disciplined

## Task log

|   # | Date | Task                                                                                                                                                                                                                                 | Branch                                  | Commits / PR | Reuse vs reinvention (0–2) | Correctness (0–2) | Completeness (0–2) | Architecture/boundaries (0–2) | Process quality (0–2) | Tests run (what + result)                    | Notes / notable failures / wins |
| --: | :--- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------- | :----------- | -------------------------: | ----------------: | -----------------: | ----------------------------: | --------------------: | :------------------------------------------- | :------------------------------ |
|   2 |      | Add a short `ARCHITECTURE.md` that documents the renderer↔IPC↔DB boundaries and where the canonical types/contracts live.                                                                                                          | `docs/architecture-md`                  |              |                          2 |                 2 |                  2 |                             2 |                     2 | succeeded                                    |                                 |
|   3 |      | Extract and reuse Tag mapping helpers (near-duplicate consolidation)                                                                                                                                                                 | `eval/task-3-tag-mapping`               |              |                          2 |                 2 |                  2 |                             2 |                     2 | very fast, quick thinking and implementation |                                 |
|   4 |      | Normalize how “writes that only need `{ changes }`” are represented/returned in renderer code (actions + `DatabaseContext` + state service), without breaking IPC.                                                                   | `eval/normalize-changes-only-response`  |              |                          2 |                 2 |                  2 |                             2 |                     2 |                                              |                                 |
|   5 |      | Add an IPC-backed `getProject(projectId)` method so the renderer can fetch a single project without fetching all projects and filtering.                                                                                             |                                         |              |                          2 |                 2 |                  2 |                             2 |                     2 |                                              |                                 |
|   6 |      | Refactor `electron/database/database.ts` to reduce file size and improve boundaries by splitting IPC handlers into modules: `projects.handlers.ts`, `sessions.handlers.ts`, `tags.handlers.ts`, `settings.handlers.ts` (or similar). | `eval/split-db-handlers-2025-11-27`     |              |                          2 |                 2 |                  2 |                             2 |                     2 |                                              |                                 |
|   7 |      | Centralize IPC channel names into a single `const` object/shared module and reuse it in both Electron and renderer boundary layers.                                                                                                  | `eval/ipc-channel-constants-2025-11-27` |              |                          2 |                 2 |                  2 |                             2 |                     2 |                                              |                                 |
|   8 |      |                                                                                                                                                                                                                                      | `eval-run-v1`                           |              |                            |                   |                    |                               |                       |                                              |                                 |
|   9 |      |                                                                                                                                                                                                                                      | `eval-run-v1`                           |              |                            |                   |                    |                               |                       |                                              |                                 |
|  10 |      |                                                                                                                                                                                                                                      | `eval-run-v1`                           |              |                            |                   |                    |                               |                       |                                              |                                 |

## Protocol deviations (optional)

Track anything that would bias scores (good or bad):

- **Skipped exploration**: changed code without requesting/reading source-of-truth files.
- **Skipped plan**: implemented without a 3–6 step plan, or did a sweeping rewrite.
- **Claimed tests**: claimed to run tests but didn’t, or ran the wrong suite.
- **Scope creep**: changed unrelated parts without agreement.
