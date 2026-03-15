import React, { useMemo, useState } from 'react';
import { ArrowRight, Info, X } from 'lucide-react';
import { AuthCard } from '../Auth/AuthCard';
import { StationContinuityPanel } from '../Auth/StationContinuityPanel';
import { playClickSound, playHoverSound } from '../../utils/SoundEffects';
import { useAdminConsole } from '../../src/admin/AdminConsoleProvider';
import { readStoredXtationLastView } from '../../src/navigation/lastView';
import { readStationActivity } from '../../src/station/stationActivity';
import { buildStationContinuityContext } from '../../src/station/continuityContext';
import { useXtationSettings } from '../../src/settings/SettingsProvider';
import { resolveGuestStationEntryState } from '../../src/welcome/guestContinuity';
import { routeWheelToContainer } from '../../src/ui/wheelScroll';

interface WelcomeProps {
  onEnterLocalMode: () => void;
  onResumeGuidedSetup?: () => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ onEnterLocalMode, onResumeGuidedSetup }) => {
  const { currentStation, access } = useAdminConsole();
  const { settings } = useXtationSettings();
  const [showStationInfo, setShowStationInfo] = useState(false);
  const stationActivity = useMemo(() => readStationActivity(), []);
  const lastView = useMemo(() => readStoredXtationLastView(), []);
  const continuityContext = useMemo(
    () =>
      buildStationContinuityContext(
        stationActivity,
        lastView,
        {
          canAccessAdmin: access.allowed,
          featureVisibility: {
            lab: settings.features.labEnabled,
            multiplayer: settings.features.multiplayerEnabled,
            store: settings.features.storeEnabled,
          },
        },
        2
      ),
    [
      access.allowed,
      lastView,
      settings.features.labEnabled,
      settings.features.multiplayerEnabled,
      settings.features.storeEnabled,
      stationActivity,
    ]
  );
  const { starterFlowSummary, latestTransitionActivity, visibleRecentStationActivity } =
    continuityContext;
  const guestEntry = useMemo(
    () =>
      resolveGuestStationEntryState(stationActivity, starterFlowSummary, latestTransitionActivity, {
        canAccessAdmin: access.allowed,
        featureVisibility: {
          lab: settings.features.labEnabled,
          multiplayer: settings.features.multiplayerEnabled,
          store: settings.features.storeEnabled,
        },
      }),
    [
      access.allowed,
      latestTransitionActivity,
      settings.features.labEnabled,
      settings.features.multiplayerEnabled,
      settings.features.storeEnabled,
      starterFlowSummary,
      stationActivity,
    ]
  );
  const localStationStatus = guestEntry.localStatus;
  const localTrialDays =
    currentStation.plan === 'trial' && currentStation.trialEndsAt
      ? Math.max(0, Math.ceil((currentStation.trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

  return (
    <div className="xt-wc-shell" onWheel={routeWheelToContainer}>
      <div className="xt-welcome-backdrop" />

      <div className="xt-wc-center">
        {/* Brand */}
        <div className="xt-wc-brand">XTATION</div>
        <p className="xt-wc-tagline">
          Personal operating system for execution, systems, and real-world follow-through.
        </p>

        {/* Auth Card */}
        <AuthCard
          variant="landing"
          showOrb
          title="Welcome Back"
          description="Sign in for cloud sync, or enter local mode to keep moving offline."
          isGuestMode={false}
          continuityStatus={localStationStatus}
          entryDescriptor={guestEntry.transitionDescriptor}
          showEntryDescriptor={false}
        />

        {/* Local mode button */}
        <button
          type="button"
          onMouseEnter={playHoverSound}
          onClick={() => {
            playClickSound();
            onEnterLocalMode();
          }}
          className="xt-wc-local-btn ui-pressable"
        >
          {localStationStatus.actionLabel}
          <ArrowRight size={14} />
        </button>

        {/* Station info icon */}
        <div className="xt-wc-info-row">
          <button
            type="button"
            className="xt-wc-info-trigger"
            onClick={() => setShowStationInfo(!showStationInfo)}
            title="Station details"
          >
            <Info size={14} />
            <span>Station Info</span>
          </button>
        </div>
      </div>

      {/* Station Info Overlay */}
      {showStationInfo ? (
        <div className="xt-wc-info-overlay">
          <div className="xt-wc-info-panel">
            <button
              type="button"
              className="xt-wc-info-close"
              onClick={() => setShowStationInfo(false)}
            >
              <X size={16} />
            </button>
            <StationContinuityPanel
              status={localStationStatus}
              releaseChannel={currentStation.releaseChannel}
              plan={currentStation.plan}
              trialDays={localTrialDays}
              activity={visibleRecentStationActivity}
              starterFlowSummary={starterFlowSummary}
              latestTransitionActivity={latestTransitionActivity}
              entryDescriptor={guestEntry.transitionDescriptor}
              onOpenGuidedSetup={onResumeGuidedSetup}
              variant="welcome"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
