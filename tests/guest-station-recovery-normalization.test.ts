import { beforeEach, describe, expect, it } from 'vitest';
import { ClientView } from '../types';
import { readGuestStationRecoverySnapshot } from '../src/auth/guestStation';
import { clearUserScopedKey, writeUserScopedString } from '../src/lib/userScopedStorage';

const USER_ID = 'user-1';
const RECOVERY_KEY = 'xtation_guest_station_recovery_v1';

describe('guest station recovery snapshot normalization', () => {
  beforeEach(() => {
    clearUserScopedKey(RECOVERY_KEY, USER_ID);
  });

  it('returns null when the stored snapshot is not structurally valid', () => {
    writeUserScopedString(RECOVERY_KEY, JSON.stringify({ foo: 'bar' }), USER_ID);
    expect(readGuestStationRecoverySnapshot(USER_ID)).toBeNull();
  });

  it('normalizes malformed nested fields and keeps runtime-safe defaults', () => {
    writeUserScopedString(
      RECOVERY_KEY,
      JSON.stringify({
        createdAt: 'bad',
        importedUserId: ' user-1 ',
        importedUserEmail: 123,
        accountSnapshot: {
          tasks: 'not-an-array',
        },
        guestSnapshot: null,
        guestContext: {
          lastView: 'not-a-view',
          importedView: 'PROFILE',
          onboardingState: {
            status: 'completed',
            updatedAt: 'invalid',
          },
          onboardingHandoff: {
            questId: 'quest-1',
            title: '',
            branch: 'Knowledge',
            track: 'mission',
            createdAt: 99,
          },
        },
      }),
      USER_ID
    );

    const snapshot = readGuestStationRecoverySnapshot(USER_ID);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.importedUserId).toBe('user-1');
    expect(snapshot?.importedUserEmail).toBeNull();
    expect(Array.isArray(snapshot?.accountSnapshot.tasks)).toBe(true);
    expect(Array.isArray(snapshot?.guestSnapshot.tasks)).toBe(true);
    expect(snapshot?.guestContext?.lastView).toBeNull();
    expect(snapshot?.guestContext?.importedView).toBe(ClientView.PROFILE);
    expect(snapshot?.guestContext?.onboardingState).toBeNull();
    expect(snapshot?.guestContext?.onboardingHandoff).toBeNull();
  });
});
