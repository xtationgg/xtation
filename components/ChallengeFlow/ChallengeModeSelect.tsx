import React from 'react';

interface ChallengeModeSelectProps {
  isOpen: boolean;
  selectedMode: 'solo' | 'multi' | null;
  onSelect: (mode: 'solo' | 'multi') => void;
}

export const ChallengeModeSelect: React.FC<ChallengeModeSelectProps> = ({
  isOpen,
  selectedMode,
  onSelect
}) => {
  return (
    <div
      className={`w-full flex flex-col gap-2 transition-all duration-300 ${
        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
      }`}
    >
      <div className="text-[9px] uppercase tracking-[0.3em] text-[#8b847a]">Select Mode</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSelect('solo')}
          className={`px-4 py-2 rounded-lg border uppercase text-[11px] tracking-[0.32em] transition ${
            selectedMode === 'solo'
              ? 'border-[#f46a2e] bg-[#2c2117] text-[#f3f0e8]'
              : 'border-white/10 bg-gradient-to-b from-[#2a2a2d] to-[#1d1d1f] text-[#f3f0e8]'
          }`}
        >
          Solo
        </button>
        <button
          type="button"
          onClick={() => onSelect('multi')}
          className={`px-4 py-2 rounded-lg border uppercase text-[11px] tracking-[0.32em] transition ${
            selectedMode === 'multi'
              ? 'border-[#f46a2e] bg-[#2c2117] text-[#f3f0e8]'
              : 'border-white/10 bg-gradient-to-b from-[#2a2a2d] to-[#1d1d1f] text-[#f3f0e8]'
          }`}
        >
          Multiplayer
        </button>
      </div>
    </div>
  );
};
