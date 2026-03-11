import { describe, expect, it } from 'vitest';
import type { Task } from '../components/XP/xpTypes';
import { resolveUrgentPresentationSignal } from '../src/presentation/urgentSignal';

const createTask = (overrides: Partial<Task>): Task => ({
  id: overrides.id || 'task-1',
  title: overrides.title || 'Default task',
  details: overrides.details || '',
  priority: overrides.priority || 'normal',
  status: overrides.status || 'todo',
  linkedSessionIds: [],
  createdAt: overrides.createdAt || 1000,
  updatedAt: overrides.updatedAt || 1000,
  ...overrides,
});

describe('resolveUrgentPresentationSignal', () => {
  it('prefers overdue urgent work over simple urgent priority', () => {
    const now = Date.UTC(2026, 2, 10, 10, 0, 0);
    const signal = resolveUrgentPresentationSignal(
      [
        createTask({ id: 'urgent-only', title: 'Urgent only', priority: 'urgent' }),
        createTask({
          id: 'urgent-overdue',
          title: 'Urgent and overdue',
          priority: 'urgent',
          scheduledAt: now - 45 * 60000,
        }),
      ],
      now
    );
    expect(signal?.taskId).toBe('urgent-overdue');
    expect(signal?.reason).toBe('urgent_overdue');
    expect(signal?.latenessMinutes).toBe(45);
  });

  it('returns null when there is no open urgent signal', () => {
    const now = Date.UTC(2026, 2, 10, 10, 0, 0);
    const signal = resolveUrgentPresentationSignal(
      [
        createTask({ id: 'done-urgent', priority: 'urgent', status: 'done', completedAt: now }),
        createTask({ id: 'normal', priority: 'normal' }),
      ],
      now
    );
    expect(signal).toBeNull();
  });

  it('uses a rolling signal key so overdue alerts can re-fire on a later bucket', () => {
    const task = createTask({
      id: 'late-task',
      title: 'Late task',
      priority: 'high',
      scheduledAt: Date.UTC(2026, 2, 10, 9, 0, 0),
    });
    const first = resolveUrgentPresentationSignal([task], Date.UTC(2026, 2, 10, 10, 0, 0));
    const second = resolveUrgentPresentationSignal([task], Date.UTC(2026, 2, 10, 10, 11, 0));
    expect(first?.reason).toBe('overdue_schedule');
    expect(second?.reason).toBe('overdue_schedule');
    expect(first?.signalKey).not.toBe(second?.signalKey);
  });
});
