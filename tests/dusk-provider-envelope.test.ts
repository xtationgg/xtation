import { describe, expect, it } from 'vitest';
import { deriveDuskActionDeck } from '../src/dusk/actionDeck';
import { buildDuskProviderRequestEnvelope, buildDuskProviderEnvelopeText } from '../src/dusk/providerEnvelope';
import { getDuskProviderTools } from '../src/dusk/providerAdapter';
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

describe('dusk provider envelope', () => {
  it('builds a provider request envelope with tools, actions, and rules', () => {
    const actionDeck = deriveDuskActionDeck({
      snapshot,
      hasLab: true,
      primaryTaskRunning: false,
      leadProjectTitle: 'Launch prep',
      leadProjectNextAction: 'Write the launch change log',
    });
    const tools = getDuskProviderTools(actionDeck);

    const envelope = buildDuskProviderRequestEnvelope({
      snapshot,
      actionDeck,
      tools,
      auditTail: [
        {
          id: 'audit-1',
          actionId: 'capture-station-note',
          actor: 'relay',
          status: 'success',
          message: 'Station snapshot captured in Lab',
          createdAt: 123,
        },
      ],
    });

    expect(envelope.version).toBe('xtation.dusk.provider.v1');
    expect(envelope.tools[0]?.name).toBe('xtation_open_primary_quest');
    expect(envelope.actionDeck[0]?.id).toBe('open-primary-quest');
    expect(envelope.auditTail[0]?.message).toBe('Station snapshot captured in Lab');
    expect(envelope.rules).toContain('Use only registered XTATION tools.');
  });

  it('serializes a stable JSON envelope text', () => {
    const envelopeText = buildDuskProviderEnvelopeText(
      buildDuskProviderRequestEnvelope({
        snapshot,
        actionDeck: [],
        tools: [],
        auditTail: [],
      })
    );

    expect(envelopeText).toContain('"version": "xtation.dusk.provider.v1"');
    expect(envelopeText).toContain('"rules"');
  });
});
