
import React, { useRef, useState } from 'react';
import { Settings, Bell, Trophy, Bot, X } from 'lucide-react';
import { ClientView } from '../../types';
import { NavTab } from '../UI/HextechUI';
import { EyeOrb } from '../UI/EyeOrb';
import { AuthDrawer } from '../UI/AuthDrawer';
import { playClickSound, playHoverSound } from '../../utils/SoundEffects';
import { useXP } from '../XP/xpStore';
import { useAuth } from '../../src/auth/AuthProvider';

interface TopBarProps {
  currentView: ClientView;
  onChangeView: (view: ClientView) => void;
  onPlayClick: () => void;
  onToggleAssistant: () => void;
  isAssistantOpen: boolean;
  activeTasksCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  currentView, 
  onChangeView, 
  onPlayClick,
  onToggleAssistant,
  isAssistantOpen,
  activeTasksCount
}) => {
  const { stats, selectors, dateKey, authStatus } = useXP();
  const { user, loading, error, signInWithGoogle, signUpWithPassword, signInWithPassword, requestPasswordReset, signOut } = useAuth();
  const userLabel = user?.name || user?.email || 'Signed in';
  const userInitial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();
  const todayTrackedMinutes = selectors.getTrackedMinutesForDay(dateKey);
  const todayTargetMinutes = selectors.getTargetXP(dateKey);
  const todayProgressPct = selectors.getProgressPct(dateKey);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const loginTriggerRef = useRef<HTMLButtonElement | null>(null);

  const openLoginModal = () => {
    setAuthMode('login');
    setAuthEmail(user?.email || '');
    setAuthPassword('');
    setAuthNotice(null);
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    if (isAuthSubmitting) return;
    setIsLoginModalOpen(false);
  };

  const handlePrimaryAuthSubmit = async () => {
    if (isAuthSubmitting) return;
    if (!authEmail.trim() || !authPassword) {
      setAuthNotice('Enter email and password.');
      return;
    }
    setIsAuthSubmitting(true);
    setAuthNotice(null);
    const success =
      authMode === 'login'
        ? await signInWithPassword(authEmail, authPassword)
        : await signUpWithPassword(authEmail, authPassword);
    setIsAuthSubmitting(false);
    if (success) {
      if (authMode === 'login') {
        setAuthNotice('Logged in successfully.');
        setIsLoginModalOpen(false);
      } else {
        setAuthNotice('Account created. Check email if confirmation is enabled.');
        setAuthMode('login');
      }
    } else {
      setAuthNotice(authMode === 'login' ? 'Login failed. Check credentials.' : null);
    }
  };

  const handleSendResetLink = async () => {
    if (isAuthSubmitting) return;
    const targetEmail = authEmail.trim();
    if (!targetEmail) {
      setAuthNotice('Enter your email to receive a reset link.');
      return;
    }
    setIsAuthSubmitting(true);
    setAuthNotice(null);
    const success = await requestPasswordReset(targetEmail);
    setIsAuthSubmitting(false);
    if (success) {
      setAuthNotice('Reset email sent. Check your inbox.');
    } else {
      setAuthNotice(null);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isAuthSubmitting) return;
    setIsAuthSubmitting(true);
    setAuthNotice(null);
    await signInWithGoogle();
    setIsAuthSubmitting(false);
  };

  return (
    <>
      <div className="fixed left-2 top-1 z-[95] pointer-events-none">
        <EyeOrb
          ariaLabel="Play"
          className="pointer-events-auto"
          onMouseEnter={playHoverSound}
          onClick={() => {
            playClickSound();
            onPlayClick();
          }}
        />
      </div>
      <div className="h-[60px] bg-[color-mix(in_srgb,var(--app-panel)_82%,transparent)] backdrop-blur-sm border-b border-[var(--app-border)] flex items-center relative z-40 select-none">
      <div className="h-full w-[132px] shrink-0" aria-hidden="true"></div>

      {/* Middle: Navigation */}
      <div className="flex-1 flex items-center h-full overflow-x-auto no-scrollbar">
        <NavTab label="Home" isActive={currentView === ClientView.HOME} onClick={() => onChangeView(ClientView.HOME)} />
        <NavTab label="Earth" isActive={currentView === ClientView.TFT} onClick={() => onChangeView(ClientView.TFT)} />
        <NavTab label="Multiplayer" isActive={currentView === ClientView.MULTIPLAYER} onClick={() => onChangeView(ClientView.MULTIPLAYER)} />
        <NavTab label="Profile" isActive={currentView === ClientView.PROFILE} onClick={() => onChangeView(ClientView.PROFILE)} />
        <NavTab label="Inventory" isActive={currentView === ClientView.INVENTORY} onClick={() => onChangeView(ClientView.INVENTORY)} />
        <NavTab label="Store" isActive={currentView === ClientView.STORE} onClick={() => onChangeView(ClientView.STORE)} />
        <NavTab label="UI Kit" isActive={currentView === ClientView.UI_KIT} onClick={() => onChangeView(ClientView.UI_KIT)} />
        <NavTab label="Settings" isActive={currentView === ClientView.SETTINGS} onClick={() => onChangeView(ClientView.SETTINGS)} />
      </div>

      {/* Right: Assistant, Currency & System */}
      <div className="flex items-center px-6 h-full border-l border-[var(--app-border)] gap-6 bg-[var(--app-panel)]">
        {/* AI Assistant Toggle (Moved here) */}
        <button 
            id="hextech-assistant-toggle"
            onClick={() => { playClickSound(); onToggleAssistant(); }}
            onMouseEnter={playHoverSound}
            className={`
                group relative flex items-center justify-center gap-2 w-32 h-10 border transition-all duration-300 mr-2
                ${isAssistantOpen 
                    ? 'bg-[var(--app-accent)] border-[var(--app-accent)] text-[var(--app-text)]' 
                    : activeTasksCount > 0
                        ? 'bg-[color-mix(in_srgb,var(--app-accent)_16%,transparent)] border-[var(--app-accent)] text-[var(--app-accent)] shadow-[var(--app-glow-accent)]'
                        : 'bg-transparent border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
                }
            `}
        >
            <Bot size={18} className={activeTasksCount > 0 && !isAssistantOpen ? 'animate-pulse' : ''} />
            <span className="text-[10px] font-bold font-mono tracking-widest">QUESTS</span>
        </button>

        {/* Server Status Indicator -> Active Mission Count */}
        <div className="flex items-center gap-2 mr-4 min-w-[60px] justify-end">
             <div className={`w-2 h-2 rounded-full ${activeTasksCount > 0 ? 'bg-[var(--app-accent)] animate-pulse shadow-[var(--app-glow-accent)]' : 'bg-[var(--app-border)]'}`}></div>
             {activeTasksCount > 0 ? (
                 <span className="text-[10px] text-[var(--app-accent)] font-mono uppercase font-bold tracking-widest">ACTIVE: {activeTasksCount}</span>
             ) : (
                 <div className="flex gap-1 h-2 items-center">
                    <div className="w-1 h-1 bg-[var(--app-muted)] animate-bounce [animation-duration:1s]"></div>
                    <div className="w-1 h-1 bg-[var(--app-muted)] animate-bounce [animation-duration:1s] [animation-delay:0.1s]"></div>
                    <div className="w-1 h-1 bg-[var(--app-muted)] animate-bounce [animation-duration:1s] [animation-delay:0.2s]"></div>
                 </div>
             )}
        </div>

        {/* XP Summary */}
        <div className="flex flex-col items-end font-mono text-xs gap-0.5">
            <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Today</div>
            <div className="flex items-center gap-2 text-[var(--app-text)]">
                <span className="font-bold tracking-wider">{todayTrackedMinutes}</span>
                <span className="text-[var(--app-muted)] text-[10px]">/ {todayTargetMinutes}</span>
            </div>
            <div className="flex items-center gap-2 text-[color-mix(in_srgb,var(--app-text)_82%,var(--app-muted))]">
                <span className="text-[10px] uppercase tracking-[0.2em]">{stats.evaluationLabel}</span>
                <span className="text-[10px] text-[var(--app-muted)]">{todayProgressPct}%</span>
            </div>
        </div>

        <div className="flex flex-col items-end font-mono text-xs gap-0.5">
            <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Today Min</div>
            <div className="flex items-center gap-2 text-[var(--app-text)]">
                <span className="font-bold tracking-wider">{todayTrackedMinutes} MIN</span>
            </div>
            <div className="text-[10px] text-[var(--app-muted)]">Daily tracked</div>
        </div>

        {authStatus === 'loadingCloud' ? (
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-accent)]">Syncing...</div>
        ) : null}

        {/* Auth (minimal UI) */}
        <div className="flex items-center gap-2 min-w-[180px] justify-end">
            {loading ? (
                <span className="text-[11px] text-[var(--app-muted)] font-mono">…</span>
            ) : null}
            {user ? (
                <>
                    <div className="w-7 h-7 rounded-full overflow-hidden border border-[color-mix(in_srgb,var(--app-border)_70%,var(--app-text))] bg-[var(--app-panel-2)] flex items-center justify-center text-[10px] text-[var(--app-text)]">
                        {user.avatar ? (
                          <img src={user.avatar} alt="user avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span>{userInitial}</span>
                        )}
                    </div>
                    <span className="text-[10px] text-[color-mix(in_srgb,var(--app-text)_82%,var(--app-muted))] max-w-[140px] truncate">{userLabel}</span>
                    <button
                        onMouseEnter={playHoverSound}
                        onClick={() => {
                            playClickSound();
                            void signOut();
                        }}
                        className="h-8 px-3 border border-[var(--app-border)] text-[9px] uppercase tracking-[0.2em] text-[var(--app-text)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] transition-colors"
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
                    className="h-8 px-3 border border-[var(--app-border)] text-[9px] uppercase tracking-[0.2em] transition-colors text-[var(--app-text)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
                >
                    LOGIN
                </button>
            ) : null}
            {import.meta.env.DEV && error && (
              <span className="text-[9px] text-[var(--app-accent)] max-w-[120px] truncate" title={error}>
                {error}
              </span>
            )}
        </div>

        <div className="w-[1px] h-6 bg-[var(--app-border)]"></div>

        {/* System Icons */}
        <div className="flex items-center gap-1 text-[var(--app-muted)]">
            <button onMouseEnter={playHoverSound} onClick={playClickSound} className="hover:text-[var(--app-text)] p-2 transition-colors"><Trophy size={16} /></button>
            <button onMouseEnter={playHoverSound} onClick={playClickSound} className="hover:text-[var(--app-text)] p-2 transition-colors"><Bell size={16} /></button>
            <button onMouseEnter={playHoverSound} onClick={() => onChangeView(ClientView.SETTINGS)} className="hover:text-[var(--app-text)] p-2 transition-colors"><Settings size={16} /></button>
        </div>
      </div>
      </div>

      <AuthDrawer
        open={isLoginModalOpen && !user}
        onClose={closeLoginModal}
        disableClose={isAuthSubmitting}
        variant="center"
        triggerRef={loginTriggerRef as React.RefObject<HTMLElement | null>}
      >
        <div className="auth-modal-shell relative aspect-[359.15/269.17] w-[min(92vw,1280px)] overflow-hidden rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-accent)_38%,var(--app-panel))]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[2.65%] top-[1.95%] h-[96.1%] w-[40.8%] rounded-[14px] border border-[color-mix(in_srgb,var(--app-border)_65%,var(--app-text)_15%)] bg-[color-mix(in_srgb,var(--app-bg)_82%,black)]">
              <div className="absolute inset-[8px] rounded-[10px] border border-[color-mix(in_srgb,var(--app-text)_72%,var(--app-border))]"></div>
            </div>

            <div className="absolute left-[51.5%] top-[4.4%] h-[44.2%] w-[35.8%] rounded-[20px] border border-[color-mix(in_srgb,var(--app-text)_70%,var(--app-border))]"></div>
            <div className="absolute left-[51.5%] top-[52.0%] h-[43.4%] w-[35.8%] rounded-[20px] border border-[color-mix(in_srgb,var(--app-text)_70%,var(--app-border))]"></div>
            <div className="absolute right-[1.65%] top-[1.95%] h-[96.1%] w-[5.75%] rounded-[12px] border border-[color-mix(in_srgb,var(--app-text)_70%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_18%,transparent)]"></div>
            <div className="absolute right-[2.05%] top-[14.2%] h-[14.8%] w-[4.95%] rounded-[12px] bg-[color-mix(in_srgb,var(--app-accent)_26%,transparent)]"></div>
            <div className="absolute right-[2.05%] top-[30.1%] h-[31.7%] w-[4.95%] rounded-[12px] bg-[color-mix(in_srgb,var(--app-accent)_22%,transparent)]"></div>
          </div>

          <button
            type="button"
            onClick={closeLoginModal}
            disabled={isAuthSubmitting}
            className="auth-modal-close ui-pressable absolute right-[1.15%] top-[1.65%] z-20 h-[6.2%] min-h-[38px] w-[3.7%] min-w-[38px] rounded-[10px] border border-transparent bg-transparent text-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close login modal"
            title="Close"
          >
            <X size={14} />
          </button>

          <div className="auth-modal-form auth-drawer-stagger absolute left-[2.65%] top-[1.95%] z-10 h-[96.1%] w-[40.8%] rounded-[12px] bg-[color-mix(in_srgb,var(--app-bg)_82%,black)]">
            <div className="pointer-events-none absolute inset-[8px] rounded-[10px] border border-[color-mix(in_srgb,var(--app-text)_74%,var(--app-border))]"></div>
            <form
              className="relative z-10 flex h-full flex-col gap-3 px-7 pb-6 pt-8"
              onSubmit={(event) => {
                event.preventDefault();
                void handlePrimaryAuthSubmit();
              }}
            >
              <div className="pt-4 text-center">
                <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#f8c74c]">HELLO PLAYER</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthNotice(null);
                  }}
                  className={`ui-pressable h-10 rounded-[8px] border text-[11px] font-semibold uppercase tracking-[0.2em] ${
                    authMode === 'login'
                      ? 'border-[var(--ui-accent)] bg-[color-mix(in_srgb,var(--app-accent)_58%,transparent)] text-[var(--ui-text)]'
                      : 'border-[color-mix(in_srgb,var(--app-accent)_35%,var(--app-border))] bg-transparent text-[var(--ui-text)]'
                  }`}
                >
                  LOGIN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthNotice(null);
                  }}
                  className={`ui-pressable h-10 rounded-[8px] border text-[11px] font-semibold uppercase tracking-[0.2em] ${
                    authMode === 'signup'
                      ? 'border-[var(--ui-accent)] bg-[color-mix(in_srgb,var(--app-accent)_58%,transparent)] text-[var(--ui-text)]'
                      : 'border-[color-mix(in_srgb,var(--app-accent)_35%,var(--app-border))] bg-transparent text-[var(--ui-text)]'
                  }`}
                >
                  SIGN UP
                </button>
              </div>

              <div className="space-y-2.5">
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="Email"
                  className="h-10 w-full rounded-[7px] border border-transparent bg-[color-mix(in_srgb,var(--app-bg)_80%,black)] px-4 text-sm text-[var(--ui-text)] outline-none transition-colors focus:border-[var(--ui-accent)]"
                  autoFocus
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="Password"
                  className="h-10 w-full rounded-[7px] border border-transparent bg-[color-mix(in_srgb,var(--app-bg)_80%,black)] px-4 text-sm text-[var(--ui-text)] outline-none transition-colors focus:border-[var(--ui-accent)]"
                />
                {authMode === 'login' && (
                  <button
                    type="button"
                    onClick={() => void handleSendResetLink()}
                    disabled={isAuthSubmitting}
                    className="text-left text-[9px] uppercase tracking-[0.18em] text-[var(--ui-muted)] hover:text-[var(--ui-text)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    FORGOT PASSWORD?
                  </button>
                )}
              </div>

              {(authNotice || error) && (
                <div className="min-h-[14px] text-[9px] uppercase tracking-[0.16em] text-[var(--ui-muted)]">{authNotice || error}</div>
              )}

              <div className="mt-auto flex flex-col gap-2.5">
                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="ui-pressable h-10 rounded-[8px] border border-[var(--ui-accent)] bg-[color-mix(in_srgb,var(--app-accent)_62%,transparent)] text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)] hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authMode === 'login' ? 'SIGN IN' : 'SIGN UP'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleGoogleSignIn()}
                  disabled={isAuthSubmitting}
                  className="ui-pressable h-10 rounded-[8px] border border-[color-mix(in_srgb,var(--app-accent)_35%,var(--app-border))] bg-transparent text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)] hover:-translate-y-[1px] hover:border-[var(--ui-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  GOOGLE OAUTH
                </button>
              </div>
            </form>
          </div>
        </div>
      </AuthDrawer>
    </>
  );
};
