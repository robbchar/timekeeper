# TimeKeeper v2

Tauri 2 + React/TypeScript + SQLite. A tray-first replacement for the v1 Electron app, in progress.

- [ARCHITECTURE.md](ARCHITECTURE.md): layers, data model, times, migrations, v1 import, backups and settings.
- [CLAUDE.md](CLAUDE.md): rules and checklists for changing the code.

## Layout

```
core/        Pure Rust: schema, v1 import, timer, totals. No GUI dependencies.
src-tauri/   Tauri shell: tray icon, window, the commands the UI calls.
src/         React UI. `api.ts` is the only file that talks to the backend.
```

## Run it (Windows)

One-time prerequisites:

1. **Rust**: install from <https://rustup.rs> (default options).
2. **Microsoft C++ Build Tools**: from <https://visualstudio.microsoft.com/visual-cpp-build-tools/>,
   choose "Desktop development with C++".
3. **WebView2**: already present on Windows 10/11.
4. **Node 26**: pinned in `.nvmrc` (`nvm use` / `fnm use`); `npm install` refuses older versions.
5. The Rust version is pinned in `rust-toolchain.toml`; rustup installs it on first build.

Then, from this folder:

```bash
npm install
npm run tauri dev      # first build takes a few minutes; later ones are fast
```

On Windows, `npm run tauri build` produces the installer, `target/release/bundle/nsis/TimeKeeper v2_<version>_x64-setup.exe`.
The installer is Windows-only: `bundle.targets` is `nsis`, so other platforms get no bundle.

The app icon's source is `src-tauri/icons/icon.svg`. After editing it, regenerate the sizes with
`npm run icons`. Keep the clock hands out of the bottom-right corner, where the timing dot covers
part of the ring.

To work on the UI alone in a browser (in-memory sample data, no Rust needed): `npm run dev`
and open <http://localhost:1420>.

## Install, upgrade, uninstall (Windows)

- **Install**: run the setup exe. It installs for the current user only (no admin prompt) into
  `%LOCALAPPDATA%\TimeKeeper v2`, with a Start menu shortcut. It installs alongside v1, which uses
  different folders and shortcuts.
- **Upgrade**: run a newer setup exe. When its version is higher, it offers to uninstall the old
  build first, which opens the old uninstaller. Either answer keeps your data as long as you leave
  "Delete the application data" unticked there. A build that changes the database's schema copies
  the database to `Documents\TimeKeeper backups` before it updates it.
- **Uninstall**: Settings → Apps → TimeKeeper v2. Your data is kept unless you tick "Delete the
  application data", which removes `%APPDATA%\dev.cathedraltree.timekeeper`. Backups in Documents
  are never touched. It also removes the start-at-login entry.
- **Start at login**: Settings → Startup → "Start TimeKeeper when I log in" (off by default). It
  starts in the tray with no window. Either choice survives upgrades, including turning it off in
  Task Manager's Startup apps, which turns the toggle off too. Release builds only: debug builds
  hide the toggle. On Linux the same toggle writes
  `~/.config/autostart/dev.cathedraltree.timekeeper.desktop`; deleting that file, or turning it off
  in your desktop's startup settings, turns the toggle off.
- **Version**: set it in `[workspace.package]` in `Cargo.toml`. The crates inherit it, and
  `tauri.conf.json` has no `version`, so the installer uses it too. A PR that adds a migration
  bumps the minor version, so the installer can tell builds on either side of a schema change apart.
- **Don't change** `identifier`, `productName` or `bundle.publisher` in `tauri.conf.json` lightly.
  - The identifier names the data folder.
  - The installer finds an existing install by `productName`. A renamed build installs alongside
    the old one, and both use the same data folder.
  - The old install's folder is read from `HKCU\Software\<publisher>\<productName>`, so a new
    publisher breaks "uninstall before installing" ("Unable to uninstall!"). Choosing "Do not
    uninstall" gets past it once.

## Your data

- v2 keeps its database at `%APPDATA%\dev.cathedraltree.timekeeper\timekeeper.db`
  (Linux: `~/.local/share/dev.cathedraltree.timekeeper/`).
- **Settings → Back up now** writes a copy of the database to
  `Documents\TimeKeeper backups\timekeeper-<date>_<time>.db`. It's safe while the timer runs.
- Backups are also automatic, in the same folder:
  - `timekeeper-auto-<date>.db` once a day. Only the newest 30 of these are kept.
  - `timekeeper-before-update-<date>_<time>.db` before a new build updates the database's schema.
    These are kept forever. If this copy can't be written, the app doesn't start, rather than
    update without one.
- To restore a backup, quit v2, delete `timekeeper.db-wal` and `timekeeper.db-shm` if present, and
  copy the backup over `timekeeper.db`.
- If v2 can't open its database (for example, it was written by a newer build), it shows a message
  with the reason and the folders instead of starting. Install the newer build, or restore a
  backup.
- On first launch it imports v1 from `%APPDATA%\timekeeper\timekeeper.db`. The v1 file is opened
  **read-only** and never changed.
- To bring in time recorded in v1 since then, use **Settings → Import new sessions from v1**. It
  adds only sessions v2 doesn't have yet, so running it twice adds nothing.
- Sessions still open in v1 are left out until you end them there. The next import brings them in
  whole.
- An imported session you later edit in v1 keeps its imported values in v2. An imported entry you
  delete in v2 comes back, with v1's current values, the next time you import.
- v1 sessions whose project was deleted, or whose start time can't be read, are skipped and counted
  in the import notice rather than failing the import.
- A Linear API key, if you add one, lives in Windows Credential Manager, or on Linux in the Secret
  Service (GNOME Keyring or KWallet, which must be running), not in `timekeeper.db` or backups.
  **Remove** in Settings deletes it. The app talks to `api.linear.app` only when you save or test
  the key or press **Suggest from Linear**, and to nothing else. It only reads from Linear.
- While v2 is in progress, keep tracking real time in v1. Running both means two separate timers.

## Behaviour worth knowing

- Closing the window hides it; the app lives in the tray. Quit from the tray menu. Quitting stops a
  running timer at that moment, keeping any idle time.
- Left-click the tray icon to open the window. The tray menu shows the running time and can
  start/stop the last-used project (or the first active one, if that project is archived). While timing, the tray icon gets a red dot, and on Windows the
  taskbar button gets a red-dot badge too. Windows 11 hides new tray icons in the "^" overflow;
  drag it onto the taskbar to keep it visible.
- Idle time (Windows only): if you come back to a running timer after 20 minutes without touching
  the keyboard or mouse, the window comes up and asks whether to **Keep** that time or **Discard**
  it. Discard drops only the time away: timing carries on from when you came back. Sleep counts as
  idle too. If you go idle again before answering, you're asked about that stretch next. The prompt
  can't be closed without answering. While it waits, the tray icon and taskbar badge show an amber
  "!" instead of the red dot, and the tray's start/stop item opens the prompt. The 20 minutes, or
  turning it off, is on the Settings page. Idle time while the timer is stopped is ignored.
- The running timer is an open interval in the database, so a crash loses nothing. If the app dies
  while timing, the next launch stops the timer at the last heartbeat (written every 30s) and says so,
  or where you went idle if that came first.
- Copy buttons on each day's entry: **Time**, **Notes**, **Date**. Formats, and which day the week starts on, are on the Settings page.
- Projects are renamed, recolored and archived on the Settings page. An archived project leaves the
  timer's list but keeps its history and stays in the totals filter.
- Each project can round what **Time** copies (5–60 minute steps; up, nearest or down). The hover
  text shows the exact value too; nothing rounded is stored.
- Linear is opt-in per project on the Settings page, with an optional team key (e.g. `LABS`). Saving
  a key checks it with Linear first; a key Linear refuses is never stored.
- For those projects, **Suggest from Linear** under the timer's notes and under each day's entry
  appends one line per issue you worked on that day (created, assigned, moved, commented, linked PR).
  It never replaces what you wrote; in the day list it opens the notes so you can trim the lines
  before they save.

## Tests

See [CLAUDE.md](CLAUDE.md#testing).
