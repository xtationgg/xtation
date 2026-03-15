import React from 'react';
import { SessionBanner } from './shared/SessionBanner';
import { Button } from '../ui/button';

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
      <div className="play-space-switcher flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
        <Button
          variant={activeSpace === 'process' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onSwitchSpace('process')}
        >
          Process
        </Button>
        <Button
          variant={activeSpace === 'vault' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onSwitchSpace('vault')}
        >
          Vault
        </Button>
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
