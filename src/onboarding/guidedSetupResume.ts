import type { LocalStationStatus } from '../welcome/localStationStatus';
import type { StationActivityEntry } from '../station/stationActivity';

const isStarterSetupSkippedActivity = (activity: Pick<StationActivityEntry, 'title' | 'detail'> | null | undefined) => {
  if (!activity) return false;
  const title = activity.title.trim().toLowerCase();
  const detail = activity.detail.trim().toLowerCase();
  return title.includes('starter setup skipped') || detail.includes('return to guided setup');
};

export const resolveGuidedSetupResumeActionLabel = (
  status: Pick<LocalStationStatus, 'mode' | 'entryState'>,
  latestTransitionActivity?: Pick<StationActivityEntry, 'title' | 'detail'> | null
) => {
  if (isStarterSetupSkippedActivity(latestTransitionActivity)) {
    return 'Return to Guided Setup';
  }

  if (status.mode === 'guided' && status.entryState === 'resume') {
    return 'Continue Guided Setup';
  }

  return null;
};

export const shouldOfferGuidedSetupResumeAction = (
  status: Pick<LocalStationStatus, 'mode' | 'entryState'>,
  latestTransitionActivity?: Pick<StationActivityEntry, 'title' | 'detail'> | null
) => Boolean(resolveGuidedSetupResumeActionLabel(status, latestTransitionActivity));
