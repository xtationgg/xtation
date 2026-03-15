import React from 'react';

interface PlayMenuItemProps {
  label: string;
  rightSlot?: React.ReactNode;
  onClick?: () => void;
  subtitle?: string;
  disabled?: boolean;
}

export const PlayMenuItem: React.FC<PlayMenuItemProps> = ({
  label,
  rightSlot,
  onClick,
  subtitle,
  disabled
}) => {
  return (
    <div
      className={`w-full rounded-xl border border-white/10 bg-gradient-to-b from-[var(--app-panel)] to-[var(--app-bg)] shadow-[0_10px_24px_rgba(0,0,0,0.45)] ${
        disabled ? 'opacity-70' : 'hover:border-white/30'
      } transition-all duration-200`}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full px-4 py-3 flex items-center justify-between uppercase tracking-[0.32em] text-[11px] text-[var(--app-text)]"
      >
        <span>{label}</span>
        {rightSlot}
      </button>
      {subtitle && (
        <div className="px-4 pb-3 text-[9px] uppercase tracking-[0.3em] text-[var(--app-muted)]">
          {subtitle}
        </div>
      )}
    </div>
  );
};
