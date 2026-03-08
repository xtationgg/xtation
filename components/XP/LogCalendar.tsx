import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useXP } from './xpStore';
import type { XPDayActivityItem, XPDayActivityGroup, Task } from './xpTypes';
import { ConfirmModal } from '../UI/ConfirmModal';
import { DayTimeOrb } from './DayTimeOrb';
import { QuestDetailPanel } from '../Play/QuestDetailPanel';
import { Check, ChevronLeft, ChevronRight, Info, Pause, Pencil, Play, Plus, Trash2, Undo2 } from 'lucide-react';

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
const TIMELINE_LABELS_SPARSE = [0, 6, 12, 18, 24] as const;
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
type TimelineStyle = 'pulse' | 'span';
type TimelineFilter = 'all' | 'active' | 'completed' | 'scheduled';

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
    dotFill: 'var(--state-active)',
    dotBorder: 'var(--state-active)',
    chipBg: 'color-mix(in_srgb,var(--state-active) 22%, var(--app-panel-2))',
    chipBorder: 'color-mix(in_srgb,var(--state-active) 38%, transparent)',
    chipText: 'var(--state-active)',
  },
  done: {
    label: 'Completed',
    dotFill: 'var(--state-done)',
    dotBorder: 'var(--state-done)',
    chipBg: 'color-mix(in_srgb,var(--state-done) 20%, var(--app-panel-2))',
    chipBorder: 'color-mix(in_srgb,var(--state-done) 36%, transparent)',
    chipText: 'var(--state-done)',
  },
  todo: {
    label: 'Unfinished',
    dotFill: 'var(--state-todo)',
    dotBorder: 'var(--state-todo)',
    chipBg: 'color-mix(in_srgb,var(--state-todo) 18%, var(--app-panel-2))',
    chipBorder: 'color-mix(in_srgb,var(--state-todo) 34%, transparent)',
    chipText: 'var(--state-todo-text)',
  },
  scheduled: {
    label: 'Scheduled',
    dotFill: 'var(--state-scheduled)',
    dotBorder: 'var(--state-scheduled)',
    chipBg: 'color-mix(in_srgb,var(--state-scheduled) 18%, var(--app-panel-2))',
    chipBorder: 'color-mix(in_srgb,var(--state-scheduled) 34%, transparent)',
    chipText: 'var(--state-scheduled-text)',
  },
  failed: {
    label: 'Failed',
    dotFill: 'var(--state-failed)',
    dotBorder: 'var(--state-failed)',
    chipBg: 'color-mix(in_srgb,var(--state-failed) 18%, var(--app-panel-2))',
    chipBorder: 'color-mix(in_srgb,var(--state-failed) 34%, transparent)',
    chipText: 'var(--state-failed-text)',
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
  selectedScheduledTasks: Task[]
): NormalizedLogItem[] => {
  const { start, end } = getDateBounds(dateKey);
  return selectedScheduledTasks
    .filter((task) => {
      const at = task.scheduledAt || 0;
      return at >= start && at < end;
    })
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
  const { dateKey, now, tasks, selectedActivity, selectedActivityGroups, selectedScheduledTasks } = params;
  return [
    ...mapTimelineEvents(selectedActivity, now),
    ...mapCompletedItems(selectedActivityGroups),
    ...mapScheduledItems(dateKey, selectedScheduledTasks),
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

const formatMinutes = (m: number): string => {
  if (m <= 0) return '—';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h > 0 && rem > 0) return `${h}h ${rem}m`;
  if (h > 0) return `${h}h`;
  return `${rem}m`;
};

const STEPS_BLOCK_RE = /\n?---\s*\n\[xstation_steps_v1\]\s*\n([\s\S]*?)\n---\s*$/;
const parseRowStepCounts = (details?: string): { total: number; done: number } | null => {
  if (!details) return null;
  const m = details.match(STEPS_BLOCK_RE);
  if (!m) return null;
  try {
    const steps = JSON.parse(m[1]?.trim())?.steps;
    if (!Array.isArray(steps) || !steps.length) return null;
    return { total: steps.length, done: steps.filter((s: { done?: boolean }) => s.done).length };
  } catch { return null; }
};

const formatShortDate = (dateKey: string) => {
  const d = fromDateKey(dateKey);
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
};

const daysBetweenKeys = (a: string, b: string) =>
  Math.round(Math.abs(fromDateKey(b).getTime() - fromDateKey(a).getTime()) / 86400000) + 1;

type ChallengeDraft = {
  name: string;
  badge: string;
  start: string | null;
  end: string | null;
  excluded: string[];
  goalType: 'daily' | 'count';
  goalTarget: number;
};

type ChallengeSaved = {
  name: string;
  badge: string;
  start: string;
  end: string;
  excluded: string[];
  goalType: 'daily' | 'count';
  goalTarget: number;
  timePreset?: 'anytime' | 'morning' | 'noon' | 'evening';
};

type ChallengeItem = ChallengeSaved & { id: string };
type ChallengeCompletionsMap = Record<string, string[]>;

const BADGE_OPTIONS = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Legend'] as const;

const expandDateRange = (start: string, end: string): string[] => {
  const days: string[] = [];
  const cursor = fromDateKey(start);
  const endDate = fromDateKey(end);
  while (cursor <= endDate) {
    days.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

let _challengeInitCache: { list: ChallengeItem[]; completions: ChallengeCompletionsMap } | null = null;
const getChallengeInit = (): { list: ChallengeItem[]; completions: ChallengeCompletionsMap } => {
  if (!_challengeInitCache) {
    try {
      const v2List = localStorage.getItem('xtation.challenge.list.v2');
      const v2Comps = localStorage.getItem('xtation.challenge.completions.v2');
      if (v2List) {
        _challengeInitCache = {
          list: JSON.parse(v2List) as ChallengeItem[],
          completions: v2Comps ? (JSON.parse(v2Comps) as ChallengeCompletionsMap) : {},
        };
      } else {
        const v1Saved = localStorage.getItem('xtation.challenge.saved.v1');
        if (v1Saved) {
          const saved = JSON.parse(v1Saved) as ChallengeSaved;
          const id = `ch_${Date.now()}`;
          const v1Comps = localStorage.getItem('xtation.challenge.completions.v1');
          const oldComps: string[] = v1Comps ? (JSON.parse(v1Comps) as string[]) : [];
          _challengeInitCache = { list: [{ ...saved, id }], completions: { [id]: oldComps } };
        } else {
          _challengeInitCache = { list: [], completions: {} };
        }
      }
    } catch { _challengeInitCache = { list: [], completions: {} }; }
  }
  return _challengeInitCache;
};

export const LogCalendar: React.FC = () => {
  const {
    now,
    tasks,
    deleteTaskCompletely,
    startSession,
    stopSession,
    addManualSession,
    selectors,
    activeLogDateKey,
    setActiveLogDateKey,
  } = useXP();

  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => activeLogDateKey || toDateKey(new Date()));
  const [rangeMode, setRangeMode] = useState<RangeMode>('month');
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('timeline');
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
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [legendFilterStates, setLegendFilterStates] = useState<QuestRowState[]>([]);
  const [timelineStyle, setTimelineStyle] = useState<TimelineStyle>('pulse');
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('all');
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [challengePickerOpen, setChallengePickerOpen] = useState(false);
  const [pickerEditId, setPickerEditId] = useState<string | null>(null);
  const [challengeList, setChallengeList] = useState<ChallengeItem[]>(() => getChallengeInit().list);
  const [challengeCompletions, setChallengeCompletions] = useState<ChallengeCompletionsMap>(() => getChallengeInit().completions);
  const [challengeDeleteTarget, setChallengeDeleteTarget] = useState<string | null>(null);
  const [pickerName, setPickerName] = useState('');
  const [pickerBadge, setPickerBadge] = useState('Bronze');
  const [pickerViewMonth, setPickerViewMonth] = useState(() => new Date());
  const [pickerStart, setPickerStart] = useState<string | null>(null);
  const [pickerEnd, setPickerEnd] = useState<string | null>(null);
  const [pickerExcluded, setPickerExcluded] = useState<string[]>([]);
  const [pickerGoalType, setPickerGoalType] = useState<'daily' | 'count'>('daily');
  const [pickerGoalTarget, setPickerGoalTarget] = useState(30);
  const [pickerTimePreset, setPickerTimePreset] = useState<'anytime' | 'morning' | 'noon' | 'evening'>('anytime');
  const [hudFilter, setHudFilter] = useState<'eligible' | 'all'>('eligible');
  const [hudTimeFilter, setHudTimeFilter] = useState<'all' | 'anytime' | 'morning' | 'noon' | 'evening'>('all');
  const [highlightedChallengeId, setHighlightedChallengeId] = useState<string | null>(null);
  const [pickerDragging, setPickerDragging] = useState(false);
  const pickerDragStartKeyRef = useRef<string | null>(null);
  const pickerDragMovedRef = useRef(false);
  const pickerNavCooldownRef = useRef(false);
  const dayConsoleListRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hudContainerRef = useRef<HTMLDivElement | null>(null);
  const hudRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const timelineChartRef = useRef<HTMLDivElement>(null);
  const [timelineChartWidth, setTimelineChartWidth] = useState(0);
  const [timelineChartHeight, setTimelineChartHeight] = useState(0);
  const [quickPopoverKey, setQuickPopoverKey] = useState<string | null>(null);
  const [qlTitle, setQlTitle] = useState('');
  const [qlMin, setQlMin] = useState('30');
  const gridSwipeStartX = useRef<number | null>(null);
  const gridSwipeMoved = useRef(false);

  const todayKey = toDateKey(new Date(now));
  const selectedDate = fromDateKey(selectedKey);
  const activeSession = useMemo(() => selectors.getActiveSession(), [selectors]);

  useEffect(() => {
    if (activeLogDateKey && activeLogDateKey !== selectedKey) {
      setSelectedKey(activeLogDateKey);
    }
  }, [activeLogDateKey, selectedKey]);

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
      setTimelineChartHeight(entries[0].contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem('xtation.challenge.list.v2', JSON.stringify(challengeList));
  }, [challengeList]);

  useEffect(() => {
    localStorage.setItem('xtation.challenge.completions.v2', JSON.stringify(challengeCompletions));
  }, [challengeCompletions]);

  useEffect(() => {
    if (!highlightedChallengeId) return;
    const timer = setTimeout(() => setHighlightedChallengeId(null), 1500);
    return () => clearTimeout(timer);
  }, [highlightedChallengeId]);

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

  const pickerGridDays = useMemo(() => {
    const start = monthGridStart(pickerViewMonth);
    return Array.from({ length: 42 }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      return { date, key: toDateKey(date), inMonth: date.getMonth() === pickerViewMonth.getMonth() };
    });
  }, [pickerViewMonth]);

  const pickerEffectiveStart = pickerStart && pickerEnd
    ? (pickerStart <= pickerEnd ? pickerStart : pickerEnd)
    : pickerStart || null;
  const pickerEffectiveEnd = pickerStart && pickerEnd
    ? (pickerStart <= pickerEnd ? pickerEnd : pickerStart)
    : null;
  const pickerDayCount = pickerEffectiveStart && pickerEffectiveEnd
    ? daysBetweenKeys(pickerEffectiveStart, pickerEffectiveEnd)
    : 0;

  const pickerExcludedSet = useMemo(() => new Set(pickerExcluded), [pickerExcluded]);
  const pickerFinalDayCount = pickerEffectiveStart && pickerEffectiveEnd
    ? pickerDayCount - pickerExcluded.filter(k => k > pickerEffectiveStart! && k < pickerEffectiveEnd!).length
    : 0;
  const primaryChallenge = challengeList[0] ?? null;
  const challengeMeta = useMemo(() => challengeList.map(ch => {
    const excSet = new Set(ch.excluded);
    const eligibleSet = new Set<string>();
    const cursor = fromDateKey(ch.start);
    const endDate = fromDateKey(ch.end);
    while (cursor <= endDate) {
      const k = toDateKey(cursor);
      if (!excSet.has(k)) eligibleSet.add(k);
      cursor.setDate(cursor.getDate() + 1);
    }
    const comps = challengeCompletions[ch.id] ?? [];
    const completionsSet = new Set(comps);
    const progress = comps.filter(k => eligibleSet.has(k)).length;
    const todayEligible = eligibleSet.has(todayKey);
    const todayDone = completionsSet.has(todayKey);
    const complete = progress >= ch.goalTarget;
    const selectedStatus: 'done' | 'not_done' | 'excluded' | 'out_of_range' = (() => {
      if (selectedKey < ch.start || selectedKey > ch.end) return 'out_of_range';
      if (!eligibleSet.has(selectedKey)) return 'excluded';
      return completionsSet.has(selectedKey) ? 'done' : 'not_done';
    })();
    const eligibleUpToToday = [...eligibleSet].filter(k => k <= todayKey).sort().reverse();
    let streak = 0;
    for (const k of eligibleUpToToday) {
      if (completionsSet.has(k)) streak++;
      else break;
    }
    return { id: ch.id, eligibleSet, completionsSet, progress, todayEligible, todayDone, complete, selectedStatus, streak };
  }), [challengeList, challengeCompletions, todayKey, selectedKey]);

  const miniTimelineDays = useMemo(() => {
    const days: string[] = [];
    const end = fromDateKey(selectedKey);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
      days.push(toDateKey(d));
    }
    return days;
  }, [selectedKey]);

  const getChallengeDayState = (dateKey: string): { inRange: boolean; excluded: boolean; done: boolean } => {
    if (!primaryChallenge || !challengeMeta[0]) return { inRange: false, excluded: false, done: false };
    const m = challengeMeta[0];
    const inDateRange = dateKey >= primaryChallenge.start && dateKey <= primaryChallenge.end;
    const inRange = inDateRange && m.eligibleSet.has(dateKey);
    const excluded = inDateRange && !m.eligibleSet.has(dateKey);
    const done = m.completionsSet.has(dateKey);
    return { inRange, excluded, done };
  };

  const getChallengeCountForDay = (dateKey: string): number =>
    challengeMeta.filter(m => m.eligibleSet.has(dateKey)).length;

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

  // Heat intensity per day: 0→no activity, 1→480+ minutes (8h)
  const xpIntensityByDay = useMemo(() => {
    const map = new Map<string, number>();
    gridKeys.forEach(key => {
      const s = selectors.getDaySummary(key, now) || EMPTY_DAY_SUMMARY;
      map.set(key, Math.min(1, s.minutesTracked / 480));
    });
    return map;
  }, [gridKeys, selectors, now]);

  // Per-day streak connector flags for the primary challenge
  const streakConnectorsByDay = useMemo(() => {
    const map = new Map<string, { left: boolean; right: boolean }>();
    if (!primaryChallenge || !challengeMeta[0]) return map;
    const m = challengeMeta[0];
    gridDays.forEach((day, idx) => {
      const isDone = m.completionsSet.has(day.key) && m.eligibleSet.has(day.key);
      if (!isDone) return;
      const prev = gridDays[idx - 1];
      const next = gridDays[idx + 1];
      map.set(day.key, {
        left: !!prev && m.completionsSet.has(prev.key) && m.eligibleSet.has(prev.key),
        right: !!next && m.completionsSet.has(next.key) && m.eligibleSet.has(next.key),
      });
    });
    return map;
  }, [primaryChallenge, challengeMeta, gridDays]);

  // Top tasks per day for month grid (computed once for all 42 cells)
  const topTasksByDay = useMemo(() => {
    const map = new Map<string, { title: string; minutes: number; running: boolean }[]>();
    gridDays.forEach(day => {
      const tops = selectors.getTopTasksForDay(day.key, 2, now);
      if (tops.length) map.set(day.key, tops);
    });
    return map;
  }, [gridDays, selectors, now]);

  // 52-week heat map grid for the year view
  const yearHeatMapWeeks = useMemo(() => {
    const year = selectedDate.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const mondayOffset = (jan1.getDay() + 6) % 7;
    const cursor = new Date(year, 0, 1 - mondayOffset);
    const weeks: Array<Array<{ key: string; date: Date; inYear: boolean }>> = [];
    while (true) {
      const week: Array<{ key: string; date: Date; inYear: boolean }> = [];
      for (let d = 0; d < 7; d++) {
        week.push({ key: toDateKey(cursor), date: new Date(cursor), inYear: cursor.getFullYear() === year });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
      if (cursor.getFullYear() > year) break;
    }
    return weeks;
  }, [selectedDate]);

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

  const taskByIdMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const computedBaselineY =
    timelineChartHeight > 0 ? Math.round(timelineChartHeight * 0.70) : TIMELINE_BASELINE_Y;

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
      const laneDotTop = Math.max(24, computedBaselineY - stackIndex * 24);
      const durationMin = row.items.reduce((acc, item) => acc + Math.max(0, item.durationMin || 0), 0);
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
        durationMin,
      };
    });
  }, [timelineRows, selectedKey, computedBaselineY]);
  const visibleTimelineDots = useMemo(
    () =>
      legendFilterStates.length === 0
        ? timelineDots
        : timelineDots.filter((dot) => legendFilterStates.includes(dot.status)),
    [timelineDots, legendFilterStates]
  );

  // Timeline mode filter — applied after legend filter, before clamping
  const TIMELINE_FILTER_STATES: Record<TimelineFilter, QuestRowState | null> = {
    all: null,
    active: 'active',
    completed: 'done',
    scheduled: 'scheduled',
  };
  const filteredByModeDots = useMemo(() => {
    const targetState = TIMELINE_FILTER_STATES[timelineFilter];
    if (!targetState) return visibleTimelineDots;
    return visibleTimelineDots.filter((dot) => dot.status === targetState);
  }, [visibleTimelineDots, timelineFilter]);

  const firstDotByRowKey = useMemo(() => {
    const map = new Map<string, string>();
    filteredByModeDots.forEach((dot) => {
      if (!map.has(dot.rowKey)) map.set(dot.rowKey, dot.id);
    });
    return map;
  }, [filteredByModeDots]);
  const hoveredDot = useMemo(
    () => (hoveredDotId ? filteredByModeDots.find((dot) => dot.id === hoveredDotId) || null : null),
    [filteredByModeDots, hoveredDotId]
  );
  const nowMarkerX = useMemo(() => {
    if (selectedKey !== todayKey) return null;
    const nowDate = new Date(now);
    const minutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    return (minutes / 1439) * 100;
  }, [selectedKey, todayKey, now]);

  const MAX_DOTS_PER_HOUR = 6;
  const { clampedDots, overflowBadges } = useMemo(() => {
    const hourBuckets = new Map<number, (typeof filteredByModeDots)[number][]>();
    for (const dot of filteredByModeDots) {
      const hour = Math.min(23, Math.floor((dot.xPct / 100) * 24));
      const bucket = hourBuckets.get(hour) ?? [];
      bucket.push(dot);
      hourBuckets.set(hour, bucket);
    }
    const clamped: typeof filteredByModeDots = [];
    const badges: Array<{ hour: number; count: number; xPct: number; topY: number }> = [];
    for (const [hour, dots] of hourBuckets) {
      if (dots.length <= MAX_DOTS_PER_HOUR) {
        clamped.push(...dots);
      } else {
        clamped.push(...dots.slice(0, MAX_DOTS_PER_HOUR));
        const topDot = dots[MAX_DOTS_PER_HOUR - 1];
        badges.push({
          hour,
          count: dots.length - MAX_DOTS_PER_HOUR,
          xPct: topDot.xPct,
          topY: Math.max(4, topDot.laneDotTop - 18),
        });
      }
    }
    return { clampedDots: clamped, overflowBadges: badges };
  }, [filteredByModeDots]);

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

  const handleGridPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    gridSwipeStartX.current = e.clientX;
    gridSwipeMoved.current = false;
  }, []);

  const handleGridPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (gridSwipeStartX.current === null) return;
    if (Math.abs(e.clientX - gridSwipeStartX.current) > 10) gridSwipeMoved.current = true;
  }, []);

  const handleGridPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (gridSwipeStartX.current === null) return;
    const dx = e.clientX - gridSwipeStartX.current;
    gridSwipeStartX.current = null;
    if (!gridSwipeMoved.current || Math.abs(dx) < 60) return;
    if (dx > 0) handlePrev(); else handleNext();
  }, [handlePrev, handleNext]);

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

  const handlePickerMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!pickerDragging || pickerNavCooldownRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < 48) {
      pickerNavCooldownRef.current = true;
      setPickerViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
      setTimeout(() => { pickerNavCooldownRef.current = false; }, 700);
    } else if (x > rect.width - 48) {
      pickerNavCooldownRef.current = true;
      setPickerViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
      setTimeout(() => { pickerNavCooldownRef.current = false; }, 700);
    }
  }, [pickerDragging]);

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

  const toggleChallengeDay = useCallback((id: string, dateKey: string) => {
    setChallengeCompletions(prev => {
      const existing = prev[id] ?? [];
      const next = existing.includes(dateKey)
        ? existing.filter(k => k !== dateKey)
        : [...existing, dateKey];
      return { ...prev, [id]: next };
    });
  }, []);

  const renderCompactItemList = (mobile = false) => {
    const selectedChallenges = challengeList.filter(ch => {
      const m = challengeMeta.find(meta => meta.id === ch.id);
      return m?.selectedStatus === 'done' || m?.selectedStatus === 'not_done';
    });
    return (
    <div
      ref={dayConsoleListRef}
      className={`xt-scroll ${mobile ? 'max-h-[58dvh]' : 'max-h-[45vh] min-h-[240px]'} overflow-y-auto overscroll-contain pr-1 space-y-2`}
    >
      {/* Challenge rows for selectedKey-eligible challenges */}
      {selectedChallenges.map(ch => {
        const meta = challengeMeta.find(m => m.id === ch.id)!;
        const isDone = meta.selectedStatus === 'done';
        return (
          <div
            key={`ch:${ch.id}`}
            className="rounded-lg border overflow-hidden border-[color-mix(in_srgb,var(--app-text)_6%,transparent)] bg-[var(--app-panel)]"
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              <button
                type="button"
                onClick={() => {
                  hudContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  setHighlightedChallengeId(ch.id);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[8px] uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--app-accent)_65%,var(--app-muted))] shrink-0">Challenge</span>
                      <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--app-text)] truncate">{ch.badge} · {ch.name || 'Challenge'}</span>
                      {(ch.timePreset && ch.timePreset !== 'anytime') && (
                        <span className="rounded px-1 py-0.5 text-[8px] uppercase tracking-[0.12em] bg-[color-mix(in_srgb,var(--app-text)_8%,transparent)] text-[var(--app-muted)] shrink-0">{ch.timePreset}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className="inline-flex justify-center rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] shrink-0 whitespace-nowrap"
                    style={{
                      width: DAY_ROW_STATUS_CHIP_WIDTH,
                      backgroundColor: isDone ? 'color-mix(in srgb, var(--app-accent) 22%, var(--app-panel))' : 'color-mix(in srgb, var(--app-text) 10%, transparent)',
                      color: isDone ? 'var(--app-accent)' : 'var(--app-muted)',
                    }}
                  >
                    {isDone ? 'Done' : 'Not done'}
                  </span>
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  title={isDone ? `Undo ${selectedKey}` : `Mark ${selectedKey} done`}
                  onClick={() => toggleChallengeDay(ch.id, selectedKey)}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded border transition-colors ${
                    isDone
                      ? 'border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] text-[var(--app-accent)] hover:border-[var(--app-accent)]'
                      : 'border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] text-[var(--app-accent)] hover:border-[var(--app-accent)]'
                  }`}
                >
                  {isDone ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {dayConsoleRows.length === 0 && selectedChallenges.length === 0 ? (
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
                highlightedPanelKey === row.key || isSelected || (row.taskId && row.taskId === hoveredTaskId)
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
                    setHoveredTaskId(row.taskId || null);
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
                    setHoveredTaskId((prev) => (prev === (row.taskId || null) ? null : prev));
                  }}
                  onFocus={() => {
                    setHighlightedPanelKey(row.key);
                    setHoveredTaskId(row.taskId || null);
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
                    setHoveredTaskId((prev) => (prev === (row.taskId || null) ? null : prev));
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
                      <div className="text-xs tracking-[0.04em] font-medium text-[var(--app-text)] truncate leading-snug">{displayTitle}</div>
                      {(() => {
                        const rowTask = row.taskId ? taskByIdMap.get(row.taskId) : undefined;
                        const steps = rowTask ? parseRowStepCounts(rowTask.details) : null;
                        const rowMin = row.items.reduce((acc, item) => acc + Math.max(0, item.durationMin || 0), 0);
                        if (steps) return steps.done > 0
                          ? <span className="text-[9px] tracking-[0.06em] text-[var(--app-muted)]">{steps.done}/{steps.total} steps</span>
                          : <span className="text-[9px] tracking-[0.06em] text-[var(--app-muted)]">{steps.total} steps</span>;
                        if (row.state === 'scheduled' && row.primaryTime) return <span className="text-[9px] tracking-[0.06em] text-[var(--app-muted)]">Scheduled {formatTime(row.primaryTime)}</span>;
                        if (rowMin > 0) return <span className="text-[9px] tracking-[0.06em] text-[var(--app-muted)]">{formatMinutes(rowMin)} tracked</span>;
                        return null;
                      })()}
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
                      onClick={(e) => { e.stopPropagation(); setDetailTaskId(row.taskId!); }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
                      title="Quest details"
                      aria-label="Quest details"
                    >
                      <Info className="h-3.5 w-3.5" />
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
                  {(() => {
                    const rowTotalMin = row.items.reduce((acc, item) => acc + Math.max(0, item.durationMin || 0), 0);
                    const rowTask = row.taskId ? taskByIdMap.get(row.taskId) : undefined;
                    const rowSteps = rowTask ? parseRowStepCounts(rowTask.details) : null;
                    if (!rowTotalMin && !rowSteps) return null;
                    return (
                      <div className="flex items-center gap-3 pb-1 text-[9px] text-[var(--app-muted)] uppercase tracking-[0.1em]">
                        {rowTotalMin > 0 && <span>{formatMinutes(rowTotalMin)} tracked</span>}
                        {rowSteps && rowSteps.done > 0 && (
                          <span className={rowSteps.done === rowSteps.total ? 'text-[#43d39e]' : ''}>
                            {rowSteps.done}/{rowSteps.total} steps
                          </span>
                        )}
                      </div>
                    );
                  })()}
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
  };

  const visibleHourLabels =
    timelineChartWidth > 0 && timelineChartWidth < 900 ? TIMELINE_LABELS_SPARSE : TIMELINE_LABELS_FULL;

  const renderTimelineChart = (mobile = false) => {
    const chartInnerTop = 24;
    const chartInnerBottom = 78;
    // For mobile the ref is not attached, so compute baseline from fixed height
    const MOBILE_CHART_H = 380;
    const baselineTop = mobile && timelineChartHeight === 0
      ? Math.round(MOBILE_CHART_H * 0.70)
      : computedBaselineY;

    // Duration (span) mode — greedy lane assignment to avoid bar overlap
    const BAR_H = 10;
    const LANE_STEP = 14;
    const MIN_BAR_PCT = 3; // ~9 px minimum on a typical 300 px chart
    const barsWithLanes = timelineStyle === 'span' ? (() => {
      const laneEnds: number[] = [];
      return [...filteredByModeDots]
        .sort((a, b) => a.xPct - b.xPct)
        .map((dot) => {
          // For running sessions with no recorded minutes yet, infer live duration
          const effectiveDuration = dot.durationMin === 0 && dot.status === 'active'
            ? Math.max(1, Math.floor((now - dot.time) / 60000))
            : dot.durationMin;
          const rawW = (effectiveDuration / 1440) * 100;
          const wPct = Math.min(100 - dot.xPct, Math.max(MIN_BAR_PCT, rawW));
          const endPct = dot.xPct + wPct;
          let lane = laneEnds.findIndex((e) => dot.xPct >= e + 0.1);
          if (lane === -1) lane = laneEnds.length;
          laneEnds[lane] = endPct;
          const barTop = Math.max(chartInnerTop + 4, baselineTop - BAR_H / 2 - lane * LANE_STEP);
          return { ...dot, wPct, barTop };
        });
    })() : [];
    const hoveredBarTop = timelineStyle === 'span'
      ? (barsWithLanes.find((b) => b.id === hoveredDotId)?.barTop ?? hoveredDot?.laneDotTop ?? 0)
      : (hoveredDot?.laneDotTop ?? 0);

    return (
      <div ref={mobile ? undefined : timelineChartRef} className={`rounded-xl bg-[color-mix(in_srgb,var(--app-panel-2)_55%,var(--app-panel))] px-2 py-2 relative overflow-hidden`} style={{ height: mobile ? 380 : 'clamp(320px, 45vh, 520px)' }}>
        {/* Instrument panel — anchored to chart top-right */}
        <div className="absolute top-2 right-2 z-10 flex items-center">
          <div className="flex rounded border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] bg-[color-mix(in_srgb,var(--app-panel-2)_85%,transparent)] p-0.5 gap-0.5">
            {(['pulse', 'duration'] as const).map((label) => {
              const styleVal = label === 'duration' ? 'span' : label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setTimelineStyle(styleVal as TimelineStyle)}
                  className={`inline-flex items-center rounded px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] transition-all duration-150 ${
                    timelineStyle === styleVal
                      ? 'bg-[var(--app-panel)] text-[var(--app-text)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--app-text)_10%,transparent)]'
                      : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
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
          {timelineStyle === 'span' ? barsWithLanes.map((bar) => (
            <button
              key={`timeline-bar-${mobile ? 'mob-' : ''}${bar.id}`}
              type="button"
              onClick={() => handleTimelineDotClick(bar.rowKey)}
              className={`absolute rounded-sm transition-opacity duration-150 ${
                hoveredDotId === bar.id ? 'opacity-100' : bar.rowTaskId && bar.rowTaskId === hoveredTaskId ? 'opacity-90' : 'opacity-60 hover:opacity-100'
              } ${expandedId === bar.rowKey || (bar.rowTaskId && bar.rowTaskId === hoveredTaskId) ? 'ring-1 ring-[color-mix(in_srgb,var(--app-accent)_50%,transparent)]' : ''}`}
              style={{
                left: `${bar.xPct}%`,
                width: `${bar.wPct}%`,
                top: bar.barTop,
                height: BAR_H,
                backgroundColor:
                  bar.status === 'todo' || bar.status === 'scheduled' || bar.inferred
                    ? 'color-mix(in_srgb,var(--app-panel-2) 90%,transparent)'
                    : `color-mix(in_srgb,${dotColorByQuestState(bar.status)} 55%,transparent)`,
                borderTop: `2px ${bar.inferred ? 'dashed' : 'solid'} ${dotBorderByQuestState(bar.status)}`,
                borderRadius: 3,
              }}
              onMouseEnter={() => { setHoveredDotId(bar.id); setHighlightedPanelKey(bar.rowKey); setHoveredTaskId(bar.rowTaskId || null); }}
              onMouseLeave={() => {
                setHoveredDotId((prev) => (prev === bar.id ? null : prev));
                setHighlightedPanelKey((prev) => prev === bar.rowKey && expandedId !== bar.rowKey ? null : prev);
                setHoveredTaskId((prev) => (prev === (bar.rowTaskId || null) ? null : prev));
              }}
              onFocus={() => { setHoveredDotId(bar.id); setHighlightedPanelKey(bar.rowKey); setHoveredTaskId(bar.rowTaskId || null); }}
              onBlur={() => {
                setHoveredDotId((prev) => (prev === bar.id ? null : prev));
                setHighlightedPanelKey((prev) => prev === bar.rowKey && expandedId !== bar.rowKey ? null : prev);
                setHoveredTaskId((prev) => (prev === (bar.rowTaskId || null) ? null : prev));
              }}
              title={`${bar.title} · ${toQuestStateBadge(bar.status)} · ${formatTime(bar.time)}${bar.inferred ? ' · inferred' : ''}`}
              aria-label={`${bar.title} ${toQuestStateBadge(bar.status)} ${formatTime(bar.time)}${bar.inferred ? ' inferred' : ''}`}
            />
          )) : clampedDots.map((dot) => (
            <button
              key={`timeline-dot-${mobile ? 'mobile-' : ''}${dot.id}`}
              type="button"
              onClick={() => handleTimelineDotClick(dot.rowKey)}
              className={`absolute h-4 w-4 rounded-full border transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-110 hover:shadow-[0_0_0_4px_color-mix(in_srgb,var(--app-accent)_12%,transparent)] ${
                hoveredDotId === dot.id
                  ? 'scale-125'
                  : dot.rowTaskId && dot.rowTaskId === hoveredTaskId
                  ? 'scale-110 ring-1 ring-[color-mix(in_srgb,var(--app-accent)_45%,transparent)]'
                  : expandedId === dot.rowKey
                  ? 'scale-110'
                  : ''
              }`}
              style={{
                left: `${dot.xPct}%`,
                // Remap laneDotTop when mobile baseline differs from computedBaselineY
                top: `${mobile && timelineChartHeight === 0 ? Math.max(24, baselineTop - dot.stackIndex * 24) : dot.laneDotTop}px`,
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
                setHoveredTaskId(dot.rowTaskId || null);
              }}
              onMouseLeave={() => {
                setHoveredDotId((prev) => (prev === dot.id ? null : prev));
                setHighlightedPanelKey((prev) =>
                  prev === dot.rowKey && expandedId !== dot.rowKey ? null : prev
                );
                setHoveredTaskId((prev) => (prev === (dot.rowTaskId || null) ? null : prev));
              }}
              onFocus={() => {
                setHoveredDotId(dot.id);
                setHighlightedPanelKey(dot.rowKey);
                setHoveredTaskId(dot.rowTaskId || null);
              }}
              onBlur={() => {
                setHoveredDotId((prev) => (prev === dot.id ? null : prev));
                setHighlightedPanelKey((prev) =>
                  prev === dot.rowKey && expandedId !== dot.rowKey ? null : prev
                );
                setHoveredTaskId((prev) => (prev === (dot.rowTaskId || null) ? null : prev));
              }}
              title={`${dot.title} · ${toQuestStateBadge(dot.status)} · ${formatTime(dot.time)}${dot.inferred ? ' · inferred' : ''}`}
              aria-label={`${dot.title} ${toQuestStateBadge(dot.status)} ${formatTime(dot.time)}${dot.inferred ? ' inferred' : ''}`}
            />
          ))}
          {timelineStyle === 'pulse' && overflowBadges.map((badge) => (
            <div
              key={`overflow-badge-${mobile ? 'mob-' : ''}${badge.hour}`}
              className="pointer-events-none absolute flex items-center justify-center rounded-full font-mono text-[var(--app-accent)]"
              style={{
                left: `${badge.xPct}%`,
                top: badge.topY,
                transform: 'translateX(-50%)',
                width: 22,
                height: 16,
                fontSize: 8,
                background: 'color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))',
                border: '1px solid color-mix(in_srgb,var(--app-accent)_40%,transparent)',
                boxShadow: '0 0 6px color-mix(in_srgb,var(--app-accent)_30%,transparent)',
              }}
            >
              +{badge.count}
            </div>
          ))}
          {filteredByModeDots.length === 0 && (legendFilterStates.length > 0 || timelineFilter !== 'all' || timelineStyle !== 'pulse') ? (
            <div className="absolute inset-0 grid place-items-center text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
              No items for active filter.
            </div>
          ) : null}
          {hoveredDot ? (() => {
            const hoveredRow = timelineRows.find((r) => r.key === hoveredDot.rowKey);
            const totalMin = hoveredRow?.items.reduce((acc, item) => acc + (item.durationMin || 0), 0) ?? 0;
            const stateMeta = getQuestStateMeta(hoveredDot.status);
            return (
              <div
                className="pointer-events-none absolute z-10 rounded-lg border border-[color-mix(in_srgb,var(--app-text)_16%,transparent)] bg-[var(--app-panel)] shadow-[0_8px_24px_rgba(0,0,0,0.45)] px-3 py-2 flex flex-col gap-1 min-w-[140px] max-w-[220px]"
                style={{
                  left: `${clampTimelineX(hoveredDot.xPct)}%`,
                  top: `${Math.max(6, hoveredBarTop - 72)}px`,
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="text-[10px] font-semibold text-[var(--app-text)] truncate leading-tight">
                  {hoveredDot.title}
                </div>
                <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                  <span
                    className="shrink-0 inline-flex items-center rounded px-1 py-0.5 text-[8px] tracking-[0.14em]"
                    style={{ background: stateMeta.chipBg, color: stateMeta.chipText, border: `1px solid ${stateMeta.chipBorder}` }}
                  >
                    {stateMeta.label}
                  </span>
                  <span>{formatTime(hoveredDot.time)}</span>
                  {totalMin > 0 && <span>{formatMinutes(totalMin)}</span>}
                </div>
                {hoveredDot.inferred && (
                  <div className="text-[8px] uppercase tracking-[0.1em] text-[var(--app-muted)] opacity-60">inferred time</div>
                )}
              </div>
            );
          })() : null}
        </div>
        <div className="absolute inset-x-4 bottom-6 text-[8px] uppercase tracking-[0.02em] text-[var(--app-muted)] tabular-nums font-mono">
          {(mobile ? TIMELINE_LABELS_SPARSE : visibleHourLabels).filter((hour) => hour < 24).map((hour) => (
            <span
              key={`timeline-hour-${hour}`}
              className="absolute whitespace-nowrap"
              style={{
                left: `${(hour / 24) * 100}%`,
                transform: hour === 0 ? 'translateX(0)' : 'translateX(-50%)',
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
            <div className="flex items-center gap-2">
              <div className="text-[10px] uppercase tracking-[0.26em] text-[var(--app-muted)]">Day Console</div>
            </div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)] mt-0.5">{selectedDateLabel}</div>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                {formatMinutes(selectedDaySummary.minutesTracked)} tracked
              </span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                {selectedDaySummary.completedCount} done
              </span>
              {sidePanelTabCounts.scheduled > 0 && (
                <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                  {sidePanelTabCounts.scheduled} scheduled
                </span>
              )}
              {selectedDaySummary.runningCount > 0 && (
                <span className="flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-[var(--state-active)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--state-active)] animate-pulse" />
                  Live
                </span>
              )}
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

      <div className="px-3 py-2 border-b border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] bg-[var(--app-panel)] flex items-center gap-1 overflow-x-auto no-scrollbar">
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
            <div className="mb-1 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">{activeTabLabel} • 24h timeline</div>
              <button
                type="button"
                onClick={() => setTimelineExpanded(true)}
                className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"
              >
                Expand
              </button>
            </div>
            {renderTimelineChart()}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUEST_STATE_LEGEND.map((entry) => (
                <button
                  key={`legend-desktop-${entry.state}`}
                  type="button"
                  onClick={() => toggleLegendState(entry.state)}
                  className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] border transition-all duration-150 ${
                    legendFilterStates.includes(entry.state)
                      ? 'border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))] text-[var(--app-text)]'
                      : 'border-[color-mix(in_srgb,var(--app-text)_7%,transparent)] text-[var(--app-muted)] hover:border-[color-mix(in_srgb,var(--app-accent)_30%,transparent)] hover:text-[var(--app-text)]'
                  }`}
                  title={entry.note ? `${entry.label} (${entry.note})` : entry.label}
                >
                  <span
                    className="h-2 w-2 rounded-full border shrink-0"
                    style={{
                      backgroundColor:
                        entry.state === 'todo' || entry.state === 'scheduled'
                          ? 'var(--app-panel)'
                          : dotColorByQuestState(entry.state),
                      borderColor: dotBorderByQuestState(entry.state),
                    }}
                  />
                  {entry.label}
                  <span className="tabular-nums opacity-60">({stateCountByLegend[entry.state]})</span>
                </button>
              ))}
              {legendFilterStates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLegendFilterStates([])}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] uppercase tracking-[0.12em] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="relative z-10 p-0.5">
            {renderCompactItemList()}
          </div>
        </div>

        <div className="lg:hidden space-y-2">
          <div className="p-1.5">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">{activeTabLabel} • 24h timeline</div>
              <button
                type="button"
                onClick={() => setTimelineExpanded(true)}
                className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"
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

        {challengeList.length > 0 && (
          <div
            ref={hudContainerRef}
            className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] overflow-hidden"
          >
            {/* Header */}
            {(() => {
              const eligibleCount = challengeMeta.filter(m => m.selectedStatus === 'done' || m.selectedStatus === 'not_done').length;
              const allCount = challengeList.length;
              return (
                <div className="px-3 py-2 flex items-center gap-2 border-b border-[color-mix(in_srgb,var(--app-text)_6%,transparent)] bg-[var(--app-panel)] overflow-x-auto">
                  <span className="text-[10px] uppercase tracking-[0.26em] text-[var(--app-muted)] shrink-0">Challenges</span>
                  {/* Filter toggle */}
                  <div className="flex gap-0.5 rounded-md border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] p-0.5 shrink-0">
                    {(['eligible', 'all'] as const).map(mode => {
                      const isActive = hudFilter === mode;
                      const count = mode === 'eligible' ? eligibleCount : allCount;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setHudFilter(mode)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] uppercase tracking-[0.14em] transition-colors ${
                            isActive
                              ? 'bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] border border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)] text-[var(--app-accent)]'
                              : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                          }`}
                        >
                          {mode === 'eligible' ? 'Eligible' : 'All'}
                          <span className={`rounded px-1 text-[8px] ${
                            isActive
                              ? 'bg-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-panel))] text-[var(--app-accent)]'
                              : 'bg-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[var(--app-muted)]'
                          }`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Time filter */}
                  <div className="flex gap-0.5 rounded-md border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] p-0.5 shrink-0">
                    {(['all', 'morning', 'noon', 'evening', 'anytime'] as const).map(t => {
                      const isActive = hudTimeFilter === t;
                      const label = t === 'all' ? 'Any time' : t.charAt(0).toUpperCase() + t.slice(1);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setHudTimeFilter(t)}
                          className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-[0.14em] transition-colors whitespace-nowrap ${
                            isActive
                              ? 'bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] border border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)] text-[var(--app-accent)]'
                              : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setPickerEditId(null);
                      setPickerViewMonth(new Date(viewMonth));
                      setPickerStart(null);
                      setPickerEnd(null);
                      setPickerExcluded([]);
                      setPickerName('');
                      setPickerBadge('Bronze');
                      setPickerGoalType('daily');
                      setPickerGoalTarget(30);
                      setPickerTimePreset('anytime');
                      setChallengePickerOpen(true);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] text-[9px] uppercase tracking-[0.14em] text-[var(--app-accent)] hover:border-[var(--app-accent)] transition-colors shrink-0"
                  >
                    + New
                  </button>
                </div>
              );
            })()}
            {/* Challenge rows */}
            {(() => {
              const baseList = hudFilter === 'eligible'
                ? challengeList.filter(ch => {
                    const m = challengeMeta.find(meta => meta.id === ch.id);
                    return m?.selectedStatus === 'done' || m?.selectedStatus === 'not_done';
                  })
                : challengeList;
              const visibleList = hudTimeFilter === 'all'
                ? baseList
                : baseList.filter(ch => {
                    const t = ch.timePreset ?? 'anytime';
                    return t === hudTimeFilter;
                  });
              if (visibleList.length === 0) {
                return (
                  <div className="px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] opacity-60">
                    {hudFilter === 'eligible' ? 'No eligible challenges for this day.' : 'No challenges match this filter.'}
                  </div>
                );
              }
              return visibleList.map(ch => {
              const meta = challengeMeta.find(m => m.id === ch.id)!;
              const isHighlighted = highlightedChallengeId === ch.id;
              const canToggle = meta.selectedStatus === 'done' || meta.selectedStatus === 'not_done';
              const selectedDone = meta.selectedStatus === 'done';
              const statusPillClass = {
                done: 'bg-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-panel))] text-[var(--app-accent)]',
                not_done: 'bg-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[var(--app-muted)]',
                excluded: 'bg-[color-mix(in_srgb,#f59e0b_14%,var(--app-panel))] text-[#f59e0b]',
                out_of_range: 'bg-[color-mix(in_srgb,var(--app-text)_6%,transparent)] text-[var(--app-muted)] opacity-60',
              }[meta.selectedStatus];
              const statusLabel = { done: 'Done', not_done: 'Not done', excluded: 'Excl.', out_of_range: 'Off range' }[meta.selectedStatus];
              return (
                <div
                  key={ch.id}
                  ref={(node) => { hudRowRefs.current[ch.id] = node; }}
                  className={`px-3 py-2 flex items-center gap-2 border-b border-[color-mix(in_srgb,var(--app-text)_5%,transparent)] last:border-0 transition-colors duration-300 ${
                    isHighlighted ? 'bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel-2))]' : ''
                  }`}
                >
                  {/* Left: name + range */}
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-accent)] truncate leading-tight">{ch.badge} · {ch.name || 'Challenge'}</div>
                    <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)] truncate leading-tight">{formatShortDate(ch.start)} → {formatShortDate(ch.end)}</div>
                  </div>
                  {/* Middle: status + progress + streak + time */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`rounded px-1.5 py-0.5 text-[8px] uppercase tracking-[0.14em] whitespace-nowrap ${statusPillClass}`}>
                      {statusLabel}
                    </span>
                    <span className="text-[9px] text-[var(--app-muted)] whitespace-nowrap tabular-nums">{meta.progress}/{ch.goalTarget}</span>
                    {meta.streak > 0 && (
                      <span className="text-[9px] text-[var(--app-muted)] whitespace-nowrap tabular-nums">🔥{meta.streak}</span>
                    )}
                    {(ch.timePreset && ch.timePreset !== 'anytime') && (
                      <span className="rounded px-1.5 py-0.5 text-[8px] uppercase tracking-[0.14em] whitespace-nowrap bg-[color-mix(in_srgb,var(--app-text)_8%,transparent)] text-[var(--app-muted)]">
                        {ch.timePreset}
                      </span>
                    )}
                  </div>
                  {/* Mini 7-day timeline */}
                  <div className="flex items-center gap-[3px] shrink-0">
                    {miniTimelineDays.map(dayKey => {
                      const inRange = dayKey >= ch.start && dayKey <= ch.end;
                      const isEligible = meta.eligibleSet.has(dayKey);
                      const isDone = meta.completionsSet.has(dayKey);
                      const isExcl = inRange && !isEligible;
                      const isActive = dayKey === selectedKey;
                      const dotStatus = isDone && isEligible ? 'Done'
                        : isEligible ? 'Not done'
                        : isExcl ? 'Excluded'
                        : 'Out of range';
                      return (
                        <button
                          key={dayKey}
                          type="button"
                          title={`${formatShortDate(dayKey)} · ${dotStatus}`}
                          onClick={() => !isActive && selectDate(dayKey)}
                          style={isDone && isEligible ? { boxShadow: '0 0 4px color-mix(in srgb, var(--app-accent) 60%, transparent)' } : undefined}
                          className={`p-0 w-[5px] h-[5px] rounded-sm transition-transform duration-100 ${
                            isActive ? 'cursor-default scale-125' : 'cursor-pointer hover:scale-150'
                          } ${
                            isDone && isEligible
                              ? 'bg-[var(--app-accent)]'
                              : isEligible
                              ? 'bg-transparent border border-[var(--app-accent)]'
                              : isExcl
                              ? 'bg-[#f59e0b] opacity-30'
                              : 'bg-[color-mix(in_srgb,var(--app-text)_15%,transparent)]'
                          }`}
                        />
                      );
                    })}
                  </div>
                  {/* Right: Done/Undo + Edit + Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={!canToggle}
                      title={selectedDone ? `Undo ${selectedKey}` : `Mark ${selectedKey} done`}
                      onClick={() => canToggle && toggleChallengeDay(ch.id, selectedKey)}
                      className={`inline-flex h-[24px] w-[24px] items-center justify-center rounded border transition-colors ${
                        !canToggle
                          ? 'border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] text-[var(--app-muted)] opacity-30 pointer-events-none'
                          : selectedDone
                          ? 'border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)] text-[var(--app-accent)] hover:border-[var(--app-accent)]'
                          : 'border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] text-[var(--app-muted)] hover:border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)] hover:text-[var(--app-accent)]'
                      }`}
                    >
                      {selectedDone ? <Undo2 className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    </button>
                    <button
                      type="button"
                      title="Edit challenge"
                      onClick={() => {
                        setPickerEditId(ch.id);
                        setPickerViewMonth(fromDateKey(ch.start));
                        setPickerStart(ch.start);
                        setPickerEnd(ch.end);
                        setPickerExcluded([...ch.excluded]);
                        setPickerName(ch.name);
                        setPickerBadge(ch.badge);
                        setPickerGoalType(ch.goalType);
                        setPickerGoalTarget(ch.goalTarget);
                        setPickerTimePreset(ch.timePreset ?? 'anytime');
                        setChallengePickerOpen(true);
                      }}
                      className="inline-flex h-[24px] w-[24px] items-center justify-center rounded border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] text-[var(--app-muted)] hover:border-[color-mix(in_srgb,var(--app-accent)_38%,transparent)] hover:text-[var(--app-text)] transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Delete challenge"
                      onClick={() => setChallengeDeleteTarget(ch.id)}
                      className="inline-flex h-[24px] w-[24px] items-center justify-center rounded border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] text-[var(--app-muted)] hover:border-[color-mix(in_srgb,var(--app-text)_30%,transparent)] hover:text-[var(--app-text)] transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            });
            })()}
          </div>
        )}

        <div className="rounded-2xl bg-[var(--app-panel-2)] p-4">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {/* ← Prev */}
            <button
              type="button"
              onClick={handlePrev}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] text-[var(--app-muted)] hover:text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-text)_26%,transparent)] transition-colors shrink-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {/* Month/Year heading */}
            <div className="text-[20px] font-semibold text-[var(--app-text)] tracking-tight leading-none min-w-0 flex-1 select-none">
              {formatMonthTitle(viewMonth)}
            </div>

            {/* → Next */}
            <button
              type="button"
              onClick={handleNext}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] text-[var(--app-muted)] hover:text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-text)_26%,transparent)] transition-colors shrink-0"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

            {/* Today chip — only visible when not on current month */}
            {(viewMonth.getFullYear() !== new Date(now).getFullYear() || viewMonth.getMonth() !== new Date(now).getMonth()) && (
              <button
                type="button"
                onClick={() => {
                  const today = new Date(now);
                  setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                  setRangeMode('month');
                }}
                className="px-2.5 py-1 rounded-md border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)] hover:text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-text)_26%,transparent)] transition-colors"
              >
                Today
              </button>
            )}

            <div className="flex-1 min-w-0" />

            {/* M / W / Y pill */}
            <div className="flex items-center rounded-md border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] overflow-hidden shrink-0">
              {(['month', 'week', 'year'] as const).map((mode, i) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleRangeChange(mode)}
                  className={`px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-colors ${
                    i > 0 ? 'border-l border-[color-mix(in_srgb,var(--app-text)_12%,transparent)]' : ''
                  } ${
                    rangeMode === mode
                      ? 'bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))] text-[var(--app-accent)]'
                      : 'bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:text-[var(--app-text)]'
                  }`}
                >
                  {mode === 'month' ? 'M' : mode === 'week' ? 'W' : 'Y'}
                </button>
              ))}
            </div>

            {/* + Log button */}
            <button
              type="button"
              onClick={() => {
                const today = new Date(now);
                setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                setRangeMode('month');
                selectDate(todayKey, today);
                setQuickPopoverKey(todayKey);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel-2))] text-[10px] uppercase tracking-[0.18em] text-[var(--app-accent)] hover:border-[var(--app-accent)] transition-colors shrink-0"
            >
              <Plus className="h-3 w-3" />
              Log
            </button>
          </div>

          {rangeMode === 'today' ? (
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] p-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">
                Today
                {primaryChallenge && challengeMeta[0] && selectedKey === todayKey && (
                  <span className={`h-2 w-2 rounded-full border ${
                    challengeMeta[0].selectedStatus === 'done'
                      ? 'bg-[var(--app-accent)] border-[var(--app-accent)]'
                      : challengeMeta[0].selectedStatus === 'not_done'
                        ? 'bg-transparent border-[var(--app-accent)]'
                        : 'bg-transparent border-[color-mix(in_srgb,var(--app-text)_30%,transparent)]'
                  }`} />
                )}
              </div>
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
                <div
                  className="grid min-w-[740px] grid-cols-7 gap-2"
                  onPointerDown={handleGridPointerDown}
                  onPointerMove={handleGridPointerMove}
                  onPointerUp={handleGridPointerUp}
                >
                  {weekDays.map((day) => {
                    const daySummary = selectors.getDaySummary(day.key, now) || EMPTY_DAY_SUMMARY;
                    const isSelected = day.key === selectedKey;
                    const isToday = day.key === todayKey;
                    const chDay = getChallengeDayState(day.key);
                    const wkIntensity = Math.min(1, daySummary.minutesTracked / 480);
                    const wkTopTasks = selectors.getTopTasksForDay(day.key, 3, now);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => selectDate(day.key, day.date)}
                        className={`relative min-h-[120px] rounded-lg border p-3 text-left transition-all duration-200 overflow-hidden flex flex-col gap-0.5 ${
                          isSelected
                            ? 'border-[color-mix(in_srgb,var(--app-accent)_60%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))]'
                            : chDay.inRange
                              ? 'border-[color-mix(in_srgb,var(--app-accent)_26%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_6%,var(--app-panel-2))] hover:bg-[color-mix(in_srgb,var(--app-text)_4%,var(--app-panel-2))]'
                              : chDay.excluded
                                ? 'border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] bg-[color-mix(in_srgb,var(--app-text)_3%,var(--app-panel-2))] hover:bg-[color-mix(in_srgb,var(--app-text)_4%,var(--app-panel-2))]'
                                : 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] hover:bg-[color-mix(in_srgb,var(--app-text)_4%,var(--app-panel-2))]'
                        }`}
                      >
                        {/* XP heat gradient */}
                        {wkIntensity > 0 && (
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0"
                            style={{ background: `linear-gradient(160deg, transparent 30%, color-mix(in srgb, var(--app-accent) ${Math.round(wkIntensity * 22)}%, transparent) 100%)` }}
                          />
                        )}
                        {chDay.excluded && (
                          <span className={`pointer-events-none absolute top-[6px] right-[6px] flex h-4 w-4 items-center justify-center rounded-sm text-[10px] leading-none text-[var(--app-muted)] ${isSelected ? 'opacity-35' : 'opacity-55'}`}>×</span>
                        )}
                        {challengeList.length > 1 && (() => { const n = getChallengeCountForDay(day.key); return n > 0 ? <span className="pointer-events-none absolute top-[6px] left-[6px] flex h-4 w-4 items-center justify-center rounded text-[8px] leading-none text-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_18%,transparent)]">{n}</span> : null; })()}
                        {/* Weekday + date */}
                        <div className={`relative z-[1] text-[11px] uppercase tracking-[0.16em] ${isToday ? 'text-[var(--app-accent)]' : 'text-[var(--app-muted)]'}`}>
                          {formatWeekdayLabel(day.key)}
                        </div>
                        {/* Top task lines */}
                        <div className="relative z-[1] flex-1 min-w-0 space-y-0.5 mt-1">
                          {wkTopTasks.map((t, i) => (
                            <p key={i} className={`text-[9px] truncate leading-snug ${i === 0 ? 'text-[color-mix(in_srgb,var(--app-text)_70%,var(--app-muted))]' : 'text-[var(--app-muted)]'}`}>{t.title}</p>
                          ))}
                        </div>
                        {/* Minutes + challenge dot */}
                        <div className="relative z-[1] mt-auto flex items-center gap-1.5">
                          {daySummary.minutesTracked > 0 && (
                            <span className={`text-[10px] uppercase tracking-[0.14em] tabular-nums ${daySummary.runningCount > 0 ? 'text-[var(--app-accent)]' : 'text-[var(--app-text)]'}`}>
                              {Math.round(daySummary.minutesTracked)}m
                            </span>
                          )}
                          {chDay.inRange && chDay.done && (
                            <span className={`h-[5px] w-[5px] rounded-full bg-[var(--app-accent)] shadow-[0_0_5px_color-mix(in_srgb,var(--app-accent)_55%,transparent)] ${isSelected ? 'opacity-60' : ''}`} />
                          )}
                        </div>
                        {/* Mini XP bar */}
                        {wkIntensity > 0 && (
                          <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 right-0 h-[3px]" style={{ opacity: 0.55 }}>
                            <div className="h-full" style={{ width: `${Math.min(100, wkIntensity * 100)}%`, background: 'var(--app-accent)', borderRadius: '0 1px 0 0' }} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {rangeMode === 'month' ? (
            <>
              {primaryChallenge && (
                <div className="flex items-center gap-4 mb-2 px-0.5 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm border border-[color-mix(in_srgb,var(--app-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_9%,var(--app-panel-2))]" />
                    In range
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-[6px] w-[6px] rounded-full bg-[var(--app-accent)] shadow-[0_0_5px_color-mix(in_srgb,var(--app-accent)_45%,transparent)]" />
                    Done
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] leading-none opacity-60">×</span>
                    Excluded
                  </span>
                </div>
              )}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {DAY_NAMES.map((name) => (
                  <div key={name} className="text-[10px] text-[var(--app-muted)] text-center py-1 font-normal uppercase tracking-[0.2em]">
                    {name}
                  </div>
                ))}
              </div>

              <div
                className="grid grid-cols-7 gap-2"
                onPointerDown={handleGridPointerDown}
                onPointerMove={handleGridPointerMove}
                onPointerUp={handleGridPointerUp}
              >
                {gridDays.map((day) => {
                  const isSelected = selectedKey === day.key;
                  const info = summaryByDay.get(day.key) || { activityCount: 0, loggedMinutes: 0, running: false };
                  const loggedMin = info.loggedMinutes;
                  const isToday = day.key === todayKey;
                  const chDay = getChallengeDayState(day.key);
                  const xpIntensity = xpIntensityByDay.get(day.key) ?? 0;
                  const streakConn = streakConnectorsByDay.get(day.key);
                  const isQuickOpen = quickPopoverKey === day.key;
                  // multi-challenge dots: up to 5 dots for challenge completions
                  const multiChDots = challengeList.length > 1 ? challengeMeta.slice(0, 5).map(m => ({
                    id: m.id,
                    done: m.completionsSet.has(day.key) && m.eligibleSet.has(day.key),
                    inRange: m.eligibleSet.has(day.key),
                  })).filter(d => d.inRange) : [];
                  const cellTopTasks = topTasksByDay.get(day.key) || [];
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => {
                        selectDate(day.key, day.date);
                        setQuickPopoverKey(prev => prev === day.key ? null : day.key);
                      }}
                      className={`group relative min-h-[88px] rounded-lg border p-2 text-left transition-all duration-200 overflow-hidden flex flex-col gap-0.5 ${
                        isSelected
                          ? 'border-transparent border-l-2 border-l-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_6%,var(--app-panel))]'
                          : !day.inMonth
                            ? 'border-transparent opacity-30'
                            : chDay.inRange
                              ? 'border-[color-mix(in_srgb,var(--app-accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_5%,var(--app-panel-2))] hover:bg-[color-mix(in_srgb,var(--app-text)_4%,var(--app-panel-2))]'
                              : chDay.excluded
                                ? 'border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] bg-[color-mix(in_srgb,var(--app-text)_3%,var(--app-panel-2))] hover:bg-[color-mix(in_srgb,var(--app-text)_4%,var(--app-panel-2))]'
                                : 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] hover:bg-[color-mix(in_srgb,var(--app-text)_4%,var(--app-panel-2))]'
                      }`}
                    >
                      {/* XP heat map layer — bottom-rising gradient */}
                      {xpIntensity > 0 && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background: `linear-gradient(170deg, transparent 30%, color-mix(in srgb, var(--app-accent) ${Math.round(xpIntensity * 22)}%, transparent) 100%)`,
                            opacity: day.inMonth ? 1 : 0.45,
                          }}
                        />
                      )}

                      {/* Streak chain — reduced opacity */}
                      {streakConn && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute left-0 right-0"
                          style={{
                            top: '44%',
                            height: 3,
                            opacity: 0.25,
                            background: streakConn.left && streakConn.right
                              ? 'color-mix(in srgb, var(--app-accent) 38%, transparent)'
                              : streakConn.left
                                ? 'linear-gradient(90deg, color-mix(in srgb, var(--app-accent) 42%, transparent) 0%, transparent 100%)'
                                : 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--app-accent) 42%, transparent) 100%)',
                          }}
                        />
                      )}

                      {chDay.excluded && (
                        <span className={`pointer-events-none absolute top-[5px] right-[5px] flex h-4 w-4 items-center justify-center rounded-sm text-[10px] leading-none text-[var(--app-muted)] ${isSelected ? 'opacity-35' : 'opacity-55'}`}>×</span>
                      )}

                      {/* Multi-challenge completion dots */}
                      {multiChDots.length > 0 && (
                        <div className="pointer-events-none absolute bottom-[6px] left-[4px] flex gap-[3px]">
                          {multiChDots.map(d => (
                            <span
                              key={d.id}
                              className="rounded-full"
                              style={{
                                width: 4, height: 4,
                                background: d.done
                                  ? 'var(--app-accent)'
                                  : 'color-mix(in srgb, var(--app-accent) 28%, transparent)',
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Challenge count badge */}
                      {challengeList.length > 1 && (() => { const n = getChallengeCountForDay(day.key); return n > 0 ? <span className="pointer-events-none absolute top-[5px] left-[5px] flex h-4 w-4 items-center justify-center rounded text-[8px] leading-none text-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_18%,transparent)]">{n}</span> : null; })()}

                      {/* Hover "+" button top-right */}
                      {day.inMonth && !chDay.excluded && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); selectDate(day.key, day.date); setQuickPopoverKey(day.key); }}
                          className="absolute top-[5px] right-[5px] flex items-center justify-center h-[15px] w-[15px] rounded text-[11px] leading-none text-[var(--app-muted)] hover:text-[var(--app-text)] opacity-0 group-hover:opacity-100 transition-opacity z-[2]"
                        >
                          +
                        </button>
                      )}

                      {/* Date number */}
                      <div className="relative z-[1]">
                        {isToday ? (
                          <span className="inline-flex items-center justify-center rounded-full w-6 h-6 bg-[var(--app-accent)] text-white text-[13px] font-semibold leading-none">
                            {day.date.getDate()}
                          </span>
                        ) : (
                          <span className="text-[15px] font-semibold leading-none text-[var(--app-text)]">
                            {day.date.getDate()}
                          </span>
                        )}
                      </div>

                      {/* Top task lines */}
                      <div className="relative z-[1] flex-1 min-w-0 space-y-0.5">
                        {cellTopTasks.map((t, i) => (
                          <p key={i} className={`text-[9px] truncate leading-snug ${i === 0 ? 'text-[color-mix(in_srgb,var(--app-text)_70%,var(--app-muted))]' : 'text-[var(--app-muted)]'}`}>{t.title}</p>
                        ))}
                        {info.activityCount > cellTopTasks.length && info.activityCount > 0 && (
                          <p className="text-[8px] text-[var(--app-muted)] opacity-60 leading-snug">+{info.activityCount - cellTopTasks.length} more</p>
                        )}
                      </div>

                      {/* Bottom bar: XP bar + minutes + challenge dot */}
                      <div className="relative z-[1] mt-auto flex items-center gap-1 pb-[5px]">
                        {xpIntensity > 0 && (
                          <div className="flex-1 h-[3px] rounded-full overflow-hidden bg-[color-mix(in_srgb,var(--app-text)_8%,transparent)]">
                            <div
                              className="h-full rounded-full bg-[var(--app-accent)]"
                              style={{ width: `${Math.min(100, xpIntensity * 100)}%`, opacity: day.inMonth ? 0.7 : 0.35 }}
                            />
                          </div>
                        )}
                        {loggedMin > 0 && (
                          <span className={`text-[8px] tabular-nums shrink-0 ${info.running ? 'text-[var(--app-accent)]' : 'text-[var(--app-muted)]'}`}>
                            {Math.round(loggedMin)}m{info.running ? ' ●' : ''}
                          </span>
                        )}
                        {chDay.inRange && chDay.done && challengeList.length <= 1 && (
                          <span className={`h-[5px] w-[5px] rounded-full bg-[var(--app-accent)] shadow-[0_0_5px_color-mix(in_srgb,var(--app-accent)_55%,transparent)] shrink-0 ${isSelected ? 'opacity-60' : ''}`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {rangeMode === 'year' ? (
            (() => {
              // Month boundaries for labels
              const year = selectedDate.getFullYear();
              const monthStartWeeks: Record<number, number> = {};
              yearHeatMapWeeks.forEach((week, wi) => {
                const firstInYear = week.find(d => d.inYear);
                if (firstInYear) {
                  const m = firstInYear.date.getMonth();
                  if (monthStartWeeks[m] === undefined) monthStartWeeks[m] = wi;
                }
              });
              const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const DAY_ROW_LABELS = ['Mon','','Wed','','Fri','',''];
              return (
                <div>
                  {/* Legend */}
                  <div className="flex items-center gap-3 mb-3 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                    <span>Less</span>
                    {[0, 0.25, 0.5, 0.75, 1].map(v => (
                      <span
                        key={v}
                        className="rounded-sm"
                        style={{
                          width: 13, height: 13, display: 'inline-block',
                          background: v === 0
                            ? 'color-mix(in srgb, var(--app-text) 9%, transparent)'
                            : `color-mix(in srgb, var(--app-accent) ${Math.round(v * 80)}%, var(--app-panel-2))`,
                        }}
                      />
                    ))}
                    <span>More</span>
                    {primaryChallenge && (
                      <span className="ml-2 flex items-center gap-1">
                        <span className="rounded-full bg-[var(--app-accent)]" style={{ width: 6, height: 6, display: 'inline-block' }} />
                        Challenge done
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto xt-scroll pb-2">
                    <div style={{ display: 'grid', gridTemplateColumns: `28px repeat(${yearHeatMapWeeks.length}, 13px)`, gridTemplateRows: 'auto repeat(7, 13px)', gap: '3px', minWidth: 0 }}>
                      {/* Month labels row */}
                      <div style={{ gridColumn: 1, gridRow: 1 }} />
                      {yearHeatMapWeeks.map((_, wi) => {
                        const monthIdx = Object.entries(monthStartWeeks).find(([, w]) => w === wi);
                        return (
                          <div
                            key={`ml-${wi}`}
                            style={{ gridColumn: wi + 2, gridRow: 1, height: 14 }}
                            className="text-[8px] uppercase tracking-[0.1em] text-[var(--app-muted)] whitespace-nowrap overflow-visible leading-none flex items-end"
                          >
                            {monthIdx ? MONTH_ABBR[parseInt(monthIdx[0])] : ''}
                          </div>
                        );
                      })}

                      {/* Day row labels (Mon/Wed/Fri) */}
                      {DAY_ROW_LABELS.map((lbl, di) => (
                        <div
                          key={`dl-${di}`}
                          style={{ gridColumn: 1, gridRow: di + 2 }}
                          className="text-[7px] uppercase tracking-[0.06em] text-[var(--app-muted)] leading-none flex items-center justify-end pr-1"
                        >
                          {lbl}
                        </div>
                      ))}

                      {/* Heat squares */}
                      {yearHeatMapWeeks.map((week, wi) =>
                        week.map((day, di) => {
                          const s = day.inYear ? (selectors.getDaySummary(day.key, now) || EMPTY_DAY_SUMMARY) : EMPTY_DAY_SUMMARY;
                          const intensity = Math.min(1, s.minutesTracked / 480);
                          // 5-level quantized intensity
                          const lvl = intensity === 0 ? 0 : Math.ceil(intensity * 4);
                          const lvlPct = [0, 20, 40, 60, 80][lvl] ?? 80;
                          const isSelectedDay = day.key === selectedKey;
                          const isToday2 = day.key === todayKey;
                          const chDone = primaryChallenge && challengeMeta[0]
                            ? challengeMeta[0].completionsSet.has(day.key) && challengeMeta[0].eligibleSet.has(day.key)
                            : false;
                          return (
                            <button
                              key={`hs-${wi}-${di}`}
                              type="button"
                              title={`${day.key} · ${s.minutesTracked}m`}
                              onClick={() => {
                                const firstDay = new Date(day.date.getFullYear(), day.date.getMonth(), 1);
                                setViewMonth(firstDay);
                                selectDate(day.key, day.date);
                                setRangeMode('month');
                              }}
                              style={{
                                gridColumn: wi + 2,
                                gridRow: di + 2,
                                width: 13, height: 13,
                                borderRadius: 3,
                                background: !day.inYear
                                  ? 'transparent'
                                  : lvl === 0
                                    ? 'color-mix(in srgb, var(--app-text) 9%, transparent)'
                                    : `color-mix(in srgb, var(--app-accent) ${lvlPct}%, var(--app-panel-2))`,
                                outline: isSelectedDay
                                  ? '1.5px solid color-mix(in srgb, var(--app-accent) 80%, transparent)'
                                  : isToday2
                                    ? '1.5px solid color-mix(in srgb, var(--app-text) 35%, transparent)'
                                    : 'none',
                                outlineOffset: 1,
                                boxShadow: chDone
                                  ? '0 0 0 1px color-mix(in srgb, var(--app-accent) 60%, transparent)'
                                  : undefined,
                                cursor: day.inYear ? 'pointer' : 'default',
                                position: 'relative',
                              }}
                            >
                              {chDone && (
                                <span
                                  aria-hidden="true"
                                  style={{
                                    position: 'absolute', bottom: 1, right: 1,
                                    width: 3, height: 3,
                                    borderRadius: '50%',
                                    background: 'var(--app-accent)',
                                    boxShadow: '0 0 3px var(--app-accent)',
                                  }}
                                />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Year summary stats */}
                  {(() => {
                    const yearStart = `${year}-01-01`;
                    const yearEnd = `${year}-12-31`;
                    const totalMin = yearHeatMapWeeks.flat().filter(d => d.inYear).reduce((sum, d) => {
                      const s = selectors.getDaySummary(d.key, now) || EMPTY_DAY_SUMMARY;
                      return sum + s.minutesTracked;
                    }, 0);
                    const activeDays = yearHeatMapWeeks.flat().filter(d => d.inYear && (selectors.getDaySummary(d.key, now)?.minutesTracked || 0) > 0).length;
                    const chYearDone = primaryChallenge && challengeMeta[0]
                      ? [...challengeMeta[0].completionsSet].filter(k => k >= yearStart && k <= yearEnd).length : 0;
                    return (
                      <div className="mt-3 flex flex-wrap gap-3 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                        <span className="rounded px-2 py-1 bg-[color-mix(in_srgb,var(--app-text)_6%,transparent)]">
                          {Math.round(totalMin / 60)}h tracked in {year}
                        </span>
                        <span className="rounded px-2 py-1 bg-[color-mix(in_srgb,var(--app-text)_6%,transparent)]">
                          {activeDays} active days
                        </span>
                        {primaryChallenge && (
                          <span className="rounded px-2 py-1 bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-accent)]">
                            {chYearDone} challenge completions
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()
          ) : null}
        </div>

        {/* Inline day panel — floats between calendar and Day Console */}
        {quickPopoverKey && rangeMode === 'month' && (() => {
          const qKey = quickPopoverKey;
          const qChDay = getChallengeDayState(qKey);
          const qSummary = selectors.getDaySummary(qKey, now) || EMPTY_DAY_SUMMARY;
          const qDateLabel = fromDateKey(qKey).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
          const qTopTasks = selectors.getTopTasksForDay(qKey, 3, now);
          return (
            <div
              className="rounded-xl border border-[color-mix(in_srgb,var(--app-accent)_30%,transparent)] bg-[var(--app-panel)] overflow-hidden"
              style={{ animation: 'glass-panel-in 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[color-mix(in_srgb,var(--app-text)_8%,transparent)]">
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-medium text-[var(--app-text)]">{qDateLabel}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-[var(--app-muted)] uppercase tracking-[0.14em]">
                  {qSummary.minutesTracked > 0 && <span>{Math.round(qSummary.minutesTracked)}m tracked</span>}
                  {qSummary.activityCount > 0 && <span>{qSummary.activityCount} done</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setQuickPopoverKey(null)}
                  className="flex h-6 w-6 items-center justify-center rounded border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] text-[var(--app-muted)] hover:text-[var(--app-text)] text-[12px] transition-colors"
                >
                  ×
                </button>
              </div>

              {/* Top tasks list */}
              {qTopTasks.length > 0 && (
                <div className="px-4 py-2 border-b border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] space-y-1">
                  {qTopTasks.map((t) => (
                    <div key={t.taskId} className="flex items-center gap-2 text-[11px]">
                      <span className="text-[var(--app-muted)] truncate flex-1">{t.title}</span>
                      {t.minutes > 0 && <span className="shrink-0 text-[var(--app-muted)] tabular-nums">{Math.round(t.minutes)}m</span>}
                      {t.running && <span className="shrink-0 text-[var(--app-accent)] text-[9px] uppercase tracking-[0.14em]">running</span>}
                      {t.doneToday && !t.running && <span className="shrink-0 text-[#43d39e] text-[9px]">✓</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Quick-log form */}
              <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-[color-mix(in_srgb,var(--app-text)_8%,transparent)]">
                <input
                  type="text"
                  placeholder="What did you work on?"
                  value={qlTitle}
                  onChange={(e) => setQlTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && qlTitle.trim()) {
                      const mins = Math.max(1, Number(qlMin) || 30);
                      addManualSession({ title: qlTitle.trim(), tag: 'Focus', minutes: mins, startAt: fromDateKey(qKey).getTime() + 9 * 3600000 });
                      setQlTitle('');
                      setQlMin('30');
                    }
                  }}
                  className="flex-1 min-w-0 rounded border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] bg-[var(--app-panel-2)] px-2.5 py-1.5 text-[11px] text-[var(--app-text)] placeholder-[var(--app-muted)] outline-none focus:border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)]"
                />
                <input
                  type="number"
                  value={qlMin}
                  onChange={(e) => setQlMin(e.target.value)}
                  min={1}
                  max={480}
                  className="w-14 rounded border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] bg-[var(--app-panel-2)] px-2 py-1.5 text-[11px] text-[var(--app-text)] text-center outline-none focus:border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)] tabular-nums"
                />
                <span className="text-[10px] text-[var(--app-muted)]">min</span>
                <button
                  type="button"
                  disabled={!qlTitle.trim()}
                  onClick={() => {
                    const mins = Math.max(1, Number(qlMin) || 30);
                    addManualSession({ title: qlTitle.trim(), tag: 'Focus', minutes: mins, startAt: fromDateKey(qKey).getTime() + 9 * 3600000 });
                    setQlTitle('');
                    setQlMin('30');
                  }}
                  className="px-3 py-1.5 rounded border border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] text-[10px] uppercase tracking-[0.14em] text-[var(--app-accent)] hover:border-[var(--app-accent)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  Log it →
                </button>
              </div>

              {/* Challenge row */}
              {primaryChallenge && qChDay.inRange && !qChDay.excluded && (
                <div className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-[10px] text-[var(--app-muted)] flex-1 truncate uppercase tracking-[0.12em]">
                    Challenge: {primaryChallenge.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleChallengeDay(primaryChallenge.id, qKey)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[9px] uppercase tracking-[0.14em] transition-colors ${
                      qChDay.done
                        ? 'border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] text-[var(--app-accent)]'
                        : 'border-[color-mix(in_srgb,var(--app-text)_18%,transparent)] text-[var(--app-muted)] hover:text-[var(--app-accent)] hover:border-[color-mix(in_srgb,var(--app-accent)_38%,transparent)]'
                    }`}
                  >
                    {qChDay.done ? <Undo2 className="h-2.5 w-2.5" /> : <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7.5L8 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    {qChDay.done ? 'Undo' : 'Mark done'}
                  </button>
                </div>
              )}
            </div>
          );
        })()}

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
                <div className="absolute inset-x-0 h-[2px] bg-[color-mix(in_srgb,var(--app-text)_18%,transparent)]" style={{ top: computedBaselineY }} />
                {nowMarkerX !== null ? (
                  <div
                    className="pointer-events-none absolute h-[4px] rounded-full"
                    style={{
                      left: 0,
                      width: `${Math.max(0, nowMarkerX)}%`,
                      top: computedBaselineY - 1,
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
                        top: computedBaselineY - 5,
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
                {clampedDots.map((dot, index) => (
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
                {overflowBadges.map((badge) => (
                  <div
                    key={`overflow-badge-expanded-${badge.hour}`}
                    className="pointer-events-none absolute flex items-center justify-center rounded-full font-mono text-[var(--app-accent)]"
                    style={{
                      left: `${badge.xPct}%`,
                      top: badge.topY,
                      transform: 'translateX(-50%)',
                      width: 22,
                      height: 16,
                      fontSize: 8,
                      background: 'color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))',
                      border: '1px solid color-mix(in_srgb,var(--app-accent)_40%,transparent)',
                      boxShadow: '0 0 6px color-mix(in_srgb,var(--app-accent)_30%,transparent)',
                    }}
                  >
                    +{badge.count}
                  </div>
                ))}
              </div>
              <div className="absolute inset-x-4 bottom-6 text-[8px] uppercase tracking-[0.02em] text-[var(--app-muted)] tabular-nums font-mono">
                {TIMELINE_LABELS_FULL.filter((hour) => hour < 24).map((hour) => (
                  <span
                    key={`timeline-expanded-hour-${hour}`}
                    className="absolute whitespace-nowrap"
                    style={{
                      left: `${(hour / 24) * 100}%`,
                      transform: hour === 0 ? 'translateX(0)' : 'translateX(-50%)',
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

      {challengePickerOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          onMouseUp={() => setPickerDragging(false)}
          onMouseLeave={() => setPickerDragging(false)}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
            aria-label="Close challenge setup"
            onClick={() => setChallengePickerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Challenge Setup"
            className="relative w-full max-w-lg rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] bg-[color-mix(in_srgb,var(--app-panel)_92%,black)] p-5 shadow-[0_16px_44px_rgba(0,0,0,0.45)]"
          >
            {/* ── Header: title + month nav ── */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm uppercase tracking-[0.16em] text-[var(--app-text)]">{pickerEditId ? 'Edit Challenge' : 'New Challenge'}</div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPickerViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                >
                  Prev
                </button>
                <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--app-muted)] px-2 min-w-[10rem] text-center">
                  {formatMonthTitle(pickerViewMonth)}
                </span>
                <button
                  type="button"
                  onClick={() => setPickerViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                >
                  Next
                </button>
              </div>
            </div>

            {/* ── Name + badge row ── */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={pickerName}
                onChange={e => setPickerName(e.target.value)}
                placeholder="Challenge name (optional)"
                className="flex-1 rounded-md border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:outline-none focus:border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)]"
              />
              <select
                value={pickerBadge}
                onChange={e => setPickerBadge(e.target.value)}
                className="rounded-md border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-[var(--app-text)] focus:outline-none focus:border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)]"
              >
                {BADGE_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* ── Goal row ── */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] shrink-0">Goal</span>
              <div className="flex gap-0.5 rounded-md border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] p-0.5">
                {(['daily', 'count'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPickerGoalType(t)}
                    className={`px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.14em] transition-colors ${
                      pickerGoalType === t
                        ? 'bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] border border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)] text-[var(--app-accent)]'
                        : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                    }`}
                  >
                    {t === 'daily' ? 'Daily' : 'Count'}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={999}
                value={pickerGoalTarget}
                onChange={e => setPickerGoalTarget(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 rounded-md border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] bg-[var(--app-panel-2)] px-2 py-1.5 text-[11px] text-center text-[var(--app-text)] focus:outline-none focus:border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)]"
              />
              <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                {pickerGoalType === 'daily' ? 'days' : 'times'}
              </span>
            </div>

            {/* ── Time row ── */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] shrink-0">Time</span>
              <select
                value={pickerTimePreset}
                onChange={e => setPickerTimePreset(e.target.value as 'anytime' | 'morning' | 'noon' | 'evening')}
                className="rounded-md border border-[color-mix(in_srgb,var(--app-text)_14%,transparent)] bg-[var(--app-panel-2)] px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--app-text)] focus:outline-none focus:border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)]"
              >
                <option value="anytime">Anytime</option>
                <option value="morning">Morning</option>
                <option value="noon">Noon</option>
                <option value="evening">Evening</option>
              </select>
            </div>

            {/* ── Instruction ── */}
            <div className="mb-2 text-[10px] tracking-[0.1em] text-[var(--app-muted)]">
              {pickerEffectiveStart && pickerEffectiveEnd
                ? 'Click inside range to exclude days. Drag to re-select range.'
                : 'Drag to select a range, or click start then click end.'}
            </div>

            {/* ── Day names header ── */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_NAMES.map(name => (
                <div key={name} className="text-center text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)] py-1">
                  {name}
                </div>
              ))}
            </div>

            {/* ── Calendar grid: range + exclusions ── */}
            <div
              className="grid grid-cols-7 gap-1 select-none"
              onMouseMove={handlePickerMouseMove}
              onMouseUp={() => setPickerDragging(false)}
            >
              {pickerGridDays.map(day => {
                const isToday = day.key === todayKey;
                const isStart = day.key === pickerEffectiveStart;
                const isEnd = day.key === pickerEffectiveEnd;
                const hasRange = !!(pickerEffectiveStart && pickerEffectiveEnd);
                const inRange = hasRange && day.key > pickerEffectiveStart! && day.key < pickerEffectiveEnd!;
                const isExcluded = pickerExcludedSet.has(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onMouseDown={() => {
                      pickerDragStartKeyRef.current = day.key;
                      pickerDragMovedRef.current = false;
                      setPickerDragging(true);
                    }}
                    onMouseEnter={() => {
                      if (!pickerDragging) return;
                      if (!pickerDragMovedRef.current) {
                        if (day.key === pickerDragStartKeyRef.current) return;
                        pickerDragMovedRef.current = true;
                        setPickerStart(pickerDragStartKeyRef.current ?? day.key);
                      }
                      setPickerEnd(day.key);
                    }}
                    onMouseUp={() => {
                      if (pickerDragging && pickerDragMovedRef.current) {
                        setPickerEnd(day.key);
                        const rawStart = pickerDragStartKeyRef.current ?? day.key;
                        const [newStart, newEnd] = rawStart <= day.key ? [rawStart, day.key] : [day.key, rawStart];
                        setPickerExcluded(prev => prev.filter(k => k > newStart && k < newEnd));
                      }
                      setPickerDragging(false);
                    }}
                    onClick={() => {
                      if (pickerDragMovedRef.current) { pickerDragMovedRef.current = false; return; }
                      if (!pickerEffectiveStart || !pickerEffectiveEnd) {
                        // Phase A: set range via two clicks
                        if (!pickerStart || pickerEnd !== null) {
                          setPickerStart(day.key);
                          setPickerEnd(null);
                        } else {
                          setPickerEnd(day.key);
                        }
                        return;
                      }
                      // Phase B: toggle exclusion inside range; outside → start fresh
                      if (inRange) {
                        setPickerExcluded(prev =>
                          prev.includes(day.key) ? prev.filter(k => k !== day.key) : [...prev, day.key].sort()
                        );
                      } else if (!isStart && !isEnd) {
                        setPickerStart(day.key);
                        setPickerEnd(null);
                        setPickerExcluded([]);
                      }
                    }}
                    className={`relative h-9 w-full rounded text-[11px] font-medium transition-all ${
                      isStart || isEnd
                        ? 'bg-[var(--app-accent)] text-white'
                        : inRange && isExcluded
                          ? 'bg-[var(--app-panel-2)] text-[var(--app-muted)] opacity-40 line-through'
                          : inRange
                            ? 'bg-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-panel))] text-[var(--app-text)]'
                            : day.inMonth
                              ? 'bg-[var(--app-panel-2)] text-[var(--app-text)] hover:bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))]'
                              : 'bg-transparent text-[var(--app-muted)] opacity-40'
                    }${isToday && !isStart && !isEnd && !isExcluded ? ' ring-1 ring-[var(--app-accent)] ring-inset' : ''}`}
                  >
                    {day.date.getDate()}
                    {isExcluded && (
                      <span className="pointer-events-none absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-[color-mix(in_srgb,var(--app-bg)_55%,transparent)] text-[10px] leading-none text-[var(--app-muted)]">×</span>
                    )}
                    {(inRange || isStart || isEnd) && !isExcluded && (pickerEditId ? (challengeCompletions[pickerEditId] ?? []) : []).includes(day.key) && (
                      <span className="pointer-events-none absolute bottom-[5px] right-[5px] h-[5px] w-[5px] rounded-full bg-[var(--app-accent)] shadow-[0_0_3px_color-mix(in_srgb,var(--app-accent)_35%,transparent)]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Summary ── */}
            <div className="mt-3 min-h-[2rem] text-[10px] tracking-[0.1em] text-[var(--app-muted)]">
              {pickerEffectiveStart && pickerEffectiveEnd ? (
                <span>
                  {`${formatShortDate(pickerEffectiveStart)} → ${formatShortDate(pickerEffectiveEnd)}`}
                  {pickerExcluded.length > 0 ? ` · ${pickerExcluded.length} excluded · ` : ' · '}
                  <span className="text-[var(--app-accent)]">
                    {pickerFinalDayCount} active day{pickerFinalDayCount !== 1 ? 's' : ''}
                  </span>
                </span>
              ) : pickerEffectiveStart
                ? `Start: ${formatShortDate(pickerEffectiveStart)} — click or drag to select end date`
                : 'Click or drag on the calendar to select a date range'}
            </div>

            {/* ── Footer ── */}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setChallengePickerOpen(false)}
                className="rounded-md border border-[color-mix(in_srgb,var(--app-text)_18%,transparent)] bg-[var(--app-panel)] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!pickerEffectiveStart || !pickerEffectiveEnd}
                onClick={() => {
                  if (!pickerEffectiveStart || !pickerEffectiveEnd) return;
                  const finalExcluded = pickerExcluded.filter(
                    k => k > pickerEffectiveStart && k < pickerEffectiveEnd
                  );
                  const challengeData = {
                    name: pickerName.trim(),
                    badge: pickerBadge,
                    start: pickerEffectiveStart,
                    end: pickerEffectiveEnd,
                    excluded: finalExcluded,
                    goalType: pickerGoalType,
                    goalTarget: pickerGoalTarget,
                    timePreset: pickerTimePreset,
                  };
                  if (pickerEditId) {
                    setChallengeList(prev => prev.map(ch => ch.id === pickerEditId ? { ...ch, ...challengeData } : ch));
                  } else {
                    const newId = `ch_${Date.now()}`;
                    setChallengeList(prev => [...prev, { id: newId, ...challengeData }]);
                  }
                  setChallengePickerOpen(false);
                }}
                className="rounded-md border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--app-accent)] hover:border-[var(--app-accent)] disabled:opacity-40 disabled:pointer-events-none"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={!!challengeDeleteTarget}
        title="Delete Challenge"
        message="Delete this challenge and all its progress?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setChallengeDeleteTarget(null)}
        onConfirm={() => {
          if (!challengeDeleteTarget) return;
          setChallengeList(prev => prev.filter(ch => ch.id !== challengeDeleteTarget));
          setChallengeCompletions(prev => {
            const next = { ...prev };
            delete next[challengeDeleteTarget];
            return next;
          });
          setChallengeDeleteTarget(null);
        }}
      />

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
      {detailTaskId ? (
        <QuestDetailPanel taskId={detailTaskId} onClose={() => setDetailTaskId(null)} />
      ) : null}
      </div>
    </div>
  );
};
