import type { Session } from '@supabase/supabase-js';

const VALID_OPERATOR_ROLES = new Set(['super_admin', 'ops_admin', 'support_admin', 'beta_manager']);

type JwtPayloadRecord = Record<string, unknown>;

export interface OperatorClaimState {
  role: string | null;
  lookupReady: boolean;
  reason: string;
}

const isRecord = (value: unknown): value is JwtPayloadRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return atob(`${normalized}${padding}`);
};

const parseJwtPayload = (token: string): JwtPayloadRecord | null => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const decoded = decodeBase64Url(parts[1]);
    const parsed = JSON.parse(decoded) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const extractOperatorRole = (payload: JwtPayloadRecord | null) => {
  if (!payload) return null;
  if (typeof payload.xtation_role === 'string' && payload.xtation_role.trim()) {
    return payload.xtation_role.trim();
  }
  if (isRecord(payload.app_metadata) && typeof payload.app_metadata.xtation_role === 'string' && payload.app_metadata.xtation_role.trim()) {
    return payload.app_metadata.xtation_role.trim();
  }
  if (isRecord(payload.user_metadata) && typeof payload.user_metadata.xtation_role === 'string' && payload.user_metadata.xtation_role.trim()) {
    return payload.user_metadata.xtation_role.trim();
  }
  return null;
};

export const readOperatorClaimState = (session: Session | null): OperatorClaimState => {
  if (!session?.access_token) {
    return {
      role: null,
      lookupReady: false,
      reason: 'Sign in with an operator account to unlock cloud lookup.',
    };
  }

  const role = extractOperatorRole(parseJwtPayload(session.access_token));
  if (!role) {
    return {
      role: null,
      lookupReady: false,
      reason: 'Signed in, but the token is missing app_metadata.xtation_role.',
    };
  }

  if (!VALID_OPERATOR_ROLES.has(role)) {
    return {
      role,
      lookupReady: false,
      reason: `Token carries ${role}, but it is not allowed to run operator lookup.`,
    };
  }

  return {
    role,
    lookupReady: true,
    reason: `Token claim ${role} is ready for operator lookup.`,
  };
};
