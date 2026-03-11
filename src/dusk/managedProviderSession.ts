import { readUserScopedJSON, writeUserScopedJSON } from '../lib/userScopedStorage';
import type { ManagedDuskProviderSuccess } from './managedProvider';
import type { DuskBaselineCompareContext } from './baselineCompare';
import type { DuskBaselineProvenanceContext } from './baselineProvenanceBrief';
import type { DuskProviderRunReport, DuskProviderRunRequest } from './providerRun';

export const DUSK_MANAGED_PROVIDER_SESSIONS_KEY = 'duskManagedProviderSessions.v1';
export const DUSK_MANAGED_PROVIDER_SESSIONS_EVENT = 'dusk:managedProviderSessions';

const MAX_MANAGED_PROVIDER_SESSIONS = 12;
const MAX_MANAGED_PROVIDER_REVISIONS = 8;

export type DuskManagedProviderSessionStatus =
  | 'planned'
  | 'revised'
  | 'accepted'
  | 'discarded'
  | 'executed';

export interface DuskManagedProviderSessionRevisionEntry {
  savedAt: number;
  note: string | null;
  nextAction: string;
  request: DuskProviderRunRequest;
  baselineCompareContext?: DuskBaselineCompareContext;
  baselineProvenanceContext?: DuskBaselineProvenanceContext;
}

export interface DuskManagedProviderSessionEntry {
  id: string;
  createdAt: number;
  status: DuskManagedProviderSessionStatus;
  providerLabel: string;
  model: string;
  responseId: string | null;
  envelopeHeadline: string;
  nextAction: string;
  linkedProjectId?: string | null;
  linkedQuestIds?: string[];
  outputText: string | null;
  request: DuskProviderRunRequest;
  revisionCount?: number;
  latestRevisionNote?: string | null;
  baselineCompareContext?: DuskBaselineCompareContext;
  baselineProvenanceContext?: DuskBaselineProvenanceContext;
  acceptedRequest?: DuskProviderRunRequest;
  acceptedNextAction?: string;
  acceptedBaselineCompareContext?: DuskBaselineCompareContext;
  acceptedBaselineProvenanceContext?: DuskBaselineProvenanceContext;
  revisionHistory?: DuskManagedProviderSessionRevisionEntry[];
  acceptedAt?: number;
  discardedAt?: number;
  promotedNoteId?: string;
  promotedNoteTitle?: string;
  promotedAt?: number;
  updatedAt?: number;
  executedAt?: number;
  reportSummary?: {
    requestedCount: number;
    succeededCount: number;
    blockedCount: number;
  };
}

const createSessionId = () => `dusk-provider-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cloneRequest = (request: DuskProviderRunRequest): DuskProviderRunRequest => ({
  ...request,
  tools: request.tools.map((tool) => ({ ...tool })),
});

const trimRevisionNote = (note?: string | null) => {
  if (typeof note !== 'string') return null;
  const trimmed = note.trim();
  return trimmed ? trimmed : null;
};

const appendRevisionHistory = (
  entry: DuskManagedProviderSessionEntry,
  input: {
    request: DuskProviderRunRequest;
    nextAction: string;
    note?: string | null;
    baselineCompareContext?: DuskBaselineCompareContext;
    baselineProvenanceContext?: DuskBaselineProvenanceContext;
  }
): DuskManagedProviderSessionRevisionEntry[] => {
  const nextEntry: DuskManagedProviderSessionRevisionEntry = {
    savedAt: Date.now(),
    note: trimRevisionNote(input.note),
    nextAction: input.nextAction,
    request: cloneRequest(input.request),
    baselineCompareContext: input.baselineCompareContext,
    baselineProvenanceContext: input.baselineProvenanceContext,
  };
  return [nextEntry, ...(entry.revisionHistory || [])].slice(0, MAX_MANAGED_PROVIDER_REVISIONS);
};

export const readManagedProviderSessions = (userId?: string | null) =>
  readUserScopedJSON<DuskManagedProviderSessionEntry[]>(DUSK_MANAGED_PROVIDER_SESSIONS_KEY, [], userId);

const writeManagedProviderSessions = (entries: DuskManagedProviderSessionEntry[], userId?: string | null) => {
  if (typeof window === 'undefined') return false;
  const ok = writeUserScopedJSON(DUSK_MANAGED_PROVIDER_SESSIONS_KEY, entries.slice(0, MAX_MANAGED_PROVIDER_SESSIONS), userId);
  if (ok) {
    window.dispatchEvent(new CustomEvent(DUSK_MANAGED_PROVIDER_SESSIONS_EVENT));
  }
  return ok;
};

export const appendManagedProviderSession = (
  input: {
    suggestion: ManagedDuskProviderSuccess;
    envelopeHeadline: string;
    nextAction: string;
    linkedProjectId?: string | null;
    linkedQuestIds?: string[];
  },
  userId?: string | null
) => {
  const entry: DuskManagedProviderSessionEntry = {
    id: createSessionId(),
    createdAt: Date.now(),
    status: 'planned',
    providerLabel: input.suggestion.provider.label,
    model: input.suggestion.provider.model,
    responseId: input.suggestion.provider.responseId,
    envelopeHeadline: input.envelopeHeadline,
    nextAction: input.nextAction,
    linkedProjectId: input.linkedProjectId ?? null,
    linkedQuestIds: input.linkedQuestIds || [],
    outputText: input.suggestion.outputText,
    request: input.suggestion.request,
    revisionCount: 0,
    latestRevisionNote: null,
    acceptedRequest: undefined,
    acceptedNextAction: undefined,
    baselineCompareContext: undefined,
    baselineProvenanceContext: undefined,
    acceptedBaselineCompareContext: undefined,
    acceptedBaselineProvenanceContext: undefined,
    revisionHistory: [],
    promotedNoteId: undefined,
    promotedNoteTitle: undefined,
    promotedAt: undefined,
  };

  writeManagedProviderSessions([entry, ...readManagedProviderSessions(userId)], userId);
  return entry;
};

export const markManagedProviderSessionExecuted = (
  sessionId: string,
  report: DuskProviderRunReport,
  userId?: string | null
) => {
  const entries = readManagedProviderSessions(userId);
  const next = entries.map((entry) =>
    entry.id === sessionId
      ? {
          ...entry,
          status: 'executed' as const,
          acceptedAt: entry.acceptedAt ?? Date.now(),
          executedAt: Date.now(),
          updatedAt: Date.now(),
          reportSummary: {
            requestedCount: report.requestedCount,
            succeededCount: report.succeededCount,
            blockedCount: report.blockedCount,
          },
        }
      : entry
  );
  writeManagedProviderSessions(next, userId);
};

export const reviseManagedProviderSession = (
  sessionId: string,
  input: {
    request: DuskProviderRunRequest;
    nextAction?: string;
    outputText?: string | null;
    revisionNote?: string | null;
    baselineCompareContext?: DuskBaselineCompareContext;
    baselineProvenanceContext?: DuskBaselineProvenanceContext;
  },
  userId?: string | null
) => {
  const entries = readManagedProviderSessions(userId);
  const next = entries.map((entry) =>
    entry.id === sessionId
      ? (() => {
          const nextAction = input.nextAction ?? entry.nextAction;
          return {
            ...entry,
            status: 'revised' as const,
            request: cloneRequest(input.request),
            nextAction,
            outputText: input.outputText === undefined ? entry.outputText : input.outputText,
            revisionCount: (entry.revisionCount ?? 0) + 1,
            latestRevisionNote: trimRevisionNote(input.revisionNote),
            baselineCompareContext: input.baselineCompareContext,
            baselineProvenanceContext: input.baselineProvenanceContext,
            revisionHistory: appendRevisionHistory(entry, {
              request: input.request,
              nextAction,
              note: input.revisionNote,
              baselineCompareContext: input.baselineCompareContext,
              baselineProvenanceContext: input.baselineProvenanceContext,
            }),
            promotedNoteId: undefined,
            promotedNoteTitle: undefined,
            promotedAt: undefined,
            acceptedBaselineCompareContext: undefined,
            acceptedBaselineProvenanceContext: undefined,
            updatedAt: Date.now(),
            acceptedAt: undefined,
            discardedAt: undefined,
            reportSummary: undefined,
            executedAt: undefined,
          };
        })()
      : entry
  );
  writeManagedProviderSessions(next, userId);
};

export const acceptManagedProviderSession = (
  sessionId: string,
  userId?: string | null,
  baselineCompareContext?: DuskBaselineCompareContext,
  baselineProvenanceContext?: DuskBaselineProvenanceContext
) => {
  const entries = readManagedProviderSessions(userId);
  const next = entries.map((entry) =>
    entry.id === sessionId
      ? {
          ...entry,
          status: 'accepted' as const,
          acceptedAt: Date.now(),
          acceptedRequest: cloneRequest(entry.request),
          acceptedNextAction: entry.nextAction,
          baselineCompareContext: baselineCompareContext ?? entry.baselineCompareContext,
          baselineProvenanceContext: baselineProvenanceContext ?? entry.baselineProvenanceContext,
          acceptedBaselineCompareContext: baselineCompareContext ?? entry.baselineCompareContext,
          acceptedBaselineProvenanceContext: baselineProvenanceContext ?? entry.baselineProvenanceContext,
          promotedNoteId: undefined,
          promotedNoteTitle: undefined,
          promotedAt: undefined,
          discardedAt: undefined,
          updatedAt: Date.now(),
        }
      : entry
  );
  writeManagedProviderSessions(next, userId);
};

export const discardManagedProviderSession = (sessionId: string, userId?: string | null) => {
  const entries = readManagedProviderSessions(userId);
  const next = entries.map((entry) =>
    entry.id === sessionId
      ? {
          ...entry,
          status: 'discarded' as const,
          discardedAt: Date.now(),
          updatedAt: Date.now(),
        }
      : entry
  );
  writeManagedProviderSessions(next, userId);
};

export const clearManagedProviderSessions = (userId?: string | null) =>
  writeManagedProviderSessions([], userId);

export const markManagedProviderSessionPromoted = (
  sessionId: string,
  noteId: string,
  noteTitle: string,
  userId?: string | null
) => {
  const entries = readManagedProviderSessions(userId);
  const next = entries.map((entry) =>
    entry.id === sessionId
      ? {
          ...entry,
          promotedNoteId: noteId,
          promotedNoteTitle: noteTitle,
          promotedAt: Date.now(),
          updatedAt: Date.now(),
        }
      : entry
  );
  writeManagedProviderSessions(next, userId);
};

export interface DuskManagedProviderRequestDiff {
  addedTools: string[];
  removedTools: string[];
  reasonChangedTools: string[];
  requestedByChanged: boolean;
  stopOnBlockedChanged: boolean;
  changed: boolean;
}

export const diffManagedProviderRequests = (
  current: DuskProviderRunRequest | null | undefined,
  baseline: DuskProviderRunRequest | null | undefined
): DuskManagedProviderRequestDiff => {
  if (!current || !baseline) {
    return {
      addedTools: current?.tools.map((tool) => tool.name) || [],
      removedTools: baseline?.tools.map((tool) => tool.name) || [],
      reasonChangedTools: [],
      requestedByChanged: (current?.requestedBy ?? null) !== (baseline?.requestedBy ?? null),
      stopOnBlockedChanged: (current?.stopOnBlocked ?? true) !== (baseline?.stopOnBlocked ?? true),
      changed: !!current || !!baseline,
    };
  }

  const currentByName = new Map(current.tools.map((tool) => [tool.name, tool]));
  const baselineByName = new Map(baseline.tools.map((tool) => [tool.name, tool]));

  const addedTools = current.tools
    .map((tool) => tool.name)
    .filter((name) => !baselineByName.has(name));
  const removedTools = baseline.tools
    .map((tool) => tool.name)
    .filter((name) => !currentByName.has(name));
  const reasonChangedTools = current.tools
    .map((tool) => tool.name)
    .filter((name) => {
      const currentTool = currentByName.get(name);
      const baselineTool = baselineByName.get(name);
      if (!currentTool || !baselineTool) return false;
      return (currentTool.reason || null) !== (baselineTool.reason || null);
    });
  const requestedByChanged = (current.requestedBy ?? null) !== (baseline.requestedBy ?? null);
  const stopOnBlockedChanged = (current.stopOnBlocked ?? true) !== (baseline.stopOnBlocked ?? true);

  return {
    addedTools,
    removedTools,
    reasonChangedTools,
    requestedByChanged,
    stopOnBlockedChanged,
    changed:
      addedTools.length > 0 ||
      removedTools.length > 0 ||
      reasonChangedTools.length > 0 ||
      requestedByChanged ||
      stopOnBlockedChanged,
  };
};

export const summarizeManagedProviderRequestDiff = (diff: DuskManagedProviderRequestDiff) => {
  if (!diff.changed) return 'Matches accepted baseline';

  const parts = [
    diff.addedTools.length ? `+${diff.addedTools.length}` : null,
    diff.removedTools.length ? `-${diff.removedTools.length}` : null,
    diff.reasonChangedTools.length ? `~${diff.reasonChangedTools.length} reasons` : null,
    diff.requestedByChanged ? 'requester changed' : null,
    diff.stopOnBlockedChanged ? 'stop mode changed' : null,
  ].filter(Boolean);

  return parts.length ? parts.join(' · ') : 'Diff detected';
};
