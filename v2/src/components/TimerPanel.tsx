import { useRef, useState } from "react";
import { api, Entry, Project, Status } from "../api";
import { formatClock } from "../format";

interface Props {
  projects: Project[];
  lastProjectId: number | null;
  status: Status;
  liveSeconds: number;
  entries: Entry[];
  today: string;
  onChanged: () => Promise<void>;
  onError: (err: unknown) => void;
}

const NEW_PROJECT = -1;

export function TimerPanel({
  projects,
  lastProjectId,
  status,
  liveSeconds,
  entries,
  today,
  onChanged,
  onError,
}: Props) {
  const running = status.running;
  const active = projects.filter((p) => !p.archived);
  // Archived projects are hidden, except a running one so the picker still shows it.
  const choices = projects.filter((p) => !p.archived || p.id === running?.projectId);
  const [chosen, setSelected] = useState<number | null>(
    running?.projectId ?? lastProjectId ?? active[0]?.id ?? null,
  );
  // A choice that has since been archived falls back to the first active project.
  const selected = choices.some((p) => p.id === chosen) ? chosen : (active[0]?.id ?? null);
  const [adding, setAdding] = useState(choices.length === 0);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  // Follow the timer if it was started elsewhere (e.g. the tray).
  const runningProjectId = running?.projectId;
  const [seenRunningProjectId, setSeenRunningProjectId] = useState(runningProjectId);
  if (runningProjectId !== seenRunningProjectId) {
    setSeenRunningProjectId(runningProjectId);
    if (runningProjectId != null) setSelected(runningProjectId);
  }

  // The notes box edits the entry the timer would use: the running one (from
  // any day, since it can run past midnight), or today's entry for the
  // selected project. With neither, it's a draft that becomes the new entry's
  // notes on Start.
  const target =
    entries.find((e) => e.id === running?.entryId) ??
    entries.find((e) => e.day === today && e.projectId === selected);
  const [notes, setNotes] = useState(target?.notes ?? "");
  const targetId = target?.id;
  const [seenTargetId, setSeenTargetId] = useState(targetId);
  if (targetId !== seenTargetId) {
    setSeenTargetId(targetId);
    setNotes(target?.notes ?? "");
  }

  const saveTimer = useRef<number | undefined>(undefined);
  const scheduleSave = (value: string) => {
    setNotes(value);
    if (targetId == null) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(
      () => void api.setNotes(targetId, value).catch(onError),
      600,
    );
  };
  // Resolves true if it saved; rejects if the save fails.
  const flushSave = async () => {
    if (targetId == null) return false;
    window.clearTimeout(saveTimer.current);
    if (notes === target?.notes) return false;
    await api.setNotes(targetId, notes);
    return true;
  };

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      void onChanged();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  };

  const toggle = () =>
    act(async () => {
      if (running) {
        // A failed save aborts the stop, so the refresh can't discard the typed notes.
        await flushSave();
        await api.stop();
      } else if (selected != null) {
        await api.start(selected, targetId == null ? notes : undefined);
      }
    });

  const addProject = () =>
    act(async () => {
      if (!newName.trim()) return;
      const p = await api.createProject(newName);
      setSelected(p.id);
      setAdding(false);
      setNewName("");
    });

  const isRunningHere = running != null && running.projectId === selected;

  return (
    <section className={`timer ${running ? "timer--running" : ""}`}>
      <div className="timer__row">
        {adding ? (
          <form
            className="timer__new-project"
            onSubmit={(e) => {
              e.preventDefault();
              void addProject();
            }}
          >
            <input
              autoFocus
              placeholder="New project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" className="btn">
              Add
            </button>
            {choices.length > 0 && (
              <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>
                Cancel
              </button>
            )}
          </form>
        ) : (
          <select
            className="timer__project"
            value={selected ?? ""}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v === NEW_PROJECT) setAdding(true);
              else setSelected(v);
            }}
          >
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value={NEW_PROJECT}>+ New project…</option>
          </select>
        )}

        <div className="timer__clock" aria-live="off">
          {formatClock(isRunningHere ? liveSeconds : (target?.seconds ?? 0))}
        </div>

        <button
          className={`btn btn--primary ${running ? "btn--stop" : ""}`}
          disabled={busy || (!running && selected == null)}
          onClick={() => void toggle()}
        >
          {running ? (isRunningHere ? "Stop" : `Stop ${running.projectName}`) : "Start"}
        </button>
      </div>

      <textarea
        className="timer__notes"
        rows={2}
        placeholder={target ? "What are you working on?" : "Notes for today — saved when you start"}
        value={notes}
        onChange={(e) => scheduleSave(e.target.value)}
        onBlur={() => void flushSave().then((saved) => (saved ? onChanged() : undefined), onError)}
      />
    </section>
  );
}
