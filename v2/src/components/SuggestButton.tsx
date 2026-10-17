import { useEffect, useRef, useState } from "react";
import { api } from "../api";

/** `addition` on new lines after `notes`, which are kept as typed. */
export function appendLines(notes: string, addition: string) {
  const kept = notes.trimEnd();
  return kept ? `${kept}\n${addition}` : addition;
}

interface Props {
  projectId: number;
  day: string;
  /**
   * Gets every suggested line, joined with newlines; not called when there are none. The callback
   * from the latest render is used, and a reply that arrives after unmount is dropped.
   */
  onSuggested: (text: string) => void;
  onError: (err: unknown) => void;
}

/** Asks the shell what was done that day and hands the lines over for appending to the notes. */
export function SuggestButton({ projectId, day, onSuggested, onError }: Props) {
  const [state, setState] = useState<"idle" | "busy" | "empty">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  // A reply lands after more typing or saving, so it goes to the editor as it is then.
  const latest = useRef({ onSuggested, onError });
  useEffect(() => {
    latest.current = { onSuggested, onError };
  });
  const alive = useRef(true);
  const resetTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(resetTimer.current);
    };
  }, []);

  const suggest = async () => {
    window.clearTimeout(resetTimer.current);
    setState("busy");
    setNotice(null);
    try {
      const found = await api.suggestNotes(projectId, day);
      if (!alive.current) return;
      setNotice(found.flatMap((s) => (s.notice ? [s.notice] : [])).join(" ") || null);
      const lines = found.flatMap((s) => s.lines);
      if (lines.length === 0) {
        setState("empty");
        resetTimer.current = window.setTimeout(() => setState("idle"), 1500);
        return;
      }
      latest.current.onSuggested(lines.join("\n"));
    } catch (err) {
      latest.current.onError(err);
    }
    if (alive.current) setState("idle");
  };

  return (
    <>
      <button
        type="button"
        className="copy suggest"
        title={`Append what you did in Linear on ${day}`}
        disabled={state === "busy"}
        // Keeps focus in the notes being edited, so the suggestion lands in that draft.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void suggest()}
      >
        {state === "busy"
          ? "Asking Linear…"
          : state === "empty"
            ? "Nothing found"
            : "Suggest from Linear"}
      </button>
      {notice && (
        <span className="suggest__notice" role="status">
          {notice}
        </span>
      )}
    </>
  );
}
