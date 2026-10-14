# TimeKeeper v2

The Tauri 2 rewrite of TimeKeeper: a Rust `core` crate, a thin Tauri shell and a React/TypeScript UI,
with SQLite for storage. It is a separate app from v1 at the repo root; v1's rules don't apply here.

Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing the data model, the commands or anything that
crosses the Rust↔UI boundary. Run instructions are in the [README](README.md).

## Package manager

npm (`package-lock.json` is committed). There are no path aliases.

## Hard rules

- **Only `src/api.ts` imports `@tauri-apps/*`.** Components call `api`, never `invoke`.
- **`core` never reads local time.** Take `now: DateTime<Utc>` and `today: NaiveDate` as parameters;
  the shell supplies them.
- **Store instants as UTC RFC 3339 and days as local `YYYY-MM-DD`.**
- **Never edit an applied migration.** Append a new one.
- **Data rules belong in `core`.** Commands in `src-tauri/src/lib.rs` stay thin.
- **Never commit a `TK_V1_DB` path or any real v1 data.**

## Adding an operation

Four places, in order. Commands are called by string name, so skipping step 2's registration or the
mock still typechecks and passes UI tests; it fails at runtime (in the app, or in `npm run dev`):

1. `core/src/lib.rs`: a `Store` method, plus a test in `core/src/tests.rs`
2. `src-tauri/src/lib.rs`: a `#[tauri::command]` that calls it, registered in `generate_handler!`
3. `src/api.ts`: a typed wrapper (camelCase args; Tauri maps them to snake_case)
4. `src/mock.ts`: a `case` for the command, or it throws `mock: unknown command`

App commands need no entry in `src-tauri/capabilities/default.json`. Plugin APIs do.

## Adding a migration

Append a SQL string to `MIGRATIONS` in `core/src/schema.rs`. `CURRENT_VERSION` follows from the list
length. `migrations_are_idempotent` in `core/src/tests.rs` covers re-running.

## Adding a UI setting

Add the key to `UI_SETTINGS` in `src-tauri/src/lib.rs`, then handle its default in the UI.
`set_setting` rejects keys that aren't listed.

## Testing

From `v2/`:

```bash
cargo test -p timekeeper-core   # core: schema, timer, totals, import
cargo test -p timekeeper        # shell: debug overrides, login entry (needs dist/)
npm test                        # UI: Vitest + jsdom, api.ts mocked; runs once
npm run lint                    # ESLint, type-checked rules
npm run format:check            # Prettier; `npm run format` fixes
npm run typecheck               # src/ and scripts/; `npm run build` checks src/ only
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
```

`npm test` already passes `--run`; calling `npx vitest` directly needs it too, or it starts watch
mode. UI tests run in `America/New_York`, so date tests cross a DST change on every machine.

Promise-returning calls must be awaited, `.catch`-ed or `void`-ed (lint enforces it). UI failures
go to `App`'s error banner through the components' `onError` prop; so do uncaught errors and
unhandled rejections, via window listeners in `App`. Render errors are caught by `ErrorBoundary` in
`main.tsx`, which shows the error, its stacks and a Reload button.

CI (`.github/workflows/v2.yml`) runs all of the above on PRs touching `v2/`, plus `cargo check` and
core tests on Windows. Clippy warnings fail the build. Clippy needs `dist/` to exist, so run
`npm run build` first. The Rust version is pinned in `rust-toolchain.toml`; bump it deliberately.

On Windows, `npm run smoke:windows` builds a debug exe and runs it against temp data dirs: first-run
import (once, v1 untouched), single instance, and crash recovery with a hard kill. It takes about
20 seconds after the build. Quit any running v2 first, or single instance hands every launch to it.
It isn't in CI. The tray, badge, window, copy buttons and duration editor still need a manual look. The
[debug overrides](ARCHITECTURE.md#debug-overrides) it relies on are debug-only.

To check the import against real data, point `TK_V1_DB` at a **copy** of a v1 database. The test
`imports_real_v1_database_when_provided` is skipped without it:

```bash
TK_V1_DB=/path/to/copy/of/timekeeper.db cargo test -p timekeeper-core
```
