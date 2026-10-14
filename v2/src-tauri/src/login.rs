//! Start at login: a per-user Windows Run entry that launches the app hidden in the tray.
//! The choice is also saved, so an upgrade's uninstall step can't silently turn it off.

use std::ffi::OsStr;

/// Passed by the login entry; the window stays hidden until opened from the tray.
pub const HIDDEN_ARG: &str = "--hidden";

/// The saved choice, in the `settings` table ("on" or "off").
pub const SETTING: &str = "start_at_login";

/// What Windows has for the app's login entry.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LoginEntry {
    Missing,
    Enabled,
    /// Switched off in Task Manager's Startup apps. The flag outlives the Run value,
    /// so an upgrade that deletes the entry doesn't turn it back on.
    DisabledInTaskManager,
}

pub fn launched_hidden<S: AsRef<OsStr>>(args: impl IntoIterator<Item = S>) -> bool {
    args.into_iter().any(|a| a.as_ref() == HIDDEN_ARG)
}

/// At launch: whether the entry should be on, which is also the choice to save.
/// Windows wins when it has an answer; a missing entry is restored if the choice was on,
/// since the installer's "uninstall first" step deletes it on every manual upgrade.
pub fn reconcile(entry: LoginEntry, saved_on: bool) -> bool {
    match entry {
        LoginEntry::Enabled => true,
        LoginEntry::DisabledInTaskManager => false,
        LoginEntry::Missing => saved_on,
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
        pub fn for_current_exe(name: &str) -> Option<Self> {
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
                LoginEntry::DisabledInTaskManager
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

/// Start at login is Windows-only; elsewhere there's never an item.
#[cfg(not(windows))]
pub struct LoginItem(std::convert::Infallible);

#[cfg(not(windows))]
impl LoginItem {
    pub fn for_current_exe(_name: &str) -> Option<Self> {
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
    fn reconcile_follows_windows_when_the_entry_exists() {
        assert!(reconcile(LoginEntry::Enabled, false));
        assert!(reconcile(LoginEntry::Enabled, true));
        assert!(!reconcile(LoginEntry::DisabledInTaskManager, true));
        assert!(!reconcile(LoginEntry::DisabledInTaskManager, false));
    }

    #[test]
    fn reconcile_restores_a_missing_entry_only_if_it_was_on() {
        assert!(reconcile(LoginEntry::Missing, true));
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
            assert_eq!(item.state().unwrap(), LoginEntry::DisabledInTaskManager);

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
            assert_eq!(item.state().unwrap(), LoginEntry::DisabledInTaskManager);
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
}
