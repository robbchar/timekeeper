// Windows smoke checks against a debug build: first-run import, single instance, crash recovery.
// Each scenario runs the real exe against its own temp data dir via the TK_* debug overrides.
// Usage: npm run smoke:windows

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";

const EXE = resolve(process.env.CARGO_TARGET_DIR ?? "target", "debug", "timekeeper.exe");
const STALE_AFTER_SECS = 5;

type Row = Record<string, unknown>;

interface App {
  child: ChildProcess;
  /** Resolves with the exit code, or null if it never started. */
  exited: Promise<number | null>;
  alive: () => boolean;
  /** Why the process couldn't be started, if it couldn't. */
  spawnError: () => Error | undefined;
}

const launched: App[] = [];

function launch(dataDir: string, extraEnv: Record<string, string> = {}): App {
  const child = spawn(EXE, [], {
    stdio: "ignore",
    env: {
      ...process.env,
      TK_DATA_DIR: dataDir,
      // Never fall back to the real v1 database.
      TK_V1_IMPORT_DB: join(dataDir, "no-v1.db"),
      // Keep WebView2's profile out of the real app's local data dir.
      WEBVIEW2_USER_DATA_FOLDER: join(dataDir, "webview"),
      ...extraEnv,
    },
  });
  let running = true;
  let spawnError: Error | undefined;
  const exited = new Promise<number | null>((done) => {
    child.once("exit", (code) => {
      running = false;
      done(code);
    });
    // Without a listener a spawn failure crashes the script; "exit" may never follow it.
    child.once("error", (error) => {
      running = false;
      spawnError = error;
      done(null);
    });
  });
  const app = { child, exited, alive: () => running, spawnError: () => spawnError };
  launched.push(app);
  return app;
}

/** Hard kill, like a crash: no window close, no clean shutdown. */
async function kill(app: App): Promise<void> {
  if (!app.alive()) return;
  try {
    execFileSync("taskkill", ["/F", "/T", "/PID", String(app.child.pid)], { stdio: "ignore" });
  } catch {
    // Exited between the check and taskkill.
  }
  await app.exited;
}

function query(dbPath: string, sql: string): Row | undefined {
  if (!existsSync(dbPath)) return undefined;
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare(sql).get();
  } catch (e) {
    if (e instanceof Error && e.message.includes("no such table")) return undefined;
    throw e;
  } finally {
    db.close();
  }
}

async function waitFor<T>(
  what: string,
  app: App,
  probe: () => T | undefined,
  timeoutMs = 20_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!app.alive()) {
      const spawnError = app.spawnError();
      if (spawnError) throw new Error(`app failed to start: ${spawnError.message}`);
      throw new Error(`app exited while waiting for ${what} (is another v2 instance running?)`);
    }
    let value: T | undefined;
    try {
      value = probe();
    } catch (e) {
      // The app holds a write lock while it starts; retry.
      if (!(e instanceof Error && /database is locked|busy/i.test(e.message))) throw e;
    }
    if (value !== undefined) return value;
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${what}`);
}

function assertEqual(actual: unknown, expected: unknown, what: string): void {
  if (actual !== expected) {
    throw new Error(`${what}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const schemaReady = (dbPath: string) => query(dbPath, "SELECT COUNT(*) AS n FROM settings");

const heartbeat = (dbPath: string) =>
  query(dbPath, "SELECT value FROM settings WHERE key = 'heartbeat_at'")?.value as
    string | undefined;

/** Seeds a running timer with a fresh heartbeat; returns the interval id and the heartbeat. */
function seedRunningTimer(dbPath: string): { intervalId: number; heartbeatAt: string } {
  const heartbeatAt = new Date().toISOString();
  const db = new DatabaseSync(dbPath);
  // Each insert reads the previous one's rowid, so the interval goes last.
  db.exec(`
    INSERT INTO settings (key, value) VALUES ('heartbeat_at', '${heartbeatAt}')
      ON CONFLICT(key) DO UPDATE SET value = excluded.value;
    INSERT INTO projects (name, created_at) VALUES ('Smoke', '${heartbeatAt}');
    INSERT INTO entries (project_id, day, created_at, updated_at)
      VALUES (last_insert_rowid(), '${new Date().toLocaleDateString("en-CA")}', '${heartbeatAt}', '${heartbeatAt}');
    INSERT INTO intervals (entry_id, start_at, source)
      VALUES (last_insert_rowid(), '${new Date(Date.now() - 60_000).toISOString()}', 'timer');
  `);
  const { id } = db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number };
  db.close();
  return { intervalId: id, heartbeatAt };
}

/** A heartbeat newer than `after` means startup finished and the ticker is running. */
const waitForHeartbeat = (app: App, dbPath: string, after: string) =>
  waitFor("a new heartbeat", app, () => {
    const at = heartbeat(dbPath);
    return at && at > after ? at : undefined;
  });

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

/** A small v1 database: two projects, three sessions, one never closed. */
function makeV1Fixture(path: string): void {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE projects (projectId INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      description TEXT, color TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE sessions (sessionId INTEGER PRIMARY KEY AUTOINCREMENT, projectId INTEGER NOT NULL,
      startTime DATETIME NOT NULL, endTime DATETIME, duration INTEGER, notes TEXT);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO settings VALUES ('schema_version', '4');
    INSERT INTO projects (projectId, name, createdAt) VALUES (1, 'Alpha', '2025-05-19 17:42:13');
    INSERT INTO projects (projectId, name, createdAt) VALUES (2, 'Beta', '2026-01-27 22:14:55');
    INSERT INTO sessions VALUES (10, 1, '2026-09-21T14:15:00.000Z', '2026-09-21T16:00:00.000Z', 6300, 'one');
    INSERT INTO sessions VALUES (11, 2, '2026-09-22T15:00:00.000Z', '2026-09-22T15:30:00.000Z', 1800, 'two');
    INSERT INTO sessions VALUES (12, 2, '2026-09-23T15:09:44.367Z', NULL, NULL, 'never closed');
  `);
  db.close();
}

// ------------------------------------------------------------------ scenarios

async function firstRunImport(dir: string): Promise<void> {
  const v1 = join(dir, "v1.db");
  makeV1Fixture(v1);
  const v1Hash = sha256(v1);
  const db = join(dir, "timekeeper.db");
  const env = { TK_V1_IMPORT_DB: v1 };

  const first = launch(dir, env);
  const importedAt = await waitFor("the v1 import", first, () => {
    const row = query(db, "SELECT value FROM settings WHERE key = 'v1_imported_at'");
    return row ? String(row.value) : undefined;
  });
  const counts = `SELECT (SELECT COUNT(*) FROM projects WHERE legacy_project_id IS NOT NULL) AS p,
    (SELECT COUNT(*) FROM intervals WHERE source = 'import') AS i`;
  assertEqual(query(db, counts)?.p, 2, "imported projects");
  assertEqual(query(db, counts)?.i, 3, "imported sessions");
  await kill(first);

  // A running timer's heartbeat shows the relaunch got past the import step.
  const { heartbeatAt } = seedRunningTimer(db);
  const second = launch(dir, { ...env, TK_HEARTBEAT_SECS: "1" });
  await waitForHeartbeat(second, db, heartbeatAt);
  assertEqual(
    query(db, "SELECT value FROM settings WHERE key = 'v1_imported_at'")?.value,
    importedAt,
    "v1_imported_at after relaunch",
  );
  assertEqual(query(db, counts)?.i, 3, "sessions after relaunch");
  await kill(second);

  assertEqual(sha256(v1), v1Hash, "v1 database hash");
}

async function singleInstance(dir: string): Promise<void> {
  const db = join(dir, "timekeeper.db");
  const first = launch(dir);
  await waitFor("the database", first, () => schemaReady(db));

  const second = launch(dir);
  const exitCode = await Promise.race([second.exited, sleep(15_000).then(() => "timeout")]);
  assertEqual(exitCode, 0, "second launch exit code");
  assertEqual(first.alive(), true, "first instance still running");
  await kill(first);
}

async function crashRecovery(dir: string): Promise<void> {
  const db = join(dir, "timekeeper.db");

  // Let the app create its schema, then seed a running timer with a fresh heartbeat.
  const init = launch(dir);
  await waitFor("the database", init, () => schemaReady(db));
  await kill(init);
  const { intervalId, heartbeatAt } = seedRunningTimer(db);
  const endAt = `SELECT end_at FROM intervals WHERE id = ${intervalId}`;

  // The timer keeps running and its heartbeat advances; then the app is killed mid-timer.
  // The default stale window applies here, so a slow start can't close the seeded timer.
  const timing = launch(dir, { TK_HEARTBEAT_SECS: "1" });
  await waitForHeartbeat(timing, db, heartbeatAt);
  await kill(timing);
  const lastHeartbeat = heartbeat(db);
  assertEqual(query(db, endAt)?.end_at, null, "timer open after kill");

  // Relaunch once the heartbeat is stale: the timer must close at the last heartbeat.
  await sleep((STALE_AFTER_SECS + 1) * 1_000);
  const relaunched = launch(dir, { TK_STALE_AFTER_SECS: String(STALE_AFTER_SECS) });
  const closedAt = await waitFor("the timer to be closed", relaunched, () => {
    const row = query(db, endAt);
    return row?.end_at ?? undefined;
  });
  assertEqual(closedAt, lastHeartbeat, "timer closed at the last heartbeat");
  await kill(relaunched);
}

// ----------------------------------------------------------------------- main

const scenarios: [string, (dir: string) => Promise<void>][] = [
  ["first-run import happens once and leaves v1 unchanged", firstRunImport],
  ["a second launch exits and leaves one instance", singleInstance],
  ["a hard-killed timer is closed at its last heartbeat", crashRecovery],
];

async function main(): Promise<number> {
  if (process.platform !== "win32") {
    console.error("smoke-windows only runs on Windows.");
    return 1;
  }
  if (!existsSync(EXE)) {
    console.error(`No debug build at ${EXE}. Run: npm run tauri build -- --debug --no-bundle`);
    return 1;
  }
  // A build without the TK_* overrides would run against the real data dir.
  if (!readFileSync(EXE).includes("TK_DATA_DIR")) {
    console.error(`${EXE} predates the TK_* overrides. Rebuild: npm run smoke:windows`);
    return 1;
  }

  let failures = 0;
  for (const [name, run] of scenarios) {
    const dir = mkdtempSync(join(tmpdir(), "tk-smoke-"));
    const started = Date.now();
    let passed = false;
    try {
      await run(dir);
      passed = true;
      console.log(`✓ ${name} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } catch (e) {
      failures++;
      console.log(`✗ ${name}\n    ${e instanceof Error ? e.message : String(e)}\n    data: ${dir}`);
    } finally {
      for (const app of launched.splice(0)) await kill(app);
    }
    // Failed runs keep their data dir for inspection.
    if (passed) rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
  return failures === 0 ? 0 : 1;
}

process.exitCode = await main();
