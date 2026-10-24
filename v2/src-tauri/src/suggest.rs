//! Lines suggested for a day's notes, one group per source the project has turned on.
//! Linear is the only source so far; each source adds its own group here.

use crate::keychain::SecretStore;
use crate::linear::{self, ActivityQuery, LinearApi};
use chrono::{DateTime, Utc};
use serde::Serialize;
use timekeeper_core::Project;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Suggestion {
    pub source: Source,
    pub lines: Vec<String>,
    /// Shown to the user, never added to the notes.
    pub notice: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Source {
    Linear,
}

/// Suggestions for `project` from `start` (inclusive) to `end` (exclusive).
pub async fn suggest(
    project: &Project,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    secrets: &impl SecretStore,
    linear_api: &impl LinearApi,
) -> Result<Vec<Suggestion>, String> {
    let mut suggestions = Vec::new();
    if project.linear_enabled {
        let query = ActivityQuery {
            start,
            end,
            team_key: project.linear_team_key.clone(),
        };
        let found = linear::suggest(secrets, linear_api, &query).await?;
        suggestions.push(Suggestion {
            source: Source::Linear,
            lines: found.lines,
            notice: found.notice,
        });
    }
    Ok(suggestions)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::linear::{Activity, IssueActivity, LinearError};
    use std::sync::Mutex;
    use tauri::async_runtime::block_on;

    struct SavedKey;

    impl SecretStore for SavedKey {
        fn get(&self) -> Result<Option<String>, String> {
            Ok(Some("lin_api_saved".into()))
        }
        fn set(&self, _secret: &str) -> Result<(), String> {
            Ok(())
        }
        fn delete(&self) -> Result<(), String> {
            Ok(())
        }
    }

    /// Records each activity query and answers with one commented issue.
    #[derive(Default)]
    struct FakeLinear(Mutex<Vec<ActivityQuery>>);

    impl LinearApi for FakeLinear {
        async fn viewer(&self, _key: &str) -> Result<String, LinearError> {
            unreachable!("suggest never asks for the viewer")
        }
        async fn activity(
            &self,
            _key: &str,
            query: &ActivityQuery,
        ) -> Result<Activity, LinearError> {
            self.0.lock().unwrap().push(query.clone());
            Ok(Activity {
                issues: vec![IssueActivity {
                    identifier: "LABS-1".into(),
                    title: "T".into(),
                    commented: true,
                    ..IssueActivity::default()
                }],
                truncated: false,
            })
        }
    }

    fn project(linear_enabled: bool, team: Option<&str>) -> Project {
        Project {
            id: 1,
            name: "Labs".into(),
            color: None,
            archived: false,
            linear_enabled,
            linear_team_key: team.map(str::to_owned),
            rounding_minutes: None,
            rounding_mode: Default::default(),
        }
    }

    fn range() -> (DateTime<Utc>, DateTime<Utc>) {
        (
            "2026-10-16T04:00:00Z".parse().unwrap(),
            "2026-10-17T04:00:00Z".parse().unwrap(),
        )
    }

    #[test]
    fn linear_lines_for_a_linear_project() {
        let api = FakeLinear::default();
        let (start, end) = range();
        let got = block_on(suggest(
            &project(true, Some("LABS")),
            start,
            end,
            &SavedKey,
            &api,
        ));
        assert_eq!(
            got,
            Ok(vec![Suggestion {
                source: Source::Linear,
                lines: vec!["LABS-1 T — commented".into()],
                notice: None,
            }])
        );
        assert_eq!(
            *api.0.lock().unwrap(),
            [ActivityQuery {
                start,
                end,
                team_key: Some("LABS".into())
            }]
        );
    }

    #[test]
    fn nothing_and_no_calls_without_a_source() {
        let api = FakeLinear::default();
        let (start, end) = range();
        let got = block_on(suggest(&project(false, None), start, end, &SavedKey, &api));
        assert_eq!(got, Ok(vec![]));
        assert!(api.0.lock().unwrap().is_empty());
    }

    #[test]
    fn serializes_for_the_ui() {
        let s = Suggestion {
            source: Source::Linear,
            lines: vec!["x".into()],
            notice: Some("partial".into()),
        };
        assert_eq!(
            serde_json::to_value(&s).unwrap(),
            serde_json::json!({ "source": "linear", "lines": ["x"], "notice": "partial" })
        );
    }
}
