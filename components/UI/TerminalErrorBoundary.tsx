import React from 'react';

interface TerminalErrorBoundaryProps {
  children: React.ReactNode;
}

interface TerminalErrorBoundaryState {
  error: Error | null;
}

export class TerminalErrorBoundary extends React.Component<
  TerminalErrorBoundaryProps,
  TerminalErrorBoundaryState
> {
  state: TerminalErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Quests panel crashed', error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  handleReset = () => {
    try {
      localStorage.removeItem('xpLedger_v2');
      localStorage.removeItem('xpLedger_v2:anon');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('xpLedger_v2:')) localStorage.removeItem(key);
      });
      localStorage.removeItem('xpLedger_v1');
      localStorage.removeItem('missions');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="fixed top-[80px] right-[24px] w-[420px] z-[100]">
          <div className="rounded-2xl border border-white/10 bg-[#0b0b0e] shadow-[0_24px_55px_rgba(0,0,0,0.6)] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 bg-[#111116] text-[10px] uppercase tracking-[0.3em] text-[#f46a2e]">
              Quests failed to load
            </div>
            <div className="p-4 space-y-3 text-[10px] text-[#b9b4ac]">
              <div>Something in the saved quests data crashed the panel.</div>
              {this.state.error?.message ? (
                <div className="text-[9px] text-[#777]">Error: {this.state.error.message}</div>
              ) : null}
              <div className="text-[#777]">
                You can reset only the quests data to recover.
              </div>
              <button
                type="button"
                onClick={this.handleRetry}
                className="w-full px-3 py-2 rounded border border-white/20 text-[10px] uppercase tracking-[0.2em] text-white/90 hover:bg-white hover:text-black transition-colors"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full px-3 py-2 rounded border border-[#f46a2e]/40 text-[10px] uppercase tracking-[0.2em] text-[#f46a2e] hover:bg-[#f46a2e] hover:text-black transition-colors"
              >
                Reset Quests Data
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
