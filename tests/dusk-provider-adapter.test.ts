import { describe, expect, it, vi } from 'vitest';
import { deriveDuskActionDeck } from '../src/dusk/actionDeck';
import {
  executeAuditedDuskProviderTool,
  executeDuskProviderTool,
  getDuskProviderTools,
} from '../src/dusk/providerAdapter';
import { readDuskToolAudit } from '../src/dusk/toolAudit';
import { buildDuskStationSnapshot } from '../src/dusk/stationSnapshot';

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

describe('dusk provider adapter', () => {
  it('maps available deck items to provider-safe tool definitions', () => {
    const deck = deriveDuskActionDeck({
      snapshot,
      hasLab: true,
      primaryTaskRunning: false,
      leadProjectTitle: 'Launch prep',
      leadProjectNextAction: 'Write the launch change log',
    });

    const tools = getDuskProviderTools(deck);
    expect(tools.map((tool) => tool.name)).toEqual([
      'xtation_open_primary_quest',
      'xtation_queue_lead_project_quest',
      'xtation_capture_station_note',
    ]);
  });

  it('executes a registered provider tool through the runtime', () => {
    const openQuest = vi.fn(() => true);

    const result = executeDuskProviderTool('xtation_open_primary_quest', {
      snapshot,
      availableTaskIds: ['task-1'],
      createQuest: vi.fn(),
      openQuest,
    });

    expect(openQuest).toHaveBeenCalledWith('task-1');
    expect(result).toMatchObject({
      status: 'success',
      openedQuestId: 'task-1',
    });
  });

  it('blocks unknown provider tools', () => {
    const result = executeDuskProviderTool('xtation_nonexistent_tool', {
      snapshot,
      availableTaskIds: [],
      createQuest: vi.fn(),
      openQuest: vi.fn(),
    });

    expect(result).toEqual({
      status: 'blocked',
      message: 'Unknown Dusk provider tool: xtation_nonexistent_tool',
    });
  });

  it('writes a provider audit entry when using the audited adapter', () => {
    const memory = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
        setItem: (key: string, value: string) => {
          memory.set(String(key), String(value));
        },
        removeItem: (key: string) => {
          memory.delete(String(key));
        },
        clear: () => {
          memory.clear();
        },
        key: (index: number) => Array.from(memory.keys())[index] ?? null,
        get length() {
          return memory.size;
        },
      },
    });

    const result = executeAuditedDuskProviderTool(
      'xtation_open_primary_quest',
      {
        snapshot,
        availableTaskIds: ['task-1'],
        createQuest: vi.fn(),
        openQuest: vi.fn(() => true),
      },
      'provider-user'
    );

    expect(result.status).toBe('success');
    const audit = readDuskToolAudit('provider-user');
    expect(audit[0]).toMatchObject({
      actor: 'provider',
      actionId: 'open-primary-quest',
      status: 'success',
    });
  });
});
