import React from 'react';
import { playClickSound, playHoverSound } from '../../utils/SoundEffects';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'play';
  className?: string;
  disabled?: boolean;
}

export const HexButton: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  className = "",
  disabled
}) => {

  // KPR Style: Sharp, technical, monochrome with red accents
  const base =
    "relative font-mono uppercase tracking-widest text-xs font-bold px-6 py-3 transition-all duration-100 " +
    "flex items-center justify-center select-none border disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden";

  const variants = {
    primary:
      "bg-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-panel))] text-[var(--app-text)] border-[var(--app-accent)] " +
      "hover:bg-[color-mix(in_srgb,var(--app-accent)_30%,var(--app-panel-2))] hover:border-[var(--app-accent)] hover:text-[var(--app-text)] " +
      "active:translate-y-[1px]",
    
    secondary:
      "bg-transparent border-[var(--app-border)] text-[var(--app-muted)] " +
      "hover:border-[var(--app-accent)] hover:text-[var(--app-text)] hover:bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] " +
      "active:translate-y-[1px]",

    ghost:
      "border-transparent text-[var(--app-muted)] hover:text-[var(--app-accent)] hover:bg-[color-mix(in_srgb,var(--app-text)_5%,transparent)]",

    danger:
      "bg-transparent border-[var(--app-danger)] text-[var(--app-danger)] " +
      "hover:bg-[color-mix(in_srgb,var(--app-danger)_15%,transparent)] hover:text-[var(--app-text)] hover:border-[var(--app-danger)]",

    play:
      "bg-[color-mix(in_srgb,var(--app-accent)_24%,var(--app-panel))] border-[var(--app-accent)] text-[var(--app-text)] text-sm " +
      "hover:bg-[color-mix(in_srgb,var(--app-accent)_34%,var(--app-panel-2))] hover:text-[var(--app-text)] hover:border-[var(--app-accent)] " +
      "clip-cut-corner"
  };

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    playClickSound();
    onClick?.();
  };

  return (
    <button
      disabled={disabled}
      onClick={handleClick}
      onMouseEnter={() => !disabled && playHoverSound()}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {/* Technical Corner Markers for primary buttons */}
      {variant === 'primary' && (
        <>
          <div className="absolute top-0 left-0 w-1 h-1 bg-[var(--app-bg)] z-10" />
          <div className="absolute bottom-0 right-0 w-1 h-1 bg-[var(--app-bg)] z-10" />
        </>
      )}
      {children}
    </button>
  );
};

// PANEL – Grid container with technical borders
export const HexPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ""
}) => (
  <div className={`relative bg-[var(--app-bg)] border border-[var(--app-border)] rounded-[var(--app-radius-md)] ${className}`}>
    {/* Corner Brackets */}
    <div className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t-2 border-l-2 border-[color-mix(in_srgb,var(--app-text)_50%,transparent)]" />
    <div className="absolute -top-[1px] -right-[1px] w-3 h-3 border-t-2 border-r-2 border-[color-mix(in_srgb,var(--app-text)_50%,transparent)]" />
    <div className="absolute -bottom-[1px] -left-[1px] w-3 h-3 border-b-2 border-l-2 border-[color-mix(in_srgb,var(--app-text)_50%,transparent)]" />
    <div className="absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b-2 border-r-2 border-[color-mix(in_srgb,var(--app-text)_50%,transparent)]" />
    
    {/* Background Grid Texture */}
    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjMzMzIiBmaWxsLW9wYWNpdHk9IjAuMiIvPgo8L3N2Zz4=')] pointer-events-none opacity-50" />
    
    <div className="relative z-10">
      {children}
    </div>
  </div>
);

// CARD – Minimalist industrial card
export const HexCard: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({
  children,
  className = "",
  onClick
}) => {
  const handleClick = () => {
    if (onClick) {
      playClickSound();
      onClick();
    }
  };

  return (
    <div 
      onClick={onClick ? handleClick : undefined}
      onMouseEnter={onClick ? playHoverSound : undefined}
      className={`
        relative bg-[var(--app-panel-2)] border border-[var(--app-border)] p-4 transition-all duration-200 rounded-[var(--app-radius-md)] 
        group hover:border-[var(--app-accent)]
        ${className}
      `}
    >
      {/* Hover Highlight Line */}
      <div className="absolute top-0 left-0 h-full w-[2px] bg-[var(--app-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
      {children}
    </div>
  );
};

// DIVIDER – Technical dashed line
export const HexDivider: React.FC = () => (
  <div className="my-6 w-full h-px bg-[var(--app-border)] flex items-center justify-center">
    <div className="bg-[var(--app-bg)] px-2 text-[var(--app-border)] text-[10px] tracking-[0.2em] font-mono">
      ///
    </div>
  </div>
);

// NAV TAB – Blocky tab with indicator
interface NavTabProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export const NavTab: React.FC<NavTabProps> = ({ label, isActive, onClick }) => {
  const handleClick = () => {
    playClickSound();
    onClick();
  };

  return (
    <button
      data-active={isActive ? 'true' : 'false'}
      onClick={handleClick}
      onMouseEnter={playHoverSound}
      className={`xt-nav-tab relative h-full px-2 xs:px-3 sm:px-6 md:px-7 font-mono uppercase tracking-[0.12em] sm:tracking-[0.18em] text-[9px] sm:text-[11px] font-bold
        transition-all duration-200 border-r border-[var(--app-border)] flex items-center justify-center whitespace-nowrap flex-shrink-0`}
    >
      <span className="xt-nav-label relative z-10 flex items-center gap-2">
        {isActive ? <span className="xt-nav-dot" /> : <span className="xt-nav-dot xt-nav-dot--idle" />}
        {label}
      </span>
      <div className="xt-nav-rule absolute bottom-0 left-0 right-0 h-px" />
    </button>
  );
};
