import type { StationActivityEntry } from './stationActivity';

const STARTER_ACTION_CHIP = 'Starter action';
const STARTER_CHECKPOINT_CHIP = 'starter-checkpoint';
const STARTER_SESSION_LIVE_CHIP = 'starter-session-live';
const MAX_STARTER_LOOP_CHIPS = 4;

export interface StationStarterFlowSummary {
  title: string;
  detail: string;
  workspaceLabel?: string | null;
  targetView?: StationActivityEntry['targetView'];
  chips: string[];
  tone: 'default' | 'accent';
  createdAt: number;
  statusLabel: 'Action confirmed' | 'Session live' | 'Checkpoint live';
  statusDetail: string;
}

export const isStarterLoopEntry = (entry: StationActivityEntry) =>
  Boolean(
    entry.chips?.includes(STARTER_ACTION_CHIP) ||
      entry.chips?.includes(STARTER_CHECKPOINT_CHIP) ||
      entry.chips?.includes(STARTER_SESSION_LIVE_CHIP)
  );

export const buildStarterLoopChips = (
  semanticChip: typeof STARTER_ACTION_CHIP | typeof STARTER_CHECKPOINT_CHIP | typeof STARTER_SESSION_LIVE_CHIP,
  chips: string[]
) => [semanticChip, ...chips.filter((chip) => chip && chip !== semanticChip)].slice(0, MAX_STARTER_LOOP_CHIPS);

export const extractStationStarterFlowSummary = (
  activity: StationActivityEntry[]
): StationStarterFlowSummary | null => {
  const entry = activity.find(isStarterLoopEntry);
  if (!entry) return null;

  const isCheckpoint = entry.chips?.includes(STARTER_CHECKPOINT_CHIP);
  const isSessionLive = entry.chips?.includes(STARTER_SESSION_LIVE_CHIP);
  const userChips = (entry.chips ?? []).filter(
    (chip) =>
      chip !== STARTER_ACTION_CHIP &&
      chip !== STARTER_CHECKPOINT_CHIP &&
      chip !== STARTER_SESSION_LIVE_CHIP
  );

  return {
    title: entry.title,
    detail: entry.detail,
    workspaceLabel: entry.workspaceLabel ?? null,
    targetView: entry.targetView ?? null,
    chips: userChips.slice(0, 3),
    tone: entry.tone === 'accent' ? 'accent' : 'default',
    createdAt: entry.createdAt,
    statusLabel: isCheckpoint ? 'Checkpoint live' : isSessionLive ? 'Session live' : 'Action confirmed',
    statusDetail: isCheckpoint
      ? 'The first routed loop has landed and XTATION is now carrying live starter progress.'
      : isSessionLive
        ? 'The first live session has started and XTATION is now tracking the starter loop in real time.'
        : 'The recommended first move has already been taken and recorded in this station.',
  };
};
