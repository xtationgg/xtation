import type { DuskActionDeckItem } from './actionDeck';
import type { StoredDuskBrief } from './bridge';
import type { DuskProviderToolDefinition } from './providerAdapter';
import type { DuskStationSnapshot } from './stationSnapshot';
import type { DuskToolAuditEntry } from './toolAudit';

export interface DuskProviderRequestEnvelope {
  version: 'xtation.dusk.provider.v1';
  builtAt: number;
  station: {
    headline: string;
    summary: string;
    nextAction: string;
    primaryTaskId: string | null;
  };
  latestBrief: null | {
    title: string;
    source: StoredDuskBrief['source'];
    tags: string[];
    linkedQuestIds: string[];
    linkedProjectIds: string[];
    receivedAt: number;
  };
  actionDeck: Array<{
    id: DuskActionDeckItem['id'];
    title: string;
    description: string;
    source: DuskActionDeckItem['source'];
  }>;
  tools: DuskProviderToolDefinition[];
  auditTail: Array<{
    actionId: string;
    actor: DuskToolAuditEntry['actor'];
    status: DuskToolAuditEntry['status'];
    message: string;
    createdAt: number;
  }>;
  rules: string[];
}

export const buildDuskProviderRequestEnvelope = (input: {
  snapshot: DuskStationSnapshot;
  latestBrief?: StoredDuskBrief | null;
  actionDeck: DuskActionDeckItem[];
  tools: DuskProviderToolDefinition[];
  auditTail: DuskToolAuditEntry[];
}): DuskProviderRequestEnvelope => ({
  version: 'xtation.dusk.provider.v1',
  builtAt: Date.now(),
  station: {
    headline: input.snapshot.headline,
    summary: input.snapshot.summary,
    nextAction: input.snapshot.nextAction,
    primaryTaskId: input.snapshot.primaryTaskId,
  },
  latestBrief: input.latestBrief
    ? {
        title: input.latestBrief.title,
        source: input.latestBrief.source,
        tags: input.latestBrief.tags || [],
        linkedQuestIds: input.latestBrief.linkedQuestIds || [],
        linkedProjectIds: input.latestBrief.linkedProjectIds || [],
        receivedAt: input.latestBrief.receivedAt,
      }
    : null,
  actionDeck: input.actionDeck.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    source: item.source,
  })),
  tools: input.tools,
  auditTail: input.auditTail.slice(0, 5).map((entry) => ({
    actionId: entry.actionId,
    actor: entry.actor,
    status: entry.status,
    message: entry.message,
    createdAt: entry.createdAt,
  })),
  rules: [
    'Use only registered XTATION tools.',
    'Do not invent writes outside the tool registry.',
    'Prefer one concrete action over multiple speculative actions.',
    'Treat blocked results as user-facing state, not silent failures.',
  ],
});

export const buildDuskProviderEnvelopeText = (envelope: DuskProviderRequestEnvelope) =>
  JSON.stringify(envelope, null, 2);
