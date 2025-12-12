import React, { useState, useEffect } from 'react';
import { HexButton, HexCard, HexPanel } from '../UI/HextechUI';
import { CHAMPIONS } from '../../constants';
import { X, Mic, Settings, MessageSquare, Search, Lock, User, Shield, Radio, Activity } from 'lucide-react';
import { playMatchFoundSound, playClickSound, playHoverSound } from '../../utils/SoundEffects';

interface LobbyProps {
  onBack: () => void;
  setBackground: (url: string | null) => void;
}

enum LobbyState {
  ROLE_SELECT = 'ROLE_SELECT',
  FINDING_MATCH = 'FINDING_MATCH',
  MATCH_FOUND = 'MATCH_FOUND',
  CHAMP_SELECT = 'CHAMP_SELECT'
}

export const Lobby: React.FC<LobbyProps> = ({ onBack, setBackground }) => {
  const [state, setState] = useState<LobbyState>(LobbyState.ROLE_SELECT);
  const [timer, setTimer] = useState(0);
  const [selectedChamp, setSelectedChamp] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [pickTimer, setPickTimer] = useState(30);

  // Queue Timer
  useEffect(() => {
    let interval: number;
    if (state === LobbyState.FINDING_MATCH) {
      interval = window.setInterval(() => {
        setTimer(t => {
            if (t > 3 && Math.random() > 0.98) { 
                setState(LobbyState.MATCH_FOUND);
                playMatchFoundSound();
                return t;
            }
            return t + 1;
        });
      }, 1000);
    } else {
        setTimer(0);
    }
    return () => clearInterval(interval);
  }, [state]);

  useEffect(() => {
    let interval: number;
    if (state === LobbyState.CHAMP_SELECT && pickTimer > 0 && !isLocked) {
        interval = window.setInterval(() => {
            setPickTimer(t => t - 1);
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [state, pickTimer, isLocked]);

  useEffect(() => {
    if (selectedChamp) {
        const champ = CHAMPIONS.find(c => c.id === selectedChamp);
        if (champ) setBackground(champ.image);
    } else {
        setBackground(null);
    }
  }, [selectedChamp, setBackground]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleAccept = () => {
    playClickSound();
    setState(LobbyState.CHAMP_SELECT);
    setPickTimer(30);
  };

  // --- MATCH FOUND OVERLAY (KPR RADAR STYLE) ---
  if (state === LobbyState.MATCH_FOUND) {
      return (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050505]/95 animate-match-found-fade">
             {/* Background Grid Scan */}
             <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzIyMiIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] opacity-20"></div>
             <div className="absolute w-full h-[2px] bg-[#FF2A3A] opacity-50 animate-scanline"></div>

             <div className="relative w-[500px] h-[500px] flex items-center justify-center">
                 <div className="absolute inset-0 rounded-full border border-[#FF2A3A]/30 animate-pulse-border"></div>
                 {/* Static Rings */}
                 <div className="absolute inset-0 rounded-full border border-[#333]"></div>
                 <div className="absolute inset-0 rounded-full border border-[#333] scale-75"></div>
                 
                 {/* Rotating Elements */}
                 <div className="absolute inset-0 border-t-2 border-[#FF2A3A] rounded-full animate-spin-slow"></div>
                 <div className="absolute inset-0 border-b-2 border-white rounded-full animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '5s' }}></div>

                 <div className="absolute flex flex-col items-center z-10 bg-[#050505] p-10 border border-[#333]">
                    <h2 className="text-4xl font-mono font-bold text-white mb-2 uppercase tracking-widest">Match_Found</h2>
                    <div className="text-[#FF2A3A] text-xs font-mono mb-8 animate-pulse">:: WAITING FOR CONFIRMATION ::</div>
                    
                    <button 
                        onClick={handleAccept}
                        onMouseEnter={playHoverSound}
                        className="group w-48 h-16 bg-white text-black font-mono font-bold text-xl uppercase tracking-widest hover:bg-[#FF2A3A] hover:text-white transition-colors border-2 border-transparent hover:border-white"
                    >
                        ACCEPT
                    </button>
                    
                    <div className="mt-6 flex flex-col items-center gap-2">
                        <button 
                            className="text-[#666] hover:text-white text-[10px] font-mono uppercase tracking-widest transition-colors" 
                            onClick={() => { playClickSound(); setState(LobbyState.ROLE_SELECT); }}
                        >
                            [ Decline ]
                        </button>
                    </div>
                 </div>
             </div>
          </div>
      );
  }

  // --- CHAMP SELECT ---
  if (state === LobbyState.CHAMP_SELECT) {
      const champ = CHAMPIONS.find(c => c.id === selectedChamp);

      return (
          <div className="flex flex-col h-full relative font-mono">
              <div className="absolute inset-0 bg-[#050505]/80 z-0 pointer-events-none"></div>

              {/* Top Bar: Timer & Phase */}
              <div className="h-20 z-10 flex items-center justify-between px-8 border-b border-[#333] bg-[#050505]/90">
                  <div className="w-1/3 text-[#666] text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-2 bg-white"></div> ALLY_UNIT
                  </div>
                  <div className="flex flex-col items-center">
                      <div className={`text-5xl font-bold leading-none ${pickTimer < 10 ? 'text-[#FF2A3A] animate-pulse' : 'text-white'}`}>{pickTimer}</div>
                      <div className="text-[#666] text-[10px] uppercase tracking-widest mt-1">
                          {isLocked ? 'WAITING_FOR_REMOTE' : 'SELECT_LOADOUT'}
                      </div>
                  </div>
                  <div className="w-1/3 text-right text-[#666] text-xs font-bold uppercase tracking-widest flex items-center justify-end gap-2">
                      ENEMY_UNIT <div className="w-2 h-2 bg-[#FF2A3A]"></div>
                  </div>
              </div>

              {/* Main Stage */}
              <div className="flex-1 flex z-10 px-8 py-6 gap-6">
                  {/* Left Team (Allies) */}
                  <div className="w-[260px] flex flex-col justify-center gap-1">
                      {[1,2,3,4,5].map(i => (
                          <div key={i} className="flex items-center gap-4 p-3 border border-[#333] bg-[#0A0A0A] transition-all hover:border-white group">
                              <div className="w-12 h-12 border border-[#333] overflow-hidden bg-[#111]">
                                    {i === 3 && selectedChamp ? (
                                        <img src={champ?.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[#333]"><User size={20} /></div>
                                    )}
                              </div>
                              <div className="flex flex-col">
                                  <span className={`text-xs font-bold uppercase ${i === 3 ? 'text-white' : 'text-[#888]'}`}>
                                      {i === 3 ? 'LOCAL_USER' : `ALLY_0${i}`}
                                  </span>
                                  <span className="text-[10px] text-[#444] uppercase">Scanning...</span>
                              </div>
                          </div>
                      ))}
                  </div>

                  {/* Center Interaction Area */}
                  <div className="flex-1 flex flex-col items-center justify-end pb-4">
                       {/* Lock In Button Area */}
                       {selectedChamp && !isLocked && (
                           <div className="mb-6 animate-fade-in w-full max-w-md flex flex-col items-center">
                               <h1 className="text-4xl font-bold text-white uppercase tracking-tighter mb-4 text-center">
                                   {champ?.name}
                               </h1>
                               <HexButton 
                                    variant="play" 
                                    className="w-full h-14 text-lg tracking-widest"
                                    onClick={() => { playClickSound(); setIsLocked(true); }}
                                >
                                   CONFIRM_SELECTION
                               </HexButton>
                           </div>
                       )}

                       {/* Champion Grid */}
                       {!isLocked && (
                           <HexPanel className="w-full max-w-5xl h-[400px] flex flex-col p-4">
                               <div className="flex gap-4 mb-4 border-b border-[#333] pb-4">
                                   <div className="relative flex-1">
                                       <Search className="absolute left-3 top-2.5 text-[#666]" size={14} />
                                       <input type="text" placeholder="SEARCH_DATABASE..." className="w-full bg-[#111] border border-[#333] py-2 pl-10 pr-4 text-white text-xs font-mono uppercase focus:border-white focus:outline-none placeholder-[#444]" />
                                   </div>
                                   <div className="flex gap-1">
                                       {['Top', 'Jng', 'Mid', 'Bot', 'Sup'].map(role => (
                                           <button key={role} className="px-3 border border-[#333] bg-[#111] hover:bg-white hover:text-black hover:border-white transition-colors text-[10px] uppercase font-bold text-[#666]">
                                               {role}
                                           </button>
                                       ))}
                                   </div>
                               </div>
                               
                               <div className="grid grid-cols-8 gap-2 overflow-y-auto pr-2 custom-scrollbar content-start">
                                   {CHAMPIONS.map(c => (
                                       <div 
                                        key={c.id} 
                                        onClick={() => { playClickSound(); setSelectedChamp(c.id); }}
                                        onMouseEnter={playHoverSound}
                                        className={`aspect-square border cursor-pointer overflow-hidden relative group transition-all ${selectedChamp === c.id ? 'border-white ring-1 ring-white z-10' : 'border-[#333] hover:border-[#888]'}`}
                                       >
                                           <img src={c.image} alt={c.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300" />
                                       </div>
                                   ))}
                               </div>
                           </HexPanel>
                       )}
                  </div>

                  {/* Right Team (Enemies) */}
                  <div className="w-[260px] flex flex-col justify-center gap-1">
                       {[1,2,3,4,5].map(i => (
                          <div key={i} className="flex flex-row-reverse items-center gap-4 p-3 border border-[#333] bg-[#0A0A0A] opacity-60">
                              <div className="w-12 h-12 border border-[#333] bg-[#111] flex items-center justify-center">
                                  <User size={20} className="text-[#333]" />
                              </div>
                              <div className="flex flex-col items-end">
                                  <span className="text-xs font-bold text-[#FF2A3A] uppercase">ENEMY_0{i}</span>
                                  <span className="text-[10px] text-[#444] uppercase">Unknown</span>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      );
  }

  // --- LOBBY (Role Select) ---
  return (
    <div className="h-full flex items-center justify-center font-mono">
      {/* Background Image is handled by CSS in App.tsx but we can add an overlay */}
      
      <div className="relative z-10 w-full max-w-7xl p-8 flex gap-8 h-[85%]">
        
        {/* Main Lobby Panel */}
        <div className="flex-1 flex flex-col">
            <div className="mb-6 border-l-4 border-[#FF2A3A] pl-4">
                <h1 className="text-4xl font-bold text-white uppercase tracking-tighter">Summoner's Rift</h1>
                <div className="flex items-center gap-2 text-[#666] text-xs font-bold uppercase tracking-widest mt-1">
                    <span>5V5</span>
                    <span>//</span>
                    <span>BLIND_PICK_MODE</span>
                </div>
            </div>
            
            <div className="flex-1 border border-[#333] bg-[#050505]/90 relative flex flex-col items-center justify-center group shadow-2xl">
                 {/* Decorative Tech Lines */}
                 <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-white"></div>
                 <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-white"></div>
                 <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-white"></div>
                 <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-white"></div>
                 
                 {/* Lobby Slots */}
                 <div className="flex items-center justify-center gap-6 w-full px-12 z-10">
                    {[1,2,3,4,5].map((slot) => (
                        <div key={slot} className="flex flex-col items-center gap-4 group/slot cursor-pointer">
                            {slot === 3 ? (
                                <div className="relative">
                                    <div className="w-24 h-24 border border-white p-1 bg-[#111]">
                                        <img src="https://ddragon.leagueoflegends.com/cdn/14.4.1/img/profileicon/29.png" className="w-full h-full grayscale" />
                                    </div>
                                    <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-[#FF2A3A] px-2 py-0.5 text-[8px] text-white font-bold uppercase tracking-widest whitespace-nowrap">
                                        LOCAL_USER
                                    </div>
                                </div>
                            ) : (
                                <div 
                                    onMouseEnter={playHoverSound}
                                    className="w-20 h-20 border border-[#333] border-dashed flex items-center justify-center hover:bg-white/10 hover:border-white transition-all"
                                >
                                    <span className="text-[#333] text-2xl group-hover/slot:text-white">+</span>
                                </div>
                            )}
                        </div>
                    ))}
                 </div>

                 {/* Role Selectors */}
                 <div className="mt-16 flex gap-4">
                     <div className="w-12 h-12 bg-white border border-white flex items-center justify-center text-black">
                         <Shield size={20} />
                     </div>
                     <div className="w-12 h-12 bg-transparent border border-[#333] flex items-center justify-center opacity-50 text-[#666]">
                        <Shield size={20} />
                     </div>
                 </div>
            </div>

            {/* Bottom Controls */}
            <div className="h-24 flex items-center justify-between px-0 pt-4">
                <HexButton variant="secondary" onClick={onBack} className="w-14 h-14 p-0 border border-[#333] hover:bg-white hover:text-black">
                     <X size={24} />
                </HexButton>

                <div className="flex flex-col items-center w-full max-w-lg mx-auto">
                    {state === LobbyState.ROLE_SELECT ? (
                        <HexButton 
                            variant="play" 
                            className="w-full h-14 text-lg tracking-widest" 
                            onClick={() => setState(LobbyState.FINDING_MATCH)}
                        >
                            INITIATE_MATCHMAKING
                        </HexButton>
                    ) : (
                        <div className="flex flex-col items-center w-full">
                            <div className="w-full h-14 border border-[#FF2A3A] bg-[#FF2A3A]/10 flex items-center justify-center gap-3">
                                <Activity className="text-[#FF2A3A] animate-pulse" size={20} />
                                <span className="text-[#FF2A3A] font-bold text-lg tracking-widest uppercase">Scanning Network...</span>
                            </div>
                            <div className="text-[#666] text-[10px] uppercase font-bold tracking-wider mt-2">Time_Elapsed: {formatTime(timer)}</div>
                            <button 
                                onClick={() => { playClickSound(); setState(LobbyState.ROLE_SELECT); }}
                                className="mt-2 text-[#666] hover:text-white text-[10px] uppercase font-bold hover:underline decoration-[#FF2A3A]"
                            >
                                [ Cancel_Request ]
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                     <button className="w-14 h-14 bg-[#050505] border border-[#333] flex items-center justify-center text-[#666] hover:text-white hover:border-white transition-all" onMouseEnter={playHoverSound} onClick={playClickSound}>
                        <Mic size={20} />
                    </button>
                </div>
            </div>
        </div>

        {/* Right Sidebar - Party/Chat */}
        <div className="w-[320px] flex flex-col gap-4">
            <HexPanel className="flex-1 p-0 flex flex-col">
                <div className="p-3 border-b border-[#333] flex justify-between items-center bg-[#0A0A0A]">
                    <span className="text-[#666] text-xs font-bold uppercase tracking-widest">Suggested_Users</span>
                </div>
                <div className="p-3">
                    {[1,2,3].map(i => (
                        <div key={i} className="flex items-center justify-between mb-3 group cursor-pointer border border-[#333] p-2 hover:bg-white hover:text-black hover:border-white transition-all" onMouseEnter={playHoverSound}>
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 bg-[#222] border border-[#444]"></div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold uppercase">Candidate_0{i}</span>
                                </div>
                            </div>
                            <PlusIcon />
                        </div>
                    ))}
                </div>
            </HexPanel>
            
            <HexPanel className="h-1/3 p-0 flex flex-col">
  <div className="p-2 border-b border-[#333] flex items-center justify-between bg-[#0A0A0A]">
    <span className="text-[#666] text-[10px] font-bold uppercase tracking-widest">Lobby_Comm_Link</span>
    <Settings size={12} className="text-[#666]" />
  </div>
  <div className="flex-1 p-3 text-xs space-y-1 font-mono">
    <div className="text-[#FF2A3A]">
      [SYS] {'>'} Link established.
    </div>
    <div className="text-[#666]">
      [SYS] {'>'} Waiting for unit assembly.
    </div>
  </div>
  <div className="p-2 border-t border-[#333]">
    <input
      type="text"
      placeholder="TRANSMIT..."
      className="w-full bg-[#050505] border border-[#333] p-2 text-xs text-white focus:border-white focus:outline-none font-mono uppercase"
    />
  </div>
</HexPanel>
        </div>

      </div>
    </div>
  );
};

const PlusIcon = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
        <path d="M6 0V12M0 6H12" strokeWidth="2"/>
    </svg>
)
