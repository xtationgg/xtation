import { describe, expect, it } from 'vitest';
import { ClientView } from '../types';
import type { StationActivityEntry } from '../src/station/stationActivity';
import {
  extractLatestStationTransitionActivity,
  filterVisibleTransitionHistory,
  resolveCurrentStationTransitionActivity,
  resolveVisibleStationActivityEntry,
  resolveVisibleStationTransitionActivity,
} from '../src/station/transitionSummary';

const buildEntry = (
  partial: Partial<StationActivityEntry> & Pick<StationActivityEntry, 'title' | 'detail'>
): StationActivityEntry => ({
  id: partial.id ?? Math.random().toString(36).slice(2),
  createdAt: partial.createdAt ?? Date.now(),
  title: partial.title,
  detail: partial.detail,
  workspaceLabel: partial.workspaceLabel ?? null,
  targetView: partial.targetView ?? null,
  chips: partial.chips ?? [],
  tone: partial.tone ?? 'default',
});

describe('extractLatestStationTransitionActivity', () => {
  it('returns the newest non-starter transition entry', () => {
    const activity: StationActivityEntry[] = [
      buildEntry({
        title: 'Starter action confirmed',
        detail: 'The first move was taken.',
        chips: ['Starter action', 'Profile'],
      }),
      buildEntry({
        title: 'Returned to local station',
        detail: 'The offline station was reopened.',
        chips: ['Account unchanged', 'Play resumed'],
      }),
    ];

    expect(extractLatestStationTransitionActivity(activity)?.title).toBe('Returned to local station');
  });

  it('returns null when only starter-loop entries exist', () => {
    const activity: StationActivityEntry[] = [
      buildEntry({
        title: 'Starter checkpoint live',
        detail: 'The first loop landed.',
        chips: ['starter-checkpoint', 'Profile'],
      }),
    ];

    expect(extractLatestStationTransitionActivity(activity)).toBeNull();
  });

  it('normalizes the visible transition destination when the recorded view is unavailable', () => {
    const resolved = resolveVisibleStationTransitionActivity(
      buildEntry({
        title: 'Returned to admin station',
        detail: 'The local station was reopened.',
        workspaceLabel: 'Admin',
        targetView: ClientView.ADMIN,
        chips: ['Admin resumed'],
      }),
      ClientView.LOBBY,
      {
        canAccessAdmin: false,
      }
    );

    expect(resolved?.workspaceLabel).toBe('Play');
    expect(resolved?.targetView).toBe(ClientView.LOBBY);
    expect(resolved?.detail).toContain('reopen Play');
    expect(resolved?.chips).toContain('Play fallback');
  });

  it('normalizes recent activity entries through the same access rules', () => {
    const resolved = resolveVisibleStationActivityEntry(
      buildEntry({
        title: 'Imported local station',
        detail: 'Recovered imported local continuity.',
        workspaceLabel: 'Admin',
        targetView: ClientView.ADMIN,
        chips: ['Recovery snapshot saved'],
      }),
      ClientView.PROFILE,
      {
        canAccessAdmin: false,
      }
    );

    expect(resolved?.workspaceLabel).toBe('Play');
    expect(resolved?.targetView).toBe(ClientView.LOBBY);
    expect(resolved?.chips).toContain('Play fallback');
  });

  it('suppresses stale transition output when a newer starter-loop state exists', () => {
    const latestTransition = buildEntry({
      title: 'Starter loop seeded',
      detail: 'The first loop is armed.',
      createdAt: 10,
      workspaceLabel: 'Play',
      targetView: ClientView.LOBBY,
    });

    expect(
      resolveCurrentStationTransitionActivity(latestTransition, {
        title: 'First session live',
        detail: 'The first live session has started.',
        chips: ['Mission', 'Systems'],
        tone: 'accent',
        createdAt: 20,
        statusLabel: 'Session live',
        statusDetail: 'The first live session has started and XTATION is now tracking the starter loop in real time.',
        workspaceLabel: 'Play',
        targetView: ClientView.LOBBY,
      })
    ).toBeNull();
  });

  it('filters the active banner event out of recent continuity history', () => {
    const duplicate = buildEntry({
      title: 'Starter setup skipped',
      detail: 'XTATION left the local Play station open without seeding a starter loop. You can return to guided setup any time from Play.',
      workspaceLabel: 'Play',
      targetView: ClientView.LOBBY,
    });
    const older = buildEntry({
      title: 'Local station active',
      detail: 'XTATION opened a fresh offline-first Play station on this device.',
      workspaceLabel: 'Play',
      targetView: ClientView.LOBBY,
    });

    const filtered = filterVisibleTransitionHistory([duplicate, older], {
      id: 'notice-1',
      createdAt: Date.now(),
      scope: 'guest',
      title: 'Starter setup skipped',
      detail:
        'XTATION left the local Play station open without seeding a starter loop. You can return to guided setup any time from Play.',
      workspaceLabel: 'Play',
      targetView: ClientView.LOBBY,
      chips: ['Play open', 'Setup skipped', 'Offline-first'],
      tone: 'default',
    });

    expect(filtered).toEqual([older]);
  });
});
