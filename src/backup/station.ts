import { xpRepository } from '../../components/XP/xpRepository';
import type { XPLedgerState } from '../../components/XP/xpTypes';
import { ClientView } from '../../types';
import type { OperatorPlan, OperatorStationProfileSnapshot, ReleaseChannel } from '../admin/AdminConsoleProvider';
import { isRestorableXtationView } from '../navigation/lastView';
import type { XtationOnboardingHandoff, XtationOnboardingState } from '../onboarding/storage';
import type {
  XtationAccent,
  XtationResolutionMode,
  XtationTheme,
} from '../theme/ThemeProvider';
import type { XtationSettingsState } from '../settings/SettingsProvider';
import {
  clearUserScopedKey,
  readUserScopedJSON,
  writeUserScopedJSON,
} from '../lib/userScopedStorage';

const RESTORE_RECOVERY_KEY = 'xtation_station_restore_recovery_v1';
const GUEST_RESTORE_RECOVERY_KEY = `${RESTORE_RECOVERY_KEY}:guest`;

export interface XtationStationExportPayload {
  version: 'xtation-station-export-v1';
  exportedAt: number;
  scope: 'guest' | 'account';
  authStatus?: string;
  user?: {
    id?: string | null;
    email?: string | null;
  } | null;
  platform?: OperatorStationProfileSnapshot;
  theme?: {
    theme?: XtationTheme;
    accent?: XtationAccent;
    resolution?: XtationResolutionMode;
  };
  settings?: XtationSettingsState;
  onboarding?: {
    state?: XtationOnboardingState | null;
    handoff?: XtationOnboardingHandoff | null;
  };
  navigation?: {
    lastView?: ClientView | null;
  };
  ledger: XPLedgerState;
}

export interface XtationStationRestoreRecoverySnapshot {
  createdAt: number;
  restoredIntoScope: 'guest' | 'account';
  currentStation: XtationStationExportPayload;
  importedStation: XtationStationExportPayload;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isReleaseChannel = (value: unknown): value is ReleaseChannel =>
  value === 'internal' || value === 'beta' || value === 'stable';

const isOperatorPlan = (value: unknown): value is OperatorPlan =>
  value === 'free' || value === 'trial' || value === 'pro' || value === 'team';

const normalizeFeatureFlags = (value: unknown): Record<string, boolean> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, flagValue]) => typeof flagValue === 'boolean')
  );
};

const parseLastView = (value: unknown): ClientView | null => {
  if (typeof value !== 'string') return null;
  if (!Object.values(ClientView).includes(value as ClientView)) return null;
  return isRestorableXtationView(value as ClientView) ? (value as ClientView) : null;
};

const parsePlatformProfile = (value: unknown): OperatorStationProfileSnapshot | undefined => {
  if (!isRecord(value)) return undefined;
  return {
    releaseChannel: isReleaseChannel(value.releaseChannel) ? value.releaseChannel : 'stable',
    plan: isOperatorPlan(value.plan) ? value.plan : 'free',
    trialEndsAt: typeof value.trialEndsAt === 'number' ? value.trialEndsAt : null,
    betaCohort: typeof value.betaCohort === 'string' && value.betaCohort.trim() ? value.betaCohort.trim() : null,
    featureFlags: normalizeFeatureFlags(value.featureFlags),
  };
};

export const parseXtationStationImport = (raw: string): XtationStationExportPayload => {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed) || parsed.version !== 'xtation-station-export-v1') {
    throw new Error('This file is not a valid XTATION station export.');
  }

  const exportedAt = typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now();
  const scope = parsed.scope === 'account' ? 'account' : 'guest';
  const ledger = xpRepository.normalize(parsed.ledger);

  return {
    version: 'xtation-station-export-v1',
    exportedAt,
    scope,
    authStatus: typeof parsed.authStatus === 'string' ? parsed.authStatus : undefined,
    user: isRecord(parsed.user)
      ? {
          id: typeof parsed.user.id === 'string' ? parsed.user.id : null,
          email: typeof parsed.user.email === 'string' ? parsed.user.email : null,
        }
      : null,
    platform: parsePlatformProfile(parsed.platform),
    theme: isRecord(parsed.theme)
      ? {
          theme: typeof parsed.theme.theme === 'string' ? (parsed.theme.theme as XtationTheme) : undefined,
          accent: typeof parsed.theme.accent === 'string' ? (parsed.theme.accent as XtationAccent) : undefined,
          resolution:
            typeof parsed.theme.resolution === 'string'
              ? (parsed.theme.resolution as XtationResolutionMode)
              : undefined,
        }
      : undefined,
    settings: isRecord(parsed.settings) ? (parsed.settings as XtationSettingsState) : undefined,
    onboarding: isRecord(parsed.onboarding)
      ? {
          state: (parsed.onboarding.state as XtationOnboardingState | null | undefined) ?? null,
          handoff: (parsed.onboarding.handoff as XtationOnboardingHandoff | null | undefined) ?? null,
        }
      : undefined,
    navigation: isRecord(parsed.navigation)
      ? {
          lastView: parseLastView(parsed.navigation.lastView),
        }
      : undefined,
    ledger,
  };
};

export const readXtationStationRestoreRecoverySnapshot = (userId?: string | null) => {
  if (typeof window === 'undefined') return null;
  if (userId) {
    return readUserScopedJSON<XtationStationRestoreRecoverySnapshot | null>(RESTORE_RECOVERY_KEY, null, userId);
  }
  try {
    const raw = window.localStorage.getItem(GUEST_RESTORE_RECOVERY_KEY);
    return raw ? (JSON.parse(raw) as XtationStationRestoreRecoverySnapshot) : null;
  } catch {
    return null;
  }
};

export const writeXtationStationRestoreRecoverySnapshot = (
  snapshot: XtationStationRestoreRecoverySnapshot,
  userId?: string | null
) => {
  if (typeof window === 'undefined') return false;
  if (userId) {
    return writeUserScopedJSON(RESTORE_RECOVERY_KEY, snapshot, userId);
  }
  try {
    window.localStorage.setItem(GUEST_RESTORE_RECOVERY_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
};

export const clearXtationStationRestoreRecoverySnapshot = (userId?: string | null) => {
  if (typeof window === 'undefined') return false;
  if (userId) {
    clearUserScopedKey(RESTORE_RECOVERY_KEY, userId);
    return true;
  }
  window.localStorage.removeItem(GUEST_RESTORE_RECOVERY_KEY);
  return true;
};
