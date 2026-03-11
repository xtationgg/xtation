import { describe, expect, it } from 'vitest';
import {
  clearPendingPlayNavigation,
  openPlayNavigation,
  readPendingPlayNavigation,
} from '../src/play/bridge';

describe('play bridge', () => {
  it('persists and clears pending play navigation', () => {
    openPlayNavigation({ taskId: 'quest-42', requestedBy: 'profile' });

    expect(readPendingPlayNavigation()).toMatchObject({
      taskId: 'quest-42',
      requestedBy: 'profile',
    });

    clearPendingPlayNavigation();
    expect(readPendingPlayNavigation()).toBeNull();
  });
});
