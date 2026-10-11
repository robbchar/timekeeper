import { useState } from "react";
import { Snapshot } from "../api";
import { formatShort } from "../format";

export function StartupNotices({ startup }: { startup: Snapshot["startup"] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const dismiss = (k: string) => setDismissed((d) => new Set(d).add(k));
  const { imported, recovered, importError } = startup;

  return (
    <>
      {imported && !dismissed.has("import") && (
        <div className="notice">
          <span>
            Imported {imported.entries} sessions ({formatShort(imported.seconds)}) across{" "}
            {imported.projects} projects from TimeKeeper v1. Your v1 data was not changed.
            {imported.unclosedSessions > 0 &&
              ` ${imported.unclosedSessions} sessions v1 never closed were imported as finished.`}
          </span>
          <button className="btn btn--ghost" onClick={() => dismiss("import")}>Dismiss</button>
        </div>
      )}
      {importError && !dismissed.has("importError") && (
        <div className="notice notice--error">
          <span>Couldn't import v1 data: {importError}</span>
          <button className="btn btn--ghost" onClick={() => dismiss("importError")}>Dismiss</button>
        </div>
      )}
      {recovered && !dismissed.has("recovered") && (
        <div className="notice">
          <span>
            The {recovered.projectName} timer was still running when TimeKeeper last closed. It was
            stopped at{" "}
            {new Date(recovered.stoppedAt).toLocaleString([], {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
            , the last moment the app was running.
          </span>
          <button className="btn btn--ghost" onClick={() => dismiss("recovered")}>Dismiss</button>
        </div>
      )}
    </>
  );
}
