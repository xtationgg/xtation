import React, { useEffect, useId, useState } from 'react';

interface EyeOrbProps {
  onClick: () => void;
  onMouseEnter?: () => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  triggerPulseKey?: string | number | null;
}

export const EyeOrb: React.FC<EyeOrbProps> = ({
  onClick,
  onMouseEnter,
  ariaLabel = 'Play',
  className = '',
  disabled = false,
  triggerPulseKey,
}) => {
  const gradientId = `eye-orb-gradient-${useId().replace(/:/g, '')}`;
  const glowId = `eye-orb-glow-${useId().replace(/:/g, '')}`;
  const [eventPulseActive, setEventPulseActive] = useState(false);

  useEffect(() => {
    if (triggerPulseKey === undefined) return undefined;
    setEventPulseActive(false);
    const raf = window.requestAnimationFrame(() => {
      setEventPulseActive(true);
    });
    const timer = window.setTimeout(() => {
      setEventPulseActive(false);
    }, 900);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [triggerPulseKey]);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={[
        'eye-orb-trigger group relative flex items-center gap-3 px-4 py-2 text-[var(--app-text)]',
        'hover:bg-[var(--app-panel-2)] transition-colors focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)]',
        eventPulseActive ? 'eye-orb-trigger--event' : '',
        disabled ? 'opacity-60 cursor-not-allowed' : '',
        className,
      ].join(' ')}
    >
      <span className="eye-orb" aria-hidden="true">
        <svg className="eye-orb__svg" viewBox="0 0 64 64" role="presentation">
          <defs>
            <radialGradient id={gradientId} cx="34%" cy="30%" r="80%">
              <stop offset="0%" stopColor="color-mix(in srgb, var(--app-accent) 74%, white)" />
              <stop offset="54%" stopColor="color-mix(in srgb, var(--app-accent) 40%, var(--app-panel-2))" />
              <stop offset="100%" stopColor="color-mix(in srgb, var(--app-bg) 80%, black)" />
            </radialGradient>
            <radialGradient id={glowId} cx="50%" cy="50%" r="58%">
              <stop offset="0%" stopColor="color-mix(in srgb, var(--app-accent) 52%, transparent)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          <g className="eye-orb__drift">
            <circle className="eye-orb__glow" cx="32" cy="32" r="30" fill={`url(#${glowId})`} />
            <circle className="eye-orb__ring" cx="32" cy="32" r="23" />
            <circle className="eye-orb__iris" cx="32" cy="32" r="20" fill={`url(#${gradientId})`} />
            <circle className="eye-orb__pupil" cx="32" cy="32" r="8" />
            <ellipse className="eye-orb__highlight" cx="25.5" cy="21.8" rx="4.6" ry="3.2" />
            <ellipse className="eye-orb__highlight-soft" cx="27.8" cy="25.4" rx="2.3" ry="1.6" />
          </g>

          <g className="eye-orb__crosshair">
            <g className="eye-orb__arm eye-orb__arm--top">
              <path d="M32 7 L28.2 13 L35.8 13 Z" />
            </g>
            <g className="eye-orb__arm eye-orb__arm--right">
              <path d="M57 32 L51 28.2 L51 35.8 Z" />
            </g>
            <g className="eye-orb__arm eye-orb__arm--bottom">
              <path d="M32 57 L35.8 51 L28.2 51 Z" />
            </g>
            <g className="eye-orb__arm eye-orb__arm--left">
              <path d="M7 32 L13 35.8 L13 28.2 Z" />
            </g>
          </g>
        </svg>
      </span>
      {/* Keep old hitbox width/alignment identical with invisible label */}
      <span className="invisible font-bold text-sm tracking-widest uppercase select-none">PLAY</span>
    </button>
  );
};

export default EyeOrb;
