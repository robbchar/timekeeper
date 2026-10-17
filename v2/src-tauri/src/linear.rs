//! Linear's GraphQL API. Only this module makes network calls, and only to `ENDPOINT`.
//! The key reaches Linear and the keychain; the UI only ever gets its last four characters.

use crate::keychain::SecretStore;
use serde::Serialize;
use std::future::Future;
use std::time::Duration;

pub const ENDPOINT: &str = "https://api.linear.app/graphql";
const TIMEOUT: Duration = Duration::from_secs(15);
const NO_KEY: &str = "No Linear API key is saved.";
const EMPTY_KEY: &str = "Paste a Linear API key first.";

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

pub trait LinearApi {
    /// The name of the Linear user `key` belongs to.
    fn viewer(&self, key: &str) -> impl Future<Output = Result<String, LinearError>> + Send;
}

/// A client that failed to build at startup; Linear stays unavailable but the app still runs.
impl<T: LinearApi + Sync> LinearApi for Result<T, String> {
    async fn viewer(&self, key: &str) -> Result<String, LinearError> {
        match self {
            Ok(api) => api.viewer(key).await,
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

    fn viewer_request(&self, key: &str) -> reqwest::Result<reqwest::Request> {
        // Personal API keys go in as-is; `Bearer` is only for OAuth tokens.
        self.http
            .post(&self.endpoint)
            .header(reqwest::header::AUTHORIZATION, key)
            .json(&serde_json::json!({ "query": "{ viewer { name } }" }))
            .build()
    }
}

impl LinearApi for Client {
    async fn viewer(&self, key: &str) -> Result<String, LinearError> {
        // A key that can't be a header value (e.g. a pasted newline) is a bad key, not an outage.
        let request = self
            .viewer_request(key)
            .map_err(|_| LinearError::Unauthorized)?;
        let response = self.http.execute(request).await.map_err(offline)?;
        let status = response.status().as_u16();
        let body = response.text().await.map_err(offline)?;
        parse_viewer(status, &body)
    }
}

/// Keeps the innermost cause (DNS, refused, TLS, timeout), which says more than reqwest's summary.
fn offline(e: reqwest::Error) -> LinearError {
    let mut cause: &dyn std::error::Error = &e;
    while let Some(inner) = cause.source() {
        cause = inner;
    }
    LinearError::Offline(cause.to_string())
}

/// Maps Linear's reply to `{ viewer { name } }` onto the viewer's name or a user-facing error.
fn parse_viewer(status: u16, body: &str) -> Result<String, LinearError> {
    match status {
        401 => return Err(LinearError::Unauthorized),
        429 => return Err(LinearError::RateLimited),
        _ => {}
    }
    let json: serde_json::Value =
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
    match json["data"]["viewer"]["name"].as_str() {
        Some(name) if status == 200 => Ok(name.into()),
        _ => Err(LinearError::Unexpected(status)),
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

    /// Answers every call with `reply` and records the keys it was asked about.
    struct FakeLinear {
        reply: Result<String, LinearError>,
        asked: Mutex<Vec<String>>,
    }

    impl FakeLinear {
        fn replying(reply: Result<&str, LinearError>) -> Self {
            Self {
                reply: reply.map(str::to_owned),
                asked: Mutex::default(),
            }
        }
    }

    impl LinearApi for FakeLinear {
        async fn viewer(&self, key: &str) -> Result<String, LinearError> {
            self.asked.lock().unwrap().push(key.into());
            self.reply.clone()
        }
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
            .viewer_request("lin_api_abc")
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
}
