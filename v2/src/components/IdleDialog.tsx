import { useState } from "react";
import { api, IdlePrompt } from "../api";
import { formatShort } from "../format";

interface Props {
  prompt: IdlePrompt;
  projectName: string | null;
  /** The answer was saved; refresh everything. */
  onAnswered: () => Promise<void>;
  onError: (err: unknown) => void;
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Asks whether to keep time spent away. It can't be dismissed: no close button, Esc or backdrop. */
export function IdleDialog({ prompt, projectName, onAnswered, onError }: Props) {
  const [saving, setSaving] = useState(false);
  const away = (Date.parse(prompt.returnedAt) - Date.parse(prompt.since)) / 1000;

  const answer = async (keep: boolean) => {
    setSaving(true);
    try {
      await api.answerIdlePrompt(keep);
      await onAnswered();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay">
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-body"
      >
        <h2 id="idle-title">You were away</h2>
        <p id="idle-body">
          No activity from {clock(prompt.since)} to {clock(prompt.returnedAt)} ({formatShort(away)})
          while timing {projectName ?? "a project"}. Keep that time?
        </p>
        <div className="dialog__actions">
          <button className="btn" disabled={saving} onClick={() => void answer(false)}>
            Discard
          </button>
          <button
            className="btn btn--primary"
            disabled={saving}
            autoFocus
            onClick={() => void answer(true)}
          >
            Keep
          </button>
        </div>
      </div>
    </div>
  );
}
