import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, Entry } from "../api";
import { DayList } from "./DayList";

vi.mock("../api", () => ({
  api: {
    setNotes: vi.fn(() => Promise.resolve()),
    deleteEntry: vi.fn(() => Promise.resolve()),
    copy: vi.fn(),
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

const list = (e: Entry, onError: (err: unknown) => void, onChanged = () => Promise.resolve()) => (
  <DayList
    entries={[e]}
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

  it("unlocks the row if it is still listed after the refresh", async () => {
    // The entries prop never changes here, as when a refresh fails after a good delete.
    const { onChanged } = openConfirm();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByTitle("Delete entry")).toHaveFocus());
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("group", { name: "Confirm delete" })).toBeNull();
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
