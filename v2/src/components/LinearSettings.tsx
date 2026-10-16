import { useEffect, useState } from "react";
import { api, Project } from "../api";
import { useInlineEdit } from "./useInlineEdit";
import { usePending } from "./usePending";

interface Props {
  projects: Project[];
  onChanged: () => Promise<void>;
  onError: (err: unknown) => void;
}

/** What Save or Test found: whose key it is, or why Linear refused it. */
type Outcome = { ok: true; viewer: string } | { ok: false; message: string };

const messageOf = (err: unknown) =>
  typeof err === "string" ? err : err instanceof Error ? err.message : String(err);

/** The Linear key and which projects use Linear. The key itself never reaches the UI. */
export function LinearSettings({ projects, onChanged, onError }: Props) {
  // `undefined` while loading, `null` when no key is saved.
  const [hint, setHint] = useState<string | null>();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    let live = true;
    api.linearKeyStatus().then(
      (status) => {
        if (live) setHint(status?.hint ?? null);
      },
      (err: unknown) => {
        if (live) setHint(null);
        onError(err);
      },
    );
    return () => {
      live = false;
    };
  }, [onError]);

  // Save and Test outcomes are expected results, so they stay in the panel, not the banner.
  const check = async (action: () => Promise<string>) => {
    setBusy(true);
    setOutcome(null);
    try {
      setOutcome({ ok: true, viewer: await action() });
    } catch (err) {
      setOutcome({ ok: false, message: messageOf(err) });
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    check(async () => {
      const connected = await api.saveLinearKey(draft);
      setHint(connected.hint);
      setDraft("");
      return connected.viewer;
    });

  const remove = async () => {
    try {
      await api.removeLinearKey();
    } catch (err) {
      onError(err);
      return;
    }
    setHint(null);
    setOutcome(null);
  };

  return (
    <section className="panel">
      <h2>Linear</h2>
      {hint === null && (
        <>
          <form
            className="linear-key"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <input
              type="password"
              aria-label="Linear personal API key"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="btn btn--ghost" disabled={busy || !draft.trim()}>
              {busy ? "Checking…" : "Save"}
            </button>
          </form>
          <p className="panel__hint">
            Create a personal API key in Linear under Settings → Security &amp; access. It's kept in
            Windows Credential Manager, not in TimeKeeper's database.
          </p>
        </>
      )}
      {hint && (
        <div className="linear-key">
          <span>
            API key <code>••••{hint}</code>
          </span>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => void check(api.testLinearConnection)}
          >
            {busy ? "Checking…" : "Test connection"}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => void remove()}
          >
            Remove
          </button>
        </div>
      )}
      {outcome && (
        <p className={outcome.ok ? "panel__hint" : "linear-error"} role="status">
          {outcome.ok ? `Connected as ${outcome.viewer}` : outcome.message}
        </p>
      )}
      {hint && <LinearProjects projects={projects} onChanged={onChanged} onError={onError} />}
    </section>
  );
}

function LinearProjects({ projects, onChanged, onError }: Props) {
  // Creation order, like ProjectSettings, so rows don't move mid-edit.
  const rows = projects.filter((p) => !p.archived).sort((a, b) => a.id - b.id);
  if (rows.length === 0) return <p className="panel__hint">No active projects yet.</p>;
  return (
    <>
      <p className="panel__hint">
        Turn Linear on for projects whose notes come from Linear. A team key, like LABS, limits
        suggestions to that team.
      </p>
      <ul className="linear-projects">
        {rows.map((p) => (
          <LinearProjectRow key={p.id} project={p} onChanged={onChanged} onError={onError} />
        ))}
      </ul>
    </>
  );
}

function LinearProjectRow({
  project,
  onChanged,
  onError,
}: {
  project: Project;
  onChanged: () => Promise<void>;
  onError: (err: unknown) => void;
}) {
  const enabled = usePending(project.linearEnabled);
  const teamKey = usePending(project.linearTeamKey);

  const team = useInlineEdit(
    teamKey.shown,
    (key) => key ?? "",
    async (draft) => {
      const next = draft.trim().toUpperCase() || null;
      if (next === teamKey.shown) return;
      teamKey.hold(next);
      try {
        await api.setProjectLinear(project.id, enabled.shown, next);
      } catch (err) {
        teamKey.drop();
        throw err;
      }
      void onChanged();
    },
    onError,
  );

  const toggle = async (on: boolean) => {
    enabled.hold(on);
    try {
      await api.setProjectLinear(project.id, on, teamKey.shown);
    } catch (err) {
      enabled.drop();
      onError(err);
      return;
    }
    void onChanged();
  };

  return (
    <li className="linear-project">
      <label className="check">
        <input
          type="checkbox"
          checked={enabled.shown}
          onChange={(e) => void toggle(e.target.checked)}
        />
        {project.name}
      </label>
      <label className="linear-project__team">
        Team
        <input
          aria-label={`Linear team key for ${project.name}`}
          className={team.unsaved ? "linear-project__team--unsaved" : undefined}
          placeholder="Any"
          disabled={!enabled.shown}
          value={team.editing || team.unsaved ? team.draft : (teamKey.shown ?? "")}
          onFocus={team.open}
          onChange={(e) => team.setDraft(e.target.value)}
          onBlur={() => void team.finish()}
          onKeyDown={(e) => {
            // Both keys exit through blur, so finish() runs exactly once.
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") team.cancel(e);
          }}
        />
      </label>
    </li>
  );
}
