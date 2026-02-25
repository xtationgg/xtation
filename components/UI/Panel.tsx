import React from 'react';

interface PanelProps {
  title?: string;
  subtitle?: string;
  headerSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  cutSize?: 'sm' | 'md' | 'lg';
}

const cutToValue: Record<NonNullable<PanelProps['cutSize']>, string> = {
  sm: 'var(--ui-cut-sm)',
  md: 'var(--ui-cut-md)',
  lg: 'var(--ui-cut-lg)',
};

export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  headerSlot,
  children,
  className = '',
  cutSize = 'md',
}) => {
  return (
    <section
      className={`ui-panel-surface ui-shape-card relative overflow-hidden ${className}`}
      style={{ '--cut': cutToValue[cutSize] } as React.CSSProperties}
    >
      {(title || headerSlot) && (
        <header className="flex items-start justify-between gap-3 border-b border-[var(--ui-border)] px-4 py-3">
          <div className="min-w-0">
            {title ? (
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--ui-text)]">{title}</h3>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--ui-muted)]">{subtitle}</p>
            ) : null}
          </div>
          {headerSlot}
        </header>
      )}
      <div className="px-4 py-4">{children}</div>
    </section>
  );
};
