import { describe, expect, it } from 'vitest';
import {
  buildStarterLoopChips,
  extractStationStarterFlowSummary,
} from '../src/station/starterFlow';
import type { StationActivityEntry } from '../src/station/stationActivity';

const buildEntry = (
  overrides: Partial<StationActivityEntry> = {}
): StationActivityEntry => ({
  id: `entry-${Math.random().toString(36).slice(2, 8)}`,
  createdAt: Date.now(),
  title: 'Entry',
  detail: 'Detail',
  workspaceLabel: 'Profile',
  targetView: null,
  chips: [],
  tone: 'default',
  ...overrides,
});

describe('extractStationStarterFlowSummary', () => {
  it('keeps the semantic starter chip when trimming chip lists', () => {
    expect(
      buildStarterLoopChips('starter-session-live', [
        'Mission',
        'Systems',
        'Session live',
        'Profile pending',
      ])
    ).toEqual(['starter-session-live', 'Mission', 'Systems', 'Session live']);
  });

  it('returns null when no starter entry exists', () => {
    expect(
      extractStationStarterFlowSummary([buildEntry({ chips: ['Cloud state updated'] })])
    ).toBeNull();
  });

  it('prefers the newest starter action entry in the current activity order', () => {
    const result = extractStationStarterFlowSummary([
      buildEntry({
        title: 'Knowledge open',
        chips: ['Starter action', 'system', 'systems'],
      }),
      buildEntry({
        title: 'First loop landed. Continue in Lab',
        chips: ['starter-checkpoint', 'system', 'systems'],
        tone: 'accent',
      }),
    ]);

    expect(result?.title).toBe('Knowledge open');
    expect(result?.statusLabel).toBe('Action confirmed');
    expect(result?.chips).toEqual(['system', 'systems']);
  });

  it('marks checkpoint entries as live checkpoints', () => {
    const result = extractStationStarterFlowSummary([
      buildEntry({
        title: 'First repetition landed. Continue in Profile',
        detail: 'The first repetition has landed.',
        chips: ['mission', 'physical', 'starter-checkpoint'],
        tone: 'accent',
      }),
    ]);

    expect(result?.statusLabel).toBe('Checkpoint live');
    expect(result?.tone).toBe('accent');
    expect(result?.chips).toEqual(['mission', 'physical']);
  });

  it('marks session-live entries as a live starter session', () => {
    const result = extractStationStarterFlowSummary([
      buildEntry({
        title: 'First session live',
        detail: 'Ship first loop is now live in Play.',
        chips: ['system', 'systems', 'starter-session-live'],
        tone: 'accent',
      }),
    ]);

    expect(result?.statusLabel).toBe('Session live');
    expect(result?.statusDetail).toContain('first live session has started');
    expect(result?.chips).toEqual(['system', 'systems']);
  });
});
