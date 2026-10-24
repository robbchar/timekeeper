// In-memory stand-in for the Rust backend, used only when the UI is opened in
// a plain browser. Synthetic data; no real records.

import type {
  Entry,
  IdlePrompt,
  ImportReport,
  Project,
  Snapshot,
  Status,
  Suggestion,
  Totals,
} from "./api";
import { addDays, localDay } from "./format";

const projects: Project[] = [
  {
    id: 1,
    name: "Acme Portal",
    color: "teal",
    archived: false,
    linearEnabled: false,
    linearTeamKey: null,
  },
  {
    id: 2,
    name: "Side project",
    color: "gold",
    archived: false,
    linearEnabled: false,
    linearTeamKey: null,
  },
];

const palette = ["teal", "coral", "blue", "gold", "purple", "green"];

function project(id: unknown): Project {
  const p = projects.find((x) => x.id === id);
  if (!p) throw new Error(`project ${String(id)} not found`);
  return p;
}

const notes = [
  "ACME-112 auth callback; review PR feedback",
  "ACME-118 dashboard filters, pairing on ACME-120",
  "standup, planning, ACME-121 spike on charts",
  "ACME-125 timeline notes; bug bash",
  "demo prep (ACME-130, ACME-131)",
];

interface MockEntry extends Entry {
  closedSeconds: number;
}

const today = localDay();
const entries: MockEntry[] = [];
let nextId = 1;
for (let i = 1; i <= 40; i++) {
  const day = addDays(today, -i);
  const dow = new Date(day + "T12:00:00").getDay();
  if (dow === 0) continue;
  const secs = 3600 * (2 + ((i * 7) % 5)) + 60 * ((i * 13) % 60);
  entries.push({
    id: nextId++,
    projectId: 1,
    projectName: projects[0].name,
    projectColor: projects[0].color,
    day,
    notes: notes[i % notes.length],
    seconds: secs,
    closedSeconds: secs,
    running: false,
  });
  if (i % 9 === 0) {
    entries.push({
      id: nextId++,
      projectId: 2,
      projectName: projects[1].name,
      projectColor: projects[1].color,
      day,
      notes: "kata: filterable list",
      seconds: 1800,
      closedSeconds: 1800,
      running: false,
    });
  }
}

let running: { entryId: number; startedAt: number } | null = null;
let lastProjectId: number | null = 1;
const settings: Record<string, string> = {};
let v1ImportedAt: string | null = null;
let startAtLogin = false;
let idlePrompt: IdlePrompt | null = null;
// Held in memory only; a browser preview never talks to Linear.
let linearKey: string | null = null;
const LINEAR_UNAUTHORIZED =
  "Linear didn't accept this key. Check that it's a personal API key that hasn't been revoked.";

function secondsOf(e: MockEntry): number {
  const live = running?.entryId === e.id ? (Date.now() - running.startedAt) / 1000 : 0;
  return Math.round(e.closedSeconds + live);
}

function status(): Status {
  if (!running) return { running: null, elapsedSeconds: 0 };
  const e = entries.find((x) => x.id === running!.entryId)!;
  return {
    running: {
      entryId: e.id,
      projectId: e.projectId,
      projectName: e.projectName,
      intervalStartedAt: new Date(running.startedAt).toISOString(),
      priorSeconds: e.closedSeconds,
    },
    elapsedSeconds: secondsOf(e),
  };
}

function stop() {
  if (!running) return;
  const e = entries.find((x) => x.id === running!.entryId)!;
  e.closedSeconds = secondsOf(e);
  running = null;
}

function sum(from: string, to: string, projectId: number | null) {
  return entries
    .filter((e) => e.day >= from && e.day <= to && (projectId == null || e.projectId === projectId))
    .reduce((n, e) => n + secondsOf(e), 0);
}

// A refusal the real core would return; only these become Tauri-style string rejections.
class Refused extends Error {}

// Async like real IPC, so throws surface as rejections; Tauri rejects with the message string.
export function invoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  return (
    Promise.resolve()
      .then(() => handle<T>(cmd, args))
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- matches Tauri's string rejections
      .catch((err: unknown) => Promise.reject(err instanceof Refused ? err.message : err))
  );
}

function handle<T>(cmd: string, a: Record<string, unknown>): T {
  switch (cmd) {
    case "snapshot": {
      // Copies, ordered like the backend: active first, then by name in SQLite's binary order.
      const sorted = projects
        .map((p) => ({ ...p }))
        .sort(
          (x, y) =>
            Number(x.archived) - Number(y.archived) ||
            (x.name < y.name ? -1 : x.name > y.name ? 1 : 0),
        );
      const active = sorted.filter((p) => !p.archived);
      return {
        status: status(),
        projects: sorted,
        palette,
        resumeProjectId: (active.find((p) => p.id === lastProjectId) ?? active[0])?.id ?? null,
        settings,
        startup: { recovered: null, imported: null, importError: null },
        dataDir: "(browser preview: in-memory sample data)",
        v1ImportedAt,
        idleSupported: true,
        idlePrompt,
      } satisfies Snapshot as T;
    }
    case "start": {
      const projectId = a.projectId as number;
      if (running && entries.find((e) => e.id === running!.entryId)!.projectId === projectId)
        return status() as T;
      stop();
      let e = entries.find((x) => x.projectId === projectId && x.day === localDay());
      if (!e) {
        const p = projects.find((x) => x.id === projectId)!;
        e = {
          id: nextId++,
          projectId,
          projectName: p.name,
          projectColor: p.color,
          day: localDay(),
          notes: (a.notes as string | undefined)?.trim() ?? "",
          seconds: 0,
          closedSeconds: 0,
          running: false,
        };
        entries.unshift(e);
      }
      running = { entryId: e.id, startedAt: Date.now() };
      lastProjectId = projectId;
      return status() as T;
    }
    case "stop":
      stop();
      idlePrompt = null;
      return status() as T;
    case "answer_idle_prompt": {
      if (idlePrompt && running && !(a.keep as boolean)) {
        // Keep what was timed before going idle; time again from the return.
        const e = entries.find((x) => x.id === running!.entryId)!;
        const kept = (Date.parse(idlePrompt.since) - running.startedAt) / 1000;
        e.closedSeconds += Math.max(0, kept);
        running.startedAt = Date.parse(idlePrompt.returnedAt);
      }
      idlePrompt = null;
      return status() as T;
    }
    case "entries":
      return entries
        .filter(
          (e) =>
            e.day >= (a.from as string) &&
            e.day <= (a.to as string) &&
            (a.projectId == null || e.projectId === a.projectId),
        )
        .sort((x, y) => (x.day < y.day ? 1 : x.day > y.day ? -1 : y.id - x.id))
        .map((e) => ({ ...e, seconds: secondsOf(e), running: running?.entryId === e.id })) as T;
    case "totals": {
      const t = localDay();
      const sundayWeeks = settings.week_start === "sunday";
      const dow = sundayWeeks ? new Date().getDay() : (new Date().getDay() + 6) % 7;
      const pid = (a.projectId as number | null) ?? null;
      const monthFirst = t.slice(0, 8) + "01";
      const lastMonthEnd = addDays(monthFirst, -1);
      const lastMonthFirst = lastMonthEnd.slice(0, 8) + "01";
      return {
        today: sum(t, t, pid),
        thisWeek: sum(addDays(t, -dow), t, pid),
        thisMonth: sum(monthFirst, t, pid),
        lastMonth: sum(lastMonthFirst, lastMonthEnd, pid),
      } satisfies Totals as T;
    }
    case "set_notes": {
      const e = entries.find((x) => x.id === a.entryId);
      if (e) e.notes = (a.notes as string).trim();
      return undefined as T;
    }
    case "add_manual_time": {
      const projectId = a.projectId as number;
      const day = a.day as string;
      const seconds = a.seconds as number;
      const note = (a.notes as string | undefined)?.trim() ?? "";
      if (!(seconds > 0 && seconds <= 24 * 3600))
        throw new Error("manual time must be between 1 second and 24 hours");
      if (day > localDay()) throw new Error(`can't add time to a future day (${day})`);
      const p = projects.find((x) => x.id === projectId);
      if (!p) throw new Error(`project ${projectId} not found`);
      let e = entries.find((x) => x.projectId === projectId && x.day === day);
      if (!e) {
        e = {
          id: nextId++,
          projectId,
          projectName: p.name,
          projectColor: p.color,
          day,
          notes: note,
          seconds: 0,
          closedSeconds: 0,
          running: false,
        };
        entries.unshift(e);
      } else if (note) {
        e.notes = e.notes ? `${e.notes}\n${note}` : note;
      }
      e.closedSeconds += seconds;
      return { ...e, seconds: secondsOf(e), running: running?.entryId === e.id } as T;
    }
    case "set_entry_seconds": {
      const e = entries.find((x) => x.id === a.entryId);
      if (!e) throw new Error(`entry ${String(a.entryId)} not found`);
      if (running?.entryId === e.id) throw new Error("stop the timer before editing its duration");
      const seconds = a.seconds as number;
      if (seconds < 0) throw new Error("duration can't be negative");
      if (seconds > 24 * 3600) throw new Error("duration can't exceed 24 hours");
      e.closedSeconds = seconds;
      return undefined as T;
    }
    case "delete_entry": {
      const id = a.entryId as number;
      const i = entries.findIndex((x) => x.id === id);
      if (i < 0) throw new Refused(`entry ${id} not found`);
      if (running?.entryId === id) throw new Refused(`stop the timer before deleting entry ${id}`);
      entries.splice(i, 1);
      return undefined as T;
    }
    case "create_project": {
      const p: Project = {
        id: projects.length + 1,
        name: (a.name as string).trim(),
        color: palette[projects.length % palette.length],
        archived: false,
        linearEnabled: false,
        linearTeamKey: null,
      };
      projects.push(p);
      return p as T;
    }
    case "rename_project": {
      const name = (a.name as string).trim();
      if (!name) throw new Error("project name is empty");
      project(a.projectId).name = name;
      for (const e of entries) if (e.projectId === a.projectId) e.projectName = name;
      return undefined as T;
    }
    case "set_project_color": {
      const color = a.color as string;
      if (!palette.includes(color)) throw new Error(`unknown project color "${color}"`);
      project(a.projectId).color = color;
      for (const e of entries) if (e.projectId === a.projectId) e.projectColor = color;
      return undefined as T;
    }
    case "set_project_archived":
      project(a.projectId).archived = a.archived as boolean;
      return undefined as T;
    case "set_setting":
      settings[a.key as string] = a.value as string;
      return undefined as T;
    case "import_v1_again":
      // No v1 database in the browser preview, so there's never anything new.
      v1ImportedAt = new Date().toISOString();
      return {
        projects: 0,
        entries: 0,
        seconds: 0,
        unclosedSessions: 0,
        missingDurations: 0,
        alreadyImported: 0,
        orphanedSessions: 0,
        unparseableSessions: 0,
        stillOpen: 0,
      } satisfies ImportReport as T;
    case "backup_now":
      return "(browser preview: nothing written)" as T;
    case "start_at_login":
      return startAtLogin as T;
    case "set_start_at_login":
      startAtLogin = a.enabled as boolean;
      return undefined as T;
    case "set_project_linear_enabled":
      project(a.projectId).linearEnabled = a.enabled as boolean;
      return undefined as T;
    case "set_project_linear_team": {
      const teamKey = ((a.teamKey as string | null) ?? "").trim();
      if (teamKey && !/^[a-z0-9]+$/i.test(teamKey)) {
        throw new Refused(`a Linear team key is letters and digits, like LABS (got "${teamKey}")`);
      }
      project(a.projectId).linearTeamKey = teamKey ? teamKey.toUpperCase() : null;
      return undefined as T;
    }
    case "linear_key_status":
      return (linearKey ? { hint: linearKey.slice(-4) } : null) as T;
    case "save_linear_key": {
      const key = (a.key as string).trim();
      if (!key) throw new Refused("Paste a Linear API key first.");
      if (!key.startsWith("lin_api_")) throw new Refused(LINEAR_UNAUTHORIZED);
      linearKey = key;
      return { hint: key.slice(-4), viewer: "Mock Viewer" } as T;
    }
    case "test_linear_connection":
      if (!linearKey) throw new Refused("No Linear API key is saved.");
      return "Mock Viewer" as T;
    case "remove_linear_key":
      linearKey = null;
      return undefined as T;
    case "suggest_notes": {
      const p = project(a.projectId);
      if (!p.linearEnabled) return [] as T;
      if (!linearKey) throw new Refused("No Linear API key is saved.");
      const issue = `${p.linearTeamKey ?? "MOCK"}-1 Mock issue for ${a.day as string}`;
      return [
        { source: "linear", lines: [`${issue} — moved to In Review; commented`], notice: null },
      ] satisfies Suggestion[] as T;
    }
  }
  throw new Error(`mock: unknown command ${cmd}`);
}

// `?idle` previews the idle prompt: timing for 40 minutes, away for 30 of them.
if (new URLSearchParams(window.location.search).has("idle")) {
  const minutesAgo = (m: number) => Date.now() - m * 60_000;
  const { entryId } = handle<Status>("start", { projectId: 1 }).running!;
  running = { entryId, startedAt: minutesAgo(40) };
  idlePrompt = {
    since: new Date(minutesAgo(31)).toISOString(),
    returnedAt: new Date(minutesAgo(1)).toISOString(),
  };
}
