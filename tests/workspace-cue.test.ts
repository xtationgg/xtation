import { describe, expect, it } from 'vitest';
import { ClientView } from '../types';
import {
  buildStarterSkippedTransition,
  buildStarterSeededTransition,
  buildStarterSessionLiveTransition,
  buildStarterWorkspaceCue,
  buildStarterWorkspaceRoute,
  clearPendingStarterWorkspaceAction,
  clearPendingStarterWorkspaceCue,
  describeStarterWorkspaceAction,
  dismissStarterWorkspaceCue,
  formatStarterWorkspaceCueEyebrow,
  openStarterWorkspaceAction,
  openStarterWorkspaceCue,
  readPendingStarterWorkspaceAction,
  readPendingStarterWorkspaceCue,
} from '../src/onboarding/workspaceCue';

const baseHandoff = {
  questId: 'quest-1',
  title: 'Ship the first loop',
  branch: 'Systems' as const,
  track: 'system' as const,
  nodeTitle: 'Automation',
  createdAt: 1_741_712_000_000,
  dismissedAt: null,
};

describe('workspace cue', () => {
  it('builds the correct route for a system starter track', () => {
    const route = buildStarterWorkspaceRoute(baseHandoff);
    expect(route.workspaceView).toBe(ClientView.LAB);
    expect(route.workspaceAction).toBe('Open Lab');
    expect(route.steps).toHaveLength(3);
  });

  it('builds a seeded transition notice for the first armed loop', () => {
    const transition = buildStarterSeededTransition(baseHandoff);
    expect(transition).toMatchObject({
      title: 'Starter loop seeded',
      workspaceLabel: 'Play',
      targetView: ClientView.LOBBY,
      tone: 'accent',
    });
    expect(transition.detail).toContain('armed in Play');
    expect(transition.detail).toContain('into Lab');
    expect(transition.chips).toEqual(['System', 'Systems', 'Lab next', 'Play armed']);
  });

  it('builds a skipped transition notice when setup is dismissed', () => {
    const transition = buildStarterSkippedTransition();
    expect(transition).toMatchObject({
      title: 'Starter setup skipped',
      workspaceLabel: 'Play',
      targetView: ClientView.LOBBY,
      tone: 'default',
    });
    expect(transition.detail).toContain('without seeding a starter loop');
    expect(transition.chips).toEqual(['Play open', 'Setup skipped', 'Offline-first']);
  });

  it('builds a session-live transition notice for the first real pass', () => {
    const transition = buildStarterSessionLiveTransition(baseHandoff, {
      landed: false,
      label: 'Checkpoint armed',
      detail: 'Keep this first session alive until the checkpoint locks. About 2 min of tracked work remains.',
      progress: 0.34,
      trackedLabel: '1 min / 3 min',
    });

    expect(transition).toMatchObject({
      title: 'First session live',
      workspaceLabel: 'Play',
      targetView: ClientView.LOBBY,
      tone: 'accent',
    });
    expect(transition.detail).toContain('now live in Play');
    expect(transition.detail).toContain('into Lab');
    expect(transition.chips).toEqual(['System', 'Systems', 'Session live', 'Lab pending']);
  });

  it('builds a destination-specific recommendation into the cue', () => {
    const cue = buildStarterWorkspaceCue(baseHandoff);
    expect(cue.workspaceView).toBe(ClientView.LAB);
    expect(cue.mode).toBe('launch');
    expect(cue.recommendedLabel).toBe('Capture the operating pattern');
    expect(cue.recommendedActionLabel).toBe('Open Knowledge');
    expect(cue.recommendedActionTarget).toBe('lab:knowledge');
  });

  it('builds a checkpoint cue after the first action lands', () => {
    const cue = buildStarterWorkspaceCue(baseHandoff, {
      mode: 'checkpoint',
      checkpointStatus: {
        landed: true,
        label: 'Checkpoint landed',
        detail: 'The first real session landed.',
        progress: 1,
        trackedLabel: '3 min / 3 min',
      },
    });
    expect(cue.workspaceView).toBe(ClientView.LAB);
    expect(cue.mode).toBe('checkpoint');
    expect(cue.title).toContain('Continue in Lab');
    expect(cue.recommendedLabel).toBe('Lock the first operating pattern');
    expect(formatStarterWorkspaceCueEyebrow(cue)).toBe('Starter checkpoint');
    expect(cue.checkpointLabel).toBe('Checkpoint landed');
    expect(cue.checkpointTrackedLabel).toBe('3 min / 3 min');
    expect(cue.checkpointProgress).toBe(1);
    expect(cue.checkpointOutcomeLabel).toBe('Lab route live');
    expect(cue.checkpointOutcomeDetail).toContain('confirmed first pass');
  });

  it('persists and clears a starter workspace cue', () => {
    const cue = buildStarterWorkspaceCue(baseHandoff);
    openStarterWorkspaceCue(cue);

    expect(readPendingStarterWorkspaceCue()).toMatchObject({
      workspaceView: ClientView.LAB,
      questId: 'quest-1',
      track: 'system',
    });

    clearPendingStarterWorkspaceCue();
    expect(readPendingStarterWorkspaceCue()).toBeNull();
  });

  it('persists and clears a starter workspace action', () => {
    openStarterWorkspaceAction({
      workspaceView: ClientView.LAB,
      target: 'lab:knowledge',
      source: 'shell',
    });

    expect(readPendingStarterWorkspaceAction()).toMatchObject({
      workspaceView: ClientView.LAB,
      target: 'lab:knowledge',
      source: 'shell',
    });

    clearPendingStarterWorkspaceAction();
    expect(readPendingStarterWorkspaceAction()).toBeNull();
  });

  it('clears a starter workspace cue when dismissed', () => {
    const cue = buildStarterWorkspaceCue(baseHandoff);
    openStarterWorkspaceCue(cue);

    dismissStarterWorkspaceCue();
    expect(readPendingStarterWorkspaceCue()).toBeNull();
  });

  it('describes a confirmed workspace action using checkpoint context', () => {
    const cue = buildStarterWorkspaceCue(baseHandoff, {
      mode: 'checkpoint',
      checkpointStatus: {
        landed: true,
        label: 'Checkpoint landed',
        detail: 'The first real session landed.',
        progress: 1,
        trackedLabel: '3 min / 3 min',
      },
    });

    expect(describeStarterWorkspaceAction(cue, 'lab:knowledge')).toMatchObject({
      title: 'Knowledge open',
      tone: 'accent',
    });
    expect(describeStarterWorkspaceAction(cue, 'lab:knowledge').detail).toContain('confirmed');
    expect(describeStarterWorkspaceAction(cue, 'lab:knowledge').chips).toContain('Starter action');
  });
});
