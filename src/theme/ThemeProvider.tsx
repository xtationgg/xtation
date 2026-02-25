import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const XTATION_THEME_STORAGE_KEY = 'xtation_theme_pack';
const LEGACY_THEME_STORAGE_KEY = 'xtation_theme';

export type XtationTheme = 'dark_minimal_solid' | 'hud_clean' | 'glass_night';

export interface XtationThemeOption {
  value: XtationTheme;
  label: string;
}

export const XTATION_THEME_OPTIONS: XtationThemeOption[] = [
  { value: 'dark_minimal_solid', label: 'Dark Minimal + Solid' },
  { value: 'hud_clean', label: 'HUD Clean' },
  { value: 'glass_night', label: 'Glass Night' },
];

const DEFAULT_THEME: XtationTheme = 'dark_minimal_solid';
const VALID_THEMES = new Set<XtationTheme>(XTATION_THEME_OPTIONS.map((option) => option.value));

const isTheme = (value: string): value is XtationTheme => VALID_THEMES.has(value as XtationTheme);

const normalizeTheme = (value: string | null): XtationTheme | null => {
  if (!value) return null;
  if (isTheme(value)) return value;
  if (value === 'dark_neon') return 'hud_clean';
  if (value === 'light_minimal') return 'dark_minimal_solid';
  if (value === 'dark_minimal') return 'dark_minimal_solid';
  return null;
};

const readStoredTheme = (): XtationTheme => {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const current = normalizeTheme(window.localStorage.getItem(XTATION_THEME_STORAGE_KEY));
  if (current) return current;
  const legacy = normalizeTheme(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY));
  return legacy ?? DEFAULT_THEME;
};

const applyThemeToDom = (theme: XtationTheme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
};

export const initializeThemeFromStorage = (): XtationTheme => {
  const theme = readStoredTheme();
  applyThemeToDom(theme);
  return theme;
};

interface ThemeContextValue {
  theme: XtationTheme;
  setTheme: (theme: XtationTheme) => void;
  options: XtationThemeOption[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<XtationTheme>(() => initializeThemeFromStorage());

  const setTheme = useCallback((nextTheme: XtationTheme) => {
    if (!isTheme(nextTheme)) return;
    setThemeState(nextTheme);
  }, []);

  useEffect(() => {
    applyThemeToDom(theme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(XTATION_THEME_STORAGE_KEY, theme);
      window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    }
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      options: XTATION_THEME_OPTIONS,
    }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
};
