import { describe, expect, it } from "vitest";
import { projectColor } from "./palette";

describe("projectColor", () => {
  it("maps a key to its token, muted if the token is missing", () => {
    expect(projectColor("teal")).toBe("var(--project-teal, var(--muted))");
  });

  it("falls back to muted for a missing or malformed key", () => {
    expect(projectColor(null)).toBe("var(--muted)");
    expect(projectColor("")).toBe("var(--muted)");
    expect(projectColor("#2a9d8f")).toBe("var(--muted)");
    expect(projectColor("teal blue")).toBe("var(--muted)");
  });
});
