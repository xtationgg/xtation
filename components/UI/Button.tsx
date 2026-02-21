import React from 'react';

export type UIButtonVariant = 'primary' | 'secondary' | 'icon';

interface UIButtonProps {
  children?: React.ReactNode;
  variant?: UIButtonVariant;
  leftIcon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  title?: string;
}

const baseClass =
  'ui-pressable inline-flex items-center justify-center gap-2 border text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ui-text)]';

const variantClass: Record<UIButtonVariant, string> = {
  primary:
    'h-10 px-4 chamfer-card border-[var(--ui-accent)] bg-[rgba(143,99,255,0.22)] hover:bg-[rgba(143,99,255,0.30)] hover:border-[rgba(184,157,255,0.95)] hover:shadow-[0_0_20px_rgba(143,99,255,0.32)]',
  secondary:
    'h-10 px-4 chamfer-card border-[var(--ui-border)] bg-[var(--ui-panel-2)] hover:border-[rgba(143,99,255,0.75)] hover:text-white',
  icon:
    'h-10 w-10 chamfer-all border-[var(--ui-border)] bg-[var(--ui-panel-2)] hover:border-[rgba(143,99,255,0.75)] hover:text-white',
};

export const Button: React.FC<UIButtonProps> = ({
  children,
  variant = 'secondary',
  leftIcon,
  onClick,
  disabled = false,
  active = false,
  className = '',
  title,
}) => {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`${baseClass} ${variantClass[variant]} ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${active ? 'ui-glow border-[var(--ui-accent)] text-white' : ''} ${className}`}
    >
      {variant !== 'icon' && leftIcon ? <span className="text-[var(--ui-accent)]">{leftIcon}</span> : null}
      {variant === 'icon' ? leftIcon ?? children : children}
    </button>
  );
};
