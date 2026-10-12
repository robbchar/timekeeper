use super::*;
use chrono::TimeZone;

fn at(s: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
}
fn day(s: &str) -> NaiveDate {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
}
fn store_with_project() -> (Store, i64) {
    let s = Store::open_in_memory().unwrap();
    let p = s
        .create_project("Elevate", at("2026-10-01T00:00:00Z"))
        .unwrap();
    (s, p.id)
}

#[test]
fn start_then_stop_records_elapsed_time() {
    let (mut s, p) = store_with_project();
    s.start(
        p,
        Some("LABS-1"),
        at("2026-10-05T15:00:00Z"),
        day("2026-10-05"),
    )
    .unwrap();
    let st = s.status(at("2026-10-05T15:30:00Z")).unwrap();
    assert_eq!(st.elapsed_seconds, 1800);
    s.stop(at("2026-10-05T16:00:00Z")).unwrap();
    assert!(s
        .status(at("2026-10-05T17:00:00Z"))
        .unwrap()
        .running
        .is_none());

    let e = s
        .entries(
            day("2026-10-05"),
            day("2026-10-05"),
            None,
            at("2026-10-05T17:00:00Z"),
        )
        .unwrap();
    assert_eq!(e.len(), 1);
    assert_eq!(e[0].seconds, 3600);
    assert_eq!(e[0].notes, "LABS-1");
    assert!(!e[0].running);
}

#[test]
fn restarting_the_same_day_reuses_the_entry() {
    let (mut s, p) = store_with_project();
    s.start(
        p,
        Some("morning"),
        at("2026-10-05T15:00:00Z"),
        day("2026-10-05"),
    )
    .unwrap();
    s.stop(at("2026-10-05T16:00:00Z")).unwrap();
    s.start(
        p,
        Some("ignored"),
        at("2026-10-05T18:00:00Z"),
        day("2026-10-05"),
    )
    .unwrap();
    let st = s.status(at("2026-10-05T18:30:00Z")).unwrap();
    assert_eq!(st.running.as_ref().unwrap().prior_seconds, 3600);
    assert_eq!(st.elapsed_seconds, 5400);

    let e = s
        .entries(
            day("2026-10-05"),
            day("2026-10-05"),
            None,
            at("2026-10-05T18:30:00Z"),
        )
        .unwrap();
    assert_eq!(e.len(), 1);
    assert_eq!(e[0].notes, "morning");
    assert!(e[0].running);
}

#[test]
fn starting_another_project_stops_the_first() {
    let (mut s, a) = store_with_project();
    let b = s
        .create_project("Katas", at("2026-10-01T00:00:00Z"))
        .unwrap()
        .id;
    s.start(a, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.start(b, None, at("2026-10-05T15:20:00Z"), day("2026-10-05"))
        .unwrap();
    let st = s.status(at("2026-10-05T15:30:00Z")).unwrap();
    assert_eq!(st.running.unwrap().project_id, b);
    let totals = s
        .totals(
            day("2026-10-05"),
            WeekStart::Monday,
            Some(a),
            at("2026-10-05T15:30:00Z"),
        )
        .unwrap();
    assert_eq!(totals.today, 1200);
}

#[test]
fn starting_the_running_project_is_a_no_op() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    let st = s
        .start(p, None, at("2026-10-05T15:10:00Z"), day("2026-10-05"))
        .unwrap();
    assert_eq!(
        st.running.unwrap().interval_started_at,
        "2026-10-05T15:00:00.000Z"
    );
}

#[test]
fn resume_uses_the_last_project_unless_it_is_archived() {
    let (mut s, a) = store_with_project();
    let b = s
        .create_project("Previvor", at("2026-10-01T00:00:00Z"))
        .unwrap()
        .id;
    assert_eq!(
        s.resume_project_id().unwrap(),
        Some(a),
        "no history: first active by name"
    );

    s.start(b, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.stop(at("2026-10-05T16:00:00Z")).unwrap();
    assert_eq!(s.resume_project_id().unwrap(), Some(b));

    s.conn
        .execute("UPDATE projects SET archived = 1 WHERE id = ?1", [b])
        .unwrap();
    assert_eq!(s.resume_project_id().unwrap(), Some(a));

    s.conn
        .execute("UPDATE projects SET archived = 1 WHERE id = ?1", [a])
        .unwrap();
    assert_eq!(s.resume_project_id().unwrap(), None);
}

#[test]
fn the_database_refuses_a_second_running_interval() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    let entry = s
        .status(at("2026-10-05T15:00:00Z"))
        .unwrap()
        .running
        .unwrap()
        .entry_id;
    let err = s.conn.execute(
        "INSERT INTO intervals (entry_id, start_at, source) VALUES (?1, '2026-10-05T15:05:00.000Z', 'timer')",
        [entry],
    );
    assert!(err.is_err());
}

#[test]
fn a_stale_timer_is_closed_at_the_last_heartbeat() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.heartbeat(at("2026-10-05T17:00:00Z")).unwrap();
    // App died; relaunched the next morning.
    let rec = s
        .recover_stale(at("2026-10-06T14:00:00Z"), Duration::minutes(2))
        .unwrap();
    assert_eq!(rec.unwrap().stopped_at, "2026-10-05T17:00:00.000Z");
    let e = s
        .entries(
            day("2026-10-05"),
            day("2026-10-05"),
            None,
            at("2026-10-06T14:00:00Z"),
        )
        .unwrap();
    assert_eq!(e[0].seconds, 7200);
}

#[test]
fn a_fresh_heartbeat_leaves_the_timer_running() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.heartbeat(at("2026-10-05T15:59:30Z")).unwrap();
    let rec = s
        .recover_stale(at("2026-10-05T16:00:00Z"), Duration::minutes(2))
        .unwrap();
    assert!(rec.is_none());
    assert!(s
        .status(at("2026-10-05T16:00:00Z"))
        .unwrap()
        .running
        .is_some());
}

fn log(s: &mut Store, p: i64, d: &str, hours: i64) {
    let t = at(&format!("{d}T15:00:00Z"));
    s.start(p, None, t, day(d)).unwrap();
    s.stop(t + Duration::hours(hours)).unwrap();
}

#[test]
fn totals_bucket_by_local_day_week_and_month() {
    let (mut s, p) = store_with_project();
    log(&mut s, p, "2026-09-30", 1); // last month (a Wednesday)
    log(&mut s, p, "2026-10-04", 2); // Sunday
    log(&mut s, p, "2026-10-05", 4); // Monday = today
    let now = at("2026-10-05T23:00:00Z");

    let t = s
        .totals(day("2026-10-05"), WeekStart::Monday, None, now)
        .unwrap();
    assert_eq!(t.today, 4 * 3600);
    assert_eq!(
        t.this_week,
        4 * 3600,
        "Sunday belongs to the previous Monday-week"
    );
    assert_eq!(t.this_month, 6 * 3600);
    assert_eq!(t.last_month, 3600);

    let t = s
        .totals(day("2026-10-05"), WeekStart::Sunday, None, now)
        .unwrap();
    assert_eq!(
        t.this_week,
        6 * 3600,
        "with Sunday weeks, Sunday starts this week"
    );
}

#[test]
fn last_month_handles_january() {
    let (mut s, p) = store_with_project();
    log(&mut s, p, "2025-12-31", 3);
    log(&mut s, p, "2025-12-01", 1);
    let t = s
        .totals(
            day("2026-01-02"),
            WeekStart::Monday,
            None,
            at("2026-01-02T20:00:00Z"),
        )
        .unwrap();
    assert_eq!(t.last_month, 4 * 3600);
    assert_eq!(t.this_month, 0);
}

#[test]
fn totals_include_the_running_interval() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    let t = s
        .totals(
            day("2026-10-05"),
            WeekStart::Monday,
            None,
            at("2026-10-05T15:45:00Z"),
        )
        .unwrap();
    assert_eq!(t.today, 2700);
}

#[test]
fn deleting_an_entry_removes_its_intervals_and_time() {
    let (mut s, p) = store_with_project();
    log(&mut s, p, "2026-10-05", 2);
    let now = at("2026-10-05T23:00:00Z");
    let entry = s
        .entries(day("2026-10-05"), day("2026-10-05"), None, now)
        .unwrap()[0]
        .id;

    s.delete_entry(entry).unwrap();

    assert!(s
        .entries(day("2026-10-05"), day("2026-10-05"), None, now)
        .unwrap()
        .is_empty());
    let intervals: i64 = s
        .conn
        .query_row("SELECT COUNT(*) FROM intervals", [], |r| r.get(0))
        .unwrap();
    assert_eq!(intervals, 0);
    let t = s
        .totals(day("2026-10-05"), WeekStart::Monday, None, now)
        .unwrap();
    assert_eq!(t.today, 0);
}

#[test]
fn deleting_the_running_entry_is_refused() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    let now = at("2026-10-05T15:30:00Z");
    let entry = s.status(now).unwrap().running.unwrap().entry_id;

    assert!(matches!(s.delete_entry(entry), Err(Error::EntryRunning(id)) if id == entry));
    assert_eq!(s.status(now).unwrap().elapsed_seconds, 1800);
}

#[test]
fn deleting_an_unknown_entry_is_not_found() {
    let (s, _) = store_with_project();
    assert!(matches!(s.delete_entry(99), Err(Error::EntryNotFound(99))));
}

#[test]
fn migrations_are_idempotent() {
    let dir = std::env::temp_dir().join(format!("tk-mig-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("t.db");
    drop(Store::open(&path).unwrap());
    let s = Store::open(&path).unwrap();
    let v: i64 = s
        .conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap();
    assert_eq!(v, schema::CURRENT_VERSION);
    std::fs::remove_dir_all(dir).ok();
}

// ------------------------------------------------------------------ v1 import

/// Builds a small v1 database with the v1 schema, covering the awkward cases
/// seen in the real data.
fn v1_fixture(path: &std::path::Path) {
    let c = Connection::open(path).unwrap();
    c.execute_batch(
        r#"
        CREATE TABLE projects (projectId INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            description TEXT, color TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE sessions (sessionId INTEGER PRIMARY KEY AUTOINCREMENT, projectId INTEGER NOT NULL,
            startTime DATETIME NOT NULL, endTime DATETIME, duration INTEGER, notes TEXT);
        CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        INSERT INTO settings VALUES ('schema_version', '4');
        INSERT INTO projects (projectId, name, createdAt) VALUES (1, 'Previvor -  Beta ', '2025-05-19 17:42:13');
        INSERT INTO projects (projectId, name, createdAt) VALUES (3, 'Elevate', '2026-01-27 22:14:55');
        -- normal: closed the next morning, endTime meaningless
        INSERT INTO sessions VALUES (10, 3, '2026-09-21T14:15:00.000Z', '2026-09-22T14:00:00.000Z', 7524, 'LABS-734');
        -- never closed
        INSERT INTO sessions VALUES (11, 1, '2025-06-19T15:09:44.367Z', NULL, NULL, '6/19');
        -- never closed but has a duration
        INSERT INTO sessions VALUES (12, 1, '2025-07-22T14:28:36.818Z', NULL, 2, '7/22');
        -- evening start in Pacific time = next day in UTC
        INSERT INTO sessions VALUES (13, 3, '2026-09-23T03:30:00.000Z', '2026-09-23T05:00:00.000Z', 5400, 'late');
        "#,
    )
    .unwrap();
}

fn pacific_day(t: DateTime<Utc>) -> NaiveDate {
    (t - Duration::hours(7)).date_naive()
}

#[test]
fn imports_v1_by_local_day_and_ignores_end_time() {
    let dir = std::env::temp_dir().join(format!("tk-imp-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let v1 = dir.join("v1.db");
    v1_fixture(&v1);

    let mut s = Store::open_in_memory().unwrap();
    let r = s.import_v1(&v1, pacific_day).unwrap();
    assert_eq!(r.projects, 2);
    assert_eq!(r.entries, 4);
    assert_eq!(r.seconds, 7524 + 2 + 5400);
    assert_eq!(r.unclosed_sessions, 2);
    assert_eq!(r.missing_durations, 1);

    let now = Utc.with_ymd_and_hms(2026, 10, 10, 0, 0, 0).unwrap();
    let all = s
        .entries(day("2025-01-01"), day("2026-12-31"), None, now)
        .unwrap();
    let late = all.iter().find(|e| e.notes == "late").unwrap();
    assert_eq!(
        late.day, "2026-09-22",
        "8:30pm Pacific stays on the local day"
    );
    let normal = all.iter().find(|e| e.notes == "LABS-734").unwrap();
    assert_eq!(normal.seconds, 7524);
    assert!(
        all.iter().all(|e| !e.running),
        "unclosed v1 sessions must not import as running"
    );
    assert_eq!(
        s.projects()
            .unwrap()
            .iter()
            .filter(|p| p.name == "Previvor -  Beta")
            .count(),
        1
    );

    // Running it again changes nothing.
    let again = s.import_v1(&v1, pacific_day).unwrap();
    assert_eq!(again.entries, 0);
    assert_eq!(again.already_imported, 6);
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn import_skips_and_counts_orphaned_and_unparseable_sessions() {
    let dir = std::env::temp_dir().join(format!("tk-imp-bad-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let v1 = dir.join("v1.db");
    v1_fixture(&v1);
    Connection::open(&v1)
        .unwrap()
        .execute_batch(
            r#"
            -- project 2 was deleted; v1 never enforced the foreign key
            INSERT INTO sessions VALUES (20, 2, '2026-09-24T15:00:00.000Z', NULL, 600, 'orphan');
            INSERT INTO sessions VALUES (21, 3, 'not a time', NULL, 600, 'garbled');
            "#,
        )
        .unwrap();

    let mut s = Store::open_in_memory().unwrap();
    let r = s.import_v1(&v1, pacific_day).unwrap();
    assert_eq!(r.entries, 4, "the good sessions still import");
    assert_eq!(r.orphaned_sessions, 1);
    assert_eq!(r.unparseable_sessions, 1);
    std::fs::remove_dir_all(dir).ok();
}

/// Point `TK_V1_DB` at a copy of the real v1 database to check the import
/// against it. Skipped otherwise, so no personal data lives in the repo.
#[test]
fn imports_real_v1_database_when_provided() {
    let Ok(path) = std::env::var("TK_V1_DB") else {
        return;
    };
    let mut s = Store::open_in_memory().unwrap();
    let r = s.import_v1(&path, pacific_day).unwrap();
    eprintln!("{r:#?}");
    let v1 =
        Connection::open_with_flags(&path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
    let (n, secs): (usize, i64) = v1
        .query_row(
            "SELECT COUNT(*), COALESCE(SUM(duration), 0) FROM sessions",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    let skipped = r.orphaned_sessions + r.unparseable_sessions;
    assert_eq!(r.entries + skipped, n);
    if skipped == 0 {
        assert_eq!(r.seconds, secs);
    }
    let now = Utc::now();
    let all = s
        .entries(day("2000-01-01"), day("2100-01-01"), None, now)
        .unwrap();
    assert_eq!(
        all.iter().map(|e| e.seconds).sum::<i64>(),
        r.seconds,
        "derived durations match the imported totals"
    );
    assert!(s.status(now).unwrap().running.is_none());
}

// ------------------------------------------------------- set_entry_seconds

fn pacific_noon(d: NaiveDate) -> DateTime<Utc> {
    Utc.from_utc_datetime(&d.and_hms_opt(19, 0, 0).unwrap())
}

fn only_entry(s: &Store, d: &str) -> Entry {
    let mut e = s
        .entries(day(d), day(d), None, at(&format!("{d}T23:00:00Z")))
        .unwrap();
    assert_eq!(e.len(), 1);
    e.remove(0)
}

fn intervals_of(s: &Store, entry_id: i64) -> Vec<(String, Option<String>, String)> {
    let mut stmt = s
        .conn
        .prepare("SELECT start_at, end_at, source FROM intervals WHERE entry_id = ?1 ORDER BY start_at, id")
        .unwrap();
    stmt.query_map([entry_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap()
}

/// Two timer intervals on 2026-10-05: 15:00–16:00 and 17:00–18:00 UTC.
fn two_intervals(s: &mut Store, p: i64) -> i64 {
    log(s, p, "2026-10-05", 1);
    s.start(p, None, at("2026-10-05T17:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.stop(at("2026-10-05T18:00:00Z")).unwrap();
    only_entry(s, "2026-10-05").id
}

const EDIT_AT: &str = "2026-10-06T12:00:00Z";

#[test]
fn raising_adds_a_manual_interval_ending_at_the_last_interval_end() {
    let (mut s, p) = store_with_project();
    let id = two_intervals(&mut s, p);
    s.set_entry_seconds(id, 3 * 3600, at(EDIT_AT), pacific_noon)
        .unwrap();

    assert_eq!(only_entry(&s, "2026-10-05").seconds, 3 * 3600);
    let manual: Vec<_> = intervals_of(&s, id)
        .into_iter()
        .filter(|i| i.2 == "manual")
        .collect();
    assert_eq!(
        manual,
        [(
            "2026-10-05T17:00:00.000Z".to_string(),
            Some("2026-10-05T18:00:00.000Z".to_string()),
            "manual".to_string()
        )]
    );
}

#[test]
fn raising_an_entry_with_no_intervals_ends_at_local_noon() {
    let (mut s, p) = store_with_project();
    log(&mut s, p, "2026-10-05", 1);
    let id = only_entry(&s, "2026-10-05").id;
    s.set_entry_seconds(id, 0, at(EDIT_AT), pacific_noon)
        .unwrap();
    s.set_entry_seconds(id, 1800, at(EDIT_AT), pacific_noon)
        .unwrap();

    assert_eq!(only_entry(&s, "2026-10-05").seconds, 1800);
    assert_eq!(
        intervals_of(&s, id),
        [(
            "2026-10-05T18:30:00.000Z".to_string(),
            Some("2026-10-05T19:00:00.000Z".to_string()),
            "manual".to_string()
        )]
    );
}

#[test]
fn lowering_shortens_the_latest_interval() {
    let (mut s, p) = store_with_project();
    let id = two_intervals(&mut s, p);
    s.set_entry_seconds(id, 5400, at(EDIT_AT), pacific_noon)
        .unwrap();

    assert_eq!(only_entry(&s, "2026-10-05").seconds, 5400);
    let ends: Vec<_> = intervals_of(&s, id)
        .into_iter()
        .filter_map(|i| i.1)
        .collect();
    assert_eq!(
        ends,
        ["2026-10-05T16:00:00.000Z", "2026-10-05T17:30:00.000Z"]
    );
}

#[test]
fn lowering_removes_later_intervals_before_trimming_earlier_ones() {
    let (mut s, p) = store_with_project();
    let id = two_intervals(&mut s, p);
    s.set_entry_seconds(id, 1800, at(EDIT_AT), pacific_noon)
        .unwrap();

    assert_eq!(only_entry(&s, "2026-10-05").seconds, 1800);
    assert_eq!(
        intervals_of(&s, id),
        [(
            "2026-10-05T15:00:00.000Z".to_string(),
            Some("2026-10-05T15:30:00.000Z".to_string()),
            "timer".to_string()
        )]
    );
}

#[test]
fn lowering_to_zero_keeps_the_entry_with_no_intervals() {
    let (mut s, p) = store_with_project();
    let id = two_intervals(&mut s, p);
    s.set_entry_seconds(id, 0, at(EDIT_AT), pacific_noon)
        .unwrap();

    let e = only_entry(&s, "2026-10-05");
    assert_eq!((e.id, e.seconds), (id, 0));
    assert!(intervals_of(&s, id).is_empty());
}

#[test]
fn setting_seconds_refuses_a_running_entry() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    let id = only_entry(&s, "2026-10-05").id;

    let r = s.set_entry_seconds(id, 60, at("2026-10-05T15:30:00Z"), pacific_noon);
    assert!(matches!(r, Err(Error::Invalid(_))), "{r:?}");
    assert_eq!(intervals_of(&s, id).len(), 1);
}

#[test]
fn lowering_after_a_raise_trims_the_manual_interval_first() {
    let (mut s, p) = store_with_project();
    let id = two_intervals(&mut s, p);
    s.set_entry_seconds(id, 4 * 3600, at(EDIT_AT), pacific_noon)
        .unwrap();
    s.set_entry_seconds(id, 3 * 3600, at(EDIT_AT), pacific_noon)
        .unwrap();

    assert_eq!(
        intervals_of(&s, id),
        [
            (
                "2026-10-05T15:00:00.000Z".to_string(),
                Some("2026-10-05T16:00:00.000Z".to_string()),
                "timer".to_string()
            ),
            (
                "2026-10-05T16:00:00.000Z".to_string(),
                Some("2026-10-05T17:00:00.000Z".to_string()),
                "manual".to_string()
            ),
            (
                "2026-10-05T17:00:00.000Z".to_string(),
                Some("2026-10-05T18:00:00.000Z".to_string()),
                "timer".to_string()
            ),
        ]
    );
}

#[test]
fn setting_seconds_rejects_more_than_a_day() {
    let (mut s, p) = store_with_project();
    log(&mut s, p, "2026-10-05", 1);
    let id = only_entry(&s, "2026-10-05").id;

    s.set_entry_seconds(id, MAX_ENTRY_SECONDS, at(EDIT_AT), pacific_noon)
        .unwrap();
    for seconds in [MAX_ENTRY_SECONDS + 1, i64::MAX] {
        let r = s.set_entry_seconds(id, seconds, at(EDIT_AT), pacific_noon);
        assert!(matches!(r, Err(Error::Invalid(_))), "{r:?}");
    }
    assert_eq!(only_entry(&s, "2026-10-05").seconds, MAX_ENTRY_SECONDS);
}

#[test]
fn setting_seconds_rejects_negative_values_and_unknown_entries() {
    let (mut s, p) = store_with_project();
    log(&mut s, p, "2026-10-05", 1);
    let id = only_entry(&s, "2026-10-05").id;

    let r = s.set_entry_seconds(id, -1, at(EDIT_AT), pacific_noon);
    assert!(matches!(r, Err(Error::Invalid(_))), "{r:?}");
    let r = s.set_entry_seconds(id + 99, 60, at(EDIT_AT), pacific_noon);
    assert!(matches!(r, Err(Error::EntryNotFound(_))), "{r:?}");
    assert_eq!(only_entry(&s, "2026-10-05").seconds, 3600);
}
