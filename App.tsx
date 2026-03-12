import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from './components/Layout/TopBar';
import { Lobby } from './components/Views/Lobby';
import { TerminalErrorBoundary } from './components/UI/TerminalErrorBoundary';
import { RewardOverlay } from './components/Features/RewardOverlay';
import { AuthCallbackView } from './components/Auth/AuthCallbackView';
import { GuestStationHandoff } from './components/Auth/GuestStationHandoff';
import { ResetPasswordView } from './components/Auth/ResetPasswordView';
import { FirstRunSetup } from './components/Onboarding/FirstRunSetup';
import { Welcome } from './components/Views/Welcome';
import { ClientView, RewardConfig } from './types';
import type { XPLedgerState } from './components/XP/xpTypes';
import { playClickSound } from './utils/SoundEffects';
import { readFileAsDataUrl } from './utils/fileUtils';
import { useXP } from './components/XP/xpStore';
import { ScheduledTaskPrompt } from './components/XP/ScheduledTaskPrompt';
import { useAuth } from './src/auth/AuthProvider';
import { CommandPalette } from './components/UI/CommandPalette';
import {
  readUserScopedJSON,
  setActiveUserId,
  writeUserScopedJSON,
  writeUserScopedString,
} from './src/lib/userScopedStorage';
import {
  DUSK_BRIEF_EVENT,
  persistLatestDuskBrief,
  type StoredDuskBrief,
} from './src/dusk/bridge';
import {
  buildGuestStationSignature,
  buildGuestStationSummary,
  clearGuestStationSnapshot,
  getGuestStationSnapshot,
  hasGuestStationData,
  readDismissedGuestStationSignature,
  writeDismissedGuestStationSignature,
  writeGuestStationRecoverySnapshot,
  type GuestStationSummary,
} from './src/auth/guestStation';
import {
  clearStationTransitionNotice,
  isStationTransitionNoticeVisible,
  readStationTransitionNotice,
  resolveGuidedSetupTransitionActionLabel,
  resolveVisibleStationTransitionNotice,
  writeStationTransitionNotice,
  XTATION_STATION_TRANSITION_NOTICE_EVENT,
  type StationTransitionNotice,
} from './src/auth/stationTransitionNotice';
import { clearAuthTransitionSignal, readAuthTransitionSignal } from './src/auth/authTransitionSignal';
import { buildAuthTransitionResultDescriptor } from './src/auth/authTransitionDescriptor';
import {
  buildStarterSkippedTransition,
  buildStarterSeededTransition,
  describeStarterWorkspaceAction,
  STARTER_WORKSPACE_ACTION_EVENT,
  STARTER_WORKSPACE_CUE_EVENT,
  STARTER_WORKSPACE_DISMISS_EVENT,
  formatStarterWorkspaceCueEyebrow,
  openStarterWorkspaceAction,
  readPendingStarterWorkspaceCue,
  type XtationStarterWorkspaceCue,
} from './src/onboarding/workspaceCue';
import {
  defaultXtationOnboardingState,
  readXtationOnboardingHandoff,
  readXtationOnboardingState,
  XTATION_ONBOARDING_STORAGE_EVENT,
  writeXtationOnboardingHandoff,
  writeXtationOnboardingState,
  type XtationOnboardingHandoff,
  type XtationOnboardingState,
} from './src/onboarding/storage';
import { useXtationSettings } from './src/settings/SettingsProvider';
import { useAdminConsole } from './src/admin/AdminConsoleProvider';
import { usePresentationEvents } from './src/presentation/PresentationEventsProvider';
import { LAB_NAVIGATION_EVENT, type LabNavigationPayload } from './src/lab/bridge';
import {
  readStoredXtationLastView,
  resolveXtationLastView,
  writeStoredXtationLastView,
  XTATION_LAST_VIEW_STORAGE_EVENT,
} from './src/navigation/lastView';
import { resolveGuestStationEntryState } from './src/welcome/guestContinuity';
import { buildLocalEntryTransitionDescriptor } from './src/welcome/localEntryTransition';
import type { LocalStationStatus } from './src/welcome/localStationStatus';
import {
  appendStationActivity,
  readStationActivity,
  XTATION_STATION_ACTIVITY_EVENT,
  type StationActivityEntry,
} from './src/station/stationActivity';
import { buildStationContinuityContext } from './src/station/continuityContext';
import { buildStationIdentitySummary } from './src/station/stationIdentity';
import { buildStarterLoopChips } from './src/station/starterFlow';
import {
  filterVisibleTransitionHistory,
  resolveVisibleStationActivityEntry,
} from './src/station/transitionSummary';
import { PLAY_NAVIGATION_EVENT, type PlayNavigationPayload } from './src/play/bridge';

const loadLab = () => import('./components/Views/Lab');
const loadAdmin = () => import('./components/Views/Admin');
const loadProfile = () => import('./components/Views/Profile');
const loadSettings = () => import('./components/Views/Settings');
const loadInventory = () => import('./components/Views/Inventory');
const loadMultiplayer = () => import('./components/Views/Multiplayer');
const loadStore = () => import('./components/Views/Store');
const loadEarth = () => import('./components/Views/Earth');
const loadUiKitPlayground = () => import('./components/Views/UiKitPlayground');
const loadDuskRelay = () => import('./components/Features/HextechAssistant');
const loadChatDock = () => import('./components/Chat');
const loadDevHud = () => import('./src/dev/DevHUD');

const LazyLab = lazy(() => loadLab().then((module) => ({ default: module.Lab })));
const LazyAdmin = lazy(() => loadAdmin().then((module) => ({ default: module.Admin })));
const LazyProfile = lazy(() => loadProfile().then((module) => ({ default: module.Profile })));
const LazySettings = lazy(() => loadSettings().then((module) => ({ default: module.Settings })));
const LazyInventory = lazy(() => loadInventory().then((module) => ({ default: module.Inventory })));
const LazyMultiplayer = lazy(() => loadMultiplayer().then((module) => ({ default: module.Multiplayer })));
const LazyStore = lazy(() => loadStore().then((module) => ({ default: module.Store })));
const LazyEarth = lazy(() => loadEarth().then((module) => ({ default: module.Earth })));
const LazyUiKitPlayground = lazy(() => loadUiKitPlayground().then((module) => ({ default: module.UiKitPlayground })));
const LazyDuskRelay = lazy(() => loadDuskRelay().then((module) => ({ default: module.DuskRelay || module.HextechAssistant })));
const LazyChatDock = lazy(() => loadChatDock().then((module) => ({ default: module.ChatDock })));
const LazyDevHUD = lazy(() => loadDevHud().then((module) => ({ default: module.DevHUD })));

const SectionLoadingState: React.FC<{ view: ClientView }> = ({ view }) => {
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

const AssistantLoadingState: React.FC = () => (
  <aside
    className="xt-dusk-shell fixed right-0 top-[56px] z-[150] h-[calc(100dvh-56px)] px-5 py-5 shadow-[-24px_0_80px_rgba(0,0,0,0.28)] md:top-[60px] md:h-[calc(100dvh-60px)]"
    style={{ width: 'clamp(320px, 34vw, 380px)' }}
  >
    <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-accent)]">Dusk</div>
    <div className="mt-2 text-lg font-semibold text-[var(--app-text)]">Opening relay</div>
    <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
      Loading the assistant workspace and latest brief context.
    </div>
    <div className="mt-5 flex gap-2">
      <span className="xt-shell-bar h-2 w-10 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_70%,transparent)]" />
      <span className="xt-shell-bar xt-shell-bar--2 h-2 w-6 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_40%,transparent)]" />
      <span className="xt-shell-bar xt-shell-bar--3 h-2 w-14 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_24%,transparent)]" />
    </div>
  </aside>
);

const defaultRewardConfigs: RewardConfig[] = [
  { level: 1, threshold: 100, animation: 'CYBER_PULSE', sound: 'LEVEL_UP' },
  { level: 2, threshold: 250, animation: 'GOLDEN_HEX', sound: 'CHIME' },
  { level: 3, threshold: 500, animation: 'GLITCH_STORM', sound: 'TECH_POWER' },
  { level: 4, threshold: 1000, animation: 'ORBITAL_STRIKE', sound: 'ALARM' },
  { level: 5, threshold: 2000, animation: 'NEON_BURST', sound: 'BASS_DROP' },
];

const defaultViewBackgrounds: Record<ClientView, string | null> = {
  [ClientView.HOME]: null,
  [ClientView.LAB]: null,
  [ClientView.ADMIN]: null,
  [ClientView.TFT]: null,
  [ClientView.MULTIPLAYER]: null,
  [ClientView.PROFILE]: null,
  [ClientView.INVENTORY]: null,
  [ClientView.STORE]: null,
  [ClientView.UI_KIT]: null,
  [ClientView.SETTINGS]: null,
  [ClientView.LOBBY]: null,
  [ClientView.MATCH_FOUND]: null,
  [ClientView.CHAMP_SELECT]: null,
};

const GUEST_MODE_SESSION_KEY = 'xtation_guest_mode';

const formatWorkspaceLabel = (view: ClientView | null | undefined) => {
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

const isPlayStageView = (view: ClientView) =>
  view === ClientView.LOBBY || view === ClientView.MATCH_FOUND || view === ClientView.CHAMP_SELECT;

const App: React.FC = () => {
  const currentPath = window.location.pathname;
  const { user, loading: authLoading, signOut } = useAuth();
  const { settings } = useXtationSettings();
  const { access: operatorAccess, state: operatorState, currentStation } = useAdminConsole();
  const { emitEvent } = usePresentationEvents();
  const activeUserId = user?.id || null;
  const userScopeRenderKey = activeUserId || 'signedOut';

  const [currentView, setCurrentView] = useState<ClientView>(ClientView.LOBBY);
  const [previousView, setPreviousView] = useState<ClientView>(ClientView.LOBBY);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingState, setOnboardingState] = useState<XtationOnboardingState>(defaultXtationOnboardingState);
  const [onboardingHandoff, setOnboardingHandoff] = useState<XtationOnboardingHandoff | null>(null);
  const [hasResolvedOnboardingScope, setHasResolvedOnboardingScope] = useState(false);
  const [isGuestStationHandoffOpen, setIsGuestStationHandoffOpen] = useState(false);
  const [guestStationSummary, setGuestStationSummary] = useState<GuestStationSummary | null>(null);
  const [accountStationSummary, setAccountStationSummary] = useState<GuestStationSummary | null>(null);
  const [guestStationSignature, setGuestStationSignature] = useState<string | null>(null);
  const [guestStationSnapshot, setGuestStationSnapshot] = useState<XPLedgerState | null>(null);
  const [stationTransitionNotice, setStationTransitionNotice] = useState<StationTransitionNotice | null>(null);
  const [starterWorkspaceShellCue, setStarterWorkspaceShellCue] = useState<XtationStarterWorkspaceCue | null>(null);
  const [starterWorkspaceActionNotice, setStarterWorkspaceActionNotice] = useState<{
    workspaceView: ClientView.PROFILE | ClientView.LAB;
    title: string;
    detail: string;
  } | null>(null);
  const [recentStationActivity, setRecentStationActivity] = useState<StationActivityEntry[]>([]);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(GUEST_MODE_SESSION_KEY) === 'true';
  });
  
  // New State for dynamic background (e.g., Champ Select splash art)
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [viewBackgrounds, setViewBackgrounds] = useState<Record<ClientView, string | null>>(defaultViewBackgrounds);
  const [resolvedBackgrounds, setResolvedBackgrounds] = useState<Record<string, string>>({});
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const { tasks, stats, selectors, authStatus, getLedgerSnapshot, replaceLedger } = useXP();

  // Reward System State
  const [rewardConfigs, setRewardConfigs] = useState<RewardConfig[]>(defaultRewardConfigs);
  
  const [triggeredLevels, setTriggeredLevels] = useState<number[]>([]);
  const [activeReward, setActiveReward] = useState<RewardConfig | null>(null);
  const [activeRewardDuration, setActiveRewardDuration] = useState<number>(4000);
  const rewardStartRef = useRef<number>(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const lastPresentationViewRef = useRef<ClientView | null>(null);
  const lastMotionViewRef = useRef<ClientView | null>(null);
  const lastRestoredScopeRef = useRef<string | null>(null);
  const [viewMotionToken, setViewMotionToken] = useState<'xt-shell-section-a' | 'xt-shell-section-b'>('xt-shell-section-a');

  const totalXP = stats.totalEarnedXP;
  const activeTasksCount = selectors.getActiveTasks().length;
  const rewardDismissTimer = useRef<number | null>(null);
  const isResetPasswordRoute = currentPath === '/reset-password';
  const isAuthCallbackRoute = currentPath === '/auth/callback';
  const featureVisibility = useMemo(
    () => ({
      lab: settings.features.labEnabled,
      multiplayer: settings.features.multiplayerEnabled,
      store: settings.features.storeEnabled,
    }),
    [settings.features.labEnabled, settings.features.multiplayerEnabled, settings.features.storeEnabled]
  );
  const stationIdentitySummary = useMemo(
    () =>
      buildStationIdentitySummary({
        currentStation,
        activeUserId,
        isGuestMode,
        activeView: stationTransitionNotice?.targetView ?? currentView,
        handoffRecoverySnapshot: activeUserId ? readGuestStationRecoverySnapshot(activeUserId) : null,
        access: {
          canAccessAdmin: operatorAccess.allowed,
          featureVisibility,
        },
      }),
    [activeUserId, currentStation, currentView, featureVisibility, isGuestMode, operatorAccess.allowed, stationTransitionNotice?.targetView]
  );
  const showTransitionIdentityTitle =
    !stationTransitionNotice ||
    stationIdentitySummary.title.trim().toLowerCase() !==
      stationTransitionNotice.title.trim().toLowerCase();
  const showTransitionIdentityDetail =
    !stationTransitionNotice ||
    stationIdentitySummary.detail.trim().toLowerCase() !==
      stationTransitionNotice.detail.trim().toLowerCase();
  const guidedSetupTransitionActionLabel = useMemo(
    () => resolveGuidedSetupTransitionActionLabel(stationTransitionNotice),
    [stationTransitionNotice]
  );
  const canLaunchGuidedSetupFromTransition =
    Boolean(stationTransitionNotice) &&
    isGuestMode &&
    stationTransitionNotice?.scope === 'guest' &&
    onboardingState.status !== 'completed' &&
    !isOnboardingOpen &&
    (onboardingState.status === 'pending' ||
      guidedSetupTransitionActionLabel !== 'Start Guided Setup');
  const visibleRecentStationActivity = useMemo(
    () =>
      recentStationActivity
        .map((entry) =>
          resolveVisibleStationActivityEntry(entry, currentView, {
            canAccessAdmin: operatorAccess.allowed,
            featureVisibility,
          })
        )
        .filter((entry): entry is StationActivityEntry => Boolean(entry)),
    [currentView, featureVisibility, operatorAccess.allowed, recentStationActivity]
  );
  const visibleTransitionHistory = useMemo(
    () => filterVisibleTransitionHistory(visibleRecentStationActivity, stationTransitionNotice),
    [stationTransitionNotice, visibleRecentStationActivity]
  );
  const isProfileTransitionCompact = currentView === ClientView.PROFILE;

  useEffect(() => {
    if (!featureVisibility.lab && (currentView === ClientView.LAB || currentView === ClientView.HOME)) {
      setCurrentView(ClientView.LOBBY);
      setPreviousView(ClientView.LOBBY);
      return;
    }
    if (!featureVisibility.multiplayer && currentView === ClientView.MULTIPLAYER) {
      setCurrentView(ClientView.LOBBY);
      setPreviousView(ClientView.LOBBY);
      return;
    }
    if (!featureVisibility.store && currentView === ClientView.STORE) {
      setCurrentView(ClientView.LOBBY);
      setPreviousView(ClientView.LOBBY);
      return;
    }
    if (!operatorAccess.allowed && currentView === ClientView.ADMIN) {
      setCurrentView(ClientView.LOBBY);
      setPreviousView(ClientView.LOBBY);
    }
  }, [currentView, featureVisibility.lab, featureVisibility.multiplayer, featureVisibility.store, operatorAccess.allowed]);

  useEffect(() => {
    const previousView = lastPresentationViewRef.current;
    lastPresentationViewRef.current = currentView;
    emitEvent(`nav.section.${currentView.toLowerCase()}.open`, {
      source: 'app',
      metadata: {
        view: currentView,
        previousView,
        guestMode: isGuestMode,
        signedIn: Boolean(user),
        operatorView: currentView === ClientView.ADMIN,
      },
    });
  }, [currentView, emitEvent, isGuestMode, user]);

  useEffect(() => {
    if (authLoading) return;
    const scopeKey = activeUserId ? `account:${activeUserId}` : isGuestMode ? 'guest' : null;
    if (!scopeKey || lastRestoredScopeRef.current !== scopeKey) return;
    writeStoredXtationLastView(currentView, activeUserId);
  }, [authLoading, activeUserId, isGuestMode, currentView]);

  useEffect(() => {
    const refresh = () => {
      const scopedActivity = readStationActivity(activeUserId ?? undefined);
      if (scopedActivity.length) {
        setRecentStationActivity(scopedActivity.slice(0, 2));
        return;
      }
      if (!activeUserId && isGuestMode) {
        setRecentStationActivity(readStationActivity().slice(0, 2));
        return;
      }
      setRecentStationActivity([]);
    };

    refresh();
    if (typeof window === 'undefined') return;
    window.addEventListener(XTATION_STATION_ACTIVITY_EVENT, refresh as EventListener);
    return () => window.removeEventListener(XTATION_STATION_ACTIVITY_EVENT, refresh as EventListener);
  }, [activeUserId, isGuestMode]);

  useEffect(() => {
    const consumeCue = (cue?: XtationStarterWorkspaceCue | null) => {
      if (!cue) return;
      setStarterWorkspaceShellCue(cue);
    };

    consumeCue(readPendingStarterWorkspaceCue());

    const handleStarterWorkspaceCue = (event: Event) => {
      const cue = (event as CustomEvent<XtationStarterWorkspaceCue>).detail;
      consumeCue(cue);
      if (cue?.mode === 'checkpoint') {
        appendStationActivity(
          {
            title: cue.title,
            detail: cue.recommendedDetail,
            workspaceLabel: formatWorkspaceLabel(cue.workspaceView),
            targetView: cue.workspaceView,
            chips: buildStarterLoopChips('starter-checkpoint', [
              cue.questTitle,
              cue.track,
              cue.branch.toLowerCase(),
            ]),
            tone: 'accent',
          },
          activeUserId
        );
      }
    };

    window.addEventListener(STARTER_WORKSPACE_CUE_EVENT, handleStarterWorkspaceCue as EventListener);
    return () =>
      window.removeEventListener(STARTER_WORKSPACE_CUE_EVENT, handleStarterWorkspaceCue as EventListener);
  }, [activeUserId]);

  useEffect(() => {
    const handleStarterWorkspaceAction = (event: Event) => {
      const detail = (event as CustomEvent<{
        workspaceView: ClientView.PROFILE | ClientView.LAB;
        target: string;
      }>).detail;

      let resolvedCue: XtationStarterWorkspaceCue | null = null;

      setStarterWorkspaceShellCue((currentCue) => {
        if (!currentCue) return currentCue;
        if (
          currentCue.workspaceView === detail.workspaceView &&
          currentCue.recommendedActionTarget === detail.target
        ) {
          resolvedCue = currentCue;
          return null;
        }
        return currentCue;
      });

      if (resolvedCue) {
        const actionDescriptor = describeStarterWorkspaceAction(resolvedCue, detail.target as any);
        setStarterWorkspaceActionNotice({
          workspaceView: resolvedCue.workspaceView,
          title: actionDescriptor.title,
          detail: actionDescriptor.detail,
        });
        appendStationActivity(
          {
            title: actionDescriptor.title,
            detail: actionDescriptor.detail,
            workspaceLabel: formatWorkspaceLabel(resolvedCue.workspaceView),
            targetView: resolvedCue.workspaceView,
            chips: actionDescriptor.chips,
            tone: actionDescriptor.tone,
          },
          activeUserId
        );
      }
    };

    const handleStarterWorkspaceDismiss = () => {
      setStarterWorkspaceShellCue(null);
      setStarterWorkspaceActionNotice(null);
    };

    window.addEventListener(STARTER_WORKSPACE_ACTION_EVENT, handleStarterWorkspaceAction as EventListener);
    window.addEventListener(STARTER_WORKSPACE_DISMISS_EVENT, handleStarterWorkspaceDismiss as EventListener);
    return () => {
      window.removeEventListener(STARTER_WORKSPACE_ACTION_EVENT, handleStarterWorkspaceAction as EventListener);
      window.removeEventListener(STARTER_WORKSPACE_DISMISS_EVENT, handleStarterWorkspaceDismiss as EventListener);
    };
  }, [activeUserId]);

  useEffect(() => {
    if (lastMotionViewRef.current === null) {
      lastMotionViewRef.current = currentView;
      return;
    }
    if (lastMotionViewRef.current !== currentView) {
      setViewMotionToken((prev) => (prev === 'xt-shell-section-a' ? 'xt-shell-section-b' : 'xt-shell-section-a'));
      lastMotionViewRef.current = currentView;
    }
  }, [currentView]);

  const openGuestGuidedSetup = () => {
    const localStationActivity = readStationActivity();
    const continuityContext = buildStationContinuityContext(
      localStationActivity,
      readStoredXtationLastView(),
      {
        canAccessAdmin: operatorAccess.allowed,
        featureVisibility,
      },
      2
    );
    const guestEntry = resolveGuestStationEntryState(
      localStationActivity,
      continuityContext.starterFlowSummary,
      continuityContext.latestTransitionActivity,
      {
        canAccessAdmin: operatorAccess.allowed,
        featureVisibility,
      }
    );
    const guidedEntryState =
      guestEntry.localStatus.entryState ??
      (guestEntry.localStatus.mode === 'fresh' ? 'fresh' : 'resume');
    const isFreshGuidedEntry = guidedEntryState === 'fresh';
    const guidedSetupStatus: LocalStationStatus = {
      ...guestEntry.localStatus,
      mode: 'guided',
      entryState: guidedEntryState,
      eyebrow: 'Guided setup',
      title: isFreshGuidedEntry ? 'Start local station' : 'Continue local station',
      detail: isFreshGuidedEntry
        ? 'XTATION is opening the guided setup flow so you can seed the first branch and operating track before moving further.'
        : 'XTATION is restoring the guided setup flow so you can seed the first branch and operating track before moving further.',
      workspaceLabel: formatWorkspaceLabel(ClientView.LOBBY),
      targetView: ClientView.LOBBY,
      actionLabel: isFreshGuidedEntry ? 'Start Guided Setup' : 'Continue Guided Setup',
      statusLabel: 'Setup',
      statusValue: isFreshGuidedEntry ? 'Pending' : 'In progress',
      chips: isFreshGuidedEntry
        ? ['Offline-first', 'Starter flow']
        : ['Offline-first', 'Starter flow', 'Resume'],
    };
    const guidedSetupTransition = buildLocalEntryTransitionDescriptor(
      guidedSetupStatus,
      ClientView.LOBBY
    );
    const nextOnboardingState: XtationOnboardingState = {
      status: 'pending',
      updatedAt: Date.now(),
    };

    setOnboardingState(nextOnboardingState);
    writeXtationOnboardingState(nextOnboardingState, activeUserId);
    writeStationTransitionNotice({
      scope: activeUserId ? 'account' : 'guest',
      ...guidedSetupTransition,
    });
    appendStationActivity(
      {
        ...guidedSetupTransition,
      },
      activeUserId
    );
    setCurrentView(ClientView.LOBBY);
    setPreviousView(ClientView.LOBBY);
    setCustomBackground(null);
    setIsAssistantOpen(false);
    setIsPaletteOpen(false);
    setIsGuestMode(true);
    window.sessionStorage.setItem(GUEST_MODE_SESSION_KEY, 'true');
    setIsOnboardingOpen(true);
  };

  useEffect(() => {
    if (authLoading) return;
    setActiveUserId(activeUserId);
    setCustomBackground(null);
    setResolvedBackgrounds({});
    setActiveReward(null);
    setTriggeredLevels([]);
    setHasInitialized(false);

    if (!activeUserId) {
      setRewardConfigs(defaultRewardConfigs);
      setViewBackgrounds(defaultViewBackgrounds);
      return;
    }

    const storedRewardConfigs = readUserScopedJSON<RewardConfig[]>('rewardConfigs', defaultRewardConfigs, activeUserId);
    setRewardConfigs(Array.isArray(storedRewardConfigs) && storedRewardConfigs.length ? storedRewardConfigs : defaultRewardConfigs);

    const storedBackgrounds = readUserScopedJSON<Record<ClientView, string | null>>(
      'viewBackgrounds',
      defaultViewBackgrounds,
      activeUserId
    );
    setViewBackgrounds({
      ...defaultViewBackgrounds,
      ...(storedBackgrounds || {}),
    });
  }, [authLoading, activeUserId]);

  useEffect(() => {
    if (authLoading) return;

    const scopeKey = activeUserId ? `account:${activeUserId}` : isGuestMode ? 'guest' : null;
    if (!scopeKey) {
      lastRestoredScopeRef.current = null;
      return;
    }

    if (lastRestoredScopeRef.current === scopeKey) return;

    const storedView = readStoredXtationLastView(activeUserId);
    const nextView = resolveXtationLastView(storedView, {
      canAccessAdmin: operatorAccess.allowed,
      featureVisibility,
    });

    setCurrentView(nextView);
    setPreviousView(nextView);
    lastRestoredScopeRef.current = scopeKey;
  }, [
    authLoading,
    activeUserId,
    isGuestMode,
    operatorAccess.allowed,
    featureVisibility.lab,
    featureVisibility.multiplayer,
    featureVisibility.store,
  ]);

  useEffect(() => {
    if (authLoading || !user) return;
    setIsGuestMode(false);
    window.sessionStorage.removeItem(GUEST_MODE_SESSION_KEY);
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !activeUserId) return;
    if (isGuestStationHandoffOpen) return;

    const pendingTransition = readAuthTransitionSignal();
    if (!pendingTransition) return;

    const restoredView = resolveXtationLastView(readStoredXtationLastView(activeUserId), {
      canAccessAdmin: operatorAccess.allowed,
      featureVisibility,
    });
    const transitionDescriptor = buildAuthTransitionResultDescriptor({
      mode: pendingTransition.mode,
      fromGuestMode: pendingTransition.fromGuestMode,
      workspaceLabel: formatWorkspaceLabel(restoredView),
    });

    writeStationTransitionNotice({
      scope: 'account',
      title: transitionDescriptor.title,
      detail: transitionDescriptor.detail,
      workspaceLabel: formatWorkspaceLabel(restoredView),
      targetView: restoredView,
      chips: transitionDescriptor.chips,
      tone: pendingTransition.fromGuestMode ? 'accent' : 'default',
    });
    appendStationActivity(
      {
        title: transitionDescriptor.title,
        detail: transitionDescriptor.detail,
        workspaceLabel: formatWorkspaceLabel(restoredView),
        targetView: restoredView,
        chips: transitionDescriptor.chips,
        tone: pendingTransition.fromGuestMode ? 'accent' : 'default',
      },
      activeUserId
    );
    clearAuthTransitionSignal();
  }, [
    authLoading,
    activeUserId,
    isGuestStationHandoffOpen,
    operatorAccess.allowed,
    featureVisibility.lab,
    featureVisibility.multiplayer,
    featureVisibility.store,
  ]);

  useEffect(() => {
    if (authLoading) {
      setHasResolvedOnboardingScope(false);
      return;
    }

    if (activeUserId) {
      setOnboardingState(readXtationOnboardingState(activeUserId));
      setOnboardingHandoff(readXtationOnboardingHandoff(activeUserId));
      setHasResolvedOnboardingScope(true);
      return;
    }

    if (isGuestMode) {
      setOnboardingState(readXtationOnboardingState());
      setOnboardingHandoff(readXtationOnboardingHandoff());
      setHasResolvedOnboardingScope(true);
      return;
    }

    setOnboardingState(defaultXtationOnboardingState);
    setOnboardingHandoff(null);
    setIsOnboardingOpen(false);
    setHasResolvedOnboardingScope(false);
  }, [authLoading, activeUserId, isGuestMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnboardingStorageChange = () => {
      if (authLoading) return;
      if (activeUserId) {
        setOnboardingState(readXtationOnboardingState(activeUserId));
        setOnboardingHandoff(readXtationOnboardingHandoff(activeUserId));
        setHasResolvedOnboardingScope(true);
        return;
      }
      if (isGuestMode) {
        setOnboardingState(readXtationOnboardingState());
        setOnboardingHandoff(readXtationOnboardingHandoff());
        setHasResolvedOnboardingScope(true);
      }
    };

    window.addEventListener(XTATION_ONBOARDING_STORAGE_EVENT, handleOnboardingStorageChange as EventListener);
    return () =>
      window.removeEventListener(XTATION_ONBOARDING_STORAGE_EVENT, handleOnboardingStorageChange as EventListener);
  }, [authLoading, activeUserId, isGuestMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLastViewStorageChange = (event: Event) => {
      if (authLoading) return;

      const detail = (event as CustomEvent<{ userId?: string | null; view?: ClientView | null }>).detail;
      const eventUserId = detail?.userId ?? null;
      const scopeMatches = activeUserId ? eventUserId === activeUserId : isGuestMode ? eventUserId === null : false;
      if (!scopeMatches) return;

      const nextView = resolveXtationLastView(detail?.view ?? readStoredXtationLastView(activeUserId), {
        canAccessAdmin: operatorAccess.allowed,
        featureVisibility,
      });
      if (nextView === currentView) return;

      setCurrentView(nextView);
      setPreviousView(nextView);
    };

    window.addEventListener(XTATION_LAST_VIEW_STORAGE_EVENT, handleLastViewStorageChange as EventListener);
    return () =>
      window.removeEventListener(XTATION_LAST_VIEW_STORAGE_EVENT, handleLastViewStorageChange as EventListener);
  }, [
    authLoading,
    activeUserId,
    currentView,
    isGuestMode,
    operatorAccess.allowed,
    featureVisibility.lab,
    featureVisibility.multiplayer,
    featureVisibility.store,
  ]);

  useEffect(() => {
    const normalizeNotice = (notice: StationTransitionNotice | null) =>
      resolveVisibleStationTransitionNotice(notice, currentView, {
        canAccessAdmin: operatorAccess.allowed,
        featureVisibility,
      });

    if (authLoading) {
      setStationTransitionNotice(null);
      return;
    }

    const nextNotice = normalizeNotice(readStationTransitionNotice());
    if (isStationTransitionNoticeVisible(nextNotice, { activeUserId, isGuestMode })) {
      setStationTransitionNotice(nextNotice);
      return;
    }

    setStationTransitionNotice(null);
  }, [authLoading, activeUserId, currentView, featureVisibility, isGuestMode, operatorAccess.allowed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const normalizeNotice = (notice: StationTransitionNotice | null) =>
      resolveVisibleStationTransitionNotice(notice, currentView, {
        canAccessAdmin: operatorAccess.allowed,
        featureVisibility,
      });

    const handleStationTransitionNotice = (event: Event) => {
      if (authLoading) return;
      const detail = (event as CustomEvent<StationTransitionNotice | null>).detail;
      const nextNotice = normalizeNotice(detail ?? readStationTransitionNotice());
      if (isStationTransitionNoticeVisible(nextNotice, { activeUserId, isGuestMode })) {
        setStationTransitionNotice(nextNotice);
        return;
      }
      setStationTransitionNotice(null);
    };

    window.addEventListener(
      XTATION_STATION_TRANSITION_NOTICE_EVENT,
      handleStationTransitionNotice as EventListener
    );
    return () =>
      window.removeEventListener(
        XTATION_STATION_TRANSITION_NOTICE_EVENT,
        handleStationTransitionNotice as EventListener
      );
  }, [authLoading, activeUserId, currentView, featureVisibility, isGuestMode, operatorAccess.allowed]);

  useEffect(() => {
    if (authLoading || !activeUserId || authStatus !== 'cloudReady') {
      if (!activeUserId) {
        setIsGuestStationHandoffOpen(false);
        setGuestStationSummary(null);
        setAccountStationSummary(null);
        setGuestStationSignature(null);
        setGuestStationSnapshot(null);
      }
      return;
    }

    const localSnapshot = getGuestStationSnapshot();
    if (!hasGuestStationData(localSnapshot)) {
      setIsGuestStationHandoffOpen(false);
      setGuestStationSummary(null);
      setAccountStationSummary(null);
      setGuestStationSignature(null);
      setGuestStationSnapshot(null);
      return;
    }

    const localSignature = buildGuestStationSignature(localSnapshot);
    const accountSnapshot = getLedgerSnapshot();
    const accountSignature = buildGuestStationSignature(accountSnapshot);
    if (localSignature === accountSignature) {
      setIsGuestStationHandoffOpen(false);
      setGuestStationSummary(null);
      setAccountStationSummary(null);
      setGuestStationSignature(null);
      setGuestStationSnapshot(null);
      return;
    }

    const dismissedSignature = readDismissedGuestStationSignature(activeUserId);
    if (dismissedSignature === localSignature) {
      setIsGuestStationHandoffOpen(false);
      setGuestStationSummary(null);
      setAccountStationSummary(null);
      setGuestStationSignature(localSignature);
      setGuestStationSnapshot(localSnapshot);
      return;
    }

    setGuestStationSummary(buildGuestStationSummary(localSnapshot));
    setAccountStationSummary(buildGuestStationSummary(accountSnapshot));
    setGuestStationSignature(localSignature);
    setGuestStationSnapshot(localSnapshot);
    setIsGuestStationHandoffOpen(true);
  }, [authLoading, activeUserId, authStatus, tasks.length, stats.totalEarnedXP]);

  useEffect(() => {
    if (authLoading) return;
    if (!activeUserId && !isGuestMode) return;

    if (tasks.length > 0 && onboardingState.status === 'pending') {
      const nextState: XtationOnboardingState = {
        status: 'completed',
        updatedAt: Date.now(),
      };
      setOnboardingState(nextState);
      writeXtationOnboardingState(nextState, activeUserId);
      setIsOnboardingOpen(false);
    }
  }, [authLoading, activeUserId, isGuestMode, onboardingState.status, tasks.length]);

  useEffect(() => {
    if (authLoading) return;
    if (!activeUserId && !isGuestMode) {
      setIsOnboardingOpen(false);
      return;
    }

    if (!hasResolvedOnboardingScope) return;

    if (!tasks.length && onboardingState.status === 'pending') {
      setIsOnboardingOpen(true);
    }
  }, [authLoading, activeUserId, isGuestMode, tasks.length, onboardingState.status, hasResolvedOnboardingScope]);

  useEffect(() => {
    if (!activeUserId) return;
    writeUserScopedJSON('rewardConfigs', rewardConfigs, activeUserId);
  }, [rewardConfigs, activeUserId]);

  useEffect(() => {
    if (!activeUserId) return;
    try {
      writeUserScopedJSON('viewBackgrounds', viewBackgrounds, activeUserId);
    } catch (err) {
      console.error('Failed to persist backgrounds', err);
    }
  }, [viewBackgrounds, activeUserId]);

  // Resolve any idb-backed backgrounds to object URLs
  useEffect(() => {
    const load = async () => {
      const entries = Object.entries(viewBackgrounds).filter(([, val]) => val?.startsWith('idb:')) as [string, string][];
      if (entries.length === 0) return;
      const newResolved: Record<string, string> = {};
      for (const [, key] of entries) {
        if (resolvedBackgrounds[key]) {
          newResolved[key] = resolvedBackgrounds[key];
          continue;
        }
        const blob = await loadBackgroundBlob(key);
        if (blob) {
          const url = URL.createObjectURL(blob);
          newResolved[key] = url;
        }
      }
      if (Object.keys(newResolved).length) {
        setResolvedBackgrounds(prev => ({ ...prev, ...newResolved }));
      }
    };
    load();
  }, [viewBackgrounds, resolvedBackgrounds]);

  

  // Monitor XP for Rewards
  useEffect(() => {
    // Initial Load: Don't trigger animations for already achieved levels
    if (!hasInitialized) {
        const alreadyReached = rewardConfigs
            .filter(c => totalXP >= c.threshold)
            .map(c => c.level);
            
        setTriggeredLevels(alreadyReached);
        setHasInitialized(true);
        return;
    }

    // RESET LOGIC: Check if we dropped below any previously achieved thresholds
    // This allows re-triggering if XP goes down and back up
    const stillAchievedLevels = triggeredLevels.filter(level => {
        const config = rewardConfigs.find(c => c.level === level);
        // If config exists and we still meet the threshold, keep it.
        // If config is missing (deleted level?) or threshold not met, drop it.
        return config && totalXP >= config.threshold;
    });

    if (stillAchievedLevels.length !== triggeredLevels.length) {
        setTriggeredLevels(stillAchievedLevels);
        // Return early to let state update before checking for new triggers
        return; 
    }

      // TRIGGER LOGIC: Check for new achievements
      rewardConfigs.forEach(config => {
        if (totalXP >= config.threshold && !triggeredLevels.includes(config.level)) {
            // Trigger Reward
            setTriggeredLevels(prev => [...prev, config.level]);
            setActiveReward(config);
            setActiveRewardDuration(4000); // fallback until media reports duration
            rewardStartRef.current = Date.now();
        }
      });
  }, [totalXP, rewardConfigs, triggeredLevels, hasInitialized]);


  const getBackgroundStyle = () => {
    const rawBg = customBackground || viewBackgrounds[currentView];
    let bg: string | null = rawBg || null;
    if (rawBg?.startsWith('idb:')) {
        bg = resolvedBackgrounds[rawBg] || null;
    }
    if (bg) {
        return { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
    return { backgroundImage: 'none', backgroundColor: 'var(--ui-bg)' };
  };

  const handlePlayClick = () => {
     if (currentView !== ClientView.LOBBY && currentView !== ClientView.CHAMP_SELECT && currentView !== ClientView.MATCH_FOUND) {
         setPreviousView(currentView);
         setCurrentView(ClientView.LOBBY);
         setCustomBackground(null);
     }
  };

  useEffect(() => {
    const handleOpenPlayer = (event: Event) => {
      const detail = (event as CustomEvent<{ playerId?: string }>).detail;
      if (!detail?.playerId) return;
      writeUserScopedString('mp_focusPlayerId', detail.playerId, activeUserId);
      if (currentView !== ClientView.MULTIPLAYER) {
        setPreviousView(currentView);
        setCurrentView(ClientView.MULTIPLAYER);
      }
    };

    window.addEventListener('dusk:openPlayerDossier', handleOpenPlayer as EventListener);
    return () => window.removeEventListener('dusk:openPlayerDossier', handleOpenPlayer as EventListener);
  }, [activeUserId, currentView]);

  useEffect(() => {
    const handleAssistantBrief = (event: Event) => {
      const detail = (event as CustomEvent<StoredDuskBrief>).detail;
      if (!detail?.title || !detail?.body) return;
      persistLatestDuskBrief(detail, activeUserId || 'local');
      setIsAssistantOpen(true);
    };

    window.addEventListener(DUSK_BRIEF_EVENT, handleAssistantBrief as EventListener);
    return () => window.removeEventListener(DUSK_BRIEF_EVENT, handleAssistantBrief as EventListener);
  }, [activeUserId]);

  useEffect(() => {
    const handleOpenLab = (event: Event) => {
      const detail = (event as CustomEvent<LabNavigationPayload>).detail;
      if (!detail) return;
      if (currentView !== ClientView.LAB && currentView !== ClientView.HOME) {
        setPreviousView(currentView);
        setCurrentView(ClientView.LAB);
      }
    };

    window.addEventListener(LAB_NAVIGATION_EVENT, handleOpenLab as EventListener);
    return () => window.removeEventListener(LAB_NAVIGATION_EVENT, handleOpenLab as EventListener);
  }, [currentView]);

  useEffect(() => {
    const handleOpenPlay = (event: Event) => {
      const detail = (event as CustomEvent<PlayNavigationPayload>).detail;
      if (!detail) return;
      if (!isPlayStageView(currentView)) {
        setPreviousView(currentView);
        setCurrentView(ClientView.LOBBY);
      }
    };

    window.addEventListener(PLAY_NAVIGATION_EVENT, handleOpenPlay as EventListener);
    return () => window.removeEventListener(PLAY_NAVIGATION_EVENT, handleOpenPlay as EventListener);
  }, [currentView]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const preload = () => {
      void loadDuskRelay();
      void loadLab();
      void loadAdmin();
      void loadProfile();
      void loadSettings();
      void loadStore();
    };

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preload, { timeout: 1800 });
      return () => window.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(preload, 900);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const updateRewardConfig = (newConfig: RewardConfig) => {
    setRewardConfigs(prev => prev.map(c => c.level === newConfig.level ? newConfig : c));
  };

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const dataUrl = await readFileAsDataUrl(file);
        const approxSize = dataUrl.length * 0.75; // bytes
        const localLimit = 4.5 * 1024 * 1024;

        let storedValue: string = dataUrl;
        if (approxSize > localLimit) {
            const idbKey = await saveBackgroundBlob(file);
            storedValue = idbKey;
        }

        setViewBackgrounds(prev => ({ ...prev, [currentView]: storedValue }));
        setCustomBackground(storedValue.startsWith('idb:') ? null : storedValue);
        playClickSound();
    } catch (err) {
        console.error('Failed to load background', err);
    } finally {
        if (backgroundInputRef.current) backgroundInputRef.current.value = '';
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case ClientView.HOME:
      case ClientView.LAB:
        return <LazyLab />;
      case ClientView.ADMIN:
        return <LazyAdmin onChangeView={(view) => setCurrentView(view)} />;
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
            onOpenWorkspace={(view) => {
              if (isPlayStageView(currentView)) {
                setPreviousView(currentView);
              }
              setCurrentView(view);
            }}
            onOpenGuidedSetup={onboardingState.status !== 'completed' ? () => setIsOnboardingOpen(true) : undefined}
            onboardingHandoff={onboardingHandoff}
            stationIdentity={stationIdentitySummary}
            onStarterSessionLive={(transition) => {
              writeStationTransitionNotice({
                scope: activeUserId ? 'account' : 'guest',
                ...transition,
              });
              appendStationActivity(
                {
                  ...transition,
                  chips: buildStarterLoopChips('starter-session-live', transition.chips),
                },
                activeUserId
              );
            }}
            onDismissOnboardingHandoff={() => {
              setOnboardingHandoff(null);
              writeXtationOnboardingHandoff(null, activeUserId);
            }}
            onNavigateStage={(view) => {
              // keep App route synced so TopBar lock + background behave consistently
              setCurrentView(view);
            }}
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

  // IndexedDB helpers for large backgrounds
  const openBgDB = () => new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('ViewBackgroundDB', 1);
    req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('backgrounds')) {
            db.createObjectStore('backgrounds');
        }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const saveBackgroundBlob = async (file: File) => {
    const db = await openBgDB();
    const key = `bg-${Date.now()}`;
    const tx = db.transaction('backgrounds', 'readwrite');
    tx.objectStore('backgrounds').put(file, key);
    await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(null);
        tx.onerror = () => reject(tx.error);
    });
    return `idb:${key}`;
  };

  const loadBackgroundBlob = async (idbKey: string) => {
    const key = idbKey.replace('idb:', '');
    try {
        const db = await openBgDB();
        const tx = db.transaction('backgrounds', 'readonly');
        const req = tx.objectStore('backgrounds').get(key);
        const blob: Blob | undefined = await new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result as Blob | undefined);
            req.onerror = () => reject(req.error);
        });
        return blob || null;
    } catch (err) {
        console.error('Failed to load background blob', err);
        return null;
    }
  };

  useEffect(() => {
    if (!activeReward) {
        if (rewardDismissTimer.current) {
            clearTimeout(rewardDismissTimer.current);
            rewardDismissTimer.current = null;
        }
        return;
    }
    if (rewardDismissTimer.current) {
        clearTimeout(rewardDismissTimer.current);
    }
    const elapsed = Date.now() - rewardStartRef.current;
    const remaining = Math.max(activeRewardDuration - elapsed, 250);
    rewardDismissTimer.current = window.setTimeout(() => {
        setActiveReward(null);
    }, remaining);

    return () => {
        if (rewardDismissTimer.current) {
            clearTimeout(rewardDismissTimer.current);
            rewardDismissTimer.current = null;
        }
    };
  }, [activeReward, activeRewardDuration]);

  if (isAuthCallbackRoute) {
    return <AuthCallbackView />;
  }

  if (isResetPasswordRoute) {
    return <ResetPasswordView />;
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(111,178,255,0.18),transparent_34%),linear-gradient(180deg,#070b15_0%,#090d18_42%,#0d111d_100%)] px-6 text-[var(--app-text)]">
        <div className="xt-shell-loading-card max-w-lg px-8 py-10 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--app-accent)]">XTATION</div>
          <div className="mt-3 text-2xl font-semibold">Opening station</div>
          <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
            Hydrating your local shell and checking sync state before the client opens.
          </div>
          <div className="mt-6 flex items-center justify-center gap-2">
            <span className="xt-shell-dot h-2.5 w-2.5 rounded-full bg-[var(--app-accent)]" />
            <span className="xt-shell-dot xt-shell-dot--2 h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_70%,transparent)]" />
            <span className="xt-shell-dot xt-shell-dot--3 h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--app-accent)_40%,transparent)]" />
          </div>
        </div>
      </div>
    );
  }

  if (!user && !isGuestMode) {
    return (
      <Welcome
        onEnterLocalMode={() => {
          const lastView = readStoredXtationLastView();
          const localStationActivity = readStationActivity();
          const continuityContext =
            buildStationContinuityContext(
              localStationActivity,
              lastView,
              {
                canAccessAdmin: operatorAccess.allowed,
                featureVisibility,
              },
              2
            );
          const guestEntry = resolveGuestStationEntryState(
            localStationActivity,
            continuityContext.starterFlowSummary,
            continuityContext.latestTransitionActivity,
            {
              canAccessAdmin: operatorAccess.allowed,
              featureVisibility,
            }
          );
          writeStationTransitionNotice({
            scope: 'guest',
            title: guestEntry.transitionDescriptor.title,
            detail: guestEntry.transitionDescriptor.detail,
            workspaceLabel: guestEntry.transitionDescriptor.workspaceLabel,
            targetView: guestEntry.transitionDescriptor.targetView,
            chips: guestEntry.transitionDescriptor.chips,
            tone: guestEntry.transitionDescriptor.tone,
          });
          setCurrentView(guestEntry.resumeView);
          setPreviousView(guestEntry.resumeView);
          setCustomBackground(null);
          setIsAssistantOpen(false);
          setIsPaletteOpen(false);
          setIsGuestMode(true);
          window.sessionStorage.setItem(GUEST_MODE_SESSION_KEY, 'true');
        }}
        onResumeGuidedSetup={openGuestGuidedSetup}
      />
    );
  }

  return (
    <div 
        className="xt-shell-root w-full min-h-[100dvh] md:h-screen lg:h-full flex flex-col overflow-hidden text-[var(--ui-text)] font-mono bg-cover bg-center transition-all duration-200 ease-out relative"
        style={getBackgroundStyle()}
    >
      <ScheduledTaskPrompt />
      
      {/* Top Navigation */}
      <TopBar
        currentView={currentView}
        onChangeView={(view) => {
            setCurrentView(view);
            setCustomBackground(null);
        }}
        onPlayClick={handlePlayClick}
        onToggleAssistant={() => setIsAssistantOpen(!isAssistantOpen)}
        isAssistantOpen={isAssistantOpen}
        activeTasksCount={activeTasksCount}
        onOpenPalette={() => setIsPaletteOpen(true)}
        isGuestMode={!user && isGuestMode}
        onOpenGuidedSetup={!user ? openGuestGuidedSetup : undefined}
        canAccessAdmin={operatorAccess.allowed}
        featureVisibility={featureVisibility}
        onExitGuestMode={
          !user && isGuestMode
            ? () => {
                setIsGuestMode(false);
                window.sessionStorage.removeItem(GUEST_MODE_SESSION_KEY);
              }
            : undefined
        }
      />

      {stationTransitionNotice ? (
        <div
          className={
            isProfileTransitionCompact
              ? 'xt-shell-transition-wrap xt-shell-transition-wrap--scene'
              : 'px-3 pb-0 pt-3 md:px-4'
          }
        >
          <div
            className={`xt-shell-transition-note ${
              stationTransitionNotice.tone === 'accent' ? 'xt-shell-transition-note--accent' : ''
            } ${isProfileTransitionCompact ? 'xt-shell-transition-note--compact xt-shell-transition-note--scene' : ''}`}
          >
            <div className="xt-shell-transition-note__meta">
              <span className="xt-shell-transition-note__eyebrow">Station Transition</span>
              {stationTransitionNotice.workspaceLabel ? (
                <span className="xt-shell-transition-note__workspace">{stationTransitionNotice.workspaceLabel}</span>
              ) : null}
            </div>
            <div className="xt-shell-transition-note__body">
              <div className="xt-shell-transition-note__title">{stationTransitionNotice.title}</div>
              {!isProfileTransitionCompact ? (
                <div className="xt-shell-transition-note__detail">{stationTransitionNotice.detail}</div>
              ) : null}
            </div>
            {!isProfileTransitionCompact ? (
              <div className="xt-shell-transition-note__identity">
                <div className="xt-shell-transition-note__identity-kicker">{stationIdentitySummary.modeLabel}</div>
                {showTransitionIdentityTitle ? (
                  <div className="xt-shell-transition-note__identity-title">{stationIdentitySummary.title}</div>
                ) : null}
                {showTransitionIdentityDetail ? (
                  <div className="xt-shell-transition-note__identity-detail">
                    {stationIdentitySummary.detail}
                  </div>
                ) : null}
              </div>
            ) : null}
            {stationTransitionNotice.chips?.length && !isProfileTransitionCompact ? (
              <div className="xt-shell-transition-note__chips">
                {stationTransitionNotice.chips.map((chip) => (
                  <span key={chip} className="xt-shell-transition-note__chip">
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
            {visibleTransitionHistory.length && !isProfileTransitionCompact ? (
              <div className="xt-shell-transition-note__history">
                <div className="xt-shell-transition-note__history-head">Recent continuity</div>
                <div className="xt-shell-transition-note__history-list">
                  {visibleTransitionHistory.map((entry) => (
                    <div key={entry.id} className="xt-shell-transition-note__history-row">
                      <div>
                        <div className="xt-shell-transition-note__history-title">{entry.title}</div>
                        <div className="xt-shell-transition-note__history-detail">
                          {entry.workspaceLabel ? `${entry.workspaceLabel} • ` : ''}
                          {entry.detail}
                        </div>
                      </div>
                      <div className="xt-shell-transition-note__history-time">
                        {new Date(entry.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="xt-shell-transition-note__actions">
              {canLaunchGuidedSetupFromTransition ? (
                <button
                  type="button"
                  className="xt-shell-transition-note__action xt-shell-transition-note__action--primary"
                  onClick={openGuestGuidedSetup}
                >
                  {guidedSetupTransitionActionLabel}
                </button>
              ) : null}
              {stationTransitionNotice.targetView && currentView !== stationTransitionNotice.targetView ? (
                <button
                  type="button"
                  className="xt-shell-transition-note__action xt-shell-transition-note__action--primary"
                  onClick={() => {
                    setCurrentView(stationTransitionNotice.targetView as ClientView);
                    clearStationTransitionNotice();
                    setStationTransitionNotice(null);
                  }}
                >
                  Open {formatWorkspaceLabel(stationTransitionNotice.targetView)}
                </button>
              ) : null}
              {currentView !== ClientView.SETTINGS &&
              !isProfileTransitionCompact &&
              !isOnboardingOpen ? (
                <button
                  type="button"
                  className="xt-shell-transition-note__action"
                  onClick={() => {
                    setCurrentView(ClientView.SETTINGS);
                    clearStationTransitionNotice();
                    setStationTransitionNotice(null);
                  }}
                >
                  Review Settings
                </button>
              ) : null}
              <button
                type="button"
                className="xt-shell-transition-note__dismiss"
                onClick={() => {
                  clearStationTransitionNotice();
                  setStationTransitionNotice(null);
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {starterWorkspaceShellCue ? (
        <div className="px-3 pb-0 pt-3 md:px-4">
          <div className="xt-shell-transition-note xt-shell-transition-note--accent">
            <div className="xt-shell-transition-note__meta">
              <span className="xt-shell-transition-note__eyebrow">{formatStarterWorkspaceCueEyebrow(starterWorkspaceShellCue)}</span>
              <span className="xt-shell-transition-note__workspace">
                {formatWorkspaceLabel(starterWorkspaceShellCue.workspaceView)}
              </span>
            </div>
            <div className="xt-shell-transition-note__body">
              <div className="xt-shell-transition-note__title">{starterWorkspaceShellCue.title}</div>
              <div className="xt-shell-transition-note__detail">{starterWorkspaceShellCue.recommendedDetail}</div>
            </div>
            <div className="xt-shell-transition-note__identity">
              <div className="xt-shell-transition-note__identity-kicker">{stationIdentitySummary.modeLabel}</div>
              <div className="xt-shell-transition-note__identity-title">{stationIdentitySummary.title}</div>
              <div className="xt-shell-transition-note__identity-detail">{stationIdentitySummary.detail}</div>
            </div>
            <div className="xt-shell-transition-note__chips">
              <span className="xt-shell-transition-note__chip">{starterWorkspaceShellCue.questTitle}</span>
              {starterWorkspaceShellCue.chips.map((chip) => (
                <span key={`starter-shell-${chip}`} className="xt-shell-transition-note__chip">
                  {chip}
                </span>
              ))}
            </div>
            {starterWorkspaceShellCue.mode === 'checkpoint' && starterWorkspaceShellCue.checkpointLabel ? (
              <div className="xt-shell-transition-note__checkpoint">
                <div className="xt-shell-transition-note__checkpoint-head">
                  <span className="xt-shell-transition-note__checkpoint-label">
                    {starterWorkspaceShellCue.checkpointLabel}
                  </span>
                  {starterWorkspaceShellCue.checkpointTrackedLabel ? (
                    <span className="xt-shell-transition-note__checkpoint-meta">
                      {starterWorkspaceShellCue.checkpointTrackedLabel}
                    </span>
                  ) : null}
                </div>
                {starterWorkspaceShellCue.checkpointDetail ? (
                  <div className="xt-shell-transition-note__checkpoint-detail">
                    {starterWorkspaceShellCue.checkpointDetail}
                  </div>
                ) : null}
                {starterWorkspaceShellCue.checkpointOutcomeLabel ? (
                  <div className="xt-shell-transition-note__checkpoint-outcome">
                    <span className="xt-shell-transition-note__checkpoint-outcome-label">
                      {starterWorkspaceShellCue.checkpointOutcomeLabel}
                    </span>
                    {starterWorkspaceShellCue.checkpointOutcomeDetail ? (
                      <span className="xt-shell-transition-note__checkpoint-outcome-detail">
                        {starterWorkspaceShellCue.checkpointOutcomeDetail}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="xt-shell-transition-note__checkpoint-bar">
                  <div
                    className="xt-shell-transition-note__checkpoint-fill"
                    style={{ width: `${Math.round((starterWorkspaceShellCue.checkpointProgress ?? 0) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
            <div className="xt-shell-transition-note__actions">
              <button
                type="button"
                className="xt-shell-transition-note__action xt-shell-transition-note__action--primary"
                onClick={() => {
                  openStarterWorkspaceAction({
                    workspaceView: starterWorkspaceShellCue.workspaceView,
                    target: starterWorkspaceShellCue.recommendedActionTarget,
                    source: 'shell',
                  });
                  if (currentView !== starterWorkspaceShellCue.workspaceView) {
                    setPreviousView(currentView);
                    setCurrentView(starterWorkspaceShellCue.workspaceView);
                  }
                  setStarterWorkspaceShellCue(null);
                }}
              >
                {starterWorkspaceShellCue.recommendedActionLabel}
              </button>
              {currentView !== starterWorkspaceShellCue.workspaceView ? (
                <button
                  type="button"
                  className="xt-shell-transition-note__action"
                  onClick={() => {
                    setPreviousView(currentView);
                    setCurrentView(starterWorkspaceShellCue.workspaceView);
                  }}
                >
                  Open {formatWorkspaceLabel(starterWorkspaceShellCue.workspaceView)}
                </button>
              ) : null}
              <button
                type="button"
                className="xt-shell-transition-note__dismiss"
                onClick={() => setStarterWorkspaceShellCue(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!starterWorkspaceShellCue && starterWorkspaceActionNotice ? (
        <div className="px-3 pb-0 pt-3 md:px-4">
          <div className="xt-shell-transition-note">
            <div className="xt-shell-transition-note__meta">
              <span className="xt-shell-transition-note__eyebrow">Starter action</span>
              <span className="xt-shell-transition-note__workspace">
                {formatWorkspaceLabel(starterWorkspaceActionNotice.workspaceView)}
              </span>
            </div>
            <div className="xt-shell-transition-note__body">
              <div className="xt-shell-transition-note__title">{starterWorkspaceActionNotice.title}</div>
              <div className="xt-shell-transition-note__detail">{starterWorkspaceActionNotice.detail}</div>
            </div>
            <div className="xt-shell-transition-note__actions">
              {currentView !== starterWorkspaceActionNotice.workspaceView ? (
                <button
                  type="button"
                  className="xt-shell-transition-note__action xt-shell-transition-note__action--primary"
                  onClick={() => {
                    setPreviousView(currentView);
                    setCurrentView(starterWorkspaceActionNotice.workspaceView);
                    setStarterWorkspaceActionNotice(null);
                  }}
                >
                  Open {formatWorkspaceLabel(starterWorkspaceActionNotice.workspaceView)}
                </button>
              ) : null}
              <button
                type="button"
                className="xt-shell-transition-note__dismiss"
                onClick={() => setStarterWorkspaceActionNotice(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Content Area */}
      <div className="xt-shell-main flex-1 min-h-0 flex overflow-hidden relative z-10">
        
        {/* Center Viewport */}
        <div key={`viewport-${userScopeRenderKey}`} className="xt-shell-viewport flex-1 min-h-0 relative overflow-y-auto overscroll-contain bg-transparent">
            {operatorState.supportLens ? (
              <div className="absolute left-4 right-4 top-4 z-20 rounded-[20px] border border-[color-mix(in_srgb,var(--app-accent)_46%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] px-4 py-3 text-sm text-[var(--app-text)] shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-sm">
                <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-accent)]">Support Lens</span>
                <div className="mt-1">
                  Operator context is locked to <span className="font-semibold">{operatorState.supportLens.stationLabel}</span>.
                </div>
              </div>
            ) : null}
            <Suspense fallback={<SectionLoadingState view={currentView} />}>
              <div className={`xt-shell-stage ${viewMotionToken}`}>
                {renderContent()}
              </div>
            </Suspense>
        </div>
      </div>

      <Suspense fallback={null}>
        <LazyChatDock key={`chat-${userScopeRenderKey}`} />
      </Suspense>

      {/* Dusk relay overlay */}
      <TerminalErrorBoundary key={`${userScopeRenderKey}-${isAssistantOpen ? 'assistant-open' : 'assistant-closed'}`}>
        <Suspense fallback={isAssistantOpen ? <AssistantLoadingState /> : null}>
          <LazyDuskRelay
            key={`assistant-${userScopeRenderKey}`}
            isOpen={isAssistantOpen}
            onClose={() => setIsAssistantOpen(false)}
          />
        </Suspense>
      </TerminalErrorBoundary>

      {/* Reward System Overlay */}
      {activeReward && (
          <RewardOverlay 
            config={activeReward} 
            onDismiss={() => setActiveReward(null)} 
            onDurationResolved={(ms) => {
                if (ms && Number.isFinite(ms)) {
                    setActiveRewardDuration(ms);
                }
            }}
          />
      )}

      <CommandPalette
        open={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onChangeView={(view) => {
          setCurrentView(view);
          setCustomBackground(null);
        }}
        onToggleAssistant={() => setIsAssistantOpen((prev) => !prev)}
        canAccessAdmin={operatorAccess.allowed}
        featureVisibility={featureVisibility}
      />

      <FirstRunSetup
        open={isOnboardingOpen && currentView !== ClientView.ADMIN}
        onClose={() => {
          if (onboardingState.status === 'completed') {
            setIsOnboardingOpen(false);
            return;
          }
          const nextState: XtationOnboardingState = {
            status: 'skipped',
            updatedAt: Date.now(),
          };
          setOnboardingState(nextState);
          writeXtationOnboardingState(nextState, activeUserId);
          const skippedTransition = buildStarterSkippedTransition();
          writeStationTransitionNotice({
            scope: activeUserId ? 'account' : 'guest',
            ...skippedTransition,
          });
          appendStationActivity(
            {
              ...skippedTransition,
            },
            activeUserId
          );
          setIsOnboardingOpen(false);
        }}
        onComplete={(payload) => {
          const nextState: XtationOnboardingState = {
            status: 'completed',
            updatedAt: Date.now(),
          };
          const nextHandoff: XtationOnboardingHandoff = {
            questId: payload.questId,
            title: payload.title,
            branch: payload.branch,
            track: payload.track,
            nodeTitle: payload.nodeTitle,
            createdAt: Date.now(),
            dismissedAt: null,
          };
          setOnboardingState(nextState);
          setOnboardingHandoff(nextHandoff);
          writeXtationOnboardingState(nextState, activeUserId);
          writeXtationOnboardingHandoff(nextHandoff, activeUserId);
          const seededTransition = buildStarterSeededTransition(nextHandoff);
          writeStationTransitionNotice({
            scope: activeUserId ? 'account' : 'guest',
            ...seededTransition,
          });
          appendStationActivity(
            {
              ...seededTransition,
            },
            activeUserId
          );
          setCurrentView(ClientView.LOBBY);
          setPreviousView(ClientView.LOBBY);
          setCustomBackground(null);
          setIsOnboardingOpen(false);
        }}
      />

      {isGuestStationHandoffOpen && guestStationSummary && accountStationSummary && guestStationSignature ? (
        (() => {
          const guestLastView = readStoredXtationLastView();
          const importedView = resolveXtationLastView(guestLastView, {
            canAccessAdmin: operatorAccess.allowed,
            featureVisibility,
          });
          const accountView = resolveXtationLastView(readStoredXtationLastView(activeUserId), {
            canAccessAdmin: operatorAccess.allowed,
            featureVisibility,
          });

          return (
            <GuestStationHandoff
              open={isGuestStationHandoffOpen}
              localSummary={guestStationSummary}
              accountSummary={accountStationSummary}
              accountLabel={user?.email || user?.name || 'this account'}
              accountWorkspace={accountView}
              importWorkspace={importedView}
              onKeepAccount={() => {
                if (!activeUserId) return;
                writeDismissedGuestStationSignature(activeUserId, guestStationSignature);
                clearAuthTransitionSignal();
                writeStationTransitionNotice({
                  scope: 'account',
                  title: 'Account station active',
                  detail: `Continuing with the signed-in station. Local progress remains on this device and can still be imported later.`,
                  workspaceLabel: formatWorkspaceLabel(accountView),
                  targetView: accountView,
                  chips: ['Cloud state unchanged', 'Guest station kept local', accountView === ClientView.LAB ? 'Lab resumed' : `${formatWorkspaceLabel(accountView)} resumed`],
                });
                appendStationActivity(
                  {
                    title: 'Account station active',
                    detail: 'Continuing with the signed-in station. Local progress remains on this device and can still be imported later.',
                    workspaceLabel: formatWorkspaceLabel(accountView),
                    targetView: accountView,
                    chips: ['Cloud state unchanged', 'Guest station kept local', accountView === ClientView.LAB ? 'Lab resumed' : `${formatWorkspaceLabel(accountView)} resumed`],
                  },
                  activeUserId
                );
                setIsGuestStationHandoffOpen(false);
              }}
              onImportLocal={() => {
                if (!activeUserId || !guestStationSnapshot) return;
                clearAuthTransitionSignal();
                const guestOnboardingState = readXtationOnboardingState();
                const guestOnboardingHandoff = readXtationOnboardingHandoff();
                writeGuestStationRecoverySnapshot(activeUserId, {
                  createdAt: Date.now(),
                  importedUserId: activeUserId,
                  importedUserEmail: user?.email || null,
                  accountSnapshot: getLedgerSnapshot(),
                  guestSnapshot: guestStationSnapshot,
                  guestContext: {
                    lastView: guestLastView,
                    importedView,
                    onboardingState: guestOnboardingState,
                    onboardingHandoff: guestOnboardingHandoff,
                  },
                });
                replaceLedger(guestStationSnapshot, true);
                writeStoredXtationLastView(importedView, activeUserId);
                writeXtationOnboardingState(guestOnboardingState, activeUserId);
                writeXtationOnboardingHandoff(guestOnboardingHandoff, activeUserId);
                clearGuestStationSnapshot();
                writeXtationOnboardingState(defaultXtationOnboardingState);
                writeXtationOnboardingHandoff(null);
                writeStationTransitionNotice({
                  scope: 'account',
                  title: 'Local station imported',
                  detail: `The guest station is now the active signed-in workspace. XTATION saved a recovery snapshot of the previous account record before switching over.`,
                  workspaceLabel: formatWorkspaceLabel(importedView),
                  targetView: importedView,
                  chips: ['Recovery snapshot saved', 'Cloud station updated', `${formatWorkspaceLabel(importedView)} reopened`],
                  tone: 'accent',
                });
                appendStationActivity(
                  {
                    title: 'Local station imported',
                    detail: 'The guest station is now the active signed-in workspace. XTATION saved a recovery snapshot of the previous account record before switching over.',
                    workspaceLabel: formatWorkspaceLabel(importedView),
                    targetView: importedView,
                    chips: ['Recovery snapshot saved', 'Cloud station updated', `${formatWorkspaceLabel(importedView)} reopened`],
                    tone: 'accent',
                  },
                  activeUserId
                );
                setCurrentView(importedView);
                setPreviousView(importedView);
                setCustomBackground(null);
                setGuestStationSummary(null);
                setAccountStationSummary(null);
                setGuestStationSignature(null);
                setGuestStationSnapshot(null);
                setIsGuestStationHandoffOpen(false);
              }}
              onReturnToLocal={() => {
                clearAuthTransitionSignal();
                const guestReturnView = resolveXtationLastView(guestLastView, {
                  canAccessAdmin: false,
                  featureVisibility,
                });
                writeStationTransitionNotice({
                  scope: 'guest',
                  title: 'Returned to local station',
                  detail: 'The signed-in account was left unchanged. XTATION is reopening the offline-first local workspace on this device.',
                  workspaceLabel: formatWorkspaceLabel(guestReturnView),
                  targetView: guestReturnView,
                  chips: ['Account unchanged', 'Import deferred', `${formatWorkspaceLabel(guestReturnView)} resumed`],
                });
                appendStationActivity({
                  title: 'Returned to local station',
                  detail: 'The signed-in account was left unchanged. XTATION is reopening the offline-first local workspace on this device.',
                  workspaceLabel: formatWorkspaceLabel(guestReturnView),
                  targetView: guestReturnView,
                  chips: ['Account unchanged', 'Import deferred', `${formatWorkspaceLabel(guestReturnView)} resumed`],
                });
                window.sessionStorage.setItem(GUEST_MODE_SESSION_KEY, 'true');
                setIsGuestMode(true);
                setIsGuestStationHandoffOpen(false);
                void signOut();
              }}
            />
          );
        })()
      ) : null}

      <Suspense fallback={null}>
        <LazyDevHUD />
      </Suspense>

            {/* Global decorative border bottom */}
      <div className="h-0.5 bg-gradient-to-r from-[#010A13] via-[#C8AA6E] to-[#010A13] opacity-30 z-50"></div>
    </div>
  );
};

export default App;
