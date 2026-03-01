import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DrawerOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Fixed-position overlay drawer that slides in from the right.
 * Does NOT affect page layout — uses position: fixed + translateX.
 */
export const DrawerOverlay: React.FC<DrawerOverlayProps> = ({ open, onClose, title, icon, children }) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[148] transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        } bg-black/30 backdrop-blur-[1px]`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel — translateX controls open/close, layout is never pushed */}
      <div
        className={`fixed top-0 right-0 h-full w-80 z-[149] bg-[var(--app-panel)] border-l border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] shrink-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--app-text)]">
            {icon && <span className="text-[var(--app-accent)]">{icon}</span>}
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)] rounded"
            aria-label="Close panel"
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto xt-scroll p-4">
          {children}
        </div>
      </div>
    </>
  );
};
