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

const ONBOARDING_STATUS_VALUES = new Set(['pending', 'skipped', 'completed']);
const STARTER_TRACK_VALUES = new Set(['mission', 'practice', 'system']);
const SELF_TREE_BRANCH_VALUES = new Set([
  'Knowledge',
  'Creation',
  'Systems',
  'Communication',
  'Physical',
  'Inner',
]);

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

const parseOnboardingState = (value: unknown): XtationOnboardingState | null => {
  if (!isRecord(value) || typeof value.status !== 'string' || !ONBOARDING_STATUS_VALUES.has(value.status)) {
    return null;
  }
  if (value.updatedAt !== null && value.updatedAt !== undefined && typeof value.updatedAt !== 'number') {
    return null;
  }
  return {
    status: value.status as XtationOnboardingState['status'],
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : null,
  };
};

const parseOnboardingHandoff = (value: unknown): XtationOnboardingHandoff | null => {
  if (!isRecord(value)) return null;
  if (typeof value.questId !== 'string' || !value.questId.trim()) return null;
  if (typeof value.title !== 'string' || !value.title.trim()) return null;
  if (typeof value.branch !== 'string' || !SELF_TREE_BRANCH_VALUES.has(value.branch)) return null;
  if (typeof value.track !== 'string' || !STARTER_TRACK_VALUES.has(value.track)) return null;
  if (typeof value.createdAt !== 'number') return null;

  return {
    questId: value.questId,
    title: value.title,
    branch: value.branch as XtationOnboardingHandoff['branch'],
    track: value.track as XtationOnboardingHandoff['track'],
    nodeTitle: typeof value.nodeTitle === 'string' && value.nodeTitle.trim() ? value.nodeTitle : undefined,
    createdAt: value.createdAt,
    dismissedAt: typeof value.dismissedAt === 'number' ? value.dismissedAt : null,
  };
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

const normalizeStationExportPayload = (value: unknown): XtationStationExportPayload | null => {
  if (!isRecord(value) || value.version !== 'xtation-station-export-v1') return null;

  const exportedAt = typeof value.exportedAt === 'number' ? value.exportedAt : Date.now();
  const scope = value.scope === 'account' ? 'account' : 'guest';
  const ledgerSource = 'ledger' in value ? value.ledger : null;
  const ledger = xpRepository.normalize(ledgerSource);

  return {
    version: 'xtation-station-export-v1',
    exportedAt,
    scope,
    authStatus: typeof value.authStatus === 'string' ? value.authStatus : undefined,
    user: isRecord(value.user)
      ? {
          id: typeof value.user.id === 'string' ? value.user.id : null,
          email: typeof value.user.email === 'string' ? value.user.email : null,
        }
      : null,
    platform: parsePlatformProfile(value.platform),
    theme: isRecord(value.theme)
      ? {
          theme: typeof value.theme.theme === 'string' ? (value.theme.theme as XtationTheme) : undefined,
          accent: typeof value.theme.accent === 'string' ? (value.theme.accent as XtationAccent) : undefined,
          resolution:
            typeof value.theme.resolution === 'string'
              ? (value.theme.resolution as XtationResolutionMode)
              : undefined,
        }
      : undefined,
    settings: isRecord(value.settings) ? (value.settings as XtationSettingsState) : undefined,
    onboarding: isRecord(value.onboarding)
      ? {
          state: parseOnboardingState(value.onboarding.state),
          handoff: parseOnboardingHandoff(value.onboarding.handoff),
        }
      : undefined,
    navigation: isRecord(value.navigation)
      ? {
          lastView: parseLastView(value.navigation.lastView),
        }
      : undefined,
    ledger,
  };
};

const normalizeRestoreRecoverySnapshot = (
  value: unknown
): XtationStationRestoreRecoverySnapshot | null => {
  if (!isRecord(value)) return null;
  const currentStation = normalizeStationExportPayload(value.currentStation);
  const importedStation = normalizeStationExportPayload(value.importedStation);
  if (!currentStation || !importedStation) return null;

  return {
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    restoredIntoScope: value.restoredIntoScope === 'account' ? 'account' : 'guest',
    currentStation,
    importedStation,
  };
};

export const parseXtationStationImport = (raw: string): XtationStationExportPayload => {
  const parsed = JSON.parse(raw) as unknown;
  const normalized = normalizeStationExportPayload(parsed);
  if (!normalized) {
    throw new Error('This file is not a valid XTATION station export.');
  }
  return normalized;
};

export const readXtationStationRestoreRecoverySnapshot = (userId?: string | null) => {
  if (typeof window === 'undefined') return null;
  if (userId) {
    return normalizeRestoreRecoverySnapshot(
      readUserScopedJSON<unknown>(RESTORE_RECOVERY_KEY, null, userId)
    );
  }
  try {
    const raw = window.localStorage.getItem(GUEST_RESTORE_RECOVERY_KEY);
    return raw ? normalizeRestoreRecoverySnapshot(JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
};

export const writeXtationStationRestoreRecoverySnapshot = (
  snapshot: XtationStationRestoreRecoverySnapshot,
  userId?: string | null
) => {
  if (typeof window === 'undefined') return false;
  const normalized = normalizeRestoreRecoverySnapshot(snapshot);
  if (!normalized) return false;
  if (userId) {
    return writeUserScopedJSON(RESTORE_RECOVERY_KEY, normalized, userId);
  }
  try {
    window.localStorage.setItem(GUEST_RESTORE_RECOVERY_KEY, JSON.stringify(normalized));
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
