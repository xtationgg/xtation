import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import type { Project, QuestLevel, Task } from '../XP/xpTypes';
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
    addTask,
    updateTask,
    completeTask,
    resumeTaskSession,
    stopSession,
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

  const openCreateQuest = () => {
    setEditingTaskId(null);
    setModalOpen(true);
  };

  const openEditQuest = (taskId: string) => {
    setEditingTaskId(taskId);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTaskId(null);
  };

  const handleSaveQuest = (draft: {
    title: string;
    details: string;
    priority: Task['priority'];
    scheduledAt?: number;
    questType: Task['questType'];
    level: QuestLevel;
    projectId?: string;
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

  const handleRunSelectedQuest = () => {
    if (!selectedTask) return;
    resumeTaskSession(selectedTask.id);
  };

  const handleCompleteSelectedQuest = () => {
    if (!selectedTask) return;
    completeTask(selectedTask.id, {
      minutes: Math.max(0, Math.floor(selectedTaskTodayMs / 60000)),
      source: selectedTaskRunning ? 'session' : 'manual_done',
    });
    presentationEvents?.emitEvent('quest.completed', {
      source: 'user',
      metadata: {
        taskId: selectedTask.id,
        title: selectedTask.title,
        via: selectedTaskRunning ? 'session' : 'manual_done',
      },
    });
    setDebriefTaskId(selectedTask.id);
  };

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

  return (
    <div className="xt-play-shell">
      <div className="xt-play-frame">
        <section className="xt-play-command">
          <div className="xt-play-grid">
            <div className="flex flex-col gap-4">
              <div className="xt-play-hero">
                <div className="max-w-3xl">
                  <div className="xt-play-kicker">Play / Action Room</div>
                  <h1 className="xt-play-title">
                    {selectedTask ? selectedTask.title : 'Ready for the next operation'}
                  </h1>
                  <p className="xt-play-detail">
                    {selectedTask
                      ? selectedTaskSteps.notes || 'Move the selected quest forward, keep the session clean, and close the loop with a proper debrief.'
                      : 'Create one clear quest, start a session, and let Xtation turn execution into visible progress.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <PlayActionButton label="New Quest" onClick={openCreateQuest} icon={<Plus size={14} />} tone="accent" />
                  {selectedTask ? (
                    <PlayActionButton label="Edit" onClick={() => openEditQuest(selectedTask.id)} icon={<Pencil size={14} />} />
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                <PlayPanel title="Primary operation" subtitle={selectedTask ? 'Selected quest' : 'No quest armed'}>
                  {onboardingHandoff && starterTask ? (
                    <div className="xt-play-callout mb-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="max-w-2xl">
                          <div className="xt-play-panel-eyebrow text-[var(--app-accent)]">Starter Relay</div>
                          <div className="mt-2 text-lg font-semibold text-[var(--app-text)]">
                            {starterCheckpointStatus?.landed
                              ? `${starterTrackLabel} confirmed for ${onboardingHandoff.branch}`
                              : starterTaskRunning
                                ? `${starterTrackLabel} live in ${onboardingHandoff.branch}`
                                : `${starterTrackLabel} armed for ${onboardingHandoff.branch}`}
                          </div>
                          <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
                            {starterRelayPhase?.detail ||
                              (onboardingHandoff.nodeTitle
                                ? `You seeded ${onboardingHandoff.nodeTitle} under ${onboardingHandoff.branch}. Take the first clean action so XTATION can start building real momentum.`
                                : `You seeded the first loop under ${onboardingHandoff.branch}. Take the first clean action so XTATION can start building real momentum.`)}
                          </div>
                          {stationIdentity ? (
                            <div className="mt-4 grid gap-2">
                              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-accent)]">
                                Current station
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="xt-play-tag justify-start text-left normal-case tracking-[0.04em] leading-5">
                                  {stationIdentity.modeLabel} • {stationIdentity.workspaceLabel}
                                </span>
                                {stationIdentity.chips.slice(0, 2).map((chip) => (
                                  <span
                                    key={`starter-station-${chip}`}
                                    className="xt-play-tag justify-start text-left normal-case tracking-[0.04em] leading-5"
                                  >
                                    {chip}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {starterRoute ? (
                            <div className="mt-4 grid gap-2">
                              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-accent)]">
                                {starterRoute.label}
                              </div>
                              <div className="grid gap-2 md:grid-cols-3">
                                {starterRoute.steps.map((step, index) => (
                                  <div
                                    key={step}
                                    className="xt-play-tag justify-start text-left normal-case tracking-[0.04em] leading-5"
                                  >
                                    {index + 1}. {step}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {starterCheckpointStatus ? (
                            <div className="xt-play-starter-checkpoint">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="xt-play-panel-eyebrow text-[var(--app-accent)]">
                                    {starterCheckpointStatus.label}
                                  </div>
                                  <div className="mt-2 text-sm leading-6 text-[var(--app-text)]">
                                    {starterCheckpointStatus.detail}
                                  </div>
                                </div>
                                <div className="xt-play-tag justify-start text-left normal-case tracking-[0.04em]">
                                  {starterCheckpointStatus.trackedLabel}
                                </div>
                              </div>
                              <div className="xt-play-starter-progress mt-3">
                                <div
                                  className="xt-play-starter-progress__fill"
                                  style={{ width: `${Math.round(starterCheckpointStatus.progress * 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <PlayActionButton
                            label={starterRelayPhase?.actionLabel ?? 'Start First Session'}
                            onClick={() => {
                              if (starterCheckpointStatus?.landed) {
                                if (!starterRoute || !onOpenWorkspace || !onboardingHandoff) return;
                                openStarterWorkspaceCue(buildStarterWorkspaceCue(onboardingHandoff));
                                onOpenWorkspace(starterRoute.workspaceView);
                                return;
                              }
                              setSelectedTaskId(starterTask.id);
                              if (!starterTaskRunning) {
                                resumeTaskSession(starterTask.id);
                              }
                            }}
                            icon={starterCheckpointStatus?.landed ? <ChevronRight size={14} /> : <PlayCircle size={14} />}
                            tone={starterRelayPhase?.actionTone ?? 'accent'}
                            disabled={starterRelayPhase?.actionDisabled}
                          />
                          <PlayActionButton
                            label="Brief Dusk"
                            onClick={() =>
                              openDuskBrief({
                                title: `Starter relay: ${starterTask.title}`,
                                body: `You just seeded the first XTATION loop.\n\nBranch: ${onboardingHandoff.branch}\nTrack: ${starterTrackLabel}\nQuest: ${starterTask.title}\n${onboardingHandoff.nodeTitle ? `Growth node: ${onboardingHandoff.nodeTitle}\n` : ''}\nHelp me turn this into a clean next action plan.`,
                                source: 'play',
                                tags: ['starter-relay', onboardingHandoff.track, onboardingHandoff.branch.toLowerCase()],
                                linkedQuestIds: [starterTask.id],
                                createdAt: onboardingHandoff.createdAt,
                              })
                            }
                            icon={<Sparkles size={14} />}
                          />
                          {starterRoute && onOpenWorkspace ? (
                            <PlayActionButton
                              label={starterRoute.workspaceAction}
                              onClick={() => {
                                if (!onboardingHandoff) return;
                                openStarterWorkspaceCue(buildStarterWorkspaceCue(onboardingHandoff));
                                onOpenWorkspace(starterRoute.workspaceView);
                              }}
                              icon={<ChevronRight size={14} />}
                            />
                          ) : null}
                          {onDismissOnboardingHandoff ? (
                            <PlayActionButton label="Dismiss" onClick={onDismissOnboardingHandoff} tone="muted" />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {selectedTask ? (
                    <div className="flex h-full flex-col gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="xt-play-tag xt-play-tag--accent">
                          {QUEST_TYPE_LABELS[selectedTask.questType ?? 'session'] ?? 'Quest'}
                        </span>
                        <span className="xt-play-tag">
                          {PRIORITY_LABELS[selectedTask.priority]}
                        </span>
                        <span className="xt-play-tag">
                          L{selectedTask.level ?? 1} · {LEVEL_LABELS[selectedTask.level ?? 1]}
                        </span>
                        {selectedTask.selfTreePrimary ? (
                          <span className="xt-play-tag">
                            {SELF_TREE_LABELS[selectedTask.selfTreePrimary]}
                          </span>
                        ) : null}
                      </div>

                      {urgentPresentationSignal ? (
                        <div className="xt-play-callout">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.22em] text-[#ffb47a]">Urgent Watch</div>
                              <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">
                                {urgentPresentationSignal.title}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-[color-mix(in_srgb,var(--app-text)_74%,#ffbf8f)]">
                                {urgentPresentationSignal.reason === 'urgent_overdue'
                                  ? `Urgent priority and already late by ${urgentPresentationSignal.latenessMinutes} min.`
                                  : urgentPresentationSignal.reason === 'overdue_schedule'
                                  ? `Scheduled window slipped by ${urgentPresentationSignal.latenessMinutes} min.`
                                  : 'Marked urgent and ready for immediate attention.'}
                              </div>
                            </div>
                            <PlayActionButton label="Focus Alert" onClick={() => setSelectedTaskId(urgentPresentationSignal.taskId)} tone="accent" />
                          </div>
                        </div>
                      ) : null}

                      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                        <div className="xt-play-callout">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">
                                {selectedTaskRunning ? 'Active Session' : 'Focus Control'}
                              </div>
                              <div className="mt-2 text-4xl font-semibold tracking-[0.08em] text-[var(--app-text)] md:text-5xl">
                                {selectedTaskRunning && activeSession
                                  ? formatDuration(selectors.getSessionDisplayMs(activeSession, now))
                                  : formatDuration(selectedTaskTodayMs)}
                              </div>
                              <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                                {selectedTaskRunning
                                  ? 'Tracking live focus on this quest'
                                  : selectedTaskTodayMs > 0
                                  ? 'Tracked today on this quest'
                                  : 'No active time on this quest yet'}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <PlayActionButton
                                label={selectedTaskRunning ? 'Pause Session' : activeSession ? 'Switch and Start' : 'Start Session'}
                                onClick={selectedTaskRunning ? stopSession : handleRunSelectedQuest}
                                icon={selectedTaskRunning ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                                tone="accent"
                              />
                              <PlayActionButton
                                label="Complete Quest"
                                onClick={handleCompleteSelectedQuest}
                                icon={<CheckCircle2 size={16} />}
                                tone="success"
                              />
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <SummaryCell label="Today" value={`${Math.floor(selectedTaskTodayMs / 60000)} min`} />
                            <SummaryCell
                              label="Completion XP"
                              value={`+${selectedTaskCompletionXP?.total ?? 0}`}
                              accent="text-[var(--app-accent)]"
                            />
                            <SummaryCell
                              label="Steps"
                              value={
                                selectedStepCounts ? `${selectedStepCounts.done}/${selectedStepCounts.total}` : '0/0'
                              }
                            />
                          </div>
                        </div>

                        <div className="xt-play-subpanel">
                          <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Execution Brief</div>
                          <div className="mt-3 flex flex-col gap-3 text-sm text-[var(--app-text)]">
                            <div className="flex items-start gap-3">
                              <Calendar size={15} className="mt-[2px] text-[var(--app-accent)]" />
                              <div>
                                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Schedule</div>
                                <div className="mt-1">{formatAbsoluteDate(selectedTask.scheduledAt)}</div>
                                {selectedTask.scheduledAt ? (
                                  <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--app-accent)]">
                                    {formatRelativeSchedule(selectedTask.scheduledAt, now)}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <FolderKanban size={15} className="mt-[2px] text-[var(--app-accent)]" />
                              <div>
                                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Project</div>
                                <div className="mt-1">{selectedTaskProject?.title || 'Standalone quest'}</div>
                                {selectedProjectProgress ? (
                                  <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                    {selectedProjectProgress.done}/{selectedProjectProgress.total} quests complete · {selectedProjectProgress.pct}%
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <Sparkles size={15} className="mt-[2px] text-[var(--app-accent)]" />
                              <div>
                                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Quest Mode</div>
                                <div className="mt-1">
                                  {selectedTask.questType === 'instant'
                                    ? 'Direct completion with clean finish bonus.'
                                    : 'Timed session flow with momentum and focus bonuses.'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="xt-play-subpanel">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Step Flow</div>
                          {selectedStepCounts ? (
                            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                              {selectedStepCounts.done}/{selectedStepCounts.total} complete
                            </div>
                          ) : null}
                        </div>

                        {selectedTaskSteps.steps.length ? (
                          <div className="mt-3 grid gap-2">
                            {selectedTaskSteps.steps.map((step, index) => (
                              <button
                                key={`${selectedTask.id}-step-${index}`}
                                type="button"
                                onClick={() => handleToggleStep(index)}
                                className={`xt-play-list-row text-left transition-colors ${
                                  step.done
                                    ? 'border-[color-mix(in_srgb,#43d39e_34%,transparent)] bg-[color-mix(in_srgb,#43d39e_10%,transparent)]'
                                    : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_72%,transparent)] hover:border-[var(--app-accent)]'
                                }`}
                              >
                                <span
                                  className={`mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                    step.done
                                      ? 'border-[#43d39e66] bg-[#43d39e22] text-[#90efc4]'
                                      : 'border-[var(--app-border)] text-[var(--app-muted)]'
                                  }`}
                                >
                                  {step.done ? <CheckCircle2 size={12} /> : <ChevronRight size={12} />}
                                </span>
                                <span className={`text-sm leading-5 ${step.done ? 'text-[var(--app-muted)] line-through' : 'text-[var(--app-text)]'}`}>
                                  {step.text}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 rounded-2xl border border-dashed border-[var(--app-border)] px-4 py-5 text-sm text-[var(--app-muted)]">
                            No checklist yet. Open edit to add steps and turn this quest into a cleaner operation flow.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="xt-play-empty">
                      <div className="xt-play-panel-eyebrow text-[var(--app-accent)]">No quest selected</div>
                      <h2 className="mt-3 text-2xl font-semibold text-[var(--app-text)]">Build the first operation</h2>
                      <p className="mt-3 max-w-md text-sm leading-6 text-[var(--app-muted)]">
                        Start with one clear quest. Once it exists, Play becomes the live execution room for timing,
                        steps, debrief, and momentum.
                      </p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <PlayActionButton label="Create First Quest" onClick={openCreateQuest} icon={<Plus size={14} />} tone="accent" />
                      </div>
                      {onOpenGuidedSetup ? (
                        <div className="mt-3">
                          <PlayActionButton label="Guided Setup" onClick={onOpenGuidedSetup} icon={<Sparkles size={14} />} />
                        </div>
                      ) : null}
                    </div>
                  )}
                </PlayPanel>

                <div className="flex flex-col gap-4">
                  {focusPulseEnabled ? (
                    <PlayPanel title="Focus Pulse" subtitle="Compact execution HUD">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="mt-2 text-lg font-semibold text-[var(--app-text)]">
                            {selectedTaskRunning
                              ? 'Session live'
                              : selectedTask
                                ? activeSession
                                  ? 'Ready to switch'
                                  : 'Ready to launch'
                                : 'No quest armed'}
                          </div>
                          <div className="mt-1 text-sm leading-6 text-[var(--app-muted)]">
                            {selectedTask
                              ? shortText(
                                  selectedTaskSteps.notes,
                                  selectedTaskRunning
                                    ? 'Keep the active session clean and finish with a proper debrief.'
                                    : 'Use this quest as the next clean focus loop.',
                                  96
                                )
                              : 'Create a clear quest to wake up the compact focus HUD.'}
                          </div>
                        </div>
                        <div className="rounded-full border border-[color-mix(in_srgb,var(--app-accent)_28%,transparent)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">
                          x{momentum.streakMultiplier.toFixed(2)}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <SummaryCell
                          label="State"
                          value={selectedTaskRunning ? 'LIVE' : selectedTask ? 'READY' : 'IDLE'}
                          accent={selectedTaskRunning ? 'text-[var(--app-accent)]' : undefined}
                        />
                        <SummaryCell label="Tracked" value={`${Math.floor(selectedTaskTodayMs / 60000)} min`} />
                        <SummaryCell
                          label="Next"
                          value={selectedStepCounts ? `${selectedStepCounts.done}/${selectedStepCounts.total}` : '0/0'}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedTask ? (
                          <PlayActionButton
                            label={selectedTaskRunning ? 'Pause' : 'Run'}
                            onClick={selectedTaskRunning ? stopSession : handleRunSelectedQuest}
                            icon={selectedTaskRunning ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                            tone="accent"
                          />
                        ) : (
                          <PlayActionButton label="Create Quest" onClick={openCreateQuest} icon={<Plus size={14} />} tone="accent" />
                        )}
                        <div className="xt-play-chip">
                          {selectedTask?.priority ? `${PRIORITY_LABELS[selectedTask.priority]} priority` : 'No queue'}
                        </div>
                      </div>
                    </PlayPanel>
                  ) : null}

                  {briefStackEnabled ? (
                    <PlayPanel
                      title="Brief Stack"
                      subtitle="Recent Dusk context that can steer the next execution pass."
                      action={<div className="xt-play-chip">{latestBrief ? latestBrief.source : 'empty'}</div>}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div />
                      </div>

                      {latestBrief ? (
                        <div className="mt-4 space-y-3">
                          <div className="xt-play-callout">
                            <div className="text-sm font-medium text-[var(--app-text)]">{latestBrief.title}</div>
                            <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
                              {shortText(latestBrief.body, 'No body captured.', 180)}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                              {latestBrief.tags?.slice(0, 3).map((tag) => (
                                <span key={tag} className="rounded-full border border-[var(--app-border)] px-2.5 py-1">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-4 py-3">
                              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Linked Quest</div>
                              <div className="mt-2 text-sm text-[var(--app-text)]">{latestBriefQuest?.title || 'No quest linked yet'}</div>
                            </div>
                            <div className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-4 py-3">
                              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Linked Project</div>
                              <div className="mt-2 text-sm text-[var(--app-text)]">{latestBriefProject?.title || 'No project linked yet'}</div>
                            </div>
                          </div>

                          <PlayActionButton
                            label="Reopen In Dusk"
                            onClick={() =>
                              openDuskBrief({
                                title: latestBrief.title,
                                body: latestBrief.body,
                                source: latestBrief.source,
                                tags: latestBrief.tags,
                                linkedQuestIds: latestBrief.linkedQuestIds,
                                linkedProjectIds: latestBrief.linkedProjectIds,
                                createdAt: latestBrief.createdAt,
                              })
                            }
                            icon={<Sparkles size={14} />}
                            tone="accent"
                          />
                        </div>
                      ) : (
                        <div className="xt-play-empty mt-4 min-h-0 px-4 py-5 text-left">
                          No brief stacked yet. Send one from Lab to keep execution context close to Play.
                        </div>
                      )}
                    </PlayPanel>
                  ) : null}

                  <PlayPanel title="Today Pulse" subtitle="Current execution signal">
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <SummaryCell label="Tracked" value={`${daySummary.minutesTracked} min`} />
                      <SummaryCell label="XP Today" value={`${selectors.getTodayXP(dateKey)}`} accent="text-[var(--app-accent)]" />
                      <SummaryCell label="Completed" value={`${daySummary.completedCount}`} />
                      <SummaryCell label="Active Days" value={`${momentum.weeklyActiveDays}`} />
                    </div>

                    <div className="xt-play-callout mt-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-accent)]">
                        <Trophy size={13} />
                        Momentum
                      </div>
                      <div className="mt-2 text-lg font-semibold text-[var(--app-text)]">
                        {momentum.currentStreak} day streak · x{momentum.streakMultiplier.toFixed(2)}
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                        Player level {stats.playerLevel} · {stats.totalEarnedXP} total XP
                      </div>
                    </div>
                  </PlayPanel>

                  <PlayPanel title="Project Context" subtitle="Campaign-level structure">
                    {selectedTaskProject ? (
                      <div className="mt-3 flex flex-col gap-3">
                        <div>
                          <div className="text-lg font-semibold text-[var(--app-text)]">{selectedTaskProject.title}</div>
                          <div className="mt-1 text-sm text-[var(--app-muted)]">{selectedTaskProject.type} project</div>
                        </div>
                        {selectedProjectProgress ? (
                          <div className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_78%,transparent)] px-4 py-3">
                            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                              <span>Quest progress</span>
                              <span>{selectedProjectProgress.pct}%</span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--app-border)_55%,transparent)]">
                              <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,var(--app-accent),color-mix(in_srgb,var(--app-accent)_60%,#ffffff))]"
                                style={{ width: `${selectedProjectProgress.pct}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                        <div className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_78%,transparent)] px-4 py-3">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Milestones</div>
                          <div className="mt-2 text-sm text-[var(--app-text)]">
                            {selectedProjectMilestones.filter((milestone) => milestone.isCompleted).length}/
                            {selectedProjectMilestones.length} completed
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-dashed border-[var(--app-border)] px-4 py-5 text-sm text-[var(--app-muted)]">
                        This quest is running standalone. Link it to a project when you want campaign-level structure and milestone tracking.
                      </div>
                    )}
                  </PlayPanel>

                  <PlayPanel title="Recent Output" subtitle="Latest recorded execution">
                    <div className="mt-3 flex flex-col gap-2">
                      {recentActivity.length ? (
                        recentActivity.map((entry) => (
                          <div
                            key={entry.key}
                            className="rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-3 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-[var(--app-text)]">{entry.title}</div>
                                <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                  {entry.latestStatusLabel}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-sm font-semibold text-[var(--app-accent)]">{entry.totalMinutes} min</div>
                                <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                  {new Date(entry.latestAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-[var(--app-border)] px-4 py-5 text-sm text-[var(--app-muted)]">
                          No activity yet today. The next clean session will start building the trace.
                        </div>
                      )}
                    </div>
                  </PlayPanel>
                </div>
              </div>
            </div>

            <PlayPanel
              title="Quest Queue"
              subtitle="Select the next operation, or switch live if something else is more urgent."
              action={<div className="xt-play-chip">{orderedTasks.length} active</div>}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                {orderedTasks.length ? (
                  orderedTasks.map((task) => {
                    const stepCounts = getQuestStepCounts(task.details);
                    const project = task.projectId ? projects.find((item) => item.id === task.projectId) ?? null : null;
                    const running = isRunningTask(task, activeSessionTaskIds);
                    const todayMinutes = Math.floor(selectors.getTaskTodayMs(task.id, dateKey, now) / 60000);
                    const isSelected = task.id === selectedTaskId;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => setSelectedTaskId(task.id)}
                        className={`xt-play-queue-item ${
                          isSelected
                            ? 'xt-play-queue-item--selected'
                            : ''
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-[15px] font-medium text-[var(--app-text)]">{task.title}</div>
                              {running ? (
                                <span className="xt-play-tag xt-play-tag--accent">
                                  Live
                                </span>
                              ) : null}
                            </div>
                            <div className="xt-play-queue-meta">
                              <span>{QUEST_TYPE_LABELS[task.questType ?? 'session']}</span>
                              <span>•</span>
                              <span>{PRIORITY_LABELS[task.priority]}</span>
                              <span>•</span>
                              <span>L{task.level ?? 1}</span>
                              {project ? (
                                <>
                                  <span>•</span>
                                  <span>{project.title}</span>
                                </>
                              ) : null}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="text-sm font-semibold text-[var(--app-accent)]">{todayMinutes} min</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                              today
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[var(--app-muted)]">
                          {stepCounts ? (
                            <span>{stepCounts.done}/{stepCounts.total} steps</span>
                          ) : (
                            <span>No steps yet</span>
                          )}
                          {task.scheduledAt ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock3 size={12} />
                              {formatAbsoluteDate(task.scheduledAt)}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-[22px] border border-dashed border-[var(--app-border)] px-4 py-6 text-sm text-[var(--app-muted)]">
                    No active quests yet. Start with one concrete objective and the rest of Play will open up around it.
                  </div>
                )}
              </div>

              {topTasks.length ? (
                <div className="xt-play-subpanel mt-5">
                  <div className="xt-play-panel-eyebrow">Top Focus Today</div>
                  <div className="mt-3 flex flex-col gap-2">
                    {topTasks.map((task) => (
                      <div key={task.taskId} className="xt-play-list-row">
                        <div className="min-w-0">
                          <div className="truncate text-sm text-[var(--app-text)]">{task.title}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                            {task.category}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold text-[var(--app-accent)]">{task.minutes} min</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                            {task.running ? 'live' : 'today'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </PlayPanel>
          </div>
        </section>
      </div>

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
