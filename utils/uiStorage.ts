const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const uiStorage = {
  getNumber(key: string, fallback = 0) {
    if (typeof window === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  },
  setNumber(key: string, value: number) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, String(value));
  },

  getString(key: string, fallback: string | null = null) {
    if (typeof window === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw;
  },
  setString(key: string, value: string | null) {
    if (typeof window === 'undefined') return;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  },

  getBoolean(key: string, fallback = false) {
    if (typeof window === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true' || raw === '1';
  },
  setBoolean(key: string, value: boolean) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value ? 'true' : 'false');
  },

  getJSON<T>(key: string, fallback: T) {
    if (typeof window === 'undefined') return fallback;
    return safeParse<T>(localStorage.getItem(key), fallback);
  },
  setJSON(key: string, value: any) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota errors
    }
  },
};
