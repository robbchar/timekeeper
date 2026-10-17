import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, Entry, Project } from "../api";
import { DayList } from "./DayList";

vi.mock("../api", () => ({
  api: {
    setNotes: vi.fn(() => Promise.resolve()),
    setEntrySeconds: vi.fn(() => Promise.resolve()),
    deleteEntry: vi.fn(() => Promise.resolve()),
    copy: vi.fn(),
    suggestNotes: vi.fn(() =>
      Promise.resolve([{ source: "linear", lines: ["LABS-1 T — commented"] }]),
    ),
  },
}));

const entry: Entry = {
  id: 3,
  projectId: 1,
  projectName: "Acme",
  projectColor: null,
  day: "2026-10-10",
  notes: "original",
  seconds: 600,
  running: false,
};

const acme: Project = {
  id: 1,
  name: "Acme",
  color: null,
  archived: false,
  linearEnabled: false,
  linearTeamKey: null,
};

const list = (
  e: Entry,
  onError: (err: unknown) => void,
  onChanged = () => Promise.resolve(),
  projects = [acme],
) => (
  <DayList
    entries={[e]}
    projects={projects}
    today="2026-10-10"
    durationFormat="hms"
    dateFormat="iso"
    onChanged={onChanged}
    onError={onError}
  />
);

function editNotes(value: string, onError = vi.fn()) {
  const { rerender } = render(list(entry, onError));
  fireEvent.click(screen.getByTitle("Edit notes"));
  const box = screen.getByRole("textbox");
  fireEvent.change(box, { target: { value } });
  return { box, rerender };
}

describe("DayList notes editing", () => {
  beforeEach(() => vi.mocked(api.setNotes).mockClear());

  it("Escape discards the edit even though it leaves through blur", () => {
    const { box } = editNotes("changed");
    fireEvent.keyDown(box, { key: "Escape" });
    expect(api.setNotes).not.toHaveBeenCalled();
    expect(screen.getByTitle("Edit notes")).toHaveTextContent("original");
  });

  it("Enter saves exactly once", () => {
    const { box } = editNotes("changed");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(api.setNotes).toHaveBeenCalledTimes(1);
    expect(api.setNotes).toHaveBeenCalledWith(3, "changed");
  });

  it("reports a failed save and keeps the draft", async () => {
    vi.mocked(api.setNotes).mockRejectedValueOnce("database is locked");
    const onError = vi.fn();
    const { box } = editNotes("changed", onError);
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(onError).toHaveBeenCalledWith("database is locked"));
    fireEvent.click(screen.getByTitle("Edit notes"));
    expect(screen.getByRole("textbox")).toHaveValue("changed");
  });

  it("shows a failed draft in the row until the notes change elsewhere", async () => {
    vi.mocked(api.setNotes).mockRejectedValueOnce("database is locked");
    const onError = vi.fn();
    const { box, rerender } = editNotes("changed", onError);
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(onError).toHaveBeenCalled());
    const row = screen.getByTitle("Edit notes");
    expect(row).toHaveTextContent("changed");
    expect(row).toHaveClass("entry__notes--unsaved");

    rerender(list({ ...entry, notes: "newer" }, onError));
    expect(screen.getByTitle("Edit notes")).toHaveTextContent("newer");
    fireEvent.click(screen.getByTitle("Edit notes"));
    expect(screen.getByRole("textbox")).toHaveValue("newer");
  });
});

describe("DayList duration editing", () => {
  beforeEach(() => vi.mocked(api.setEntrySeconds).mockClear());

  function editDuration(value: string, { onError = vi.fn(), onChanged = vi.fn() } = {}) {
    const view = render(list(entry, onError, onChanged));
    fireEvent.click(screen.getByTitle(/Edit duration/));
    const box = screen.getByLabelText("Duration");
    fireEvent.change(box, { target: { value } });
    return { ...view, box, onError, onChanged };
  }

  it("opens prefilled as h:mm:ss", () => {
    render(list(entry, vi.fn()));
    fireEvent.click(screen.getByTitle(/Edit duration/));
    expect(screen.getByLabelText("Duration")).toHaveValue("0:10:00");
  });

  it("Enter saves h:mm, shows the new value at once and refreshes", async () => {
    const { box, onChanged } = editDuration("1:30");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(api.setEntrySeconds).toHaveBeenCalledTimes(1);
    expect(api.setEntrySeconds).toHaveBeenCalledWith(3, 5400);
    expect(screen.getByTitle(/Edit duration/)).toHaveTextContent("01:30:00");
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("accepts h:mm:ss", () => {
    const { box } = editDuration("0:05:30");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(api.setEntrySeconds).toHaveBeenCalledWith(3, 330);
  });

  it("Escape discards the edit even though it leaves through blur", () => {
    const { box } = editDuration("1:30");
    fireEvent.keyDown(box, { key: "Escape" });
    expect(api.setEntrySeconds).not.toHaveBeenCalled();
    expect(screen.getByTitle(/Edit duration/)).toHaveTextContent("00:10:00");
  });

  it("Enter on an invalid value keeps editing and marks it invalid", () => {
    const { box } = editDuration("1.5");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(api.setEntrySeconds).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Duration")).toHaveAttribute("aria-invalid", "true");
  });

  it("does not save an unchanged value", () => {
    const { box } = editDuration("0:10:00");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(api.setEntrySeconds).not.toHaveBeenCalled();
  });

  it("reports a failed save, reverts the display and keeps the draft", async () => {
    vi.mocked(api.setEntrySeconds).mockRejectedValueOnce("database is locked");
    const { box, onError, onChanged } = editDuration("1:30");
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(onError).toHaveBeenCalledWith("database is locked"));
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByTitle(/Edit duration/)).toHaveTextContent("00:10:00");
    fireEvent.click(screen.getByTitle(/Edit duration/));
    expect(screen.getByLabelText("Duration")).toHaveValue("1:30");
  });

  it("click-away on an invalid value reports it and keeps the draft", async () => {
    const { box, onError } = editDuration("1.5");
    fireEvent.blur(box);
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(api.setEntrySeconds).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTitle(/Edit duration/));
    expect(screen.getByLabelText("Duration")).toHaveValue("1.5");
  });

  it("can't be reopened while saving, and Copy Time follows the shown value", async () => {
    let resolve = () => {};
    vi.mocked(api.setEntrySeconds).mockReturnValueOnce(new Promise<void>((r) => (resolve = r)));
    const { box, onChanged } = editDuration("1:30");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByTitle(/Edit duration/)).toBeDisabled();
    expect(screen.getByTitle("Copy: 01:30:00")).toBeInTheDocument();
    resolve();
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(screen.getByTitle(/Edit duration/)).toBeEnabled();
    fireEvent.click(screen.getByTitle(/Edit duration/));
    expect(screen.getByLabelText("Duration")).toHaveValue("1:30:00");
  });

  it("drops the saved value once the entry's seconds change", async () => {
    const onChanged = vi.fn();
    const { box, rerender } = editDuration("1:30", { onChanged });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    rerender(list({ ...entry, seconds: 5400 }, vi.fn()));
    rerender(list(entry, vi.fn()));
    expect(screen.getByTitle(/Edit duration/)).toHaveTextContent("00:10:00");
  });

  it("is not editable while the entry is running", () => {
    render(list({ ...entry, running: true }, vi.fn()));
    expect(screen.queryByTitle(/Edit duration/)).toBeNull();
    expect(screen.getByText("00:10:00")).toBeInTheDocument();
  });
});

describe("DayList deleting", () => {
  beforeEach(() => vi.mocked(api.deleteEntry).mockClear());

  function openConfirm(e = entry) {
    const onError = vi.fn();
    const onChanged = vi.fn(() => Promise.resolve());
    render(list(e, onError, onChanged));
    fireEvent.click(screen.getByTitle("Delete entry"));
    return { onError, onChanged, group: screen.getByRole("group", { name: "Confirm delete" }) };
  }

  it("asks before deleting and focuses Cancel", () => {
    openConfirm();
    expect(api.deleteEntry).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("deletes on confirm and refreshes", async () => {
    const { onChanged } = openConfirm();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(api.deleteEntry).toHaveBeenCalledWith(3);
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("Cancel keeps the entry and returns focus to Delete", () => {
    openConfirm();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.deleteEntry).not.toHaveBeenCalled();
    expect(screen.getByTitle("Delete entry")).toHaveFocus();
  });

  it("Escape cancels", () => {
    const { group } = openConfirm();
    fireEvent.keyDown(group, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Confirm delete" })).toBeNull();
    expect(api.deleteEntry).not.toHaveBeenCalled();
    expect(screen.getByTitle("Delete entry")).toHaveFocus();
  });

  it("locks the confirm while the delete is in flight", () => {
    vi.mocked(api.deleteEntry).mockReturnValueOnce(new Promise(() => {}));
    const { group } = openConfirm();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.keyDown(group, { key: "Escape" });
    expect(screen.getByRole("group", { name: "Confirm delete" })).toBeInTheDocument();
  });

  it("hides a deleted row even if the refresh leaves it listed", async () => {
    // The entries prop never changes here, as when a refresh fails or is superseded.
    const { onChanged } = openConfirm();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("original")).toBeNull());
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByTitle("Delete entry")).toBeNull();
    expect(api.deleteEntry).toHaveBeenCalledTimes(1);
  });

  it("moves focus to the next row's Delete after a delete", async () => {
    const other = { ...entry, id: 4, notes: "other" };
    render(
      <DayList
        entries={[entry, other]}
        projects={[acme]}
        today="2026-10-10"
        durationFormat="hms"
        dateFormat="iso"
        onChanged={() => Promise.resolve()}
        onError={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByTitle("Delete entry")[0]);
    const group = screen.getByRole("group", { name: "Confirm delete" });
    fireEvent.click(within(group).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("original")).toBeNull());
    expect(screen.getByTitle("Delete entry")).toHaveFocus();
  });

  it("reports a refused delete of the running entry", async () => {
    vi.mocked(api.deleteEntry).mockRejectedValueOnce("stop the timer before deleting entry 3");
    const { onError, onChanged } = openConfirm({ ...entry, running: true });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith("stop the timer before deleting entry 3"),
    );
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByTitle("Delete entry")).toHaveFocus();
  });
});

describe("DayList Linear suggestions", () => {
  beforeEach(() => {
    vi.mocked(api.setNotes).mockClear();
    vi.mocked(api.suggestNotes).mockClear();
  });

  const linear = [{ ...acme, linearEnabled: true }];

  it("is only offered for entries of projects with Linear turned on", () => {
    const { rerender } = render(list(entry, vi.fn()));
    expect(screen.queryByRole("button", { name: "Suggest from Linear" })).toBeNull();
    rerender(list(entry, vi.fn(), undefined, linear));
    expect(screen.getByRole("button", { name: "Suggest from Linear" })).toBeInTheDocument();
  });

  it("opens the notes with the suggestion appended, saved on blur", async () => {
    render(list(entry, vi.fn(), undefined, linear));
    fireEvent.click(screen.getByRole("button", { name: "Suggest from Linear" }));
    const box = await screen.findByRole("textbox");
    expect(box).toHaveValue("original\nLABS-1 T — commented");
    expect(api.suggestNotes).toHaveBeenCalledWith(1, "2026-10-10");
    expect(api.setNotes).not.toHaveBeenCalled();
    fireEvent.blur(box);
    expect(api.setNotes).toHaveBeenCalledWith(3, "original\nLABS-1 T — commented");
  });

  it("appends to a draft that's already being edited", async () => {
    render(list(entry, vi.fn(), undefined, linear));
    fireEvent.click(screen.getByTitle("Edit notes"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "typed" } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest from Linear" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox")).toHaveValue("typed\nLABS-1 T — commented"),
    );
  });
});
