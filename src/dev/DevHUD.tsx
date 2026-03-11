import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useXP } from '../../components/XP/xpStore';
import { useAuth } from '../auth/AuthProvider';
import { useXtationSettings } from '../settings/SettingsProvider';
import { Issue, runLedgerHealthChecks } from './devHealth';

const formatElapsed = (seconds: number) => {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.max(0, seconds) % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const DevHUDInner: React.FC = () => {
  const {
    tasks,
    sessions,
    challenges,
    selectors,
    elapsedSeconds,
    stats,
    dateKey,
    currentAuthUserId,
    ledgerCacheKey,
    ledgerSource,
    syncStatus,
    lastSyncedAt,
    cloudResetStatus,
    cloudResetMessage,
    isHydrated,
    getLedgerSnapshot,
    repairLedgerLinks,
    resetLocalData,
    resetAccountData,
  } = useXP();
  const { user } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statusText, setStatusText] = useState('Ready');
  const [position, setPosition] = useState(() => ({
    x: 16,
    y: typeof window !== 'undefined' ? Math.max(16, window.innerHeight - 290) : 16,
  }));

  const activeSession = selectors.getActiveSession();
  const runningText = activeSession ? `${activeSession.id} (${formatElapsed(elapsedSeconds)})` : 'none';
  const errorCount = useMemo(() => issues.filter((issue) => issue.severity === 'error').length, [issues]);

  const runChecks = useCallback(() => {
    const report = runLedgerHealthChecks({
      ...getLedgerSnapshot(),
      dateKey,
      reportedTodayXP: stats.todayEarnedXP,
      reportedTodayTargetXP: stats.todayTargetXP,
    });
    setIssues(report.issues);
    setStatusText(report.ok ? 'Health checks OK' : `Found ${report.issues.length} issue(s)`);
  }, [dateKey, getLedgerSnapshot, stats.todayEarnedXP, stats.todayTargetXP]);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const beginDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-no-drag]')) return;

    const originX = position.x;
    const originY = position.y;
    const startX = event.clientX;
    const startY = event.clientY;
    const panelWidth = collapsed ? 220 : 370;
    const panelHeight = collapsed ? 50 : 340;

    const onMove = (moveEvent: MouseEvent) => {
      const rawX = originX + (moveEvent.clientX - startX);
      const rawY = originY + (moveEvent.clientY - startY);
      const maxX = Math.max(8, window.innerWidth - panelWidth - 8);
      const maxY = Math.max(8, window.innerHeight - panelHeight - 8);
      setPosition({
        x: Math.min(Math.max(8, rawX), maxX),
        y: Math.min(Math.max(8, rawY), maxY),
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleRepair = () => {
    repairLedgerLinks();
    setStatusText('Ledger links repaired');
    window.setTimeout(runChecks, 0);
  };

  const handleExport = async () => {
    const snapshot = getLedgerSnapshot();
    const json = JSON.stringify(snapshot, null, 2);
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `xp-ledger-${dateKey}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatusText('Ledger exported');
    } catch (error) {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(json);
        setStatusText('Export copied to clipboard');
        return;
      }
      setStatusText(error instanceof Error ? error.message : 'Export failed');
    }
  };

  const handleReset = () => {
    if (!window.confirm('Reset all local XP/task/session/challenge data for this app?')) return;
    resetLocalData();
    setStatusText('Local data reset');
    setIssues([]);
    window.setTimeout(runChecks, 0);
  };

  const handleResetCloudData = async () => {
    if (!currentAuthUserId) {
      setStatusText('Sign in required for cloud reset');
      return;
    }
    if (!window.confirm(`Reset cloud data for this signed-in account (${user?.email || currentAuthUserId})?`)) return;
    await resetAccountData();
    window.setTimeout(runChecks, 0);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[120]">
      <div
        className="pointer-events-auto fixed text-[#d6d2cb] font-mono select-none"
        style={{ left: position.x, top: position.y, width: collapsed ? 220 : 370 }}
      >
        <div className="rounded-xl border border-white/20 bg-[#0b0c10]/95 shadow-[0_14px_30px_rgba(0,0,0,0.55)] overflow-hidden">
          <div
            className="px-3 py-2 border-b border-white/10 bg-gradient-to-r from-[#151922] via-[#12141b] to-[#10131a] flex items-center justify-between cursor-move"
            onMouseDown={beginDrag}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] tracking-[0.25em] uppercase">Developer HUD</span>
              {errorCount > 0 && (
                <span className="px-1.5 py-0.5 rounded border border-[#ff4d4d] bg-[#2a1111] text-[#ff6a6a] text-[9px]">
                  {errorCount} ERR
                </span>
              )}
            </div>
            <button
              type="button"
              data-no-drag
              onClick={() => setCollapsed((prev) => !prev)}
              className="px-2 py-0.5 border border-white/15 rounded text-[9px] tracking-[0.2em] uppercase hover:border-white/40"
            >
              {collapsed ? 'Open' : 'Min'}
            </button>
          </div>

          {!collapsed && (
            <div className="p-3 space-y-3 text-[10px]">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <span className="text-[#8a8f99] uppercase tracking-[0.2em]">Auth</span>
                <span className="truncate">{user?.email || 'Not signed in'}</span>
                <span className="text-[#8a8f99] uppercase tracking-[0.2em]">User ID</span>
                <span className="truncate">{currentAuthUserId || 'anon'}</span>
                <span className="text-[#8a8f99] uppercase tracking-[0.2em]">Ledger Key</span>
                <span className="truncate">{ledgerCacheKey}</span>
                <span className="text-[#8a8f99] uppercase tracking-[0.2em]">Ledger Source</span>
                <span className="truncate">{ledgerSource}</span>
                <span className="text-[#8a8f99] uppercase tracking-[0.2em]">Cloud Status</span>
                <span className="truncate">
                  {currentAuthUserId && !isHydrated ? 'Loading cloud...' : syncStatus}
                </span>
                <span className="text-[#8a8f99] uppercase tracking-[0.2em]">Last Sync</span>
                <span className="truncate">{lastSyncedAt || '-'}</span>
                <span className="text-[#8a8f99] uppercase tracking-[0.2em]">Counts</span>
                <span>{tasks.length} tasks / {sessions.length} sessions / {challenges.length} challenges</span>
                <span className="text-[#8a8f99] uppercase tracking-[0.2em]">Running</span>
                <span className="truncate">{runningText}</span>
                <span className="text-[#8a8f99] uppercase tracking-[0.2em]">Today</span>
                <span>{stats.todayEarnedXP}/{stats.todayTargetXP} ({stats.rankTier})</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={runChecks}
                  className="px-2 py-1 rounded border border-white/20 hover:border-[#8ecbff] hover:text-[#d9efff] uppercase tracking-[0.2em]"
                >
                  Run Checks
                </button>
                <button
                  type="button"
                  onClick={handleRepair}
                  className="px-2 py-1 rounded border border-white/20 hover:border-[#6de2a5] hover:text-[#c7ffe0] uppercase tracking-[0.2em]"
                >
                  Repair Links
                </button>
                <button
                  type="button"
                  onClick={() => void handleExport()}
                  className="px-2 py-1 rounded border border-white/20 hover:border-[#f3cc71] hover:text-[#ffebba] uppercase tracking-[0.2em]"
                >
                  Export Ledger JSON
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2 py-1 rounded border border-[#5e2020] text-[#ff8f8f] hover:border-[#ff5f5f] uppercase tracking-[0.2em]"
                >
                  Reset Local Data
                </button>
                <button
                  type="button"
                  onClick={() => void handleResetCloudData()}
                  disabled={!currentAuthUserId || cloudResetStatus === 'saving'}
                  className="col-span-2 px-2 py-1 rounded border border-[#5e2020] text-[#ff8f8f] hover:border-[#ff5f5f] uppercase tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cloudResetStatus === 'saving'
                    ? 'Resetting Cloud Data...'
                    : 'Reset Cloud Data (This Account)'}
                </button>
              </div>

              <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
                <div className="uppercase tracking-[0.2em] text-[#8a8f99]">Cloud reset</div>
                <div className="text-[10px]">
                  {cloudResetMessage || (cloudResetStatus === 'idle' ? 'Idle' : cloudResetStatus)}
                </div>
              </div>

              <div className="rounded border border-white/10 bg-black/20">
                <button
                  type="button"
                  onClick={() => setIssuesOpen((prev) => !prev)}
                  className="w-full px-2 py-1.5 flex items-center justify-between text-left"
                >
                  <span className="uppercase tracking-[0.2em] text-[#8a8f99]">
                    Health: {issues.length ? `${issues.length} issue(s)` : 'OK'}
                  </span>
                  <span className="text-[#8a8f99]">{issuesOpen ? 'Hide' : 'Show'}</span>
                </button>
                {issuesOpen && (
                  <div className="px-2 pb-2 space-y-1 max-h-[130px] overflow-auto">
                    {issues.length === 0 ? (
                      <div className="text-[#86d5a8]">No issues found.</div>
                    ) : (
                      issues.map((issue) => (
                        <div
                          key={issue.id}
                          className={`p-1.5 rounded border ${
                            issue.severity === 'error'
                              ? 'border-[#6a2222] bg-[#221214] text-[#ff9797]'
                              : 'border-[#5d5230] bg-[#1f1a11] text-[#f4dd98]'
                          }`}
                        >
                          <div className="uppercase tracking-[0.2em] text-[9px]">{issue.severity}</div>
                          <div>{issue.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="text-[9px] text-[#7c818a] uppercase tracking-[0.18em]">{statusText}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const DevHUD: React.FC = () => {
  if (!import.meta.env.DEV) return null;
  const { settings } = useXtationSettings();
  if (!settings.device.devHudEnabled) return null;
  return <DevHUDInner />;
};
