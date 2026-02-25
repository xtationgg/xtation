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
      "bg-[var(--t-text)] text-[var(--t-bg)] border-[var(--t-text)] " +
      "hover:bg-[var(--t-accent)] hover:border-[var(--t-accent)] hover:text-[var(--t-text)] " +
      "active:translate-y-[1px]",
    
    secondary:
      "bg-transparent border-[var(--t-border)] text-[var(--t-muted)] " +
      "hover:border-[var(--t-text)] hover:text-[var(--t-text)] hover:bg-[color-mix(in_srgb,var(--t-text)_5%,transparent)] " +
      "active:translate-y-[1px]",

    ghost:
      "border-transparent text-[var(--t-muted)] hover:text-[var(--t-accent)] hover:bg-[color-mix(in_srgb,var(--t-text)_5%,transparent)]",

    danger:
      "bg-transparent border-[var(--t-danger)] text-[var(--t-danger)] " +
      "hover:bg-[color-mix(in_srgb,var(--t-danger)_15%,transparent)] hover:text-[var(--t-text)] hover:border-[var(--t-danger)]",

    play:
      "bg-[var(--t-accent)] border-[var(--t-accent)] text-[var(--t-text)] text-sm " +
      "hover:bg-[var(--t-text)] hover:text-[var(--t-bg)] hover:border-[var(--t-text)] " +
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
          <div className="absolute top-0 left-0 w-1 h-1 bg-[var(--t-bg)] z-10" />
          <div className="absolute bottom-0 right-0 w-1 h-1 bg-[var(--t-bg)] z-10" />
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
  <div className={`relative bg-[var(--t-bg)] border border-[var(--t-border)] rounded-[var(--t-radius-md)] ${className}`}>
    {/* Corner Brackets */}
    <div className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t-2 border-l-2 border-[color-mix(in_srgb,var(--t-text)_50%,transparent)]" />
    <div className="absolute -top-[1px] -right-[1px] w-3 h-3 border-t-2 border-r-2 border-[color-mix(in_srgb,var(--t-text)_50%,transparent)]" />
    <div className="absolute -bottom-[1px] -left-[1px] w-3 h-3 border-b-2 border-l-2 border-[color-mix(in_srgb,var(--t-text)_50%,transparent)]" />
    <div className="absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b-2 border-r-2 border-[color-mix(in_srgb,var(--t-text)_50%,transparent)]" />
    
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
        relative bg-[var(--t-panel-2)] border border-[var(--t-border)] p-4 transition-all duration-200 rounded-[var(--t-radius-md)] 
        group hover:border-[var(--t-text)]
        ${className}
      `}
    >
      {/* Hover Highlight Line */}
      <div className="absolute top-0 left-0 h-full w-[2px] bg-[var(--t-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
      {children}
    </div>
  );
};

// DIVIDER – Technical dashed line
export const HexDivider: React.FC = () => (
  <div className="my-6 w-full h-px bg-[var(--t-border)] flex items-center justify-center">
    <div className="bg-[var(--t-bg)] px-2 text-[var(--t-border)] text-[10px] tracking-[0.2em] font-mono">
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
      onClick={handleClick}
      onMouseEnter={playHoverSound}
      className={`relative h-full px-8 font-mono uppercase tracking-[0.15em] text-xs font-bold
        transition-all duration-200 border-r border-[var(--t-border)] group overflow-hidden flex items-center justify-center
        ${isActive 
          ? 'text-[var(--t-bg)] bg-[var(--t-text)] shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]' 
          : 'text-[var(--t-muted)] hover:text-[var(--t-accent)] hover:bg-[color-mix(in_srgb,var(--t-accent)_5%,transparent)]'}
      `}
    >
      {/* Active Background Pattern */}
      {isActive && (
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjMDAwIiBmaWxsLW9wYWNpdHk9IjAuMSIvPjwvc3ZnPg==')] opacity-60" />
      )}

      <span className={`relative z-10 flex items-center gap-2 ${!isActive ? 'hover-text-glitch' : ''}`}>
        {/* Terminal Activation Cursor */}
        {isActive && (
          <span className="text-[var(--t-accent)] animate-blink font-black">
            {'>'}
          </span>
        )}
        {label}
      </span>
      
      {/* Active Indicators - Terminal Highlights */}
      {isActive && (
        <>
          <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--t-accent)]" />
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-[var(--t-accent)]" />
          <div className="absolute top-0 right-0 w-1 h-1 bg-[var(--t-bg)]" />
          <div className="absolute bottom-0 left-0 w-1 h-1 bg-[var(--t-bg)]" />
        </>
      )}
      
      {/* Hover decorative line */}
      {!isActive && (
        <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-[var(--t-accent)] group-hover:w-full transition-all duration-300" />
      )}
    </button>
  );
};
