import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

// Boxed so a thrown `undefined` or `null` still counts as a failure.
interface State {
  failure: { error: unknown; componentStack?: string } | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failure: null };

  static getDerivedStateFromError(error: unknown): State {
    return { failure: { error } };
  }

  // Keep the stacks on screen: the console is gone once the user reloads.
  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.setState({ failure: { error, componentStack: info.componentStack ?? undefined } });
  }

  render() {
    const { failure } = this.state;
    if (!failure) return this.props.children;
    const { error, componentStack } = failure;
    const stack = [error instanceof Error ? error.stack : undefined, componentStack]
      .filter(Boolean)
      .join("\n");
    return (
      <div className="crash" role="alert">
        <h1>Something went wrong</h1>
        {/* String() matches App's error banner and names errors with no message. */}
        <p className="crash__message">{String(error)}</p>
        {stack && (
          <details>
            <summary>Details</summary>
            <pre className="crash__message">{stack}</pre>
          </details>
        )}
        <button className="btn btn--primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
