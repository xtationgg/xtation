import { describe, expect, it, vi } from 'vitest';
import {
  buildDuskProviderRunRequest,
  buildDuskProviderRunRequestText,
  executeDuskProviderRunRequest,
  parseDuskProviderRunRequestText,
} from '../src/dusk/providerRun';
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
  primaryTaskTitle: 'Ship provider bridge',
  primaryTaskPriority: 'high',
  primaryTaskRunning: false,
  openQuestCount: 4,
  enabledAutomationCount: 3,
  leadProjectTitle: 'Launch prep',
  leadProjectNextAction: 'Write the launch change log',
  pinnedNoteTitle: 'Release notes skeleton',
  activeCampaignTitle: 'Beta rollout log',
});

const installMemoryStorage = () => {
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
};

describe('dusk provider run', () => {
  it('builds and parses a valid provider run request', () => {
    const text = buildDuskProviderRunRequestText(
      buildDuskProviderRunRequest(['xtation_open_primary_quest', 'xtation_capture_station_note'], {
        requestedBy: 'provider-test',
      })
    );

    const parsed = parseDuskProviderRunRequestText(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.request?.tools.map((tool) => tool.name)).toEqual([
      'xtation_open_primary_quest',
      'xtation_capture_station_note',
    ]);
    expect(parsed.request?.requestedBy).toBe('provider-test');
  });

  it('rejects invalid provider request versions', () => {
    const parsed = parseDuskProviderRunRequestText(
      JSON.stringify({
        version: 'xtation.dusk.provider.v1',
        tools: ['xtation_open_primary_quest'],
      })
    );

    expect(parsed).toEqual({
      ok: false,
      message: 'Provider request version must be xtation.dusk.provider-run.v1',
    });
  });

  it('executes a provider run sequentially and audits each tool', () => {
    installMemoryStorage();

    const report = executeDuskProviderRunRequest(
      buildDuskProviderRunRequest(['xtation_open_primary_quest', 'xtation_capture_station_note']),
      {
        snapshot,
        availableTaskIds: ['task-1'],
        createQuest: vi.fn(),
        openQuest: vi.fn(() => true),
        saveNote: vi.fn(() => 'note-1'),
      },
      'provider-run-user'
    );

    expect(report).toMatchObject({
      requestedCount: 2,
      executedCount: 2,
      succeededCount: 2,
      blockedCount: 0,
      stoppedEarly: false,
    });
    expect(report.results[0]).toMatchObject({
      name: 'xtation_open_primary_quest',
      actionId: 'open-primary-quest',
      status: 'success',
    });
    expect(report.results[1]).toMatchObject({
      name: 'xtation_capture_station_note',
      actionId: 'capture-station-note',
      status: 'success',
    });

    const audit = readDuskToolAudit('provider-run-user');
    expect(audit).toHaveLength(2);
    expect(audit.every((entry) => entry.actor === 'provider')).toBe(true);
  });

  it('stops early when stopOnBlocked is enabled', () => {
    installMemoryStorage();

    const request = buildDuskProviderRunRequest(
      ['xtation_nonexistent_tool', 'xtation_open_primary_quest'],
      {
        stopOnBlocked: true,
      }
    );

    const report = executeDuskProviderRunRequest(
      request,
      {
        snapshot,
        availableTaskIds: ['task-1'],
        createQuest: vi.fn(),
        openQuest: vi.fn(() => true),
      },
      'provider-run-user'
    );

    expect(report).toMatchObject({
      requestedCount: 2,
      executedCount: 1,
      blockedCount: 1,
      stoppedEarly: true,
    });
    expect(report.results[0]?.message).toContain('Unknown Dusk provider tool');
  });
});
