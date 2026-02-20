
import React from 'react';
import { Play, Settings, Bell, Trophy, Bot } from 'lucide-react';
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
  const { user, loading, error, signInWithGoogle, signOut } = useAuth();
  const userLabel = user?.name || user?.email || 'Signed in';
  const userInitial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();
  const todayTrackedMinutes = selectors.getTrackedMinutesForDay(dateKey);
  const todayTargetMinutes = selectors.getTargetXP(dateKey);
  const todayProgressPct = selectors.getProgressPct(dateKey);

  return (
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
                        void signInWithGoogle();
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
  );
};
