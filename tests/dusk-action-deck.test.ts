import { describe, expect, it } from 'vitest';
import {
  buildBriefNoteSeed,
  buildQuestFromBrief,
  buildQuestFromLeadProject,
  buildStationNoteSeed,
  deriveDuskActionDeck,
} from '../src/dusk/actionDeck';
import { buildDuskStationSnapshot } from '../src/dusk/stationSnapshot';
import type { StoredDuskBrief } from '../src/dusk/bridge';

const baseSnapshot = buildDuskStationSnapshot({
  signedIn: true,
  userLabel: 'operator@xtation.app',
  stationLabel: 'XTATION Prime',
  plan: 'pro',
  releaseChannel: 'beta',
  platformCloudEnabled: true,
  platformSyncStatus: 'synced',
  primaryTaskId: 'task-1',
  primaryTaskTitle: 'Ship Play polish',
  primaryTaskPriority: 'high',
  primaryTaskRunning: false,
  openQuestCount: 4,
  enabledAutomationCount: 3,
  leadProjectTitle: 'Launch prep',
  leadProjectNextAction: 'Write the launch change log',
  pinnedNoteTitle: 'Release notes skeleton',
  activeCampaignTitle: 'Beta rollout log',
});

const brief: StoredDuskBrief = {
  title: 'Follow up with beta users',
  body: 'Summarize the latest beta issues and turn them into one outreach block.',
  source: 'multiplayer',
  tags: ['beta', 'follow-up'],
  linkedQuestIds: ['task-brief'],
  linkedProjectIds: ['project-1'],
  receivedAt: Date.now(),
};

describe('deriveDuskActionDeck', () => {
  it('builds station and brief actions in priority order', () => {
    const actions = deriveDuskActionDeck({
      snapshot: baseSnapshot,
      hasLab: true,
      primaryTaskRunning: false,
      leadProjectId: 'project-1',
      leadProjectTitle: 'Launch prep',
      leadProjectNextAction: 'Write the launch change log',
      latestBrief: brief,
    });

    expect(actions.map((action) => action.id)).toEqual([
      'open-primary-quest',
      'queue-lead-project-quest',
      'capture-station-note',
      'open-brief-quest',
      'save-brief-note',
    ]);
  });

  it('falls back to brief quest creation when the brief is not linked yet', () => {
    const actions = deriveDuskActionDeck({
      snapshot: {
        ...baseSnapshot,
        primaryTaskId: null,
      },
      hasLab: false,
      primaryTaskRunning: false,
      leadProjectTitle: null,
      leadProjectNextAction: null,
      latestBrief: {
        ...brief,
        linkedQuestIds: [],
      },
    });

    expect(actions.map((action) => action.id)).toEqual(['create-brief-quest']);
  });
});

describe('Dusk seed builders', () => {
  it('creates a quest seed from a lead project next action', () => {
    const seed = buildQuestFromLeadProject({
      leadProjectTitle: 'Launch prep',
      leadProjectNextAction: 'Write the launch change log',
      snapshot: baseSnapshot,
    });

    expect(seed.title).toBe('Write the launch change log');
    expect(seed.details).toContain('Lead project: Launch prep');
    expect(seed.tags).toContain('next-action');
  });

  it('creates a brief note seed that preserves links and tags', () => {
    const seed = buildBriefNoteSeed(brief);

    expect(seed.linkedQuestIds).toEqual(['task-brief']);
    expect(seed.linkedProjectIds).toEqual(['project-1']);
    expect(seed.pinned).toBe(true);
    expect(seed.tags).toEqual(expect.arrayContaining(['dusk', 'multiplayer', 'beta']));
  });

  it('creates a station note seed linked to the current primary quest', () => {
    const seed = buildStationNoteSeed({
      snapshot: baseSnapshot,
      leadProjectId: 'project-1',
    });

    expect(seed.linkedQuestIds).toEqual(['task-1']);
    expect(seed.linkedProjectIds).toEqual(['project-1']);
    expect(seed.content).toContain('Station: XTATION Prime');
  });

  it('creates a quest seed from the latest brief', () => {
    const seed = buildQuestFromBrief(brief);

    expect(seed.title).toBe('Follow up with beta users');
    expect(seed.details).toContain('latest beta issues');
    expect(seed.tags).toEqual(expect.arrayContaining(['dusk', 'multiplayer', 'follow-up']));
  });
});
