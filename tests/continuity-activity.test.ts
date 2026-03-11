import { describe, expect, it } from 'vitest';
import { ClientView } from '../types';
import type { StationActivityEntry } from '../src/station/stationActivity';
import { buildContinuityActivityPreview } from '../src/station/continuityActivity';

const buildEntry = (
  overrides: Partial<StationActivityEntry> & Pick<StationActivityEntry, 'title' | 'detail'>
): StationActivityEntry => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  createdAt: overrides.createdAt ?? Date.now(),
  title: overrides.title,
  detail: overrides.detail,
  workspaceLabel: overrides.workspaceLabel ?? 'Play',
  targetView: overrides.targetView ?? ClientView.LOBBY,
  chips: overrides.chips ?? [],
  tone: overrides.tone ?? 'default',
});

describe('buildContinuityActivityPreview', () => {
  it('removes the current starter-flow milestone from recent continuity', () => {
    const activity = [
      buildEntry({
        title: 'First session live',
        detail: 'The first session is live.',
        createdAt: 20,
      }),
      buildEntry({
        title: 'Starter loop seeded',
        detail: 'The starter loop is armed.',
        createdAt: 10,
      }),
    ];

    const preview = buildContinuityActivityPreview(activity, {
      title: 'First session live',
      detail: 'The first session is live.',
      chips: ['Mission', 'Systems'],
      tone: 'accent',
      createdAt: 20,
      statusLabel: 'Session live',
      statusDetail: 'The first live session has started and XTATION is now tracking the starter loop in real time.',
      workspaceLabel: 'Play',
      targetView: ClientView.LOBBY,
    });

    expect(preview).toHaveLength(1);
    expect(preview[0]?.title).toBe('Starter loop seeded');
  });

  it('falls back to the newest activity when no starter flow summary exists', () => {
    const activity = [
      buildEntry({
        title: 'Imported local station',
        detail: 'Local station imported.',
        createdAt: 20,
      }),
      buildEntry({
        title: 'Account connected',
        detail: 'Signed in and connected.',
        createdAt: 10,
      }),
    ];

    const preview = buildContinuityActivityPreview(activity, null);

    expect(preview).toHaveLength(2);
    expect(preview[0]?.title).toBe('Imported local station');
  });
});
