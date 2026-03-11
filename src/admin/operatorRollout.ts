import { supabase } from '../lib/supabaseClient';
import type { OperatorPlan, ReleaseChannel } from './AdminConsoleProvider';
import type { OperatorLookupResult } from './operatorLookup';
import { MissingOperatorLookupFunctionError, OperatorLookupAccessDeniedError } from './operatorLookup';

const ROLLOUT_RPC = 'xtation_apply_station_rollout';

type OperatorRolloutRow = {
  user_id?: string | null;
  email?: string | null;
  release_channel?: string | null;
  plan?: string | null;
  trial_ends_at?: string | null;
  beta_cohort?: string | null;
  feature_flags?: Record<string, boolean> | null;
  updated_at?: string | null;
  audit_id?: string | null;
};

export interface OperatorRolloutPatch {
  releaseChannel?: ReleaseChannel;
  plan?: OperatorPlan;
  trialDays?: number | null;
  clearTrial?: boolean;
  betaCohort?: string | null;
  clearBetaCohort?: boolean;
  featureFlagsPatch?: Record<string, boolean>;
}

export interface OperatorRolloutResult extends OperatorLookupResult {
  auditId: string | null;
}

export class MissingOperatorRolloutFunctionError extends Error {
  constructor() {
    super('Supabase operator rollout function is not installed.');
    this.name = 'MissingOperatorRolloutFunctionError';
  }
}

const isReleaseChannel = (value: unknown): value is ReleaseChannel =>
  value === 'internal' || value === 'beta' || value === 'stable';

const isPlan = (value: unknown): value is OperatorPlan =>
  value === 'free' || value === 'trial' || value === 'pro' || value === 'team';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeFeatureFlags = (value: unknown): Record<string, boolean> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, flagValue]) => typeof flagValue === 'boolean')
  );
};

const isMissingFunctionError = (error: unknown) => {
  const candidate = error as { code?: string; status?: number; message?: string; details?: string } | null;
  if (!candidate) return false;
  if (candidate.code === '42883' || candidate.code === 'PGRST202') return true;
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase();
  return message.includes(ROLLOUT_RPC) && (message.includes('function') || message.includes('does not exist'));
};

const isAccessDeniedError = (error: unknown) => {
  const candidate = error as { code?: string; status?: number; message?: string; details?: string } | null;
  if (!candidate) return false;
  if (candidate.code === '42501' || candidate.status === 401 || candidate.status === 403) return true;
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase();
  return message.includes('operator access required') || message.includes('permission denied');
};

const normalizeRow = (row: OperatorRolloutRow): OperatorRolloutResult | null => {
  if (!row.user_id || typeof row.user_id !== 'string') return null;
  return {
    userId: row.user_id,
    email: typeof row.email === 'string' ? row.email : null,
    releaseChannel: isReleaseChannel(row.release_channel) ? row.release_channel : 'stable',
    plan: isPlan(row.plan) ? row.plan : 'free',
    trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at).getTime() : null,
    betaCohort: typeof row.beta_cohort === 'string' && row.beta_cohort.trim() ? row.beta_cohort.trim() : null,
    featureFlags: normalizeFeatureFlags(row.feature_flags),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    auditId: typeof row.audit_id === 'string' ? row.audit_id : null,
  };
};

export const applyOperatorStationRollout = async (
  targetUserId: string,
  patch: OperatorRolloutPatch
): Promise<OperatorRolloutResult> => {
  const { data, error } = await supabase.rpc(ROLLOUT_RPC, {
    target_user_id: targetUserId,
    next_release_channel: patch.releaseChannel ?? null,
    next_plan: patch.plan ?? null,
    next_trial_days: patch.trialDays ?? null,
    clear_trial: patch.clearTrial ?? false,
    next_beta_cohort: patch.betaCohort ?? null,
    clear_beta_cohort: patch.clearBetaCohort ?? false,
    feature_flags_patch: patch.featureFlagsPatch ?? null,
  });

  if (error) {
    if (isMissingFunctionError(error)) {
      throw new MissingOperatorRolloutFunctionError();
    }
    if (isAccessDeniedError(error)) {
      throw new OperatorLookupAccessDeniedError();
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  const normalized = normalizeRow((row || {}) as OperatorRolloutRow);
  if (!normalized) {
    throw new Error('Cloud rollout update did not return a valid station profile.');
  }
  return normalized;
};
