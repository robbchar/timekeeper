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

pub use import::{ImportReport, V1Data};

use chrono::{DateTime, Datelike, Duration, NaiveDate, SecondsFormat, Utc};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),
    #[error("project {0} not found")]
    ProjectNotFound(i64),
    #[error("entry {0} not found")]
    EntryNotFound(i64),
    #[error("stop the timer before deleting entry {0}")]
    EntryRunning(i64),
    #[error("{0}")]
    Invalid(String),
    #[error("no v1 database at {}", .0.display())]
    NoV1Database(std::path::PathBuf),
}

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
    pub archived: bool,
    /// Whether the notes editor offers "Suggest from Linear" for this project.
    pub linear_enabled: bool,
    /// Limits Linear suggestions to one team, e.g. `LABS`; `None` means any team.
    pub linear_team_key: Option<String>,
    /// Step that copied durations round to, one of [`ROUNDING_STEPS`]; `None` means exact.
    pub rounding_minutes: Option<i64>,
    /// Kept while rounding is off, so turning it back on restores the mode.
    pub rounding_mode: RoundingMode,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum RoundingMode {
    Up,
    #[default]
    Nearest,
    Down,
}

impl RoundingMode {
    fn as_str(self) -> &'static str {
        match self {
            Self::Up => "up",
            Self::Nearest => "nearest",
            Self::Down => "down",
        }
    }
}

impl rusqlite::types::FromSql for RoundingMode {
    fn column_result(v: rusqlite::types::ValueRef<'_>) -> rusqlite::types::FromSqlResult<Self> {
        match v.as_str()? {
            "up" => Ok(Self::Up),
            "nearest" => Ok(Self::Nearest),
            "down" => Ok(Self::Down),
            other => Err(rusqlite::types::FromSqlError::Other(
                format!("unknown rounding mode {other:?}").into(),
            )),
        }
    }
}

/// Rounding steps a project can choose, in minutes. 6 is a tenth of an hour.
pub const ROUNDING_STEPS: &[i64] = &[5, 6, 10, 15, 30, 60];

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

/// Time to add to a day's entry for a project, as a `manual` interval.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ManualTime<'a> {
    pub project_id: i64,
    pub day: NaiveDate,
    pub seconds: i64,
    pub notes: Option<&'a str>,
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

/// Project color keys, in the order new projects get them. The UI maps each to a
/// `--project-<key>` CSS token, so adding one means adding the token too.
pub const PALETTE: &[&str] = &["teal", "coral", "blue", "gold", "purple", "green"];

pub(crate) fn palette_color(n: i64) -> &'static str {
    PALETTE[(n.max(0) as usize) % PALETTE.len()]
}

/// A Linear team key as stored: trimmed and uppercased, `None` when blank.
fn linear_team_key(key: Option<&str>) -> Result<Option<String>> {
    let key = key.unwrap_or_default().trim();
    if key.is_empty() {
        return Ok(None);
    }
    if !key.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(Error::Invalid(format!(
            "a Linear team key is letters and digits, like LABS (got {key:?})"
        )));
    }
    Ok(Some(key.to_ascii_uppercase()))
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

/// The most an entry's duration can be set to, or one manual addition can add: one day.
pub const MAX_ENTRY_SECONDS: i64 = 24 * 3600;

/// Ends every open interval at `?1`, never before its own start.
const CLOSE_OPEN_INTERVALS: &str =
    "UPDATE intervals SET end_at = MAX(start_at, ?1) WHERE end_at IS NULL";

/// The entry for `project_id` on `day`, created with `notes` if there isn't one.
/// Returns its id and whether it was just created.
fn entry_for(
    tx: &rusqlite::Transaction,
    project_id: i64,
    day: NaiveDate,
    notes: Option<&str>,
    now: DateTime<Utc>,
) -> Result<(i64, bool)> {
    let existing: Option<i64> = tx
        .query_row(
            "SELECT id FROM entries WHERE project_id = ?1 AND day = ?2 ORDER BY id DESC LIMIT 1",
            params![project_id, day_str(day)],
            |r| r.get(0),
        )
        .optional()?;
    if let Some(id) = existing {
        return Ok((id, false));
    }
    tx.execute(
        "INSERT INTO entries (project_id, day, notes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4)",
        params![
            project_id,
            day_str(day),
            notes.unwrap_or("").trim(),
            ts(now)
        ],
    )?;
    Ok((tx.last_insert_rowid(), true))
}

/// Adds a closed `manual` interval of `length` to `entry_id`, ending at `end_at`.
fn insert_manual_interval(
    tx: &rusqlite::Transaction,
    entry_id: i64,
    length: Duration,
    end_at: DateTime<Utc>,
) -> Result<()> {
    tx.execute(
        "INSERT INTO intervals (entry_id, start_at, end_at, source) VALUES (?1, ?2, ?3, 'manual')",
        params![entry_id, ts(end_at - length), ts(end_at)],
    )?;
    Ok(())
}

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
        let mut stmt = self.conn.prepare(
            "SELECT id, name, color, archived, linear_enabled, linear_team_key,
                    rounding_minutes, rounding_mode
             FROM projects ORDER BY archived, name",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(Project {
                id: r.get(0)?,
                name: r.get(1)?,
                color: r.get(2)?,
                archived: r.get(3)?,
                linear_enabled: r.get(4)?,
                linear_team_key: r.get(5)?,
                rounding_minutes: r.get(6)?,
                rounding_mode: r.get(7)?,
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
            linear_enabled: false,
            linear_team_key: None,
            rounding_minutes: None,
            rounding_mode: RoundingMode::default(),
        })
    }

    pub fn rename_project(&self, id: i64, name: &str) -> Result<()> {
        let name = name.trim();
        if name.is_empty() {
            return Err(Error::Invalid("project name is empty".into()));
        }
        self.update_project(id, "UPDATE projects SET name = ?2 WHERE id = ?1", name)
    }

    pub fn set_project_color(&self, id: i64, color: &str) -> Result<()> {
        if !PALETTE.contains(&color) {
            return Err(Error::Invalid(format!("unknown project color {color:?}")));
        }
        self.update_project(id, "UPDATE projects SET color = ?2 WHERE id = ?1", color)
    }

    /// Archived projects drop out of the timer's picker; their entries are untouched.
    pub fn set_project_archived(&self, id: i64, archived: bool) -> Result<()> {
        self.update_project(
            id,
            "UPDATE projects SET archived = ?2 WHERE id = ?1",
            archived,
        )
    }

    /// Turns Linear on or off for a project; its team key is kept either way.
    pub fn set_project_linear_enabled(&self, id: i64, enabled: bool) -> Result<()> {
        self.update_project(
            id,
            "UPDATE projects SET linear_enabled = ?2 WHERE id = ?1",
            enabled,
        )
    }

    /// Limits a project's Linear suggestions to one team; blank or `None` means any team.
    pub fn set_project_linear_team(&self, id: i64, team_key: Option<&str>) -> Result<()> {
        let team_key = linear_team_key(team_key)?;
        self.update_project(
            id,
            "UPDATE projects SET linear_team_key = ?2 WHERE id = ?1",
            team_key,
        )
    }

    /// Sets how copied durations round; `minutes: None` turns rounding off and keeps the mode.
    pub fn set_project_rounding(
        &self,
        id: i64,
        minutes: Option<i64>,
        mode: RoundingMode,
    ) -> Result<()> {
        if let Some(m) = minutes.filter(|m| !ROUNDING_STEPS.contains(m)) {
            return Err(Error::Invalid(format!(
                "rounding step must be one of {ROUNDING_STEPS:?} minutes (got {m})"
            )));
        }
        match self.conn.execute(
            "UPDATE projects SET rounding_minutes = ?2, rounding_mode = ?3 WHERE id = ?1",
            params![id, minutes, mode.as_str()],
        )? {
            0 => Err(Error::ProjectNotFound(id)),
            _ => Ok(()),
        }
    }

    fn update_project(&self, id: i64, sql: &str, value: impl rusqlite::ToSql) -> Result<()> {
        match self.conn.execute(sql, params![id, value])? {
            0 => Err(Error::ProjectNotFound(id)),
            _ => Ok(()),
        }
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
        }

        // Closing the previous interval shares the transaction, so a switch is all-or-nothing.
        let tx = self.conn.transaction()?;
        tx.execute(CLOSE_OPEN_INTERVALS, [ts(now)])?;
        let (entry_id, _) = entry_for(&tx, project_id, today, notes, now)?;
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
        self.conn.execute(CLOSE_OPEN_INTERVALS, [ts(now)])?;
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

    /// The project a one-click start should use: the last one timed unless it
    /// is archived or gone, else the first active project.
    pub fn resume_project_id(&self) -> Result<Option<i64>> {
        let last = self.last_project_id()?;
        let active: Vec<Project> = self
            .projects()?
            .into_iter()
            .filter(|p| !p.archived)
            .collect();
        Ok(active
            .iter()
            .find(|p| Some(p.id) == last)
            .or(active.first())
            .map(|p| p.id))
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

    /// Adds `m.seconds` to `m.day`'s entry for the project, creating it if needed.
    /// Ends before the entry's first interval, else at `fallback_end` capped at `now`.
    pub fn add_manual_time(
        &mut self,
        m: ManualTime,
        now: DateTime<Utc>,
        today: NaiveDate,
        fallback_end: DateTime<Utc>,
    ) -> Result<Entry> {
        if m.seconds <= 0 || m.seconds > MAX_ENTRY_SECONDS {
            return Err(Error::Invalid(format!(
                "manual time must be between 1 second and 24 hours, got {}s",
                m.seconds
            )));
        }
        if m.day > today {
            return Err(Error::Invalid(format!(
                "can't add time to a future day ({})",
                day_str(m.day)
            )));
        }
        self.project_name(m.project_id)?;

        let notes = m.notes.map(str::trim).filter(|n| !n.is_empty());
        let tx = self.conn.transaction()?;
        let (entry_id, created) = entry_for(&tx, m.project_id, m.day, notes, now)?;
        let first_start: Option<String> = tx.query_row(
            "SELECT MIN(start_at) FROM intervals WHERE entry_id = ?1",
            [entry_id],
            |r| r.get(0),
        )?;
        let end_at = match first_start {
            Some(s) => parse_ts(&s)?,
            None => fallback_end.min(now),
        };
        insert_manual_interval(&tx, entry_id, Duration::seconds(m.seconds), end_at)?;
        if !created {
            tx.execute(
                "UPDATE entries SET updated_at = ?1, notes = CASE
                     WHEN ?2 IS NULL THEN notes
                     WHEN notes = '' THEN ?2 ELSE notes || char(10) || ?2 END
                 WHERE id = ?3",
                params![ts(now), notes, entry_id],
            )?;
        }
        tx.commit()?;

        self.entries(m.day, m.day, Some(m.project_id), now)?
            .into_iter()
            .find(|e| e.id == entry_id)
            .ok_or(Error::EntryNotFound(entry_id))
    }

    /// Sets a stopped entry's duration. Raising adds a `manual` interval that
    /// ends where the entry's last interval ends (or at `local_noon` of its day,
    /// capped at `now`, if it has none); lowering trims intervals from the latest end backwards,
    /// so a raise is undone before recorded time.
    pub fn set_entry_seconds(
        &mut self,
        entry_id: i64,
        seconds: i64,
        now: DateTime<Utc>,
        local_noon: impl Fn(NaiveDate) -> DateTime<Utc>,
    ) -> Result<()> {
        if seconds < 0 {
            return Err(Error::Invalid("duration can't be negative".into()));
        }
        if seconds > MAX_ENTRY_SECONDS {
            return Err(Error::Invalid("duration can't exceed 24 hours".into()));
        }
        let tx = self.conn.transaction()?;
        let day: String = tx
            .query_row("SELECT day FROM entries WHERE id = ?1", [entry_id], |r| {
                r.get(0)
            })
            .optional()?
            .ok_or(Error::EntryNotFound(entry_id))?;

        // Latest first: (id, start, end).
        let mut intervals = Vec::new();
        {
            let mut stmt = tx.prepare(
                "SELECT id, start_at, end_at FROM intervals WHERE entry_id = ?1
                 ORDER BY end_at DESC, id DESC",
            )?;
            let mut rows = stmt.query([entry_id])?;
            while let Some(r) = rows.next()? {
                let Some(end) = r.get::<_, Option<String>>(2)? else {
                    return Err(Error::Invalid(
                        "stop the timer before editing its duration".into(),
                    ));
                };
                intervals.push((
                    r.get::<_, i64>(0)?,
                    parse_ts(&r.get::<_, String>(1)?)?,
                    parse_ts(&end)?,
                ));
            }
        }

        let total: Duration = intervals.iter().map(|(_, start, end)| *end - *start).sum();
        let target = Duration::seconds(seconds);
        if target > total {
            let end = match intervals.iter().map(|(_, _, end)| *end).max() {
                Some(end) => end,
                None => {
                    let d = NaiveDate::parse_from_str(&day, "%Y-%m-%d")
                        .map_err(|e| Error::Invalid(format!("bad day {day:?}: {e}")))?;
                    local_noon(d).min(now)
                }
            };
            insert_manual_interval(&tx, entry_id, target - total, end)?;
        } else {
            let mut excess = total - target;
            for (id, start, end) in intervals {
                if excess <= Duration::zero() {
                    break;
                }
                let length = end - start;
                if length <= excess {
                    tx.execute("DELETE FROM intervals WHERE id = ?1", [id])?;
                    excess -= length;
                } else {
                    tx.execute(
                        "UPDATE intervals SET end_at = ?1 WHERE id = ?2",
                        params![ts(end - excess), id],
                    )?;
                    excess = Duration::zero();
                }
            }
        }
        tx.execute(
            "UPDATE entries SET updated_at = ?1 WHERE id = ?2",
            params![ts(now), entry_id],
        )?;
        tx.commit()?;
        Ok(())
    }

    /// Deletes an entry and, by cascade, its intervals. Refused while it is running.
    pub fn delete_entry(&mut self, entry_id: i64) -> Result<()> {
        // The refusal reason is read in the same transaction, so it matches what the DELETE saw.
        let tx = self.conn.transaction()?;
        let deleted = tx.execute(
            "DELETE FROM entries WHERE id = ?1 AND NOT EXISTS
               (SELECT 1 FROM intervals WHERE entry_id = ?1 AND end_at IS NULL)",
            [entry_id],
        )?;
        if deleted > 0 {
            tx.commit()?;
            return Ok(());
        }
        let exists: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM entries WHERE id = ?1)",
            [entry_id],
            |r| r.get(0),
        )?;
        Err(if exists {
            Error::EntryRunning(entry_id)
        } else {
            Error::EntryNotFound(entry_id)
        })
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

    /// Imports a v1 (Electron) database read by `V1Data::read`. See `import.rs`.
    pub fn import_v1(
        &mut self,
        v1: V1Data,
        local_day: impl Fn(DateTime<Utc>) -> NaiveDate,
    ) -> Result<ImportReport> {
        let open = import::OpenSessions::ImportClosed;
        import::import_v1(&mut self.conn, v1, open, local_day)
    }

    /// Brings in v1 sessions recorded since the last import. Sessions v1 hasn't
    /// ended yet are left for a later run, so they arrive with their full time.
    pub fn import_v1_again(
        &mut self,
        v1: V1Data,
        local_day: impl Fn(DateTime<Utc>) -> NaiveDate,
    ) -> Result<ImportReport> {
        let open = import::OpenSessions::Skip;
        import::import_v1(&mut self.conn, v1, open, local_day)
    }

    /// Writes a consistent copy of the database at `db` to `path`, which must not exist.
    /// Reads one snapshot, WAL included, on its own read-only connection, so a `Store` on `db`
    /// needn't be locked meanwhile.
    pub fn backup_to(db: &Path, path: &Path) -> Result<()> {
        let io = |p: &Path, e: std::io::Error| Error::Invalid(format!("{}: {e}", p.display()));
        if path.try_exists().map_err(|e| io(path, e))? {
            return Err(Error::Invalid(format!("{} already exists", path.display())));
        }
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| io(dir, e))?;
        }
        // Written under a temporary name, so a failed write never looks like a backup.
        let mut partial = path.as_os_str().to_owned();
        partial.push(".partial");
        let partial = PathBuf::from(partial);
        let target = partial
            .to_str()
            .ok_or_else(|| Error::Invalid(format!("{} isn't valid UTF-8", path.display())))?;
        let written = Connection::open_with_flags(db, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .and_then(|conn| conn.execute("VACUUM INTO ?1", [target]))
            .map_err(Error::from)
            .and_then(|_| std::fs::rename(&partial, path).map_err(|e| io(path, e)));
        if written.is_err() {
            std::fs::remove_file(&partial).ok();
        }
        written
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
