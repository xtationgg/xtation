export interface PlayNavigationPayload {
  taskId?: string | null;
  requestedBy?: 'play' | 'profile' | 'lab' | 'dusk' | 'admin';
}

export const PLAY_NAVIGATION_EVENT = 'xtation:play:navigate';
export const PLAY_NAVIGATION_STORAGE_KEY = 'xtation.play.navigation.pending';

const getNavigationStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;

  try {
    if (window.sessionStorage) return window.sessionStorage;
  } catch {
    // Ignore session storage access issues.
  }

  try {
    if (window.localStorage) return window.localStorage;
  } catch {
    // Ignore local storage access issues.
  }

  return null;
};

export const readPendingPlayNavigation = (): PlayNavigationPayload | null => {
  const storage = getNavigationStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(PLAY_NAVIGATION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlayNavigationPayload;
  } catch {
    return null;
  }
};

export const clearPendingPlayNavigation = () => {
  const storage = getNavigationStorage();
  if (!storage) return;

  try {
    storage.removeItem(PLAY_NAVIGATION_STORAGE_KEY);
  } catch {
    // Ignore cleanup failures.
  }
};

export const openPlayNavigation = (payload: PlayNavigationPayload) => {
  if (typeof window === 'undefined') return;

  const detail: PlayNavigationPayload = {
    requestedBy: payload.requestedBy || 'play',
    ...payload,
  };

  const storage = getNavigationStorage();
  if (storage) {
    try {
      storage.setItem(PLAY_NAVIGATION_STORAGE_KEY, JSON.stringify(detail));
    } catch {
      // Ignore storage failures and still emit the event.
    }
  }

  window.dispatchEvent(
    new CustomEvent<PlayNavigationPayload>(PLAY_NAVIGATION_EVENT, {
      detail,
    })
  );
};
