import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearStationTransitionNotice,
  isStationTransitionNoticeVisible,
  readStationTransitionNotice,
  resolveGuidedSetupTransitionActionLabel,
  resolveVisibleStationTransitionNotice,
  writeStationTransitionNotice,
} from '../src/auth/stationTransitionNotice';

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

describe('stationTransitionNotice', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('persists and reads a guest-scoped notice', () => {
    writeStationTransitionNotice({
      scope: 'guest',
      title: 'Returned to local station',
      detail: 'Offline workspace reopened.',
      workspaceLabel: 'Lab',
      chips: ['Account unchanged'],
    });

    expect(readStationTransitionNotice()).toMatchObject({
      scope: 'guest',
      title: 'Returned to local station',
      detail: 'Offline workspace reopened.',
      workspaceLabel: 'Lab',
      chips: ['Account unchanged'],
    });
  });

  it('matches visibility against account and guest scope correctly', () => {
    const guestNotice = writeStationTransitionNotice({
      scope: 'guest',
      title: 'Guest',
      detail: 'Guest detail',
    });

    expect(isStationTransitionNoticeVisible(guestNotice, { activeUserId: null, isGuestMode: true })).toBe(true);
    expect(isStationTransitionNoticeVisible(guestNotice, { activeUserId: 'user-1', isGuestMode: false })).toBe(false);

    const accountNotice = {
      ...(guestNotice as NonNullable<typeof guestNotice>),
      scope: 'account' as const,
    };

    expect(isStationTransitionNoticeVisible(accountNotice, { activeUserId: 'user-1', isGuestMode: false })).toBe(true);
    expect(isStationTransitionNoticeVisible(accountNotice, { activeUserId: null, isGuestMode: true })).toBe(false);
  });

  it('clears the stored notice', () => {
    writeStationTransitionNotice({
      scope: 'any',
      title: 'Notice',
      detail: 'Detail',
    });

    clearStationTransitionNotice();
    expect(readStationTransitionNotice()).toBeNull();
  });

  it('normalizes the visible target when the recorded workspace is no longer available', () => {
    const resolved = resolveVisibleStationTransitionNotice(
      {
        id: 'notice-1',
        createdAt: Date.now(),
        scope: 'account',
        title: 'Imported local station active',
        detail: 'XTATION restored the imported station.',
        workspaceLabel: 'Admin',
        targetView: 'ADMIN',
        chips: ['Imported', 'Admin reopened'],
        tone: 'accent',
      },
      'LOBBY',
      {
        canAccessAdmin: false,
        featureVisibility: { lab: true, multiplayer: true, store: true },
      }
    );

    expect(resolved?.workspaceLabel).toBe('Play');
    expect(resolved?.targetView).toBe('LOBBY');
    expect(resolved?.detail).toContain('reopen Play');
    expect(resolved?.chips).toContain('Play fallback');
  });

  it('resolves guided setup action labels from the current notice', () => {
    expect(
      resolveGuidedSetupTransitionActionLabel({
        id: 'notice-guided',
        createdAt: Date.now(),
        scope: 'guest',
        title: 'Guided setup opened',
        detail: 'XTATION opened the local Play station and started the guided setup flow.',
      })
    ).toBe('Continue Guided Setup');

    expect(
      resolveGuidedSetupTransitionActionLabel({
        id: 'notice-skipped',
        createdAt: Date.now(),
        scope: 'guest',
        title: 'Starter setup skipped',
        detail: 'XTATION left the local Play station open without seeding a starter loop. You can return to guided setup any time from Play.',
      })
    ).toBe('Return to Guided Setup');

    expect(resolveGuidedSetupTransitionActionLabel(null)).toBe('Start Guided Setup');
  });

  it('returns null instead of throwing when session storage write fails', () => {
    withSessionStorageOverride(
      'setItem',
      () => {
        throw new Error('blocked');
      },
      () => {
        expect(
          writeStationTransitionNotice({
            scope: 'guest',
            title: 'Guest',
            detail: 'Detail',
          })
        ).toBeNull();
      }
    );
  });

  it('returns null when session storage read fails', () => {
    withSessionStorageOverride(
      'getItem',
      () => {
        throw new Error('blocked');
      },
      () => {
        expect(readStationTransitionNotice()).toBeNull();
      }
    );
  });

  it('does not throw when session storage remove fails', () => {
    withSessionStorageOverride(
      'removeItem',
      () => {
        throw new Error('blocked');
      },
      () => {
        expect(() => clearStationTransitionNotice()).not.toThrow();
      }
    );
  });
});
