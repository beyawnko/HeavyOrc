import { Component, ReactNode } from 'react';

const MAX_RETRIES = 3;

const DefaultFallback = ({
  error,
  onRetry,
  canRetry,
}: {
  error: unknown;
  onRetry: () => void;
  canRetry: boolean;
}) => (
  <div role="alert" className="p-4 text-sm text-red-600 space-y-2">
    <p>Something went wrong while loading memories.</p>
    {error ? (
      <pre className="whitespace-pre-wrap text-xs text-red-500 max-h-40 overflow-auto">
        {String(error)}
      </pre>
    ) : null}
    {canRetry ? (
      <button onClick={onRetry} className="underline text-blue-600">
        Retry
      </button>
    ) : (
      <p className="text-xs">Retry limit reached</p>
    )}
  </div>
);

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  error: unknown;
  retries: number;
}

export default class MemoryErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, retries: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    console.error('Memory component error', error);
  }

  private handleRetry = () => {
    this.setState(prev => ({ hasError: false, error: null, retries: prev.retries + 1 }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const canRetry = this.state.retries < MAX_RETRIES;
      return (
        <DefaultFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          canRetry={canRetry}
        />
      );
    }
    return this.props.children;
  }
}
