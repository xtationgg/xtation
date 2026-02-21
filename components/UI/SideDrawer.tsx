import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SideDrawerProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  collapsedLabel?: string;
  children: React.ReactNode;
  className?: string;
  widthClassName?: string;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  title,
  open,
  onToggle,
  collapsedLabel,
  children,
  className = '',
  widthClassName = 'w-[280px]',
}) => {
  return (
    <aside
      className={`ui-panel-surface chamfer-left relative shrink-0 overflow-hidden transition-[width] duration-[160ms] ease-[var(--ui-ease)] ${
        open ? widthClassName : 'w-[56px]'
      } ${className}`}
      style={{ '--cut': 'var(--ui-cut-md)' } as React.CSSProperties}
    >
      <div className="flex h-full">
        <button
          type="button"
          onClick={onToggle}
          className="ui-pressable flex w-[56px] shrink-0 flex-col items-center justify-center gap-2 border-r border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
          aria-label={open ? 'Collapse drawer' : 'Expand drawer'}
        >
          {open ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          <span className="text-[9px] font-semibold uppercase tracking-[0.22em]">Type</span>
          {!open && collapsedLabel ? (
            <span className="max-w-[42px] text-center text-[8px] uppercase tracking-[0.16em] text-[var(--ui-text)]">{collapsedLabel}</span>
          ) : null}
        </button>

        {open ? (
          <div className="min-w-0 flex-1">
            <div className="border-b border-[var(--ui-border)] px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--ui-text)]">
              {title}
            </div>
            <div className="h-[calc(100%-40px)] overflow-y-auto p-3">{children}</div>
          </div>
        ) : null}
      </div>
    </aside>
  );
};
