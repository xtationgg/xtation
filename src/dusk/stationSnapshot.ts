import type { PlatformSyncStatus } from '../admin/AdminConsoleProvider';

export interface DuskStationSnapshotInput {
  signedIn: boolean;
  userLabel: string;
  stationLabel: string;
  plan: string;
  releaseChannel: string;
  platformCloudEnabled: boolean;
  platformSyncStatus: PlatformSyncStatus;
  primaryTaskId?: string | null;
  primaryTaskTitle?: string | null;
  primaryTaskPriority?: string | null;
  primaryTaskRunning?: boolean;
  openQuestCount: number;
  enabledAutomationCount: number;
  leadProjectTitle?: string | null;
  leadProjectNextAction?: string | null;
  pinnedNoteTitle?: string | null;
  activeCampaignTitle?: string | null;
}

export interface DuskStationSnapshotCue {
  label: string;
  value: string;
  detail: string;
}

export interface DuskStationSnapshot {
  headline: string;
  summary: string;
  nextAction: string;
  suggestedTitle: string;
  suggestedBody: string;
  tags: string[];
  primaryTaskId: string | null;
  cues: DuskStationSnapshotCue[];
}

const formatPlatformState = (signedIn: boolean, cloudEnabled: boolean, syncStatus: PlatformSyncStatus) => {
  if (!signedIn) return 'Local-first';
  if (!cloudEnabled) return 'Local fallback';
  if (syncStatus === 'synced') return 'Cloud synced';
  if (syncStatus === 'loading') return 'Cloud loading';
  if (syncStatus === 'saving') return 'Cloud saving';
  if (syncStatus === 'error') return 'Cloud blocked';
  return 'Local only';
};

const formatFocusDetail = (input: DuskStationSnapshotInput) => {
  if (!input.primaryTaskTitle) {
    return input.leadProjectTitle
      ? `No active quest. Lead project is ${input.leadProjectTitle}.`
      : 'No active quest yet. Dusk should help shape the next one.';
  }

  const status = input.primaryTaskRunning ? 'running now' : 'queued next';
  const priority = input.primaryTaskPriority ? ` • ${input.primaryTaskPriority}` : '';
  return `${status}${priority}`;
};

export const buildDuskStationSnapshot = (input: DuskStationSnapshotInput): DuskStationSnapshot => {
  const platformState = formatPlatformState(input.signedIn, input.platformCloudEnabled, input.platformSyncStatus);
  const effectiveLeadProject = input.leadProjectTitle || 'No lab project active';
  const effectiveLeadNote = input.pinnedNoteTitle || 'No pinned note';
  const effectiveCampaign = input.activeCampaignTitle || 'No active campaign';
  const focusTitle = input.primaryTaskTitle || 'No active quest';

  let headline = 'Build the next operation';
  let nextAction = 'Create one concrete quest and give Dusk a clearer operating target.';

  if (input.primaryTaskTitle && input.primaryTaskRunning) {
    headline = `Stay on ${input.primaryTaskTitle}`;
    nextAction = `Keep the running session on ${input.primaryTaskTitle} alive until the next concrete step is closed.`;
  } else if (input.primaryTaskTitle) {
    headline = `Resume ${input.primaryTaskTitle}`;
    nextAction = `Open ${input.primaryTaskTitle} and turn it into the next focused block instead of opening a new thread.`;
  } else if (input.leadProjectNextAction) {
    headline = `Convert ${effectiveLeadProject} into action`;
    nextAction = input.leadProjectNextAction;
  } else if (input.leadProjectTitle) {
    headline = `Move ${effectiveLeadProject} forward`;
    nextAction = `Turn the next move for ${effectiveLeadProject} into one real quest.`;
  }

  const cues: DuskStationSnapshotCue[] = [
    {
      label: 'Station',
      value: `${input.stationLabel} • ${input.plan}/${input.releaseChannel}`,
      detail: input.signedIn ? input.userLabel : 'Offline/local station mode',
    },
    {
      label: 'Cloud',
      value: platformState,
      detail: input.signedIn ? 'Account-aware station state' : 'Runs fully without account sync',
    },
    {
      label: 'Focus',
      value: input.primaryTaskTitle ? `Quest • ${focusTitle}` : focusTitle,
      detail: formatFocusDetail(input),
    },
    {
      label: 'Lab',
      value: effectiveLeadProject,
      detail: input.leadProjectNextAction || effectiveLeadNote,
    },
  ];

  const summary = `${input.openQuestCount} open quests • ${input.enabledAutomationCount} enabled rules • ${effectiveCampaign}.`;
  const suggestedTitle = input.primaryTaskTitle
    ? `Station brief: ${input.primaryTaskTitle}`
    : input.leadProjectTitle
      ? `Station brief: ${input.leadProjectTitle}`
      : 'Station brief: Next XTATION operation';

  const suggestedBody = [
    `Station: ${input.stationLabel} (${input.plan}/${input.releaseChannel})`,
    `Operator: ${input.userLabel}`,
    `Cloud state: ${platformState}`,
    `Primary focus: ${focusTitle}`,
    `Lab lead: ${effectiveLeadProject}`,
    `Pinned note: ${effectiveLeadNote}`,
    `Active campaign: ${effectiveCampaign}`,
    `Open quests: ${input.openQuestCount}`,
    `Enabled automations: ${input.enabledAutomationCount}`,
    `Recommended next action: ${nextAction}`,
  ].join('\n');

  const tags = Array.from(
    new Set(
      [
        'station',
        input.signedIn ? 'signed-in' : 'local',
        input.releaseChannel,
        input.plan,
        input.primaryTaskRunning ? 'running-quest' : input.primaryTaskTitle ? 'queued-quest' : 'no-active-quest',
        input.leadProjectTitle ? 'lab-project' : 'no-lab-project',
      ].filter(Boolean)
    )
  );

  return {
    headline,
    summary,
    nextAction,
    suggestedTitle,
    suggestedBody,
    tags,
    primaryTaskId: input.primaryTaskId || null,
    cues,
  };
};
