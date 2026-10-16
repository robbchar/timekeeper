//! Versioned schema. `PRAGMA user_version` records how far a database has
//! been migrated; each step runs inside its own transaction.

use rusqlite::Connection;

pub(crate) const MIGRATIONS: &[&str] = &[
    // 1: initial schema
    r#"
    CREATE TABLE projects (
        id                INTEGER PRIMARY KEY,
        name              TEXT    NOT NULL,
        color             TEXT,
        archived          INTEGER NOT NULL DEFAULT 0,
        created_at        TEXT    NOT NULL,
        legacy_project_id INTEGER UNIQUE
    );

    CREATE TABLE entries (
        id                INTEGER PRIMARY KEY,
        project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        day               TEXT    NOT NULL,               -- local YYYY-MM-DD
        notes             TEXT    NOT NULL DEFAULT '',
        created_at        TEXT    NOT NULL,
        updated_at        TEXT    NOT NULL,
        legacy_session_id INTEGER UNIQUE
    );
    CREATE INDEX entries_by_day ON entries(day);

    CREATE TABLE intervals (
        id       INTEGER PRIMARY KEY,
        entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        start_at TEXT    NOT NULL,                        -- UTC RFC 3339
        end_at   TEXT,                                    -- NULL = running
        source   TEXT    NOT NULL CHECK (source IN ('timer', 'manual', 'import'))
    );
    CREATE INDEX intervals_by_entry ON intervals(entry_id);
    -- At most one running interval in the whole database.
    CREATE UNIQUE INDEX one_running_interval ON intervals((1)) WHERE end_at IS NULL;

    CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    "#,
    // 2: project colors become palette keys, which the UI maps to theme tokens
    r#"
    UPDATE projects SET color = CASE color
        WHEN '#2a9d8f' THEN 'teal'
        WHEN '#e76f51' THEN 'coral'
        WHEN '#457b9d' THEN 'blue'
        WHEN '#e9c46a' THEN 'gold'
        WHEN '#8d6cab' THEN 'purple'
        WHEN '#6a994e' THEN 'green'
        ELSE CASE (id - 1) % 6
            WHEN 0 THEN 'teal'
            WHEN 1 THEN 'coral'
            WHEN 2 THEN 'blue'
            WHEN 3 THEN 'gold'
            WHEN 4 THEN 'purple'
            ELSE 'green'
        END
    END;
    "#,
    // 3: per-project Linear settings; the API key lives in the OS keychain, never here
    r#"
    ALTER TABLE projects ADD COLUMN linear_enabled INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE projects ADD COLUMN linear_team_key TEXT;  -- NULL = any team
    "#,
];

#[cfg_attr(not(test), allow(dead_code))]
pub const CURRENT_VERSION: i64 = MIGRATIONS.len() as i64;

pub fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    for (i, sql) in MIGRATIONS.iter().enumerate().skip(version as usize) {
        let next = i as i64 + 1;
        conn.execute_batch(&format!(
            "BEGIN; {sql}; PRAGMA user_version = {next}; COMMIT;"
        ))
        .inspect_err(|_| {
            let _ = conn.execute_batch("ROLLBACK");
        })?;
    }
    Ok(())
}
