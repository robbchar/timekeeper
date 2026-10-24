import { api, ImportReport, Snapshot } from "../api";
import { DATE_FORMATS, DateFormat, DURATION_FORMATS, DurationFormat, formatShort } from "../format";
import { LinearSettings } from "./LinearSettings";
import { ProjectSettings } from "./ProjectSettings";
import { StartAtLogin } from "./StartAtLogin";
import { useBusyAction } from "./useBusyAction";

interface Props {
  snapshot: Snapshot;
  onSetting: (key: string, value: string) => void;
  /** Projects or entries changed (project edits, a v1 import). */
  onChanged: () => Promise<void>;
  onError: (err: unknown) => void;
}

// Matches core's DEFAULT_IDLE_MINUTES; 0 turns the prompt off.
const DEFAULT_IDLE_MINUTES = 20;
const IDLE_MINUTES = [0, 5, 10, 15, 20, 30, 45, 60];

/// Reads the setting as core's `idle_threshold` does: whole minutes up to a day, else the default.
function parseIdleMinutes(value: string | undefined): number {
  const v = value?.trim() ?? "";
  const m = /^[+-]?\d+$/.test(v) ? Number(v) : NaN;
  return m >= 0 && m <= 24 * 60 ? m : DEFAULT_IDLE_MINUTES;
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

function describeImport(r: ImportReport): string {
  const added = [
    r.entries > 0 && `${count(r.entries, "new session")} (${formatShort(r.seconds)})`,
    r.projects > 0 && count(r.projects, "new project"),
  ].filter(Boolean);
  let text = added.length > 0 ? `Imported ${added.join(" and ")}.` : "No new sessions in v1.";
  if (r.stillOpen > 0) {
    const [verb, them] = r.stillOpen === 1 ? ["is", "it"] : ["are", "them"];
    text += ` ${count(r.stillOpen, "session")} ${verb} still open in v1. End ${them} there, then import again.`;
  }
  return text;
}

export function SettingsPage({ snapshot, onSetting, onChanged, onError }: Props) {
  const s = snapshot.settings;
  const durationFormat = (s.duration_format as DurationFormat) ?? "hms";
  const dateFormat = (s.date_format as DateFormat) ?? "iso";
  const weekStart = s.week_start === "sunday" ? "sunday" : "monday";
  const idleMinutes = parseIdleMinutes(s.idle_minutes);
  // A saved value that isn't a preset still shows as itself.
  const idleOptions = IDLE_MINUTES.includes(idleMinutes)
    ? IDLE_MINUTES
    : [...IDLE_MINUTES, idleMinutes].sort((a, b) => a - b);

  const [importAgain, importing, imported] = useBusyAction(async () => {
    const report = await api.importV1Again();
    void onChanged();
    return describeImport(report);
  }, onError);
  const [backUp, backingUp, backedUpTo] = useBusyAction(api.backupNow, onError);

  return (
    <div className="settings-page">
      <ProjectSettings
        projects={snapshot.projects}
        palette={snapshot.palette}
        onChanged={onChanged}
        onError={onError}
      />

      <section className="panel">
        <h2>Copying</h2>
        <p className="panel__hint">
          What the Time and Date buttons on each entry put on the clipboard.
        </p>
        <div className="field">
          <label htmlFor="duration-format">Time</label>
          <select
            id="duration-format"
            value={durationFormat}
            onChange={(e) => onSetting("duration_format", e.target.value)}
          >
            {Object.entries(DURATION_FORMATS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="date-format">Date</label>
          <select
            id="date-format"
            value={dateFormat}
            onChange={(e) => onSetting("date_format", e.target.value)}
          >
            {Object.entries(DATE_FORMATS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="panel">
        <h2>Totals</h2>
        <div className="field">
          <label htmlFor="week-start">Week starts on</label>
          <select
            id="week-start"
            value={weekStart}
            onChange={(e) => onSetting("week_start", e.target.value)}
          >
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </select>
        </div>
      </section>

      {snapshot.idleSupported && (
        <section className="panel">
          <h2>Idle time</h2>
          <div className="field">
            <label htmlFor="idle-minutes">Ask after</label>
            <select
              id="idle-minutes"
              value={idleMinutes}
              onChange={(e) => onSetting("idle_minutes", e.target.value)}
            >
              {idleOptions.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? "Never" : `${m} minutes idle`}
                </option>
              ))}
            </select>
          </div>
          <p className="panel__hint">
            If you come back to a running timer after this long without using the keyboard or mouse,
            TimeKeeper asks whether to keep or discard the time you were away.
          </p>
        </section>
      )}

      <LinearSettings projects={snapshot.projects} onChanged={onChanged} onError={onError} />

      <StartAtLogin onError={onError} />

      <section className="panel">
        <h2>Data</h2>
        <dl className="facts">
          <dt>Stored in</dt>
          <dd>
            <code>{snapshot.dataDir}</code>
          </dd>
          <dt>Last imported from v1</dt>
          <dd>
            {snapshot.v1ImportedAt
              ? new Date(snapshot.v1ImportedAt).toLocaleString()
              : "Not imported"}
          </dd>
        </dl>
        <button
          className="btn btn--ghost panel__action"
          disabled={importing}
          onClick={() => void importAgain()}
        >
          {importing ? "Importing…" : "Import new sessions from v1"}
        </button>
        {imported && (
          <p className="panel__hint" role="status">
            {imported}
          </p>
        )}
        <button
          className="btn btn--ghost panel__action"
          disabled={backingUp}
          onClick={() => void backUp()}
        >
          {backingUp ? "Backing up…" : "Back up now"}
        </button>
        {backedUpTo && (
          <p className="panel__hint" role="status">
            Backed up to <code>{backedUpTo}</code>
          </p>
        )}
      </section>
    </div>
  );
}
