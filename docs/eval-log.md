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

|   # | Date | Task                                                                                                                                                           | Branch                     | Commits / PR | Reuse vs reinvention (0–2) | Correctness (0–2) | Completeness (0–2) | Architecture/boundaries (0–2) | Process quality (0–2) | Tests run (what + result) | Notes / notable failures / wins              |
| --: | :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- | :----------- | -------------------------: | ----------------: | -----------------: | ----------------------------: | --------------------: | :------------------------ | :------------------------------------------- |
|   2 |      | Align docs and architecture with reality (lightweight)                                                                                                         | `docs/architecture`        |              |                          - |                 2 |                  2 |                             2 |                     2 |                           | identified that it did not need to run tests |
|   3 |      | Extract and reuse Tag mapping helpers (near-duplicate consolidation)                                                                                           | `chore/tag-mapping-helper` | 2            |                          2 |                 2 |                  2 |                             2 |                       | npm test -- --run         |                                              |
|   4 |      | Normalize how “writes that only need { changes }” are represented/returned in renderer code (actions + DatabaseContext + state service), without breaking IPC. | `eval-task4-changes-only`  |              |                          2 |                 2 |                  2 |                             2 |                     2 |                           |                                              |
|   5 |      |                                                                                                                                                                | `eval-run-v1`              |              |                            |                   |                    |                               |                       |                           |                                              |
|   6 |      |                                                                                                                                                                | `eval-run-v1`              |              |                            |                   |                    |                               |                       |                           |                                              |
|   7 |      |                                                                                                                                                                | `eval-run-v1`              |              |                            |                   |                    |                               |                       |                           |                                              |
|   8 |      |                                                                                                                                                                | `eval-run-v1`              |              |                            |                   |                    |                               |                       |                           |                                              |
|   9 |      |                                                                                                                                                                | `eval-run-v1`              |              |                            |                   |                    |                               |                       |                           |                                              |
|  10 |      |                                                                                                                                                                | `eval-run-v1`              |              |                            |                   |                    |                               |                       |                           |                                              |

## Protocol deviations (optional)

Track anything that would bias scores (good or bad):

- **Skipped exploration**: changed code without requesting/reading source-of-truth files.
- **Skipped plan**: implemented without a 3–6 step plan, or did a sweeping rewrite.
- **Claimed tests**: claimed to run tests but didn’t, or ran the wrong suite.
- **Scope creep**: changed unrelated parts without agreement.
