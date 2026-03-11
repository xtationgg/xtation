import { describe, expect, it } from 'vitest';
import type { Task } from '../components/XP/xpTypes';
import {
  buildStarterRelayPhase,
  hasStarterCheckpointLanded,
  STARTER_SESSION_CHECKPOINT_MIN_MS,
} from '../src/onboarding/starterCheckpoint';

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Starter task',
  details: '',
  priority: 'high',
  status: 'todo',
  linkedSessionIds: [],
  createdAt: 1,
  updatedAt: 1,
  questType: 'session',
  ...overrides,
});

describe('hasStarterCheckpointLanded', () => {
  it('does not trigger for a session quest until meaningful tracked time lands', () => {
    const task = buildTask({ questType: 'session', status: 'active', startedAt: Date.now() });

    expect(hasStarterCheckpointLanded({ task, trackedMs: 0 })).toBe(false);
    expect(hasStarterCheckpointLanded({ task, trackedMs: STARTER_SESSION_CHECKPOINT_MIN_MS - 1 })).toBe(false);
    expect(hasStarterCheckpointLanded({ task, trackedMs: STARTER_SESSION_CHECKPOINT_MIN_MS })).toBe(true);
  });

  it('allows instant starter quests to checkpoint on first real activation', () => {
    const task = buildTask({ questType: 'instant', status: 'active', startedAt: Date.now() });

    expect(hasStarterCheckpointLanded({ task, trackedMs: 0 })).toBe(true);
  });

  it('always triggers when the starter quest is completed', () => {
    const task = buildTask({ status: 'done', completedAt: Date.now() });

    expect(hasStarterCheckpointLanded({ task, trackedMs: 0 })).toBe(true);
  });
});

describe('buildStarterRelayPhase', () => {
  it('shows an armed relay before the first session starts', () => {
    const task = buildTask({ questType: 'session', status: 'todo' });

    expect(
      buildStarterRelayPhase({
        task,
        trackedMs: 0,
        running: false,
        workspaceActionLabel: 'Open Profile',
      })
    ).toMatchObject({
      state: 'armed',
      actionLabel: 'Start First Session',
      actionDisabled: false,
      actionTone: 'accent',
    });
  });

  it('shows checkpoint-in-progress while the first session is live', () => {
    const task = buildTask({ questType: 'session', status: 'active', startedAt: Date.now() });

    expect(
      buildStarterRelayPhase({
        task,
        trackedMs: 0,
        running: true,
        workspaceActionLabel: 'Open Profile',
      })
    ).toMatchObject({
      state: 'live',
      actionLabel: 'Checkpoint in progress',
      actionDisabled: true,
      actionTone: 'success',
    });
  });

  it('switches to the routed workspace action once the checkpoint is confirmed', () => {
    const task = buildTask({ questType: 'session', status: 'active', startedAt: Date.now() });

    expect(
      buildStarterRelayPhase({
        task,
        trackedMs: STARTER_SESSION_CHECKPOINT_MIN_MS,
        running: true,
        workspaceActionLabel: 'Open Profile',
      })
    ).toMatchObject({
      state: 'confirmed',
      actionLabel: 'Open Profile',
      actionDisabled: false,
      actionTone: 'success',
    });
  });
});
