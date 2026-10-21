//! Startup settings that debug builds can override from the environment, so
//! `scripts/smoke-windows.ts` can run the app against a temp data dir with short timings.
//! Release builds ignore the environment and get the defaults.

use chrono::Duration;
use std::path::PathBuf;

/// A timer with no heartbeat for this long was left running by a run that
/// ended without stopping it.
const STALE_AFTER_SECS: u64 = 2 * 60;
const HEARTBEAT_EVERY_SECS: u64 = 30;
/// The most seconds `chrono::Duration::seconds` accepts.
const MAX_SECS: u64 = i64::MAX as u64 / 1_000;

#[derive(Debug, PartialEq)]
pub struct Overrides {
    /// `TK_DATA_DIR`: replaces the per-user app data dir.
    pub data_dir: Option<PathBuf>,
    /// `TK_V1_IMPORT_DB`: the v1 database the first-run import reads.
    pub v1_import_db: Option<PathBuf>,
    /// `TK_HEARTBEAT_SECS`: how often a running timer writes its heartbeat.
    pub heartbeat_every_secs: u64,
    /// `TK_STALE_AFTER_SECS`: heartbeat age at which startup closes a running timer.
    pub stale_after: Duration,
    /// `TK_IDLE_SECS`: replaces the idle setting, so the idle prompt can be tried in seconds.
    pub idle_after: Option<Duration>,
}

impl Default for Overrides {
    fn default() -> Self {
        Self {
            data_dir: None,
            v1_import_db: None,
            heartbeat_every_secs: HEARTBEAT_EVERY_SECS,
            stale_after: Duration::seconds(STALE_AFTER_SECS as i64),
            idle_after: None,
        }
    }
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
        let secs_if_set = |key: &str| match set(key) {
            None => Ok(None),
            Some(v) => match v.parse::<u64>() {
                Ok(n) if n > 0 && n <= MAX_SECS => Ok(Some(n)),
                _ => Err(format!(
                    "{key} must be a positive whole number of seconds, got {v:?}"
                )),
            },
        };
        let secs = |key: &str, default: u64| secs_if_set(key).map(|n| n.unwrap_or(default));
        Ok(Self {
            data_dir: set("TK_DATA_DIR").map(PathBuf::from),
            v1_import_db: set("TK_V1_IMPORT_DB").map(PathBuf::from),
            heartbeat_every_secs: secs("TK_HEARTBEAT_SECS", HEARTBEAT_EVERY_SECS)?,
            stale_after: Duration::seconds(secs("TK_STALE_AFTER_SECS", STALE_AFTER_SECS)? as i64),
            idle_after: secs_if_set("TK_IDLE_SECS")?.map(|n| Duration::seconds(n as i64)),
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
            ("TK_IDLE_SECS", "10"),
        ])
        .unwrap();
        assert_eq!(
            o,
            Overrides {
                data_dir: Some(PathBuf::from("C:\\tmp\\tk")),
                v1_import_db: Some(PathBuf::from("C:\\tmp\\v1.db")),
                heartbeat_every_secs: 1,
                stale_after: Duration::seconds(5),
                idle_after: Some(Duration::seconds(10)),
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
        assert!(parse(&[("TK_IDLE_SECS", "0")]).is_err());
        let max = MAX_SECS.to_string();
        assert!(parse(&[("TK_STALE_AFTER_SECS", &max)]).is_ok());
        let over = (MAX_SECS + 1).to_string();
        assert!(parse(&[("TK_STALE_AFTER_SECS", &over)]).is_err());
    }
}
