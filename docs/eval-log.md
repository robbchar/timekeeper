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

|   # | Date | Task                                                                                                                                | Branch                 | Commits / PR | Reuse vs reinvention (0–2) | Correctness (0–2) | Completeness (0–2) | Architecture/boundaries (0–2) | Process quality (0–2) | Tests run (what + result) | Notes / notable failures / wins |
| --: | :--- | :---------------------------------------------------------------------------------------------------------------------------------- | :--------------------- | :----------- | -------------------------: | ----------------: | -----------------: | ----------------------------: | --------------------: | :------------------------ | :------------------------------ |
|   2 |      | Add a short ARCHITECTURE.md that documents the renderer↔IPC↔DB boundaries and where the canonical types/contracts live.           | `docs/architecture-md` |              |                          2 |                 2 |                  2 |                             2 |                     2 |                           |                                 |
|   3 |      | Consolidate repeated “DB Tag ↔ UI Tag” transformations into a shared helper (or small module) and reuse it across DatabaseContext. | `chore/tag-mappers`    |              |                          2 |                 2 |                  2 |                             2 |                     2 |                           |                                 |
|   4 |      |                                                                                                                                     | `eval-run-v1`          |              |                            |                   |                    |                               |                       |                           |                                 |
|   5 |      |                                                                                                                                     | `eval-run-v1`          |              |                            |                   |                    |                               |                       |                           |                                 |
|   6 |      |                                                                                                                                     | `eval-run-v1`          |              |                            |                   |                    |                               |                       |                           |                                 |
|   7 |      |                                                                                                                                     | `eval-run-v1`          |              |                            |                   |                    |                               |                       |                           |                                 |
|   8 |      |                                                                                                                                     | `eval-run-v1`          |              |                            |                   |                    |                               |                       |                           |                                 |
|   9 |      |                                                                                                                                     | `eval-run-v1`          |              |                            |                   |                    |                               |                       |                           |                                 |
|  10 |      |                                                                                                                                     | `eval-run-v1`          |              |                            |                   |                    |                               |                       |                           |                                 |

## Protocol deviations (optional)

Track anything that would bias scores (good or bad):

- **Skipped exploration**: changed code without requesting/reading source-of-truth files.
- **Skipped plan**: implemented without a 3–6 step plan, or did a sweeping rewrite.
- **Claimed tests**: claimed to run tests but didn’t, or ran the wrong suite.
- **Scope creep**: changed unrelated parts without agreement.
