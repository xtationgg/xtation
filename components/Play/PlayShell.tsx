import React from 'react';
import { SessionBanner } from './shared/SessionBanner';

type PlaySpace = 'process' | 'vault';

interface PlayShellProps {
  children: React.ReactNode; // The active space component
  activeSpace: PlaySpace;
  onSwitchSpace: (space: PlaySpace) => void;
  // Session props (passed from parent)
  sessionActive: boolean;
  sessionQuestTitle?: string;
  sessionElapsed?: number;
  sessionPaused?: boolean;
  onSessionPause?: () => void;
  onSessionEnd?: () => void;
  onEnterFocus?: () => void;
}

export const PlayShell: React.FC<PlayShellProps> = ({
  children, activeSpace, onSwitchSpace,
  sessionActive, sessionQuestTitle, sessionElapsed, sessionPaused,
  onSessionPause, onSessionEnd, onEnterFocus,
}) => (
  <div className="play-shell">
    <div className="play-header">
      <div className="play-space-switcher">
        <button
          className={`play-space-tab ${activeSpace === 'process' ? 'play-space-tab--active' : ''}`}
          onClick={() => onSwitchSpace('process')}
        >
          Process
        </button>
        <button
          className={`play-space-tab ${activeSpace === 'vault' ? 'play-space-tab--active' : ''}`}
          onClick={() => onSwitchSpace('vault')}
        >
          Vault
        </button>
      </div>
      {sessionActive && sessionQuestTitle && onSessionPause && onSessionEnd && onEnterFocus ? (
        <SessionBanner
          questTitle={sessionQuestTitle}
          elapsedSeconds={sessionElapsed || 0}
          isPaused={sessionPaused || false}
          onPause={onSessionPause}
          onEnd={onSessionEnd}
          onEnterFocus={onEnterFocus}
        />
      ) : null}
    </div>
    <div className="play-content">
      {children}
    </div>
  </div>
);
