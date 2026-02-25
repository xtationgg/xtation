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
    'h-10 px-4 ui-shape-card border-[var(--ui-accent)] bg-[color-mix(in_srgb,var(--ui-accent)_20%,transparent)] hover:bg-[color-mix(in_srgb,var(--ui-accent)_30%,transparent)] hover:border-[color-mix(in_srgb,var(--ui-accent)_70%,var(--ui-border))]',
  secondary:
    'h-10 px-4 ui-shape-card border-[var(--ui-border)] bg-[var(--ui-panel-2)] hover:border-[var(--ui-accent)] hover:text-[var(--ui-text)]',
  icon:
    'h-10 w-10 ui-shape-all border-[var(--ui-border)] bg-[var(--ui-panel-2)] hover:border-[var(--ui-accent)] hover:text-[var(--ui-text)]',
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
      } ${active ? 'ui-glow border-[var(--ui-accent)] text-[var(--ui-text)]' : ''} ${className}`}
    >
      {variant !== 'icon' && leftIcon ? <span className="text-[var(--ui-accent)]">{leftIcon}</span> : null}
      {variant === 'icon' ? leftIcon ?? children : children}
    </button>
  );
};
