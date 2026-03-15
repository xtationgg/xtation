import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FolderKanban,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { QuestModal } from '../Play/QuestModal';
import { QuestDebriefPanel } from '../Play/QuestDebriefPanel';
import { useXP } from '../XP/xpStore';
import type { Project, QuestLevel, SelfTreeBranch, Task } from '../XP/xpTypes';
import { ClientView } from '../../types';
import { useXtationSettings } from '../../src/settings/SettingsProvider';
import type { XtationOnboardingHandoff } from '../../src/onboarding/storage';
import {
  buildStarterSessionLiveTransition,
  buildStarterWorkspaceCue,
  buildStarterWorkspaceRoute,
  openStarterWorkspaceCue,
  type XtationStarterSessionLiveTransition,
} from '../../src/onboarding/workspaceCue';
import {
  buildStarterCheckpointStatus,
  buildStarterRelayPhase,
  hasStarterCheckpointLanded,
} from '../../src/onboarding/starterCheckpoint';
import {
  encodeQuestNotesWithSteps,
  getQuestStepCounts,
  parseQuestNotesAndSteps,
} from '../../src/lib/quests/steps';
import { openDuskBrief } from '../../src/dusk/bridge';
import { useLatestDuskBrief } from '../../src/dusk/useLatestDuskBrief';
import { useOptionalPresentationEvents } from '../../src/presentation/PresentationEventsProvider';
import { resolveUrgentPresentationSignal } from '../../src/presentation/urgentSignal';
import type { StationIdentitySummary } from '../../src/station/stationIdentity';
import {
  clearPendingPlayNavigation,
  PLAY_NAVIGATION_EVENT,
  readPendingPlayNavigation,
  type PlayNavigationPayload,
} from '../../src/play/bridge';

const PRIORITY_ORDER: Record<Task['priority'], number> = {
  urgent: 0,
  high: 1,
  normal: 2,
};

const PRIORITY_LABELS: Record<Task['priority'], string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
};

const QUEST_TYPE_LABELS: Record<string, string> = {
  session: 'Session',
  instant: 'Instant',
  scheduled: 'Scheduled',
};

const LEVEL_LABELS: Record<QuestLevel, string> = {
  1: 'Standard',
  2: 'Focused',
  3: 'Priority',
  4: 'Critical',
};

const SELF_TREE_LABELS: Record<string, string> = {
  Knowledge: 'Knowledge',
  Creation: 'Creation',
  Systems: 'Systems',
  Communication: 'Communication',
  Physical: 'Physical',
  Inner: 'Inner',
};

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const formatAbsoluteDate = (ts?: number): string => {
  if (!ts) return 'No schedule';
  return new Date(ts).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRelativeSchedule = (ts: number, now: number): string => {
  const diffMs = ts - now;
  const absMinutes = Math.max(0, Math.round(Math.abs(diffMs) / 60000));
  if (diffMs > 0) {
    if (absMinutes < 60) return `Starts in ${absMinutes} min`;
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    return `Starts in ${hours}h ${minutes}m`;
  }
  if (absMinutes < 15) return 'In the current window';
  if (absMinutes < 60) return `${absMinutes} min late`;
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  return `${hours}h ${minutes}m late`;
};

const shortText = (value: string, fallback: string, max = 110) => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > max ? `${trimmed.slice(0, max - 3)}...` : trimmed;
};

const isRunningTask = (task: Task, activeSessionTaskIds: Set<string>) => activeSessionTaskIds.has(task.id);

const getProjectCompletion = (project: Project | null, tasks: Task[]) => {
  if (!project) return null;
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  if (!projectTasks.length) {
    return {
      total: 0,
      done: 0,
      pct: 0,
    };
  }
  const done = projectTasks.filter((task) => task.status === 'done' || !!task.completedAt).length;
  return {
    total: projectTasks.length,
    done,
    pct: Math.round((done / projectTasks.length) * 100),
  };
};

const pickDefaultTaskId = (tasks: Task[], activeSessionTaskIds: Set<string>, now: number): string | null => {
  if (!tasks.length) return null;
  const sorted = [...tasks].sort((a, b) => {
    const aRunning = isRunningTask(a, activeSessionTaskIds) ? 1 : 0;
    const bRunning = isRunningTask(b, activeSessionTaskIds) ? 1 : 0;
    if (aRunning !== bRunning) return bRunning - aRunning;

    const aScheduled = typeof a.scheduledAt === 'number' ? a.scheduledAt : Number.POSITIVE_INFINITY;
    const bScheduled = typeof b.scheduledAt === 'number' ? b.scheduledAt : Number.POSITIVE_INFINITY;
    const aScheduleScore = aScheduled >= now ? aScheduled : Number.NEGATIVE_INFINITY;
    const bScheduleScore = bScheduled >= now ? bScheduled : Number.NEGATIVE_INFINITY;
    if (aScheduleScore !== bScheduleScore) return aScheduleScore - bScheduleScore;

    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
  });
  return sorted[0]?.id ?? null;
};

const SummaryCell: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div className="xt-play-summary-cell">
    <div className={`xt-play-summary-value ${accent || 'text-[var(--app-text)]'}`}>{value}</div>
    <div className="xt-play-summary-label">{label}</div>
  </div>
);

const PlayActionButton: React.FC<{
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  tone?: 'default' | 'accent' | 'success' | 'muted';
  disabled?: boolean;
}> = ({ label, onClick, icon, tone = 'default', disabled = false }) => (
  <button
    type="button"
    onClick={onClick}
    className="xt-play-action ui-pressable"
    data-tone={tone}
    disabled={disabled}
  >
    {icon ? <span className="xt-play-action-icon">{icon}</span> : null}
    <span>{label}</span>
  </button>
);

const PlayPanel: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, action, children }) => (
  <section className="xt-play-panel">
    <div className="xt-play-panel-header">
      <div className="min-w-0">
        <div className="xt-play-panel-eyebrow">{title}</div>
        {subtitle ? <div className="xt-play-panel-subtitle">{subtitle}</div> : null}
      </div>
      {action ? <div className="xt-play-panel-actions">{action}</div> : null}
    </div>
    {children}
  </section>
);

interface PlayProps {
  onOpenGuidedSetup?: () => void;
  onOpenWorkspace?: (view: ClientView) => void;
  onboardingHandoff?: XtationOnboardingHandoff | null;
  onDismissOnboardingHandoff?: () => void;
  stationIdentity?: StationIdentitySummary | null;
  onStarterSessionLive?: (transition: XtationStarterSessionLiveTransition) => void;
}

export const Play: React.FC<PlayProps> = ({
  onOpenGuidedSetup,
  onOpenWorkspace,
  onboardingHandoff = null,
  onDismissOnboardingHandoff,
  stationIdentity = null,
  onStarterSessionLive,
}) => {
  const {
    now,
    dateKey,
    tasks,
    projects,
    milestones,
    stats,
    selectors,
    completions,
    sessions,
    addTask,
    updateTask,
    completeTask,
    resumeTaskSession,
    stopSession,
    pauseSession,
  } = useXP();
  const { settings } = useXtationSettings();
  const latestBrief = useLatestDuskBrief();
  const presentationEvents = useOptionalPresentationEvents();
  const previousSessionKeyRef = useRef<string | null>(null);
  const urgentSignalKeyRef = useRef<string | null>(null);
  const starterSessionLiveKeyRef = useRef<string | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [debriefTaskId, setDebriefTaskId] = useState<string | null>(null);

  // ── Quick-add quest ──
  const [quickAddValue, setQuickAddValue] = useState('');
  const [quickAddFocused, setQuickAddFocused] = useState(false);
  const quickAddRef = useRef<HTMLInputElement>(null);

  // ── Inline step-add ──
  const [inlineStepValue, setInlineStepValue] = useState('');
  const inlineStepRef = useRef<HTMLInputElement>(null);

  // ── Completion celebration ──
  const [celebrationData, setCelebrationData] = useState<{ xp: number; title: string } | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);

  const activeSession = selectors.getActiveSession();
  const activeTasks = selectors.getActiveTasks();

  const activeSessionTaskIds = useMemo(
    () =>
      new Set<string>(
        [activeSession?.taskId, ...(activeSession?.linkedTaskIds || [])].filter(
          (taskId): taskId is string => typeof taskId === 'string'
        )
      ),
    [activeSession]
  );

  const orderedTasks = useMemo(() => {
    return [...activeTasks].sort((a, b) => {
      const aRunning = isRunningTask(a, activeSessionTaskIds) ? 1 : 0;
      const bRunning = isRunningTask(b, activeSessionTaskIds) ? 1 : 0;
      if (aRunning !== bRunning) return bRunning - aRunning;

      const aScheduled = typeof a.scheduledAt === 'number' ? a.scheduledAt : Number.POSITIVE_INFINITY;
      const bScheduled = typeof b.scheduledAt === 'number' ? b.scheduledAt : Number.POSITIVE_INFINITY;
      const aTimeDiff = Math.abs(aScheduled - now);
      const bTimeDiff = Math.abs(bScheduled - now);
      if (aScheduled !== bScheduled) return aTimeDiff - bTimeDiff;

      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    });
  }, [activeTasks, activeSessionTaskIds, now]);

  useEffect(() => {
    const nextDefault = pickDefaultTaskId(orderedTasks, activeSessionTaskIds, now);
    setSelectedTaskId((current) => {
      if (current && orderedTasks.some((task) => task.id === current)) return current;
      return nextDefault;
    });
  }, [orderedTasks, activeSessionTaskIds, now]);

  useEffect(() => {
    const applyNavigation = (detail?: PlayNavigationPayload | null) => {
      if (!detail?.taskId) return;
      setSelectedTaskId(detail.taskId);
      clearPendingPlayNavigation();
    };

    applyNavigation(readPendingPlayNavigation());

    const handlePlayNavigation = (event: Event) => {
      applyNavigation((event as CustomEvent<PlayNavigationPayload>).detail);
    };

    window.addEventListener(PLAY_NAVIGATION_EVENT, handlePlayNavigation as EventListener);
    return () => window.removeEventListener(PLAY_NAVIGATION_EVENT, handlePlayNavigation as EventListener);
  }, []);

  const selectedTask = useMemo(
    () => (selectedTaskId ? selectors.getTaskById(selectedTaskId) : null),
    [selectors, selectedTaskId]
  );

  const selectedTaskRunning = !!selectedTask && isRunningTask(selectedTask, activeSessionTaskIds);
  const selectedTaskSteps = useMemo(
    () => parseQuestNotesAndSteps(selectedTask?.details),
    [selectedTask]
  );
  const selectedTaskProject = useMemo(
    () => (selectedTask?.projectId ? projects.find((project) => project.id === selectedTask.projectId) ?? null : null),
    [selectedTask, projects]
  );
  const selectedProjectMilestones = useMemo(
    () => (selectedTaskProject ? milestones.filter((milestone) => milestone.projectId === selectedTaskProject.id) : []),
    [selectedTaskProject, milestones]
  );
  const selectedProjectProgress = useMemo(
    () => getProjectCompletion(selectedTaskProject, tasks),
    [selectedTaskProject, tasks]
  );

  const selectedTaskTodayMs = selectedTask
    ? selectors.getTaskTodayMs(selectedTask.id, dateKey, now)
    : 0;
  const selectedTaskCompletionXP = selectedTask
    ? selectors.getQuestCompletionXP(selectedTask.id)
    : null;
  const focusPulseEnabled = settings.unlocks.activeWidgetIds.includes('widget-focus-pulse');
  const briefStackEnabled = settings.unlocks.activeWidgetIds.includes('widget-brief-stack');

  const daySummary = selectors.getDaySummary(dateKey, now);
  const momentum = selectors.getMomentum();
  const recentActivity = selectors.getDayActivityGrouped(dateKey, now).slice(0, 4);

  const BRANCH_COLORS: Record<string, string> = {
    Knowledge: '#60a5fa', Creation: '#c084fc', Systems: '#34d399',
    Communication: '#fb923c', Physical: '#f87171', Inner: '#facc15',
  };

  const branchDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const t of activeTasks) {
      if (t.selfTreePrimary) {
        counts[t.selfTreePrimary] = (counts[t.selfTreePrimary] || 0) + 1;
        total++;
      }
    }
    if (total === 0) return null;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([branch, count]) => ({
        branch,
        count,
        pct: Math.round((count / total) * 100),
        color: BRANCH_COLORS[branch] || '#888',
      }));
  }, [activeTasks]);

  const branchGrowth = useMemo(() => {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const counts: Record<string, number> = {};
    let maxCount = 0;
    for (const c of completions) {
      const t = taskMap.get(c.taskId);
      if (t?.selfTreePrimary) {
        counts[t.selfTreePrimary] = (counts[t.selfTreePrimary] || 0) + 1;
        if (counts[t.selfTreePrimary] > maxCount) maxCount = counts[t.selfTreePrimary];
      }
    }
    if (maxCount === 0) return null;
    const ALL_BRANCHES = ['Knowledge', 'Creation', 'Systems', 'Communication', 'Physical', 'Inner'] as const;
    return ALL_BRANCHES.map(branch => ({
      branch,
      count: counts[branch] || 0,
      pct: maxCount > 0 ? Math.round(((counts[branch] || 0) / maxCount) * 100) : 0,
      color: BRANCH_COLORS[branch],
    }));
  }, [tasks, completions]);

  const weekDots = useMemo(() => {
    const base = new Date(dateKey + 'T12:00:00');
    const dow = base.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(base);
    monday.setDate(base.getDate() + mondayOffset);
    const completionDays = new Set(completions.map(c => c.dateKey));
    const sessionDays = new Set(sessions.filter(s => s.status === 'completed').map(s => s.endAt ? new Date(s.endAt).toISOString().slice(0, 10) : ''));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dk = d.toISOString().slice(0, 10);
      return {
        dk,
        active: completionDays.has(dk) || sessionDays.has(dk),
        isToday: dk === dateKey,
        label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i],
      };
    });
  }, [completions, sessions, dateKey]);
  const topTasks = selectors.getTopTasksForDay(dateKey, 4, now);
  const latestBriefQuest = useMemo(
    () => (latestBrief?.linkedQuestIds?.length ? tasks.find((task) => task.id === latestBrief.linkedQuestIds[0]) ?? null : null),
    [latestBrief, tasks]
  );
  const latestBriefProject = useMemo(
    () =>
      latestBrief?.linkedProjectIds?.length
        ? projects.find((project) => project.id === latestBrief.linkedProjectIds[0]) ?? null
        : null,
    [latestBrief, projects]
  );
  const starterTask = useMemo(
    () => (onboardingHandoff ? tasks.find((task) => task.id === onboardingHandoff.questId) ?? null : null),
    [onboardingHandoff, tasks]
  );
  const starterTaskTodayMs = starterTask ? selectors.getTaskTodayMs(starterTask.id, dateKey, now) : 0;
  const starterTaskRunning = !!starterTask && isRunningTask(starterTask, activeSessionTaskIds);
  const starterCheckpointStatus = useMemo(
    () => buildStarterCheckpointStatus({ task: starterTask, trackedMs: starterTaskTodayMs }),
    [starterTask, starterTaskTodayMs]
  );
  const starterTrackLabel =
    onboardingHandoff?.track === 'practice'
      ? 'Practice relay'
      : onboardingHandoff?.track === 'system'
        ? 'System relay'
        : 'Mission relay';
  const starterRoute = onboardingHandoff ? buildStarterWorkspaceRoute(onboardingHandoff) : null;
  const starterRelayPhase = useMemo(
    () =>
      buildStarterRelayPhase({
        task: starterTask,
        trackedMs: starterTaskTodayMs,
        running: starterTaskRunning,
        workspaceActionLabel: starterRoute?.workspaceAction ?? null,
      }),
    [starterRoute, starterTask, starterTaskRunning, starterTaskTodayMs]
  );
  const urgentPresentationSignal = useMemo(
    () => resolveUrgentPresentationSignal(orderedTasks, now),
    [now, orderedTasks]
  );

  useEffect(() => {
    if (!onboardingHandoff || !onDismissOnboardingHandoff || !starterTask) return;
    if (hasStarterCheckpointLanded({ task: starterTask, trackedMs: starterTaskTodayMs })) {
      openStarterWorkspaceCue(
        buildStarterWorkspaceCue(onboardingHandoff, {
          mode: 'checkpoint',
          checkpointStatus: starterCheckpointStatus,
        })
      );
      onDismissOnboardingHandoff();
    }
  }, [onboardingHandoff, onDismissOnboardingHandoff, starterCheckpointStatus, starterTask, starterTaskTodayMs]);

  useEffect(() => {
    if (!onboardingHandoff || !starterTask || !onStarterSessionLive) {
      starterSessionLiveKeyRef.current = null;
      return;
    }

    const checkpointLanded = hasStarterCheckpointLanded({ task: starterTask, trackedMs: starterTaskTodayMs });
    const liveKey =
      starterTaskRunning && !checkpointLanded
        ? `${onboardingHandoff.questId}:${activeSession?.id ?? 'starter-live'}`
        : null;

    if (!liveKey) {
      if (!starterTaskRunning || checkpointLanded) {
        starterSessionLiveKeyRef.current = null;
      }
      return;
    }

    if (starterSessionLiveKeyRef.current === liveKey) return;
    starterSessionLiveKeyRef.current = liveKey;

    onStarterSessionLive(buildStarterSessionLiveTransition(onboardingHandoff, starterCheckpointStatus));
  }, [
    activeSession?.id,
    onStarterSessionLive,
    onboardingHandoff,
    starterCheckpointStatus,
    starterTask,
    starterTaskRunning,
    starterTaskTodayMs,
  ]);

  useEffect(() => {
    if (!urgentPresentationSignal) {
      urgentSignalKeyRef.current = null;
      return;
    }
    if (urgentSignalKeyRef.current === urgentPresentationSignal.signalKey) return;
    urgentSignalKeyRef.current = urgentPresentationSignal.signalKey;
    presentationEvents?.emitEvent('notification.urgent', {
      source: 'system',
      metadata: {
        taskId: urgentPresentationSignal.taskId,
        title: urgentPresentationSignal.title,
        reason: urgentPresentationSignal.reason,
        latenessMinutes: urgentPresentationSignal.latenessMinutes,
        scheduledAt: urgentPresentationSignal.scheduledAt ?? null,
      },
    });
  }, [presentationEvents, urgentPresentationSignal]);

  const openCreateQuest = useCallback(() => {
    setEditingTaskId(null);
    setModalOpen(true);
  }, []);

  const openEditQuest = useCallback((taskId: string) => {
    setEditingTaskId(taskId);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingTaskId(null);
  }, []);

  const handleSaveQuest = (draft: {
    title: string;
    details: string;
    priority: Task['priority'];
    scheduledAt?: number;
    questType: Task['questType'];
    level: QuestLevel;
    projectId?: string;
    selfTreePrimary?: SelfTreeBranch;
  }) => {
    if (editingTaskId) {
      updateTask(editingTaskId, {
        title: draft.title,
        details: draft.details,
        priority: draft.priority,
        scheduledAt: draft.scheduledAt,
        questType: draft.questType,
        level: draft.level,
        projectId: draft.projectId,
        selfTreePrimary: draft.selfTreePrimary,
      });
      setSelectedTaskId(editingTaskId);
    } else {
      const createdId = addTask({
        title: draft.title,
        details: draft.details,
        priority: draft.priority,
        status: 'todo',
        category: draft.projectId ? 'Project quest' : 'Quest',
        questType: draft.questType,
        level: draft.level,
        projectId: draft.projectId,
        scheduledAt: draft.scheduledAt,
        selfTreePrimary: draft.selfTreePrimary,
        icon: draft.level >= 3 ? 'flag' : 'zap',
      });
      setSelectedTaskId(createdId);
    }
    closeModal();
  };

  const handleToggleStep = (stepIndex: number) => {
    if (!selectedTask) return;
    const parsed = parseQuestNotesAndSteps(selectedTask.details);
    if (!parsed.steps[stepIndex]) return;
    const nextSteps = parsed.steps.map((step, index) =>
      index === stepIndex ? { ...step, done: !step.done } : step
    );
    updateTask(selectedTask.id, {
      details: encodeQuestNotesWithSteps(parsed.notes, nextSteps),
    });
  };

  // ── Quick-add quest handler ──
  const handleQuickAdd = useCallback(() => {
    const title = quickAddValue.trim();
    if (!title) return;
    const createdId = addTask({
      title,
      details: '',
      priority: 'normal',
      status: 'todo',
      category: 'Quest',
      questType: 'session',
      level: 1 as QuestLevel,
      icon: 'zap',
    });
    setSelectedTaskId(createdId);
    setQuickAddValue('');
    quickAddRef.current?.blur();
  }, [quickAddValue, addTask]);

  // ── Inline step-add handler ──
  const handleInlineStepAdd = useCallback(() => {
    const text = inlineStepValue.trim();
    if (!text || !selectedTask) return;
    const parsed = parseQuestNotesAndSteps(selectedTask.details);
    const nextSteps = [...parsed.steps, { text, done: false }];
    updateTask(selectedTask.id, {
      details: encodeQuestNotesWithSteps(parsed.notes, nextSteps),
    });
    setInlineStepValue('');
    // Keep focus on input for rapid multi-step entry
    setTimeout(() => inlineStepRef.current?.focus(), 0);
  }, [inlineStepValue, selectedTask, updateTask]);

  const handleRunSelectedQuest = () => {
    if (!selectedTask) return;
    resumeTaskSession(selectedTask.id);
  };

  const handleCompleteSelectedQuest = () => {
    if (!selectedTask) return;
    const taskTitle = selectedTask.title;
    const taskId = selectedTask.id;
    const xpBreakdown = selectors.getQuestCompletionXP(taskId);

    completeTask(taskId, {
      minutes: Math.max(0, Math.floor(selectedTaskTodayMs / 60000)),
      source: selectedTaskRunning ? 'session' : 'manual_done',
    });
    presentationEvents?.emitEvent('quest.completed', {
      source: 'user',
      metadata: {
        taskId,
        title: taskTitle,
        via: selectedTaskRunning ? 'session' : 'manual_done',
      },
    });

    // Trigger celebration flash, then open debrief after animation
    setCelebrationData({ xp: xpBreakdown?.total ?? 0, title: taskTitle });
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = window.setTimeout(() => {
      setCelebrationData(null);
      setDebriefTaskId(taskId);
      celebrationTimerRef.current = null;
    }, 1800);
  };

  // ── Global keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs/textareas or modal is open
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (modalOpen || debriefTaskId) return;

      switch (e.key) {
        case ' ': // Space → toggle session (start/pause)
          if (!selectedTask) return;
          e.preventDefault();
          if (selectedTaskRunning) {
            pauseSession();
          } else {
            handleRunSelectedQuest();
          }
          break;
        case 'n': // N → focus quick-add input
        case 'N':
          e.preventDefault();
          quickAddRef.current?.focus();
          break;
        case 'e': // E → edit selected quest
        case 'E':
          if (selectedTask) {
            e.preventDefault();
            openEditQuest(selectedTask.id);
          }
          break;
        case 'c': // C → complete selected quest
        case 'C':
          if (selectedTask && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handleCompleteSelectedQuest();
          }
          break;
        case 'ArrowDown': // Navigate quest list
          e.preventDefault();
          setSelectedTaskId((current) => {
            const idx = orderedTasks.findIndex((t) => t.id === current);
            const next = orderedTasks[idx + 1];
            return next?.id ?? current;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedTaskId((current) => {
            const idx = orderedTasks.findIndex((t) => t.id === current);
            const prev = orderedTasks[idx - 1];
            return prev?.id ?? current;
          });
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedTask, selectedTaskRunning, modalOpen, debriefTaskId, orderedTasks]);

  const editingTask = editingTaskId ? selectors.getTaskById(editingTaskId) : null;
  const selectedStepCounts = getQuestStepCounts(selectedTask?.details);

  useEffect(() => {
    const sessionKey = activeSession?.status === 'running' ? activeSession.id : null;
    const previousSessionKey = previousSessionKeyRef.current;
    if (sessionKey && sessionKey !== previousSessionKey) {
      presentationEvents?.emitEvent('play.session.start', {
        source: 'user',
        metadata: {
          sessionId: activeSession?.id,
          taskId: activeSession?.taskId || activeSession?.linkedTaskIds?.[0] || null,
          title: activeSession?.title || null,
        },
      });
    }
    if (!sessionKey && previousSessionKey) {
      presentationEvents?.emitEvent('play.session.stop', {
        source: 'user',
        metadata: {
          previousSessionId: previousSessionKey,
        },
      });
    }
    previousSessionKeyRef.current = sessionKey;
  }, [
    activeSession?.id,
    activeSession?.linkedTaskIds,
    activeSession?.status,
    activeSession?.taskId,
    activeSession?.title,
    presentationEvents,
  ]);


  // ── Ring progress for HUD ──
  // Always use selectedTaskTodayMs — it already includes the running session's
  // live elapsed time via getSessionMsForDate. This prevents the timer resetting
  // to 0 when starting a new session on a task with previous sessions.
  const ringProgress = useMemo(() => {
    if (!selectedTask) return 0;
    return Math.min(1, (selectedTaskTodayMs / 3600000));
  }, [selectedTask, selectedTaskTodayMs]);

  const ringCircumference = 2 * Math.PI * 120; // r=120
  const ringOffset = ringCircumference * (1 - ringProgress);

  // Visual mode class
  const playMode = selectedTaskRunning ? 'xt-ops--live' : selectedTask ? 'xt-ops--armed' : 'xt-ops--idle';

  return (
    <div className={`xt-ops-room ${playMode}`}>
      {/* ── Cinematic environment background ── */}
      <div className="xt-ops-grid-env" aria-hidden="true">
        <div className="xt-ops-grid-plane" />
        <div className="xt-ops-grid-glow" />
        <div className="xt-ops-vignette" />
        {/* Floating ambient particles */}
        <div className="xt-ops-particles">
          {Array.from({ length: 18 }, (_, i) => (
            <div key={i} className="xt-ops-particle" style={{
              left: `${5 + (i * 37 % 90)}%`,
              animationDelay: `${(i * 1.3) % 8}s`,
              animationDuration: `${6 + (i % 5) * 2}s`,
              '--particle-size': `${1 + (i % 3)}px`,
              '--particle-drift': `${-20 + (i * 7 % 40)}px`,
            } as React.CSSProperties} />
          ))}
        </div>
        {/* Horizon light beam — subtle atmospheric line */}
        <div className="xt-ops-horizon" />
      </div>

      {/* ── Master-detail layout ── */}
      <div className="xt-ops-layout">

        {/* ══ LEFT: Mission Rack ══ */}
        <aside className="xt-ops-rack">
          <div className="xt-ops-rack-header">
            <span className="xt-ops-rack-label">Operations</span>
            <button type="button" onClick={openCreateQuest} className="xt-ops-rack-add" title="Full quest editor">
              <Plus size={12} />
            </button>
          </div>

          {/* Quick-add quest — type title, Enter to create */}
          <div className={`xt-ops-quick-add ${quickAddFocused ? 'xt-ops-quick-add--focused' : ''}`}>
            <input
              ref={quickAddRef}
              type="text"
              placeholder="Quick add quest…"
              value={quickAddValue}
              onChange={(e) => setQuickAddValue(e.target.value)}
              onFocus={() => setQuickAddFocused(true)}
              onBlur={() => setQuickAddFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleQuickAdd();
                } else if (e.key === 'Enter' && e.shiftKey) {
                  // Shift+Enter → open full modal with title pre-filled
                  e.preventDefault();
                  const title = quickAddValue.trim();
                  setQuickAddValue('');
                  if (title) {
                    setEditingTaskId(null);
                    setModalOpen(true);
                    // The modal will open empty — but this at least skips the + click
                  }
                } else if (e.key === 'Escape') {
                  setQuickAddValue('');
                  quickAddRef.current?.blur();
                }
              }}
              className="xt-ops-quick-add-input"
            />
            {quickAddValue.trim() && (
              <span className="xt-ops-quick-add-hint">
                ↵ create · ⇧↵ full editor
              </span>
            )}
          </div>

          {/* Vitals bar — compact HUD stats */}
          <div className="xt-ops-vitals">
            <div className="xt-ops-vital" title="Minutes tracked today">
              <span className="xt-ops-vital-val">{daySummary.minutesTracked}</span>
              <span className="xt-ops-vital-unit">min</span>
            </div>
            <div className="xt-ops-vital" title="Quests completed today">
              <span className="xt-ops-vital-val">{daySummary.completedCount}</span>
              <span className="xt-ops-vital-unit">done</span>
            </div>
            <div className="xt-ops-vital" title="Current daily streak">
              <span className="xt-ops-vital-val">{momentum.currentStreak}</span>
              <span className="xt-ops-vital-unit">streak</span>
            </div>
            <div className="xt-ops-vital" title="XP multiplier from streak">
              <span className="xt-ops-vital-val xt-ops-vital-val--accent">x{momentum.streakMultiplier.toFixed(1)}</span>
              <span className="xt-ops-vital-unit">mult</span>
            </div>
          </div>

          {/* Week activity tracker — game-style progress dots */}
          <div className="xt-ops-week-strip">
            {weekDots.map(({ dk, active, isToday, label }) => (
              <div key={dk} className={`xt-ops-week-cell ${active ? 'xt-ops-week-cell--active' : ''} ${isToday ? 'xt-ops-week-cell--today' : ''}`}>
                <span className="xt-ops-week-cell-label">{label}</span>
              </div>
            ))}
          </div>

          {/* Branch distribution bar */}
          {branchDistribution && (
            <div className="xt-ops-branch-bar" title="Self-Tree branch distribution">
              {branchDistribution.map(({ branch, pct, color }) => (
                <div
                  key={branch}
                  className="xt-ops-branch-bar-seg"
                  style={{ width: `${Math.max(pct, 4)}%`, background: color }}
                  title={`${branch}: ${pct}%`}
                />
              ))}
            </div>
          )}

          {/* Quest list */}
          <div className="xt-ops-rack-scroll">
            {orderedTasks.length ? (
              orderedTasks.map((task) => {
                const running = isRunningTask(task, activeSessionTaskIds);
                const todayMinutes = Math.floor(selectors.getTaskTodayMs(task.id, dateKey, now) / 60000);
                const isSelected = task.id === selectedTaskId;
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`xt-ops-briefing ${isSelected ? 'xt-ops-briefing--active' : ''} ${running ? 'xt-ops-briefing--live' : ''}`}
                  >
                    <div className="xt-ops-briefing-edge" />
                    <div className="xt-ops-briefing-body">
                      <div className="xt-ops-briefing-title">
                        {running ? <span className="xt-ops-live-dot" /> : null}
                        <span className="truncate">{task.title}</span>
                      </div>
                      <div className="xt-ops-briefing-meta">
                        {task.selfTreePrimary ? (
                          <span
                            className="xt-ops-branch-dot"
                            style={{ background: BRANCH_COLORS[task.selfTreePrimary] }}
                            title={task.selfTreePrimary}
                          />
                        ) : null}
                        <span>{PRIORITY_LABELS[task.priority]}</span>
                        <span className="xt-ops-briefing-sep">·</span>
                        <span>L{task.level ?? 1}</span>
                        {todayMinutes > 0 ? (
                          <>
                            <span className="xt-ops-briefing-sep">·</span>
                            <span className="xt-ops-briefing-time">{todayMinutes}m</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="xt-ops-rack-empty">
                <span>No operations</span>
                <button type="button" onClick={openCreateQuest} className="xt-ops-rack-empty-btn">
                  Create first quest
                </button>
              </div>
            )}
          </div>

          {/* Recent activity footer */}
          {recentActivity.length ? (
            <div className="xt-ops-rack-footer">
              <div className="xt-ops-rack-footer-label">Recent</div>
              {recentActivity.slice(0, 3).map((entry) => (
                <div key={entry.key} className="xt-ops-recent">
                  <span className="truncate">{entry.title}</span>
                  <span className="xt-ops-recent-time">{entry.totalMinutes}m</span>
                </div>
              ))}
            </div>
          ) : null}
        </aside>

        {/* ══ RIGHT: Command Display ══ */}
        <main className="xt-ops-command">
          {/* Onboarding relay — compact */}
          {onboardingHandoff && starterTask ? (
            <div className="xt-ops-relay">
              <div className="xt-ops-relay-content">
                <span className="xt-ops-relay-badge">Starter Relay</span>
                <span className="xt-ops-relay-text">
                  {starterCheckpointStatus?.landed
                    ? `${starterTrackLabel} confirmed`
                    : starterTaskRunning
                      ? `${starterTrackLabel} live`
                      : `${starterTrackLabel} armed`}
                </span>
              </div>
              <div className="xt-ops-relay-actions">
                <PlayActionButton
                  label={starterRelayPhase?.actionLabel ?? 'Start'}
                  onClick={() => {
                    if (starterCheckpointStatus?.landed) {
                      if (!starterRoute || !onOpenWorkspace || !onboardingHandoff) return;
                      openStarterWorkspaceCue(buildStarterWorkspaceCue(onboardingHandoff));
                      onOpenWorkspace(starterRoute.workspaceView);
                      return;
                    }
                    setSelectedTaskId(starterTask.id);
                    if (!starterTaskRunning) resumeTaskSession(starterTask.id);
                  }}
                  icon={starterCheckpointStatus?.landed ? <ChevronRight size={14} /> : <PlayCircle size={14} />}
                  tone={starterRelayPhase?.actionTone ?? 'accent'}
                  disabled={starterRelayPhase?.actionDisabled}
                />
                {onDismissOnboardingHandoff ? (
                  <PlayActionButton label="Dismiss" onClick={onDismissOnboardingHandoff} tone="muted" />
                ) : null}
              </div>
            </div>
          ) : null}

          {selectedTask ? (
            <>
              {/* ── HUD Ring + Timer ── */}
              <div className="xt-ops-hud">
                <div className="xt-ops-ring-container">
                  {/* Outer atmosphere glow — cinematic depth ring */}
                  <div className="xt-ops-ring-aura" />
                  {/* Background ring */}
                  <svg className="xt-ops-ring-svg" viewBox="0 0 260 260">
                    {/* Outer decorative ring */}
                    <circle
                      cx="130" cy="130" r="126"
                      fill="none"
                      stroke="var(--app-border)"
                      strokeWidth="0.5"
                      opacity="0.2"
                    />
                    <circle
                      cx="130" cy="130" r="120"
                      fill="none"
                      stroke="var(--app-border)"
                      strokeWidth="2"
                      opacity="0.4"
                    />
                    {/* Inner decorative ring */}
                    <circle
                      cx="130" cy="130" r="114"
                      fill="none"
                      stroke="var(--app-border)"
                      strokeWidth="0.5"
                      opacity="0.15"
                    />
                    {/* Progress ring */}
                    <circle
                      cx="130" cy="130" r="120"
                      fill="none"
                      stroke="var(--app-accent)"
                      strokeWidth="3"
                      strokeLinecap="butt"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      className="xt-ops-ring-progress"
                      transform="rotate(-90 130 130)"
                    />
                    {/* Tick marks — 12 positions like a clock */}
                    {Array.from({ length: 12 }, (_, i) => i * 30).map((angle) => (
                      <line
                        key={angle}
                        x1="130" y1={angle % 90 === 0 ? '4' : '8'}
                        x2="130" y2={angle % 90 === 0 ? '16' : '14'}
                        stroke="var(--app-muted)"
                        strokeWidth={angle % 90 === 0 ? '1.5' : '0.5'}
                        opacity={angle % 90 === 0 ? '0.5' : '0.25'}
                        transform={`rotate(${angle} 130 130)`}
                      />
                    ))}
                  </svg>

                  {/* Center content */}
                  <div className="xt-ops-ring-center">
                    <div className="xt-ops-timer">
                      {formatDuration(selectedTaskTodayMs)}
                    </div>
                    <div className="xt-ops-timer-status">
                      {selectedTaskRunning ? 'SESSION ACTIVE' : selectedTaskTodayMs > 0 ? 'TRACKED TODAY' : 'READY'}
                    </div>

                    {/* Station emblem — evolves with level */}
                    <div className={`xt-ops-emblem xt-ops-emblem--lvl${Math.min(stats.playerLevel, 5)}`}>
                      <div className="xt-ops-emblem-inner" />
                    </div>
                  </div>
                </div>

                {/* Quest title below ring */}
                <div className="xt-ops-quest-header">
                  <h1 className="xt-ops-quest-title">{selectedTask.title}</h1>
                  <div className="xt-ops-quest-tags">
                    <span className="xt-ops-tag xt-ops-tag--accent">
                      {QUEST_TYPE_LABELS[selectedTask.questType ?? 'session'] ?? 'Quest'}
                    </span>
                    <span className="xt-ops-tag">{PRIORITY_LABELS[selectedTask.priority]}</span>
                    <span className="xt-ops-tag">L{selectedTask.level ?? 1}</span>
                    {selectedTask.selfTreePrimary ? (
                      <span
                        className="xt-ops-tag"
                        style={{
                          borderColor: BRANCH_COLORS[selectedTask.selfTreePrimary],
                          color: BRANCH_COLORS[selectedTask.selfTreePrimary],
                        }}
                      >
                        {SELF_TREE_LABELS[selectedTask.selfTreePrimary]}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Action controls */}
                <div className="xt-ops-controls">
                  <PlayActionButton
                    label={selectedTaskRunning ? 'Pause' : activeSession ? 'Switch' : 'Start Session'}
                    onClick={selectedTaskRunning ? pauseSession : handleRunSelectedQuest}
                    icon={selectedTaskRunning ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                    tone="accent"
                  />
                  <PlayActionButton
                    label="Complete"
                    onClick={handleCompleteSelectedQuest}
                    icon={<CheckCircle2 size={14} />}
                    tone="success"
                  />
                  <PlayActionButton
                    label="Edit"
                    onClick={() => openEditQuest(selectedTask.id)}
                    icon={<Pencil size={13} />}
                  />
                </div>
              </div>

              {/* Urgent alert */}
              {urgentPresentationSignal ? (
                <div className="xt-ops-urgent">
                  <span className="xt-ops-urgent-badge">Urgent</span>
                  <span className="xt-ops-urgent-text">{urgentPresentationSignal.title}</span>
                  <button type="button" onClick={() => setSelectedTaskId(urgentPresentationSignal.taskId)} className="xt-ops-urgent-btn">
                    Focus
                  </button>
                </div>
              ) : null}

              {/* ── Stats strip ── */}
              <div className="xt-ops-stats">
                <SummaryCell label="Today" value={`${Math.floor(selectedTaskTodayMs / 60000)} min`} />
                <SummaryCell label="XP" value={`+${selectedTaskCompletionXP?.total ?? 0}`} accent="text-[var(--app-accent)]" />
                <SummaryCell label="Steps" value={selectedStepCounts ? `${selectedStepCounts.done}/${selectedStepCounts.total}` : '—'} />
                <SummaryCell label="Level" value={`${stats.playerLevel}`} />
              </div>

              {/* ── Lower panels: Steps + Intel ── */}
              <div className="xt-ops-panels">
                {/* Steps / checklist */}
                <div className="xt-ops-panel">
                  <div className="xt-ops-panel-head">
                    <span className="xt-ops-panel-label">Mission Steps</span>
                    {selectedStepCounts ? (
                      <span className="xt-ops-panel-count">{selectedStepCounts.done}/{selectedStepCounts.total}</span>
                    ) : null}
                  </div>
                  {selectedTaskSteps.steps.length ? (
                    <div className="xt-ops-steps">
                      {selectedTaskSteps.steps.map((step, index) => (
                        <button
                          key={`${selectedTask.id}-step-${index}`}
                          type="button"
                          onClick={() => handleToggleStep(index)}
                          className={`xt-ops-step ${step.done ? 'xt-ops-step--done' : ''}`}
                        >
                          <span className="xt-ops-step-check">
                            {step.done ? <CheckCircle2 size={11} /> : <ChevronRight size={11} />}
                          </span>
                          <span className="xt-ops-step-text">{step.text}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="xt-ops-steps-empty">
                      Add steps below or edit quest for full checklist.
                    </div>
                  )}

                  {/* Inline step-add input */}
                  <div className="xt-ops-step-add">
                    <input
                      ref={inlineStepRef}
                      type="text"
                      placeholder="+ Add step…"
                      value={inlineStepValue}
                      onChange={(e) => setInlineStepValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleInlineStepAdd();
                        } else if (e.key === 'Escape') {
                          setInlineStepValue('');
                          inlineStepRef.current?.blur();
                        }
                      }}
                      className="xt-ops-step-add-input"
                    />
                  </div>

                  {/* Notes */}
                  {selectedTaskSteps.notes ? (
                    <div className="xt-ops-notes">
                      <div className="xt-ops-panel-label">Brief</div>
                      <p className="xt-ops-notes-text">{shortText(selectedTaskSteps.notes, '', 300)}</p>
                    </div>
                  ) : null}
                </div>

                {/* Intel column */}
                <div className="xt-ops-intel">
                  {/* Schedule / Project / Mode */}
                  <div className="xt-ops-panel">
                    <div className="xt-ops-panel-head">
                      <span className="xt-ops-panel-label">Intel</span>
                    </div>
                    <div className="xt-ops-intel-rows">
                      <div className="xt-ops-intel-row">
                        <Calendar size={13} className="xt-ops-intel-icon" />
                        <div>
                          <div className="xt-ops-intel-key">Schedule</div>
                          <div className="xt-ops-intel-val">{formatAbsoluteDate(selectedTask.scheduledAt)}</div>
                          {selectedTask.scheduledAt ? (
                            <div className="xt-ops-intel-accent">{formatRelativeSchedule(selectedTask.scheduledAt, now)}</div>
                          ) : null}
                        </div>
                      </div>
                      <div className="xt-ops-intel-row">
                        <FolderKanban size={13} className="xt-ops-intel-icon" />
                        <div>
                          <div className="xt-ops-intel-key">Project</div>
                          <div className="xt-ops-intel-val">{selectedTaskProject?.title || 'Standalone'}</div>
                          {selectedProjectProgress ? (
                            <div className="xt-ops-intel-accent">{selectedProjectProgress.pct}% complete</div>
                          ) : null}
                        </div>
                      </div>
                      <div className="xt-ops-intel-row">
                        <Sparkles size={13} className="xt-ops-intel-icon" />
                        <div>
                          <div className="xt-ops-intel-key">Mode</div>
                          <div className="xt-ops-intel-val">
                            {selectedTask.questType === 'instant' ? 'Direct completion' : 'Timed session'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Campaign progress */}
                  {selectedTaskProject && selectedProjectProgress ? (
                    <div className="xt-ops-panel">
                      <div className="xt-ops-panel-head">
                        <span className="xt-ops-panel-label">Campaign</span>
                      </div>
                      <div className="xt-ops-campaign-title">{selectedTaskProject.title}</div>
                      <div className="xt-ops-campaign-bar">
                        <div className="xt-ops-campaign-fill" style={{ width: `${selectedProjectProgress.pct}%` }} />
                      </div>
                      <div className="xt-ops-campaign-meta">
                        {selectedProjectProgress.pct}% · {selectedProjectMilestones.filter((m) => m.isCompleted).length}/{selectedProjectMilestones.length} milestones
                      </div>
                    </div>
                  ) : null}

                  {/* Momentum */}
                  <div className="xt-ops-panel">
                    <div className="xt-ops-panel-head">
                      <Trophy size={12} className="text-[var(--app-accent)]" />
                      <span className="xt-ops-panel-label">Momentum</span>
                    </div>
                    <div className="xt-ops-momentum-val">
                      {momentum.currentStreak}d streak · x{momentum.streakMultiplier.toFixed(2)}
                    </div>
                    <div className="xt-ops-momentum-sub">
                      Lvl {stats.playerLevel} · {stats.totalEarnedXP} XP
                    </div>
                    {/* Weekly dots — Mon through Sun */}
                    <div className="xt-ops-week-dots">
                      {weekDots.map(({ dk, active, isToday, label }) => (
                        <div key={dk} className="xt-ops-week-dot-col">
                          <div className={`xt-ops-week-pip ${active ? 'xt-ops-week-pip--active' : ''} ${isToday ? 'xt-ops-week-pip--today' : ''}`} />
                          <span className={`xt-ops-week-label ${isToday ? 'xt-ops-week-label--today' : ''}`}>{label}</span>
                        </div>
                      ))}
                    </div>
                    {/* Weekly bonus threshold */}
                    {momentum.weeklyActiveDays > 0 && (
                      <div className="xt-ops-week-bonus">
                        {[3, 5, 7].map(threshold => (
                          <span
                            key={threshold}
                            className={`xt-ops-week-bonus-pip ${momentum.weeklyActiveDays >= threshold ? 'xt-ops-week-bonus-pip--reached' : ''}`}
                            title={`${threshold}-day bonus`}
                          >
                            {threshold}d
                          </span>
                        ))}
                        <span className="xt-ops-week-bonus-label">{momentum.weeklyActiveDays}/7 active</span>
                      </div>
                    )}
                  </div>

                  {/* Self-Tree growth */}
                  {branchGrowth ? (
                    <div className="xt-ops-panel">
                      <div className="xt-ops-panel-head">
                        <span className="xt-ops-panel-label">Self-Tree</span>
                        <span className="xt-ops-panel-count">
                          {branchGrowth.reduce((s, b) => s + b.count, 0)} total
                        </span>
                      </div>
                      <div className="xt-ops-tree-branches">
                        {branchGrowth.map(({ branch, count, pct, color }) => (
                          <div key={branch} className="xt-ops-tree-row">
                            <span className="xt-ops-tree-label" style={{ color: count > 0 ? color : undefined }}>
                              {branch.slice(0, 4)}
                            </span>
                            <div className="xt-ops-tree-track">
                              <div
                                className="xt-ops-tree-fill"
                                style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%`, background: color }}
                              />
                            </div>
                            <span className="xt-ops-tree-count">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            /* ── Empty state — cinematic idle ── */
            <div className="xt-ops-empty">
              <div className="xt-ops-empty-sigil">
                <svg viewBox="0 0 260 260" className="xt-ops-empty-sigil-svg">
                  <circle cx="130" cy="130" r="120" fill="none" stroke="var(--app-border)" strokeWidth="0.5" opacity="0.15" />
                  <circle cx="130" cy="130" r="100" fill="none" stroke="var(--app-border)" strokeWidth="1" opacity="0.12" />
                  <circle cx="130" cy="130" r="80" fill="none" stroke="var(--app-border)" strokeWidth="0.5" opacity="0.08" />
                  {/* Cross-hatch compass lines */}
                  {[0, 45, 90, 135].map(angle => (
                    <line key={angle} x1="130" y1="30" x2="130" y2="230" stroke="var(--app-border)" strokeWidth="0.3" opacity="0.06" transform={`rotate(${angle} 130 130)`} />
                  ))}
                  {/* Diamond at center */}
                  <polygon points="130,106 154,130 130,154 106,130" fill="none" stroke="var(--app-accent)" strokeWidth="0.8" opacity="0.2" />
                </svg>
              </div>
              <div className="xt-ops-empty-content">
                <div className="xt-ops-panel-label text-[var(--app-accent)]">Standing By</div>
                <h2 className="xt-ops-empty-title">No active mission</h2>
                <p className="xt-ops-empty-desc">
                  Select a quest from Operations or create a new mission.
                </p>
                <div className="xt-ops-empty-actions">
                  <PlayActionButton label="New Mission" onClick={openCreateQuest} icon={<Plus size={14} />} tone="accent" />
                  {onOpenGuidedSetup ? (
                    <PlayActionButton label="Guided Setup" onClick={onOpenGuidedSetup} icon={<Sparkles size={14} />} />
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Completion Celebration Overlay — cinematic fullscreen ── */}
      {celebrationData && (
        <div className="xt-ops-celebration" aria-live="assertive">
          <div className="xt-ops-celebration-bg" />
          <div className="xt-ops-celebration-flash" />
          <div className="xt-ops-celebration-rays" />
          <div className="xt-ops-celebration-content">
            <div className="xt-ops-celebration-emblem">
              <svg viewBox="0 0 120 120" className="xt-ops-celebration-emblem-svg">
                <polygon points="60,8 72,44 112,44 80,66 90,104 60,80 30,104 40,66 8,44 48,44"
                  fill="none" stroke="var(--app-accent)" strokeWidth="1.5" opacity="0.6" />
                <circle cx="60" cy="60" r="28" fill="none" stroke="var(--app-accent)" strokeWidth="1" opacity="0.4" />
              </svg>
              <div className="xt-ops-celebration-check">
                <CheckCircle2 size={32} />
              </div>
            </div>
            <div className="xt-ops-celebration-kicker">Mission Complete</div>
            <div className="xt-ops-celebration-xp">+{celebrationData.xp} XP</div>
            <div className="xt-ops-celebration-quest">{celebrationData.title}</div>
            <div className="xt-ops-celebration-bar" />
          </div>
        </div>
      )}

      <QuestModal
        open={modalOpen}
        task={editingTask}
        onClose={closeModal}
        onSave={handleSaveQuest}
      />

      {debriefTaskId ? (
        <QuestDebriefPanel
          taskId={debriefTaskId}
          onClose={() => setDebriefTaskId(null)}
          onNavigate={onOpenWorkspace ? (view) => onOpenWorkspace(view as ClientView) : undefined}
        />
      ) : null}
    </div>
  );
};
