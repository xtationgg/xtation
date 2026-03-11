import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { readUserScopedString, writeUserScopedString } from '../lib/userScopedStorage';

export const XTATION_THEME_STORAGE_KEY = 'xtation_theme_pack';
export const XTATION_ACCENT_STORAGE_KEY = 'xtation_accent_pack';
export const XTATION_RESOLUTION_STORAGE_KEY = 'xtation_resolution_mode';
const LEGACY_THEME_STORAGE_KEY = 'xtation_theme';
export const BUILTIN_THEME_PACK_PREFIX = 'builtin:';
const THEME_DIRECTION_MIGRATION_KEY = 'xtation_theme_direction_v1';

export type XtationTheme =
  | 'dusk'
  | 'dusk_soft'
  | 'dark_minimal_solid'
  | 'dark_minimal_rounded_solid'
  | 'dark_minimal_rounded_glass'
  | 'hud_clean'
  | 'glass_night'
  | 'notion_light'
  | 'notion_dark'
  | 'void'
  | 'bureau';

export interface XtationThemeOption {
  value: XtationTheme;
  label: string;
}

export type XtationAccent = 'purple' | 'neutral' | 'amber' | 'teal' | 'crimson' | 'lime' | 'outline';

export interface XtationAccentOption {
  value: XtationAccent;
  label: string;
}

export type XtationResolutionMode = 'auto' | 'hd_720' | 'hd_1080' | 'qhd_1440' | 'uhd_2160';

export interface XtationResolutionOption {
  value: XtationResolutionMode;
  label: string;
}

export const getBuiltInThemePackId = (theme: XtationTheme) => `${BUILTIN_THEME_PACK_PREFIX}${theme}`;

export const XTATION_THEME_OPTIONS: XtationThemeOption[] = [
  { value: 'dusk', label: 'Dusk' },
  { value: 'dusk_soft', label: 'Dusk • No Outline' },
  { value: 'dark_minimal_solid', label: 'Dark Minimal + Solid' },
  { value: 'dark_minimal_rounded_solid', label: 'DARK MINIMAL • ROUNDED • SOLID' },
  { value: 'dark_minimal_rounded_glass', label: 'DARK MINIMAL • ROUNDED • GLASS' },
  { value: 'hud_clean', label: 'HUD Clean' },
  { value: 'glass_night', label: 'Glass Night' },
  { value: 'notion_light', label: 'Notion Light' },
  { value: 'notion_dark', label: 'Notion Dark' },
  { value: 'void', label: 'Void' },
  { value: 'bureau', label: 'Bureau' },
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

export const XTATION_RESOLUTION_OPTIONS: XtationResolutionOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'hd_720', label: '1280 × 720' },
  { value: 'hd_1080', label: '1920 × 1080' },
  { value: 'qhd_1440', label: '2560 × 1440' },
  { value: 'uhd_2160', label: '3840 × 2160' },
];

const DEFAULT_THEME: XtationTheme = 'bureau';
const DEFAULT_ACCENT: XtationAccent = 'amber';
const DEFAULT_RESOLUTION: XtationResolutionMode = 'auto';
const VALID_THEMES = new Set<XtationTheme>(XTATION_THEME_OPTIONS.map((option) => option.value));
const VALID_ACCENTS = new Set<XtationAccent>(XTATION_ACCENT_OPTIONS.map((option) => option.value));
const VALID_RESOLUTIONS = new Set<XtationResolutionMode>(XTATION_RESOLUTION_OPTIONS.map((option) => option.value));

const isTheme = (value: string): value is XtationTheme => VALID_THEMES.has(value as XtationTheme);
const isAccent = (value: string): value is XtationAccent => VALID_ACCENTS.has(value as XtationAccent);
const isResolution = (value: string): value is XtationResolutionMode =>
  VALID_RESOLUTIONS.has(value as XtationResolutionMode);

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

const readStoredThemeForUser = (userId?: string | null): XtationTheme => {
  const scoped = normalizeTheme(readUserScopedString(XTATION_THEME_STORAGE_KEY, null, userId));
  if (scoped) return scoped;
  const scopedLegacy = normalizeTheme(readUserScopedString(LEGACY_THEME_STORAGE_KEY, null, userId));
  if (scopedLegacy) return scopedLegacy;
  return readStoredTheme();
};

const readStoredAccent = (): XtationAccent => {
  if (typeof window === 'undefined') return DEFAULT_ACCENT;
  const stored = window.localStorage.getItem(XTATION_ACCENT_STORAGE_KEY);
  if (stored && isAccent(stored)) return stored;
  return DEFAULT_ACCENT;
};

const readStoredAccentForUser = (userId?: string | null): XtationAccent => {
  const scoped = readUserScopedString(XTATION_ACCENT_STORAGE_KEY, null, userId);
  if (scoped && isAccent(scoped)) return scoped;
  return readStoredAccent();
};

const readStoredResolution = (): XtationResolutionMode => {
  if (typeof window === 'undefined') return DEFAULT_RESOLUTION;
  const stored = window.localStorage.getItem(XTATION_RESOLUTION_STORAGE_KEY);
  if (stored && isResolution(stored)) return stored;
  return DEFAULT_RESOLUTION;
};

const readStoredResolutionForUser = (userId?: string | null): XtationResolutionMode => {
  const scoped = readUserScopedString(XTATION_RESOLUTION_STORAGE_KEY, null, userId);
  if (scoped && isResolution(scoped)) return scoped;
  return readStoredResolution();
};

const applyThemeToDom = (theme: XtationTheme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
};

const applyAccentToDom = (accent: XtationAccent) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.accent = accent;
};

const applyResolutionToDom = (resolution: XtationResolutionMode) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.resolution = resolution;
};

const persistThemeSelection = (theme: XtationTheme, userId?: string | null) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(XTATION_THEME_STORAGE_KEY, theme);
  window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
  if (userId) {
    writeUserScopedString(XTATION_THEME_STORAGE_KEY, theme, userId);
    writeUserScopedString(LEGACY_THEME_STORAGE_KEY, theme, userId);
  }
};

const persistAccentSelection = (accent: XtationAccent, userId?: string | null) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(XTATION_ACCENT_STORAGE_KEY, accent);
  if (userId) {
    writeUserScopedString(XTATION_ACCENT_STORAGE_KEY, accent, userId);
  }
};

const persistResolutionSelection = (resolution: XtationResolutionMode, userId?: string | null) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(XTATION_RESOLUTION_STORAGE_KEY, resolution);
  if (userId) {
    writeUserScopedString(XTATION_RESOLUTION_STORAGE_KEY, resolution, userId);
  }
};

const persistThemeDirectionMigration = (userId?: string | null) => {
  if (typeof window === 'undefined') return;
  if (userId) {
    writeUserScopedString(THEME_DIRECTION_MIGRATION_KEY, 'applied', userId);
    return;
  }
  window.localStorage.setItem(THEME_DIRECTION_MIGRATION_KEY, 'applied');
};

const hasThemeDirectionMigration = (userId?: string | null) => {
  if (typeof window === 'undefined') return true;
  if (userId) {
    return readUserScopedString(THEME_DIRECTION_MIGRATION_KEY, null, userId) === 'applied';
  }
  return window.localStorage.getItem(THEME_DIRECTION_MIGRATION_KEY) === 'applied';
};

const migrateThemeDirection = (userId?: string | null) => {
  if (typeof window === 'undefined') return;
  if (hasThemeDirectionMigration(userId)) return;

  const storedTheme = normalizeTheme(
    userId
      ? readUserScopedString(XTATION_THEME_STORAGE_KEY, null, userId) ??
          readUserScopedString(LEGACY_THEME_STORAGE_KEY, null, userId)
      : window.localStorage.getItem(XTATION_THEME_STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)
  );
  const storedAccent = userId
    ? readUserScopedString(XTATION_ACCENT_STORAGE_KEY, null, userId)
    : window.localStorage.getItem(XTATION_ACCENT_STORAGE_KEY);

  const themeLooksDefault = storedTheme == null || storedTheme === 'dusk';
  const accentLooksDefault = storedAccent == null || storedAccent === 'purple';

  if (themeLooksDefault && accentLooksDefault) {
    persistThemeSelection(DEFAULT_THEME, userId);
    persistAccentSelection(DEFAULT_ACCENT, userId);
  }

  persistThemeDirectionMigration(userId);
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const computeAutoResolutionScale = () => {
  if (typeof window === 'undefined') return 1;
  // Use screen dimensions — unaffected by browser zoom (innerWidth shrinks on zoom-in,
  // causing the app to fight against the user's zoom and shrink content).
  const widthScale = window.screen.width / 1920;
  const heightScale = window.screen.height / 1080;
  return clamp(Math.min(widthScale, heightScale), 0.78, 1);
};

export const initializeThemeFromStorage = (): XtationTheme => {
  const theme = readStoredTheme();
  const accent = readStoredAccent();
  const resolution = readStoredResolution();
  applyThemeToDom(theme);
  applyAccentToDom(accent);
  applyResolutionToDom(resolution);
  return theme;
};

interface ThemeContextValue {
  theme: XtationTheme;
  setTheme: (theme: XtationTheme) => void;
  options: XtationThemeOption[];
  accent: XtationAccent;
  setAccent: (accent: XtationAccent) => void;
  accentOptions: XtationAccentOption[];
  resolution: XtationResolutionMode;
  setResolution: (resolution: XtationResolutionMode) => void;
  resolutionOptions: XtationResolutionOption[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const activeUserId = user?.id || null;
  const [theme, setThemeState] = useState<XtationTheme>(() => initializeThemeFromStorage());
  const [accent, setAccentState] = useState<XtationAccent>(() => readStoredAccent());
  const [resolution, setResolutionState] = useState<XtationResolutionMode>(() => readStoredResolution());
  const [hydratedScopeKey, setHydratedScopeKey] = useState('__boot__');

  const setTheme = useCallback((nextTheme: XtationTheme) => {
    if (!isTheme(nextTheme)) return;
    setThemeState(nextTheme);
  }, []);

  const setAccent = useCallback((nextAccent: XtationAccent) => {
    if (!isAccent(nextAccent)) return;
    setAccentState(nextAccent);
  }, []);

  const setResolution = useCallback((nextResolution: XtationResolutionMode) => {
    if (!isResolution(nextResolution)) return;
    setResolutionState(nextResolution);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const scopeKey = activeUserId || 'local';
    migrateThemeDirection(activeUserId);
    setThemeState(readStoredThemeForUser(activeUserId));
    setAccentState(readStoredAccentForUser(activeUserId));
    setResolutionState(readStoredResolutionForUser(activeUserId));
    setHydratedScopeKey(scopeKey);
  }, [authLoading, activeUserId]);

  useEffect(() => {
    if (authLoading || hydratedScopeKey !== (activeUserId || 'local')) return;
    applyThemeToDom(theme);
    persistThemeSelection(theme, activeUserId);
  }, [theme, authLoading, hydratedScopeKey, activeUserId]);

  useEffect(() => {
    if (authLoading || hydratedScopeKey !== (activeUserId || 'local')) return;
    applyAccentToDom(accent);
    persistAccentSelection(accent, activeUserId);
  }, [accent, authLoading, hydratedScopeKey, activeUserId]);

  useEffect(() => {
    if (authLoading || hydratedScopeKey !== (activeUserId || 'local')) return;
    applyResolutionToDom(resolution);
    persistResolutionSelection(resolution, activeUserId);
  }, [resolution, authLoading, hydratedScopeKey, activeUserId]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const applyAutoScale = () => {
      const root = document.documentElement;
      if (resolution !== 'auto') {
        root.style.removeProperty('--xt-auto-scale');
        return;
      }
      root.style.setProperty('--xt-auto-scale', computeAutoResolutionScale().toFixed(4));
    };

    applyAutoScale();
    window.addEventListener('resize', applyAutoScale);
    return () => window.removeEventListener('resize', applyAutoScale);
  }, [resolution]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      options: XTATION_THEME_OPTIONS,
      accent,
      setAccent,
      accentOptions: XTATION_ACCENT_OPTIONS,
      resolution,
      setResolution,
      resolutionOptions: XTATION_RESOLUTION_OPTIONS,
    }),
    [theme, setTheme, accent, setAccent, resolution, setResolution]
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
