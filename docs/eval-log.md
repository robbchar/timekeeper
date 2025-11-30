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

|   # | Date | Task                                                                                                                                                                                | Branch                           | Commits / PR | Reuse vs reinvention (0–2) | Correctness (0–2) | Completeness (0–2) | Architecture/boundaries (0–2) | Process quality (0–2) | Tests run (what + result) | Notes / notable failures / wins                                          |
| --: | :--- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------- | :----------- | -------------------------: | ----------------: | -----------------: | ----------------------------: | --------------------: | :------------------------ | :----------------------------------------------------------------------- |
|   2 |      | Add a short ARCHITECTURE.md that documents the renderer↔IPC↔DB boundaries and where the canonical types/contracts live.                                                           | `docs/architecture-md`           |              |                          2 |                 2 |                  2 |                             2 |                     2 |                           |                                                                          |
|   3 |      | Consolidate repeated “DB Tag ↔ UI Tag” transformations into a shared helper (or small module) and reuse it across DatabaseContext.                                                 | `chore/tag-mappers`              |              |                          2 |                 2 |                  2 |                             2 |                     2 |                           |                                                                          |
|   4 |      | Normalize how “writes that only need { changes }” are represented/returned in renderer code (actions + DatabaseContext + state service), without breaking IPC.                      | `eval-d-normalize-changes-only`  |              |                          2 |                 2 |                  2 |                             2 |                     1 |                           | It didnt create a new branch, justifying by saying I didnt ask for that. |
|   5 |      | Add an IPC-backed getProject(projectId) method so the renderer can fetch a single project without fetching all projects and filtering.                                              | `feat/ipc-get-project`           |              |                          2 |                 2 |                  2 |                             2 |                     2 |                           |                                                                          |
|   6 |      | Refactor electron/database/database.ts to reduce file size and improve boundaries by splitting IPC handlers into modules (projects/sessions/tags/settings handlers, or similar).    | `refactor/split-db-ipc-handlers` |              |                          2 |                 2 |                  2 |                             2 |                     2 |                           |                                                                          |
|   7 |      | Centralize IPC channel names into a single const object/shared module and reuse it in both Electron and renderer boundary layers (keep the strings stable; do not rename channels). | `chore/ipc-channels-centralize`  |              |                          2 |                 2 |                  2 |                             2 |                     2 |                           |                                                                          |
|   8 |      |                                                                                                                                                                                     | `eval-run-v1`                    |              |                            |                   |                    |                               |                       |                           |                                                                          |
|   9 |      |                                                                                                                                                                                     | `eval-run-v1`                    |              |                            |                   |                    |                               |                       |                           |                                                                          |
|  10 |      |                                                                                                                                                                                     | `eval-run-v1`                    |              |                            |                   |                    |                               |                       |                           |                                                                          |

## Protocol deviations (optional)

Track anything that would bias scores (good or bad):

- **Skipped exploration**: changed code without requesting/reading source-of-truth files.
- **Skipped plan**: implemented without a 3–6 step plan, or did a sweeping rewrite.
- **Claimed tests**: claimed to run tests but didn’t, or ran the wrong suite.
- **Scope creep**: changed unrelated parts without agreement.
