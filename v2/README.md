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
- **Upgrade**: run a newer setup exe. Either answer to "uninstall before installing" keeps your data.
- **Uninstall**: Settings → Apps → TimeKeeper v2. Your data is kept unless you tick "Delete the
  application data", which removes `%APPDATA%\dev.cathedraltree.timekeeper`. Backups in Documents
  are never touched.
- **Version**: set it in `[workspace.package]` in `Cargo.toml`. The crates inherit it, and
  `tauri.conf.json` has no `version`, so the installer uses it too.
- **Don't change** `identifier`, `productName` or `bundle.publisher` in `tauri.conf.json` lightly.
  The identifier names the data folder. The installer finds the previous install under
  `HKCU\Software\<publisher>\<productName>`, so changing either breaks "uninstall before installing"
  for existing installs ("Unable to uninstall!"); choosing "Do not uninstall" gets past it once.

## Your data

- v2 keeps its database at `%APPDATA%\dev.cathedraltree.timekeeper\timekeeper.db`
  (Linux: `~/.local/share/dev.cathedraltree.timekeeper/`).
- **Settings → Back up now** writes a copy of the database to
  `Documents\TimeKeeper backups\timekeeper-<date>_<time>.db`. It's safe while the timer runs. To
  restore one, quit v2, delete `timekeeper.db-wal` and `timekeeper.db-shm` if present, and copy the
  backup over `timekeeper.db`.
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
- While v2 is in progress, keep tracking real time in v1. Running both means two separate timers.

## Behaviour worth knowing

- Closing the window hides it; the app lives in the tray. Quit from the tray menu. Quitting stops a
  running timer at that moment.
- Left-click the tray icon to open the window. The tray menu shows the running time and can
  start/stop the last-used project (or the first active one, if that project is archived). While timing, the tray icon gets a red dot, and on Windows the
  taskbar button gets a red-dot badge too. Windows 11 hides new tray icons in the "^" overflow;
  drag it onto the taskbar to keep it visible.
- The running timer is an open interval in the database, so a crash loses nothing. If the app dies
  while timing, the next launch stops the timer at the last heartbeat (written every 30s) and says so.
- Copy buttons on each day's entry: **Time**, **Notes**, **Date**. Formats, and which day the week starts on, are on the Settings page.
- Projects are renamed, recolored and archived on the Settings page. An archived project leaves the
  timer's list but keeps its history and stays in the totals filter.

## Tests

See [CLAUDE.md](CLAUDE.md#testing).
