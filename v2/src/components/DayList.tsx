import { useEffect, useRef, useState } from "react";
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
import { useInlineEdit } from "./useInlineEdit";

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
  const notes = useInlineEdit(
    entry.notes,
    (n) => n,
    async (draft) => {
      if (draft.trim() === entry.notes) return;
      await api.setNotes(entry.id, draft);
      onChanged();
    },
    onError,
  );
  // A duration being saved, keyed to the seconds it was edited from; dropped once they change.
  const [pending, setPending] = useState<Pending | null>(null);
  if (pending && pending.base !== entry.seconds) setPending(null);
  const seconds = pending?.seconds ?? entry.seconds;
  const [confirming, setConfirming] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  // Set when the confirm closes, so focus goes back to the Delete button instead of the body.
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (!confirming && restoreFocus.current) {
      restoreFocus.current = false;
      deleteButton.current?.focus();
    }
  }, [confirming]);

  const remove = async () => {
    try {
      await api.deleteEntry(entry.id);
    } catch (err) {
      setConfirming(false);
      restoreFocus.current = true;
      onError(err);
      return;
    }
    onChanged();
  };

  return (
    <div className={`entry ${entry.running ? "entry--running" : ""}`}>
      <span className="entry__dot" style={{ background: entry.projectColor ?? "var(--muted)" }} />
      <div className="entry__body">
        <div className="entry__project">{entry.projectName}</div>
        {notes.editing ? (
          <textarea
            className="entry__edit"
            autoFocus
            rows={2}
            value={notes.draft}
            onChange={(e) => notes.setDraft(e.target.value)}
            onBlur={() => void notes.finish()}
            onKeyDown={(e) => {
              // Both keys exit through blur, so finish() runs exactly once.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") notes.cancel(e);
            }}
          />
        ) : (
          <button
            className={`entry__notes ${notes.unsaved ? "entry__notes--unsaved" : entry.notes ? "" : "entry__notes--empty"}`}
            title="Edit notes"
            onClick={notes.open}
          >
            {notes.unsaved ? notes.draft : entry.notes || "Add notes"}
          </button>
        )}
      </div>
      <DurationCell
        entry={entry}
        shown={seconds}
        setPending={setPending}
        durationFormat={durationFormat}
        onChanged={onChanged}
        onError={onError}
      />
      <div className="entry__copy">
        {confirming ? (
          <DeleteConfirm
            onConfirm={() => void remove()}
            onCancel={() => {
              setConfirming(false);
              restoreFocus.current = true;
            }}
          />
        ) : (
          <>
            <CopyButton label="Time" text={formatDuration(seconds, durationFormat)} />
            <CopyButton label="Notes" text={entry.notes} />
            <CopyButton label="Date" text={formatDate(entry.day, dateFormat)} />
            <button
              ref={deleteButton}
              className="copy copy--delete"
              title="Delete entry"
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface Pending {
  seconds: number;
  base: number;
}

function DurationCell({
  entry,
  shown,
  setPending,
  durationFormat,
  onChanged,
  onError,
}: {
  entry: Entry;
  shown: number;
  setPending: (pending: Pending | null) => void;
  durationFormat: DurationFormat;
  onChanged: () => void;
  onError: (err: unknown) => void;
}) {
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const edit = useInlineEdit(
    shown,
    formatClock,
    async (draft) => {
      const seconds = parseDuration(draft);
      if (seconds === null) {
        throw new Error(`"${draft}" isn't a duration: use h:mm or h:mm:ss, up to 24:00:00`);
      }
      if (seconds === shown) return;
      const before = shown === entry.seconds ? null : { seconds: shown, base: entry.seconds };
      setPending({ seconds, base: entry.seconds });
      setSaving(true);
      try {
        await api.setEntrySeconds(entry.id, seconds);
      } catch (err) {
        setPending(before);
        throw err;
      } finally {
        setSaving(false);
      }
      onChanged();
    },
    onError,
  );

  if (entry.running) {
    return <div className="entry__duration">{formatDuration(entry.seconds, durationFormat)}</div>;
  }

  return edit.editing ? (
    <input
      className={`entry__duration entry__duration-edit ${invalid ? "entry__duration-edit--invalid" : ""}`}
      aria-label="Duration"
      aria-invalid={invalid}
      autoFocus
      value={edit.draft}
      onChange={(e) => {
        edit.setDraft(e.target.value);
        setInvalid(false);
      }}
      onBlur={() => {
        setInvalid(false);
        void edit.finish();
      }}
      onKeyDown={(e) => {
        // Both keys exit through blur, so finish() runs exactly once.
        if (e.key === "Enter") {
          e.preventDefault();
          if (parseDuration(edit.draft) === null) setInvalid(true);
          else e.currentTarget.blur();
        }
        if (e.key === "Escape") edit.cancel(e);
      }}
    />
  ) : (
    <button
      className="entry__duration entry__duration-button"
      title="Edit duration (h:mm or h:mm:ss)"
      disabled={saving}
      onClick={edit.open}
    >
      {formatDuration(shown, durationFormat)}
    </button>
  );
}

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div
      className="entry__confirm"
      role="group"
      aria-label="Confirm delete"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onCancel();
      }}
    >
      <span>Delete entry?</span>
      <button
        className="copy copy--delete"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          onConfirm();
        }}
      >
        Delete
      </button>
      <button className="copy" autoFocus disabled={busy} onClick={onCancel}>
        Cancel
      </button>
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
