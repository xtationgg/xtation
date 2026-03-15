import React from 'react';

interface ChallengeModeSelectProps {
  onClose: () => void;
  onSelect: (mode: 'solo' | 'multi') => void;
}

export const ChallengeModeSelect: React.FC<ChallengeModeSelectProps> = ({ onClose, onSelect }) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="w-full px-3 py-2 rounded-xl border border-white/10 bg-gradient-to-r from-[#1f1f22] via-[#1f1f22] to-[#5c3c1c] flex items-center justify-between text-[11px] tracking-[0.32em] uppercase text-[var(--app-text)]">
        <span>Challenge</span>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg border border-white/20 bg-[var(--app-border)] text-[var(--app-text)] flex items-center justify-center text-sm hover:border-white/40"
          aria-label="Close"
        >
          X
        </button>
      </div>

      <div className="text-[9px] uppercase tracking-[0.3em] text-[var(--app-muted)]">Select Mode</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSelect('solo')}
          className="px-4 py-2 rounded-lg border border-white/10 bg-gradient-to-b from-[var(--app-panel-2)] to-[var(--app-panel)] uppercase text-[11px] tracking-[0.32em] text-[var(--app-text)] hover:-translate-y-0.5 transition"
        >
          Solo
        </button>
        <button
          type="button"
          onClick={() => onSelect('multi')}
          className="px-4 py-2 rounded-lg border border-white/10 bg-gradient-to-b from-[var(--app-panel-2)] to-[var(--app-panel)] uppercase text-[11px] tracking-[0.32em] text-[var(--app-text)] hover:-translate-y-0.5 transition"
        >
          Multiplayer
        </button>
      </div>
    </div>
  );
};
