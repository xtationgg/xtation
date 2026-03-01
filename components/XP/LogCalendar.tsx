import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useXP } from './xpStore';
import type { XPDayActivityItem, XPDayActivityGroup, Task } from './xpTypes';
import { ConfirmModal } from '../UI/ConfirmModal';
import { DayTimeOrb } from './DayTimeOrb';
import { Pause, Play, Trash2 } from 'lucide-react';

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
const TIMELINE_HOUR_MARKERS = Array.from({ length: 25 }, (_, index) => index);
const TIMELINE_LABELS_FULL = TIMELINE_HOUR_MARKERS;
const TIMELINE_LABELS_SPARSE = TIMELINE_HOUR_MARKERS;
const TIMELINE_BASELINE_Y = 350;

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

type QuestRowState = 'done' | 'active' | 'scheduled' | 'failed' | 'todo';
const QUEST_STATE_LEGEND: Array<{ state: QuestRowState; label: string; note?: string }> = [
  { state: 'active', label: 'Active' },
  { state: 'done', label: 'Completed' },
  { state: 'todo', label: 'Unfinished' },
  { state: 'scheduled', label: 'Scheduled' },
  { state: 'failed', label: 'Failed', note: 'Dropped' },
];
type TaskCardTab = SidePanelTab | 'all';

type DayConsoleRow = {
  key: string;
  title: string;
  state: QuestRowState;
  primaryTime?: number;
  inferredTime: boolean;
  groupKey?: string;
  taskId?: string;
  items: NormalizedLogItem[];
};

type DeleteConfirmState = {
  taskId: string;
  title: string;
  collapsePanelRowKey?: string;
  collapseHistoryRowKey?: string;
};

type QuestStateMeta = {
  label: string;
  dotFill: string;
  dotBorder: string;
  chipBg: string;
  chipBorder: string;
  chipText: string;
};

const QUEST_STATE_META: Record<QuestRowState, QuestStateMeta> = {
  active: {
    label: 'Active',
    dotFill: '#e3b34a',
    dotBorder: '#e3b34a',
    chipBg: 'color-mix(in_srgb,#e3b34a 22%, var(--app-panel-2))',
    chipBorder: 'color-mix(in_srgb,#e3b34a 38%, transparent)',
    chipText: '#e3b34a',
  },
  done: {
    label: 'Completed',
    dotFill: '#43d39e',
    dotBorder: '#43d39e',
    chipBg: 'color-mix(in_srgb,#43d39e 20%, var(--app-panel-2))',
    chipBorder: 'color-mix(in_srgb,#43d39e 36%, transparent)',
    chipText: '#43d39e',
  },
  todo: {
    label: 'Unfinished',
    dotFill: '#8f88ab',
    dotBorder: '#8f88ab',
    chipBg: 'color-mix(in_srgb,#8f88ab 18%, var(--app-panel-2))',
    chipBorder: 'color-mix(in_srgb,#8f88ab 34%, transparent)',
    chipText: '#cdc7e8',
  },
  scheduled: {
    label: 'Scheduled',
    dotFill: '#5f9dff',
    dotBorder: '#5f9dff',
    chipBg: 'color-mix(in_srgb,#5f9dff 18%, var(--app-panel-2))',
    chipBorder: 'color-mix(in_srgb,#5f9dff 34%, transparent)',
    chipText: '#8db8ff',
  },
  failed: {
    label: 'Failed',
    dotFill: '#ff5a6a',
    dotBorder: '#ff5a6a',
    chipBg: 'color-mix(in_srgb,#ff5a6a 18%, var(--app-panel-2))',
    chipBorder: 'color-mix(in_srgb,#ff5a6a 34%, transparent)',
    chipText: '#ff7d88',
  },
};

const QUEST_STATE_PRIORITY: Record<QuestRowState, number> = {
  active: 5,
  done: 4,
  failed: 3,
  scheduled: 2,
  todo: 1,
};

const NORMALIZED_STATUS_TO_QUEST_STATE: Record<NormalizedLogItemStatus, QuestRowState> = {
  running: 'active',
  done: 'done',
  failed: 'failed',
  scheduled: 'scheduled',
  todo: 'todo',
  created: 'todo',
  tracked: 'todo',
  retro: 'todo',
};

const DAY_ROW_STATUS_CHIP_WIDTH = 96;
const DAY_ROW_TIME_WIDTH = 74;

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

const filterTaskCardItems = (items: NormalizedLogItem[], tab: TaskCardTab, now: number): NormalizedLogItem[] => {
  if (tab === 'all') {
    return [...items].sort((a, b) => (b.startAt || 0) - (a.startAt || 0));
  }
  const orderedDesc = [...items].sort((a, b) => (b.startAt || 0) - (a.startAt || 0));

  if (tab === 'timeline') {
    return orderedDesc.filter((item) => item.type === 'timeline' || item.status === 'scheduled');
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

const getQuestRowKey = (item: NormalizedLogItem, dateKey = '') => {
  if (item.taskId) return `task:${item.taskId}`;
  if (item.groupKey && item.groupKey.startsWith('task:')) return item.groupKey;
  const normalizedTitle = item.title.trim().toLowerCase();
  if (normalizedTitle) return `title:${normalizedTitle}:${dateKey || 'day'}`;
  return item.groupKey || item.sourceRef || item.id;
};

const toQuestState = (items: NormalizedLogItem[], now: number, taskStatus?: Task['status']): QuestRowState => {
  if (taskStatus === 'active') return 'active';
  if (taskStatus === 'done') return 'done';
  if (taskStatus === 'dropped') return 'failed';

  const derivedStates = items.map<QuestRowState>((item) => {
    if (item.status === 'scheduled') {
      const startAt = item.startAt || 0;
      return startAt >= now ? 'scheduled' : 'todo';
    }
    return NORMALIZED_STATUS_TO_QUEST_STATE[item.status];
  });

  if (derivedStates.length === 0) return 'todo';

  return derivedStates.reduce<QuestRowState>((current, candidate) =>
    QUEST_STATE_PRIORITY[candidate] > QUEST_STATE_PRIORITY[current] ? candidate : current
  );
};

const getPrimaryTime = (items: NormalizedLogItem[], now: number): { value?: number; inferred: boolean } => {
  const futureScheduledTimes = items
    .filter((item) => item.status === 'scheduled' && Number.isFinite(item.startAt) && (item.startAt || 0) >= now)
    .map((item) => item.startAt as number)
    .sort((a, b) => a - b);
  if (futureScheduledTimes.length > 0) return { value: futureScheduledTimes[0], inferred: false };
  const latestTrackedTime =
    items
    .map((item) => (Number.isFinite(item.startAt) ? (item.startAt as number) : 0))
    .reduce((latest, ts) => (ts > latest ? ts : latest), 0) || undefined;
  if (latestTrackedTime) return { value: latestTrackedTime, inferred: false };
  return { value: undefined, inferred: true };
};

const normalizeDayItemsToTaskCards = (
  items: NormalizedLogItem[],
  tab: TaskCardTab,
  now: number,
  dateKey: string,
  tasks: Task[]
): DayConsoleRow[] => {
  const filtered = filterTaskCardItems(items, tab, now);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const grouped = new Map<string, NormalizedLogItem[]>();
  for (const item of filtered) {
    const key = getQuestRowKey(item, dateKey);
    const existing = grouped.get(key) || [];
    existing.push(item);
    grouped.set(key, existing);
  }

  const sortDirection = tab === 'scheduled' ? 1 : -1;

  return Array.from(grouped.entries())
    .map(([key, groupItems]) => {
      const sorted = [...groupItems].sort((a, b) => (b.startAt || 0) - (a.startAt || 0));
      const head = sorted[0];
      const headTask = head?.taskId ? taskById.get(head.taskId) : undefined;
      const taskStatus = headTask?.status;
      const primaryTime = getPrimaryTime(sorted, now);
      const taskTitle = headTask?.title?.trim() ?? '';
      const itemTitle = (head?.title ?? '').trim();
      return {
        key,
        title: taskTitle || itemTitle || 'Untitled',
        state: toQuestState(sorted, now, taskStatus),
        primaryTime: primaryTime.value,
        inferredTime: primaryTime.inferred,
        groupKey: head?.groupKey,
        taskId: head?.taskId,
        items: sorted,
      } satisfies DayConsoleRow;
    })
    .sort((a, b) => ((a.primaryTime || 0) - (b.primaryTime || 0)) * sortDirection);
};

const getQuestStateMeta = (state: QuestRowState): QuestStateMeta => QUEST_STATE_META[state];

const dotColorByQuestState = (state: QuestRowState) => getQuestStateMeta(state).dotFill;

const dotBorderByQuestState = (state: QuestRowState) => getQuestStateMeta(state).dotBorder;

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
      return 'TO DO';
    case 'tracked':
    default:
      return 'TRACKED';
  }
};

const toQuestStateBadge = (state: QuestRowState) => getQuestStateMeta(state).label;

const toPanelSubtitle = (item: NormalizedLogItem) => {
  if (item.subtitle) return item.subtitle;
  if (item.status === 'done') {
    return item.durationMin && item.durationMin > 0 ? `${item.durationMin}m tracked` : 'No time logged';
  }
  if (item.status === 'scheduled') {
    return 'Scheduled';
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

const clampTimelineX = (xPct: number) => Math.max(7, Math.min(93, xPct));

export const LogCalendar: React.FC = () => {
  const {
    tasks,
    deleteTaskCompletely,
    startSession,
    stopSession,
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [highlightedPanelKey, setHighlightedPanelKey] = useState<string | null>(null);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [mobileConsoleOpen, setMobileConsoleOpen] = useState(false);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [deleteConfirmState, setDeleteConfirmState] = useState<DeleteConfirmState | null>(null);
  const [hoveredDotId, setHoveredDotId] = useState<string | null>(null);
  const [legendFilterStates, setLegendFilterStates] = useState<QuestRowState[]>([]);
  const dayConsoleListRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const timelineChartRef = useRef<HTMLDivElement>(null);
  const [timelineChartWidth, setTimelineChartWidth] = useState(0);

  const todayKey = toDateKey(new Date(now));
  const selectedDate = fromDateKey(selectedKey);
  const hasRunning = useMemo(() => !!selectors.getActiveSession(), [selectors]);
  const activeSession = useMemo(() => selectors.getActiveSession(), [selectors]);

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

  useEffect(() => {
    const el = timelineChartRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setTimelineChartWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const dayConsoleRows = useMemo(
    () => normalizeDayItemsToTaskCards(normalized, sidePanelTab, now, selectedKey, ensureArray(tasks)),
    [normalized, sidePanelTab, now, selectedKey, tasks]
  );
  const sidePanelTabCounts = useMemo<Record<SidePanelTab, number>>(() => {
    const safeTasks = ensureArray(tasks);
    return {
      timeline: normalizeDayItemsToTaskCards(normalized, 'timeline', now, selectedKey, safeTasks).length,
      unfinished: normalizeDayItemsToTaskCards(normalized, 'unfinished', now, selectedKey, safeTasks).length,
      completed: normalizeDayItemsToTaskCards(normalized, 'completed', now, selectedKey, safeTasks).length,
      scheduled: normalizeDayItemsToTaskCards(normalized, 'scheduled', now, selectedKey, safeTasks).length,
    };
  }, [normalized, now, selectedKey, tasks]);
  const fullHistoryRows = useMemo(
    () => normalizeDayItemsToTaskCards(normalized, 'all', now, selectedKey, ensureArray(tasks)),
    [normalized, now, selectedKey, tasks]
  );
  const timelineRows = dayConsoleRows;
  const stateCountByLegend = useMemo(() => {
    const counts: Record<QuestRowState, number> = {
      active: 0,
      done: 0,
      todo: 0,
      scheduled: 0,
      failed: 0,
    };
    timelineRows.forEach((row) => {
      counts[row.state] += 1;
    });
    return counts;
  }, [timelineRows]);
  const timelineDots = useMemo(() => {
    const dayStart = fromDateKey(selectedKey).getTime();
    const dayEnd = dayStart + 86400000;
    const stackByHour = new Map<number, number>();
    return timelineRows.map((row, index) => {
      const safeTime = row.primaryTime
        ? Math.min(Math.max(row.primaryTime, dayStart), dayEnd - 1)
        : dayStart + index * 60000;
      const minute = Math.max(0, Math.floor((safeTime - dayStart) / 60000));
      const hour = Math.max(0, Math.min(23, Math.floor(minute / 60)));
      const stackIndex = stackByHour.get(hour) || 0;
      stackByHour.set(hour, stackIndex + 1);
      const laneDotTop = Math.max(24, TIMELINE_BASELINE_Y - stackIndex * 24);
      return {
        id: row.key,
        title: row.title,
        status: row.state,
        rowKey: row.key,
        rowTaskId: row.taskId,
        time: safeTime,
        xPct: (minute / 1439) * 100,
        laneDotTop,
        stackIndex,
        inferred: row.inferredTime,
      };
    });
  }, [timelineRows, selectedKey]);
  const visibleTimelineDots = useMemo(
    () =>
      legendFilterStates.length === 0
        ? timelineDots
        : timelineDots.filter((dot) => legendFilterStates.includes(dot.status)),
    [timelineDots, legendFilterStates]
  );
  const firstDotByRowKey = useMemo(() => {
    const map = new Map<string, string>();
    visibleTimelineDots.forEach((dot) => {
      if (!map.has(dot.rowKey)) map.set(dot.rowKey, dot.id);
    });
    return map;
  }, [visibleTimelineDots]);
  const hoveredDot = useMemo(
    () => (hoveredDotId ? visibleTimelineDots.find((dot) => dot.id === hoveredDotId) || null : null),
    [visibleTimelineDots, hoveredDotId]
  );
  const nowMarkerX = useMemo(() => {
    if (selectedKey !== todayKey) return null;
    const nowDate = new Date(now);
    const minutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    return (minutes / 1439) * 100;
  }, [selectedKey, todayKey, now]);

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

  const toggleLegendState = useCallback((state: QuestRowState) => {
    setLegendFilterStates((current) =>
      current.includes(state) ? current.filter((value) => value !== state) : [...current, state]
    );
  }, []);

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

  const scrollPanelRowIntoView = useCallback((rowKey: string) => {
    const panelRow = rowRefs.current[rowKey] || document.getElementById(`day-console-row-${rowKey}`);
    if (!panelRow) return;
    const container = dayConsoleListRef.current;
    if (!container || !container.contains(panelRow)) {
      panelRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const rowRect = panelRow.getBoundingClientRect();
    const isAbove = rowRect.top < containerRect.top + 8;
    const isBelow = rowRect.bottom > containerRect.bottom - 8;
    if (!isAbove && !isBelow) return;

    const nextTop = panelRow.offsetTop - container.offsetTop - 8;
    container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  }, []);

  const handlePanelItemClick = useCallback(
    (item: NormalizedLogItem) => {
      const panelKey = getQuestRowKey(item, selectedKey);
      setExpandedId(panelKey);
      setHighlightedPanelKey(panelKey);
      window.setTimeout(() => {
        setHighlightedPanelKey((prev) => (prev === panelKey ? null : prev));
      }, 1400);
      scrollPanelRowIntoView(panelKey);

      if (historyModalOpen) jumpToGroup(item);
    },
    [jumpToGroup, historyModalOpen, selectedKey, scrollPanelRowIntoView]
  );

  const handlePanelRowToggle = useCallback(
    (row: DayConsoleRow) => {
      const nextExpanded = expandedId === row.key ? null : row.key;
      setExpandedId(nextExpanded);
      setHighlightedPanelKey(row.key);
      window.setTimeout(() => {
        setHighlightedPanelKey((prev) => (prev === row.key ? null : prev));
      }, 1400);
      scrollPanelRowIntoView(row.key);

      const headItem = row.items[0];
      if (headItem && historyModalOpen) {
        jumpToGroup(headItem);
      }
    },
    [expandedId, historyModalOpen, jumpToGroup, scrollPanelRowIntoView]
  );

  const handleTimelineDotClick = useCallback(
    (rowKey: string) => {
      const row = timelineRows.find((candidate) => candidate.key === rowKey);
      if (!row) return;
      setExpandedId(row.key);
      setHighlightedPanelKey(row.key);
      window.setTimeout(() => {
        setHighlightedPanelKey((prev) => (prev === row.key ? null : prev));
      }, 1400);
      scrollPanelRowIntoView(row.key);

      const headItem = row.items[0];
      if (headItem && historyModalOpen) {
        jumpToGroup(headItem);
      }
    },
    [timelineRows, historyModalOpen, jumpToGroup, scrollPanelRowIntoView]
  );

  const openDeleteConfirm = useCallback((next: DeleteConfirmState) => {
    setDeleteConfirmState(next);
  }, []);

  const confirmDeleteTask = useCallback(() => {
    if (!deleteConfirmState) return;
    deleteTaskCompletely(deleteConfirmState.taskId);
    if (deleteConfirmState.collapsePanelRowKey) {
      setExpandedId((prev) => (prev === deleteConfirmState.collapsePanelRowKey ? null : prev));
    }
    if (deleteConfirmState.collapseHistoryRowKey) {
      setExpandedGroupKey((prev) => (prev === deleteConfirmState.collapseHistoryRowKey ? null : prev));
    }
    setDeleteConfirmState(null);
  }, [deleteConfirmState, deleteTaskCompletely]);

  const focusAdjacentPanelRow = useCallback((currentKey: string, step: -1 | 1) => {
    const rowButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-day-console-row-button="true"]')
    );
    const currentIndex = rowButtons.findIndex((button) => button.dataset.rowKey === currentKey);
    if (currentIndex === -1) return;
    const nextIndex = Math.max(0, Math.min(rowButtons.length - 1, currentIndex + step));
    rowButtons[nextIndex]?.focus();
  }, []);

  const renderCompactItemList = (mobile = false) => (
    <div
      ref={dayConsoleListRef}
      className={`xt-scroll ${mobile ? 'max-h-[58dvh]' : 'max-h-[45vh] min-h-[240px]'} overflow-y-auto overscroll-contain pr-1 space-y-2`}
    >
      {dayConsoleRows.length === 0 ? (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] p-3 text-[11px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
          No items for this tab.
        </div>
      ) : (
        dayConsoleRows.map((row) => {
          const isSelected = expandedId === row.key;
          const isStartable = !!row.taskId && (row.state === 'scheduled' || row.state === 'failed' || row.state === 'todo');
          const isThisRowRunning = row.state === 'active';
          const stateMeta = getQuestStateMeta(row.state);
          const displayTitle = isThisRowRunning
            ? (row.title?.trim() || activeSession?.title?.trim() || 'Active session')
            : (row.title || 'Untitled');
          return (
            <div
              key={row.key}
              id={`day-console-row-${row.key}`}
              ref={(node) => {
                rowRefs.current[row.key] = node;
              }}
              className={`rounded-lg border overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                highlightedPanelKey === row.key || isSelected
                  ? 'border-[color-mix(in_srgb,var(--app-accent)_60%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))]'
                  : 'border-[color-mix(in_srgb,var(--app-text)_6%,transparent)] bg-[var(--app-panel)]'
              }`}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    handlePanelRowToggle(row);
                  }}
                  onMouseEnter={() => {
                    setHighlightedPanelKey(row.key);
                    const dotId = firstDotByRowKey.get(row.key);
                    if (dotId) setHoveredDotId(dotId);
                  }}
                  onMouseLeave={() => {
                    setHoveredDotId((prev) => {
                      if (!prev) return prev;
                      const dotId = firstDotByRowKey.get(row.key);
                      return prev === dotId ? null : prev;
                    });
                    setHighlightedPanelKey((prev) => (prev === row.key ? null : prev));
                  }}
                  onFocus={() => {
                    setHighlightedPanelKey(row.key);
                    const dotId = firstDotByRowKey.get(row.key);
                    if (dotId) setHoveredDotId(dotId);
                  }}
                  onBlur={() => {
                    setHoveredDotId((prev) => {
                      if (!prev) return prev;
                      const dotId = firstDotByRowKey.get(row.key);
                      return prev === dotId ? null : prev;
                    });
                    setHighlightedPanelKey((prev) => (prev === row.key ? null : prev));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      focusAdjacentPanelRow(row.key, 1);
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      focusAdjacentPanelRow(row.key, -1);
                    }
                  }}
                  data-day-console-row-button="true"
                  data-row-key={row.key}
                  aria-pressed={isSelected}
                  className="min-w-0 flex-1 pointer-events-auto cursor-pointer text-left transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--app-accent)_55%,transparent)] rounded"
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs uppercase tracking-[0.12em] text-[var(--app-text)] truncate">{displayTitle}</div>
                    </div>
                    <span
                      className="inline-flex justify-center rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] shrink-0"
                      style={{
                        width: DAY_ROW_STATUS_CHIP_WIDTH,
                        backgroundColor: stateMeta.chipBg,
                        color: stateMeta.chipText,
                      }}
                    >
                      {toQuestStateBadge(row.state)}
                    </span>
                    <span className="text-right text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)] shrink-0 tabular-nums font-mono" style={{ width: DAY_ROW_TIME_WIDTH }}>
                      {row.primaryTime ? `${row.inferredTime ? '~' : ''}${formatTime(row.primaryTime)}` : '--:--'}
                    </span>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {isThisRowRunning ? (
                    <button
                      type="button"
                      onClick={stopSession}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
                      title="Pause"
                      aria-label="Pause"
                    >
                      <Pause className="h-3.5 w-3.5" />
                    </button>
                  ) : isStartable ? (
                    <button
                      type="button"
                      onClick={() => startFromDayConsole(row)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
                      title="Start"
                      aria-label="Start"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {row.taskId ? (
                    <button
                      type="button"
                      onClick={() => {
                        openDeleteConfirm({
                          taskId: row.taskId,
                          title: row.title,
                          collapsePanelRowKey: row.key,
                        });
                        if (mobile) setMobileConsoleOpen(false);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
                      title="Delete"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
              {isSelected && row.items.length > 0 ? (
                <div className="border-t border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] px-3 pb-2 pt-1.5 space-y-0.5">
                  {row.items.map((entry) => (
                    <div
                      key={`${row.key}-signal-${entry.id}`}
                      className="flex items-center justify-between gap-2 rounded px-1 py-1"
                    >
                      <span className="min-w-0 truncate text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{toPanelSubtitle(entry)}</span>
                      <span className="shrink-0 font-mono tabular-nums text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{entry.startAt ? formatTime(entry.startAt) : '--:--'}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );

  const visibleHourLabels =
    timelineChartWidth > 0 && timelineChartWidth < 320 ? TIMELINE_LABELS_SPARSE : TIMELINE_LABELS_FULL;

  const renderTimelineChart = (mobile = false) => {
    const chartHeight = mobile ? 380 : 500;
    const chartInnerTop = 24;
    const chartInnerBottom = 78;
    const baselineTop = TIMELINE_BASELINE_Y;
    return (
      <div ref={mobile ? undefined : timelineChartRef} className={`rounded-xl bg-[color-mix(in_srgb,var(--app-panel-2)_55%,var(--app-panel))] px-2 py-2 relative overflow-hidden`} style={{ height: chartHeight }}>
        <div className="absolute inset-x-4" style={{ top: chartInnerTop, bottom: chartInnerBottom }}>
          <div
            className="absolute inset-x-0 h-[2px] bg-[color-mix(in_srgb,var(--app-text)_18%,transparent)]"
            style={{ top: baselineTop }}
          />
          {nowMarkerX !== null ? (
            <div
              className="pointer-events-none absolute h-[4px] rounded-full"
              style={{
                left: 0,
                width: `${Math.max(0, nowMarkerX)}%`,
                top: baselineTop - 1,
                background:
                  'linear-gradient(90deg, color-mix(in_srgb,var(--app-accent)_28%,transparent) 0%, color-mix(in_srgb,var(--app-accent)_75%,#fff) 100%)',
                boxShadow: '0 0 10px color-mix(in_srgb,var(--app-accent)_45%,transparent)',
              }}
            >
              <span
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_88%,#fff)]"
                style={{
                  left: 0,
                  width: 8,
                  height: 8,
                  boxShadow: '0 0 6px color-mix(in_srgb,var(--app-accent)_55%,transparent)',
                }}
              />
              <span
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_90%,#fff)]"
                style={{
                  left: '100%',
                  width: 9,
                  height: 9,
                  boxShadow: '0 0 8px color-mix(in_srgb,var(--app-accent)_60%,transparent)',
                }}
              />
            </div>
          ) : null}
          {TIMELINE_HOUR_MARKERS.map((hour) => (
            <div
              key={`timeline-grid-${hour}`}
              className="absolute top-0 bottom-0 border-l border-[color-mix(in_srgb,var(--app-text)_9%,transparent)]"
              style={{ left: `${(hour / 24) * 100}%` }}
            />
          ))}
          {hoveredDot ? (
            <div
              className="pointer-events-none absolute top-0 bottom-0 border-l border-[color-mix(in_srgb,var(--app-text)_25%,transparent)]"
              style={{ left: `${hoveredDot.xPct}%` }}
            />
          ) : null}
          {nowMarkerX !== null ? (
            <div
              className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-[color-mix(in_srgb,var(--app-accent)_55%,transparent)]"
              style={{ left: `${nowMarkerX}%` }}
            >
              <span
                className="absolute -translate-x-1/2 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_82%,#fff)]"
                style={{
                  top: baselineTop - 5,
                  width: 10,
                  height: 10,
                  boxShadow: '0 0 0 4px color-mix(in_srgb,var(--app-accent)_18%,transparent), 0 0 10px color-mix(in_srgb,var(--app-accent)_55%,transparent)',
                }}
              />
              <span
                className="absolute -translate-x-1/2 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_42%,transparent)]"
                style={{
                  top: baselineTop - 3,
                  width: 28,
                  height: 6,
                  filter: 'blur(2px)',
                }}
              />
              <span className="absolute -top-4 -translate-x-1/2 rounded px-1 py-0.5 text-[8px] uppercase tracking-[0.12em] text-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))]">
                Now
              </span>
            </div>
          ) : null}
          {visibleTimelineDots.map((dot) => (
            <button
              key={`timeline-dot-${mobile ? 'mobile-' : ''}${dot.id}`}
              type="button"
              onClick={() => handleTimelineDotClick(dot.rowKey)}
              className={`absolute h-4 w-4 rounded-full border transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-110 hover:shadow-[0_0_0_4px_color-mix(in_srgb,var(--app-accent)_12%,transparent)] ${
                hoveredDotId === dot.id ? 'scale-125' : expandedId === dot.rowKey ? 'scale-110' : ''
              }`}
              style={{
                left: `${dot.xPct}%`,
                top: `${dot.laneDotTop}px`,
                transform: 'translateX(-50%)',
                backgroundColor:
                  dot.status === 'todo' || dot.status === 'scheduled' || dot.inferred
                    ? 'var(--app-panel)'
                    : dotColorByQuestState(dot.status),
                borderColor: dotBorderByQuestState(dot.status),
                borderStyle: dot.inferred ? 'dashed' : 'solid',
                boxShadow:
                  expandedId === dot.rowKey
                    ? '0 0 0 3px color-mix(in_srgb,var(--app-accent)_18%,transparent)'
                    : undefined,
              }}
              onMouseEnter={() => {
                setHoveredDotId(dot.id);
                setHighlightedPanelKey(dot.rowKey);
              }}
              onMouseLeave={() => {
                setHoveredDotId((prev) => (prev === dot.id ? null : prev));
                setHighlightedPanelKey((prev) =>
                  prev === dot.rowKey && expandedId !== dot.rowKey ? null : prev
                );
              }}
              onFocus={() => {
                setHoveredDotId(dot.id);
                setHighlightedPanelKey(dot.rowKey);
              }}
              onBlur={() => {
                setHoveredDotId((prev) => (prev === dot.id ? null : prev));
                setHighlightedPanelKey((prev) =>
                  prev === dot.rowKey && expandedId !== dot.rowKey ? null : prev
                );
              }}
              title={`${dot.title} · ${toQuestStateBadge(dot.status)} · ${formatTime(dot.time)}${dot.inferred ? ' · inferred' : ''}`}
              aria-label={`${dot.title} ${toQuestStateBadge(dot.status)} ${formatTime(dot.time)}${dot.inferred ? ' inferred' : ''}`}
            />
          ))}
          {visibleTimelineDots.length === 0 ? (
            <div className="absolute inset-0 grid place-items-center text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
              {legendFilterStates.length ? 'No dots for active legend filter.' : 'No items for this tab.'}
            </div>
          ) : null}
          {hoveredDot ? (
            <div
              className="pointer-events-none absolute z-10 rounded-md border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] bg-[var(--app-panel)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-text)]"
              style={{
                left: `${clampTimelineX(hoveredDot.xPct)}%`,
                top: `${Math.max(6, hoveredDot.laneDotTop - 30)}px`,
                transform: 'translateX(-50%)',
              }}
            >
              {hoveredDot.title} • {formatTime(hoveredDot.time)} • {toQuestStateBadge(hoveredDot.status)}
              {hoveredDot.inferred ? ' • inferred time' : ''}
            </div>
          ) : null}
        </div>
        <div className="absolute inset-x-4 bottom-6 text-[8px] uppercase tracking-[0.02em] text-[var(--app-muted)] tabular-nums font-mono">
          {(mobile ? TIMELINE_LABELS_SPARSE : visibleHourLabels).map((hour) => (
            <span
              key={`timeline-hour-${hour}`}
              className="absolute whitespace-nowrap"
              style={{
                left: `${(hour / 24) * 100}%`,
                transform: hour === 0 ? 'translateX(0)' : hour === 24 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {`${String(hour).padStart(2, '0')}:00`}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const dayConsole = (
    <div className="rounded-2xl bg-[var(--app-panel-2)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] bg-[var(--app-panel)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.26em] text-[var(--app-muted)]">Day Console</div>
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

      <div className="px-3 py-2 border-b border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] bg-[var(--app-panel)] flex gap-1 overflow-x-auto no-scrollbar">
        {SIDE_PANEL_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setSidePanelTab(tab.value);
              setExpandedId(null);
              setLegendFilterStates([]);
            }}
            className={`px-2.5 py-1 rounded-md border text-[10px] uppercase tracking-[0.14em] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] whitespace-nowrap ${
              sidePanelTab === tab.value
                ? 'border-[color-mix(in_srgb,var(--app-accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] text-[var(--app-accent)]'
                : 'border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:text-[var(--app-text)] hover:-translate-y-[1px]'
            }`}
          >
            {tab.label} ({sidePanelTabCounts[tab.value]})
          </button>
        ))}
      </div>

      <div className="p-3">
        <div className="hidden lg:block space-y-3">
          <div className="px-1 py-1">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">{activeTabLabel} • 24h timeline</div>
              <button
                type="button"
                onClick={() => setTimelineExpanded(true)}
                className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
              >
                Expand
              </button>
            </div>
            {renderTimelineChart()}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
              {QUEST_STATE_LEGEND.map((entry) => (
                <button
                  key={`legend-desktop-${entry.state}`}
                  type="button"
                  onClick={() => toggleLegendState(entry.state)}
                  className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors ${
                    legendFilterStates.includes(entry.state)
                      ? 'bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] text-[var(--app-text)]'
                      : ''
                  }`}
                  title={entry.note ? `${entry.label} (${entry.note})` : entry.label}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full border"
                    style={{
                      backgroundColor:
                        entry.state === 'todo' || entry.state === 'scheduled'
                          ? 'var(--app-panel)'
                          : dotColorByQuestState(entry.state),
                      borderColor: dotBorderByQuestState(entry.state),
                    }}
                  />
                  {entry.label} ({stateCountByLegend[entry.state]})
                </button>
              ))}
              <button
                type="button"
                onClick={() => setLegendFilterStates([])}
                className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="relative z-10 p-0.5">
            {renderCompactItemList()}
          </div>
        </div>

        <div className="lg:hidden space-y-2">
          <div className="p-1.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">{activeTabLabel} • 24h timeline</div>
              <button
                type="button"
                onClick={() => setTimelineExpanded(true)}
                className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]"
              >
                Expand
              </button>
            </div>
            {renderTimelineChart(true)}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
              {QUEST_STATE_LEGEND.map((entry) => (
                <button
                  key={`legend-mobile-${entry.state}`}
                  type="button"
                  onClick={() => toggleLegendState(entry.state)}
                  className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors ${
                    legendFilterStates.includes(entry.state)
                      ? 'bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] text-[var(--app-text)]'
                      : ''
                  }`}
                  title={entry.note ? `${entry.label} (${entry.note})` : entry.label}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full border"
                    style={{
                      backgroundColor:
                        entry.state === 'todo' || entry.state === 'scheduled'
                          ? 'var(--app-panel)'
                          : dotColorByQuestState(entry.state),
                      borderColor: dotBorderByQuestState(entry.state),
                    }}
                  />
                  {entry.label} ({stateCountByLegend[entry.state]})
                </button>
              ))}
              <button
                type="button"
                onClick={() => setLegendFilterStates([])}
                className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
              >
                Clear
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileConsoleOpen(true)}
            className="w-full px-3 py-2 rounded-lg border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))] text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]"
          >
            Open {activeTabLabel} ({sidePanelTabCounts[sidePanelTab]})
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col text-[var(--app-text)]">
      {import.meta.env.DEV ? (
        <div className="shrink-0 mb-3 rounded-md border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))] px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
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
      <div className="flex-1 overflow-y-auto xt-scroll">
      <div className="space-y-4">
        <div className="flex justify-center lg:justify-end">
          <DayTimeOrb size={552} showLiveLabel={selectedKey !== todayKey} />
        </div>

        <div className="rounded-2xl bg-[var(--app-panel-2)] p-4">
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

        <div className="rounded-2xl bg-[var(--app-panel-2)] p-4">
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

        <div className="rounded-2xl bg-[var(--app-panel-2)] p-4">
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
                  <div key={task.id} className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_6%,transparent)] bg-[var(--app-panel)] px-3 py-2">
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

            {fullHistoryRows.length === 0 ? (
              <div className="text-sm text-[var(--app-muted)]">No activity found on this date.</div>
            ) : (
              <div className="xt-scroll space-y-2 max-h-[70dvh] overflow-y-auto pr-1">
                {fullHistoryRows.map((row) => {
                  const isExpanded = expandedGroupKey === row.key;
                  const isHighlighted = highlightedGroupKey === row.key;
                  const stateMeta = getQuestStateMeta(row.state);
                  const isThisHistRowRunning = row.state === 'active';
                  const histDisplayTitle = isThisHistRowRunning
                    ? (row.title?.trim() || activeSession?.title?.trim() || 'Active session')
                    : (row.title || 'Untitled');
                  return (
                    <div
                      id={`day-history-group-${row.key}`}
                      key={row.key}
                      className={`rounded-lg border transition-colors overflow-hidden ${
                        isHighlighted
                          ? 'border-[color-mix(in_srgb,var(--app-accent)_65%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel-2))]'
                          : 'border-[color-mix(in_srgb,var(--app-text)_6%,transparent)] bg-[var(--app-panel)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedGroupKey((prev) => (prev === row.key ? null : row.key))}
                        className="w-full text-left px-3 py-2.5 hover:bg-[color-mix(in_srgb,var(--app-accent)_9%,var(--app-panel))]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1 text-sm font-normal text-[var(--app-text)] truncate">{histDisplayTitle}</div>
                          <span
                            className="inline-flex justify-center rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] shrink-0"
                            style={{
                              width: DAY_ROW_STATUS_CHIP_WIDTH,
                              backgroundColor: stateMeta.chipBg,
                              color: stateMeta.chipText,
                            }}
                          >
                            {toQuestStateBadge(row.state)}
                          </span>
                          <span className="text-right text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)] shrink-0 tabular-nums font-mono" style={{ width: DAY_ROW_TIME_WIDTH }}>
                            {row.primaryTime ? `${row.inferredTime ? '~' : ''}${formatTime(row.primaryTime)}` : '--:--'}
                          </span>
                        </div>
                      </button>
                      {isExpanded ? (
                        <div className="px-3 pb-2 pt-2 border-t border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] space-y-2">
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                            {row.items.map((entry) => {
                            return (
                              <button
                                type="button"
                                key={`${row.key}-${entry.id}`}
                                onClick={() => handlePanelItemClick(entry)}
                                className="w-full rounded border border-[color-mix(in_srgb,var(--app-text)_6%,transparent)] bg-[var(--app-panel-2)] px-2 py-1.5 text-left hover:border-[color-mix(in_srgb,var(--app-accent)_40%,transparent)]"
                              >
                                <div className="text-[11px] text-[var(--app-muted)] uppercase tracking-[0.14em] truncate">
                                  {toPanelSubtitle(entry)} · {entry.startAt ? formatTime(entry.startAt) : '--:--'}
                                </div>
                              </button>
                            );
                            })}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 justify-end">
                            {row.taskId ? (
                              isThisHistRowRunning ? (
                                <button
                                  type="button"
                                  onClick={stopSession}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
                                  title="Pause"
                                  aria-label="Pause"
                                >
                                  <Pause className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    startSession({
                                      title: row.title,
                                      tag: 'calendar',
                                      source: 'timer',
                                      linkedTaskIds: [row.taskId],
                                    })
                                  }
                                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
                                  title="Start"
                                  aria-label="Start"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </button>
                              )
                            ) : null}
                            {row.taskId ? (
                              <button
                                type="button"
                                onClick={() => {
                                  openDeleteConfirm({
                                    taskId: row.taskId,
                                    title: row.title,
                                    collapseHistoryRowKey: row.key,
                                  });
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
                                title="Delete quest and all linked activity"
                                aria-label="Delete quest"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
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
            <div className="h-[520px] rounded-lg bg-[var(--app-panel)] px-4 py-4 relative overflow-hidden">
              <div className="absolute inset-x-4 top-4 bottom-[4.5rem]">
                <div className="absolute inset-x-0 h-[2px] bg-[color-mix(in_srgb,var(--app-text)_18%,transparent)]" style={{ top: TIMELINE_BASELINE_Y }} />
                {nowMarkerX !== null ? (
                  <div
                    className="pointer-events-none absolute h-[4px] rounded-full"
                    style={{
                      left: 0,
                      width: `${Math.max(0, nowMarkerX)}%`,
                      top: TIMELINE_BASELINE_Y - 1,
                      background:
                        'linear-gradient(90deg, color-mix(in_srgb,var(--app-accent)_28%,transparent) 0%, color-mix(in_srgb,var(--app-accent)_75%,#fff) 100%)',
                      boxShadow: '0 0 10px color-mix(in_srgb,var(--app-accent)_45%,transparent)',
                    }}
                  >
                    <span
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_88%,#fff)]"
                      style={{
                        left: 0,
                        width: 8,
                        height: 8,
                        boxShadow: '0 0 6px color-mix(in_srgb,var(--app-accent)_55%,transparent)',
                      }}
                    />
                    <span
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_90%,#fff)]"
                      style={{
                        left: '100%',
                        width: 9,
                        height: 9,
                        boxShadow: '0 0 8px color-mix(in_srgb,var(--app-accent)_60%,transparent)',
                      }}
                    />
                  </div>
                ) : null}
                {TIMELINE_HOUR_MARKERS.map((hour) => (
                  <div
                    key={`timeline-expanded-grid-${hour}`}
                    className="absolute top-0 bottom-0 border-l border-[color-mix(in_srgb,var(--app-text)_9%,transparent)]"
                    style={{ left: `${(hour / 24) * 100}%` }}
                  />
                ))}
                {nowMarkerX !== null ? (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-[color-mix(in_srgb,var(--app-accent)_55%,transparent)]"
                    style={{ left: `${nowMarkerX}%` }}
                  >
                    <span
                      className="absolute -translate-x-1/2 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_82%,#fff)]"
                      style={{
                        top: TIMELINE_BASELINE_Y - 5,
                        width: 10,
                        height: 10,
                        boxShadow: '0 0 0 4px color-mix(in_srgb,var(--app-accent)_18%,transparent), 0 0 10px color-mix(in_srgb,var(--app-accent)_55%,transparent)',
                      }}
                    />
                    <span className="absolute -top-4 -translate-x-1/2 rounded px-1 py-0.5 text-[8px] uppercase tracking-[0.12em] text-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))]">
                      Now
                    </span>
                  </div>
                ) : null}
                {visibleTimelineDots.map((dot, index) => (
                  <button
                    key={`timeline-expanded-${dot.id}-${index}`}
                    type="button"
                    onClick={() => handleTimelineDotClick(dot.rowKey)}
                    className="absolute h-4 w-4 rounded-full border border-[color-mix(in_srgb,var(--app-text)_24%,transparent)]"
                    style={{
                      left: `${dot.xPct}%`,
                      top: `${dot.laneDotTop}px`,
                      transform: 'translateX(-50%)',
                      backgroundColor:
                        dot.status === 'todo' || dot.status === 'scheduled' || dot.inferred
                          ? 'var(--app-panel)'
                          : dotColorByQuestState(dot.status),
                      borderColor: dotBorderByQuestState(dot.status),
                      borderStyle: dot.inferred ? 'dashed' : 'solid',
                      boxShadow:
                        expandedId === dot.rowKey
                          ? '0 0 0 3px color-mix(in_srgb,var(--app-accent)_18%,transparent)'
                          : undefined,
                    }}
                    onMouseEnter={() => {
                      setHoveredDotId(dot.id);
                      setHighlightedPanelKey(dot.rowKey);
                    }}
                    onMouseLeave={() => {
                      setHoveredDotId((prev) => (prev === dot.id ? null : prev));
                      setHighlightedPanelKey((prev) =>
                        prev === dot.rowKey && expandedId !== dot.rowKey ? null : prev
                      );
                    }}
                    title={`${dot.title} · ${toQuestStateBadge(dot.status)} · ${formatTime(dot.time)}${dot.inferred ? ' · inferred' : ''}`}
                  />
                ))}
              </div>
              <div className="absolute inset-x-4 bottom-6 text-[8px] uppercase tracking-[0.02em] text-[var(--app-muted)] tabular-nums font-mono">
                {TIMELINE_LABELS_FULL.map((hour) => (
                  <span
                    key={`timeline-expanded-hour-${hour}`}
                    className="absolute whitespace-nowrap"
                    style={{
                      left: `${(hour / 24) * 100}%`,
                      transform: hour === 0 ? 'translateX(0)' : hour === 24 ? 'translateX(-100%)' : 'translateX(-50%)',
                    }}
                  >
                    {`${String(hour).padStart(2, '0')}:00`}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
              {QUEST_STATE_LEGEND.map((entry) => (
                <button
                  key={`legend-expanded-${entry.state}`}
                  type="button"
                  onClick={() => toggleLegendState(entry.state)}
                  className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors ${
                    legendFilterStates.includes(entry.state)
                      ? 'bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] text-[var(--app-text)]'
                      : ''
                  }`}
                  title={entry.note ? `${entry.label} (${entry.note})` : entry.label}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full border"
                    style={{
                      backgroundColor:
                        entry.state === 'todo' || entry.state === 'scheduled'
                          ? 'var(--app-panel)'
                          : dotColorByQuestState(entry.state),
                      borderColor: dotBorderByQuestState(entry.state),
                    }}
                    />
                  {entry.label} ({stateCountByLegend[entry.state]})
                </button>
              ))}
              <button
                type="button"
                onClick={() => setLegendFilterStates([])}
                className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
              >
                Clear
              </button>
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

      <ConfirmModal
        open={!!deleteConfirmState}
        title="Delete Quest"
        message={
          deleteConfirmState
            ? `Delete "${deleteConfirmState.title}" and all linked activity for this day?`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setDeleteConfirmState(null)}
        onConfirm={confirmDeleteTask}
      />
      </div>
    </div>
  );
};
