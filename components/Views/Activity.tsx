import React, { useEffect, useMemo, useState } from 'react';
import { useXP } from '../XP/xpStore';

type ActivityMode = 'TODAY' | 'WEEK';

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  return new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
};

const formatDayLabel = (dateKey: string) =>
  parseDateKey(dateKey).toLocaleDateString(undefined, { weekday: 'short' });

const formatTodayLabel = (dateKey: string) =>
  parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const Activity: React.FC = () => {
  const { selectors } = useXP();
  const [mode, setMode] = useState<ActivityMode>('TODAY');
  const [now, setNow] = useState(() => Date.now());
  const todayKey = selectors.getDateKey(new Date(now));
  const runningSession = selectors.getActiveSession();

  useEffect(() => {
    if (!runningSession) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [runningSession]);

  const todayOverview = useMemo(
    () => ({
      trackedMinutes: selectors.getTrackedMinutesForDay(todayKey, now),
      activityCount: selectors.getDayActivityCount(todayKey, now),
      completedCount: selectors.getCompletedCountForDay(todayKey),
    }),
    [selectors, todayKey, now]
  );

  const todayCategories = useMemo(
    () => selectors.getCategoryBreakdownForRange(todayKey, todayKey, now),
    [selectors, todayKey, now]
  );

  const topTasksToday = useMemo(
    () => selectors.getTopTasksForDay(todayKey, 5, now),
    [selectors, todayKey, now]
  );

  const weekKeys = useMemo(() => selectors.getLastNDays(7), [selectors]);
  const weekRangeLabel = useMemo(() => selectors.getWeekRangeLabel(weekKeys), [selectors, weekKeys]);

  const weekDaily = useMemo(
    () =>
      weekKeys.map((key) => ({
        dateKey: key,
        minutes: selectors.getTrackedMinutesForDay(key, now),
      })),
    [weekKeys, selectors, now]
  );

  const weekSummary = useMemo(() => {
    const total = weekDaily.reduce((sum, day) => sum + day.minutes, 0);
    const best = weekDaily.reduce(
      (max, day) => (day.minutes > max.minutes ? day : max),
      { dateKey: weekDaily[0]?.dateKey || todayKey, minutes: 0 }
    );
    return {
      totalMinutes: total,
      avgMinutes: Math.round(total / Math.max(weekDaily.length, 1)),
      bestDay: best,
      bestMinutes: Math.max(1, best.minutes),
    };
  }, [weekDaily, todayKey]);

  const weekCategories = useMemo(() => {
    const start = weekKeys[0] || todayKey;
    const end = weekKeys[weekKeys.length - 1] || todayKey;
    return selectors.getCategoryBreakdownForRange(start, end, now);
  }, [selectors, weekKeys, todayKey, now]);

  return (
    <div className="space-y-4 text-[#f3f0e8]">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#242427] to-[#1a1a1c] shadow-[0_12px_28px_rgba(0,0,0,0.45)] p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] text-[#8b847a] tracking-[0.3em] uppercase">Profile</div>
            <div className="text-xl font-medium tracking-[0.08em] uppercase text-[#f3f0e8]">Activity</div>
            <div className="text-xs text-[#8b847a] mt-1">
              {mode === 'TODAY' ? formatTodayLabel(todayKey) : weekRangeLabel}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('TODAY')}
              className={`px-3 py-2 rounded-md border text-[10px] tracking-[0.2em] uppercase transition-colors ${
                mode === 'TODAY'
                  ? 'border-[#f46a2e]/70 bg-[#2a1a12] text-[#f46a2e]'
                  : 'border-white/10 bg-[#141418] text-[#f3f0e8] hover:border-white/30'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setMode('WEEK')}
              className={`px-3 py-2 rounded-md border text-[10px] tracking-[0.2em] uppercase transition-colors ${
                mode === 'WEEK'
                  ? 'border-[#f46a2e]/70 bg-[#2a1a12] text-[#f46a2e]'
                  : 'border-white/10 bg-[#141418] text-[#f3f0e8] hover:border-white/30'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {mode === 'TODAY' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#111114] shadow-[0_10px_24px_rgba(0,0,0,0.35)] p-4">
            <div className="text-sm font-medium text-[#f3f0e8] uppercase tracking-[0.16em] mb-3">Overview</div>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-white/10 bg-[#141418] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b847a]">Tracked Minutes</div>
                <div className="text-2xl font-semibold text-[#f3f0e8] mt-1">{todayOverview.trackedMinutes}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#141418] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b847a]">Events Logged</div>
                <div className="text-2xl font-semibold text-[#f3f0e8] mt-1">{todayOverview.activityCount}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#141418] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b847a]">Completed</div>
                <div className="text-2xl font-semibold text-[#f3f0e8] mt-1">{todayOverview.completedCount}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#111114] shadow-[0_10px_24px_rgba(0,0,0,0.35)] p-4">
            <div className="text-sm font-medium text-[#f3f0e8] uppercase tracking-[0.16em] mb-3">Category Breakdown</div>
            {todayCategories.length === 0 ? (
              <div className="text-sm text-[#8b847a]">No tracked minutes for today.</div>
            ) : (
              <div className="space-y-2">
                {todayCategories.map((row) => (
                  <div key={row.category} className="flex items-center justify-between rounded border border-white/10 bg-[#141418] px-3 py-2">
                    <div className="text-sm text-[#f3f0e8]">{row.category}</div>
                    <div className="text-xs uppercase tracking-[0.16em] text-[#8b847a]">{row.minutes}m</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#111114] shadow-[0_10px_24px_rgba(0,0,0,0.35)] p-4">
            <div className="text-sm font-medium text-[#f3f0e8] uppercase tracking-[0.16em] mb-3">Top Quests Today</div>
            {topTasksToday.length === 0 ? (
              <div className="text-sm text-[#8b847a]">No quest activity yet.</div>
            ) : (
              <div className="space-y-2">
                {topTasksToday.map((task) => (
                  <div key={task.taskId} className="rounded border border-white/10 bg-[#141418] px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-[#f3f0e8] truncate">{task.title}</div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[#8b847a] mt-1">{task.category}</div>
                      </div>
                      <div className="text-xs uppercase tracking-[0.16em] text-[#8b847a] shrink-0">{task.minutes}m</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {task.running ? (
                        <span className="text-[10px] rounded px-2 py-0.5 bg-[#2b1d13] text-[#f46a2e]">RUNNING</span>
                      ) : null}
                      {task.doneToday ? (
                        <span className="text-[10px] rounded px-2 py-0.5 bg-[#17231f] text-[#8bd5a5]">DONE</span>
                      ) : null}
                      {task.scheduledToday ? (
                        <span className="text-[10px] rounded px-2 py-0.5 bg-[#1f232c] text-[#f3f0e8]">SCHEDULED</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#111114] shadow-[0_10px_24px_rgba(0,0,0,0.35)] p-4">
            <div className="text-sm font-medium text-[#f3f0e8] uppercase tracking-[0.16em] mb-3">Week Overview</div>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-white/10 bg-[#141418] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b847a]">Total Tracked</div>
                <div className="text-2xl font-semibold text-[#f3f0e8] mt-1">{weekSummary.totalMinutes}m</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#141418] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b847a]">Avg / Day</div>
                <div className="text-2xl font-semibold text-[#f3f0e8] mt-1">{weekSummary.avgMinutes}m</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#141418] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#8b847a]">Best Day</div>
                <div className="text-sm font-semibold text-[#f3f0e8] mt-1">
                  {weekSummary.bestDay.dateKey} · {weekSummary.bestDay.minutes}m
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#111114] shadow-[0_10px_24px_rgba(0,0,0,0.35)] p-4">
            <div className="text-sm font-medium text-[#f3f0e8] uppercase tracking-[0.16em] mb-3">Daily Bars</div>
            <div className="space-y-2">
              {weekDaily.map((day) => {
                const widthPct = Math.round((day.minutes / weekSummary.bestMinutes) * 100);
                return (
                  <div key={day.dateKey} className="grid grid-cols-[48px,1fr,64px] items-center gap-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-[#8b847a]">{formatDayLabel(day.dateKey)}</div>
                    <div className="h-2 rounded bg-[#1a1a1f] border border-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#f46a2e] to-[#f79b45]"
                        style={{ width: `${Math.max(3, widthPct)}%` }}
                      />
                    </div>
                    <div className="text-xs uppercase tracking-[0.16em] text-[#8b847a] text-right">{day.minutes}m</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#111114] shadow-[0_10px_24px_rgba(0,0,0,0.35)] p-4">
            <div className="text-sm font-medium text-[#f3f0e8] uppercase tracking-[0.16em] mb-3">Week Category Breakdown</div>
            {weekCategories.length === 0 ? (
              <div className="text-sm text-[#8b847a]">No tracked minutes this week.</div>
            ) : (
              <div className="space-y-2">
                {weekCategories.map((row) => (
                  <div key={row.category} className="flex items-center justify-between rounded border border-white/10 bg-[#141418] px-3 py-2">
                    <div className="text-sm text-[#f3f0e8]">{row.category}</div>
                    <div className="text-xs uppercase tracking-[0.16em] text-[#8b847a]">{row.minutes}m</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
