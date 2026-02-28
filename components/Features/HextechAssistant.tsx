import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HexButton } from '../UI/HextechUI';
import { playClickSound, playErrorSound, playPanelOpenSound, playSuccessSound } from '../../utils/SoundEffects';
import { useXP } from '../XP/xpStore';
import { Task, TaskPriority, XPDayActivityGroup } from '../XP/xpTypes';
import { supabase } from '../../src/lib/supabaseClient';
import { useAuth } from '../../src/auth/AuthProvider';
import {
  Check,
  Clock,
  Edit2,
  Flag,
  Pause,
  Play,
  Shield,
  Square,
  Star,
  Sword,
  Terminal,
  X,
  Zap,
} from 'lucide-react';

interface HextechAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'active' | 'log';

interface TaskDraft {
  title: string;
  details: string;
  priority: TaskPriority;
  schedule: string;
  retroMinutes: number;
  retroNote: string;
}

const toLocalDateTimeInput = (timestamp: number) => {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(timestamp - offset).toISOString().slice(0, 16);
};

const formatMinutes = (seconds: number) => `${Math.max(0, Math.floor(seconds / 60))}m`;

const formatLogTime = (value: number) =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatScheduleState = (task: Task, now: number) => {
  if (!task.scheduledAt) return 'NO SCHEDULE';
  const diffMs = task.scheduledAt - now;
  if (diffMs <= 0) return 'READY';
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `IN ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
};

const getDateKeyFromTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getScheduleBadge = (scheduledAt: number | undefined, selectedDateKey: string) => {
  if (!scheduledAt) return 'No schedule';
  const taskDateKey = getDateKeyFromTimestamp(scheduledAt);
  if (taskDateKey === selectedDateKey) return 'Today';
  if (taskDateKey > selectedDateKey) return 'Future';
  return 'No schedule';
};

const buildDraft = (task: Task): TaskDraft => ({
  title: task.title,
  details: task.details || '',
  priority: task.priority,
  schedule: task.scheduledAt ? toLocalDateTimeInput(task.scheduledAt) : '',
  retroMinutes: 15,
  retroNote: '',
});

export const HextechAssistant: React.FC<HextechAssistantProps> = ({ isOpen, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [viewMode, setViewMode] = useState<ViewMode>('active');

  const [newTitle, setNewTitle] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('high');
  const [newSchedule, setNewSchedule] = useState('');
  const [newIcon, setNewIcon] = useState<Task['icon']>('sword');

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [editingLogTaskId, setEditingLogTaskId] = useState<string | null>(null);
  const [showHiddenInLog, setShowHiddenInLog] = useState(false);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskDraft>>({});
  const [supabasePingStatus, setSupabasePingStatus] = useState<string>('');

  const {
    dateKey,
    activeLogDateKey,
    authStatus,
    tasks,
    addTask,
    updateTask,
    completeTask,
    archiveTask,
    unarchiveTask,
    selectors,
    startSession,
    stopSession,
    pauseSession,
    resumeTaskSession,
    addRetroMinutes,
  } = useXP();
  const isSyncingCloud = authStatus === 'loadingCloud';

  useEffect(() => {
    if (isOpen) playPanelOpenSound();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Keep Quests open state predictable so active badge and list stay in sync.
    setViewMode('active');
    setExpandedTaskId(null);
    setEditingLogTaskId(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isOpen) return;
      const target = event.target as Element;
      const toggleBtn = document.getElementById('hextech-assistant-toggle');
      if (containerRef.current && containerRef.current.contains(target as Node)) return;
      if (toggleBtn && (toggleBtn === target || toggleBtn.contains(target as Node))) return;
      onClose();
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const activeSession = selectors.getActiveSession();
  const todayTrackedMinutes = selectors.getTrackedMinutesForDay(dateKey, now);
  const selectedLogDateKey = activeLogDateKey || dateKey;
  const dayActivityGroups = selectors.getDayActivityGrouped(selectedLogDateKey, now);
  const visibleTasks = useMemo(() => {
    const runningTaskIds = new Set<string>();
    if (activeSession?.taskId) runningTaskIds.add(activeSession.taskId);
    (activeSession?.linkedTaskIds || []).forEach((taskId) => runningTaskIds.add(taskId));

    const fromSelectors = selectors.getActiveTasks();
    const runningFallback = tasks.filter(
      (task) => !task.archivedAt && !task.completedAt && runningTaskIds.has(task.id)
    );
    const merged = [...fromSelectors, ...runningFallback].filter(
      (task, index, list) => list.findIndex((item) => item.id === task.id) === index
    );

    return merged
      .sort((a, b) => {
        const aRunning =
          !!activeSession &&
          (activeSession.taskId === a.id || (activeSession.linkedTaskIds || []).includes(a.id))
            ? 1
            : 0;
        const bRunning =
          !!activeSession &&
          (activeSession.taskId === b.id || (activeSession.linkedTaskIds || []).includes(b.id))
            ? 1
            : 0;
        if (aRunning !== bRunning) return bRunning - aRunning;
        return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
      });
  }, [selectors, activeSession, tasks]);
  const visibleLogGroups = useMemo(() => {
    if (showHiddenInLog) return dayActivityGroups;
    return dayActivityGroups.filter((group) => {
      if (!group.taskId) return true;
      const task = tasks.find((item) => item.id === group.taskId);
      return !task?.archivedAt;
    });
  }, [dayActivityGroups, showHiddenInLog, tasks]);

  useEffect(() => {
    if (showHiddenInLog) return;
    if (!editingLogTaskId) return;
    const editedTask = tasks.find((task) => task.id === editingLogTaskId);
    if (editedTask?.archivedAt) {
      setEditingLogTaskId(null);
    }
  }, [editingLogTaskId, showHiddenInLog, tasks]);

  const ensureDraft = (task: Task) => {
    setTaskDrafts((prev) => (prev[task.id] ? prev : { ...prev, [task.id]: buildDraft(task) }));
  };

  const updateDraft = (taskId: string, patch: Partial<TaskDraft>) => {
    setTaskDrafts((prev) => {
      const current = prev[taskId];
      if (!current) return prev;
      return {
        ...prev,
        [taskId]: { ...current, ...patch },
      };
    });
  };

  const resetCreateForm = () => {
    setNewTitle('');
    setNewDetails('');
    setNewPriority('high');
    setNewSchedule('');
    setNewIcon('sword');
  };

  const addQuest = () => {
    if (isSyncingCloud) return;
    if (!newTitle.trim()) {
      playErrorSound();
      return;
    }
    const scheduleTimestamp = newSchedule ? new Date(newSchedule).getTime() : undefined;
    addTask({
      title: newTitle.trim(),
      details: newDetails.trim(),
      priority: newPriority,
      status: 'todo',
      scheduledAt: scheduleTimestamp,
      icon: newIcon,
    });
    resetCreateForm();
    playSuccessSound();
  };

  const completeQuest = (task: Task) => {
    if (isSyncingCloud) return;
    completeTask(task.id, {
      source: 'manual_done',
    });
    if (expandedTaskId === task.id) setExpandedTaskId(null);
    playSuccessSound();
  };

  const saveInlineEdit = (task: Task) => {
    if (isSyncingCloud) return;
    const draft = taskDrafts[task.id];
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) {
      playErrorSound();
      return;
    }
    updateTask(task.id, {
      title,
      details: draft.details.trim(),
      priority: draft.priority,
      scheduledAt: draft.schedule ? new Date(draft.schedule).getTime() : undefined,
    });
    setExpandedTaskId(null);
    playSuccessSound();
  };

  const saveLogEdit = (task: Task) => {
    if (isSyncingCloud) return;
    const draft = taskDrafts[task.id];
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) {
      playErrorSound();
      return;
    }
    updateTask(task.id, {
      title,
      details: draft.details.trim(),
      priority: draft.priority,
      scheduledAt: draft.schedule ? new Date(draft.schedule).getTime() : undefined,
      completedAt: undefined,
      completedDateKey: undefined,
      status: 'todo',
    });
    if (task.archivedAt) {
      unarchiveTask(task.id);
    }
    setEditingLogTaskId(null);
    setViewMode('active');
    playSuccessSound();
  };

  const cancelInlineEdit = (task: Task) => {
    setTaskDrafts((prev) => ({
      ...prev,
      [task.id]: buildDraft(task),
    }));
    setExpandedTaskId(null);
    playClickSound();
  };

  const cancelLogEdit = (task: Task) => {
    setTaskDrafts((prev) => ({
      ...prev,
      [task.id]: buildDraft(task),
    }));
    setEditingLogTaskId(null);
    playClickSound();
  };

  const addInlineRetro = (task: Task) => {
    if (isSyncingCloud) return;
    const draft = taskDrafts[task.id];
    if (!draft) return;
    const minutes = Math.max(0, Math.floor(draft.retroMinutes));
    if (!minutes) {
      playErrorSound();
      return;
    }
    addRetroMinutes(task.id, minutes, draft.retroNote);
    updateDraft(task.id, { retroMinutes: 15, retroNote: '' });
    playSuccessSound();
  };

  const onTaskStart = (task: Task) => {
    if (isSyncingCloud) return;
    const existing = selectors.getTaskSessions(task.id);
    if (existing.length > 0) {
      resumeTaskSession(task.id);
      return;
    }
    startSession({
      title: task.title,
      tag: task.priority.toUpperCase(),
      source: 'timer',
      linkedTaskIds: [task.id],
    });
  };

  const handleSupabasePing = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      console.log('[supabase] getSession result:', data);
      setSupabasePingStatus('Supabase OK');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[supabase] getSession error:', error);
      setSupabasePingStatus(`Supabase error: ${message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      data-quests-overlay="true"
      className="absolute top-[60px] right-2 sm:right-4 md:right-[24px] w-[calc(100vw-16px)] sm:w-[420px] max-w-[420px] z-50 animate-fade-in font-mono origin-top-right"
    >
      <div className="relative rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--app-bg)_90%,transparent)] backdrop-blur-xl shadow-[0_24px_55px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_0%,color-mix(in_srgb,var(--app-accent)_12%,transparent),transparent_55%)] opacity-70" />
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,transparent_40%)]" />

        <div className="relative">
          <div className="px-4 py-3 border-b border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-gradient-to-r from-[var(--app-panel)] via-[var(--app-panel-2)] to-[var(--app-panel)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] flex items-center justify-center shadow-[inset_0_0_12px_rgba(255,255,255,0.06)]">
                <Terminal size={16} className="text-[var(--app-text)]" />
              </div>
              <span className="text-xs uppercase tracking-[0.28em] text-[var(--app-text)] font-bold">Quests</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] overflow-hidden">
                <button
                  onClick={() => {
                    playClickSound();
                    setViewMode('active');
                  }}
                  className={`px-3 py-1 text-[9px] uppercase tracking-[0.28em] transition ${
                    viewMode === 'active'
                      ? 'bg-[color-mix(in_srgb,var(--app-accent)_20%,transparent)] text-[var(--app-text)]'
                      : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => {
                    playClickSound();
                    setViewMode('log');
                  }}
                  className={`px-3 py-1 text-[9px] uppercase tracking-[0.28em] transition ${
                    viewMode === 'log'
                      ? 'bg-[color-mix(in_srgb,var(--app-accent)_20%,transparent)] text-[var(--app-text)]'
                      : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                  }`}
                >
                  Log
                </button>
              </div>
              <button
                onClick={() => {
                  playClickSound();
                  onClose();
                }}
                className="w-8 h-8 rounded-lg border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[var(--app-muted)] hover:text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-text)_30%,transparent)] transition-colors"
                aria-label="Close"
              >
                <X size={14} className="mx-auto" />
              </button>
            </div>
          </div>

          {viewMode === 'active' && (
            <div className="px-4 py-4 border-b border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)]">
              <div className="grid gap-3">
                {isSyncingCloud ? (
                  <div className="text-[9px] uppercase tracking-[0.22em] text-[var(--app-accent)]">Syncing...</div>
                ) : null}
                <input
                  type="text"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="ENTER_DIRECTIVE..."
                  className="w-full bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] p-2 text-[10px] text-[var(--app-text)] placeholder-[var(--app-muted)] focus:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] focus:outline-none uppercase"
                />
                <textarea
                  value={newDetails}
                  onChange={(event) => setNewDetails(event.target.value)}
                  placeholder="DETAILS / NOTES..."
                  className="w-full bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] p-2 text-[10px] text-[var(--app-text)] placeholder-[var(--app-muted)] focus:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] focus:outline-none uppercase min-h-[60px]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newPriority}
                    onChange={(event) => setNewPriority(event.target.value as TaskPriority)}
                    className="bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[9px] text-[var(--app-text)] p-2 focus:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] outline-none uppercase"
                  >
                    <option value="normal">Prio: Normal</option>
                    <option value="high">Prio: High</option>
                    <option value="urgent">Prio: Urgent</option>
                  </select>
                  <input
                    type="datetime-local"
                    value={newSchedule}
                    onChange={(event) => setNewSchedule(event.target.value)}
                    className="w-full bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[9px] text-[var(--app-text)] p-2 focus:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] outline-none [color-scheme:dark]"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {(['sword', 'shield', 'star', 'zap', 'flag'] as const).map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setNewIcon(icon);
                      }}
                      className={`p-1.5 rounded-md border transition-all ${
                        newIcon === icon
                          ? 'bg-[var(--app-text)] text-[var(--app-bg)] border-[var(--app-text)]'
                          : 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[var(--app-muted)] hover:border-[color-mix(in_srgb,var(--app-text)_30%,transparent)]'
                      }`}
                    >
                      <MissionIcon icon={icon} size={12} />
                    </button>
                  ))}
                </div>
                <HexButton
                  onClick={addQuest}
                  disabled={isSyncingCloud}
                  className="w-full py-2 text-[10px] border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] hover:bg-[var(--app-accent)] hover:border-[var(--app-accent)]"
                  variant="primary"
                >
                  Add Quest
                </HexButton>
              </div>
            </div>
          )}

          {viewMode === 'log' && (
            <div className="px-4 py-2 border-b border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] flex items-center justify-between gap-2">
              <span className="text-[var(--app-muted)] text-[9px] font-bold tracking-[0.35em] uppercase">
                Log: {selectedLogDateKey}
              </span>
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setShowHiddenInLog((prev) => !prev);
                }}
                className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[9px] uppercase tracking-[0.2em] text-[var(--app-muted)] hover:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)]"
              >
                {showHiddenInLog ? 'Hide Hidden' : 'Show Hidden'}
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar min-h-[200px] max-h-[420px]">
            {viewMode === 'active' ? (
              visibleTasks.length === 0 ? (
                <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] p-4 text-center">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--app-muted)]">No active quests</div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--app-muted)] mt-1">
                    Add a quest to start tracking time
                  </div>
                </div>
              ) : (
                visibleTasks.map((task) => {
                  const runningForTask =
                    !!activeSession &&
                    activeSession.status === 'running' &&
                    (activeSession.taskId === task.id || (activeSession.linkedTaskIds || []).includes(task.id));
                  const runningSeconds = runningForTask
                    ? Math.floor(selectors.getSessionDisplayMs(activeSession!, now) / 1000)
                    : 0;
                  const daySeconds = Math.floor(selectors.getTaskTodayMs(task.id, dateKey, now) / 1000);
                  const draft = taskDrafts[task.id] || buildDraft(task);
                  const hasSessions = selectors.getTaskSessions(task.id).length > 0;
                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      selectedDateKey={dateKey}
                      now={now}
                      isRunning={runningForTask}
                      daySeconds={daySeconds}
                      runningSeconds={runningSeconds}
                      controlsDisabled={isSyncingCloud}
                      isExpanded={expandedTaskId === task.id}
                      draft={draft}
                      hasSessions={hasSessions}
                      onExpand={() => {
                        playClickSound();
                        if (expandedTaskId === task.id) {
                          setExpandedTaskId(null);
                          return;
                        }
                        ensureDraft(task);
                        setExpandedTaskId(task.id);
                      }}
                      onDraftChange={(patch) => updateDraft(task.id, patch)}
                      onSave={() => saveInlineEdit(task)}
                      onCancel={() => cancelInlineEdit(task)}
                      onAddRetro={() => addInlineRetro(task)}
                      onStart={() => onTaskStart(task)}
                      onPause={() => pauseSession()}
                      onStop={() => stopSession()}
                      onDone={() => completeQuest(task)}
                    />
                  );
                })
              )
            ) : visibleLogGroups.length === 0 ? (
              <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] p-4 text-center">
                <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--app-muted)]">No quest history yet</div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--app-muted)] mt-1">
                  Activity from sessions, completions, and retro logs appears here
                </div>
              </div>
            ) : (
              visibleLogGroups.map((group) => (
                (() => {
                  const groupTask = group.taskId ? tasks.find((task) => task.id === group.taskId) : undefined;
                  const logDraft = groupTask ? taskDrafts[groupTask.id] || buildDraft(groupTask) : undefined;
                  return (
                    <QuestLogRow
                      key={group.key}
                      group={group}
                      task={groupTask}
                      isEditing={!!groupTask && editingLogTaskId === groupTask.id}
                      draft={logDraft}
                      onDraftChange={
                        groupTask
                          ? (patch) => updateDraft(groupTask.id, patch)
                          : undefined
                      }
                      onStartEdit={
                        groupTask
                          ? () => {
                              playClickSound();
                              ensureDraft(groupTask);
                              setEditingLogTaskId((prev) => (prev === groupTask.id ? null : groupTask.id));
                            }
                          : undefined
                      }
                      onSaveEdit={
                        groupTask
                          ? () => saveLogEdit(groupTask)
                          : undefined
                      }
                      onCancelEdit={
                        groupTask
                          ? () => cancelLogEdit(groupTask)
                          : undefined
                      }
                      onToggleHidden={
                        groupTask
                          ? () => {
                              if (groupTask.archivedAt) {
                                if (!showHiddenInLog) return;
                                unarchiveTask(groupTask.id);
                                return;
                              }
                              archiveTask(groupTask.id);
                              setShowHiddenInLog(false);
                              setEditingLogTaskId((prev) => (prev === groupTask.id ? null : prev));
                            }
                          : undefined
                      }
                      showHiddenMode={showHiddenInLog}
                    />
                  );
                })()
              ))
            )}
          </div>

          <div className="px-4 py-2 border-t border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel)] flex justify-end items-center text-[9px] text-[var(--app-muted)] uppercase tracking-[0.28em]">
            <div className="flex items-center gap-2 text-[9px] tracking-normal">
              {import.meta.env.DEV && (
                <>
                  <button
                    type="button"
                    onClick={handleSupabasePing}
                    className="px-2 py-1 border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[9px] text-[var(--app-text)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] transition-colors"
                  >
                    SUPABASE PING
                  </button>
                  <span className="text-[9px] tracking-normal normal-case text-[var(--app-muted)] max-w-[160px] truncate">
                    {supabasePingStatus || 'idle'}
                  </span>
                  <span className="text-[9px] tracking-normal normal-case text-[var(--app-muted)] max-w-[200px] truncate">
                    {user?.email ? `Signed in as ${user.email}` : 'Not signed in'}
                  </span>
                </>
              )}
              <span className="uppercase tracking-[0.28em]">Today: {todayTrackedMinutes}m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MissionIcon: React.FC<{ icon?: Task['icon']; size?: number; className?: string }> = ({
  icon,
  size = 16,
  className = '',
}) => {
  switch (icon) {
    case 'sword':
      return <Sword size={size} className={className} />;
    case 'shield':
      return <Shield size={size} className={className} />;
    case 'star':
      return <Star size={size} className={className} />;
    case 'zap':
      return <Zap size={size} className={className} />;
    case 'flag':
      return <Flag size={size} className={className} />;
    default:
      return <Flag size={size} className={className} />;
  }
};

const TaskCard: React.FC<{
  task: Task;
  selectedDateKey: string;
  now: number;
  isRunning: boolean;
  daySeconds: number;
  runningSeconds: number;
  controlsDisabled: boolean;
  isExpanded: boolean;
  draft: TaskDraft;
  hasSessions: boolean;
  onExpand: () => void;
  onDraftChange: (patch: Partial<TaskDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddRetro: () => void;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onDone: () => void;
}> = ({
  task,
  selectedDateKey,
  now,
  isRunning,
  daySeconds,
  runningSeconds,
  controlsDisabled,
  isExpanded,
  draft,
  hasSessions,
  onExpand,
  onDraftChange,
  onSave,
  onCancel,
  onAddRetro,
  onStart,
  onPause,
  onStop,
  onDone,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const scheduleState = formatScheduleState(task, now);
  const statusLabel = isRunning ? 'RUNNING' : task.status.toUpperCase();
  const railVisible = isExpanded || isHovered;
  const actionDisabled = controlsDisabled;
  const scheduleBadge = getScheduleBadge(task.scheduledAt, selectedDateKey);
  const hideRailAnd = (action: () => void) => {
    setIsHovered(false);
    action();
  };
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden rounded-xl border px-3 py-3 transition-all ${
        isRunning
          ? 'border-[color-mix(in_srgb,var(--app-accent)_60%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--app-accent)_50%,transparent)] shadow-[0_0_24px_rgba(168,85,247,0.32)]'
          : 'border-[color-mix(in_srgb,var(--app-text)_15%,transparent)] bg-[var(--app-panel-2)]'
      } ${railVisible && !isExpanded ? 'pr-[210px]' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg border border-[color-mix(in_srgb,var(--app-text)_30%,transparent)] flex items-center justify-center shrink-0 text-[color-mix(in_srgb,var(--app-text)_90%,transparent)]">
          <MissionIcon icon={task.icon} size={14} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--app-muted)]">Priority: {task.priority}</div>
            <span className="text-[8px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded border border-[color-mix(in_srgb,var(--app-text)_15%,transparent)] text-[var(--app-muted)]">
              {scheduleBadge}
            </span>
          </div>
          <h4 className="font-bold text-[11px] truncate uppercase text-[var(--app-text)]">{task.title}</h4>
          <div className="mt-1 flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
            <Clock size={10} />
            <span>{scheduleState}</span>
            <span>·</span>
            <span>{statusLabel}</span>
            <span>·</span>
            <span>Day {formatMinutes(daySeconds)}</span>
            {isRunning ? (
              <>
                <span>·</span>
                <span className="text-violet-300">Live {formatMinutes(runningSeconds)}</span>
              </>
            ) : null}
          </div>
        </div>

        {isRunning ? (
          <div className="pl-3 border-l border-violet-300/30 min-w-[120px] text-right">
            <div className="text-[9px] uppercase tracking-[0.2em] text-violet-200">Running</div>
            <div className="text-2xl font-semibold tracking-[0.14em] text-[var(--app-text)]">{formatMinutes(daySeconds)}</div>
          </div>
        ) : null}
      </div>

      {!isExpanded ? (
        <div
          className={`absolute top-0 right-0 h-full flex items-center bg-[var(--app-bg)] border-l border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] transition-all duration-200 z-20 ${
            railVisible ? 'translate-x-0 opacity-100 pointer-events-auto' : 'translate-x-full opacity-0 pointer-events-none'
          }`}
        >
          {!isRunning ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                hideRailAnd(onStart);
              }}
              disabled={actionDisabled}
              className="h-full px-3 hover:bg-[var(--app-text)] hover:text-[var(--app-bg)] transition-colors"
              title={hasSessions ? 'Resume session' : 'Start session'}
            >
              <Play size={14} />
            </button>
          ) : (
            <>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  hideRailAnd(onPause);
                }}
                disabled={actionDisabled}
                className="h-full px-3 hover:bg-[var(--app-text)] hover:text-[var(--app-bg)] transition-colors border-l border-[color-mix(in_srgb,var(--app-text)_10%,transparent)]"
                title="Pause session"
              >
                <Pause size={14} />
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  hideRailAnd(onStop);
                }}
                disabled={actionDisabled}
                className="h-full px-3 hover:bg-[var(--app-text)] hover:text-[var(--app-bg)] transition-colors border-l border-[color-mix(in_srgb,var(--app-text)_10%,transparent)]"
                title="Stop session"
              >
                <Square size={14} />
              </button>
            </>
          )}

          <button
            onClick={(event) => {
              event.stopPropagation();
              hideRailAnd(onDone);
            }}
            disabled={actionDisabled}
            className="h-full px-3 hover:bg-[var(--app-text)] hover:text-[var(--app-bg)] transition-colors border-l border-[color-mix(in_srgb,var(--app-text)_10%,transparent)]"
            title="Complete quest"
          >
            <Check size={14} />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onExpand();
            }}
            className="h-full px-3 hover:bg-[var(--app-text)] hover:text-[var(--app-bg)] transition-colors border-l border-[color-mix(in_srgb,var(--app-text)_10%,transparent)]"
            title="Edit quest"
          >
            <Edit2 size={14} />
          </button>
        </div>
      ) : null}

      {isExpanded ? (
        <div className="mt-3 pt-3 border-t border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] space-y-2 animate-fade-in">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => hideRailAnd(onSave)}
              className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[9px] uppercase tracking-[0.2em] text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)]"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => hideRailAnd(onCancel)}
              className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[9px] uppercase tracking-[0.2em] text-[var(--app-muted)] hover:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => hideRailAnd(onDone)}
              disabled={actionDisabled}
              className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[9px] uppercase tracking-[0.2em] text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)]"
            >
              Done
            </button>
          </div>
          <input
            value={draft.title}
            onChange={(event) => onDraftChange({ title: event.target.value })}
            className="w-full bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] p-2 text-[10px] text-[var(--app-text)] placeholder-[var(--app-muted)] focus:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] focus:outline-none uppercase"
            placeholder="Quest title"
          />
          <textarea
            value={draft.details}
            onChange={(event) => onDraftChange({ details: event.target.value })}
            className="w-full bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] p-2 text-[10px] text-[var(--app-text)] placeholder-[var(--app-muted)] focus:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] focus:outline-none uppercase min-h-[56px]"
            placeholder="Details / notes"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={draft.priority}
              onChange={(event) => onDraftChange({ priority: event.target.value as TaskPriority })}
              className="bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[9px] text-[var(--app-text)] p-2 focus:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] outline-none uppercase"
            >
              <option value="normal">Prio: Normal</option>
              <option value="high">Prio: High</option>
              <option value="urgent">Prio: Urgent</option>
            </select>
            <input
              type="datetime-local"
              value={draft.schedule}
              onChange={(event) => onDraftChange({ schedule: event.target.value })}
              className="w-full bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[9px] text-[var(--app-text)] p-2 focus:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] outline-none [color-scheme:dark]"
            />
          </div>
          <div className="grid grid-cols-[120px,1fr,100px] gap-2">
            <input
              type="number"
              min={1}
              value={draft.retroMinutes}
              onChange={(event) => onDraftChange({ retroMinutes: Number(event.target.value) || 0 })}
              className="bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[10px] text-[var(--app-text)] p-2 focus:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] outline-none"
              placeholder="Minutes"
            />
            <input
              value={draft.retroNote}
              onChange={(event) => onDraftChange({ retroNote: event.target.value })}
              className="bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[10px] text-[var(--app-text)] p-2 focus:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] outline-none"
              placeholder="Retro note (optional)"
            />
            <button
              type="button"
              onClick={onAddRetro}
              className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-accent)_40%,transparent)] text-[9px] uppercase tracking-[0.2em] text-[var(--app-accent)]"
            >
              Add Retro
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const QuestLogRow: React.FC<{
  group: XPDayActivityGroup;
  task?: Task;
  isEditing?: boolean;
  showHiddenMode?: boolean;
  draft?: TaskDraft;
  onDraftChange?: (patch: Partial<TaskDraft>) => void;
  onStartEdit?: () => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  onToggleHidden?: () => void;
}> = ({
  group,
  task,
  isEditing = false,
  showHiddenMode = false,
  draft,
  onDraftChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleHidden,
}) => {
  const statusLabel = group.hasCompletion
    ? group.totalMinutes > 0
      ? 'COMPLETED'
      : 'COMPLETED (NO TIME)'
    : group.hasRunning
      ? 'RUNNING'
      : group.hasRetro && !group.hasSession
        ? 'RETRO'
        : group.hasCreated
          ? group.latestStatusLabel
          : 'TRACKED';
  const detailLabel = `${group.totalMinutes}m total · ${group.entries.length} entries`;
  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[var(--app-panel-2)] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--app-text)] truncate">{group.title}</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-[var(--app-muted)] mt-1 flex items-center gap-2">
            <span>{statusLabel}</span>
            <span>·</span>
            <span>{detailLabel}</span>
            <span>·</span>
            <span>{formatLogTime(group.latestAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {task && onStartEdit ? (
            <button
              type="button"
              onClick={onStartEdit}
              className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[9px] uppercase tracking-[0.2em] text-[var(--app-muted)] hover:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)]"
              title="Edit quest"
            >
              {isEditing ? 'Close' : 'Edit'}
            </button>
          ) : null}
          {task && onToggleHidden ? (
            task.archivedAt && !showHiddenMode ? null : (
              <button
                type="button"
                onClick={onToggleHidden}
                className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[9px] uppercase tracking-[0.2em] text-[var(--app-muted)] hover:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)]"
                title={task.archivedAt ? 'Unhide quest' : 'Hide quest'}
              >
                {task.archivedAt ? 'Unhide' : 'Hide'}
              </button>
            )
          ) : null}
        </div>
      </div>
      {task && draft && isEditing && onDraftChange && onSaveEdit && onCancelEdit ? (
        <div className="mt-3 pt-3 border-t border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] space-y-2 animate-fade-in">
          <input
            value={draft.title}
            onChange={(event) => onDraftChange({ title: event.target.value })}
            className="w-full bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] p-2 text-[10px] text-[var(--app-text)] placeholder-[var(--app-muted)] focus:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] focus:outline-none uppercase"
            placeholder="Quest title"
          />
          <textarea
            value={draft.details}
            onChange={(event) => onDraftChange({ details: event.target.value })}
            className="w-full bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] p-2 text-[10px] text-[var(--app-text)] placeholder-[var(--app-muted)] focus:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] focus:outline-none uppercase min-h-[56px]"
            placeholder="Details / notes"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={draft.priority}
              onChange={(event) => onDraftChange({ priority: event.target.value as TaskPriority })}
              className="bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[9px] text-[var(--app-text)] p-2 focus:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] outline-none uppercase"
            >
              <option value="normal">Prio: Normal</option>
              <option value="high">Prio: High</option>
              <option value="urgent">Prio: Urgent</option>
            </select>
            <input
              type="datetime-local"
              value={draft.schedule}
              onChange={(event) => onDraftChange({ schedule: event.target.value })}
              className="w-full bg-[var(--app-panel-2)] border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-[9px] text-[var(--app-text)] p-2 focus:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)] outline-none [color-scheme:dark]"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[9px] uppercase tracking-[0.2em] text-[var(--app-muted)] hover:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              className="px-2 py-1 rounded border border-[color-mix(in_srgb,var(--app-text)_20%,transparent)] text-[9px] uppercase tracking-[0.2em] text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-text)_40%,transparent)]"
            >
              Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
