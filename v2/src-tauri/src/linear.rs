//! Linear's GraphQL API. Only this module makes network calls, and only to `ENDPOINT`.
//! The key reaches Linear and the keychain; the UI only ever gets its last four characters.

use crate::keychain::SecretStore;
use chrono::{DateTime, SecondsFormat, Utc};
use serde::Serialize;
use serde_json::{json, Value};
use std::future::Future;
use std::time::Duration;

pub const ENDPOINT: &str = "https://api.linear.app/graphql";
const TIMEOUT: Duration = Duration::from_secs(15);
const NO_KEY: &str = "No Linear API key is saved.";
const EMPTY_KEY: &str = "Paste a Linear API key first.";
/// Pages fetched before giving up, so a broad day can't run into Linear's rate limit.
/// 20 pages of 10 issues still covers 200 issues.
const MAX_PAGES: usize = 20;
const TRUNCATED: &str = "Linear had more activity than this; some issues are missing.";
const TRUNCATED_ANY_TEAM: &str =
    "Linear had more activity than this. Set a team key in Settings to narrow it.";

#[derive(Debug, Clone, PartialEq)]
pub enum LinearError {
    /// The request never got a reply; holds the underlying reason.
    Offline(String),
    Unauthorized,
    RateLimited,
    Linear(String),
    Unexpected(u16),
    /// The HTTP client couldn't be built at startup (e.g. TLS or proxy setup failed).
    Setup(String),
}

impl std::fmt::Display for LinearError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Offline(reason) => write!(
                f,
                "Couldn't reach Linear ({reason}). Check your internet connection and try again."
            ),
            Self::Unauthorized => f.write_str(
                "Linear didn't accept this key. Check that it's a personal API key that hasn't been revoked.",
            ),
            Self::RateLimited => {
                f.write_str("Linear's rate limit was reached. Try again in a few minutes.")
            }
            Self::Linear(message) => write!(f, "Linear returned an error: {message}"),
            Self::Unexpected(status) => {
                write!(f, "Unexpected response from Linear (HTTP {status}).")
            }
            Self::Setup(reason) => write!(f, "Couldn't set up the connection to Linear: {reason}"),
        }
    }
}

/// The span of one local day, as UTC instants: `start` inclusive, `end` exclusive.
#[derive(Debug, Clone, PartialEq)]
pub struct ActivityQuery {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    /// Only this team's issues; `None` means any team.
    pub team_key: Option<String>,
}

impl ActivityQuery {
    fn contains(&self, at: &str) -> bool {
        DateTime::parse_from_rfc3339(at)
            .is_ok_and(|t| (self.start..self.end).contains(&t.with_timezone(&Utc)))
    }
}

/// What the viewer did to one issue during the queried day.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct IssueActivity {
    pub identifier: String,
    pub title: String,
    pub created: bool,
    pub assigned: bool,
    /// States the viewer moved the issue to, in order.
    pub moved_to: Vec<String>,
    pub commented: bool,
    /// Linked GitHub PRs updated that day, e.g. `timekeeper#104`.
    pub prs: Vec<String>,
}

impl IssueActivity {
    /// Whether the viewer did anything themselves; a PR update alone could be anyone's.
    fn acted(&self) -> bool {
        self.created || self.assigned || !self.moved_to.is_empty() || self.commented
    }

    /// `LABS-852 Product Isolation ADR — moved to In Review; commented`, or `None` if nothing happened.
    pub fn line(&self) -> Option<String> {
        let mut parts = Vec::new();
        if self.created {
            parts.push("created".to_owned());
        }
        if self.assigned {
            parts.push("assigned".to_owned());
        }
        if !self.moved_to.is_empty() {
            parts.push(format!("moved to {}", self.moved_to.join(", then ")));
        }
        if self.commented {
            parts.push("commented".to_owned());
        }
        if !self.prs.is_empty() {
            parts.push(format!("PR {}", self.prs.join(", ")));
        }
        (!parts.is_empty())
            .then(|| format!("{} {} — {}", self.identifier, self.title, parts.join("; ")))
    }
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Activity {
    pub issues: Vec<IssueActivity>,
    /// More matching issues than `MAX_PAGES` holds, or Linear failed partway through.
    pub truncated: bool,
}

pub trait LinearApi {
    /// The name of the Linear user `key` belongs to.
    fn viewer(&self, key: &str) -> impl Future<Output = Result<String, LinearError>> + Send;
    /// The issues the key's user created, was assigned, moved or commented on in `query`'s span.
    fn activity(
        &self,
        key: &str,
        query: &ActivityQuery,
    ) -> impl Future<Output = Result<Activity, LinearError>> + Send;
}

/// A client that failed to build at startup; Linear stays unavailable but the app still runs.
impl<T: LinearApi + Sync> LinearApi for Result<T, String> {
    async fn viewer(&self, key: &str) -> Result<String, LinearError> {
        match self {
            Ok(api) => api.viewer(key).await,
            Err(reason) => Err(LinearError::Setup(reason.clone())),
        }
    }
    async fn activity(&self, key: &str, query: &ActivityQuery) -> Result<Activity, LinearError> {
        match self {
            Ok(api) => api.activity(key, query).await,
            Err(reason) => Err(LinearError::Setup(reason.clone())),
        }
    }
}

pub struct Client {
    http: reqwest::Client,
    endpoint: String,
}

impl Client {
    pub fn new() -> reqwest::Result<Self> {
        Ok(Self {
            http: reqwest::Client::builder().timeout(TIMEOUT).build()?,
            endpoint: ENDPOINT.into(),
        })
    }

    fn request(&self, key: &str, body: &Value) -> reqwest::Result<reqwest::Request> {
        // Personal API keys go in as-is; `Bearer` is only for OAuth tokens.
        self.http
            .post(&self.endpoint)
            .header(reqwest::header::AUTHORIZATION, key)
            .json(body)
            .build()
    }

    /// Sends `body` and returns the reply's status and text.
    async fn post(&self, key: &str, body: &Value) -> Result<(u16, String), LinearError> {
        // A key that can't be a header value (e.g. a pasted newline) is a bad key, not an outage.
        let request = self
            .request(key, body)
            .map_err(|_| LinearError::Unauthorized)?;
        let response = self.http.execute(request).await.map_err(offline)?;
        let status = response.status().as_u16();
        let text = response.text().await.map_err(offline)?;
        Ok((status, text))
    }
}

impl LinearApi for Client {
    async fn viewer(&self, key: &str) -> Result<String, LinearError> {
        let (status, body) = self
            .post(key, &json!({ "query": "{ viewer { name } }" }))
            .await?;
        parse_viewer(status, &body)
    }

    async fn activity(&self, key: &str, query: &ActivityQuery) -> Result<Activity, LinearError> {
        collect_pages(|after| async move {
            let (status, body) = self
                .post(key, &activity_body(query, after.as_deref()))
                .await?;
            parse_activity(status, &body, query)
        })
        .await
    }
}

/// Follows cursors for up to `MAX_PAGES`. A failure after the first page keeps what came back,
/// marked truncated, instead of losing it to one bad reply.
async fn collect_pages<F, Fut>(mut fetch: F) -> Result<Activity, LinearError>
where
    F: FnMut(Option<String>) -> Fut,
    Fut: Future<Output = Result<ActivityPage, LinearError>>,
{
    let mut activity = Activity::default();
    let mut after = None;
    for n in 0..MAX_PAGES {
        let page = match fetch(after.take()).await {
            Ok(page) => page,
            Err(e) if n == 0 => return Err(e),
            Err(_) => break,
        };
        activity.issues.extend(page.issues);
        after = page.next;
        if after.is_none() {
            return Ok(activity);
        }
    }
    activity.truncated = true;
    Ok(activity)
}

// `Issue.history` can't be filtered: cast a wide net, keep only the viewer's day in `parse_activity`.
// 10 issues × 100 history entries is about 4,600 of Linear's 10,000 points per query; 25 was over.
const ACTIVITY_QUERY: &str = "query Activity(
  $filter: IssueFilter!, $comments: CommentFilter!, $attachments: AttachmentFilter!, $after: String
) {
  issues(first: 10, after: $after, filter: $filter, includeArchived: true) {
    pageInfo { hasNextPage endCursor }
    nodes {
      identifier
      title
      createdAt
      creator { isMe }
      assignee { isMe }
      history(first: 100) { nodes { createdAt actor { isMe } toState { name } toAssignee { isMe } } }
      comments(first: 1, filter: $comments) { nodes { id } }
      attachments(first: 10, filter: $attachments) { nodes { url } }
    }
  }
}";

fn activity_body(query: &ActivityQuery, after: Option<&str>) -> Value {
    let at = |t: &DateTime<Utc>| t.to_rfc3339_opts(SecondsFormat::Secs, true);
    let (start, end) = (at(&query.start), at(&query.end));
    let me = json!({ "isMe": { "eq": true } });
    let in_day = json!({ "gte": start, "lt": end });
    let since = json!({ "gte": start });
    let touched = json!({ "or": [
        { "comments": { "some": { "user": me, "createdAt": in_day } } },
        { "creator": me, "createdAt": in_day },
        { "assignee": me, "updatedAt": since },
        { "subscribers": { "some": me }, "updatedAt": since },
    ] });
    let filter = match &query.team_key {
        Some(key) => json!({ "and": [{ "team": { "key": { "eq": key } } }, touched] }),
        None => touched,
    };
    json!({
        "query": ACTIVITY_QUERY,
        "variables": {
            "filter": filter,
            "comments": { "user": me, "createdAt": in_day },
            "attachments": { "updatedAt": in_day },
            "after": after,
        },
    })
}

/// Keeps the innermost cause (DNS, refused, TLS, timeout), which says more than reqwest's summary.
fn offline(e: reqwest::Error) -> LinearError {
    let mut cause: &dyn std::error::Error = &e;
    while let Some(inner) = cause.source() {
        cause = inner;
    }
    LinearError::Offline(cause.to_string())
}

/// The `data` of a successful GraphQL reply, or the user-facing error it stands for.
fn reply_data(status: u16, body: &str) -> Result<Value, LinearError> {
    match status {
        401 => return Err(LinearError::Unauthorized),
        429 => return Err(LinearError::RateLimited),
        _ => {}
    }
    let mut json: Value =
        serde_json::from_str(body).map_err(|_| LinearError::Unexpected(status))?;
    if let Some(error) = json["errors"].get(0) {
        return Err(match error["extensions"]["code"].as_str() {
            Some("AUTHENTICATION_ERROR") => LinearError::Unauthorized,
            Some("RATELIMITED") => LinearError::RateLimited,
            _ => match error["message"].as_str() {
                Some(message) => LinearError::Linear(message.into()),
                None => LinearError::Unexpected(status),
            },
        });
    }
    match json["data"].take() {
        data @ Value::Object(_) if status == 200 => Ok(data),
        _ => Err(LinearError::Unexpected(status)),
    }
}

/// Maps Linear's reply to `{ viewer { name } }` onto the viewer's name or a user-facing error.
fn parse_viewer(status: u16, body: &str) -> Result<String, LinearError> {
    let data = reply_data(status, body)?;
    match data["viewer"]["name"].as_str() {
        Some(name) => Ok(name.into()),
        None => Err(LinearError::Unexpected(status)),
    }
}

struct ActivityPage {
    issues: Vec<IssueActivity>,
    /// The cursor for the next page, if there is one.
    next: Option<String>,
}

/// Keeps, per issue, only what the viewer did inside `query`'s span; drops issues with nothing.
fn parse_activity(
    status: u16,
    body: &str,
    query: &ActivityQuery,
) -> Result<ActivityPage, LinearError> {
    let data = reply_data(status, body)?;
    let issues = &data["issues"];
    let Some(nodes) = issues["nodes"].as_array() else {
        return Err(LinearError::Unexpected(status));
    };
    let is_me = |user: &Value| user["isMe"].as_bool() == Some(true);
    let str_of = |v: &Value| v.as_str().unwrap_or_default().to_owned();
    let mut found = Vec::new();
    for node in nodes {
        let mut history: Vec<&Value> = node["history"]["nodes"]
            .as_array()
            .map(|h| {
                h.iter()
                    .filter(|e| query.contains(&str_of(&e["createdAt"])))
                    .collect()
            })
            .unwrap_or_default();
        history.sort_by_key(|e| str_of(&e["createdAt"]));
        let mut issue = IssueActivity {
            identifier: str_of(&node["identifier"]),
            title: str_of(&node["title"]),
            created: is_me(&node["creator"]) && query.contains(&str_of(&node["createdAt"])),
            commented: node["comments"]["nodes"]
                .as_array()
                .is_some_and(|c| !c.is_empty()),
            prs: node["attachments"]["nodes"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|a| pr_label(a["url"].as_str()?))
                .collect(),
            ..IssueActivity::default()
        };
        for entry in history {
            issue.assigned |= is_me(&entry["toAssignee"]);
            if let (true, Some(state)) = (is_me(&entry["actor"]), entry["toState"]["name"].as_str())
            {
                if issue.moved_to.last().map(String::as_str) != Some(state) {
                    issue.moved_to.push(state.to_owned());
                }
            }
        }
        // A PR update counts on the viewer's own issue; elsewhere it only adds to their activity.
        if issue.acted() || (is_me(&node["assignee"]) && !issue.prs.is_empty()) {
            found.push(issue);
        }
    }
    let next = match issues["pageInfo"]["hasNextPage"].as_bool() {
        Some(true) => issues["pageInfo"]["endCursor"].as_str().map(str::to_owned),
        _ => None,
    };
    Ok(ActivityPage {
        issues: found,
        next,
    })
}

/// `repo#123` for a GitHub pull request URL; other attachments aren't PRs.
fn pr_label(url: &str) -> Option<String> {
    let path = url.strip_prefix("https://github.com/")?;
    let segments: Vec<&str> = path.split('/').collect();
    match segments.as_slice() {
        [_owner, repo, "pull", number, ..] if number.parse::<u64>().is_ok() => {
            Some(format!("{repo}#{number}"))
        }
        _ => None,
    }
}

#[derive(Debug, Serialize, PartialEq)]
pub struct KeyStatus {
    pub hint: String,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Connected {
    pub hint: String,
    pub viewer: String,
}

/// The key's last four characters: the only part of it the UI ever sees.
fn hint(key: &str) -> String {
    let chars: Vec<char> = key.chars().collect();
    chars[chars.len().saturating_sub(4)..].iter().collect()
}

pub fn key_status(secrets: &impl SecretStore) -> Result<Option<KeyStatus>, String> {
    Ok(secrets.get()?.map(|key| KeyStatus { hint: hint(&key) }))
}

/// Stores `key` only once Linear accepts it, so a typo never gets saved.
pub async fn save_key(
    secrets: &impl SecretStore,
    api: &impl LinearApi,
    key: &str,
) -> Result<Connected, String> {
    let key = key.trim();
    if key.is_empty() {
        return Err(EMPTY_KEY.into());
    }
    // Before Linear sees the key, so it never leaves the machine when it can't be kept.
    secrets.writable()?;
    let viewer = api.viewer(key).await.map_err(|e| e.to_string())?;
    secrets.set(key)?;
    Ok(Connected {
        hint: hint(key),
        viewer,
    })
}

#[derive(Debug, PartialEq)]
pub struct Lines {
    pub lines: Vec<String>,
    /// For the user, not the notes: why the lines may be incomplete.
    pub notice: Option<String>,
}

/// One line per issue the saved key's user worked on in `query`'s span, for appending to notes.
pub async fn suggest(
    secrets: &impl SecretStore,
    api: &impl LinearApi,
    query: &ActivityQuery,
) -> Result<Lines, String> {
    let key = secrets.get()?.ok_or(NO_KEY)?;
    let activity = api.activity(&key, query).await.map_err(|e| e.to_string())?;
    let notice = activity.truncated.then(|| {
        if query.team_key.is_some() {
            TRUNCATED
        } else {
            TRUNCATED_ANY_TEAM
        }
        .to_owned()
    });
    Ok(Lines {
        lines: activity
            .issues
            .iter()
            .filter_map(IssueActivity::line)
            .collect(),
        notice,
    })
}

/// The name of the user the saved key belongs to.
pub async fn test_connection(
    secrets: &impl SecretStore,
    api: &impl LinearApi,
) -> Result<String, String> {
    let key = secrets.get()?.ok_or(NO_KEY)?;
    api.viewer(&key).await.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::sync::Mutex;
    use tauri::async_runtime::block_on;

    #[derive(Default)]
    struct FakeKeychain(Mutex<Option<String>>);

    impl SecretStore for FakeKeychain {
        fn get(&self) -> Result<Option<String>, String> {
            Ok(self.0.lock().unwrap().clone())
        }
        fn set(&self, secret: &str) -> Result<(), String> {
            *self.0.lock().unwrap() = Some(secret.into());
            Ok(())
        }
        fn delete(&self) -> Result<(), String> {
            *self.0.lock().unwrap() = None;
            Ok(())
        }
    }

    /// Answers every call with `reply` / `activity` and records the keys it was asked about.
    struct FakeLinear {
        reply: Result<String, LinearError>,
        activity: Result<Activity, LinearError>,
        asked: Mutex<Vec<String>>,
    }

    impl FakeLinear {
        fn replying(reply: Result<&str, LinearError>) -> Self {
            Self {
                reply: reply.map(str::to_owned),
                activity: Ok(Activity::default()),
                asked: Mutex::default(),
            }
        }

        fn with_activity(activity: Result<Activity, LinearError>) -> Self {
            Self {
                activity,
                ..Self::replying(Ok("Robb"))
            }
        }
    }

    impl LinearApi for FakeLinear {
        async fn viewer(&self, key: &str) -> Result<String, LinearError> {
            self.asked.lock().unwrap().push(key.into());
            self.reply.clone()
        }
        async fn activity(
            &self,
            key: &str,
            _query: &ActivityQuery,
        ) -> Result<Activity, LinearError> {
            self.asked.lock().unwrap().push(key.into());
            self.activity.clone()
        }
    }

    /// 2026-10-16 in New York (UTC-4).
    fn day() -> ActivityQuery {
        ActivityQuery {
            start: "2026-10-16T04:00:00Z".parse().unwrap(),
            end: "2026-10-17T04:00:00Z".parse().unwrap(),
            team_key: None,
        }
    }

    fn issue_node(extra: Value) -> Value {
        let mut node = json!({
            "identifier": "LABS-852",
            "title": "Product Isolation ADR",
            "createdAt": "2026-09-01T12:00:00.000Z",
            "creator": { "isMe": false },
            "history": { "nodes": [] },
            "comments": { "nodes": [] },
            "attachments": { "nodes": [] },
        });
        for (k, v) in extra.as_object().unwrap() {
            node[k] = v.clone();
        }
        node
    }

    fn page(nodes: Vec<Value>, next: Option<&str>) -> String {
        json!({ "data": { "issues": {
            "pageInfo": { "hasNextPage": next.is_some(), "endCursor": next },
            "nodes": nodes,
        } } })
        .to_string()
    }

    fn parse(nodes: Vec<Value>) -> Vec<IssueActivity> {
        parse_activity(200, &page(nodes, None), &day())
            .unwrap()
            .issues
    }

    // Probed from the live API with a fake key.
    const UNAUTHORIZED_BODY: &str = r#"{"errors":[{"message":"Authentication required, not authenticated","extensions":{"type":"authentication error","code":"AUTHENTICATION_ERROR","statusCode":401,"userError":true,"userPresentableMessage":"You need to authenticate to access this operation.","meta":{},"http":{"status":401}}}]}"#;

    #[test]
    fn parse_viewer_reads_the_name() {
        let body = r#"{"data":{"viewer":{"name":"Robb Charnock"}}}"#;
        assert_eq!(parse_viewer(200, body), Ok("Robb Charnock".into()));
    }

    #[test]
    fn parse_viewer_real_unauthorized_response() {
        assert_eq!(
            parse_viewer(401, UNAUTHORIZED_BODY),
            Err(LinearError::Unauthorized)
        );
    }

    #[test]
    fn parse_viewer_authentication_error_code_without_401() {
        let body =
            r#"{"errors":[{"message":"nope","extensions":{"code":"AUTHENTICATION_ERROR"}}]}"#;
        assert_eq!(parse_viewer(400, body), Err(LinearError::Unauthorized));
    }

    #[test]
    fn parse_viewer_rate_limited() {
        let body =
            r#"{"errors":[{"message":"Rate limit exceeded","extensions":{"code":"RATELIMITED"}}]}"#;
        assert_eq!(parse_viewer(400, body), Err(LinearError::RateLimited));
    }

    #[test]
    fn parse_viewer_http_429_is_rate_limited() {
        assert_eq!(
            parse_viewer(429, "Too Many Requests"),
            Err(LinearError::RateLimited)
        );
    }

    #[test]
    fn parse_viewer_other_graphql_error_keeps_the_message() {
        let body = r#"{"errors":[{"message":"Something broke","extensions":{"code":"INTERNAL"}}]}"#;
        assert_eq!(
            parse_viewer(200, body),
            Err(LinearError::Linear("Something broke".into()))
        );
    }

    #[test]
    fn parse_viewer_html_is_unexpected() {
        assert_eq!(
            parse_viewer(200, "<html>Sign in to the Wi-Fi</html>"),
            Err(LinearError::Unexpected(200))
        );
        assert_eq!(
            parse_viewer(502, "Bad gateway"),
            Err(LinearError::Unexpected(502))
        );
    }

    #[test]
    fn parse_viewer_missing_name_is_unexpected() {
        assert_eq!(
            parse_viewer(200, r#"{"data":{"viewer":null}}"#),
            Err(LinearError::Unexpected(200))
        );
    }

    #[test]
    fn errors_read_as_the_spec_says() {
        assert_eq!(
            LinearError::Offline("dns error".into()).to_string(),
            "Couldn't reach Linear (dns error). Check your internet connection and try again."
        );
        assert_eq!(
            LinearError::Unauthorized.to_string(),
            "Linear didn't accept this key. Check that it's a personal API key that hasn't been revoked."
        );
        assert_eq!(
            LinearError::RateLimited.to_string(),
            "Linear's rate limit was reached. Try again in a few minutes."
        );
        assert_eq!(
            LinearError::Linear("x".into()).to_string(),
            "Linear returned an error: x"
        );
        assert_eq!(
            LinearError::Unexpected(500).to_string(),
            "Unexpected response from Linear (HTTP 500)."
        );
    }

    #[test]
    fn request_sends_the_raw_key_to_linear() {
        let request = Client::new()
            .unwrap()
            .request("lin_api_abc", &json!({ "query": "{ viewer { name } }" }))
            .unwrap();
        assert_eq!(request.method(), reqwest::Method::POST);
        assert_eq!(request.url().as_str(), ENDPOINT);
        assert_eq!(
            request.headers()[reqwest::header::AUTHORIZATION],
            "lin_api_abc"
        );
    }

    #[test]
    fn viewer_rejects_a_key_that_cant_be_a_header() {
        let client = Client::new().unwrap();
        assert_eq!(
            block_on(client.viewer("lin_api\nabc")),
            Err(LinearError::Unauthorized)
        );
    }

    #[test]
    fn viewer_unreachable_is_offline() {
        // Bind then drop, so the port is closed and nothing is listening.
        let port = std::net::TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port();
        // No proxy: a system or env proxy would answer for 127.0.0.1 instead.
        let client = Client {
            http: reqwest::Client::builder()
                .no_proxy()
                .timeout(TIMEOUT)
                .build()
                .unwrap(),
            endpoint: format!("http://127.0.0.1:{port}/graphql"),
        };
        let err = block_on(client.viewer("k")).unwrap_err();
        assert!(
            matches!(&err, LinearError::Offline(reason) if !reason.is_empty()),
            "{err:?}"
        );
    }

    #[test]
    fn a_client_that_failed_to_build_reports_it_instead_of_calling() {
        let broken: Result<FakeLinear, String> = Err("no TLS".into());
        assert_eq!(
            block_on(broken.viewer("k")),
            Err(LinearError::Setup("no TLS".into()))
        );
        assert_eq!(
            LinearError::Setup("no TLS".into()).to_string(),
            "Couldn't set up the connection to Linear: no TLS"
        );
    }

    #[test]
    fn a_built_client_answers_as_usual() {
        let ready: Result<FakeLinear, String> = Ok(FakeLinear::replying(Ok("Robb")));
        assert_eq!(block_on(ready.viewer("k")), Ok("Robb".into()));
    }

    #[test]
    fn hint_is_the_last_four_characters() {
        assert_eq!(hint("lin_api_abcd1234"), "1234");
    }

    #[test]
    fn hint_of_a_short_key() {
        assert_eq!(hint("ab"), "ab");
        assert_eq!(hint(""), "");
    }

    #[test]
    fn save_key_stores_a_key_linear_accepts() {
        let secrets = FakeKeychain::default();
        let api = FakeLinear::replying(Ok("Robb"));
        let connected = block_on(save_key(&secrets, &api, "  lin_api_abcd1234\n")).unwrap();
        assert_eq!(
            connected,
            Connected {
                hint: "1234".into(),
                viewer: "Robb".into()
            }
        );
        assert_eq!(
            secrets.get().unwrap().as_deref(),
            Some("lin_api_abcd1234"),
            "trimmed"
        );
        assert_eq!(*api.asked.lock().unwrap(), ["lin_api_abcd1234"]);
    }

    #[test]
    fn save_key_stores_nothing_when_linear_refuses() {
        let secrets = FakeKeychain::default();
        for reply in [LinearError::Unauthorized, LinearError::Offline("x".into())] {
            let api = FakeLinear::replying(Err(reply.clone()));
            let err = block_on(save_key(&secrets, &api, "lin_api_typo")).unwrap_err();
            assert_eq!(err, reply.to_string());
            assert_eq!(secrets.get().unwrap(), None);
        }
    }

    /// A store that can't keep anything, like `Keychain` outside Windows.
    struct ReadOnlyKeychain;

    impl SecretStore for ReadOnlyKeychain {
        fn get(&self) -> Result<Option<String>, String> {
            Ok(None)
        }
        fn set(&self, _secret: &str) -> Result<(), String> {
            unreachable!("save_key checks writable() first")
        }
        fn delete(&self) -> Result<(), String> {
            Ok(())
        }
        fn writable(&self) -> Result<(), String> {
            Err("read-only".into())
        }
    }

    #[test]
    fn save_key_never_sends_a_key_it_cant_keep() {
        let api = FakeLinear::replying(Ok("Robb"));
        let err = block_on(save_key(&ReadOnlyKeychain, &api, "lin_api_abcd1234")).unwrap_err();
        assert_eq!(err, "read-only");
        assert!(api.asked.lock().unwrap().is_empty());
    }

    #[test]
    fn save_key_refuses_an_empty_key_without_asking_linear() {
        let secrets = FakeKeychain::default();
        let api = FakeLinear::replying(Ok("Robb"));
        let err = block_on(save_key(&secrets, &api, "   ")).unwrap_err();
        assert_eq!(err, "Paste a Linear API key first.");
        assert!(api.asked.lock().unwrap().is_empty());
    }

    #[test]
    fn key_status_shows_only_the_hint() {
        let secrets = FakeKeychain::default();
        assert_eq!(key_status(&secrets), Ok(None));
        secrets.set("lin_api_abcd1234").unwrap();
        assert_eq!(
            key_status(&secrets),
            Ok(Some(KeyStatus {
                hint: "1234".into()
            }))
        );
    }

    #[test]
    fn test_connection_uses_the_saved_key() {
        let secrets = FakeKeychain::default();
        secrets.set("lin_api_saved").unwrap();
        let api = FakeLinear::replying(Ok("Robb"));
        assert_eq!(block_on(test_connection(&secrets, &api)), Ok("Robb".into()));
        assert_eq!(*api.asked.lock().unwrap(), ["lin_api_saved"]);
    }

    #[test]
    fn test_connection_without_a_key() {
        let api = FakeLinear::replying(Ok("Robb"));
        assert_eq!(
            block_on(test_connection(&FakeKeychain::default(), &api)),
            Err("No Linear API key is saved.".into())
        );
        assert!(api.asked.lock().unwrap().is_empty());
    }

    #[test]
    fn line_reads_like_the_spec_example() {
        let issue = IssueActivity {
            identifier: "LABS-852".into(),
            title: "Product Isolation ADR".into(),
            moved_to: vec!["In Review".into()],
            commented: true,
            ..IssueActivity::default()
        };
        assert_eq!(
            issue.line().as_deref(),
            Some("LABS-852 Product Isolation ADR — moved to In Review; commented")
        );
    }

    #[test]
    fn line_lists_every_kind_of_activity_in_order() {
        let issue = IssueActivity {
            identifier: "LABS-1".into(),
            title: "T".into(),
            created: true,
            assigned: true,
            moved_to: vec!["In Progress".into(), "In Review".into()],
            commented: true,
            prs: vec!["app#12".into(), "api#3".into()],
        };
        assert_eq!(
            issue.line().as_deref(),
            Some("LABS-1 T — created; assigned; moved to In Progress, then In Review; commented; PR app#12, api#3")
        );
    }

    #[test]
    fn line_is_none_without_activity() {
        assert_eq!(IssueActivity::default().line(), None);
    }

    #[test]
    fn parse_activity_keeps_my_state_changes_inside_the_day() {
        let history = json!({ "history": { "nodes": [
            // Newest first, as Linear may return them.
            { "createdAt": "2026-10-17T05:00:00.000Z", "actor": { "isMe": true }, "toState": { "name": "Done" } },
            { "createdAt": "2026-10-16T20:00:00.000Z", "actor": { "isMe": true }, "toState": { "name": "In Review" } },
            { "createdAt": "2026-10-16T18:00:00.000Z", "actor": { "isMe": false }, "toState": { "name": "Blocked" } },
            { "createdAt": "2026-10-16T14:00:00.000Z", "actor": { "isMe": true }, "toState": { "name": "In Progress" } },
            { "createdAt": "2026-10-16T03:59:59.000Z", "actor": { "isMe": true }, "toState": { "name": "Todo" } },
        ] } });
        let issues = parse(vec![issue_node(history)]);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].moved_to, ["In Progress", "In Review"]);
        assert!(!issues[0].created && !issues[0].assigned && !issues[0].commented);
    }

    #[test]
    fn parse_activity_collapses_repeated_moves_to_one_state() {
        let history = json!({ "history": { "nodes": [
            { "createdAt": "2026-10-16T14:00:00Z", "actor": { "isMe": true }, "toState": { "name": "In Progress" } },
            { "createdAt": "2026-10-16T15:00:00Z", "actor": { "isMe": true }, "toState": null },
            { "createdAt": "2026-10-16T16:00:00Z", "actor": { "isMe": true }, "toState": { "name": "In Progress" } },
        ] } });
        assert_eq!(
            parse(vec![issue_node(history)])[0].moved_to,
            ["In Progress"]
        );
    }

    #[test]
    fn parse_activity_assigned_to_me_that_day_by_anyone() {
        let history = json!({ "history": { "nodes": [
            { "createdAt": "2026-10-16T14:00:00Z", "actor": { "isMe": false }, "toAssignee": { "isMe": true } },
        ] } });
        let issues = parse(vec![issue_node(history)]);
        assert!(issues[0].assigned);
        assert!(issues[0].moved_to.is_empty());
    }

    #[test]
    fn parse_activity_created_only_counts_inside_the_day() {
        let today = json!({ "creator": { "isMe": true }, "createdAt": "2026-10-16T15:00:00Z" });
        let yesterday = json!({ "creator": { "isMe": true }, "createdAt": "2026-10-15T15:00:00Z" });
        let issues = parse(vec![issue_node(today), issue_node(yesterday)]);
        assert_eq!(issues.len(), 1);
        assert!(issues[0].created);
    }

    #[test]
    fn parse_activity_comments_and_prs_come_prefiltered() {
        let extra = json!({
            "comments": { "nodes": [{ "id": "c1" }] },
            "attachments": { "nodes": [
                { "url": "https://github.com/robbchar/timekeeper/pull/104" },
                { "url": "https://www.figma.com/file/abc" },
            ] },
        });
        let issues = parse(vec![issue_node(extra)]);
        assert!(issues[0].commented);
        assert_eq!(issues[0].prs, ["timekeeper#104"]);
    }

    #[test]
    fn parse_activity_drops_issues_with_nothing_from_me_that_day() {
        let other = json!({ "history": { "nodes": [
            { "createdAt": "2026-10-16T14:00:00Z", "actor": { "isMe": false }, "toState": { "name": "Done" } },
        ] } });
        assert!(parse(vec![issue_node(other), issue_node(json!({}))]).is_empty());
    }

    #[test]
    fn parse_activity_counts_a_pr_alone_only_on_my_issues() {
        let pr = json!({ "url": "https://github.com/o/app/pull/12" });
        let followed = json!({ "attachments": { "nodes": [pr] }, "assignee": { "isMe": false } });
        let mine = json!({
            "identifier": "LABS-2",
            "attachments": { "nodes": [pr] },
            "assignee": { "isMe": true },
        });
        let issues = parse(vec![issue_node(followed), issue_node(mine)]);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].identifier, "LABS-2");
        assert_eq!(issues[0].prs, ["app#12"]);
    }

    #[test]
    fn parse_activity_reads_the_next_cursor() {
        let body = page(vec![], Some("cursor-1"));
        let next = parse_activity(200, &body, &day()).unwrap().next;
        assert_eq!(next.as_deref(), Some("cursor-1"));
        let last = parse_activity(200, &page(vec![], None), &day())
            .unwrap()
            .next;
        assert_eq!(last, None);
    }

    #[test]
    fn parse_activity_shares_viewer_error_handling() {
        assert_eq!(
            parse_activity(401, UNAUTHORIZED_BODY, &day()).err(),
            Some(LinearError::Unauthorized)
        );
        assert_eq!(
            parse_activity(429, "", &day()).err(),
            Some(LinearError::RateLimited)
        );
        assert_eq!(
            parse_activity(200, r#"{"data":{"issues":null}}"#, &day()).err(),
            Some(LinearError::Unexpected(200))
        );
    }

    #[test]
    fn pr_label_only_for_github_pull_requests() {
        assert_eq!(
            pr_label("https://github.com/robbchar/timekeeper/pull/104").as_deref(),
            Some("timekeeper#104")
        );
        assert_eq!(
            pr_label("https://github.com/o/r/pull/7/files").as_deref(),
            Some("r#7")
        );
        assert_eq!(pr_label("https://github.com/o/r/issues/7"), None);
        assert_eq!(pr_label("https://github.com/o/r/pull/new"), None);
        assert_eq!(pr_label("https://gitlab.com/o/r/-/merge_requests/7"), None);
    }

    #[test]
    fn activity_body_bounds_the_day_in_utc() {
        let body = activity_body(&day(), None);
        let vars = &body["variables"];
        let in_day = json!({ "gte": "2026-10-16T04:00:00Z", "lt": "2026-10-17T04:00:00Z" });
        assert_eq!(vars["comments"]["createdAt"], in_day);
        assert_eq!(vars["comments"]["user"], json!({ "isMe": { "eq": true } }));
        assert_eq!(vars["attachments"]["updatedAt"], in_day);
        assert_eq!(
            vars["filter"]["or"][0]["comments"]["some"]["createdAt"],
            in_day
        );
        assert_eq!(vars["after"], Value::Null);
        assert!(body["query"]
            .as_str()
            .unwrap()
            .starts_with("query Activity("));
    }

    #[test]
    fn activity_body_filters_by_team_and_pages_on() {
        let query = ActivityQuery {
            team_key: Some("LABS".into()),
            ..day()
        };
        let body = activity_body(&query, Some("cursor-1"));
        let filter = &body["variables"]["filter"];
        assert_eq!(
            filter["and"][0],
            json!({ "team": { "key": { "eq": "LABS" } } })
        );
        assert!(filter["and"][1]["or"].is_array());
        assert_eq!(body["variables"]["after"], "cursor-1");
    }

    type Tokens = std::iter::Peekable<std::vec::IntoIter<String>>;

    /// Linear's documented score, in tenths of a point: a scalar is 1, an object 10, and a
    /// connection's children count `first` times. Every connection must pass `first`.
    fn complexity_tenths(query: &str) -> u64 {
        let mut tokens = Vec::new();
        let mut word = String::new();
        for c in query.chars() {
            if c.is_alphanumeric() || c == '_' || c == '$' {
                word.push(c);
                continue;
            }
            if !word.is_empty() {
                tokens.push(std::mem::take(&mut word));
            }
            if "{}():".contains(c) {
                tokens.push(c.into());
            }
        }
        let mut tokens = tokens.into_iter().peekable();
        while tokens.next_if(|t| t != "{").is_some() {}
        tokens.next();
        selection(&mut tokens, false)
    }

    /// `paged`: the enclosing field passed a literal `first`.
    fn selection(tokens: &mut Tokens, paged: bool) -> u64 {
        let mut total = 0;
        while let Some(field) = tokens.next() {
            if field == "}" {
                break;
            }
            // Unpaged, Linear charges its default page size; this scorer would charge 1.
            assert!(
                paged || (field != "nodes" && field != "edges"),
                "a connection has no literal `first`"
            );
            let mut first = None;
            if tokens.next_if_eq("(").is_some() {
                while let Some(t) = tokens.next() {
                    if t == ")" {
                        break;
                    }
                    if t == "first" {
                        tokens.next_if_eq(":");
                        first = tokens.next().and_then(|n| n.parse::<u64>().ok());
                    }
                }
            }
            total += match (tokens.next_if_eq("{").is_some(), first) {
                (false, _) => 1,
                (true, Some(n)) => n * selection(tokens, true),
                (true, None) => 10 + selection(tokens, false),
            };
        }
        total
    }

    #[test]
    fn complexity_matches_linears_documented_example() {
        let example =
            r#"{ user(id: "x") { createdIssues(first: 10) { nodes { id title createdAt } } } }"#;
        assert_eq!(complexity_tenths(example), 140);
    }

    #[test]
    #[should_panic(expected = "no literal `first`")]
    fn complexity_refuses_a_connection_without_first() {
        complexity_tenths("{ issues { nodes { id } } }");
    }

    #[test]
    fn activity_query_fits_linears_per_query_limit() {
        // Linear always rejects a single query over 10,000 points; compare in tenths, unrounded.
        let tenths = complexity_tenths(ACTIVITY_QUERY);
        assert!(
            tenths <= 100_000,
            "ACTIVITY_QUERY costs {tenths} tenths of a point"
        );
    }

    fn issue_page(id: &str, next: Option<&str>) -> ActivityPage {
        ActivityPage {
            issues: vec![IssueActivity {
                identifier: id.into(),
                ..Default::default()
            }],
            next: next.map(Into::into),
        }
    }

    #[test]
    fn collect_pages_keeps_earlier_pages_when_a_later_one_fails() {
        let mut calls = 0;
        let activity = block_on(collect_pages(|_| {
            calls += 1;
            let reply = match calls {
                1 => Ok(issue_page("A-1", Some("c1"))),
                _ => Err(LinearError::RateLimited),
            };
            async move { reply }
        }))
        .unwrap();
        assert_eq!(activity.issues[0].identifier, "A-1");
        assert!(activity.truncated);
    }

    #[test]
    fn collect_pages_reports_a_first_page_failure() {
        let result = block_on(collect_pages(|_| async { Err(LinearError::RateLimited) }));
        assert_eq!(result, Err(LinearError::RateLimited));
    }

    #[test]
    fn collect_pages_follows_cursors_and_stops_at_max_pages() {
        let mut cursors = Vec::new();
        let activity = block_on(collect_pages(|after| {
            cursors.push(after);
            let n = cursors.len();
            async move { Ok(issue_page(&format!("A-{n}"), Some("more"))) }
        }))
        .unwrap();
        assert_eq!(cursors.len(), MAX_PAGES);
        assert_eq!(cursors[0], None);
        assert_eq!(cursors[1].as_deref(), Some("more"));
        assert_eq!(activity.issues.len(), MAX_PAGES);
        assert!(activity.truncated);
    }

    #[test]
    fn suggest_turns_activity_into_lines() {
        let secrets = FakeKeychain::default();
        secrets.set("lin_api_saved").unwrap();
        let issue = IssueActivity {
            identifier: "LABS-1".into(),
            title: "T".into(),
            commented: true,
            ..IssueActivity::default()
        };
        let api = FakeLinear::with_activity(Ok(Activity {
            issues: vec![issue],
            truncated: true,
        }));
        assert_eq!(
            block_on(suggest(&secrets, &api, &day())),
            Ok(Lines {
                lines: vec!["LABS-1 T — commented".into()],
                notice: Some(
                    "Linear had more activity than this. Set a team key in Settings to narrow it."
                        .into()
                ),
            })
        );
        assert_eq!(*api.asked.lock().unwrap(), ["lin_api_saved"]);
    }

    #[test]
    fn suggest_keeps_the_truncation_notice_out_of_the_lines() {
        let secrets = FakeKeychain::default();
        secrets.set("k").unwrap();
        let api = FakeLinear::with_activity(Ok(Activity {
            issues: vec![],
            truncated: true,
        }));
        let query = ActivityQuery {
            team_key: Some("LABS".into()),
            ..day()
        };
        assert_eq!(
            block_on(suggest(&secrets, &api, &query)),
            Ok(Lines {
                lines: vec![],
                notice: Some("Linear had more activity than this; some issues are missing.".into()),
            })
        );
        let complete = FakeLinear::with_activity(Ok(Activity::default()));
        assert_eq!(
            block_on(suggest(&secrets, &complete, &query)).map(|l| l.notice),
            Ok(None)
        );
    }

    #[test]
    fn suggest_without_a_key_asks_nothing() {
        let api = FakeLinear::with_activity(Ok(Activity::default()));
        assert_eq!(
            block_on(suggest(&FakeKeychain::default(), &api, &day())),
            Err("No Linear API key is saved.".into())
        );
        assert!(api.asked.lock().unwrap().is_empty());
    }

    #[test]
    fn suggest_reports_linear_errors_for_the_ui() {
        let secrets = FakeKeychain::default();
        secrets.set("k").unwrap();
        for e in [
            LinearError::RateLimited,
            LinearError::Offline("dns error".into()),
        ] {
            let api = FakeLinear::with_activity(Err(e.clone()));
            assert_eq!(
                block_on(suggest(&secrets, &api, &day())),
                Err(e.to_string())
            );
        }
    }

    #[test]
    fn a_client_that_failed_to_build_reports_it_for_activity_too() {
        let broken: Result<FakeLinear, String> = Err("no TLS".into());
        assert_eq!(
            block_on(broken.activity("k", &day())),
            Err(LinearError::Setup("no TLS".into()))
        );
    }
}
