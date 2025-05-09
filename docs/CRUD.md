## 🗂️ Project

| Operation | Description |
|----------|-------------|
| **Create** | Create a new project with a `name`, optional `description`, and metadata like `createdAt`. |
| **Read** | List all projects or fetch a project by `id`. |
| **Update** | Edit a project’s `name` or `description`. |
| **Delete** | Delete a project — optionally cascade delete or archive associated sessions. |

## ⏱️ Session

| Operation | Description |
|----------|-------------|
| **Create** | Start a session with a `startTime`, linked `projectId`, optional `notes`, and optional `tags`. You can also “resume” by copying the last session and updating `startTime`. |
| **Read** | Fetch sessions by date, project, or tag. Filter for daily/weekly/monthly logs. |
| **Update** | Modify `endTime`, `notes`, `tags`, or reassign to a different `projectId`. |
| **Delete** | Remove an individual session. |

## 🏷️ Tag

| Operation | Description |
|----------|-------------|
| **Create** | Add a new tag with a `name`, maybe a `color` or category. |
| **Read** | List tags or get tag usage statistics. |
| **Update** | Rename or change tag appearance. |
| **Delete** | Remove tag — either delete from all sessions or leave them orphaned. |

## ⚙️ Settings

| Operation | Description |
|----------|-------------|
| **Create** | Not usually “created” in the UI — just exists by default. |
| **Read** | Load app preferences like theme, time format, or default project. |
| **Update** | Modify preferences (e.g., switch to dark mode, change timer rounding rules). |
| **Delete** | Possibly reset to default (not traditional delete). |
