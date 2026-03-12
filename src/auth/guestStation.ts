import { xpRepository } from '../../components/XP/xpRepository';
import type { XPLedgerState } from '../../components/XP/xpTypes';
import { ClientView } from '../../types';
import {
  clearUserScopedKey,
  readUserScopedJSON,
  readUserScopedString,
  writeUserScopedJSON,
  writeUserScopedString,
} from '../lib/userScopedStorage';
import type { XtationOnboardingHandoff, XtationOnboardingState } from '../onboarding/storage';

const DISMISSED_SIGNATURE_KEY = 'xtation_guest_station_dismissed_signature_v1';
const RECOVERY_SNAPSHOT_KEY = 'xtation_guest_station_recovery_v1';
export const XTATION_GUEST_STATION_RECOVERY_EVENT = 'xtation:guest-station-recovery';

export interface GuestStationSummary {
  tasks: number;
  sessions: number;
  projects: number;
  selfTreeNodes: number;
  inventorySlots: number;
  activeDays: number;
  latestActivityAt: number | null;
}

export interface GuestStationRecoverySnapshot {
  createdAt: number;
  importedUserId: string;
  importedUserEmail?: string | null;
  accountSnapshot: XPLedgerState;
  guestSnapshot: XPLedgerState;
  guestContext?: {
    lastView: ClientView | null;
    importedView: ClientView | null;
    onboardingState: XtationOnboardingState | null;
    onboardingHandoff: XtationOnboardingHandoff | null;
  };
}

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseClientView = (value: unknown): ClientView | null =>
  typeof value === 'string' && Object.values(ClientView).includes(value as ClientView)
    ? (value as ClientView)
    : null;

const parseOnboardingState = (value: unknown): XtationOnboardingState | null => {
  if (!isRecord(value) || typeof value.status !== 'string' || !ONBOARDING_STATUS_VALUES.has(value.status)) {
    return null;
  }
  if (value.updatedAt !== null && value.updatedAt !== undefined && typeof value.updatedAt !== 'number') {
    return null;
  }
  return {
    status: value.status,
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

const normalizeSnapshot = (value: unknown): XPLedgerState => {
  try {
    return xpRepository.normalize(value);
  } catch {
    return xpRepository.createEmpty();
  }
};

const normalizeGuestContext = (
  value: unknown
): GuestStationRecoverySnapshot['guestContext'] | undefined => {
  if (!isRecord(value)) return undefined;

  const context: GuestStationRecoverySnapshot['guestContext'] = {
    lastView: parseClientView(value.lastView),
    importedView: parseClientView(value.importedView),
    onboardingState: parseOnboardingState(value.onboardingState),
    onboardingHandoff: parseOnboardingHandoff(value.onboardingHandoff),
  };

  if (
    !context.lastView &&
    !context.importedView &&
    !context.onboardingState &&
    !context.onboardingHandoff
  ) {
    return undefined;
  }

  return context;
};

const normalizeGuestStationRecoverySnapshot = (
  value: unknown
): GuestStationRecoverySnapshot | null => {
  if (!isRecord(value) || typeof value.importedUserId !== 'string' || !value.importedUserId.trim()) {
    return null;
  }

  return {
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    importedUserId: value.importedUserId.trim(),
    importedUserEmail: typeof value.importedUserEmail === 'string' ? value.importedUserEmail : null,
    accountSnapshot: normalizeSnapshot(value.accountSnapshot),
    guestSnapshot: normalizeSnapshot(value.guestSnapshot),
    guestContext: normalizeGuestContext(value.guestContext),
  };
};

const hashString = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const getSnapshotActivityDates = (snapshot: XPLedgerState) => {
  const dates = new Set<string>();
  snapshot.sessions.forEach((session) => {
    if (Number.isFinite(session.startAt)) {
      dates.add(new Date(session.startAt).toISOString().slice(0, 10));
    }
  });
  snapshot.completions.forEach((completion) => dates.add(completion.dateKey));
  snapshot.manualLogs.forEach((entry) => dates.add(entry.dateKey));
  snapshot.taskEvents.forEach((entry) => dates.add(entry.dateKey));
  return dates;
};

export const getGuestStationSnapshot = (): XPLedgerState =>
  xpRepository.load(null, { allowLegacyMigration: true, initializeIfMissing: false });

export const clearGuestStationSnapshot = (): XPLedgerState => xpRepository.reset(null);

export const hasGuestStationData = (snapshot: XPLedgerState) =>
  snapshot.tasks.length > 0 ||
  snapshot.sessions.length > 0 ||
  snapshot.projects.length > 0 ||
  snapshot.selfTreeNodes.length > 0 ||
  snapshot.inventorySlots.length > 0 ||
  snapshot.manualLogs.length > 0;

export const buildGuestStationSummary = (snapshot: XPLedgerState): GuestStationSummary => {
  const latestActivityAt = Math.max(
    0,
    ...snapshot.tasks.map((task) => task.updatedAt || task.createdAt),
    ...snapshot.sessions.map((session) => session.updatedAt || session.endAt || session.startAt),
    ...snapshot.manualLogs.map((entry) => entry.createdAt),
    ...snapshot.completions.map((entry) => entry.createdAt),
    ...snapshot.taskEvents.map((entry) => entry.createdAt)
  );

  return {
    tasks: snapshot.tasks.length,
    sessions: snapshot.sessions.length,
    projects: snapshot.projects.length,
    selfTreeNodes: snapshot.selfTreeNodes.length,
    inventorySlots: snapshot.inventorySlots.length,
    activeDays: getSnapshotActivityDates(snapshot).size,
    latestActivityAt: latestActivityAt > 0 ? latestActivityAt : null,
  };
};

export const buildGuestStationSignature = (snapshot: XPLedgerState) => {
  const normalized = xpRepository.normalize(snapshot);
  return hashString(JSON.stringify(normalized));
};

export const readDismissedGuestStationSignature = (userId: string) =>
  readUserScopedString(DISMISSED_SIGNATURE_KEY, null, userId);

export const writeDismissedGuestStationSignature = (userId: string, signature: string) =>
  writeUserScopedString(DISMISSED_SIGNATURE_KEY, signature, userId);

export const writeGuestStationRecoverySnapshot = (
  userId: string,
  snapshot: GuestStationRecoverySnapshot
) => {
  const normalized = normalizeGuestStationRecoverySnapshot(snapshot);
  if (!normalized) return false;
  const written = writeUserScopedJSON(RECOVERY_SNAPSHOT_KEY, normalized, userId);
  if (written && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(XTATION_GUEST_STATION_RECOVERY_EVENT, {
        detail: {
          userId,
          hasSnapshot: true,
        },
      })
    );
  }
  return written;
};

export const readGuestStationRecoverySnapshot = (userId: string) =>
  normalizeGuestStationRecoverySnapshot(
    readUserScopedJSON<unknown>(RECOVERY_SNAPSHOT_KEY, null, userId)
  );

export const clearGuestStationRecoverySnapshot = (userId: string) =>
  {
    clearUserScopedKey(RECOVERY_SNAPSHOT_KEY, userId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(XTATION_GUEST_STATION_RECOVERY_EVENT, {
          detail: {
            userId,
            hasSnapshot: false,
          },
        })
      );
    }
  };
