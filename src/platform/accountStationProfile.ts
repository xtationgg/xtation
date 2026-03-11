import { supabase } from '../lib/supabaseClient';
import type { OperatorPlan, ReleaseChannel } from '../admin/AdminConsoleProvider';
import type { XtationAccent, XtationResolutionMode, XtationTheme } from '../theme/ThemeProvider';
import type { XtationUnlockSettings } from '../settings/SettingsProvider';

const TABLE = 'user_station_profiles';

type StationProfileRow = {
  release_channel?: string | null;
  plan?: string | null;
  trial_ends_at?: string | null;
  beta_cohort?: string | null;
  feature_flags?: Record<string, boolean> | null;
  preferences?: Record<string, unknown> | null;
  updated_at?: string | null;
} | null;

export interface AccountStationPreferences {
  theme?: XtationTheme;
  accent?: XtationAccent;
  resolution?: XtationResolutionMode;
  unlocks?: Partial<XtationUnlockSettings>;
}

export interface AccountStationProfile {
  releaseChannel: ReleaseChannel;
  plan: OperatorPlan;
  trialEndsAt: number | null;
  betaCohort: string | null;
  featureFlags: Record<string, boolean>;
  preferences: AccountStationPreferences;
  updatedAt: number | null;
}

export class MissingAccountStationProfileTableError extends Error {
  constructor() {
    super('Supabase table user_station_profiles is missing.');
    this.name = 'MissingAccountStationProfileTableError';
  }
}

const isReleaseChannel = (value: unknown): value is ReleaseChannel =>
  value === 'internal' || value === 'beta' || value === 'stable';

const isPlan = (value: unknown): value is OperatorPlan =>
  value === 'free' || value === 'trial' || value === 'pro' || value === 'team';

const isTheme = (value: unknown): value is XtationTheme =>
  typeof value === 'string' &&
  ['dusk','dusk_soft','dark_minimal_solid','dark_minimal_rounded_solid','dark_minimal_rounded_glass','hud_clean','glass_night','notion_light','notion_dark','void','bureau'].includes(value);

const isAccent = (value: unknown): value is XtationAccent =>
  typeof value === 'string' &&
  ['purple', 'neutral', 'amber', 'teal', 'crimson', 'lime', 'outline'].includes(value);

const isResolution = (value: unknown): value is XtationResolutionMode =>
  typeof value === 'string' &&
  ['auto', 'hd_720', 'hd_1080', 'qhd_1440', 'uhd_2160'].includes(value);

const normalizePreferences = (value: unknown): AccountStationPreferences => {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const unlocksValue = record.unlocks && typeof record.unlocks === 'object' && !Array.isArray(record.unlocks)
    ? (record.unlocks as Record<string, unknown>)
    : {};

  return {
    theme: isTheme(record.theme) ? record.theme : undefined,
    accent: isAccent(record.accent) ? record.accent : undefined,
    resolution: isResolution(record.resolution) ? record.resolution : undefined,
    unlocks: {
      activeThemeId: typeof unlocksValue.activeThemeId === 'string' ? unlocksValue.activeThemeId : undefined,
      activeSoundPackId: typeof unlocksValue.activeSoundPackId === 'string' ? unlocksValue.activeSoundPackId : undefined,
      activeWidgetIds: Array.isArray(unlocksValue.activeWidgetIds)
        ? unlocksValue.activeWidgetIds.filter((entry): entry is string => typeof entry === 'string')
        : undefined,
      activeLabModuleIds: Array.isArray(unlocksValue.activeLabModuleIds)
        ? unlocksValue.activeLabModuleIds.filter((entry): entry is string => typeof entry === 'string')
        : undefined,
    },
  };
};

const isMissingTableError = (error: unknown) => {
  const candidate = error as { code?: string; status?: number; message?: string } | null;
  if (!candidate) return false;
  if (candidate.code === '42P01' || candidate.code === 'PGRST205') return true;
  if (candidate.status === 404) return true;
  const message = candidate.message?.toLowerCase() || '';
  return message.includes('user_station_profiles') && (message.includes('relation') || message.includes('table'));
};

const normalizeProfile = (row: StationProfileRow): AccountStationProfile | null => {
  if (!row) return null;
  return {
    releaseChannel: isReleaseChannel(row.release_channel) ? row.release_channel : 'stable',
    plan: isPlan(row.plan) ? row.plan : 'free',
    trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at).getTime() : null,
    betaCohort: typeof row.beta_cohort === 'string' && row.beta_cohort.trim() ? row.beta_cohort.trim() : null,
    featureFlags:
      row.feature_flags && typeof row.feature_flags === 'object' && !Array.isArray(row.feature_flags)
        ? row.feature_flags
        : {},
    preferences: normalizePreferences(row.preferences),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
  };
};

export const loadAccountStationProfile = async (userId: string): Promise<AccountStationProfile | null> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('release_channel, plan, trial_ends_at, beta_cohort, feature_flags, preferences, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      throw new MissingAccountStationProfileTableError();
    }
    throw error;
  }

  return normalizeProfile(data as StationProfileRow);
};

export const saveAccountStationProfile = async (
  userId: string,
  profile: Omit<AccountStationProfile, 'updatedAt'>
): Promise<AccountStationProfile> => {
  const payload = {
    user_id: userId,
    release_channel: profile.releaseChannel,
    plan: profile.plan,
    trial_ends_at: profile.trialEndsAt ? new Date(profile.trialEndsAt).toISOString() : null,
    beta_cohort: profile.betaCohort,
    feature_flags: profile.featureFlags,
    preferences: profile.preferences || {},
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'user_id' })
    .select('release_channel, plan, trial_ends_at, beta_cohort, feature_flags, preferences, updated_at')
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      throw new MissingAccountStationProfileTableError();
    }
    throw error;
  }

  const normalized = normalizeProfile(data as StationProfileRow);
  return normalized || { ...profile, updatedAt: Date.now() };
};
