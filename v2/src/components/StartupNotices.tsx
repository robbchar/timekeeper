import { Snapshot } from "../api";
import { formatShort } from "../format";

interface Props {
  startup: Snapshot["startup"];
  dismissed: ReadonlySet<string>;
  onDismiss: (key: string) => void;
}

export function StartupNotices({ startup, dismissed, onDismiss: dismiss }: Props) {
  const { imported, recovered, importError } = startup;
  const skipped = imported ? imported.orphanedSessions + imported.unparseableSessions : 0;

  return (
    <>
      {imported && !dismissed.has("import") && (
        <div className="notice">
          <span>
            Imported {imported.entries} sessions ({formatShort(imported.seconds)}) across{" "}
            {imported.projects} projects from TimeKeeper v1. Your v1 data was not changed.
            {imported.unclosedSessions > 0 &&
              ` ${imported.unclosedSessions} sessions v1 never closed were imported as finished.`}
            {skipped > 0 &&
              ` ${skipped} sessions were skipped because their project was gone or their start time was unreadable.`}
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
