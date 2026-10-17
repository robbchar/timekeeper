import { describe, expect, it } from "vitest";
import type { Snapshot } from "./api";
import { invoke } from "./mock";

describe("mock invoke", () => {
  it("rejects with the message string, like Tauri", async () => {
    await expect(invoke("delete_entry", { entryId: 999999 })).rejects.toBe(
      "entry 999999 not found",
    );
  });

  it("saves a lin_api_ key and shows only its last four characters", async () => {
    await expect(invoke("save_linear_key", { key: " lin_api_abcd1234 " })).resolves.toEqual({
      hint: "1234",
      viewer: "Mock Viewer",
    });
    await expect(invoke("linear_key_status")).resolves.toEqual({ hint: "1234" });
    await expect(invoke("test_linear_connection")).resolves.toBe("Mock Viewer");
    await invoke("remove_linear_key");
    await expect(invoke("linear_key_status")).resolves.toBeNull();
  });

  it("refuses any other key with Linear's message, as a string", async () => {
    await expect(invoke("save_linear_key", { key: "typo" })).rejects.toBe(
      "Linear didn't accept this key. Check that it's a personal API key that hasn't been revoked.",
    );
    await expect(invoke("test_linear_connection")).rejects.toBe("No Linear API key is saved.");
  });

  it("normalizes and validates a project's team key", async () => {
    await invoke("set_project_linear_enabled", { projectId: 1, enabled: true });
    await invoke("set_project_linear_team", { projectId: 1, teamKey: " labs " });
    const snap = await invoke<Snapshot>("snapshot");
    expect(snap.projects.find((p) => p.id === 1)).toMatchObject({
      linearEnabled: true,
      linearTeamKey: "LABS",
    });
    await expect(
      invoke("set_project_linear_team", { projectId: 1, teamKey: "LA-BS" }),
    ).rejects.toBe('a Linear team key is letters and digits, like LABS (got "LA-BS")');
  });
});
