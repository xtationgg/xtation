import React, { useEffect, useRef } from 'react';

interface AuthDrawerProps {
  open: boolean;
  onClose: () => void;
  disableClose?: boolean;
  triggerRef?: React.RefObject<HTMLElement | null>;
  variant?: 'drawer' | 'center';
  panelClassName?: string;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const AuthDrawer: React.FC<AuthDrawerProps> = ({
  open,
  onClose,
  disableClose = false,
  triggerRef,
  variant = 'drawer',
  panelClassName = '',
  children,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    wasOpenRef.current = true;

    const panel = panelRef.current;
    if (!panel) return;

    const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) => !element.hasAttribute('disabled')
    );
    const firstFocusable = focusables[0];
    const lastFocusable = focusables[focusables.length - 1];
    firstFocusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (disableClose) return;
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || focusables.length === 0) return;

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable?.focus();
        }
        return;
      }

      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [disableClose, onClose, open]);

  useEffect(() => {
    if (open || !wasOpenRef.current) return;
    wasOpenRef.current = false;
    triggerRef?.current?.focus();
  }, [open, triggerRef]);

  if (!open) return null;

  return (
    <div
      className="auth-drawer-backdrop fixed inset-0 z-[180] bg-[color-mix(in_srgb,var(--app-bg)_74%,black)] backdrop-blur-[2px]"
      onClick={() => {
        if (!disableClose) onClose();
      }}
    >
      <div
        className={[
          variant === 'drawer'
            ? 'auth-drawer-panel absolute right-0 top-0 h-[100dvh] max-w-full border-l border-[var(--app-border)] bg-[var(--app-panel)] shadow-[var(--app-shadow)]'
            : 'auth-center-panel absolute left-1/2 top-1/2 h-auto w-[min(92vw,1280px)] max-h-[92dvh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[20px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[var(--app-shadow)]',
          panelClassName,
        ].join(' ')}
        style={variant === 'drawer' ? { width: 'clamp(360px, 34vw, 520px)' } : undefined}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        ref={panelRef}
      >
        {children}
      </div>
    </div>
  );
};
