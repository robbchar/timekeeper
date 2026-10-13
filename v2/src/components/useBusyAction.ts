import { useState } from "react";

/** Runs `action` behind a busy flag (to disable its button) and keeps its last result. */
export function useBusyAction(action: () => Promise<string>, onError: (err: unknown) => void) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      setResult(await action());
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  };

  return [run, busy, result] as const;
}
