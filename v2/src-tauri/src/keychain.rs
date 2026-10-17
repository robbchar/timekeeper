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

#[cfg(not(windows))]
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

#[cfg(not(windows))]
mod other {
    const UNSUPPORTED: &str = "Saving a Linear key is only supported on Windows.";

    /// No credential store outside Windows; nothing is ever saved.
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

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn round_trips_through_credential_manager() {
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
}
