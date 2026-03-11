import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { readUserScopedJSON, writeUserScopedJSON } from '../lib/userScopedStorage';
import {
  loadAccountStationProfile,
  MissingAccountStationProfileTableError,
  saveAccountStationProfile,
} from '../platform/accountStationProfile';
import { useTheme } from '../theme/ThemeProvider';
import { useXtationSettings } from '../settings/SettingsProvider';

export type OperatorRole =
  | 'super_admin'
  | 'ops_admin'
  | 'support_admin'
  | 'content_admin'
  | 'beta_manager'
  | 'finance_admin';

export type ReleaseChannel = 'internal' | 'beta' | 'stable';
export type OperatorPlan = 'free' | 'trial' | 'pro' | 'team';
export type OperatorAuditScope = 'access' | 'rollout' | 'support' | 'catalog' | 'test_lab';
export type OperatorAccessSource = 'env_allowlist' | 'dev_preview' | 'denied';
export type OperatorStationKind = 'current-user' | 'local-station' | 'test-account';

export interface OperatorStationRecord {
  id: string;
  kind: OperatorStationKind;
  label: string;
  email: string | null;
  releaseChannel: ReleaseChannel;
  plan: OperatorPlan;
  trialEndsAt: number | null;
  betaCohort: string | null;
  supportNotes: string;
  featureFlags: Record<string, boolean>;
  createdAt: number;
  lastSeenAt: number;
}

export type OperatorStationProfileSnapshot = Pick<
  OperatorStationRecord,
  'releaseChannel' | 'plan' | 'trialEndsAt' | 'betaCohort' | 'featureFlags'
>;

export interface OperatorAuditEntry {
  id: string;
  createdAt: number;
  actorLabel: string;
  action: string;
  scope: OperatorAuditScope;
  stationId: string;
  summary: string;
}

export interface OperatorSupportLens {
  stationId: string;
  stationLabel: string;
  startedAt: number;
}

export interface OperatorConsoleState {
  stations: OperatorStationRecord[];
  audit: OperatorAuditEntry[];
  supportLens: OperatorSupportLens | null;
  lastReviewedAt: number | null;
}

export interface OperatorAccessState {
  allowed: boolean;
  source: OperatorAccessSource;
  roles: OperatorRole[];
  label: string;
}

export type PlatformSyncStatus = 'local_only' | 'loading' | 'saving' | 'synced' | 'error';

interface AdminConsoleContextValue {
  access: OperatorAccessState;
  state: OperatorConsoleState;
  currentStation: OperatorStationRecord;
  platformSyncStatus: PlatformSyncStatus;
  platformSyncMessage: string | null;
  platformCloudUpdatedAt: number | null;
  platformCloudEnabled: boolean;
  restoreCurrentStationProfile: (profile: OperatorStationProfileSnapshot, summary?: string) => void;
  setReleaseChannel: (stationId: string, channel: ReleaseChannel) => void;
  setPlan: (stationId: string, plan: OperatorPlan) => void;
  setTrialDays: (stationId: string, days: number | null) => void;
  setBetaCohort: (stationId: string, cohort: string | null) => void;
  toggleFeatureFlag: (stationId: string, flag: string) => void;
  setSupportNotes: (stationId: string, notes: string) => void;
  createTestAccount: () => void;
  removeStation: (stationId: string) => void;
  startSupportLens: (stationId: string) => void;
  startSupportLensExternal: (stationId: string, stationLabel: string, summary?: string) => void;
  stopSupportLens: () => void;
  markAuditReviewed: () => void;
}

const USER_ADMIN_CONSOLE_KEY = 'xtation_admin_console_v1';
const GUEST_ADMIN_CONSOLE_KEY = 'xtation_admin_console_guest_v1';

const DEFAULT_FEATURE_FLAGS = {
  avatar_lobby: false,
  people_ops_discovery: false,
  dusk_connected_mode: true,
  admin_console: true,
};

const defaultFeatureFlags = () => ({ ...DEFAULT_FEATURE_FLAGS });

const parseCsv = (value: string | undefined) =>
  value
    ?.split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean) ?? [];

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const buildSyncedProfileSignature = (station: Pick<OperatorStationRecord, 'releaseChannel' | 'plan' | 'trialEndsAt' | 'betaCohort' | 'featureFlags'>) =>
  JSON.stringify({
    releaseChannel: station.releaseChannel,
    plan: station.plan,
    trialEndsAt: station.trialEndsAt,
    betaCohort: station.betaCohort,
    featureFlags: station.featureFlags,
  });

const buildSyncedPreferencesSignature = (preferences: {
  theme: string;
  accent: string;
  resolution: string;
  unlocks: {
    activeThemeId?: string;
    activeSoundPackId?: string;
    activeWidgetIds: string[];
    activeLabModuleIds: string[];
  };
}) =>
  JSON.stringify({
    theme: preferences.theme,
    accent: preferences.accent,
    resolution: preferences.resolution,
    unlocks: {
      activeThemeId: preferences.unlocks.activeThemeId || null,
      activeSoundPackId: preferences.unlocks.activeSoundPackId || null,
      activeWidgetIds: [...preferences.unlocks.activeWidgetIds].sort(),
      activeLabModuleIds: [...preferences.unlocks.activeLabModuleIds].sort(),
    },
  });

const buildAuditEntry = (
  actorLabel: string,
  scope: OperatorAuditScope,
  action: string,
  stationId: string,
  summary: string
): OperatorAuditEntry => ({
  id: createId('audit'),
  createdAt: Date.now(),
  actorLabel,
  scope,
  action,
  stationId,
  summary,
});

const TEST_ACCOUNT_SEEDS: OperatorStationRecord[] = [
  {
    id: 'test-beta-runner',
    kind: 'test-account',
    label: 'Beta Runner',
    email: 'beta.runner@xtation.local',
    releaseChannel: 'beta',
    plan: 'trial',
    trialEndsAt: Date.now() + 1000 * 60 * 60 * 24 * 10,
    betaCohort: 'launch-wave',
    supportNotes: 'Use this record to preview beta flags and guided setup support.',
    featureFlags: {
      ...defaultFeatureFlags(),
      people_ops_discovery: true,
    },
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  },
  {
    id: 'test-pro-operator',
    kind: 'test-account',
    label: 'Pro Operator',
    email: 'pro.operator@xtation.local',
    releaseChannel: 'stable',
    plan: 'pro',
    trialEndsAt: null,
    betaCohort: null,
    supportNotes: 'Use this record to preview the stable paid path.',
    featureFlags: {
      ...defaultFeatureFlags(),
      avatar_lobby: true,
    },
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  },
];

const normalizeStation = (record: Partial<OperatorStationRecord>, fallback: OperatorStationRecord): OperatorStationRecord => ({
  ...fallback,
  ...record,
  featureFlags: {
    ...fallback.featureFlags,
    ...(record.featureFlags || {}),
  },
});

const readStoredState = (userId?: string | null): OperatorConsoleState | null => {
  if (typeof window === 'undefined') return null;
  if (userId) {
    return readUserScopedJSON<OperatorConsoleState | null>(USER_ADMIN_CONSOLE_KEY, null, userId);
  }
  try {
    const raw = window.localStorage.getItem(GUEST_ADMIN_CONSOLE_KEY);
    return raw ? (JSON.parse(raw) as OperatorConsoleState) : null;
  } catch {
    return null;
  }
};

const persistStoredState = (state: OperatorConsoleState, userId?: string | null) => {
  if (typeof window === 'undefined') return;
  if (userId) {
    writeUserScopedJSON(USER_ADMIN_CONSOLE_KEY, state, userId);
    return;
  }
  window.localStorage.setItem(GUEST_ADMIN_CONSOLE_KEY, JSON.stringify(state));
};

const buildCurrentStation = (userId?: string | null, userEmail?: string | null, userName?: string | null): OperatorStationRecord => {
  const now = Date.now();
  if (userId) {
    return {
      id: `user:${userId}`,
      kind: 'current-user',
      label: userName || userEmail || 'Current Account',
      email: userEmail || null,
      releaseChannel: 'stable',
      plan: 'free',
      trialEndsAt: null,
      betaCohort: null,
      supportNotes: '',
      featureFlags: defaultFeatureFlags(),
      createdAt: now,
      lastSeenAt: now,
    };
  }

  return {
    id: 'station:local',
    kind: 'local-station',
    label: 'Local Station',
    email: null,
    releaseChannel: 'internal',
    plan: 'trial',
    trialEndsAt: now + 1000 * 60 * 60 * 24 * 14,
    betaCohort: 'offline-preview',
    supportNotes: 'This station is running local-first without a signed-in account.',
    featureFlags: defaultFeatureFlags(),
    createdAt: now,
    lastSeenAt: now,
  };
};

const deriveAccess = (userId?: string | null, userEmail?: string | null): OperatorAccessState => {
  const envEmails = parseCsv(import.meta.env.VITE_XTATION_OPERATOR_EMAILS);
  const envIds = parseCsv(import.meta.env.VITE_XTATION_OPERATOR_IDS);
  const normalizedEmail = userEmail?.trim().toLowerCase() ?? '';
  const normalizedId = userId?.trim().toLowerCase() ?? '';

  if (
    (normalizedEmail && envEmails.includes(normalizedEmail)) ||
    (normalizedId && envIds.includes(normalizedId))
  ) {
    return {
      allowed: true,
      source: 'env_allowlist',
      roles: ['super_admin'],
      label: 'Allowlisted operator',
    };
  }

  if (import.meta.env.DEV) {
    return {
      allowed: true,
      source: 'dev_preview',
      roles: ['super_admin'],
      label: userId ? 'Developer preview operator' : 'Local preview operator',
    };
  }

  return {
    allowed: false,
    source: 'denied',
    roles: [],
    label: 'No operator access',
  };
};

const mergeState = (stored: OperatorConsoleState | null, currentStation: OperatorStationRecord): OperatorConsoleState => {
  const stations = Array.isArray(stored?.stations) ? stored.stations : [];
  const nextStations = [
    normalizeStation(
      stations.find((station) => station.id === currentStation.id) || {},
      currentStation
    ),
    ...stations.filter((station) => station.id !== currentStation.id && station.kind !== 'test-account'),
    ...TEST_ACCOUNT_SEEDS.map((seed) => {
      const storedSeed = stations.find((station) => station.id === seed.id);
      return normalizeStation(storedSeed || {}, seed);
    }),
    ...stations.filter(
      (station) =>
        station.kind === 'test-account' && !TEST_ACCOUNT_SEEDS.some((seed) => seed.id === station.id)
    ),
  ];

  return {
    stations: nextStations,
    audit: Array.isArray(stored?.audit) ? stored.audit.slice(0, 120) : [],
    supportLens: stored?.supportLens || null,
    lastReviewedAt: typeof stored?.lastReviewedAt === 'number' ? stored.lastReviewedAt : null,
  };
};

const AdminConsoleContext = createContext<AdminConsoleContextValue | null>(null);

export const AdminConsoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { theme, accent, resolution, setTheme, setAccent, setResolution } = useTheme();
  const { settings, replaceSettingsSnapshot } = useXtationSettings();
  const activeUserId = user?.id || null;
  const currentStationSeed = useMemo(
    () => buildCurrentStation(activeUserId, user?.email || null, user?.name || null),
    [activeUserId, user?.email, user?.name]
  );
  const access = useMemo(
    () => deriveAccess(activeUserId, user?.email || null),
    [activeUserId, user?.email]
  );
  const [state, setState] = useState<OperatorConsoleState>(() => mergeState(readStoredState(activeUserId), currentStationSeed));
  const [platformSyncStatus, setPlatformSyncStatus] = useState<PlatformSyncStatus>('local_only');
  const [platformSyncMessage, setPlatformSyncMessage] = useState<string | null>(null);
  const [platformCloudUpdatedAt, setPlatformCloudUpdatedAt] = useState<number | null>(null);
  const [platformCloudEnabled, setPlatformCloudEnabled] = useState(false);
  const [platformHydratedScopeKey, setPlatformHydratedScopeKey] = useState('__boot__');
  const [lastPlatformSyncedSignature, setLastPlatformSyncedSignature] = useState<string | null>(null);
  const [lastPlatformPreferencesSignature, setLastPlatformPreferencesSignature] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    setState(mergeState(readStoredState(activeUserId), currentStationSeed));
  }, [authLoading, activeUserId, currentStationSeed]);

  useEffect(() => {
    if (authLoading) return;
    persistStoredState(state, activeUserId);
  }, [state, authLoading, activeUserId]);

  const actorLabel = user?.email || user?.name || 'Local operator';
  const currentStation = state.stations.find((station) => station.id === currentStationSeed.id) || currentStationSeed;
  const currentStationSyncSignature = useMemo(() => buildSyncedProfileSignature(currentStation), [currentStation]);
  const currentPreferencesSignature = useMemo(
    () =>
      buildSyncedPreferencesSignature({
        theme,
        accent,
        resolution,
        unlocks: settings.unlocks,
      }),
    [theme, accent, resolution, settings.unlocks]
  );

  const updateState = useCallback(
    (updater: (current: OperatorConsoleState) => OperatorConsoleState) => {
      setState((current) => {
        const next = updater(current);
        return {
          ...next,
          stations: next.stations.map((station) =>
            station.id === currentStationSeed.id
              ? normalizeStation(station, {
                  ...currentStationSeed,
                  releaseChannel: station.releaseChannel,
                  plan: station.plan,
                  trialEndsAt: station.trialEndsAt,
                  betaCohort: station.betaCohort,
                  supportNotes: station.supportNotes,
                  featureFlags: station.featureFlags,
                })
              : station
          ),
        };
      });
    },
    [currentStationSeed]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!activeUserId) {
      setPlatformSyncStatus('local_only');
      setPlatformSyncMessage(null);
      setPlatformCloudUpdatedAt(null);
      setPlatformCloudEnabled(false);
      setPlatformHydratedScopeKey('local');
      setLastPlatformSyncedSignature(null);
      setLastPlatformPreferencesSignature(null);
      return;
    }

    let cancelled = false;
    setPlatformSyncStatus('loading');
    setPlatformSyncMessage(null);

    loadAccountStationProfile(activeUserId)
      .then((profile) => {
        if (cancelled) return;
        setPlatformCloudEnabled(true);
        setPlatformHydratedScopeKey(activeUserId);

        if (!profile) {
          setPlatformCloudUpdatedAt(null);
          setLastPlatformSyncedSignature(null);
          setLastPlatformPreferencesSignature(null);
          setPlatformSyncStatus('saving');
          return;
        }

        updateState((current) => ({
          ...current,
          stations: current.stations.map((station) =>
            station.id === currentStationSeed.id
              ? {
                  ...station,
                  releaseChannel: profile.releaseChannel,
                  plan: profile.plan,
                  trialEndsAt: profile.trialEndsAt,
                  betaCohort: profile.betaCohort,
                  featureFlags: {
                    ...station.featureFlags,
                    ...profile.featureFlags,
                  },
                  lastSeenAt: profile.updatedAt || station.lastSeenAt,
                }
              : station
          ),
        }));

        setPlatformCloudUpdatedAt(profile.updatedAt);
        setLastPlatformSyncedSignature(
          buildSyncedProfileSignature({
            releaseChannel: profile.releaseChannel,
            plan: profile.plan,
            trialEndsAt: profile.trialEndsAt,
            betaCohort: profile.betaCohort,
            featureFlags: profile.featureFlags,
          } as Pick<OperatorStationRecord, 'releaseChannel' | 'plan' | 'trialEndsAt' | 'betaCohort' | 'featureFlags'>)
        );
        if (profile.preferences.theme) setTheme(profile.preferences.theme);
        if (profile.preferences.accent) setAccent(profile.preferences.accent);
        if (profile.preferences.resolution) setResolution(profile.preferences.resolution);
        replaceSettingsSnapshot({
          unlocks: {
            activeThemeId: profile.preferences.unlocks?.activeThemeId,
            activeSoundPackId: profile.preferences.unlocks?.activeSoundPackId,
            activeWidgetIds: profile.preferences.unlocks?.activeWidgetIds ?? settings.unlocks.activeWidgetIds,
            activeLabModuleIds: profile.preferences.unlocks?.activeLabModuleIds ?? settings.unlocks.activeLabModuleIds,
          },
        });
        setLastPlatformPreferencesSignature(
          buildSyncedPreferencesSignature({
            theme: profile.preferences.theme || theme,
            accent: profile.preferences.accent || accent,
            resolution: profile.preferences.resolution || resolution,
            unlocks: {
              ...settings.unlocks,
              ...(profile.preferences.unlocks || {}),
              activeWidgetIds: profile.preferences.unlocks?.activeWidgetIds ?? settings.unlocks.activeWidgetIds,
              activeLabModuleIds: profile.preferences.unlocks?.activeLabModuleIds ?? settings.unlocks.activeLabModuleIds,
            },
          })
        );
        setPlatformSyncStatus('synced');
      })
      .catch((error) => {
        if (cancelled) return;
        setPlatformHydratedScopeKey(activeUserId);
        setPlatformCloudUpdatedAt(null);
        setLastPlatformSyncedSignature(null);
        setLastPlatformPreferencesSignature(null);
        if (error instanceof MissingAccountStationProfileTableError) {
          setPlatformCloudEnabled(false);
          setPlatformSyncStatus('local_only');
          setPlatformSyncMessage('Supabase platform profile table is not installed yet.');
          console.warn('[platform-profile] Missing user_station_profiles table; using local fallback.');
          return;
        }
        setPlatformCloudEnabled(true);
        setPlatformSyncStatus('error');
        setPlatformSyncMessage(error instanceof Error ? error.message : 'Failed to load station profile');
        console.warn('[platform-profile] Failed to load account station profile', error);
      });

    return () => {
      cancelled = true;
    };
  }, [
    accent,
    activeUserId,
    authLoading,
    currentStationSeed.id,
    replaceSettingsSnapshot,
    resolution,
    setAccent,
    setResolution,
    setTheme,
    settings.unlocks,
    theme,
    updateState,
  ]);

  useEffect(() => {
    if (authLoading || !activeUserId) return;
    if (!platformCloudEnabled) return;
    if (platformHydratedScopeKey !== activeUserId) return;
    if (
      currentStationSyncSignature === lastPlatformSyncedSignature &&
      currentPreferencesSignature === lastPlatformPreferencesSignature
    ) {
      return;
    }

    let cancelled = false;
    setPlatformSyncStatus('saving');
    setPlatformSyncMessage(null);

    saveAccountStationProfile(activeUserId, {
      releaseChannel: currentStation.releaseChannel,
      plan: currentStation.plan,
      trialEndsAt: currentStation.trialEndsAt,
      betaCohort: currentStation.betaCohort,
      featureFlags: currentStation.featureFlags,
      preferences: {
        theme,
        accent,
        resolution,
        unlocks: settings.unlocks,
      },
    })
      .then((profile) => {
        if (cancelled) return;
        setPlatformCloudUpdatedAt(profile.updatedAt);
        setLastPlatformSyncedSignature(buildSyncedProfileSignature(profile));
        setLastPlatformPreferencesSignature(
          buildSyncedPreferencesSignature({
            theme: profile.preferences.theme || theme,
            accent: profile.preferences.accent || accent,
            resolution: profile.preferences.resolution || resolution,
            unlocks: {
              ...settings.unlocks,
              ...(profile.preferences.unlocks || {}),
              activeWidgetIds: profile.preferences.unlocks?.activeWidgetIds ?? settings.unlocks.activeWidgetIds,
              activeLabModuleIds: profile.preferences.unlocks?.activeLabModuleIds ?? settings.unlocks.activeLabModuleIds,
            },
          })
        );
        setPlatformSyncStatus('synced');
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof MissingAccountStationProfileTableError) {
          setPlatformCloudEnabled(false);
          setPlatformSyncStatus('local_only');
          setPlatformSyncMessage('Supabase platform profile table is not installed yet.');
          console.warn('[platform-profile] Missing user_station_profiles table during save; using local fallback.');
          return;
        }
        setPlatformSyncStatus('error');
        setPlatformSyncMessage(error instanceof Error ? error.message : 'Failed to save station profile');
        console.warn('[platform-profile] Failed to save account station profile', error);
      });

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    activeUserId,
    currentStation.betaCohort,
    currentStation.featureFlags,
    currentStation.plan,
    currentStation.releaseChannel,
    currentStation.trialEndsAt,
    currentPreferencesSignature,
    currentStationSyncSignature,
    accent,
    lastPlatformSyncedSignature,
    lastPlatformPreferencesSignature,
    platformCloudEnabled,
    platformHydratedScopeKey,
    resolution,
    settings.unlocks,
    theme,
  ]);

  const updateStation = useCallback(
    (
      stationId: string,
      mutate: (station: OperatorStationRecord) => OperatorStationRecord,
      auditFactory?: (station: OperatorStationRecord, next: OperatorStationRecord) => OperatorAuditEntry | null
    ) => {
      updateState((current) => {
        let auditEntry: OperatorAuditEntry | null = null;
        const stations = current.stations.map((station) => {
          if (station.id !== stationId) return station;
          const next = mutate(station);
          if (auditFactory) {
            auditEntry = auditFactory(station, next);
          }
          return next;
        });
        return {
          ...current,
          stations,
          audit: auditEntry ? [auditEntry, ...current.audit].slice(0, 120) : current.audit,
        };
      });
    },
    [updateState]
  );

  const setReleaseChannel = useCallback(
    (stationId: string, channel: ReleaseChannel) => {
      updateStation(
        stationId,
        (station) => (station.releaseChannel === channel ? station : { ...station, releaseChannel: channel, lastSeenAt: Date.now() }),
        (station, next) =>
          station.releaseChannel === next.releaseChannel
            ? null
            : buildAuditEntry(actorLabel, 'rollout', 'release_channel_change', stationId, `${station.label} -> ${next.releaseChannel}`)
      );
    },
    [actorLabel, updateStation]
  );

  const setPlan = useCallback(
    (stationId: string, plan: OperatorPlan) => {
      updateStation(
        stationId,
        (station) => (station.plan === plan ? station : { ...station, plan, lastSeenAt: Date.now() }),
        (station, next) =>
          station.plan === next.plan
            ? null
            : buildAuditEntry(actorLabel, 'rollout', 'plan_change', stationId, `${station.label} -> ${next.plan}`)
      );
    },
    [actorLabel, updateStation]
  );

  const setTrialDays = useCallback(
    (stationId: string, days: number | null) => {
      updateStation(
        stationId,
        (station) => ({
          ...station,
          plan: days ? 'trial' : station.plan === 'trial' ? 'free' : station.plan,
          trialEndsAt: days ? Date.now() + 1000 * 60 * 60 * 24 * days : null,
          lastSeenAt: Date.now(),
        }),
        (station, next) =>
          buildAuditEntry(
            actorLabel,
            'rollout',
            'trial_window_change',
            stationId,
            days ? `${station.label} trial set to ${days}d` : `${station.label} trial cleared`
          )
      );
    },
    [actorLabel, updateStation]
  );

  const setBetaCohort = useCallback(
    (stationId: string, cohort: string | null) => {
      const normalized = cohort?.trim() || null;
      updateStation(
        stationId,
        (station) => ({
          ...station,
          betaCohort: normalized,
          releaseChannel: normalized ? 'beta' : station.releaseChannel,
          lastSeenAt: Date.now(),
        }),
        (station, next) =>
          station.betaCohort === next.betaCohort
            ? null
            : buildAuditEntry(
                actorLabel,
                'rollout',
                'beta_cohort_change',
                stationId,
                `${station.label} cohort -> ${next.betaCohort || 'none'}`
              )
      );
    },
    [actorLabel, updateStation]
  );

  const toggleFeatureFlag = useCallback(
    (stationId: string, flag: string) => {
      updateStation(
        stationId,
        (station) => ({
          ...station,
          featureFlags: {
            ...station.featureFlags,
            [flag]: !station.featureFlags[flag],
          },
          lastSeenAt: Date.now(),
        }),
        (station, next) =>
          buildAuditEntry(
            actorLabel,
            'rollout',
            'feature_flag_toggle',
            stationId,
            `${station.label} ${flag} -> ${next.featureFlags[flag] ? 'on' : 'off'}`
          )
      );
    },
    [actorLabel, updateStation]
  );

  const setSupportNotes = useCallback(
    (stationId: string, notes: string) => {
      updateStation(
        stationId,
        (station) => ({
          ...station,
          supportNotes: notes,
          lastSeenAt: Date.now(),
        })
      );
    },
    [updateStation]
  );

  const restoreCurrentStationProfile = useCallback(
    (profile: OperatorStationProfileSnapshot, summary = 'Current station profile restored from station file') => {
      updateStation(
        currentStationSeed.id,
        (station) => ({
          ...station,
          releaseChannel: profile.releaseChannel,
          plan: profile.plan,
          trialEndsAt: profile.trialEndsAt,
          betaCohort: profile.betaCohort,
          featureFlags: {
            ...station.featureFlags,
            ...profile.featureFlags,
          },
          lastSeenAt: Date.now(),
        }),
        () => buildAuditEntry(actorLabel, 'support', 'station_profile_restore', currentStationSeed.id, summary)
      );
    },
    [actorLabel, currentStationSeed.id, updateStation]
  );

  const createTestAccount = useCallback(() => {
    const now = Date.now();
    const newStation: OperatorStationRecord = {
      id: createId('test'),
      kind: 'test-account',
      label: `Test Cohort ${state.stations.filter((station) => station.kind === 'test-account').length + 1}`,
      email: null,
      releaseChannel: 'beta',
      plan: 'trial',
      trialEndsAt: now + 1000 * 60 * 60 * 24 * 7,
      betaCohort: 'custom-cohort',
      supportNotes: '',
      featureFlags: defaultFeatureFlags(),
      createdAt: now,
      lastSeenAt: now,
    };
    updateState((current) => ({
      ...current,
      stations: [...current.stations, newStation],
      audit: [
        buildAuditEntry(actorLabel, 'test_lab', 'test_account_create', newStation.id, `${newStation.label} created`),
        ...current.audit,
      ].slice(0, 120),
    }));
  }, [actorLabel, state.stations, updateState]);

  const removeStation = useCallback(
    (stationId: string) => {
      updateState((current) => {
        const station = current.stations.find((entry) => entry.id === stationId);
        if (!station || station.kind !== 'test-account') return current;
        return {
          ...current,
          stations: current.stations.filter((entry) => entry.id !== stationId),
          supportLens:
            current.supportLens?.stationId === stationId
              ? null
              : current.supportLens,
          audit: [
            buildAuditEntry(actorLabel, 'test_lab', 'test_account_remove', stationId, `${station.label} removed`),
            ...current.audit,
          ].slice(0, 120),
        };
      });
    },
    [actorLabel, updateState]
  );

  const startSupportLens = useCallback(
    (stationId: string) => {
      updateState((current) => {
        const station = current.stations.find((entry) => entry.id === stationId);
        if (!station) return current;
        return {
          ...current,
          supportLens: {
            stationId,
            stationLabel: station.label,
            startedAt: Date.now(),
          },
          audit: [
            buildAuditEntry(actorLabel, 'support', 'support_lens_start', stationId, `Support lens -> ${station.label}`),
            ...current.audit,
          ].slice(0, 120),
        };
      });
    },
    [actorLabel, updateState]
  );

  const startSupportLensExternal = useCallback(
    (stationId: string, stationLabel: string, summary?: string) => {
      updateState((current) => ({
        ...current,
        supportLens: {
          stationId,
          stationLabel,
          startedAt: Date.now(),
        },
        audit: [
          buildAuditEntry(
            actorLabel,
            'support',
            'support_lens_external_start',
            stationId,
            summary || `Support lens -> ${stationLabel}`
          ),
          ...current.audit,
        ].slice(0, 120),
      }));
    },
    [actorLabel, updateState]
  );

  const stopSupportLens = useCallback(() => {
    updateState((current) => {
      if (!current.supportLens) return current;
      return {
        ...current,
        supportLens: null,
        audit: [
          buildAuditEntry(actorLabel, 'support', 'support_lens_stop', current.supportLens.stationId, 'Support lens cleared'),
          ...current.audit,
        ].slice(0, 120),
      };
    });
  }, [actorLabel, updateState]);

  const markAuditReviewed = useCallback(() => {
    updateState((current) => ({
      ...current,
      lastReviewedAt: Date.now(),
      audit: [
        buildAuditEntry(actorLabel, 'access', 'audit_reviewed', currentStation.id, 'Audit review checkpoint saved'),
        ...current.audit,
      ].slice(0, 120),
    }));
  }, [actorLabel, currentStation.id, updateState]);

  const value = useMemo<AdminConsoleContextValue>(
    () => ({
      access,
      state,
      currentStation,
      platformSyncStatus,
      platformSyncMessage,
      platformCloudUpdatedAt,
      platformCloudEnabled,
      restoreCurrentStationProfile,
      setReleaseChannel,
      setPlan,
      setTrialDays,
      setBetaCohort,
      toggleFeatureFlag,
      setSupportNotes,
      createTestAccount,
      removeStation,
      startSupportLens,
      startSupportLensExternal,
      stopSupportLens,
      markAuditReviewed,
    }),
    [
      access,
      state,
      currentStation,
      platformSyncStatus,
      platformSyncMessage,
      platformCloudUpdatedAt,
      platformCloudEnabled,
      restoreCurrentStationProfile,
      setReleaseChannel,
      setPlan,
      setTrialDays,
      setBetaCohort,
      toggleFeatureFlag,
      setSupportNotes,
      createTestAccount,
      removeStation,
      startSupportLens,
      startSupportLensExternal,
      stopSupportLens,
      markAuditReviewed,
    ]
  );

  return <AdminConsoleContext.Provider value={value}>{children}</AdminConsoleContext.Provider>;
};

export const useAdminConsole = () => {
  const context = useContext(AdminConsoleContext);
  if (!context) {
    throw new Error('useAdminConsole must be used inside AdminConsoleProvider');
  }
  return context;
};

export const useOptionalAdminConsole = () => useContext(AdminConsoleContext);
