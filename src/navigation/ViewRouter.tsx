/**
 * ViewRouter — renders the active section view based on ClientView.
 *
 * Extracted from App.tsx to reduce monolith size.
 * All lazy-loaded view imports and the content switch live here.
 */

import React, { Suspense, lazy } from 'react';
import { ClientView, type RewardConfig } from '../../types';

// ── Lazy view imports ──────────────────────────────────────────────────────────

const loadLab = () => import('../../components/Views/Lab');
const loadAdmin = () => import('../../components/Views/Admin');
const loadProfile = () => import('../../components/Views/Profile');
const loadSettings = () => import('../../components/Views/Settings');
const loadInventory = () => import('../../components/Views/Inventory');
const loadMultiplayer = () => import('../../components/Views/Multiplayer');
const loadStore = () => import('../../components/Views/Store');
const loadEarth = () => import('../../components/Views/Earth');
const loadUiKitPlayground = () => import('../../components/Views/UiKitPlayground');

const LazyLab = lazy(() => loadLab().then((module) => ({ default: module.Lab })));
const LazyAdmin = lazy(() => loadAdmin().then((module) => ({ default: module.Admin })));
const LazyProfile = lazy(() => loadProfile().then((module) => ({ default: module.Profile })));
const LazySettings = lazy(() => loadSettings().then((module) => ({ default: module.Settings })));
const LazyInventory = lazy(() => loadInventory().then((module) => ({ default: module.Inventory })));
const LazyMultiplayer = lazy(() => loadMultiplayer().then((module) => ({ default: module.Multiplayer })));
const LazyStore = lazy(() => loadStore().then((module) => ({ default: module.Store })));
const LazyEarth = lazy(() => loadEarth().then((module) => ({ default: module.Earth })));
const LazyUiKitPlayground = lazy(() => loadUiKitPlayground().then((module) => ({ default: module.UiKitPlayground })));

// ── Section loading fallback ────────────────────────────────────────────────────

export const SectionLoadingState: React.FC<{ view: ClientView }> = ({ view }) => {
  const label =
    view === ClientView.LAB || view === ClientView.HOME
      ? 'Lab'
      : view === ClientView.ADMIN
        ? 'Admin'
      : view === ClientView.MULTIPLAYER
        ? 'Multiplayer'
        : view === ClientView.PROFILE
          ? 'Profile'
          : view === ClientView.INVENTORY
            ? 'Inventory'
            : view === ClientView.STORE
              ? 'Store'
              : view === ClientView.SETTINGS
                ? 'Settings'
                : view === ClientView.TFT
                  ? 'Earth'
                  : view === ClientView.UI_KIT
                    ? 'UI Kit'
                    : 'XTATION';

  return (
    <div className="flex h-full min-h-[420px] items-center justify-center px-6">
      <div className="xt-shell-loading-card max-w-xl px-8 py-10 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--app-accent)]">{label}</div>
        <div className="mt-3 text-2xl font-semibold text-[var(--app-text)]">Loading section</div>
        <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
          XTATION is streaming this workspace only when you open it, so the main action room stays lighter and faster.
        </div>
        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="xt-shell-dot h-2.5 w-2.5 rounded-full bg-[var(--app-accent)]" />
          <span className="xt-shell-dot xt-shell-dot--2 h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_70%,transparent)]" />
          <span className="xt-shell-dot xt-shell-dot--3 h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_40%,transparent)]" />
        </div>
      </div>
    </div>
  );
};

// ── Helper ──────────────────────────────────────────────────────────────────────

export const formatWorkspaceLabel = (view: ClientView | null | undefined) => {
  switch (view) {
    case ClientView.LOBBY:
      return 'Play';
    case ClientView.HOME:
    case ClientView.LAB:
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
    default:
      return 'Play';
  }
};

export const isPlayStageView = (view: ClientView) =>
  view === ClientView.LOBBY || view === ClientView.MATCH_FOUND || view === ClientView.CHAMP_SELECT;

// ── ViewRouter props ────────────────────────────────────────────────────────────

export interface ViewRouterProps {
  currentView: ClientView;
  previousView: ClientView;
  rewardConfigs: RewardConfig[];
  updateRewardConfig: (index: number, config: RewardConfig) => void;
  totalXP: number;
  user: { email?: string; name?: string; id?: string } | null;
  operatorAccess: { allowed: boolean };
  featureVisibility: { lab?: boolean; multiplayer?: boolean; store?: boolean };
  onboardingState: { status: string };
  onboardingHandoff: { questId: string; title: string; branch: string; track: string; nodeTitle: string; createdAt: number; dismissedAt: number | null } | null;
  stationIdentity: { modeLabel: string; title: string; detail: string };
  activeUserId: string | null;
  setCurrentView: (view: ClientView) => void;
  setPreviousView: (view: ClientView) => void;
  setCustomBackground: (bg: string | null) => void;
  setIsOnboardingOpen: (open: boolean) => void;
  setOnboardingHandoff: (handoff: null) => void;
  onStarterSessionLive: (transition: {
    title: string;
    detail: string;
    workspaceLabel: string;
    targetView: ClientView;
    chips: string[];
  }) => void;
  onNavigateStage: (view: ClientView) => void;
  openGuestGuidedSetup?: () => void;
}

// ── ViewRouter component ────────────────────────────────────────────────────────

export const ViewRouter: React.FC<ViewRouterProps> = ({
  currentView,
  previousView,
  rewardConfigs,
  updateRewardConfig,
  totalXP,
  user,
  operatorAccess,
  featureVisibility,
  onboardingState,
  onboardingHandoff,
  stationIdentity,
  activeUserId,
  setCurrentView,
  setPreviousView,
  setCustomBackground,
  setIsOnboardingOpen,
  setOnboardingHandoff,
  onStarterSessionLive,
  onNavigateStage,
  openGuestGuidedSetup,
}) => {
  const renderContent = () => {
    switch (currentView) {
      case ClientView.HOME:
      case ClientView.LAB:
        return <LazyLab />;
      case ClientView.ADMIN:
        return <LazyAdmin onChangeView={(view: ClientView) => setCurrentView(view)} />;
      case ClientView.TFT:
        return <LazyEarth />;
      case ClientView.MULTIPLAYER:
        return <LazyMultiplayer />;
      case ClientView.PROFILE:
        return <LazyProfile rewardConfigs={rewardConfigs} />;
      case ClientView.INVENTORY:
        return <LazyInventory />;
      case ClientView.STORE:
        return <LazyStore />;
      case ClientView.UI_KIT:
        return <LazyUiKitPlayground />;
      case ClientView.SETTINGS:
        return (
          <LazySettings
            rewardConfigs={rewardConfigs}
            onUpdateConfig={updateRewardConfig}
            currentXP={totalXP}
            onOpenGuidedSetup={!user ? openGuestGuidedSetup : undefined}
          />
        );
      case ClientView.LOBBY:
      case ClientView.MATCH_FOUND:
      case ClientView.CHAMP_SELECT:
        return (
          <Lobby
            onBack={() => setCurrentView(previousView)}
            setBackground={setCustomBackground}
            onOpenWorkspace={(view: ClientView) => {
              if (isPlayStageView(currentView)) {
                setPreviousView(currentView);
              }
              setCurrentView(view);
            }}
            onOpenGuidedSetup={onboardingState.status !== 'completed' ? () => setIsOnboardingOpen(true) : undefined}
            onboardingHandoff={onboardingHandoff}
            stationIdentity={stationIdentity}
            onStarterSessionLive={onStarterSessionLive}
            onDismissOnboardingHandoff={() => {
              setOnboardingHandoff(null);
            }}
            onNavigateStage={onNavigateStage}
          />
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-[#5B5A56] flex-col">
            <div className="w-20 h-20 border border-[#3C3C41] border-dashed rounded-full flex items-center justify-center animate-spin-slow mb-4">
              <div className="w-16 h-16 border border-[#C8AA6E] rounded-full opacity-20"></div>
            </div>
            <div className="text-4xl font-bold mb-2 opacity-30 tracking-widest uppercase">Under Construction</div>
            <div className="text-sm text-[#A09B8C]">This section of the XTATION network is currently offline.</div>
          </div>
        );
    }
  };

  return (
    <Suspense fallback={<SectionLoadingState view={currentView} />}>
      {renderContent()}
    </Suspense>
  );
};

// Re-export Lobby for the Lobby case — it's imported directly (not lazy) in App.tsx
import { Lobby } from '../../components/Views/Lobby';
