import { supabase } from '../lib/supabaseClient';
import type { OperatorPlan, ReleaseChannel } from './AdminConsoleProvider';

const LOOKUP_RPC = 'xtation_search_station_profiles';

type OperatorLookupRow = {
  user_id?: string | null;
  email?: string | null;
  release_channel?: string | null;
  plan?: string | null;
  trial_ends_at?: string | null;
  beta_cohort?: string | null;
  feature_flags?: Record<string, boolean> | null;
  updated_at?: string | null;
};

export interface OperatorLookupResult {
  userId: string;
  email: string | null;
  releaseChannel: ReleaseChannel;
  plan: OperatorPlan;
  trialEndsAt: number | null;
  betaCohort: string | null;
  featureFlags: Record<string, boolean>;
  updatedAt: number | null;
}

export class MissingOperatorLookupFunctionError extends Error {
  constructor() {
    super('Supabase operator lookup function is not installed.');
    this.name = 'MissingOperatorLookupFunctionError';
  }
}

export class OperatorLookupAccessDeniedError extends Error {
  constructor() {
    super('Operator lookup requires a signed-in account with XTATION operator claims.');
    this.name = 'OperatorLookupAccessDeniedError';
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
  return message.includes(LOOKUP_RPC) && (message.includes('function') || message.includes('does not exist'));
};

const isAccessDeniedError = (error: unknown) => {
  const candidate = error as { code?: string; status?: number; message?: string; details?: string } | null;
  if (!candidate) return false;
  if (candidate.code === '42501' || candidate.status === 401 || candidate.status === 403) return true;
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase();
  return message.includes('operator access required') || message.includes('permission denied');
};

const normalizeRow = (row: OperatorLookupRow): OperatorLookupResult | null => {
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
  };
};

export const searchOperatorStationProfiles = async (
  searchTerm: string,
  limit = 12
): Promise<OperatorLookupResult[]> => {
  const normalizedSearch = searchTerm.trim();
  const { data, error } = await supabase.rpc(LOOKUP_RPC, {
    search_term: normalizedSearch ? normalizedSearch : null,
    result_limit: Math.max(1, Math.min(limit, 25)),
  });

  if (error) {
    if (isMissingFunctionError(error)) {
      throw new MissingOperatorLookupFunctionError();
    }
    if (isAccessDeniedError(error)) {
      throw new OperatorLookupAccessDeniedError();
    }
    throw error;
  }

  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => normalizeRow((entry || {}) as OperatorLookupRow))
    .filter((entry): entry is OperatorLookupResult => !!entry);
};
