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

export const writeAuthTransitionSignal = (signal: Omit<AuthTransitionSignal, 'createdAt'>) => {
  const storage = getSessionStorage();
  if (!storage || typeof storage.setItem !== 'function') return false;
  storage.setItem(
    AUTH_TRANSITION_SIGNAL_KEY,
    JSON.stringify({
      ...signal,
      createdAt: Date.now(),
    } satisfies AuthTransitionSignal)
  );
  return true;
};

export const readAuthTransitionSignal = (): AuthTransitionSignal | null => {
  const storage = getSessionStorage();
  if (!storage || typeof storage.getItem !== 'function') return null;
  const raw = storage.getItem(AUTH_TRANSITION_SIGNAL_KEY);
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
  if (!storage || typeof storage.removeItem !== 'function') return;
  storage.removeItem(AUTH_TRANSITION_SIGNAL_KEY);
};
