import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, Entry } from "../api";
import { DayList } from "./DayList";

vi.mock("../api", () => ({
  api: { setNotes: vi.fn(() => Promise.resolve()), copy: vi.fn() },
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

function editNotes(value: string, onError = vi.fn()) {
  render(
    <DayList
      entries={[entry]}
      today="2026-10-10"
      durationFormat="hms"
      dateFormat="iso"
      onChanged={() => {}}
      onError={onError}
    />,
  );
  fireEvent.click(screen.getByTitle("Edit notes"));
  const box = screen.getByRole("textbox");
  fireEvent.change(box, { target: { value } });
  return box;
}

describe("DayList notes editing", () => {
  beforeEach(() => vi.mocked(api.setNotes).mockClear());

  it("Escape discards the edit even though it leaves through blur", () => {
    const box = editNotes("changed");
    fireEvent.keyDown(box, { key: "Escape" });
    expect(api.setNotes).not.toHaveBeenCalled();
    expect(screen.getByTitle("Edit notes")).toHaveTextContent("original");
  });

  it("Enter saves exactly once", () => {
    const box = editNotes("changed");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(api.setNotes).toHaveBeenCalledTimes(1);
    expect(api.setNotes).toHaveBeenCalledWith(3, "changed");
  });

  it("reports a failed save and keeps the draft", async () => {
    vi.mocked(api.setNotes).mockRejectedValueOnce("database is locked");
    const onError = vi.fn();
    const box = editNotes("changed", onError);
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(onError).toHaveBeenCalledWith("database is locked"));
    fireEvent.click(screen.getByTitle("Edit notes"));
    expect(screen.getByRole("textbox")).toHaveValue("changed");
  });
});
