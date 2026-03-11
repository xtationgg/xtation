import { describe, expect, it } from 'vitest';
import { readOperatorClaimState } from '../src/admin/operatorClaims';

const makeSession = (payload: Record<string, unknown>) =>
  ({
    access_token: [
      'header',
      Buffer.from(JSON.stringify(payload)).toString('base64url'),
      'signature',
    ].join('.'),
  }) as never;

describe('operator claim state', () => {
  it('blocks lookup when no session is present', () => {
    const state = readOperatorClaimState(null);
    expect(state.lookupReady).toBe(false);
    expect(state.role).toBeNull();
  });

  it('reads xtation_role from app metadata and marks valid operator claims ready', () => {
    const state = readOperatorClaimState(
      makeSession({
        app_metadata: {
          xtation_role: 'support_admin',
        },
      })
    );

    expect(state.lookupReady).toBe(true);
    expect(state.role).toBe('support_admin');
  });

  it('blocks lookup for unknown roles', () => {
    const state = readOperatorClaimState(
      makeSession({
        app_metadata: {
          xtation_role: 'viewer',
        },
      })
    );

    expect(state.lookupReady).toBe(false);
    expect(state.role).toBe('viewer');
  });
});
