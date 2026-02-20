import React from 'react';

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: undefined };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, message: error?.message || 'Unknown error' };
  }

  componentDidCatch(error: any, info: any) {
    console.error('App crashed', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen flex items-center justify-center p-8 bg-[var(--ui-panel)] text-[#e6e8ee]">
          <div className="max-w-xl w-full border border-[var(--ui-border)] bg-[var(--ui-panel)] p-6 rounded">
            <div className="text-xs uppercase tracking-[0.25em] text-[var(--ui-accent)]">Recovered from crash</div>
            <div className="mt-2 text-lg font-semibold">This section crashed instead of showing a blank page.</div>
            <div className="mt-2 text-sm text-[var(--ui-muted)]">{this.state.message || ''}</div>
            <div className="mt-6 flex gap-3">
              <button
                className="border border-[var(--ui-border)] bg-[var(--ui-panel)] px-4 py-2 text-xs uppercase tracking-[0.2em] hover:border-[#e6e8ee]"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
            <div className="mt-4 text-[11px] text-[var(--ui-muted)]">Check DevTools console for the full error.</div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
