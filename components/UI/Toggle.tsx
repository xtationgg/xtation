import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label = 'Sound' }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`ui-pressable inline-flex items-center gap-2 border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] ${
        checked
          ? 'chamfer-card border-[var(--ui-accent)] bg-[rgba(143,99,255,0.2)] text-[var(--ui-text)] ui-glow'
          : 'chamfer-card border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
      }`}
      aria-pressed={checked}
      title={label}
    >
      {checked ? <Volume2 size={14} /> : <VolumeX size={14} />}
      <span>{label}</span>
      <span className="text-[9px] text-[var(--ui-muted)]">{checked ? 'ON' : 'OFF'}</span>
    </button>
  );
};
