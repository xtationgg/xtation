import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearGuestModeSession,
  readGuestModeSession,
  writeGuestModeSession,
} from '../src/auth/guestModeSession';

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

describe('guestModeSession', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('persists and reads guest mode state', () => {
    expect(writeGuestModeSession(true)).toBe(true);
    expect(readGuestModeSession()).toBe(true);

    expect(clearGuestModeSession()).toBe(true);
    expect(readGuestModeSession()).toBe(false);
  });

  it('returns false when session read throws', () => {
    withSessionStorageOverride(
      'getItem',
      () => {
        throw new Error('blocked');
      },
      () => {
        expect(readGuestModeSession()).toBe(false);
      }
    );
  });

  it('returns false when session write throws', () => {
    withSessionStorageOverride(
      'setItem',
      () => {
        throw new Error('blocked');
      },
      () => {
        expect(writeGuestModeSession(true)).toBe(false);
      }
    );
  });

  it('returns false when clearing guest mode throws', () => {
    withSessionStorageOverride(
      'removeItem',
      () => {
        throw new Error('blocked');
      },
      () => {
        expect(clearGuestModeSession()).toBe(false);
      }
    );
  });
});
