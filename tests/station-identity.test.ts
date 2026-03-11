import { describe, expect, it } from 'vitest';
import { buildStationIdentitySummary } from '../src/station/stationIdentity';
import type { OperatorStationRecord } from '../src/admin/AdminConsoleProvider';
import type { GuestStationRecoverySnapshot } from '../src/auth/guestStation';

const baseStation: OperatorStationRecord = {
  id: 'station:local',
  kind: 'local-station',
  label: 'Local Station',
  email: null,
  releaseChannel: 'internal',
  plan: 'trial',
  trialEndsAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
  betaCohort: null,
  supportNotes: '',
  featureFlags: {},
  createdAt: Date.now(),
  lastSeenAt: Date.now(),
};

describe('buildStationIdentitySummary', () => {
  it('builds guest local identity', () => {
    const summary = buildStationIdentitySummary({
      currentStation: baseStation,
      isGuestMode: true,
      activeView: 'LAB',
    });

    expect(summary.modeLabel).toBe('Local');
    expect(summary.workspaceLabel).toBe('Lab');
    expect(summary.title).toMatch(/Local station active/i);
  });

  it('builds imported local identity for signed-in accounts with recovery snapshot', () => {
    const importedSnapshot: GuestStationRecoverySnapshot = {
      createdAt: Date.now(),
      importedUserId: 'user-1',
      importedUserEmail: 'user@example.com',
      accountSnapshot: {} as GuestStationRecoverySnapshot['accountSnapshot'],
      guestSnapshot: {} as GuestStationRecoverySnapshot['guestSnapshot'],
      guestContext: {
        lastView: 'LAB',
        importedView: 'PROFILE',
        onboardingState: null,
        onboardingHandoff: null,
      },
    };

    const summary = buildStationIdentitySummary({
      currentStation: {
        ...baseStation,
        id: 'user:user-1',
        kind: 'current-user',
        label: 'User Station',
        email: 'user@example.com',
        releaseChannel: 'beta',
        plan: 'pro',
      },
      activeUserId: 'user-1',
      activeView: 'SETTINGS',
      handoffRecoverySnapshot: importedSnapshot,
    });

    expect(summary.modeLabel).toBe('Imported Local');
    expect(summary.workspaceLabel).toBe('Profile');
    expect(summary.tone).toBe('accent');
  });

  it('normalizes imported recovery workspace through current access rules', () => {
    const importedSnapshot: GuestStationRecoverySnapshot = {
      createdAt: Date.now(),
      importedUserId: 'user-1',
      importedUserEmail: 'user@example.com',
      accountSnapshot: {} as GuestStationRecoverySnapshot['accountSnapshot'],
      guestSnapshot: {} as GuestStationRecoverySnapshot['guestSnapshot'],
      guestContext: {
        lastView: 'LAB',
        importedView: 'ADMIN',
        onboardingState: null,
        onboardingHandoff: null,
      },
    };

    const summary = buildStationIdentitySummary({
      currentStation: {
        ...baseStation,
        id: 'user:user-1',
        kind: 'current-user',
        label: 'User Station',
        email: 'user@example.com',
      },
      activeUserId: 'user-1',
      activeView: 'SETTINGS',
      handoffRecoverySnapshot: importedSnapshot,
      access: {
        canAccessAdmin: false,
        featureVisibility: { lab: true, multiplayer: true, store: true },
      },
    });

    expect(summary.workspaceLabel).toBe('Play');
    expect(summary.modeLabel).toBe('Imported Local');
  });
});
