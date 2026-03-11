import { describe, expect, it, vi } from 'vitest';
import { executeDuskTool } from '../src/dusk/toolRuntime';
import { buildDuskStationSnapshot } from '../src/dusk/stationSnapshot';
import type { StoredDuskBrief } from '../src/dusk/bridge';

const snapshot = buildDuskStationSnapshot({
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

describe('executeDuskTool', () => {
  it('opens the primary quest through the runtime boundary', () => {
    const openQuest = vi.fn(() => true);

    const result = executeDuskTool('open-primary-quest', {
      snapshot,
      availableTaskIds: ['task-1'],
      createQuest: vi.fn(),
      openQuest,
    });

    expect(openQuest).toHaveBeenCalledWith('task-1');
    expect(result).toEqual({
      status: 'success',
      message: 'Primary quest opened',
      openedQuestId: 'task-1',
    });
  });

  it('creates and links a quest for the lead Lab project', () => {
    const createQuest = vi.fn(() => 'task-2');
    const linkProjectQuest = vi.fn();

    const result = executeDuskTool('queue-lead-project-quest', {
      snapshot,
      availableTaskIds: ['task-1'],
      createQuest,
      openQuest: vi.fn(),
      leadProject: {
        id: 'project-1',
        title: 'Launch prep',
        nextAction: 'Write the launch change log',
      },
      linkProjectQuest,
    });

    expect(createQuest).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Write the launch change log',
      }),
      { priority: 'high' }
    );
    expect(linkProjectQuest).toHaveBeenCalledWith('project-1', 'task-2');
    expect(result).toEqual({
      status: 'success',
      message: 'Queued next action for Launch prep',
      createdQuestId: 'task-2',
    });
  });

  it('saves a station note when Lab saveNote is available', () => {
    const saveNote = vi.fn(() => 'note-1');

    const result = executeDuskTool('capture-station-note', {
      snapshot,
      availableTaskIds: ['task-1'],
      createQuest: vi.fn(),
      openQuest: vi.fn(),
      saveNote,
      leadProject: {
        id: 'project-1',
        title: 'Launch prep',
        nextAction: 'Write the launch change log',
      },
    });

    expect(saveNote).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Station brief'),
        linkedQuestIds: ['task-1'],
        linkedProjectIds: ['project-1'],
      })
    );
    expect(result).toEqual({
      status: 'success',
      message: 'Station snapshot captured in Lab',
      noteId: 'note-1',
    });
  });

  it('creates a quest from the latest brief and links the project when available', () => {
    const createQuest = vi.fn(() => 'task-3');
    const linkProjectQuest = vi.fn();

    const result = executeDuskTool('create-brief-quest', {
      snapshot,
      latestBrief: {
        ...brief,
        linkedQuestIds: [],
      },
      availableTaskIds: ['task-1'],
      createQuest,
      openQuest: vi.fn(),
      linkProjectQuest,
    });

    expect(createQuest).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Follow up with beta users',
      }),
      { priority: 'high' }
    );
    expect(linkProjectQuest).toHaveBeenCalledWith('project-1', 'task-3');
    expect(result).toEqual({
      status: 'success',
      message: 'Quest created from latest Dusk brief',
      createdQuestId: 'task-3',
    });
  });

  it('blocks note capture when Lab is not available', () => {
    const result = executeDuskTool('save-brief-note', {
      snapshot,
      latestBrief: brief,
      availableTaskIds: ['task-1'],
      createQuest: vi.fn(),
      openQuest: vi.fn(),
    });

    expect(result).toEqual({
      status: 'blocked',
      message: 'Lab is not available in this station',
    });
  });
});
