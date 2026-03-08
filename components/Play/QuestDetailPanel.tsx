import React, { useEffect, useMemo, useRef } from 'react';
import { X, Zap, Layers, Calendar, Clock } from 'lucide-react';
import { useXP } from '../XP/xpStore';
import type { QuestLevel, XPSession } from '../XP/xpTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMs = (ms: number): string => {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return '<1m';
};

const formatTime = (ts: number): string =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDateShort = (ts: number): string =>
  new Date(ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

const LEVEL_LABELS: Record<QuestLevel, string> = {
  1: 'Standard',
  2: 'Focused',
  3: 'Priority',
  4: 'Critical',
};

const LEVEL_XP_TARGETS: Record<QuestLevel, number> = {
  1: 50,
  2: 100,
  3: 200,
  4: 400,
};

const IMPACT_LABEL: Record<XPSession['impactRating'], string> = {
  normal: 'Normal',
  medium: 'Medium',
  hard: 'Hard',
};

const STATUS_LABEL: Record<string, string> = {
  todo: 'To Do',
  active: 'Active',
  paused: 'Paused',
  done: 'Completed',
  dropped: 'Dropped',
};

const QUEST_TYPE_LABEL: Record<string, string> = {
  session: 'Session',
  instant: 'Instant',
  scheduled: 'Countdown',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Secondary section heading — reduced visual weight intentionally */
const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)] mb-2 opacity-70">
    {children}
  </div>
);

const StatCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col gap-1 rounded-lg bg-[color-mix(in_srgb,var(--app-panel-2)_70%,transparent)] px-3 py-3">
    <span className="text-[18px] font-bold tabular-nums leading-none text-[var(--app-text)]">{value}</span>
    <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)]">{label}</span>
  </div>
);

const XPRow: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{label}</span>
    <span className="font-mono text-[10px] text-[var(--app-text)]">+{value} XP</span>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export interface QuestDetailPanelProps {
  taskId: string | null;
  onClose: () => void;
}

const MAX_VISIBLE_SESSIONS = 10;

export const QuestDetailPanel: React.FC<QuestDetailPanelProps> = ({ taskId, onClose }) => {
  const { now, selectors, projects, milestones } = useXP();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const task = useMemo(
    () => (taskId ? selectors.getTaskById(taskId) : null),
    [selectors, taskId],
  );

  const sessions = useMemo(
    () => (taskId ? selectors.getTaskSessions(taskId) : []),
    [selectors, taskId],
  );

  const xpBreakdown = useMemo(
    () => (taskId ? selectors.getQuestCompletionXP(taskId) : null),
    [selectors, taskId],
  );

  const linkedProject = useMemo(
    () => (task?.projectId ? (projects.find((p) => p.id === task.projectId) ?? null) : null),
    [task, projects],
  );

  const projectMilestones = useMemo(
    () => (linkedProject ? milestones.filter((m) => m.projectId === linkedProject.id) : []),
    [linkedProject, milestones],
  );

  const timeSummary = useMemo(() => {
    if (!sessions.length) return null;
    let totalMs = 0;
    let longestMs = 0;
    sessions.forEach((s) => {
      const ms = selectors.getSessionDisplayMs(s, now);
      totalMs += ms;
      if (ms > longestMs) longestMs = ms;
    });
    return {
      count: sessions.length,
      totalMs,
      longestMs,
      avgMs: sessions.length > 0 ? Math.floor(totalMs / sessions.length) : 0,
    };
  }, [sessions, selectors, now]);

  const sessionXPTotal = useMemo(
    () =>
      sessions.reduce((sum, s) => {
        const minutes = Math.floor(selectors.getSessionDisplayMs(s, now) / 60_000);
        return sum + selectors.getSessionXP(minutes);
      }, 0),
    [sessions, selectors, now],
  );

  const stepsData = useMemo(() => {
    if (!task?.details) return null;
    const m = task.details.match(/\n?---\s*\n\[xstation_steps_v1\]\s*\n([\s\S]*?)\n---\s*$/);
    if (!m) return null;
    try {
      const parsed = JSON.parse(m[1]?.trim());
      const steps = Array.isArray(parsed?.steps)
        ? (parsed.steps as Array<{ text?: string; done?: boolean }>).filter((s) => s.text?.trim())
        : [];
      return steps.length > 0 ? (steps as Array<{ text: string; done: boolean }>) : null;
    } catch {
      return null;
    }
  }, [task]);

  const totalXP = xpBreakdown?.total ?? sessionXPTotal;

  if (!task || !taskId) return null;

  const isCompleted = task.status === 'done';
  const level: QuestLevel = task.level ?? 1;
  const xpTarget = LEVEL_XP_TARGETS[level];
  const progressPct = Math.min(100, Math.round((totalXP / xpTarget) * 100));
  const visibleSessions = sessions.slice(0, MAX_VISIBLE_SESSIONS);
  const hasMoreSessions = sessions.length > MAX_VISIBLE_SESSIONS;
  const descriptionText = task.details
    ? task.details.replace(/\n?---\s*\n\[xstation_steps_v1\][\s\S]*$/, '').trim()
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Quest detail: ${task.title}`}
    >
      <div className="absolute inset-0 bg-black/40" />

      <div
        ref={panelRef}
        className="relative z-10 flex h-full w-full max-w-md flex-col overflow-hidden bg-[var(--app-panel)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Identity header — title + description + all quest metadata ── */}
        <div className="shrink-0 border-b border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_50%,var(--app-panel))] px-5 pt-5 pb-4">
          {/* Close */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              {/* Title — primary visual anchor of the header */}
              <h2 className="text-[17px] font-bold leading-[1.3] tracking-[0.01em] text-[var(--app-text)]">
                {task.title}
              </h2>
              {/* Description — shown prominently right under title */}
              {descriptionText ? (
                <p className="mt-1.5 text-[12px] leading-[1.55] text-[var(--app-muted)] line-clamp-3">
                  {descriptionText}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] transition-colors"
              aria-label="Close panel"
            >
              <X size={14} />
            </button>
          </div>

          {/* Badge row — status / type / level / priority */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span
              className="rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
              style={{
                background: isCompleted
                  ? 'color-mix(in_srgb,#43d39e 18%,var(--app-panel-2))'
                  : task.status === 'active'
                  ? 'color-mix(in_srgb,#e3b34a 18%,var(--app-panel-2))'
                  : 'color-mix(in_srgb,var(--app-muted) 14%,var(--app-panel-2))',
                color: isCompleted ? '#43d39e' : task.status === 'active' ? '#e3b34a' : 'var(--app-muted)',
                border: `1px solid ${isCompleted ? '#43d39e44' : task.status === 'active' ? '#e3b34a44' : 'var(--app-border)'}`,
              }}
            >
              {STATUS_LABEL[task.status] ?? task.status}
            </span>
            <span className="rounded px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[var(--app-muted)] ring-1 ring-inset ring-[var(--app-border)]">
              {QUEST_TYPE_LABEL[task.questType ?? 'session'] ?? task.questType}
            </span>
            <span className="rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--app-accent)_40%,transparent)]">
              L{level} · {LEVEL_LABELS[level]}
            </span>
            <span className="rounded px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[var(--app-muted)] ring-1 ring-inset ring-[var(--app-border)]">
              {task.priority}
            </span>
            {task.scheduledAt ? (
              <span className="flex items-center gap-1 rounded px-2 py-0.5 text-[9px] text-[var(--app-muted)] ring-1 ring-inset ring-[var(--app-border)]">
                <Calendar size={9} />
                {formatDateShort(task.scheduledAt)} {formatTime(task.scheduledAt)}
              </span>
            ) : null}
          </div>

          {/* Compact stats strip — steps · sessions · time · last session */}
          {(timeSummary || stepsData) ? (
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] text-[var(--app-muted)]">
              {stepsData ? (
                <span className={stepsData.filter((s) => s.done).length === stepsData.length ? 'text-[#43d39e]' : ''}>
                  {stepsData.filter((s) => s.done).length}/{stepsData.length} steps
                </span>
              ) : null}
              {timeSummary ? (
                <>
                  <span>{timeSummary.count} {timeSummary.count === 1 ? 'session' : 'sessions'}</span>
                  <span>{formatMs(timeSummary.totalMs)} tracked</span>
                  {sessions[0] ? <span>Last: {formatDateShort(sessions[0].startAt)}</span> : null}
                </>
              ) : null}
            </div>
          ) : null}

          {/* Metadata pills — self tree, estimated */}
          {(task.selfTreePrimary || task.estimatedMinutes) ? (
            <div className="flex flex-wrap gap-1.5">
              {task.selfTreePrimary ? (
                <div className="flex items-center gap-1 rounded bg-[var(--app-panel-2)] px-2 py-1 text-[9px] text-[var(--app-muted)]">
                  <Layers size={10} />
                  <span>{task.selfTreePrimary}</span>
                  {task.selfTreeSecondary ? <span className="opacity-55">· {task.selfTreeSecondary}</span> : null}
                </div>
              ) : null}
              {task.estimatedMinutes ? (
                <div className="flex items-center gap-1 rounded bg-[var(--app-panel-2)] px-2 py-1 text-[9px] text-[var(--app-muted)]">
                  <Clock size={10} />
                  <span>Est. {task.estimatedMinutes}m</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Timestamps — smallest, lowest weight */}
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[8px] text-[var(--app-muted)] opacity-70">
            {task.startedAt ? (
              <span>Started {formatDateShort(task.startedAt)}</span>
            ) : (
              <span>Created {formatDateShort(task.createdAt)}</span>
            )}
            {task.completedAt ? <span>· Completed {formatDateShort(task.completedAt)}</span> : null}
          </div>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Steps checklist ───────────────────────────────────────────────── */}
          {stepsData ? (
            <div className="px-5 pt-5 pb-4 border-b border-[var(--app-border)]">
              <div className="mb-2 flex items-center justify-between">
                <SectionHeading>Steps</SectionHeading>
                <span className="text-[9px] tabular-nums text-[var(--app-muted)]">
                  {stepsData.filter((s) => s.done).length} / {stepsData.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {stepsData.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 shrink-0 h-3.5 w-3.5 rounded-full border flex items-center justify-center text-[8px] ${
                        step.done
                          ? 'border-[#43d39e] bg-[color-mix(in_srgb,#43d39e_20%,var(--app-panel-2))] text-[#43d39e]'
                          : 'border-[var(--app-border)] bg-[var(--app-panel-2)] text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                    <span
                      className={`text-[11px] leading-[1.5] ${
                        step.done ? 'line-through text-[var(--app-muted)] opacity-60' : 'text-[var(--app-text)]'
                      }`}
                    >
                      {step.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ── XP Progress — primary feedback zone, highlighted container ── */}
          <div className="px-5 pt-5 pb-6">
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_7%,var(--app-panel-2))] px-4 py-4">
              {/* Total XP — dominant number */}
              <div className="mb-0.5 flex items-baseline gap-2">
                <Zap size={15} className="shrink-0 text-[var(--app-accent)]" />
                <span className="text-[28px] font-bold tabular-nums leading-none text-[var(--app-text)]">
                  {totalXP} XP
                </span>
              </div>

              {/* Level progress label */}
              <div className="mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
                Level Progress
              </div>

              {/* Progress bar */}
              <div className="mb-1.5 h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--app-panel)_60%,transparent)]">
                <div
                  className="h-full rounded-full bg-[var(--app-accent)] transition-[width] duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* currentXP / targetXP */}
              <div className="mb-4 text-[9px] tabular-nums text-[var(--app-muted)]">
                {totalXP} / {xpTarget} XP
              </div>

              {/* Breakdown */}
              {xpBreakdown ? (
                <div className="divide-y divide-[color-mix(in_srgb,var(--app-border)_60%,transparent)]">
                  {xpBreakdown.sessionXP > 0 && <XPRow label="Session XP" value={xpBreakdown.sessionXP} />}
                  {xpBreakdown.deepBonus > 0 && <XPRow label="Deep focus bonus" value={xpBreakdown.deepBonus} />}
                  {xpBreakdown.instantBaseXP > 0 && <XPRow label="Instant base" value={xpBreakdown.instantBaseXP} />}
                  {xpBreakdown.stepXP > 0 && <XPRow label="Step XP" value={xpBreakdown.stepXP} />}
                  {xpBreakdown.completionBonus > 0 && <XPRow label="Completion bonus" value={xpBreakdown.completionBonus} />}
                  {xpBreakdown.scheduleBonus > 0 && <XPRow label="Schedule bonus" value={xpBreakdown.scheduleBonus} />}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)]">Total</span>
                    <span className="font-mono text-[12px] font-bold text-[var(--app-accent)]">+{xpBreakdown.total} XP</span>
                  </div>
                </div>
              ) : sessions.length > 0 ? (
                <XPRow label="Session XP so far" value={sessionXPTotal} />
              ) : null}
            </div>
          </div>

          {/* ── Secondary sections — visually separated from XP zone ───────── */}
          <div className="border-t border-[var(--app-border)] px-5 pt-5 pb-6 space-y-6">

            {/* 3. Time Summary */}
            {timeSummary ? (
              <section>
                <SectionHeading>Time Summary</SectionHeading>
                <div className="grid grid-cols-2 gap-2">
                  <StatCell label="Total sessions" value={String(timeSummary.count)} />
                  <StatCell label="Total time" value={formatMs(timeSummary.totalMs)} />
                  <StatCell label="Avg session" value={formatMs(timeSummary.avgMs)} />
                  <StatCell label="Longest session" value={formatMs(timeSummary.longestMs)} />
                </div>
              </section>
            ) : null}

            {/* 4. Session History */}
            {sessions.length > 0 ? (
              <section>
                <SectionHeading>Session History</SectionHeading>
                <div className="space-y-1.5">
                  {visibleSessions.map((session) => {
                    const displayMs = selectors.getSessionDisplayMs(session, now);
                    const isRunning = session.status === 'running';
                    const sessionMinutes = Math.floor(displayMs / 60_000);
                    const xp = selectors.getSessionXP(sessionMinutes);
                    return (
                      <div
                        key={session.id}
                        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                          isRunning
                            ? 'bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel-2))] border border-[color-mix(in_srgb,var(--app-accent)_28%,transparent)]'
                            : 'bg-[color-mix(in_srgb,var(--app-panel-2)_70%,transparent)]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--app-muted)]">
                            <span>{formatDateShort(session.startAt)}</span>
                            <span>·</span>
                            <span>{formatTime(session.startAt)}</span>
                            {isRunning ? (
                              <span className="font-semibold text-[var(--app-accent)]">· Live</span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[9px] text-[var(--app-muted)] opacity-75">
                            <span>{formatMs(displayMs)}</span>
                            <span>·</span>
                            <span>{IMPACT_LABEL[session.impactRating]}</span>
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-[var(--app-accent)]">
                          +{xp} XP
                        </span>
                      </div>
                    );
                  })}
                  {hasMoreSessions ? (
                    <div className="px-1 pt-0.5 text-[9px] uppercase tracking-[0.12em] text-[var(--app-muted)] opacity-60">
                      +{sessions.length - MAX_VISIBLE_SESSIONS} more sessions
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {/* 5. Notes & Tags */}
            {(task.notes || task.tags?.length) ? (
              <section>
                <SectionHeading>Notes & Tags</SectionHeading>
                <div className="space-y-2">
                  {task.notes ? (
                    <p className="text-[11px] leading-relaxed text-[var(--app-muted)]">{task.notes}</p>
                  ) : null}
                  {task.tags?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[var(--app-muted)] ring-1 ring-inset ring-[var(--app-border)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {/* 6. Linked Project */}
            {linkedProject ? (
              <section>
                <SectionHeading>Linked Project</SectionHeading>
                <div className="rounded-lg border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_70%,transparent)] px-3 py-3">
                  <div className="truncate text-[12px] font-semibold text-[var(--app-text)] mb-1.5">
                    {linkedProject.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded px-1.5 py-0.5 text-[8px] uppercase tracking-[0.14em] text-[var(--app-muted)] ring-1 ring-inset ring-[var(--app-border)]">
                      {linkedProject.type}
                    </span>
                    <span className="rounded px-1.5 py-0.5 text-[8px] uppercase tracking-[0.14em] text-[var(--app-accent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--app-accent)_40%,transparent)]">
                      L{linkedProject.level}
                    </span>
                    <span className="rounded px-1.5 py-0.5 text-[8px] uppercase tracking-[0.14em] text-[var(--app-muted)] ring-1 ring-inset ring-[var(--app-border)]">
                      {linkedProject.status}
                    </span>
                  </div>
                  {projectMilestones.length > 0 ? (
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[9px] text-[var(--app-muted)]">
                        <span>Milestones</span>
                        <span>
                          {projectMilestones.filter((m) => m.isCompleted).length} / {projectMilestones.length}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--app-panel)]">
                        <div
                          className="h-full rounded-full bg-[var(--app-accent)] transition-[width] duration-500"
                          style={{
                            width: `${Math.round(
                              (projectMilestones.filter((m) => m.isCompleted).length / projectMilestones.length) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

          </div>
        </div>
      </div>
    </div>
  );
};
