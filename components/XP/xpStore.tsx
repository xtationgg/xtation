import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Challenge,
  ChallengeMode,
  ChallengePrivacy,
  ChallengeRules,
  Task,
  XPCompletion,
  XPCompletionSource,
  XPDayActivityItem,
  XPDayActivityGroup,
  XPDayConfig,
  XPLedgerState,
  XPManualLog,
  XPMode,
  XPSession,
  XPSessionImpact,
  XPSessionSource,
  XPStats,
  XPTaskEvent,
  Project,
  Milestone,
  SelfTreeNode,
  QuestLevel,
  XPBreakdown,
  MomentumState,
  InventoryCategory,
  InventorySlot,
} from './xpTypes';
import { xpRepository } from './xpRepository';
import { useAuth } from '../../src/auth/AuthProvider';
import { getOrCreateLedger, resetCloudLedgerForCurrentUser, saveLedger } from '../../src/data/userLedger';
import type { UserLedger } from '../../src/types/ledger';
import { parseQuestNotesAndSteps } from '../../src/lib/quests/steps';

const MODE_TARGETS: Record<XPMode, number> = {
  Easy: 480,
  Medium: 720,
  Hard: 960,
  Extreme: 1080,
};

const CLOUD_SNAPSHOT_KEY = '__xp_state_v1';
const SYNC_DEBOUNCE_MS = 1500;

const getDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDayBounds = (key: string) => {
  const [year, month, day] = key.split('-').map((value) => Number(value));
  const start = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
  return { start, end: start + 86400000 };
};

const getOverlapMs = (startA: number, endA: number, startB: number, endB: number) => {
  const start = Math.max(startA, startB);
  const end = Math.min(endA, endB);
  return Math.max(0, end - start);
};

const buildDayConfig = (dateKey: string, mode: XPMode = 'Hard'): XPDayConfig => ({
  dateKey,
  mode,
  targetXP: MODE_TARGETS[mode],
});

const getRankTierFromPct = (pct: number): XPStats['rankTier'] => {
  if (pct < 25) return 'Bronze';
  if (pct < 50) return 'Silver';
  if (pct < 75) return 'Gold';
  if (pct < 100) return 'Platinum';
  return 'Diamond';
};

const getEvaluationLabel = (pct: number): XPMode => {
  if (pct < 50) return 'Easy';
  if (pct < 80) return 'Medium';
  if (pct < 110) return 'Hard';
  return 'Extreme';
};

const getImpactLabel = (sessions: XPSession[]) => {
  if (!sessions.length) return 'No sessions logged';
  const impactValues: Record<XPSessionImpact, number> = { normal: 1, medium: 2, hard: 3 };
  const totalMinutes = sessions.reduce(
    (sum, session) => sum + Math.max(0, Math.floor(getSessionDisplayMs(session) / 60000)),
    0
  );
  if (totalMinutes <= 0) return 'No sessions logged';
  const weighted = sessions.reduce(
    (sum, session) =>
      sum + (impactValues[session.impactRating] ?? 1) * Math.max(0, Math.floor(getSessionDisplayMs(session) / 60000)),
    0
  );
  const avg = weighted / totalMinutes;
  if (avg < 1.5) return 'Normal impact usage';
  if (avg < 2.4) return 'Medium impact usage';
  return 'Hard impact usage';
};

const getSessionStoredMs = (session: XPSession) => {
  if (Number.isFinite(session.durationMs) && session.durationMs >= 0) return Math.floor(session.durationMs);
  if (Number.isFinite(session.accumulatedMs) && session.accumulatedMs >= 0) return Math.floor(session.accumulatedMs);
  if (Number.isFinite(session.durationMinutes) && session.durationMinutes >= 0) return Math.floor(session.durationMinutes * 60000);
  return 0;
};

const getSessionDisplayMs = (session: XPSession, now = Date.now()) => {
  const base = Math.max(0, getSessionStoredMs(session));
  if (session.status !== 'running' || !session.runningStartedAt) return base;
  return base + Math.max(0, now - session.runningStartedAt);
};

const toXPMinutes = (durationMs: number) => Math.max(0, Math.floor(durationMs / 60000));

// ─── Xtation XP Engine ────────────────────────────────────────────────────────

const SESSION_MIN_MINUTES = 3;

const LEVEL_MULTIPLIER: Record<QuestLevel, number> = {
  1: 1.00,
  2: 1.10,
  3: 1.25,
  4: 1.45,
};

const INSTANT_BASE_XP: Record<QuestLevel, number> = {
  1: 5,
  2: 10,
  3: 15,
  4: 20,
};

const STEP_XP_PER_STEP: Record<QuestLevel, number> = { 1: 1, 2: 2, 3: 3, 4: 4 };
const STEP_XP_MAX: Record<QuestLevel, number> = { 1: 5, 2: 10, 3: 15, 4: 20 };

/** Deep session bonus based on session duration in minutes. */
const getDeepSessionBonus = (minutes: number): number => {
  if (minutes >= 120) return 60;
  if (minutes >= 90) return 40;
  if (minutes >= 60) return 25;
  if (minutes >= 30) return 10;
  return 0;
};

/**
 * XP for a session contribution.
 * - Sessions under 3 minutes yield 0 XP.
 * - Sessions 30+ minutes earn a deep focus bonus.
 * @param overlapMinutes - Minutes attributed to a specific day or the full session.
 */
const calculateSessionXP = (overlapMinutes: number): number => {
  if (overlapMinutes < SESSION_MIN_MINUTES) return 0;
  return overlapMinutes + getDeepSessionBonus(overlapMinutes);
};

const parseStepsFromDetails = (details?: string): { total: number; done: number } => {
  const { steps } = parseQuestNotesAndSteps(details);
  return {
    total: steps.length,
    done: steps.filter((step) => step.done).length,
  };
};

/**
 * Schedule bonus XP.
 * +10 if completed on time, +5 if within 15 minutes late, +0 otherwise.
 */
const getScheduleBonus = (task: Task): number => {
  if (!task.scheduledAt || !task.completedAt) return 0;
  const diff = task.completedAt - task.scheduledAt;
  if (diff <= 0) return 10;
  if (diff <= 15 * 60 * 1000) return 5;
  return 0;
};

/** Full XP breakdown for a completed quest. */
const calculateQuestCompletionXP = (task: Task): XPBreakdown => {
  const level = (task.level ?? 1) as QuestLevel;
  const questType = task.questType ?? 'session';
  const multiplier = LEVEL_MULTIPLIER[level];

  const instantBaseXP = questType === 'instant' ? INSTANT_BASE_XP[level] : 0;

  const { done: doneSteps } = parseStepsFromDetails(task.details);
  const stepXP = Math.min(doneSteps * STEP_XP_PER_STEP[level], STEP_XP_MAX[level]);

  const completionBonus = Math.floor(10 * multiplier);
  const scheduleBonus = getScheduleBonus(task);

  return {
    sessionXP: 0,
    deepBonus: 0,
    instantBaseXP,
    stepXP,
    completionBonus,
    scheduleBonus,
    total: instantBaseXP + stepXP + completionBonus + scheduleBonus,
  };
};

/**
 * Permanent player level derived from total XP.
 * Level curve: xpForLevel(N) = 100 × N^1.35
 * Returns the highest N where xpForLevel(N) ≤ totalXP, minimum 0.
 */
const getPlayerLevel = (totalXP: number): number => {
  if (totalXP < 100) return 0;
  let level = 1;
  while (Math.round(100 * Math.pow(level + 1, 1.35)) <= totalXP) {
    level++;
  }
  return level;
};

// ─── Phase 5: Momentum / Streak System ────────────────────────────────────────

const STREAK_THRESHOLDS: Array<[number, number]> = [
  [30, 1.15],
  [14, 1.12],
  [7, 1.08],
  [3, 1.05],
  [1, 1.02],
];

const getStreakMultiplier = (streak: number): number => {
  for (const [threshold, mult] of STREAK_THRESHOLDS) {
    if (streak >= threshold) return mult;
  }
  return 1.0;
};

const getWeeklyBonus = (activeDaysInWeek: number): number => {
  if (activeDaysInWeek >= 7) return 35;
  if (activeDaysInWeek >= 5) return 20;
  if (activeDaysInWeek >= 3) return 10;
  return 0;
};

const getISOWeekKey = (dateKey: string): string => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeek = date.getDay() || 7;
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + 4 - dayOfWeek);
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};

const getActiveDayKeys = (state: XPLedgerState): Set<string> => {
  const days = new Set<string>();
  state.sessions
    .filter((s) => s.status !== 'canceled' && toXPMinutes(getSessionDisplayMs(s)) >= SESSION_MIN_MINUTES)
    .forEach((s) => {
      const dk = /^\d{4}-\d{2}-\d{2}$/.test(s.tag) ? s.tag : getDateKey(new Date(s.startAt));
      days.add(dk);
    });
  state.completions.forEach((c) => days.add(c.dateKey));
  state.manualLogs.filter((l) => l.minutes > 0).forEach((l) => days.add(l.dateKey));
  return days;
};

const computeCurrentStreak = (activeDays: Set<string>, todayKey: string): number => {
  let streak = 0;
  let check = todayKey;
  for (let i = 0; i < 400; i++) {
    if (!activeDays.has(check)) break;
    streak++;
    const [y, m, d] = check.split('-').map(Number);
    check = getDateKey(new Date(y, m - 1, d - 1));
  }
  return streak;
};

const computeLongestStreak = (activeDays: Set<string>): number => {
  if (!activeDays.size) return 0;
  const sorted = [...activeDays].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const [py, pm, pd] = sorted[i - 1].split('-').map(Number);
    const [cy, cm, cd] = sorted[i].split('-').map(Number);
    const diff = Math.round(
      (new Date(cy, cm - 1, cd).getTime() - new Date(py, pm - 1, pd).getTime()) / 86400000
    );
    if (diff === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
};

const computeTotalWeeklyBonusXP = (activeDays: Set<string>): number => {
  if (!activeDays.size) return 0;
  const weekCounts = new Map<string, number>();
  for (const dk of activeDays) {
    const wk = getISOWeekKey(dk);
    weekCounts.set(wk, (weekCounts.get(wk) || 0) + 1);
  }
  let total = 0;
  for (const count of weekCounts.values()) {
    total += getWeeklyBonus(count);
  }
  return total;
};

const computeMomentum = (state: XPLedgerState, todayKey: string): MomentumState => {
  const activeDays = getActiveDayKeys(state);
  const currentStreak = computeCurrentStreak(activeDays, todayKey);
  const longestStreak = computeLongestStreak(activeDays);
  const weekKey = getISOWeekKey(todayKey);
  const weeklyActiveDays = [...activeDays].filter((dk) => getISOWeekKey(dk) === weekKey).length;
  const sortedDays = [...activeDays].sort();
  return {
    currentStreak,
    longestStreak,
    lastActiveDateKey: sortedDays.at(-1) ?? '',
    weeklyActiveDays,
    weekKey,
    streakMultiplier: getStreakMultiplier(currentStreak),
    weeklyBonus: getWeeklyBonus(weeklyActiveDays),
  };
};

const syncSessionDurations = (session: XPSession): XPSession => {
  const durationMs = Math.max(0, Math.floor(session.durationMs ?? getSessionStoredMs(session)));
  const accumulatedMs =
    session.status === 'running'
      ? Math.max(0, Math.floor(session.accumulatedMs ?? durationMs))
      : durationMs;
  return {
    ...session,
    durationMs,
    accumulatedMs,
    durationMinutes: toXPMinutes(durationMs),
    runningStartedAt: session.status === 'running' ? session.runningStartedAt ?? session.startAt : null,
    endAt: session.status === 'running' ? session.endAt : Math.max(session.endAt, session.startAt + durationMs),
  };
};

const getSessionEndAt = (session: XPSession, now = Date.now()) => {
  const displayMs = getSessionDisplayMs(session, now);
  return Math.max(session.startAt, session.startAt + displayMs);
};

const getSessionOverlapMsForDay = (session: XPSession, dayStart: number, dayEnd: number, now = Date.now()) => {
  return getOverlapMs(session.startAt, getSessionEndAt(session, now), dayStart, dayEnd);
};

const getSessionOverlapMinutesForDay = (session: XPSession, dateKey: string, now = Date.now()) => {
  const { start, end } = getDayBounds(dateKey);
  const overlapMs = getSessionOverlapMsForDay(session, start, end, now);
  return Math.max(0, Math.floor(overlapMs / 60000));
};

const isEventInDay = (
  event: { createdAt?: number; updatedAt?: number; dateKey?: string },
  dateKey: string
) => {
  const { start, end } = getDayBounds(dateKey);
  if (Number.isFinite(event.createdAt)) {
    const value = event.createdAt as number;
    return value >= start && value < end;
  }
  if (Number.isFinite(event.updatedAt)) {
    const value = event.updatedAt as number;
    return value >= start && value < end;
  }
  return event.dateKey === dateKey;
};

const cloneLedgerState = (ledger: XPLedgerState): XPStateSnapshot => {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(ledger);
    }
    return JSON.parse(JSON.stringify(ledger)) as XPStateSnapshot;
  } catch (err) {
    console.error('[xp] Failed to clone ledger state:', err);
    return { ...ledger } as XPStateSnapshot;
  }
};

const getLedgerSyncSignature = (ledger: XPLedgerState): string => {
  return JSON.stringify({
    tasks: ledger.tasks,
    sessions: ledger.sessions,
    taskEvents: ledger.taskEvents,
    dayConfigs: ledger.dayConfigs,
    projects: ledger.projects,
    milestones: ledger.milestones,
    selfTreeNodes: ledger.selfTreeNodes,
    inventorySlots: ledger.inventorySlots,
  });
};

const readSnapshotFromCloudLedger = (cloudLedger: UserLedger): XPStateSnapshot | null => {
  const raw = cloudLedger.days?.[CLOUD_SNAPSHOT_KEY];
  if (!raw || typeof raw !== 'object') return null;
  return xpRepository.normalize(raw);
};

const buildCloudLedgerPayload = (
  previous: UserLedger | null,
  snapshot: XPStateSnapshot,
  totalXp: number
): UserLedger => ({
  xp: Math.max(0, Math.floor(totalXp)),
  days: {
    ...(previous?.days || {}),
    [CLOUD_SNAPSHOT_KEY]: snapshot,
  },
  meta: {
    ...(previous?.meta || {}),
    lastSync: new Date().toISOString(),
  },
});

const snapshotFromCloudRecord = (record: UserLedger): XPStateSnapshot => {
  const snapshot = readSnapshotFromCloudLedger(record);
  if (!snapshot) {
    return xpRepository.createEmpty();
  }
  return snapshot;
};

export type XPDomainState = Pick<
  XPLedgerState,
  'tasks' | 'sessions' | 'completions' | 'manualLogs' | 'taskEvents' | 'challenges' | 'dayConfigs'
>;

export type XPStateSnapshot = XPLedgerState;

type XPDaySummary = {
  minutesTracked: number;
  completedCount: number;
  scheduledCount: number;
  activityCount: number;
  runningCount: number;
};

type XPTopTaskSummary = {
  taskId: string;
  title: string;
  minutes: number;
  running: boolean;
  doneToday: boolean;
  scheduledToday: boolean;
  category: string;
};

type XPCategoryBreakdownRow = {
  category: string;
  minutes: number;
};

const isSessionInDate = (session: XPSession, dateKey: string, now = Date.now()) => {
  const { start, end } = getDayBounds(dateKey);
  return getSessionOverlapMsForDay(session, start, end, now) > 0;
};

const getSessionMsForDate = (session: XPSession, dateKey: string, now = Date.now()) => {
  const { start, end } = getDayBounds(dateKey);
  return getSessionOverlapMsForDay(session, start, end, now);
};

export const XPSelectors = {
  getDateKey(date?: Date): string {
    return getDateKey(date);
  },
  getTodaySessions(state: XPDomainState, dateKey: string): XPSession[] {
    return state.sessions
      .filter((session) => session.status !== 'canceled' && isSessionInDate(session, dateKey))
      .sort((a, b) => b.startAt - a.startAt);
  },
  getTodayCompletedSessions(state: XPDomainState, dateKey: string): XPSession[] {
    return state.sessions
      .filter((session) => session.status === 'completed' && isSessionInDate(session, dateKey))
      .sort((a, b) => b.startAt - a.startAt);
  },
  getTodayXP(state: XPDomainState, dateKey: string, now = Date.now()): number {
    // Uses the Xtation XP Engine formula: base minutes + deep session bonuses,
    // with a 3-minute minimum. Separate from getTrackedMinutesForDay which
    // always returns raw minutes for time-display purposes.
    const xp = this.getTodaySessions(state, dateKey).reduce((sum, session) => {
      const overlapMinutes = getSessionOverlapMinutesForDay(session, dateKey, now);
      return sum + calculateSessionXP(overlapMinutes);
    }, 0);
    return Math.max(0, xp);
  },
  getTargetXP(state: XPDomainState, dateKey: string): number {
    const dayConfig = state.dayConfigs[dateKey];
    if (dayConfig?.mode) return MODE_TARGETS[dayConfig.mode];
    return MODE_TARGETS.Hard;
  },
  getProgressPct(state: XPDomainState, dateKey: string): number {
    const target = this.getTargetXP(state, dateKey);
    const todayXP = this.getTodayXP(state, dateKey);
    if (target <= 0) return 0;
    return Math.round((todayXP / target) * 100);
  },
  getRankTier(state: XPDomainState, dateKey: string): XPStats['rankTier'] {
    return getRankTierFromPct(this.getProgressPct(state, dateKey));
  },
  getActiveSession(state: XPDomainState): XPSession | null {
    const running = state.sessions.filter((session) => session.status === 'running');
    if (!running.length) return null;
    return [...running].sort((a, b) => b.startAt - a.startAt)[0];
  },
  getSessionDisplayMs(state: XPDomainState, session: XPSession, now = Date.now()): number {
    return getSessionDisplayMs(session, now);
  },
  getSessionMsForDate(state: XPDomainState, session: XPSession, dateKey: string, now = Date.now()): number {
    return getSessionMsForDate(session, dateKey, now);
  },
  getTaskById(state: XPDomainState, id: string): Task | null {
    return state.tasks.find((task) => task.id === id) || null;
  },
  getTasksActive(state: XPDomainState): Task[] {
    const runningTaskIds = new Set<string>();
    state.sessions
      .filter((session) => session.status === 'running')
      .forEach((session) => {
        if (session.taskId) runningTaskIds.add(session.taskId);
        (session.linkedTaskIds || []).forEach((taskId) => runningTaskIds.add(taskId));
      });
    return state.tasks
      .filter((task) => {
        if (task.archivedAt || task.completedAt) return false;
        if (task.status === 'dropped' || task.status === 'done') return runningTaskIds.has(task.id);
        return task.status === 'todo' || task.status === 'active' || task.status === 'paused' || runningTaskIds.has(task.id);
      })
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  },
  getActiveTasks(state: XPDomainState): Task[] {
    return this.getTasksActive(state);
  },
  getTaskSessions(state: XPDomainState, taskId: string): XPSession[] {
    return state.sessions
      .filter((session) => (session.linkedTaskIds || []).includes(taskId))
      .sort((a, b) => b.startAt - a.startAt);
  },
  getTaskTodayXP(state: XPDomainState, taskId: string, dateKey: string): number {
    return Math.max(0, Math.floor(this.getTaskTodayMs(state, taskId, dateKey) / 60000));
  },
  getTaskTodayMs(state: XPDomainState, taskId: string, dateKey: string, now = Date.now()): number {
    return this.getTaskSessions(state, taskId)
      .filter((session) => isSessionInDate(session, dateKey, now))
      .reduce((sum, session) => sum + getSessionMsForDate(session, dateKey, now), 0);
  },
  getTaskMinutesForDay(state: XPDomainState, taskId: string, dateKey: string, now = Date.now()): number {
    return Math.max(0, Math.floor(this.getTaskTodayMs(state, taskId, dateKey, now) / 60000));
  },
  getDayCompletions(state: XPDomainState, dateKey: string): XPCompletion[] {
    return state.completions
      .filter((completion) => isEventInDay(completion, dateKey))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  getDayManualLogs(state: XPDomainState, dateKey: string): XPManualLog[] {
    return state.manualLogs
      .filter((entry) => isEventInDay(entry, dateKey))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  getDayTaskEvents(state: XPDomainState, dateKey: string): XPTaskEvent[] {
    return state.taskEvents
      .filter((entry) => isEventInDay(entry, dateKey))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  getDayActivity(state: XPDomainState, dateKey: string, now = Date.now()): XPDayActivityItem[] {
    const taskById = new Map(state.tasks.map((task) => [task.id, task]));

    const sessions: XPDayActivityItem[] = this.getTodaySessions(state, dateKey)
      .map((session) => {
        const taskId = session.taskId || session.linkedTaskIds?.[0];
        const task = taskId ? taskById.get(taskId) : undefined;
        const minutes = getSessionOverlapMinutesForDay(session, dateKey, now);
        return {
          kind: 'session',
          id: session.id,
          taskId,
          dateKey,
          minutes,
          createdAt: session.startAt,
          statusLabel: session.status.toUpperCase(),
          title: task?.title || session.title || 'Session',
          note: session.notes,
          source: session.source,
        };
      });

    const taskEvents: XPDayActivityItem[] = this.getDayTaskEvents(state, dateKey).map((event) => {
      const task = taskById.get(event.taskId);
      const base = {
        id: event.id,
        taskId: event.taskId,
        dateKey,
        createdAt: event.createdAt,
        title: task?.title || 'Task event',
        note: event.note,
        source: event.source || 'task_event',
      };
      switch (event.type) {
        case 'completed':
          return {
            ...base,
            kind: 'completion' as const,
            minutes: Math.max(0, event.minutes || 0),
            statusLabel: 'COMPLETED',
            note: event.note || (event.minutes ? undefined : 'No time logged'),
          };
        case 'retro':
          return {
            ...base,
            kind: 'manual' as const,
            minutes: Math.max(0, event.minutes || 0),
            statusLabel: 'RETRO',
          };
        case 'scheduled':
          return {
            ...base,
            kind: 'created' as const,
            minutes: 0,
            statusLabel: 'SCHEDULED',
          };
        case 'archived':
          return {
            ...base,
            kind: 'created' as const,
            minutes: 0,
            statusLabel: 'HIDDEN',
          };
        case 'unarchived':
          return {
            ...base,
            kind: 'created' as const,
            minutes: 0,
            statusLabel: 'UNHIDDEN',
          };
        case 'created':
        default:
          return {
            ...base,
            kind: 'created' as const,
            minutes: 0,
            statusLabel: 'CREATED',
          };
      }
    });

    return [...sessions, ...taskEvents].sort((a, b) => b.createdAt - a.createdAt);
  },
  getDayActivityGrouped(state: XPDomainState, dateKey: string, now = Date.now()): XPDayActivityGroup[] {
    const activity = this.getDayActivity(state, dateKey, now);
    const taskById = new Map(state.tasks.map((task) => [task.id, task]));
    const groups = new Map<string, XPDayActivityGroup>();

    activity.forEach((entry) => {
      const groupKey = entry.taskId ? `task:${entry.taskId}` : 'unassigned';
      const existing = groups.get(groupKey);
      const task = entry.taskId ? taskById.get(entry.taskId) : undefined;
      const title = task?.title || entry.title || 'Unassigned activity';

      if (!existing) {
        groups.set(groupKey, {
          key: groupKey,
          taskId: entry.taskId,
          dateKey,
          title,
          totalMinutes: Math.max(0, entry.minutes),
          latestAt: entry.createdAt,
          latestStatusLabel: entry.statusLabel,
          hasCompletion: entry.kind === 'completion',
          hasSession: entry.kind === 'session',
          hasRetro: entry.kind === 'manual',
          hasCreated: entry.kind === 'created',
          hasRunning: entry.kind === 'session' && entry.statusLabel === 'RUNNING',
          entries: [entry],
          archivedAt: task?.archivedAt,
        });
        return;
      }

      existing.totalMinutes += Math.max(0, entry.minutes);
      if (entry.createdAt >= existing.latestAt) {
        existing.latestStatusLabel = entry.statusLabel;
      }
      existing.latestAt = Math.max(existing.latestAt, entry.createdAt);
      existing.hasCompletion = existing.hasCompletion || entry.kind === 'completion';
      existing.hasSession = existing.hasSession || entry.kind === 'session';
      existing.hasRetro = existing.hasRetro || entry.kind === 'manual';
      existing.hasCreated = existing.hasCreated || entry.kind === 'created';
      existing.hasRunning = existing.hasRunning || (entry.kind === 'session' && entry.statusLabel === 'RUNNING');
      existing.entries.push(entry);
      existing.archivedAt = task?.archivedAt ?? existing.archivedAt;
    });

    return [...groups.values()]
      .map((group) => ({
        ...group,
        entries: [...group.entries].sort((a, b) => b.createdAt - a.createdAt),
      }))
      .sort((a, b) => b.latestAt - a.latestAt);
  },
  getDaySummary(state: XPDomainState, dateKey: string, now = Date.now()): XPDaySummary {
    const completedCount = this.getCompletedCountForDay(state, dateKey);
    const runningCount = this.getTodaySessions(state, dateKey).filter((session) => session.status === 'running').length;
    const scheduledCount = state.tasks.filter((task) => {
      if (!task.scheduledAt || task.archivedAt) return false;
      return getDateKey(new Date(task.scheduledAt)) === dateKey;
    }).length;
    const minutesTracked = this.getTrackedMinutesForDay(state, dateKey, now);
    const activityCount = this.getDayActivityCount(state, dateKey, now);
    return {
      minutesTracked,
      completedCount,
      scheduledCount,
      activityCount,
      runningCount,
    };
  },
  getRunningSession(
    state: XPDomainState,
    now = Date.now()
  ): { taskId?: string; sessionId: string; elapsedSeconds: number } | null {
    const session = this.getActiveSession(state);
    if (!session) return null;
    return {
      taskId: session.taskId || session.linkedTaskIds?.[0],
      sessionId: session.id,
      elapsedSeconds: Math.max(0, Math.floor(getSessionDisplayMs(session, now) / 1000)),
    };
  },
  getDayHasActivity(state: XPDomainState, dateKey: string, now = Date.now()): boolean {
    return this.getDayActivityGrouped(state, dateKey, now).length > 0;
  },
  getTrackedMinutesForDay(state: XPDomainState, dateKey: string, now = Date.now()): number {
    const sessionMinutes = this.getTodaySessions(state, dateKey).reduce(
      (sum, session) => sum + getSessionOverlapMinutesForDay(session, dateKey, now),
      0
    );
    return Math.max(0, sessionMinutes);
  },
  getDayActivityCount(state: XPDomainState, dateKey: string, now = Date.now()): number {
    const sessionCount = this.getTodaySessions(state, dateKey).filter(
      (session) => this.getSessionMsForDate(state, session, dateKey, now) > 0
    ).length;
    const eventCount = this.getDayTaskEvents(state, dateKey).length;
    return sessionCount + eventCount;
  },
  getCompletedCountForDay(state: XPDomainState, dateKey: string): number {
    return this.getDayTaskEvents(state, dateKey).filter((entry) => entry.type === 'completed').length;
  },
  getTopTasksForDay(state: XPDomainState, dateKey: string, limit = 5, now = Date.now()): XPTopTaskSummary[] {
    const taskById = new Map(state.tasks.map((task) => [task.id, task]));
    const sessionMinutesByTask = new Map<string, number>();
    const todaySessions = this.getTodaySessions(state, dateKey);

    todaySessions.forEach((session) => {
      const minutes = getSessionOverlapMinutesForDay(session, dateKey, now);
      if (minutes <= 0) return;
      const taskIds = Array.from(
        new Set(
          [session.taskId, ...(session.linkedTaskIds || [])].filter(
            (taskId): taskId is string => typeof taskId === 'string' && taskById.has(taskId)
          )
        )
      );
      taskIds.forEach((taskId) => {
        sessionMinutesByTask.set(taskId, (sessionMinutesByTask.get(taskId) || 0) + minutes);
      });
    });

    const dayEvents = this.getDayTaskEvents(state, dateKey);
    const doneTaskIds = new Set(dayEvents.filter((entry) => entry.type === 'completed').map((entry) => entry.taskId));
    const scheduledTaskIds = new Set(dayEvents.filter((entry) => entry.type === 'scheduled').map((entry) => entry.taskId));
    const runningSession = this.getActiveSession(state);
    const runningTaskIds = new Set<string>(
      [
        runningSession?.taskId,
        ...((runningSession?.linkedTaskIds || []).filter((taskId) => typeof taskId === 'string') as string[]),
      ].filter((taskId): taskId is string => !!taskId)
    );

    // Only include running task IDs for today — a running session cannot belong to past/future days
    const todayKey = getDateKey();
    const candidateTaskIds = new Set<string>([
      ...sessionMinutesByTask.keys(),
      ...doneTaskIds.values(),
      ...scheduledTaskIds.values(),
      ...(dateKey === todayKey ? runningTaskIds.values() : []),
    ]);

    return [...candidateTaskIds]
      .map((taskId) => {
        const task = taskById.get(taskId);
        if (!task) return null;
        const category = task.category?.trim() || 'General';
        return {
          taskId,
          title: task.title,
          minutes: sessionMinutesByTask.get(taskId) || 0,
          running: runningTaskIds.has(taskId),
          doneToday: doneTaskIds.has(taskId),
          scheduledToday: scheduledTaskIds.has(taskId),
          category,
        } satisfies XPTopTaskSummary;
      })
      .filter((entry): entry is XPTopTaskSummary => !!entry)
      .sort((a, b) => {
        if (b.minutes !== a.minutes) return b.minutes - a.minutes;
        if (a.running !== b.running) return a.running ? -1 : 1;
        if (a.doneToday !== b.doneToday) return a.doneToday ? -1 : 1;
        if (a.scheduledToday !== b.scheduledToday) return a.scheduledToday ? -1 : 1;
        return a.title.localeCompare(b.title);
      })
      .slice(0, Math.max(1, Math.floor(limit)));
  },
  getLastNDays(_state: XPDomainState, n = 7): string[] {
    const safeN = Math.max(1, Math.floor(n));
    const today = new Date();
    const result: string[] = [];
    for (let offset = safeN - 1; offset >= 0; offset -= 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset, 0, 0, 0, 0);
      result.push(getDateKey(date));
    }
    return result;
  },
  getWeekRangeLabel(_state: XPDomainState, dateKeys: string[]): string {
    if (!dateKeys.length) return '';
    const parseKey = (key: string) => {
      const [year, month, day] = key.split('-').map((value) => Number(value));
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    };
    const first = parseKey(dateKeys[0]);
    const last = parseKey(dateKeys[dateKeys.length - 1]);
    const firstLabel = first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const sameMonth = first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth();
    const lastLabel = last.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
    return `${firstLabel}-${lastLabel}`;
  },
  getCategoryBreakdownForRange(
    state: XPDomainState,
    startDateKey: string,
    endDateKey: string,
    now = Date.now()
  ): XPCategoryBreakdownRow[] {
    const parseKey = (key: string) => {
      const [year, month, day] = key.split('-').map((value) => Number(value));
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    };
    const taskById = new Map(state.tasks.map((task) => [task.id, task]));
    const breakdown = new Map<string, number>();
    const startDate = parseKey(startDateKey);
    const endDate = parseKey(endDateKey);
    const cursorStart = startDate <= endDate ? startDate : endDate;
    const cursorEnd = startDate <= endDate ? endDate : startDate;
    const cursor = new Date(cursorStart);

    while (cursor <= cursorEnd) {
      const dayKey = getDateKey(cursor);
      this.getTodaySessions(state, dayKey).forEach((session) => {
        const taskId = session.taskId || session.linkedTaskIds?.[0];
        const task = taskId ? taskById.get(taskId) : undefined;
        const category = task?.category?.trim() || 'General';
        const minutes = getSessionOverlapMinutesForDay(session, dayKey, now);
        if (minutes <= 0) return;
        breakdown.set(category, (breakdown.get(category) || 0) + minutes);
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return [...breakdown.entries()]
      .map(([category, minutes]) => ({ category, minutes }))
      .sort((a, b) => b.minutes - a.minutes || a.category.localeCompare(b.category))
      .slice(0, 5);
  },
};

interface StartPayload {
  title: string;
  tag: string;
  source: XPSessionSource;
  linkedTaskIds?: string[];
  linkedChallengeId?: string;
}

interface XPContextValue {
  now: number;
  dateKey: string;
  activeLogDateKey: string;
  currentAuthUserId: string | null;
  ledgerCacheKey: string;
  ledgerSource: 'cloud' | 'anon-local';
  dayConfig: XPDayConfig;
  tasks: Task[];
  sessions: XPSession[];
  completions: XPCompletion[];
  manualLogs: XPManualLog[];
  taskEvents: XPTaskEvent[];
  challenges: Challenge[];
  stats: XPStats;
  legacyXP: number;
  isHydrated: boolean;
  syncStatus: 'idle' | 'loading' | 'saving' | 'error';
  lastSyncedAt?: string;
  authStatus: 'signedOut' | 'loadingCloud' | 'cloudReady';
  cloudResetStatus: 'idle' | 'saving' | 'saved' | 'error';
  cloudResetMessage?: string;
  selectors: {
    getDateKey: (date?: Date) => string;
    getTodaySessions: (dateKey?: string) => XPSession[];
    getTodayCompletedSessions: (dateKey?: string) => XPSession[];
    getTodayXP: (dateKey?: string) => number;
    getTargetXP: (dateKey?: string) => number;
    getProgressPct: (dateKey?: string) => number;
    getRankTier: (dateKey?: string) => XPStats['rankTier'];
    getActiveSession: () => XPSession | null;
    getSessionDisplayMs: (session: XPSession, now?: number) => number;
    getSessionMsForDate: (session: XPSession, dateKey?: string, now?: number) => number;
    getTaskById: (id: string) => Task | null;
    getTasksActive: () => Task[];
    getActiveTasks: () => Task[];
    getTaskSessions: (taskId: string) => XPSession[];
    getTaskTodayXP: (taskId: string, dateKey?: string) => number;
    getTaskTodayMs: (taskId: string, dateKey?: string, now?: number) => number;
    getTaskMinutesForDay: (taskId: string, dateKey?: string, now?: number) => number;
    getRunningSession: (now?: number) => { taskId?: string; sessionId: string; elapsedSeconds: number } | null;
    getDayCompletions: (dateKey?: string) => XPCompletion[];
    getDayManualLogs: (dateKey?: string) => XPManualLog[];
    getDayTaskEvents: (dateKey?: string) => XPTaskEvent[];
    getDayActivity: (dateKey?: string, now?: number) => XPDayActivityItem[];
    getDayActivityGrouped: (dateKey?: string, now?: number) => XPDayActivityGroup[];
    getDaySummary: (dateKey?: string, now?: number) => XPDaySummary;
    getDayHasActivity: (dateKey?: string, now?: number) => boolean;
    getTrackedMinutesForDay: (dateKey?: string, now?: number) => number;
    getDayActivityCount: (dateKey?: string, now?: number) => number;
    getCompletedCountForDay: (dateKey?: string) => number;
    getTopTasksForDay: (dateKey?: string, limit?: number, now?: number) => XPTopTaskSummary[];
    getCategoryBreakdownForRange: (
      startDateKey: string,
      endDateKey: string,
      now?: number
    ) => XPCategoryBreakdownRow[];
    getLastNDays: (n?: number) => string[];
    getWeekRangeLabel: (dateKeys: string[]) => string;
    /** Full XP breakdown for a quest on completion. Returns null if task not found. */
    getQuestCompletionXP: (taskId: string) => XPBreakdown | null;
    /** Session XP for a given overlap in minutes using the engine formula. */
    getSessionXP: (overlapMinutes: number) => number;
    /** Current momentum / streak state derived from ledger data. */
    getMomentum: () => MomentumState;
  };
  activeSessionId: string | null;
  elapsedSeconds: number;
  scheduledPromptQuiet: boolean;
  setMode: (mode: XPMode) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'linkedSessionIds'>) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  completeTask: (
    taskId: string,
    opts?: { note?: string; minutes?: number; source?: XPCompletionSource; createdAt?: number; completionId?: string }
  ) => string | null;
  archiveTask: (taskId: string, atTimestamp?: number) => void;
  unarchiveTask: (taskId: string) => void;
  dropTask: (id: string) => void;
  removeTask: (id: string) => void;
  deleteTaskCompletely: (taskId: string) => void;
  snoozeTask: (id: string, minutes: number) => void;
  setScheduledPromptQuiet: (quiet: boolean) => void;
  addManualSession: (payload: {
    title: string;
    tag: string;
    minutes: number;
    startAt?: number;
    notes?: string;
    linkedTaskIds?: string[];
    impactRating?: XPSessionImpact;
  }) => void;
  addRetroMinutes: (taskId: string | null | undefined, minutes: number, note?: string, atTimestamp?: number) => void;
  startSession: (payload: StartPayload) => string | null;
  stopSession: () => void;
  pauseSession: () => void;
  resumeTaskSession: (taskId: string) => string | null;
  splitSession: () => string | null;
  cancelSession: (id?: string) => void;
  updateSession: (id: string, patch: Partial<XPSession>) => void;
  deleteSession: (sessionId: string) => void;
  deleteCompletion: (completionId: string) => void;
  deleteLogItem: (item: Pick<XPDayActivityItem, 'kind' | 'id'>) => void;
  reassignSessionTask: (sessionId: string, taskId: string | null) => void;
  deleteDayActivity: (dateKey: string) => void;
  createChallenge: (payload: {
    mode: ChallengeMode;
    name: string;
    details: string;
    rules: ChallengeRules;
    privacy: ChallengePrivacy;
  }) => Challenge;
  updateChallenge: (id: string, patch: Partial<Challenge>) => void;
  // ─── Phase 2: Projects ────────────────────────────────────────────────────
  projects: Project[];
  addProject: (payload: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  // ─── Phase 2: Milestones ──────────────────────────────────────────────────
  milestones: Milestone[];
  addMilestone: (payload: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateMilestone: (id: string, patch: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;
  completeMilestone: (id: string) => void;
  // ─── Phase 2: Self Tree ───────────────────────────────────────────────────
  selfTreeNodes: SelfTreeNode[];
  addSelfTreeNode: (payload: Omit<SelfTreeNode, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateSelfTreeNode: (id: string, patch: Partial<SelfTreeNode>) => void;
  deleteSelfTreeNode: (id: string) => void;
  // ─── Phase 8: Inventory Data Model ────────────────────────────────────────
  inventorySlots: InventorySlot[];
  addInventorySlot: (payload: Omit<InventorySlot, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateInventorySlot: (id: string, patch: Partial<InventorySlot>) => void;
  deleteInventorySlot: (id: string) => void;
  resetToday: () => void;
  setActiveLogDateKey: (key: string) => void;
  getLedgerSnapshot: () => XPStateSnapshot;
  replaceLedger: (snapshot: XPStateSnapshot, markHydrated?: boolean) => void;
  replaceLedgerSnapshot: (snapshot: XPStateSnapshot, markHydrated?: boolean) => void;
  hydrateFromLedger: (snapshot: XPStateSnapshot) => void;
  setActiveUser: (userId: string | null) => void;
  repairLedgerLinks: () => void;
  resetLocalData: () => void;
  resetAccountData: () => Promise<void>;
}

const XPContext = createContext<XPContextValue | null>(null);

export const useXP = () => {
  const ctx = useContext(XPContext);
  if (!ctx) throw new Error('useXP must be used within XPProvider');
  return ctx;
};

export const XPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const currentAuthUserId = user?.id || null;
  const ledgerCacheKey = xpRepository.getCacheKey(currentAuthUserId);
  const [ledger, setLedger] = useState<XPLedgerState>(() => xpRepository.createEmpty());
  const [ledgerSource, setLedgerSource] = useState<'cloud' | 'anon-local'>('anon-local');
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<XPContextValue['syncStatus']>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);
  const [authStatus, setAuthStatus] = useState<XPContextValue['authStatus']>('signedOut');
  const [cloudResetStatus, setCloudResetStatus] = useState<XPContextValue['cloudResetStatus']>('idle');
  const [cloudResetMessage, setCloudResetMessage] = useState<string | undefined>(undefined);
  const [dateKey, setDateKey] = useState(() => getDateKey());
  const [activeLogDateKey, setActiveLogDateKeyState] = useState<string>(() => getDateKey());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return XPSelectors.getActiveSession(ledger)?.id || null;
  });
  const [timerNow, setTimerNow] = useState<number>(Date.now());
  const timerRef = useRef<number | null>(null);
  const syncUserIdRef = useRef<string | null>(null);
  const syncLoadingRef = useRef(false);
  const syncSavingRef = useRef(false);
  const syncSkipNextSaveRef = useRef(false);
  const syncSaveTimerRef = useRef<number | null>(null);
  const syncLastSavedSignatureRef = useRef('');
  const syncLoadRequestIdRef = useRef(0);
  const cloudLedgerRef = useRef<UserLedger | null>(null);

  const replaceLedgerState = (snapshot: XPStateSnapshot, markHydrated = true) => {
    const normalized = xpRepository.normalize(snapshot);
    const nextDateKey = getDateKey();
    const running = XPSelectors.getActiveSession(normalized);
    setLedger(normalized);
    setDateKey(nextDateKey);
    setActiveLogDateKeyState(nextDateKey);
    setActiveSessionId(running?.id || null);
    setTimerNow(Date.now());
    setIsHydrated(markHydrated);
  };

  const clearLedgerForSwitch = () => {
    const empty = xpRepository.createEmpty();
    replaceLedgerState(empty, false);
    setActiveSessionId(null);
    setTimerNow(Date.now());
  };

  const setActiveUser: XPContextValue['setActiveUser'] = (nextUserId) => {
    const normalizedUserId = nextUserId?.trim() ? nextUserId.trim() : null;
    const requestId = syncLoadRequestIdRef.current + 1;
    syncLoadRequestIdRef.current = requestId;

    if (syncSaveTimerRef.current) {
      window.clearTimeout(syncSaveTimerRef.current);
      syncSaveTimerRef.current = null;
    }

    syncLoadingRef.current = false;
    syncSavingRef.current = false;
    syncSkipNextSaveRef.current = false;
    syncLastSavedSignatureRef.current = '';
    syncUserIdRef.current = normalizedUserId;
    cloudLedgerRef.current = null;
    setCloudResetStatus('idle');
    setCloudResetMessage(undefined);
    setLastSyncedAt(undefined);

    // Hard clear before any auth-scoped load to prevent cross-account flashes.
    clearLedgerForSwitch();

    if (!normalizedUserId) {
      setLedgerSource('anon-local');
      setSyncStatus('idle');
      setAuthStatus('signedOut');
      setIsHydrated(true);
      return;
    }

    setLedgerSource('cloud');
    setSyncStatus('loading');
    setAuthStatus('loadingCloud');
    syncLoadingRef.current = true;

    (async () => {
      try {
        // Optional fast cache for the same user; cloud still overwrites unconditionally.
        const cached = xpRepository.load(normalizedUserId, {
          allowLegacyMigration: false,
          initializeIfMissing: false,
        });
        if (
          syncLoadRequestIdRef.current === requestId &&
          syncUserIdRef.current === normalizedUserId &&
          isHydrated
        ) {
          replaceLedgerState(cached, false);
        }

        const cloudRecord = await getOrCreateLedger();
        if (syncLoadRequestIdRef.current !== requestId || syncUserIdRef.current !== normalizedUserId) return;

        let nextSnapshot: XPStateSnapshot;
        try {
          nextSnapshot = snapshotFromCloudRecord(cloudRecord.ledger);
        } catch (snapshotError) {
          console.warn('[xp-sync] Invalid cloud ledger snapshot. Falling back to empty state.', snapshotError);
          nextSnapshot = xpRepository.createEmpty();
        }

        // On first-ever login, migrate anonymous local data into the new cloud account.
        if (cloudRecord.isNew) {
          const anonSnapshot = xpRepository.load(null, { allowLegacyMigration: true, initializeIfMissing: false });
          const hasAnonData =
            anonSnapshot.tasks.length > 0 ||
            anonSnapshot.sessions.length > 0 ||
            anonSnapshot.manualLogs.length > 0;
          if (hasAnonData) {
            nextSnapshot = anonSnapshot;
            const totalMs = anonSnapshot.sessions
              .filter((s) => s.status === 'completed' || s.status === 'paused')
              .reduce((sum, s) => sum + getSessionDisplayMs(s), 0);
            const totalXp =
              toXPMinutes(totalMs) +
              anonSnapshot.manualLogs.reduce((sum, e) => sum + Math.max(0, e.minutes), 0);
            const migratePayload = buildCloudLedgerPayload(null, anonSnapshot, totalXp);
            try {
              const saved = await saveLedger(migratePayload);
              if (syncLoadRequestIdRef.current === requestId && syncUserIdRef.current === normalizedUserId) {
                cloudLedgerRef.current = saved.ledger;
              }
            } catch (migrateError) {
              console.warn('[xp-sync] Failed to migrate anonymous data to cloud on first login:', migrateError);
            }
            if (syncLoadRequestIdRef.current !== requestId || syncUserIdRef.current !== normalizedUserId) return;
          }
        }

        if (!cloudRecord.isNew || !cloudLedgerRef.current) {
          cloudLedgerRef.current = cloudRecord.ledger;
        }
        replaceLedgerState(nextSnapshot, true);
        syncSkipNextSaveRef.current = true;
        syncLastSavedSignatureRef.current = getLedgerSyncSignature(nextSnapshot);
        xpRepository.save(nextSnapshot, normalizedUserId);
        setLastSyncedAt(cloudRecord.clientUpdatedAt ?? undefined);
        setSyncStatus('idle');
        setAuthStatus('cloudReady');
      } catch (error) {
        if (syncLoadRequestIdRef.current !== requestId || syncUserIdRef.current !== normalizedUserId) return;
        const status = typeof error === 'object' && error && 'status' in error ? (error as { status?: number }).status : undefined;
        const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined;
        console.warn('[xp-sync] Failed to load cloud ledger (table=user_ledgers):', { status, code, error });
        replaceLedgerState(xpRepository.createEmpty(), true);
        setSyncStatus('error');
        setAuthStatus('cloudReady');
      } finally {
        if (syncLoadRequestIdRef.current === requestId) {
          syncLoadingRef.current = false;
        }
      }
    })();
  };

  useEffect(() => {
    return () => {
      if (syncSaveTimerRef.current) {
        window.clearTimeout(syncSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDateKey((prev) => {
        const nextKey = getDateKey();
        return nextKey !== prev ? nextKey : prev;
      });
    }, 60000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable interval, no deps needed
  }, []);

  useEffect(() => {
    const running = XPSelectors.getActiveSession(ledger);
    if (running && running.id !== activeSessionId) {
      setActiveSessionId(running.id);
      setTimerNow(Date.now());
    }
    if (!running && activeSessionId) {
      setActiveSessionId(null);
    }
  }, [ledger.sessions, activeSessionId]);

  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!ledger.dayConfigs[dateKey]) {
      setLedger((prev) => ({
        ...prev,
        dayConfigs: {
          ...prev.dayConfigs,
          [dateKey]: buildDayConfig(dateKey, 'Hard'),
        },
      }));
    }
    if (!prevSettingsExists(ledger)) {
      setLedger((prev) => ({
        ...prev,
        settings: { scheduledPromptQuiet: false },
      }));
    }
  }, [dateKey, ledger]);

  useEffect(() => {
    if (authLoading) return;
    setActiveUser(currentAuthUserId);
  }, [authLoading, currentAuthUserId]);

  const dayConfig = ledger.dayConfigs[dateKey] || buildDayConfig(dateKey);
  const activeSession = XPSelectors.getActiveSession(ledger);
  const elapsedSeconds = activeSession ? Math.max(0, Math.floor(getSessionDisplayMs(activeSession, timerNow) / 1000)) : 0;

  const stats = useMemo<XPStats>(() => {
    // Selectors are the single source of truth; do not recompute in UI.
    const todayCompletedSessions = XPSelectors.getTodayCompletedSessions(ledger, dateKey);
    const todayEarnedXP = XPSelectors.getTodayXP(ledger, dateKey);
    const todayTargetXP = XPSelectors.getTargetXP(ledger, dateKey);
    // Session XP: apply new engine formula (3-min minimum + deep bonuses).
    const totalSessionXP = ledger.sessions
      .filter((session) => session.status === 'completed' || session.status === 'paused')
      .reduce((sum, session) => sum + calculateSessionXP(toXPMinutes(getSessionDisplayMs(session))), 0);
    // Completion XP: step XP + completion bonus + schedule bonus for every done quest.
    const totalCompletionXP = ledger.tasks
      .filter((task) => task.status === 'done')
      .reduce((sum, task) => sum + calculateQuestCompletionXP(task).total, 0);
    const totalEarnedXP =
      totalSessionXP +
      ledger.manualLogs.reduce((sum, entry) => sum + Math.max(0, entry.minutes), 0) +
      totalCompletionXP;
    const momentum = computeMomentum(ledger, dateKey);
    // Apply streak multiplier to today's XP for display.
    const todayEarnedXPWithMomentum = Math.round(todayEarnedXP * momentum.streakMultiplier);
    // Total weekly bonuses across all past and current weeks.
    const totalWeeklyBonusXP = computeTotalWeeklyBonusXP(getActiveDayKeys(ledger));
    const totalEarnedXPWithBonuses = totalEarnedXP + totalWeeklyBonusXP;
    const todayPercent = todayTargetXP > 0
      ? Math.round((todayEarnedXPWithMomentum / todayTargetXP) * 100)
      : 0;
    const evaluationLabel = getEvaluationLabel(todayPercent);
    const impactLabel = getImpactLabel(todayCompletedSessions);
    const playerLevel = getPlayerLevel(totalEarnedXPWithBonuses);
    return {
      todayEarnedXP: todayEarnedXPWithMomentum,
      todayTargetXP,
      todayRawXP: todayEarnedXP,
      todayRemainingXP: Math.max(0, todayTargetXP - todayEarnedXPWithMomentum),
      todayPercent,
      overcapPercent: Math.max(0, todayPercent - 100),
      evaluationLabel,
      progressPct: todayPercent,
      rankTier: XPSelectors.getRankTier(ledger, dateKey),
      totalEarnedXP: totalEarnedXPWithBonuses,
      dailyEvaluation: `${evaluationLabel} · ${todayEarnedXPWithMomentum} XP (${todayPercent}%) · ${impactLabel}`,
      playerLevel,
      momentum,
    };
  }, [ledger, dateKey]);

  useEffect(() => {
    if (authLoading || !currentAuthUserId || authStatus !== 'cloudReady') return;
    if (syncUserIdRef.current !== currentAuthUserId) return;
    if (syncLoadingRef.current) return;

    const signature = getLedgerSyncSignature(ledger);
    if (syncSkipNextSaveRef.current) {
      syncSkipNextSaveRef.current = false;
      syncLastSavedSignatureRef.current = signature;
      return;
    }
    if (signature === syncLastSavedSignatureRef.current) return;

    if (syncSaveTimerRef.current) {
      window.clearTimeout(syncSaveTimerRef.current);
      syncSaveTimerRef.current = null;
    }

    const saveRequestId = syncLoadRequestIdRef.current;
    const saveUserId = currentAuthUserId;
    syncSaveTimerRef.current = window.setTimeout(async () => {
      if (!saveUserId || syncLoadingRef.current || syncSavingRef.current) return;
      if (syncUserIdRef.current !== saveUserId) return;
      if (syncLoadRequestIdRef.current !== saveRequestId) return;
      syncSavingRef.current = true;
      setSyncStatus('saving');
      try {
        const snapshot = cloneLedgerState(ledger);
        const payload = buildCloudLedgerPayload(cloudLedgerRef.current, snapshot, stats.totalEarnedXP);
        const saved = await saveLedger(payload);
        if (syncLoadRequestIdRef.current !== saveRequestId || syncUserIdRef.current !== saveUserId) {
          return;
        }
        cloudLedgerRef.current = saved.ledger;
        syncLastSavedSignatureRef.current = signature;
        setLastSyncedAt(saved.clientUpdatedAt ?? new Date().toISOString());
        xpRepository.save(snapshot, saveUserId);
        setSyncStatus('idle');
      } catch (error) {
        if (syncLoadRequestIdRef.current !== saveRequestId || syncUserIdRef.current !== saveUserId) {
          return;
        }
        console.warn('[xp-sync] Failed to save cloud ledger:', error);
        setSyncStatus('error');
      } finally {
        syncSavingRef.current = false;
      }
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (syncSaveTimerRef.current) {
        window.clearTimeout(syncSaveTimerRef.current);
        syncSaveTimerRef.current = null;
      }
    };
  }, [
    authLoading,
    authStatus,
    currentAuthUserId,
    ledger.tasks,
    ledger.sessions,
    ledger.taskEvents,
    ledger.dayConfigs,
    ledger.projects,
    ledger.milestones,
    ledger.selfTreeNodes,
    ledger.inventorySlots,
    stats.totalEarnedXP,
  ]);

  const selectors = useMemo<XPContextValue['selectors']>(
    () => ({
      getDateKey: (date?: Date) => XPSelectors.getDateKey(date),
      getTodaySessions: (targetDateKey?: string) => XPSelectors.getTodaySessions(ledger, targetDateKey || dateKey),
      getTodayCompletedSessions: (targetDateKey?: string) =>
        XPSelectors.getTodayCompletedSessions(ledger, targetDateKey || dateKey),
      getTodayXP: (targetDateKey?: string) => XPSelectors.getTodayXP(ledger, targetDateKey || dateKey),
      getTargetXP: (targetDateKey?: string) => XPSelectors.getTargetXP(ledger, targetDateKey || dateKey),
      getProgressPct: (targetDateKey?: string) => XPSelectors.getProgressPct(ledger, targetDateKey || dateKey),
      getRankTier: (targetDateKey?: string) => XPSelectors.getRankTier(ledger, targetDateKey || dateKey),
      getActiveSession: () => XPSelectors.getActiveSession(ledger),
      getSessionDisplayMs: (session: XPSession, now = Date.now()) => XPSelectors.getSessionDisplayMs(ledger, session, now),
      getSessionMsForDate: (session: XPSession, targetDateKey?: string, now = Date.now()) =>
        XPSelectors.getSessionMsForDate(ledger, session, targetDateKey || dateKey, now),
      getTaskById: (id: string) => XPSelectors.getTaskById(ledger, id),
      getTasksActive: () => XPSelectors.getTasksActive(ledger),
      getActiveTasks: () => XPSelectors.getActiveTasks(ledger),
      getTaskSessions: (taskId: string) => XPSelectors.getTaskSessions(ledger, taskId),
      getTaskTodayXP: (taskId: string, targetDateKey?: string) =>
        XPSelectors.getTaskTodayXP(ledger, taskId, targetDateKey || dateKey),
      getTaskTodayMs: (taskId: string, targetDateKey?: string, now = Date.now()) =>
        XPSelectors.getTaskTodayMs(ledger, taskId, targetDateKey || dateKey, now),
      getTaskMinutesForDay: (taskId: string, targetDateKey?: string, now = Date.now()) =>
        XPSelectors.getTaskMinutesForDay(ledger, taskId, targetDateKey || dateKey, now),
      getRunningSession: (now = Date.now()) => XPSelectors.getRunningSession(ledger, now),
      getDayCompletions: (targetDateKey?: string) => XPSelectors.getDayCompletions(ledger, targetDateKey || dateKey),
      getDayManualLogs: (targetDateKey?: string) => XPSelectors.getDayManualLogs(ledger, targetDateKey || dateKey),
      getDayTaskEvents: (targetDateKey?: string) => XPSelectors.getDayTaskEvents(ledger, targetDateKey || dateKey),
      getDayActivity: (targetDateKey?: string, now = Date.now()) =>
        XPSelectors.getDayActivity(ledger, targetDateKey || dateKey, now),
      getDayActivityGrouped: (targetDateKey?: string, now = Date.now()) =>
        XPSelectors.getDayActivityGrouped(ledger, targetDateKey || dateKey, now),
      getDaySummary: (targetDateKey?: string, now = Date.now()) =>
        XPSelectors.getDaySummary(ledger, targetDateKey || dateKey, now),
      getDayHasActivity: (targetDateKey?: string, now = Date.now()) =>
        XPSelectors.getDayHasActivity(ledger, targetDateKey || dateKey, now),
      getTrackedMinutesForDay: (targetDateKey?: string, now = Date.now()) =>
        XPSelectors.getTrackedMinutesForDay(ledger, targetDateKey || dateKey, now),
      getDayActivityCount: (targetDateKey?: string, now = Date.now()) =>
        XPSelectors.getDayActivityCount(ledger, targetDateKey || dateKey, now),
      getCompletedCountForDay: (targetDateKey?: string) =>
        XPSelectors.getCompletedCountForDay(ledger, targetDateKey || dateKey),
      getTopTasksForDay: (targetDateKey?: string, limit = 5, now = Date.now()) =>
        XPSelectors.getTopTasksForDay(ledger, targetDateKey || dateKey, limit, now),
      getCategoryBreakdownForRange: (startDateKey: string, endDateKey: string, now = Date.now()) =>
        XPSelectors.getCategoryBreakdownForRange(ledger, startDateKey, endDateKey, now),
      getLastNDays: (n = 7) => XPSelectors.getLastNDays(ledger, n),
      getWeekRangeLabel: (dateKeys: string[]) => XPSelectors.getWeekRangeLabel(ledger, dateKeys),
      getQuestCompletionXP: (taskId: string) => {
        const task = XPSelectors.getTaskById(ledger, taskId);
        if (!task) return null;
        return calculateQuestCompletionXP(task);
      },
      getSessionXP: (overlapMinutes: number) => calculateSessionXP(overlapMinutes),
      getMomentum: () => computeMomentum(ledger, dateKey),
    }),
    [ledger, dateKey]
  );

  const setMode = (mode: XPMode) => {
    setLedger((prev) => ({
      ...prev,
      dayConfigs: {
        ...prev.dayConfigs,
        [dateKey]: buildDayConfig(dateKey, mode),
      },
    }));
  };

  const setActiveLogDateKey = (key: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    setActiveLogDateKeyState(key);
  };

  const buildTaskEvent = (
    taskId: string,
    type: XPTaskEvent['type'],
    createdAt = Date.now(),
    dateKeyOverride?: string,
    extras?: Partial<Pick<XPTaskEvent, 'id' | 'minutes' | 'note' | 'source'>>
  ): XPTaskEvent => ({
    id: extras?.id || `task-event-${type}-${createdAt}-${Math.random().toString(36).slice(2, 6)}`,
    taskId,
    type,
    createdAt,
    dateKey: dateKeyOverride || getDateKey(new Date(createdAt)),
    minutes: extras?.minutes,
    note: extras?.note,
    source: extras?.source,
  });

  const addTask: XPContextValue['addTask'] = (task) => {
    const now = Date.now();
    const createdDateKey = getDateKey(new Date(now));
    const estimatedMinutes = task.estimatedMinutes ?? task.estimatedXP;
    const newTask: Task = {
      id: `task-${now}-${Math.random().toString(36).slice(2, 6)}`,
      title: task.title,
      details: task.details,
      category: task.category,
      priority: task.priority,
      status: task.status,
      scheduledAt: task.scheduledAt,
      estimatedMinutes,
      ruleType: task.ruleType,
      countdownMin: task.countdownMin,
      linkedSessionIds: [],
      icon: task.icon,
      notes: task.notes,
      createdAt: now,
      updatedAt: now,
      questType: task.questType,
      level: task.level,
      selfTreePrimary: task.selfTreePrimary,
      selfTreeSecondary: task.selfTreeSecondary,
      projectId: task.projectId,
      startedAt: task.startedAt,
    };
    const createdEvent = buildTaskEvent(newTask.id, 'created', now, createdDateKey, { source: 'system' });
    const scheduledEvent =
      typeof newTask.scheduledAt === 'number'
        ? buildTaskEvent(
            newTask.id,
            'scheduled',
            now,
            getDateKey(new Date(newTask.scheduledAt)),
            { source: 'system', note: 'Scheduled task' }
          )
        : null;
    setLedger((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
      taskEvents: [createdEvent, ...(scheduledEvent ? [scheduledEvent] : []), ...prev.taskEvents],
    }));
    return newTask.id;
  };

  const updateTask = (id: string, patch: Partial<Task>) => {
    const estimatedMinutes = patch.estimatedMinutes ?? patch.estimatedXP;
    const nextPatch: Partial<Task> = {
      ...patch,
      estimatedMinutes,
      estimatedXP: undefined,
    };
    const now = Date.now();
    setLedger((prev) => {
      const current = prev.tasks.find((task) => task.id === id);
      if (!current) return prev;
      const updatedTask = { ...current, ...nextPatch, updatedAt: now };
      const appendEvents: XPTaskEvent[] = [];
      if (
        Object.prototype.hasOwnProperty.call(nextPatch, 'scheduledAt') &&
        typeof updatedTask.scheduledAt === 'number' &&
        updatedTask.scheduledAt > 0
      ) {
        appendEvents.push(
          buildTaskEvent(
            id,
            'scheduled',
            now,
            getDateKey(new Date(updatedTask.scheduledAt)),
            { source: 'system', note: 'Scheduled task' }
          )
        );
      }
      return {
        ...prev,
        tasks: prev.tasks.map((task) => (task.id === id ? updatedTask : task)),
        taskEvents: appendEvents.length ? [...appendEvents, ...prev.taskEvents] : prev.taskEvents,
      };
    });
  };

  const completeTask: XPContextValue['completeTask'] = (taskId, opts) => {
    if (!ledger.tasks.some((task) => task.id === taskId)) return null;
    const now = Number.isFinite(opts?.createdAt) ? Math.floor(opts!.createdAt as number) : Date.now();
    const completionId = opts?.completionId || `completion-${now}-${Math.random().toString(36).slice(2, 6)}`;
    const completionDateKey = getDateKey(new Date(now));
    let stoppedSessionId: string | null = null;

    setLedger((prev) => {
      const task = prev.tasks.find((item) => item.id === taskId);
      if (!task) return prev;

      const runningForTask = prev.sessions.find(
        (session) => session.status === 'running' && (session.linkedTaskIds || []).includes(taskId)
      );

      let nextSessions = prev.sessions;
      let nextChallenges = prev.challenges;
      if (runningForTask) {
        const finalized = finalizeRunningSession(prev.sessions, runningForTask.id, now, 'completed');
        if (finalized.target) {
          nextSessions = finalized.sessions;
          stoppedSessionId = runningForTask.id;
          nextChallenges = prev.challenges.map((challenge) =>
            challenge.linkedSessionId === runningForTask.id
              ? { ...challenge, status: 'ended', updatedAt: now }
              : challenge
          );
        }
      }

      const note = opts?.note?.trim();
      const completionMinutes = Number.isFinite(opts?.minutes) ? Math.max(0, Math.floor(opts!.minutes as number)) : 0;
      const completion: XPCompletion = {
        id: completionId,
        taskId,
        createdAt: now,
        dateKey: completionDateKey,
        note: note || undefined,
        minutes: completionMinutes,
        source: opts?.source || 'manual_done',
      };
      const completionEvent = buildTaskEvent(taskId, 'completed', now, completionDateKey, {
        id: completionId,
        minutes: completionMinutes,
        note: note || undefined,
        source: completion.source,
      });

      return {
        ...prev,
        sessions: nextSessions,
        completions: [completion, ...prev.completions],
        taskEvents: [completionEvent, ...prev.taskEvents],
        challenges: nextChallenges,
        tasks: prev.tasks.map((item) =>
          item.id === taskId
            ? {
                ...item,
                status: item.status === 'dropped' ? 'dropped' : 'done',
                completedAt: now,
                completedDateKey: completionDateKey,
                scheduledAt: undefined,
                updatedAt: now,
              }
            : item
        ),
      };
    });

    if (stoppedSessionId) {
      setActiveSessionId((prev) => (prev === stoppedSessionId ? null : prev));
      setTimerNow(now);
    }
    return completionId;
  };

  const archiveTask: XPContextValue['archiveTask'] = (taskId, atTimestamp = Date.now()) => {
    const now = Math.floor(atTimestamp);
    setLedger((prev) => ({
      ...prev,
      taskEvents: [
        buildTaskEvent(taskId, 'archived', now, getDateKey(new Date(now)), {
          source: 'system',
          note: 'Quest hidden',
        }),
        ...prev.taskEvents,
      ],
      tasks: prev.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: 'dropped',
              archivedAt: now,
              updatedAt: now,
            }
          : task
      ),
    }));
  };

  const unarchiveTask: XPContextValue['unarchiveTask'] = (taskId) => {
    const now = Date.now();
    setLedger((prev) => ({
      ...prev,
      taskEvents: [
        buildTaskEvent(taskId, 'unarchived', now, getDateKey(new Date(now)), {
          source: 'system',
          note: 'Quest unhidden',
        }),
        ...prev.taskEvents,
      ],
      tasks: prev.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              archivedAt: undefined,
              status: task.completedAt ? 'done' : 'todo',
              updatedAt: now,
            }
          : task
      ),
    }));
  };

  const dropTask = (id: string) => {
    archiveTask(id);
  };

  const removeTask = (id: string) => {
    setLedger((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((task) => task.id !== id),
      sessions: prev.sessions.map((session) => {
        if (!(session.linkedTaskIds || []).includes(id)) return session;
        return {
          ...session,
          taskId: session.taskId === id ? undefined : session.taskId,
          linkedTaskIds: (session.linkedTaskIds || []).filter((taskId) => taskId !== id),
          updatedAt: Date.now(),
        };
      }),
      completions: prev.completions.filter((c) => c.taskId !== id),
      manualLogs: prev.manualLogs.filter((m) => m.taskId !== id),
      taskEvents: prev.taskEvents.filter((e) => e.taskId !== id),
    }));
  };

  const deleteTaskCompletely: XPContextValue['deleteTaskCompletely'] = (taskId) => {
    const now = Date.now();
    let removedActiveSession = false;

    setLedger((prev) => {
      if (!prev.tasks.some((task) => task.id === taskId)) return prev;

      const removedSessionIds = new Set(
        prev.sessions
          .filter((session) => session.taskId === taskId || (session.linkedTaskIds || []).includes(taskId))
          .map((session) => session.id)
      );
      removedActiveSession = !!activeSessionId && removedSessionIds.has(activeSessionId);

      const nextTasks = prev.tasks
        .filter((task) => task.id !== taskId)
        .map((task) => {
          const nextLinkedSessionIds = task.linkedSessionIds.filter((id) => !removedSessionIds.has(id));
          if (nextLinkedSessionIds.length === task.linkedSessionIds.length) return task;
          return {
            ...task,
            linkedSessionIds: nextLinkedSessionIds,
            updatedAt: now,
          };
        });

      const nextChallenges = prev.challenges.map((challenge) => {
        const challengeAny = challenge as Challenge & { linkedTaskIds?: string[] };
        let nextChallenge: Challenge & { linkedTaskIds?: string[] } = challengeAny;
        let changed = false;

        if (challengeAny.linkedSessionId && removedSessionIds.has(challengeAny.linkedSessionId)) {
          nextChallenge = {
            ...nextChallenge,
            linkedSessionId: undefined,
            status: challengeAny.status === 'active' ? 'canceled' : challengeAny.status,
            updatedAt: now,
          };
          changed = true;
        }

        if (Array.isArray(challengeAny.linkedTaskIds) && challengeAny.linkedTaskIds.includes(taskId)) {
          nextChallenge = {
            ...nextChallenge,
            linkedTaskIds: challengeAny.linkedTaskIds.filter((id) => id !== taskId),
            updatedAt: now,
          };
          changed = true;
        }

        return changed ? (nextChallenge as Challenge) : challenge;
      });

      return {
        ...prev,
        tasks: nextTasks,
        sessions: prev.sessions.filter((session) => !removedSessionIds.has(session.id)),
        completions: prev.completions.filter((completion) => completion.taskId !== taskId),
        manualLogs: prev.manualLogs.filter((entry) => entry.taskId !== taskId),
        taskEvents: prev.taskEvents.filter((entry) => entry.taskId !== taskId),
        challenges: nextChallenges,
      };
    });

    if (removedActiveSession) {
      setActiveSessionId(null);
      setTimerNow(now);
    }
  };

  const snoozeTask = (id: string, minutes: number) => {
    const delta = Math.max(1, Math.floor(minutes)) * 60000;
    updateTask(id, { scheduledAt: Date.now() + delta });
  };

  const setScheduledPromptQuiet = (quiet: boolean) => {
    setLedger((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        scheduledPromptQuiet: quiet,
      },
    }));
  };

  const addManualSession: XPContextValue['addManualSession'] = (payload) => {
    const now = Date.now();
    const minutes = Math.max(0, Math.floor(payload.minutes));
    const durationMs = minutes * 60000;
    const startAt = payload.startAt ?? now - durationMs;
    const endAt = startAt + durationMs;
    const linkedTaskIds = payload.linkedTaskIds || [];
    const session: XPSession = {
      id: `session-${now}-${Math.random().toString(36).slice(2, 6)}`,
      taskId: linkedTaskIds[0],
      title: payload.title,
      tag: payload.tag,
      source: 'manual',
      linkedTaskIds,
      startAt,
      endAt,
      durationMs,
      accumulatedMs: durationMs,
      runningStartedAt: null,
      durationMinutes: minutes,
      status: 'completed',
      impactRating: payload.impactRating || 'normal',
      notes: payload.notes,
      createdAt: now,
      updatedAt: now,
    };

    setLedger((prev) => ({
      ...prev,
      sessions: [session, ...prev.sessions],
      tasks: linkedTaskIds.length
        ? prev.tasks.map((task) =>
            linkedTaskIds.includes(task.id)
              ? { ...task, linkedSessionIds: [...task.linkedSessionIds, session.id], updatedAt: now }
              : task
          )
        : prev.tasks,
    }));
  };

  const addRetroMinutes: XPContextValue['addRetroMinutes'] = (taskId, minutes, note, atTimestamp = Date.now()) => {
    const safeMinutes = Math.max(0, Math.floor(minutes));
    if (!safeMinutes) return;
    const now = Date.now();
    const createdAt = Math.floor(atTimestamp);
    const targetDateKey = getDateKey(new Date(createdAt));
    const entry: XPManualLog = {
      id: `manual-log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      taskId: taskId || undefined,
      createdAt,
      dateKey: targetDateKey,
      minutes: safeMinutes,
      note: note?.trim() || undefined,
      tag: 'Retro',
    };
    setLedger((prev) => ({
      ...prev,
      manualLogs: [entry, ...prev.manualLogs],
      taskEvents:
        taskId
          ? [
              buildTaskEvent(taskId, 'retro', createdAt, targetDateKey, {
                id: entry.id,
                minutes: safeMinutes,
                note: note?.trim() || undefined,
                source: 'manual',
              }),
              ...prev.taskEvents,
            ]
          : prev.taskEvents,
    }));
  };

  const createRunningSession = (payload: StartPayload, now = Date.now()): XPSession => {
    const linkedTaskIds = payload.linkedTaskIds || [];
    return {
      id: `session-${now}-${Math.random().toString(36).slice(2, 6)}`,
      taskId: linkedTaskIds[0],
      title: payload.title,
      tag: payload.tag,
      source: payload.source,
      linkedTaskIds,
      linkedChallengeId: payload.linkedChallengeId,
      startAt: now,
      endAt: now,
      durationMs: 0,
      accumulatedMs: 0,
      runningStartedAt: now,
      durationMinutes: 0,
      status: 'running',
      impactRating: 'normal',
      createdAt: now,
      updatedAt: now,
    };
  };

  const finalizeRunningSession = (
    sessions: XPSession[],
    sessionId: string,
    now: number,
    status: 'completed' | 'paused' | 'canceled'
  ) => {
    const target = sessions.find((session) => session.id === sessionId);
    if (!target) return { sessions, target: null as XPSession | null };
    const baseMs = Math.max(0, Math.floor(target.accumulatedMs ?? getSessionStoredMs(target)));
    const runningMs = target.runningStartedAt ? Math.max(0, now - target.runningStartedAt) : 0;
    const finalDurationMs = status === 'canceled' ? 0 : baseMs + runningMs;
    const nextSessions = sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            endAt: Math.max(session.startAt, session.startAt + finalDurationMs),
            durationMs: finalDurationMs,
            accumulatedMs: finalDurationMs,
            runningStartedAt: null,
            durationMinutes: toXPMinutes(finalDurationMs),
            status,
            updatedAt: now,
          }
        : session
    );
    return { sessions: nextSessions, target };
  };

  const startSession: XPContextValue['startSession'] = (payload) => {
    const now = Date.now();
    const session = createRunningSession(payload, now);

    setLedger((prev) => {
      let nextSessions = prev.sessions;
      let nextTasks = prev.tasks;
      let nextChallenges = prev.challenges;

      const runningSessions = prev.sessions.filter((item) => item.status === 'running');
      if (runningSessions.length) {
        nextSessions = prev.sessions.map((item) =>
          item.status === 'running'
            ? {
                ...item,
                endAt: Math.max(item.startAt, item.startAt + getSessionDisplayMs(item, now)),
                durationMs: getSessionDisplayMs(item, now),
                accumulatedMs: getSessionDisplayMs(item, now),
                runningStartedAt: null,
                durationMinutes: toXPMinutes(getSessionDisplayMs(item, now)),
                status: 'completed',
                updatedAt: now,
              }
            : item
        );
        nextTasks = nextTasks.map((task) =>
          runningSessions.some((running) => (running.linkedTaskIds || []).includes(task.id)) && task.status === 'active'
            ? { ...task, status: 'todo', updatedAt: now }
            : task
        );
        nextChallenges = nextChallenges.map((challenge) =>
          runningSessions.some((running) => challenge.linkedSessionId === running.id)
            ? { ...challenge, status: 'ended', updatedAt: now }
            : challenge
        );
      }

      nextSessions = [session, ...nextSessions];
      nextTasks = nextTasks.map((task) =>
        (session.linkedTaskIds || []).includes(task.id)
          ? {
              ...task,
              status: 'active',
              scheduledAt: undefined,
              linkedSessionIds: [...task.linkedSessionIds, session.id],
              updatedAt: now,
            }
          : task
      );
      nextChallenges = nextChallenges.map((challenge) =>
        challenge.id === payload.linkedChallengeId
          ? { ...challenge, status: 'active', linkedSessionId: session.id, updatedAt: now }
          : challenge
      );

      return {
        ...prev,
        sessions: nextSessions,
        tasks: nextTasks,
        challenges: nextChallenges,
      };
    });

    setActiveSessionId(session.id);
    setTimerNow(now);
    return session.id;
  };

  const stopSession = () => {
    const now = Date.now();
    let stoppedSessionId: string | null = null;
    setLedger((prev) => {
      const running = XPSelectors.getActiveSession(prev);
      const targetId = activeSessionId || running?.id;
      if (!targetId) return prev;
      const finalized = finalizeRunningSession(prev.sessions, targetId, now, 'completed');
      if (!finalized.target) return prev;
      stoppedSessionId = finalized.target.id;
      return {
        ...prev,
        sessions: finalized.sessions,
        tasks: prev.tasks.map((task) =>
          (finalized.target?.linkedTaskIds || []).includes(task.id) && task.status === 'active'
            ? { ...task, status: 'todo', updatedAt: now }
            : task
        ),
        challenges: prev.challenges.map((challenge) =>
          challenge.linkedSessionId === finalized.target?.id ? { ...challenge, status: 'ended', updatedAt: now } : challenge
        ),
      };
    });
    if (stoppedSessionId) {
      setActiveSessionId(null);
    }
  };

  const pauseSession = () => {
    const now = Date.now();
    let pausedSessionId: string | null = null;
    setLedger((prev) => {
      const running = XPSelectors.getActiveSession(prev);
      const targetId = activeSessionId || running?.id;
      if (!targetId) return prev;
      const finalized = finalizeRunningSession(prev.sessions, targetId, now, 'paused');
      if (!finalized.target) return prev;
      pausedSessionId = finalized.target.id;
      return {
        ...prev,
        sessions: finalized.sessions,
        tasks: prev.tasks.map((task) =>
          (finalized.target?.linkedTaskIds || []).includes(task.id) && task.status === 'active'
            ? { ...task, status: 'paused' as const, updatedAt: now }
            : task
        ),
      };
    });
    if (pausedSessionId) {
      setActiveSessionId(null);
    }
  };

  const resumeTaskSession = (taskId: string) => {
    const task = ledger.tasks.find((item) => item.id === taskId);
    if (!task) return null;
    return startSession({
      title: task.title,
      tag: task.priority.toUpperCase(),
      source: 'timer',
      linkedTaskIds: [taskId],
    });
  };

  const splitSession = () => {
    if (!activeSessionId) return null;
    const running = XPSelectors.getActiveSession(ledger);
    if (!running || running.id !== activeSessionId) return null;
    const nextId = startSession({
      title: running.title,
      tag: running.tag,
      source: running.source,
      linkedTaskIds: running.linkedTaskIds,
      linkedChallengeId: running.linkedChallengeId,
    });
    return nextId;
  };

  const cancelSession = (id?: string) => {
    const now = Date.now();
    let canceledSessionId: string | null = null;

    setLedger((prev) => {
      const running = XPSelectors.getActiveSession(prev);
      const sessionId = id || activeSessionId || running?.id;
      if (!sessionId) return prev;
      const finalized = finalizeRunningSession(prev.sessions, sessionId, now, 'canceled');
      const target = finalized.target || prev.sessions.find((session) => session.id === sessionId) || null;
      if (!target) return prev;
      canceledSessionId = sessionId;

      return {
        ...prev,
        sessions: prev.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                status: 'canceled',
                endAt: Math.max(session.startAt, now),
                durationMs: 0,
                accumulatedMs: 0,
                runningStartedAt: null,
                durationMinutes: 0,
                updatedAt: now,
              }
            : session
        ),
        tasks: prev.tasks.map((task) =>
          (target.linkedTaskIds || []).includes(task.id) && task.status === 'active'
            ? { ...task, status: 'todo', updatedAt: now }
            : task
        ),
        challenges: prev.challenges.map((challenge) =>
          challenge.linkedSessionId === sessionId ? { ...challenge, status: 'canceled', updatedAt: now } : challenge
        ),
      };
    });

    if (canceledSessionId && activeSessionId === canceledSessionId) setActiveSessionId(null);
  };

  const updateSession = (id: string, patch: Partial<XPSession>) => {
    setLedger((prev) => ({
      ...prev,
      sessions: prev.sessions.map((session) => {
        if (session.id !== id) return session;
        const next = {
          ...session,
          ...patch,
          taskId:
            patch.taskId !== undefined
              ? patch.taskId || undefined
              : patch.linkedTaskIds?.[0] ?? session.taskId,
          impactRating: patch.impactRating || session.impactRating,
          updatedAt: Date.now(),
        } as XPSession;
        if (typeof patch.durationMs === 'number') {
          const durationMs = Math.max(0, Math.floor(patch.durationMs));
          next.durationMs = durationMs;
          next.accumulatedMs = durationMs;
          next.runningStartedAt = next.status === 'running' ? next.runningStartedAt ?? next.startAt : null;
          next.durationMinutes = toXPMinutes(durationMs);
          next.endAt = Math.max(next.startAt, next.startAt + durationMs);
        }
        if (typeof patch.durationMinutes === 'number') {
          const minutes = Math.max(0, Math.floor(patch.durationMinutes));
          const durationMs = minutes * 60000;
          next.durationMs = durationMs;
          next.accumulatedMs = durationMs;
          next.runningStartedAt = next.status === 'running' ? next.runningStartedAt ?? next.startAt : null;
          next.durationMinutes = minutes;
          next.endAt = Math.max(next.startAt, next.startAt + durationMs);
        }
        if (next.status === 'canceled') {
          next.durationMs = 0;
          next.accumulatedMs = 0;
          next.runningStartedAt = null;
          next.durationMinutes = 0;
        }
        return syncSessionDurations(next);
      }),
    }));
  };

  const deleteSession = (sessionId: string) => {
    const now = Date.now();
    setLedger((prev) => {
      const target = prev.sessions.find((session) => session.id === sessionId);
      if (!target) return prev;
      const linkedTaskIds = target.linkedTaskIds || [];
      const isRunning = target.status === 'running';

      return {
        ...prev,
        sessions: prev.sessions.filter((session) => session.id !== sessionId),
        tasks: prev.tasks.map((task) => {
          const linked = linkedTaskIds.includes(task.id) || task.linkedSessionIds.includes(sessionId);
          if (!linked) return task;
          return {
            ...task,
            status: isRunning && task.status === 'active' ? 'todo' : task.status,
            linkedSessionIds: task.linkedSessionIds.filter((id) => id !== sessionId),
            updatedAt: now,
          };
        }),
        challenges: prev.challenges.map((challenge) => {
          if (challenge.linkedSessionId !== sessionId) return challenge;
          return {
            ...challenge,
            linkedSessionId: undefined,
            status: isRunning ? 'canceled' : challenge.status,
            updatedAt: now,
          };
        }),
      };
    });

    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
    }
  };

  const deleteCompletion = (completionId: string) => {
    setLedger((prev) => {
      const target = prev.completions.find((completion) => completion.id === completionId);
      if (!target) return prev;
      const completions = prev.completions.filter((completion) => completion.id !== completionId);
      const taskEvents = prev.taskEvents.filter((event) => {
        if (event.id === completionId && event.type === 'completed') return false;
        if (
          event.type === 'completed' &&
          event.taskId === target.taskId &&
          event.dateKey === target.dateKey &&
          event.createdAt === target.createdAt
        ) {
          return false;
        }
        return true;
      });
      const hasOtherCompletionForTask = completions.some(
        (completion) => completion.taskId === target.taskId && completion.dateKey === target.dateKey
      );
      return {
        ...prev,
        completions,
        taskEvents,
        tasks: prev.tasks.map((task) => {
          if (task.id !== target.taskId) return task;
          if (task.completedDateKey !== target.dateKey || hasOtherCompletionForTask) return task;
          return {
            ...task,
            completedAt: undefined,
            completedDateKey: undefined,
            status: task.archivedAt ? 'dropped' : 'todo',
            updatedAt: Date.now(),
          };
        }),
      };
    });
  };

  const deleteLogItem: XPContextValue['deleteLogItem'] = (item) => {
    if (item.kind === 'session') {
      deleteSession(item.id);
      return;
    }
    if (item.kind === 'completion') {
      if (ledger.completions.some((completion) => completion.id === item.id)) {
        deleteCompletion(item.id);
        return;
      }
      setLedger((prev) => {
        const event = prev.taskEvents.find((entry) => entry.id === item.id && entry.type === 'completed');
        if (!event) return prev;
        const nextTaskEvents = prev.taskEvents.filter((entry) => entry.id !== item.id);
        const hasOtherCompletionForTask = nextTaskEvents.some(
          (entry) =>
            entry.type === 'completed' &&
            entry.taskId === event.taskId &&
            entry.dateKey === event.dateKey
        );
        return {
          ...prev,
          taskEvents: nextTaskEvents,
          tasks: prev.tasks.map((task) => {
            if (task.id !== event.taskId) return task;
            if (task.completedDateKey !== event.dateKey || hasOtherCompletionForTask) return task;
            return {
              ...task,
              completedAt: undefined,
              completedDateKey: undefined,
              status: task.archivedAt ? 'dropped' : 'todo',
              updatedAt: Date.now(),
            };
          }),
        };
      });
      return;
    }
    if (item.kind === 'manual') {
      setLedger((prev) => ({
        ...prev,
        manualLogs: prev.manualLogs.filter((entry) => entry.id !== item.id),
        taskEvents: prev.taskEvents.filter((event) => event.id !== item.id),
      }));
      return;
    }
    if (item.kind === 'created') {
      setLedger((prev) => ({
        ...prev,
        taskEvents: prev.taskEvents.filter((entry) => entry.id !== item.id),
      }));
    }
  };

  const reassignSessionTask = (sessionId: string, taskId: string | null) => {
    const now = Date.now();
    setLedger((prev) => {
      const target = prev.sessions.find((session) => session.id === sessionId);
      if (!target || target.status === 'running') return prev;
      const oldTaskIds = target.linkedTaskIds || [];
      const nextTaskIds = taskId ? [taskId] : [];
      const nextSessions = prev.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              taskId: taskId || undefined,
              linkedTaskIds: nextTaskIds,
              updatedAt: now,
            }
          : session
      );
      const nextTasks = prev.tasks.map((task) => {
        const removed = oldTaskIds.includes(task.id);
        const added = !!taskId && task.id === taskId;
        if (!removed && !added) return task;
        const nextLinked = task.linkedSessionIds.filter((id) => id !== sessionId);
        if (added && !nextLinked.includes(sessionId)) nextLinked.push(sessionId);
        return {
          ...task,
          linkedSessionIds: nextLinked,
          updatedAt: now,
        };
      });

      return {
        ...prev,
        sessions: nextSessions,
        tasks: nextTasks,
      };
    });
  };

  const deleteDayActivity: XPContextValue['deleteDayActivity'] = (targetDateKey) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateKey)) return;
    const now = Date.now();
    const { start: dayStart, end: dayEnd } = getDayBounds(targetDateKey);
    let removedActiveSession = false;

    setLedger((prev) => {
      const sessionIdsToDelete = new Set(
        prev.sessions
          .filter((session) => {
            const sessionEnd = getSessionEndAt(session, now);
            return session.startAt < dayEnd && sessionEnd > dayStart;
          })
          .map((session) => session.id)
      );

      removedActiveSession = !!activeSessionId && sessionIdsToDelete.has(activeSessionId);

      const keptSessions = prev.sessions.filter((session) => !sessionIdsToDelete.has(session.id));
      const keptSessionIds = new Set(keptSessions.map((session) => session.id));

      const hasRunningForTask = (taskId: string) =>
        keptSessions.some(
          (session) =>
            session.status === 'running' &&
            (session.taskId === taskId || (session.linkedTaskIds || []).includes(taskId))
        );

      const taskUpdatedAt = now;
      const nextTasks = prev.tasks.map((task) => {
        const nextLinkedSessionIds = task.linkedSessionIds.filter((id) => keptSessionIds.has(id));
        const linkedChanged = nextLinkedSessionIds.length !== task.linkedSessionIds.length;
        const shouldDowngradeActive = task.status === 'active' && !hasRunningForTask(task.id);
        if (!linkedChanged && !shouldDowngradeActive) return task;
        return {
          ...task,
          status: shouldDowngradeActive ? (task.completedAt ? 'done' : task.archivedAt ? 'dropped' : 'todo') : task.status,
          linkedSessionIds: nextLinkedSessionIds,
          updatedAt: taskUpdatedAt,
        };
      });

      const nextChallenges = prev.challenges.map((challenge) => {
        if (!challenge.linkedSessionId || !sessionIdsToDelete.has(challenge.linkedSessionId)) return challenge;
        return {
          ...challenge,
          linkedSessionId: undefined,
          status: challenge.status === 'active' ? 'canceled' : challenge.status,
          updatedAt: now,
        };
      });

      const isTimestampInDay = (timestamp?: number) =>
        Number.isFinite(timestamp) && (timestamp as number) >= dayStart && (timestamp as number) < dayEnd;

      return {
        ...prev,
        sessions: keptSessions,
        tasks: nextTasks,
        challenges: nextChallenges,
        taskEvents: prev.taskEvents.filter((entry) => {
          const entryAt = isTimestampInDay(entry.createdAt)
            ? entry.createdAt
            : isTimestampInDay((entry as XPTaskEvent & { updatedAt?: number }).updatedAt)
              ? (entry as XPTaskEvent & { updatedAt?: number }).updatedAt
              : undefined;
          if (Number.isFinite(entryAt)) return false;
          return entry.dateKey !== targetDateKey;
        }),
        completions: prev.completions.filter((completion) => {
          if (isTimestampInDay(completion.createdAt)) return false;
          return completion.dateKey !== targetDateKey;
        }),
        manualLogs: prev.manualLogs.filter((entry) => {
          if (isTimestampInDay(entry.createdAt)) return false;
          return entry.dateKey !== targetDateKey;
        }),
      };
    });

    if (removedActiveSession) {
      setActiveSessionId(null);
      setTimerNow(now);
    }
  };

  const createChallenge: XPContextValue['createChallenge'] = (payload) => {
    const now = Date.now();
    const challenge: Challenge = {
      id: `challenge-${now}-${Math.random().toString(36).slice(2, 6)}`,
      mode: payload.mode,
      name: payload.name,
      details: payload.details,
      rules: payload.rules,
      privacy: payload.privacy,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    setLedger((prev) => ({ ...prev, challenges: [challenge, ...prev.challenges] }));
    return challenge;
  };

  const updateChallenge = (id: string, patch: Partial<Challenge>) => {
    setLedger((prev) => ({
      ...prev,
      challenges: prev.challenges.map((challenge) =>
        challenge.id === id ? { ...challenge, ...patch, updatedAt: Date.now() } : challenge
      ),
    }));
  };

  // ─── Phase 2: Project CRUD ─────────────────────────────────────────────────
  const addProject: XPContextValue['addProject'] = (payload) => {
    const now = Date.now();
    const newProject: Project = {
      ...payload,
      id: `project-${now}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    setLedger((prev) => ({ ...prev, projects: [newProject, ...prev.projects] }));
    return newProject.id;
  };

  const updateProject: XPContextValue['updateProject'] = (id, patch) => {
    setLedger((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p
      ),
    }));
  };

  const deleteProject: XPContextValue['deleteProject'] = (id) => {
    setLedger((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== id),
      // Orphan quests by clearing their projectId
      tasks: prev.tasks.map((t) =>
        t.projectId === id ? { ...t, projectId: undefined, updatedAt: Date.now() } : t
      ),
    }));
  };

  // ─── Phase 2: Milestone CRUD ───────────────────────────────────────────────
  const addMilestone: XPContextValue['addMilestone'] = (payload) => {
    const now = Date.now();
    const newMilestone: Milestone = {
      ...payload,
      id: `milestone-${now}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    setLedger((prev) => ({ ...prev, milestones: [...prev.milestones, newMilestone] }));
    return newMilestone.id;
  };

  const updateMilestone: XPContextValue['updateMilestone'] = (id, patch) => {
    setLedger((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) =>
        m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m
      ),
    }));
  };

  const deleteMilestone: XPContextValue['deleteMilestone'] = (id) => {
    setLedger((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((m) => m.id !== id),
    }));
  };

  const completeMilestone: XPContextValue['completeMilestone'] = (id) => {
    const now = Date.now();
    setLedger((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) =>
        m.id === id
          ? { ...m, isCompleted: true, completedAt: m.completedAt ?? now, updatedAt: now }
          : m
      ),
    }));
  };

  // ─── Phase 2: Self Tree CRUD ───────────────────────────────────────────────
  const addSelfTreeNode: XPContextValue['addSelfTreeNode'] = (payload) => {
    const now = Date.now();
    const newNode: SelfTreeNode = {
      ...payload,
      id: `stn-${now}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    setLedger((prev) => ({ ...prev, selfTreeNodes: [...prev.selfTreeNodes, newNode] }));
    return newNode.id;
  };

  const updateSelfTreeNode: XPContextValue['updateSelfTreeNode'] = (id, patch) => {
    setLedger((prev) => ({
      ...prev,
      selfTreeNodes: prev.selfTreeNodes.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n
      ),
    }));
  };

  const deleteSelfTreeNode: XPContextValue['deleteSelfTreeNode'] = (id) => {
    setLedger((prev) => ({
      ...prev,
      // Also orphan children by clearing their parentId
      selfTreeNodes: prev.selfTreeNodes
        .filter((n) => n.id !== id)
        .map((n) => n.parentId === id ? { ...n, parentId: undefined, updatedAt: Date.now() } : n),
    }));
  };

  // ─── Phase 8: Inventory Data Model ──────────────────────────────────────────

  const addInventorySlot: XPContextValue['addInventorySlot'] = (payload) => {
    const now = Date.now();
    const newSlot: InventorySlot = {
      ...payload,
      id: `inv-${now}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    setLedger((prev) => ({ ...prev, inventorySlots: [...prev.inventorySlots, newSlot] }));
    return newSlot.id;
  };

  const updateInventorySlot: XPContextValue['updateInventorySlot'] = (id, patch) => {
    setLedger((prev) => ({
      ...prev,
      inventorySlots: prev.inventorySlots.map((s) =>
        s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s
      ),
    }));
  };

  const deleteInventorySlot: XPContextValue['deleteInventorySlot'] = (id) => {
    setLedger((prev) => ({
      ...prev,
      inventorySlots: prev.inventorySlots.filter((s) => s.id !== id),
    }));
  };

  const resetToday = () => {
    const { start: todayStart, end: todayEnd } = getDayBounds(dateKey);
    const active = activeSessionId ? ledger.sessions.find((session) => session.id === activeSessionId) : null;
    setLedger((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((session) => {
        return getSessionOverlapMsForDay(session, todayStart, todayEnd) <= 0;
      }),
      completions: prev.completions.filter((completion) => completion.dateKey !== dateKey),
      manualLogs: prev.manualLogs.filter((entry) => entry.dateKey !== dateKey),
      taskEvents: prev.taskEvents.filter((entry) => entry.dateKey !== dateKey),
      tasks: prev.tasks.map((task) =>
        task.completedDateKey === dateKey
          ? {
              ...task,
              completedAt: undefined,
              completedDateKey: undefined,
              status: task.archivedAt ? 'dropped' : 'todo',
              updatedAt: Date.now(),
            }
          : task
      ),
    }));
    if (active && getSessionOverlapMsForDay(active, todayStart, todayEnd) > 0) setActiveSessionId(null);
  };

  const getLedgerSnapshot = () => {
    return cloneLedgerState(ledger);
  };

  const replaceLedger: XPContextValue['replaceLedger'] = (snapshot, markHydrated = true) => {
    replaceLedgerState(snapshot, markHydrated);
  };

  const replaceLedgerSnapshot: XPContextValue['replaceLedgerSnapshot'] = (snapshot, markHydrated = true) => {
    replaceLedgerState(snapshot, markHydrated);
  };

  const hydrateFromLedger: XPContextValue['hydrateFromLedger'] = (snapshot) => {
    replaceLedgerState(snapshot, true);
  };

  const repairLedgerLinks = () => {
    const now = Date.now();
    let nextActiveSessionId: string | null = null;

    setLedger((prev) => {
      const taskIds = new Set(prev.tasks.map((task) => task.id));

      const sanitizedSessions = prev.sessions.map((session) => {
        const filteredLinked = Array.from(new Set((session.linkedTaskIds || []).filter((taskId) => taskIds.has(taskId))));
        const validTaskId = session.taskId && taskIds.has(session.taskId) ? session.taskId : undefined;
        const linkedTaskIds = validTaskId && !filteredLinked.includes(validTaskId) ? [validTaskId, ...filteredLinked] : filteredLinked;
        const taskId = linkedTaskIds[0];
        const changed =
          session.taskId !== taskId ||
          linkedTaskIds.length !== (session.linkedTaskIds || []).length ||
          linkedTaskIds.some((id, idx) => id !== (session.linkedTaskIds || [])[idx]);
        if (!changed) return session;
        return syncSessionDurations({
          ...session,
          taskId,
          linkedTaskIds,
          updatedAt: now,
        });
      });

      const runningSessions = sanitizedSessions
        .filter((session) => session.status === 'running')
        .sort((a, b) => b.startAt - a.startAt);
      const keepRunningId = runningSessions[0]?.id || null;
      nextActiveSessionId = keepRunningId;

      const repairedSessions = sanitizedSessions.map((session) => {
        if (session.status !== 'running' || session.id === keepRunningId) return session;
        return {
          ...session,
          status: 'canceled',
          endAt: Math.max(session.startAt, now),
          durationMs: 0,
          accumulatedMs: 0,
          runningStartedAt: null,
          durationMinutes: 0,
          updatedAt: now,
        };
      });

      const taskSessionMap = new Map<string, string[]>();
      prev.tasks.forEach((task) => taskSessionMap.set(task.id, []));
      repairedSessions.forEach((session) => {
        (session.linkedTaskIds || []).forEach((taskId) => {
          if (!taskSessionMap.has(taskId)) return;
          taskSessionMap.get(taskId)!.push(session.id);
        });
      });

      const repairedTasks = prev.tasks.map((task) => {
        const linkedSessionIds = Array.from(new Set(taskSessionMap.get(task.id) || []));
        const linkedRunning = repairedSessions.some(
          (session) => session.status === 'running' && (session.linkedTaskIds || []).includes(task.id)
        );
        const status = linkedRunning ? 'active' : task.status === 'active' ? 'todo' : task.status;
        const changed =
          status !== task.status ||
          linkedSessionIds.length !== task.linkedSessionIds.length ||
          linkedSessionIds.some((id, idx) => id !== task.linkedSessionIds[idx]);
        if (!changed) return task;
        return {
          ...task,
          status,
          linkedSessionIds,
          updatedAt: now,
        };
      });

      const canceledSessionIds = new Set(
        repairedSessions.filter((session) => session.status === 'canceled').map((session) => session.id)
      );
      const repairedChallenges = prev.challenges.map((challenge) => {
        if (!challenge.linkedSessionId) return challenge;
        if (canceledSessionIds.has(challenge.linkedSessionId) && challenge.status === 'active') {
          return {
            ...challenge,
            status: 'canceled',
            updatedAt: now,
          };
        }
        return challenge;
      });

      return {
        ...prev,
        tasks: repairedTasks,
        sessions: repairedSessions,
        challenges: repairedChallenges,
      };
    });

    setActiveSessionId(nextActiveSessionId);
    setTimerNow(now);
  };

  const resetLocalData = () => {
    const next = xpRepository.reset(currentAuthUserId);
    const running = XPSelectors.getActiveSession(next);
    setLedger(next);
    setActiveSessionId(running ? running.id : null);
    setTimerNow(Date.now());
    setDateKey(getDateKey());
    syncLastSavedSignatureRef.current = getLedgerSyncSignature(next);
  };

  const resetAccountData: XPContextValue['resetAccountData'] = async () => {
    if (!currentAuthUserId) {
      setCloudResetStatus('error');
      setCloudResetMessage('Not signed in. Sign in to reset cloud data.');
      return;
    }

    const requestId = syncLoadRequestIdRef.current + 1;
    syncLoadRequestIdRef.current = requestId;

    if (syncSaveTimerRef.current) {
      window.clearTimeout(syncSaveTimerRef.current);
      syncSaveTimerRef.current = null;
    }

    const emptySnapshot = xpRepository.createEmpty();
    syncLoadingRef.current = true;
    syncSavingRef.current = false;
    syncSkipNextSaveRef.current = false;
    syncUserIdRef.current = currentAuthUserId;
    setSyncStatus('saving');
    setCloudResetStatus('saving');
    setCloudResetMessage('Resetting cloud data for this account...');
    setLedgerSource('cloud');
    setLastSyncedAt(undefined);

    // Verification flow:
    // 1) Sign in as user A, create tasks/sessions.
    // 2) Trigger reset and confirm UI clears immediately.
    // 3) Refresh and confirm user A remains empty.
    // 4) Sign in as user B and confirm B data is unchanged.
    replaceLedgerState(emptySnapshot, true);
    syncLastSavedSignatureRef.current = getLedgerSyncSignature(emptySnapshot);

    try {
      await resetCloudLedgerForCurrentUser();
      if (syncLoadRequestIdRef.current !== requestId || syncUserIdRef.current !== currentAuthUserId) return;

      const cloudRecord = await getOrCreateLedger();
      if (syncLoadRequestIdRef.current !== requestId || syncUserIdRef.current !== currentAuthUserId) return;

      const cloudSnapshot = snapshotFromCloudRecord(cloudRecord.ledger);
      replaceLedgerState(cloudSnapshot, true);
      cloudLedgerRef.current = cloudRecord.ledger;
      syncSkipNextSaveRef.current = true;
      syncLastSavedSignatureRef.current = getLedgerSyncSignature(cloudSnapshot);
      xpRepository.reset(currentAuthUserId);
      xpRepository.save(cloudSnapshot, currentAuthUserId);
      setLastSyncedAt(cloudRecord.clientUpdatedAt ?? new Date().toISOString());
      setSyncStatus('idle');
      setCloudResetStatus('saved');
      setCloudResetMessage('Cloud data reset complete.');
    } catch (error) {
      if (syncLoadRequestIdRef.current !== requestId || syncUserIdRef.current !== currentAuthUserId) return;
      console.warn('[xp-sync] Failed to reset account cloud ledger:', error);
      setSyncStatus('error');
      setCloudResetStatus('error');
      setCloudResetMessage(error instanceof Error ? error.message : 'Cloud reset failed.');

      try {
        const fallback = await getOrCreateLedger();
        if (syncLoadRequestIdRef.current !== requestId || syncUserIdRef.current !== currentAuthUserId) return;
        const fallbackSnapshot = snapshotFromCloudRecord(fallback.ledger);
        replaceLedgerState(fallbackSnapshot, true);
        cloudLedgerRef.current = fallback.ledger;
        syncSkipNextSaveRef.current = true;
        syncLastSavedSignatureRef.current = getLedgerSyncSignature(fallbackSnapshot);
        xpRepository.save(fallbackSnapshot, currentAuthUserId);
        setLastSyncedAt(fallback.clientUpdatedAt ?? undefined);
      } catch (fallbackError) {
        console.warn('[xp-sync] Failed to reload cloud ledger after reset failure:', fallbackError);
      }
    } finally {
      if (syncLoadRequestIdRef.current === requestId) {
        syncLoadingRef.current = false;
      }
      syncSavingRef.current = false;
    }
  };

  const value: XPContextValue = {
    now: timerNow,
    dateKey,
    activeLogDateKey,
    currentAuthUserId,
    ledgerCacheKey,
    ledgerSource,
    dayConfig,
    tasks: ledger.tasks,
    sessions: ledger.sessions,
    completions: ledger.completions,
    manualLogs: ledger.manualLogs,
    taskEvents: ledger.taskEvents,
    challenges: ledger.challenges,
    stats,
    legacyXP: ledger.legacyXP,
    isHydrated,
    syncStatus,
    lastSyncedAt,
    authStatus,
    cloudResetStatus,
    cloudResetMessage,
    selectors,
    activeSessionId,
    elapsedSeconds,
    scheduledPromptQuiet: !!ledger.settings?.scheduledPromptQuiet,
    setMode,
    addTask,
    updateTask,
    completeTask,
    archiveTask,
    unarchiveTask,
    dropTask,
    removeTask,
    deleteTaskCompletely,
    snoozeTask,
    setScheduledPromptQuiet,
    addManualSession,
    addRetroMinutes,
    startSession,
    stopSession,
    pauseSession,
    resumeTaskSession,
    splitSession,
    cancelSession,
    updateSession,
    deleteSession,
    deleteCompletion,
    deleteLogItem,
    reassignSessionTask,
    deleteDayActivity,
    createChallenge,
    updateChallenge,
    projects: ledger.projects,
    addProject,
    updateProject,
    deleteProject,
    milestones: ledger.milestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    completeMilestone,
    selfTreeNodes: ledger.selfTreeNodes,
    addSelfTreeNode,
    updateSelfTreeNode,
    deleteSelfTreeNode,
    inventorySlots: ledger.inventorySlots,
    addInventorySlot,
    updateInventorySlot,
    deleteInventorySlot,
    resetToday,
    setActiveLogDateKey,
    getLedgerSnapshot,
    replaceLedger,
    replaceLedgerSnapshot,
    hydrateFromLedger,
    setActiveUser,
    repairLedgerLinks,
    resetLocalData,
    resetAccountData,
  };

  return <XPContext.Provider value={value}>{children}</XPContext.Provider>;
};

const prevSettingsExists = (ledger: XPLedgerState) => {
  return !!ledger.settings && typeof ledger.settings.scheduledPromptQuiet === 'boolean';
};
