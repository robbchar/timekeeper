//! When to ask about idle time. The shell reads the last input time from the OS; the rules
//! for what to do with it live here so they can be tested without one.

use chrono::{DateTime, Duration, Utc};

/// The setting holding how many minutes of no input count as idle; "0" turns it off.
pub const IDLE_MINUTES_SETTING: &str = "idle_minutes";
pub const DEFAULT_IDLE_MINUTES: i64 = 20;

/// Input this close to the idle start is the input that started it, seen again on a later
/// tick, not the user coming back.
const SAME_INPUT: Duration = Duration::seconds(2);

/// How long without input counts as idle, from the setting; `None` when it is turned off.
/// A missing or unreadable value means the default.
pub fn idle_threshold(setting: Option<&str>) -> Option<Duration> {
    let minutes = setting
        .and_then(|v| v.trim().parse::<i64>().ok())
        .filter(|m| (0..=24 * 60).contains(m))
        .unwrap_or(DEFAULT_IDLE_MINUTES);
    (minutes > 0).then(|| Duration::minutes(minutes))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdleAction {
    Nothing,
    /// The user has gone idle; save when (`Store::mark_idle`).
    MarkIdle(DateTime<Utc>),
    /// The user is back after going idle; ask whether to keep the time.
    Ask {
        since: DateTime<Utc>,
        returned_at: DateTime<Utc>,
    },
}

/// What the ticker should do, given the last input and the saved idle start. Idle time is only
/// tracked while timing. Once marked, the user is asked on return even if the threshold has
/// since been turned off, since the mark is already saved.
pub fn idle_action(
    threshold: Option<Duration>,
    running: bool,
    idle_since: Option<DateTime<Utc>>,
    last_input: DateTime<Utc>,
    now: DateTime<Utc>,
) -> IdleAction {
    if !running {
        return IdleAction::Nothing;
    }
    match (idle_since, threshold) {
        (Some(since), _) if last_input > since + SAME_INPUT => IdleAction::Ask {
            since,
            returned_at: last_input,
        },
        (Some(_), _) => IdleAction::Nothing,
        (None, Some(t)) if now - last_input >= t => IdleAction::MarkIdle(last_input),
        (None, _) => IdleAction::Nothing,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }
    const TWENTY: Option<Duration> = Some(Duration::minutes(20));

    #[test]
    fn threshold_reads_the_setting() {
        assert_eq!(idle_threshold(None), Some(Duration::minutes(20)));
        assert_eq!(idle_threshold(Some("5")), Some(Duration::minutes(5)));
        assert_eq!(idle_threshold(Some("0")), None);
        for bad in ["", "soon", "-3", "1.5", "99999"] {
            assert_eq!(idle_threshold(Some(bad)), TWENTY, "{bad:?}");
        }
    }

    #[test]
    fn marks_idle_once_the_threshold_passes() {
        let input = at("2026-10-05T15:00:00Z");
        let act = |now| idle_action(TWENTY, true, None, input, at(now));
        assert_eq!(act("2026-10-05T15:19:59Z"), IdleAction::Nothing);
        assert_eq!(act("2026-10-05T15:20:00Z"), IdleAction::MarkIdle(input));
    }

    #[test]
    fn asks_when_input_comes_after_the_idle_start() {
        let since = at("2026-10-05T15:00:00Z");
        let now = at("2026-10-05T15:30:00Z");
        let still_away = idle_action(TWENTY, true, Some(since), since, now);
        assert_eq!(still_away, IdleAction::Nothing);
        let jitter = idle_action(TWENTY, true, Some(since), since + Duration::seconds(1), now);
        assert_eq!(jitter, IdleAction::Nothing);
        let back = at("2026-10-05T15:29:59Z");
        assert_eq!(
            idle_action(TWENTY, true, Some(since), back, now),
            IdleAction::Ask {
                since,
                returned_at: back
            }
        );
        assert_eq!(
            idle_action(None, true, Some(since), back, now),
            IdleAction::Ask {
                since,
                returned_at: back
            },
            "a saved mark is still asked about after turning it off"
        );
    }

    #[test]
    fn ignores_idle_time_while_stopped_or_turned_off() {
        let input = at("2026-10-05T15:00:00Z");
        let now = at("2026-10-05T17:00:00Z");
        assert_eq!(
            idle_action(TWENTY, false, None, input, now),
            IdleAction::Nothing
        );
        assert_eq!(
            idle_action(None, true, None, input, now),
            IdleAction::Nothing
        );
    }
}
