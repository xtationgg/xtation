import type { ClientView } from '../../types';
import type { StationActivityEntry } from './stationActivity';
import {
  extractLatestStationTransitionActivity,
  resolveCurrentStationTransitionActivity,
  resolveVisibleStationActivityEntry,
  resolveVisibleStationTransitionActivity,
} from './transitionSummary';
import { extractStationStarterFlowSummary, type StationStarterFlowSummary } from './starterFlow';

interface StationContinuityAccess {
  canAccessAdmin?: boolean;
  featureVisibility?: {
    lab?: boolean;
    multiplayer?: boolean;
    store?: boolean;
  };
}

export interface StationContinuityContext {
  starterFlowSummary: StationStarterFlowSummary | null;
  latestTransitionActivity: StationActivityEntry | null;
  visibleRecentStationActivity: StationActivityEntry[];
}

export const buildStationContinuityContext = (
  activity: StationActivityEntry[],
  fallbackView: ClientView | null,
  access?: StationContinuityAccess,
  recentLimit = 2
): StationContinuityContext => {
  const starterFlowSummary = extractStationStarterFlowSummary(activity);
  const latestTransitionActivity = resolveCurrentStationTransitionActivity(
    resolveVisibleStationTransitionActivity(
      extractLatestStationTransitionActivity(activity),
      fallbackView,
      access
    ),
    starterFlowSummary
  );
  const visibleRecentStationActivity = activity
    .slice(0, recentLimit)
    .map((entry) => resolveVisibleStationActivityEntry(entry, fallbackView, access))
    .filter((entry): entry is StationActivityEntry => Boolean(entry));

  return {
    starterFlowSummary,
    latestTransitionActivity,
    visibleRecentStationActivity,
  };
};
