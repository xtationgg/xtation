import { ClientView } from '../../types';
import type { StationActivityEntry } from './stationActivity';
import { isStarterLoopEntry, type StationStarterFlowSummary } from './starterFlow';
import { resolveLocalStationEntryView } from '../welcome/localEntryView';
import type { StationTransitionNotice } from '../auth/stationTransitionNotice';

interface TransitionAccess {
  canAccessAdmin?: boolean;
  featureVisibility?: {
    lab?: boolean;
    multiplayer?: boolean;
    store?: boolean;
  };
}

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

export const extractLatestStationTransitionActivity = (
  activity: StationActivityEntry[]
): StationActivityEntry | null => {
  const entry = activity.find((item) => !isStarterLoopEntry(item));
  return entry ?? null;
};

export const resolveVisibleStationActivityEntry = (
  entry: StationActivityEntry | null,
  fallbackView: ClientView | null | undefined,
  access?: TransitionAccess
): StationActivityEntry | null => {
  if (!entry) return null;

  const resolvedTargetView = resolveLocalStationEntryView(
    entry.targetView ?? fallbackView,
    access
  );
  const resolvedWorkspaceLabel = formatWorkspaceLabel(resolvedTargetView);
  const originalWorkspaceLabel = entry.workspaceLabel || formatWorkspaceLabel(entry.targetView);
  const rerouted = originalWorkspaceLabel !== resolvedWorkspaceLabel;

  return {
    ...entry,
    workspaceLabel: resolvedWorkspaceLabel,
    targetView: resolvedTargetView,
    detail: rerouted
      ? `${entry.detail} XTATION will reopen ${resolvedWorkspaceLabel} because the recorded workspace is not currently available.`
      : entry.detail,
    chips: rerouted
      ? [ ...(entry.chips ?? []).filter(Boolean), `${resolvedWorkspaceLabel} fallback` ].slice(0, 4)
      : entry.chips,
  };
};

export const resolveVisibleStationTransitionActivity = (
  entry: StationActivityEntry | null,
  fallbackView: ClientView | null | undefined,
  access?: TransitionAccess
): StationActivityEntry | null => resolveVisibleStationActivityEntry(entry, fallbackView, access);

export const filterVisibleTransitionHistory = (
  activity: StationActivityEntry[],
  notice: StationTransitionNotice | null
) => {
  if (!notice) return activity;

  const normalizedNoticeTitle = notice.title.trim().toLowerCase();
  const normalizedNoticeDetail = notice.detail.trim().toLowerCase();
  const normalizedNoticeWorkspace = (notice.workspaceLabel ?? '').trim().toLowerCase();

  return activity.filter((entry) => {
    const sameTitle = entry.title.trim().toLowerCase() === normalizedNoticeTitle;
    const sameDetail = entry.detail.trim().toLowerCase() === normalizedNoticeDetail;
    const sameWorkspace = (entry.workspaceLabel ?? '').trim().toLowerCase() === normalizedNoticeWorkspace;
    return !(sameTitle && sameDetail && sameWorkspace);
  });
};

export const resolveCurrentStationTransitionActivity = (
  entry: StationActivityEntry | null,
  starterFlowSummary: StationStarterFlowSummary | null
): StationActivityEntry | null => {
  if (!entry) return null;
  if (!starterFlowSummary) return entry;
  return starterFlowSummary.createdAt > entry.createdAt ? null : entry;
};
