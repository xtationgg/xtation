import { beforeEach, describe, expect, it } from 'vitest';
import { clearUserScopedKey, writeUserScopedString } from '../src/lib/userScopedStorage';
import { readXtationStationRestoreRecoverySnapshot } from '../src/backup/station';

const USER_ID = 'user-restore-1';
const RESTORE_RECOVERY_KEY = 'xtation_station_restore_recovery_v1';

const buildStationPayload = (patch: Record<string, unknown> = {}) => ({
  version: 'xtation-station-export-v1',
  exportedAt: 1,
  scope: 'guest',
  ledger: {
    tasks: [],
    sessions: [],
    completions: [],
    manualLogs: [],
    taskEvents: [],
    projects: [],
    milestones: [],
    selfTreeNodes: [],
    inventorySlots: [],
  },
  ...patch,
});

describe('station restore recovery normalization', () => {
  beforeEach(() => {
    clearUserScopedKey(RESTORE_RECOVERY_KEY, USER_ID);
  });

  it('returns null for malformed stored restore snapshots', () => {
    writeUserScopedString(RESTORE_RECOVERY_KEY, JSON.stringify({ foo: 'bar' }), USER_ID);
    expect(readXtationStationRestoreRecoverySnapshot(USER_ID)).toBeNull();
  });

  it('normalizes nested station payloads and drops malformed optional fields', () => {
    writeUserScopedString(
      RESTORE_RECOVERY_KEY,
      JSON.stringify({
        createdAt: 'bad',
        restoredIntoScope: 'invalid',
        currentStation: buildStationPayload({
          navigation: { lastView: 'UNKNOWN_VIEW' },
          onboarding: {
            state: { status: 'completed', updatedAt: 'bad' },
          },
        }),
        importedStation: buildStationPayload({
          platform: {
            releaseChannel: 'invalid',
            plan: 'invalid',
          },
        }),
      }),
      USER_ID
    );

    const snapshot = readXtationStationRestoreRecoverySnapshot(USER_ID);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.restoredIntoScope).toBe('guest');
    expect(snapshot?.currentStation.navigation?.lastView).toBeNull();
    expect(snapshot?.currentStation.onboarding?.state).toBeNull();
    expect(snapshot?.importedStation.platform?.releaseChannel).toBe('stable');
    expect(snapshot?.importedStation.platform?.plan).toBe('free');
    expect(Array.isArray(snapshot?.currentStation.ledger.tasks)).toBe(true);
  });
});
