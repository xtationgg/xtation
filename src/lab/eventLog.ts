import { readUserScopedJSON, writeUserScopedJSON } from '../lib/userScopedStorage';

export type LabEventType =
  | 'node:created'
  | 'node:edited'
  | 'node:deleted'
  | 'node:selected'
  | 'wire:created'
  | 'wire:deleted'
  | 'checklist:toggled'
  | 'quest:completed'
  | 'quest:started'
  | 'session:started'
  | 'session:ended'
  | 'tab:created'
  | 'tab:switched'
  | 'canvas:opened';

export interface LabEvent {
  id: string;
  type: LabEventType;
  timestamp: number;
  nodeId?: string;
  nodeType?: string;
  metadata?: Record<string, unknown>;
}

const STORAGE_KEY = 'xtationLabEventLog';
const MAX_EVENTS = 2000;

// Monotonic counter to avoid collisions within the same millisecond
let _counter = 0;
const createEventId = () =>
  `${Date.now()}-${(_counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Read the full event log from storage. */
export function readEventLog(scopeId: string): LabEvent[] {
  return readUserScopedJSON<LabEvent[]>(STORAGE_KEY, [], scopeId);
}

/** Append a single event, auto-trimming when over MAX_EVENTS. */
export function logEvent(
  scopeId: string,
  type: LabEventType,
  data?: { nodeId?: string; nodeType?: string; metadata?: Record<string, unknown> },
): void {
  const events = readEventLog(scopeId);
  const event: LabEvent = {
    id: createEventId(),
    type,
    timestamp: Date.now(),
    ...(data?.nodeId ? { nodeId: data.nodeId } : {}),
    ...(data?.nodeType ? { nodeType: data.nodeType } : {}),
    ...(data?.metadata ? { metadata: data.metadata } : {}),
  };
  events.push(event);
  // Trim to last MAX_EVENTS
  const trimmed = events.length > MAX_EVENTS ? events.slice(-MAX_EVENTS) : events;
  writeUserScopedJSON(STORAGE_KEY, trimmed, scopeId);
}

// ─── Query helpers ────────────────────────────────────────────────────────────

/** Get all events that fall on a given calendar day. */
export function getEventsForDay(events: LabEvent[], date: Date): LabEvent[] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = start + 86_400_000;
  return events.filter((e) => e.timestamp >= start && e.timestamp < end);
}

/** Get all events in a 7-day window starting from weekStartDate. */
export function getEventsForWeek(events: LabEvent[], weekStartDate: Date): LabEvent[] {
  const start = new Date(
    weekStartDate.getFullYear(),
    weekStartDate.getMonth(),
    weekStartDate.getDate(),
  ).getTime();
  const end = start + 7 * 86_400_000;
  return events.filter((e) => e.timestamp >= start && e.timestamp < end);
}

/** Filter events by type. */
export function getEventsByType(events: LabEvent[], type: LabEventType): LabEvent[] {
  return events.filter((e) => e.type === type);
}

/**
 * Calculate the current streak: consecutive days (ending today or yesterday)
 * with at least one event matching the given activity types.
 */
export function getStreakDays(events: LabEvent[], activityTypes: LabEventType[]): number {
  const typeSet = new Set(activityTypes);
  const activeDays = new Set<string>();
  for (const e of events) {
    if (typeSet.has(e.type)) {
      const d = new Date(e.timestamp);
      activeDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }

  const now = new Date();
  let streak = 0;
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Check today first; if not active, check yesterday to allow "haven't opened yet today"
  const todayKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
  if (!activeDays.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
    const yKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (!activeDays.has(yKey)) return 0;
  }

  while (true) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (!activeDays.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/** Returns a 24-element array with the count of events per hour (0-23). */
export function getHourlyActivity(events: LabEvent[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const e of events) {
    const h = new Date(e.timestamp).getHours();
    hours[h]++;
  }
  return hours;
}
