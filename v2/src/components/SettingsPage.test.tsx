import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ImportReport, Snapshot } from "../api";
import { SettingsPage } from "./SettingsPage";

vi.mock("../api", () => ({
  api: {
    importV1Again: vi.fn(),
    backupNow: vi.fn(),
    startAtLogin: vi.fn(() => Promise.resolve(null)),
    linearKeyStatus: vi.fn(() => Promise.resolve(null)),
  },
}));

const snapshot: Snapshot = {
  status: { running: null, elapsedSeconds: 0 },
  projects: [],
  palette: [],
  roundingSteps: [],
  resumeProjectId: null,
  settings: {},
  startup: { recovered: null, imported: null, importError: null },
  dataDir: "C:\\data",
  v1ImportedAt: "2026-10-01T12:00:00Z",
  idleSupported: true,
  idlePrompt: null,
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

function renderPage(snap: Snapshot = snapshot) {
  const onChanged = vi.fn(() => Promise.resolve());
  const onError = vi.fn();
  const onSetting = vi.fn();
  render(
    <SettingsPage snapshot={snap} onSetting={onSetting} onChanged={onChanged} onError={onError} />,
  );
  return { onChanged, onError, onSetting };
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

const backupButton = () => screen.getByRole("button", { name: "Back up now" });

describe("SettingsPage: back up now", () => {
  beforeEach(() => vi.mocked(api.backupNow).mockReset());

  it("shows where the backup went", async () => {
    const path = String.raw`C:\Docs\TimeKeeper backups\timekeeper-2026-10-12_153012.db`;
    vi.mocked(api.backupNow).mockResolvedValueOnce(path);
    renderPage();
    fireEvent.click(backupButton());

    expect(await screen.findByRole("status")).toHaveTextContent(`Backed up to ${path}`);
  });

  it("reports a failed backup", async () => {
    vi.mocked(api.backupNow).mockRejectedValueOnce("disk full");
    const { onError } = renderPage();
    fireEvent.click(backupButton());

    await waitFor(() => expect(onError).toHaveBeenCalledWith("disk full"));
    expect(screen.queryByRole("status")).toBeNull();
    expect(backupButton()).toBeEnabled();
  });

  it("can't be clicked again while a backup is running", async () => {
    let finish: (path: string) => void = () => {};
    vi.mocked(api.backupNow).mockReturnValueOnce(new Promise((res) => (finish = res)));
    renderPage();
    fireEvent.click(backupButton());

    const busy = screen.getByRole("button", { name: "Backing up…" });
    expect(busy).toBeDisabled();
    fireEvent.click(busy);
    expect(api.backupNow).toHaveBeenCalledTimes(1);

    finish("backup.db");
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(backupButton()).toBeEnabled();
  });
});

describe("SettingsPage: idle time", () => {
  const select = () => screen.getByRole("combobox", { name: "Ask after" });

  it("defaults to 20 minutes and saves a change", () => {
    const { onSetting } = renderPage();
    expect(select()).toHaveValue("20");
    fireEvent.change(select(), { target: { value: "0" } });
    expect(onSetting).toHaveBeenCalledWith("idle_minutes", "0");
  });

  it("shows the saved value", () => {
    renderPage({ ...snapshot, settings: { idle_minutes: "45" } });
    expect(select()).toHaveValue("45");
  });

  it("shows a saved value that isn't a preset", () => {
    renderPage({ ...snapshot, settings: { idle_minutes: "25" } });
    expect(select()).toHaveValue("25");
    expect(screen.getByRole("option", { name: "25 minutes idle" })).toBeInTheDocument();
  });

  it("shows the default for a value core would ignore", () => {
    renderPage({ ...snapshot, settings: { idle_minutes: "1.5" } });
    expect(select()).toHaveValue("20");
  });

  it("is hidden where idle time can't be detected", () => {
    renderPage({ ...snapshot, idleSupported: false });
    expect(screen.queryByText("Idle time")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Ask after" })).toBeNull();
  });
});
