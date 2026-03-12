import { ClientView } from '../../types';
import { buildGuestStationSummary, getGuestStationSnapshot, hasGuestStationData } from '../auth/guestStation';
import { readStoredXtationLastView } from '../navigation/lastView';
import { readXtationOnboardingHandoff, readXtationOnboardingState } from '../onboarding/storage';
import { readStationActivity, type StationActivityEntry } from '../station/stationActivity';
import { buildStationContinuityContext } from '../station/continuityContext';
import type { StationStarterFlowSummary } from '../station/starterFlow';
import { buildLocalStationStatus, type LocalStationStatus } from './localStationStatus';
import {
  buildLocalEntryTransitionDescriptor,
  resolveLocalEntryTargetView,
  type LocalEntryTransitionDescriptor,
} from './localEntryTransition';
import { resolveLocalStationEntryView } from './localEntryView';

interface GuestContinuityAccess {
  canAccessAdmin?: boolean;
  featureVisibility?: {
    lab?: boolean;
    multiplayer?: boolean;
    store?: boolean;
  };
}

export interface GuestStationContinuityState {
  localStatus: LocalStationStatus;
  stationActivity: StationActivityEntry[];
  starterFlowSummary: StationStarterFlowSummary | null;
  latestTransitionActivity: StationActivityEntry | null;
}

export interface GuestStationEntryState extends GuestStationContinuityState {
  fallbackResumeView: ClientView;
  resumeView: ClientView;
  transitionDescriptor: LocalEntryTransitionDescriptor;
}

export const readGuestStationContinuityState = (
  stationActivity: StationActivityEntry[],
  starterFlowSummary: StationStarterFlowSummary | null,
  latestTransitionActivity: StationActivityEntry | null,
  access?: GuestContinuityAccess
): GuestStationContinuityState => {
  const snapshot = getGuestStationSnapshot();
  const summary = hasGuestStationData(snapshot) ? buildGuestStationSummary(snapshot) : null;
  const onboardingState = readXtationOnboardingState();
  const onboardingHandoff = readXtationOnboardingHandoff();
  const lastView = readStoredXtationLastView();

  return {
    stationActivity,
    starterFlowSummary,
    latestTransitionActivity,
    localStatus: buildLocalStationStatus(
      summary,
      onboardingState,
      onboardingHandoff,
      lastView,
      starterFlowSummary,
      latestTransitionActivity,
      access
    ),
  };
};

export const resolveGuestStationEntryState = (
  stationActivity: StationActivityEntry[],
  starterFlowSummary: StationStarterFlowSummary | null,
  latestTransitionActivity: StationActivityEntry | null,
  access?: GuestContinuityAccess
): GuestStationEntryState => {
  const continuityState = readGuestStationContinuityState(
    stationActivity,
    starterFlowSummary,
    latestTransitionActivity,
    access
  );
  const fallbackResumeView = resolveLocalStationEntryView(readStoredXtationLastView(), access);
  const resumeView = resolveLocalEntryTargetView(
    continuityState.localStatus,
    fallbackResumeView,
    access
  );

  return {
    ...continuityState,
    fallbackResumeView,
    resumeView,
    transitionDescriptor: buildLocalEntryTransitionDescriptor(
      continuityState.localStatus,
      resumeView
    ),
  };
};

export const resolveGuestStationEntryStateFromStorage = (access?: GuestContinuityAccess) => {
  const stationActivity = readStationActivity();
  const continuityContext = buildStationContinuityContext(
    stationActivity,
    readStoredXtationLastView(),
    access,
    2
  );
  return resolveGuestStationEntryState(
    stationActivity,
    continuityContext.starterFlowSummary,
    continuityContext.latestTransitionActivity,
    access
  );
};
