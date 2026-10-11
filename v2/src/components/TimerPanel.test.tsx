import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, Entry, Project } from "../api";
import { TimerPanel } from "./TimerPanel";

vi.mock("../api", () => ({
  api: { setNotes: vi.fn(() => Promise.resolve()), start: vi.fn(), stop: vi.fn(), createProject: vi.fn() },
}));

const project: Project = { id: 1, name: "Acme", color: null, archived: false };
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

describe("TimerPanel", () => {
  beforeEach(() => vi.mocked(api.setNotes).mockClear());

  it("edits the running entry's notes after the timer crosses midnight", () => {
    render(
      <TimerPanel
        projects={[project]}
        lastProjectId={1}
        status={{
          running: {
            entryId: 7,
            projectId: 1,
            projectName: "Acme",
            intervalStartedAt: "2026-10-09T23:30:00.000Z",
            priorSeconds: 0,
          },
          elapsedSeconds: 3600,
        }}
        liveSeconds={3600}
        entries={[lateEntry]}
        today="2026-10-10"
        onChanged={() => {}}
      />,
    );

    const notes = screen.getByRole("textbox");
    expect(notes).toHaveValue("late fix");
    fireEvent.change(notes, { target: { value: "late fix, deployed" } });
    fireEvent.blur(notes);
    expect(api.setNotes).toHaveBeenCalledWith(7, "late fix, deployed");
  });
});
