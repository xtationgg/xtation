
import React, { useState } from 'react';
import { Settings, Bell, Trophy, Bot, X } from 'lucide-react';
import { ClientView } from '../../types';
import { NavTab } from '../UI/HextechUI';
import { OrbButton } from '../UI/OrbButton';
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
      <div className="h-[60px] bg-[color-mix(in_srgb,var(--app-panel)_82%,transparent)] backdrop-blur-sm border-b border-[var(--app-border)] flex items-center relative z-40 select-none">
      
      {/* Left: Play Orb Trigger */}
      <div className="flex items-center h-full border-r border-[var(--app-border)] pl-2 pr-6 gap-4">
        <OrbButton
          ariaLabel="Play"
          onMouseEnter={playHoverSound}
          onClick={() => {
            playClickSound();
            onPlayClick();
          }}
        />
      </div>

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

      {isLoginModalOpen && !user ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[color-mix(in_srgb,var(--app-bg)_72%,black)] px-4"
          onClick={closeLoginModal}
        >
          <div
            className="ui-panel-surface ui-shape-card w-full max-w-md border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5"
            onClick={(event) => event.stopPropagation()}
            style={{ '--cut': 'var(--ui-cut-md)' } as React.CSSProperties}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--ui-text)]">
                  {authMode === 'login' ? 'Login' : 'Sign Up'}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--ui-muted)]">Sign in inside the app</div>
              </div>
              <button
                type="button"
                onClick={closeLoginModal}
                className="ui-pressable flex h-8 w-8 items-center justify-center border border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
                aria-label="Close login modal"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthNotice(null);
                }}
                className={`ui-pressable h-9 border text-[10px] font-semibold uppercase tracking-[0.2em] ${
                  authMode === 'login'
                    ? 'border-[var(--ui-accent)] bg-[color-mix(in_srgb,var(--app-accent)_20%,transparent)] text-[var(--ui-text)]'
                    : 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)]'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthNotice(null);
                }}
                className={`ui-pressable h-9 border text-[10px] font-semibold uppercase tracking-[0.2em] ${
                  authMode === 'signup'
                    ? 'border-[var(--ui-accent)] bg-[color-mix(in_srgb,var(--app-accent)_20%,transparent)] text-[var(--ui-text)]'
                    : 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)]'
                }`}
              >
                Sign Up
              </button>
            </div>

            <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Email</label>
            <input
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="you@example.com"
              className="mb-3 h-10 w-full border border-[var(--ui-border)] bg-[var(--ui-panel-2)] px-3 text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-accent)]"
              autoFocus
            />

            {authMode === 'login' && (
              <button
                type="button"
                onClick={() => void handleSendResetLink()}
                disabled={isAuthSubmitting}
                className="mb-3 text-left text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)] hover:text-[var(--ui-text)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Forgot password?
              </button>
            )}

            <label className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Password</label>
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="••••••••"
              className="mb-3 h-10 w-full border border-[var(--ui-border)] bg-[var(--ui-panel-2)] px-3 text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-accent)]"
            />

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handlePrimaryAuthSubmit()}
                disabled={isAuthSubmitting}
                className="ui-pressable flex h-10 items-center justify-center gap-2 border border-[var(--ui-accent)] bg-[color-mix(in_srgb,var(--app-accent)_20%,transparent)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)] hover:bg-[color-mix(in_srgb,var(--app-accent)_28%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authMode === 'login' ? 'Login' : 'Sign Up'}
              </button>
              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={isAuthSubmitting}
                className="ui-pressable h-10 border border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)] hover:border-[var(--ui-accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Google OAuth
              </button>
            </div>

            {(authNotice || error) && (
              <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[var(--ui-muted)]">{authNotice || error}</div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
};
