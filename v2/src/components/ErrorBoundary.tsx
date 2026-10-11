import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  onReload?: () => void;
}

// Boxed so a thrown `undefined` or `null` still counts as a failure.
interface State {
  failure: { error: unknown } | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failure: null };

  static getDerivedStateFromError(error: unknown): State {
    return { failure: { error } };
  }

  render() {
    const { failure } = this.state;
    if (!failure) return this.props.children;
    const reload = this.props.onReload ?? (() => window.location.reload());
    return (
      <div className="crash" role="alert">
        <h1>Something went wrong</h1>
        <p className="crash__message">
          {failure.error instanceof Error ? failure.error.message : String(failure.error)}
        </p>
        <button className="btn btn--primary" onClick={reload}>
          Reload
        </button>
      </div>
    );
  }
}
