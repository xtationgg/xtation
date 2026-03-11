import { describe, expect, it } from 'vitest';
import { buildDuskStationSnapshot } from '../src/dusk/stationSnapshot';

describe('dusk station snapshot', () => {
  it('builds a running-task brief when a quest is in motion', () => {
    const snapshot = buildDuskStationSnapshot({
      signedIn: true,
      userLabel: 'operator@example.com',
      stationLabel: 'Main Station',
      plan: 'pro',
      releaseChannel: 'beta',
      platformCloudEnabled: true,
      platformSyncStatus: 'synced',
      primaryTaskId: 'quest-1',
      primaryTaskTitle: 'Ship onboarding',
      primaryTaskPriority: 'high',
      primaryTaskRunning: true,
      openQuestCount: 4,
      enabledAutomationCount: 2,
      leadProjectTitle: 'XTATION architecture',
      leadProjectNextAction: 'Turn the next architecture decision into one shipped screen.',
      pinnedNoteTitle: 'Launch notes',
      activeCampaignTitle: 'Launch rhythm',
    });

    expect(snapshot.headline).toMatch(/Ship onboarding/);
    expect(snapshot.nextAction).toMatch(/running session/i);
    expect(snapshot.tags).toContain('running-quest');
    expect(snapshot.primaryTaskId).toBe('quest-1');
  });

  it('falls back to lab guidance when no active quest exists', () => {
    const snapshot = buildDuskStationSnapshot({
      signedIn: false,
      userLabel: 'Local operator',
      stationLabel: 'Local Station',
      plan: 'trial',
      releaseChannel: 'internal',
      platformCloudEnabled: false,
      platformSyncStatus: 'local_only',
      openQuestCount: 0,
      enabledAutomationCount: 1,
      leadProjectTitle: 'Play refinement',
      leadProjectNextAction: 'Convert the next Play friction into one quest.',
      pinnedNoteTitle: 'Focus cleanup',
      activeCampaignTitle: null,
    });

    expect(snapshot.headline).toMatch(/Play refinement/);
    expect(snapshot.suggestedBody).toMatch(/Convert the next Play friction/i);
    expect(snapshot.tags).toContain('local');
    expect(snapshot.tags).toContain('no-active-quest');
  });
});
