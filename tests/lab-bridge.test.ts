import { afterEach, describe, expect, it } from 'vitest';
import {
  clearPendingLabNavigation,
  openLabNavigation,
  readPendingLabNavigation,
} from '../src/lab/bridge';

describe('lab bridge', () => {
  afterEach(() => {
    clearPendingLabNavigation();
  });

  it('stores and reads pending navigation payloads', () => {
    openLabNavigation({
      section: 'knowledge',
      collection: 'baselines',
      noteId: 'note-1',
      requestedBy: 'dusk',
    });

    expect(readPendingLabNavigation()).toEqual({
      section: 'knowledge',
      collection: 'baselines',
      noteId: 'note-1',
      requestedBy: 'dusk',
    });
  });

  it('clears pending navigation payloads', () => {
    openLabNavigation({
      section: 'workspace',
      requestedBy: 'lab',
    });

    clearPendingLabNavigation();

    expect(readPendingLabNavigation()).toBeNull();
  });
});
