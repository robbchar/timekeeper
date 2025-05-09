# ⏱️ Time Tracking App — UI Structure & Pages

## 📄 Pages

### 1. **Timer Page**
Primary interface for starting, stopping, and viewing work sessions.

- **Components:**
  - `<TimerPanel />`: Main timer interface
    - Start/Stop button
    - Project dropdown
    - Description field
  - `<SessionList />`: View previous sessions
    - Lists sessions with time, project, description
    - Edit/Delete actions
  - `<EditSessionModal />`: Edit session details (popped from list)
  - `<NowRunningBar />` (optional): Persistent small timer/status

---

### 2. **Projects Page**
Dedicated interface for project management (add/edit/delete).

- **Components:**
  - `<ProjectList />`: Shows existing projects
    - Name, color/label, or category (TBD)
    - Edit/Delete buttons
  - `<AddProjectForm />`: Create new project
  - `<EditProjectModal />`: Modify existing project details

---

## 💻 UI Components

### `<TimerPanel />`
- Central timer logic
- Displays elapsed time
- Requires a selected project to start
- Optional description input
- Auto-saves on stop

### `<ProjectDropdown />`
- Used in `<TimerPanel />`
- Shows selectable projects
- Inline option to “+ Add Project…”

### `<SessionList />`
- Scrollable or toggleable under timer
- Past sessions (chronological)
- Edit and Delete buttons

### `<EditSessionModal />`
- Modal dialog for editing sessions
- Can update project, start/end time, and description

### `<AppShell />`
- Shared layout for all pages
- Minimal sidebar or top nav
- Room to expand (e.g., add "Reports" later)

---

## 🎨 Style & Design

- **UI Library:** [Heroui](https://heroui.dev/)
- **State Management:** React Context API + Reducers
- **Styling:** Probably styled-components (or CSS modules, TBD)
- **Theme:** Simple light/dark mode, responsive layout

---

## 📦 Tech Stack Summary

- **Platform:** Electron
- **UI:** React + Heroui
- **Language:** TypeScript
- **Bundler:** Vite
- **DB:** SQLite (local persistence)
- **Testing:** Vitest + Testing Library
- **Date utils:** date-fns
