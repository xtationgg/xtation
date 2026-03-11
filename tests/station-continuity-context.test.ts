import { describe, expect, it } from 'vitest';
import { ClientView } from '../types';
import { buildStationContinuityContext } from '../src/station/continuityContext';

const makeEntry = (overrides: Partial<import('../src/station/stationActivity').StationActivityEntry>) => ({
  id: overrides.id ?? 'entry',
  createdAt: overrides.createdAt ?? Date.now(),
  title: overrides.title ?? 'Entry',
  detail: overrides.detail ?? 'Detail',
  targetView: overrides.targetView ?? ClientView.LOBBY,
  workspaceLabel: overrides.workspaceLabel ?? 'Play',
  chips: overrides.chips ?? ['Offline-first'],
  tone: overrides.tone ?? 'default',
});

describe('buildStationContinuityContext', () => {
  it('returns starter summary, visible transition, and visible recent activity together', () => {
    const activity = [
      makeEntry({
        id: 'starter',
        createdAt: 300,
        title: 'First session live',
        detail: 'Live starter loop',
        targetView: ClientView.PROFILE,
        workspaceLabel: 'Profile',
        chips: ['starter-session-live', 'Mission'],
      }),
      makeEntry({
        id: 'transition',
        createdAt: 200,
        title: 'Imported local station',
        detail: 'Imported into account state.',
        targetView: ClientView.ADMIN,
        workspaceLabel: 'Admin',
        chips: ['Imported'],
      }),
      makeEntry({
        id: 'older',
        createdAt: 100,
        title: 'Older continuity',
      }),
    ];

    const context = buildStationContinuityContext(activity, ClientView.LOBBY, {
      canAccessAdmin: false,
      featureVisibility: { lab: true, multiplayer: true, store: true },
    });

    expect(context.starterFlowSummary?.title).toBe('First session live');
    expect(context.latestTransitionActivity).toBeNull();
    expect(context.visibleRecentStationActivity).toHaveLength(2);
    expect(context.visibleRecentStationActivity[1]?.workspaceLabel).toBe('Play');
    expect(context.visibleRecentStationActivity[1]?.chips).toContain('Play fallback');
  });
});
