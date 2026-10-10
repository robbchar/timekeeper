import { useState } from "react";
import { api, Entry } from "../api";
import { dayHeading, DateFormat, DurationFormat, formatDate, formatDuration, formatShort } from "../format";

interface Props {
  entries: Entry[];
  today: string;
  durationFormat: DurationFormat;
  dateFormat: DateFormat;
  onChanged: () => void;
}

export function DayList({ entries, today, durationFormat, dateFormat, onChanged }: Props) {
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
            <span className="day__total">{formatShort(list.reduce((n, e) => n + e.seconds, 0))}</span>
          </div>
          {list.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              durationFormat={durationFormat}
              dateFormat={dateFormat}
              onChanged={onChanged}
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
}: {
  entry: Entry;
  durationFormat: DurationFormat;
  dateFormat: DateFormat;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.notes);

  const save = async () => {
    setEditing(false);
    if (draft.trim() !== entry.notes) {
      await api.setNotes(entry.id, draft);
      onChanged();
    }
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
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") {
                setDraft(entry.notes);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            className={`entry__notes ${entry.notes ? "" : "entry__notes--empty"}`}
            title="Edit notes"
            onClick={() => {
              setDraft(entry.notes);
              setEditing(true);
            }}
          >
            {entry.notes || "Add notes"}
          </button>
        )}
      </div>
      <div className="entry__duration">{formatDuration(entry.seconds, durationFormat)}</div>
      <div className="entry__copy">
        <CopyButton label="Time" text={formatDuration(entry.seconds, durationFormat)} />
        <CopyButton label="Notes" text={entry.notes} />
        <CopyButton label="Date" text={formatDate(entry.day, dateFormat)} />
      </div>
    </div>
  );
}

function CopyButton({ label, text }: { label: string; text: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  return (
    <button
      className={`copy ${state === "done" ? "copy--done" : ""}`}
      title={`Copy: ${text}`}
      disabled={!text}
      onClick={async () => {
        try {
          await api.copy(text);
          setState("done");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 1200);
      }}
    >
      {state === "done" ? "Copied" : state === "failed" ? "Failed" : label}
    </button>
  );
}
