import React from 'react';
import { SessionBanner } from './shared/SessionBanner';
import { Archive, Activity, ChevronLeft, Swords, Clock, CheckCircle2, Zap, Radio } from 'lucide-react';
import { DirectionAwareHover } from '../UI/direction-aware-hover';

export type PlaySpace = 'home' | 'process' | 'vault';

export interface VaultSummary {
  totalQuests: number;
  activeQuests: number;
  completedToday: number;
  totalTimeMs: number;
  runningQuest?: string | null;
}

export interface ProcessSummary {
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
  children, activeSpace, onSwitchSpace, vaultSummary,
  sessionActive, sessionQuestTitle, sessionElapsed, sessionPaused,
  onSessionPause, onSessionEnd, onEnterFocus,
}) => (
  <div className="play-shell">
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
      <div className="pm-select">
        <div className="pm-header">
          <h1 className="pm-title">Play</h1>
          <p className="pm-subtitle">Choose your operations mode</p>
        </div>

        <div className="pm-cards">
          {/* Vault */}
          <DirectionAwareHover
            imageUrl="https://images.unsplash.com/photo-1614854262318-831574f15f1f?w=1200&q=80"
            className="pm-card"
            childrenClassName="pm-card-content"
            onClick={() => onSwitchSpace('vault')}
          >
            <div className="pm-card-inner">
              <div className="pm-card-icon"><Swords size={28} /></div>
              <h2 className="pm-card-title">Vault</h2>
              <p className="pm-card-desc">Quest operations & mission control</p>

              <div className="pm-card-stats">
                <div className="pm-stat">
                  <Archive size={12} />
                  <span className="pm-stat-val">{vaultSummary.totalQuests}</span>
                  <span className="pm-stat-lbl">Quests</span>
                </div>
                <div className="pm-stat">
                  <Zap size={12} />
                  <span className="pm-stat-val">{vaultSummary.activeQuests}</span>
                  <span className="pm-stat-lbl">Active</span>
                </div>
                <div className="pm-stat">
                  <CheckCircle2 size={12} />
                  <span className="pm-stat-val">{vaultSummary.completedToday}</span>
                  <span className="pm-stat-lbl">Done</span>
                </div>
                <div className="pm-stat">
                  <Clock size={12} />
                  <span className="pm-stat-val">{formatTotalTime(vaultSummary.totalTimeMs)}</span>
                  <span className="pm-stat-lbl">Tracked</span>
                </div>
              </div>

              {vaultSummary.runningQuest ? (
                <div className="pm-card-live">
                  <Radio size={10} />
                  <span>{vaultSummary.runningQuest}</span>
                </div>
              ) : null}
            </div>
          </DirectionAwareHover>

          {/* Process */}
          <DirectionAwareHover
            imageUrl="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80"
            className="pm-card pm-card--process"
            childrenClassName="pm-card-content"
            onClick={() => onSwitchSpace('process')}
          >
            <div className="pm-card-inner">
              <div className="pm-card-icon"><Activity size={28} /></div>
              <h2 className="pm-card-title">Process</h2>
              <p className="pm-card-desc">Live operations monitor & analytics</p>

              <div className="pm-card-stats pm-card-stats--muted">
                <div className="pm-stat">
                  <Radio size={12} />
                  <span className="pm-stat-val">--</span>
                  <span className="pm-stat-lbl">Systems</span>
                </div>
                <div className="pm-stat">
                  <Activity size={12} />
                  <span className="pm-stat-val">--</span>
                  <span className="pm-stat-lbl">Uptime</span>
                </div>
              </div>

              <div className="pm-card-badge">Coming Soon</div>
            </div>
          </DirectionAwareHover>
        </div>
      </div>
    ) : (
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
