import React from 'react';

interface ChallengeButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const ChallengeButton: React.FC<ChallengeButtonProps> = ({ isOpen, onToggle }) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className={`group w-full max-w-[260px] px-4 py-2 rounded-xl border border-white/10 bg-gradient-to-r from-[#221f27] via-[#1f1f22] to-[#5c3c1c] shadow-[0_8px_20px_rgba(0,0,0,0.55)] flex items-center justify-between gap-3 uppercase tracking-[0.32em] text-[11px] text-[#f3f0e8] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(0,0,0,0.6)] ${isOpen ? 'ring-1 ring-[#f46a2e]/40' : ''}`}
    >
      <span>Challenge</span>
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-lg font-bold ${isOpen ? 'bg-[#1a1a1d] text-[#f3f0e8] border border-white/20' : 'bg-white/90 text-black'}`}>
        {isOpen ? 'X' : '+'}
      </span>
    </button>
  );
};
