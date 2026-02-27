
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
  const drawerDate = new Date();
  const drawerDayLabel = drawerDate.toLocaleDateString(undefined, { weekday: 'long' });
  const drawerDateLabel = `${drawerDate.getFullYear()}/${drawerDate
    .toLocaleDateString(undefined, { month: 'short' })
    .toLowerCase()}/${String(drawerDate.getDate()).padStart(2, '0')}`;

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
      <div className="fixed left-2 top-1 z-[95] pointer-events-none md:left-2">
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
      <div className="h-[56px] md:h-[60px] bg-[color-mix(in_srgb,var(--app-panel)_82%,transparent)] backdrop-blur-sm border-b border-[var(--app-border)] flex items-center relative z-40 select-none">
      <div className="h-full w-[84px] sm:w-[96px] md:w-[132px] shrink-0" aria-hidden="true"></div>

      {/* Middle: Navigation */}
      <div className="flex-1 flex items-center h-full overflow-x-auto no-scrollbar min-w-0">
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
      <div className="flex items-center px-2 sm:px-3 md:px-4 h-full border-l border-[var(--app-border)] gap-2 sm:gap-3 md:gap-4 bg-[var(--app-panel)] min-w-0">
        {/* AI Assistant Toggle (Moved here) */}
        <button 
            id="hextech-assistant-toggle"
            onClick={() => { playClickSound(); onToggleAssistant(); }}
            onMouseEnter={playHoverSound}
            className={`
                group relative flex items-center justify-center gap-2 w-9 sm:w-24 md:w-32 h-9 md:h-10 border transition-all duration-300
                ${isAssistantOpen 
                    ? 'bg-[var(--app-accent)] border-[var(--app-accent)] text-[var(--app-text)]' 
                    : activeTasksCount > 0
                        ? 'bg-[color-mix(in_srgb,var(--app-accent)_16%,transparent)] border-[var(--app-accent)] text-[var(--app-accent)] shadow-[var(--app-glow-accent)]'
                        : 'bg-transparent border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
                }
            `}
        >
            <Bot size={16} className={activeTasksCount > 0 && !isAssistantOpen ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline text-[9px] md:text-[10px] font-bold font-mono tracking-widest">QUESTS</span>
        </button>

        {/* Server Status Indicator -> Active Mission Count */}
        <div className="hidden xl:flex items-center gap-2 mr-2 min-w-[60px] justify-end">
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
        <div className="hidden lg:flex flex-col items-end font-mono text-xs gap-0.5">
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

        <div className="hidden lg:flex flex-col items-end font-mono text-xs gap-0.5">
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
        <div className="flex items-center gap-2 min-w-0 justify-end">
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
                    <span className="hidden sm:inline text-[10px] text-[color-mix(in_srgb,var(--app-text)_82%,var(--app-muted))] max-w-[140px] truncate">{userLabel}</span>
                    <button
                        onMouseEnter={playHoverSound}
                        onClick={() => {
                            playClickSound();
                            void signOut();
                        }}
                    className="h-8 px-2 sm:px-3 border border-[var(--app-border)] text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-[var(--app-text)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] transition-colors"
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
                    className="h-8 px-2 sm:px-3 border border-[var(--app-border)] text-[8px] sm:text-[9px] uppercase tracking-[0.2em] transition-colors text-[var(--app-text)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
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

        <div className="hidden sm:block w-[1px] h-6 bg-[var(--app-border)]"></div>

        {/* System Icons */}
        <div className="hidden sm:flex items-center gap-1 text-[var(--app-muted)]">
            <button onMouseEnter={playHoverSound} onClick={playClickSound} className="hover:text-[var(--app-text)] p-1.5 md:p-2 transition-colors"><Trophy size={15} /></button>
            <button onMouseEnter={playHoverSound} onClick={playClickSound} className="hover:text-[var(--app-text)] p-1.5 md:p-2 transition-colors"><Bell size={15} /></button>
            <button onMouseEnter={playHoverSound} onClick={() => onChangeView(ClientView.SETTINGS)} className="hover:text-[var(--app-text)] p-1.5 md:p-2 transition-colors"><Settings size={15} /></button>
        </div>
      </div>
      </div>

      <AuthDrawer
        open={isLoginModalOpen && !user}
        onClose={closeLoginModal}
        disableClose={isAuthSubmitting}
        variant="center"
        panelClassName="!w-auto !max-h-none !overflow-visible !rounded-none !border-0 !bg-transparent !shadow-none"
        triggerRef={loginTriggerRef as React.RefObject<HTMLElement | null>}
      >
        <div
          className="auth-modal-shell relative aspect-[359.15/269.17] overflow-hidden rounded-[20px] bg-[#573778]"
          style={{ width: 'min(82vw, calc(82dvh * 1.334), 1420px)' }}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="auth-skel-canvas absolute inset-0"></div>
            <div className="auth-skel-left absolute left-[2.2%] top-[2.2%] h-[95.6%] w-[40.8%] rounded-[14px] bg-[#1f162d]"></div>

            <div className="auth-center-divider absolute left-[47.6%] top-[2.2%] h-[95.6%] w-[1px]"></div>

            <div className="auth-skel-top auth-skel-card absolute left-[51.5%] top-0 h-[49%] w-[35.8%] overflow-hidden bg-transparent">
              <div className="absolute inset-0 flex items-start justify-center">
                <img
                  src="/ui-reference/auth/illustration-up.svg"
                  alt="Top illustration"
                  className="h-[132%] w-full -translate-y-[18%] object-contain object-top"
                  draggable={false}
                />
              </div>
            </div>

            <div className="auth-skel-bottom auth-skel-card absolute left-[51.5%] top-[53.9%] h-[43.9%] w-[35.8%] overflow-visible bg-transparent">
              <div className="absolute inset-0 flex items-end justify-center">
                <img
                  src="/ui-reference/auth/character.svg"
                  alt="Character illustration"
                  className="h-[116%] w-auto max-w-none translate-y-[6%] object-contain"
                  draggable={false}
                />
              </div>
            </div>

            <div className="auth-skel-rail absolute right-[1.65%] top-[1.95%] h-[96.1%] w-[5.75%] rounded-[12px] bg-[#f0c33f]"></div>
            <div className="auth-skel-rail-alert absolute right-[2.05%] top-[14.2%] flex h-[14.8%] w-[4.95%] flex-col items-center justify-center gap-3 overflow-hidden rounded-[12px] bg-[#ef3131]">
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={`chev-${index}`} className="auth-rail-chevron" style={{ animationDelay: `${index * 120}ms` }} />
              ))}
            </div>
            <div className="auth-skel-rail-pattern absolute right-[2.05%] top-[70.5%] h-[23%] w-[4.95%] overflow-hidden rounded-[12px] bg-[#f0c33f]">
              <div className="auth-rail-pattern absolute inset-[6%] rounded-[10px]"></div>
            </div>
            <div className="auth-skel-day-text absolute right-[2.05%] top-[35.8%] h-[9%] w-[4.95%]">
              <div className="flex h-full w-full items-center justify-center">
                <span className="whitespace-nowrap [writing-mode:vertical-rl] text-[clamp(10px,0.82vw,14px)] font-semibold tracking-[0.08em] text-[#de3e36]">
                  {drawerDayLabel}
                </span>
              </div>
            </div>
            <div className="absolute right-[4.45%] top-[48.6%] h-[6.2%] w-[1px] bg-[#de3e36]"></div>
            <div className="auth-skel-date-text absolute right-[2.05%] top-[55.2%] h-[14%] w-[4.95%]">
              <div className="flex h-full w-full items-center justify-center">
                <span className="whitespace-nowrap [writing-mode:vertical-rl] text-[clamp(10px,0.82vw,14px)] font-semibold tracking-[0.05em] text-[#de3e36]">
                  {drawerDateLabel}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={closeLoginModal}
            disabled={isAuthSubmitting}
            className="auth-modal-close ui-pressable absolute right-[2.05%] top-[1.95%] z-20 flex h-[6.2%] min-h-[38px] w-[4.95%] min-w-[38px] items-center justify-center rounded-[10px] bg-[color-mix(in_srgb,var(--app-bg)_62%,#1b1530)] text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close login modal"
            title="Close"
          >
            <X size={14} />
          </button>

          <div className="auth-modal-form auth-drawer-stagger absolute left-[2.2%] top-[2.2%] z-10 h-[95.6%] w-[40.8%] rounded-[12px] bg-[#1f162d]">
            <form
              className="relative z-10 flex h-full min-h-0 flex-col justify-center gap-2.5 overflow-y-auto px-7 py-6"
              onSubmit={(event) => {
                event.preventDefault();
                void handlePrimaryAuthSubmit();
              }}
            >
              <div className="flex justify-center pt-1 pb-8">
                <EyeOrb
                  onClick={() => {}}
                  ariaLabel="Decorative orb"
                  className="auth-mini-orb pointer-events-none cursor-default h-[156px] w-[156px] p-0"
                />
              </div>

              <div className="text-center">
                <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#f8c74c]">HELLO PLAYER</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthNotice(null);
                  }}
                  className={`ui-pressable h-9 rounded-[8px] border text-[11px] font-semibold uppercase tracking-[0.2em] ${
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
                  className={`ui-pressable h-9 rounded-[8px] border text-[11px] font-semibold uppercase tracking-[0.2em] ${
                    authMode === 'signup'
                      ? 'border-[var(--ui-accent)] bg-[color-mix(in_srgb,var(--app-accent)_58%,transparent)] text-[var(--ui-text)]'
                      : 'border-[color-mix(in_srgb,var(--app-accent)_35%,var(--app-border))] bg-transparent text-[var(--ui-text)]'
                  }`}
                >
                  SIGN UP
                </button>
              </div>

              <div className="space-y-2">
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="Email"
                  data-auth-initial-focus="true"
                  className="h-9 w-full rounded-[7px] border border-transparent bg-[color-mix(in_srgb,var(--app-bg)_80%,black)] px-4 text-sm text-[var(--ui-text)] outline-none transition-colors focus:border-[var(--ui-accent)]"
                  autoFocus
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="Password"
                  className="h-9 w-full rounded-[7px] border border-transparent bg-[color-mix(in_srgb,var(--app-bg)_80%,black)] px-4 text-sm text-[var(--ui-text)] outline-none transition-colors focus:border-[var(--ui-accent)]"
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
                <div className="min-h-[20px] text-[9px] leading-[1.35] tracking-[0.1em] text-[var(--ui-muted)]">
                  {authNotice || error}
                </div>
              )}

              <div className="mt-1 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="ui-pressable h-9 rounded-[8px] border border-[var(--ui-accent)] bg-[color-mix(in_srgb,var(--app-accent)_62%,transparent)] text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)] hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authMode === 'login' ? 'SIGN IN' : 'SIGN UP'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleGoogleSignIn()}
                  disabled={isAuthSubmitting}
                  className="ui-pressable h-9 rounded-[8px] border border-[color-mix(in_srgb,var(--app-accent)_35%,var(--app-border))] bg-transparent text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)] hover:-translate-y-[1px] hover:border-[var(--ui-accent)] disabled:cursor-not-allowed disabled:opacity-60"
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
