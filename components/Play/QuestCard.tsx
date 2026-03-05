import React, { useEffect, useMemo, useState } from 'react';
import { Check, Pause, Play } from 'lucide-react';
import { Task, XPSession } from '../XP/xpTypes';

const STEPS_BLOCK_REGEX = /\n?---\s*\n\[xstation_steps_v1\]\s*\n([\s\S]*?)\n---\s*$/;

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatClock = (timestamp?: number) => {
  if (!timestamp) return 'No schedule';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getDurationTargetMs = (task: Task) => {
  const source =
    (typeof task.countdownMin === 'number' && task.countdownMin > 0 && task.countdownMin) ||
    (typeof task.estimatedMinutes === 'number' && task.estimatedMinutes > 0 && task.estimatedMinutes) ||
    (typeof task.estimatedXP === 'number' && task.estimatedXP > 0 && task.estimatedXP);
  if (!source) return null;
  return Math.floor(source * 60_000);
};

const getStatus = (task: Task, isRunning: boolean) => {
  if (isRunning) return 'Running';
  if (task.completedAt || task.status === 'done') return 'Done';
  if (task.scheduledAt && task.scheduledAt > Date.now()) return 'Scheduled';
  return 'Active';
};

const getStepProgress = (details?: string) => {
  if (!details) return { total: 0, done: 0 };
  const match = details.match(STEPS_BLOCK_REGEX);
  if (!match?.[1]) return { total: 0, done: 0 };

  try {
    const parsed = JSON.parse(match[1]);
    const steps = Array.isArray(parsed?.steps) ? parsed.steps : [];
    const total = steps.filter((step: unknown) => typeof (step as { text?: unknown })?.text === 'string').length;
    const done = steps.filter((step: unknown) => !!(step as { done?: boolean })?.done).length;
    return { total, done };
  } catch {
    return { total: 0, done: 0 };
  }
};

export interface QuestCardProps {
  task: Task;
  isRunning: boolean;
  runningSession: XPSession | null;
  getTaskTrackedMs: (taskId: string, now?: number) => number;
  isFocused?: boolean;
  mediaPreviewUrl?: string | null;
  mediaPreviewType?: 'animation' | 'image' | 'video';
  mediaLabel?: string;
  onOpen: () => void;
  onToggleRun: () => void;
  onComplete: () => void;
  disabled?: boolean;
}

export const QuestCard: React.FC<QuestCardProps> = ({
  task,
  isRunning,
  runningSession,
  getTaskTrackedMs,
  isFocused = false,
  mediaPreviewUrl = null,
  mediaPreviewType = 'animation',
  mediaLabel,
  onOpen,
  onToggleRun,
  onComplete,
  disabled = false,
}) => {
  const [tickNow, setTickNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning || !runningSession) return;
    const interval = window.setInterval(() => setTickNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isRunning, runningSession?.id]);

  const elapsedMs = useMemo(
    () => getTaskTrackedMs(task.id, tickNow),
    [getTaskTrackedMs, task.id, tickNow]
  );

  const timerLabel = useMemo(() => {
    if (!isRunning || !runningSession) return null;
    const targetMs = getDurationTargetMs(task);
    if (!targetMs) return formatDuration(elapsedMs);
    return formatDuration(Math.max(0, targetMs - elapsedMs));
  }, [elapsedMs, isRunning, runningSession, task]);

  const status = getStatus(task, isRunning);
  const isCompleted = task.completedAt || task.status === 'done';
  const stepProgress = useMemo(() => getStepProgress(task.details), [task.details]);
  const progressPct = stepProgress.total > 0 ? Math.round((stepProgress.done / stepProgress.total) * 100) : 0;

  return (
    <article
      className={`group relative w-full overflow-hidden rounded-[12px] border text-left transition-colors ${
        isRunning
          ? 'border-[color-mix(in_srgb,var(--app-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel))]'
          : isFocused
          ? 'border-[color-mix(in_srgb,var(--app-accent)_34%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_8%,var(--app-panel))]'
          : 'border-[var(--app-border)] bg-[var(--app-panel)] hover:bg-[color-mix(in_srgb,var(--app-accent)_7%,var(--app-panel))]'
      } ${isCompleted ? 'opacity-70' : ''}`}
    >
      {mediaPreviewUrl ? (
        <img
          src={mediaPreviewUrl}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.12]"
        />
      ) : null}
      {!mediaPreviewUrl && mediaPreviewType === 'video' ? (
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(110,70,168,0.14),rgba(18,20,28,0.18),rgba(16,18,24,0.12))]" />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,9,12,0.78),rgba(8,9,12,0.48))]" />
      <div className="relative z-[1] flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-0.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-accent)]"
        >
          <div className={`h-10 w-1 rounded-full ${isRunning ? 'bg-[var(--app-accent)]' : 'bg-transparent'}`} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold leading-5 tracking-[0.04em] text-[var(--app-text)]">{task.title}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase leading-4 tracking-[0.1em] text-[var(--app-muted)]">
              <span>{status}</span>
              <span>•</span>
              <span>{formatClock(task.scheduledAt)}</span>
              {isRunning ? (
                <>
                  <span>•</span>
                  <span className="font-medium text-[var(--app-accent)]">{timerLabel}</span>
                </>
              ) : null}
              {mediaPreviewType !== 'animation' ? (
                <>
                  <span>•</span>
                  <span>{mediaPreviewType === 'video' ? 'video' : 'image'}</span>
                </>
              ) : null}
            </div>
            {stepProgress.total > 0 ? (
              <div className="mt-1.5">
                <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                  {stepProgress.done} / {stepProgress.total} steps complete
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--app-border)_75%,transparent)]">
                  <div
                    className="h-full rounded-full bg-[var(--app-accent)] transition-[width] duration-200"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : null}
            {mediaLabel && mediaPreviewType !== 'animation' ? (
              <div className="mt-1 truncate text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                {mediaLabel}
              </div>
            ) : null}
          </div>
        </button>

        <div className="flex items-center gap-1.5 pr-0.5">
          {!isCompleted ? (
            <button
              type="button"
              aria-label={isRunning ? 'Pause quest' : 'Start quest'}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onToggleRun();
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-text)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-accent)] disabled:opacity-40"
            >
              {isRunning ? <Pause size={16} /> : <Play size={16} />}
            </button>
          ) : null}

          {!isCompleted ? (
            <button
              type="button"
              aria-label="Complete quest"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onComplete();
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-text)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-accent)] disabled:opacity-40"
            >
              <Check size={16} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
};
