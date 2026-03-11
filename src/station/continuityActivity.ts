import type { StationStarterFlowSummary } from './starterFlow';
import type { StationActivityEntry } from './stationActivity';

export const buildContinuityActivityPreview = (
  activity: StationActivityEntry[],
  starterFlowSummary: StationStarterFlowSummary | null,
  limit = 2
) => {
  if (!starterFlowSummary) return activity.slice(0, limit);

  return activity
    .filter((entry) => entry.createdAt !== starterFlowSummary.createdAt)
    .slice(0, limit);
};
