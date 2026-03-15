import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronUp, Pause, Play } from 'lucide-react';
import { Task, XPSession, QuestType, QuestLevel } from '../XP/xpTypes';

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

const getCountdownTargetMs = (task: Task) => {
  if (typeof task.countdownMin !== 'number' || task.countdownMin <= 0) return null;
  return Math.floor(task.countdownMin * 60_000);
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

const extractYouTubeVideoId = (url?: string | null) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace('www.', '');
    if (hostname.includes('youtu.be')) {
      return parsed.pathname.split('/').filter(Boolean)[0] || null;
    }
    if (hostname.includes('youtube.com') || hostname.includes('youtube-nocookie.com')) {
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/shorts/')[1]?.split('/')[0] || null;
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/embed/')[1]?.split('/')[0] || null;
      }
      return parsed.searchParams.get('v') || parsed.searchParams.get('vi');
    }
  } catch {
    return null;
  }
  return null;
};

const getYouTubeThumbnailUrl = (url?: string | null) => {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
};

const isDirectVideoSource = (src?: string | null) => {
  if (!src) return false;
  if (src.startsWith('blob:') || src.startsWith('data:video/')) return true;
  try {
    const parsed = new URL(src);
    const clean = parsed.pathname.toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v)$/i.test(clean);
  } catch {
    const clean = src.toLowerCase().split('?')[0].split('#')[0];
    return /\.(mp4|webm|ogg|mov|m4v)$/i.test(clean);
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
  /** Quest type from the Xtation Core Engine. Falls back to task.questType if not provided. */
  questType?: QuestType;
  /** Quest level (L1–L4). Falls back to task.level if not provided. */
  level?: QuestLevel;
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
  questType: questTypeProp,
  level: levelProp,
  onOpen,
  onToggleRun,
  onComplete,
  disabled = false,
}) => {
  // Props take precedence; fall back to values stored on the task itself.
  const resolvedQuestType: QuestType = questTypeProp ?? task.questType ?? 'session';
  const resolvedLevel: QuestLevel = levelProp ?? task.level ?? 1;
  const [tickNow, setTickNow] = useState(() => Date.now());
  const isScheduledFuture = !!task.scheduledAt && task.scheduledAt > tickNow;

  useEffect(() => {
    if (!isRunning && !isScheduledFuture) return;
    const interval = window.setInterval(() => setTickNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isRunning, isScheduledFuture, runningSession?.id]);

  const elapsedMs = useMemo(
    () => getTaskTrackedMs(task.id, tickNow),
    [getTaskTrackedMs, task.id, tickNow]
  );

  const countdownTargetMs = useMemo(() => getCountdownTargetMs(task), [task]);
  const isCountdownFinished = !!(countdownTargetMs && elapsedMs >= countdownTargetMs);
  const timerLabel = useMemo(() => {
    if (!isRunning || !runningSession) return null;
    if (!countdownTargetMs) return formatDuration(elapsedMs);
    return formatDuration(Math.max(0, countdownTargetMs - elapsedMs));
  }, [elapsedMs, isRunning, runningSession, countdownTargetMs]);

  const isCompleted = task.completedAt || task.status === 'done';
  const stepProgress = useMemo(() => getStepProgress(task.details), [task.details]);
  const progressPct = stepProgress.total > 0 ? Math.round((stepProgress.done / stepProgress.total) * 100) : 0;
  const priorityLevel = useMemo(() => getPriorityLevel(priorityVisual), [priorityVisual]);
  const timedProgress = useMemo(() => {
    if (!countdownTargetMs || countdownTargetMs <= 0) return null;
    const ratio = Math.max(0, Math.min(1, elapsedMs / countdownTargetMs));
    return ratio;
  }, [elapsedMs, countdownTargetMs]);
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
  const completedClock = formatClock(task.completedAt);
  const completedShort = formatScheduleLabel(task.completedAt);
  const trackedLabel = elapsedMs > 0 ? formatDuration(elapsedMs) : null;
  const rightTimeLabel =
    timerLabel ||
    (isCompleted ? completedClock : null) ||
    scheduleShort ||
    trackedLabel ||
    null;
  const effectiveProgress = timedProgress;
  const hasActiveTiming = isRunning || !!countdownTargetMs || !!isScheduledFuture;
  const showProgressBar = !!countdownTargetMs;
  const runLabel = isRunning ? 'Pause quest' : 'Start quest';
  const mediaPreviewImageSrc =
    mediaPreviewType === 'video' ? getYouTubeThumbnailUrl(mediaPreviewUrl) : mediaPreviewUrl;
  const canRenderDirectVideo = mediaPreviewType === 'video' && isDirectVideoSource(mediaPreviewUrl);

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
      {mediaPreviewImageSrc && (mediaPreviewType === 'image' || (mediaPreviewType === 'video' && !canRenderDirectVideo)) ? (
        <img
          src={mediaPreviewImageSrc}
          alt=""
          aria-hidden
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            isFocused || isRunning ? 'opacity-[0.46]' : 'opacity-0 group-hover:opacity-[0.34]'
          }`}
        />
      ) : null}
      {mediaPreviewUrl && canRenderDirectVideo ? (
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
                    ? `quest-priority-arrow text-[var(--app-text)] ${!isCompleted && (isRunning || isFocused) ? 'quest-priority-arrow--active' : ''}`
                    : 'quest-priority-arrow text-[color-mix(in_srgb,var(--app-muted)_45%,transparent)]'
                }
                strokeWidth={2.3}
              />
            ))}
          </div>
          <div className={`h-10 w-1 rounded-full ${isRunning ? 'bg-[var(--app-accent)]' : 'bg-transparent'}`} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold leading-5 tracking-[0.04em] text-[var(--app-text)]">{task.title}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="rounded px-1 py-px text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)] ring-1 ring-inset ring-[var(--app-border)]">
                {resolvedQuestType}
              </span>
              {resolvedLevel > 1 ? (
                <span className="rounded px-1 py-px text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--app-accent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--app-accent)_40%,transparent)]">
                  L{resolvedLevel}
                </span>
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
          </div>
        </div>

        <div className="flex w-[168px] shrink-0 items-center justify-end gap-2 pr-0.5">
          {rightTimeLabel ? (
            <div className="min-w-[72px] text-right text-[13px] font-semibold tracking-[0.06em] text-[var(--app-text)]">
              <span>{rightTimeLabel}</span>
              {isCompleted && completedShort ? (
                <div className="mt-0.5 text-[9px] font-medium tracking-[0.06em] text-[var(--app-muted)]">{completedShort}</div>
              ) : null}
              {scheduleRemaining && !isRunning && !isCompleted ? (
                <div className="mt-0.5 text-[9px] font-medium tracking-[0.06em] text-[var(--app-muted)]">{scheduleRemaining}</div>
              ) : null}
            </div>
          ) : null}
          {!isCompleted ? (
            <div className="flex flex-col gap-1">
              {!isCountdownFinished ? (
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
                  {isRunning ? <Pause size={16} /> : <Play size={16} />}
                </button>
              ) : null}

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
            </div>
          ) : null}
        </div>
      </div>
      {showProgressBar ? (
        <div className="relative z-[1] px-3 pb-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--app-border)_70%,transparent)]">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                isRunning
                  ? 'bg-[color-mix(in_srgb,var(--app-accent)_80%,#ffffff)]'
                  : isScheduledFuture
                  ? 'bg-[color-mix(in_srgb,var(--app-accent)_70%,var(--app-text))]'
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
