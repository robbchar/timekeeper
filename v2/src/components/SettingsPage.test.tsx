import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ImportReport, Snapshot } from "../api";
import { SettingsPage } from "./SettingsPage";

vi.mock("../api", () => ({
  api: { importV1Again: vi.fn() },
}));

const snapshot: Snapshot = {
  status: { running: null, elapsedSeconds: 0 },
  projects: [],
  lastProjectId: null,
  settings: {},
  startup: { recovered: null, imported: null, importError: null },
  dataDir: "C:\\data",
  v1ImportedAt: "2026-10-01T12:00:00Z",
};

const report = (r: Partial<ImportReport>): ImportReport => ({
  projects: 0,
  entries: 0,
  seconds: 0,
  unclosedSessions: 0,
  missingDurations: 0,
  alreadyImported: 0,
  orphanedSessions: 0,
  unparseableSessions: 0,
  stillOpen: 0,
  ...r,
});

function renderPage() {
  const onChanged = vi.fn(() => Promise.resolve());
  const onError = vi.fn();
  render(
    <SettingsPage snapshot={snapshot} onChange={vi.fn()} onChanged={onChanged} onError={onError} />,
  );
  return { onChanged, onError };
}

const importButton = () => screen.getByRole("button", { name: "Import new sessions from v1" });

describe("SettingsPage: import new sessions from v1", () => {
  beforeEach(() => vi.mocked(api.importV1Again).mockReset());

  it("reports the new sessions and refreshes", async () => {
    vi.mocked(api.importV1Again).mockResolvedValueOnce(report({ entries: 3, seconds: 8100 }));
    const { onChanged } = renderPage();
    fireEvent.click(importButton());

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Imported 3 new sessions (2h 15m).",
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("mentions new projects only when there are some", async () => {
    vi.mocked(api.importV1Again).mockResolvedValueOnce(
      report({ entries: 1, seconds: 1800, projects: 1 }),
    );
    renderPage();
    fireEvent.click(importButton());

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Imported 1 new session (30m) and 1 new project.",
    );
  });

  it("reports new projects even without new sessions", async () => {
    vi.mocked(api.importV1Again).mockResolvedValueOnce(report({ projects: 2 }));
    renderPage();
    fireEvent.click(importButton());

    expect(await screen.findByRole("status")).toHaveTextContent("Imported 2 new projects.");
  });

  it("says when v1 has nothing new", async () => {
    vi.mocked(api.importV1Again).mockResolvedValueOnce(report({ alreadyImported: 12 }));
    renderPage();
    fireEvent.click(importButton());

    expect(await screen.findByRole("status")).toHaveTextContent("No new sessions in v1.");
  });

  it("says which sessions wait until they're ended in v1", async () => {
    vi.mocked(api.importV1Again).mockResolvedValueOnce(report({ stillOpen: 2 }));
    renderPage();
    fireEvent.click(importButton());

    expect(await screen.findByRole("status")).toHaveTextContent(
      "No new sessions in v1. 2 sessions are still open in v1. End them there, then import again.",
    );
  });

  it("reports a failed import without refreshing", async () => {
    vi.mocked(api.importV1Again).mockRejectedValueOnce("no v1 database at C:\\v1.db");
    const { onChanged, onError } = renderPage();
    fireEvent.click(importButton());

    await waitFor(() => expect(onError).toHaveBeenCalledWith("no v1 database at C:\\v1.db"));
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
    expect(importButton()).toBeEnabled();
  });

  it("can't be clicked again while an import is running", async () => {
    let finish: (r: ImportReport) => void = () => {};
    vi.mocked(api.importV1Again).mockReturnValueOnce(new Promise((res) => (finish = res)));
    renderPage();
    fireEvent.click(importButton());

    const busy = screen.getByRole("button", { name: "Importing…" });
    expect(busy).toBeDisabled();
    fireEvent.click(busy);
    expect(api.importV1Again).toHaveBeenCalledTimes(1);

    finish(report({}));
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(importButton()).toBeEnabled();
  });
});
