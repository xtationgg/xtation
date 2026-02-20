import React from 'react';

interface ChallengeCollapsedButtonProps {
  onClick: () => void;
}

export const ChallengeCollapsedButton: React.FC<ChallengeCollapsedButtonProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group w-full max-w-[260px] px-4 py-2 rounded-xl border border-white/10 bg-gradient-to-r from-[#221f27] via-[#1f1f22] to-[#5c3c1c] shadow-[0_8px_20px_rgba(0,0,0,0.55)] flex items-center justify-between gap-3 uppercase tracking-[0.32em] text-[11px] text-[#f3f0e8] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(0,0,0,0.6)]"
  >
    <span>Challenge</span>
    <span className="w-7 h-7 rounded-lg bg-white/90 text-black flex items-center justify-center text-lg font-bold">+</span>
  </button>
);
