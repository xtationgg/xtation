import type { GuestStationSummary } from '../auth/guestStation';
import type { XtationOnboardingHandoff, XtationOnboardingState } from '../onboarding/storage';
import type { StationStarterFlowSummary } from '../station/starterFlow';
import type { StationActivityEntry } from '../station/stationActivity';
import { ClientView } from '../../types';
import { resolveLocalStationEntryView } from './localEntryView';

export type LocalStationMode = 'fresh' | 'guided' | 'resume' | 'relay';

export interface LocalStationMetric {
  label: string;
  value: string;
}

export interface LocalStationStatus {
  mode: LocalStationMode;
  entryState?: 'fresh' | 'resume';
  eyebrow: string;
  title: string;
  detail: string;
  workspaceLabel: string;
  targetView?: ClientView | null;
  connectHint: string;
  actionLabel: string;
  statusLabel: string;
  statusValue: string;
  chips: string[];
  metrics: LocalStationMetric[];
  relayTitle?: string | null;
}

interface LocalStationAccess {
  canAccessAdmin?: boolean;
  featureVisibility?: {
    lab?: boolean;
    multiplayer?: boolean;
    store?: boolean;
  };
}

const hasSummaryData = (summary: GuestStationSummary | null) =>
  Boolean(
    summary &&
      (summary.tasks > 0 ||
        summary.sessions > 0 ||
        summary.projects > 0 ||
        summary.selfTreeNodes > 0 ||
        summary.inventorySlots > 0 ||
        summary.activeDays > 0 ||
        summary.latestActivityAt)
  );

const formatTrackLabel = (track: XtationOnboardingHandoff['track']) => {
  switch (track) {
    case 'mission':
      return 'Mission';
    case 'practice':
      return 'Practice';
    case 'system':
      return 'System';
    default:
      return 'Starter';
  }
};

const buildMetrics = (summary: GuestStationSummary | null): LocalStationMetric[] => {
  if (!summary) return [];
  return [
    { label: 'Quests', value: String(summary.tasks) },
    { label: 'Sessions', value: String(summary.sessions) },
    { label: 'Tree', value: String(summary.selfTreeNodes) },
    { label: 'Days', value: String(summary.activeDays) },
  ];
};

const formatWorkspaceLabel = (view: ClientView | null | undefined) => {
  switch (view) {
    case ClientView.LAB:
    case ClientView.HOME:
      return 'Lab';
    case ClientView.PROFILE:
      return 'Profile';
    case ClientView.MULTIPLAYER:
      return 'Multiplayer';
    case ClientView.INVENTORY:
      return 'Inventory';
    case ClientView.STORE:
      return 'Store';
    case ClientView.SETTINGS:
      return 'Settings';
    case ClientView.ADMIN:
      return 'Admin';
    case ClientView.TFT:
      return 'Earth';
    case ClientView.UI_KIT:
      return 'UI Kit';
    case ClientView.LOBBY:
    default:
      return 'Play';
  }
};

export const buildLocalStationStatus = (
  summary: GuestStationSummary | null,
  onboardingState: XtationOnboardingState,
  onboardingHandoff: XtationOnboardingHandoff | null,
  lastView: ClientView | null = null,
  starterFlowSummary: StationStarterFlowSummary | null = null,
  latestTransitionActivity: StationActivityEntry | null = null,
  access?: LocalStationAccess
): LocalStationStatus => {
  const resolvedLastView = resolveLocalStationEntryView(lastView, access);
  const metrics = buildMetrics(summary);
  const hasData = hasSummaryData(summary);
  const workspaceLabel = formatWorkspaceLabel(resolvedLastView);
  const starterFlowIsCurrent =
    starterFlowSummary &&
    (!onboardingHandoff || starterFlowSummary.createdAt >= onboardingHandoff.createdAt);

  if (onboardingHandoff && !onboardingHandoff.dismissedAt && !starterFlowIsCurrent) {
    const trackLabel = formatTrackLabel(onboardingHandoff.track);
    return {
      mode: 'relay',
      entryState: 'resume',
      eyebrow: 'Starter relay',
      title: 'Resume local station',
      detail: `Starter relay armed for ${onboardingHandoff.branch}. Continue with ${onboardingHandoff.title} and let XTATION turn the first accepted loop into real momentum.`,
      workspaceLabel,
      targetView: resolvedLastView,
      connectHint: `If you connect now, XTATION will let you decide whether this ${workspaceLabel} relay becomes the signed-in account state.`,
      actionLabel: 'Resume Starter Relay',
      statusLabel: 'Relay',
      statusValue: `${trackLabel} • ${onboardingHandoff.branch}`,
      chips: [trackLabel, onboardingHandoff.branch, hasData ? 'Recovered station' : 'Fresh loop'],
      metrics,
      relayTitle: onboardingHandoff.title,
    };
  }

  if (starterFlowSummary) {
    const starterTargetView = resolveLocalStationEntryView(
      starterFlowSummary.targetView ?? resolvedLastView,
      access
    );
    const starterWorkspaceLabel = formatWorkspaceLabel(starterTargetView);
    return {
      mode: 'resume',
      entryState: 'resume',
      eyebrow: 'Starter loop',
      title: 'Continue local station',
      detail: `${starterFlowSummary.statusDetail} Resume in ${starterWorkspaceLabel} and continue from ${starterFlowSummary.title.toLowerCase()}.`,
      workspaceLabel: starterWorkspaceLabel,
      targetView: starterTargetView,
      connectHint: `If you connect now, XTATION will preserve this ${starterWorkspaceLabel} starter loop and let you decide whether to import it into the signed-in station.`,
      actionLabel: 'Continue Starter Loop',
      statusLabel: starterFlowSummary.statusLabel,
      statusValue: starterWorkspaceLabel,
      chips: ['Starter loop', ...starterFlowSummary.chips.slice(0, 2)],
      metrics,
      relayTitle: starterFlowSummary.title,
    };
  }

  if (onboardingState.status === 'pending') {
    const hasResumeContext =
      Boolean(lastView && lastView !== ClientView.LOBBY) ||
      hasData ||
      Boolean(latestTransitionActivity) ||
      Boolean(starterFlowSummary) ||
      Boolean(onboardingHandoff);
    return {
      mode: 'guided',
      entryState: hasResumeContext ? 'resume' : 'fresh',
      eyebrow: 'Guided setup',
      title: hasResumeContext ? 'Continue local station' : 'Start local station',
      detail: hasResumeContext
        ? 'XTATION already has a local guided setup in progress. Reopen it and continue seeding the first branch and operating track.'
        : 'Seed the first branch, choose an operating track, and let XTATION build the initial action room around it.',
      workspaceLabel,
      targetView: resolvedLastView,
      connectHint: 'If you connect after setup, XTATION will carry your local starter flow into the signed-in handoff review.',
      actionLabel: hasResumeContext ? 'Continue Guided Setup' : 'Start Guided Setup',
      statusLabel: 'Setup',
      statusValue: hasResumeContext ? 'In progress' : 'Pending',
      chips: hasResumeContext ? ['Offline-first', 'Starter flow', 'Resume'] : ['Offline-first', 'Starter flow'],
      metrics,
      relayTitle: null,
    };
  }

  if (latestTransitionActivity) {
    const transitionTargetView = resolveLocalStationEntryView(
      latestTransitionActivity.targetView ?? resolvedLastView,
      access
    );
    const transitionWorkspaceLabel = formatWorkspaceLabel(transitionTargetView);
    return {
      mode: 'resume',
      entryState: 'resume',
      eyebrow: 'Latest transition',
      title: 'Continue local station',
      detail: `${latestTransitionActivity.detail} Resume in ${transitionWorkspaceLabel} and keep the local station moving from the latest confirmed state.`,
      workspaceLabel: transitionWorkspaceLabel,
      targetView: transitionTargetView,
      connectHint: `If you connect now, XTATION will preserve this ${transitionWorkspaceLabel} station state and let you choose whether to import it into the signed-in account.`,
      actionLabel: 'Continue Local Station',
      statusLabel: 'Transition',
      statusValue: transitionWorkspaceLabel,
      chips: latestTransitionActivity.chips?.slice(0, 3) ?? ['Offline-first'],
      metrics,
      relayTitle: latestTransitionActivity.title,
    };
  }

  if (hasData) {
    return {
      mode: 'resume',
      entryState: 'resume',
      eyebrow: 'Local station',
      title: 'Resume local station',
      detail: summary?.latestActivityAt
        ? `Your offline station already has live progress. Reopen it and keep moving from the latest recorded activity.`
        : 'Your offline station already has saved progress. Reopen it and continue without waiting on sync.',
      workspaceLabel,
      targetView: resolvedLastView,
      connectHint: `If you connect now, XTATION will show a keep-account vs import-local decision before anything is overwritten.`,
      actionLabel: 'Resume Local Station',
      statusLabel: 'State',
      statusValue: summary?.latestActivityAt ? 'Active record' : 'Saved record',
      chips: ['Offline-first', summary?.projects ? `${summary.projects} projects` : 'Solo station'],
      metrics,
      relayTitle: null,
    };
  }

  if (lastView && lastView !== ClientView.LOBBY) {
    return {
      mode: 'resume',
      entryState: 'resume',
      eyebrow: 'Local station',
      title: 'Resume local station',
      detail: `XTATION will reopen the last active workspace in ${lastView.toLowerCase()} and keep the local shell moving from there.`,
      workspaceLabel,
      targetView: resolvedLastView,
      connectHint: `If you connect now, XTATION will preserve that ${workspaceLabel} workspace and let you choose whether to import it.`,
      actionLabel: 'Resume Local Station',
      statusLabel: 'Resume',
      statusValue: lastView,
      chips: ['Offline-first', `Resume ${lastView.toLowerCase()}`],
      metrics,
      relayTitle: null,
    };
  }

  return {
    mode: 'fresh',
    entryState: 'fresh',
    eyebrow: 'Local station',
    title: 'Open local station',
    detail: 'Use Play, Lab, Inventory, and Dusk offline now, then connect an account later when you want sync.',
    workspaceLabel,
    targetView: resolvedLastView,
    connectHint: 'Connecting later opens a safe continuity review before local work is merged into any account.',
    actionLabel: 'Open Local Station',
    statusLabel: 'State',
    statusValue: 'Fresh',
    chips: ['Offline-first', 'No sync required'],
    metrics,
    relayTitle: null,
  };
};
