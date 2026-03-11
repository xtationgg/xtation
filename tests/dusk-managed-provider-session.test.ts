import { describe, expect, it } from 'vitest';
import {
  acceptManagedProviderSession,
  appendManagedProviderSession,
  clearManagedProviderSessions,
  discardManagedProviderSession,
  diffManagedProviderRequests,
  markManagedProviderSessionPromoted,
  markManagedProviderSessionExecuted,
  readManagedProviderSessions,
  reviseManagedProviderSession,
  summarizeManagedProviderRequestDiff,
} from '../src/dusk/managedProviderSession';

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

describe('dusk managed provider sessions', () => {
  it('stores and updates managed provider planning sessions', () => {
    installMemoryStorage();

    const entry = appendManagedProviderSession(
      {
        envelopeHeadline: 'Resume XTATION architecture',
        nextAction: 'Turn the next architecture decision into one implemented workflow.',
        linkedProjectId: 'lab-project-1',
        linkedQuestIds: ['quest-1'],
        suggestion: {
          ok: true,
          request: {
            version: 'xtation.dusk.provider-run.v1',
            requestedBy: 'openai:gpt-5',
            stopOnBlocked: true,
            tools: [{ name: 'xtation_queue_lead_project_quest', reason: 'Make the next action concrete.' }],
          },
          provider: {
            label: 'Managed OpenAI',
            model: 'gpt-5',
            responseId: 'resp_123',
          },
          outputText: 'Queue the next action as a quest.',
        },
      },
      'managed-user'
    );

    expect(readManagedProviderSessions('managed-user')[0]).toMatchObject({
      id: entry.id,
      status: 'planned',
      model: 'gpt-5',
      envelopeHeadline: 'Resume XTATION architecture',
      linkedProjectId: 'lab-project-1',
      linkedQuestIds: ['quest-1'],
    });

    reviseManagedProviderSession(
      entry.id,
      {
        request: {
          version: 'xtation.dusk.provider-run.v1',
          requestedBy: 'openai:gpt-5',
          stopOnBlocked: true,
          tools: [{ name: 'xtation_capture_station_note', reason: 'Preserve the latest planning state.' }],
        },
        nextAction: 'Capture the current station state before queuing the next action.',
        revisionNote: 'Save the station state before running anything destructive.',
        baselineCompareContext: {
          currentTitle: 'Alpha',
          previousTitle: 'Bravo',
          driftSummary: 'title · +1 tag',
          loadedAt: 123,
          currentProvenance: {
            providerLabel: 'Managed OpenAI',
            model: 'gpt-5',
            acceptedLabel: 'Mar 11, 02:00',
            nextAction: 'Queue the next action',
            revisionNote: 'Tighten the baseline',
            compareCurrentTitle: 'Alpha',
            comparePreviousTitle: 'Bravo',
            compareDriftSummary: 'title · +1 tag',
          },
          previousProvenance: null,
        },
        baselineProvenanceContext: {
          baselineTitle: 'Alpha',
          acceptedLabel: 'Mar 11, 02:00',
          nextAction: 'Queue the next action',
          revisionNote: 'Tighten the baseline',
          providerLabel: 'Managed OpenAI',
          model: 'gpt-5',
          compareCurrentTitle: 'Alpha',
          comparePreviousTitle: 'Bravo',
          compareDriftSummary: 'title · +1 tag',
          compareLoadedAt: 123,
          loadedAt: 456,
        },
      },
      'managed-user'
    );

    expect(readManagedProviderSessions('managed-user')[0]).toMatchObject({
      id: entry.id,
      status: 'revised',
      revisionCount: 1,
      nextAction: 'Capture the current station state before queuing the next action.',
      latestRevisionNote: 'Save the station state before running anything destructive.',
      baselineCompareContext: {
        currentTitle: 'Alpha',
        previousTitle: 'Bravo',
        driftSummary: 'title · +1 tag',
        loadedAt: 123,
        currentProvenance: {
          providerLabel: 'Managed OpenAI',
          model: 'gpt-5',
          acceptedLabel: 'Mar 11, 02:00',
          nextAction: 'Queue the next action',
          revisionNote: 'Tighten the baseline',
          compareCurrentTitle: 'Alpha',
          comparePreviousTitle: 'Bravo',
          compareDriftSummary: 'title · +1 tag',
        },
        previousProvenance: null,
      },
      baselineProvenanceContext: {
        baselineTitle: 'Alpha',
        acceptedLabel: 'Mar 11, 02:00',
        nextAction: 'Queue the next action',
        revisionNote: 'Tighten the baseline',
        providerLabel: 'Managed OpenAI',
        model: 'gpt-5',
        compareCurrentTitle: 'Alpha',
        comparePreviousTitle: 'Bravo',
        compareDriftSummary: 'title · +1 tag',
        compareLoadedAt: 123,
        loadedAt: 456,
      },
      request: {
        tools: [{ name: 'xtation_capture_station_note', reason: 'Preserve the latest planning state.' }],
      },
      revisionHistory: [
        {
          baselineCompareContext: {
            currentTitle: 'Alpha',
            previousTitle: 'Bravo',
            driftSummary: 'title · +1 tag',
            loadedAt: 123,
            currentProvenance: {
              providerLabel: 'Managed OpenAI',
              model: 'gpt-5',
              acceptedLabel: 'Mar 11, 02:00',
              nextAction: 'Queue the next action',
              revisionNote: 'Tighten the baseline',
              compareCurrentTitle: 'Alpha',
              comparePreviousTitle: 'Bravo',
              compareDriftSummary: 'title · +1 tag',
            },
            previousProvenance: null,
          },
          baselineProvenanceContext: {
            baselineTitle: 'Alpha',
            acceptedLabel: 'Mar 11, 02:00',
            nextAction: 'Queue the next action',
            revisionNote: 'Tighten the baseline',
            providerLabel: 'Managed OpenAI',
            model: 'gpt-5',
            compareCurrentTitle: 'Alpha',
            comparePreviousTitle: 'Bravo',
            compareDriftSummary: 'title · +1 tag',
            compareLoadedAt: 123,
            loadedAt: 456,
          },
          note: 'Save the station state before running anything destructive.',
          nextAction: 'Capture the current station state before queuing the next action.',
        },
      ],
    });

    acceptManagedProviderSession(entry.id, 'managed-user');

    expect(readManagedProviderSessions('managed-user')[0]).toMatchObject({
      id: entry.id,
      status: 'accepted',
      acceptedRequest: {
        tools: [{ name: 'xtation_capture_station_note', reason: 'Preserve the latest planning state.' }],
      },
      acceptedNextAction: 'Capture the current station state before queuing the next action.',
      acceptedBaselineCompareContext: {
        currentTitle: 'Alpha',
        previousTitle: 'Bravo',
        driftSummary: 'title · +1 tag',
        loadedAt: 123,
        currentProvenance: {
          providerLabel: 'Managed OpenAI',
          model: 'gpt-5',
          acceptedLabel: 'Mar 11, 02:00',
          nextAction: 'Queue the next action',
          revisionNote: 'Tighten the baseline',
          compareCurrentTitle: 'Alpha',
          comparePreviousTitle: 'Bravo',
          compareDriftSummary: 'title · +1 tag',
        },
        previousProvenance: null,
      },
      acceptedBaselineProvenanceContext: {
        baselineTitle: 'Alpha',
        acceptedLabel: 'Mar 11, 02:00',
        nextAction: 'Queue the next action',
        revisionNote: 'Tighten the baseline',
        providerLabel: 'Managed OpenAI',
        model: 'gpt-5',
        compareCurrentTitle: 'Alpha',
        comparePreviousTitle: 'Bravo',
        compareDriftSummary: 'title · +1 tag',
        compareLoadedAt: 123,
        loadedAt: 456,
      },
    });

    markManagedProviderSessionPromoted(
      entry.id,
      'lab-note-1',
      'Dusk baseline · Resume XTATION architecture',
      'managed-user'
    );

    expect(readManagedProviderSessions('managed-user')[0]).toMatchObject({
      id: entry.id,
      promotedNoteId: 'lab-note-1',
      promotedNoteTitle: 'Dusk baseline · Resume XTATION architecture',
      promotedAt: expect.any(Number),
    });

    markManagedProviderSessionExecuted(
      entry.id,
      {
        version: 'xtation.dusk.provider-run-report.v1',
        receivedAt: Date.now(),
        requestedBy: 'openai:gpt-5',
        requestedCount: 1,
        executedCount: 1,
        succeededCount: 1,
        blockedCount: 0,
        stoppedEarly: false,
        stopOnBlocked: true,
        results: [],
      },
      'managed-user'
    );

    expect(readManagedProviderSessions('managed-user')[0]).toMatchObject({
      id: entry.id,
      status: 'executed',
      acceptedAt: expect.any(Number),
      executedAt: expect.any(Number),
      reportSummary: {
        requestedCount: 1,
        succeededCount: 1,
        blockedCount: 0,
      },
    });

    clearManagedProviderSessions('managed-user');
    expect(readManagedProviderSessions('managed-user')).toEqual([]);
  });

  it('can discard managed provider sessions without deleting the trace', () => {
    installMemoryStorage();

    const entry = appendManagedProviderSession(
      {
        envelopeHeadline: 'Triage the next XTATION pass',
        nextAction: 'Review the current planning trace before running tools.',
        suggestion: {
          ok: true,
          request: {
            version: 'xtation.dusk.provider-run.v1',
            requestedBy: 'openai:gpt-5',
            stopOnBlocked: true,
            tools: [{ name: 'xtation_open_primary_quest' }],
          },
          provider: {
            label: 'Managed OpenAI',
            model: 'gpt-5',
            responseId: 'resp_456',
          },
          outputText: 'Open the current quest before revising the plan.',
        },
      },
      'managed-user'
    );

    discardManagedProviderSession(entry.id, 'managed-user');

    expect(readManagedProviderSessions('managed-user')[0]).toMatchObject({
      id: entry.id,
      status: 'discarded',
      discardedAt: expect.any(Number),
    });
  });

  it('diffs current and accepted provider plans for review', () => {
    const diff = diffManagedProviderRequests(
      {
        version: 'xtation.dusk.provider-run.v1',
        requestedBy: 'openai:gpt-5',
        stopOnBlocked: true,
        tools: [
          { name: 'xtation_capture_station_note', reason: 'Preserve the current state.' },
          { name: 'xtation_queue_lead_project_quest', reason: 'Push the lead next action into Play.' },
        ],
      },
      {
        version: 'xtation.dusk.provider-run.v1',
        requestedBy: 'openai:gpt-5',
        stopOnBlocked: false,
        tools: [
          { name: 'xtation_capture_station_note', reason: 'Save the station state.' },
          { name: 'xtation_open_primary_quest', reason: 'Open the current operation.' },
        ],
      }
    );

    expect(diff).toEqual({
      addedTools: ['xtation_queue_lead_project_quest'],
      removedTools: ['xtation_open_primary_quest'],
      reasonChangedTools: ['xtation_capture_station_note'],
      requestedByChanged: false,
      stopOnBlockedChanged: true,
      changed: true,
    });

    expect(summarizeManagedProviderRequestDiff(diff)).toBe('+1 · -1 · ~1 reasons · stop mode changed');
  });
});
