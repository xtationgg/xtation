import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { DateTimePicker } from '../UI/DateTimePicker';
import { ConfirmModal } from '../UI/ConfirmModal';
import { Task, TaskPriority, QuestType, QuestLevel } from '../XP/xpTypes';
import { useXP } from '../XP/xpStore';

interface QuestDraft {
  title: string;
  details: string;
  priority: TaskPriority;
  scheduledAt?: number;
  questType: QuestType;
  level: QuestLevel;
  projectId?: string;
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
  onSave: (draft: {
    title: string;
    details: string;
    priority: TaskPriority;
    scheduledAt?: number;
    questType: QuestType;
    level: QuestLevel;
    projectId?: string;
  }) => void;
  onDelete?: () => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const STEPS_BLOCK_REGEX = /\n?---\s*\n\[xstation_steps_v1\]\s*\n([\s\S]*?)\n---\s*$/;

const defaultDraft: QuestDraft = {
  title: '',
  details: '',
  priority: 'high',
  scheduledAt: undefined,
  questType: 'session',
  level: 1,
  projectId: undefined,
};

const createStepId = () => `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toLocalDateTimeInput = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(timestamp - offset).toISOString().slice(0, 16);
};

const roundToFiveMinutes = (date = new Date()) => {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const rounded = Math.ceil(next.getMinutes() / 5) * 5;
  if (rounded >= 60) {
    next.setHours(next.getHours() + 1);
    next.setMinutes(0);
  } else {
    next.setMinutes(rounded);
  }
  return next;
};

const makeScheduleSeed = (timestamp?: number) => toLocalDateTimeInput(timestamp || roundToFiveMinutes().getTime());

const parseNotesAndSteps = (raw: string) => {
  if (!raw) {
    return { notes: '', steps: [] as StepDraft[] };
  }

  const match = raw.match(STEPS_BLOCK_REGEX);
  if (!match) {
    return { notes: raw, steps: [] as StepDraft[] };
  }

  const jsonPayload = match[1]?.trim();
  const noteText = raw.replace(STEPS_BLOCK_REGEX, '').trimEnd();

  try {
    const parsed = JSON.parse(jsonPayload);
    const steps = Array.isArray(parsed?.steps)
      ? parsed.steps
          .map((step: unknown) => {
            const next = step as { text?: string; done?: boolean };
            const text = typeof next?.text === 'string' ? next.text.trim() : '';
            if (!text) return null;
            return {
              id: createStepId(),
              text,
              done: !!next?.done,
            } as StepDraft;
          })
          .filter(Boolean) as StepDraft[]
      : [];

    return { notes: noteText, steps };
  } catch {
    return { notes: noteText, steps: [] as StepDraft[] };
  }
};

const encodeNotesWithSteps = (notes: string, steps: StepDraft[]) => {
  const trimmedNotes = notes.trimEnd();
  const normalizedSteps = steps
    .map((step) => ({ text: step.text.trim(), done: step.done }))
    .filter((step) => step.text.length > 0);

  if (!normalizedSteps.length) {
    return trimmedNotes;
  }

  const block = `---\n[xstation_steps_v1]\n${JSON.stringify({ steps: normalizedSteps }, null, 2)}\n---`;
  return trimmedNotes ? `${trimmedNotes}\n\n${block}` : block;
};

const serializeSnapshot = (draft: QuestDraft, steps: StepDraft[], scheduleSeed: string) =>
  JSON.stringify({
    title: draft.title,
    details: draft.details,
    priority: draft.priority,
    scheduledAt: draft.scheduledAt || null,
    scheduleSeed,
    questType: draft.questType,
    level: draft.level,
    projectId: draft.projectId || null,
    steps: steps.map((step) => ({ text: step.text, done: step.done })),
  });

const formatScheduleHeader = (value: string) => {
  if (!value) return 'Today';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Today';
  return parsed.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatScheduledPreview = (timestamp?: number) => {
  if (!timestamp) return 'No schedule set';
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return 'No schedule set';
  return value.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const QuestModal: React.FC<QuestModalProps> = ({ open, task, onClose, onSave, onDelete }) => {
  const { projects } = useXP();
  const activeProjects = projects.filter((p) => p.status !== 'Archived');
  const [draft, setDraft] = useState<QuestDraft>(defaultDraft);
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [newStepText, setNewStepText] = useState('');
  const [scheduleSeed, setScheduleSeed] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const initialSnapshotRef = useRef<string>(serializeSnapshot(defaultDraft, [], ''));
  const isDirtyRef = useRef(false);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const parsed = parseNotesAndSteps(task?.details || '');
    const nextScheduleSeed = makeScheduleSeed(task?.scheduledAt);
    const nextDraft: QuestDraft = task
      ? {
          title: task.title,
          details: parsed.notes,
          priority: task.priority || 'high',
          scheduledAt: task.scheduledAt,
          questType: task.questType ?? 'session',
          level: task.level ?? 1,
          projectId: task.projectId,
        }
      : {
          ...defaultDraft,
          scheduledAt: undefined,
        };

    setDraft(nextDraft);
    setSteps(parsed.steps);
    setNewStepText('');
    setScheduleOpen(false);
    setScheduleSeed(nextScheduleSeed);

    initialSnapshotRef.current = serializeSnapshot(nextDraft, parsed.steps, nextScheduleSeed);
  }, [open, task]);

  const isDirty = useMemo(() => {
    if (!open) return false;
    return serializeSnapshot(draft, steps, scheduleSeed) !== initialSnapshotRef.current;
  }, [open, draft, steps, scheduleSeed]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const attemptClose = useCallback(() => {
    if (isDirtyRef.current) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }, [onClose]);

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

      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        handleSave();
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
  }, [open, attemptClose]);

  const saveDisabled =
    !draft.title.trim() ||
    (draft.questType === 'scheduled' && scheduleOpen && !draft.scheduledAt);

  const handleSave = () => {
    const title = draft.title.trim();
    if (!title) return;
    if (saveDisabled) return;

    onSave({
      title,
      details: encodeNotesWithSteps(draft.details, steps),
      priority: draft.priority,
      scheduledAt: draft.scheduledAt,
      questType: draft.questType,
      level: draft.level,
      projectId: draft.projectId || undefined,
    });
  };

  const addStep = () => {
    const text = newStepText.trim();
    if (!text) return;
    setSteps((prev) => [...prev, { id: createStepId(), text, done: false }]);
    setNewStepText('');
  };

  const applyScheduledAt = () => {
    const nextTs = scheduleSeed ? new Date(scheduleSeed).getTime() : undefined;
    setDraft((prev) => ({ ...prev, scheduledAt: Number.isFinite(nextTs) ? nextTs : undefined }));
  };

  const clearScheduledAt = () => {
    setDraft((prev) => ({ ...prev, scheduledAt: undefined }));
    setScheduleSeed(makeScheduleSeed());
  };

  const setNowSeed = () => {
    setScheduleSeed(makeScheduleSeed());
  };

  const setTodaySeed = () => {
    const roundedNow = roundToFiveMinutes();
    const next = new Date(scheduleSeed ? new Date(scheduleSeed) : roundedNow);
    if (Number.isNaN(next.getTime())) {
      setScheduleSeed(makeScheduleSeed());
      return;
    }

    next.setFullYear(roundedNow.getFullYear(), roundedNow.getMonth(), roundedNow.getDate());
    const offset = next.getTimezoneOffset() * 60000;
    setScheduleSeed(new Date(next.getTime() - offset).toISOString().slice(0, 16));
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
          onMouseDown={(event) => event.stopPropagation()}
        >
          {/* Floating close button — outside layout */}
          <button
            type="button"
            onClick={attemptClose}
            className="absolute -top-3 -right-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)] shadow-md hover:text-[var(--app-text)] transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>

          <div className="mb-4">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">
              {task ? 'Edit Quest' : 'Add Quest'}
            </h2>
            <p className="mt-1 text-[10px] leading-4 tracking-[0.08em] text-[var(--app-muted)]">
              Stable schedule panel + persistent checklist
            </p>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Title</label>
              <input
                autoFocus
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
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
                <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Type</label>
                <select
                  value={draft.questType}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, questType: event.target.value as QuestType }))
                  }
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="session">Session</option>
                  <option value="instant">Instant</option>
                  <option value="scheduled">Countdown</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Level</label>
                <select
                  value={draft.level}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, level: Number(event.target.value) as QuestLevel }))
                  }
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value={1}>L1 — Standard</option>
                  <option value={2}>L2 — Focused</option>
                  <option value={3}>L3 — Priority</option>
                  <option value={4}>L4 — Critical</option>
                </select>
              </div>
            </div>

            {activeProjects.length > 0 ? (
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Project</label>
                <select
                  value={draft.projectId ?? ''}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, projectId: e.target.value || undefined }))
                  }
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="">No project</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

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
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] p-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!scheduleOpen) setScheduleSeed(makeScheduleSeed());
                      setScheduleOpen((prev) => !prev);
                    }}
                    data-testid="schedule-toggle"
                    className="flex w-full items-center justify-between rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-2.5 py-2 text-left text-[11px] text-[var(--app-text)]"
                  >
                    <span data-testid="schedule-value-preview">{formatScheduledPreview(draft.scheduledAt)}</span>
                    <span className="text-[9px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                      {scheduleOpen ? 'Close' : 'Open'}
                    </span>
                  </button>

                  {scheduleOpen ? (
                    <div
                      data-testid="schedule-panel"
                      className="mt-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] p-2.5"
                      onClick={(event) => event.stopPropagation()}
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--app-border)] pb-2">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                          {formatScheduleHeader(scheduleSeed)}
                        </div>
                        <button
                          type="button"
                          aria-label="Close schedule panel"
                          onClick={() => setScheduleOpen(false)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--app-border)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                        >
                          <X size={12} />
                        </button>
                      </div>

                      <DateTimePicker
                        value={scheduleSeed}
                        onChange={setScheduleSeed}
                        className="w-full"
                        placeholder="Set schedule"
                        triggerTestId="schedule-picker-trigger"
                      />

                      <div className="mt-2.5 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={setNowSeed}
                          className="rounded-lg border border-[var(--app-border)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]"
                        >
                          Now
                        </button>
                        <button
                          type="button"
                          onClick={setTodaySeed}
                          className="rounded-lg border border-[var(--app-border)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]"
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={clearScheduledAt}
                          className="rounded-lg border border-[var(--app-border)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={applyScheduledAt}
                          data-testid="schedule-add"
                          className="rounded-lg border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)]"
                        >
                          Add Scheduled
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
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
                    <div
                      key={step.id}
                      className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1 text-xs text-[var(--app-text)]"
                    >
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
                disabled={saveDisabled}
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
