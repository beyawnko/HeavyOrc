import { Component, ReactNode } from 'react';

const DefaultFallback = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => (
  <div role="alert" className="p-4 text-sm text-red-600 space-y-2">
    <p>Something went wrong while loading memories.</p>
    {error ? (
      <pre className="whitespace-pre-wrap text-xs text-red-500 max-h-40 overflow-auto">
        {String(error)}
      </pre>
    ) : null}
    <button onClick={onRetry} className="underline text-blue-600">
      Retry
    </button>
  </div>
);

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  error: unknown;
}

export default class MemoryErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    console.error('Memory component error', error);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <DefaultFallback error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
