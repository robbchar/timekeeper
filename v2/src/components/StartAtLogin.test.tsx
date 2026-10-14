import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { StartAtLogin } from "./StartAtLogin";

vi.mock("../api", () => ({
  api: { startAtLogin: vi.fn(), setStartAtLogin: vi.fn() },
}));

const checkbox = () => screen.getByRole("checkbox", { name: "Start TimeKeeper when I log in" });

function renderToggle(initial: boolean | null) {
  vi.mocked(api.startAtLogin).mockResolvedValueOnce(initial);
  const onError = vi.fn();
  render(<StartAtLogin onError={onError} />);
  return { onError };
}

describe("StartAtLogin", () => {
  beforeEach(() => {
    vi.mocked(api.startAtLogin).mockReset();
    vi.mocked(api.setStartAtLogin).mockReset();
  });

  it("shows that it's off", async () => {
    renderToggle(false);
    await waitFor(() => expect(checkbox()).toBeEnabled());
    expect(checkbox()).not.toBeChecked();
  });

  it("shows that it's on", async () => {
    renderToggle(true);
    await waitFor(() => expect(checkbox()).toBeChecked());
  });

  it("is disabled until the current state has loaded", () => {
    vi.mocked(api.startAtLogin).mockReturnValueOnce(new Promise(() => {}));
    render(<StartAtLogin onError={vi.fn()} />);
    expect(checkbox()).toBeDisabled();
  });

  it("is hidden where starting at login isn't supported", async () => {
    renderToggle(null);
    await waitFor(() => expect(screen.queryByRole("checkbox")).toBeNull());
    expect(screen.queryByText("Startup")).toBeNull();
  });

  it("turns it on", async () => {
    vi.mocked(api.setStartAtLogin).mockResolvedValueOnce(undefined);
    renderToggle(false);
    await waitFor(() => expect(checkbox()).toBeEnabled());
    fireEvent.click(checkbox());

    await waitFor(() => expect(checkbox()).toBeChecked());
    expect(api.setStartAtLogin).toHaveBeenCalledWith(true);
  });

  it("turns it off", async () => {
    vi.mocked(api.setStartAtLogin).mockResolvedValueOnce(undefined);
    renderToggle(true);
    await waitFor(() => expect(checkbox()).toBeChecked());
    fireEvent.click(checkbox());

    await waitFor(() => expect(checkbox()).not.toBeChecked());
    expect(api.setStartAtLogin).toHaveBeenCalledWith(false);
  });

  it("can't be toggled again while saving", async () => {
    let finish: () => void = () => {};
    vi.mocked(api.setStartAtLogin).mockReturnValueOnce(new Promise((res) => (finish = res)));
    renderToggle(false);
    await waitFor(() => expect(checkbox()).toBeEnabled());
    fireEvent.click(checkbox());

    expect(checkbox()).toBeDisabled();
    finish();
    await waitFor(() => expect(checkbox()).toBeEnabled());
    expect(checkbox()).toBeChecked();
  });

  it("reports a failed change and keeps the old state", async () => {
    vi.mocked(api.setStartAtLogin).mockRejectedValueOnce("Access is denied.");
    const { onError } = renderToggle(false);
    await waitFor(() => expect(checkbox()).toBeEnabled());
    fireEvent.click(checkbox());

    await waitFor(() => expect(onError).toHaveBeenCalledWith("Access is denied."));
    expect(checkbox()).not.toBeChecked();
    expect(checkbox()).toBeEnabled();
  });

  it("reports a failed load", async () => {
    vi.mocked(api.startAtLogin).mockRejectedValueOnce("registry unavailable");
    const onError = vi.fn();
    render(<StartAtLogin onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledWith("registry unavailable"));
    expect(checkbox()).toBeDisabled();
  });
});
