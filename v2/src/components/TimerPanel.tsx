import { useRef, useState } from "react";
import { api, Entry, Project, Status } from "../api";
import { formatClock } from "../format";
import { appendLines, SuggestButton } from "./SuggestButton";

interface Props {
  projects: Project[];
  resumeProjectId: number | null;
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
  resumeProjectId,
  status,
  liveSeconds,
  entries,
  today,
  onChanged,
  onError,
}: Props) {
  const running = status.running;
  // A project just added is listed here until the refresh brings it in.
  const [added, setAdded] = useState<Project | null>(null);
  const listed =
    added && !projects.some((p) => p.id === added.id) ? [...projects, added] : projects;
  // Archived projects are hidden, except a running one so the picker still shows it.
  const choices = listed.filter((p) => !p.archived || p.id === running?.projectId);
  const [chosen, setChosen] = useState<number | null>(running?.projectId ?? resumeProjectId);
  // A choice hidden since (an archived timer that stopped) falls back to the resume project.
  const hidden = listed.some((p) => p.id === chosen) && !choices.some((p) => p.id === chosen);
  const selected = hidden ? resumeProjectId : chosen;
  const [adding, setAdding] = useState(false);
  // With nothing to pick, the form is the only way to get a project.
  const showForm = adding || choices.length === 0;
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  // Follow the timer if it was started elsewhere (e.g. the tray).
  const runningProjectId = running?.projectId;
  const [seenRunningProjectId, setSeenRunningProjectId] = useState(runningProjectId);
  if (runningProjectId !== seenRunningProjectId) {
    setSeenRunningProjectId(runningProjectId);
    if (runningProjectId != null) setChosen(runningProjectId);
  }

  const isRunningHere = running != null && running.projectId === selected;
  // The notes box edits the entry the timer would use for the selected project:
  // the running one (from any day, since it can run past midnight), or today's.
  // With neither, it's a draft that becomes the new entry's notes on Start.
  const target =
    (isRunningHere ? entries.find((e) => e.id === running.entryId) : undefined) ??
    entries.find((e) => e.day === today && e.projectId === selected);
  const [notes, setNotes] = useState(target?.notes ?? "");
  const targetId = target?.id;
  const [seenTargetId, setSeenTargetId] = useState(targetId);
  // Notes saved elsewhere (the day list) replace the box's text, unless it's being typed in.
  const [seenNotes, setSeenNotes] = useState(target?.notes);
  const [focused, setFocused] = useState(false);
  if (targetId !== seenTargetId) {
    setSeenTargetId(targetId);
    setSeenNotes(target?.notes);
    setNotes(target?.notes ?? "");
  } else if (target?.notes !== seenNotes) {
    setSeenNotes(target?.notes);
    if (!focused) setNotes(target?.notes ?? "");
  }

  const selectedProject = listed.find((p) => p.id === selected);

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

  // A failed save aborts the action, so the refresh can't discard the typed notes.
  const stop = () =>
    act(async () => {
      await flushSave();
      await api.stop();
    });
  // While another project runs, this switches to the selected one with no gap.
  const start = () =>
    act(async () => {
      if (selected == null) return;
      await flushSave();
      await api.start(selected, targetId == null ? notes : undefined);
    });

  const addProject = () =>
    act(async () => {
      if (!newName.trim()) return;
      const p = await api.createProject(newName);
      setAdded(p);
      setChosen(p.id);
      setAdding(false);
      setNewName("");
    });

  return (
    <section className={`timer ${running ? "timer--running" : ""}`}>
      <div className="timer__row">
        {showForm ? (
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
              else setChosen(v);
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

        {running && !isRunningHere && (
          <button className="btn btn--ghost" disabled={busy} onClick={() => void stop()}>
            Stop {running.projectName}
          </button>
        )}
        <button
          className={`btn btn--primary ${isRunningHere ? "btn--stop" : ""}`}
          disabled={busy || selected == null}
          onClick={() => void (isRunningHere ? stop() : start())}
        >
          {isRunningHere ? "Stop" : running ? `Switch to ${selectedProject?.name}` : "Start"}
        </button>
      </div>

      <textarea
        className="timer__notes"
        rows={2}
        placeholder={target ? "What are you working on?" : "Notes for today — saved when you start"}
        value={notes}
        onChange={(e) => scheduleSave(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          void flushSave().then((saved) => (saved ? onChanged() : undefined), onError);
        }}
      />
      {selectedProject?.linearEnabled && (
        <div className="timer__suggest">
          <SuggestButton
            // A new target drops a reply that was meant for the old one.
            key={`${selectedProject.id}:${target?.day ?? today}:${targetId ?? "draft"}`}
            projectId={selectedProject.id}
            day={target?.day ?? today}
            onSuggested={(text) => scheduleSave(appendLines(notes, text))}
            onError={onError}
          />
        </div>
      )}
    </section>
  );
}
