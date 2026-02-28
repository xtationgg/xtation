import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const XTATION_THEME_STORAGE_KEY = 'xtation_theme_pack';
export const XTATION_ACCENT_STORAGE_KEY = 'xtation_accent_pack';
const LEGACY_THEME_STORAGE_KEY = 'xtation_theme';

export type XtationTheme =
  | 'dusk'
  | 'dusk_soft'
  | 'dark_minimal_solid'
  | 'dark_minimal_rounded_solid'
  | 'dark_minimal_rounded_glass'
  | 'hud_clean'
  | 'glass_night';

export interface XtationThemeOption {
  value: XtationTheme;
  label: string;
}

export type XtationAccent = 'purple' | 'neutral' | 'amber' | 'teal' | 'crimson' | 'lime' | 'outline';

export interface XtationAccentOption {
  value: XtationAccent;
  label: string;
}

export const XTATION_THEME_OPTIONS: XtationThemeOption[] = [
  { value: 'dusk', label: 'Dusk' },
  { value: 'dusk_soft', label: 'Dusk • No Outline' },
  { value: 'dark_minimal_solid', label: 'Dark Minimal + Solid' },
  { value: 'dark_minimal_rounded_solid', label: 'DARK MINIMAL • ROUNDED • SOLID' },
  { value: 'dark_minimal_rounded_glass', label: 'DARK MINIMAL • ROUNDED • GLASS' },
  { value: 'hud_clean', label: 'HUD Clean' },
  { value: 'glass_night', label: 'Glass Night' },
];

export const XTATION_ACCENT_OPTIONS: XtationAccentOption[] = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'purple', label: 'Purple' },
  { value: 'outline', label: 'Outline' },
  { value: 'amber', label: 'Amber' },
  { value: 'teal', label: 'Teal' },
  { value: 'crimson', label: 'Crimson' },
  { value: 'lime', label: 'Lime' },
];

const DEFAULT_THEME: XtationTheme = 'dusk';
const DEFAULT_ACCENT: XtationAccent = 'purple';
const VALID_THEMES = new Set<XtationTheme>(XTATION_THEME_OPTIONS.map((option) => option.value));
const VALID_ACCENTS = new Set<XtationAccent>(XTATION_ACCENT_OPTIONS.map((option) => option.value));

const isTheme = (value: string): value is XtationTheme => VALID_THEMES.has(value as XtationTheme);
const isAccent = (value: string): value is XtationAccent => VALID_ACCENTS.has(value as XtationAccent);

const normalizeTheme = (value: string | null): XtationTheme | null => {
  if (!value) return null;
  if (value === 'dark_minimal_solid') return 'dusk';
  if (isTheme(value)) return value;
  if (value === 'dark_neon') return 'hud_clean';
  if (value === 'light_minimal') return 'dusk';
  if (value === 'dark_minimal') return 'dusk';
  return null;
};

const readStoredTheme = (): XtationTheme => {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const current = normalizeTheme(window.localStorage.getItem(XTATION_THEME_STORAGE_KEY));
  if (current) return current;
  const legacy = normalizeTheme(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY));
  return legacy ?? DEFAULT_THEME;
};

const readStoredAccent = (): XtationAccent => {
  if (typeof window === 'undefined') return DEFAULT_ACCENT;
  const stored = window.localStorage.getItem(XTATION_ACCENT_STORAGE_KEY);
  if (stored && isAccent(stored)) return stored;
  return DEFAULT_ACCENT;
};

const applyThemeToDom = (theme: XtationTheme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
};

const applyAccentToDom = (accent: XtationAccent) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.accent = accent;
};

export const initializeThemeFromStorage = (): XtationTheme => {
  const theme = readStoredTheme();
  const accent = readStoredAccent();
  applyThemeToDom(theme);
  applyAccentToDom(accent);
  return theme;
};

interface ThemeContextValue {
  theme: XtationTheme;
  setTheme: (theme: XtationTheme) => void;
  options: XtationThemeOption[];
  accent: XtationAccent;
  setAccent: (accent: XtationAccent) => void;
  accentOptions: XtationAccentOption[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<XtationTheme>(() => initializeThemeFromStorage());
  const [accent, setAccentState] = useState<XtationAccent>(() => readStoredAccent());

  const setTheme = useCallback((nextTheme: XtationTheme) => {
    if (!isTheme(nextTheme)) return;
    setThemeState(nextTheme);
  }, []);

  const setAccent = useCallback((nextAccent: XtationAccent) => {
    if (!isAccent(nextAccent)) return;
    setAccentState(nextAccent);
  }, []);

  useEffect(() => {
    applyThemeToDom(theme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(XTATION_THEME_STORAGE_KEY, theme);
      window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    }
  }, [theme]);

  useEffect(() => {
    applyAccentToDom(accent);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(XTATION_ACCENT_STORAGE_KEY, accent);
    }
  }, [accent]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      options: XTATION_THEME_OPTIONS,
      accent,
      setAccent,
      accentOptions: XTATION_ACCENT_OPTIONS,
    }),
    [theme, setTheme, accent, setAccent]
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
