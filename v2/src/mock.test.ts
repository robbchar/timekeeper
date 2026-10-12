import { describe, expect, it } from "vitest";
import { invoke } from "./mock";

describe("mock invoke", () => {
  it("rejects with the message string, like Tauri", async () => {
    await expect(invoke("delete_entry", { entryId: 999999 })).rejects.toBe(
      "entry 999999 not found",
    );
  });
});
