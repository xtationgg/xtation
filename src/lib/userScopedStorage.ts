const USER_SCOPE_CHANGE_EVENT = 'dusk:user-scope-change';

let activeUserId: string | null = null;

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  const storage = window.localStorage as Partial<Storage> | undefined;
  if (!storage) return null;
  return storage;
};

const normalizeUserId = (userId?: string | null) => {
  if (!userId || typeof userId !== 'string') return null;
  const trimmed = userId.trim();
  return trimmed.length ? trimmed : null;
};

export const getActiveUserId = () => activeUserId;

export const setActiveUserId = (userId?: string | null) => {
  activeUserId = normalizeUserId(userId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(USER_SCOPE_CHANGE_EVENT, {
        detail: {
          userId: activeUserId,
        },
      })
    );
  }
};

export const getUserScopedKey = (baseKey: string, userId?: string | null): string | null => {
  const normalized = normalizeUserId(userId ?? activeUserId);
  if (!normalized) return null;
  return `${baseKey}:${normalized}`;
};

export const clearUserScopedKey = (baseKey: string, userId?: string | null) => {
  const storage = getStorage();
  if (!storage || typeof storage.removeItem !== 'function') return;
  const key = getUserScopedKey(baseKey, userId);
  if (!key) return;
  storage.removeItem(key);
};

export const isUserScopedStorageKey = (key: string | null, baseKey: string, userId?: string | null) => {
  if (!key) return false;
  const scopedKey = getUserScopedKey(baseKey, userId);
  if (!scopedKey) return false;
  return key === scopedKey;
};

export const readUserScopedString = (
  baseKey: string,
  fallback: string | null = null,
  userId?: string | null
) => {
  const storage = getStorage();
  if (!storage || typeof storage.getItem !== 'function') return fallback;
  const key = getUserScopedKey(baseKey, userId);
  if (!key) return fallback;
  const value = storage.getItem(key);
  return value === null ? fallback : value;
};

export const writeUserScopedString = (baseKey: string, value: string, userId?: string | null) => {
  const storage = getStorage();
  if (!storage || typeof storage.setItem !== 'function') return false;
  const key = getUserScopedKey(baseKey, userId);
  if (!key) return false;
  storage.setItem(key, value);
  return true;
};

export const removeUserScopedString = (baseKey: string, userId?: string | null) => {
  const storage = getStorage();
  if (!storage || typeof storage.removeItem !== 'function') return false;
  const key = getUserScopedKey(baseKey, userId);
  if (!key) return false;
  storage.removeItem(key);
  return true;
};

export const readUserScopedNumber = (baseKey: string, fallback = 0, userId?: string | null) => {
  const raw = readUserScopedString(baseKey, null, userId);
  if (raw === null) return fallback;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const writeUserScopedNumber = (baseKey: string, value: number, userId?: string | null) =>
  writeUserScopedString(baseKey, String(value), userId);

export const readUserScopedJSON = <T,>(baseKey: string, fallback: T, userId?: string | null): T => {
  const raw = readUserScopedString(baseKey, null, userId);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const writeUserScopedJSON = (baseKey: string, value: unknown, userId?: string | null) => {
  try {
    return writeUserScopedString(baseKey, JSON.stringify(value), userId);
  } catch {
    return false;
  }
};

export const USER_SCOPED_STORAGE_EVENT = USER_SCOPE_CHANGE_EVENT;
