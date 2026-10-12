import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, Project } from "../api";
import { AddTimeForm } from "./AddTimeForm";

vi.mock("../api", () => ({
  api: { addManualTime: vi.fn(() => Promise.resolve()) },
}));

const projects: Project[] = [
  { id: 1, name: "Acme", color: null, archived: false },
  { id: 2, name: "Side", color: null, archived: false },
  { id: 3, name: "Old", color: null, archived: true },
];

function open(props: Partial<Parameters<typeof AddTimeForm>[0]> = {}) {
  const onChanged = vi.fn();
  const onError = vi.fn();
  render(
    <AddTimeForm
      projects={projects}
      lastProjectId={2}
      today="2026-10-10"
      onChanged={onChanged}
      onError={onError}
      {...props}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add time" }));
  return { onChanged, onError };
}

const field = (label: string) => screen.getByLabelText(label);

describe("AddTimeForm", () => {
  beforeEach(() => vi.mocked(api.addManualTime).mockClear());

  it("defaults to the last project and today, and lists only active projects", () => {
    open();
    expect(field("Project")).toHaveValue("2");
    expect(field("Day")).toHaveValue("2026-10-10");
    expect(field("Day")).toHaveAttribute("max", "2026-10-10");
    expect(screen.queryByRole("option", { name: "Old" })).toBeNull();
  });

  it("adds the time, reports the change and closes", async () => {
    const { onChanged } = open();
    fireEvent.change(field("Project"), { target: { value: "1" } });
    fireEvent.change(field("Day"), { target: { value: "2026-10-08" } });
    fireEvent.change(field("Duration"), { target: { value: "2:15" } });
    fireEvent.change(field("Notes"), { target: { value: "forgot the timer" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(api.addManualTime).toHaveBeenCalledWith(1, "2026-10-08", 8100, "forgot the timer");
    expect(screen.queryByLabelText("Duration")).toBeNull();
  });

  it("refuses a duration it can't read without calling the backend", () => {
    open();
    fireEvent.change(field("Duration"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(api.addManualTime).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("h:mm");
  });

  it("reports a failed add and keeps the form open", async () => {
    vi.mocked(api.addManualTime).mockRejectedValueOnce("database is locked");
    const { onChanged, onError } = open();
    fireEvent.change(field("Duration"), { target: { value: "1:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("database is locked"));
    expect(onChanged).not.toHaveBeenCalled();
    expect(field("Duration")).toHaveValue("1:00");
  });

  it("Cancel closes without adding", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.addManualTime).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add time" })).toBeInTheDocument();
  });
});
