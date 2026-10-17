import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, Entry, Project, Status, Suggestion } from "../api";
import { TimerPanel } from "./TimerPanel";

vi.mock("../api", () => ({
  api: {
    setNotes: vi.fn(() => Promise.resolve()),
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(),
    createProject: vi.fn(),
    suggestNotes: vi.fn(() =>
      Promise.resolve([{ source: "linear", lines: ["LABS-1 T — commented"], notice: null }]),
    ),
  },
}));

const acme: Project = {
  id: 1,
  name: "Acme",
  color: null,
  archived: false,
  linearEnabled: false,
  linearTeamKey: null,
};
const beta: Project = {
  id: 2,
  name: "Beta",
  color: null,
  archived: false,
  linearEnabled: false,
  linearTeamKey: null,
};
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
  resumeProjectId: 1,
  status: idle,
  liveSeconds: 0,
  entries: [],
  today: "2026-10-10",
  onChanged: () => Promise.resolve(),
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
    const { rerender } = render(<TimerPanel {...defaults} resumeProjectId={2} />);
    expect(screen.getByRole("combobox")).toHaveValue("2");
    rerender(<TimerPanel {...defaults} resumeProjectId={2} status={runningAcme} />);
    expect(screen.getByRole("combobox")).toHaveValue("1");
  });

  it("hides archived projects", () => {
    render(
      <TimerPanel
        {...defaults}
        projects={[{ ...acme, archived: true }, beta]}
        resumeProjectId={2}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("2");
    expect(screen.queryByRole("option", { name: "Acme" })).toBeNull();
  });

  it("falls back to the resume project when an archived timer stops", () => {
    const gamma: Project = {
      id: 3,
      name: "Gamma",
      color: null,
      archived: false,
      linearEnabled: false,
      linearTeamKey: null,
    };
    // Gamma, not the first active project, so the test pins the resume project.
    const props = {
      ...defaults,
      projects: [{ ...acme, archived: true }, beta, gamma],
      resumeProjectId: 3,
    };
    const { rerender } = render(
      <TimerPanel {...props} status={runningAcme} entries={[lateEntry]} />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("1");
    rerender(<TimerPanel {...props} />);
    expect(screen.getByRole("combobox")).toHaveValue("3");
    expect(screen.queryByRole("option", { name: "Acme" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(api.start).toHaveBeenCalledWith(3, "");
  });

  it("offers the new-project form once a stopped archived timer leaves nothing to pick", () => {
    const props = { ...defaults, projects: [{ ...acme, archived: true }], resumeProjectId: null };
    const { rerender } = render(
      <TimerPanel {...props} status={runningAcme} entries={[lateEntry]} />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("1");
    rerender(<TimerPanel {...props} />);
    expect(screen.getByPlaceholderText("New project name")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("keeps a just-added project and the draft notes while the list refreshes", async () => {
    const gamma: Project = {
      id: 3,
      name: "Gamma",
      color: null,
      archived: false,
      linearEnabled: false,
      linearTeamKey: null,
    };
    vi.mocked(api.createProject).mockResolvedValueOnce(gamma);
    const acmeToday: Entry = { ...betaToday, id: 9, projectId: 1, projectName: "Acme" };
    // Acme, the resume project, has an entry today; switching to it would replace the draft.
    const props = { ...defaults, entries: [acmeToday] };
    const { rerender } = render(<TimerPanel {...props} />);
    const notes = () => screen.getByPlaceholderText(/^(Notes for today|What are you working on)/);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } });
    fireEvent.change(notes(), { target: { value: "draft" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "-1" } });
    fireEvent.change(screen.getByPlaceholderText("New project name"), {
      target: { value: "Gamma" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    // Listed and selected before the refresh brings it in, so Start times what the picker shows.
    expect(await screen.findByRole("combobox")).toHaveValue("3");
    expect(screen.getByRole("option", { name: "Gamma" })).toBeInTheDocument();
    expect(notes()).toHaveValue("draft");

    rerender(<TimerPanel {...props} projects={[acme, beta, gamma]} />);
    expect(screen.getByRole("combobox")).toHaveValue("3");
    expect(screen.getAllByRole("option", { name: "Gamma" })).toHaveLength(1);
    expect(notes()).toHaveValue("draft");
  });

  it("keeps the running project listed after it is archived", () => {
    render(
      <TimerPanel
        {...defaults}
        projects={[{ ...acme, archived: true }, beta]}
        status={runningAcme}
        entries={[lateEntry]}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("1");
    expect(screen.getByRole("option", { name: "Acme" })).toBeInTheDocument();
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
    const onChanged = vi.fn(() => Promise.resolve());
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

describe("TimerPanel Linear suggestions", () => {
  beforeEach(() => {
    vi.mocked(api.setNotes).mockClear();
    vi.mocked(api.suggestNotes).mockClear();
  });

  const linearAcme = { ...acme, linearEnabled: true };

  it("is only offered for projects with Linear turned on", () => {
    const { rerender } = render(<TimerPanel {...defaults} />);
    expect(screen.queryByRole("button", { name: "Suggest from Linear" })).toBeNull();
    rerender(<TimerPanel {...defaults} projects={[linearAcme, beta]} />);
    expect(screen.getByRole("button", { name: "Suggest from Linear" })).toBeInTheDocument();
  });

  it("appends to the running entry's notes for its own day, and saves", async () => {
    render(
      <TimerPanel
        {...defaults}
        projects={[linearAcme, beta]}
        status={runningAcme}
        entries={[lateEntry]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Suggest from Linear" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox")).toHaveValue("late fix\nLABS-1 T — commented"),
    );
    expect(api.suggestNotes).toHaveBeenCalledWith(1, "2026-10-09");
    await waitFor(() =>
      expect(api.setNotes).toHaveBeenCalledWith(7, "late fix\nLABS-1 T — commented"),
    );
  });

  it("adds to a draft for today before the timer starts", async () => {
    render(<TimerPanel {...defaults} projects={[linearAcme, beta]} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "planning" } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest from Linear" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox")).toHaveValue("planning\nLABS-1 T — commented"),
    );
    expect(api.suggestNotes).toHaveBeenCalledWith(1, "2026-10-10");
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(api.start).toHaveBeenCalledWith(1, "planning\nLABS-1 T — commented");
  });
  it("drops a suggestion that arrives after switching to another entry", async () => {
    let resolve: (v: Suggestion[]) => void = () => {};
    vi.mocked(api.suggestNotes).mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const acmeToday = { ...betaToday, id: 9, projectId: 1, notes: "acme notes" };
    render(
      <TimerPanel
        {...defaults}
        projects={[linearAcme, { ...beta, linearEnabled: true }]}
        entries={[acmeToday, betaToday]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Suggest from Linear" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2" } });
    await act(async () =>
      resolve([{ source: "linear", lines: ["LABS-1 T — commented"], notice: null }]),
    );
    expect(screen.getByRole("textbox")).toHaveValue("beta notes");
  });
});
