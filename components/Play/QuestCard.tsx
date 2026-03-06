import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronUp, Pause, Play } from 'lucide-react';
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
  if (!timestamp) return null;
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatScheduleLabel = (timestamp?: number) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const weekday = date.toLocaleDateString([], { weekday: 'short' });
  const month = date.toLocaleDateString([], { month: 'short' });
  return `${weekday} ${date.getDate()}/${month}`;
};

const getDurationTargetMs = (task: Task) => {
  const source =
    (typeof task.countdownMin === 'number' && task.countdownMin > 0 && task.countdownMin) ||
    (typeof task.estimatedMinutes === 'number' && task.estimatedMinutes > 0 && task.estimatedMinutes) ||
    (typeof task.estimatedXP === 'number' && task.estimatedXP > 0 && task.estimatedXP);
  if (!source) return null;
  return Math.floor(source * 60_000);
};

const getPriorityLevel = (priorityVisual: 'normal' | 'high' | 'urgent' | 'extreme') => {
  if (priorityVisual === 'extreme') return 4;
  if (priorityVisual === 'urgent') return 3;
  if (priorityVisual === 'high') return 2;
  return 1;
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
  priorityVisual?: 'normal' | 'high' | 'urgent' | 'extreme';
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
  priorityVisual = 'normal',
  onOpen,
  onToggleRun,
  onComplete,
  disabled = false,
}) => {
  const [tickNow, setTickNow] = useState(() => Date.now());
  const isScheduledFuture = !!task.scheduledAt && task.scheduledAt > Date.now();

  useEffect(() => {
    if (!isRunning && !isScheduledFuture) return;
    const interval = window.setInterval(() => setTickNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isRunning, isScheduledFuture, runningSession?.id]);

  const elapsedMs = useMemo(
    () => getTaskTrackedMs(task.id, tickNow),
    [getTaskTrackedMs, task.id, tickNow]
  );

  const targetMs = useMemo(() => getDurationTargetMs(task), [task]);
  const isCountdownFinished = !!(targetMs && elapsedMs >= targetMs);
  const timerLabel = useMemo(() => {
    if (!isRunning || !runningSession) return null;
    if (!targetMs) return formatDuration(elapsedMs);
    return formatDuration(Math.max(0, targetMs - elapsedMs));
  }, [elapsedMs, isRunning, runningSession, targetMs]);

  const isCompleted = task.completedAt || task.status === 'done';
  const stepProgress = useMemo(() => getStepProgress(task.details), [task.details]);
  const progressPct = stepProgress.total > 0 ? Math.round((stepProgress.done / stepProgress.total) * 100) : 0;
  const priorityLevel = useMemo(() => getPriorityLevel(priorityVisual), [priorityVisual]);
  const timedProgress = useMemo(() => {
    if (!targetMs || targetMs <= 0) return null;
    const ratio = Math.max(0, Math.min(1, elapsedMs / targetMs));
    return ratio;
  }, [elapsedMs, targetMs]);
  const schedulePulse = useMemo(() => {
    if (!task.scheduledAt || task.scheduledAt <= Date.now()) return null;
    const until = task.scheduledAt - Date.now();
    const totalWindow = 1000 * 60 * 60 * 24;
    const ratio = 1 - Math.max(0, Math.min(1, until / totalWindow));
    return ratio;
  }, [task.scheduledAt, tickNow]);
  const stateToneClass = useMemo(() => {
    if (isCountdownFinished) return 'bg-[#f4c664] shadow-[0_0_10px_rgba(244,198,100,0.45)]';
    if (isCompleted) return 'bg-[var(--app-accent)] shadow-[0_0_10px_color-mix(in_srgb,var(--app-accent)_45%,transparent)]';
    if (isScheduledFuture) return 'bg-[#55a3ff] shadow-[0_0_10px_rgba(85,163,255,0.45)]';
    if (isRunning) return 'bg-[var(--app-accent)] shadow-[0_0_10px_color-mix(in_srgb,var(--app-accent)_40%,transparent)]';
    return 'bg-[color-mix(in_srgb,var(--app-muted)_80%,transparent)]';
  }, [isCountdownFinished, isCompleted, isScheduledFuture, isRunning]);
  const scheduleShort = useMemo(() => formatScheduleLabel(task.scheduledAt), [task.scheduledAt]);
  const scheduleRemaining = useMemo(() => {
    if (!task.scheduledAt || task.scheduledAt <= Date.now()) return null;
    let remaining = task.scheduledAt - Date.now();
    const minutes = Math.floor(remaining / 60_000);
    const hours = Math.floor(remaining / 3_600_000);
    const days = Math.floor(remaining / 86_400_000);
    const months = Math.floor(days / 30);

    if (months > 0) {
      const monthDays = days - months * 30;
      const hourRemainder = Math.max(0, Math.floor((remaining - days * 86_400_000) / 3_600_000));
      return `${months}M ${monthDays}D ${hourRemainder}H`;
    }
    if (days > 0) {
      const hourRemainder = Math.max(0, Math.floor((remaining - days * 86_400_000) / 3_600_000));
      const minuteRemainder = Math.max(
        0,
        Math.floor((remaining - days * 86_400_000 - hourRemainder * 3_600_000) / 60_000)
      );
      return `${days}D ${hourRemainder}H ${minuteRemainder}M`;
    }
    const hourOnly = Math.floor(minutes / 60);
    const minuteOnly = Math.max(0, minutes - hourOnly * 60);
    return `${hourOnly}H ${minuteOnly}M`;
  }, [task.scheduledAt, tickNow]);
  const rightTimeLabel = timerLabel || scheduleShort || formatClock(task.scheduledAt) || null;
  const isTimedQuest = !!targetMs || !!task.scheduledAt || isRunning;
  const effectiveProgress = timedProgress ?? schedulePulse;
  const hasActiveTiming = isRunning || !!targetMs || (!!task.scheduledAt && task.scheduledAt > Date.now());
  const runLabel = isCountdownFinished ? 'Countdown finished' : isRunning ? 'Pause quest' : 'Start quest';

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`quest-card-shell group relative w-full overflow-hidden rounded-[12px] border text-left transition-colors ${
        isRunning
          ? 'border-[color-mix(in_srgb,var(--app-accent)_58%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))] shadow-[0_0_0_1px_color-mix(in_srgb,var(--app-accent)_30%,transparent)]'
          : isCompleted
          ? 'border-[color-mix(in_srgb,var(--app-accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))]'
          : isFocused
          ? 'border-[color-mix(in_srgb,var(--app-accent)_34%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_8%,var(--app-panel))]'
          : hasActiveTiming
          ? 'border-[color-mix(in_srgb,var(--app-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_6%,var(--app-panel))]'
          : 'border-[var(--app-border)] bg-[var(--app-panel)] hover:bg-[color-mix(in_srgb,var(--app-accent)_7%,var(--app-panel))]'
      }`}
    >
      {mediaPreviewUrl && mediaPreviewType === 'image' ? (
        <img
          src={mediaPreviewUrl}
          alt=""
          aria-hidden
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            isFocused || isRunning ? 'opacity-[0.46]' : 'opacity-0 group-hover:opacity-[0.34]'
          }`}
        />
      ) : null}
      {mediaPreviewUrl && mediaPreviewType === 'video' ? (
        <video
          src={mediaPreviewUrl}
          muted
          loop
          autoPlay
          playsInline
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            isFocused || isRunning ? 'opacity-[0.46]' : 'opacity-0 group-hover:opacity-[0.34]'
          }`}
        />
      ) : null}
      {!mediaPreviewUrl && mediaPreviewType === 'video' ? (
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(110,70,168,0.14),rgba(18,20,28,0.18),rgba(16,18,24,0.12))]" />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,9,12,0.78),rgba(8,9,12,0.48))]" />
      <div className="relative z-[1] flex items-start gap-2 p-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-0.5 text-left outline-none transition-transform duration-200 group-hover:translate-x-[1px]">
          <div className="flex w-4 shrink-0 flex-col items-center justify-center gap-0.5">
            {[4, 3, 2, 1].map((level) => (
              <ChevronUp
                key={level}
                size={11}
                className={
                  priorityLevel >= level
                    ? `quest-priority-arrow text-[var(--app-text)] ${isRunning || isFocused ? 'quest-priority-arrow--active' : ''}`
                    : 'quest-priority-arrow text-[color-mix(in_srgb,var(--app-muted)_45%,transparent)]'
                }
                strokeWidth={2.3}
              />
            ))}
          </div>
          <div className={`h-10 w-1 rounded-full ${isRunning ? 'bg-[var(--app-accent)]' : 'bg-transparent'}`} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold leading-5 tracking-[0.04em] text-[var(--app-text)]">{task.title}</div>
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
          </div>
        </div>

        <div className="flex w-[176px] shrink-0 items-center justify-end gap-1.5 pr-0.5">
          <span className={`inline-flex h-2.5 w-2.5 rounded-full ${stateToneClass}`} aria-hidden="true" />
          {rightTimeLabel ? (
            <div className="min-w-[72px] text-right text-[13px] font-semibold tracking-[0.06em] text-[var(--app-text)]">
              <span className={scheduleRemaining && !isRunning ? 'group-hover:hidden' : ''}>{rightTimeLabel}</span>
              {scheduleRemaining && !isRunning ? (
                <span className="hidden group-hover:inline">{scheduleRemaining}</span>
              ) : null}
            </div>
          ) : null}
          {!isCompleted ? (
            <>
              <button
                type="button"
                aria-label={runLabel}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  onToggleRun();
                }}
                className="inline-flex h-8 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-text)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-accent)] disabled:opacity-40"
              >
                {isCountdownFinished ? <Check size={16} /> : isRunning ? <Pause size={16} /> : <Play size={16} />}
              </button>

              <button
                type="button"
                aria-label="Complete quest"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  onComplete();
                }}
                className="inline-flex h-8 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-text)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-accent)] disabled:opacity-40"
              >
                <Check size={16} />
              </button>
            </>
          ) : null}
        </div>
      </div>
      {isTimedQuest ? (
        <div className="relative z-[1] px-3 pb-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--app-border)_70%,transparent)]">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                isRunning
                  ? 'bg-[color-mix(in_srgb,var(--app-accent)_80%,#ffffff)]'
                  : isScheduledFuture
                  ? 'bg-[#55a3ff]'
                  : 'bg-[var(--app-accent)]'
              }`}
              style={{ width: `${Math.max(4, ((effectiveProgress || 0) * 100))}%` }}
            />
          </div>
        </div>
      ) : null}
    </article>
  );
};
