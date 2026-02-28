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
  | 'todo'
  | 'done'
  | 'created'
  | 'scheduled'
  | 'running'
  | 'tracked'
  | 'retro'
  | 'failed';

type NormalizedLogItemType = 'timeline' | 'task' | 'summary';

type NormalizedLogItem = {
  id: string;
  type: NormalizedLogItemType;
  title: string;
  status: NormalizedLogItemStatus;
  startAt?: number;
  endAt?: number;
  durationMin?: number;
  sourceRef: string;
  taskId?: string;
  groupKey?: string;
  subtitle?: string;
};

type DayConsoleRow = {
  key: string;
  title: string;
  status: NormalizedLogItemStatus;
  startAt?: number;
  groupKey?: string;
  taskId?: string;
  items: NormalizedLogItem[];
};

const mapActivityStatus = (entry: XPDayActivityItem): NormalizedLogItemStatus => {
  if (entry.kind === 'completion') return 'done';
  if (entry.kind === 'manual') return 'retro';
  if (entry.kind === 'created') {
    const normalized = entry.statusLabel.toLowerCase();
    if (normalized.includes('scheduled')) return 'scheduled';
    if (normalized.includes('completed')) return 'done';
    return 'created';
  }
  if (entry.statusLabel === 'RUNNING') return 'running';
  return 'tracked';
};

const mapTimelineEvents = (selectedActivity: XPDayActivityItem[], now: number): NormalizedLogItem[] =>
  selectedActivity.map<NormalizedLogItem>((entry) => {
    const safeCreatedAt = toSafeTimestamp(entry.createdAt) ?? now;
    return {
      id: `timeline:${entry.kind}:${entry.id}`,
      type: 'timeline',
      title: entry.title,
      status: mapActivityStatus(entry),
      startAt: safeCreatedAt,
      durationMin: Math.max(0, entry.minutes),
      sourceRef: `${entry.kind}:${entry.id}`,
      taskId: entry.taskId,
      groupKey: entry.taskId ? `task:${entry.taskId}` : undefined,
    };
  });

const mapCompletedItems = (selectedActivityGroups: XPDayActivityGroup[]): NormalizedLogItem[] =>
  selectedActivityGroups
    .filter((group) => group.hasCompletion)
    .map<NormalizedLogItem>((group) => ({
      id: `summary:completed:${group.key}`,
      type: 'summary',
      title: group.title,
      status: 'done',
      startAt: group.latestAt,
      durationMin: Math.max(0, group.totalMinutes),
      sourceRef: `group:${group.key}`,
      taskId: group.taskId,
      groupKey: group.key,
      subtitle: group.totalMinutes > 0 ? `${group.totalMinutes}m tracked` : 'No time logged',
    }));

const mapScheduledItems = (
  dateKey: string,
  todayKey: string,
  now: number,
  selectedScheduledTasks: Task[]
): NormalizedLogItem[] => {
  const selectedDayIsToday = dateKey === todayKey;
  return selectedScheduledTasks
    .filter((task) => !selectedDayIsToday || (task.scheduledAt || 0) >= now)
    .map<NormalizedLogItem>((task) => {
      const startAt =
        toSafeTimestamp(task.scheduledAt) || toSafeTimestamp(task.updatedAt) || toSafeTimestamp(task.createdAt);
      return {
        id: `task:scheduled:${task.id}`,
        type: 'task',
        title: task.title,
        status: 'scheduled',
        startAt,
        sourceRef: `task:${task.id}`,
        taskId: task.id,
        groupKey: `task:${task.id}`,
        subtitle: `Prio: ${task.priority.toUpperCase()}`,
      };
    });
};

const mapUnfinishedItems = (
  tasks: Task[],
  selectedScheduledTasks: Task[],
  selectedActivityGroups: XPDayActivityGroup[]
): NormalizedLogItem[] => {
  const scheduledIds = new Set(selectedScheduledTasks.map((task) => task.id));
  const activeGroupIds = new Set(
    selectedActivityGroups.map((group) => group.taskId).filter((taskId): taskId is string => !!taskId)
  );

  return tasks
    .filter((task) => {
      if (task.archivedAt) return false;
      if (task.status === 'done') return false;
      if (!(task.status === 'todo' || task.status === 'active' || task.status === 'dropped')) return false;
      return scheduledIds.has(task.id) || activeGroupIds.has(task.id);
    })
    .map<NormalizedLogItem>((task) => ({
      id: `task:unfinished:${task.id}`,
      type: 'task',
      title: task.title,
      status: task.status === 'active' ? 'running' : task.status === 'dropped' ? 'failed' : 'todo',
      startAt: toSafeTimestamp(task.scheduledAt) || toSafeTimestamp(task.updatedAt) || toSafeTimestamp(task.createdAt),
      sourceRef: `task:${task.id}`,
      taskId: task.id,
      groupKey: `task:${task.id}`,
      subtitle:
        task.status === 'dropped'
          ? 'Failed / dropped'
          : task.status === 'active'
            ? 'In progress'
            : 'Todo',
    }));
};

const normalizeDayItems = (params: {
  dateKey: string;
  now: number;
  todayKey: string;
  tasks: Task[];
  selectedActivity: XPDayActivityItem[];
  selectedActivityGroups: XPDayActivityGroup[];
  selectedScheduledTasks: Task[];
}): NormalizedLogItem[] => {
  const { dateKey, now, todayKey, tasks, selectedActivity, selectedActivityGroups, selectedScheduledTasks } = params;
  return [
    ...mapTimelineEvents(selectedActivity, now),
    ...mapCompletedItems(selectedActivityGroups),
    ...mapScheduledItems(dateKey, todayKey, now, selectedScheduledTasks),
    ...mapUnfinishedItems(tasks, selectedScheduledTasks, selectedActivityGroups),
  ];
};

const filterPanelItems = (items: NormalizedLogItem[], tab: SidePanelTab, now: number): NormalizedLogItem[] => {
  const orderedDesc = [...items].sort((a, b) => (b.startAt || 0) - (a.startAt || 0));

  if (tab === 'timeline') {
    return orderedDesc.filter((item) => item.type === 'timeline');
  }
  if (tab === 'unfinished') {
    return orderedDesc.filter((item) => item.status === 'todo' || item.status === 'running' || item.status === 'failed');
  }
  if (tab === 'completed') {
    return orderedDesc.filter((item) => item.status === 'done');
  }
  return [...items]
    .filter((item) => item.status === 'scheduled' && (item.startAt || 0) >= now)
    .sort((a, b) => (a.startAt || 0) - (b.startAt || 0));
};

const statusRank: Record<NormalizedLogItemStatus, number> = {
  running: 7,
  failed: 6,
  todo: 5,
  scheduled: 4,
  done: 3,
  retro: 2,
  tracked: 1,
  created: 0,
};

const toRowStatus = (items: NormalizedLogItem[]): NormalizedLogItemStatus =>
  items.reduce(
    (best, item) => (statusRank[item.status] > statusRank[best] ? item.status : best),
    items[0]?.status ?? 'tracked'
  );

const groupPanelItems = (items: NormalizedLogItem[]): DayConsoleRow[] => {
  const grouped = new Map<string, NormalizedLogItem[]>();
  for (const item of items) {
    const key = item.groupKey || item.taskId || item.sourceRef || item.id;
    const existing = grouped.get(key) || [];
    existing.push(item);
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries())
    .map(([key, groupItems]) => {
      const sorted = [...groupItems].sort((a, b) => (b.startAt || 0) - (a.startAt || 0));
      const head = sorted[0];
      return {
        key,
        title: head?.title || 'Untitled',
        status: toRowStatus(sorted),
        startAt: head?.startAt,
        groupKey: head?.groupKey,
        taskId: head?.taskId,
        items: sorted,
      } satisfies DayConsoleRow;
    })
    .sort((a, b) => (b.startAt || 0) - (a.startAt || 0));
};

const dotColorByStatus = (status: NormalizedLogItemStatus) => {
  if (status === 'running') return 'var(--app-accent)';
  if (status === 'done') return 'color-mix(in_srgb,var(--app-accent)_72%,white)';
  if (status === 'failed') return 'color-mix(in_srgb,#ff5a6a_75%,var(--app-accent))';
  if (status === 'scheduled') return 'color-mix(in_srgb,var(--app-accent)_45%,var(--app-text))';
  if (status === 'todo') return 'color-mix(in_srgb,var(--app-text)_68%,var(--app-panel-2))';
  return 'color-mix(in_srgb,var(--app-accent)_30%,var(--app-text))';
};

const toPanelBadge = (status: NormalizedLogItemStatus) => {
  switch (status) {
    case 'done':
      return 'DONE';
    case 'retro':
      return 'RETRO';
    case 'scheduled':
      return 'SCHEDULED';
    case 'running':
      return 'RUNNING';
    case 'failed':
      return 'FAILED';
    case 'todo':
      return 'UNFINISHED';
    case 'created':
      return 'CREATED';
    case 'tracked':
    default:
      return 'TRACKED';
  }
};

const toPanelSubtitle = (item: NormalizedLogItem) => {
  if (item.subtitle) return item.subtitle;
  if (item.status === 'done') {
    return item.durationMin && item.durationMin > 0 ? `${item.durationMin}m tracked` : 'No time logged';
  }
  if (item.status === 'scheduled') {
    return item.startAt ? `Starts ${formatTime(item.startAt)}` : 'Scheduled';
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
    startSession,
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
  const [detailItem, setDetailItem] = useState<NormalizedLogItem | null>(null);
  const [expandedPanelItemId, setExpandedPanelItemId] = useState<string | null>(null);
  const [highlightedPanelKey, setHighlightedPanelKey] = useState<string | null>(null);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [mobileConsoleOpen, setMobileConsoleOpen] = useState(false);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [hoveredDotId, setHoveredDotId] = useState<string | null>(null);

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

  const panelItems = useMemo(() => filterPanelItems(normalized, sidePanelTab, now), [normalized, sidePanelTab, now]);
  const dayConsoleRows = useMemo(() => groupPanelItems(panelItems), [panelItems]);
  const timelineDots = useMemo(() => {
    const dayStart = fromDateKey(selectedKey).getTime();
    const dayEnd = dayStart + 86400000;
    return normalized.map((item, index) => {
      const startAt = item.startAt && Number.isFinite(item.startAt) ? item.startAt : undefined;
      const safeTime = startAt ? Math.min(Math.max(startAt, dayStart), dayEnd - 1) : dayStart + index * 60000;
      const minute = Math.max(0, Math.floor((safeTime - dayStart) / 60000));
      return {
        id: item.id,
        title: item.title,
        status: item.status,
        time: safeTime,
        xPct: (minute / 1439) * 100,
        yPx: 18 + (index % 4) * 14,
      };
    });
  }, [normalized, selectedKey]);
  const hoveredDot = useMemo(
    () => (hoveredDotId ? timelineDots.find((dot) => dot.id === hoveredDotId) || null : null),
    [timelineDots, hoveredDotId]
  );

  const rangeLabel = useMemo(
    () => RANGE_OPTIONS.find((option) => option.value === rangeMode)?.label ?? rangeMode,
    [rangeMode]
  );
  const activeTabLabel = useMemo(
    () => SIDE_PANEL_TABS.find((tab) => tab.value === sidePanelTab)?.label ?? 'Timeline',
    [sidePanelTab]
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

  const handlePrev = useCallback(() => {
    if (rangeMode === 'week') {
      const base = fromDateKey(selectedKey);
      base.setDate(base.getDate() - 7);
      selectDate(toDateKey(base), base);
      return;
    }
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, [rangeMode, selectedKey]);

  const handleNext = useCallback(() => {
    if (rangeMode === 'week') {
      const base = fromDateKey(selectedKey);
      base.setDate(base.getDate() + 7);
      selectDate(toDateKey(base), base);
      return;
    }
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, [rangeMode, selectedKey]);

  const jumpToGroup = useCallback(
    (item: NormalizedLogItem) => {
      const targetGroup = item.groupKey || (item.taskId ? `task:${item.taskId}` : undefined);
      if (!targetGroup) {
        if (historyModalOpen) setDetailItem(item);
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

      if (historyModalOpen) setDetailItem(item);
    },
    [historyModalOpen]
  );

  const openQuestAddFlow = useCallback(() => {
    const toggleBtn = document.getElementById('hextech-assistant-toggle') as HTMLButtonElement | null;
    if (!toggleBtn) return;
    const overlayOpen = !!document.querySelector('[data-quests-overlay="true"]');
    if (!overlayOpen) toggleBtn.click();
  }, []);

  const startFromDayConsole = useCallback(
    (row: DayConsoleRow) => {
      if (!row.taskId) return;
      startSession({
        title: row.title,
        tag: 'calendar',
        source: 'timer',
        linkedTaskIds: [row.taskId],
      });
      setMobileConsoleOpen(false);
    },
    [startSession]
  );

  const handlePanelItemClick = useCallback(
    (item: NormalizedLogItem) => {
      const panelKey = item.groupKey || (item.taskId ? `task:${item.taskId}` : item.sourceRef || item.id);
      setExpandedPanelItemId(panelKey);
      setHighlightedPanelKey(panelKey);
      window.setTimeout(() => {
        setHighlightedPanelKey((prev) => (prev === panelKey ? null : prev));
      }, 1400);

      const panelRow = document.getElementById(`day-console-row-${panelKey}`);
      if (panelRow) {
        panelRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      if (historyModalOpen) jumpToGroup(item);
    },
    [jumpToGroup, historyModalOpen]
  );

  const renderCompactItemList = (mobile = false) => (
    <div className={`${mobile ? 'max-h-[58dvh]' : 'max-h-[45vh]'} overflow-y-auto pr-1 space-y-1.5`}>
      {dayConsoleRows.length === 0 ? (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] p-3 text-[11px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
          No items for this tab.
        </div>
      ) : (
        dayConsoleRows.map((row) => {
          const expanded = expandedPanelItemId === row.key;
          const headItem = row.items[0];
          const isStartable =
            !!row.taskId && (row.status === 'todo' || row.status === 'scheduled' || row.status === 'failed');
          return (
            <div
              key={row.key}
              id={`day-console-row-${row.key}`}
              className={`rounded-lg border overflow-hidden transition-colors ${
                highlightedPanelKey === row.key
                  ? 'border-[color-mix(in_srgb,var(--app-accent)_60%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))]'
                  : 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)]'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (headItem) handlePanelItemClick(headItem);
                  setExpandedPanelItemId((prev) => (prev === row.key ? null : row.key));
                }}
                className="w-full text-left px-3 py-2 transition-colors hover:bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel))]"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 text-xs uppercase tracking-[0.14em] text-[var(--app-text)] truncate">
                    {row.title}
                  </div>
                  <span className="inline-flex rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel-2))] text-[var(--app-accent)] shrink-0">
                    {toPanelBadge(row.status)}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)] shrink-0">
                    {row.startAt ? formatTime(row.startAt) : '--:--'}
                  </span>
                </div>
              </button>
              {expanded ? (
                <div className="border-t border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] bg-[color-mix(in_srgb,var(--app-panel-2)_65%,var(--app-panel))] px-3 py-2 space-y-2">
                  <div className="space-y-1.5">
                    {row.items.slice(0, 5).map((entry) => (
                      <button
                        key={`${row.key}-${entry.id}`}
                        type="button"
                        onClick={() => handlePanelItemClick(entry)}
                        className="w-full rounded border border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] bg-[var(--app-panel)] px-2 py-1 text-left text-[10px] uppercase tracking-[0.13em] text-[var(--app-muted)] hover:border-[color-mix(in_srgb,var(--app-accent)_40%,transparent)]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{toPanelSubtitle(entry)}</span>
                          <span className="shrink-0">{entry.startAt ? formatTime(entry.startAt) : '--:--'}</span>
                        </div>
                      </button>
                    ))}
                    {row.items.length > 5 ? (
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] px-1">
                        +{row.items.length - 5} more entries
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (headItem) handlePanelItemClick(headItem);
                        if (mobile) setMobileConsoleOpen(false);
                      }}
                      className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                    >
                      Details
                    </button>
                    {isStartable ? (
                      <button
                        type="button"
                        onClick={() => startFromDayConsole(row)}
                        className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] text-[10px] uppercase tracking-[0.14em] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
                      >
                        Start
                      </button>
                    ) : null}
                    {row.taskId ? (
                      <button
                        type="button"
                        onClick={() => {
                          const ok = window.confirm('Delete this quest and all linked activity?');
                          if (!ok) return;
                          deleteTaskCompletely(row.taskId);
                          if (mobile) setMobileConsoleOpen(false);
                        }}
                        className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] text-[10px] uppercase tracking-[0.14em] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );

  const dayConsole = (
    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.26em] text-[var(--app-muted)]">Day Console</div>
            <div className="text-sm uppercase tracking-[0.12em] text-[var(--app-text)] mt-1 truncate">
              Selected Date: {selectedDateLabel}
            </div>
            <div className="text-[11px] text-[var(--app-muted)] mt-1 uppercase tracking-[0.12em]">
              Tracked {selectedDaySummary.minutesTracked}m • Items {selectedDaySummary.activityCount} • Completed{' '}
              {selectedDaySummary.completedCount} • Scheduled {selectedDaySummary.scheduledCount}
            </div>
          </div>
          <button
            type="button"
            onClick={openQuestAddFlow}
            className="px-2.5 py-1.5 rounded-md border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)] hover:border-[var(--app-accent)] shrink-0"
          >
            Add
          </button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] flex gap-1 overflow-x-auto no-scrollbar">
        {SIDE_PANEL_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setSidePanelTab(tab.value);
              setExpandedPanelItemId(null);
            }}
            className={`px-2.5 py-1 rounded-md border text-[10px] uppercase tracking-[0.14em] transition-colors whitespace-nowrap ${
              sidePanelTab === tab.value
                ? 'border-[color-mix(in_srgb,var(--app-accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] text-[var(--app-accent)]'
                : 'border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:text-[var(--app-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-3">
        <div className="hidden lg:grid gap-3 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
          <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] p-3">
            {sidePanelTab === 'timeline' ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">24h Heatline</div>
                  <button
                    type="button"
                    onClick={() => setTimelineExpanded(true)}
                    className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                  >
                    Expand
                  </button>
                </div>
                <div className="h-[88px] rounded-lg border border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] bg-[color-mix(in_srgb,var(--app-panel-2)_65%,var(--app-panel))] px-2 py-2 relative overflow-hidden">
                  <div className="absolute inset-x-2 bottom-5 h-px bg-[color-mix(in_srgb,var(--app-text)_16%,transparent)]" />
                  <div className="absolute inset-x-2 top-2 h-[1px] bg-[linear-gradient(to_right,color-mix(in_srgb,var(--app-text)_7%,transparent)_1px,transparent_1px)] bg-[size:32px_100%] opacity-70" />
                  {timelineDots.map((dot) => (
                    <button
                      key={`timeline-dot-${dot.id}`}
                      type="button"
                      onClick={() => {
                        const match = normalized.find((item) => item.id === dot.id);
                        if (match) handlePanelItemClick(match);
                      }}
                      className="absolute h-2.5 w-2.5 rounded-full border border-[color-mix(in_srgb,var(--app-text)_24%,transparent)]"
                      style={{
                        left: `calc(${dot.xPct}% + 8px)`,
                        bottom: `${dot.yPx}px`,
                        backgroundColor: dotColorByStatus(dot.status),
                      }}
                      onMouseEnter={() => setHoveredDotId(dot.id)}
                      onMouseLeave={() => setHoveredDotId((prev) => (prev === dot.id ? null : prev))}
                      onFocus={() => setHoveredDotId(dot.id)}
                      onBlur={() => setHoveredDotId((prev) => (prev === dot.id ? null : prev))}
                      title={`${dot.title} · ${toPanelBadge(dot.status)} · ${formatTime(dot.time)}`}
                      aria-label={`${dot.title} ${toPanelBadge(dot.status)} ${formatTime(dot.time)}`}
                    />
                  ))}
                  {hoveredDot ? (
                    <div
                      className="pointer-events-none absolute z-10 rounded-md border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] bg-[var(--app-panel)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-text)] shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
                      style={{
                        left: `calc(${hoveredDot.xPct}% + 16px)`,
                        bottom: `${Math.min(hoveredDot.yPx + 18, 72)}px`,
                        transform: 'translateX(-50%)',
                      }}
                    >
                      {hoveredDot.title} • {formatTime(hoveredDot.time)} • {toPanelBadge(hoveredDot.status)}
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="h-[88px] rounded-lg border border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] bg-[color-mix(in_srgb,var(--app-panel-2)_65%,var(--app-panel))] px-3 py-2 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">{activeTabLabel}</div>
                  <div className="text-xs uppercase tracking-[0.14em] text-[var(--app-text)] mt-1">
                    {dayConsoleRows.length} grouped items
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileConsoleOpen(true)}
                  className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                >
                  Quick Open
                </button>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] p-2.5">
            {renderCompactItemList()}
          </div>
        </div>

        <div className="lg:hidden space-y-2">
          {sidePanelTab === 'timeline' ? (
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">24h Heatline</div>
                <button
                  type="button"
                  onClick={() => setTimelineExpanded(true)}
                  className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]"
                >
                  Expand
                </button>
              </div>
              <div className="h-[88px] rounded-lg border border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] bg-[color-mix(in_srgb,var(--app-panel-2)_65%,var(--app-panel))] px-2 py-2 relative overflow-hidden">
                <div className="absolute inset-x-2 bottom-5 h-px bg-[color-mix(in_srgb,var(--app-text)_16%,transparent)]" />
                {timelineDots.map((dot) => (
                  <button
                    key={`timeline-mobile-dot-${dot.id}`}
                    type="button"
                    onClick={() => {
                      const match = normalized.find((item) => item.id === dot.id);
                      if (match) handlePanelItemClick(match);
                    }}
                    className="absolute h-2.5 w-2.5 rounded-full border border-[color-mix(in_srgb,var(--app-text)_24%,transparent)]"
                    style={{
                      left: `calc(${dot.xPct}% + 8px)`,
                      bottom: `${dot.yPx}px`,
                      backgroundColor: dotColorByStatus(dot.status),
                    }}
                    onMouseEnter={() => setHoveredDotId(dot.id)}
                    onMouseLeave={() => setHoveredDotId((prev) => (prev === dot.id ? null : prev))}
                    onFocus={() => setHoveredDotId(dot.id)}
                    onBlur={() => setHoveredDotId((prev) => (prev === dot.id ? null : prev))}
                  />
                ))}
                {hoveredDot ? (
                  <div
                    className="pointer-events-none absolute z-10 rounded-md border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] bg-[var(--app-panel)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-text)] shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
                    style={{
                      left: `calc(${hoveredDot.xPct}% + 16px)`,
                      bottom: `${Math.min(hoveredDot.yPx + 18, 72)}px`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    {hoveredDot.title} • {formatTime(hoveredDot.time)} • {toPanelBadge(hoveredDot.status)}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
              {activeTabLabel} list ({dayConsoleRows.length})
            </div>
          )}
          <button
            type="button"
            onClick={() => setMobileConsoleOpen(true)}
            className="w-full px-3 py-2 rounded-lg border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))] text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]"
          >
            Open {activeTabLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative text-[var(--app-text)]">
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
                onClick={handlePrev}
                className="px-3 py-2 rounded-md border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[10px] tracking-[0.2em] uppercase text-[var(--app-text)] bg-[var(--app-panel-2)] hover:border-[color-mix(in_srgb,var(--app-text)_30%,transparent)] transition-colors"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={handleNext}
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
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-2">
                {DAY_NAMES.map((name) => (
                  <div
                    key={`week-${name}`}
                    className="text-[10px] text-[var(--app-muted)] text-center py-1 font-normal uppercase tracking-[0.2em]"
                  >
                    {name}
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto no-scrollbar">
                <div className="grid min-w-[740px] grid-cols-7 gap-2">
                  {weekDays.map((day) => {
                    const daySummary = selectors.getDaySummary(day.key, now) || EMPTY_DAY_SUMMARY;
                    const isSelected = day.key === selectedKey;
                    const isToday = day.key === todayKey;
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => selectDate(day.key, day.date)}
                        className={`min-h-[104px] rounded-lg border p-3 text-left transition-colors ${
                          isSelected
                            ? 'border-[color-mix(in_srgb,var(--app-accent)_60%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))]'
                            : 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)]'
                        }`}
                      >
                        <div className={`text-[11px] uppercase tracking-[0.16em] ${isToday ? 'text-[var(--app-accent)]' : 'text-[var(--app-muted)]'}`}>
                          {formatWeekdayLabel(day.key)}
                        </div>
                        <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--app-text)]">
                          {daySummary.minutesTracked}m
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] mt-1">
                          {daySummary.activityCount} items
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
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

        {dayConsole}

        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[var(--app-text)] uppercase tracking-[0.16em]">Full Day History</div>
              <div className="text-xs text-[var(--app-muted)]">Open full grouped history in a modal drawer.</div>
            </div>
            <button
              type="button"
              onClick={() => setHistoryModalOpen(true)}
              className="px-3 py-2 rounded-md border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))] text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
            >
              Show Full History
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] p-4">
          <button
            type="button"
            onClick={() => setScheduledOpen((prev) => !prev)}
            className="w-full flex items-center justify-between gap-3"
          >
            <div className="text-sm font-medium text-[var(--app-text)] uppercase tracking-[0.16em]">
              Scheduled Tasks ({selectedScheduledTasks.length})
            </div>
            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
              {scheduledOpen ? 'Hide' : 'Show'}
            </span>
          </button>

          {scheduledOpen ? (
            selectedScheduledTasks.length === 0 ? (
              <div className="text-sm text-[var(--app-muted)] mt-3">No scheduled tasks for this date.</div>
            ) : (
              <div className="space-y-2 mt-3">
                {selectedScheduledTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] px-3 py-2">
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
            )
          ) : null}
        </div>
      </div>

      {historyModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setHistoryModalOpen(false)}
            className="absolute inset-0 bg-black/55"
            aria-label="Close full history"
          />
          <div className="relative w-full max-w-5xl rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
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
              <div className="space-y-2 max-h-[70dvh] overflow-y-auto pr-1">
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
                          : 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)]'
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
                              <span className="text-[10px] rounded px-2 py-0.5 bg-[var(--app-panel-2)] text-[var(--app-text)]">CREATED</span>
                            ) : null}
                            {hasScheduled ? (
                              <span className="text-[10px] rounded px-2 py-0.5 bg-[var(--app-panel-2)] text-[var(--app-text)]">SCHEDULED</span>
                            ) : null}
                            {group.hasCompletion ? (
                              <span className="text-[10px] rounded px-2 py-0.5 bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel-2))] text-[var(--app-accent)]">DONE</span>
                            ) : null}
                            {retroMinutes > 0 ? (
                              <span className="text-[10px] rounded px-2 py-0.5 bg-[var(--app-panel-2)] text-[var(--app-text)]">RETRO +{retroMinutes}m</span>
                            ) : null}
                            {trackedMinutes > 0 ? (
                              <span className="text-[10px] rounded px-2 py-0.5 bg-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-panel-2))] text-[var(--app-accent)]">TRACKED {trackedMinutes}m</span>
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
                                className="rounded border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] px-2 py-1.5"
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
        </div>
      ) : null}

      {timelineExpanded ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setTimelineExpanded(false)}
            className="absolute inset-0 bg-black/55"
            aria-label="Close timeline"
          />
          <div className="relative w-full max-w-4xl rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm uppercase tracking-[0.16em] text-[var(--app-text)]">Timeline • Expanded</div>
              <button
                type="button"
                onClick={() => setTimelineExpanded(false)}
                className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]"
              >
                Close
              </button>
            </div>
            <div className="h-[280px] rounded-lg border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] px-4 py-4 relative overflow-hidden">
              <div className="absolute inset-x-4 bottom-10 h-px bg-[color-mix(in_srgb,var(--app-text)_16%,transparent)]" />
              <div className="absolute inset-x-4 top-4 h-[1px] bg-[linear-gradient(to_right,color-mix(in_srgb,var(--app-text)_7%,transparent)_1px,transparent_1px)] bg-[size:40px_100%] opacity-75" />
              {timelineDots.map((dot, index) => (
                <button
                  key={`timeline-expanded-${dot.id}-${index}`}
                  type="button"
                  onClick={() => {
                    const match = normalized.find((item) => item.id === dot.id);
                    if (match) handlePanelItemClick(match);
                  }}
                  className="absolute h-3 w-3 rounded-full border border-[color-mix(in_srgb,var(--app-text)_24%,transparent)]"
                  style={{
                    left: `calc(${dot.xPct}% + 12px)`,
                    bottom: `${32 + (index % 8) * 22}px`,
                    backgroundColor: dotColorByStatus(dot.status),
                  }}
                  title={`${dot.title} · ${toPanelBadge(dot.status)} · ${formatTime(dot.time)}`}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {mobileConsoleOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileConsoleOpen(false)}
            className="absolute inset-0 bg-black/55"
            aria-label="Close day console list"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--app-text)]">
                {activeTabLabel} • {selectedDateLabel}
              </div>
              <button
                type="button"
                onClick={() => setMobileConsoleOpen(false)}
                className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]"
              >
                Close
              </button>
            </div>
            {renderCompactItemList(true)}
          </div>
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
              {detailItem.startAt ? formatTime(detailItem.startAt) : '--:--'}
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
