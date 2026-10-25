import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { IdleDialog } from "./IdleDialog";

vi.mock("../api", () => ({
  api: { answerIdlePrompt: vi.fn() },
}));

const prompt = { since: "2026-10-05T15:30:00Z", returnedAt: "2026-10-05T16:42:00Z" };
const status = { running: null, elapsedSeconds: 0 };

function renderDialog() {
  const onAnswered = vi.fn(() => Promise.resolve());
  const onError = vi.fn();
  render(
    <IdleDialog prompt={prompt} projectName="Acme" onAnswered={onAnswered} onError={onError} />,
  );
  return { onAnswered, onError };
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

describe("IdleDialog", () => {
  beforeEach(() => vi.mocked(api.answerIdlePrompt).mockReset());

  it("says when the user was away and for how long", () => {
    renderDialog();
    expect(screen.getByRole("alertdialog", { name: "You were away" })).toHaveTextContent(
      `No activity from ${clock(prompt.since)} to ${clock(prompt.returnedAt)} (1h 12m) while timing Acme. Keep that time?`,
    );
  });

  it("focuses Keep, the answer that changes nothing", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Keep" })).toHaveFocus();
  });

  it("has no way to dismiss it without answering", () => {
    const { onAnswered } = renderDialog();
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Discard", "Keep"]);
    expect(onAnswered).not.toHaveBeenCalled();
  });

  it.each([
    ["Keep", true],
    ["Discard", false],
  ])("answers %s and refreshes", async (name, keep) => {
    vi.mocked(api.answerIdlePrompt).mockResolvedValueOnce(status);
    const { onAnswered } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name }));
    await waitFor(() => expect(onAnswered).toHaveBeenCalledTimes(1));
    expect(api.answerIdlePrompt).toHaveBeenCalledWith(keep);
  });

  it("reports a failed answer and lets the user try again", async () => {
    vi.mocked(api.answerIdlePrompt).mockRejectedValueOnce("database is locked");
    const { onAnswered, onError } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("database is locked"));
    expect(onAnswered).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Discard" })).toBeEnabled();
  });
});
