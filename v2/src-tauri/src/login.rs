//! Start at login: a per-user Windows Run entry, or an XDG autostart file on Linux, that
//! launches the app hidden in the tray. The choice is also saved, so an upgrade's uninstall
//! step can't silently turn it off.

use std::ffi::OsStr;

/// Passed by the login entry; the window stays hidden until opened from the tray.
pub const HIDDEN_ARG: &str = "--hidden";

/// The saved choice, in the `settings` table ("on" or "off").
pub const SETTING: &str = "start_at_login";

/// What the OS has for the app's login entry.
// Only the platform modules construct these outside tests.
#[cfg_attr(not(any(windows, target_os = "linux")), allow(dead_code))]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LoginEntry {
    Missing,
    Enabled,
    /// Switched off outside the app: Task Manager's Startup apps on Windows, whose flag
    /// outlives the Run value so an upgrade doesn't turn it back on; `Hidden=true` or
    /// `X-GNOME-Autostart-enabled=false` on Linux.
    DisabledByOs,
}

pub fn launched_hidden<S: AsRef<OsStr>>(args: impl IntoIterator<Item = S>) -> bool {
    args.into_iter().any(|a| a.as_ref() == HIDDEN_ARG)
}

/// Windows' installer deletes the Run value on every manual upgrade, so a missing entry is
/// restored there. Nothing deletes a Linux autostart file but the user, so it means off.
const RESTORES_MISSING: bool = cfg!(windows);

/// At launch: whether the entry should be on, which is also the choice to save.
/// The OS wins when it has an answer.
pub fn reconcile(entry: LoginEntry, saved_on: bool) -> bool {
    match entry {
        LoginEntry::Enabled => true,
        LoginEntry::DisabledByOs => false,
        LoginEntry::Missing => saved_on && RESTORES_MISSING,
    }
}

#[cfg(windows)]
pub use windows::LoginItem;

#[cfg(windows)]
mod windows {
    use super::{LoginEntry, HIDDEN_ARG};
    use windows_registry::{Key, CURRENT_USER};
    use windows_result::WIN32_ERROR;

    const RUN: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const APPROVED: &str =
        r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
    const ERROR_FILE_NOT_FOUND: WIN32_ERROR = WIN32_ERROR(2);

    pub struct LoginItem {
        /// The value name in both keys. The NSIS uninstaller deletes it as `${PRODUCTNAME}`.
        name: String,
        command: String,
        run: String,
        approved: String,
    }

    /// A missing key or value is `None`; anything else is an error.
    fn optional<T>(r: windows_registry::Result<T>) -> windows_registry::Result<Option<T>> {
        match r {
            Ok(v) => Ok(Some(v)),
            Err(e) if WIN32_ERROR::from_error(&e) == Some(ERROR_FILE_NOT_FOUND) => Ok(None),
            Err(e) => Err(e),
        }
    }

    fn remove(key: &str, name: &str) -> windows_registry::Result<()> {
        let Some(key) = optional(CURRENT_USER.options().write().open(key))? else {
            return Ok(());
        };
        optional(key.remove_value(name)).map(drop)
    }

    impl LoginItem {
        /// `None` if the running exe's path can't be found.
        pub fn for_current_exe(name: &str, _id: &str) -> Option<Self> {
            let exe = std::env::current_exe().ok()?;
            Some(Self::at(RUN, APPROVED, name, &exe))
        }

        pub(crate) fn at(run: &str, approved: &str, name: &str, exe: &std::path::Path) -> Self {
            Self {
                name: name.to_string(),
                // Quoted: the install dir has a space, and Windows guesses at unquoted paths.
                command: format!("\"{}\" {HIDDEN_ARG}", exe.display()),
                run: run.to_string(),
                approved: approved.to_string(),
            }
        }

        fn value(&self, key: &str) -> windows_registry::Result<Option<windows_registry::Value>> {
            let Some(key): Option<Key> = optional(CURRENT_USER.open(key))? else {
                return Ok(None);
            };
            optional(key.get_value(&self.name))
        }

        pub fn state(&self) -> Result<LoginEntry, String> {
            let err = |e: windows_result::Error| e.to_string();
            // Task Manager writes a flag byte: even means enabled, odd means disabled.
            let disabled = self
                .value(&self.approved)
                .map_err(err)?
                .is_some_and(|v| v.first().is_some_and(|b| b & 1 == 1));
            Ok(if disabled {
                LoginEntry::DisabledByOs
            } else if self.value(&self.run).map_err(err)?.is_some() {
                LoginEntry::Enabled
            } else {
                LoginEntry::Missing
            })
        }

        /// Turning it on also clears a Task Manager "disabled" flag; no flag reads as enabled.
        pub fn set(&self, on: bool) -> Result<(), String> {
            let result = if on {
                CURRENT_USER
                    .create(&self.run)
                    .and_then(|k| k.set_string(&self.name, &self.command))
            } else {
                remove(&self.run, &self.name)
            };
            result
                .and_then(|()| remove(&self.approved, &self.name))
                .map_err(|e| e.to_string())
        }

        /// Writes the Run value unless it already launches this exe; leaves the flag alone.
        pub fn refresh(&self) -> Result<(), String> {
            if self.command().map_err(|e| e.to_string())?.as_deref() == Some(&self.command) {
                return Ok(());
            }
            CURRENT_USER
                .create(&self.run)
                .and_then(|k| k.set_string(&self.name, &self.command))
                .map_err(|e| e.to_string())
        }

        pub(crate) fn command(&self) -> windows_registry::Result<Option<String>> {
            Ok(self
                .value(&self.run)?
                .map(|v| String::try_from(v).unwrap_or_default()))
        }
    }
}

#[cfg(target_os = "linux")]
pub use linux::LoginItem;

#[cfg(target_os = "linux")]
mod linux {
    use super::{LoginEntry, HIDDEN_ARG};
    use std::io::ErrorKind;
    use std::path::{Path, PathBuf};

    const GROUP: &str = "[Desktop Entry]";

    /// `<config>/autostart/<id>.desktop`, read by the desktop session at login.
    pub struct LoginItem {
        path: PathBuf,
        /// The `Exec` value, compared as written so it never needs parsing back.
        exec: String,
        contents: String,
    }

    /// `$XDG_CONFIG_HOME`, or `~/.config` when it's unset or relative, as the spec says.
    fn config_dir() -> Option<PathBuf> {
        std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .filter(|p| p.is_absolute())
            .or_else(|| Some(PathBuf::from(std::env::var_os("HOME")?).join(".config")))
    }

    /// One quoted `Exec` argument: Exec quoting first, then the string-value escapes.
    fn exec_arg(arg: &str) -> String {
        let mut out = String::from("\"");
        for c in arg.chars() {
            match c {
                '"' | '`' | '$' => {
                    out.push_str("\\\\");
                    out.push(c);
                }
                '\\' => out.push_str("\\\\\\\\"),
                '%' => out.push_str("%%"),
                c => out.push(c),
            }
        }
        out.push('"');
        out
    }

    /// The trimmed values of `key` in the `[Desktop Entry]` group.
    fn values<'a>(contents: &'a str, key: &'a str) -> impl Iterator<Item = &'a str> + 'a {
        let mut in_group = false;
        contents.lines().filter_map(move |line| {
            let line = line.trim();
            if line.starts_with('[') {
                in_group = line == GROUP;
                return None;
            }
            let (k, v) = line.split_once('=')?;
            (in_group && k.trim() == key).then(|| v.trim())
        })
    }

    impl LoginItem {
        /// `None` if the app's path or the config dir can't be found.
        pub fn for_current_exe(name: &str, id: &str) -> Option<Self> {
            // Inside an AppImage the exe is in a mount that changes on every launch.
            let exe = match std::env::var_os("APPIMAGE") {
                Some(image) => PathBuf::from(image),
                None => std::env::current_exe().ok()?,
            };
            Some(Self::at(&config_dir()?.join("autostart"), id, name, &exe))
        }

        pub(crate) fn at(dir: &Path, id: &str, name: &str, exe: &Path) -> Self {
            let exec = format!("{} {HIDDEN_ARG}", exec_arg(&exe.to_string_lossy()));
            let contents = format!(
                "{GROUP}\nType=Application\nName={name}\nExec={exec}\nTerminal=false\n\
                 X-GNOME-Autostart-enabled=true\n"
            );
            Self {
                path: dir.join(format!("{id}.desktop")),
                exec,
                contents,
            }
        }

        fn read(&self) -> Result<Option<String>, String> {
            match std::fs::read_to_string(&self.path) {
                Ok(s) => Ok(Some(s)),
                Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
                Err(e) => Err(format!("Couldn't read {}: {e}", self.path.display())),
            }
        }

        /// Through a temp file and a rename, so a half-written file is never left behind.
        fn write(&self) -> Result<(), String> {
            let err = |e: std::io::Error| format!("Couldn't write {}: {e}", self.path.display());
            if let Some(dir) = self.path.parent() {
                std::fs::create_dir_all(dir).map_err(err)?;
            }
            let tmp = self.path.with_extension("desktop.tmp");
            std::fs::write(&tmp, &self.contents).map_err(err)?;
            std::fs::rename(&tmp, &self.path).map_err(err)
        }

        pub fn state(&self) -> Result<LoginEntry, String> {
            let Some(contents) = self.read()? else {
                return Ok(LoginEntry::Missing);
            };
            let hidden = values(&contents, "Hidden").any(|v| v == "true");
            let off = values(&contents, "X-GNOME-Autostart-enabled").any(|v| v == "false");
            Ok(if hidden || off {
                LoginEntry::DisabledByOs
            } else {
                LoginEntry::Enabled
            })
        }

        /// Turning it on rewrites the whole file, which also clears an outside "off".
        pub fn set(&self, on: bool) -> Result<(), String> {
            if on {
                return self.write();
            }
            match std::fs::remove_file(&self.path) {
                Ok(()) => Ok(()),
                Err(e) if e.kind() == ErrorKind::NotFound => Ok(()),
                Err(e) => Err(format!("Couldn't remove {}: {e}", self.path.display())),
            }
        }

        /// Rewrites the file unless it already launches this exe.
        pub fn refresh(&self) -> Result<(), String> {
            if self.command()?.as_deref() == Some(&self.exec) {
                return Ok(());
            }
            self.write()
        }

        pub(crate) fn command(&self) -> Result<Option<String>, String> {
            Ok(self
                .read()?
                .and_then(|c| values(&c, "Exec").next().map(str::to_string)))
        }
    }
}

/// Start at login is Windows- and Linux-only; elsewhere there's never an item.
#[cfg(not(any(windows, target_os = "linux")))]
pub struct LoginItem(std::convert::Infallible);

#[cfg(not(any(windows, target_os = "linux")))]
impl LoginItem {
    pub fn for_current_exe(_name: &str, _id: &str) -> Option<Self> {
        None
    }
    pub fn state(&self) -> Result<LoginEntry, String> {
        match self.0 {}
    }
    pub fn set(&self, _on: bool) -> Result<(), String> {
        match self.0 {}
    }
    pub fn refresh(&self) -> Result<(), String> {
        match self.0 {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hidden_arg_is_found_anywhere_in_the_args() {
        assert!(launched_hidden([
            r"C:\TimeKeeper v2\timekeeper.exe",
            "--hidden"
        ]));
        assert!(launched_hidden(["--hidden"]));
        assert!(!launched_hidden([r"C:\TimeKeeper v2\timekeeper.exe"]));
        assert!(!launched_hidden(["timekeeper.exe", "--hidden-not"]));
        assert!(!launched_hidden(Vec::<String>::new()));
    }

    #[test]
    fn reconcile_follows_the_os_when_the_entry_exists() {
        assert!(reconcile(LoginEntry::Enabled, false));
        assert!(reconcile(LoginEntry::Enabled, true));
        assert!(!reconcile(LoginEntry::DisabledByOs, true));
        assert!(!reconcile(LoginEntry::DisabledByOs, false));
    }

    #[cfg(windows)]
    #[test]
    fn reconcile_restores_a_missing_entry_only_if_it_was_on() {
        assert!(reconcile(LoginEntry::Missing, true));
        assert!(!reconcile(LoginEntry::Missing, false));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn reconcile_reads_a_missing_autostart_file_as_off() {
        assert!(!reconcile(LoginEntry::Missing, true));
        assert!(!reconcile(LoginEntry::Missing, false));
    }

    /// Uses scratch keys under HKCU, never the real Run key.
    #[cfg(windows)]
    mod registry {
        use super::super::*;
        use windows_registry::CURRENT_USER;

        struct Scratch(String);
        impl Drop for Scratch {
            fn drop(&mut self) {
                let _ = CURRENT_USER.remove_tree(&self.0);
            }
        }

        fn scratch(test: &str) -> (Scratch, LoginItem) {
            let root = format!(r"Software\TimeKeeperTest-{test}-{}", std::process::id());
            let item = LoginItem::at(
                &format!(r"{root}\Run"),
                &format!(r"{root}\Approved"),
                "TimeKeeper Test",
                std::path::Path::new(r"C:\Program Files\TimeKeeper v2\timekeeper.exe"),
            );
            (Scratch(root), item)
        }

        #[test]
        fn on_and_off_round_trip() {
            let (_s, item) = scratch("round-trip");
            assert_eq!(item.state().unwrap(), LoginEntry::Missing);

            item.set(true).unwrap();
            assert_eq!(item.state().unwrap(), LoginEntry::Enabled);
            assert_eq!(
                item.command().unwrap().as_deref(),
                Some(r#""C:\Program Files\TimeKeeper v2\timekeeper.exe" --hidden"#)
            );

            item.set(false).unwrap();
            assert_eq!(item.state().unwrap(), LoginEntry::Missing);
            item.set(false).unwrap(); // already off is fine
        }

        #[test]
        fn reads_task_manager_flag_and_clears_it_when_turned_on() {
            let (s, item) = scratch("task-manager");
            item.set(true).unwrap();
            let approved = CURRENT_USER.create(format!(r"{}\Approved", s.0)).unwrap();
            let flag = |first: u8| [first, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

            approved
                .set_bytes("TimeKeeper Test", windows_registry::Type::Bytes, &flag(3))
                .unwrap();
            assert_eq!(item.state().unwrap(), LoginEntry::DisabledByOs);

            approved
                .set_bytes("TimeKeeper Test", windows_registry::Type::Bytes, &flag(2))
                .unwrap();
            assert_eq!(item.state().unwrap(), LoginEntry::Enabled);

            approved
                .set_bytes("TimeKeeper Test", windows_registry::Type::Bytes, &flag(3))
                .unwrap();
            item.set(true).unwrap();
            assert_eq!(item.state().unwrap(), LoginEntry::Enabled);
        }

        #[test]
        fn task_manager_off_survives_losing_the_run_value() {
            let (s, item) = scratch("upgrade");
            item.set(true).unwrap();
            let approved = CURRENT_USER.create(format!(r"{}\Approved", s.0)).unwrap();
            approved
                .set_bytes("TimeKeeper Test", windows_registry::Type::Bytes, &[3; 12])
                .unwrap();
            // What the uninstaller does on a manual upgrade.
            CURRENT_USER
                .create(format!(r"{}\Run", s.0))
                .unwrap()
                .remove_value("TimeKeeper Test")
                .unwrap();
            assert_eq!(item.state().unwrap(), LoginEntry::DisabledByOs);
        }

        #[test]
        fn refresh_rewrites_a_stale_command_and_keeps_the_flag() {
            let (s, item) = scratch("refresh");
            let run = CURRENT_USER.create(format!(r"{}\Run", s.0)).unwrap();
            run.set_string("TimeKeeper Test", r#""C:\old\timekeeper.exe" --hidden"#)
                .unwrap();
            let approved = CURRENT_USER.create(format!(r"{}\Approved", s.0)).unwrap();
            approved
                .set_bytes("TimeKeeper Test", windows_registry::Type::Bytes, &[2; 12])
                .unwrap();

            item.refresh().unwrap();
            assert_eq!(
                item.command().unwrap().as_deref(),
                Some(r#""C:\Program Files\TimeKeeper v2\timekeeper.exe" --hidden"#)
            );
            assert!(approved.get_value("TimeKeeper Test").is_ok());

            let (_m, missing) = scratch("refresh-missing");
            missing.refresh().unwrap();
            assert_eq!(missing.state().unwrap(), LoginEntry::Enabled);
        }
    }

    /// Uses a scratch dir under the temp dir, never `~/.config/autostart`.
    #[cfg(target_os = "linux")]
    mod autostart {
        use super::super::*;
        use std::path::{Path, PathBuf};

        struct Scratch(PathBuf);
        impl Drop for Scratch {
            fn drop(&mut self) {
                let _ = std::fs::remove_dir_all(&self.0);
            }
        }

        const EXE: &str = "/home/me/Apps/TimeKeeper v2.AppImage";

        fn scratch(test: &str, exe: &str) -> (Scratch, LoginItem, PathBuf) {
            let root =
                std::env::temp_dir().join(format!("timekeeper-test-{test}-{}", std::process::id()));
            let dir = root.join("autostart");
            let item = LoginItem::at(
                &dir,
                "dev.test.timekeeper",
                "TimeKeeper Test",
                Path::new(exe),
            );
            (Scratch(root), item, dir.join("dev.test.timekeeper.desktop"))
        }

        fn read(file: &Path) -> String {
            std::fs::read_to_string(file).unwrap()
        }

        #[test]
        fn on_and_off_round_trip() {
            let (_s, item, file) = scratch("round-trip", EXE);
            assert_eq!(item.state().unwrap(), LoginEntry::Missing);

            item.set(true).unwrap();
            assert_eq!(item.state().unwrap(), LoginEntry::Enabled);
            assert_eq!(
                read(&file),
                "[Desktop Entry]\nType=Application\nName=TimeKeeper Test\n\
                 Exec=\"/home/me/Apps/TimeKeeper v2.AppImage\" --hidden\nTerminal=false\n\
                 X-GNOME-Autostart-enabled=true\n"
            );
            assert!(!file.with_extension("desktop.tmp").exists());

            item.set(false).unwrap();
            assert_eq!(item.state().unwrap(), LoginEntry::Missing);
            assert!(!file.exists());
            item.set(false).unwrap(); // already off is fine
        }

        #[test]
        fn deleting_the_file_outside_the_app_turns_it_off() {
            let (_s, item, file) = scratch("deleted", EXE);
            item.set(true).unwrap();
            std::fs::remove_file(&file).unwrap();
            assert!(!reconcile(item.state().unwrap(), true));
        }

        #[test]
        fn reads_an_outside_off_and_clears_it_when_turned_on() {
            let (_s, item, file) = scratch("outside-off", EXE);
            for off in ["Hidden=true", "X-GNOME-Autostart-enabled = false"] {
                item.set(true).unwrap();
                std::fs::write(&file, format!("{}{off}\n", read(&file))).unwrap();
                assert_eq!(item.state().unwrap(), LoginEntry::DisabledByOs);
                item.set(true).unwrap();
                assert_eq!(item.state().unwrap(), LoginEntry::Enabled);
            }
        }

        #[test]
        fn ignores_keys_outside_the_desktop_entry_group() {
            let (_s, item, file) = scratch("groups", EXE);
            item.set(true).unwrap();
            std::fs::write(
                &file,
                format!("{}[Desktop Action x]\nHidden=true\n", read(&file)),
            )
            .unwrap();
            assert_eq!(item.state().unwrap(), LoginEntry::Enabled);
        }

        #[test]
        fn refresh_rewrites_a_stale_path() {
            let (_s, item, file) = scratch("refresh", EXE);
            std::fs::create_dir_all(file.parent().unwrap()).unwrap();
            std::fs::write(
                &file,
                "[Desktop Entry]\nExec=\"/old/TimeKeeper.AppImage\" --hidden\n",
            )
            .unwrap();

            item.refresh().unwrap();
            assert_eq!(
                item.command().unwrap().as_deref(),
                Some(r#""/home/me/Apps/TimeKeeper v2.AppImage" --hidden"#)
            );
            assert_eq!(item.state().unwrap(), LoginEntry::Enabled);

            let (_m, missing, _) = scratch("refresh-missing", EXE);
            missing.refresh().unwrap();
            assert_eq!(missing.state().unwrap(), LoginEntry::Enabled);
        }

        #[test]
        fn escapes_reserved_characters_in_the_path() {
            let (_s, item, _) = scratch("escape", r#"/opt/a"b`c$d\e%f/tk"#);
            item.set(true).unwrap();
            assert_eq!(
                item.command().unwrap().as_deref(),
                Some(r#""/opt/a\\"b\\`c\\$d\\\\e%%f/tk" --hidden"#)
            );
        }
    }
}
