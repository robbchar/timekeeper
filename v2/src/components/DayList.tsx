import { useRef, useState } from "react";
import { api, Entry } from "../api";
import {
  dayHeading,
  DateFormat,
  DurationFormat,
  formatDate,
  formatDuration,
  formatShort,
} from "../format";

interface Props {
  entries: Entry[];
  today: string;
  durationFormat: DurationFormat;
  dateFormat: DateFormat;
  onChanged: () => Promise<void>;
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
  onChanged: () => Promise<void>;
  onError: (err: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.notes);
  // Escape leaves through blur too; this tells save() to discard.
  const cancelled = useRef(false);
  // The saved notes a failed draft was based on; the draft is dropped once they change elsewhere.
  const [failedBase, setFailedBase] = useState<string | null>(null);
  const unsaved = failedBase === entry.notes;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Hidden once deleted, so a stale or failed refresh can't offer it again.
  const [deleted, setDeleted] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  // Set when the confirm closes, so focus goes back to the Delete button instead of the body.
  const restoreFocus = useRef(false);

  const closeConfirm = () => {
    restoreFocus.current = true;
    setConfirming(false);
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.deleteEntry(entry.id);
    } catch (err) {
      setDeleting(false);
      closeConfirm();
      onError(err);
      return;
    }
    focusNeighbour();
    setDeleted(true);
    void onChanged();
  };

  // Hands focus to the next row's Delete (or the previous one), not the body.
  const focusNeighbour = () => {
    const self = row.current;
    if (!self) return;
    const others = Array.from(
      self.closest(".days")?.querySelectorAll<HTMLButtonElement>(".copy--delete") ?? [],
    ).filter((b) => !self.contains(b));
    const next =
      others.find((b) => self.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ??
      others[others.length - 1];
    next?.focus();
  };

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
      void onChanged();
    }
    setFailedBase(null);
  };

  if (deleted) return null;

  return (
    <div ref={row} className={`entry ${entry.running ? "entry--running" : ""}`}>
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
      <div className="entry__duration">{formatDuration(entry.seconds, durationFormat)}</div>
      <div className="entry__copy">
        {confirming ? (
          <DeleteConfirm busy={deleting} onConfirm={() => void remove()} onCancel={closeConfirm} />
        ) : (
          <>
            <CopyButton label="Time" text={formatDuration(entry.seconds, durationFormat)} />
            <CopyButton label="Notes" text={entry.notes} />
            <CopyButton label="Date" text={formatDate(entry.day, dateFormat)} />
            <button
              ref={(el) => {
                if (el && restoreFocus.current) {
                  restoreFocus.current = false;
                  el.focus();
                }
              }}
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

function DeleteConfirm({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
      <button className="copy copy--delete" disabled={busy} onClick={onConfirm}>
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
