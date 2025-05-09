# Time Tracking App - Data Models

## 1. Project Model
Each project will have the following attributes:
- **ID**: Unique identifier for the project.
- **Name**: Name of the project (e.g., "Client Website", "Internal Tool").
- **Description**: Short description of what the project is about.
- **Color**: Color to visually distinguish the project (this could be a color hex code).
- **CreatedAt**: Timestamp for when the project was created.

### Table: `projects`

| Column Name     | Type        | Description                               |
|-----------------|-------------|-------------------------------------------|
| `id`            | INTEGER     | Primary key, auto-incremented             |
| `name`          | TEXT        | Project name                             |
| `description`   | TEXT        | Short description of the project         |
| `color`         | TEXT        | Hex code for the project’s visual color  |
| `created_at`    | DATETIME    | Timestamp when the project was created   |

---

## 2. Session Model
A session will track the time spent on each project. It will be linked to a **Project** and will store the duration of work. 

- **ID**: Unique identifier for the session.
- **ProjectID**: The ID of the project that the session is related to.
- **StartTime**: The timestamp of when the session started.
- **EndTime**: The timestamp of when the session ended.
- **Duration**: Duration in seconds or minutes (you could store this as a calculated field, or save it directly).

### Table: `sessions`

| Column Name     | Type        | Description                               |
|-----------------|-------------|-------------------------------------------|
| `id`            | INTEGER     | Primary key, auto-incremented             |
| `project_id`    | INTEGER     | Foreign key to `projects.id`              |
| `start_time`    | DATETIME    | Timestamp when the session started       |
| `end_time`      | DATETIME    | Timestamp when the session ended         |
| `duration`      | INTEGER     | Duration in seconds (or minutes)          |

---

## 3. AppState Model
We can store **app-wide preferences** in the SQLite database too, such as whether the user prefers dark mode or other simple settings.

- **ID**: Unique identifier for the state entry.
- **Key**: The setting name (e.g., "dark_mode").
- **Value**: The value of the setting (e.g., `true` or `false` for dark mode).

### Table: `app_state`

| Column Name     | Type        | Description                               |
|-----------------|-------------|-------------------------------------------|
| `id`            | INTEGER     | Primary key, auto-incremented             |
| `key`           | TEXT        | Setting name (e.g., "dark_mode")          |
| `value`         | TEXT        | Setting value (e.g., "true", "false")     |

---

## 4. Database Structure Overview

To make the SQLite database functional, the relationships between the **Project** and **Session** models are important:
- **One-to-many relationship**: A project can have many sessions, but each session belongs to only one project.

### SQLite Schema

```sql
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    duration INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE app_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    value TEXT NOT NULL
);
