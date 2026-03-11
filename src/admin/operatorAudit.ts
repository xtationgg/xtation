import { supabase } from '../lib/supabaseClient';
import { OperatorLookupAccessDeniedError } from './operatorLookup';

const AUDIT_RPC = 'xtation_recent_operator_audit';

type OperatorAuditRow = {
  audit_id?: string | null;
  actor_user_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  target_user_id?: string | null;
  target_email?: string | null;
  action?: string | null;
  summary?: string | null;
  patch?: Record<string, unknown> | null;
  created_at?: string | null;
};

export interface CloudOperatorAuditEntry {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  action: string;
  summary: string;
  patch: Record<string, unknown>;
  createdAt: number | null;
}

export class MissingOperatorAuditFunctionError extends Error {
  constructor() {
    super('Supabase operator audit feed function is not installed.');
    this.name = 'MissingOperatorAuditFunctionError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isMissingFunctionError = (error: unknown) => {
  const candidate = error as { code?: string; status?: number; message?: string; details?: string } | null;
  if (!candidate) return false;
  if (candidate.code === '42883' || candidate.code === 'PGRST202') return true;
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase();
  return message.includes(AUDIT_RPC) && (message.includes('function') || message.includes('does not exist'));
};

const isAccessDeniedError = (error: unknown) => {
  const candidate = error as { code?: string; status?: number; message?: string; details?: string } | null;
  if (!candidate) return false;
  if (candidate.code === '42501' || candidate.status === 401 || candidate.status === 403) return true;
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase();
  return message.includes('operator access required') || message.includes('permission denied');
};

const normalizeEntry = (row: OperatorAuditRow): CloudOperatorAuditEntry | null => {
  if (!row.audit_id || typeof row.audit_id !== 'string') return null;
  return {
    id: row.audit_id,
    actorUserId: typeof row.actor_user_id === 'string' ? row.actor_user_id : null,
    actorEmail: typeof row.actor_email === 'string' ? row.actor_email : null,
    actorRole: typeof row.actor_role === 'string' ? row.actor_role : null,
    targetUserId: typeof row.target_user_id === 'string' ? row.target_user_id : null,
    targetEmail: typeof row.target_email === 'string' ? row.target_email : null,
    action: typeof row.action === 'string' ? row.action : 'unknown',
    summary: typeof row.summary === 'string' ? row.summary : 'Operator action recorded',
    patch: isRecord(row.patch) ? row.patch : {},
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
  };
};

export const loadCloudOperatorAudit = async (
  targetUserId?: string | null,
  limit = 20
): Promise<CloudOperatorAuditEntry[]> => {
  const { data, error } = await supabase.rpc(AUDIT_RPC, {
    target_user_id: targetUserId ?? null,
    result_limit: Math.max(1, Math.min(limit, 50)),
  });

  if (error) {
    if (isMissingFunctionError(error)) {
      throw new MissingOperatorAuditFunctionError();
    }
    if (isAccessDeniedError(error)) {
      throw new OperatorLookupAccessDeniedError();
    }
    throw error;
  }

  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => normalizeEntry((entry || {}) as OperatorAuditRow))
    .filter((entry): entry is CloudOperatorAuditEntry => !!entry);
};
