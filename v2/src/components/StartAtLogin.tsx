import { useEffect, useState } from "react";
import { api } from "../api";

interface Props {
  onError: (err: unknown) => void;
}

/** The "start when I log in" setting; hidden where the OS doesn't support it. */
export function StartAtLogin({ onError }: Props) {
  // `undefined` while loading, `null` where unsupported.
  const [enabled, setEnabled] = useState<boolean | null>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    api.startAtLogin().then(
      (on) => {
        if (live) setEnabled(on);
      },
      (err: unknown) => {
        // A toggle that can't be read can't be trusted either.
        if (live) setEnabled(null);
        onError(err);
      },
    );
    return () => {
      live = false;
    };
  }, [onError]);

  if (enabled === null) return null;

  const toggle = async (on: boolean) => {
    setSaving(true);
    try {
      await api.setStartAtLogin(on);
      setEnabled(on);
    } catch (err) {
      onError(err);
      // A failure may have landed halfway, so show what Windows has now.
      setEnabled(await api.startAtLogin().catch(() => null));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel">
      <h2>Startup</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={enabled ?? false}
          disabled={enabled === undefined || saving}
          onChange={(e) => void toggle(e.target.checked)}
        />
        Start TimeKeeper when I log in
      </label>
      <p className="panel__hint">It starts in the tray, without opening the window.</p>
    </section>
  );
}
