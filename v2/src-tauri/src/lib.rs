//! Tauri shell: wires `timekeeper-core` to a tray icon and the web UI.
//! Everything about the data lives in the core crate; this file only adapts it.

use chrono::{DateTime, Duration, Local, NaiveDate, Utc};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent, Wry,
};
use timekeeper_core::{Entry, ImportReport, Project, Recovered, Status, Store, Totals, WeekStart};

/// A timer with no heartbeat for this long was left running by a run that
/// ended without stopping it.
const STALE_AFTER: i64 = 2; // minutes
const HEARTBEAT_EVERY_SECS: u64 = 30;
/// Settings the UI is allowed to write.
const UI_SETTINGS: &[&str] = &["duration_format", "date_format", "week_start"];

struct AppState {
    store: Mutex<Store>,
    startup: Startup,
    /// Where the v2 database lives, shown on the Settings page.
    data_dir: String,
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
    last_project_id: Option<i64>,
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
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

// ------------------------------------------------------------------ commands

#[tauri::command]
fn snapshot(state: State<AppState>) -> Result<Snapshot, String> {
    let store = state.store.lock().unwrap();
    let mut settings = std::collections::HashMap::new();
    for key in UI_SETTINGS {
        if let Some(v) = store.setting(key).map_err(err)? {
            settings.insert(key.to_string(), v);
        }
    }
    Ok(Snapshot {
        status: store.status(Utc::now()).map_err(err)?,
        projects: store.projects().map_err(err)?,
        last_project_id: store.last_project_id().map_err(err)?,
        settings,
        startup: state.startup.clone(),
        data_dir: state.data_dir.clone(),
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
        .store
        .lock()
        .unwrap()
        .start(project_id, notes.as_deref(), Utc::now(), today())
        .map_err(err)?;
    refresh_tray(&app, &status);
    Ok(status)
}

#[tauri::command]
fn stop(app: AppHandle, state: State<AppState>) -> Result<Status, String> {
    let status = state.store.lock().unwrap().stop(Utc::now()).map_err(err)?;
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
        .store
        .lock()
        .unwrap()
        .entries(parse(&from)?, parse(&to)?, project_id, Utc::now())
        .map_err(err)
}

#[tauri::command]
fn totals(state: State<AppState>, project_id: Option<i64>) -> Result<Totals, String> {
    let store = state.store.lock().unwrap();
    let week_start = WeekStart::from_setting(store.setting("week_start").map_err(err)?.as_deref());
    store
        .totals(today(), week_start, project_id, Utc::now())
        .map_err(err)
}

#[tauri::command]
fn set_notes(state: State<AppState>, entry_id: i64, notes: String) -> Result<(), String> {
    state
        .store
        .lock()
        .unwrap()
        .set_notes(entry_id, &notes, Utc::now())
        .map_err(err)
}

#[tauri::command]
fn create_project(state: State<AppState>, name: String) -> Result<Project, String> {
    state
        .store
        .lock()
        .unwrap()
        .create_project(&name, Utc::now())
        .map_err(err)
}

#[tauri::command]
fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    if !UI_SETTINGS.contains(&key.as_str()) {
        return Err(format!("unknown setting {key}"));
    }
    state
        .store
        .lock()
        .unwrap()
        .set_setting(&key, &value)
        .map_err(err)
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
        let mut store = state.store.lock().unwrap();
        let now = Utc::now();
        match store.status(now) {
            Ok(s) if s.running.is_some() => store.stop(now).map(Some),
            Ok(_) => match store.last_project_id().ok().flatten().or_else(|| {
                store
                    .projects()
                    .ok()?
                    .into_iter()
                    .find(|p| !p.archived)
                    .map(|p| p.id)
            }) {
                Some(p) => store.start(p, None, now, today()).map(Some),
                None => Ok(None),
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
            "quit" => app.exit(0),
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
fn spawn_ticker(app: AppHandle) {
    std::thread::spawn(move || {
        let mut ticks: u64 = 0;
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
            ticks += 1;
            let state = app.state::<AppState>();
            let status = {
                let store = state.store.lock().unwrap();
                let now = Utc::now();
                let status = store.status(now);
                if ticks % HEARTBEAT_EVERY_SECS == 0 {
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
                refresh_tray(&app, &status);
            }
        }
    });
}

// ----------------------------------------------------------------------- run

fn open_store(app: &AppHandle) -> Result<(Store, Startup, String), Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    let mut store = Store::open(dir.join("timekeeper.db"))?;
    let mut startup = Startup::default();

    // First run: bring in v1's data. v1 (Electron) kept its database in the
    // per-user config dir under "timekeeper"; it is opened read-only.
    if store.is_empty()? && store.setting("v1_imported_at")?.is_none() {
        let v1 = app
            .path()
            .config_dir()?
            .join("timekeeper")
            .join("timekeeper.db");
        if v1.exists() {
            match store.import_v1(&v1, local_day) {
                Ok(report) => startup.imported = Some(report),
                Err(e) => startup.import_error = Some(e.to_string()),
            }
        }
    }

    startup.recovered = store.recover_stale(Utc::now(), Duration::minutes(STALE_AFTER))?;
    Ok((store, startup, dir.display().to_string()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app)
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let (store, startup, data_dir) = open_store(&handle)?;
            let status = store.status(Utc::now())?;
            app.manage(AppState {
                store: Mutex::new(store),
                startup,
                data_dir,
            });
            let tray = build_tray(&handle)?;
            app.manage(tray);
            refresh_tray(&handle, &status);
            spawn_ticker(handle);
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
            create_project,
            set_setting
        ])
        .run(tauri::generate_context!())
        .expect("error while running TimeKeeper");
}
