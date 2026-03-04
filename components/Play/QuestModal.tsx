import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { DateTimePicker } from '../UI/DateTimePicker';
import { ConfirmModal } from '../UI/ConfirmModal';
import { Task, TaskPriority } from '../XP/xpTypes';

interface QuestDraft {
  title: string;
  details: string;
  priority: TaskPriority;
  schedule: string;
}

interface StepDraft {
  id: string;
  text: string;
  done: boolean;
}

interface QuestModalProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSave: (draft: { title: string; details: string; priority: TaskPriority; scheduledAt?: number }) => void;
  onDelete?: () => void;
}

const toLocalDateTimeInput = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(timestamp - offset).toISOString().slice(0, 16);
};

const defaultDraft: QuestDraft = {
  title: '',
  details: '',
  priority: 'high',
  schedule: '',
};

const serializeDraft = (draft: QuestDraft, steps: StepDraft[]) =>
  JSON.stringify({
    ...draft,
    steps,
  });

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const QuestModal: React.FC<QuestModalProps> = ({ open, task, onClose, onSave, onDelete }) => {
  const [draft, setDraft] = useState<QuestDraft>(defaultDraft);
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [newStepText, setNewStepText] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const initialSnapshotRef = useRef<string>(serializeDraft(defaultDraft, []));
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const nextDraft: QuestDraft = task
      ? {
          title: task.title,
          details: task.details || '',
          priority: task.priority || 'high',
          schedule: toLocalDateTimeInput(task.scheduledAt),
        }
      : defaultDraft;

    setDraft(nextDraft);
    setSteps([]);
    setNewStepText('');
    const snapshot = serializeDraft(nextDraft, []);
    initialSnapshotRef.current = snapshot;
  }, [open, task]);

  useEffect(() => {
    if (!open) return;

    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const firstFocusable = surfaceRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        attemptClose();
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
  });

  const isDirty = useMemo(() => {
    if (!open) return false;
    const current = serializeDraft(draft, steps);
    return current !== initialSnapshotRef.current;
  }, [open, draft, steps]);

  const attemptClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  };

  const handleSave = () => {
    const title = draft.title.trim();
    if (!title) return;
    onSave({
      title,
      details: draft.details.trim(),
      priority: draft.priority,
      scheduledAt: draft.schedule ? new Date(draft.schedule).getTime() : undefined,
    });
  };

  const addStep = () => {
    const text = newStepText.trim();
    if (!text) return;
    setSteps((prev) => [
      ...prev,
      { id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, done: false },
    ]);
    setNewStepText('');
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="Close quest modal"
          onClick={attemptClose}
          className="absolute inset-0 bg-black/45"
        />

        <div
          ref={surfaceRef}
          role="dialog"
          aria-modal="true"
          aria-label={task ? 'Edit quest' : 'Create quest'}
          className="relative w-full max-w-[720px] rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] p-5 transition-all duration-200"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">
                {task ? 'Edit Quest' : 'Add Quest'}
              </h2>
              <p className="mt-1 text-[10px] leading-4 tracking-[0.08em] text-[var(--app-muted)]">
                Clean quest editor • steps are local in phase 1
              </p>
            </div>
            <button
              type="button"
              onClick={attemptClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Title</label>
              <input
                autoFocus
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSave();
                  }
                }}
                className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2.5 text-[14px] font-medium leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                placeholder="Quest title"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Notes</label>
              <textarea
                value={draft.details}
                onChange={(event) => setDraft((prev) => ({ ...prev, details: event.target.value }))}
                className="min-h-[96px] w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2.5 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                placeholder="Quest notes"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Priority</label>
                <select
                  value={draft.priority}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, priority: event.target.value as TaskPriority }))
                  }
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Schedule</label>
                <DateTimePicker value={draft.schedule} onChange={(value) => setDraft((prev) => ({ ...prev, schedule: value }))} />
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] p-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Steps (checklist)</div>
              <div className="flex gap-2">
                <input
                  value={newStepText}
                  onChange={(event) => setNewStepText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addStep();
                    }
                  }}
                  className="flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1.5 text-[12px] leading-4 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                  placeholder="Add step"
                />
                <button
                  type="button"
                  onClick={addStep}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-text)] hover:border-[var(--app-accent)]"
                  aria-label="Add step"
                >
                  <Plus size={14} />
                </button>
              </div>
              {steps.length ? (
                <div className="max-h-28 space-y-1 overflow-y-auto pr-1">
                  {steps.map((step) => (
                    <div key={step.id} className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1 text-xs text-[var(--app-text)]">
                      <input
                        type="checkbox"
                        checked={step.done}
                        onChange={() =>
                          setSteps((prev) =>
                            prev.map((item) => (item.id === step.id ? { ...item, done: !item.done } : item))
                          )
                        }
                        className="h-3.5 w-3.5"
                      />
                      <span className={`flex-1 leading-4 ${step.done ? 'line-through opacity-60' : ''}`}>{step.text}</span>
                      <button
                        type="button"
                        aria-label="Remove step"
                        onClick={() => setSteps((prev) => prev.filter((item) => item.id !== step.id))}
                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--app-border)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div>
              {task && onDelete ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-lg border border-[color-mix(in_srgb,var(--app-accent)_35%,transparent)] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
                >
                  Delete
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={attemptClose}
                className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-2)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--app-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!draft.title.trim()}
                className="rounded-lg border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)] disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showDiscardConfirm}
        title="Discard changes?"
        message="You have unsaved edits in this quest modal."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onClose();
        }}
      />

      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete quest"
        message="This action removes the quest and its local references."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete?.();
        }}
      />
    </>
  );
};
