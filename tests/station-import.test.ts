import { describe, expect, it } from 'vitest';
import { ClientView } from '../types';
import { parseXtationStationImport } from '../src/backup/station';

describe('station import parser', () => {
  it('restores platform profile metadata when present', () => {
    const parsed = parseXtationStationImport(
      JSON.stringify({
        version: 'xtation-station-export-v1',
        exportedAt: 1,
        scope: 'account',
        platform: {
          releaseChannel: 'beta',
          plan: 'pro',
          trialEndsAt: 12345,
          betaCohort: 'wave-a',
          featureFlags: {
            avatar_lobby: true,
            ignored: 'nope',
          },
        },
        navigation: {
          lastView: ClientView.LAB,
        },
        ledger: {
          tasks: [],
          sessions: [],
          rewards: [],
          rewardQueue: [],
          projects: [],
          selfTree: [],
          inventory: [],
          preferences: {},
          claims: [],
        },
      })
    );

    expect(parsed.platform).toEqual({
      releaseChannel: 'beta',
      plan: 'pro',
      trialEndsAt: 12345,
      betaCohort: 'wave-a',
      featureFlags: {
        avatar_lobby: true,
      },
    });
    expect(parsed.navigation).toEqual({
      lastView: ClientView.LAB,
    });
  });

  it('keeps backward compatibility when platform metadata is missing', () => {
    const parsed = parseXtationStationImport(
      JSON.stringify({
        version: 'xtation-station-export-v1',
        exportedAt: 1,
        scope: 'guest',
        ledger: {
          tasks: [],
          sessions: [],
          rewards: [],
          rewardQueue: [],
          projects: [],
          selfTree: [],
          inventory: [],
          preferences: {},
          claims: [],
        },
      })
    );

    expect(parsed.platform).toBeUndefined();
    expect(parsed.navigation).toBeUndefined();
    expect(parsed.scope).toBe('guest');
  });
});
