import { useRef, useState } from "react";
import { api, Entry } from "../api";
import {
  dayHeading,
  DateFormat,
  DurationFormat,
  formatClock,
  formatDate,
  formatDuration,
  formatShort,
  parseDuration,
} from "../format";

interface Props {
  entries: Entry[];
  today: string;
  durationFormat: DurationFormat;
  dateFormat: DateFormat;
  onChanged: () => void;
  onError: (err: unknown) => void;
}

export function DayList({ entries, today, durationFormat, dateFormat, onChanged, onError }: Props) {
  const days: [string, Entry[]][] = [];
  for (const e of entries) {
    const last = days[days.length - 1];
    if (last && last[0] === e.day) last[1].push(e);
    else days.push([e.day, [e]]);
  }

  if (days.length === 0) {
    return <p className="empty">No time recorded in this range yet.</p>;
  }

  return (
    <section className="days">
      {days.map(([day, list]) => (
        <div className="day" key={day}>
          <div className="day__head">
            <h3>{dayHeading(day, today)}</h3>
            <span className="day__total">
              {formatShort(list.reduce((n, e) => n + e.seconds, 0))}
            </span>
          </div>
          {list.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              durationFormat={durationFormat}
              dateFormat={dateFormat}
              onChanged={onChanged}
              onError={onError}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

function EntryRow({
  entry,
  durationFormat,
  dateFormat,
  onChanged,
  onError,
}: {
  entry: Entry;
  durationFormat: DurationFormat;
  dateFormat: DateFormat;
  onChanged: () => void;
  onError: (err: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.notes);
  // Escape leaves through blur too; this tells save() to discard.
  const cancelled = useRef(false);
  // The saved notes a failed draft was based on; the draft is dropped once they change elsewhere.
  const [failedBase, setFailedBase] = useState<string | null>(null);
  const unsaved = failedBase === entry.notes;

  const save = async () => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      setFailedBase(null);
      setDraft(entry.notes);
      return;
    }
    if (draft.trim() !== entry.notes) {
      try {
        await api.setNotes(entry.id, draft);
      } catch (err) {
        setFailedBase(entry.notes);
        onError(err);
        return;
      }
      onChanged();
    }
    setFailedBase(null);
  };

  return (
    <div className={`entry ${entry.running ? "entry--running" : ""}`}>
      <span className="entry__dot" style={{ background: entry.projectColor ?? "var(--muted)" }} />
      <div className="entry__body">
        <div className="entry__project">{entry.projectName}</div>
        {editing ? (
          <textarea
            className="entry__edit"
            autoFocus
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              // Both keys exit through blur, so save() runs exactly once.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                cancelled.current = true;
                e.currentTarget.blur();
              }
            }}
          />
        ) : (
          <button
            className={`entry__notes ${unsaved ? "entry__notes--unsaved" : entry.notes ? "" : "entry__notes--empty"}`}
            title="Edit notes"
            onClick={() => {
              if (!unsaved) setDraft(entry.notes);
              setEditing(true);
            }}
          >
            {unsaved ? draft : entry.notes || "Add notes"}
          </button>
        )}
      </div>
      <DurationCell
        entry={entry}
        durationFormat={durationFormat}
        onChanged={onChanged}
        onError={onError}
      />
      <div className="entry__copy">
        <CopyButton label="Time" text={formatDuration(entry.seconds, durationFormat)} />
        <CopyButton label="Notes" text={entry.notes} />
        <CopyButton label="Date" text={formatDate(entry.day, dateFormat)} />
      </div>
    </div>
  );
}

function DurationCell({
  entry,
  durationFormat,
  onChanged,
  onError,
}: {
  entry: Entry;
  durationFormat: DurationFormat;
  onChanged: () => void;
  onError: (err: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const cancelled = useRef(false);
  // A value being saved, or a failed draft, keyed to the seconds it was edited from.
  const [pending, setPending] = useState<{ seconds: number; base: number } | null>(null);
  const [failedBase, setFailedBase] = useState<number | null>(null);
  const shown = pending?.base === entry.seconds ? pending.seconds : entry.seconds;

  if (entry.running) {
    return <div className="entry__duration">{formatDuration(entry.seconds, durationFormat)}</div>;
  }

  const save = async () => {
    setEditing(false);
    setInvalid(false);
    const seconds = parseDuration(draft);
    if (cancelled.current || seconds === null) {
      cancelled.current = false;
      setFailedBase(null);
      return;
    }
    setFailedBase(null);
    if (seconds === entry.seconds) return;
    const base = entry.seconds;
    setPending({ seconds, base });
    try {
      await api.setEntrySeconds(entry.id, seconds);
    } catch (err) {
      setPending(null);
      setFailedBase(base);
      onError(err);
      return;
    }
    onChanged();
  };

  return editing ? (
    <input
      className={`entry__duration entry__duration-edit ${invalid ? "entry__duration-edit--invalid" : ""}`}
      aria-label="Duration"
      aria-invalid={invalid}
      autoFocus
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        setInvalid(false);
      }}
      onBlur={() => void save()}
      onKeyDown={(e) => {
        // Both keys exit through blur, so save() runs exactly once.
        if (e.key === "Enter") {
          e.preventDefault();
          if (parseDuration(draft) === null) setInvalid(true);
          else e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  ) : (
    <button
      className="entry__duration entry__duration-button"
      title="Edit duration (h:mm or h:mm:ss)"
      onClick={() => {
        if (failedBase !== entry.seconds) setDraft(formatClock(entry.seconds));
        setEditing(true);
      }}
    >
      {formatDuration(shown, durationFormat)}
    </button>
  );
}

function CopyButton({ label, text }: { label: string; text: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  return (
    <button
      className={`copy ${state === "done" ? "copy--done" : ""}`}
      title={`Copy: ${text}`}
      disabled={!text}
      onClick={() =>
        void api
          .copy(text)
          .then(
            () => setState("done"),
            () => setState("failed"),
          )
          .finally(() => setTimeout(() => setState("idle"), 1200))
      }
    >
      {state === "done" ? "Copied" : state === "failed" ? "Failed" : label}
    </button>
  );
}
