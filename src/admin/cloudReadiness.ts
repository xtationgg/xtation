import type { PlatformSyncStatus } from './AdminConsoleProvider';
import type { OperatorClaimState } from './operatorClaims';
import type { OperatorDiagnostics } from './operatorDiagnostics';

export type CloudReadinessLevel = 'ready' | 'attention' | 'blocked';
export type CloudReadinessState = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';

export interface CloudReadinessCheck {
  id: string;
  label: string;
  status: CloudReadinessLevel;
  detail: string;
}

export interface CloudReadinessReport {
  level: CloudReadinessLevel;
  summary: string;
  nextStep: string;
  checks: CloudReadinessCheck[];
}

interface BuildCloudReadinessInput {
  hasSession: boolean;
  claimState: OperatorClaimState;
  platformCloudEnabled: boolean;
  platformSyncStatus: PlatformSyncStatus;
  platformSyncMessage: string | null;
  diagnosticsState: CloudReadinessState;
  diagnosticsMessage: string | null;
  diagnostics: OperatorDiagnostics | null;
}

const pickOverallLevel = (checks: CloudReadinessCheck[]): CloudReadinessLevel => {
  if (checks.some((check) => check.status === 'blocked')) return 'blocked';
  if (checks.some((check) => check.status === 'attention')) return 'attention';
  return 'ready';
};

export const buildCloudReadinessReport = ({
  hasSession,
  claimState,
  platformCloudEnabled,
  platformSyncStatus,
  platformSyncMessage,
  diagnosticsState,
  diagnosticsMessage,
  diagnostics,
}: BuildCloudReadinessInput): CloudReadinessReport => {
  const checks: CloudReadinessCheck[] = [];

  checks.push(
    hasSession
      ? {
          id: 'session',
          label: 'Signed-in account',
          status: 'ready',
          detail: 'A signed-in account is available for cloud sync and operator RPCs.',
        }
      : {
          id: 'session',
          label: 'Signed-in account',
          status: 'blocked',
          detail: 'Sign in before using XTATION cloud diagnostics or operator workflows.',
        }
  );

  if (!hasSession) {
    checks.push(
      {
        id: 'claim',
        label: 'Operator JWT claim',
        status: 'blocked',
        detail: 'No active session means there is no token to inspect for xtation_role.',
      },
      {
        id: 'stack',
        label: 'Supabase cloud stack',
        status: 'blocked',
        detail: 'Cloud stack checks only run after sign-in.',
      },
      {
        id: 'profile',
        label: 'Platform profile sync',
        status: 'blocked',
        detail: 'Platform profile sync only applies to signed-in accounts.',
      }
    );

    return {
      level: 'blocked',
      summary: 'Cloud operator workflows are blocked until you sign in.',
      nextStep: 'Sign in with the account you want to use as an XTATION operator.',
      checks,
    };
  }

  if (claimState.lookupReady) {
    checks.push({
      id: 'claim',
      label: 'Operator JWT claim',
      status: 'ready',
      detail: claimState.reason,
    });
  } else if (diagnostics?.assignmentRole) {
    checks.push({
      id: 'claim',
      label: 'Operator JWT claim',
      status: 'attention',
      detail: `Assignment exists as ${diagnostics.assignmentRole}, but the active token is stale. Sign out and back in to refresh xtation_role.`,
    });
  } else {
    checks.push({
      id: 'claim',
      label: 'Operator JWT claim',
      status: 'blocked',
      detail: claimState.reason,
    });
  }

  if (diagnosticsState === 'loading') {
    checks.push({
      id: 'stack',
      label: 'Supabase cloud stack',
      status: 'attention',
      detail: 'Probing XTATION operator tables and RPC functions…',
    });
  } else if (diagnosticsState === 'error') {
    checks.push({
      id: 'stack',
      label: 'Supabase cloud stack',
      status: 'blocked',
      detail: diagnosticsMessage || 'Cloud diagnostics failed.',
    });
  } else if (diagnosticsState === 'unavailable') {
    checks.push({
      id: 'stack',
      label: 'Supabase cloud stack',
      status: 'blocked',
      detail: diagnosticsMessage || 'Cloud diagnostics are not available yet.',
    });
  } else if (!diagnostics) {
    checks.push({
      id: 'stack',
      label: 'Supabase cloud stack',
      status: 'attention',
      detail: 'Run a cloud readiness refresh to inspect platform tables and operator RPCs.',
    });
  } else {
    const missingParts = [
      diagnostics.hasPlatformProfilesTable ? null : 'user_station_profiles',
      diagnostics.hasOperatorAssignmentsTable ? null : 'xtation_operator_assignments',
      diagnostics.hasHookFunction ? null : 'xtation_custom_access_token_hook',
      diagnostics.hasLookupRpc ? null : 'xtation_search_station_profiles',
      diagnostics.hasRolloutRpc ? null : 'xtation_apply_station_rollout',
      diagnostics.hasAuditRpc ? null : 'xtation_recent_operator_audit',
    ].filter(Boolean) as string[];

    checks.push({
      id: 'stack',
      label: 'Supabase cloud stack',
      status: missingParts.length === 0 ? 'ready' : 'blocked',
      detail:
        missingParts.length === 0
          ? 'Platform tables and operator RPC functions are installed.'
          : `Missing: ${missingParts.join(', ')}.`,
    });
  }

  if (!platformCloudEnabled) {
    checks.push({
      id: 'profile',
      label: 'Platform profile sync',
      status: diagnostics?.hasPlatformProfilesTable ? 'attention' : 'blocked',
      detail:
        platformSyncMessage ||
        (diagnostics?.hasPlatformProfilesTable
          ? 'Platform table exists, but the current client is still using local fallback.'
          : 'Supabase platform profile table is not installed yet.'),
    });
  } else if (platformSyncStatus === 'synced') {
    checks.push({
      id: 'profile',
      label: 'Platform profile sync',
      status: 'ready',
      detail: diagnostics?.currentProfileExists
        ? 'Current signed-in account has a cloud station profile and is syncing normally.'
        : 'Cloud profile sync is active and will create the station profile on first write.',
    });
  } else if (platformSyncStatus === 'loading' || platformSyncStatus === 'saving') {
    checks.push({
      id: 'profile',
      label: 'Platform profile sync',
      status: 'attention',
      detail: platformSyncStatus === 'loading' ? 'Loading platform profile from Supabase.' : 'Saving platform profile to Supabase.',
    });
  } else if (platformSyncStatus === 'error') {
    checks.push({
      id: 'profile',
      label: 'Platform profile sync',
      status: 'blocked',
      detail: platformSyncMessage || 'Platform profile sync failed.',
    });
  } else {
    checks.push({
      id: 'profile',
      label: 'Platform profile sync',
      status: 'attention',
      detail: platformSyncMessage || 'Platform sync is still in local-only mode.',
    });
  }

  const level = pickOverallLevel(checks);
  const nextBlocked = checks.find((check) => check.status === 'blocked');
  const nextAttention = checks.find((check) => check.status === 'attention');

  if (level === 'ready') {
    return {
      level,
      summary: 'Cloud operator workflows are ready.',
      nextStep: 'Use Cloud Account Lookup and rollout actions normally.',
      checks,
    };
  }

  if (nextBlocked) {
    return {
      level,
      summary: `Cloud readiness is blocked at ${nextBlocked.label.toLowerCase()}.`,
      nextStep: nextBlocked.detail,
      checks,
    };
  }

  return {
    level,
    summary: 'Cloud readiness needs one more setup pass.',
    nextStep: nextAttention?.detail || 'Refresh the diagnostics after applying the Supabase stack.',
    checks,
  };
};
