import { useState } from "react";
import { api } from "../api";

/** `addition` on new lines after `notes`, which are kept as typed. */
export function appendLines(notes: string, addition: string) {
  const kept = notes.trimEnd();
  return kept ? `${kept}\n${addition}` : addition;
}

interface Props {
  projectId: number;
  day: string;
  /** Gets every suggested line, joined with newlines; not called when there are none. */
  onSuggested: (text: string) => void;
  onError: (err: unknown) => void;
}

/** Asks the shell what was done that day and hands the lines over for appending to the notes. */
export function SuggestButton({ projectId, day, onSuggested, onError }: Props) {
  const [state, setState] = useState<"idle" | "busy" | "empty">("idle");

  const suggest = async () => {
    setState("busy");
    try {
      const lines = (await api.suggestNotes(projectId, day)).flatMap((s) => s.lines);
      if (lines.length === 0) {
        setState("empty");
        setTimeout(() => setState("idle"), 1500);
        return;
      }
      onSuggested(lines.join("\n"));
    } catch (err) {
      onError(err);
    }
    setState("idle");
  };

  return (
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
  );
}
