
import React, { useState, useEffect } from 'react';
import { RewardConfig } from '../../types';
import { HexPanel } from '../UI/HextechUI';
import { Settings as SettingsIcon, Activity, Upload, CheckCircle, ChevronDown, Monitor, Shield } from 'lucide-react';
import { playClickSound, playPanelOpenSound, playHoverSound } from '../../utils/SoundEffects';
import { readFileAsDataUrl } from '../../utils/fileUtils';
import { useAuth } from '../../src/auth/AuthProvider';
import { readUserScopedString, writeUserScopedString } from '../../src/lib/userScopedStorage';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ThemeSwitcher } from '../UI/ThemeSwitcher';

interface SettingsProps {
    rewardConfigs: RewardConfig[];
    onUpdateConfig: (config: RewardConfig) => void;
    currentXP: number;
}

export const Settings: React.FC<SettingsProps> = ({ rewardConfigs, onUpdateConfig, currentXP }) => {
  const { user } = useAuth();
  const { theme, options, accent, setAccent, accentOptions, resolution, setResolution, resolutionOptions } = useTheme();
  const activeUserId = user?.id || null;
  const activeThemeLabel = options.find((option) => option.value === theme)?.label ?? theme;
  const activeAccentLabel = accentOptions.find((option) => option.value === accent)?.label ?? accent;
  const activeResolutionLabel = resolutionOptions.find((option) => option.value === resolution)?.label ?? resolution;
    
  const [isProtocolExpanded, setIsProtocolExpanded] = useState(false);
  const [isDisplayExpanded, setIsDisplayExpanded] = useState(false);
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(false);

  type DensityOption = 'compact' | 'comfortable' | 'spacious';
  type VisibilityOption = 'private' | 'circles' | 'community';
  type PresenceOption = 'active' | 'hidden';

  const [density, setDensityState] = useState<DensityOption>('comfortable');
  const [reduceMotion, setReduceMotionState] = useState(false);
  const [defaultVisibility, setDefaultVisibilityState] = useState<VisibilityOption>('private');
  const [mpPresence, setMpPresenceState] = useState<PresenceOption>('active');

  // Init display settings from plain localStorage (device-level preferences)
  useEffect(() => {
    const storedDensity = localStorage.getItem('xtation_density');
    if (storedDensity === 'compact' || storedDensity === 'spacious') {
      setDensityState(storedDensity);
      document.documentElement.dataset.density = storedDensity;
    }
    const storedMotion = localStorage.getItem('xtation_motion');
    if (storedMotion === 'reduced') {
      setReduceMotionState(true);
      document.documentElement.dataset.motion = 'reduced';
    }
  }, []);

  // Init privacy settings from user-scoped storage
  useEffect(() => {
    if (!activeUserId) return;
    const visRaw = readUserScopedString('defaultTaskVisibility', 'private', activeUserId);
    if (visRaw === 'circles' || visRaw === 'community') setDefaultVisibilityState(visRaw);
    const presenceRaw = readUserScopedString('mpPresenceMode', 'active', activeUserId);
    if (presenceRaw === 'hidden') setMpPresenceState('hidden');
  }, [activeUserId]);

  const applyDensity = (next: DensityOption) => {
    setDensityState(next);
    localStorage.setItem('xtation_density', next);
    document.documentElement.dataset.density = next;
  };

  const applyMotion = (reduced: boolean) => {
    setReduceMotionState(reduced);
    localStorage.setItem('xtation_motion', reduced ? 'reduced' : 'normal');
    if (reduced) {
      document.documentElement.dataset.motion = 'reduced';
    } else {
      delete document.documentElement.dataset.motion;
    }
  };

  const applyDefaultVisibility = (next: VisibilityOption) => {
    setDefaultVisibilityState(next);
    if (activeUserId) writeUserScopedString('defaultTaskVisibility', next, activeUserId);
  };

  const applyMpPresence = (next: PresenceOption) => {
    setMpPresenceState(next);
    if (activeUserId) writeUserScopedString('mpPresenceMode', next, activeUserId);
  };

    const [resolvedVisuals, setResolvedVisuals] = useState<Record<number, string>>({});

    const openVisualDB = () => new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('RewardVisualDB', 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('visuals')) {
                db.createObjectStore('visuals');
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    const saveVisualToDB = async (level: number, file: File) => {
        const db = await openVisualDB();
        const tx = db.transaction('visuals', 'readwrite');
        tx.objectStore('visuals').put(file, `visual-${level}`);
        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(null);
            tx.onerror = () => reject(tx.error);
        });
        const url = URL.createObjectURL(file);
        setResolvedVisuals(prev => ({ ...prev, [level]: url }));
        return `idb:${level}`;
    };

    const loadVisualFromDB = async (level: number) => {
        try {
            const db = await openVisualDB();
            const tx = db.transaction('visuals', 'readonly');
            const req = tx.objectStore('visuals').get(`visual-${level}`);
            const blob: Blob | undefined = await new Promise((resolve, reject) => {
                req.onsuccess = () => resolve(req.result as Blob | undefined);
                req.onerror = () => reject(req.error);
            });
            if (blob) {
                const url = URL.createObjectURL(blob);
                setResolvedVisuals(prev => ({ ...prev, [level]: url }));
            }
        } catch (err) {
            console.error('Failed to load visual from DB', err);
        }
    };

    useEffect(() => {
        rewardConfigs.forEach(config => {
            if (config.customVisualUrl?.startsWith('idb:') && !resolvedVisuals[config.level]) {
                loadVisualFromDB(config.level);
            }
        });
    }, [rewardConfigs, resolvedVisuals]);

    const handleThresholdChange = (level: number, val: string) => {
        const num = parseInt(val) || 0;
        const config = rewardConfigs.find(r => r.level === level);
        if (config) {
            onUpdateConfig({ ...config, threshold: num });
        }
    };

    const handleFileUpload = async (level: number, type: 'visual' | 'audio', e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const config = rewardConfigs.find(r => r.level === level);
        if (!config) return;

        playClickSound();

        try {
            const isVideo = file.type.startsWith('video');
            const dataUrl = await readFileAsDataUrl(file);
            const approxSize = dataUrl.length * 0.75;
            const localLimit = 4.5 * 1024 * 1024;
            let storedUrl = dataUrl;

            if (approxSize > localLimit) {
                storedUrl = await saveVisualToDB(level, file);
            } else {
                // Save inline to avoid object URL persistence issues
                writeUserScopedString(`rewardVisual-${level}`, storedUrl, activeUserId);
                // Clear any DB ref if switching back
                setResolvedVisuals(prev => {
                    if (prev[level]) {
                        URL.revokeObjectURL(prev[level]);
                        const next = { ...prev };
                        delete next[level];
                        return next;
                    }
                    return prev;
                });
            }

            onUpdateConfig({ 
                ...config, 
                animation: 'CUSTOM', 
                customVisualUrl: storedUrl,
                customVisualType: isVideo ? 'video' : 'image'
            });
        } catch (err) {
            console.error('Failed to load custom asset', err);
        } finally {
            e.target.value = '';
        }
    };

    const toggleProtocol = () => {
        if (!isProtocolExpanded) {
            playPanelOpenSound();
        } else {
            playClickSound();
        }
        setIsProtocolExpanded(!isProtocolExpanded);
    };

    return (
        <div className="p-8 h-full overflow-y-auto custom-scrollbar">
            <div className="mb-8 border-b border-[var(--app-border)] pb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-4 border border-[var(--app-border)] bg-[var(--app-panel-2)]">
                        <SettingsIcon size={32} className="text-[var(--app-text)]" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-[var(--app-text)] uppercase tracking-tighter">System Configuration</h1>
                        <p className="text-[var(--app-muted)] font-mono tracking-widest text-xs">CUSTOMIZE REWARD PROTOCOLS</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-[var(--app-muted)] uppercase font-bold tracking-widest">Current Profile XP</div>
                    <div className="text-3xl font-black text-[var(--app-accent)] font-mono">{currentXP} XP</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <HexPanel className="transition-all duration-300">
                    <div className="p-6 border-b border-[var(--app-border)]">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-xl font-bold text-[var(--app-text)] uppercase tracking-widest">Theme System</h2>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Current: {activeThemeLabel}</div>
                        </div>
                        <p className="mt-2 text-[11px] text-[var(--app-muted)] uppercase tracking-[0.16em]">Global theme applies instantly across all views.</p>
                    </div>
                    <div className="p-6 space-y-5">
                        <ThemeSwitcher />
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Accent</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{activeAccentLabel}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {accentOptions.map((option) => {
                                    const selected = option.value === accent;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setAccent(option.value)}
                                            className={`ui-pressable rounded-[var(--app-radius-sm)] border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                                selected
                                                    ? 'border-[var(--app-accent)] bg-[var(--app-accent-weak)] text-[var(--app-text)]'
                                                    : 'border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
                                            }`}
                                            aria-pressed={selected}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </HexPanel>

                <HexPanel className="transition-all duration-300">
                    <div 
                        onClick={toggleProtocol}
                        onMouseEnter={playHoverSound}
                        className="flex items-center justify-between p-6 cursor-pointer hover:bg-[color-mix(in_srgb,var(--app-text)_5%,transparent)] transition-colors group"
                    >
                         <h2 className="text-xl font-bold text-[var(--app-text)] uppercase tracking-widest flex items-center gap-2 group-hover:text-[var(--app-accent)] transition-colors">
                            <Activity className="text-[var(--app-accent)]" />
                            XP Reward Protocol
                         </h2>
                         <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-[var(--app-accent)] animate-pulse"></div>
                                <div className="text-xs text-[var(--app-muted)] font-mono group-hover:text-[var(--app-text)] transition-colors">LIVE SYNC ACTIVE</div>
                            </div>
                            <div className={`transition-transform duration-300 ${isProtocolExpanded ? 'rotate-180' : ''}`}>
                                <ChevronDown className="text-[var(--app-muted)] group-hover:text-[var(--app-text)]" />
                            </div>
                         </div>
                    </div>

                    {isProtocolExpanded && (
                        <div className="px-6 pb-6 space-y-4 animate-fade-in border-t border-[var(--app-border)] pt-4">
                            {rewardConfigs.map((config) => {
                                const isAchieved = currentXP >= config.threshold;
                                const progressPercent = Math.min(100, Math.max(0, (currentXP / config.threshold) * 100));

                                return (
                                    <div 
                                        key={config.level} 
                                        className={`
                                            grid grid-cols-1 md:grid-cols-12 gap-4 items-start p-4 border transition-colors group relative overflow-hidden
                                            ${isAchieved ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_5%,transparent)]' : 'border-[var(--app-border)] bg-[var(--app-panel)] hover:border-[var(--app-muted)]'}
                                        `}
                                    >
                                        {/* Achieved Watermark */}
                                        {isAchieved && (
                                            <div className="absolute top-0 right-0 p-2 opacity-20 pointer-events-none">
                                                <CheckCircle size={64} className="text-[var(--app-accent)]" />
                                            </div>
                                        )}
                                        
                                        {/* Level Label */}
                                        <div className="md:col-span-1 text-center pt-2 relative z-10">
                                            <div className="text-[10px] text-[var(--app-muted)] uppercase font-bold mb-1">Level</div>
                                            <div className={`text-2xl font-black ${isAchieved ? 'text-[var(--app-accent)]' : 'text-[var(--app-text)]'}`}>
                                                0{config.level}
                                            </div>
                                            {isAchieved ? (
                                                <div className="mt-1 text-[8px] font-bold text-[var(--app-accent)] border border-[var(--app-accent)] px-1 inline-block">ACQUIRED</div>
                                            ) : (
                                                <div className="mt-1 text-[8px] font-bold text-[var(--app-muted)] border border-[var(--app-border)] px-1 inline-block">LOCKED</div>
                                            )}
                                        </div>

                                        {/* Threshold Input & Progress */}
                                        <div className="md:col-span-2 relative z-10">
                                            <label className="text-[10px] text-[var(--app-muted)] uppercase font-bold block mb-1">XP Threshold</label>
                                            <div className="relative mb-2">
                                                <input 
                                                    type="number" 
                                                    value={config.threshold}
                                                    onChange={(e) => handleThresholdChange(config.level, e.target.value)}
                                                    className={`w-full bg-[var(--app-bg)] border p-2 text-[var(--app-text)] font-mono outline-none transition-colors ${isAchieved ? 'border-[var(--app-accent)] text-[var(--app-accent)]' : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'}`}
                                                />
                                                <div className="absolute right-2 top-2 text-[var(--app-muted)] text-xs font-bold">XP</div>
                                            </div>
                                            
                                            {/* Progress Bar */}
                                            <div className="w-full h-20 bg-[var(--app-panel-2)] border border-[var(--app-border)] relative overflow-hidden rounded-sm">
                                                {/* Visual preview */}
                                                <div className="absolute inset-0 opacity-80">
                                                    {(() => {
                                                        const visualUrl = config.customVisualUrl?.startsWith('idb:')
                                                            ? resolvedVisuals[config.level]
                                                            : config.customVisualUrl;
                                                        if (visualUrl) {
                                                            if (config.customVisualType === 'video') {
                                                                return (
                                                                    <video 
                                                                        key={visualUrl}
                                                                        src={visualUrl} 
                                                                        className="w-full h-full object-cover"
                                                                        autoPlay 
                                                                        loop 
                                                                        muted 
                                                                        playsInline 
                                                                    />
                                                                );
                                                            }
                                                            return <img src={visualUrl} className="w-full h-full object-cover" />;
                                                        }
                                                        return (
                                                            <div className="w-full h-full bg-gradient-to-r from-[var(--app-panel)] via-[var(--app-panel-2)] to-[var(--app-panel-2)] flex items-center px-3 text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">
                                                                Custom Visual Preview
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                {/* Progress bar overlay at bottom */}
                                                <div className="absolute bottom-0 left-0 right-0 h-2 bg-[color-mix(in_srgb,var(--app-bg)_40%,transparent)] border-t border-[var(--app-border)]">
                                                    <div 
                                                        className={`h-full transition-all duration-500 ${isAchieved ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-muted)]'}`} 
                                                        style={{ width: `${progressPercent}%` }}
                                                    ></div>
                                                </div>
                                                <div className="absolute inset-0 pointer-events-none border border-[color-mix(in_srgb,var(--app-border)_60%,transparent)]"></div>
                                            </div>
                                            <div className="flex justify-between mt-1 text-[8px] font-mono text-[var(--app-muted)]">
                                                <span>{currentXP} / {config.threshold}</span>
                                                <span>{Math.floor(progressPercent)}%</span>
                                            </div>
                                        </div>

                                        {/* Animation Selector & Upload */}
                                        <div className="md:col-span-6 relative z-10 flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] text-[var(--app-muted)] uppercase font-bold">Visual Effect</label>
                                                <label className="cursor-pointer flex items-center gap-1 text-[8px] uppercase text-[var(--app-accent)] hover:text-[var(--app-text)] transition-colors border border-[var(--app-border)] px-2 py-0.5 hover:border-[var(--app-accent)]">
                                                    <Upload size={8} /> Upload Visual
                                                    <input 
                                                        type="file" 
                                                        accept="image/gif,image/png,image/jpeg,video/mp4,video/webm"
                                                        className="hidden" 
                                                        onChange={(e) => handleFileUpload(config.level, 'visual', e)}
                                                    />
                                                </label>
                                            </div>
                                            {config.animation === 'CUSTOM' && (
                                                <div className="text-[9px] text-[var(--app-muted)] truncate max-w-full bg-[var(--app-panel-2)] px-2 py-1 border border-[var(--app-border)]">
                                                    {config.customVisualUrl ? 'SRC: Custom Visual Loaded' : 'Upload a visual'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </HexPanel>

                {/* Display Settings */}
                <HexPanel className="transition-all duration-300">
                    <div
                        onClick={() => {
                            if (!isDisplayExpanded) playPanelOpenSound(); else playClickSound();
                            setIsDisplayExpanded(!isDisplayExpanded);
                        }}
                        onMouseEnter={playHoverSound}
                        className="flex items-center justify-between p-6 cursor-pointer hover:bg-[color-mix(in_srgb,var(--app-text)_5%,transparent)] transition-colors group"
                    >
                        <h2 className="text-xl font-bold text-[var(--app-text)] uppercase tracking-widest flex items-center gap-2 group-hover:text-[var(--app-accent)] transition-colors">
                            <Monitor className="text-[var(--app-accent)]" />
                            Display
                        </h2>
                        <div className={`transition-transform duration-300 ${isDisplayExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown className="text-[var(--app-muted)] group-hover:text-[var(--app-text)]" />
                        </div>
                    </div>

                    {isDisplayExpanded && (
                        <div className="px-6 pb-6 space-y-6 animate-fade-in border-t border-[var(--app-border)] pt-5">
                            {/* Resolution Mode */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Resolution Mode</span>
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{activeResolutionLabel}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {resolutionOptions.map((option) => {
                                        const selected = resolution === option.value;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setResolution(option.value)}
                                                className={`ui-pressable rounded-[var(--app-radius-sm)] border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                                                    selected
                                                        ? 'border-[var(--app-accent)] bg-[var(--app-accent-weak)] text-[var(--app-text)]'
                                                        : 'border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
                                                }`}
                                                aria-pressed={selected}
                                            >
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-[var(--app-muted)] uppercase tracking-[0.14em]">
                                    Changes global workspace scale to keep layouts readable on different screen sizes.
                                </p>
                            </div>

                            {/* Density */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">UI Density</span>
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{density}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(['compact', 'comfortable', 'spacious'] as const).map((option) => {
                                        const selected = density === option;
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => applyDensity(option)}
                                                className={`ui-pressable rounded-[var(--app-radius-sm)] border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                                    selected
                                                        ? 'border-[var(--app-accent)] bg-[var(--app-accent-weak)] text-[var(--app-text)]'
                                                        : 'border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
                                                }`}
                                                aria-pressed={selected}
                                            >
                                                {option}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-[var(--app-muted)] uppercase tracking-[0.14em]">
                                    Compact tightens spacing throughout the interface.
                                </p>
                            </div>

                            {/* Reduce Motion */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Reduce Motion</div>
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] mt-0.5">
                                            Disables transitions and animations system-wide.
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => applyMotion(!reduceMotion)}
                                        className={`ui-pressable shrink-0 rounded-[var(--app-radius-sm)] border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-colors ${
                                            reduceMotion
                                                ? 'border-[var(--app-accent)] bg-[var(--app-accent-weak)] text-[var(--app-text)]'
                                                : 'border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
                                        }`}
                                        aria-pressed={reduceMotion}
                                    >
                                        {reduceMotion ? 'On' : 'Off'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </HexPanel>

                {/* Privacy Settings */}
                <HexPanel className="transition-all duration-300">
                    <div
                        onClick={() => {
                            if (!isPrivacyExpanded) playPanelOpenSound(); else playClickSound();
                            setIsPrivacyExpanded(!isPrivacyExpanded);
                        }}
                        onMouseEnter={playHoverSound}
                        className="flex items-center justify-between p-6 cursor-pointer hover:bg-[color-mix(in_srgb,var(--app-text)_5%,transparent)] transition-colors group"
                    >
                        <h2 className="text-xl font-bold text-[var(--app-text)] uppercase tracking-widest flex items-center gap-2 group-hover:text-[var(--app-accent)] transition-colors">
                            <Shield className="text-[var(--app-accent)]" />
                            Privacy
                        </h2>
                        <div className={`transition-transform duration-300 ${isPrivacyExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown className="text-[var(--app-muted)] group-hover:text-[var(--app-text)]" />
                        </div>
                    </div>

                    {isPrivacyExpanded && (
                        <div className="px-6 pb-6 space-y-6 animate-fade-in border-t border-[var(--app-border)] pt-5">
                            {/* Default task visibility */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Default Task Visibility</span>
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">{defaultVisibility}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(['private', 'circles', 'community'] as const).map((option) => {
                                        const selected = defaultVisibility === option;
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => applyDefaultVisibility(option)}
                                                disabled={!activeUserId}
                                                className={`ui-pressable rounded-[var(--app-radius-sm)] border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] disabled:opacity-50 disabled:cursor-not-allowed ${
                                                    selected
                                                        ? 'border-[var(--app-accent)] bg-[var(--app-accent-weak)] text-[var(--app-text)]'
                                                        : 'border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
                                                }`}
                                                aria-pressed={selected}
                                            >
                                                {option}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-[var(--app-muted)] uppercase tracking-[0.14em]">
                                    {!activeUserId
                                        ? 'Sign in to save privacy preferences.'
                                        : 'New tasks will default to this visibility level.'}
                                </p>
                            </div>

                            {/* Multiplayer presence */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Multiplayer Presence</div>
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)] mt-0.5">
                                            Whether others can see you as online in the squad view.
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        {(['active', 'hidden'] as const).map((option) => {
                                            const selected = mpPresence === option;
                                            return (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    onClick={() => applyMpPresence(option)}
                                                    disabled={!activeUserId}
                                                    className={`ui-pressable rounded-[var(--app-radius-sm)] border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] disabled:opacity-50 disabled:cursor-not-allowed ${
                                                        selected
                                                            ? 'border-[var(--app-accent)] bg-[var(--app-accent-weak)] text-[var(--app-text)]'
                                                            : 'border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
                                                    }`}
                                                    aria-pressed={selected}
                                                >
                                                    {option}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </HexPanel>

            </div>
        </div>
    );
};
