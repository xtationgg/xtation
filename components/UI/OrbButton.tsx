import React, { useId } from 'react';

interface OrbButtonProps {
  onClick: () => void;
  onMouseEnter?: () => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

export const OrbButton: React.FC<OrbButtonProps> = ({
  onClick,
  onMouseEnter,
  ariaLabel = 'Play',
  className = '',
  disabled = false,
}) => {
  const gradientId = `orb-iris-${useId().replace(/:/g, '')}`;
  const glowId = `orb-glow-${useId().replace(/:/g, '')}`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={[
        'orb-button group relative flex items-center gap-3 px-4 py-2 text-[var(--app-text)]',
        'hover:bg-[var(--app-panel-2)] transition-colors focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)]',
        disabled ? 'opacity-60 cursor-not-allowed' : '',
        className,
      ].join(' ')}
    >
      <span className="orb-button__icon" aria-hidden="true">
        <svg className="orb-button__svg" viewBox="0 0 64 64" role="presentation">
          <defs>
            <radialGradient id={gradientId} cx="34%" cy="28%" r="78%">
              <stop offset="0%" stopColor="color-mix(in srgb, var(--app-accent) 75%, white)" />
              <stop offset="48%" stopColor="color-mix(in srgb, var(--app-accent) 40%, var(--app-panel-2))" />
              <stop offset="100%" stopColor="color-mix(in srgb, var(--app-bg) 72%, black)" />
            </radialGradient>
            <radialGradient id={glowId} cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="color-mix(in srgb, var(--app-accent) 48%, transparent)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <g className="orb-button__spin">
            <circle cx="32" cy="32" r="28" fill={`url(#${glowId})`} className="orb-button__halo" />
            <circle cx="32" cy="32" r="23" className="orb-button__ring" />
            <circle cx="32" cy="32" r="20" fill={`url(#${gradientId})`} className="orb-button__iris" />
            <circle cx="32" cy="32" r="8" className="orb-button__pupil" />
            <ellipse cx="26" cy="22" rx="4.2" ry="3.2" className="orb-button__highlight" />
          </g>

          <g className="orb-button__brackets" fill="none">
            <path className="orb-button__bracket orb-button__bracket--tl" d="M20 14 L14 20 L20 26" />
            <path className="orb-button__bracket orb-button__bracket--tr" d="M44 14 L50 20 L44 26" />
            <path className="orb-button__bracket orb-button__bracket--bl" d="M20 38 L14 44 L20 50" />
            <path className="orb-button__bracket orb-button__bracket--br" d="M44 38 L50 44 L44 50" />
          </g>
        </svg>
      </span>
      {/* Preserves the exact top-left trigger hitbox width/alignment without showing text */}
      <span className="invisible font-bold text-sm tracking-widest uppercase select-none">PLAY</span>
    </button>
  );
};

export default OrbButton;
