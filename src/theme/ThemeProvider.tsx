import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const XTATION_THEME_STORAGE_KEY = 'xtation_theme';

export type XtationTheme = 'dark_minimal' | 'dark_neon' | 'light_minimal';

export interface XtationThemeOption {
  value: XtationTheme;
  label: string;
}

export const XTATION_THEME_OPTIONS: XtationThemeOption[] = [
  { value: 'dark_minimal', label: 'Dark Minimal' },
  { value: 'dark_neon', label: 'Dark Neon' },
  { value: 'light_minimal', label: 'Light Minimal' },
];

const DEFAULT_THEME: XtationTheme = 'dark_minimal';
const VALID_THEMES = new Set<XtationTheme>(XTATION_THEME_OPTIONS.map((option) => option.value));

const isTheme = (value: string): value is XtationTheme => VALID_THEMES.has(value as XtationTheme);

const readStoredTheme = (): XtationTheme => {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const stored = window.localStorage.getItem(XTATION_THEME_STORAGE_KEY);
  return stored && isTheme(stored) ? stored : DEFAULT_THEME;
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
