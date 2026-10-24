// The UI's only door to the backend. In the Tauri app these are Rust commands;
// opened in a plain browser (`npm run dev`) they fall back to an in-memory mock
// so the UI can be worked on without the native shell.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import * as mock from "./mock";

export interface Project {
  id: number;
  name: string;
  color: string | null;
  archived: boolean;
  /** Whether the notes editor offers Linear suggestions for this project. */
  linearEnabled: boolean;
  /** Limits Linear suggestions to one team, e.g. "LABS"; `null` means any team. */
  linearTeamKey: string | null;
  /** Step copied durations round to, one of `Snapshot.roundingSteps`; `null` copies them exact. */
  roundingMinutes: number | null;
  /** Kept while rounding is off. */
  roundingMode: RoundingMode;
}

export type RoundingMode = "up" | "nearest" | "down";

/** A Linear key that was just checked: its last four characters and whose it is. */
export interface LinearConnection {
  hint: string;
  viewer: string;
}

/** Lines for a day's notes from one source; the shell gathers one per source a project uses. */
export interface Suggestion {
  source: "linear";
  lines: string[];
  /** Why the lines may be incomplete; shown, never added to the notes. */
  notice: string | null;
}

export interface Entry {
  id: number;
  projectId: number;
  projectName: string;
  projectColor: string | null;
  day: string; // YYYY-MM-DD, local
  notes: string;
  seconds: number;
  running: boolean;
}

export interface Running {
  entryId: number;
  projectId: number;
  projectName: string;
  intervalStartedAt: string;
  priorSeconds: number;
}

export interface Status {
  running: Running | null;
  elapsedSeconds: number;
}

export interface Totals {
  today: number;
  thisWeek: number;
  thisMonth: number;
  lastMonth: number;
}

export interface ImportReport {
  projects: number;
  entries: number;
  seconds: number;
  unclosedSessions: number;
  missingDurations: number;
  alreadyImported: number;
  orphanedSessions: number;
  unparseableSessions: number;
  stillOpen: number;
}

export interface Snapshot {
  status: Status;
  projects: Project[];
  /** Project color keys; see `projectColor`. */
  palette: string[];
  /** Minutes a project can round copied durations to. */
  roundingSteps: number[];
  /** The last project timed unless it's archived, else the first active one. */
  resumeProjectId: number | null;
  settings: Record<string, string>;
  startup: {
    recovered: { projectName: string; stoppedAt: string } | null;
    imported: ImportReport | null;
    importError: string | null;
  };
  dataDir: string;
  v1ImportedAt: string | null;
}

const inTauri = "__TAURI_INTERNALS__" in window;

function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return inTauri ? invoke<T>(cmd, args) : mock.invoke<T>(cmd, args);
}

export const api = {
  snapshot: () => call<Snapshot>("snapshot"),
  start: (projectId: number, notes?: string) => call<Status>("start", { projectId, notes }),
  stop: () => call<Status>("stop"),
  entries: (from: string, to: string, projectId: number | null) =>
    call<Entry[]>("entries", { from, to, projectId }),
  totals: (projectId: number | null) => call<Totals>("totals", { projectId }),
  setNotes: (entryId: number, notes: string) => call<void>("set_notes", { entryId, notes }),
  /** Adds `seconds` to `day`'s entry for the project, creating it if needed. */
  addManualTime: (projectId: number, day: string, seconds: number, notes?: string) =>
    call<Entry>("add_manual_time", { projectId, day, seconds, notes }),
  setEntrySeconds: (entryId: number, seconds: number) =>
    call<void>("set_entry_seconds", { entryId, seconds }),
  deleteEntry: (entryId: number) => call<void>("delete_entry", { entryId }),
  createProject: (name: string) => call<Project>("create_project", { name }),
  renameProject: (projectId: number, name: string) =>
    call<void>("rename_project", { projectId, name }),
  setProjectColor: (projectId: number, color: string) =>
    call<void>("set_project_color", { projectId, color }),
  setProjectArchived: (projectId: number, archived: boolean) =>
    call<void>("set_project_archived", { projectId, archived }),
  setProjectLinearEnabled: (projectId: number, enabled: boolean) =>
    call<void>("set_project_linear_enabled", { projectId, enabled }),
  /** Normalized by the backend: trimmed, uppercased, blank → `null`; refused unless letters and digits. */
  setProjectLinearTeam: (projectId: number, teamKey: string | null) =>
    call<void>("set_project_linear_team", { projectId, teamKey }),
  /** `minutes: null` turns rounding off; refused unless a step in `Snapshot.roundingSteps`. */
  setProjectRounding: (projectId: number, minutes: number | null, mode: RoundingMode) =>
    call<void>("set_project_rounding", { projectId, minutes, mode }),
  setSetting: (key: string, value: string) => call<void>("set_setting", { key, value }),
  /** Brings in v1 sessions recorded since the last import; still-open ones wait. */
  importV1Again: () => call<ImportReport>("import_v1_again"),
  /** Copies the database to a new timestamped file; resolves to its path. */
  backupNow: () => call<string>("backup_now"),
  /** Whether the app starts hidden in the tray at login; `null` where that isn't supported. */
  startAtLogin: () => call<boolean | null>("start_at_login"),
  setStartAtLogin: (enabled: boolean) => call<void>("set_start_at_login", { enabled }),
  /** The saved Linear key's last four characters, or `null`; the key itself never reaches the UI. */
  linearKeyStatus: () => call<{ hint: string } | null>("linear_key_status"),
  /** Checks the key with Linear and stores it only if Linear accepts it. */
  saveLinearKey: (key: string) => call<LinearConnection>("save_linear_key", { key }),
  /** Resolves to the name of the Linear user the saved key belongs to. */
  testLinearConnection: () => call<string>("test_linear_connection"),
  removeLinearKey: () => call<void>("remove_linear_key"),
  /** What was done on local `day` for the project, per source; nothing leaves Linear but reads. */
  suggestNotes: (projectId: number, day: string) =>
    call<Suggestion[]>("suggest_notes", { projectId, day }),

  copy: (text: string) => (inTauri ? writeText(text) : navigator.clipboard.writeText(text)),

  /** Fires when the timer changes outside the window (e.g. from the tray). */
  onTimerChanged: (fn: () => void): Promise<() => void> =>
    inTauri ? listen("timer-changed", fn) : Promise.resolve(() => {}),
};
