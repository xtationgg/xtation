import React from 'react';
import { Pause, Square } from 'lucide-react';
import { StatusDot } from './StatusDot';
import { MonoTimer } from './MonoTimer';

interface SessionBannerProps {
  questTitle: string;
  elapsedSeconds: number;
  isPaused: boolean;
  onPause: () => void;
  onEnd: () => void;
  onEnterFocus: () => void;
}

export const SessionBanner: React.FC<SessionBannerProps> = ({
  questTitle, elapsedSeconds, isPaused, onPause, onEnd, onEnterFocus,
}) => (
  <div className="play-session-banner" onClick={onEnterFocus}>
    <StatusDot status={isPaused ? 'paused' : 'running'} size={6} />
    <span className="play-session-banner__title">{questTitle}</span>
    <span className="play-session-banner__sep">&middot;</span>
    <MonoTimer seconds={elapsedSeconds} size="sm" />
    <button className="play-session-banner__action" onClick={(e) => { e.stopPropagation(); onPause(); }} title={isPaused ? 'Resume' : 'Pause'}>
      <Pause size={14} />
    </button>
    <button className="play-session-banner__action" onClick={(e) => { e.stopPropagation(); onEnd(); }} title="End session">
      <Square size={12} />
    </button>
  </div>
);
