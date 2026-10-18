//! Tauri shell: wires `timekeeper-core` to a tray icon and the web UI.
//! Everything about the data lives in the core crate; this file only adapts it.

mod keychain;
mod linear;
mod login;
mod overrides;
mod suggest;

use chrono::{DateTime, Duration, Local, NaiveDate, TimeZone, Utc};
use keychain::SecretStore;
use overrides::Overrides;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent, Wry,
};
use timekeeper_core::{
    Entry, ImportReport, ManualTime, Project, Recovered, Status, Store, Totals, V1Data, WeekStart,
    PALETTE,
};

/// Settings the UI is allowed to write.
const UI_SETTINGS: &[&str] = &["duration_format", "date_format", "week_start"];

/// The v2 database's file name in the data dir.
const DB_FILE: &str = "timekeeper.db";

struct AppState {
    store: Mutex<Store>,
    startup: Startup,
    /// Where the v2 database lives, shown on the Settings page.
    data_dir: PathBuf,
    /// The v1 database the import reads, at first run and from Settings.
    v1_db: PathBuf,
    /// The login entry; `None` in debug builds and where start at login isn't supported.
    login: Option<login::LoginItem>,
    /// Where the Linear API key lives; never SQLite.
    secrets: keychain::Keychain,
    /// `Err` if the HTTP client couldn't be built; only Linear's Save and Test fail then.
    linear: Result<linear::Client, String>,
}

impl AppState {
    fn lock_store(&self) -> MutexGuard<'_, Store> {
        lock_recovering(&self.store)
    }
}

// Lock recovery and the ticker's panic guard rely on unwinding; abort would make them dead code.
#[cfg(not(panic = "unwind"))]
compile_error!("TimeKeeper must be built with panic = \"unwind\"");

/// A panic while holding the lock poisons it; without this, every later call would panic too.
/// Safe because each `Store` write is one statement or one transaction, which SQLite rolls back if
/// interrupted.
fn lock_recovering<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|poisoned| {
        eprintln!("store lock was poisoned by an earlier panic; recovering");
        m.clear_poison();
        poisoned.into_inner()
    })
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct Startup {
    recovered: Option<Recovered>,
    imported: Option<ImportReport>,
    import_error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Snapshot {
    status: Status,
    projects: Vec<Project>,
    /// Project color keys; the UI styles each with a `--project-<key>` token.
    palette: &'static [&'static str],
    /// The project a one-click start uses (`Store::resume_project_id`).
    resume_project_id: Option<i64>,
    settings: std::collections::HashMap<String, String>,
    startup: Startup,
    data_dir: String,
    v1_imported_at: Option<String>,
}

fn today() -> NaiveDate {
    Local::now().date_naive()
}
fn local_day(t: DateTime<Utc>) -> NaiveDate {
    t.with_timezone(&Local).date_naive()
}
/// Noon on local day `d`, or an hour later if the zone skips noon.
fn local_noon(d: NaiveDate) -> DateTime<Utc> {
    let noon = d.and_hms_opt(12, 0, 0).expect("12:00:00 is a valid time");
    [noon, noon + Duration::hours(1)]
        .into_iter()
        .find_map(|t| t.and_local_timezone(Local).earliest())
        .map_or_else(|| noon.and_utc(), |t| t.with_timezone(&Utc))
}
/// Local day `d` as UTC instants: its first moment (inclusive) to the next day's (exclusive).
fn local_day_range(d: NaiveDate) -> (DateTime<Utc>, DateTime<Utc>) {
    day_range_in(&Local, d)
}
fn day_range_in<Tz: TimeZone>(tz: &Tz, d: NaiveDate) -> (DateTime<Utc>, DateTime<Utc>) {
    (
        start_of_day_in(tz, d),
        start_of_day_in(tz, d + Duration::days(1)),
    )
}
/// Midnight, or the first hour that exists if the zone skips midnight.
fn start_of_day_in<Tz: TimeZone>(tz: &Tz, d: NaiveDate) -> DateTime<Utc> {
    let midnight = d.and_hms_opt(0, 0, 0).expect("00:00:00 is a valid time");
    (0..=2)
        .map(|h| midnight + Duration::hours(h))
        .find_map(|t| t.and_local_timezone(tz.clone()).earliest())
        .map_or_else(|| midnight.and_utc(), |t| t.with_timezone(&Utc))
}
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

// ------------------------------------------------------------------ commands

#[tauri::command]
fn snapshot(state: State<AppState>) -> Result<Snapshot, String> {
    let store = state.lock_store();
    let mut settings = std::collections::HashMap::new();
    for key in UI_SETTINGS {
        if let Some(v) = store.setting(key).map_err(err)? {
            settings.insert(key.to_string(), v);
        }
    }
    Ok(Snapshot {
        status: store.status(Utc::now()).map_err(err)?,
        projects: store.projects().map_err(err)?,
        palette: PALETTE,
        resume_project_id: store.resume_project_id().map_err(err)?,
        settings,
        startup: state.startup.clone(),
        data_dir: state.data_dir.display().to_string(),
        v1_imported_at: store.setting("v1_imported_at").map_err(err)?,
    })
}

#[tauri::command]
fn start(
    app: AppHandle,
    state: State<AppState>,
    project_id: i64,
    notes: Option<String>,
) -> Result<Status, String> {
    let status = state
        .lock_store()
        .start(project_id, notes.as_deref(), Utc::now(), today())
        .map_err(err)?;
    refresh_tray(&app, &status);
    Ok(status)
}

#[tauri::command]
fn stop(app: AppHandle, state: State<AppState>) -> Result<Status, String> {
    let status = state.lock_store().stop(Utc::now()).map_err(err)?;
    refresh_tray(&app, &status);
    Ok(status)
}

#[tauri::command]
fn entries(
    state: State<AppState>,
    from: String,
    to: String,
    project_id: Option<i64>,
) -> Result<Vec<Entry>, String> {
    let parse = |s: &str| NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(err);
    state
        .lock_store()
        .entries(parse(&from)?, parse(&to)?, project_id, Utc::now())
        .map_err(err)
}

#[tauri::command]
fn totals(state: State<AppState>, project_id: Option<i64>) -> Result<Totals, String> {
    let store = state.lock_store();
    let week_start = WeekStart::from_setting(store.setting("week_start").map_err(err)?.as_deref());
    store
        .totals(today(), week_start, project_id, Utc::now())
        .map_err(err)
}

#[tauri::command]
fn set_notes(state: State<AppState>, entry_id: i64, notes: String) -> Result<(), String> {
    state
        .lock_store()
        .set_notes(entry_id, &notes, Utc::now())
        .map_err(err)
}

#[tauri::command]
fn add_manual_time(
    app: AppHandle,
    state: State<AppState>,
    project_id: i64,
    day: String,
    seconds: i64,
    notes: Option<String>,
) -> Result<Entry, String> {
    let day = NaiveDate::parse_from_str(&day, "%Y-%m-%d").map_err(err)?;
    let now = Utc::now();
    let mut store = state.lock_store();
    let entry = store
        .add_manual_time(
            ManualTime {
                project_id,
                day,
                seconds,
                notes: notes.as_deref(),
            },
            now,
            today(),
            local_noon(day),
        )
        .map_err(err)?;
    // The time is saved; the tray refresh is best-effort. The UI refreshes itself.
    if entry.running {
        if let Ok(status) = store.status(now) {
            drop(store);
            refresh_tray(&app, &status);
        }
    }
    Ok(entry)
}

#[tauri::command]
fn set_entry_seconds(state: State<AppState>, entry_id: i64, seconds: i64) -> Result<(), String> {
    state
        .lock_store()
        .set_entry_seconds(entry_id, seconds, Utc::now(), local_noon)
        .map_err(err)
}

#[tauri::command]
fn delete_entry(state: State<AppState>, entry_id: i64) -> Result<(), String> {
    state.lock_store().delete_entry(entry_id).map_err(err)
}

#[tauri::command]
fn create_project(state: State<AppState>, name: String) -> Result<Project, String> {
    state
        .lock_store()
        .create_project(&name, Utc::now())
        .map_err(err)
}

/// The ticker picks up the new name for the tray within a second.
#[tauri::command]
fn rename_project(state: State<AppState>, project_id: i64, name: String) -> Result<(), String> {
    state
        .lock_store()
        .rename_project(project_id, &name)
        .map_err(err)
}

#[tauri::command]
fn set_project_color(state: State<AppState>, project_id: i64, color: String) -> Result<(), String> {
    state
        .lock_store()
        .set_project_color(project_id, &color)
        .map_err(err)
}

#[tauri::command]
fn set_project_archived(
    state: State<AppState>,
    project_id: i64,
    archived: bool,
) -> Result<(), String> {
    state
        .lock_store()
        .set_project_archived(project_id, archived)
        .map_err(err)
}

#[tauri::command]
fn set_project_linear_enabled(
    state: State<AppState>,
    project_id: i64,
    enabled: bool,
) -> Result<(), String> {
    state
        .lock_store()
        .set_project_linear_enabled(project_id, enabled)
        .map_err(err)
}

#[tauri::command]
fn set_project_linear_team(
    state: State<AppState>,
    project_id: i64,
    team_key: Option<String>,
) -> Result<(), String> {
    state
        .lock_store()
        .set_project_linear_team(project_id, team_key.as_deref())
        .map_err(err)
}

/// The saved key's last four characters, or `None`; never the key itself.
// Off the main thread: on Linux a locked keyring prompts, and the window must stay live.
#[tauri::command(async)]
fn linear_key_status(state: State<AppState>) -> Result<Option<linear::KeyStatus>, String> {
    linear::key_status(&state.secrets)
}

#[tauri::command]
async fn save_linear_key(
    state: State<'_, AppState>,
    key: String,
) -> Result<linear::Connected, String> {
    linear::save_key(&state.secrets, &state.linear, &key).await
}

#[tauri::command]
async fn test_linear_connection(state: State<'_, AppState>) -> Result<String, String> {
    linear::test_connection(&state.secrets, &state.linear).await
}

/// Lines for the notes of `project_id`'s entry on local `day`, from each source it has turned on.
#[tauri::command]
async fn suggest_notes(
    state: State<'_, AppState>,
    project_id: i64,
    day: String,
) -> Result<Vec<suggest::Suggestion>, String> {
    let day = NaiveDate::parse_from_str(&day, "%Y-%m-%d").map_err(err)?;
    let project = state
        .lock_store()
        .projects()
        .map_err(err)?
        .into_iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| format!("no project with id {project_id}"))?;
    let (start, end) = local_day_range(day);
    suggest::suggest(&project, start, end, &state.secrets, &state.linear).await
}

// Off the main thread, like `linear_key_status`.
#[tauri::command(async)]
fn remove_linear_key(state: State<AppState>) -> Result<(), String> {
    state.secrets.delete()
}

#[tauri::command]
fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    if !UI_SETTINGS.contains(&key.as_str()) {
        return Err(format!("unknown setting {key}"));
    }
    state.lock_store().set_setting(&key, &value).map_err(err)
}

/// Whether the app starts at login; `None` where that isn't supported.
#[tauri::command]
fn start_at_login(state: State<AppState>) -> Result<Option<bool>, String> {
    state
        .login
        .as_ref()
        .map(|l| l.state().map(|e| e == login::LoginEntry::Enabled))
        .transpose()
}

#[tauri::command]
fn set_start_at_login(state: State<AppState>, enabled: bool) -> Result<(), String> {
    let Some(item) = &state.login else {
        return Err("starting at login isn't supported here".into());
    };
    // "on" is saved only once the entry exists, and "off" before it goes, so a failure
    // midway never leaves a saved "on" that the next launch would restore.
    let save = |value| {
        state
            .lock_store()
            .set_setting(login::SETTING, value)
            .map_err(err)
    };
    if enabled {
        item.set(true)?;
        save("on")
    } else {
        save("off")?;
        item.set(false)
    }
}

// Runs off the main thread, and reads v1 before locking the store, so neither
// the window nor other commands wait on the v1 read.
#[tauri::command(async)]
fn import_v1_again(state: State<AppState>) -> Result<ImportReport, String> {
    let v1 = V1Data::read(&state.v1_db).map_err(err)?;
    state
        .lock_store()
        .import_v1_again(v1, local_day)
        .map_err(err)
}

/// Copies the database to a timestamped file under Documents, outside the app data
/// dir so uninstalling with "delete app data" doesn't take the backups too.
#[tauri::command(async)]
fn backup_now(app: AppHandle, state: State<AppState>) -> Result<String, String> {
    // Milliseconds, so a quick second click gets its own file.
    let name = format!(
        "timekeeper-{}.db",
        Local::now().format("%Y-%m-%d_%H%M%S%.3f")
    );
    let path = app
        .path()
        .document_dir()
        .map_err(err)?
        .join("TimeKeeper backups")
        .join(name);
    Store::backup_to(&state.data_dir.join(DB_FILE), &path).map_err(err)?;
    Ok(path.display().to_string())
}

// ---------------------------------------------------------------------- tray

struct TrayHandles {
    tray: TrayIcon<Wry>,
    status_item: MenuItem<Wry>,
    toggle_item: MenuItem<Wry>,
    idle_icon: Image<'static>,
    timing_icon: Image<'static>,
    /// Small red dot laid over the window's taskbar button while timing (Windows).
    #[cfg_attr(not(windows), allow(dead_code))]
    overlay_dot: Image<'static>,
    /// Whether the icons currently show "timing", so they're only swapped on change.
    showing_timing: AtomicBool,
}

fn format_elapsed(secs: i64) -> String {
    format!("{}:{:02}:{:02}", secs / 3600, secs / 60 % 60, secs % 60)
}

fn refresh_tray(app: &AppHandle, status: &Status) {
    let Some(h) = app.try_state::<TrayHandles>() else {
        return;
    };
    let (label, toggle) = match &status.running {
        Some(r) => (
            format!(
                "{} — {}",
                r.project_name,
                format_elapsed(status.elapsed_seconds)
            ),
            "Stop timing",
        ),
        None => ("Not timing".to_string(), "Start timing"),
    };
    let _ = h.status_item.set_text(&label);
    let _ = h.toggle_item.set_text(toggle);
    let _ = h.tray.set_tooltip(Some(format!("TimeKeeper — {label}")));

    let timing = status.running.is_some();
    if h.showing_timing.swap(timing, Ordering::SeqCst) != timing {
        let icon = if timing { &h.timing_icon } else { &h.idle_icon };
        let _ = h.tray.set_icon(Some(icon.clone()));
        if let Some(win) = app.get_webview_window("main") {
            // Windows shows a badge on the taskbar button; elsewhere, swap the window icon.
            #[cfg(windows)]
            let _ = win.set_overlay_icon(timing.then(|| h.overlay_dot.clone()));
            #[cfg(not(windows))]
            let _ = win.set_icon(icon.clone());
        }
    }
}

/// A red dot with a white ring, for the taskbar overlay.
fn red_dot(size: u32) -> Image<'static> {
    let mut rgba = vec![0u8; (size * size * 4) as usize];
    let c = size as f32 / 2.0;
    let r = c - 1.5;
    for y in 0..size {
        for x in 0..size {
            let d = ((x as f32 + 0.5 - c).powi(2) + (y as f32 + 0.5 - c).powi(2)).sqrt();
            let i = ((y * size + x) * 4) as usize;
            if d <= r - 2.0 {
                rgba[i..i + 4].copy_from_slice(&[0xE5, 0x48, 0x4D, 0xFF]);
            } else if d <= r {
                rgba[i..i + 4].copy_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF]);
            }
        }
    }
    Image::new_owned(rgba, size, size)
}

/// The app icon with a red dot in the corner, shown while timing.
fn with_red_dot(base: &Image<'_>) -> Image<'static> {
    let (w, h) = (base.width(), base.height());
    let mut rgba = base.rgba().to_vec();
    let r = w.min(h) as f32 * 0.22;
    let (cx, cy) = (w as f32 - r - 1.0, h as f32 - r - 1.0);
    for y in 0..h {
        for x in 0..w {
            let d = ((x as f32 + 0.5 - cx).powi(2) + (y as f32 + 0.5 - cy).powi(2)).sqrt();
            let i = ((y * w + x) * 4) as usize;
            if d <= r {
                rgba[i..i + 4].copy_from_slice(&[0xE5, 0x48, 0x4D, 0xFF]);
            } else if d <= r + 1.5 {
                rgba[i..i + 4].copy_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF]);
            }
        }
    }
    Image::new_owned(rgba, w, h)
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn toggle_from_tray(app: &AppHandle) {
    let state = app.state::<AppState>();
    let result = {
        let mut store = state.lock_store();
        let now = Utc::now();
        match store.status(now) {
            Ok(s) if s.running.is_some() => store.stop(now).map(Some),
            Ok(_) => match store.resume_project_id() {
                Ok(Some(p)) => store.start(p, None, now, today()).map(Some),
                Ok(None) => Ok(None),
                Err(e) => Err(e),
            },
            Err(e) => Err(e),
        }
    };
    match result {
        Ok(Some(status)) => {
            refresh_tray(app, &status);
            let _ = app.emit("timer-changed", ());
        }
        Ok(None) => show_main(app), // no projects yet
        Err(e) => eprintln!("tray toggle failed: {e}"),
    }
}

/// A deliberate quit stops the timer now, so the next launch has nothing to recover.
fn quit(app: &AppHandle) {
    if let Err(e) = app.state::<AppState>().lock_store().stop(Utc::now()) {
        eprintln!("stopping the timer on quit failed: {e}");
    }
    app.exit(0);
}

fn build_tray(app: &AppHandle) -> tauri::Result<TrayHandles> {
    let status_item = MenuItem::with_id(app, "status", "Not timing", false, None::<&str>)?;
    let toggle_item = MenuItem::with_id(app, "toggle", "Start timing", true, None::<&str>)?;
    let show_item = MenuItem::with_id(app, "show", "Open TimeKeeper", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &status_item,
            &PredefinedMenuItem::separator(app)?,
            &toggle_item,
            &show_item,
            &PredefinedMenuItem::separator(app)?,
            &quit_item,
        ],
    )?;
    let idle_icon = app
        .default_window_icon()
        .expect("app icon")
        .clone()
        .to_owned();
    let timing_icon = with_red_dot(&idle_icon);

    let tray = TrayIconBuilder::with_id("main")
        .icon(idle_icon.clone())
        .tooltip("TimeKeeper")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => toggle_from_tray(app),
            "show" => show_main(app),
            "quit" => quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(TrayHandles {
        tray,
        status_item,
        toggle_item,
        idle_icon,
        timing_icon,
        overlay_dot: red_dot(32),
        showing_timing: AtomicBool::new(false),
    })
}

/// Keeps the tray's elapsed time current and writes the heartbeat.
fn spawn_ticker(app: AppHandle, heartbeat_every_secs: u64) {
    std::thread::spawn(move || {
        let mut ticks: u64 = 0;
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
            ticks += 1;
            // A panic in one tick is logged by the hook; the ticker keeps going.
            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                tick(&app, ticks, heartbeat_every_secs)
            }));
        }
    });
}

fn tick(app: &AppHandle, ticks: u64, heartbeat_every_secs: u64) {
    let state = app.state::<AppState>();
    let status = {
        let store = state.lock_store();
        let now = Utc::now();
        let status = store.status(now);
        if ticks.is_multiple_of(heartbeat_every_secs) {
            if let Ok(Status {
                running: Some(_), ..
            }) = &status
            {
                let _ = store.heartbeat(now);
            }
        }
        status
    };
    if let Ok(status) = status {
        refresh_tray(app, &status);
    }
}

/// Release builds have no console, so panics are also appended to `panic.log` in the data dir.
fn log_panics_to(path: std::path::PathBuf) {
    let default = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        default(info);
        let line = format!("{} {info}\n", Utc::now().to_rfc3339());
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .and_then(|mut f| std::io::Write::write_all(&mut f, line.as_bytes()));
    }));
}

// ----------------------------------------------------------------------- run

/// Brings the login entry in line with the saved choice; see `login::reconcile`.
fn sync_login_item(state: &AppState) -> Result<(), String> {
    let Some(item) = &state.login else {
        return Ok(());
    };
    let setting = state.lock_store().setting(login::SETTING).map_err(err)?;
    let saved_on = setting.as_deref() == Some("on");
    let on = login::reconcile(item.state()?, saved_on);
    // Also repoints the entry if the install moved.
    if on {
        item.refresh()?;
    }
    if on != saved_on {
        let value = if on { "on" } else { "off" };
        state
            .lock_store()
            .set_setting(login::SETTING, value)
            .map_err(err)?;
    }
    Ok(())
}

/// Release builds only, so dev and smoke-test runs never point the entry at a debug exe.
fn login_item(app: &tauri::App) -> Option<login::LoginItem> {
    if cfg!(debug_assertions) {
        return None;
    }
    login::LoginItem::for_current_exe(&app.package_info().name, &app.config().identifier)
}

/// v1 (Electron) kept its database in the per-user config dir under "timekeeper".
fn v1_db_path(app: &AppHandle, overrides: &Overrides) -> tauri::Result<PathBuf> {
    if let Some(path) = &overrides.v1_import_db {
        return Ok(path.clone());
    }
    let config = app.path().config_dir()?;
    Ok(config.join("timekeeper").join("timekeeper.db"))
}

fn open_store(
    app: &AppHandle,
    overrides: &Overrides,
    v1_db: &Path,
) -> Result<(Store, Startup, PathBuf), Box<dyn std::error::Error>> {
    let dir = match &overrides.data_dir {
        Some(dir) => dir.clone(),
        None => app.path().app_data_dir()?,
    };
    std::fs::create_dir_all(&dir)?;
    log_panics_to(dir.join("panic.log"));
    let mut store = Store::open(dir.join(DB_FILE))?;
    let mut startup = Startup::default();

    // First run: bring in v1's data, opened read-only. No v1 database is fine.
    if store.is_empty()? && store.setting("v1_imported_at")?.is_none() {
        match V1Data::read(v1_db).and_then(|v1| store.import_v1(v1, local_day)) {
            Ok(report) => startup.imported = Some(report),
            Err(timekeeper_core::Error::NoV1Database(_)) => {}
            Err(e) => startup.import_error = Some(e.to_string()),
        }
    }

    startup.recovered = store.recover_stale(Utc::now(), overrides.stale_after)?;
    Ok((store, startup, dir))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // A login launch while already running leaves the window as it is.
            if !login::launched_hidden(args) {
                show_main(app)
            }
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let overrides = Overrides::from_env()?;
            let v1_db = v1_db_path(&handle, &overrides)?;
            let (store, startup, data_dir) = open_store(&handle, &overrides, &v1_db)?;
            let status = store.status(Utc::now())?;
            let state = AppState {
                store: Mutex::new(store),
                startup,
                data_dir,
                v1_db,
                login: login_item(app),
                secrets: keychain::Keychain::new(
                    &app.config().identifier,
                    keychain::linear_key_user(),
                ),
                linear: linear::Client::new().map_err(|e| {
                    eprintln!("building the Linear client failed: {e}");
                    e.to_string()
                }),
            };
            if let Err(e) = sync_login_item(&state) {
                eprintln!("syncing the login entry failed: {e}");
            }
            app.manage(state);
            let tray = build_tray(&handle)?;
            app.manage(tray);
            refresh_tray(&handle, &status);
            // The window starts hidden (tauri.conf.json) so a login launch never flashes it.
            if !login::launched_hidden(std::env::args_os()) {
                show_main(&handle);
            }
            spawn_ticker(handle, overrides.heartbeat_every_secs);
            Ok(())
        })
        .on_window_event(|window, event| {
            // The tray is the app; closing the window just hides it.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            snapshot,
            start,
            stop,
            entries,
            totals,
            set_notes,
            add_manual_time,
            set_entry_seconds,
            delete_entry,
            create_project,
            rename_project,
            set_project_color,
            set_project_archived,
            set_setting,
            import_v1_again,
            backup_now,
            start_at_login,
            set_start_at_login,
            set_project_linear_enabled,
            set_project_linear_team,
            linear_key_status,
            save_linear_key,
            test_linear_connection,
            remove_linear_key,
            suggest_notes
        ])
        .run(tauri::generate_context!())
        .expect("error while running TimeKeeper");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lock_recovering_survives_a_poisoned_lock() {
        let m = Mutex::new(1);
        let _ = std::panic::catch_unwind(|| {
            let _guard = m.lock().unwrap();
            panic!("poison it");
        });
        assert!(m.is_poisoned());

        *lock_recovering(&m) += 1;
        assert_eq!(*lock_recovering(&m), 2);
        assert!(!m.is_poisoned());
    }

    #[test]
    fn local_noon_is_noon_on_that_local_day() {
        for d in ["2026-03-08", "2026-03-29", "2026-07-15", "2026-11-01"] {
            let day = NaiveDate::parse_from_str(d, "%Y-%m-%d").unwrap();
            let local = local_noon(day).with_timezone(&Local).naive_local();
            assert_eq!(local, day.and_hms_opt(12, 0, 0).unwrap(), "{d}");
        }
    }

    #[test]
    fn day_range_is_local_midnight_to_midnight() {
        let tz = chrono::FixedOffset::west_opt(4 * 3600).unwrap();
        let day = NaiveDate::from_ymd_opt(2026, 10, 16).unwrap();
        let (start, end) = day_range_in(&tz, day);
        assert_eq!(start.to_rfc3339(), "2026-10-16T04:00:00+00:00");
        assert_eq!(end.to_rfc3339(), "2026-10-17T04:00:00+00:00");
    }

    #[test]
    fn local_day_range_starts_at_local_midnight() {
        for d in ["2026-03-08", "2026-03-29", "2026-07-15", "2026-11-01"] {
            let day = NaiveDate::parse_from_str(d, "%Y-%m-%d").unwrap();
            let (start, end) = local_day_range(day);
            let local = start.with_timezone(&Local).naive_local();
            assert_eq!(local, day.and_hms_opt(0, 0, 0).unwrap(), "{d}");
            let hours = (end - start).num_hours();
            assert!((23..=25).contains(&hours), "{d}: {hours}h");
        }
    }
}
