import { supabase } from '../lib/supabaseClient';

const DIAGNOSTICS_RPC = 'xtation_operator_diagnostics';

type OperatorDiagnosticsRow = {
  operator_user_id?: string | null;
  operator_email?: string | null;
  role_claim?: string | null;
  assignment_role?: string | null;
  has_operator_access?: boolean | null;
  has_platform_profiles_table?: boolean | null;
  has_operator_assignments_table?: boolean | null;
  has_lookup_rpc?: boolean | null;
  has_rollout_rpc?: boolean | null;
  has_audit_rpc?: boolean | null;
  has_hook_function?: boolean | null;
  current_profile_exists?: boolean | null;
};

export interface OperatorDiagnostics {
  operatorUserId: string | null;
  operatorEmail: string | null;
  roleClaim: string | null;
  assignmentRole: string | null;
  hasOperatorAccess: boolean;
  hasPlatformProfilesTable: boolean;
  hasOperatorAssignmentsTable: boolean;
  hasLookupRpc: boolean;
  hasRolloutRpc: boolean;
  hasAuditRpc: boolean;
  hasHookFunction: boolean;
  currentProfileExists: boolean;
}

export class MissingOperatorDiagnosticsFunctionError extends Error {
  constructor() {
    super('Supabase operator diagnostics function is not installed.');
    this.name = 'MissingOperatorDiagnosticsFunctionError';
  }
}

export class OperatorDiagnosticsAuthRequiredError extends Error {
  constructor() {
    super('Sign in before using XTATION cloud diagnostics.');
    this.name = 'OperatorDiagnosticsAuthRequiredError';
  }
}

const isMissingFunctionError = (error: unknown) => {
  const candidate = error as { code?: string; status?: number; message?: string; details?: string } | null;
  if (!candidate) return false;
  if (candidate.code === '42883' || candidate.code === 'PGRST202') return true;
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase();
  return message.includes(DIAGNOSTICS_RPC) && (message.includes('function') || message.includes('does not exist'));
};

const isAuthRequiredError = (error: unknown) => {
  const candidate = error as { code?: string; status?: number; message?: string; details?: string } | null;
  if (!candidate) return false;
  if (candidate.status === 401 || candidate.status === 403) return true;
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase();
  return message.includes('authentication required') || message.includes('permission denied');
};

const normalizeBoolean = (value: unknown) => value === true;

const normalizeText = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const normalizeRow = (row: OperatorDiagnosticsRow): OperatorDiagnostics => ({
  operatorUserId: normalizeText(row.operator_user_id),
  operatorEmail: normalizeText(row.operator_email),
  roleClaim: normalizeText(row.role_claim),
  assignmentRole: normalizeText(row.assignment_role),
  hasOperatorAccess: normalizeBoolean(row.has_operator_access),
  hasPlatformProfilesTable: normalizeBoolean(row.has_platform_profiles_table),
  hasOperatorAssignmentsTable: normalizeBoolean(row.has_operator_assignments_table),
  hasLookupRpc: normalizeBoolean(row.has_lookup_rpc),
  hasRolloutRpc: normalizeBoolean(row.has_rollout_rpc),
  hasAuditRpc: normalizeBoolean(row.has_audit_rpc),
  hasHookFunction: normalizeBoolean(row.has_hook_function),
  currentProfileExists: normalizeBoolean(row.current_profile_exists),
});

export const loadOperatorDiagnostics = async (): Promise<OperatorDiagnostics> => {
  const { data, error } = await supabase.rpc(DIAGNOSTICS_RPC);

  if (error) {
    if (isMissingFunctionError(error)) {
      throw new MissingOperatorDiagnosticsFunctionError();
    }
    if (isAuthRequiredError(error)) {
      throw new OperatorDiagnosticsAuthRequiredError();
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return normalizeRow((row || {}) as OperatorDiagnosticsRow);
};
