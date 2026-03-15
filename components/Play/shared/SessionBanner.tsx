import React from 'react';
import { Pause, Play, Square } from 'lucide-react';
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
  <div className="vq-hud-banner" onClick={onEnterFocus}>
    <div className="vq-hud-live-tag">
      <StatusDot status={isPaused ? 'paused' : 'running'} size={6} />
      <span>{isPaused ? 'PAUSED' : 'LIVE'}</span>
    </div>
    <span className="vq-hud-title">{questTitle}</span>
    <MonoTimer seconds={elapsedSeconds} size="sm" />
    <div className="vq-hud-actions">
      <button className="vq-hud-btn" onClick={(e) => { e.stopPropagation(); onPause(); }} title={isPaused ? 'Resume' : 'Pause'}>
        {isPaused ? <Play size={13} /> : <Pause size={13} />}
      </button>
      <button className="vq-hud-btn vq-hud-btn--stop" onClick={(e) => { e.stopPropagation(); onEnd(); }} title="End session">
        <Square size={11} />
      </button>
    </div>
  </div>
);
