# Backlog

Unbuilt intentions, rescued from the early planning docs when they were removed on
2026-09-16. Anything here is a candidate, not a commitment.

Ordered by how much of the groundwork already exists.

## Half-built — schema or types exist, no UI

These are the cheap ones. The data layer landed; nothing surfaces it.

| Item                        | What exists                                                                                            | What's missing                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Project color picker        | `projects.color` column, `Project.color` in `src/types/project.ts`                                     | No color input in `ProjectsPage.tsx`; the column is never written                                                   |
| Project description editing | `projects.description` column, field on the domain type                                                | Only the name is editable                                                                                           |
| Light/dark theme toggle     | `darkTheme` in `src/styles/theme.ts`, working `TOGGLE_THEME` case in `src/state/reducers/uiReducer.ts` | Nothing calls `toggleTheme` except its own test                                                                     |
| Settings UI                 | `timeFormat` / `defaultProject` on the settings type, generic `getSetting`/`setSetting` IPC pair       | `SettingsPage.tsx` is a tag manager only — no settings controls at all                                              |
| Session tags                | `session_tags` table, migration 002 handling                                                           | No channel, handler, or `DatabaseAPI` method. See ARCHITECTURE.md — project tags are the only reachable tag surface |

## Not started

- **Export to CSV/JSON**, with date-range and per-project filters. No export code exists anywhere.
- **Session reports** — summaries over a date range.
- **Session filtering and sorting** in `RecentSessions.tsx`.
- **Timeline view** with filtering and zoom. No route for it.
- **Timer rounding** — round session durations to the nearest 5 minutes.
- **Error boundary / fallback UI.** There is no `ErrorBoundary` in the renderer; a throw during render takes the window blank.
- **Inline "+ Add Project…"** in the timer's project dropdown, so a session can start without visiting Projects first.

## Open questions

- **Persistent "Now Running" bar.** Appeared in the earliest layouts. The taskbar dot
  (`electron/timingIndicator.ts`) may have obsoleted the need — it answers "is it running"
  without taking screen space. Decide keep or drop rather than leaving it implied.
- **Header content.** An early checklist marked "header with project switcher or clock" as
  done, but `src/components/layout/Header.tsx` renders a static title. Dropped idea, or still wanted?
