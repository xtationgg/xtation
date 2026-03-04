import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useXP } from '../XP/xpStore';
import { Task } from '../XP/xpTypes';
import { ConfirmModal } from '../UI/ConfirmModal';
import { QuestCard } from '../Play/QuestCard';
import { QuestModal } from '../Play/QuestModal';
import { playClickSound, playSuccessSound } from '../../utils/SoundEffects';

interface HextechAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

type QuestFilter = 'all' | 'active' | 'completed';

const isCompletedTask = (task: Task) => !!task.completedAt || task.status === 'done';
const isHiddenTask = (task: Task) => !!task.archivedAt || task.status === 'dropped';

export const HextechAssistant: React.FC<HextechAssistantProps> = ({ isOpen, onClose }) => {
  const {
    tasks,
    selectors,
    addTask,
    updateTask,
    removeTask,
    startSession,
    pauseSession,
    completeTask,
  } = useXP();

  const [filter, setFilter] = useState<QuestFilter>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [confirmCompleteTaskId, setConfirmCompleteTaskId] = useState<string | null>(null);

  const [rendered, setRendered] = useState(isOpen);
  const [visible, setVisible] = useState(isOpen);

  const closeTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const actionLockedRef = useRef(false);

  const activeSession = selectors.getActiveSession();
  const runningTaskId = activeSession?.taskId || activeSession?.linkedTaskIds?.[0] || null;

  const availableTasks = useMemo(() => {
    return tasks
      .filter((task) => !isHiddenTask(task))
      .sort((a, b) => {
        const aCompleted = isCompletedTask(a) ? 1 : 0;
        const bCompleted = isCompletedTask(b) ? 1 : 0;
        if (aCompleted !== bCompleted) return aCompleted - bCompleted;
        return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
      });
  }, [tasks]);

  const runningTask = useMemo(
    () => availableTasks.find((task) => task.id === runningTaskId) || null,
    [availableTasks, runningTaskId]
  );

  const filteredTasks = useMemo(() => {
    const byFilter = availableTasks.filter((task) => {
      if (filter === 'active') return !isCompletedTask(task);
      if (filter === 'completed') return isCompletedTask(task);
      return true;
    });

    if (!runningTaskId) return byFilter;
    return byFilter.filter((task) => task.id !== runningTaskId);
  }, [availableTasks, filter, runningTaskId]);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      window.requestAnimationFrame(() => setVisible(true));
      return;
    }

    setVisible(false);
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setRendered(false);
      closeTimerRef.current = null;
    }, 210);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!rendered) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isCreateOpen || editingTaskId || confirmCompleteTaskId) return;
      event.preventDefault();
      requestClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [rendered, isCreateOpen, editingTaskId, confirmCompleteTaskId]);

  const runGuarded = (fn: () => void) => {
    if (actionLockedRef.current) return;
    actionLockedRef.current = true;
    try {
      fn();
    } finally {
      window.setTimeout(() => {
        actionLockedRef.current = false;
      }, 140);
    }
  };

  const pushToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2200);
  };

  const requestClose = () => {
    playClickSound();
    setIsCreateOpen(false);
    setEditingTaskId(null);
    setConfirmCompleteTaskId(null);
    onClose();
  };

  const openCreateModal = () => {
    playClickSound();
    setEditingTaskId(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (taskId: string) => {
    playClickSound();
    setIsCreateOpen(false);
    setEditingTaskId(taskId);
  };

  const closeQuestModal = () => {
    setIsCreateOpen(false);
    setEditingTaskId(null);
  };

  const handleSaveQuest = (draft: {
    title: string;
    details: string;
    priority: Task['priority'];
    scheduledAt?: number;
  }) => {
    if (!draft.title.trim()) {
      playErrorSound();
      return;
    }

    if (editingTaskId) {
      updateTask(editingTaskId, {
        title: draft.title,
        details: draft.details,
        priority: draft.priority,
        scheduledAt: draft.scheduledAt,
      });
    } else {
      addTask({
        title: draft.title,
        details: draft.details,
        priority: draft.priority,
        status: 'todo',
        scheduledAt: draft.scheduledAt,
        icon: 'sword',
      });
    }

    playSuccessSound();
    closeQuestModal();
  };

  const handleDeleteQuest = () => {
    if (!editingTaskId) return;
    removeTask(editingTaskId);
    closeQuestModal();
  };

  const handleToggleRun = (task: Task) => {
    if (isCompletedTask(task)) return;

    runGuarded(() => {
      const isRunningCurrent = runningTaskId === task.id && activeSession?.status === 'running';
      if (isRunningCurrent) {
        pauseSession();
        playClickSound();
        return;
      }

      if (runningTask && runningTask.id !== task.id) {
        pauseSession();
        pushToast(`Paused ${runningTask.title}`);
      }

      startSession({
        title: task.title,
        tag: task.priority.toUpperCase(),
        source: 'timer',
        linkedTaskIds: [task.id],
      });
      playSuccessSound();
    });
  };

  const handleComplete = (task: Task) => {
    if (isCompletedTask(task)) return;

    const runningThisTask =
      !!activeSession &&
      activeSession.status === 'running' &&
      (activeSession.taskId === task.id || (activeSession.linkedTaskIds || []).includes(task.id));

    if (runningThisTask) {
      setConfirmCompleteTaskId(task.id);
      return;
    }

    runGuarded(() => {
      completeTask(task.id, { source: 'manual_done' });
      playSuccessSound();
    });
  };

  const counts = useMemo(() => {
    const active = availableTasks.filter((task) => !isCompletedTask(task)).length;
    const completed = availableTasks.filter((task) => isCompletedTask(task)).length;
    return { all: availableTasks.length, active, completed };
  }, [availableTasks]);

  const modalTask = editingTaskId ? availableTasks.find((task) => task.id === editingTaskId) || null : null;
  const completeTarget = confirmCompleteTaskId
    ? availableTasks.find((task) => task.id === confirmCompleteTaskId) || null
    : null;

  if (!rendered) return null;

  return (
    <>
      <div className="fixed inset-0 z-[160]" data-quests-overlay="true" aria-hidden={!visible}>
        <button
          type="button"
          aria-label="Close quests drawer"
          onClick={requestClose}
          className={`absolute inset-0 bg-black/35 transition-opacity duration-200 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <aside
          className={`absolute right-0 top-0 h-[100dvh] border-l border-[var(--app-border)] bg-[var(--app-panel)] transition-transform duration-200 ease-out ${
            visible ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ width: 'clamp(320px, 34vw, 380px)' }}
        >
          <div className="flex h-full flex-col">
            <header className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">Quests</div>
              <button
                type="button"
                onClick={requestClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                aria-label="Close quests drawer"
              >
                <X size={16} />
              </button>
            </header>

            <div className="border-b border-[var(--app-border)] p-4">
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel-2))] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text)]"
              >
                <Plus size={16} />
                Add Quest
              </button>

              <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] p-1">
                {([
                  { key: 'all', label: 'All', count: counts.all },
                  { key: 'active', label: 'Active', count: counts.active },
                  { key: 'completed', label: 'Completed', count: counts.completed },
                ] as const).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setFilter(option.key);
                    }}
                    className={`h-8 rounded-lg border px-2 text-[10px] font-medium uppercase tracking-[0.1em] transition-colors ${
                      filter === option.key
                        ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] text-[var(--app-text)]'
                        : 'border-[color-mix(in_srgb,var(--app-border)_70%,transparent)] bg-transparent text-[var(--app-muted)] hover:text-[var(--app-text)]'
                    }`}
                  >
                    {option.label} ({option.count})
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {runningTask ? (
                <section className="mb-4">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--app-muted)]">Running</div>
                  <QuestCard
                    task={runningTask}
                    isRunning
                    runningSession={activeSession}
                    getSessionDisplayMs={selectors.getSessionDisplayMs}
                    onOpen={() => openEditModal(runningTask.id)}
                    onToggleRun={() => handleToggleRun(runningTask)}
                    onComplete={() => handleComplete(runningTask)}
                  />
                </section>
              ) : null}

              <section>
                <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--app-muted)]">Quest list</div>
                <div className="space-y-2">
                  {filteredTasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-panel-2)] p-4 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                      No quests in this filter.
                    </div>
                  ) : (
                    filteredTasks.map((task) => {
                      const isRunning =
                        !!activeSession &&
                        activeSession.status === 'running' &&
                        (activeSession.taskId === task.id || (activeSession.linkedTaskIds || []).includes(task.id));

                      return (
                        <QuestCard
                          key={task.id}
                          task={task}
                          isRunning={isRunning}
                          runningSession={isRunning ? activeSession : null}
                          getSessionDisplayMs={selectors.getSessionDisplayMs}
                          onOpen={() => openEditModal(task.id)}
                          onToggleRun={() => handleToggleRun(task)}
                          onComplete={() => handleComplete(task)}
                        />
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </div>
        </aside>

        {toastMessage ? (
          <div className="pointer-events-none absolute right-[calc(clamp(320px,34vw,380px)+16px)] top-4 rounded-lg border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_94%,black)] px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-text)]">
            {toastMessage}
          </div>
        ) : null}
      </div>

      <QuestModal
        open={isCreateOpen || !!editingTaskId}
        task={modalTask}
        onClose={closeQuestModal}
        onSave={handleSaveQuest}
        onDelete={editingTaskId ? handleDeleteQuest : undefined}
      />

      <ConfirmModal
        open={!!completeTarget}
        title="Quest is running"
        message="Pause and complete this quest?"
        confirmLabel="Pause + Complete"
        cancelLabel="Cancel"
        onCancel={() => setConfirmCompleteTaskId(null)}
        onConfirm={() => {
          if (!completeTarget) return;
          runGuarded(() => {
            const isRunningTarget =
              !!activeSession &&
              activeSession.status === 'running' &&
              (activeSession.taskId === completeTarget.id ||
                (activeSession.linkedTaskIds || []).includes(completeTarget.id));
            if (isRunningTarget) {
              pauseSession();
            }
            completeTask(completeTarget.id, { source: 'manual_done' });
            setConfirmCompleteTaskId(null);
            playSuccessSound();
          });
        }}
      />
    </>
  );
};
