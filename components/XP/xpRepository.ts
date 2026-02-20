import {
  XPMode,
  XPSettings,
  XPCompletion,
  XPCompletionSource,
  XPManualLog,
  XPTaskEvent,
  XPTaskEventType,
  Task,
  XPLedgerState,
  XPSession,
  XPSessionImpact,
  XPSessionSource,
} from './xpTypes';

const LEDGER_KEY_PREFIX = 'xpLedger_v2';
const LEGACY_LEDGER_KEY = 'xpLedger_v1';
const LEGACY_MISSIONS_KEY = 'missions';
const TIME_XP_PREFIX = 'timeXP_day_';

const MODE_TARGETS: Record<XPMode, number> = {
  Easy: 480,
  Medium: 720,
  Hard: 960,
  Extreme: 1080,
};

const DEFAULT_SETTINGS: XPSettings = {
  scheduledPromptQuiet: false,
};

const normalizeUserId = (userId?: string | null) => {
  if (!userId || typeof userId !== 'string') return null;
  const trimmed = userId.trim();
  return trimmed.length ? trimmed : null;
};

const buildCacheKey = (userId?: string | null) => {
  const normalized = normalizeUserId(userId);
  return `${LEDGER_KEY_PREFIX}:${normalized || 'anon'}`;
};

const safeParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const formatDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateTime = (dateKey: string, time: string) => {
  const [hour, minute] = time.split(':').map((v) => Number(v));
  if (Number.isNaN(hour) || Number.isNaN(minute)) return Date.now();
  const [year, month, day] = dateKey.split('-').map((v) => Number(v));
  if (!year || !month || !day) return Date.now();
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
};

const normalizeMode = (value: unknown): XPMode => {
  return value === 'Easy' || value === 'Medium' || value === 'Hard' || value === 'Extreme' ? value : 'Hard';
};

const normalizeImpact = (value: unknown): XPSessionImpact => {
  if (value === 'medium') return 'medium';
  if (value === 'hard' || value === 'high') return 'hard';
  if (value === 'normal' || value === 'low') return 'normal';
  return 'normal';
};

const normalizeSource = (value: unknown): XPSessionSource => {
  if (value === 'timer' || value === 'manual' || value === 'challenge' || value === 'import') return value;
  return 'import';
};

const normalizeCompletionSource = (value: unknown): XPCompletionSource => {
  if (value === 'manual_done' || value === 'retro' || value === 'session') return value;
  return 'manual_done';
};

const normalizeTaskEventType = (value: unknown): XPTaskEventType => {
  if (
    value === 'created' ||
    value === 'scheduled' ||
    value === 'completed' ||
    value === 'retro' ||
    value === 'archived' ||
    value === 'unarchived'
  ) {
    return value;
  }
  return 'created';
};

const normalizeSettings = (value: unknown): XPSettings => {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS;
  const raw = value as Partial<XPSettings>;
  return {
    scheduledPromptQuiet: !!raw.scheduledPromptQuiet,
  };
};

const normalizeTask = (task: any): Task => {
  const now = Date.now();
  const priority =
    task?.priority === 'normal' || task?.priority === 'high' || task?.priority === 'urgent'
      ? task.priority
      : 'normal';
  const status =
    task?.status === 'todo' || task?.status === 'active' || task?.status === 'done' || task?.status === 'dropped'
      ? task.status
      : 'todo';
  const icon =
    task?.icon === 'sword' || task?.icon === 'shield' || task?.icon === 'star' || task?.icon === 'zap' || task?.icon === 'flag'
      ? task.icon
      : 'flag';
  const ruleType =
    task?.ruleType === 'countdown' || task?.ruleType === 'anytime' || task?.ruleType === 'scheduled'
      ? task.ruleType
      : undefined;
  const estimate = Number(task?.estimatedMinutes ?? task?.estimatedXP ?? task?.estimateMinutes);
  const estimatedMinutes = Number.isFinite(estimate) && estimate > 0 ? Math.floor(estimate) : undefined;
  const completedAt = Number.isFinite(task?.completedAt)
    ? Math.floor(task.completedAt)
    : status === 'done'
      ? Number.isFinite(task?.updatedAt)
        ? Math.floor(task.updatedAt)
        : now
      : undefined;
  const completedDateKey =
    typeof task?.completedDateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.completedDateKey)
      ? task.completedDateKey
      : completedAt
        ? formatDateKey(new Date(completedAt))
        : undefined;
  const archivedAt = Number.isFinite(task?.archivedAt)
    ? Math.floor(task.archivedAt)
    : status === 'dropped'
      ? Number.isFinite(task?.updatedAt)
        ? Math.floor(task.updatedAt)
        : now
      : undefined;

  return {
    id: typeof task?.id === 'string' && task.id ? task.id : `task-${now}-${Math.random().toString(36).slice(2, 6)}`,
    title: typeof task?.title === 'string' && task.title.trim() ? task.title : 'Untitled Task',
    details: typeof task?.details === 'string' ? task.details : '',
    priority,
    status,
    completedAt,
    completedDateKey,
    archivedAt,
    scheduledAt: Number.isFinite(task?.scheduledAt) ? task.scheduledAt : Number.isFinite(task?.dueAt) ? task.dueAt : undefined,
    estimatedMinutes,
    // Legacy field kept only for backward compatibility with old snapshots.
    estimatedXP: undefined,
    ruleType,
    countdownMin: Number.isFinite(task?.countdownMin) ? Math.max(1, Math.floor(task.countdownMin)) : undefined,
    linkedSessionIds: Array.isArray(task?.linkedSessionIds)
      ? task.linkedSessionIds.filter((id: unknown): id is string => typeof id === 'string')
      : [],
    notes: typeof task?.notes === 'string' ? task.notes : undefined,
    icon,
    createdAt: Number.isFinite(task?.createdAt) ? task.createdAt : now,
    updatedAt: Number.isFinite(task?.updatedAt) ? task.updatedAt : now,
  };
};

const normalizeSession = (session: any): XPSession => {
  const now = Date.now();
  const startAt = Number.isFinite(session?.startAt) ? session.startAt : now;
  const safeEndAtRaw = Number.isFinite(session?.endAt) ? session.endAt : startAt;
  const baseEndAt = Math.max(startAt, safeEndAtRaw);

  const status =
    session?.status === 'running' || session?.status === 'completed' || session?.status === 'canceled'
      ? session.status
      : 'completed';

  const rawDurationMs = Number(session?.durationMs ?? session?.accumulatedMs);
  const rawDurationMinutes = Number(session?.durationMinutes ?? session?.baseXP ?? session?.earnedXP);
  const fallbackDurationMs = Math.max(0, baseEndAt - startAt);
  const normalizedDurationMs =
    status === 'canceled'
      ? 0
      : Number.isFinite(rawDurationMs) && rawDurationMs >= 0
        ? Math.floor(rawDurationMs)
        : Number.isFinite(rawDurationMinutes) && rawDurationMinutes >= 0
          ? Math.floor(rawDurationMinutes * 60000)
          : fallbackDurationMs;
  const accumulatedMs =
    Number.isFinite(session?.accumulatedMs) && session.accumulatedMs >= 0
      ? Math.floor(session.accumulatedMs)
      : normalizedDurationMs;
  const runningStartedAt =
    status === 'running'
      ? Number.isFinite(session?.runningStartedAt)
        ? Math.max(startAt, Math.floor(session.runningStartedAt))
        : startAt
      : null;
  const durationMs = status === 'running' ? Math.max(0, accumulatedMs) : Math.max(0, normalizedDurationMs);
  const endAt = status === 'running' ? baseEndAt : Math.max(baseEndAt, startAt + durationMs);
  const durationMinutes = Math.max(0, Math.floor(durationMs / 60000));

  const linkedTaskIds = Array.isArray(session?.linkedTaskIds)
    ? session.linkedTaskIds.filter((id: unknown): id is string => typeof id === 'string')
    : typeof session?.taskId === 'string'
      ? [session.taskId]
      : [];

  return {
    id:
      typeof session?.id === 'string' && session.id
        ? session.id
        : `session-${now}-${Math.random().toString(36).slice(2, 6)}`,
    taskId: typeof session?.taskId === 'string' ? session.taskId : linkedTaskIds[0],
    title: typeof session?.title === 'string' && session.title.trim() ? session.title : 'Session',
    tag: typeof session?.tag === 'string' && session.tag.trim() ? session.tag : 'Focus',
    source: normalizeSource(session?.source),
    linkedTaskIds,
    linkedChallengeId: typeof session?.linkedChallengeId === 'string' ? session.linkedChallengeId : undefined,
    startAt,
    endAt,
    durationMs,
    accumulatedMs: status === 'running' ? Math.max(0, accumulatedMs) : durationMs,
    runningStartedAt,
    durationMinutes,
    status,
    impactRating: normalizeImpact(session?.impactRating ?? session?.impact),
    notes: typeof session?.notes === 'string' ? session.notes : undefined,
    createdAt: Number.isFinite(session?.createdAt) ? session.createdAt : now,
    updatedAt: Number.isFinite(session?.updatedAt) ? session.updatedAt : now,
  };
};

const normalizeCompletion = (completion: any): XPCompletion => {
  const now = Date.now();
  const createdAt = Number.isFinite(completion?.createdAt) ? completion.createdAt : now;
  const date = new Date(createdAt);
  const dateKey =
    typeof completion?.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(completion.dateKey)
      ? completion.dateKey
      : formatDateKey(date);
  return {
    id:
      typeof completion?.id === 'string' && completion.id
        ? completion.id
        : `completion-${createdAt}-${Math.random().toString(36).slice(2, 6)}`,
    taskId: typeof completion?.taskId === 'string' ? completion.taskId : '',
    createdAt,
    dateKey,
    note: typeof completion?.note === 'string' ? completion.note : undefined,
    minutes: Number.isFinite(completion?.minutes) ? Math.max(0, Math.floor(completion.minutes)) : 0,
    source: normalizeCompletionSource(completion?.source),
  };
};

const normalizeTaskEvent = (event: any): XPTaskEvent => {
  const now = Date.now();
  const createdAt = Number.isFinite(event?.createdAt) ? event.createdAt : now;
  const dateKey =
    typeof event?.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.dateKey)
      ? event.dateKey
      : formatDateKey(new Date(createdAt));
  return {
    id:
      typeof event?.id === 'string' && event.id
        ? event.id
        : `task-event-${createdAt}-${Math.random().toString(36).slice(2, 6)}`,
    taskId: typeof event?.taskId === 'string' ? event.taskId : '',
    type: normalizeTaskEventType(event?.type),
    createdAt,
    dateKey,
    minutes: Number.isFinite(event?.minutes) ? Math.max(0, Math.floor(event.minutes)) : undefined,
    note: typeof event?.note === 'string' ? event.note : undefined,
    source: typeof event?.source === 'string' ? event.source : undefined,
  };
};

const normalizeManualLog = (log: any): XPManualLog => {
  const now = Date.now();
  const createdAt = Number.isFinite(log?.createdAt) ? log.createdAt : now;
  const dateKey =
    typeof log?.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(log.dateKey)
      ? log.dateKey
      : formatDateKey(new Date(createdAt));
  return {
    id:
      typeof log?.id === 'string' && log.id
        ? log.id
        : `manual-log-${createdAt}-${Math.random().toString(36).slice(2, 6)}`,
    taskId: typeof log?.taskId === 'string' && log.taskId ? log.taskId : undefined,
    createdAt,
    dateKey,
    minutes: Number.isFinite(log?.minutes) ? Math.max(0, Math.floor(log.minutes)) : 0,
    note: typeof log?.note === 'string' ? log.note : undefined,
    tag: typeof log?.tag === 'string' ? log.tag : undefined,
  };
};

const repairRunningSessions = (sessions: XPSession[]): XPSession[] => {
  const now = Date.now();
  const running = sessions.filter((session) => session.status === 'running');
  if (running.length <= 1) return sessions;

  const keep = [...running].sort((a, b) => b.startAt - a.startAt)[0];
  return sessions.map((session) => {
    if (session.status !== 'running' || session.id === keep.id) return session;
    const baseMs = Math.max(0, Math.floor(session.accumulatedMs ?? session.durationMs ?? session.durationMinutes * 60000));
    const runningMs = session.runningStartedAt ? Math.max(0, now - session.runningStartedAt) : 0;
    const durationMs = baseMs + runningMs;
    const endAt = Math.max(session.startAt, session.startAt + durationMs);
    return {
      ...session,
      endAt,
      durationMs,
      accumulatedMs: durationMs,
      runningStartedAt: null,
      durationMinutes: Math.max(0, Math.floor(durationMs / 60000)),
      status: 'completed',
      updatedAt: now,
    };
  });
};

const buildLegacySessions = (): XPSession[] => {
  if (typeof window === 'undefined') return [];
  const sessions: XPSession[] = [];
  const keys = Object.keys(localStorage).filter((key) => key.startsWith(TIME_XP_PREFIX));
  keys.forEach((key) => {
    const dateKey = key.replace(TIME_XP_PREFIX, '');
    const day = safeParse<any>(localStorage.getItem(key));
    if (!day?.entries) return;
    day.entries.forEach((entry: any) => {
      const durationMinutes = Number(entry.durationMinutes || entry.points || 0) || 0;
      const durationMs = Math.max(0, Math.floor(durationMinutes * 60000));
      const startAt = entry.startTime ? parseDateTime(dateKey, entry.startTime) : Date.now();
      const endAt = entry.endTime ? parseDateTime(dateKey, entry.endTime) : startAt + durationMs;
      sessions.push({
        id: `import-${entry.id || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        taskId: undefined,
        title: entry.title || 'Imported Session',
        tag: entry.type || 'import',
        source: 'import',
        linkedTaskIds: [],
        startAt,
        endAt,
        durationMs,
        accumulatedMs: durationMs,
        runningStartedAt: null,
        durationMinutes: Math.max(0, Math.floor(durationMs / 60000)),
        status: 'completed',
        impactRating: 'normal',
        notes: 'Migrated from legacy TimeXP.',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });
  return sessions;
};

const buildLegacyTasksAndXP = () => {
  if (typeof window === 'undefined') return { tasks: [], legacyXP: 0 };
  const stored = safeParse<any[]>(localStorage.getItem(LEGACY_MISSIONS_KEY)) || [];
  let legacyXP = 0;
  const tasks = stored.map((mission) => {
    const priority =
      mission.priority === 'HIGH' ? 'urgent' : mission.priority === 'MEDIUM' ? 'high' : 'normal';
    if (mission.completed) legacyXP += mission.xp || 0;
    return normalizeTask({
      id: mission.id,
      title: mission.title,
      details: '',
      priority,
      status: mission.completed ? 'done' : 'todo',
      scheduledAt: mission.deadline,
      icon: mission.icon,
      createdAt: mission.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
  });
  return { tasks, legacyXP };
};

const createEmptyState = (): XPLedgerState => {
  const todayKey = formatDateKey();
  return {
    tasks: [],
    sessions: [],
    completions: [],
    manualLogs: [],
    taskEvents: [],
    challenges: [],
    dayConfigs: {
      [todayKey]: { dateKey: todayKey, mode: 'Hard', targetXP: MODE_TARGETS.Hard },
    },
    settings: DEFAULT_SETTINGS,
    legacyXP: 0,
  };
};

const normalizeDayConfigs = (raw: any, todayKey: string) => {
  const next: XPLedgerState['dayConfigs'] = {};
  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([key, value]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      const mode = normalizeMode((value as any)?.mode);
      next[key] = {
        dateKey: key,
        mode,
        targetXP: MODE_TARGETS[mode],
      };
    });
  }
  if (!next[todayKey]) {
    next[todayKey] = { dateKey: todayKey, mode: 'Hard', targetXP: MODE_TARGETS.Hard };
  }
  return next;
};

const migrateLedger = (stored: any): XPLedgerState => {
  const todayKey = formatDateKey();
  const base = createEmptyState();
  if (!stored || typeof stored !== 'object') return base;

  const tasks = Array.isArray(stored.tasks)
    ? stored.tasks
        .filter((task: any) => task && typeof task === 'object')
        .map(normalizeTask)
    : base.tasks;

  const sessionsRaw = Array.isArray(stored.sessions)
    ? stored.sessions.filter((session: any) => session && typeof session === 'object')
    : base.sessions;
  const sessions = repairRunningSessions(sessionsRaw.map(normalizeSession));
  const completions = Array.isArray(stored.completions)
    ? stored.completions
        .filter((item: any) => item && typeof item === 'object')
        .map(normalizeCompletion)
        .filter((item) => !!item.taskId)
    : [];
  const manualLogs = Array.isArray(stored.manualLogs)
    ? stored.manualLogs
        .filter((item: any) => item && typeof item === 'object')
        .map(normalizeManualLog)
    : [];
  const taskEvents = Array.isArray(stored.taskEvents)
    ? stored.taskEvents
        .filter((item: any) => item && typeof item === 'object')
        .map(normalizeTaskEvent)
        .filter((item) => !!item.taskId)
    : [];

  // Backfill timeline events so day activity can be derived from sessions + taskEvents only.
  const taskEventIds = new Set(taskEvents.map((event) => event.id));
  const completionEvents = completions
    .filter((completion) => !taskEventIds.has(completion.id))
    .map((completion) => ({
      id: completion.id,
      taskId: completion.taskId,
      type: 'completed' as const,
      createdAt: completion.createdAt,
      dateKey: completion.dateKey,
      minutes: completion.minutes,
      note: completion.note,
      source: completion.source,
    }));
  completionEvents.forEach((event) => taskEventIds.add(event.id));

  const retroEvents = manualLogs
    .filter((entry) => !!entry.taskId && !taskEventIds.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      taskId: entry.taskId as string,
      type: 'retro' as const,
      createdAt: entry.createdAt,
      dateKey: entry.dateKey,
      minutes: entry.minutes,
      note: entry.note,
      source: 'manual',
    }));

  const fallbackTaskEvents = tasks.flatMap((task) => {
    const events: XPTaskEvent[] = [];
    const createdDateKey = formatDateKey(new Date(task.createdAt));
    const createdId = `task-created-${task.id}-${createdDateKey}`;
    if (!taskEvents.some((event) => event.taskId === task.id && event.type === 'created') && !taskEventIds.has(createdId)) {
      events.push({
        id: createdId,
        taskId: task.id,
        type: 'created',
        createdAt: task.createdAt,
        dateKey: createdDateKey,
        source: 'system',
      });
      taskEventIds.add(createdId);
    }

    if (task.scheduledAt) {
      const scheduledDateKey = formatDateKey(new Date(task.scheduledAt));
      const scheduledId = `task-scheduled-${task.id}-${scheduledDateKey}`;
      if (
        !taskEvents.some(
          (event) => event.taskId === task.id && event.type === 'scheduled' && event.dateKey === scheduledDateKey
        ) &&
        !taskEventIds.has(scheduledId)
      ) {
        events.push({
          id: scheduledId,
          taskId: task.id,
          type: 'scheduled',
          createdAt: task.updatedAt || task.createdAt,
          dateKey: scheduledDateKey,
          source: 'system',
          note: 'Scheduled task',
        });
        taskEventIds.add(scheduledId);
      }
    }

    if (task.completedDateKey) {
      const completedId = `task-completed-${task.id}-${task.completedDateKey}`;
      if (
        !taskEvents.some(
          (event) => event.taskId === task.id && event.type === 'completed' && event.dateKey === task.completedDateKey
        ) &&
        !taskEventIds.has(completedId)
      ) {
        events.push({
          id: completedId,
          taskId: task.id,
          type: 'completed',
          createdAt: task.completedAt || task.updatedAt || task.createdAt,
          dateKey: task.completedDateKey,
          minutes: 0,
          source: 'manual_done',
          note: 'No time logged',
        });
        taskEventIds.add(completedId);
      }
    }
    return events;
  });

  const taskById = new Map<string, Task>(tasks.map((task) => [task.id, task] as [string, Task]));
  sessions.forEach((session) => {
    session.linkedTaskIds.forEach((taskId) => {
      const task = taskById.get(taskId);
      if (!task) return;
      if (!task.linkedSessionIds.includes(session.id)) {
        task.linkedSessionIds.push(session.id);
      }
    });
    if (!session.taskId && session.linkedTaskIds.length) {
      session.taskId = session.linkedTaskIds[0];
    }
  });

  return {
    ...base,
    tasks,
    sessions,
    completions,
    manualLogs,
    taskEvents: [...taskEvents, ...completionEvents, ...retroEvents, ...fallbackTaskEvents],
    challenges: Array.isArray(stored.challenges) ? stored.challenges : base.challenges,
    dayConfigs: normalizeDayConfigs(stored.dayConfigs, todayKey),
    settings: normalizeSettings(stored.settings),
    legacyXP: typeof stored.legacyXP === 'number' ? stored.legacyXP : base.legacyXP,
  };
};

const buildLegacySeedState = (): XPLedgerState => {
  const base = createEmptyState();
  const { tasks, legacyXP } = buildLegacyTasksAndXP();
  const sessions = buildLegacySessions();
  return {
    ...base,
    tasks,
    sessions,
    legacyXP,
  };
};

export const xpRepository = {
  getLocalKey: (userId?: string | null) => buildCacheKey(userId),
  getCacheKey: (userId?: string | null) => buildCacheKey(userId),
  createEmpty: (): XPLedgerState => createEmptyState(),
  load: (
    userId?: string | null,
    options?: { allowLegacyMigration?: boolean; initializeIfMissing?: boolean }
  ): XPLedgerState => {
    const normalizedUserId = normalizeUserId(userId);
    const cacheKey = buildCacheKey(normalizedUserId);
    const allowLegacyMigration = options?.allowLegacyMigration ?? !normalizedUserId;
    const initializeIfMissing = options?.initializeIfMissing ?? true;

    if (typeof window === 'undefined') return createEmptyState();

    const stored = safeParse<XPLedgerState>(localStorage.getItem(cacheKey));
    if (stored) return migrateLedger(stored);

    if (allowLegacyMigration) {
      const legacy = safeParse<any>(localStorage.getItem(LEGACY_LEDGER_KEY));
      if (legacy) {
        const migrated = migrateLedger(legacy);
        localStorage.setItem(cacheKey, JSON.stringify(migrated));
        return migrated;
      }

      if (!normalizedUserId) {
        const seeded = buildLegacySeedState();
        localStorage.setItem(cacheKey, JSON.stringify(seeded));
        return seeded;
      }
    }

    const initial = createEmptyState();
    if (initializeIfMissing) {
      localStorage.setItem(cacheKey, JSON.stringify(initial));
    }
    return initial;
  },
  save: (state: XPLedgerState, userId?: string | null) => {
    if (typeof window === 'undefined') return;
    const cacheKey = buildCacheKey(userId);
    localStorage.setItem(cacheKey, JSON.stringify(state));
  },
  reset: (userId?: string | null): XPLedgerState => {
    const normalizedUserId = normalizeUserId(userId);
    const cacheKey = buildCacheKey(normalizedUserId);
    const initial = createEmptyState();
    if (typeof window === 'undefined') return initial;

    localStorage.removeItem(cacheKey);
    if (!normalizedUserId) {
      localStorage.removeItem(LEGACY_LEDGER_KEY);
      localStorage.removeItem(LEGACY_MISSIONS_KEY);
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(TIME_XP_PREFIX)) localStorage.removeItem(key);
      });
    }

    localStorage.setItem(cacheKey, JSON.stringify(initial));
    return initial;
  },
  normalize: (state: unknown): XPLedgerState => {
    return migrateLedger(state as any);
  },
};
