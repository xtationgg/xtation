import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ProfilePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** When true, suppress the desktop sidebar (only the mobile bottom sheet renders) */
  mobileOnly?: boolean;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ open, onClose, title, icon, children, mobileOnly }) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const header = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] shrink-0">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--app-text)]">
        {icon && <span className="text-[var(--app-accent)]">{icon}</span>}
        {title}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"
        aria-label="Close panel"
      >
        <X size={14} />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[120] pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 pointer-events-auto md:bg-black/20 bg-black/50"
        onClick={onClose}
      />

      {/* Desktop: right sidebar */}
      <div className={`absolute right-0 top-0 h-full w-80 bg-[var(--app-panel)] border-l border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] shadow-2xl pointer-events-auto flex-col lobby-slide-right ${mobileOnly ? 'hidden' : 'hidden md:flex'}`}>
        {header}
        <div className="flex-1 overflow-y-auto xt-scroll p-4">
          {children}
        </div>
      </div>

      {/* Mobile: bottom sheet */}
      <div className="absolute inset-x-0 bottom-0 max-h-[72dvh] bg-[var(--app-panel)] border-t border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] shadow-2xl pointer-events-auto flex flex-col md:hidden rounded-t-2xl lobby-slide-up">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[color-mix(in_srgb,var(--app-text)_20%,transparent)]" />
        </div>
        {header}
        <div className="flex-1 overflow-y-auto xt-scroll p-4">
          {children}
        </div>
      </div>
    </div>
  );
};
