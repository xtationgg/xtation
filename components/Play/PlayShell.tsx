import React from 'react';
import { SessionBanner } from './shared/SessionBanner';
import { Archive, Activity, ChevronLeft, Swords, Clock, CheckCircle2, Zap, Radio } from 'lucide-react';

export type PlaySpace = 'home' | 'process' | 'vault';

export interface VaultSummary {
  totalQuests: number;
  activeQuests: number;
  completedToday: number;
  totalTimeMs: number;
  /** Currently running quest title, if any */
  runningQuest?: string | null;
}

export interface ProcessSummary {
  /** placeholder for future data */
  status: 'coming-soon';
}

interface PlayShellProps {
  children: React.ReactNode;
  activeSpace: PlaySpace;
  onSwitchSpace: (space: PlaySpace) => void;
  vaultSummary: VaultSummary;
  processSummary?: ProcessSummary;
  sessionActive: boolean;
  sessionQuestTitle?: string;
  sessionElapsed?: number;
  sessionPaused?: boolean;
  onSessionPause?: () => void;
  onSessionEnd?: () => void;
  onEnterFocus?: () => void;
}

const formatTotalTime = (ms: number): string => {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m}m`;
  }
  return `${totalMin}m`;
};

export const PlayShell: React.FC<PlayShellProps> = ({
  children, activeSpace, onSwitchSpace, vaultSummary, processSummary,
  sessionActive, sessionQuestTitle, sessionElapsed, sessionPaused,
  onSessionPause, onSessionEnd, onEnterFocus,
}) => (
  <div className="play-shell">
    {/* ── Session HUD (always visible when session is active) ── */}
    {sessionActive && sessionQuestTitle && onSessionPause && onSessionEnd && onEnterFocus ? (
      <div className="play-hud-strip">
        <SessionBanner
          questTitle={sessionQuestTitle}
          elapsedSeconds={sessionElapsed || 0}
          isPaused={sessionPaused || false}
          onPause={onSessionPause}
          onEnd={onSessionEnd}
          onEnterFocus={onEnterFocus}
        />
      </div>
    ) : null}

    {activeSpace === 'home' ? (
      /* ── MODE SELECT — two large hero tabs ── */
      <div className="play-mode-select">
        <div className="play-mode-header">
          <h1 className="play-mode-title">Play</h1>
          <p className="play-mode-subtitle">Choose your operations mode</p>
        </div>

        <div className="play-mode-cards">
          {/* Vault Card */}
          <button
            type="button"
            className="play-mode-card play-mode-card--vault"
            onClick={() => onSwitchSpace('vault')}
          >
            <div className="play-mode-card-glow" />
            <div className="play-mode-card-icon">
              <Swords size={32} />
            </div>
            <h2 className="play-mode-card-title">Vault</h2>
            <p className="play-mode-card-desc">Quest operations &amp; mission control</p>

            <div className="play-mode-card-stats">
              <div className="play-mode-stat">
                <Archive size={13} />
                <span className="play-mode-stat-val">{vaultSummary.totalQuests}</span>
                <span className="play-mode-stat-label">Quests</span>
              </div>
              <div className="play-mode-stat">
                <Zap size={13} />
                <span className="play-mode-stat-val">{vaultSummary.activeQuests}</span>
                <span className="play-mode-stat-label">Active</span>
              </div>
              <div className="play-mode-stat">
                <CheckCircle2 size={13} />
                <span className="play-mode-stat-val">{vaultSummary.completedToday}</span>
                <span className="play-mode-stat-label">Done Today</span>
              </div>
              <div className="play-mode-stat">
                <Clock size={13} />
                <span className="play-mode-stat-val">{formatTotalTime(vaultSummary.totalTimeMs)}</span>
                <span className="play-mode-stat-label">Tracked</span>
              </div>
            </div>

            {vaultSummary.runningQuest ? (
              <div className="play-mode-card-live">
                <Radio size={11} />
                <span>{vaultSummary.runningQuest}</span>
              </div>
            ) : null}

            <div className="play-mode-card-enter">
              Enter Vault
              <ChevronLeft size={14} className="play-mode-card-arrow" />
            </div>
          </button>

          {/* Process Card */}
          <button
            type="button"
            className="play-mode-card play-mode-card--process"
            onClick={() => onSwitchSpace('process')}
          >
            <div className="play-mode-card-glow" />
            <div className="play-mode-card-icon">
              <Activity size={32} />
            </div>
            <h2 className="play-mode-card-title">Process</h2>
            <p className="play-mode-card-desc">Live operations monitor &amp; analytics</p>

            <div className="play-mode-card-stats">
              <div className="play-mode-stat play-mode-stat--muted">
                <Radio size={13} />
                <span className="play-mode-stat-val">--</span>
                <span className="play-mode-stat-label">Systems</span>
              </div>
              <div className="play-mode-stat play-mode-stat--muted">
                <Activity size={13} />
                <span className="play-mode-stat-val">--</span>
                <span className="play-mode-stat-label">Uptime</span>
              </div>
            </div>

            <div className="play-mode-card-badge">Coming Soon</div>

            <div className="play-mode-card-enter">
              Enter Process
              <ChevronLeft size={14} className="play-mode-card-arrow" />
            </div>
          </button>
        </div>
      </div>
    ) : (
      /* ── ACTIVE SPACE VIEW ── */
      <>
        <div className="play-header">
          <button
            type="button"
            className="play-back-btn"
            onClick={() => onSwitchSpace('home')}
          >
            <ChevronLeft size={16} />
            <span>Play</span>
          </button>
          <span className="play-header-space-label">
            {activeSpace === 'vault' ? 'Vault' : 'Process'}
          </span>
        </div>
        <div className="play-content">
          {children}
        </div>
      </>
    )}
  </div>
);
