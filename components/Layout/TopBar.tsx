
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Settings, Bell, Trophy, Bot, X } from 'lucide-react';
import { ClientView } from '../../types';
import { NavTab } from '../UI/HextechUI';
import { AuthDrawer } from '../UI/AuthDrawer';
import { SignInPage } from '../ui/sign-in';
import { writeAuthTransitionSignal } from '../../src/auth/authTransitionSignal';
import { playClickSound, playHoverSound } from '../../utils/SoundEffects';
import { useXP } from '../XP/xpStore';
import { useAuth } from '../../src/auth/AuthProvider';
import { useAdminConsole } from '../../src/admin/AdminConsoleProvider';
import {
  readGuestStationRecoverySnapshot,
  XTATION_GUEST_STATION_RECOVERY_EVENT,
} from '../../src/auth/guestStation';
import { buildStationIdentitySummary } from '../../src/station/stationIdentity';
import { buildStationContinuityContext } from '../../src/station/continuityContext';
import {
  readStationActivity,
  XTATION_STATION_ACTIVITY_EVENT,
  type StationActivityEntry,
} from '../../src/station/stationActivity';
import { resolveGuestStationEntryState } from '../../src/welcome/guestContinuity';

interface TopBarProps {
  currentView: ClientView;
  onChangeView: (view: ClientView) => void;
  onPlayClick: () => void;
  onToggleAssistant: () => void;
  isAssistantOpen: boolean;
  activeTasksCount: number;
  onOpenPalette?: () => void;
  isGuestMode?: boolean;
  onExitGuestMode?: () => void;
  onOpenGuidedSetup?: () => void;
  canAccessAdmin?: boolean;
  featureVisibility?: {
    lab: boolean;
    multiplayer: boolean;
    store: boolean;
  };
}

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  onChangeView,
  onPlayClick,
  onToggleAssistant,
  isAssistantOpen,
  activeTasksCount,
  onOpenPalette,
  isGuestMode = false,
  onExitGuestMode,
  onOpenGuidedSetup,
  canAccessAdmin = false,
  featureVisibility = {
    lab: true,
    multiplayer: true,
    store: true,
  },
}) => {
  const { selectors, dateKey, authStatus, stats } = useXP();
  const { user, loading, error, signOut, signInWithPassword, signUpWithPassword, signInWithGoogle, requestPasswordReset } = useAuth();
  const { currentStation } = useAdminConsole();
  const activeUserId = user?.id || null;
  const userLabel = user?.name || user?.email || 'Signed in';
  const userInitial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();
  const [handoffRecoverySnapshot, setHandoffRecoverySnapshot] = useState(() =>
    activeUserId ? readGuestStationRecoverySnapshot(activeUserId) : null
  );
  const [stationActivity, setStationActivity] = useState<StationActivityEntry[]>(() =>
    isGuestMode ? readStationActivity() : []
  );
  const {
    starterFlowSummary,
    latestTransitionActivity,
    visibleRecentStationActivity,
  } = useMemo(
    () =>
      buildStationContinuityContext(
        stationActivity,
        currentView,
        {
          canAccessAdmin,
          featureVisibility,
        },
        2
      ),
    [canAccessAdmin, currentView, featureVisibility, stationActivity]
  );
  const todayTrackedMinutes = selectors.getTrackedMinutesForDay(dateKey);
  const todayTargetMinutes = selectors.getTargetXP(dateKey);
  const trialDaysRemaining = currentStation.trialEndsAt
    ? Math.max(0, Math.ceil((currentStation.trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const loginTriggerRef = useRef<HTMLButtonElement | null>(null);
  const guestEntry = useMemo(() => {
    if (!isGuestMode) return null;
    return resolveGuestStationEntryState(stationActivity, starterFlowSummary, latestTransitionActivity, {
      canAccessAdmin,
      featureVisibility,
    });
  }, [
    canAccessAdmin,
    featureVisibility,
    isGuestMode,
    latestTransitionActivity,
    starterFlowSummary,
    stationActivity,
  ]);
  const localStationStatus = guestEntry?.localStatus ?? null;
  useEffect(() => {
    setHandoffRecoverySnapshot(activeUserId ? readGuestStationRecoverySnapshot(activeUserId) : null);
  }, [activeUserId]);

  useEffect(() => {
    if (!isGuestMode || typeof window === 'undefined') {
      setStationActivity([]);
      return;
    }

    const refresh = () => setStationActivity(readStationActivity());
    refresh();
    window.addEventListener(XTATION_STATION_ACTIVITY_EVENT, refresh as EventListener);
    return () => window.removeEventListener(XTATION_STATION_ACTIVITY_EVENT, refresh as EventListener);
  }, [isGuestMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRecoverySnapshotChange = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string | null }>).detail;
      const eventUserId = detail?.userId ?? null;
      if ((activeUserId || null) !== eventUserId) return;
      setHandoffRecoverySnapshot(activeUserId ? readGuestStationRecoverySnapshot(activeUserId) : null);
    };

    window.addEventListener(XTATION_GUEST_STATION_RECOVERY_EVENT, handleRecoverySnapshotChange as EventListener);
    return () =>
      window.removeEventListener(
        XTATION_GUEST_STATION_RECOVERY_EVENT,
        handleRecoverySnapshotChange as EventListener
      );
  }, [activeUserId]);
  const stationIdentity = useMemo(
    () =>
      buildStationIdentitySummary({
        currentStation,
        activeUserId,
        isGuestMode,
        activeView: currentView,
        handoffRecoverySnapshot,
        access: {
          canAccessAdmin,
          featureVisibility,
        },
      }),
    [activeUserId, canAccessAdmin, currentStation, currentView, featureVisibility, handoffRecoverySnapshot, isGuestMode]
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenPalette?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenPalette]);

  const isPlayView =
    currentView === ClientView.LOBBY ||
    currentView === ClientView.MATCH_FOUND ||
    currentView === ClientView.CHAMP_SELECT;

  const openLoginModal = () => {
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
  };

  return (
    <>
      <div className="xt-topbar xt-topbar-shell h-[56px] md:h-[60px] flex items-center relative z-40 select-none">
      {/* Middle: Navigation */}
      <div className="xt-nav-tabs flex-1 flex items-center h-full overflow-x-auto no-scrollbar min-w-0 xt-nav-scroll-fade">
        <NavTab label="Play" isActive={isPlayView} onClick={onPlayClick} />
        {featureVisibility.lab ? (
          <NavTab label="Lab" isActive={currentView === ClientView.LAB} onClick={() => onChangeView(ClientView.LAB)} />
        ) : null}
        {featureVisibility.multiplayer ? (
          <NavTab label="Multiplayer" isActive={currentView === ClientView.MULTIPLAYER} onClick={() => onChangeView(ClientView.MULTIPLAYER)} />
        ) : null}
        <NavTab label="Profile" isActive={currentView === ClientView.PROFILE} onClick={() => onChangeView(ClientView.PROFILE)} />
        <NavTab label="Inventory" isActive={currentView === ClientView.INVENTORY} onClick={() => onChangeView(ClientView.INVENTORY)} />
        {featureVisibility.store ? (
          <NavTab label="Store" isActive={currentView === ClientView.STORE} onClick={() => onChangeView(ClientView.STORE)} />
        ) : null}
        <NavTab label="Settings" isActive={currentView === ClientView.SETTINGS} onClick={() => onChangeView(ClientView.SETTINGS)} />
        {canAccessAdmin ? (
          <NavTab label="Admin" isActive={currentView === ClientView.ADMIN} onClick={() => onChangeView(ClientView.ADMIN)} />
        ) : null}
      </div>

      {/* Right: Assistant, Currency & System */}
      <div className="xt-topbar-rail flex items-center px-2 sm:px-3 md:px-4 h-full gap-2 sm:gap-3 md:gap-4 min-w-0">
        {/* AI Assistant Toggle (Moved here) */}
        <button 
            id="dusk-assistant-toggle"
            onClick={() => { playClickSound(); onToggleAssistant(); }}
            onMouseEnter={playHoverSound}
            className={`
                xt-topbar-dusk group relative flex items-center justify-center gap-2 w-9 sm:w-24 md:w-32 h-9 md:h-10 border transition-all duration-300
                ${isAssistantOpen 
                    ? 'bg-[var(--app-accent)] border-[var(--app-accent)] text-[var(--app-text)]' 
                    : activeTasksCount > 0
                        ? 'bg-[color-mix(in_srgb,var(--app-accent)_16%,transparent)] border-[var(--app-accent)] text-[var(--app-accent)] shadow-[var(--app-glow-accent)]'
                        : 'bg-transparent border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
                }
            `}
        >
            <Bot size={16} className={activeTasksCount > 0 && !isAssistantOpen ? 'xt-topbar-dusk-pulse' : ''} />
            <span className="hidden sm:inline text-[9px] md:text-[10px] font-bold font-mono tracking-widest">DUSK</span>
        </button>

        {/* Server Status Indicator -> Active Mission Count */}
        <div className="xt-topbar-status hidden xl:flex items-center gap-2 mr-2 min-w-[60px] justify-end">
             <div className={`w-2 h-2 rounded-full ${activeTasksCount > 0 ? 'xt-topbar-live-dot bg-[var(--app-accent)] shadow-[var(--app-glow-accent)]' : 'bg-[var(--app-border)]'}`}></div>
             {activeTasksCount > 0 ? (
                 <span className="text-[10px] text-[var(--app-accent)] font-mono uppercase font-bold tracking-widest">ACTIVE: {activeTasksCount}</span>
             ) : (
                 <div className="flex gap-1 h-2 items-center">
                    <div className="xt-topbar-idle-dot w-1 h-1 bg-[var(--app-muted)]"></div>
                    <div className="xt-topbar-idle-dot xt-topbar-idle-dot--2 w-1 h-1 bg-[var(--app-muted)]"></div>
                    <div className="xt-topbar-idle-dot xt-topbar-idle-dot--3 w-1 h-1 bg-[var(--app-muted)]"></div>
                 </div>
             )}
        </div>

        {/* XP Summary */}
        <div className="xt-topbar-summary hidden lg:flex flex-col items-center text-center font-mono text-xs leading-tight gap-0.5">
            <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Today</div>
            <div className="text-[var(--app-text)]">
                <span className="font-bold tracking-wider">{todayTrackedMinutes}</span>
                <span className="text-[var(--app-muted)] text-[10px]"> / {todayTargetMinutes}</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{todayTrackedMinutes} MIN</div>
        </div>

        {authStatus === 'loadingCloud' ? (
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-accent)]">Syncing...</div>
        ) : null}

        {/* Auth (minimal UI) */}
        <div className="flex items-center gap-2 min-w-0 justify-end">
            {isGuestMode ? (
                <div className="xt-topbar-pill hidden md:flex items-center gap-2 px-3 py-1 text-[9px] uppercase tracking-[0.2em] text-[var(--app-accent)]">
                    Local Mode
                </div>
            ) : null}
            <div
              className={`xt-topbar-pill hidden xl:flex items-center gap-2 px-3 py-1 text-[9px] uppercase tracking-[0.18em] ${
                stationIdentity.tone === 'accent' ? 'text-[var(--app-accent)]' : 'text-[var(--app-muted)]'
              }`}
              title={stationIdentity.detail}
            >
              <span className="text-[var(--app-text)]">{stationIdentity.modeLabel}</span>
              <span>•</span>
              <span>{stationIdentity.workspaceLabel}</span>
            </div>
            <div className="xt-topbar-pill hidden lg:flex items-center gap-2 px-3 py-1 text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                <span className="text-[var(--app-text)]">{currentStation.plan}</span>
                <span>•</span>
                <span>{currentStation.releaseChannel}</span>
                {currentStation.plan === 'trial' && trialDaysRemaining !== null ? (
                  <>
                    <span>•</span>
                    <span className="text-[var(--app-accent)]">{trialDaysRemaining}d</span>
                  </>
                ) : null}
            </div>
            {loading ? (
                <span className="text-[11px] text-[var(--app-muted)] font-mono">…</span>
            ) : null}
            {user ? (
                <>
                    <div className="xt-topbar-avatar w-7 h-7 overflow-hidden flex items-center justify-center text-[10px] text-[var(--app-text)]">
                        {user.avatar ? (
                          <img src={user.avatar} alt="user avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span>{userInitial}</span>
                        )}
                    </div>
                    <span className="hidden sm:inline text-[10px] text-[color-mix(in_srgb,var(--app-text)_82%,var(--app-muted))] max-w-[140px] truncate">{userLabel}</span>
                    <button
                        onMouseEnter={playHoverSound}
                        onClick={() => {
                            playClickSound();
                            void signOut();
                        }}
                    className="xt-topbar-btn h-8 px-2 sm:px-3 text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-[var(--app-text)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] transition-colors"
                    >
                        Logout
                    </button>
                </>
            ) : !loading ? (
                <button
                    ref={loginTriggerRef}
                    onMouseEnter={playHoverSound}
                    onClick={() => {
                        playClickSound();
                        openLoginModal();
                    }}
                    className="xt-topbar-btn h-8 px-2 sm:px-3 text-[8px] sm:text-[9px] uppercase tracking-[0.2em] transition-colors text-[var(--app-text)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
                >
                    {isGuestMode ? 'CONNECT' : 'LOGIN'}
                </button>
            ) : null}
            {import.meta.env.DEV && error && (
              <span className="text-[9px] text-[var(--app-accent)] max-w-[120px] truncate" title={error}>
                {error}
              </span>
            )}
        </div>

        {onOpenPalette ? (
          <button
            type="button"
            onClick={onOpenPalette}
            onMouseEnter={playHoverSound}
            title="Command palette (⌘K)"
            className="xt-topbar-keycap hidden md:inline-flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)] font-mono hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] transition-colors"
          >
            ⌘K
          </button>
        ) : null}

        <div className="xt-topbar-divider hidden sm:block w-[1px] h-6"></div>

        {isGuestMode && onExitGuestMode ? (
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onExitGuestMode();
            }}
            onMouseEnter={playHoverSound}
            className="xt-topbar-keycap inline-flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)] font-mono hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] transition-colors"
          >
            Exit
          </button>
        ) : null}

        {/* System Icons */}
        <div className="hidden sm:flex items-center gap-1 text-[var(--app-muted)]">
            <div
              className="xt-topbar-keycap flex items-center gap-1 px-1.5 py-0.5 text-[var(--app-accent)]"
              title={`Player Level (${stats.totalEarnedXP} total XP)`}
            >
              <Trophy size={11} />
              <span className="font-mono text-[9px] font-bold tracking-widest uppercase">LV {stats.playerLevel}</span>
            </div>
            <button onMouseEnter={playHoverSound} onClick={playClickSound} className="xt-topbar-icon hover:text-[var(--app-text)] p-1.5 md:p-2 transition-colors"><Bell size={15} /></button>
            <button onMouseEnter={playHoverSound} onClick={() => onChangeView(ClientView.SETTINGS)} className="xt-topbar-icon hover:text-[var(--app-text)] p-1.5 md:p-2 transition-colors"><Settings size={15} /></button>
        </div>
      </div>
      </div>

      <AuthDrawer
        open={isLoginModalOpen && !user}
        onClose={closeLoginModal}
        variant="center"
        panelClassName="!w-auto !max-w-[420px] !max-h-[90dvh] !overflow-y-auto !rounded-[14px] !border-[var(--app-border)] !bg-[var(--app-bg)]"
        triggerRef={loginTriggerRef as React.RefObject<HTMLElement | null>}
      >
        <SignInPage
          compact
          onSignIn={async (email, password) => {
            if (!email.trim() || !password) return;
            const success = await signInWithPassword(email, password);
            if (success) {
              writeAuthTransitionSignal({ mode: 'login', fromGuestMode: isGuestMode });
              closeLoginModal();
            }
          }}
          onSignUp={async (email, password) => {
            if (!email.trim() || !password) return;
            await signUpWithPassword(email, password);
            writeAuthTransitionSignal({ mode: 'signup', fromGuestMode: isGuestMode });
          }}
          onGoogleSignIn={async () => {
            writeAuthTransitionSignal({ mode: 'oauth', fromGuestMode: isGuestMode });
            await signInWithGoogle();
          }}
          onResetPassword={async (email) => {
            if (email.trim()) await requestPasswordReset(email);
          }}
          error={error}
        />
      </AuthDrawer>
    </>
  );
};
