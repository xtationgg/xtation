import { ClientView } from '../../types';
import {
  clearUserScopedKey,
  readUserScopedJSON,
  writeUserScopedJSON,
} from '../lib/userScopedStorage';

const GUEST_STATION_ACTIVITY_KEY = 'xtation_guest_station_activity_v1';
const ACCOUNT_STATION_ACTIVITY_KEY = 'xtation_station_activity_v1';
const MAX_STATION_ACTIVITY = 12;

export const XTATION_STATION_ACTIVITY_EVENT = 'xtation:station-activity';

let guestActivityFallback: StationActivityEntry[] = [];
const accountActivityFallback = new Map<string, StationActivityEntry[]>();

export interface StationActivityEntry {
  id: string;
  createdAt: number;
  title: string;
  detail: string;
  workspaceLabel?: string | null;
  targetView?: ClientView | null;
  chips?: string[];
  tone?: 'default' | 'accent';
}

const getGuestStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage as Partial<Storage> | undefined;
};

const readGuestActivity = (): StationActivityEntry[] => {
  const storage = getGuestStorage();
  if (!storage || typeof storage.getItem !== 'function') return guestActivityFallback;
  let raw: string | null = null;
  try {
    raw = storage.getItem(GUEST_STATION_ACTIVITY_KEY);
  } catch {
    return guestActivityFallback;
  }
  if (!raw) return guestActivityFallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return guestActivityFallback;
    return parsed.filter((entry): entry is StationActivityEntry => Boolean(entry && typeof entry === 'object' && typeof entry.title === 'string' && typeof entry.detail === 'string'));
  } catch {
    return guestActivityFallback;
  }
};

const writeGuestActivity = (entries: StationActivityEntry[]) => {
  const storage = getGuestStorage();
  guestActivityFallback = entries;
  if (!storage || typeof storage.setItem !== 'function') return true;
  try {
    storage.setItem(GUEST_STATION_ACTIVITY_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return true;
  }
};

const normalizeActivityEntry = (entry: Omit<StationActivityEntry, 'id' | 'createdAt'>): StationActivityEntry => ({
  id: `station-activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  createdAt: Date.now(),
  title: entry.title,
  detail: entry.detail,
  workspaceLabel: entry.workspaceLabel ?? null,
  targetView: entry.targetView ?? null,
  chips: Array.isArray(entry.chips) ? entry.chips.filter(Boolean) : [],
  tone: entry.tone === 'accent' ? 'accent' : 'default',
});

export const appendStationActivity = (
  entry: Omit<StationActivityEntry, 'id' | 'createdAt'>,
  userId?: string | null
): StationActivityEntry | null => {
  const normalized = normalizeActivityEntry(entry);
  if (userId) {
    const currentStored = readUserScopedJSON<StationActivityEntry[]>(
      ACCOUNT_STATION_ACTIVITY_KEY,
      [],
      userId
    );
    const current = currentStored.length
      ? currentStored
      : accountActivityFallback.get(userId) ?? [];
    const next = [normalized, ...current].slice(0, MAX_STATION_ACTIVITY);
    const ok = writeUserScopedJSON(ACCOUNT_STATION_ACTIVITY_KEY, next, userId);
    if (!ok) {
      accountActivityFallback.set(userId, next);
    } else {
      accountActivityFallback.set(userId, next);
    }
  } else {
    const next = [normalized, ...readGuestActivity()].slice(0, MAX_STATION_ACTIVITY);
    const ok = writeGuestActivity(next);
    if (!ok) return null;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(XTATION_STATION_ACTIVITY_EVENT, {
        detail: {
          userId: userId ?? null,
          entry: normalized,
        },
      })
    );
  }
  return normalized;
};

export const readStationActivity = (userId?: string | null): StationActivityEntry[] => {
  if (userId) {
    const stored = readUserScopedJSON<StationActivityEntry[]>(
      ACCOUNT_STATION_ACTIVITY_KEY,
      [],
      userId
    );
    if (stored.length) {
      accountActivityFallback.set(userId, stored);
      return stored;
    }
    return accountActivityFallback.get(userId) ?? [];
  }
  return readGuestActivity();
};

export const clearStationActivity = (userId?: string | null) => {
  if (userId) {
    clearUserScopedKey(ACCOUNT_STATION_ACTIVITY_KEY, userId);
    accountActivityFallback.delete(userId);
    return;
  }
  guestActivityFallback = [];
  const storage = getGuestStorage();
  if (!storage) return;
  if (typeof storage.removeItem === 'function') {
    try {
      storage.removeItem(GUEST_STATION_ACTIVITY_KEY);
    } catch {
      return;
    }
    return;
  }
  if (typeof storage.setItem === 'function') {
    try {
      storage.setItem(GUEST_STATION_ACTIVITY_KEY, '[]');
    } catch {
      return;
    }
  }
};
