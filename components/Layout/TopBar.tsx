
import React, { useState } from 'react';
import { Play, Settings, Bell, Trophy, Bot, X } from 'lucide-react';
import { ClientView } from '../../types';
import { NavTab } from '../UI/HextechUI';
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
      <div className="h-[60px] bg-white/15 backdrop-blur-sm border-b border-white/30 flex items-center relative z-40 select-none">
      
      {/* Left: Play Button */}
      <div className="flex items-center h-full border-r border-[#e5e5e5] pl-2 pr-6 gap-4">
        <button 
            onClick={() => { playClickSound(); onPlayClick(); }}
            onMouseEnter={playHoverSound}
            className="group relative flex items-center gap-3 px-4 py-2 hover:bg-white hover:text-black transition-colors"
        >
            <div className="w-8 h-8 flex items-center justify-center border border-current">
                 <Play size={14} className="fill-current" />
            </div>
            
            <div className="flex flex-col items-start font-mono">
                <span className="font-bold text-sm tracking-widest uppercase">PLAY</span>
            </div>
        </button>
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
      <div className="flex items-center px-6 h-full border-l border-[#333] gap-6 bg-[#0A0A0A]">
        {/* AI Assistant Toggle (Moved here) */}
        <button 
            id="hextech-assistant-toggle"
            onClick={() => { playClickSound(); onToggleAssistant(); }}
            onMouseEnter={playHoverSound}
            className={`
                group relative flex items-center justify-center gap-2 w-32 h-10 border transition-all duration-300 mr-2
                ${isAssistantOpen 
                    ? 'bg-[#FF2A3A] border-[#FF2A3A] text-white' 
                    : activeTasksCount > 0
                        ? 'bg-[#FF2A3A]/10 border-[#FF2A3A] text-[#FF2A3A] shadow-[0_0_15px_rgba(255,42,58,0.4)]'
                        : 'bg-transparent border-[#333] text-[#666] hover:border-white hover:text-white'
                }
            `}
        >
            <Bot size={18} className={activeTasksCount > 0 && !isAssistantOpen ? 'animate-pulse' : ''} />
            <span className="text-[10px] font-bold font-mono tracking-widest">QUESTS</span>
        </button>

        {/* Server Status Indicator -> Active Mission Count */}
        <div className="flex items-center gap-2 mr-4 min-w-[60px] justify-end">
             <div className={`w-2 h-2 rounded-full ${activeTasksCount > 0 ? 'bg-[#FF2A3A] animate-pulse shadow-[0_0_8px_#FF2A3A]' : 'bg-[#333]'}`}></div>
             {activeTasksCount > 0 ? (
                 <span className="text-[10px] text-[#FF2A3A] font-mono uppercase font-bold tracking-widest">ACTIVE: {activeTasksCount}</span>
             ) : (
                 <div className="flex gap-1 h-2 items-center">
                    <div className="w-1 h-1 bg-[#666] animate-bounce [animation-duration:1s]"></div>
                    <div className="w-1 h-1 bg-[#666] animate-bounce [animation-duration:1s] [animation-delay:0.1s]"></div>
                    <div className="w-1 h-1 bg-[#666] animate-bounce [animation-duration:1s] [animation-delay:0.2s]"></div>
                 </div>
             )}
        </div>

        {/* XP Summary */}
        <div className="flex flex-col items-end font-mono text-xs gap-0.5">
            <div className="text-[9px] uppercase tracking-[0.2em] text-[#666]">Today</div>
            <div className="flex items-center gap-2 text-[#CCC]">
                <span className="font-bold tracking-wider">{todayTrackedMinutes}</span>
                <span className="text-[#666] text-[10px]">/ {todayTargetMinutes}</span>
            </div>
            <div className="flex items-center gap-2 text-[#AAA]">
                <span className="text-[10px] uppercase tracking-[0.2em]">{stats.evaluationLabel}</span>
                <span className="text-[10px] text-[#666]">{todayProgressPct}%</span>
            </div>
        </div>

        <div className="flex flex-col items-end font-mono text-xs gap-0.5">
            <div className="text-[9px] uppercase tracking-[0.2em] text-[#666]">Today Min</div>
            <div className="flex items-center gap-2 text-[#CCC]">
                <span className="font-bold tracking-wider">{todayTrackedMinutes} MIN</span>
            </div>
            <div className="text-[10px] text-[#666]">Daily tracked</div>
        </div>

        {authStatus === 'loadingCloud' ? (
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#f3c56a]">Syncing...</div>
        ) : null}

        {/* Auth (minimal UI) */}
        <div className="flex items-center gap-2 min-w-[180px] justify-end">
            {loading ? (
                <span className="text-[11px] text-[#777] font-mono">…</span>
            ) : null}
            {user ? (
                <>
                    <div className="w-7 h-7 rounded-full overflow-hidden border border-white/20 bg-[#111114] flex items-center justify-center text-[10px] text-[#f3f0e8]">
                        {user.avatar ? (
                          <img src={user.avatar} alt="user avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span>{userInitial}</span>
                        )}
                    </div>
                    <span className="text-[10px] text-[#AAA] max-w-[140px] truncate">{userLabel}</span>
                    <button
                        onMouseEnter={playHoverSound}
                        onClick={() => {
                            playClickSound();
                            void signOut();
                        }}
                        className="h-8 px-3 border border-[#333] text-[9px] uppercase tracking-[0.2em] text-[#f3f0e8] hover:border-[#ff2a3a] hover:text-[#ff2a3a] transition-colors"
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
                    className="h-8 px-3 border border-[#333] text-[9px] uppercase tracking-[0.2em] transition-colors text-[#f3f0e8] hover:border-[#ff2a3a] hover:text-[#ff2a3a]"
                >
                    LOGIN
                </button>
            ) : null}
            {import.meta.env.DEV && error && (
              <span className="text-[9px] text-[#ff2a3a] max-w-[120px] truncate" title={error}>
                {error}
              </span>
            )}
        </div>

        <div className="w-[1px] h-6 bg-[#333]"></div>

        {/* System Icons */}
        <div className="flex items-center gap-1 text-[#666]">
            <button onMouseEnter={playHoverSound} onClick={playClickSound} className="hover:text-white p-2 transition-colors"><Trophy size={16} /></button>
            <button onMouseEnter={playHoverSound} onClick={playClickSound} className="hover:text-white p-2 transition-colors"><Bell size={16} /></button>
            <button onMouseEnter={playHoverSound} onClick={() => onChangeView(ClientView.SETTINGS)} className="hover:text-white p-2 transition-colors"><Settings size={16} /></button>
        </div>
      </div>
      </div>

      {isLoginModalOpen && !user ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4" onClick={closeLoginModal}>
          <div
            className="ui-panel-surface chamfer-card w-full max-w-md border border-[var(--ui-border)] bg-[var(--ui-panel)] p-5"
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
                    ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.2)] text-[var(--ui-text)]'
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
                    ? 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.2)] text-[var(--ui-text)]'
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
                className="ui-pressable flex h-10 items-center justify-center gap-2 border border-[var(--ui-accent)] bg-[rgba(143,99,255,0.2)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ui-text)] hover:bg-[rgba(143,99,255,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
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
