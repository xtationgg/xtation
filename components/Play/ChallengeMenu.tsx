import React from 'react';

interface ChallengeMenuProps {
  onClose: () => void;
  onSelect: (mode: 'solo' | 'multi' | 'explore') => void;
}

export const ChallengeMenu: React.FC<ChallengeMenuProps> = ({ onClose, onSelect }) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.35em] text-[#f3f0e8]">Challenge</div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg border border-white/10 text-[#f3f0e8] hover:border-white/30"
          aria-label="Close"
        >
          X
        </button>
      </div>

      <button
        type="button"
        onClick={() => onSelect('solo')}
        className="w-full rounded-xl border border-white/10 bg-[#141418] px-4 py-3 text-left text-[12px] uppercase tracking-[0.28em] text-[#f3f0e8] hover:border-white/30"
      >
        Solo
      </button>
      <button
        type="button"
        onClick={() => onSelect('multi')}
        className="w-full rounded-xl border border-white/10 bg-[#141418] px-4 py-3 text-left text-[12px] uppercase tracking-[0.28em] text-[#f3f0e8] hover:border-white/30"
      >
        Multiplayer
      </button>
      <button
        type="button"
        onClick={() => onSelect('explore')}
        className="w-full rounded-xl border border-white/10 bg-[#141418] px-4 py-3 text-left text-[12px] uppercase tracking-[0.28em] text-[#f3f0e8] hover:border-white/30"
      >
        Explore
      </button>
    </div>
  );
};
