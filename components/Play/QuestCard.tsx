import React, { useEffect, useMemo, useState } from 'react';
import { Check, Pause, Play } from 'lucide-react';
import { Task, XPSession } from '../XP/xpTypes';

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

const getStatus = (task: Task, isRunning: boolean) => {
  if (isRunning) return 'Running';
  if (task.completedAt || task.status === 'done') return 'Done';
  if (task.scheduledAt && task.scheduledAt > Date.now()) return 'Scheduled';
  return 'Active';
};

export interface QuestCardProps {
  task: Task;
  isRunning: boolean;
  runningSession: XPSession | null;
  getSessionDisplayMs: (session: XPSession, now?: number) => number;
  onOpen: () => void;
  onToggleRun: () => void;
  onComplete: () => void;
  disabled?: boolean;
}

export const QuestCard: React.FC<QuestCardProps> = ({
  task,
  isRunning,
  runningSession,
  getSessionDisplayMs,
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

  const elapsedMs = useMemo(() => {
    if (!isRunning || !runningSession) return 0;
    return getSessionDisplayMs(runningSession, tickNow);
  }, [isRunning, runningSession, getSessionDisplayMs, tickNow]);

  const status = getStatus(task, isRunning);
  const isCompleted = task.completedAt || task.status === 'done';

  return (
    <article
      className={`group w-full rounded-[12px] border text-left transition-colors ${
        isRunning
          ? 'border-[color-mix(in_srgb,var(--app-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel))]'
          : 'border-[var(--app-border)] bg-[var(--app-panel)] hover:bg-[color-mix(in_srgb,var(--app-accent)_7%,var(--app-panel))]'
      } ${isCompleted ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-2 p-3">
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
                  <span className="font-medium text-[var(--app-accent)]">{formatDuration(elapsedMs)}</span>
                </>
              ) : null}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1.5 pr-0.5">
          {!isCompleted ? (
            <button
              type="button"
              aria-label={isRunning ? 'Pause quest' : 'Start quest'}
              disabled={disabled}
              onClick={onToggleRun}
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
              onClick={onComplete}
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
