import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, Entry } from "../api";
import { DayList } from "./DayList";

vi.mock("../api", () => ({
  api: {
    setNotes: vi.fn(() => Promise.resolve()),
    setEntrySeconds: vi.fn(() => Promise.resolve()),
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

const list = (e: Entry, onError: (err: unknown) => void, onChanged = () => {}) => (
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

  it("is not editable while the entry is running", () => {
    render(list({ ...entry, running: true }, vi.fn()));
    expect(screen.queryByTitle(/Edit duration/)).toBeNull();
    expect(screen.getByText("00:10:00")).toBeInTheDocument();
  });
});
