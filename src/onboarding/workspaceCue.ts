import { ClientView } from '../../types';
import type { XtationOnboardingHandoff } from './storage';
import type { StarterCheckpointStatus } from './starterCheckpoint';

export interface XtationStarterWorkspaceRoute {
  label: string;
  workspaceView: ClientView.PROFILE | ClientView.LAB;
  workspaceAction: string;
  steps: string[];
}

export interface XtationStarterSeededTransition {
  title: string;
  detail: string;
  workspaceLabel: string;
  targetView: ClientView.LOBBY;
  chips: string[];
  tone: 'accent';
}

export interface XtationStarterSessionLiveTransition {
  title: string;
  detail: string;
  workspaceLabel: string;
  targetView: ClientView.LOBBY;
  chips: string[];
  tone: 'accent';
}

export type XtationStarterWorkspaceActionTarget =
  | 'profile:stats'
  | 'profile:loadout'
  | 'lab:knowledge'
  | 'lab:workspace';

export interface XtationStarterWorkspaceCue {
  source: 'starter-relay';
  mode: 'launch' | 'checkpoint';
  workspaceView: ClientView.PROFILE | ClientView.LAB;
  title: string;
  detail: string;
  recommendedLabel: string;
  recommendedDetail: string;
  recommendedActionLabel: string;
  recommendedActionTarget: XtationStarterWorkspaceActionTarget;
  chips: string[];
  steps: string[];
  questId: string;
  questTitle: string;
  branch: XtationOnboardingHandoff['branch'];
  track: XtationOnboardingHandoff['track'];
  nodeTitle?: string;
  checkpointLabel?: string;
  checkpointDetail?: string;
  checkpointProgress?: number;
  checkpointTrackedLabel?: string;
  checkpointOutcomeLabel?: string;
  checkpointOutcomeDetail?: string;
  createdAt: number;
}

export const STARTER_WORKSPACE_CUE_EVENT = 'xtation:starter-workspace-cue';
export const STARTER_WORKSPACE_ACTION_EVENT = 'xtation:starter-workspace-action';
export const STARTER_WORKSPACE_DISMISS_EVENT = 'xtation:starter-workspace-dismiss';
const STARTER_WORKSPACE_CUE_STORAGE_KEY = 'xtation.starter-workspace-cue';
const STARTER_WORKSPACE_ACTION_STORAGE_KEY = 'xtation.starter-workspace-action';

export interface XtationStarterWorkspaceAction {
  workspaceView: ClientView.PROFILE | ClientView.LAB;
  target: XtationStarterWorkspaceActionTarget;
  source: 'shell' | 'profile' | 'lab';
  createdAt: number;
}

export interface XtationStarterWorkspaceActionDescriptor {
  title: string;
  detail: string;
  chips: string[];
  tone: 'default' | 'accent';
}

export const formatStarterWorkspaceCueEyebrow = (cue: XtationStarterWorkspaceCue) =>
  cue.mode === 'checkpoint' ? 'Starter checkpoint' : 'Starter route';

export const describeStarterWorkspaceAction = (
  cue: XtationStarterWorkspaceCue | null | undefined,
  target: XtationStarterWorkspaceActionTarget
): XtationStarterWorkspaceActionDescriptor => {
  switch (target) {
    case 'profile:stats':
      return {
        title: 'Stats lane open',
        detail:
          cue?.mode === 'checkpoint'
            ? 'The first repetition is confirmed. Use the stats lane to read branch signal and keep momentum visible.'
            : 'The stats lane is open. Use it to read branch signal and confirm the first visible gain.',
        chips: ['Starter action', cue?.track ?? 'practice', cue?.branch?.toLowerCase() ?? 'profile'],
        tone: cue?.mode === 'checkpoint' ? 'accent' : 'default',
      };
    case 'profile:loadout':
      return {
        title: 'Loadout lane open',
        detail:
          cue?.mode === 'checkpoint'
            ? 'The first loop is now live. Use the loadout lane to confirm shell readiness around the seeded quest.'
            : 'The loadout lane is open. Use it to confirm shell readiness around the seeded quest.',
        chips: ['Starter action', cue?.track ?? 'mission', cue?.branch?.toLowerCase() ?? 'profile'],
        tone: cue?.mode === 'checkpoint' ? 'accent' : 'default',
      };
    case 'lab:workspace':
      return {
        title: 'Workspace open',
        detail: 'The workshop is open. Use the brief lane to decide what should become a durable operating record next.',
        chips: ['Starter action', cue?.track ?? 'system', cue?.branch?.toLowerCase() ?? 'lab'],
        tone: cue?.mode === 'checkpoint' ? 'accent' : 'default',
      };
    case 'lab:knowledge':
    default:
      return {
        title: 'Knowledge open',
        detail:
          cue?.mode === 'checkpoint'
            ? 'The first system pass is confirmed. Capture the pattern now while the session trace is still fresh.'
            : 'Knowledge is open. Capture the pattern, note, or baseline before the first session context fades.',
        chips: ['Starter action', cue?.track ?? 'system', cue?.branch?.toLowerCase() ?? 'lab'],
        tone: cue?.mode === 'checkpoint' ? 'accent' : 'default',
      };
  }
};

const getCueStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;

  try {
    if (window.sessionStorage) return window.sessionStorage;
  } catch {
    // Ignore session storage access problems.
  }

  try {
    if (window.localStorage) return window.localStorage;
  } catch {
    // Ignore local storage access problems.
  }

  return null;
};

export const buildStarterWorkspaceRoute = (
  handoff: XtationOnboardingHandoff
): XtationStarterWorkspaceRoute => {
  switch (handoff.track) {
    case 'practice':
      return {
        label: 'Practice route',
        workspaceView: ClientView.PROFILE,
        workspaceAction: 'Open Profile',
        steps: [
          'Start one clean session and log the first visible repetition.',
          'Use the branch and node as the anchor for repeated momentum.',
          'Review the station shell in Profile after the first loop lands.',
        ],
      };
    case 'system':
      return {
        label: 'System route',
        workspaceView: ClientView.LAB,
        workspaceAction: 'Open Lab',
        steps: [
          'Start the first session so the system quest becomes real work.',
          'Capture the operating pattern you want to repeat next in Lab.',
          'Turn the baseline into a reusable rule, template, or note.',
        ],
      };
    case 'mission':
    default:
      return {
        label: 'Mission route',
        workspaceView: ClientView.PROFILE,
        workspaceAction: 'Open Profile',
        steps: [
          'Start the first focused session and make the mission visibly real.',
          'Use Dusk only to tighten the next move, not to replace execution.',
          'Return to Profile after the first win so the branch has real history.',
        ],
      };
  }
};

const formatStarterTrackLabel = (track: XtationOnboardingHandoff['track']) => {
  switch (track) {
    case 'practice':
      return 'Practice';
    case 'system':
      return 'System';
    case 'mission':
    default:
      return 'Mission';
  }
};

const formatWorkspaceLabel = (view: ClientView.PROFILE | ClientView.LAB) =>
  view === ClientView.LAB ? 'Lab' : 'Profile';

export const buildStarterSeededTransition = (
  handoff: XtationOnboardingHandoff
): XtationStarterSeededTransition => {
  const route = buildStarterWorkspaceRoute(handoff);
  const trackLabel = formatStarterTrackLabel(handoff.track);
  const nextWorkspaceLabel = formatWorkspaceLabel(route.workspaceView);
  const actionPhrase = route.workspaceView === ClientView.LAB ? 'to open Lab' : 'to open Profile';

  return {
    title: 'Starter loop seeded',
    detail: `${handoff.title} is now armed in Play. XTATION will route the first confirmed ${trackLabel.toLowerCase()} pass into ${nextWorkspaceLabel} ${actionPhrase}.`,
    workspaceLabel: 'Play',
    targetView: ClientView.LOBBY,
    chips: [trackLabel, handoff.branch, `${nextWorkspaceLabel} next`, 'Play armed'],
    tone: 'accent',
  };
};

export const buildStarterSkippedTransition = () => ({
  title: 'Starter setup skipped',
  detail:
    'XTATION left the local Play station open without seeding a starter loop. You can return to guided setup any time from Play.',
  workspaceLabel: 'Play',
  targetView: ClientView.LOBBY,
  chips: ['Play open', 'Setup skipped', 'Offline-first'],
  tone: 'default' as const,
});

export const buildStarterSessionLiveTransition = (
  handoff: XtationOnboardingHandoff,
  checkpointStatus: StarterCheckpointStatus | null | undefined
): XtationStarterSessionLiveTransition => {
  const route = buildStarterWorkspaceRoute(handoff);
  const trackLabel = formatStarterTrackLabel(handoff.track);
  const nextWorkspaceLabel = formatWorkspaceLabel(route.workspaceView);
  const checkpointDetail = checkpointStatus?.detail ?? 'Keep the first session alive until the checkpoint lands.';

  return {
    title: 'First session live',
    detail: `${handoff.title} is now live in Play. ${checkpointDetail} XTATION will hand the first confirmed ${trackLabel.toLowerCase()} pass into ${nextWorkspaceLabel}.`,
    workspaceLabel: 'Play',
    targetView: ClientView.LOBBY,
    chips: [trackLabel, handoff.branch, 'Session live', `${nextWorkspaceLabel} pending`],
    tone: 'accent',
  };
};

export const buildStarterWorkspaceCue = (
  handoff: XtationOnboardingHandoff,
  options?: {
    mode?: 'launch' | 'checkpoint';
    checkpointStatus?: StarterCheckpointStatus | null;
  }
): XtationStarterWorkspaceCue => {
  const route = buildStarterWorkspaceRoute(handoff);
  const isLabRoute = route.workspaceView === ClientView.LAB;
  const mode = options?.mode ?? 'launch';
  const checkpointStatus = mode === 'checkpoint' ? options?.checkpointStatus ?? null : null;
  const checkpointOutcomeLabel =
    mode === 'checkpoint'
      ? isLabRoute
        ? 'Lab route live'
        : 'Profile route live'
      : undefined;
  const checkpointOutcomeDetail =
    mode === 'checkpoint'
      ? isLabRoute
        ? handoff.nodeTitle
          ? `${handoff.nodeTitle} now has a confirmed first pass. Lab is the live workshop for locking the pattern while it is still fresh.`
          : 'The first system pass is confirmed. Lab is now the live workshop for locking the pattern while it is still fresh.'
        : handoff.track === 'practice'
          ? handoff.nodeTitle
            ? `${handoff.nodeTitle} now has a confirmed first repetition. Profile is the live station for reading branch signal and shell readiness.`
            : 'The first repetition is confirmed. Profile is now the live station for reading branch signal and shell readiness.'
          : handoff.nodeTitle
            ? `${handoff.nodeTitle} now has a confirmed first trace. Profile is the live station for shell readiness and visible history.`
            : 'The first focused pass is confirmed. Profile is now the live station for shell readiness and visible history.'
      : undefined;

  return {
    source: 'starter-relay',
    mode,
    workspaceView: route.workspaceView,
    title:
      mode === 'checkpoint'
        ? isLabRoute
          ? 'First loop landed. Continue in Lab'
          : handoff.track === 'practice'
            ? 'First repetition landed. Continue in Profile'
            : 'First loop landed. Continue in Profile'
        : isLabRoute
          ? 'Starter route opened in Lab'
          : 'Starter route opened in Profile',
    detail:
      mode === 'checkpoint'
        ? isLabRoute
          ? handoff.nodeTitle
            ? `${handoff.nodeTitle} has real motion now. Capture the operating pattern while the first pass is still fresh.`
            : `The first system pass has landed. Move into Lab and lock the operating pattern before it fades.`
          : handoff.track === 'practice'
            ? handoff.nodeTitle
              ? `${handoff.nodeTitle} has its first visible rep. Use Profile to confirm branch signal, shell status, and momentum.`
              : `The first repetition has landed. Use Profile to make the gain visible and keep the loop honest.`
            : handoff.nodeTitle
              ? `${handoff.nodeTitle} now has real history. Use Profile to confirm shell readiness, loadout, and visible progress.`
              : `The first focused pass has landed. Use Profile to confirm shell readiness and visible progress before the next loop.`
        : isLabRoute
          ? handoff.nodeTitle
            ? `${handoff.nodeTitle} now needs a reusable operating record. Capture the first pattern here before the session context fades.`
            : `This system track belongs in Lab after the first action. Capture the pattern, note, or rule that should repeat.`
          : handoff.nodeTitle
            ? `${handoff.nodeTitle} now needs visible history. Use Profile to anchor the branch, loadout state, and first confirmed gain.`
            : `This starter loop belongs in Profile after the first action. Use it to anchor visible progress, branch history, and shell readiness.`,
    recommendedLabel:
      mode === 'checkpoint'
        ? isLabRoute
          ? 'Lock the first operating pattern'
          : handoff.track === 'practice'
            ? 'Confirm the first gain'
            : 'Lock shell readiness'
        : isLabRoute
          ? 'Capture the operating pattern'
          : handoff.track === 'practice'
            ? 'Review the branch signal'
            : 'Review shell readiness',
    recommendedDetail:
      mode === 'checkpoint'
        ? isLabRoute
          ? 'Open Knowledge and turn this first real pass into a durable note, baseline, or operating pattern while the details are still fresh.'
          : handoff.track === 'practice'
            ? 'Open the stats lane and confirm the first repetition landed so the branch starts building visible momentum.'
            : 'Open the loadout lane and confirm the station shell, badge, and readiness state now that the first pass is real.'
        : isLabRoute
          ? 'Move into Knowledge and turn this seeded system quest into a durable note, baseline, or operating pattern before context fades.'
          : handoff.track === 'practice'
            ? 'Open the stats lane and confirm the first repetition landed so the branch starts building visible momentum.'
            : 'Open the loadout lane and confirm the station shell, badge, and readiness state around the quest you just seeded.',
    recommendedActionLabel: isLabRoute ? 'Open Knowledge' : handoff.track === 'practice' ? 'Open Stats' : 'Open Loadout',
    recommendedActionTarget: isLabRoute
      ? 'lab:knowledge'
      : handoff.track === 'practice'
      ? 'profile:stats'
      : 'profile:loadout',
    chips: [handoff.track, handoff.branch.toLowerCase(), route.label.toLowerCase()],
    steps: route.steps,
    questId: handoff.questId,
    questTitle: handoff.title,
    branch: handoff.branch,
    track: handoff.track,
    nodeTitle: handoff.nodeTitle,
    checkpointLabel: checkpointStatus?.label,
    checkpointDetail: checkpointStatus?.detail,
    checkpointProgress: checkpointStatus?.progress,
    checkpointTrackedLabel: checkpointStatus?.trackedLabel,
    checkpointOutcomeLabel,
    checkpointOutcomeDetail,
    createdAt: handoff.createdAt,
  };
};

export const readPendingStarterWorkspaceCue = (): XtationStarterWorkspaceCue | null => {
  const storage = getCueStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(STARTER_WORKSPACE_CUE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as XtationStarterWorkspaceCue;
  } catch {
    return null;
  }
};

export const clearPendingStarterWorkspaceCue = () => {
  const storage = getCueStorage();
  if (!storage) return;

  try {
    storage.removeItem(STARTER_WORKSPACE_CUE_STORAGE_KEY);
  } catch {
    // Ignore cleanup problems.
  }
};

export const readPendingStarterWorkspaceAction = (): XtationStarterWorkspaceAction | null => {
  const storage = getCueStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(STARTER_WORKSPACE_ACTION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as XtationStarterWorkspaceAction;
  } catch {
    return null;
  }
};

export const clearPendingStarterWorkspaceAction = () => {
  const storage = getCueStorage();
  if (!storage) return;

  try {
    storage.removeItem(STARTER_WORKSPACE_ACTION_STORAGE_KEY);
  } catch {
    // Ignore cleanup problems.
  }
};

export const openStarterWorkspaceCue = (cue: XtationStarterWorkspaceCue) => {
  if (typeof window === 'undefined') return;

  const storage = getCueStorage();
  if (storage) {
    try {
      storage.setItem(STARTER_WORKSPACE_CUE_STORAGE_KEY, JSON.stringify(cue));
    } catch {
      // Ignore storage problems and still emit the event.
    }
  }

  window.dispatchEvent(
    new CustomEvent<XtationStarterWorkspaceCue>(STARTER_WORKSPACE_CUE_EVENT, {
      detail: cue,
    })
  );
};

export const dismissStarterWorkspaceCue = () => {
  clearPendingStarterWorkspaceCue();

  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent<null>(STARTER_WORKSPACE_DISMISS_EVENT, { detail: null }));
};

export const openStarterWorkspaceAction = (
  action: Omit<XtationStarterWorkspaceAction, 'createdAt'>
) => {
  if (typeof window === 'undefined') return;

  const normalized: XtationStarterWorkspaceAction = {
    ...action,
    createdAt: Date.now(),
  };

  const storage = getCueStorage();
  if (storage) {
    try {
      storage.setItem(STARTER_WORKSPACE_ACTION_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage problems and still emit the event.
    }
  }

  window.dispatchEvent(
    new CustomEvent<XtationStarterWorkspaceAction>(STARTER_WORKSPACE_ACTION_EVENT, {
      detail: normalized,
    })
  );
};
