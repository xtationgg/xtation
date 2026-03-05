import React, { useEffect, useRef } from 'react';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const focusables = surfaceRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== 'Tab') return;
      const nodes = surfaceRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!nodes || nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      lastFocusedRef.current?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
        aria-hidden="true"
        onMouseDown={onCancel}
      />
      <div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] bg-[color-mix(in_srgb,var(--app-panel)_92%,black)] p-4 shadow-[0_16px_44px_rgba(0,0,0,0.45)]"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="text-sm uppercase tracking-[0.16em] text-[var(--app-text)]">{title}</div>
        <div className="mt-2 text-xs leading-6 tracking-[0.08em] text-[var(--app-muted)]">{message}</div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[color-mix(in_srgb,var(--app-text)_18%,transparent)] bg-[var(--app-panel)] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-confirm-primary="true"
            onClick={onConfirm}
            className="rounded-md border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
