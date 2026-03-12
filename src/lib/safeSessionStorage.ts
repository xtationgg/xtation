const getSessionStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage as Partial<Storage> | undefined;
};

export const readSessionString = (key: string): string | null => {
  const storage = getSessionStorage();
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

export const writeSessionString = (key: string, value: string): boolean => {
  const storage = getSessionStorage();
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const removeSessionString = (key: string): boolean => {
  const storage = getSessionStorage();
  if (!storage || typeof storage.removeItem !== 'function') return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};
