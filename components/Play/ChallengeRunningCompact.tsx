import React from 'react';
import { useXP } from '../XP/xpStore';

interface ChallengeRunningCompactProps {
  mode: 'solo' | 'multi';
  onCancel: () => void;
}

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const ChallengeRunningCompact: React.FC<ChallengeRunningCompactProps> = ({ mode, onCancel }) => {
  const { elapsedSeconds } = useXP();

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-gradient-to-b from-[#2a2a2d] to-[#1b1b1d] p-5 shadow-[0_14px_26px_rgba(0,0,0,0.6)] flex flex-col items-center gap-4">
      <div className="text-[9px] uppercase tracking-[0.32em] text-[#9a9288]">
        {mode === 'multi' ? 'Searching...' : 'Running...'}
      </div>
      <div className="text-3xl tracking-[0.3em] text-[#f6e9c8]">
        {formatTime(elapsedSeconds)}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 rounded-lg border border-[#f46a2e]/70 bg-[#2d2017] text-[#f3f0e8] text-[12px] tracking-[0.32em] uppercase"
      >
        Cancel
      </button>
    </div>
  );
};
