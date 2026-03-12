import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { readUserScopedJSON, readUserScopedString, writeUserScopedJSON, writeUserScopedString } from '../lib/userScopedStorage';
import { getBuiltInThemePackId } from '../theme/ThemeProvider';
import {
  defaultXtationAudioMixLevels,
  normalizeXtationAudioMixLevels,
  type XtationAudioMixLevels,
} from '../presentation/audioMix';

const DEVICE_SETTINGS_KEY = 'xtation_device_settings_v1';
const USER_SETTINGS_KEY = 'xtation_user_settings_v1';
const LEGACY_DENSITY_KEY = 'xtation_density';
const LEGACY_MOTION_KEY = 'xtation_motion';
const LEGACY_VISIBILITY_KEY = 'defaultTaskVisibility';
const LEGACY_PRESENCE_KEY = 'mpPresenceMode';
const LEGACY_PRESENCE_KEY_ALT = 'mp_presence_mode';

export type DensityOption = 'compact' | 'comfortable' | 'spacious';
export type FocusModeOption = 'normal' | 'reduced' | 'deep';
export type PresenceModeOption = 'active' | 'hidden';
export type DefaultQuestVisibility = 'private' | 'circles' | 'community';

export interface XtationDeviceSettings {
  density: DensityOption;
  motion: 'normal' | 'reduced';
  audioEnabled: boolean;
  audioVolume: number;
  audioMixLevels: XtationAudioMixLevels;
  performanceMode: 'quality' | 'balanced' | 'performance';
  devHudEnabled: boolean;
}

export interface XtationUserSettings {
  focusMode: FocusModeOption;
  defaultQuestVisibility: DefaultQuestVisibility;
  presenceMode: PresenceModeOption;
  timezoneMode: 'system' | 'manual';
}

export interface XtationNotificationSettings {
  scheduledQuestReminders: boolean;
  focusSessionAlerts: boolean;
  rewardAlerts: boolean;
  multiplayerAlerts: boolean;
  labAlerts: boolean;
}

export interface XtationPrivacySettings {
  profileDetailLevel: 'basic' | 'details';
  locationMode: 'off' | 'city' | 'live';
  pinVisibility: 'none' | 'close' | 'specific';
  rankVisibility: boolean;
  appearsInRank: boolean;
  closeCircle: boolean;
}

export interface XtationFeatureSettings {
  multiplayerEnabled: boolean;
  labEnabled: boolean;
  storeEnabled: boolean;
  experimentalFlags: Record<string, boolean>;
}

export interface XtationUnlockSettings {
  activeThemeId?: string;
  activeSoundPackId?: string;
  activeWidgetIds: string[];
  activeLabModuleIds: string[];
}

export interface XtationSettingsState {
  device: XtationDeviceSettings;
  user: XtationUserSettings;
  notifications: XtationNotificationSettings;
  privacy: XtationPrivacySettings;
  features: XtationFeatureSettings;
  unlocks: XtationUnlockSettings;
}

const defaultDeviceSettings: XtationDeviceSettings = {
  density: 'comfortable',
  motion: 'normal',
  audioEnabled: true,
  audioVolume: 80,
  audioMixLevels: defaultXtationAudioMixLevels(),
  performanceMode: 'balanced',
  devHudEnabled: false,
};

const defaultUserSettings: XtationUserSettings = {
  focusMode: 'normal',
  defaultQuestVisibility: 'private',
  presenceMode: 'active',
  timezoneMode: 'system',
};

const defaultNotificationSettings: XtationNotificationSettings = {
  scheduledQuestReminders: true,
  focusSessionAlerts: true,
  rewardAlerts: true,
  multiplayerAlerts: true,
  labAlerts: true,
};

const defaultPrivacySettings: XtationPrivacySettings = {
  profileDetailLevel: 'basic',
  locationMode: 'off',
  pinVisibility: 'none',
  rankVisibility: true,
  appearsInRank: true,
  closeCircle: false,
};

const defaultFeatureSettings: XtationFeatureSettings = {
  multiplayerEnabled: true,
  labEnabled: true,
  storeEnabled: true,
  experimentalFlags: {},
};

const defaultUnlockSettings: XtationUnlockSettings = {
  activeThemeId: getBuiltInThemePackId('bureau'),
  activeSoundPackId: 'soundpack-bureau-amber',
  activeWidgetIds: [],
  activeLabModuleIds: [],
};

const defaultXtationSettings: XtationSettingsState = {
  device: defaultDeviceSettings,
  user: defaultUserSettings,
  notifications: defaultNotificationSettings,
  privacy: defaultPrivacySettings,
  features: defaultFeatureSettings,
  unlocks: defaultUnlockSettings,
};

const isDensityOption = (value: unknown): value is DensityOption =>
  value === 'compact' || value === 'comfortable' || value === 'spacious';

const isFocusModeOption = (value: unknown): value is FocusModeOption =>
  value === 'normal' || value === 'reduced' || value === 'deep';

const isPresenceModeOption = (value: unknown): value is PresenceModeOption =>
  value === 'active' || value === 'hidden';

const isDefaultQuestVisibility = (value: unknown): value is DefaultQuestVisibility =>
  value === 'private' || value === 'circles' || value === 'community';

const cloneDefaults = (): XtationSettingsState => ({
  device: { ...defaultDeviceSettings, audioMixLevels: defaultXtationAudioMixLevels() },
  user: { ...defaultUserSettings },
  notifications: { ...defaultNotificationSettings },
  privacy: { ...defaultPrivacySettings },
  features: { ...defaultFeatureSettings, experimentalFlags: {} },
  unlocks: { ...defaultUnlockSettings, activeWidgetIds: [], activeLabModuleIds: [] },
});

const applyDeviceSettingsToDom = (device: XtationDeviceSettings) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.density = device.density;
  if (device.motion === 'reduced') {
    document.documentElement.dataset.motion = 'reduced';
  } else {
    delete document.documentElement.dataset.motion;
  }
};

const readDeviceSettings = (): XtationDeviceSettings => {
  const base = { ...defaultDeviceSettings, audioMixLevels: defaultXtationAudioMixLevels() };
  if (typeof window === 'undefined') return base;

  try {
    const raw = window.localStorage.getItem(DEVICE_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<XtationDeviceSettings>;
      if (isDensityOption(parsed.density)) base.density = parsed.density;
      if (parsed.motion === 'reduced' || parsed.motion === 'normal') base.motion = parsed.motion;
      if (typeof parsed.audioEnabled === 'boolean') base.audioEnabled = parsed.audioEnabled;
      if (typeof parsed.audioVolume === 'number' && Number.isFinite(parsed.audioVolume)) {
        base.audioVolume = Math.min(100, Math.max(0, Math.round(parsed.audioVolume)));
      }
      base.audioMixLevels = normalizeXtationAudioMixLevels(parsed.audioMixLevels);
      if (
        parsed.performanceMode === 'quality' ||
        parsed.performanceMode === 'balanced' ||
        parsed.performanceMode === 'performance'
      ) {
        base.performanceMode = parsed.performanceMode;
      }
      if (typeof parsed.devHudEnabled === 'boolean') base.devHudEnabled = parsed.devHudEnabled;
    }
  } catch {
    // Ignore malformed device settings and fall back to defaults / legacy values.
  }

  const legacyDensity = window.localStorage.getItem(LEGACY_DENSITY_KEY);
  if (isDensityOption(legacyDensity)) {
    base.density = legacyDensity;
  }

  if (window.localStorage.getItem(LEGACY_MOTION_KEY) === 'reduced') {
    base.motion = 'reduced';
  }

  return base;
};

const readUserSettings = (userId: string): Omit<XtationSettingsState, 'device'> => {
  const base = cloneDefaults();
  const scoped = readUserScopedJSON<Omit<XtationSettingsState, 'device'>>(
    USER_SETTINGS_KEY,
    {
      user: base.user,
      notifications: base.notifications,
      privacy: base.privacy,
      features: base.features,
      unlocks: base.unlocks,
    },
    userId
  );

  const merged: Omit<XtationSettingsState, 'device'> = {
    user: {
      ...base.user,
      ...(scoped?.user || {}),
    },
    notifications: {
      ...base.notifications,
      ...(scoped?.notifications || {}),
    },
    privacy: {
      ...base.privacy,
      ...(scoped?.privacy || {}),
    },
    features: {
      ...base.features,
      ...(scoped?.features || {}),
      experimentalFlags: {
        ...base.features.experimentalFlags,
        ...(scoped?.features?.experimentalFlags || {}),
      },
    },
    unlocks: {
      ...base.unlocks,
      ...(scoped?.unlocks || {}),
      activeWidgetIds: Array.isArray(scoped?.unlocks?.activeWidgetIds) ? scoped.unlocks.activeWidgetIds : [],
      activeLabModuleIds: Array.isArray(scoped?.unlocks?.activeLabModuleIds) ? scoped.unlocks.activeLabModuleIds : [],
    },
  };

  const legacyVisibility = readUserScopedString(LEGACY_VISIBILITY_KEY, null, userId);
  if (isDefaultQuestVisibility(legacyVisibility)) {
    merged.user.defaultQuestVisibility = legacyVisibility;
  }

  const legacyPresencePrimary = readUserScopedString(LEGACY_PRESENCE_KEY, null, userId);
  const legacyPresenceAlt = readUserScopedString(LEGACY_PRESENCE_KEY_ALT, null, userId);
  const legacyPresence = legacyPresencePrimary ?? legacyPresenceAlt;
  if (isPresenceModeOption(legacyPresence)) {
    merged.user.presenceMode = legacyPresence;
  }

  if (!isFocusModeOption(merged.user.focusMode)) {
    merged.user.focusMode = defaultUserSettings.focusMode;
  }
  if (!isDefaultQuestVisibility(merged.user.defaultQuestVisibility)) {
    merged.user.defaultQuestVisibility = defaultUserSettings.defaultQuestVisibility;
  }
  if (!isPresenceModeOption(merged.user.presenceMode)) {
    merged.user.presenceMode = defaultUserSettings.presenceMode;
  }

  return merged;
};

const persistDeviceSettings = (device: XtationDeviceSettings) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify(device));
  window.localStorage.setItem(LEGACY_DENSITY_KEY, device.density);
  window.localStorage.setItem(LEGACY_MOTION_KEY, device.motion === 'reduced' ? 'reduced' : 'normal');
};

const persistUserSettings = (userId: string, state: Omit<XtationSettingsState, 'device'>) => {
  writeUserScopedJSON(USER_SETTINGS_KEY, state, userId);
  writeUserScopedString(LEGACY_VISIBILITY_KEY, state.user.defaultQuestVisibility, userId);
  writeUserScopedString(LEGACY_PRESENCE_KEY, state.user.presenceMode, userId);
  writeUserScopedString(LEGACY_PRESENCE_KEY_ALT, state.user.presenceMode, userId);
};

export const initializeXtationSettingsFromStorage = () => {
  const device = readDeviceSettings();
  applyDeviceSettingsToDom(device);
  return device;
};

interface XtationSettingsContextValue {
  settings: XtationSettingsState;
  setDensity: (next: DensityOption) => void;
  setMotionReduced: (reduced: boolean) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setAudioVolume: (volume: number) => void;
  setAudioMixLevel: (group: keyof XtationAudioMixLevels, volume: number) => void;
  setPerformanceMode: (mode: XtationDeviceSettings['performanceMode']) => void;
  setDevHudEnabled: (enabled: boolean) => void;
  setFocusMode: (mode: FocusModeOption) => void;
  setDefaultQuestVisibility: (visibility: DefaultQuestVisibility) => void;
  setPresenceMode: (mode: PresenceModeOption) => void;
  setPrivacySetting: <K extends keyof XtationPrivacySettings>(key: K, value: XtationPrivacySettings[K]) => void;
  setNotification: (key: keyof XtationNotificationSettings, enabled: boolean) => void;
  setFeatureEnabled: (key: 'multiplayerEnabled' | 'labEnabled' | 'storeEnabled', enabled: boolean) => void;
  setExperimentalFlag: (key: string, enabled: boolean) => void;
  setActiveThemeId: (themeId?: string) => void;
  setActiveSoundPackId: (soundPackId?: string) => void;
  toggleActiveWidgetId: (widgetId: string) => void;
  toggleActiveLabModuleId: (moduleId: string) => void;
  replaceSettingsSnapshot: (snapshot: Partial<XtationSettingsState>) => void;
}

const XtationSettingsContext = createContext<XtationSettingsContextValue | null>(null);

const GUEST_SCOPE_ID = 'anon';

export const XtationSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const scopeId = user?.id || GUEST_SCOPE_ID;
  const [settings, setSettings] = useState<XtationSettingsState>(() => ({
    ...cloneDefaults(),
    device: readDeviceSettings(),
  }));

  useEffect(() => {
    applyDeviceSettingsToDom(settings.device);
    persistDeviceSettings(settings.device);
  }, [settings.device]);

  useEffect(() => {
    if (authLoading) return;
    const nextUserSettings = readUserSettings(scopeId);
    setSettings((prev) => ({
      ...prev,
      ...nextUserSettings,
    }));
  }, [authLoading, scopeId]);

  useEffect(() => {
    persistUserSettings(scopeId, {
      user: settings.user,
      notifications: settings.notifications,
      privacy: settings.privacy,
      features: settings.features,
      unlocks: settings.unlocks,
    });
  }, [scopeId, settings.user, settings.notifications, settings.privacy, settings.features, settings.unlocks]);

  const value = useMemo<XtationSettingsContextValue>(
    () => ({
      settings,
      setDensity: (next) => setSettings((prev) => ({ ...prev, device: { ...prev.device, density: next } })),
      setMotionReduced: (reduced) =>
        setSettings((prev) => ({ ...prev, device: { ...prev.device, motion: reduced ? 'reduced' : 'normal' } })),
      setAudioEnabled: (enabled) => setSettings((prev) => ({ ...prev, device: { ...prev.device, audioEnabled: enabled } })),
      setAudioVolume: (volume) =>
        setSettings((prev) => ({
          ...prev,
          device: { ...prev.device, audioVolume: Math.min(100, Math.max(0, Math.round(volume))) },
        })),
      setAudioMixLevel: (group, volume) =>
        setSettings((prev) => ({
          ...prev,
          device: {
            ...prev.device,
            audioMixLevels: {
              ...prev.device.audioMixLevels,
              [group]: Math.min(100, Math.max(0, Math.round(volume))),
            },
          },
        })),
      setPerformanceMode: (mode) => setSettings((prev) => ({ ...prev, device: { ...prev.device, performanceMode: mode } })),
      setDevHudEnabled: (enabled) =>
        setSettings((prev) => ({ ...prev, device: { ...prev.device, devHudEnabled: enabled } })),
      setFocusMode: (mode) => setSettings((prev) => ({ ...prev, user: { ...prev.user, focusMode: mode } })),
      setDefaultQuestVisibility: (visibility) =>
        setSettings((prev) => ({ ...prev, user: { ...prev.user, defaultQuestVisibility: visibility } })),
      setPresenceMode: (mode) => setSettings((prev) => ({ ...prev, user: { ...prev.user, presenceMode: mode } })),
      setPrivacySetting: (key, value) =>
        setSettings((prev) => ({
          ...prev,
          privacy: { ...prev.privacy, [key]: value },
        })),
      setNotification: (key, enabled) =>
        setSettings((prev) => ({
          ...prev,
          notifications: { ...prev.notifications, [key]: enabled },
        })),
      setFeatureEnabled: (key, enabled) =>
        setSettings((prev) => ({
          ...prev,
          features: { ...prev.features, [key]: enabled },
        })),
      setExperimentalFlag: (key, enabled) =>
        setSettings((prev) => ({
          ...prev,
          features: {
            ...prev.features,
            experimentalFlags: {
              ...prev.features.experimentalFlags,
              [key]: enabled,
            },
          },
        })),
      setActiveThemeId: (themeId) =>
        setSettings((prev) => ({
          ...prev,
          unlocks: { ...prev.unlocks, activeThemeId: themeId || undefined },
        })),
      setActiveSoundPackId: (soundPackId) =>
        setSettings((prev) => ({
          ...prev,
          unlocks: { ...prev.unlocks, activeSoundPackId: soundPackId || undefined },
        })),
      toggleActiveWidgetId: (widgetId) =>
        setSettings((prev) => ({
          ...prev,
          unlocks: {
            ...prev.unlocks,
            activeWidgetIds: prev.unlocks.activeWidgetIds.includes(widgetId)
              ? prev.unlocks.activeWidgetIds.filter((id) => id !== widgetId)
              : [...prev.unlocks.activeWidgetIds, widgetId],
          },
        })),
      toggleActiveLabModuleId: (moduleId) =>
        setSettings((prev) => ({
          ...prev,
          unlocks: {
            ...prev.unlocks,
            activeLabModuleIds: prev.unlocks.activeLabModuleIds.includes(moduleId)
              ? prev.unlocks.activeLabModuleIds.filter((id) => id !== moduleId)
              : [...prev.unlocks.activeLabModuleIds, moduleId],
          },
        })),
      replaceSettingsSnapshot: (snapshot) =>
        setSettings((prev) => ({
          device: {
            ...prev.device,
            ...(snapshot.device || {}),
            audioMixLevels: snapshot.device?.audioMixLevels
              ? normalizeXtationAudioMixLevels(snapshot.device.audioMixLevels)
              : prev.device.audioMixLevels,
          },
          user: {
            ...prev.user,
            ...(snapshot.user || {}),
          },
          notifications: {
            ...prev.notifications,
            ...(snapshot.notifications || {}),
          },
          privacy: {
            ...prev.privacy,
            ...(snapshot.privacy || {}),
          },
          features: {
            ...prev.features,
            ...(snapshot.features || {}),
            experimentalFlags: {
              ...prev.features.experimentalFlags,
              ...(snapshot.features?.experimentalFlags || {}),
            },
          },
          unlocks: {
            ...prev.unlocks,
            ...(snapshot.unlocks || {}),
            activeWidgetIds: Array.isArray(snapshot.unlocks?.activeWidgetIds)
              ? snapshot.unlocks.activeWidgetIds
              : prev.unlocks.activeWidgetIds,
            activeLabModuleIds: Array.isArray(snapshot.unlocks?.activeLabModuleIds)
              ? snapshot.unlocks.activeLabModuleIds
              : prev.unlocks.activeLabModuleIds,
          },
        })),
    }),
    [settings]
  );

  return <XtationSettingsContext.Provider value={value}>{children}</XtationSettingsContext.Provider>;
};

export const useXtationSettings = () => {
  const context = useContext(XtationSettingsContext);
  if (!context) {
    throw new Error('useXtationSettings must be used inside XtationSettingsProvider');
  }
  return context;
};
