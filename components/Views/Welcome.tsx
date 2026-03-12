import React, { useMemo, useRef } from 'react';
import { ArrowRight, Bot, Boxes, Compass, Layers3, ShieldCheck, UserRound } from 'lucide-react';
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

const sectionCards = [
  {
    title: 'Play',
    caption: 'Run your active quest, focus session, and execution flow.',
    icon: Compass,
  },
  {
    title: 'Profile',
    caption: 'Track history, level, self tree growth, and identity.',
    icon: UserRound,
  },
  {
    title: 'Lab',
    caption: 'Build automations, assistants, knowledge systems, and templates.',
    icon: Layers3,
  },
  {
    title: 'Inventory',
    caption: 'Keep resources, assets, and unlocked XTATION capabilities aligned.',
    icon: Boxes,
  },
];

const operatingSignals = [
  'Local-first and offline-capable by default',
  'Dusk-assisted workflows with explicit user control',
  'Web now, desktop-ready, mobile companion later',
  'One account, one station, one evolving system',
];

export const Welcome: React.FC<WelcomeProps> = ({ onEnterLocalMode, onResumeGuidedSetup }) => {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const { currentStation, access } = useAdminConsole();
  const { settings } = useXtationSettings();
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
    <div ref={shellRef} className="xt-welcome-shell" onWheel={routeWheelToContainer}>
      <div className="xt-welcome-backdrop" />

      <div className="xt-welcome-frame">
        <header className="xt-welcome-header">
          <div>
            <div className="xt-welcome-kicker">XTATION</div>
            <div className="xt-welcome-header-detail">Personal operating system for execution, systems, and real-world follow-through.</div>
          </div>
          <div className="xt-welcome-chip">
            <ShieldCheck size={14} className="text-[var(--app-accent)]" />
            Local-first
          </div>
        </header>

        <div className="xt-welcome-layout">
          <section className="space-y-8">
            <div className="max-w-4xl">
              <div className="xt-welcome-chip xt-welcome-chip--accent">
                <Bot size={13} />
                Dusk-ready station
              </div>
              <h1 className="xt-welcome-title">
                Build your system once.
                <br />
                Run your life through it every day.
              </h1>
              <p className="xt-welcome-detail">
                XTATION combines action rooms, growth tracking, systems design, people ops, resources, and Dusk into one station.
                Sign in for cloud sync, or enter local mode and keep moving offline.
              </p>
            </div>

            <div className="xt-welcome-cards">
              {sectionCards.map(({ title, caption, icon: Icon }) => (
                <article key={title} className="xt-welcome-card">
                  <div className="flex items-center justify-between gap-3">
                    <div className="xt-welcome-card-title">{title}</div>
                    <Icon size={16} className="text-[var(--app-accent)]" />
                  </div>
                  <div className="xt-welcome-card-detail">{caption}</div>
                </article>
              ))}
            </div>

            <div className="xt-welcome-panel">
              <div className="xt-welcome-panel-eyebrow">Operating Principles</div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {operatingSignals.map((signal) => (
                  <div key={signal} className="xt-welcome-signal">
                    {signal}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <AuthCard
              variant="landing"
              showOrb={false}
              eyebrow="Access"
              title="Open your XTATION station"
              description="Sign in for synced progress, upgrades, and shared layers. Your local station still works first."
              isGuestMode={false}
              continuityStatus={localStationStatus}
              entryDescriptor={guestEntry.transitionDescriptor}
              showEntryDescriptor={false}
            />

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
            <button
              type="button"
              onMouseEnter={playHoverSound}
              onClick={() => {
                playClickSound();
                onEnterLocalMode();
              }}
              className="xt-welcome-primary ui-pressable"
            >
              {localStationStatus.actionLabel}
              <ArrowRight size={14} />
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
};
