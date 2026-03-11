import type { Task } from '../../components/XP/xpTypes';

export const STARTER_SESSION_CHECKPOINT_MIN_MS = 3 * 60 * 1000;

export interface StarterCheckpointStatus {
  landed: boolean;
  label: string;
  detail: string;
  progress: number;
  trackedLabel: string;
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
