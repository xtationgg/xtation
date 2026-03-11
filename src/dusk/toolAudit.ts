import { readUserScopedJSON, writeUserScopedJSON } from '../lib/userScopedStorage';
import type { DuskActionId } from './actionDeck';
import type { DuskToolExecutionResult } from './toolRuntime';

export type DuskToolAuditActor = 'relay' | 'provider';

export interface DuskToolAuditEntry {
  id: string;
  actionId: DuskActionId;
  actor: DuskToolAuditActor;
  status: DuskToolExecutionResult['status'];
  message: string;
  createdAt: number;
  createdQuestId?: string;
  openedQuestId?: string;
  noteId?: string;
}

export const DUSK_TOOL_AUDIT_KEY = 'duskToolAudit.v1';
export const DUSK_TOOL_AUDIT_EVENT = 'dusk:toolAudit';

const MAX_AUDIT_ENTRIES = 40;

const createAuditId = () => `dusk-tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const readDuskToolAudit = (userId?: string | null) =>
  readUserScopedJSON<DuskToolAuditEntry[]>(DUSK_TOOL_AUDIT_KEY, [], userId);

export const appendDuskToolAuditEntry = (
  actionId: DuskActionId,
  actor: DuskToolAuditActor,
  result: DuskToolExecutionResult,
  userId?: string | null
): DuskToolAuditEntry | null => {
  if (typeof window === 'undefined') return null;

  const entry: DuskToolAuditEntry = {
    id: createAuditId(),
    actionId,
    actor,
    status: result.status,
    message: result.message,
    createdAt: Date.now(),
    createdQuestId: result.createdQuestId,
    openedQuestId: result.openedQuestId,
    noteId: result.noteId,
  };

  const next = [entry, ...readDuskToolAudit(userId)].slice(0, MAX_AUDIT_ENTRIES);
  writeUserScopedJSON(DUSK_TOOL_AUDIT_KEY, next, userId);
  window.dispatchEvent(
    new CustomEvent<DuskToolAuditEntry>(DUSK_TOOL_AUDIT_EVENT, {
      detail: entry,
    })
  );
  return entry;
};
