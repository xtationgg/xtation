import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderKanban,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Sparkles,
  Target,
  Trophy,
  Image as ImageIcon,
} from 'lucide-react';
import { QuestModal } from '../Play/QuestModal';
import { QuestDebriefPanel } from '../Play/QuestDebriefPanel';
import { useXP } from '../XP/xpStore';
import type { Project, QuestLevel, SelfTreeBranch, Task } from '../XP/xpTypes';
import { ClientView } from '../../types';
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
    pauseSession,
  } = useXP();
  const latestBrief = useLatestDuskBrief();
  const presentationEvents = useOptionalPresentationEvents();
  const previousSessionKeyRef = useRef<string | null>(null);
  const urgentSignalKeyRef = useRef<string | null>(null);
  const starterSessionLiveKeyRef = useRef<string | null>(null);

  type PlayCategory = 'active' | 'routine' | 'build';
  const [activeCategory, setActiveCategory] = useState<PlayCategory>('active');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [debriefTaskId, setDebriefTaskId] = useState<string | null>(null);

  // ── Rack (sidebar) drawer toggle ──
  const [rackOpen, setRackOpen] = useState(false);

  // ── Play background customization ──
  const [playBgUrl, setPlayBgUrl] = useState<string | null>(() => {
    try { return localStorage.getItem('xtation.play.background') || null; } catch { return null; }
  });
  const [bgPanelOpen, setBgPanelOpen] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);

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

  const categoryQuests = useMemo(() => {
    const nonDone = orderedTasks.filter(t => t.status !== 'done');
    const routine = nonDone.filter(t => t.questType === 'daily');
    const routineIds = new Set(routine.map(t => t.id));
    const build = nonDone.filter(t => t.projectId && !routineIds.has(t.id));
    const buildIds = new Set(build.map(t => t.id));
    const active = nonDone.filter(t => !routineIds.has(t.id) && !buildIds.has(t.id));

    return { active, routine, build };
  }, [orderedTasks]);

  const handleCategorySwitch = useCallback((cat: PlayCategory) => {
    setActiveCategory(cat);
    setSelectedTaskId(null); // Always deselect when switching categories
  }, []);

  const currentCategoryQuests = categoryQuests[activeCategory];

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

  const handleRunSelectedQuest = useCallback(() => {
    if (!selectedTask) return;
    resumeTaskSession(selectedTask.id);
  }, [selectedTask, resumeTaskSession]);

  const handleCompleteSelectedQuest = useCallback(() => {
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
  }, [selectedTask, selectors, completeTask, selectedTaskTodayMs, selectedTaskRunning, presentationEvents]);

  // Clean up celebration timer on unmount to prevent state updates after unmount
  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
    };
  }, []);

  // ── Global keyboard shortcuts ──
  // Use refs to avoid stale closures and prevent re-registering the listener every render
  const kbStateRef = useRef({
    selectedTask, selectedTaskRunning, modalOpen, debriefTaskId,
    orderedTasks, pauseSession, handleRunSelectedQuest, handleCompleteSelectedQuest, openEditQuest,
  });
  kbStateRef.current = {
    selectedTask, selectedTaskRunning, modalOpen, debriefTaskId,
    orderedTasks, pauseSession, handleRunSelectedQuest, handleCompleteSelectedQuest, openEditQuest,
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const s = kbStateRef.current;
      // Don't capture when typing in inputs/textareas or modal is open
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (s.modalOpen || s.debriefTaskId) return;

      switch (e.key) {
        case ' ': // Space → toggle session (start/pause)
          if (!s.selectedTask) return;
          e.preventDefault();
          if (s.selectedTaskRunning) {
            s.pauseSession();
          } else {
            s.handleRunSelectedQuest();
          }
          break;
        case 'n': // N → focus quick-add input
        case 'N':
          e.preventDefault();
          quickAddRef.current?.focus();
          break;
        case 'e': // E → edit selected quest
        case 'E':
          if (s.selectedTask) {
            e.preventDefault();
            s.openEditQuest(s.selectedTask.id);
          }
          break;
        case 'c': // C → complete selected quest
        case 'C':
          if (s.selectedTask && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            s.handleCompleteSelectedQuest();
          }
          break;
        case 'ArrowDown': // Navigate quest list
          e.preventDefault();
          setSelectedTaskId((current) => {
            const idx = s.orderedTasks.findIndex((t) => t.id === current);
            const next = s.orderedTasks[idx + 1];
            return next?.id ?? current;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedTaskId((current) => {
            const idx = s.orderedTasks.findIndex((t) => t.id === current);
            const prev = s.orderedTasks[idx - 1];
            return prev?.id ?? current;
          });
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — all values accessed via kbStateRef

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

  // ── Background handlers ──
  const handleBgUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setPlayBgUrl(url);
      try { localStorage.setItem('xtation.play.background', url); } catch {}
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const clearBg = useCallback(() => {
    setPlayBgUrl(null);
    try { localStorage.removeItem('xtation.play.background'); } catch {}
  }, []);

  const setPresetBg = useCallback((gradient: string) => {
    setPlayBgUrl(gradient);
    try { localStorage.setItem('xtation.play.background', gradient); } catch {}
  }, []);

  const ringCircumference = 2 * Math.PI * 120; // r=120
  const ringOffset = ringCircumference * (1 - ringProgress);

  // Visual mode class
  const playMode = selectedTaskRunning ? 'xt-ops--live' : selectedTask ? 'xt-ops--armed' : 'xt-ops--idle';

  return (
    <div className={`xt-ops-room ${playMode}`}>
      {/* Custom background */}
      {playBgUrl ? (
        <div className="xt-ops-custom-bg" style={{
          backgroundImage: playBgUrl.startsWith('linear-gradient') || playBgUrl.startsWith('radial-gradient')
            ? playBgUrl
            : `url(${playBgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}>
          <div className="xt-ops-custom-bg-overlay" />
        </div>
      ) : null}

      {/* Cinematic environment */}
      <div className="xt-ops-grid-env" aria-hidden="true">
        <div className="xt-ops-grid-plane" />
        <div className="xt-ops-grid-glow" />
        <div className="xt-ops-vignette" />
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
        <div className="xt-ops-horizon" />
      </div>

      {/* Main floating layout */}
      <div className="xt-play-float">
        {/* Top bar */}
        <div className="xt-play-topbar">
          <button className="xt-play-ops-btn" onClick={() => setRackOpen(prev => !prev)}>
            Operations {'\u25BE'}
          </button>
          <div className="xt-play-topbar-right">
            <button className="xt-play-add-btn" onClick={openCreateQuest}>
              <Plus size={13} /> Quest
            </button>
            <button className="xt-ops-bg-btn" onClick={() => setBgPanelOpen(prev => !prev)} title="Background">
              <ImageIcon size={13} />
            </button>
          </div>
        </div>

        {/* Background panel */}
        {bgPanelOpen ? (
          <div className="xt-ops-bg-panel">
            <div className="xt-ops-bg-panel-title">Background</div>

            <button className="xt-ops-bg-option" onClick={() => bgInputRef.current?.click()}>
              Upload Image
            </button>
            <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgUpload} style={{ display: 'none' }} />

            <div className="xt-ops-bg-panel-title" style={{ marginTop: 12 }}>Presets</div>
            <div className="xt-ops-bg-presets">
              <button className="xt-ops-bg-preset" style={{ background: 'linear-gradient(135deg, #0a0a0e 0%, #1a1a2e 50%, #0a0a0e 100%)' }}
                onClick={() => setPresetBg('linear-gradient(135deg, #0a0a0e 0%, #1a1a2e 50%, #0a0a0e 100%)')} title="Deep Blue" />
              <button className="xt-ops-bg-preset" style={{ background: 'linear-gradient(135deg, #0a0e0a 0%, #1a2e1a 50%, #0a0e0a 100%)' }}
                onClick={() => setPresetBg('linear-gradient(135deg, #0a0e0a 0%, #1a2e1a 50%, #0a0e0a 100%)')} title="Forest" />
              <button className="xt-ops-bg-preset" style={{ background: 'linear-gradient(135deg, #0e0a0a 0%, #2e1a1a 50%, #0e0a0a 100%)' }}
                onClick={() => setPresetBg('linear-gradient(135deg, #0e0a0a 0%, #2e1a1a 50%, #0e0a0a 100%)')} title="Ember" />
              <button className="xt-ops-bg-preset" style={{ background: 'linear-gradient(135deg, #0e0a10 0%, #2a1a30 50%, #0e0a10 100%)' }}
                onClick={() => setPresetBg('linear-gradient(135deg, #0e0a10 0%, #2a1a30 50%, #0e0a10 100%)')} title="Void" />
              <button className="xt-ops-bg-preset" style={{ background: 'linear-gradient(180deg, #0d0d12 0%, #111118 100%)' }}
                onClick={() => setPresetBg('linear-gradient(180deg, #0d0d12 0%, #111118 100%)')} title="Dark" />
              <button className="xt-ops-bg-preset" style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a1a2e 0%, #0a0a0e 70%)' }}
                onClick={() => setPresetBg('radial-gradient(ellipse at 50% 30%, #1a1a2e 0%, #0a0a0e 70%)')} title="Spotlight" />
            </div>

            {playBgUrl ? (
              <button className="xt-ops-bg-option xt-ops-bg-option--clear" onClick={clearBg} style={{ marginTop: 8 }}>
                Reset to Default
              </button>
            ) : null}

            <button className="xt-ops-bg-option" onClick={() => setBgPanelOpen(false)} style={{ marginTop: 4, opacity: 0.5 }}>
              Close
            </button>
          </div>
        ) : null}

        {/* 3 Category Tabs — floating in space */}
        <div className="xt-play-categories">
          <button
            className={`xt-play-cat ${activeCategory === 'active' ? 'is-active' : ''}`}
            onClick={() => handleCategorySwitch('active')}
          >
            <span className="xt-play-cat-label">Active</span>
            <span className="xt-play-cat-count">{categoryQuests.active.length} quests</span>
          </button>
          <button
            className={`xt-play-cat ${activeCategory === 'routine' ? 'is-active' : ''}`}
            onClick={() => handleCategorySwitch('routine')}
          >
            <span className="xt-play-cat-label">Routine</span>
            <span className="xt-play-cat-count">{categoryQuests.routine.length} habits</span>
          </button>
          <button
            className={`xt-play-cat ${activeCategory === 'build' ? 'is-active' : ''}`}
            onClick={() => handleCategorySwitch('build')}
          >
            <span className="xt-play-cat-label">Build</span>
            <span className="xt-play-cat-count">{categoryQuests.build.length} projects</span>
          </button>
        </div>

        {/* Quest list for selected category */}
        {currentCategoryQuests.length > 0 && !selectedTask ? (
          <div className="xt-play-quest-list">
            {currentCategoryQuests.slice(0, 5).map(task => (
              <button
                key={task.id}
                className="xt-play-quest-item"
                onClick={() => setSelectedTaskId(task.id)}
              >
                <span className="xt-play-quest-item-title">{task.title}</span>
                <span className="xt-play-quest-item-meta">
                  {QUEST_TYPE_LABELS[task.questType ?? 'session']} {'\u00B7'} {PRIORITY_LABELS[task.priority]}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {/* Selected Quest Hero */}
        {selectedTask ? (
          <div className="xt-play-hero">
            {/* Timer */}
            {selectedTaskRunning ? (
              <div className="xt-play-hero-timer">
                <div className="xt-play-hero-time">{formatDuration(selectedTaskTodayMs)}</div>
                <div className="xt-play-hero-status">SESSION ACTIVE</div>
              </div>
            ) : selectedTaskTodayMs > 0 ? (
              <div className="xt-play-hero-timer" style={{ opacity: 0.5 }}>
                <div className="xt-play-hero-time" style={{ fontSize: '24px' }}>{formatDuration(selectedTaskTodayMs)}</div>
                <div className="xt-play-hero-status" style={{ color: 'var(--app-muted)' }}>TRACKED TODAY</div>
              </div>
            ) : null}

            {/* Quest title — the hero */}
            <h1 className="xt-play-hero-title">{selectedTask.title}</h1>

            {/* Tags */}
            <div className="xt-play-hero-tags">
              <span className="xt-play-hero-tag is-accent">
                {QUEST_TYPE_LABELS[selectedTask.questType ?? 'session'] ?? 'Quest'}
              </span>
              <span className="xt-play-hero-tag">{PRIORITY_LABELS[selectedTask.priority]}</span>
              <span className="xt-play-hero-tag">L{selectedTask.level ?? 1}</span>
              {selectedTask.selfTreePrimary ? (
                <span className="xt-play-hero-tag" style={{ color: BRANCH_COLORS[selectedTask.selfTreePrimary] }}>
                  {SELF_TREE_LABELS[selectedTask.selfTreePrimary]}
                </span>
              ) : null}
            </div>

            {/* Action buttons */}
            <div className="xt-play-hero-actions">
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

            {/* Stats strip — floating */}
            <div className="xt-play-hero-stats">
              <div className="xt-play-stat">
                <span className="xt-play-stat-val">{Math.floor(selectedTaskTodayMs / 60000)} min</span>
                <span className="xt-play-stat-label">today</span>
              </div>
              <div className="xt-play-stat">
                <span className="xt-play-stat-val">+{selectedTaskCompletionXP?.total ?? 0}</span>
                <span className="xt-play-stat-label">XP</span>
              </div>
              <div className="xt-play-stat">
                <span className="xt-play-stat-val">{selectedStepCounts ? `${selectedStepCounts.done}/${selectedStepCounts.total}` : '\u2014'}</span>
                <span className="xt-play-stat-label">steps</span>
              </div>
              <div className="xt-play-stat">
                <span className="xt-play-stat-val">{stats.playerLevel}</span>
                <span className="xt-play-stat-label">level</span>
              </div>
            </div>

            {/* Steps (if quest has them) */}
            {selectedTaskSteps.steps.length > 0 || selectedTask.details ? (
              <div className="xt-play-hero-steps">
                {selectedTaskSteps.steps.length > 0 ? (
                  <>
                    {selectedTaskSteps.steps.map((step, idx) => (
                      <div key={idx} className={`xt-play-step ${step.done ? 'is-done' : ''}`} onClick={() => handleToggleStep(idx)}>
                        <span className="xt-play-step-check">{step.done ? '\u2713' : ''}</span>
                        <span className="xt-play-step-text">{step.text}</span>
                      </div>
                    ))}
                    <div className="xt-play-step-add">
                      <input
                        ref={inlineStepRef}
                        placeholder="+ Add step..."
                        className="xt-play-step-input"
                        value={inlineStepValue}
                        onChange={(e) => setInlineStepValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && inlineStepValue.trim()) {
                            e.preventDefault();
                            handleInlineStepAdd();
                          } else if (e.key === 'Escape') {
                            setInlineStepValue('');
                            inlineStepRef.current?.blur();
                          }
                        }}
                      />
                    </div>
                  </>
                ) : null}
                {selectedTaskSteps.notes ? (
                  <div className="xt-play-brief">
                    <span className="xt-play-brief-label">Brief</span>
                    <p className="xt-play-brief-text">{selectedTaskSteps.notes}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Back to category list */}
            <button className="xt-play-back" onClick={() => setSelectedTaskId(null)}>
              {'\u2190'} Back to {activeCategory}
            </button>
          </div>
        ) : currentCategoryQuests.length === 0 ? (
          <div className="xt-play-empty">
            <div className="xt-play-empty-text">No {activeCategory} quests yet</div>
            <button className="xt-play-empty-btn" onClick={openCreateQuest}>
              <Plus size={14} /> Create Quest
            </button>
          </div>
        ) : null}

        {/* Bottom: vitals */}
        <div className="xt-play-bottom">
          <span className="xt-play-bottom-stat">{daySummary.minutesTracked} min today</span>
          <span className="xt-play-bottom-stat">{daySummary.completedCount} done</span>
          <span className="xt-play-bottom-stat">{momentum.currentStreak}d streak</span>
          <span className="xt-play-bottom-stat">Lv {stats.playerLevel}</span>
        </div>
      </div>

      {/* Operations drawer */}
      {rackOpen && <div className="xt-ops-rack-backdrop" onClick={() => setRackOpen(false)} />}
      <aside className={`xt-ops-rack ${rackOpen ? 'is-open' : ''}`}>
        <div className="xt-ops-rack-header">
          <span className="xt-ops-rack-label">Operations</span>
          <button type="button" onClick={openCreateQuest} className="xt-ops-rack-add" title="Full quest editor">
            <Plus size={12} />
          </button>
        </div>

        {/* Quick-add quest */}
        <div className={`xt-ops-quick-add ${quickAddFocused ? 'xt-ops-quick-add--focused' : ''}`}>
          <input
            ref={quickAddRef}
            type="text"
            placeholder="Quick add quest..."
            value={quickAddValue}
            onChange={(e) => setQuickAddValue(e.target.value)}
            onFocus={() => setQuickAddFocused(true)}
            onBlur={() => setQuickAddFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleQuickAdd();
              } else if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                const title = quickAddValue.trim();
                setQuickAddValue('');
                if (title) {
                  setEditingTaskId(null);
                  setModalOpen(true);
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
              {'\u21B5'} create {'\u00B7'} {'\u21E7\u21B5'} full editor
            </span>
          )}
        </div>

        {/* Vitals bar */}
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

        {/* Week activity tracker */}
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

        {/* Today's Focus */}
        {topTasks.length > 0 && !orderedTasks.length ? null : topTasks.length > 0 ? (
          <div className="xt-ops-focus-strip">
            <div className="xt-ops-focus-strip-head">
              <Target size={10} className="xt-ops-focus-strip-icon" />
              <span>Focus</span>
            </div>
            <div className="xt-ops-focus-strip-items">
              {topTasks.slice(0, 3).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`xt-ops-focus-item${t.id === selectedTaskId ? ' is-active' : ''}`}
                  onClick={() => setSelectedTaskId(t.id)}
                >
                  <span className="xt-ops-focus-item-dot" style={{
                    background: t.priority === 'urgent' ? 'var(--app-accent)' : t.priority === 'high' ? '#a055f5' : 'var(--app-muted)',
                  }} />
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

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
                      <span className="xt-ops-briefing-sep">{'\u00B7'}</span>
                      <span>L{task.level ?? 1}</span>
                      {todayMinutes > 0 ? (
                        <>
                          <span className="xt-ops-briefing-sep">{'\u00B7'}</span>
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

      {/* Completion Celebration Overlay */}
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
