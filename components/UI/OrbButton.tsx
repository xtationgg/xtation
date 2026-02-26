import React from 'react';

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
        <img
          src="/ui-reference/brand/eye-orb.svg"
          alt=""
          className="orb-button__asset"
          draggable={false}
        />
      </span>
      {/* Preserves the exact top-left trigger hitbox width/alignment without showing text */}
      <span className="invisible font-bold text-sm tracking-widest uppercase select-none">PLAY</span>
    </button>
  );
};

export default OrbButton;
