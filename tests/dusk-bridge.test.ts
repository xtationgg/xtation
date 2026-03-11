import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearLatestDuskBrief,
  normalizeStoredDuskBrief,
  openDuskBrief,
  readLatestDuskBrief,
  persistLatestDuskBrief,
} from '../src/dusk/bridge';
import { setActiveUserId } from '../src/lib/userScopedStorage';

const resetBridgeState = () => {
  clearLatestDuskBrief('local');
  clearLatestDuskBrief('user-42');
  setActiveUserId(null);
};

describe('dusk brief bridge', () => {
  beforeEach(() => {
    resetBridgeState();
  });

  afterEach(() => {
    resetBridgeState();
  });

  it('persists the latest brief for local scope when opened without a user', () => {
    openDuskBrief({
      title: 'Local brief',
      body: 'Keep the local station live.',
      source: 'play',
      tags: ['starter'],
    });

    const stored = readLatestDuskBrief('local');
    expect(stored).not.toBeNull();
    expect(stored?.title).toBe('Local brief');
    expect(stored?.source).toBe('play');
    expect(stored?.tags).toEqual(['starter']);
    expect(typeof stored?.receivedAt).toBe('number');
  });

  it('persists the latest brief under the active user scope', () => {
    setActiveUserId('user-42');

    openDuskBrief({
      title: 'Account brief',
      body: 'Sync the account station.',
      source: 'settings',
    });

    expect(readLatestDuskBrief('user-42')?.title).toBe('Account brief');
    expect(readLatestDuskBrief('local')).toBeNull();
  });

  it('preserves stored timestamps when persisting an already stored brief again', () => {
    const stored = normalizeStoredDuskBrief({
      title: 'Stored brief',
      body: 'Existing stored payload.',
      source: 'lab',
      createdAt: 100,
      receivedAt: 200,
    });

    const persisted = persistLatestDuskBrief(stored, 'user-42');

    expect(persisted.createdAt).toBe(100);
    expect(persisted.receivedAt).toBe(200);
    expect(readLatestDuskBrief('user-42')?.receivedAt).toBe(200);
  });

  it('clears the latest brief for the requested scope', () => {
    persistLatestDuskBrief(
      {
        title: 'Clear me',
        body: 'Will be removed.',
        source: 'profile',
      },
      'user-42'
    );

    clearLatestDuskBrief('user-42');

    expect(readLatestDuskBrief('user-42')).toBeNull();
  });
});
