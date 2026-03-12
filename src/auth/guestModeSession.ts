export const GUEST_MODE_SESSION_KEY = 'xtation_guest_mode';

const getSessionStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage as Partial<Storage> | undefined;
};

export const readGuestModeSession = () => {
  const storage = getSessionStorage();
  if (!storage || typeof storage.getItem !== 'function') return false;
  try {
    return storage.getItem(GUEST_MODE_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
};

export const writeGuestModeSession = (isGuestMode: boolean) => {
  const storage = getSessionStorage();
  if (!storage) return false;

  if (isGuestMode) {
    if (typeof storage.setItem !== 'function') return false;
    try {
      storage.setItem(GUEST_MODE_SESSION_KEY, 'true');
      return true;
    } catch {
      return false;
    }
  }

  if (typeof storage.removeItem !== 'function') return false;
  try {
    storage.removeItem(GUEST_MODE_SESSION_KEY);
    return true;
  } catch {
    return false;
  }
};

export const clearGuestModeSession = () => writeGuestModeSession(false);
