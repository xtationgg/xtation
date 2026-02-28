import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useXP } from './xpStore';
import type { XPDayActivityItem, XPDayActivityGroup, Task } from './xpTypes';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
] as const;
const SIDE_PANEL_TABS = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'unfinished', label: 'Unfinished' },
  { value: 'completed', label: 'Completed' },
  { value: 'scheduled', label: 'Scheduled' },
] as const;

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const fromDateKey = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d) || y <= 0 || m <= 0 || d <= 0) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
};

const formatMonthTitle = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const formatWeekdayLabel = (dateKey: string) =>
  fromDateKey(dateKey).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });

const toSafeTimestamp = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return Math.floor(numeric);
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const formatTime = (value: number | undefined) => {
  const safeValue = toSafeTimestamp(value);
  if (!Number.isFinite(safeValue)) return '--:--';
  const date = new Date(safeValue as number);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const monthGridStart = (monthDate: Date) => {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0);
  const mondayOffset = (first.getDay() + 6) % 7;
  first.setDate(first.getDate() - mondayOffset);
  return first;
};

const getWeekStart = (dateKey: string) => {
  const date = fromDateKey(dateKey);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date;
};

const getDateBounds = (dateKey: string) => {
  const start = fromDateKey(dateKey).getTime();
  return { start, end: start + 86400000 };
};

const ensureArray = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const EMPTY_DAY_SUMMARY = {
  minutesTracked: 0,
  activityCount: 0,
  completedCount: 0,
  scheduledCount: 0,
  runningCount: 0,
} as const;

type RangeMode = (typeof RANGE_OPTIONS)[number]['value'];
type SidePanelTab = (typeof SIDE_PANEL_TABS)[number]['value'];

type NormalizedLogItemStatus =
  | 'created'
  | 'scheduled'
  | 'running'
  | 'tracked'
  | 'completed'
  | 'retro'
  | 'unfinished'
  | 'failed';

type NormalizedLogItemType = 'timeline' | 'unfinished' | 'completed' | 'scheduled';

type NormalizedLogItem = {
  id: string;
  type: NormalizedLogItemType;
  title: string;
  status: NormalizedLogItemStatus;
  startAt?: number;
  endAt?: number;
  scheduledAt?: number;
  durationMin?: number;
  sourceKey?: string;
  taskId?: string;
  groupKey?: string;
  subtitle?: string;
};

type NormalizedBuckets = {
  timeline: NormalizedLogItem[];
  unfinished: NormalizedLogItem[];
  completed: NormalizedLogItem[];
  scheduled: NormalizedLogItem[];
};

const mapActivityStatus = (entry: XPDayActivityItem): NormalizedLogItemStatus => {
  if (entry.kind === 'completion') return 'completed';
  if (entry.kind === 'manual') return 'retro';
  if (entry.kind === 'created') {
    const normalized = entry.statusLabel.toLowerCase();
    if (normalized.includes('scheduled')) return 'scheduled';
    return 'created';
  }
  if (entry.statusLabel === 'RUNNING') return 'running';
  return 'tracked';
};

const normalizeDayItems = (params: {
  dateKey: string;
  now: number;
  todayKey: string;
  tasks: Task[];
  selectedActivity: XPDayActivityItem[];
  selectedActivityGroups: XPDayActivityGroup[];
  selectedScheduledTasks: Task[];
}): NormalizedBuckets => {
  const {
    dateKey,
    now,
    todayKey,
    tasks,
    selectedActivity,
    selectedActivityGroups,
    selectedScheduledTasks,
  } = params;

  const timeline = selectedActivity
    .map<NormalizedLogItem>((entry) => {
      const safeCreatedAt = toSafeTimestamp(entry.createdAt) ?? now;
      const status = mapActivityStatus(entry);
      return {
        id: `${entry.kind}:${entry.id}`,
        type: 'timeline',
        title: entry.title,
        status,
        startAt: safeCreatedAt,
        durationMin: Math.max(0, entry.minutes),
        sourceKey: `${entry.kind}:${entry.id}`,
        taskId: entry.taskId,
        groupKey: entry.taskId ? `task:${entry.taskId}` : undefined,
      };
    })
    .sort((a, b) => (b.startAt || 0) - (a.startAt || 0));

  const completed = selectedActivityGroups
    .filter((group) => group.hasCompletion)
    .map<NormalizedLogItem>((group) => ({
      id: `completed:${group.key}`,
      type: 'completed',
      title: group.title,
      status: 'completed',
      startAt: group.latestAt,
      durationMin: Math.max(0, group.totalMinutes),
      sourceKey: group.key,
      taskId: group.taskId,
      groupKey: group.key,
      subtitle: group.totalMinutes > 0 ? `${group.totalMinutes}m tracked` : 'No time logged',
    }))
    .sort((a, b) => (b.startAt || 0) - (a.startAt || 0));

  const selectedDayIsToday = dateKey === todayKey;
  const scheduled = selectedScheduledTasks
    .filter((task) => !selectedDayIsToday || (task.scheduledAt || 0) >= now)
    .map<NormalizedLogItem>((task) => ({
      id: `scheduled:${task.id}`,
      type: 'scheduled',
      title: task.title,
      status: 'scheduled',
      scheduledAt: toSafeTimestamp(task.scheduledAt),
      startAt: toSafeTimestamp(task.scheduledAt) || toSafeTimestamp(task.updatedAt) || toSafeTimestamp(task.createdAt),
      sourceKey: `task:${task.id}`,
      taskId: task.id,
      groupKey: `task:${task.id}`,
      subtitle: `Prio: ${task.priority.toUpperCase()}`,
    }))
    .sort((a, b) => (a.scheduledAt || a.startAt || 0) - (b.scheduledAt || b.startAt || 0));

  const scheduledIds = new Set(selectedScheduledTasks.map((task) => task.id));
  const activeGroupIds = new Set(
    selectedActivityGroups.map((group) => group.taskId).filter((taskId): taskId is string => !!taskId)
  );

  const unfinished = tasks
    .filter((task) => {
      if (task.archivedAt) return false;
      if (task.status === 'done') return false;
      if (!(task.status === 'todo' || task.status === 'active' || task.status === 'dropped')) return false;
      return scheduledIds.has(task.id) || activeGroupIds.has(task.id);
    })
    .map<NormalizedLogItem>((task) => ({
      id: `unfinished:${task.id}`,
      type: 'unfinished',
      title: task.title,
      status: task.status === 'dropped' ? 'failed' : 'unfinished',
      startAt: toSafeTimestamp(task.scheduledAt) || toSafeTimestamp(task.updatedAt) || toSafeTimestamp(task.createdAt),
      scheduledAt: toSafeTimestamp(task.scheduledAt),
      sourceKey: `task:${task.id}`,
      taskId: task.id,
      groupKey: `task:${task.id}`,
      subtitle:
        task.status === 'dropped'
          ? 'Failed / dropped'
          : task.status === 'active'
            ? 'In progress'
            : 'Todo',
    }))
    .sort((a, b) => (b.startAt || 0) - (a.startAt || 0));

  return { timeline, unfinished, completed, scheduled };
};

const toPanelBadge = (status: NormalizedLogItemStatus) => {
  switch (status) {
    case 'completed':
      return 'DONE';
    case 'retro':
      return 'RETRO';
    case 'scheduled':
      return 'SCHEDULED';
    case 'running':
      return 'RUNNING';
    case 'failed':
      return 'FAILED';
    case 'created':
      return 'CREATED';
    case 'unfinished':
      return 'UNFINISHED';
    case 'tracked':
    default:
      return 'TRACKED';
  }
};

const toPanelSubtitle = (item: NormalizedLogItem) => {
  if (item.subtitle) return item.subtitle;
  if (item.status === 'completed') {
    return item.durationMin && item.durationMin > 0 ? `${item.durationMin}m tracked` : 'No time logged';
  }
  if (item.status === 'scheduled') {
    return item.scheduledAt ? `Starts ${formatTime(item.scheduledAt)}` : 'Scheduled';
  }
  if (item.status === 'retro') {
    return `Retro +${Math.max(0, item.durationMin || 0)}m`;
  }
  if (item.status === 'running') {
    return `${Math.max(0, item.durationMin || 0)}m live`;
  }
  if (item.status === 'tracked') {
    return `${Math.max(0, item.durationMin || 0)}m tracked`;
  }
  return toPanelBadge(item.status);
};

export const LogCalendar: React.FC = () => {
  const {
    tasks,
    deleteTaskCompletely,
    selectors,
    activeLogDateKey,
    setActiveLogDateKey,
  } = useXP();

  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => activeLogDateKey || toDateKey(new Date()));
  const [rangeMode, setRangeMode] = useState<RangeMode>('month');
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('timeline');
  const [now, setNow] = useState(() => Date.now());
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [highlightedGroupKey, setHighlightedGroupKey] = useState<string | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<NormalizedLogItem | null>(null);

  const todayKey = toDateKey(new Date(now));
  const selectedDate = fromDateKey(selectedKey);
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

  useEffect(() => {
    if (rangeMode !== 'today') return;
    const key = toDateKey(new Date());
    if (key !== selectedKey) {
      setSelectedKey(key);
      setActiveLogDateKey(key);
    }
  }, [rangeMode, selectedKey, setActiveLogDateKey]);

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

  const weekDays = useMemo(() => {
    const start = getWeekStart(selectedKey);
    return Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      return { date, key: toDateKey(date) };
    });
  }, [selectedKey]);

  const yearMonths = useMemo(() => {
    const year = selectedDate.getFullYear();
    return Array.from({ length: 12 }, (_, idx) => new Date(year, idx, 1, 0, 0, 0, 0));
  }, [selectedDate]);

  const gridKeys = useMemo(() => gridDays.map((day) => day.key), [gridDays]);
  const summaryByDay = useMemo(() => {
    const map = new Map<string, { activityCount: number; loggedMinutes: number; running: boolean }>();
    gridKeys.forEach((key) => {
      const daySummary = selectors.getDaySummary(key, now) || EMPTY_DAY_SUMMARY;
      map.set(key, {
        activityCount: daySummary.activityCount,
        loggedMinutes: daySummary.minutesTracked,
        running: daySummary.runningCount > 0,
      });
    });
    return map;
  }, [gridKeys, selectors, now]);

  const selectedDateLabel = useMemo(
    () =>
      selectedDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [selectedDate]
  );

  const selectedDaySummary = selectors.getDaySummary(selectedKey, now) || EMPTY_DAY_SUMMARY;

  const selectedActivity = useMemo(
    () => ensureArray(selectors.getDayActivity(selectedKey, now)),
    [selectors, selectedKey, now]
  );

  const selectedActivityGroups = useMemo(
    () => ensureArray(selectors.getDayActivityGrouped(selectedKey, now)),
    [selectors, selectedKey, now]
  );

  const selectedScheduledTasks = useMemo(() => {
    const { start, end } = getDateBounds(selectedKey);
    return ensureArray(tasks)
      .filter((task) => !!task.scheduledAt && task.scheduledAt >= start && task.scheduledAt < end)
      .sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0));
  }, [tasks, selectedKey]);

  const normalized = useMemo(
    () =>
      normalizeDayItems({
        dateKey: selectedKey,
        now,
        todayKey,
        tasks: ensureArray(tasks),
        selectedActivity,
        selectedActivityGroups,
        selectedScheduledTasks,
      }),
    [selectedKey, now, todayKey, tasks, selectedActivity, selectedActivityGroups, selectedScheduledTasks]
  );

  const panelItems = useMemo(() => ensureArray(normalized?.[sidePanelTab]), [normalized, sidePanelTab]);

  const rangeLabel = useMemo(
    () => RANGE_OPTIONS.find((option) => option.value === rangeMode)?.label ?? rangeMode,
    [rangeMode]
  );

  const selectDate = (dateKey: string, monthDate?: Date) => {
    setSelectedKey(dateKey);
    setActiveLogDateKey(dateKey);
    if (monthDate) {
      setViewMonth(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
    }
    setHighlightedGroupKey(null);
  };

  const handleRangeChange = (mode: RangeMode) => {
    setRangeMode(mode);
    if (mode === 'today') {
      const today = new Date();
      selectDate(toDateKey(today), today);
    }
  };

  const jumpToGroup = useCallback((item: NormalizedLogItem) => {
    const targetGroup = item.groupKey || (item.taskId ? `task:${item.taskId}` : undefined);
    if (!targetGroup) {
      setDetailItem(item);
      return;
    }

    setExpandedGroupKey(targetGroup);
    setHighlightedGroupKey(targetGroup);
    window.setTimeout(() => {
      setHighlightedGroupKey((prev) => (prev === targetGroup ? null : prev));
    }, 1400);

    const element = document.getElementById(`day-history-group-${targetGroup}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setDetailItem(item);
  }, []);

  const openQuestAddFlow = useCallback(() => {
    const toggleBtn = document.getElementById('hextech-assistant-toggle') as HTMLButtonElement | null;
    if (!toggleBtn) return;
    const overlayOpen = !!document.querySelector('[data-quests-overlay="true"]');
    if (!overlayOpen) toggleBtn.click();
  }, []);

  const sidePanel = (
    <div className="flex h-full flex-col rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] shadow-[0_14px_34px_rgba(0,0,0,0.42)] overflow-hidden">
      <div className="px-4 py-4 border-b border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.26em] text-[var(--app-muted)]">Selected Date</div>
            <div className="text-sm uppercase tracking-[0.14em] text-[var(--app-text)] mt-1">{selectedDateLabel}</div>
          </div>
          <button
            type="button"
            onClick={openQuestAddFlow}
            className="px-2.5 py-1.5 rounded-md border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))] text-[10px] uppercase tracking-[0.18em] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
          >
            Add
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.16em]">
          <div className="rounded-md border border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] bg-[var(--app-panel-2)] px-2 py-1.5 text-[var(--app-muted)]">
            Tracked
            <div className="mt-1 text-[var(--app-text)]">{selectedDaySummary.minutesTracked}m</div>
          </div>
          <div className="rounded-md border border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] bg-[var(--app-panel-2)] px-2 py-1.5 text-[var(--app-muted)]">
            Total Items
            <div className="mt-1 text-[var(--app-text)]">{selectedDaySummary.activityCount}</div>
          </div>
          <div className="rounded-md border border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] bg-[var(--app-panel-2)] px-2 py-1.5 text-[var(--app-muted)]">
            Completed
            <div className="mt-1 text-[var(--app-text)]">{selectedDaySummary.completedCount}</div>
          </div>
          <div className="rounded-md border border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] bg-[var(--app-panel-2)] px-2 py-1.5 text-[var(--app-muted)]">
            Scheduled
            <div className="mt-1 text-[var(--app-text)]">{selectedDaySummary.scheduledCount}</div>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] flex gap-2 overflow-x-auto no-scrollbar">
        {SIDE_PANEL_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSidePanelTab(tab.value)}
            className={`px-3 py-1.5 rounded-md border text-[10px] uppercase tracking-[0.18em] transition-colors whitespace-nowrap ${
              sidePanelTab === tab.value
                ? 'border-[color-mix(in_srgb,var(--app-accent)_60%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] text-[var(--app-accent)]'
                : 'border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:text-[var(--app-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {panelItems.length === 0 ? (
          <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] p-3 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
            No items for this tab.
          </div>
        ) : (
          panelItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => jumpToGroup(item)}
              className="w-full text-left rounded-lg border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] px-3 py-2 hover:border-[color-mix(in_srgb,var(--app-accent)_55%,transparent)] transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.14em] text-[var(--app-text)] truncate">{item.title}</div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)] mt-1 truncate">{toPanelSubtitle(item)}</div>
                </div>
                <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  {item.scheduledAt ? formatTime(item.scheduledAt) : item.startAt ? formatTime(item.startAt) : '--:--'}
                </span>
              </div>
              <div className="mt-2 inline-flex rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))] text-[var(--app-accent)]">
                {toPanelBadge(item.status)}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="relative xl:pr-[416px] text-[var(--app-text)]">
      {import.meta.env.DEV ? (
        <div className="mb-3 rounded-md border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))] px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-[var(--app-text)]">selectedDate: {selectedKey}</span>
            <span>activeRange: {rangeLabel}</span>
            <span>tracked: {selectedDaySummary.minutesTracked}m</span>
            <span>completed: {selectedDaySummary.completedCount}</span>
            <span>scheduled: {selectedDaySummary.scheduledCount}</span>
            <span>total: {selectedDaySummary.activityCount}</span>
          </div>
        </div>
      ) : null}
      <div className="space-y-4">
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-gradient-to-b from-[color-mix(in_srgb,var(--app-panel-2)_90%,var(--app-panel))] to-[var(--app-panel)] shadow-[0_12px_28px_rgba(0,0,0,0.45)] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <div className="text-[10px] text-[var(--app-muted)] tracking-[0.3em] uppercase">Log Calendar</div>
              <div className="text-xl font-medium tracking-[0.08em] uppercase text-[var(--app-text)]">{formatMonthTitle(viewMonth)}</div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleRangeChange(option.value)}
                  className={`px-3 py-2 rounded-md border text-[10px] tracking-[0.2em] uppercase transition-colors ${
                    rangeMode === option.value
                      ? 'border-[color-mix(in_srgb,var(--app-accent)_60%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))] text-[var(--app-accent)]'
                      : 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-text)_30%,transparent)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="px-3 py-2 rounded-md border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[10px] tracking-[0.2em] uppercase text-[var(--app-text)] bg-[var(--app-panel-2)] hover:border-[color-mix(in_srgb,var(--app-text)_30%,transparent)] transition-colors"
              >
                Prev
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

          {rangeMode === 'today' ? (
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Today</div>
              <div className="text-lg uppercase tracking-[0.12em] text-[var(--app-text)] mt-2">{selectedDateLabel}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em]">
                <span className="rounded-full px-2 py-1 bg-[var(--app-panel)] text-[var(--app-text)]">{selectedDaySummary.minutesTracked}m tracked</span>
                <span className="rounded-full px-2 py-1 bg-[var(--app-panel)] text-[var(--app-muted)]">{selectedDaySummary.activityCount} items</span>
              </div>
            </div>
          ) : null}

          {rangeMode === 'week' ? (
            <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const daySummary = selectors.getDaySummary(day.key, now) || EMPTY_DAY_SUMMARY;
                const isSelected = day.key === selectedKey;
                const isToday = day.key === todayKey;
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => selectDate(day.key, day.date)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? 'border-[color-mix(in_srgb,var(--app-accent)_60%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))]'
                        : 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)]'
                    }`}
                  >
                    <div className={`text-[11px] uppercase tracking-[0.16em] ${isToday ? 'text-[var(--app-accent)]' : 'text-[var(--app-muted)]'}`}>
                      {formatWeekdayLabel(day.key)}
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--app-text)]">{daySummary.minutesTracked}m</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] mt-1">{daySummary.activityCount} items</div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {rangeMode === 'month' ? (
            <>
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
                      onClick={() => selectDate(day.key, day.date)}
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
            </>
          ) : null}

          {rangeMode === 'year' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {yearMonths.map((monthDate) => {
                const monthKey = toDateKey(monthDate);
                const monthSummary = selectors.getDaySummary(monthKey, now) || EMPTY_DAY_SUMMARY;
                const isSelectedMonth =
                  viewMonth.getFullYear() === monthDate.getFullYear() &&
                  viewMonth.getMonth() === monthDate.getMonth();
                return (
                  <button
                    key={monthDate.toISOString()}
                    type="button"
                    onClick={() => {
                      const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
                      setViewMonth(firstDay);
                      selectDate(toDateKey(firstDay), firstDay);
                      setRangeMode('month');
                    }}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      isSelectedMonth
                        ? 'border-[color-mix(in_srgb,var(--app-accent)_60%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))]'
                        : 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)]'
                    }`}
                  >
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--app-text)]">
                      {monthDate.toLocaleDateString(undefined, { month: 'short' })}
                    </div>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                      {monthSummary.minutesTracked}m tracked
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] mt-1">
                      {monthSummary.activityCount} items
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] shadow-[0_10px_24px_rgba(0,0,0,0.35)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-[var(--app-text)] uppercase tracking-[0.16em]">Day History</div>
              <div className="text-xs text-[var(--app-muted)]">{selectedDateLabel}</div>
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em]">
              <span className="rounded-full px-2 py-1 bg-[var(--app-panel)] text-[var(--app-text)]">{selectedDaySummary.minutesTracked}m tracked</span>
              <span className="rounded-full px-2 py-1 bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))] text-[var(--app-accent)]">{selectedDaySummary.activityCount} items</span>
            </div>
          </div>

          {selectedActivityGroups.length === 0 ? (
            <div className="text-sm text-[var(--app-muted)]">No activity found on this date.</div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
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
                const isHighlighted = highlightedGroupKey === group.key;
                return (
                  <div
                    id={`day-history-group-${group.key}`}
                    key={group.key}
                    className={`rounded-lg border px-3 py-2 transition-colors ${
                      isHighlighted
                        ? 'border-[color-mix(in_srgb,var(--app-accent)_65%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel-2))]'
                        : 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)]'
                    }`}
                  >
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
                            <span className="text-[10px] rounded px-2 py-0.5 bg-[var(--app-panel)] text-[var(--app-text)]">CREATED</span>
                          ) : null}
                          {hasScheduled ? (
                            <span className="text-[10px] rounded px-2 py-0.5 bg-[var(--app-panel)] text-[var(--app-text)]">SCHEDULED</span>
                          ) : null}
                          {group.hasCompletion ? (
                            <span className="text-[10px] rounded px-2 py-0.5 bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))] text-[var(--app-accent)]">DONE</span>
                          ) : null}
                          {retroMinutes > 0 ? (
                            <span className="text-[10px] rounded px-2 py-0.5 bg-[var(--app-panel)] text-[var(--app-text)]">RETRO +{retroMinutes}m</span>
                          ) : null}
                          {trackedMinutes > 0 ? (
                            <span className="text-[10px] rounded px-2 py-0.5 bg-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-panel))] text-[var(--app-accent)]">TRACKED {trackedMinutes}m</span>
                          ) : null}
                          {hasHidden ? (
                            <span className="text-[10px] rounded px-2 py-0.5 bg-[var(--app-panel)] text-[var(--app-text)]">HIDDEN</span>
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
            <div className="text-sm font-medium text-[var(--app-text)] uppercase tracking-[0.16em]">
              Scheduled Tasks ({selectedScheduledTasks.length})
            </div>
          </div>

          {selectedScheduledTasks.length === 0 ? (
            <div className="text-sm text-[var(--app-muted)]">No scheduled tasks for this date.</div>
          ) : (
            <div className="space-y-2">
              {selectedScheduledTasks.map((task) => (
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

      <aside className="hidden xl:flex fixed right-4 top-[76px] h-[calc(100dvh-88px)] w-[390px] z-30">{sidePanel}</aside>

      <button
        type="button"
        onClick={() => setMobilePanelOpen(true)}
        className="xl:hidden fixed right-4 top-[76px] z-30 px-3 py-2 rounded-md border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))] text-[10px] uppercase tracking-[0.18em] text-[var(--app-accent)]"
      >
        Timeline
      </button>

      {mobilePanelOpen ? (
        <div className="xl:hidden fixed inset-0 z-40">
          <button
            type="button"
            onClick={() => setMobilePanelOpen(false)}
            className="absolute inset-0 bg-black/55"
            aria-label="Close timeline panel"
          />
          <div className="absolute right-0 top-[60px] h-[calc(100dvh-60px)] w-[min(420px,100vw)] p-3">{sidePanel}</div>
        </div>
      ) : null}

      {detailItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setDetailItem(null)}
            className="absolute inset-0 bg-black/55"
            aria-label="Close details"
          />
          <div className="relative w-full max-w-sm rounded-xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] p-4">
            <div className="text-sm uppercase tracking-[0.18em] text-[var(--app-text)]">{detailItem.title}</div>
            <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--app-muted)]">{toPanelSubtitle(detailItem)}</div>
            <div className="mt-3 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
              {detailItem.scheduledAt ? formatTime(detailItem.scheduledAt) : detailItem.startAt ? formatTime(detailItem.startAt) : '--:--'}
            </div>
            <button
              type="button"
              onClick={() => setDetailItem(null)}
              className="mt-4 w-full rounded-md border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-text)]"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
