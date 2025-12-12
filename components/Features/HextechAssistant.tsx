
import React, { useState, useEffect, useRef } from 'react';
import { Mission, Priority } from '../../types';
import { HexButton, HexPanel } from '../UI/HextechUI';
import { playSuccessSound, playPanelOpenSound, playClickSound, playErrorSound, playHoverSound } from '../../utils/SoundEffects';
import { 
  Bot, X, Plus, Trash2, Check, Clock, 
  Sword, Shield, Star, Zap, Flag, AlertTriangle, Edit2, RotateCcw,
  History, List, Terminal
} from 'lucide-react';

interface HextechAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  missions: Mission[];
  setMissions: React.Dispatch<React.SetStateAction<Mission[]>>;
}

export const HextechAssistant: React.FC<HextechAssistantProps> = ({ isOpen, onClose, missions, setMissions }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Play sound on open
  useEffect(() => {
    if (isOpen) playPanelOpenSound();
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (!isOpen) return;

        const target = event.target as Element;
        const toggleBtn = document.getElementById('hextech-assistant-toggle');

        // Check if click is inside the assistant panel
        if (containerRef.current && containerRef.current.contains(target as Node)) {
            return;
        }

        // Check if click is on the toggle button (let the button handle the toggle action)
        if (toggleBtn && (toggleBtn === target || toggleBtn.contains(target as Node))) {
            return;
        }

        // Otherwise, close the assistant
        onClose();
    };

    if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newMissionTitle, setNewMissionTitle] = useState('');
  const [newMissionPriority, setNewMissionPriority] = useState<Priority>(Priority.MEDIUM);
  const [newMissionXP, setNewMissionXP] = useState<number>(100);
  
  const [newMissionDeadline, setNewMissionDeadline] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 24);
    d.setMinutes(0);
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  });
  
  const [newMissionIcon, setNewMissionIcon] = useState<Mission['icon']>('sword');

  const resetForm = () => {
    setNewMissionTitle('');
    setNewMissionPriority(Priority.MEDIUM);
    setNewMissionXP(100);
    setNewMissionIcon('sword');
    
    const d = new Date();
    d.setHours(d.getHours() + 24);
    d.setMinutes(0);
    setNewMissionDeadline(new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16));
    
    setEditingId(null);
  };

  const handleEditClick = (mission: Mission) => {
    playClickSound();
    setViewMode('active');
    setEditingId(mission.id);
    setNewMissionTitle(mission.title);
    setNewMissionPriority(mission.priority);
    setNewMissionXP(mission.xp);
    setNewMissionIcon(mission.icon);
    
    const d = new Date(mission.deadline);
    const iso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    setNewMissionDeadline(iso);
  };

  const addOrUpdateMission = () => {
    if (!newMissionTitle.trim()) {
        playErrorSound();
        return;
    }
    
    const deadlineTimestamp = new Date(newMissionDeadline).getTime();

    if (editingId) {
        setMissions(prev => prev.map(m => 
            m.id === editingId 
            ? {
                ...m,
                title: newMissionTitle,
                priority: newMissionPriority,
                deadline: deadlineTimestamp,
                icon: newMissionIcon,
                xp: newMissionXP
              }
            : m
        ));
        resetForm();
    } else {
        const mission: Mission = {
            id: Date.now().toString(),
            title: newMissionTitle,
            priority: newMissionPriority,
            completed: false,
            createdAt: Date.now(),
            deadline: deadlineTimestamp,
            icon: newMissionIcon,
            xp: newMissionXP
        };
        setMissions(prev => [mission, ...prev]);
        resetForm();
    }
    playSuccessSound();
  };

  const toggleComplete = (id: string) => {
    setMissions(prev => {
        const mission = prev.find(m => m.id === id);
        if (mission && !mission.completed) {
            playSuccessSound();
        } else {
            playClickSound();
        }
        return prev.map(m => m.id === id ? { 
            ...m, 
            completed: !m.completed,
            completedAt: !m.completed ? Date.now() : undefined 
        } : m);
    });
  };

  const deleteMission = (id: string) => {
    playErrorSound();
    setMissions(prev => prev.filter(m => m.id !== id));
    if (editingId === id) resetForm();
  };

  if (!isOpen) return null;

  const visibleMissions = missions
    .filter(m => viewMode === 'history' ? m.completed : !m.completed)
    .sort((a, b) => {
        if (viewMode === 'history') return b.createdAt - a.createdAt;
        const priorityWeight = { [Priority.HIGH]: 3, [Priority.MEDIUM]: 2, [Priority.LOW]: 1 };
        if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
            return priorityWeight[b.priority] - priorityWeight[a.priority];
        }
        return a.deadline - b.deadline;
    });

  return (
    <div ref={containerRef} className="absolute top-[60px] right-[20px] w-[400px] z-50 animate-fade-in font-mono origin-top-right">
      <HexPanel className="flex flex-col max-h-[700px] bg-[#0F0F0F] border border-[#333] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#333] flex items-center justify-between bg-[#050505]">
          <div className="flex items-center gap-2 text-white">
            <Terminal size={18} />
            <span className="font-bold tracking-widest uppercase text-xs">AI_OS_TERMINAL_V1</span>
          </div>
          
          <div className="flex items-center gap-2">
              <button 
                onClick={() => { playClickSound(); setViewMode(viewMode === 'active' ? 'history' : 'active'); }}
                className={`p-1 border transition-all ${viewMode === 'history' ? 'bg-[#FF2A3A] text-white border-[#FF2A3A]' : 'border-[#333] text-[#666] hover:text-white'}`}
              >
                {viewMode === 'active' ? <History size={14} /> : <List size={14} />}
              </button>
              <button 
                onClick={() => { playClickSound(); onClose(); }} 
                className="p-1 border border-[#333] text-[#666] hover:bg-[#FF2A3A] hover:text-white hover:border-[#FF2A3A] transition-colors"
              >
                <X size={14} />
              </button>
          </div>
        </div>

        {/* Input Form */}
        {viewMode === 'active' && (
            <div className={`p-4 border-b border-[#333] transition-colors ${editingId ? 'bg-[#FF2A3A]/10' : 'bg-[#0A0A0A]'}`}>
            <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#666]">
                    {editingId ? '>> MODIFYING_ENTRY' : '>> NEW_ENTRY'}
                </span>
                {editingId && (
                    <button onClick={() => { playClickSound(); resetForm(); }} className="text-[10px] text-[#FF2A3A] uppercase hover:underline">
                        [ Cancel ]
                    </button>
                )}
            </div>
            
            <div className="mb-3">
                <input 
                type="text" 
                value={newMissionTitle}
                onChange={(e) => setNewMissionTitle(e.target.value)}
                placeholder="ENTER_DIRECTIVE..."
                className="w-full bg-[#111] border border-[#333] p-2 text-xs text-white placeholder-[#444] focus:border-white focus:outline-none uppercase"
                />
            </div>
            
            <div className="flex gap-2 mb-3">
                <select 
                value={newMissionPriority}
                onChange={(e) => setNewMissionPriority(e.target.value as Priority)}
                className="bg-[#111] border border-[#333] text-[10px] text-white p-2 w-32 focus:border-white outline-none uppercase"
                >
                <option value={Priority.LOW}>Prio: Low</option>
                <option value={Priority.MEDIUM}>Prio: Med</option>
                <option value={Priority.HIGH}>Prio: High</option>
                </select>

                <div className="relative flex-1">
                    <input 
                    type="datetime-local"
                    value={newMissionDeadline}
                    onChange={(e) => setNewMissionDeadline(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] text-[10px] text-white p-2 focus:border-white outline-none [color-scheme:dark] uppercase"
                    />
                </div>
            </div>

            <div className="flex items-center justify-between mb-3">
                <div className="flex gap-1">
                    {(['sword', 'shield', 'star', 'zap', 'flag'] as const).map(icon => (
                    <button 
                        key={icon}
                        onClick={() => { playClickSound(); setNewMissionIcon(icon); }}
                        className={`p-1.5 border transition-all ${newMissionIcon === icon ? 'bg-white text-black border-white' : 'border-[#333] text-[#666] hover:border-[#666]'}`}
                    >
                        <MissionIcon icon={icon} size={12} />
                    </button>
                    ))}
                </div>

                <div className="relative w-24">
                    <input 
                        type="number"
                        min="0"
                        value={newMissionXP}
                        onChange={(e) => setNewMissionXP(parseInt(e.target.value) || 0)}
                        className="w-full bg-[#111] border border-[#333] text-xs text-[#FF2A3A] p-2 pr-8 focus:border-white outline-none font-bold text-right"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-[#444] pointer-events-none font-bold">XP</span>
                </div>
            </div>

            <HexButton onClick={addOrUpdateMission} className="w-full py-2 text-xs border border-white hover:bg-[#FF2A3A] hover:border-[#FF2A3A]" variant="primary">
                {editingId ? 'UPDATE_DATABASE' : 'ADD_TO_DATABASE'}
            </HexButton>
            </div>
        )}

        {/* History Banner */}
        {viewMode === 'history' && (
            <div className="p-2 bg-[#0A0A0A] border-b border-[#333] text-center">
                <span className="text-[#666] text-[10px] font-bold tracking-widest uppercase">:: ARCHIVE_MODE ::</span>
            </div>
        )}

        {/* Mission List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar min-h-[200px] max-h-[420px]">
          {visibleMissions.map(mission => (
            <MissionItem 
              key={mission.id} 
              mission={mission} 
              isEditing={editingId === mission.id}
              onToggle={() => toggleComplete(mission.id)}
              onDelete={() => deleteMission(mission.id)}
              onEdit={() => handleEditClick(mission)}
            />
          ))}
        </div>
        
        {/* Footer */}
        <div className="p-2 border-t border-[#333] bg-[#050505] flex justify-between items-center text-[10px] text-[#444] uppercase tracking-wider font-mono">
           <span>RAM: 64TB</span>
           <span>XP_TOTAL: {missions.filter(m => m.completed).reduce((sum, m) => sum + (m.xp || 0), 0)}</span>
        </div>
      </HexPanel>
    </div>
  );
};

// --- Sub-components ---

const MissionIcon: React.FC<{ icon: string, size?: number, className?: string }> = ({ icon, size = 16, className = '' }) => {
    switch (icon) {
        case 'sword': return <Sword size={size} className={className} />;
        case 'shield': return <Shield size={size} className={className} />;
        case 'star': return <Star size={size} className={className} />;
        case 'zap': return <Zap size={size} className={className} />;
        case 'flag': return <Flag size={size} className={className} />;
        default: return <AlertTriangle size={size} className={className} />;
    }
}

const MissionItem: React.FC<{ 
    mission: Mission, 
    isEditing: boolean,
    onToggle: () => void, 
    onDelete: () => void,
    onEdit: () => void
}> = ({ mission, isEditing, onToggle, onDelete, onEdit }) => {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isOverdue, setIsOverdue] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        const updateTimer = () => {
            const now = Date.now();
            const diff = mission.deadline - now;
            if (diff <= 0) {
                setTimeLeft(mission.completed ? 'COMPLETED' : 'OVERDUE');
                setIsOverdue(!mission.completed);
            } else {
                setIsOverdue(false);
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                if (h > 24) setTimeLeft(`${Math.floor(h / 24)}d ${h % 24}h`);
                else setTimeLeft(`${h}h ${m}m`);
            }
        };
        updateTimer();
        const interval = setInterval(updateTimer, 60000); // Less frequent updates for industrial feel
        return () => clearInterval(interval);
    }, [mission.deadline, mission.completed]);

    const handleToggleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!mission.completed) {
            setIsAnimating(true);
            playSuccessSound();
            setTimeout(() => {
                onToggle();
                setIsAnimating(false);
            }, 500);
        } else {
            onToggle();
        }
    };

    const getPriorityColor = () => {
        if (mission.completed) return 'bg-[#111] border-[#333] text-[#444]';
        if (isOverdue) return 'bg-[#FF2A3A]/10 border-[#FF2A3A] text-[#FF2A3A]';
        switch (mission.priority) {
            case Priority.HIGH: return 'border-white bg-[#0A0A0A] text-white';
            case Priority.MEDIUM: return 'border-[#666] bg-[#0A0A0A] text-[#AAA]';
            case Priority.LOW: return 'border-[#333] bg-[#0A0A0A] text-[#666]';
        }
    };

    return (
        <div className={`
            relative border p-3 transition-all group overflow-hidden
            ${getPriorityColor()}
            ${isAnimating ? 'bg-white text-black border-white invert' : ''}
            ${isEditing ? 'ring-1 ring-white' : ''}
        `}>
            {/* Visual Confirmation Glitch */}
            {isAnimating && (
                <div className="absolute inset-0 bg-white z-20 mix-blend-difference flex items-center justify-center">
                    <div className="text-black font-black text-2xl uppercase tracking-widest">SUCCESS</div>
                </div>
            )}

            <div className="flex items-start gap-3 relative z-10">
                <div className={`w-8 h-8 border border-current flex items-center justify-center shrink-0`}>
                    <MissionIcon icon={mission.icon} size={14} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                {isOverdue ? '! CRITICAL !' : `PRIO: ${mission.priority}`}
                            </span>
                            {mission.xp > 0 && (
                                <span className="text-[8px] border border-current px-1 font-bold">
                                    +{mission.xp} XP
                                </span>
                            )}
                        </div>
                    </div>
                    
                    <h4 className={`font-bold text-xs mb-1 truncate uppercase ${mission.completed ? 'line-through opacity-50' : ''}`}>
                        {mission.title}
                    </h4>

                    <div className="flex items-center gap-2 text-[10px] opacity-70">
                        <Clock size={10} />
                        <span>{timeLeft}</span>
                    </div>
                </div>
            </div>

            {/* Hover Actions */}
            <div className="absolute top-0 right-0 h-full flex items-center bg-[#050505] border-l border-[#333] translate-x-full group-hover:translate-x-0 transition-transform z-20">
                 <button onClick={handleToggleClick} className="h-full px-3 hover:bg-white hover:text-black transition-colors">
                    {mission.completed ? <RotateCcw size={14} /> : <Check size={14} />}
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="h-full px-3 hover:bg-white hover:text-black transition-colors border-l border-[#333]">
                    <Edit2 size={14} />
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="h-full px-3 hover:bg-[#FF2A3A] hover:text-white transition-colors border-l border-[#333]">
                    <Trash2 size={14} />
                 </button>
            </div>
        </div>
    );
};
