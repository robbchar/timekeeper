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
}

export interface Snapshot {
  status: Status;
  projects: Project[];
  lastProjectId: number | null;
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
  createProject: (name: string) => call<Project>("create_project", { name }),
  setSetting: (key: string, value: string) => call<void>("set_setting", { key, value }),

  copy: (text: string) => (inTauri ? writeText(text) : navigator.clipboard.writeText(text)),

  /** Fires when the timer changes outside the window (e.g. from the tray). */
  onTimerChanged: (fn: () => void): Promise<() => void> =>
    inTauri ? listen("timer-changed", fn) : Promise.resolve(() => {}),
};
