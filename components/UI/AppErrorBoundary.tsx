import React from 'react';

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
  stack?: string;
};

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
    stack: undefined,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Unknown runtime error',
      stack: error.stack,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[app-error-boundary] Runtime error:', error);
    if (errorInfo.componentStack) {
      console.error('[app-error-boundary] Component stack:', errorInfo.componentStack);
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] font-mono p-6">
        <div className="max-w-3xl mx-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] p-5">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--app-muted)]">
            Runtime Error
          </div>
          <div className="mt-2 text-sm text-[var(--app-text)]">
            {this.state.message || 'Unknown runtime error'}
          </div>
          {this.state.stack ? (
            <pre className="mt-4 max-h-[55vh] overflow-auto rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-2)] p-3 text-[10px] leading-5 text-[var(--app-muted)] whitespace-pre-wrap">
              {this.state.stack}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md border border-[var(--app-border)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-text)] bg-[var(--app-panel-2)]"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
