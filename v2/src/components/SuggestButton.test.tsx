import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { appendLines, SuggestButton } from "./SuggestButton";

vi.mock("../api", () => ({
  api: { suggestNotes: vi.fn() },
}));

describe("appendLines", () => {
  it("starts empty notes with the addition", () => {
    expect(appendLines("", "LABS-1 T — commented")).toBe("LABS-1 T — commented");
    expect(appendLines("  \n", "x")).toBe("x");
  });

  it("puts the addition on a new line after the kept notes", () => {
    expect(appendLines("standup\n\n", "LABS-1")).toBe("standup\nLABS-1");
    expect(appendLines("  indented", "x")).toBe("  indented\nx");
  });
});

describe("SuggestButton", () => {
  beforeEach(() => vi.mocked(api.suggestNotes).mockReset());

  const renderButton = () => {
    const onSuggested = vi.fn();
    const onError = vi.fn();
    render(
      <SuggestButton projectId={4} day="2026-10-16" onSuggested={onSuggested} onError={onError} />,
    );
    return { onSuggested, onError, button: screen.getByRole("button") };
  };

  it("asks for the entry's project and day and hands over every line", async () => {
    vi.mocked(api.suggestNotes).mockResolvedValue([
      { source: "linear", lines: ["LABS-1 A — commented", "LABS-2 B — created"] },
    ]);
    const { onSuggested, button } = renderButton();
    fireEvent.click(button);
    await waitFor(() =>
      expect(onSuggested).toHaveBeenCalledWith("LABS-1 A — commented\nLABS-2 B — created"),
    );
    expect(api.suggestNotes).toHaveBeenCalledWith(4, "2026-10-16");
    expect(button).toHaveTextContent("Suggest from Linear");
  });

  it("says it's busy while waiting", async () => {
    let resolve: (v: []) => void = () => {};
    vi.mocked(api.suggestNotes).mockReturnValue(new Promise((r) => (resolve = r)));
    const { button } = renderButton();
    fireEvent.click(button);
    expect(button).toHaveTextContent("Asking Linear…");
    expect(button).toBeDisabled();
    await act(async () => resolve([]));
  });

  it("says when nothing was found and appends nothing", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(api.suggestNotes).mockResolvedValue([{ source: "linear", lines: [] }]);
      const { onSuggested, button } = renderButton();
      await act(async () => fireEvent.click(button));
      expect(button).toHaveTextContent("Nothing found");
      expect(onSuggested).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(button).toHaveTextContent("Suggest from Linear");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a failure and can be tried again", async () => {
    vi.mocked(api.suggestNotes).mockRejectedValueOnce(
      "Linear's rate limit was reached. Try again in a few minutes.",
    );
    const { onSuggested, onError, button } = renderButton();
    fireEvent.click(button);
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        "Linear's rate limit was reached. Try again in a few minutes.",
      ),
    );
    expect(onSuggested).not.toHaveBeenCalled();
    expect(button).toBeEnabled();
  });

  it("doesn't take focus from the notes being edited", () => {
    const { button } = renderButton();
    const mouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    button.dispatchEvent(mouseDown);
    expect(mouseDown.defaultPrevented).toBe(true);
  });
});
