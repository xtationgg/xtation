import { xpRepository } from '../../components/XP/xpRepository';
import type { XPLedgerState } from '../../components/XP/xpTypes';
import type { ClientView } from '../../types';
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
  const written = writeUserScopedJSON(RECOVERY_SNAPSHOT_KEY, snapshot, userId);
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
  readUserScopedJSON<GuestStationRecoverySnapshot | null>(RECOVERY_SNAPSHOT_KEY, null, userId);

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
