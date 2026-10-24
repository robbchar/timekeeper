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

    s.set_project_archived(b, true).unwrap();
    assert_eq!(s.resume_project_id().unwrap(), Some(a));

    s.set_project_archived(a, true).unwrap();
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
fn a_stale_timer_that_went_idle_is_closed_where_idling_began() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.mark_idle(at("2026-10-05T16:00:00Z"), at("2026-10-05T16:20:00Z"))
        .unwrap();
    s.heartbeat(at("2026-10-05T17:00:00Z")).unwrap();
    let rec = s
        .recover_stale(at("2026-10-06T14:00:00Z"), Duration::minutes(2))
        .unwrap();
    assert_eq!(rec.unwrap().stopped_at, "2026-10-05T16:00:00.000Z");
    assert_eq!(s.idle_since().unwrap(), None);
}

#[test]
fn a_fresh_heartbeat_leaves_the_idle_mark_for_the_prompt() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.mark_idle(at("2026-10-05T15:30:00Z"), at("2026-10-05T15:50:00Z"))
        .unwrap();
    s.heartbeat(at("2026-10-05T15:59:30Z")).unwrap();
    let rec = s
        .recover_stale(at("2026-10-05T16:00:00Z"), Duration::minutes(2))
        .unwrap();
    assert!(rec.is_none());
    assert_eq!(s.idle_since().unwrap(), Some(at("2026-10-05T15:30:00Z")));
}

#[test]
fn the_first_idle_mark_is_kept() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.mark_idle(at("2026-10-05T15:30:00Z"), at("2026-10-05T15:50:00Z"))
        .unwrap();
    s.mark_idle(at("2026-10-05T15:40:00Z"), at("2026-10-05T16:00:00Z"))
        .unwrap();
    assert_eq!(s.idle_since().unwrap(), Some(at("2026-10-05T15:30:00Z")));
}

#[test]
fn idling_while_stopped_is_not_marked() {
    let (s, _) = store_with_project();
    s.mark_idle(at("2026-10-05T15:30:00Z"), at("2026-10-05T15:50:00Z"))
        .unwrap();
    assert_eq!(s.idle_since().unwrap(), None);
}

#[test]
fn stopping_or_starting_clears_the_idle_mark() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.mark_idle(at("2026-10-05T15:30:00Z"), at("2026-10-05T15:50:00Z"))
        .unwrap();
    s.stop(at("2026-10-05T16:00:00Z")).unwrap();
    assert_eq!(s.idle_since().unwrap(), None);

    let b = s
        .create_project("Katas", at("2026-10-01T00:00:00Z"))
        .unwrap()
        .id;
    s.start(p, None, at("2026-10-05T17:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.mark_idle(at("2026-10-05T17:30:00Z"), at("2026-10-05T17:50:00Z"))
        .unwrap();
    s.start(b, None, at("2026-10-05T18:00:00Z"), day("2026-10-05"))
        .unwrap();
    assert_eq!(s.idle_since().unwrap(), None);
}

#[test]
fn keeping_idle_time_leaves_the_interval_open() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.mark_idle(at("2026-10-05T15:30:00Z"), at("2026-10-05T15:50:00Z"))
        .unwrap();
    s.keep_idle().unwrap();
    assert_eq!(s.idle_since().unwrap(), None);
    let st = s.status(at("2026-10-05T16:00:00Z")).unwrap();
    assert_eq!(st.elapsed_seconds, 3600);
}

#[test]
fn discarding_idle_time_trims_and_times_from_the_return() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.mark_idle(at("2026-10-05T15:30:00Z"), at("2026-10-05T15:50:00Z"))
        .unwrap();
    let st = s
        .discard_idle(
            at("2026-10-05T15:55:00Z"),
            day("2026-10-05"),
            at("2026-10-05T16:00:00Z"),
        )
        .unwrap();
    let r = st.running.unwrap();
    assert_eq!(r.project_id, p);
    assert_eq!(r.interval_started_at, "2026-10-05T15:55:00.000Z");
    assert_eq!(r.prior_seconds, 1800);
    assert_eq!(s.idle_since().unwrap(), None);
    let st = s.status(at("2026-10-05T16:10:00Z")).unwrap();
    assert_eq!(st.elapsed_seconds, 2700);
}

#[test]
fn discarding_never_resumes_after_now() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.mark_idle(at("2026-10-05T15:30:00Z"), at("2026-10-05T15:50:00Z"))
        .unwrap();
    let st = s
        .discard_idle(
            at("2026-10-05T17:00:00Z"),
            day("2026-10-05"),
            at("2026-10-05T16:00:00Z"),
        )
        .unwrap();
    let r = st.running.unwrap();
    assert_eq!(r.interval_started_at, "2026-10-05T16:00:00.000Z");
}

#[test]
fn discarding_never_trims_before_the_interval_started() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.mark_idle(at("2026-10-05T14:00:00Z"), at("2026-10-05T15:20:00Z"))
        .unwrap();
    s.discard_idle(
        at("2026-10-05T16:00:00Z"),
        day("2026-10-05"),
        at("2026-10-05T16:00:00Z"),
    )
    .unwrap();
    let e = s
        .entries(
            day("2026-10-05"),
            day("2026-10-05"),
            None,
            at("2026-10-05T16:00:00Z"),
        )
        .unwrap();
    assert_eq!(e[0].seconds, 0);
}

#[test]
fn discarding_across_midnight_resumes_on_todays_entry() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T22:00:00Z"), day("2026-10-05"))
        .unwrap();
    s.mark_idle(at("2026-10-05T23:00:00Z"), at("2026-10-05T23:20:00Z"))
        .unwrap();
    s.discard_idle(
        at("2026-10-06T08:00:00Z"),
        day("2026-10-06"),
        at("2026-10-06T08:00:00Z"),
    )
    .unwrap();
    let e = s
        .entries(
            day("2026-10-05"),
            day("2026-10-06"),
            None,
            at("2026-10-06T08:30:00Z"),
        )
        .unwrap();
    let by_day = |d: &str| e.iter().find(|x| x.day == d).unwrap().seconds;
    assert_eq!(by_day("2026-10-05"), 3600);
    assert_eq!(by_day("2026-10-06"), 1800);
}

#[test]
fn discarding_without_an_idle_mark_changes_nothing() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();
    let st = s
        .discard_idle(
            at("2026-10-05T16:00:00Z"),
            day("2026-10-05"),
            at("2026-10-05T16:00:00Z"),
        )
        .unwrap();
    assert_eq!(st.elapsed_seconds, 3600);
    assert!(st.running.is_some());
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
    let (mut s, _) = store_with_project();
    assert!(matches!(s.delete_entry(99), Err(Error::EntryNotFound(99))));
}

// ---------------------------------------------------------------- projects

fn project(s: &Store, id: i64) -> Project {
    s.projects()
        .unwrap()
        .into_iter()
        .find(|p| p.id == id)
        .unwrap()
}

#[test]
fn new_projects_take_palette_keys_in_order() {
    let (s, a) = store_with_project();
    let b = s
        .create_project("Previvor", at("2026-10-01T00:00:00Z"))
        .unwrap();
    assert_eq!(project(&s, a).color.as_deref(), Some("teal"));
    assert_eq!(b.color.as_deref(), Some("coral"));
}

#[test]
fn renaming_trims_and_rejects_an_empty_name() {
    let (s, p) = store_with_project();
    s.rename_project(p, "  Elevate Labs ").unwrap();
    assert_eq!(project(&s, p).name, "Elevate Labs");

    assert!(matches!(s.rename_project(p, "   "), Err(Error::Invalid(_))));
    assert_eq!(project(&s, p).name, "Elevate Labs");
}

#[test]
fn project_color_must_be_a_palette_key() {
    let (s, p) = store_with_project();
    s.set_project_color(p, "purple").unwrap();
    assert_eq!(project(&s, p).color.as_deref(), Some("purple"));

    assert!(matches!(
        s.set_project_color(p, "#ff0000"),
        Err(Error::Invalid(_))
    ));
    assert_eq!(project(&s, p).color.as_deref(), Some("purple"));
}

#[test]
fn archiving_leaves_history_unchanged() {
    let (mut s, p) = store_with_project();
    s.start(
        p,
        Some("LABS-1"),
        at("2026-10-05T15:00:00Z"),
        day("2026-10-05"),
    )
    .unwrap();
    let now = at("2026-10-05T16:00:00Z");
    s.stop(now).unwrap();
    let list = |s: &Store| {
        s.entries(day("2026-10-05"), day("2026-10-05"), None, now)
            .unwrap()
    };
    let before = list(&s);

    s.set_project_archived(p, true).unwrap();
    assert!(project(&s, p).archived);
    assert_eq!(list(&s), before);
    assert_eq!(
        s.totals(day("2026-10-05"), WeekStart::Monday, Some(p), now)
            .unwrap()
            .today,
        3600
    );

    s.set_project_archived(p, false).unwrap();
    assert!(!project(&s, p).archived);
}

#[test]
fn updating_an_unknown_project_is_not_found() {
    let (s, _) = store_with_project();
    assert!(matches!(
        s.rename_project(99, "x"),
        Err(Error::ProjectNotFound(99))
    ));
    assert!(matches!(
        s.set_project_color(99, "teal"),
        Err(Error::ProjectNotFound(99))
    ));
    assert!(matches!(
        s.set_project_archived(99, true),
        Err(Error::ProjectNotFound(99))
    ));
}

#[test]
fn migration_2_turns_hex_colors_into_palette_keys() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(&format!(
        "{} PRAGMA user_version = 1;",
        schema::MIGRATIONS[0]
    ))
    .unwrap();
    conn.execute_batch(
        "INSERT INTO projects (id, name, color, created_at) VALUES
            (1, 'a', '#e9c46a', 'x'),
            (2, 'b', '#123456', 'x'),
            (3, 'c', NULL, 'x');",
    )
    .unwrap();

    let s = Store::init(conn).unwrap();
    let colors: Vec<_> = s.projects().unwrap().into_iter().map(|p| p.color).collect();
    let keys = |k: [&str; 3]| k.map(|c| Some(c.to_string())).to_vec();
    assert_eq!(
        colors,
        keys(["gold", "coral", "blue"]),
        "unknown or missing: cycle by id"
    );
}

#[test]
fn migration_3_leaves_existing_projects_without_linear() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(&format!(
        "{} {} PRAGMA user_version = 2;",
        schema::MIGRATIONS[0],
        schema::MIGRATIONS[1]
    ))
    .unwrap();
    conn.execute_batch(
        "INSERT INTO projects (id, name, color, created_at) VALUES (1, 'a', 'teal', 'x');",
    )
    .unwrap();

    let s = Store::init(conn).unwrap();
    let p = &s.projects().unwrap()[0];
    assert!(!p.linear_enabled);
    assert_eq!(p.linear_team_key, None);
}

#[test]
fn new_projects_start_without_linear() {
    let (s, id) = store_with_project();
    let created = project(&s, id);
    assert!(!created.linear_enabled);
    assert_eq!(created.linear_team_key, None);
}

#[test]
fn set_project_linear_team_normalizes_the_team_key() {
    let (s, id) = store_with_project();
    s.set_project_linear_team(id, Some("  labs ")).unwrap();
    assert_eq!(project(&s, id).linear_team_key.as_deref(), Some("LABS"));

    s.set_project_linear_team(id, Some("   ")).unwrap();
    assert_eq!(
        project(&s, id).linear_team_key,
        None,
        "blank means no filter"
    );
    s.set_project_linear_team(id, Some("LABS")).unwrap();
    s.set_project_linear_team(id, None).unwrap();
    assert_eq!(project(&s, id).linear_team_key, None);
}

#[test]
fn set_project_linear_enabled_keeps_the_team_key() {
    let (s, id) = store_with_project();
    s.set_project_linear_team(id, Some("LABS")).unwrap();
    s.set_project_linear_enabled(id, true).unwrap();
    assert!(project(&s, id).linear_enabled);
    s.set_project_linear_enabled(id, false).unwrap();
    let p = project(&s, id);
    assert!(!p.linear_enabled);
    assert_eq!(p.linear_team_key.as_deref(), Some("LABS"));
}

#[test]
fn set_project_linear_team_leaves_enabled_alone() {
    let (s, id) = store_with_project();
    s.set_project_linear_enabled(id, true).unwrap();
    s.set_project_linear_team(id, Some("LABS")).unwrap();
    assert!(project(&s, id).linear_enabled);
}

#[test]
fn set_project_linear_team_refuses_a_team_key_that_isnt_letters_and_digits() {
    let (s, id) = store_with_project();
    for bad in ["LA-BS", "labs!", "LA BS"] {
        assert!(
            matches!(
                s.set_project_linear_team(id, Some(bad)),
                Err(Error::Invalid(_))
            ),
            "{bad:?} should be refused"
        );
    }
    assert_eq!(project(&s, id).linear_team_key, None, "nothing saved");
}

#[test]
fn set_project_linear_team_refuses_non_ascii() {
    let (s, id) = store_with_project();
    assert!(matches!(
        s.set_project_linear_team(id, Some("ÄBC")),
        Err(Error::Invalid(_))
    ));
}

#[test]
fn set_project_linear_on_an_unknown_project_fails() {
    let (s, _) = store_with_project();
    assert!(matches!(
        s.set_project_linear_enabled(99, true),
        Err(Error::ProjectNotFound(99))
    ));
    assert!(matches!(
        s.set_project_linear_team(99, None),
        Err(Error::ProjectNotFound(99))
    ));
}

#[test]
fn migration_4_leaves_existing_projects_unrounded() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(&format!(
        "{} {} {} PRAGMA user_version = 3;",
        schema::MIGRATIONS[0],
        schema::MIGRATIONS[1],
        schema::MIGRATIONS[2]
    ))
    .unwrap();
    conn.execute_batch(
        "INSERT INTO projects (id, name, color, created_at) VALUES (1, 'a', 'teal', 'x');",
    )
    .unwrap();

    let s = Store::init(conn).unwrap();
    let p = &s.projects().unwrap()[0];
    assert_eq!(p.rounding_minutes, None);
    assert_eq!(p.rounding_mode, RoundingMode::Nearest);
}

#[test]
fn new_projects_start_unrounded() {
    let (s, id) = store_with_project();
    let p = project(&s, id);
    assert_eq!(p.rounding_minutes, None);
    assert_eq!(p.rounding_mode, RoundingMode::Nearest);
}

#[test]
fn set_project_rounding_saves_step_and_mode() {
    let (s, id) = store_with_project();
    s.set_project_rounding(id, Some(15), RoundingMode::Up)
        .unwrap();
    let p = project(&s, id);
    assert_eq!(p.rounding_minutes, Some(15));
    assert_eq!(p.rounding_mode, RoundingMode::Up);
}

#[test]
fn turning_rounding_off_keeps_the_mode() {
    let (s, id) = store_with_project();
    s.set_project_rounding(id, Some(6), RoundingMode::Down)
        .unwrap();
    s.set_project_rounding(id, None, RoundingMode::Down)
        .unwrap();
    let p = project(&s, id);
    assert_eq!(p.rounding_minutes, None);
    assert_eq!(p.rounding_mode, RoundingMode::Down);
}

#[test]
fn set_project_rounding_refuses_a_step_outside_the_list() {
    let (s, id) = store_with_project();
    for bad in [0, -15, 7, 45, 120] {
        assert!(
            matches!(
                s.set_project_rounding(id, Some(bad), RoundingMode::Up),
                Err(Error::Invalid(_))
            ),
            "{bad}"
        );
    }
    assert_eq!(project(&s, id).rounding_minutes, None, "nothing saved");
}

#[test]
fn set_project_rounding_on_an_unknown_project_fails() {
    let (s, _) = store_with_project();
    assert!(matches!(
        s.set_project_rounding(99, Some(15), RoundingMode::Up),
        Err(Error::ProjectNotFound(99))
    ));
}

#[test]
fn the_database_refuses_an_unknown_rounding_mode() {
    let (s, id) = store_with_project();
    assert!(s
        .conn
        .execute(
            "UPDATE projects SET rounding_mode = 'sideways' WHERE id = ?1",
            [id]
        )
        .is_err());
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

// --------------------------------------------------------------------- backup

#[test]
fn backup_copies_everything_including_a_running_timer() {
    let dir = std::env::temp_dir().join(format!("tk-backup-{}", std::process::id()));
    std::fs::remove_dir_all(&dir).ok();
    std::fs::create_dir_all(&dir).unwrap();
    let live = dir.join("live.db");
    let mut s = Store::open(&live).unwrap();
    let p = s
        .create_project("Elevate", at("2026-10-01T00:00:00Z"))
        .unwrap();
    s.start(
        p.id,
        Some("LABS-1"),
        at("2026-10-05T15:00:00Z"),
        day("2026-10-05"),
    )
    .unwrap();

    // `s` stays open, as it does in the app.
    let copy = dir.join("nested").join("backup.db");
    Store::backup_to(&live, &copy).unwrap();
    assert!(!dir.join("nested").join("backup.db.partial").exists());

    let b = Store::open(&copy).unwrap();
    assert_eq!(b.projects().unwrap(), s.projects().unwrap());
    let st = b.status(at("2026-10-05T15:30:00Z")).unwrap();
    assert_eq!(st.running.unwrap().project_id, p.id);
    assert_eq!(st.elapsed_seconds, 1800);
    drop((s, b));
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn backup_refuses_to_overwrite() {
    let dir = std::env::temp_dir().join(format!("tk-backup-exists-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let copy = dir.join("backup.db");
    std::fs::write(&copy, b"keep me").unwrap();

    let result = Store::backup_to(&dir.join("live.db"), &copy);
    assert!(matches!(result, Err(Error::Invalid(_))));
    assert_eq!(std::fs::read(&copy).unwrap(), b"keep me");
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn failed_backup_leaves_no_file() {
    let dir = std::env::temp_dir().join(format!("tk-backup-fails-{}", std::process::id()));
    std::fs::remove_dir_all(&dir).ok();
    std::fs::create_dir_all(&dir).unwrap();
    let live = dir.join("live.db");
    drop(Store::open(&live).unwrap());
    let copy = dir.join("backup.db");
    let partial = dir.join("backup.db.partial");
    // VACUUM INTO refuses a non-empty file, so the write fails.
    std::fs::write(&partial, b"stale").unwrap();

    assert!(Store::backup_to(&live, &copy).is_err());
    assert!(!copy.exists());
    assert!(!partial.exists());
    std::fs::remove_dir_all(dir).ok();
}

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("{name}-{}", std::process::id()));
    std::fs::remove_dir_all(&dir).ok();
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// A database migrated only as far as `version`, holding one project.
fn database_at_version(path: &Path, version: usize) {
    let c = Connection::open(path).unwrap();
    for sql in &schema::MIGRATIONS[..version] {
        c.execute_batch(sql).unwrap();
    }
    c.execute_batch(&format!("PRAGMA user_version = {version};"))
        .unwrap();
    c.execute(
        "INSERT INTO projects (name, created_at) VALUES ('Elevate', '2026-10-01T00:00:00Z')",
        [],
    )
    .unwrap();
}

fn user_version(path: &Path) -> i64 {
    Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .unwrap()
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap()
}

fn names_in(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(dir)
        .unwrap()
        .map(|e| e.unwrap().file_name().into_string().unwrap())
        .collect();
    names.sort();
    names
}

#[test]
fn opening_an_older_database_backs_it_up_before_migrating() {
    let dir = scratch("tk-open-older");
    let db = dir.join("live.db");
    database_at_version(&db, 2);
    let copy = dir.join("backups").join("before.db");

    let s = Store::open_with_backup(&db, || Ok(copy.clone())).unwrap();

    assert_eq!(user_version(&copy), 2);
    let projects: i64 = Connection::open(&copy)
        .unwrap()
        .query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0))
        .unwrap();
    assert_eq!(projects, 1);
    drop(s);
    assert_eq!(user_version(&db), schema::CURRENT_VERSION);
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn opening_a_new_or_current_database_makes_no_backup() {
    let dir = scratch("tk-open-current");
    let db = dir.join("live.db");

    drop(Store::open_with_backup(&db, || panic!("backed up a new database")).unwrap());
    drop(Store::open_with_backup(&db, || panic!("backed up a current database")).unwrap());
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn a_failed_backup_stops_the_migration() {
    let dir = scratch("tk-open-backup-fails");
    let db = dir.join("live.db");
    database_at_version(&db, 2);
    let copy = dir.join("before.db");
    // backup_to never overwrites, so this copy fails.
    std::fs::write(&copy, b"taken").unwrap();

    assert!(Store::open_with_backup(&db, || Ok(copy.clone())).is_err());
    assert_eq!(user_version(&db), 2);
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn a_database_from_a_newer_build_is_refused_untouched() {
    let dir = scratch("tk-open-newer");
    let db = dir.join("live.db");
    drop(Store::open(&db).unwrap());
    let newer = schema::CURRENT_VERSION + 1;
    Connection::open(&db)
        .unwrap()
        .execute_batch(&format!("PRAGMA user_version = {newer};"))
        .unwrap();
    let before = std::fs::read(&db).unwrap();

    let result = Store::open_with_backup(&db, || panic!("backed up a newer database"));

    assert!(matches!(
        result,
        Err(Error::SchemaTooNew { found, supported })
            if found == newer && supported == schema::CURRENT_VERSION
    ));
    assert_eq!(std::fs::read(&db).unwrap(), before);
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn daily_backup_writes_one_file_per_day() {
    let dir = scratch("tk-daily-once");
    let db = dir.join("live.db");
    drop(Store::open(&db).unwrap());
    let backups = dir.join("backups");

    Store::daily_backup(&db, &backups, day("2026-10-24"), 30).unwrap();
    Store::daily_backup(&db, &backups, day("2026-10-24"), 30).unwrap();

    assert_eq!(names_in(&backups), ["timekeeper-auto-2026-10-24.db"]);
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn daily_backup_prunes_only_older_automatic_backups() {
    let dir = scratch("tk-daily-prune");
    let db = dir.join("live.db");
    drop(Store::open(&db).unwrap());
    let backups = dir.join("backups");
    std::fs::create_dir_all(&backups).unwrap();
    for name in [
        "timekeeper-auto-2026-10-20.db",
        "timekeeper-auto-2026-10-21.db",
        "timekeeper-auto-2026-10-22.db",
        "timekeeper-auto-2026-10-23.db.partial",
        "timekeeper-auto-notes.txt",
        "timekeeper-2026-10-01_090000.000.db",
        "timekeeper-before-update-2026-10-02_090000.000.db",
    ] {
        std::fs::write(backups.join(name), b"x").unwrap();
    }

    Store::daily_backup(&db, &backups, day("2026-10-24"), 2).unwrap();

    assert_eq!(
        names_in(&backups),
        [
            "timekeeper-2026-10-01_090000.000.db",
            "timekeeper-auto-2026-10-22.db",
            "timekeeper-auto-2026-10-23.db.partial",
            "timekeeper-auto-2026-10-24.db",
            "timekeeper-auto-notes.txt",
            "timekeeper-before-update-2026-10-02_090000.000.db",
        ]
    );
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
    let r = s
        .import_v1(V1Data::read(&v1).unwrap(), pacific_day)
        .unwrap();
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

    assert!(s
        .projects()
        .unwrap()
        .iter()
        .all(|p| PALETTE.contains(&p.color.as_deref().unwrap())));

    // Running it again changes nothing.
    let again = s
        .import_v1(V1Data::read(&v1).unwrap(), pacific_day)
        .unwrap();
    assert_eq!(again.entries, 0);
    assert_eq!(again.already_imported, 4, "sessions only");
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
    let r = s
        .import_v1(V1Data::read(&v1).unwrap(), pacific_day)
        .unwrap();
    assert_eq!(r.entries, 4, "the good sessions still import");
    assert_eq!(r.orphaned_sessions, 1);
    assert_eq!(r.unparseable_sessions, 1);
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn import_again_brings_in_only_sessions_recorded_since() {
    let dir = std::env::temp_dir().join(format!("tk-imp-again-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let v1 = dir.join("v1.db");
    v1_fixture(&v1);
    let mut s = Store::open_in_memory().unwrap();
    s.import_v1(V1Data::read(&v1).unwrap(), pacific_day)
        .unwrap();

    Connection::open(&v1)
        .unwrap()
        .execute(
            "INSERT INTO sessions VALUES
                 (14, 3, '2026-10-05T15:00:00.000Z', '2026-10-06T14:00:00.000Z', 1800, 'LABS-800')",
            [],
        )
        .unwrap();
    let v1_bytes = std::fs::read(&v1).unwrap();

    let r = s
        .import_v1_again(V1Data::read(&v1).unwrap(), pacific_day)
        .unwrap();
    assert_eq!((r.entries, r.seconds, r.projects), (1, 1800, 0));
    assert_eq!(
        r.still_open, 0,
        "never-ended sessions the first import took aren't reported as open"
    );
    assert_eq!(
        std::fs::read(&v1).unwrap(),
        v1_bytes,
        "v1's file is untouched"
    );
    let now = Utc.with_ymd_and_hms(2026, 10, 10, 0, 0, 0).unwrap();
    let added = s
        .entries(day("2026-10-05"), day("2026-10-05"), None, now)
        .unwrap();
    assert_eq!(added.len(), 1);
    assert_eq!(
        (added[0].notes.as_str(), added[0].seconds),
        ("LABS-800", 1800)
    );

    let again = s
        .import_v1_again(V1Data::read(&v1).unwrap(), pacific_day)
        .unwrap();
    assert_eq!(again.entries, 0, "a second run adds nothing");
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn import_again_leaves_open_v1_sessions_until_they_end() {
    let dir = std::env::temp_dir().join(format!("tk-imp-open-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let v1 = dir.join("v1.db");
    v1_fixture(&v1);
    let mut s = Store::open_in_memory().unwrap();
    s.import_v1(V1Data::read(&v1).unwrap(), pacific_day)
        .unwrap();

    let v1_writer = Connection::open(&v1).unwrap();
    v1_writer
        .execute(
            "INSERT INTO sessions VALUES (15, 3, '2026-10-06T15:00:00.000Z', NULL, 600, 'LABS-801')",
            [],
        )
        .unwrap();
    let r = s
        .import_v1_again(V1Data::read(&v1).unwrap(), pacific_day)
        .unwrap();
    assert_eq!((r.entries, r.still_open), (0, 1));

    v1_writer
        .execute(
            "UPDATE sessions SET endTime = '2026-10-07T14:00:00.000Z', duration = 5400
             WHERE sessionId = 15",
            [],
        )
        .unwrap();
    let r = s
        .import_v1_again(V1Data::read(&v1).unwrap(), pacific_day)
        .unwrap();
    assert_eq!((r.entries, r.seconds, r.still_open), (1, 5400, 0));
    drop(v1_writer);
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn import_reports_a_missing_v1_database() {
    let missing = std::env::temp_dir()
        .join("tk-no-such-dir")
        .join("timekeeper.db");
    let e = V1Data::read(&missing).err().unwrap();
    assert!(matches!(e, Error::NoV1Database(_)), "{e}");
    assert!(
        e.to_string().contains(&missing.display().to_string()),
        "names the path it looked at: {e}"
    );
}

#[test]
fn import_again_adopts_a_same_named_v2_project() {
    let dir = std::env::temp_dir().join(format!("tk-imp-adopt-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let v1 = dir.join("v1.db");
    v1_fixture(&v1);
    let mut s = Store::open_in_memory().unwrap();
    s.import_v1(V1Data::read(&v1).unwrap(), pacific_day)
        .unwrap();
    let now = Utc.with_ymd_and_hms(2026, 10, 10, 0, 0, 0).unwrap();
    let labs = s.create_project("LABS", now).unwrap();

    Connection::open(&v1)
        .unwrap()
        .execute_batch(
            "INSERT INTO projects (projectId, name) VALUES (4, 'LABS ');
             INSERT INTO sessions VALUES
                 (16, 4, '2026-10-05T15:00:00.000Z', '2026-10-06T14:00:00.000Z', 900, 'x')",
        )
        .unwrap();
    let r = s
        .import_v1_again(V1Data::read(&v1).unwrap(), pacific_day)
        .unwrap();
    assert_eq!((r.projects, r.entries, r.already_imported), (0, 1, 4));
    let named: Vec<_> = s
        .projects()
        .unwrap()
        .into_iter()
        .filter(|p| p.name == "LABS")
        .collect();
    assert_eq!(named.len(), 1, "no twin project");
    let added = s
        .entries(day("2026-10-05"), day("2026-10-05"), None, now)
        .unwrap();
    assert_eq!(added[0].project_id, labs.id);
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
    let r = s
        .import_v1(V1Data::read(&path).unwrap(), pacific_day)
        .unwrap();
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

#[test]
fn raising_an_entry_with_no_intervals_never_ends_after_now() {
    let (mut s, p) = store_with_project();
    log(&mut s, p, "2026-10-05", 1);
    let id = only_entry(&s, "2026-10-05").id;
    let now = at("2026-10-05T18:00:00Z");
    s.set_entry_seconds(id, 0, now, pacific_noon).unwrap();
    s.set_entry_seconds(id, 1800, now, pacific_noon).unwrap();

    assert_eq!(
        intervals_of(&s, id),
        [(
            "2026-10-05T17:30:00.000Z".to_string(),
            Some("2026-10-05T18:00:00.000Z".to_string()),
            "manual".to_string()
        )]
    );
}

// ------------------------------------------------------- add_manual_time

fn manual<'a>(project_id: i64, d: &str, seconds: i64, notes: Option<&'a str>) -> ManualTime<'a> {
    ManualTime {
        project_id,
        day: day(d),
        seconds,
        notes,
    }
}

#[test]
fn manual_time_on_an_empty_past_day_creates_an_entry_ending_at_the_fallback() {
    let (mut s, p) = store_with_project();
    let e = s
        .add_manual_time(
            manual(p, "2026-10-03", 7200, Some("LABS-9")),
            at("2026-10-05T15:00:00Z"),
            day("2026-10-05"),
            at("2026-10-03T16:00:00Z"),
        )
        .unwrap();
    assert_eq!(e.day, "2026-10-03");
    assert_eq!(e.seconds, 7200);
    assert_eq!(e.notes, "LABS-9");
    assert!(!e.running);
    assert_eq!(
        intervals_of(&s, e.id),
        vec![(
            "2026-10-03T14:00:00.000Z".to_string(),
            Some("2026-10-03T16:00:00.000Z".to_string()),
            "manual".to_string()
        )]
    );
}

#[test]
fn manual_time_on_an_empty_today_never_ends_after_now() {
    let (mut s, p) = store_with_project();
    let e = s
        .add_manual_time(
            manual(p, "2026-10-05", 3600, None),
            at("2026-10-05T13:00:00Z"),
            day("2026-10-05"),
            at("2026-10-05T16:00:00Z"),
        )
        .unwrap();
    assert_eq!(
        intervals_of(&s, e.id),
        vec![(
            "2026-10-05T12:00:00.000Z".to_string(),
            Some("2026-10-05T13:00:00.000Z".to_string()),
            "manual".to_string()
        )]
    );
}

#[test]
fn manual_time_extends_an_existing_entry_before_its_first_interval() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-03T15:00:00Z"), day("2026-10-03"))
        .unwrap();
    s.stop(at("2026-10-03T16:00:00Z")).unwrap();

    let e = s
        .add_manual_time(
            manual(p, "2026-10-03", 1800, None),
            at("2026-10-05T15:00:00Z"),
            day("2026-10-05"),
            at("2026-10-03T19:00:00Z"),
        )
        .unwrap();
    assert_eq!(e.seconds, 5400);
    let iv = intervals_of(&s, e.id);
    assert_eq!(iv.len(), 2);
    assert_eq!(
        iv[0],
        (
            "2026-10-03T14:30:00.000Z".to_string(),
            Some("2026-10-03T15:00:00.000Z".to_string()),
            "manual".to_string()
        )
    );
    let totals = s
        .totals(
            day("2026-10-05"),
            WeekStart::Monday,
            None,
            at("2026-10-05T15:00:00Z"),
        )
        .unwrap();
    assert_eq!(totals.this_month, 5400);
}

#[test]
fn manual_time_on_the_running_entry_adds_to_it_and_keeps_timing() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-05T15:00:00Z"), day("2026-10-05"))
        .unwrap();

    let e = s
        .add_manual_time(
            manual(p, "2026-10-05", 7200, None),
            at("2026-10-05T15:30:00Z"),
            day("2026-10-05"),
            at("2026-10-05T16:00:00Z"),
        )
        .unwrap();
    assert!(e.running);
    assert_eq!(e.seconds, 7200 + 1800);

    let st = s.status(at("2026-10-05T16:00:00Z")).unwrap();
    let r = st.running.unwrap();
    assert_eq!(r.entry_id, e.id);
    assert_eq!(r.prior_seconds, 7200);
    assert_eq!(st.elapsed_seconds, 7200 + 3600);
}

#[test]
fn manual_time_appends_notes_to_an_existing_entry() {
    let (mut s, p) = store_with_project();
    let (now, today, end) = (
        at("2026-10-05T15:00:00Z"),
        day("2026-10-05"),
        at("2026-10-04T16:00:00Z"),
    );
    s.add_manual_time(manual(p, "2026-10-04", 60, Some("first")), now, today, end)
        .unwrap();
    let e = s
        .add_manual_time(
            manual(p, "2026-10-04", 60, Some("  second ")),
            now,
            today,
            end,
        )
        .unwrap();
    assert_eq!(e.notes, "first\nsecond");
    let e = s
        .add_manual_time(manual(p, "2026-10-04", 60, Some("  ")), now, today, end)
        .unwrap();
    assert_eq!(e.notes, "first\nsecond");
    assert_eq!(e.seconds, 180);
}

#[test]
fn manual_time_sets_notes_on_an_entry_without_any() {
    let (mut s, p) = store_with_project();
    s.start(p, None, at("2026-10-04T15:00:00Z"), day("2026-10-04"))
        .unwrap();
    s.stop(at("2026-10-04T16:00:00Z")).unwrap();
    let e = s
        .add_manual_time(
            manual(p, "2026-10-04", 60, Some("late note")),
            at("2026-10-05T15:00:00Z"),
            day("2026-10-05"),
            at("2026-10-04T16:00:00Z"),
        )
        .unwrap();
    assert_eq!(e.notes, "late note");
}

#[test]
fn manual_time_rejects_bad_input() {
    let (mut s, p) = store_with_project();
    let now = at("2026-10-05T15:00:00Z");
    let today = day("2026-10-05");
    let end = at("2026-10-05T16:00:00Z");
    for m in [
        manual(p, "2026-10-05", 0, None),
        manual(p, "2026-10-05", -5, None),
        manual(p, "2026-10-05", 24 * 3600 + 1, None),
        manual(p, "2026-10-06", 60, None),
    ] {
        assert!(matches!(
            s.add_manual_time(m, now, today, end),
            Err(Error::Invalid(_))
        ));
    }
    assert!(matches!(
        s.add_manual_time(manual(p + 99, "2026-10-05", 60, None), now, today, end),
        Err(Error::ProjectNotFound(_))
    ));
    assert!(s
        .entries(day("2026-10-01"), today, None, now)
        .unwrap()
        .is_empty());
}
