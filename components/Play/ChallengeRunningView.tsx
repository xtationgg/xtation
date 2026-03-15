import React from 'react';
import { RunningConfig } from './challengeWidgetTypes';
import { useXP } from '../XP/xpStore';

interface ChallengeRunningViewProps {
  config: RunningConfig;
  mode: 'solo' | 'multi';
  onCancel: () => void;
  onComplete?: () => void;
  onFinish?: () => void;
}

const formatTimer = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const ChallengeRunningView: React.FC<ChallengeRunningViewProps> = ({
  config,
  mode,
  onCancel,
  onComplete,
  onFinish,
}) => {
  const { elapsedSeconds } = useXP();
  const label = config.title;

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="text-[10px] uppercase tracking-[0.35em] text-[var(--app-muted)]">{mode === 'solo' ? 'Solo' : 'Multiplayer'} session</div>
      <div className="text-[12px] uppercase tracking-[0.28em] text-white">{label}</div>
      <div className="text-[36px] font-bold tracking-[0.2em] text-white">
        {formatTimer(elapsedSeconds)}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onCancel();
          }}
          className="px-4 py-2 rounded-lg border border-white/15 text-[11px] uppercase tracking-[0.2em] text-[var(--app-text)]"
        >
          Cancel
        </button>
        {mode === 'solo' ? (
          <button
            type="button"
            onClick={() => {
              onComplete?.();
            }}
            className="px-4 py-2 rounded-lg border border-[#5ef48a]/40 text-[11px] uppercase tracking-[0.2em] text-[#5ef48a]"
          >
            Complete
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onFinish?.();
            }}
            className="px-4 py-2 rounded-lg border border-[#5ef48a]/40 text-[11px] uppercase tracking-[0.2em] text-[#5ef48a]"
          >
            Finish
          </button>
        )}
      </div>
      <div className="text-[9px] uppercase tracking-[0.28em] text-[var(--app-muted)]">
        TODO: sync timer + state to backend
      </div>
    </div>
  );
};
