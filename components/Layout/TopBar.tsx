
import React from 'react';
import { Play, Settings, Bell, HelpCircle, Trophy, Bot, Radio } from 'lucide-react';
import { ClientView } from '../../types';
import { NavTab } from '../UI/HextechUI';
import { ASSETS } from '../../constants';
import { playClickSound, playHoverSound } from '../../utils/SoundEffects';

interface TopBarProps {
  currentView: ClientView;
  onChangeView: (view: ClientView) => void;
  onPlayClick: () => void;
  onToggleAssistant: () => void;
  isAssistantOpen: boolean;
  activeMissionsCount: number;
  totalXP: number;
  potentialXP: number;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  currentView, 
  onChangeView, 
  onPlayClick,
  onToggleAssistant,
  isAssistantOpen,
  activeMissionsCount,
  totalXP,
  potentialXP
}) => {
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
                    : activeMissionsCount > 0
                        ? 'bg-[#FF2A3A]/10 border-[#FF2A3A] text-[#FF2A3A] shadow-[0_0_15px_rgba(255,42,58,0.4)]'
                        : 'bg-transparent border-[#333] text-[#666] hover:border-white hover:text-white'
                }
            `}
        >
            <Bot size={18} className={activeMissionsCount > 0 && !isAssistantOpen ? 'animate-pulse' : ''} />
            <span className="text-[10px] font-bold font-mono tracking-widest">TERMINAL</span>
        </button>

        {/* Server Status Indicator -> Active Mission Count */}
        <div className="flex items-center gap-2 mr-4 min-w-[60px] justify-end">
             <div className={`w-2 h-2 rounded-full ${activeMissionsCount > 0 ? 'bg-[#FF2A3A] animate-pulse shadow-[0_0_8px_#FF2A3A]' : 'bg-[#333]'}`}></div>
             {activeMissionsCount > 0 ? (
                 <span className="text-[10px] text-[#FF2A3A] font-mono uppercase font-bold tracking-widest">ACTIVE: {activeMissionsCount}</span>
             ) : (
                 <div className="flex gap-1 h-2 items-center">
                    <div className="w-1 h-1 bg-[#666] animate-bounce [animation-duration:1s]"></div>
                    <div className="w-1 h-1 bg-[#666] animate-bounce [animation-duration:1s] [animation-delay:0.1s]"></div>
                    <div className="w-1 h-1 bg-[#666] animate-bounce [animation-duration:1s] [animation-delay:0.2s]"></div>
                 </div>
             )}
        </div>

        {/* Currencies - Technical Readout */}
        <div className="flex flex-col items-end font-mono text-xs gap-0.5">
            <div className="flex items-center gap-2 group cursor-pointer text-[#CCC]">
                <span className="font-bold tracking-wider">{totalXP}</span>
                <span className="text-[#666] text-[10px]">XP</span>
            </div>
            <div className="flex items-center gap-2 group cursor-pointer text-[#CCC]">
                <span className="font-bold tracking-wider text-[#FF2A3A]">-{potentialXP}</span>
                <span className="text-[#666] text-[10px]">REQ</span>
            </div>
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
