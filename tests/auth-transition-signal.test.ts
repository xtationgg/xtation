import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAuthTransitionSignal,
  readAuthTransitionSignal,
  writeAuthTransitionSignal,
} from '../src/auth/authTransitionSignal';

const withSessionStorageOverride = (
  method: 'getItem' | 'setItem' | 'removeItem',
  override: Storage['getItem'] | Storage['setItem'] | Storage['removeItem'],
  run: () => void
) => {
  const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
  const original = storageProto[method];
  Object.defineProperty(storageProto, method, {
    configurable: true,
    value: override,
  });
  try {
    run();
  } finally {
    Object.defineProperty(storageProto, method, {
      configurable: true,
      value: original,
    });
  }
};

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

  it('fails safely when session storage write throws', () => {
    withSessionStorageOverride(
      'setItem',
      () => {
        throw new Error('blocked');
      },
      () => {
        expect(
          writeAuthTransitionSignal({
            mode: 'login',
            fromGuestMode: true,
          })
        ).toBe(false);
      }
    );
  });

  it('returns null when session storage read throws', () => {
    withSessionStorageOverride(
      'getItem',
      () => {
        throw new Error('blocked');
      },
      () => {
        expect(readAuthTransitionSignal()).toBeNull();
      }
    );
  });

  it('does not throw when session storage remove throws', () => {
    withSessionStorageOverride(
      'removeItem',
      () => {
        throw new Error('blocked');
      },
      () => {
        expect(() => clearAuthTransitionSignal()).not.toThrow();
      }
    );
  });
});
