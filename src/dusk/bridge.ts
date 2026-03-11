import {
  clearUserScopedKey,
  getActiveUserId,
  readUserScopedJSON,
  writeUserScopedJSON,
} from '../lib/userScopedStorage';

export type DuskBriefSource = 'lab' | 'play' | 'multiplayer' | 'profile' | 'settings';

export interface DuskBriefPayload {
  title: string;
  body: string;
  source: DuskBriefSource;
  tags?: string[];
  linkedQuestIds?: string[];
  linkedProjectIds?: string[];
  createdAt?: number;
}

export const DUSK_BRIEF_EVENT = 'dusk:openAssistantBrief';
export const LATEST_DUSK_BRIEF_KEY = 'latestDuskBrief';

export interface StoredDuskBrief extends DuskBriefPayload {
  receivedAt: number;
}

const resolveDuskBriefScope = (userId?: string | null) => userId || getActiveUserId() || 'local';

export const normalizeStoredDuskBrief = (
  payload: DuskBriefPayload | StoredDuskBrief,
  receivedAt = Date.now()
): StoredDuskBrief => ({
  ...payload,
  createdAt: payload.createdAt || Date.now(),
  receivedAt: 'receivedAt' in payload && typeof payload.receivedAt === 'number' ? payload.receivedAt : receivedAt,
});

export const readLatestDuskBrief = (userId?: string | null) =>
  readUserScopedJSON<StoredDuskBrief | null>(LATEST_DUSK_BRIEF_KEY, null, resolveDuskBriefScope(userId));

export const persistLatestDuskBrief = (
  payload: DuskBriefPayload | StoredDuskBrief,
  userId?: string | null
) => {
  const storedBrief = normalizeStoredDuskBrief(payload);
  writeUserScopedJSON(LATEST_DUSK_BRIEF_KEY, storedBrief, resolveDuskBriefScope(userId));
  return storedBrief;
};

export const clearLatestDuskBrief = (userId?: string | null) => {
  clearUserScopedKey(LATEST_DUSK_BRIEF_KEY, resolveDuskBriefScope(userId));
};

export const openDuskBrief = (payload: DuskBriefPayload, userId?: string | null) => {
  if (typeof window === 'undefined') return;
  const storedBrief = persistLatestDuskBrief(payload, userId);
  window.dispatchEvent(
    new CustomEvent<StoredDuskBrief>(DUSK_BRIEF_EVENT, {
      detail: storedBrief,
    })
  );
};
