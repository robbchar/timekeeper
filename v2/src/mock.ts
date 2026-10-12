// In-memory stand-in for the Rust backend, used only when the UI is opened in
// a plain browser. Synthetic data; no real records.

import type { Entry, Project, Snapshot, Status, Totals } from "./api";
import { addDays, localDay } from "./format";

const projects: Project[] = [
  { id: 1, name: "Acme Portal", color: "#2a9d8f", archived: false },
  { id: 2, name: "Side project", color: "#e9c46a", archived: false },
];

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
    case "snapshot":
      return {
        status: status(),
        projects,
        lastProjectId,
        settings,
        startup: { recovered: null, imported: null, importError: null },
        dataDir: "(browser preview: in-memory sample data)",
        v1ImportedAt: null,
      } satisfies Snapshot as T;
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
      return status() as T;
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
        color: null,
        archived: false,
      };
      projects.push(p);
      return p as T;
    }
    case "set_setting":
      settings[a.key as string] = a.value as string;
      return undefined as T;
  }
  throw new Error(`mock: unknown command ${cmd}`);
}
