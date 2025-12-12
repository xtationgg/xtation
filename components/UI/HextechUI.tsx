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
      "bg-white text-black border-white " +
      "hover:bg-[#FF2A3A] hover:border-[#FF2A3A] hover:text-white " +
      "active:translate-y-[1px]",
    
    secondary:
      "bg-transparent border-[#333] text-[#888] " +
      "hover:border-white hover:text-white hover:bg:white/5 " +
      "active:translate-y-[1px]",

    ghost:
      "border-transparent text-[#666] hover:text-[#FF2A3A] hover:bg-white/5",

    danger:
      "bg-transparent border-red-900 text-red-500 " +
      "hover:bg-red-600 hover:text-black hover:border-red-600",

    play:
      "bg-[#FF2A3A] border-[#FF2A3A] text-white text-sm " +
      "hover:bg-white hover:text-black hover:border-white " +
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
          <div className="absolute top-0 left-0 w-1 h-1 bg-black z-10" />
          <div className="absolute bottom-0 right-0 w-1 h-1 bg-black z-10" />
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
  <div className={`relative bg-[#050505] border border-[#333] ${className}`}>
    {/* Corner Brackets */}
    <div className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t-2 border-l-2 border-white/50" />
    <div className="absolute -top-[1px] -right-[1px] w-3 h-3 border-t-2 border-r-2 border-white/50" />
    <div className="absolute -bottom-[1px] -left-[1px] w-3 h-3 border-b-2 border-l-2 border-white/50" />
    <div className="absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b-2 border-r-2 border-white/50" />
    
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
        relative bg-[#0F0F0F] border border-[#333] p-4 transition-all duration-200 
        group hover:border-white
        ${className}
      `}
    >
      {/* Hover Highlight Line */}
      <div className="absolute top-0 left-0 h-full w-[2px] bg-[#FF2A3A] opacity-0 group-hover:opacity-100 transition-opacity" />
      {children}
    </div>
  );
};

// DIVIDER – Technical dashed line
export const HexDivider: React.FC = () => (
  <div className="my-6 w-full h-px bg-[#333] flex items-center justify-center">
    <div className="bg-[#050505] px-2 text-[#333] text-[10px] tracking-[0.2em] font-mono">
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
        transition-all duration-200 border-r border-[#333] group overflow-hidden flex items-center justify-center
        ${isActive 
          ? 'text-black bg-white shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]' 
          : 'text-[#888] hover:text-[#FF2A3A] hover:bg-[#FF2A3A]/5'}
      `}
    >
      {/* Active Background Pattern */}
      {isActive && (
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjMDAwIiBmaWxsLW9wYWNpdHk9IjAuMSIvPjwvc3ZnPg==')] opacity-60" />
      )}

      <span className={`relative z-10 flex items-center gap-2 ${!isActive ? 'hover-text-glitch' : ''}`}>
        {/* Terminal Activation Cursor */}
        {isActive && (
          <span className="text-[#FF2A3A] animate-blink font-black">
            {'>'}
          </span>
        )}
        {label}
      </span>
      
      {/* Active Indicators - Terminal Highlights */}
      {isActive && (
        <>
          <div className="absolute top-0 left-0 w-full h-[2px] bg-[#FF2A3A]" />
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#FF2A3A]" />
          <div className="absolute top-0 right-0 w-1 h-1 bg-black" />
          <div className="absolute bottom-0 left-0 w-1 h-1 bg-black" />
        </>
      )}
      
      {/* Hover decorative line */}
      {!isActive && (
        <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-[#FF2A3A] group-hover:w-full transition-all duration-300" />
      )}
    </button>
  );
};