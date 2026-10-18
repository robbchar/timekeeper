//! The Linear API key, kept in the OS credential store and never in SQLite or settings.

/// One secret in the OS credential store.
pub trait SecretStore {
    fn get(&self) -> Result<Option<String>, String>;
    fn set(&self, secret: &str) -> Result<(), String>;
    /// Removing a secret that isn't there succeeds.
    fn delete(&self) -> Result<(), String>;
    /// `Err` with the reason when `set` can never succeed here.
    fn writable(&self) -> Result<(), String> {
        Ok(())
    }
}

/// Debug builds use their own entry, so `tauri dev` never touches the installed app's key.
pub fn linear_key_user() -> &'static str {
    if cfg!(debug_assertions) {
        "linear-api-key-dev"
    } else {
        "linear-api-key"
    }
}

#[cfg(target_os = "linux")]
pub use self::linux::Keychain;
#[cfg(not(any(windows, target_os = "linux")))]
pub use self::other::Keychain;
#[cfg(windows)]
pub use self::windows::Keychain;

#[cfg(windows)]
mod windows {
    use keyring::v1::{Entry, Error};

    /// An entry in Windows Credential Manager.
    pub struct Keychain {
        service: String,
        user: String,
    }

    impl Keychain {
        pub fn new(service: &str, user: &str) -> Self {
            Self {
                service: service.into(),
                user: user.into(),
            }
        }

        fn entry(&self) -> Result<Entry, String> {
            Entry::new(&self.service, &self.user).map_err(describe)
        }
    }

    fn describe(e: Error) -> String {
        format!("Couldn't access Windows Credential Manager: {e}")
    }

    impl super::SecretStore for Keychain {
        fn get(&self) -> Result<Option<String>, String> {
            match self.entry()?.get_password() {
                Ok(secret) => Ok(Some(secret)),
                Err(Error::NoEntry) => Ok(None),
                Err(e) => Err(describe(e)),
            }
        }

        fn set(&self, secret: &str) -> Result<(), String> {
            self.entry()?.set_password(secret).map_err(describe)
        }

        fn delete(&self) -> Result<(), String> {
            match self.entry()?.delete_credential() {
                Ok(()) | Err(Error::NoEntry) => Ok(()),
                Err(e) => Err(describe(e)),
            }
        }
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use keyring_core::api::CredentialStoreApi;
    use keyring_core::{Entry, Error};
    use secret_service::Error as ServiceError;
    use zbus_secret_service_keyring_store::Store;

    pub(super) const UNAVAILABLE: &str =
        "No keyring service is running (GNOME Keyring or KWallet). \
        Start one, then try again.";

    /// An item in the desktop's Secret Service.
    pub struct Keychain {
        service: String,
        user: String,
    }

    impl Keychain {
        pub fn new(service: &str, user: &str) -> Self {
            Self {
                service: service.into(),
                user: user.into(),
            }
        }

        /// Connects on every call, so a keyring that starts after the app is still found.
        fn entry(&self) -> Result<Entry, String> {
            let store = Store::new().map_err(|_| UNAVAILABLE.to_string())?;
            store
                .build(&self.service, &self.user, None)
                .map_err(describe)
        }
    }

    /// `NoStorageAccess` also covers a missing default collection, so check what's underneath.
    pub(super) fn describe(e: Error) -> String {
        let locked = match &e {
            Error::NoStorageAccess(b) => matches!(
                b.downcast_ref(),
                Some(ServiceError::Locked | ServiceError::Prompt)
            ),
            _ => false,
        };
        if locked {
            "The keyring is locked. Unlock it, then try again.".into()
        } else {
            format!("Couldn't access the keyring: {e}")
        }
    }

    impl super::SecretStore for Keychain {
        fn get(&self) -> Result<Option<String>, String> {
            match self.entry()?.get_password() {
                Ok(secret) => Ok(Some(secret)),
                Err(Error::NoEntry) => Ok(None),
                Err(e) => Err(describe(e)),
            }
        }

        fn set(&self, secret: &str) -> Result<(), String> {
            self.entry()?.set_password(secret).map_err(describe)
        }

        fn delete(&self) -> Result<(), String> {
            match self.entry()?.delete_credential() {
                Ok(()) | Err(Error::NoEntry) => Ok(()),
                Err(e) => Err(describe(e)),
            }
        }

        fn writable(&self) -> Result<(), String> {
            self.entry().map(drop)
        }
    }
}

#[cfg(not(any(windows, target_os = "linux")))]
mod other {
    const UNSUPPORTED: &str = "Saving a Linear key is only supported on Windows and Linux.";

    /// No credential store on this platform; nothing is ever saved.
    pub struct Keychain;

    impl Keychain {
        pub fn new(_service: &str, _user: &str) -> Self {
            Self
        }
    }

    impl super::SecretStore for Keychain {
        fn get(&self) -> Result<Option<String>, String> {
            Ok(None)
        }
        fn set(&self, _secret: &str) -> Result<(), String> {
            Err(UNSUPPORTED.into())
        }
        fn delete(&self) -> Result<(), String> {
            Ok(())
        }
        fn writable(&self) -> Result<(), String> {
            Err(UNSUPPORTED.into())
        }
    }
}

#[cfg(test)]
mod tests {
    #[cfg(any(windows, target_os = "linux"))]
    use super::*;

    /// On Linux this needs a scratch Secret Service; CI runs it under `dbus-run-session`.
    #[cfg(any(windows, target_os = "linux"))]
    #[cfg_attr(target_os = "linux", ignore = "needs a scratch Secret Service")]
    #[test]
    fn round_trips_through_the_os_store() {
        // A scratch entry, never the app's own.
        let user = format!("scratch-{}", std::process::id());
        let k = Keychain::new("dev.cathedraltree.timekeeper.test", &user);
        k.delete().unwrap();
        assert_eq!(k.get().unwrap(), None);

        k.set("lin_api_secret").unwrap();
        assert_eq!(k.get().unwrap().as_deref(), Some("lin_api_secret"));

        k.delete().unwrap();
        assert_eq!(k.get().unwrap(), None);
        k.delete().unwrap();
    }

    /// Runs itself again in a child process whose session bus doesn't exist, so the
    /// real keyring is never reached and no other test's environment changes.
    #[cfg(target_os = "linux")]
    #[test]
    fn no_secret_service_is_a_clear_error() {
        const CHILD: &str = "TIMEKEEPER_TEST_NO_BUS";
        if std::env::var_os(CHILD).is_none() {
            let status = std::process::Command::new(std::env::current_exe().unwrap())
                .args([
                    "keychain::tests::no_secret_service_is_a_clear_error",
                    "--exact",
                ])
                .env(CHILD, "1")
                .env(
                    "DBUS_SESSION_BUS_ADDRESS",
                    "unix:path=/nonexistent/timekeeper-test-bus",
                )
                .status()
                .unwrap();
            assert!(status.success());
            return;
        }
        let k = Keychain::new("dev.cathedraltree.timekeeper.test", "scratch");
        let unavailable = Err(linux::UNAVAILABLE.to_string());
        assert_eq!(k.writable(), unavailable);
        assert_eq!(k.set("lin_api_secret"), unavailable);
        assert_eq!(k.get(), Err(linux::UNAVAILABLE.to_string()));
        assert_eq!(k.delete(), unavailable);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn describes_only_a_real_lock_as_locked() {
        use keyring_core::Error;
        use secret_service::Error as ServiceError;
        let locked = "The keyring is locked. Unlock it, then try again.";

        let no_access = |e| linux::describe(Error::NoStorageAccess(Box::new(e)));
        assert_eq!(no_access(ServiceError::Locked), locked);
        assert_eq!(no_access(ServiceError::Prompt), locked);
        // No default collection: not a lock, so the real cause is shown.
        assert!(no_access(ServiceError::NoResult).starts_with("Couldn't access the keyring: "));
    }
}
