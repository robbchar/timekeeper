import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, Project } from "../api";
import { ProjectSettings } from "./ProjectSettings";

vi.mock("../api", () => ({
  api: {
    renameProject: vi.fn(() => Promise.resolve()),
    setProjectColor: vi.fn(() => Promise.resolve()),
    setProjectArchived: vi.fn(() => Promise.resolve()),
    setProjectRounding: vi.fn(() => Promise.resolve()),
  },
}));

const acme: Project = {
  id: 1,
  name: "Acme",
  color: "teal",
  archived: false,
  linearEnabled: false,
  linearTeamKey: null,
  roundingMinutes: null,
  roundingMode: "nearest",
};
const old: Project = {
  id: 2,
  name: "Old client",
  color: "gold",
  archived: true,
  linearEnabled: false,
  linearTeamKey: null,
  roundingMinutes: null,
  roundingMode: "nearest",
};
const palette = ["teal", "coral", "gold"];
const never = () => new Promise<void>(() => {});

function setup(projects = [acme], onChanged = vi.fn(() => Promise.resolve()), onError = vi.fn()) {
  render(
    <ProjectSettings
      projects={projects}
      palette={palette}
      roundingSteps={[6, 15]}
      onChanged={onChanged}
      onError={onError}
    />,
  );
  return { onChanged, onError };
}

function rename(value: string, key = "Enter") {
  const box = screen.getByRole("textbox", { name: "Rename Acme" });
  box.focus();
  fireEvent.change(box, { target: { value } });
  fireEvent.keyDown(box, { key });
  return box;
}

describe("ProjectSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renames on Enter and refreshes", async () => {
    const { onChanged } = setup();
    rename("Acme Corp");
    expect(api.renameProject).toHaveBeenCalledExactlyOnceWith(1, "Acme Corp");
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("renames on blur", () => {
    setup();
    const box = screen.getByRole("textbox", { name: "Rename Acme" });
    box.focus();
    fireEvent.change(box, { target: { value: "Acme Corp" } });
    fireEvent.blur(box);
    expect(api.renameProject).toHaveBeenCalledExactlyOnceWith(1, "Acme Corp");
  });

  it("shows the new name while the rename is saving", () => {
    vi.mocked(api.renameProject).mockImplementationOnce(never);
    setup();
    expect(rename("  Acme Corp ")).toHaveValue("Acme Corp");
  });

  it("Escape keeps the old name", () => {
    setup();
    const box = rename("Nope", "Escape");
    expect(api.renameProject).not.toHaveBeenCalled();
    expect(box).toHaveValue("Acme");
  });

  it("skips saving an unchanged name", () => {
    setup();
    rename(" Acme ");
    expect(api.renameProject).not.toHaveBeenCalled();
  });

  it("keeps a rejected name visible and reports the error", async () => {
    vi.mocked(api.renameProject).mockRejectedValueOnce("project name is empty");
    const { onChanged, onError } = setup();
    const box = rename("  ");
    await waitFor(() => expect(onError).toHaveBeenCalledWith("project name is empty"));
    expect(box).toHaveValue("  ");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("checks the current color and saves a new one", async () => {
    const { onChanged } = setup();
    expect(screen.getByRole("radio", { name: "teal" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "coral" }));
    expect(api.setProjectColor).toHaveBeenCalledWith(1, "coral");
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("keeps the new color checked while it saves", () => {
    vi.mocked(api.setProjectColor).mockImplementationOnce(never);
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "coral" }));
    expect(screen.getByRole("radio", { name: "coral" })).toBeChecked();
  });

  it("shows a refreshed color over one still saving", () => {
    vi.mocked(api.setProjectColor).mockImplementationOnce(never);
    const props = {
      palette,
      roundingSteps: [6, 15],
      onChanged: vi.fn(() => Promise.resolve()),
      onError: vi.fn(),
    };
    const { rerender } = render(<ProjectSettings projects={[acme]} {...props} />);
    fireEvent.click(screen.getByRole("radio", { name: "coral" }));
    rerender(<ProjectSettings projects={[{ ...acme, color: "gold" }]} {...props} />);
    expect(screen.getByRole("radio", { name: "gold" })).toBeChecked();
  });

  it("reports a failed color change and puts the old color back", async () => {
    vi.mocked(api.setProjectColor).mockRejectedValueOnce("unknown project color");
    const { onChanged, onError } = setup();
    fireEvent.click(screen.getByRole("radio", { name: "coral" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("unknown project color"));
    expect(screen.getByRole("radio", { name: "teal" })).toBeChecked();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("archives and unarchives", () => {
    setup([acme, old]);
    const acmeBox = screen.getByRole("checkbox", { name: "Archived: Acme" });
    const oldBox = screen.getByRole("checkbox", { name: "Archived: Old client" });
    expect(acmeBox).not.toBeChecked();
    expect(oldBox).toBeChecked();

    fireEvent.click(acmeBox);
    expect(api.setProjectArchived).toHaveBeenCalledWith(1, true);
    fireEvent.click(oldBox);
    expect(api.setProjectArchived).toHaveBeenCalledWith(2, false);
  });

  it("undoes an archive with a second click before the first one saves", () => {
    vi.mocked(api.setProjectArchived).mockImplementationOnce(never).mockImplementationOnce(never);
    setup();
    const box = screen.getByRole("checkbox", { name: "Archived: Acme" });
    fireEvent.click(box);
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(box).not.toBeChecked();
    expect(vi.mocked(api.setProjectArchived).mock.calls).toEqual([
      [1, true],
      [1, false],
    ]);
  });

  it("reports a failed archive without refreshing", async () => {
    vi.mocked(api.setProjectArchived).mockRejectedValueOnce("project 1 not found");
    const { onChanged, onError } = setup();
    const box = screen.getByRole("checkbox", { name: "Archived: Acme" });
    fireEvent.click(box);
    await waitFor(() => expect(onError).toHaveBeenCalledWith("project 1 not found"));
    expect(box).not.toBeChecked();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("lists projects in creation order, so archiving doesn't move a row", () => {
    // Given in the backend's order (active first, then by name), which creation order isn't.
    setup([
      { ...acme, id: 2 },
      { ...old, id: 1 },
    ]);
    const names = screen.getAllByRole("textbox").map((box) => (box as HTMLInputElement).value);
    expect(names).toEqual(["Old client", "Acme"]);
  });
});

describe("ProjectSettings rounding", () => {
  beforeEach(() => vi.clearAllMocks());

  const step = () => screen.getByRole("combobox", { name: "Acme: round copied time to" });
  const mode = () => screen.getByRole("combobox", { name: "Acme: round copied time" });

  it("starts off, with the direction disabled", () => {
    setup();
    expect(step()).toHaveValue("");
    expect(mode()).toBeDisabled();
  });

  it("saves a step with the current direction and refreshes", async () => {
    const { onChanged } = setup();
    fireEvent.change(step(), { target: { value: "15" } });
    expect(api.setProjectRounding).toHaveBeenCalledExactlyOnceWith(1, 15, "nearest");
    expect(step()).toHaveValue("15");
    expect(mode()).toBeEnabled();
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("saves a direction with the current step", () => {
    setup([{ ...acme, roundingMinutes: 6 }]);
    fireEvent.change(mode(), { target: { value: "up" } });
    expect(api.setProjectRounding).toHaveBeenCalledExactlyOnceWith(1, 6, "up");
  });

  it("turning it off keeps the direction", () => {
    setup([{ ...acme, roundingMinutes: 15, roundingMode: "down" }]);
    fireEvent.change(step(), { target: { value: "" } });
    expect(api.setProjectRounding).toHaveBeenCalledExactlyOnceWith(1, null, "down");
    expect(mode()).toBeDisabled();
    expect(mode()).toHaveValue("down");
  });

  it("puts the saved rule back and reports when saving fails", async () => {
    vi.mocked(api.setProjectRounding).mockRejectedValueOnce(new Error("nope"));
    const { onChanged, onError } = setup();
    fireEvent.change(step(), { target: { value: "15" } });
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(step()).toHaveValue("");
    expect(onChanged).not.toHaveBeenCalled();
  });
});
