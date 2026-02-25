import React, { useEffect, useMemo, useState } from 'react';
import { useXP } from './xpStore';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const fromDateKey = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
};

const formatMonthTitle = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const formatTime = (value: number) =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const monthGridStart = (monthDate: Date) => {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0);
  const mondayOffset = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - mondayOffset);
  return first;
};

export const LogCalendar: React.FC = () => {
  const {
    tasks,
    deleteTaskCompletely,
    deleteDayActivity,
    selectors,
    activeLogDateKey,
    setActiveLogDateKey,
  } = useXP();
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => activeLogDateKey || toDateKey(new Date()));
  const [now, setNow] = useState(() => Date.now());
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const todayKey = toDateKey(new Date(now));

  const hasRunning = useMemo(() => !!selectors.getActiveSession(), [selectors]);

  useEffect(() => {
    if (activeLogDateKey && activeLogDateKey !== selectedKey) {
      setSelectedKey(activeLogDateKey);
    }
  }, [activeLogDateKey, selectedKey]);

  useEffect(() => {
    if (!hasRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasRunning]);

  const gridDays = useMemo(() => {
    const start = monthGridStart(viewMonth);
    return Array.from({ length: 42 }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      return {
        date,
        key: toDateKey(date),
        inMonth: date.getMonth() === viewMonth.getMonth(),
      };
    });
  }, [viewMonth]);

  const gridKeys = useMemo(() => gridDays.map((day) => day.key), [gridDays]);
  const summaryByDay = useMemo(() => {
    // Selectors are the single source of truth; do not recompute XP totals in UI.
    const base = new Map<string, { activityCount: number; loggedMinutes: number; running: boolean }>();
    gridKeys.forEach((key) => base.set(key, { activityCount: 0, loggedMinutes: 0, running: false }));

    gridKeys.forEach((key) => {
      const slot = base.get(key);
      if (!slot) return;
      const daySummary = selectors.getDaySummary(key, now);
      slot.loggedMinutes = daySummary.minutesTracked;
      slot.activityCount = daySummary.activityCount;
      slot.running = daySummary.runningCount > 0;
    });

    return base;
  }, [gridKeys, selectors, now]);

  const selectedBounds = useMemo(() => {
    const start = fromDateKey(selectedKey).getTime();
    return { start, end: start + 86400000 };
  }, [selectedKey]);

  const selectedTasks = useMemo(() => {
    const { start, end } = selectedBounds;
    return tasks
      .filter((task) => !!task.scheduledAt && task.scheduledAt >= start && task.scheduledAt < end)
      .sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0));
  }, [tasks, selectedBounds]);

  const selectedActivityGroups = useMemo(
    () => selectors.getDayActivityGrouped(selectedKey, now),
    [selectors, selectedKey, now]
  );

  const selectedDaySummary = selectors.getDaySummary(selectedKey, now);

  const selectedMinutes = Math.max(0, selectedDaySummary.minutesTracked);

  const selectedDateLabel = fromDateKey(selectedKey).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-4 text-[var(--app-text)]">
      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-gradient-to-b from-[color-mix(in_srgb,var(--app-panel-2)_90%,var(--app-panel))] to-[var(--app-panel)] shadow-[0_12px_28px_rgba(0,0,0,0.45)] p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-[10px] text-[var(--app-muted)] tracking-[0.3em] uppercase">Log Calendar</div>
            <div className="text-xl font-medium tracking-[0.08em] uppercase text-[var(--app-text)]">{formatMonthTitle(viewMonth)}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="px-3 py-2 rounded-md border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[10px] tracking-[0.2em] uppercase text-[var(--app-text)] bg-[var(--app-panel-2)] hover:border-[color-mix(in_srgb,var(--app-text)_30%,transparent)] transition-colors"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                const nextKey = toDateKey(today);
                setViewMonth(today);
                setSelectedKey(nextKey);
                setActiveLogDateKey(nextKey);
              }}
              className="px-3 py-2 rounded-md border border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)] text-[10px] tracking-[0.2em] uppercase text-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] hover:border-[var(--app-accent)] transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="px-3 py-2 rounded-md border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[10px] tracking-[0.2em] uppercase text-[var(--app-text)] bg-[var(--app-panel-2)] hover:border-[color-mix(in_srgb,var(--app-text)_30%,transparent)] transition-colors"
            >
              Next
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {DAY_NAMES.map((name) => (
            <div key={name} className="text-[10px] text-[var(--app-muted)] text-center py-1 font-normal uppercase tracking-[0.2em]">
              {name}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {gridDays.map((day) => {
            const isSelected = selectedKey === day.key;
            const info = summaryByDay.get(day.key) || { activityCount: 0, loggedMinutes: 0, running: false };
            const loggedMin = info.loggedMinutes;
            const isToday = day.key === todayKey;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => {
                  setSelectedKey(day.key);
                  setActiveLogDateKey(day.key);
                  if (!day.inMonth) {
                    setViewMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
                  }
                }}
                className={`min-h-[108px] rounded-lg border p-2 text-left transition-colors ${
                  isSelected
                    ? 'border-[color-mix(in_srgb,var(--app-accent)_70%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))]'
                    : day.inMonth
                      ? 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] hover:bg-[var(--app-panel-2)]'
                      : 'border-[color-mix(in_srgb,var(--app-text)_5%,transparent)] bg-[var(--app-bg)] text-[var(--app-muted)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${isToday ? 'text-[var(--app-accent)]' : 'text-[var(--app-text)]'}`}>{day.date.getDate()}</span>
                  {loggedMin > 0 ? (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-[var(--app-panel-2)] text-[var(--app-text)]">
                      {loggedMin}m
                    </span>
                  ) : null}
                </div>
                <div className="space-y-1">
                  {isToday && (
                    <div className="text-[10px] rounded px-2 py-0.5 bg-[color-mix(in_srgb,var(--app-accent)_28%,var(--app-panel))] text-[var(--app-accent)]">
                      Today
                    </div>
                  )}
                  {info.running && (
                    <div className="text-[10px] rounded px-2 py-0.5 bg-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-panel))] text-[var(--app-accent)]">
                      Running
                    </div>
                  )}
                  {info.activityCount > 0 && (
                    <div className="text-[10px] rounded px-2 py-0.5 bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))] text-[var(--app-accent)]">
                      {info.activityCount} activity
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr] gap-4">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] shadow-[0_10px_24px_rgba(0,0,0,0.35)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-[var(--app-text)] uppercase tracking-[0.16em]">Day History</div>
                <div className="text-xs text-[var(--app-muted)]">{selectedDateLabel}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const ok = window.confirm(
                      `This will remove all tracked sessions and log events for ${selectedDateLabel}. Tasks will remain.`
                    );
                    if (!ok) return;
                    deleteDayActivity(selectedKey);
                    setExpandedGroupKey(null);
                  }}
                  className="text-xs rounded-full px-2 py-1 bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] border border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
                >
                  DELETE DAY ACTIVITY
                </button>
                <div className="text-xs rounded-full px-2 py-1 bg-[var(--app-panel)] text-[var(--app-text)]">
                  {selectedMinutes} min tracked
                </div>
                <div className="text-xs rounded-full px-2 py-1 bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))] text-[var(--app-accent)]">
                  {selectedDaySummary.activityCount} activity
                </div>
                <div className="text-xs rounded-full px-2 py-1 bg-[var(--app-panel)] text-[var(--app-muted)]">
                  {selectedDaySummary.completedCount} completed
                </div>
                <div className="text-xs rounded-full px-2 py-1 bg-[var(--app-panel)] text-[var(--app-muted)]">
                  {selectedDaySummary.scheduledCount} scheduled
                </div>
              </div>
            </div>

            {selectedActivityGroups.length === 0 ? (
              <div className="text-sm text-[var(--app-muted)]">No activity found on this date.</div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {selectedActivityGroups.map((group) => {
                  const statusText = group.hasCompletion
                    ? group.totalMinutes > 0
                      ? 'COMPLETED'
                      : 'COMPLETED (NO TIME)'
                    : group.hasRunning
                      ? 'RUNNING'
                      : group.hasRetro && !group.hasSession
                        ? 'RETRO'
                        : group.hasCreated
                          ? group.latestStatusLabel
                          : 'TRACKED';
                  const detailText = `${group.totalMinutes}m · ${group.entries.length} entries`;
                  const isExpanded = expandedGroupKey === group.key;
                  const hasCreated = group.entries.some((entry) => entry.kind === 'created' && entry.statusLabel === 'CREATED');
                  const hasScheduled = group.entries.some((entry) => entry.kind === 'created' && entry.statusLabel === 'SCHEDULED');
                  const hasHidden = group.entries.some((entry) => entry.kind === 'created' && entry.statusLabel === 'HIDDEN');
                  const retroMinutes = group.entries
                    .filter((entry) => entry.kind === 'manual')
                    .reduce((sum, entry) => sum + Math.max(0, entry.minutes), 0);
                  const trackedMinutes = group.entries
                    .filter((entry) => entry.kind === 'session')
                    .reduce((sum, entry) => sum + Math.max(0, entry.minutes), 0);
                  return (
                    <div key={group.key} className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-normal text-[var(--app-text)] truncate">{group.title}</div>
                          <div className="text-xs text-[var(--app-muted)] mt-1 flex items-center gap-2">
                            <span className="uppercase tracking-[0.18em]">{statusText}</span>
                            <span>·</span>
                            <span>{detailText}</span>
                            <span>·</span>
                            <span>{formatTime(group.latestAt)}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {hasCreated ? (
                              <span className="text-[10px] rounded px-2 py-0.5 bg-[var(--app-panel-2)] text-[var(--app-text)]">CREATED</span>
                            ) : null}
                            {hasScheduled ? (
                              <span className="text-[10px] rounded px-2 py-0.5 bg-[var(--app-panel-2)] text-[var(--app-text)]">SCHEDULED</span>
                            ) : null}
                            {group.hasCompletion ? (
                              <span className="text-[10px] rounded px-2 py-0.5 bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))] text-[var(--app-accent)]">DONE</span>
                            ) : null}
                            {retroMinutes > 0 ? (
                              <span className="text-[10px] rounded px-2 py-0.5 bg-[var(--app-panel-2)] text-[var(--app-text)]">RETRO +{retroMinutes}m</span>
                            ) : null}
                            {trackedMinutes > 0 ? (
                              <span className="text-[10px] rounded px-2 py-0.5 bg-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-panel))] text-[var(--app-accent)]">TRACKED {trackedMinutes}m</span>
                            ) : null}
                            {hasHidden ? (
                              <span className="text-[10px] rounded px-2 py-0.5 bg-[var(--app-panel-2)] text-[var(--app-text)]">HIDDEN</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setExpandedGroupKey((prev) => (prev === group.key ? null : group.key))}
                            className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[11px] text-[var(--app-muted)] hover:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)]"
                          >
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                          {group.taskId ? (
                            <button
                              type="button"
                              onClick={() => {
                                const ok = window.confirm('Delete this quest and all linked activity?');
                                if (!ok) return;
                                deleteTaskCompletely(group.taskId);
                                setExpandedGroupKey((prev) => (prev === group.key ? null : prev));
                              }}
                              className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] text-[11px] uppercase tracking-[0.12em] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
                              title="Delete quest and all linked activity"
                            >
                              Delete Quest
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {isExpanded ? (
                        <div className="mt-2 pt-2 border-t border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] space-y-2">
                          {group.entries.map((entry) => {
                            const entryLabel =
                              entry.kind === 'completion'
                                ? entry.minutes > 0
                                  ? `COMPLETED ${entry.minutes}m`
                                  : 'COMPLETED NO TIME'
                                : entry.kind === 'manual'
                                  ? `RETRO +${entry.minutes}m`
                                  : entry.kind === 'created'
                                    ? entry.statusLabel
                                    : `${entry.minutes}m TRACKED`;
                            return (
                              <div
                                key={`${group.key}-${entry.kind}-${entry.id}`}
                                className="rounded border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] px-2 py-1.5"
                              >
                                <div className="text-[11px] text-[var(--app-muted)] uppercase tracking-[0.14em] truncate">
                                  {entryLabel} · {formatTime(entry.createdAt)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] shadow-[0_10px_24px_rgba(0,0,0,0.35)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-[var(--app-text)] uppercase tracking-[0.16em]">Scheduled Tasks ({selectedTasks.length})</div>
            </div>

            {selectedTasks.length === 0 ? (
              <div className="text-sm text-[var(--app-muted)]">No scheduled tasks for this date.</div>
            ) : (
              <div className="space-y-2">
                {selectedTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-normal text-[var(--app-text)]">{task.title}</div>
                        <div className="text-xs text-[var(--app-muted)] mt-1">
                          {task.scheduledAt ? formatTime(task.scheduledAt) : 'No time'} • {task.priority}
                        </div>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        {task.status.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
