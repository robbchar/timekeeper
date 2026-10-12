# TimeKeeper v2 architecture

How v2 is put together and the rules that keep it that way. For running the app and what it does
for the user, see the [README](README.md). For the checklist when changing code, see
[CLAUDE.md](CLAUDE.md).

## Layers

```
core/                 timekeeper-core: pure Rust, owns SQLite
  ↑
src-tauri/src/lib.rs  thin #[tauri::command]s, tray, window, startup
  ↑  invoke()
src/api.ts            the only frontend file that calls the backend
  ↑
src/components/       React UI
```

- **`core`** holds every rule about the data: schema, migrations, the timer, totals and the v1
  import. It has no GUI dependencies and is tested on its own against in-memory SQLite. Its public
  surface is `Store` (`core/src/lib.rs`).
- **`src-tauri/src/lib.rs`** adapts `core` to the app. Each command locks the `Store`, calls `Store`
  methods (usually one), maps the error to a string and, if the timer changed, refreshes the tray.
  It also owns things only a desktop shell can decide: what time it is, what "local" means, where
  files live, the tray, the window and the heartbeat. Logic that could live in `core` belongs in
  `core`.
  A panic doesn't take the app down: builds must unwind (a `compile_error!` enforces it), a
  poisoned `Store` lock is recovered, the ticker survives a failed tick, and panics are appended
  to `<app data dir>/panic.log`. This is safe because every `Store` write is a single statement or
  a single transaction.
- **`src/api.ts`** is the single typed boundary. It is the only file under `src/` that imports
  `@tauri-apps/*`. Components and hooks import `api` and never call `invoke` themselves.
- Outside Tauri (`"__TAURI_INTERNALS__"` absent, e.g. `npm run dev` in a browser), `api.ts` routes
  every call to `src/mock.ts`, an in-memory backend with sample data. UI tests mock `./api` itself.

Rust types returned to the UI use `#[serde(rename_all = "camelCase")]`, and Tauri maps camelCase
command arguments (`projectId`) to snake_case parameters (`project_id`), so TypeScript stays
camelCase throughout.

## Data model

Defined in `core/src/schema.rs`.

| Table       | Holds                                                           |
| ----------- | --------------------------------------------------------------- |
| `projects`  | name, color, archived flag, `legacy_project_id` (v1 id, unique) |
| `entries`   | a project, a local day and notes; `legacy_session_id` (unique)  |
| `intervals` | `start_at`, `end_at` (NULL = running), `source`                 |
| `settings`  | key/value strings                                               |

- **An entry is a project + a local day + notes.** It has no duration column. `(project_id, day)`
  is not unique: the v1 import makes one entry per session, and `start` reuses the newest one.
- **An entry's duration is the sum of its intervals.** Nothing stores a total, so nothing can
  drift out of sync with the intervals.
- **An open interval is the running timer.** There is no separate "timer" state. The partial unique
  index `one_running_interval` (`ON intervals((1)) WHERE end_at IS NULL`) lets at most one interval
  in the whole database be open, so two timers cannot run even if the code has a bug.
- `source` is `timer`, `manual` or `import`, enforced by a `CHECK`.
- **Editing a duration edits intervals.** `set_entry_seconds` raises a total by adding a `manual`
  interval that ends where the entry's last interval ends (or at local noon on its day if it has
  none), and lowers it by trimming or deleting intervals from the latest end backwards, so a raise
  is undone before recorded time. It refuses a running entry and anything over 24 hours. A raise can overlap the entry's own intervals; only their sum is meaningful.
- **A project's color is a palette key** (`teal`, `coral`, …) from `PALETTE` in `core/src/lib.rs`,
  not a CSS color. The UI maps each key to a `--project-<key>` token in `src/styles.css`, with a
  light and a dark value. A new key needs a token too. `snapshot` sends `PALETTE` so the Settings
  picker lists the same keys `set_project_color` accepts. v1 colors aren't imported; imported
  projects get palette keys in order.
- **Archiving hides a project from the timer's picker, nothing else.** Its entries, history and
  totals filter are unchanged, and a running timer keeps running. The tray's Start skips archived
  projects (`resume_project_id`).
- Deleting a project cascades to its entries and their intervals.
- Deleting an entry cascades to its intervals. `delete_entry` refuses the running entry; stop the
  timer first.

Because the running timer is a row, a crash loses nothing. While timing, the shell writes a
heartbeat every 30 seconds (and `start` writes one at once); `heartbeat_at` is not updated while
idle. At startup, `recover_stale` closes any interval whose heartbeat is more than two minutes
old at the last heartbeat time, and the UI says so.

## Times and days

- **Instants are stored as UTC RFC 3339 strings** (`start_at`, `end_at`, `created_at`, …).
- **Days are local `YYYY-MM-DD` strings** (`entries.day`).
- **Only the shell decides what "now" and "local" mean.** `core` never reads the clock or the local
  time zone for its rules. `Store` methods take `now: DateTime<Utc>` and `today: NaiveDate`, and the
  import and `set_entry_seconds` take `local_day` / `local_noon` closures. The shell supplies them from `today()`, `local_day()` and `local_noon()` in
  `src-tauri/src/lib.rs`.
- This keeps `core` deterministic in tests. The import is the one place `core` calls
  `Utc::now()`: for the `v1_imported_at` setting and as `created_at` for v1 projects whose
  `createdAt` can't be parsed. Both are UTC and don't affect any day boundary.

## Migrations

`MIGRATIONS` in `core/src/schema.rs` is an ordered list of SQL steps. `PRAGMA user_version` records
how many have been applied. On open, `migrate` runs each pending step in its own transaction and
bumps `user_version` in that same transaction, so a failed step leaves the database untouched.

- Add a migration by **appending** to `MIGRATIONS`.
- **Never edit an applied migration.** Databases that already ran it won't run it again.
- There is no separate "create tables" schema: new databases run every migration from step 1.

## v1 import

`core/src/import.rs`, called by the shell from `open_store` at startup.

- **When it runs:** only when the v2 store is empty and the `v1_imported_at` setting is unset, and
  only if v1's database exists at `<config dir>/timekeeper/timekeeper.db`. It never runs from the UI.
- **Read-only:** the v1 file is opened with `SQLITE_OPEN_READ_ONLY`. v2 never writes to it.
- **One transaction:** the whole import commits or none of it does, and it sets `v1_imported_at`.
- **Mapping rules:** see the module doc in `import.rs`, the source of truth. In short, each v1
  session becomes one entry with one `import` interval of `startTime` + `duration`.
- **Safe to re-run:** rows are inserted with `INSERT OR IGNORE` keyed on the legacy ids, and
  duplicates are counted as `already_imported`.
- The result (or error) is passed to the UI in `Startup` and shown once.

## Settings

Settings are rows in the `settings` table. The UI may only read and write the keys in `UI_SETTINGS`
in `src-tauri/src/lib.rs`:

| Key               | Values                            |
| ----------------- | --------------------------------- |
| `duration_format` | default `hms` (frontend)          |
| `date_format`     | default `iso` (frontend)          |
| `week_start`      | `sunday`; anything else is Monday |

`set_setting` rejects any other key but does not validate values, and `snapshot` returns only these.
Internal keys (`v1_imported_at`, `heartbeat_at`, `last_project_id`) share the table but are not
UI-writable.

## Shell behavior

- **Tray-first.** Closing the window hides it. The app quits only from the tray menu.
- **Quitting stops the timer** at that moment, so the timer never runs while the app is closed.
- **Single instance.** Launching again shows the existing window.
- **Indicators.** While timing, the tray icon gets a red dot. On Windows the taskbar button gets an
  overlay badge.
- **Tray changes reach the UI** through the `timer-changed` event, which `api.onTimerChanged`
  subscribes to.
- The database lives at `<app data dir>/timekeeper.db` (identifier `dev.cathedraltree.timekeeper`).

## Debug overrides

Debug builds read these environment variables (`src-tauri/src/overrides.rs`); release builds ignore
them. An invalid value fails startup instead of being ignored.

| Variable              | Replaces                                         |
| --------------------- | ------------------------------------------------ |
| `TK_DATA_DIR`         | the app data dir                                 |
| `TK_V1_IMPORT_DB`     | the v1 database the first-run import reads       |
| `TK_HEARTBEAT_SECS`   | the 30-second heartbeat interval                 |
| `TK_STALE_AFTER_SECS` | the two-minute stale window `recover_stale` uses |

They exist for `scripts/smoke-windows.ts`. `TK_DATA_DIR` doesn't move WebView2's profile; the
script sets `WEBVIEW2_USER_DATA_FOLDER` for that. Single instance is keyed by the app identifier, not the
data dir, so an overridden run still hands off to any other running v2.
