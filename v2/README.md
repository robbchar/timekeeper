# TimeKeeper v2

Tauri 2 + React/TypeScript + SQLite. A tray-first replacement for the v1 Electron app, in progress.

- [ARCHITECTURE.md](ARCHITECTURE.md): layers, data model, times, migrations, v1 import and settings.
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

`npm run tauri build` produces an installer under `target/release/bundle/`.

To work on the UI alone in a browser (in-memory sample data, no Rust needed): `npm run dev`
and open <http://localhost:1420>.

## Your data

- v2 keeps its database at `%APPDATA%\dev.cathedraltree.timekeeper\timekeeper.db`
  (Linux: `~/.local/share/dev.cathedraltree.timekeeper/`).
- On first launch it imports v1 from `%APPDATA%\timekeeper\timekeeper.db`. The v1 file is opened
  **read-only** and never changed.
- The import is one-time. Time you keep recording in v1 afterwards won't appear in v2. To re-import
  a fresh copy, quit v2 and delete the v2 database folder above.
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
