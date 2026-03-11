import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAuthTransitionSignal,
  readAuthTransitionSignal,
  writeAuthTransitionSignal,
} from '../src/auth/authTransitionSignal';

describe('authTransitionSignal', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('persists a login transition', () => {
    writeAuthTransitionSignal({
      mode: 'login',
      fromGuestMode: true,
    });

    expect(readAuthTransitionSignal()).toMatchObject({
      mode: 'login',
      fromGuestMode: true,
    });
  });

  it('clears the pending transition signal', () => {
    writeAuthTransitionSignal({
      mode: 'oauth',
      fromGuestMode: false,
    });

    clearAuthTransitionSignal();
    expect(readAuthTransitionSignal()).toBeNull();
  });
});
