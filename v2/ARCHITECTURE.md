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
  a single transaction. Startup is the exception: if setup fails (the store can't be opened,
  migrated or backed up first), a message box shows the error and the folders, and the app exits.
- **`src-tauri/src/linear.rs`** is the only code that makes network calls (see [Linear](#linear)),
  and **`src-tauri/src/keychain.rs`** keeps the Linear key in the OS credential store (Windows
  Credential Manager, or the Secret Service on Linux).
  **`src-tauri/src/suggest.rs`** gathers note suggestions, one group per source a project has
  turned on (only Linear so far; merged GitHub PRs are #106).
- **`src/api.ts`** is the single typed boundary. It is the only file under `src/` that imports
  `@tauri-apps/*`. Components and hooks import `api` and never call `invoke` themselves.
- Outside Tauri (`"__TAURI_INTERNALS__"` absent, e.g. `npm run dev` in a browser), `api.ts` routes
  every call to `src/mock.ts`, an in-memory backend with sample data. UI tests mock `./api` itself.

Rust types returned to the UI use `#[serde(rename_all = "camelCase")]`, and Tauri maps camelCase
command arguments (`projectId`) to snake_case parameters (`project_id`), so TypeScript stays
camelCase throughout.

## Data model

Defined in `core/src/schema.rs`.

| Table       | Holds                                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `projects`  | name, color, archived flag, `legacy_project_id` (v1 id, unique), `linear_enabled`, `linear_team_key`, `rounding_minutes`, `rounding_mode` |
| `entries`   | a project, a local day and notes; `legacy_session_id` (unique)                                                                            |
| `intervals` | `start_at`, `end_at` (NULL = running), `source`                                                                                           |
| `settings`  | key/value strings                                                                                                                         |

- **An entry is a project + a local day + notes.** It has no duration column. `(project_id, day)`
  is not unique: the v1 import makes one entry per session, and `start` and `add_manual_time` reuse
  the newest one.
- **An entry's duration is the sum of its intervals.** Nothing stores a total, so nothing can
  drift out of sync with the intervals.
- **An open interval is the running timer.** There is no separate "timer" state. The partial unique
  index `one_running_interval` (`ON intervals((1)) WHERE end_at IS NULL`) lets at most one interval
  in the whole database be open, so two timers cannot run even if the code has a bug.
- `source` is `timer`, `manual` or `import`, enforced by a `CHECK`.
- **Manual time is a closed `manual` interval.** `add_manual_time` ends it where the entry's first
  interval starts, so it never overlaps the running one. An entry with no intervals ends it at local
  noon (which the shell supplies) or now, whichever is earlier. Manual intervals may overlap another entry's time; totals are sums,
  so that's harmless.
- **Editing a duration edits intervals.** `set_entry_seconds` raises a total by adding a `manual`
  interval that ends where the entry's last interval ends (or at local noon on its day, or now if
  that's earlier, if it has none), and lowers it by trimming or deleting intervals from the latest end backwards, so a raise
  is undone before recorded time. It refuses a running entry and anything over 24 hours. A raise can overlap the entry's own intervals; only their sum is meaningful.
- **A project's color is a palette key** (`teal`, `coral`, …) from `PALETTE` in `core/src/lib.rs`,
  not a CSS color. The UI maps each key to a `--project-<key>` token in `src/styles.css`, with a
  light and a dark value. A new key needs a token too. `snapshot` sends `PALETTE` so the Settings
  picker lists the same keys `set_project_color` accepts. v1 colors aren't imported; imported
  projects get palette keys in order.
- **Rounding happens only when copying.** A project's `rounding_minutes` (NULL = off, else one of
  `ROUNDING_STEPS` in `core/src/lib.rs`) and `rounding_mode` (`up`, `nearest`, `down`) change what
  the entry's Time button copies (`roundSeconds` in `src/format.ts`). Nothing rounded is stored, and
  totals and the shown duration stay exact. `snapshot` sends `ROUNDING_STEPS` so the Settings picker
  lists the steps `set_project_rounding` accepts; turning rounding off keeps the mode.
- **Archiving hides a project from the timer's picker, nothing else.** Its entries, history and
  totals filter are unchanged, and a running timer keeps running. Which project a start defaults
  to is `resume_project_id` (the last one timed unless archived, else the first active one).
  The tray uses it directly, and `snapshot` sends it for the timer picker and Add time.
- Deleting a project cascades to its entries and their intervals.
- Deleting an entry cascades to its intervals. `delete_entry` refuses the running entry; stop the
  timer first.

Because the running timer is a row, a crash loses nothing. While timing, the shell writes a
heartbeat every 30 seconds (and `start` writes one at once); `heartbeat_at` is not updated while
idle. At startup, `recover_stale` closes any interval whose heartbeat is more than two minutes
old at the last heartbeat time, and the UI says so. If an idle start is saved (below), it closes
there instead, since nobody was asked about that time.

### Idle time

Windows only for now. Each second the ticker reads the last input time (`src-tauri/src/idle.rs`,
`GetLastInputInfo`), and `core::idle::idle_action` decides what to do with it:

1. While timing, once there has been no input for the threshold (`idle_minutes`, default 20),
   `mark_idle` saves the last input time as `idle_since`. Only the first mark counts. If more
   than 30 seconds pass between ticks, the PC slept: the last input seen before the gap counts,
   not the input that woke it (`last_input_across_suspend`).
2. When input arrives after `idle_since`, the shell holds an `IdlePrompt` in memory, shows the
   window and emits `timer-changed`. `snapshot` carries the prompt, and the UI shows `IdleDialog`
   over an inert page.
3. `answer_idle_prompt` keeps the time (`keep_idle` clears the mark) or discards it
   (`discard_idle`: in one transaction, end the open interval at `idle_since` and open a new one
   at the prompt's return time on that day's entry, so time back before answering counts).

The timer keeps running while the prompt waits. If the user goes idle again before answering, the
shell remembers that start and marks it once the prompt is answered, so the next tick asks about
the second stretch. `start` and `stop` clear `idle_since`, which drops any open prompt. Quit just
stops the timer, so idle time is kept. Elsewhere, `idle_for` returns `None`,
`snapshot.idleSupported` is false and the UI hides the setting.

## Times and days

- **Instants are stored as UTC RFC 3339 strings** (`start_at`, `end_at`, `created_at`, …).
- **Days are local `YYYY-MM-DD` strings** (`entries.day`).
- **Only the shell decides what "now" and "local" mean.** `core` never reads the clock or the local
  time zone for its rules. `Store` methods take `now: DateTime<Utc>` and `today: NaiveDate`, and the
  import and `set_entry_seconds` take `local_day` / `local_noon` closures. The shell supplies them from `today()`, `local_day()` and `local_noon()` in
  `src-tauri/src/lib.rs`. `local_day_range()` turns a local day into the UTC span from its first
  moment to the next day's, for queries to other systems.
- This keeps `core` deterministic in tests. The import is the one place `core` calls
  `Utc::now()`: for the `v1_imported_at` setting and as `created_at` for v1 projects whose
  `createdAt` can't be parsed. Both are UTC and don't affect any day boundary.

## Migrations

`MIGRATIONS` in `core/src/schema.rs` is an ordered list of SQL steps. `PRAGMA user_version` records
how many have been applied. On open, `migrate` runs each pending step in its own transaction and
bumps `user_version` in that same transaction, so a failed step leaves the database untouched.

- Add a migration by **appending** to `MIGRATIONS`, and bump the minor version (see the README).
- **Never edit an applied migration.** Databases that already ran it won't run it again.
- There is no separate "create tables" schema: new databases run every migration from step 1.
- **Backed up first:** the shell opens the store with `Store::open_with_backup`. When the file
  exists, has a schema (`user_version` > 0) and is behind the build, it is copied with `backup_to`
  to `timekeeper-before-update-<local date>_<time with ms>.db` in the backups folder before
  anything migrates. If the copy fails, the open fails and nothing is migrated.
- **Newer databases are refused:** `Error::SchemaTooNew` when `user_version` is above
  `CURRENT_VERSION`, so an older build never runs against data it doesn't understand.
  `open_with_backup` checks on a read-only connection first, because `Store::open` sets WAL mode
  before `migrate` can refuse; `migrate` checks again for any other caller.

## v1 import

`core/src/import.rs`, called by the shell from `open_store` at startup (`Store::import_v1`) and by
the `import_v1_again` command from Settings (`Store::import_v1_again`).

- **When it runs:** at startup, only when the v2 store is empty and the `v1_imported_at` setting is
  unset, and only if v1's database exists at `<config dir>/timekeeper/timekeeper.db`. After that,
  only when the user clicks "Import new sessions from v1" in Settings, which errors if the file is
  missing.
- **Read-only:** the v1 file is opened with `SQLITE_OPEN_READ_ONLY`, with a busy timeout because v1
  may be running. v2 never writes to it.
- **Read, then write:** `V1Data::read` loads v1's rows before the store is locked; a missing file is
  `Error::NoV1Database`, which the first-run import treats as "nothing to import".
- **One transaction:** the whole import commits or none of it does, and it sets `v1_imported_at`, so
  Settings shows the latest import.
- **Mapping rules:** see the module doc in `import.rs`, the source of truth. In short, each v1
  session becomes one entry with one `import` interval of `startTime` + `duration`.
- **Safe to re-run:** rows are keyed on the legacy ids; sessions already imported are counted as
  `already_imported`. A v1 project with the same name as one made by hand in v2 takes over that
  project instead of creating a twin.
- **Open sessions wait:** the first import takes sessions v1 hasn't ended (`endTime` NULL) as they
  stand. `import_v1_again` skips them and counts them as `still_open`, so a later run brings them in
  with their full duration.
- **Limits of re-running:** nothing already imported is updated, so a v1 edit to an imported session
  never comes across. Deletions aren't recorded, so an imported entry deleted in v2 comes back on the
  next import.
- The startup result (or error) is passed to the UI in `Startup` and shown once. A re-import's report
  is the command's return value, shown under the button.

## Backups

The `backup_now` command (Settings → Data) calls `Store::backup_to`, which runs `VACUUM INTO` on
its own read-only connection: one consistent snapshot, WAL included, so it's safe while the timer
runs and doesn't hold the store lock. It writes to `<name>.partial` and renames on success, so a
failed write never leaves a file that looks like a backup. The shell picks the path,
`<Documents>/TimeKeeper backups/timekeeper-<local date>_<time with ms>.db`, outside the app data dir
so the uninstaller's "delete app data" option leaves backups alone. An existing file is never
overwritten. With `TK_DATA_DIR` set (debug only), the backups folder is `<data dir>/backups`
instead, so smoke runs never write to the real one.

Two kinds of backup are automatic, in the same folder:

- **Daily:** the ticker calls `Store::daily_backup` on its first tick and hourly after, so a PC that
  stays on still gets one a day. It writes `timekeeper-auto-<local date>.db` unless that day's
  file exists, then deletes all but the newest 30 `timekeeper-auto-<date>.db` files, plus any
  `timekeeper-auto-<date>.db.partial` left by an interrupted run (one would make `VACUUM INTO`
  fail every retry that day). Nothing else in the folder is ever deleted. A failure is appended to `panic.log` and retried an hour later.
- **Before a migration:** see [Migrations](#migrations). These are never pruned.

## Settings

Settings are rows in the `settings` table. The UI may only read and write the keys in `UI_SETTINGS`
in `src-tauri/src/lib.rs`:

| Key               | Values                            |
| ----------------- | --------------------------------- |
| `duration_format` | default `hms` (frontend)          |
| `date_format`     | default `iso` (frontend)          |
| `week_start`      | `sunday`; anything else is Monday |
| `idle_minutes`    | minutes, `0` = off; default 20    |

`set_setting` rejects any other key but does not validate values, and `snapshot` returns only these.
Internal keys (`v1_imported_at`, `heartbeat_at`, `last_project_id`, `start_at_login`, `idle_since`) share the
table but are not UI-writable.

### Start at login

Windows and Linux release builds only (`src-tauri/src/login.rs`); elsewhere, and in debug builds so
dev and smoke runs never point the entry at a debug exe, `start_at_login` returns `null` and the UI
hides the toggle. On Windows it is a per-user value named after `productName` under
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, holding `"<exe>" --hidden`. Task Manager's
Startup apps on/off switch is a flag under `Explorer\StartupApproved\Run` with the same name.

Windows is the source of truth for the toggle, but the choice is also saved as `start_at_login`
(`on`/`off`). Upgrading with "uninstall before installing" (the default when the version goes up)
deletes the Run value, so
each launch reconciles the two:

| Windows has                   | Action                                      |
| ----------------------------- | ------------------------------------------- |
| Task Manager flag says off    | leave it, save `off`                        |
| Run value, no "off" flag      | rewrite it only if the exe moved, save `on` |
| neither, saved `on`           | write the Run value again                   |
| neither, saved `off` or unset | nothing                                     |

The toggle saves `on` only after writing the Run value, and `off` before deleting it, so a failure
midway can't leave a saved `on` that the next launch would restore.

Uninstalling (not upgrading) deletes the Run value (Tauri's NSIS template). The Task Manager flag is
left on purpose: the uninstaller can't tell an upgrade from an uninstall, and the flag is what keeps
a Task Manager "off" through an upgrade.

On Linux it is an XDG autostart file, `$XDG_CONFIG_HOME/autostart/<identifier>.desktop` (usually
`~/.config/autostart/dev.cathedraltree.timekeeper.desktop`), whose `Exec` is `"<path>" --hidden`.
The path is `$APPIMAGE` when the exe runs inside that AppImage's mount (`$APPDIR`), since the mount
changes on every launch; the variable alone isn't trusted, as anything an AppImage starts inherits
it. The same reconcile runs, with two differences: `Hidden=true` or `X-GNOME-Autostart-enabled=false`
(what desktop startup settings write) is the "off" flag, and a missing file means off, since nothing
but the user deletes it. Turning the toggle on rewrites the whole file, through a temp file and a
rename; a launch that finds a stale path changes only `Exec`, keeping any keys the user added. A
path that isn't UTF-8 or holds a control character can't go in a desktop file, so the toggle is
hidden.

## Linear

Suggests notes from what you did in Linear. Opt-in per project, since Linear is one client's
system. Nothing is ever written to Linear.

- **The key** is one Linear personal API key in Windows Credential Manager, or the Secret Service
  (GNOME Keyring, KWallet) on Linux: service
  `dev.cathedraltree.timekeeper`, user `linear-api-key` (`linear-api-key-dev` in debug builds, so
  `tauri dev` never touches the installed app's key). It is never in SQLite, settings or backups.
  The UI only ever gets its last four characters; on other platforms nothing can be saved.
- **Linux connects per call.** `keychain.rs` uses `keyring-core` with the zbus Secret Service store
  directly rather than `keyring::v1`, which connects once per process and keeps a failure, so a
  keyring that starts after the app (a login launch) still works. With no Secret Service, Save
  fails before the key is sent to Linear, with a message naming GNOME Keyring and KWallet; other
  connection failures show their real cause. There is no plain-file fallback. Calls run under
  `block_in_place`, since an unlock prompt can block for as long as the user takes.
- **Save checks first.** `save_linear_key` asks Linear for `{ viewer { name } }` and stores the key
  only if Linear accepts it. `test_linear_connection` repeats the check with the stored key.
- **One endpoint.** `linear.rs` POSTs to `https://api.linear.app/graphql` with
  `Authorization: <key>` (no `Bearer`) and a 15 s timeout. Nothing else in the app uses the network.
- **Suggest from Linear** (`suggest_notes`, on demand only) takes a project and a local day and asks
  for issues you commented on or created that day, plus issues assigned to you or that you're
  subscribed to updated since the day began (filtered by team key, if set). `Issue.history` can't be
  filtered server-side, so `parse_activity` keeps only what happened inside the day: states _you_
  moved it to, being assigned (by anyone), creating it, commenting, and GitHub PRs attached to it
  that were updated that day. A PR update alone only counts on an issue assigned to you, since
  anyone could have made it. Issues with none of these are dropped. Each issue becomes one line,
  e.g. `LABS-852 Product Isolation ADR — moved to In Review; commented`, which the UI appends to the
  notes. It fetches 10 issues per page (each with 100 history entries, which keeps the query
  under Linear's 10,000-point complexity limit), at most 20 pages; past that the suggestion
  carries a `notice` the UI shows beside the button, never in the notes. A failure after the first
  page (e.g. rate limited) keeps the pages already fetched, with the same notice; only a
  first-page failure is an error. The further back the day,
  the more issues have been updated since, so old days hit that cap sooner. A state change you make
  on an issue you neither own nor follow isn't found.
- **Late replies** go to the notes editor as it is when they arrive (`SuggestButton` calls the
  latest callback). The timer panel keys the button to its target entry, so a reply for an entry
  you've switched away from is dropped.
- **Errors** map to plain messages: HTTP 401 or `AUTHENTICATION_ERROR` → the key was refused;
  HTTP 429 or `RATELIMITED` → rate limited; no reply at all (DNS, refused, TLS, timeout) → offline,
  with the underlying reason; any other GraphQL error → Linear's own message.
- **Nothing leaves the machine that can't be kept:** where no credential store exists, Save fails
  before Linear is asked.
- **Per project:** `linear_enabled` (0/1) and `linear_team_key` (uppercase letters and digits, NULL
  = any team), each saved by its own command so a toggle never races a team-key edit. A project
  uses Linear only if it's switched on and a key is saved. Removing the key keeps each project's
  settings.

## Shell behavior

- **Tray-first.** Closing the window hides it. The app quits only from the tray menu.
- **Quitting stops the timer** at that moment, so the timer never runs while the app is closed.
  Idle time is kept, as if the prompt were answered Keep.
- **Single instance.** Launching again shows the existing window, unless that launch passed
  `--hidden`.
- **Hidden start.** The window is created hidden (`visible: false`) and shown during setup, unless
  the app was launched with `--hidden`, as the login entry does.
- **Indicators.** While timing, the tray icon gets a red dot. On Windows the taskbar button gets an
  overlay badge. While the idle prompt waits, both show an amber "!" badge instead (`with_bang`,
  `bang_badge`), and the tray's start/stop item opens the window.
- **Tray changes reach the UI** through the `timer-changed` event, which `api.onTimerChanged`
  subscribes to.
- The database lives at `<app data dir>/timekeeper.db` (identifier `dev.cathedraltree.timekeeper`).

## Debug overrides

Debug builds read these environment variables (`src-tauri/src/overrides.rs`); release builds ignore
them. An invalid value fails startup instead of being ignored.

| Variable              | Replaces                                         |
| --------------------- | ------------------------------------------------ |
| `TK_DATA_DIR`         | the app data dir, and puts backups in `backups/` |
| `TK_V1_IMPORT_DB`     | the v1 database both imports read                |
| `TK_HEARTBEAT_SECS`   | the 30-second heartbeat interval                 |
| `TK_STALE_AFTER_SECS` | the two-minute stale window `recover_stale` uses |
| `TK_IDLE_SECS`        | the `idle_minutes` setting, in seconds           |

They exist for `scripts/smoke-windows.ts`, apart from `TK_IDLE_SECS`, which is for trying the idle
prompt by hand. `TK_DATA_DIR` doesn't move WebView2's profile; the
script sets `WEBVIEW2_USER_DATA_FOLDER` for that. Single instance is keyed by the app identifier, not the
data dir, so an overridden run still hands off to any other running v2.
