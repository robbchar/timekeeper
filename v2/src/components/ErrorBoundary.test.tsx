import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("cannot read notes of undefined");
}

function Blank(): never {
  throw new Error();
}

describe("ErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("when a child throws", () => {
    // React logs caught render errors; keep the test output clean.
    beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

    it("shows the fallback with the error message instead of a blank window", () => {
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      );
      expect(screen.getByRole("alert")).toHaveTextContent("Error: cannot read notes of undefined");
    });

    it("names an error that has no message", () => {
      render(
        <ErrorBoundary>
          <Blank />
        </ErrorBoundary>,
      );
      expect(screen.getByText("Error")).toBeInTheDocument();
    });

    it("keeps the component stack in the details", () => {
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      );
      expect(screen.getByText("Details").parentElement).toHaveTextContent("Boom");
    });

    it("reloads the window from the fallback", () => {
      const reload = vi.fn();
      vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload });
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Reload" }));
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  it("renders children when nothing throws", () => {
    const consoleError = vi.spyOn(console, "error");
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("fine")).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
