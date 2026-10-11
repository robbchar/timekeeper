import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, Entry, Project, Status } from "../api";
import { TimerPanel } from "./TimerPanel";

vi.mock("../api", () => ({
  api: {
    setNotes: vi.fn(() => Promise.resolve()),
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(),
    createProject: vi.fn(),
  },
}));

const acme: Project = { id: 1, name: "Acme", color: null, archived: false };
const beta: Project = { id: 2, name: "Beta", color: null, archived: false };
const lateEntry: Entry = {
  id: 7,
  projectId: 1,
  projectName: "Acme",
  projectColor: null,
  day: "2026-10-09",
  notes: "late fix",
  seconds: 3600,
  running: true,
};
const betaToday: Entry = {
  ...lateEntry,
  id: 8,
  projectId: 2,
  projectName: "Beta",
  day: "2026-10-10",
  notes: "beta notes",
  running: false,
};

const idle: Status = { running: null, elapsedSeconds: 0 };
const runningAcme: Status = {
  running: {
    entryId: 7,
    projectId: 1,
    projectName: "Acme",
    intervalStartedAt: "2026-10-09T23:30:00.000Z",
    priorSeconds: 0,
  },
  elapsedSeconds: 3600,
};

type Props = ComponentProps<typeof TimerPanel>;
const defaults: Props = {
  projects: [acme, beta],
  lastProjectId: 1,
  status: idle,
  liveSeconds: 0,
  entries: [],
  today: "2026-10-10",
  onChanged: () => {},
  onError: () => {},
};

describe("TimerPanel", () => {
  beforeEach(() => {
    vi.mocked(api.setNotes).mockClear();
    vi.mocked(api.start).mockClear();
  });

  it("edits the running entry's notes after the timer crosses midnight", () => {
    render(
      <TimerPanel {...defaults} status={runningAcme} liveSeconds={3600} entries={[lateEntry]} />,
    );

    const notes = screen.getByRole("textbox");
    expect(notes).toHaveValue("late fix");
    fireEvent.change(notes, { target: { value: "late fix, deployed" } });
    fireEvent.blur(notes);
    expect(api.setNotes).toHaveBeenCalledWith(7, "late fix, deployed");
  });

  it("follows a timer started elsewhere", () => {
    const { rerender } = render(<TimerPanel {...defaults} lastProjectId={2} />);
    expect(screen.getByRole("combobox")).toHaveValue("2");
    rerender(<TimerPanel {...defaults} lastProjectId={2} status={runningAcme} />);
    expect(screen.getByRole("combobox")).toHaveValue("1");
  });

  it("loads the notes of the entry for the newly selected project", () => {
    render(<TimerPanel {...defaults} entries={[betaToday]} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } });
    expect(screen.getByRole("textbox")).toHaveValue("beta notes");
  });

  it("reports a failed start and re-enables the button", async () => {
    vi.mocked(api.start).mockRejectedValueOnce("database is locked");
    const onError = vi.fn();
    render(<TimerPanel {...defaults} onError={onError} />);

    const start = screen.getByRole("button", { name: "Start" });
    fireEvent.click(start);
    await waitFor(() => expect(onError).toHaveBeenCalledWith("database is locked"));
    expect(start).toBeEnabled();
  });

  it("reports a failed notes save", async () => {
    vi.mocked(api.setNotes).mockRejectedValueOnce("database is locked");
    const onError = vi.fn();
    render(
      <TimerPanel {...defaults} status={runningAcme} entries={[lateEntry]} onError={onError} />,
    );

    const notes = screen.getByRole("textbox");
    fireEvent.change(notes, { target: { value: "edited" } });
    fireEvent.blur(notes);
    await waitFor(() => expect(onError).toHaveBeenCalledWith("database is locked"));
  });

  it("keeps the timer running when saving notes on Stop fails", async () => {
    vi.mocked(api.setNotes).mockRejectedValueOnce("database is locked");
    vi.mocked(api.stop).mockClear();
    const onError = vi.fn();
    const onChanged = vi.fn();
    render(
      <TimerPanel
        {...defaults}
        status={runningAcme}
        entries={[lateEntry]}
        onChanged={onChanged}
        onError={onError}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "edited" } });
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("database is locked"));
    expect(api.stop).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue("edited");
  });
});
