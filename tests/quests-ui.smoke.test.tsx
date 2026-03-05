import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QuestModal } from '../components/Play/QuestModal';
import { HextechAssistant } from '../components/Features/HextechAssistant';
import type { Task, XPSession } from '../components/XP/xpTypes';

const mockUseXP = vi.fn();

vi.mock('../components/XP/xpStore', () => ({
  useXP: () => mockUseXP(),
}));

vi.mock('../utils/SoundEffects', () => ({
  playClickSound: vi.fn(),
  playSuccessSound: vi.fn(),
  playErrorSound: vi.fn(),
  playPanelOpenSound: vi.fn(),
}));

const now = Date.now();

const makeTask = (overrides: Partial<Task>): Task => ({
  id: `task-${Math.random().toString(36).slice(2, 8)}`,
  title: 'Task',
  details: '',
  priority: 'high',
  status: 'todo',
  linkedSessionIds: [],
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const runningSession: XPSession = {
  id: 'session-running',
  taskId: 'task-running',
  title: 'Run focus',
  tag: 'HIGH',
  source: 'timer',
  linkedTaskIds: ['task-running'],
  startAt: now - 5 * 60 * 1000,
  endAt: now - 5 * 60 * 1000,
  durationMs: 0,
  accumulatedMs: 0,
  runningStartedAt: now - 5 * 60 * 1000,
  durationMinutes: 0,
  status: 'running',
  impactRating: 'normal',
  createdAt: now - 5 * 60 * 1000,
  updatedAt: now,
};

const buildXPMock = (tasks: Task[], initialActive: XPSession | null = runningSession) => {
  let activeSessionState: XPSession | null = initialActive;
  const startSession = vi.fn((payload: { title: string; tag: string; source: 'timer'; linkedTaskIds: string[] }) => {
    const taskId = payload.linkedTaskIds?.[0];
    activeSessionState = {
      id: `session-${Date.now()}`,
      taskId,
      title: payload.title,
      tag: payload.tag,
      source: payload.source,
      linkedTaskIds: payload.linkedTaskIds || [],
      startAt: Date.now(),
      endAt: Date.now(),
      durationMs: 0,
      accumulatedMs: 0,
      runningStartedAt: Date.now(),
      durationMinutes: 0,
      status: 'running',
      impactRating: 'normal',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (taskId) {
      const target = tasks.find((task) => task.id === taskId);
      if (target && target.status !== 'done') {
        target.status = 'active';
      }
    }
    return activeSessionState.id;
  });
  const pauseSession = vi.fn(() => {
    activeSessionState = null;
  });
  const completeTask = vi.fn((taskId: string) => {
    const target = tasks.find((task) => task.id === taskId);
    if (target) {
      target.status = 'done';
      target.completedAt = Date.now();
    }
  });

  return {
    tasks,
    selectors: {
      getActiveSession: () => activeSessionState,
      getSessionDisplayMs: () => 90_000,
    },
    addTask: vi.fn(),
    updateTask: vi.fn(),
    removeTask: vi.fn(),
    startSession,
    pauseSession,
    completeTask,
  };
};

describe('Quest modal interactions', () => {
  it('allows typing full text in title and notes without losing focus', async () => {
    const user = userEvent.setup();
    render(<QuestModal open task={null} onClose={vi.fn()} onSave={vi.fn()} />);

    const titleInput = screen.getByPlaceholderText('Quest title');
    await user.click(titleInput);
    await user.type(titleInput, 'hello world');

    expect(titleInput).toHaveValue('hello world');
    expect(titleInput).toHaveFocus();

    const notesInput = screen.getByPlaceholderText('Quest notes');
    await user.click(notesInput);
    await user.type(notesInput, 'multi line note');
    expect(notesInput).toHaveValue('multi line note');
    expect(notesInput).toHaveFocus();
  });

  it('persists steps via notes embedding after save and reopen', async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [open, setOpen] = useState(true);
      const [task, setTask] = useState<Task | null>(null);

      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            reopen
          </button>
          <QuestModal
            open={open}
            task={task}
            onClose={() => setOpen(false)}
            onSave={(draft) => {
              setTask(
                makeTask({
                  id: 'task-persist',
                  title: draft.title,
                  details: draft.details,
                  priority: draft.priority,
                  scheduledAt: draft.scheduledAt,
                })
              );
              setOpen(false);
            }}
          />
        </div>
      );
    };

    render(<Wrapper />);

    await user.type(screen.getByPlaceholderText('Quest title'), 'Persist quest');
    await user.type(screen.getByPlaceholderText('Quest notes'), 'Main note');

    const stepInput = screen.getByPlaceholderText('Add step');
    await user.type(stepInput, 'Step A');
    await user.click(screen.getByRole('button', { name: /add step/i }));

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await user.click(screen.getByRole('button', { name: /reopen/i }));

    expect(await screen.findByDisplayValue('Persist quest')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Quest notes')).toHaveValue('Main note');
    expect(screen.getByText('Step A')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('keeps schedule panel open while interacting with the time wheels', async () => {
    const user = userEvent.setup();
    render(<QuestModal open task={null} onClose={vi.fn()} onSave={vi.fn()} />);

    await user.click(screen.getByTestId('schedule-toggle'));
    const panel = screen.getByTestId('schedule-panel');
    expect(panel).toBeInTheDocument();

    await user.click(within(panel).getByTestId('schedule-picker-trigger'));

    const minuteWheel = screen.getByTestId('drum-min');
    fireEvent.wheel(minuteWheel, { deltaY: 200 });
    fireEvent.scroll(minuteWheel, { target: { scrollTop: 9 * 36 } });

    await waitFor(() => {
      expect(screen.getByTestId('schedule-panel')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('schedule-add'));
    expect(screen.getByTestId('schedule-value-preview').textContent).not.toContain('No schedule set');
  });
});

describe('Quests drawer filter + running section behavior', () => {
  beforeEach(() => {
    const tasks: Task[] = [
      makeTask({ id: 'task-running', title: 'Run focus', status: 'active' }),
      makeTask({ id: 'task-complete', title: 'Done quest', status: 'done', completedAt: now - 10_000 }),
      makeTask({ id: 'task-backlog', title: 'Backlog quest', status: 'todo' }),
    ];
    mockUseXP.mockReturnValue(buildXPMock(tasks));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens with Active filter selected', () => {
    render(<HextechAssistant isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Backlog quest')).toBeInTheDocument();
    expect(screen.queryByText('Done quest')).not.toBeInTheDocument();
    expect(screen.queryByText('No quests in this filter.')).not.toBeInTheDocument();
  });

  it('keeps running quest pinned while completed filter only shows completed rows below', async () => {
    const user = userEvent.setup();
    render(<HextechAssistant isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /completed/i }));

    expect(screen.getAllByText('Running').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Run focus').length).toBeGreaterThan(0);

    expect(screen.getByText('Done quest')).toBeInTheDocument();
    expect(screen.queryByText('Backlog quest')).not.toBeInTheDocument();
  });

  it('uses in-app confirm modal for running completion (no browser confirm)', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    const alertSpy = vi.spyOn(window, 'alert');

    render(<HextechAssistant isOpen onClose={vi.fn()} />);

    const completeButtons = screen.getAllByRole('button', { name: /complete quest/i });
    await user.click(completeButtons[0]);

    expect(screen.getByText('Quest is running')).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('pause + complete from confirm keeps drawer open and resolves running state', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<HextechAssistant isOpen onClose={onClose} />);

    await user.click(screen.getAllByRole('button', { name: /complete quest/i })[0]);
    expect(screen.getByText('Quest is running')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /pause \+ complete/i }));

    const xp = mockUseXP.mock.results.at(-1)?.value;
    expect(xp.pauseSession).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(xp.completeTask).toHaveBeenCalledWith('task-running', { source: 'manual_done' });
    });
    expect(xp.selectors.getActiveSession()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Quests')).toBeInTheDocument();
  });

  it('play button starts quest without opening workspace panel', async () => {
    const user = userEvent.setup();
    render(<HextechAssistant isOpen onClose={vi.fn()} />);

    const xp = mockUseXP.mock.results.at(-1)?.value;
    await user.click(screen.getAllByRole('button', { name: /start quest/i })[0]);

    expect(xp.startSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/quest workspace/i)).not.toBeInTheDocument();
  });

  it('clicking quest body opens focus workspace', async () => {
    const user = userEvent.setup();
    render(<HextechAssistant isOpen onClose={vi.fn()} />);

    await user.click(screen.getByText('Backlog quest'));
    expect(screen.getByText(/quest workspace/i)).toBeInTheDocument();
  });

  it('allows checklist toggle in focus mode without entering edit mode', async () => {
    const user = userEvent.setup();
    const tasks: Task[] = [
      makeTask({
        id: 'task-steps',
        title: 'Steps quest',
        details: `Focus details

---
[xstation_steps_v1]
{"steps":[{"text":"Step A","done":false},{"text":"Step B","done":false}]}
---`,
        status: 'active',
      }),
    ];
    const xp = buildXPMock(tasks, null);
    mockUseXP.mockReturnValue(xp);

    render(<HextechAssistant isOpen onClose={vi.fn()} />);

    await user.click(screen.getByText('Steps quest'));
    expect(screen.getByText(/quest workspace/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit quest/i })).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    await waitFor(() => {
      expect(xp.updateTask).toHaveBeenCalled();
    });
    expect(xp.updateTask.mock.calls[0][0]).toBe('task-steps');
    expect(xp.updateTask.mock.calls[0][1].details).toContain('"done": true');
  });

  it('asks before discarding unsaved create draft', async () => {
    const user = userEvent.setup();
    render(<HextechAssistant isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /add quest/i }));
    await user.type(screen.getByPlaceholderText('Quest title'), 'Unsaved draft');

    await user.click(screen.getByLabelText(/close focus workspace/i));
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /keep editing/i }));
    expect(screen.getByDisplayValue('Unsaved draft')).toBeInTheDocument();

    await user.click(screen.getByLabelText(/close focus workspace/i));
    await user.click(screen.getByRole('button', { name: /^discard$/i }));
    expect(screen.queryByText(/quest workspace/i)).not.toBeInTheDocument();
  });

  it('smoke: create quest with steps + schedule, start it, then complete it', async () => {
    const user = userEvent.setup();
    const tasks: Task[] = [makeTask({ id: 'task-a', title: 'Quest A', status: 'todo' })];
    const xp = buildXPMock(tasks, null);
    mockUseXP.mockReturnValue(xp);

    render(<HextechAssistant isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /add quest/i }));
    await user.type(screen.getByPlaceholderText('Quest title'), 'New Quest');
    await user.type(screen.getByPlaceholderText('Quest notes'), 'Primary notes');
    await user.type(screen.getByPlaceholderText('Add step'), 'First step');
    await user.click(screen.getByRole('button', { name: /add step/i }));
    await user.click(screen.getByRole('checkbox'));

    await user.click(screen.getByTestId('schedule-toggle'));
    const panel = screen.getByTestId('schedule-panel');
    await user.click(within(panel).getByTestId('schedule-picker-trigger'));
    await user.click(within(panel).getByRole('button', { name: 'Now' }));
    await user.click(screen.getByTestId('schedule-add'));

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(xp.addTask).toHaveBeenCalledTimes(1);
    const created = xp.addTask.mock.calls[0][0];
    expect(created.title).toBe('New Quest');
    expect(typeof created.scheduledAt).toBe('number');
    expect(created.details).toContain('[xstation_steps_v1]');
    expect(created.details).toContain('First step');

    await user.click(screen.getByRole('button', { name: /start quest/i }));
    expect(xp.startSession).toHaveBeenCalledTimes(1);

    await user.click(screen.getAllByRole('button', { name: /complete quest/i })[0]);
    await user.click(screen.getByRole('button', { name: /pause \+ complete/i }));

    await waitFor(() => {
      expect(xp.completeTask).toHaveBeenCalledWith('task-a', { source: 'manual_done' });
    });
  });
});
