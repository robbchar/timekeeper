import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, Entry, ImportReport, Snapshot } from "./api";
import App from "./App";
import { localDay } from "./format";

vi.mock("./api", () => ({
  api: {
    snapshot: vi.fn(),
    entries: vi.fn(),
    totals: vi.fn(),
    setSetting: vi.fn(() => Promise.resolve()),
    onTimerChanged: vi.fn(() => Promise.resolve(() => {})),
  },
}));

const imported: ImportReport = {
  projects: 1,
  entries: 2,
  seconds: 7200,
  unclosedSessions: 0,
  missingDurations: 0,
  alreadyImported: 0,
  orphanedSessions: 0,
  unparseableSessions: 0,
};

const snapshot: Snapshot = {
  status: { running: null, elapsedSeconds: 0 },
  projects: [
    { id: 1, name: "Acme", color: null, archived: false },
    { id: 2, name: "Beta", color: null, archived: false },
  ],
  lastProjectId: 1,
  settings: {},
  startup: { recovered: null, imported, importError: null },
  dataDir: "test",
  v1ImportedAt: null,
};

const entryWithNotes = (id: number, notes: string): Entry => ({
  id,
  projectId: 1,
  projectName: "Acme",
  projectColor: null,
  day: localDay(),
  notes,
  seconds: 60,
  running: false,
});

beforeEach(() => {
  vi.mocked(api.snapshot).mockReset().mockResolvedValue(snapshot);
  vi.mocked(api.entries).mockReset().mockResolvedValue([]);
  vi.mocked(api.totals)
    .mockReset()
    .mockResolvedValue({ today: 0, thisWeek: 0, thisMonth: 0, lastMonth: 0 });
});

describe("App", () => {
  it("fetches once on mount", async () => {
    render(<App />);
    await screen.findByText("TimeKeeper");
    expect(api.snapshot).toHaveBeenCalledTimes(1);
  });

  it("keeps a dismissed startup notice dismissed after visiting Settings", async () => {
    render(<App />);
    await screen.findByText(/Imported 2 sessions/);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByText(/Imported 2 sessions/)).not.toBeInTheDocument();
  });

  it("ignores an older refresh that resolves after a newer one", async () => {
    render(<App />);
    await screen.findByText("TimeKeeper");

    let resolveStale!: (e: Entry[]) => void;
    let resolveFresh!: (e: Entry[]) => void;
    vi.mocked(api.entries)
      .mockReturnValueOnce(new Promise((r) => (resolveStale = r)))
      .mockReturnValueOnce(new Promise((r) => (resolveFresh = r)));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    fireEvent.change(screen.getByDisplayValue("All projects"), { target: { value: "2" } });

    await act(async () => resolveFresh([entryWithNotes(2, "fresh")]));
    await act(async () => resolveStale([entryWithNotes(1, "stale")]));

    expect(screen.getByTitle("Edit notes")).toHaveTextContent("fresh");
  });
});
