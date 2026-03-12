export type AuthTransitionMode = 'login' | 'signup' | 'oauth';

export interface AuthTransitionSignal {
  createdAt: number;
  mode: AuthTransitionMode;
  fromGuestMode: boolean;
}

const AUTH_TRANSITION_SIGNAL_KEY = 'xtation_auth_transition_signal_v1';

const getSessionStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage as Partial<Storage> | undefined;
};

const safeSessionGetItem = (storage: Partial<Storage>, key: string): string | null => {
  if (typeof storage.getItem !== 'function') return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeSessionSetItem = (storage: Partial<Storage>, key: string, value: string): boolean => {
  if (typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeSessionRemoveItem = (storage: Partial<Storage>, key: string) => {
  if (typeof storage.removeItem !== 'function') return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage-level failures.
  }
};

export const writeAuthTransitionSignal = (signal: Omit<AuthTransitionSignal, 'createdAt'>) => {
  const storage = getSessionStorage();
  if (!storage) return false;
  return safeSessionSetItem(
    storage,
    AUTH_TRANSITION_SIGNAL_KEY,
    JSON.stringify({
      ...signal,
      createdAt: Date.now(),
    } satisfies AuthTransitionSignal)
  );
};

export const readAuthTransitionSignal = (): AuthTransitionSignal | null => {
  const storage = getSessionStorage();
  if (!storage) return null;
  const raw = safeSessionGetItem(storage, AUTH_TRANSITION_SIGNAL_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthTransitionSignal;
    if (!parsed || typeof parsed.mode !== 'string') return null;
    return {
      createdAt: Number.isFinite(parsed.createdAt) ? parsed.createdAt : Date.now(),
      mode:
        parsed.mode === 'login' || parsed.mode === 'signup' || parsed.mode === 'oauth'
          ? parsed.mode
          : 'login',
      fromGuestMode: Boolean(parsed.fromGuestMode),
    };
  } catch {
    return null;
  }
};

export const clearAuthTransitionSignal = () => {
  const storage = getSessionStorage();
  if (!storage) return;
  safeSessionRemoveItem(storage, AUTH_TRANSITION_SIGNAL_KEY);
};
