import { useState } from "react";
import { api, Project } from "../api";
import { parseDuration } from "../format";

interface Props {
  projects: Project[];
  lastProjectId: number | null;
  today: string;
  onChanged: () => Promise<void>;
  onError: (err: unknown) => void;
}

/** Adds time to a day by hand, for days the timer missed or started late. */
export function AddTimeForm({ projects, lastProjectId, today, onChanged, onError }: Props) {
  const active = projects.filter((p) => !p.archived);
  const defaultProject = active.find((p) => p.id === lastProjectId)?.id ?? active[0]?.id;

  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(defaultProject);
  const [day, setDay] = useState(today);
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const show = () => {
    setProjectId(defaultProject);
    setDay(today);
    setDuration("");
    setNotes("");
    setInvalid(null);
    setOpen(true);
  };

  const submit = async () => {
    const seconds = parseDuration(duration);
    // parseDuration already refuses anything over 24 hours.
    if (!seconds || projectId == null) {
      setInvalid("Enter a duration between 0:00:01 and 24:00 as h:mm, like 1:30.");
      return;
    }
    setBusy(true);
    try {
      await api.addManualTime(projectId, day, seconds, notes);
    } catch (err) {
      onError(err);
      return;
    } finally {
      setBusy(false);
    }
    setOpen(false);
    void onChanged();
  };

  if (!open) {
    return (
      <button className="btn btn--ghost add-time__open" disabled={!active.length} onClick={show}>
        Add time
      </button>
    );
  }

  return (
    <form
      className="add-time"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label>
        Project
        <select value={projectId ?? ""} onChange={(e) => setProjectId(Number(e.target.value))}>
          {active.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Day
        <input
          type="date"
          required
          max={today}
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </label>
      <label>
        Duration
        <input
          autoFocus
          placeholder="h:mm"
          inputMode="numeric"
          aria-invalid={invalid != null}
          value={duration}
          onChange={(e) => {
            setDuration(e.target.value);
            setInvalid(null);
          }}
        />
      </label>
      <label className="add-time__notes">
        Notes
        <input placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {invalid && (
        <p className="add-time__error" role="alert">
          {invalid}
        </p>
      )}
      <div className="add-time__actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          Add
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
