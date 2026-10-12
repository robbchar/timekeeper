import { Snapshot } from "../api";
import { DATE_FORMATS, DateFormat, DURATION_FORMATS, DurationFormat } from "../format";
import { ProjectSettings } from "./ProjectSettings";

interface Props {
  snapshot: Snapshot;
  onChange: (key: string, value: string) => void;
  onChanged: () => void;
  onError: (err: unknown) => void;
}

export function SettingsPage({ snapshot, onChange, onChanged, onError }: Props) {
  const s = snapshot.settings;
  const durationFormat = (s.duration_format as DurationFormat) ?? "hms";
  const dateFormat = (s.date_format as DateFormat) ?? "iso";
  const weekStart = s.week_start === "sunday" ? "sunday" : "monday";

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
            onChange={(e) => onChange("duration_format", e.target.value)}
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
            onChange={(e) => onChange("date_format", e.target.value)}
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
            onChange={(e) => onChange("week_start", e.target.value)}
          >
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </select>
        </div>
      </section>

      <section className="panel">
        <h2>Data</h2>
        <dl className="facts">
          <dt>Stored in</dt>
          <dd>
            <code>{snapshot.dataDir}</code>
          </dd>
          <dt>Imported from v1</dt>
          <dd>
            {snapshot.v1ImportedAt
              ? new Date(snapshot.v1ImportedAt).toLocaleString()
              : "Not imported"}
          </dd>
        </dl>
      </section>
    </div>
  );
}
