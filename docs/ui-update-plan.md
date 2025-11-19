<!-- 8a311ad8-40ee-4e0d-a480-d1407ec64b23 ab0ef61c-1a32-49c8-b30b-925e432e5239 -->

# Time Keeper UI Enhancements Plan

### Scope

Implement small UX fixes and a first-pass tags UX, without changing core data flows, focusing on:

- Remembering the selected project on the `Timer` tab while the app is open.
- Adding consistent delete confirmation dialogs.
- Fixing visual glitches in session time editing.
- Small copy and layout tweaks.
- Introducing styled, system-wide tags using HeroUI `Chip` components in project create/edit and Settings.

### 1. Remember selected project on `Timer` (in-memory only)

- Identify where the selected project is stored and passed to the `Timer` view (likely in `src/components/timer/*.tsx` and `src/contexts/ProjectsContext.tsx` or `AppContext.ts`).
- Add a `selectedProjectId` field in shared app or projects state (e.g., context or reducer in `src/state/reducers`), scoped to the current run only (no persistence to disk/DB).
- Update the Timer project dropdown component so that:
- On change, it updates `selectedProjectId` in context.
- On mount, it initializes its local value from `selectedProjectId` if present.
- Ensure that navigating between `Timer`, `Projects`, and `Settings` keeps `selectedProjectId` intact while the app remains open, so returning to `Timer` reuses the last selection.

### 2. Reusable delete confirmation dialog

- Inspect existing confirm dialog component (likely `src/components/ConfirmModal.tsx`) and current delete flows in `Timer` sessions list and the Projects list.
- Generalize `ConfirmModal` (if needed) to accept props like `title`, `message`, `confirmLabel`, `cancelLabel`, and `onConfirm`.
- Refactor session delete actions in timer-related components (e.g., `src/components/timer/*`) to:
- Open `ConfirmModal` when the trash/delete icon is clicked.
- Only call the underlying delete function if the user confirms.
- Refactor project delete actions in project-related components (e.g., `src/components/projects/*`) to use the same `ConfirmModal` behavior.
- Ensure focus management and keyboard handling (Esc to cancel, Enter to confirm) are sensible and consistent.

### 3. Fix duplicate time-edit arrows on session edit

- Locate the session edit UI (likely a modal or inline editor in `src/components/timer/*`, e.g. an `EditSessionModal` or similar component).
- Inspect how the up/down arrow controls are rendered and wired; identify why two overlapping/duplicated arrow hit areas appear on hover.
- Simplify to a single set of increment/decrement controls per unit (hours/minutes/seconds), removing duplicated icons or event handlers.
- Verify that:
- Hover/active styles look consistent with the existing UI.
- Keyboard input (if supported) still works.
- No regression in validation or time parsing.

### 4. Copy and layout tweaks

- Update the notes placeholder in the Timer view:
- Change any `"Add notes..."` placeholder (in `src/components/timer/*`) to `"Add notes for session..."`.
- Project stats in the Projects list:
- In the project card component (likely in `src/components/projects/*`):
- Remove the existing `Project Stats` collapsible section label from the bottom of the card.
- Always show the stats content previously inside the expanded area (`Total Time`, `Sessions`) as a simple stats row/section under the project name when the card is expanded.
- Introduce a new collapse/expand affordance at the level of the project header (near the project name), so that:
- When expanded: project name, creation date, controls, and stats are visible.
- When collapsed: the card shows only the project name (and optionally creation date), hiding stats and secondary details.
- Maintain visual consistency with the existing card style (padding, background, typography) and side navigation look from your screenshots.

### 5. Tags: system-wide management and project association

- Review existing tag types and DB support (`src/types/tag.ts`, `src/types/project.ts`, and relevant electron/database files) to understand how tags are stored and related to projects.
- Define a simple, system-wide tag model if not already clear (e.g., `id`, `name`, optional `color`) and ensure the backend already supports CRUD or plan a minimal extension later if needed.

#### 5.1 Settings page: tag management

- Locate or create a Settings view component (likely under `src/components/layout` or similar).
- Add a **Tag Management** section that:
- Lists all existing tags as HeroUI `Chip`s, using color/variant styling to make them visually distinct (e.g., `variant="flat"` with subtle colors matching the app theme).
- Provides affordances to add a new tag (simple inline input + “Add” button) and to rename or delete tags (e.g., edit icon or using the `onClose` behavior of `Chip` for delete, wrapped in the same `ConfirmModal` from step 2).
- Wire the Settings tag CRUD actions into the existing tag data layer (context/service functions in `src/state/services` or DB context), ensuring changes are reflected app-wide.

#### 5.2 Project create/edit: display and select tags

- In the project create/edit form component (used by the Projects tab and possibly the Timer when selecting/creating a project):
- Fetch the list of system-wide tags from context/service.
- Add a **Tags** field that shows available tags as selectable HeroUI `Chip`s (multi-select, visually styled as chosen vs unchosen).
- When saving a project, store the association to the selected tags in the existing project data model.
- In the Projects list and project detail card:
- Display a project’s tags as a row of small `Chip`s under the project name/stats, using a subdued style so they read as metadata.
- In the Timer view:
- When a project is selected, optionally show its tags near the project selector or under the project title, reinforcing the metadata without adding new behavior yet.

### 6. Testing and polish

- Add or update unit tests / component tests where present (e.g., `App.test.tsx`, context tests, or any existing tests under `src/components` and `src/contexts`) to cover:
- Project selection being remembered across route/tab changes within a single run.
- Delete flows invoking confirmation and only deleting on confirm for sessions and projects.
- Correct rendering of a single set of time-edit controls.
- Tag rendering and selection in project forms and the Settings page.
- Manually verify flows against the existing UI:
- Navigating between `Timer`, `Projects`, and `Settings` while preserving Timer’s selected project.
- Creating/editing tags in Settings and seeing them appear in project forms and project details.
- Deleting sessions/projects via confirmation dialog and cancelling without side effects.

If this plan looks good, I’ll proceed by inspecting the concrete components/contexts mentioned above and then start implementing the changes step by step in the codebase.

### To-dos

- [ ] Add in-memory selected project persistence for the Timer tab via shared state/context and update the Timer project dropdown accordingly.
- [ ] Unify delete behavior for sessions and projects using a reusable confirmation modal component.
- [ ] Fix duplicate up/down arrow controls in the session edit time UI so only one set appears per time unit.
- [ ] Apply text/copy tweaks and rework the Project Stats collapse behavior on project cards.
- [ ] Implement system-wide tag management in Settings and surface tags in project create/edit forms and project detail views using HeroUI chips.
