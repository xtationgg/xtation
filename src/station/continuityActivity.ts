import type { StationStarterFlowSummary } from './starterFlow';
import type { StationActivityEntry } from './stationActivity';

const isSameStationActivity = (
  entry: StationActivityEntry,
  candidate: StationActivityEntry | null | undefined
) => {
  if (!candidate) return false;
  if (entry.id === candidate.id) return true;

  return (
    entry.createdAt === candidate.createdAt &&
    entry.title === candidate.title &&
    entry.detail === candidate.detail &&
    (entry.workspaceLabel ?? '') === (candidate.workspaceLabel ?? '')
  );
};

export const buildContinuityActivityPreview = (
  activity: StationActivityEntry[],
  starterFlowSummary: StationStarterFlowSummary | null,
  latestTransitionActivity: StationActivityEntry | null = null,
  limit = 2
) => {
  const filtered = activity.filter((entry) => {
    if (starterFlowSummary && entry.createdAt === starterFlowSummary.createdAt) {
      return false;
    }

    if (isSameStationActivity(entry, latestTransitionActivity)) {
      return false;
    }

    return true;
  });

  return filtered.slice(0, limit);
};
