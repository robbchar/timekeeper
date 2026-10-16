import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, Project } from "../api";
import { LinearSettings } from "./LinearSettings";

vi.mock("../api", () => ({
  api: {
    linearKeyStatus: vi.fn(),
    saveLinearKey: vi.fn(),
    testLinearConnection: vi.fn(),
    removeLinearKey: vi.fn(() => Promise.resolve()),
    setProjectLinear: vi.fn(() => Promise.resolve()),
  },
}));

const acme: Project = {
  id: 1,
  name: "Acme",
  color: "teal",
  archived: false,
  linearEnabled: true,
  linearTeamKey: "LABS",
};
const side: Project = {
  id: 2,
  name: "Side",
  color: "gold",
  archived: false,
  linearEnabled: false,
  linearTeamKey: null,
};
const old: Project = {
  id: 3,
  name: "Old client",
  color: "blue",
  archived: true,
  linearEnabled: true,
  linearTeamKey: null,
};
const never = <T,>() => new Promise<T>(() => {});
const UNAUTHORIZED =
  "Linear didn't accept this key. Check that it's a personal API key that hasn't been revoked.";
const REFUSED_TEAM = 'a Linear team key is letters and digits, like LABS (got "LA-BS")';

function setup(hint: string | null = null, projects = [acme, side, old]) {
  vi.mocked(api.linearKeyStatus).mockResolvedValue(hint === null ? null : { hint });
  const onChanged = vi.fn(() => Promise.resolve());
  const onError = vi.fn();
  render(<LinearSettings projects={projects} onChanged={onChanged} onError={onError} />);
  return { onChanged, onError };
}

const keyBox = () => screen.findByLabelText("Linear personal API key");
const button = (name: string) => screen.getByRole("button", { name });
const teamBox = (project: string) => screen.getByLabelText(`Linear team key for ${project}`);

async function paste(key: string) {
  fireEvent.change(await keyBox(), { target: { value: key } });
  fireEvent.click(button("Save"));
}

describe("LinearSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("without a saved key", () => {
    it("asks for a key as a password and hides the projects", async () => {
      setup();
      expect(await keyBox()).toHaveAttribute("type", "password");
      expect(button("Save")).toBeDisabled();
      expect(screen.queryByLabelText("Linear team key for Acme")).toBeNull();
    });

    it("saves a key Linear accepts and shows only its hint", async () => {
      vi.mocked(api.saveLinearKey).mockResolvedValueOnce({ hint: "1234", viewer: "Robb" });
      setup();
      await paste("lin_api_abcd1234");

      expect(await screen.findByText("Connected as Robb")).toBeInTheDocument();
      expect(api.saveLinearKey).toHaveBeenCalledExactlyOnceWith("lin_api_abcd1234");
      expect(screen.getByText("••••1234")).toBeInTheDocument();
      expect(screen.queryByLabelText("Linear personal API key")).toBeNull();
    });

    it("shows a refused key inline and keeps what was pasted", async () => {
      vi.mocked(api.saveLinearKey).mockRejectedValueOnce(UNAUTHORIZED);
      const { onError } = setup();
      await paste("typo");

      expect(await screen.findByText(UNAUTHORIZED)).toBeInTheDocument();
      expect(await keyBox()).toHaveValue("typo");
      expect(onError).not.toHaveBeenCalled();
    });

    it("disables Save while checking", async () => {
      vi.mocked(api.saveLinearKey).mockImplementationOnce(never);
      setup();
      await paste("lin_api_abcd1234");

      expect(button("Checking…")).toBeDisabled();
      fireEvent.click(button("Checking…"));
      expect(api.saveLinearKey).toHaveBeenCalledTimes(1);
    });
  });

  describe("with a saved key", () => {
    it("shows the hint and the non-archived projects", async () => {
      setup("1234");
      expect(await screen.findByText("••••1234")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Acme" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Side" })).not.toBeChecked();
      expect(screen.queryByRole("checkbox", { name: "Old client" })).toBeNull();
      expect(teamBox("Acme")).toHaveValue("LABS");
      expect(teamBox("Side")).toBeDisabled();
    });

    it("doesn't mark a project without a team key as unsaved", async () => {
      setup("1234");
      await screen.findByText("••••1234");
      expect(teamBox("Side")).not.toHaveClass("linear-project__team--unsaved");
      expect(teamBox("Side")).toHaveValue("");
    });

    it("tests the connection", async () => {
      vi.mocked(api.testLinearConnection).mockResolvedValueOnce("Robb");
      setup("1234");
      fireEvent.click(await screen.findByRole("button", { name: "Test connection" }));
      expect(await screen.findByText("Connected as Robb")).toBeInTheDocument();
    });

    it("shows a failed test inline", async () => {
      vi.mocked(api.testLinearConnection).mockRejectedValueOnce("No Linear API key is saved.");
      const { onError } = setup("1234");
      fireEvent.click(await screen.findByRole("button", { name: "Test connection" }));
      expect(await screen.findByText("No Linear API key is saved.")).toBeInTheDocument();
      expect(onError).not.toHaveBeenCalled();
    });

    it("removes the key and goes back to asking for one", async () => {
      setup("1234");
      fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
      expect(await keyBox()).toBeInTheDocument();
      expect(api.removeLinearKey).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("checkbox", { name: "Acme" })).toBeNull();
    });

    it("reports a failed removal and keeps the key shown", async () => {
      vi.mocked(api.removeLinearKey).mockRejectedValueOnce("Access is denied.");
      const { onError } = setup("1234");
      fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
      await waitFor(() => expect(onError).toHaveBeenCalledWith("Access is denied."));
      expect(screen.getByText("••••1234")).toBeInTheDocument();
    });

    it("turns Linear on for a project, keeping its team key", async () => {
      const { onChanged } = setup("1234");
      fireEvent.click(await screen.findByRole("checkbox", { name: "Side" }));
      expect(api.setProjectLinear).toHaveBeenCalledExactlyOnceWith(2, true, null);
      expect(screen.getByRole("checkbox", { name: "Side" })).toBeChecked();
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it("reverts the toggle when saving fails", async () => {
      vi.mocked(api.setProjectLinear).mockRejectedValueOnce("database is locked");
      const { onError } = setup("1234");
      fireEvent.click(await screen.findByRole("checkbox", { name: "Acme" }));
      await waitFor(() => expect(onError).toHaveBeenCalledWith("database is locked"));
      expect(screen.getByRole("checkbox", { name: "Acme" })).toBeChecked();
    });

    it("saves a team key on Enter, uppercased", async () => {
      setup("1234");
      await screen.findByText("••••1234");
      const box = teamBox("Acme");
      box.focus();
      fireEvent.change(box, { target: { value: " eng " } });
      fireEvent.keyDown(box, { key: "Enter" });
      expect(api.setProjectLinear).toHaveBeenCalledExactlyOnceWith(1, true, "ENG");
      expect(box).toHaveValue("ENG");
    });

    it("clears the team key when blanked", async () => {
      setup("1234");
      await screen.findByText("••••1234");
      const box = teamBox("Acme");
      box.focus();
      fireEvent.change(box, { target: { value: "" } });
      fireEvent.blur(box);
      expect(api.setProjectLinear).toHaveBeenCalledExactlyOnceWith(1, true, null);
    });

    it("cancels a team key edit on Escape", async () => {
      setup("1234");
      await screen.findByText("••••1234");
      const box = teamBox("Acme");
      box.focus();
      fireEvent.change(box, { target: { value: "ENG" } });
      fireEvent.keyDown(box, { key: "Escape" });
      expect(api.setProjectLinear).not.toHaveBeenCalled();
      expect(box).toHaveValue("LABS");
    });

    it("reports a refused team key and keeps the draft", async () => {
      vi.mocked(api.setProjectLinear).mockRejectedValueOnce(REFUSED_TEAM);
      const { onError } = setup("1234");
      await screen.findByText("••••1234");
      const box = teamBox("Acme");
      box.focus();
      fireEvent.change(box, { target: { value: "la-bs" } });
      fireEvent.keyDown(box, { key: "Enter" });
      await waitFor(() => expect(onError).toHaveBeenCalledWith(REFUSED_TEAM));
      expect(box).toHaveValue("la-bs");
    });
  });

  it("reports a failed status load and asks for a key", async () => {
    vi.mocked(api.linearKeyStatus).mockRejectedValueOnce(
      "Couldn't access Windows Credential Manager: x",
    );
    const onError = vi.fn();
    render(<LinearSettings projects={[acme]} onChanged={vi.fn()} onError={onError} />);
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith("Couldn't access Windows Credential Manager: x"),
    );
    expect(await keyBox()).toBeInTheDocument();
  });
});
