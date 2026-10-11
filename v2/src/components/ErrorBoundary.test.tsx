import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("cannot read notes of undefined");
}

describe("ErrorBoundary", () => {
  // React logs caught render errors; keep the test output clean.
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("shows the fallback with the error message instead of a blank window", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("cannot read notes of undefined");
  });

  it("reloads from the fallback", () => {
    const onReload = vi.fn();
    render(
      <ErrorBoundary onReload={onReload}>
        <Boom />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("fine")).toBeInTheDocument();
  });
});
