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
            let store = Store::new().map_err(describe)?;
            store
                .build(&self.service, &self.user, None)
                .map_err(describe)
        }
    }

    /// D-Bus calls block, and an unlock prompt waits on the user, so free the async worker.
    fn blocking<T>(f: impl FnOnce() -> T) -> T {
        tokio::task::block_in_place(f)
    }

    /// No session bus, or one with nothing serving `org.freedesktop.secrets`.
    fn unavailable(e: &ServiceError) -> bool {
        use zbus::fdo::Error as Fdo;
        let no_owner = |e: &Fdo| matches!(e, Fdo::ServiceUnknown(_) | Fdo::NameHasNoOwner(_));
        match e {
            ServiceError::Unavailable => true,
            // The session bus socket isn't there.
            ServiceError::Zbus(zbus::Error::Connection(..)) => true,
            ServiceError::Zbus(zbus::Error::MethodError(name, ..)) => matches!(
                name.as_str(),
                "org.freedesktop.DBus.Error.ServiceUnknown"
                    | "org.freedesktop.DBus.Error.NameHasNoOwner"
            ),
            ServiceError::Zbus(zbus::Error::FDO(e)) => no_owner(e),
            ServiceError::ZbusFdo(e) => no_owner(e),
            _ => false,
        }
    }

    /// `NoStorageAccess` also covers a missing default collection, so check what's underneath.
    pub(super) fn describe(e: Error) -> String {
        let cause = match &e {
            Error::NoStorageAccess(b) | Error::PlatformFailure(b) => b.downcast_ref(),
            _ => None,
        };
        match cause {
            Some(c) if unavailable(c) => UNAVAILABLE.into(),
            Some(ServiceError::Locked | ServiceError::Prompt) => {
                "The keyring is locked. Unlock it, then try again.".into()
            }
            _ => format!("Couldn't access the keyring: {e}"),
        }
    }

    impl super::SecretStore for Keychain {
        fn get(&self) -> Result<Option<String>, String> {
            blocking(|| match self.entry()?.get_password() {
                Ok(secret) => Ok(Some(secret)),
                Err(Error::NoEntry) => Ok(None),
                Err(e) => Err(describe(e)),
            })
        }

        fn set(&self, secret: &str) -> Result<(), String> {
            blocking(|| self.entry()?.set_password(secret).map_err(describe))
        }

        fn delete(&self) -> Result<(), String> {
            blocking(|| match self.entry()?.delete_credential() {
                Ok(()) | Err(Error::NoEntry) => Ok(()),
                Err(e) => Err(describe(e)),
            })
        }

        fn writable(&self) -> Result<(), String> {
            blocking(|| self.entry().map(drop))
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
        use secret_service::Error as ServiceError;
        // The store's own wrapper, so a `secret-service` version split fails to compile.
        use zbus_secret_service_keyring_store::errors::decode_error;
        let locked = "The keyring is locked. Unlock it, then try again.";

        let describe = |e| linux::describe(decode_error(e));
        assert_eq!(describe(ServiceError::Locked), locked);
        assert_eq!(describe(ServiceError::Prompt), locked);
        // No default collection: not a lock, so the real cause is shown.
        assert!(describe(ServiceError::NoResult).starts_with("Couldn't access the keyring: "));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn describes_only_a_missing_service_as_unavailable() {
        use secret_service::Error as ServiceError;
        use zbus::fdo::Error as Fdo;
        use zbus::message::Message;
        use zbus_secret_service_keyring_store::errors::platform_failure;

        let describe = |e| linux::describe(platform_failure(e));
        let unavailable = linux::UNAVAILABLE.to_string();
        assert_eq!(describe(ServiceError::Unavailable), unavailable);
        assert_eq!(
            describe(ServiceError::ZbusFdo(Fdo::ServiceUnknown("x".into()))),
            unavailable
        );

        // No session bus to connect to.
        let no_bus = zbus::Error::Connection(
            std::sync::Arc::new(std::io::ErrorKind::NotFound.into()),
            "unix:path=/nonexistent/bus".parse().unwrap(),
        );
        assert_eq!(describe(ServiceError::Zbus(no_bus)), unavailable);

        // A bus that's up with no provider answers OpenSession with ServiceUnknown.
        let call = Message::method_call("/org/freedesktop/secrets", "OpenSession")
            .unwrap()
            .build(&())
            .unwrap();
        let reply = Message::error(&call.header(), "org.freedesktop.DBus.Error.ServiceUnknown")
            .unwrap()
            .build(&("not activatable",))
            .unwrap();
        assert_eq!(describe(ServiceError::Zbus(reply.into())), unavailable);

        // A bus and a provider that fail some other way show the real cause.
        assert!(
            describe(ServiceError::Crypto("bad key")).starts_with("Couldn't access the keyring: ")
        );
    }
}
