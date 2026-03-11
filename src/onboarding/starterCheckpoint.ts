import type { Task } from '../../components/XP/xpTypes';

export const STARTER_SESSION_CHECKPOINT_MIN_MS = 3 * 60 * 1000;

export interface StarterCheckpointStatus {
  landed: boolean;
  label: string;
  detail: string;
  progress: number;
  trackedLabel: string;
}

export interface StarterRelayPhase {
  state: 'armed' | 'live' | 'confirmed';
  label: string;
  detail: string;
  actionLabel: string;
  actionTone: 'accent' | 'success' | 'muted';
  actionDisabled: boolean;
}

interface StarterCheckpointOptions {
  task: Task | null | undefined;
  trackedMs?: number;
}

export const hasStarterCheckpointLanded = ({ task, trackedMs = 0 }: StarterCheckpointOptions): boolean => {
  if (!task) return false;

  if (task.status === 'done' || !!task.completedAt) {
    return true;
  }

  if (task.questType === 'instant') {
    return task.status === 'active' || !!task.startedAt || trackedMs > 0;
  }

  return trackedMs >= STARTER_SESSION_CHECKPOINT_MIN_MS;
};

const formatMinutes = (ms: number) => `${Math.max(0, Math.floor(ms / 60000))} min`;

export const buildStarterCheckpointStatus = ({
  task,
  trackedMs = 0,
}: StarterCheckpointOptions): StarterCheckpointStatus | null => {
  if (!task) return null;

  const landed = hasStarterCheckpointLanded({ task, trackedMs });

  if (task.questType === 'instant') {
    return {
      landed,
      label: landed ? 'Checkpoint landed' : 'Checkpoint armed',
      detail: landed
        ? 'The starter route is now confirmed. XTATION can hand you into the next workspace with real signal behind it.'
        : 'This instant starter checkpoints as soon as the first real activation lands.',
      progress: landed ? 1 : 0,
      trackedLabel: landed ? 'Activated' : 'Awaiting first activation',
    };
  }

  const progress = Math.max(0, Math.min(1, trackedMs / STARTER_SESSION_CHECKPOINT_MIN_MS));
  const remaining = Math.max(0, STARTER_SESSION_CHECKPOINT_MIN_MS - trackedMs);

  return {
    landed,
    label: landed ? 'Checkpoint landed' : 'Checkpoint armed',
    detail: landed
      ? 'The first real session landed. XTATION can now route you into the next workspace with a confirmed execution trace.'
      : `Keep this first session alive until the checkpoint locks. About ${formatMinutes(remaining)} of tracked work remains.`,
    progress,
    trackedLabel: `${formatMinutes(trackedMs)} / ${formatMinutes(STARTER_SESSION_CHECKPOINT_MIN_MS)}`,
  };
};

interface StarterRelayPhaseOptions extends StarterCheckpointOptions {
  running?: boolean;
  workspaceActionLabel?: string | null;
}

export const buildStarterRelayPhase = ({
  task,
  trackedMs = 0,
  running = false,
  workspaceActionLabel,
}: StarterRelayPhaseOptions): StarterRelayPhase | null => {
  if (!task) return null;

  const landed = hasStarterCheckpointLanded({ task, trackedMs });

  if (landed) {
    return {
      state: 'confirmed',
      label: 'Route confirmed',
      detail:
        'The first mission pass is now confirmed. XTATION is ready to hand you into the next workspace with real execution behind it.',
      actionLabel: workspaceActionLabel || 'Open Workspace',
      actionTone: 'success',
      actionDisabled: !workspaceActionLabel,
    };
  }

  if (running) {
    return {
      state: 'live',
      label: 'Session live',
      detail: 'Keep the first session alive until the checkpoint locks. XTATION will route the next workspace as soon as that first pass is real.',
      actionLabel: 'Checkpoint in progress',
      actionTone: 'success',
      actionDisabled: true,
    };
  }

  return {
    state: 'armed',
    label: 'Starter relay armed',
    detail:
      task.questType === 'instant'
        ? 'Trigger the first clean action to make the starter route real.'
        : 'Start the first focused session to make the starter route real.',
    actionLabel: task.questType === 'instant' ? 'Start First Action' : 'Start First Session',
    actionTone: 'accent',
    actionDisabled: false,
  };
};
