import { describe, expect, it } from 'vitest';
import { buildCloudReadinessReport } from '../src/admin/cloudReadiness';

describe('cloud readiness report', () => {
  it('blocks when there is no signed-in session', () => {
    const report = buildCloudReadinessReport({
      hasSession: false,
      claimState: {
        role: null,
        lookupReady: false,
        reason: 'No session',
      },
      platformCloudEnabled: false,
      platformSyncStatus: 'local_only',
      platformSyncMessage: null,
      diagnosticsState: 'idle',
      diagnosticsMessage: null,
      diagnostics: null,
    });

    expect(report.level).toBe('blocked');
    expect(report.checks[0]?.id).toBe('session');
    expect(report.nextStep).toMatch(/sign in/i);
  });

  it('shows refresh-session guidance when assignment exists but token claim is stale', () => {
    const report = buildCloudReadinessReport({
      hasSession: true,
      claimState: {
        role: null,
        lookupReady: false,
        reason: 'Signed in, but the token is missing app_metadata.xtation_role.',
      },
      platformCloudEnabled: true,
      platformSyncStatus: 'synced',
      platformSyncMessage: null,
      diagnosticsState: 'ready',
      diagnosticsMessage: null,
      diagnostics: {
        operatorUserId: 'user-1',
        operatorEmail: 'operator@example.com',
        roleClaim: null,
        assignmentRole: 'super_admin',
        hasOperatorAccess: false,
        hasPlatformProfilesTable: true,
        hasOperatorAssignmentsTable: true,
        hasLookupRpc: true,
        hasRolloutRpc: true,
        hasAuditRpc: true,
        hasHookFunction: true,
        currentProfileExists: true,
      },
    });

    expect(report.level).toBe('attention');
    expect(report.checks.find((check) => check.id === 'claim')?.detail).toMatch(/sign out and back in/i);
  });

  it('reports ready when the signed-in operator stack is healthy', () => {
    const report = buildCloudReadinessReport({
      hasSession: true,
      claimState: {
        role: 'super_admin',
        lookupReady: true,
        reason: 'Token claim super_admin is ready for operator lookup.',
      },
      platformCloudEnabled: true,
      platformSyncStatus: 'synced',
      platformSyncMessage: null,
      diagnosticsState: 'ready',
      diagnosticsMessage: null,
      diagnostics: {
        operatorUserId: 'user-1',
        operatorEmail: 'operator@example.com',
        roleClaim: 'super_admin',
        assignmentRole: 'super_admin',
        hasOperatorAccess: true,
        hasPlatformProfilesTable: true,
        hasOperatorAssignmentsTable: true,
        hasLookupRpc: true,
        hasRolloutRpc: true,
        hasAuditRpc: true,
        hasHookFunction: true,
        currentProfileExists: true,
      },
    });

    expect(report.level).toBe('ready');
    expect(report.summary).toMatch(/ready/i);
  });
});
