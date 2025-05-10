## 🧠 Planning

- [x] Decide on goal: personal time tracking with streamlined use case
- [x] Choose tech stack:
  - Electron
  - React
  - TypeScript
  - Heroui
  - SQLite
  - Vite
  - Vitest + React Testing Library
  - date-fns
  - Context API with reducer/actions
  - styled-components

## 📐 Design & Structure

- [x] Identify core data models:

  - Project
  - Session
  - Tag
  - Settings

- [x] Identify key pages/components:
  - Timer
  - Projects
  - Tags
  - Settings
  - Timeline (optional)
  - Export (basic)

## ⚙️ Functionality Definition

- [x] Define CRUD operations for each model
- [x] Prioritize features (core vs optional vs advanced)

## 🧪 Dev Environment Setup

- [x] Bootstrap Electron app with Vite + React + TypeScript
- [x] Wire up testing framework (Vitest + RTL)
- [x] Set up SQLite schema and data access layer
- [x] Add Context-based state management with reducer logic

## 🧰 UI Scaffolding

### Layout

- [x] Build base layout:
  - [x] Sidebar navigation (Timer, Projects, Settings)
  - [x] Header with project switcher or clock
  - [x] Main content area

### Timer Page

- [x] Add live timer display and controls (Start, Stop, Resume)
- [x] Show current session details (project, optional notes/tags)
- [ ] Add note field and tag selector
- [ ] List today's or active session history
- [ ] Session controls: edit/delete/resume past sessions

### Projects Page

- [x] Display list of all projects
- [x] Add new project form
- [x] Edit project name/description
- [x] Delete project (with confirm)
- [x] (Optional) Project usage stats

### Tags Component

- [ ] Create modal or dropdown for tag selection
- [ ] Allow tag creation (inline or in a separate view)
- [ ] Associate tags with sessions
- [ ] Optional: assign colors or categories to tags

### Settings Panel

- [ ] UI theme (light/dark toggle)
- [ ] Default project
- [ ] Time format (12/24h)
- [ ] Timer rounding options (e.g., nearest 5 min)

### Timeline View (Optional)

- [ ] Implement visual timeline (using a lib or simple blocks)
- [ ] Filter by project, tag, or date
- [ ] Allow zoom or scroll through history

### Export View

- [ ] Basic data export to CSV or JSON
- [ ] Filters for date range or project
- [ ] Trigger download of exported data

## 🧼 Final Cleanup & Delivery

- [ ] Add error handling and fallback UI
- [ ] Finalize styles with styled-components + Heroui
- [ ] Build Electron app for distribution
- [ ] Add simple README and usage instructions
