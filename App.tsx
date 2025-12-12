
import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from './components/Layout/TopBar';
import { Home } from './components/Views/Home';
import { Profile } from './components/Views/Profile';
import { Lobby } from './components/Views/Lobby';
import { Settings } from './components/Views/Settings';
import { Inventory } from './components/Views/Inventory';
import { Multiplayer } from './components/Views/Multiplayer';
import { HextechAssistant } from './components/Features/HextechAssistant';
import { RewardOverlay } from './components/Features/RewardOverlay';
import { Earth } from './components/Views/Earth';
import { ClientView, Mission, Priority, RewardConfig } from './types';
import { ASSETS } from './constants';
import { playMatchFoundSound, playClickSound } from './utils/SoundEffects';
import { readFileAsDataUrl } from './utils/fileUtils';

const defaultRewardConfigs: RewardConfig[] = [
  { level: 1, threshold: 100, animation: 'CYBER_PULSE', sound: 'LEVEL_UP' },
  { level: 2, threshold: 250, animation: 'GOLDEN_HEX', sound: 'CHIME' },
  { level: 3, threshold: 500, animation: 'GLITCH_STORM', sound: 'TECH_POWER' },
  { level: 4, threshold: 1000, animation: 'ORBITAL_STRIKE', sound: 'ALARM' },
  { level: 5, threshold: 2000, animation: 'NEON_BURST', sound: 'BASS_DROP' },
];

const defaultMissions: Mission[] = [
  {
    id: '1',
    title: 'Win 3 Ranked Games',
    priority: Priority.HIGH,
    completed: false,
    createdAt: Date.now() - 3600000,
    deadline: Date.now() + 7200000, 
    icon: 'sword',
    xp: 500
  },
  {
    id: '2',
    title: 'Earn 5000 Gold',
    priority: Priority.MEDIUM,
    completed: true,
    createdAt: Date.now() - 86400000,
    completedAt: Date.now() - 10000, // Just completed
    deadline: Date.now() - 10000,
    icon: 'star',
    xp: 250
  },
  {
    id: '3',
    title: 'Daily First Win',
    priority: Priority.LOW,
    completed: false,
    createdAt: Date.now() - 86400000,
    deadline: Date.now() - 3600000, 
    icon: 'zap',
    xp: 150
  }
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ClientView>(ClientView.HOME);
  const [previousView, setPreviousView] = useState<ClientView>(ClientView.HOME);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  
  // New State for dynamic background (e.g., Champ Select splash art)
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [viewBackgrounds, setViewBackgrounds] = useState<Record<ClientView, string | null>>(() => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('viewBackgrounds');
        if (stored) {
            try {
                return JSON.parse(stored) as Record<ClientView, string | null>;
            } catch (err) {
                console.error('Failed to parse stored backgrounds', err);
            }
        }
    }
    return {
      [ClientView.HOME]: null,
      [ClientView.TFT]: null,
      [ClientView.MULTIPLAYER]: null,
      [ClientView.PROFILE]: null,
      [ClientView.INVENTORY]: null,
      [ClientView.STORE]: null,
      [ClientView.SETTINGS]: null,
      [ClientView.LOBBY]: null,
      [ClientView.MATCH_FOUND]: null,
      [ClientView.CHAMP_SELECT]: null
    };
  });
  const [resolvedBackgrounds, setResolvedBackgrounds] = useState<Record<string, string>>({});
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  // Lifted Missions State
  const [missions, setMissions] = useState<Mission[]>(() => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('missions');
        if (stored) {
            try {
                return JSON.parse(stored) as Mission[];
            } catch (err) {
                console.error('Failed to parse stored missions', err);
            }
        }
    }
    return defaultMissions;
  });

  // Reward System State
  const [rewardConfigs, setRewardConfigs] = useState<RewardConfig[]>(() => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('rewardConfigs');
        if (stored) {
            try {
                return JSON.parse(stored) as RewardConfig[];
            } catch (err) {
                console.error('Failed to parse stored reward configs', err);
            }
        }
    }
    return defaultRewardConfigs;
  });
  
  const [triggeredLevels, setTriggeredLevels] = useState<number[]>([]);
  const [activeReward, setActiveReward] = useState<RewardConfig | null>(null);
  const [activeRewardDuration, setActiveRewardDuration] = useState<number>(4000);
  const rewardStartRef = useRef<number>(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [missionAlert, setMissionAlert] = useState<Mission | null>(null);
  const [notifiedDeadlines, setNotifiedDeadlines] = useState<Record<string, number>>({});
  const priorityRank: Record<Priority, number> = {
    [Priority.HIGH]: 0,
    [Priority.MEDIUM]: 1,
    [Priority.LOW]: 2,
  };

  // Calculate Total XP (linked to Profile XP)
  const totalXP = missions.filter(m => m.completed).reduce((sum, m) => sum + (m.xp || 0), 0);
  
  // Calculate Potential XP (Negative/Required from active missions)
  const potentialXP = missions.filter(m => !m.completed).reduce((sum, m) => sum + (m.xp || 0), 0);
  
  const activeMissionsCount = missions.filter(m => !m.completed).length;
  const rewardDismissTimer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('rewardConfigs', JSON.stringify(rewardConfigs));
    }
  }, [rewardConfigs]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('missions', JSON.stringify(missions));
    }
  }, [missions]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem('viewBackgrounds', JSON.stringify(viewBackgrounds));
        } catch (err) {
            console.error('Failed to persist backgrounds', err);
        }
    }
  }, [viewBackgrounds]);

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

  // Prune notified deadlines for removed missions
  useEffect(() => {
    setNotifiedDeadlines(prev => {
        const next: Record<string, number> = {};
        missions.forEach(m => {
            if (prev[m.id] !== undefined) next[m.id] = prev[m.id];
        });
        return next;
    });
  }, [missions]);

  // Mission deadline monitor
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const dueMissions = missions
        .filter(m => {
          if (m.completed) return false;
          if (m.deadline > now) return false;
          const lastNotifiedAt = notifiedDeadlines[m.id];
          return lastNotifiedAt === undefined || lastNotifiedAt !== m.deadline;
        })
        .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

      const dueMission = dueMissions[0];
      if (dueMission) {
        setMissionAlert(dueMission);
        setNotifiedDeadlines(prev => ({ ...prev, [dueMission.id]: dueMission.deadline }));
        playMatchFoundSound();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [missions, notifiedDeadlines]);

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
    return { backgroundImage: 'none', backgroundColor: '#f5f6f8' };
  };

  const handlePlayClick = () => {
     if (currentView !== ClientView.LOBBY && currentView !== ClientView.CHAMP_SELECT && currentView !== ClientView.MATCH_FOUND) {
         setPreviousView(currentView);
         setCurrentView(ClientView.LOBBY);
         setCustomBackground(null);
     }
  };

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
        return <Home />;
      case ClientView.TFT:
        return <Earth />;
      case ClientView.MULTIPLAYER:
        return <Multiplayer />;
      case ClientView.PROFILE:
        return <Profile missions={missions} rewardConfigs={rewardConfigs} />;
      case ClientView.INVENTORY:
        return <Inventory />;
      case ClientView.SETTINGS:
        return <Settings rewardConfigs={rewardConfigs} onUpdateConfig={updateRewardConfig} currentXP={totalXP} />;
      case ClientView.LOBBY:
      case ClientView.MATCH_FOUND:
      case ClientView.CHAMP_SELECT:
        return <Lobby onBack={() => setCurrentView(previousView)} setBackground={setCustomBackground} />;
      default:
        return (
            <div className="flex items-center justify-center h-full text-[#5B5A56] flex-col">
                <div className="w-20 h-20 border border-[#3C3C41] border-dashed rounded-full flex items-center justify-center animate-spin-slow mb-4">
                    <div className="w-16 h-16 border border-[#C8AA6E] rounded-full opacity-20"></div>
                </div>
                <div className="text-4xl font-bold mb-2 opacity-30 tracking-widest uppercase">Under Construction</div>
                <div className="text-sm text-[#A09B8C]">This section of the hextech network is currently offline.</div>
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

  const isLobbyMode = currentView === ClientView.LOBBY || currentView === ClientView.CHAMP_SELECT || currentView === ClientView.MATCH_FOUND;

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

  return (
    <div 
        className="w-screen h-screen flex flex-col overflow-hidden text-[#111] font-mono bg-cover bg-center transition-all duration-200 ease-out relative"
        style={getBackgroundStyle()}
    >
      
      {missionAlert && (
        <div 
          className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center"
          onClick={() => setMissionAlert(null)}
        >
          <div 
            className="relative bg-white border border-[#ddd] p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-[0.25em] text-[#c24141]">Mission Alert</div>
              <button 
                className="text-[#666] hover:text-black transition-colors"
                onClick={() => { playClickSound(); setMissionAlert(null); }}
              >
                ✕
              </button>
            </div>
            <div className="text-xl font-bold text-black mb-1">{missionAlert.title}</div>
            <div className="text-sm text-[#555] uppercase flex items-center gap-2">
              <span>Deadline reached</span>
              <span className="px-2 py-1 border border-[#c24141] text-[#c24141] text-[10px] uppercase tracking-[0.2em]">
                {missionAlert.priority} Priority
              </span>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button 
                className="px-4 py-2 text-xs uppercase tracking-[0.2em] border border-[#ddd] text-[#444] hover:border-black hover:text-black transition-colors"
                onClick={() => setMissionAlert(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Top Navigation */}
      <TopBar 
        currentView={currentView} 
        onChangeView={(view) => {
            if (!isLobbyMode) {
                setCurrentView(view);
                setCustomBackground(null);
            }
        }}
        onPlayClick={handlePlayClick}
        onToggleAssistant={() => setIsAssistantOpen(!isAssistantOpen)}
        isAssistantOpen={isAssistantOpen}
        activeMissionsCount={activeMissionsCount}
        totalXP={totalXP}
        potentialXP={potentialXP}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Center Viewport */}
        <div className="flex-1 relative transition-all duration-300 bg-transparent">
            {renderContent()}
        </div>
      </div>

      {/* Hextech Assistant Overlay */}
      <HextechAssistant 
        isOpen={isAssistantOpen} 
        onClose={() => setIsAssistantOpen(false)} 
        missions={missions}
        setMissions={setMissions}
      />

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

      {/* Background upload button */}
      <button 
        className="fixed bottom-4 right-4 z-[150] bg-white border border-[#ccc] text-xs uppercase tracking-[0.2em] px-4 py-2 hover:border-black transition-colors"
        onClick={() => backgroundInputRef.current?.click()}
      >
        Set Background
      </button>
      <input 
        type="file" 
        accept="image/png,image/jpeg" 
        ref={backgroundInputRef} 
        className="hidden" 
        onChange={handleBackgroundUpload}
      />

      {/* Global decorative border bottom */}
      <div className="h-0.5 bg-gradient-to-r from-[#010A13] via-[#C8AA6E] to-[#010A13] opacity-30 z-50"></div>
    </div>
  );
};

export default App;
