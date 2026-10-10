//! TimeKeeper's storage, timer and reporting.
//!
//! This crate has no GUI dependencies so it can be tested on its own and reused
//! by anything that needs the data (the Tauri app today, maybe a small server
//! for remote stop later).
//!
//! Model, in one paragraph: a **project** has **entries**, one per day of work
//! (occasionally more). An entry's duration is the sum of its **intervals**.
//! An interval with no `end_at` is the running timer, so the timer survives a
//! crash by construction. At most one interval is open at a time.

mod import;
mod schema;

pub use import::ImportReport;

use chrono::{DateTime, Datelike, Duration, NaiveDate, SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::path::Path;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),
    #[error("project {0} not found")]
    ProjectNotFound(i64),
    #[error("entry {0} not found")]
    EntryNotFound(i64),
    #[error("{0}")]
    Invalid(String),
}

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
    pub archived: bool,
}

/// One row in the day list: what gets copied into the client's system.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: i64,
    pub project_id: i64,
    pub project_name: String,
    pub project_color: Option<String>,
    /// Local calendar day, `YYYY-MM-DD`.
    pub day: String,
    pub notes: String,
    /// Total seconds, including the running interval if this entry is timing.
    pub seconds: i64,
    pub running: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Running {
    pub entry_id: i64,
    pub project_id: i64,
    pub project_name: String,
    /// When the open interval started (UTC, RFC 3339).
    pub interval_started_at: String,
    /// Seconds already on the entry before the open interval began.
    pub prior_seconds: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub running: Option<Running>,
    /// Elapsed seconds on the running entry, as of `now`.
    pub elapsed_seconds: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Totals {
    pub today: i64,
    pub this_week: i64,
    pub this_month: i64,
    pub last_month: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WeekStart {
    Monday,
    Sunday,
}

impl WeekStart {
    /// Reads the `week_start` setting value; anything but "sunday" means Monday.
    pub fn from_setting(value: Option<&str>) -> Self {
        match value {
            Some("sunday") => WeekStart::Sunday,
            _ => WeekStart::Monday,
        }
    }
}

/// Returned at startup when a timer was left running by a run that ended
/// without stopping it (crash, power loss, killed process).
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Recovered {
    pub project_name: String,
    /// When the interval was closed: the last heartbeat (UTC, RFC 3339).
    pub stopped_at: String,
}

/// Colors handed to projects that don't have one, in order.
pub const PALETTE: &[&str] = &[
    "#2a9d8f", "#e76f51", "#457b9d", "#e9c46a", "#8d6cab", "#6a994e",
];

pub(crate) fn palette_color(n: i64) -> &'static str {
    PALETTE[(n.max(0) as usize) % PALETTE.len()]
}

pub fn ts(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn parse_ts(s: &str) -> Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|t| t.with_timezone(&Utc))
        .map_err(|e| Error::Invalid(format!("bad timestamp {s:?}: {e}")))
}

fn day_str(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

/// SQL for an entry's duration in whole seconds, with `?now` standing in for
/// the end of a still-open interval.
const SECONDS_SQL: &str = "CAST(ROUND(COALESCE(SUM(
        (julianday(COALESCE(i.end_at, :now)) - julianday(i.start_at)) * 86400.0
    ), 0)) AS INTEGER)";

pub struct Store {
    conn: Connection,
}

impl Store {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        Self::init(Connection::open(path)?)
    }

    pub fn open_in_memory() -> Result<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(conn: Connection) -> Result<Self> {
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        schema::migrate(&conn)?;
        Ok(Self { conn })
    }

    // ---------------------------------------------------------------- projects

    pub fn projects(&self) -> Result<Vec<Project>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, color, archived FROM projects ORDER BY archived, name")?;
        let rows = stmt.query_map([], |r| {
            Ok(Project {
                id: r.get(0)?,
                name: r.get(1)?,
                color: r.get(2)?,
                archived: r.get(3)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    pub fn create_project(&self, name: &str, now: DateTime<Utc>) -> Result<Project> {
        let name = name.trim();
        if name.is_empty() {
            return Err(Error::Invalid("project name is empty".into()));
        }
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0))?;
        let color = palette_color(count);
        self.conn.execute(
            "INSERT INTO projects (name, color, created_at) VALUES (?1, ?2, ?3)",
            params![name, color, ts(now)],
        )?;
        let id = self.conn.last_insert_rowid();
        Ok(Project {
            id,
            name: name.to_string(),
            color: Some(color.to_string()),
            archived: false,
        })
    }

    fn project_name(&self, id: i64) -> Result<String> {
        self.conn
            .query_row("SELECT name FROM projects WHERE id = ?1", [id], |r| {
                r.get(0)
            })
            .optional()?
            .ok_or(Error::ProjectNotFound(id))
    }

    // ------------------------------------------------------------------- timer

    pub fn status(&self, now: DateTime<Utc>) -> Result<Status> {
        let open: Option<(i64, i64, String, String)> = self
            .conn
            .query_row(
                "SELECT e.id, e.project_id, p.name, i.start_at
                 FROM intervals i JOIN entries e ON e.id = i.entry_id
                 JOIN projects p ON p.id = e.project_id
                 WHERE i.end_at IS NULL",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .optional()?;

        let Some((entry_id, project_id, project_name, started)) = open else {
            return Ok(Status {
                running: None,
                elapsed_seconds: 0,
            });
        };

        let prior_seconds: i64 = self.conn.query_row(
            &format!(
                "SELECT {SECONDS_SQL} FROM intervals i WHERE i.entry_id = :entry AND i.end_at IS NOT NULL"
            ),
            rusqlite::named_params! { ":entry": entry_id, ":now": ts(now) },
            |r| r.get(0),
        )?;
        let open_seconds = (now - parse_ts(&started)?).num_seconds().max(0);

        Ok(Status {
            running: Some(Running {
                entry_id,
                project_id,
                project_name,
                interval_started_at: started,
                prior_seconds,
            }),
            elapsed_seconds: prior_seconds + open_seconds,
        })
    }

    /// Starts timing `project_id` on `today`'s entry, creating the entry if
    /// there isn't one. `notes` only applies when a new entry is created.
    /// Starting a different project stops the current one first; starting the
    /// project that is already running does nothing.
    pub fn start(
        &mut self,
        project_id: i64,
        notes: Option<&str>,
        now: DateTime<Utc>,
        today: NaiveDate,
    ) -> Result<Status> {
        self.project_name(project_id)?;
        if let Some(r) = self.status(now)?.running {
            if r.project_id == project_id {
                return self.status(now);
            }
            self.stop(now)?;
        }

        let tx = self.conn.transaction()?;
        let existing: Option<i64> = tx
            .query_row(
                "SELECT id FROM entries WHERE project_id = ?1 AND day = ?2 ORDER BY id DESC LIMIT 1",
                params![project_id, day_str(today)],
                |r| r.get(0),
            )
            .optional()?;
        let entry_id = match existing {
            Some(id) => id,
            None => {
                tx.execute(
                    "INSERT INTO entries (project_id, day, notes, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?4)",
                    params![
                        project_id,
                        day_str(today),
                        notes.unwrap_or("").trim(),
                        ts(now)
                    ],
                )?;
                tx.last_insert_rowid()
            }
        };
        tx.execute(
            "INSERT INTO intervals (entry_id, start_at, source) VALUES (?1, ?2, 'timer')",
            params![entry_id, ts(now)],
        )?;
        tx.execute(
            "INSERT INTO settings (key, value) VALUES ('last_project_id', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [project_id.to_string()],
        )?;
        tx.commit()?;
        self.heartbeat(now)?;
        self.status(now)
    }

    pub fn stop(&mut self, now: DateTime<Utc>) -> Result<Status> {
        self.conn.execute(
            "UPDATE intervals SET end_at = MAX(start_at, ?1) WHERE end_at IS NULL",
            [ts(now)],
        )?;
        self.status(now)
    }

    /// Records that the app was alive and timing at `now`.
    pub fn heartbeat(&self, now: DateTime<Utc>) -> Result<()> {
        self.set_setting("heartbeat_at", &ts(now))
    }

    /// Called at startup. If a timer is open and the last heartbeat is older
    /// than `stale_after`, the previous run ended without stopping it: close
    /// the interval at the last heartbeat so the dead time isn't counted.
    pub fn recover_stale(
        &mut self,
        now: DateTime<Utc>,
        stale_after: Duration,
    ) -> Result<Option<Recovered>> {
        let Some(running) = self.status(now)?.running else {
            return Ok(None);
        };
        let started = parse_ts(&running.interval_started_at)?;
        let last_seen = match self.setting("heartbeat_at")? {
            Some(s) => parse_ts(&s)?.max(started),
            None => started,
        };
        if now - last_seen < stale_after {
            return Ok(None);
        }
        self.stop(last_seen)?;
        Ok(Some(Recovered {
            project_name: running.project_name,
            stopped_at: ts(last_seen),
        }))
    }

    pub fn last_project_id(&self) -> Result<Option<i64>> {
        Ok(self
            .setting("last_project_id")?
            .and_then(|v| v.parse().ok()))
    }

    // ----------------------------------------------------------------- entries

    /// Entries whose day falls in `from..=to`, newest first.
    pub fn entries(
        &self,
        from: NaiveDate,
        to: NaiveDate,
        project_id: Option<i64>,
        now: DateTime<Utc>,
    ) -> Result<Vec<Entry>> {
        let sql = format!(
            "SELECT e.id, e.project_id, p.name, p.color, e.day, e.notes, {SECONDS_SQL},
                    MAX(i.end_at IS NULL AND i.id IS NOT NULL)
             FROM entries e
             JOIN projects p ON p.id = e.project_id
             LEFT JOIN intervals i ON i.entry_id = e.id
             WHERE e.day BETWEEN :from AND :to
               AND (:project IS NULL OR e.project_id = :project)
             GROUP BY e.id
             ORDER BY e.day DESC, e.id DESC"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(
            rusqlite::named_params! {
                ":from": day_str(from), ":to": day_str(to),
                ":project": project_id, ":now": ts(now),
            },
            |r| {
                Ok(Entry {
                    id: r.get(0)?,
                    project_id: r.get(1)?,
                    project_name: r.get(2)?,
                    project_color: r.get(3)?,
                    day: r.get(4)?,
                    notes: r.get(5)?,
                    seconds: r.get(6)?,
                    running: r.get::<_, Option<bool>>(7)?.unwrap_or(false),
                })
            },
        )?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }

    pub fn set_notes(&self, entry_id: i64, notes: &str, now: DateTime<Utc>) -> Result<()> {
        let changed = self.conn.execute(
            "UPDATE entries SET notes = ?1, updated_at = ?2 WHERE id = ?3",
            params![notes.trim(), ts(now), entry_id],
        )?;
        if changed == 0 {
            return Err(Error::EntryNotFound(entry_id));
        }
        Ok(())
    }

    fn seconds_between(
        &self,
        from: NaiveDate,
        to: NaiveDate,
        project_id: Option<i64>,
        now: DateTime<Utc>,
    ) -> Result<i64> {
        let sql = format!(
            "SELECT {SECONDS_SQL} FROM intervals i JOIN entries e ON e.id = i.entry_id
             WHERE e.day BETWEEN :from AND :to AND (:project IS NULL OR e.project_id = :project)"
        );
        Ok(self.conn.query_row(
            &sql,
            rusqlite::named_params! {
                ":from": day_str(from), ":to": day_str(to),
                ":project": project_id, ":now": ts(now),
            },
            |r| r.get(0),
        )?)
    }

    /// Totals by local day: today, this week (to date), this month (to date)
    /// and the whole of last month.
    pub fn totals(
        &self,
        today: NaiveDate,
        week_start: WeekStart,
        project_id: Option<i64>,
        now: DateTime<Utc>,
    ) -> Result<Totals> {
        let into_week = match week_start {
            WeekStart::Monday => today.weekday().num_days_from_monday(),
            WeekStart::Sunday => today.weekday().num_days_from_sunday(),
        };
        let week_first = today - Duration::days(into_week as i64);
        let month_first = today.with_day(1).expect("day 1 exists");
        let last_month_end = month_first - Duration::days(1);
        let last_month_first = last_month_end.with_day(1).expect("day 1 exists");
        let sum = |from, to| self.seconds_between(from, to, project_id, now);
        Ok(Totals {
            today: sum(today, today)?,
            this_week: sum(week_first, today)?,
            this_month: sum(month_first, today)?,
            last_month: sum(last_month_first, last_month_end)?,
        })
    }

    // ---------------------------------------------------------------- settings

    pub fn setting(&self, key: &str) -> Result<Option<String>> {
        Ok(self
            .conn
            .query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| {
                r.get(0)
            })
            .optional()?)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    /// Imports a v1 (Electron) database, opened read-only. See `import.rs`.
    pub fn import_v1(
        &mut self,
        v1_path: impl AsRef<Path>,
        local_day: impl Fn(DateTime<Utc>) -> NaiveDate,
    ) -> Result<ImportReport> {
        import::import_v1(&mut self.conn, v1_path.as_ref(), local_day)
    }

    pub fn is_empty(&self) -> Result<bool> {
        let n: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0))?;
        Ok(n == 0)
    }
}

#[cfg(test)]
mod tests;
