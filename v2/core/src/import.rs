//! One-time import from the v1 Electron app's database (schema version 4).
//!
//! Rules, from how v1 was actually used:
//! - each v1 session becomes one entry with one interval;
//! - the entry's day is the local date of `startTime`;
//! - the interval runs `startTime` → `startTime + duration`. v1's `endTime` is
//!   ignored: sessions were closed the next morning, so it measures nothing;
//! - sessions v1 never closed are imported closed, the same way;
//! - a NULL duration imports as a zero-length interval so the notes survive;
//! - sessions whose project is gone (v1 never enforced foreign keys) or whose
//!   start can't be parsed are skipped and counted, not fatal.
//!
//! The v1 file is opened read-only. Re-running the import skips anything
//! already imported (matched on the legacy ids).

use crate::{ts, Result};
use chrono::{DateTime, Duration, NaiveDate, NaiveDateTime, Utc};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub projects: usize,
    pub entries: usize,
    pub seconds: i64,
    /// Sessions v1 left without an end time, imported as closed.
    pub unclosed_sessions: usize,
    /// Sessions with no recorded duration, imported as zero.
    pub missing_durations: usize,
    /// Rows skipped because an earlier import already brought them in.
    pub already_imported: usize,
    /// Sessions skipped because their v1 project no longer exists.
    pub orphaned_sessions: usize,
    /// Sessions skipped because their start time couldn't be parsed.
    pub unparseable_sessions: usize,
}

struct V1Session {
    id: i64,
    project_id: i64,
    start: String,
    end: Option<String>,
    duration: Option<i64>,
    notes: Option<String>,
}

fn parse_v1_time(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|t| t.with_timezone(&Utc))
        .ok()
        .or_else(|| {
            // SQLite CURRENT_TIMESTAMP format, which is UTC.
            NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
                .ok()
                .map(|n| n.and_utc())
        })
}

pub fn import_v1(
    conn: &mut Connection,
    v1_path: &Path,
    local_day: impl Fn(DateTime<Utc>) -> NaiveDate,
) -> Result<ImportReport> {
    let v1 = Connection::open_with_flags(
        v1_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    let now = Utc::now();
    let mut report = ImportReport::default();
    let tx = conn.transaction()?;

    let mut stmt = v1.prepare("SELECT projectId, name, createdAt FROM projects")?;
    let projects = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, Option<String>>(2)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    // v1 colors are free-form, so imports take palette keys instead.
    for (i, (legacy_id, name, created)) in projects.into_iter().enumerate() {
        let color = crate::palette_color(i as i64);
        let created = created.as_deref().and_then(parse_v1_time).unwrap_or(now);
        let inserted = tx.execute(
            "INSERT OR IGNORE INTO projects (name, color, created_at, legacy_project_id)
             VALUES (?1, ?2, ?3, ?4)",
            params![name.trim(), color, ts(created), legacy_id],
        )?;
        if inserted == 1 {
            report.projects += 1;
        } else {
            report.already_imported += 1;
        }
    }

    let mut stmt = v1.prepare(
        "SELECT sessionId, projectId, startTime, endTime, duration, notes
         FROM sessions ORDER BY startTime",
    )?;
    let sessions = stmt
        .query_map([], |r| {
            Ok(V1Session {
                id: r.get(0)?,
                project_id: r.get(1)?,
                start: r.get(2)?,
                end: r.get(3)?,
                duration: r.get(4)?,
                notes: r.get(5)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    for s in sessions {
        let Some(start) = parse_v1_time(&s.start) else {
            report.unparseable_sessions += 1;
            continue;
        };
        let project_id: Option<i64> = tx
            .query_row(
                "SELECT id FROM projects WHERE legacy_project_id = ?1",
                [s.project_id],
                |r| r.get(0),
            )
            .optional()?;
        let Some(project_id) = project_id else {
            report.orphaned_sessions += 1;
            continue;
        };
        let seconds = s.duration.unwrap_or(0).max(0);
        let inserted = tx.execute(
            "INSERT OR IGNORE INTO entries
                 (project_id, day, notes, created_at, updated_at, legacy_session_id)
             VALUES (?1, ?2, ?3, ?4, ?4, ?5)",
            params![
                project_id,
                local_day(start).format("%Y-%m-%d").to_string(),
                s.notes.as_deref().unwrap_or("").trim(),
                ts(start),
                s.id
            ],
        )?;
        if inserted == 0 {
            report.already_imported += 1;
            continue;
        }
        let entry_id = tx.last_insert_rowid();
        tx.execute(
            "INSERT INTO intervals (entry_id, start_at, end_at, source) VALUES (?1, ?2, ?3, 'import')",
            params![entry_id, ts(start), ts(start + Duration::seconds(seconds))],
        )?;
        report.entries += 1;
        report.seconds += seconds;
        if s.end.is_none() {
            report.unclosed_sessions += 1;
        }
        if s.duration.is_none() {
            report.missing_durations += 1;
        }
    }

    tx.execute(
        "INSERT INTO settings (key, value) VALUES ('v1_imported_at', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [ts(now)],
    )?;
    tx.commit()?;
    Ok(report)
}
