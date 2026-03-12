import {
  readSessionString,
  removeSessionString,
  writeSessionString,
} from '../lib/safeSessionStorage';

export type AuthTransitionMode = 'login' | 'signup' | 'oauth';

export interface AuthTransitionSignal {
  createdAt: number;
  mode: AuthTransitionMode;
  fromGuestMode: boolean;
}

const AUTH_TRANSITION_SIGNAL_KEY = 'xtation_auth_transition_signal_v1';

export const writeAuthTransitionSignal = (signal: Omit<AuthTransitionSignal, 'createdAt'>) => {
  return writeSessionString(
    AUTH_TRANSITION_SIGNAL_KEY,
    JSON.stringify({
      ...signal,
      createdAt: Date.now(),
    } satisfies AuthTransitionSignal)
  );
};

export const readAuthTransitionSignal = (): AuthTransitionSignal | null => {
  const raw = readSessionString(AUTH_TRANSITION_SIGNAL_KEY);
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
  removeSessionString(AUTH_TRANSITION_SIGNAL_KEY);
};
