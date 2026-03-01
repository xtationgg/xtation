
import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from './components/Layout/TopBar';
import { Home } from './components/Views/Home';
import { Profile } from './components/Views/Profile';
import { Lobby } from './components/Views/Lobby';
import { Settings } from './components/Views/Settings';
import { Inventory } from './components/Views/Inventory';
import { Multiplayer } from './components/Views/Multiplayer';
import { HextechAssistant } from './components/Features/HextechAssistant';
import { TerminalErrorBoundary } from './components/UI/TerminalErrorBoundary';
import { RewardOverlay } from './components/Features/RewardOverlay';
import { ChatDock } from './components/Chat';
import { AuthCallbackView } from './components/Auth/AuthCallbackView';
import { ResetPasswordView } from './components/Auth/ResetPasswordView';
import { Earth } from './components/Views/Earth';
import { UiKitPlayground } from './components/Views/UiKitPlayground';
import { ClientView, RewardConfig } from './types';
import { ASSETS } from './constants';
import { playClickSound } from './utils/SoundEffects';
import { readFileAsDataUrl } from './utils/fileUtils';
import { useXP } from './components/XP/xpStore';
import { ScheduledTaskPrompt } from './components/XP/ScheduledTaskPrompt';
import { DevHUD } from './src/dev/DevHUD';
import { useAuth } from './src/auth/AuthProvider';
import { CommandPalette } from './components/UI/CommandPalette';
import {
  readUserScopedJSON,
  setActiveUserId,
  writeUserScopedJSON,
  writeUserScopedString,
} from './src/lib/userScopedStorage';

const defaultRewardConfigs: RewardConfig[] = [
  { level: 1, threshold: 100, animation: 'CYBER_PULSE', sound: 'LEVEL_UP' },
  { level: 2, threshold: 250, animation: 'GOLDEN_HEX', sound: 'CHIME' },
  { level: 3, threshold: 500, animation: 'GLITCH_STORM', sound: 'TECH_POWER' },
  { level: 4, threshold: 1000, animation: 'ORBITAL_STRIKE', sound: 'ALARM' },
  { level: 5, threshold: 2000, animation: 'NEON_BURST', sound: 'BASS_DROP' },
];

const defaultViewBackgrounds: Record<ClientView, string | null> = {
  [ClientView.HOME]: null,
  [ClientView.TFT]: null,
  [ClientView.MULTIPLAYER]: null,
  [ClientView.PROFILE]: null,
  [ClientView.INVENTORY]: null,
  [ClientView.STORE]: null,
  [ClientView.UI_KIT]: null,
  [ClientView.SETTINGS]: null,
  [ClientView.LOBBY]: null,
  [ClientView.MATCH_FOUND]: null,
  [ClientView.CHAMP_SELECT]: null,
};

const App: React.FC = () => {
  const currentPath = window.location.pathname;
  const { user, loading: authLoading } = useAuth();
  const activeUserId = user?.id || null;
  const userScopeRenderKey = activeUserId || 'signedOut';

  const [currentView, setCurrentView] = useState<ClientView>(ClientView.HOME);
  const [previousView, setPreviousView] = useState<ClientView>(ClientView.HOME);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  
  // New State for dynamic background (e.g., Champ Select splash art)
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [viewBackgrounds, setViewBackgrounds] = useState<Record<ClientView, string | null>>(defaultViewBackgrounds);
  const [resolvedBackgrounds, setResolvedBackgrounds] = useState<Record<string, string>>({});
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const { tasks, stats, selectors } = useXP();

  // Reward System State
  const [rewardConfigs, setRewardConfigs] = useState<RewardConfig[]>(defaultRewardConfigs);
  
  const [triggeredLevels, setTriggeredLevels] = useState<number[]>([]);
  const [activeReward, setActiveReward] = useState<RewardConfig | null>(null);
  const [activeRewardDuration, setActiveRewardDuration] = useState<number>(4000);
  const rewardStartRef = useRef<number>(0);
  const [hasInitialized, setHasInitialized] = useState(false);

  const totalXP = stats.totalEarnedXP;
  const activeTasksCount = selectors.getActiveTasks().length;
  const rewardDismissTimer = useRef<number | null>(null);
  const isResetPasswordRoute = currentPath === '/reset-password';
  const isAuthCallbackRoute = currentPath === '/auth/callback';

  useEffect(() => {
    if (authLoading) return;
    setActiveUserId(activeUserId);
    setCustomBackground(null);
    setResolvedBackgrounds({});
    setActiveReward(null);
    setTriggeredLevels([]);
    setHasInitialized(false);

    if (!activeUserId) {
      setRewardConfigs(defaultRewardConfigs);
      setViewBackgrounds(defaultViewBackgrounds);
      return;
    }

    const storedRewardConfigs = readUserScopedJSON<RewardConfig[]>('rewardConfigs', defaultRewardConfigs, activeUserId);
    setRewardConfigs(Array.isArray(storedRewardConfigs) && storedRewardConfigs.length ? storedRewardConfigs : defaultRewardConfigs);

    const storedBackgrounds = readUserScopedJSON<Record<ClientView, string | null>>(
      'viewBackgrounds',
      defaultViewBackgrounds,
      activeUserId
    );
    setViewBackgrounds({
      ...defaultViewBackgrounds,
      ...(storedBackgrounds || {}),
    });
  }, [authLoading, activeUserId]);

  useEffect(() => {
    if (!activeUserId) return;
    writeUserScopedJSON('rewardConfigs', rewardConfigs, activeUserId);
  }, [rewardConfigs, activeUserId]);

  useEffect(() => {
    if (!activeUserId) return;
    try {
      writeUserScopedJSON('viewBackgrounds', viewBackgrounds, activeUserId);
    } catch (err) {
      console.error('Failed to persist backgrounds', err);
    }
  }, [viewBackgrounds, activeUserId]);

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
    return { backgroundImage: 'none', backgroundColor: 'var(--ui-bg)' };
  };

  const handlePlayClick = () => {
     if (currentView !== ClientView.LOBBY && currentView !== ClientView.CHAMP_SELECT && currentView !== ClientView.MATCH_FOUND) {
         setPreviousView(currentView);
         setCurrentView(ClientView.LOBBY);
         setCustomBackground(null);
     }
  };

  useEffect(() => {
    const handleOpenPlayer = (event: Event) => {
      const detail = (event as CustomEvent<{ playerId?: string }>).detail;
      if (!detail?.playerId) return;
      writeUserScopedString('mp_focusPlayerId', detail.playerId, activeUserId);
      if (currentView !== ClientView.MULTIPLAYER) {
        setPreviousView(currentView);
        setCurrentView(ClientView.MULTIPLAYER);
      }
    };

    window.addEventListener('dusk:openPlayerDossier', handleOpenPlayer as EventListener);
    return () => window.removeEventListener('dusk:openPlayerDossier', handleOpenPlayer as EventListener);
  }, [activeUserId, currentView]);

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
        return <Profile rewardConfigs={rewardConfigs} />;
      case ClientView.INVENTORY:
        return <Inventory />;
      case ClientView.UI_KIT:
        return <UiKitPlayground />;
      case ClientView.SETTINGS:
        return <Settings rewardConfigs={rewardConfigs} onUpdateConfig={updateRewardConfig} currentXP={totalXP} />;
      case ClientView.LOBBY:
      case ClientView.MATCH_FOUND:
      case ClientView.CHAMP_SELECT:
        return (
          <Lobby
            onBack={() => setCurrentView(previousView)}
            setBackground={setCustomBackground}
            onNavigateStage={(view) => {
              // keep App route synced so TopBar lock + background behave consistently
              setCurrentView(view);
            }}
          />
        );
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

  if (isAuthCallbackRoute) {
    return <AuthCallbackView />;
  }

  if (isResetPasswordRoute) {
    return <ResetPasswordView />;
  }

  return (
    <div 
        className="w-full min-h-[100dvh] md:h-screen flex flex-col overflow-x-hidden overflow-y-auto md:overflow-hidden text-[var(--ui-text)] font-mono bg-cover bg-center transition-all duration-200 ease-out relative"
        style={getBackgroundStyle()}
    >
      <ScheduledTaskPrompt />
      
      {/* Top Navigation */}
      <TopBar
        currentView={currentView}
        onChangeView={(view) => {
            setCurrentView(view);
            setCustomBackground(null);
        }}
        onPlayClick={handlePlayClick}
        onToggleAssistant={() => setIsAssistantOpen(!isAssistantOpen)}
        isAssistantOpen={isAssistantOpen}
        activeTasksCount={activeTasksCount}
        onOpenPalette={() => setIsPaletteOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex overflow-x-hidden overflow-y-auto md:overflow-hidden relative z-10">
        
        {/* Center Viewport */}
        <div key={`viewport-${userScopeRenderKey}`} className="flex-1 min-h-0 relative overflow-y-auto md:overflow-hidden transition-all duration-300 bg-transparent">
            {renderContent()}
        </div>
      </div>

      <ChatDock key={`chat-${userScopeRenderKey}`} />

      {/* Hextech Assistant Overlay */}
      <TerminalErrorBoundary key={`${userScopeRenderKey}-${isAssistantOpen ? 'assistant-open' : 'assistant-closed'}`}>
        <HextechAssistant
          key={`assistant-${userScopeRenderKey}`}
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
        />
      </TerminalErrorBoundary>

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

      <CommandPalette
        open={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onChangeView={(view) => {
          setCurrentView(view);
          setCustomBackground(null);
        }}
        onToggleAssistant={() => setIsAssistantOpen((prev) => !prev)}
      />

      <DevHUD />

            {/* Global decorative border bottom */}
      <div className="h-0.5 bg-gradient-to-r from-[#010A13] via-[#C8AA6E] to-[#010A13] opacity-30 z-50"></div>
    </div>
  );
};

export default App;
