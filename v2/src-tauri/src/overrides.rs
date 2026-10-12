//! Debug-only environment overrides, so `scripts/smoke-windows.ts` can run the app against a temp
//! data dir with short timings. Release builds ignore the environment.

use std::path::PathBuf;

/// The most seconds `chrono::Duration::seconds` accepts.
const MAX_SECS: u64 = i64::MAX as u64 / 1_000;

#[derive(Debug, Default, PartialEq)]
pub struct Overrides {
    /// `TK_DATA_DIR`: replaces the per-user app data dir.
    pub data_dir: Option<PathBuf>,
    /// `TK_V1_IMPORT_DB`: the v1 database the first-run import reads.
    pub v1_import_db: Option<PathBuf>,
    /// `TK_HEARTBEAT_SECS`: how often a running timer writes its heartbeat.
    pub heartbeat_secs: Option<u64>,
    /// `TK_STALE_AFTER_SECS`: heartbeat age at which startup closes a running timer.
    pub stale_after_secs: Option<u64>,
}

impl Overrides {
    pub fn from_env() -> Result<Self, String> {
        if cfg!(debug_assertions) {
            Self::parse(|key| std::env::var(key).ok())
        } else {
            Ok(Self::default())
        }
    }

    fn parse(var: impl Fn(&str) -> Option<String>) -> Result<Self, String> {
        let set = |key: &str| var(key).filter(|v| !v.is_empty());
        let secs = |key: &str| {
            set(key)
                .map(|v| match v.parse::<u64>() {
                    Ok(n) if n > 0 && n <= MAX_SECS => Ok(n),
                    _ => Err(format!(
                        "{key} must be a positive whole number of seconds, got {v:?}"
                    )),
                })
                .transpose()
        };
        Ok(Self {
            data_dir: set("TK_DATA_DIR").map(PathBuf::from),
            v1_import_db: set("TK_V1_IMPORT_DB").map(PathBuf::from),
            heartbeat_secs: secs("TK_HEARTBEAT_SECS")?,
            stale_after_secs: secs("TK_STALE_AFTER_SECS")?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn parse(pairs: &[(&str, &str)]) -> Result<Overrides, String> {
        let env: HashMap<String, String> = pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        Overrides::parse(|key| env.get(key).cloned())
    }

    #[test]
    fn nothing_set_overrides_nothing() {
        assert_eq!(parse(&[]), Ok(Overrides::default()));
    }

    #[test]
    fn reads_every_override() {
        let o = parse(&[
            ("TK_DATA_DIR", "C:\\tmp\\tk"),
            ("TK_V1_IMPORT_DB", "C:\\tmp\\v1.db"),
            ("TK_HEARTBEAT_SECS", "1"),
            ("TK_STALE_AFTER_SECS", "5"),
        ])
        .unwrap();
        assert_eq!(
            o,
            Overrides {
                data_dir: Some(PathBuf::from("C:\\tmp\\tk")),
                v1_import_db: Some(PathBuf::from("C:\\tmp\\v1.db")),
                heartbeat_secs: Some(1),
                stale_after_secs: Some(5),
            }
        );
    }

    #[test]
    fn empty_values_count_as_unset() {
        assert_eq!(
            parse(&[("TK_DATA_DIR", ""), ("TK_HEARTBEAT_SECS", "")]),
            Ok(Overrides::default())
        );
    }

    #[test]
    fn rejects_seconds_that_are_not_a_positive_whole_number() {
        for bad in ["0", "-1", "1.5", "soon", "99999999999999999"] {
            let err = parse(&[("TK_HEARTBEAT_SECS", bad)]).unwrap_err();
            assert!(err.contains("TK_HEARTBEAT_SECS"), "{err}");
        }
        assert!(parse(&[("TK_STALE_AFTER_SECS", "0")]).is_err());
    }
}
