import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, Project } from "../api";
import { ProjectSettings } from "./ProjectSettings";

vi.mock("../api", () => ({
  api: {
    renameProject: vi.fn(() => Promise.resolve()),
    setProjectColor: vi.fn(() => Promise.resolve()),
    setProjectArchived: vi.fn(() => Promise.resolve()),
  },
}));

const acme: Project = { id: 1, name: "Acme", color: "teal", archived: false };
const old: Project = { id: 2, name: "Old client", color: "gold", archived: true };
const palette = ["teal", "coral", "gold"];

function setup(projects = [acme], onChanged = vi.fn(), onError = vi.fn()) {
  render(
    <ProjectSettings
      projects={projects}
      palette={palette}
      onChanged={onChanged}
      onError={onError}
    />,
  );
  return { onChanged, onError };
}

function rename(value: string, key = "Enter") {
  const box = screen.getByRole("textbox", { name: "Project name" });
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

  it("archives and unarchives", () => {
    setup([acme, old]);
    const [acmeBox, oldBox] = screen.getAllByRole("checkbox", { name: "Archived" });
    expect(acmeBox).not.toBeChecked();
    expect(oldBox).toBeChecked();

    fireEvent.click(acmeBox);
    expect(api.setProjectArchived).toHaveBeenCalledWith(1, true);
    fireEvent.click(oldBox);
    expect(api.setProjectArchived).toHaveBeenCalledWith(2, false);
  });

  it("reports a failed archive without refreshing", async () => {
    vi.mocked(api.setProjectArchived).mockRejectedValueOnce("project 1 not found");
    const { onChanged, onError } = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Archived" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("project 1 not found"));
    expect(onChanged).not.toHaveBeenCalled();
  });
});
