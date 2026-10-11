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
npm test -- --run               # UI: Vitest + jsdom, api.ts mocked
npm run build                   # also the only TypeScript typecheck
```

Vitest defaults to watch mode, so always pass `--run`. There is no lint script.

To check the import against real data, point `TK_V1_DB` at a **copy** of a v1 database. The test
`imports_real_v1_database_when_provided` is skipped without it:

```bash
TK_V1_DB=/path/to/copy/of/timekeeper.db cargo test -p timekeeper-core
```
