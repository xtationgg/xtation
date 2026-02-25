
import React, { useState, useEffect } from 'react';
import { RewardConfig } from '../../types';
import { HexPanel } from '../UI/HextechUI';
import { Settings as SettingsIcon, Activity, Upload, CheckCircle, ChevronDown } from 'lucide-react';
import { playClickSound, playPanelOpenSound, playHoverSound } from '../../utils/SoundEffects';
import { readFileAsDataUrl } from '../../utils/fileUtils';
import { useAuth } from '../../src/auth/AuthProvider';
import { writeUserScopedString } from '../../src/lib/userScopedStorage';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ThemeSwitcher } from '../UI/ThemeSwitcher';

interface SettingsProps {
    rewardConfigs: RewardConfig[];
    onUpdateConfig: (config: RewardConfig) => void;
    currentXP: number;
}

export const Settings: React.FC<SettingsProps> = ({ rewardConfigs, onUpdateConfig, currentXP }) => {
  const { user } = useAuth();
  const { theme, options } = useTheme();
  const activeUserId = user?.id || null;
  const activeThemeLabel = options.find((option) => option.value === theme)?.label ?? theme;
    
  const [isProtocolExpanded, setIsProtocolExpanded] = useState(false);

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
            <div className="mb-8 border-b border-[var(--t-border)] pb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-4 border border-[var(--t-text)] bg-[var(--t-panel-2)]">
                        <SettingsIcon size={32} className="text-[var(--t-text)]" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-[var(--t-text)] uppercase tracking-tighter">System Configuration</h1>
                        <p className="text-[var(--t-muted)] font-mono tracking-widest text-xs">CUSTOMIZE REWARD PROTOCOLS</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-[var(--t-muted)] uppercase font-bold tracking-widest">Current Profile XP</div>
                    <div className="text-3xl font-black text-[var(--t-accent)] font-mono">{currentXP} XP</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <HexPanel className="transition-all duration-300">
                    <div className="p-6 border-b border-[var(--t-border)]">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-xl font-bold text-[var(--t-text)] uppercase tracking-widest">Theme System</h2>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--t-muted)]">Current: {activeThemeLabel}</div>
                        </div>
                        <p className="mt-2 text-[11px] text-[var(--t-muted)] uppercase tracking-[0.16em]">Global theme applies instantly across all views.</p>
                    </div>
                    <div className="p-6">
                        <ThemeSwitcher />
                    </div>
                </HexPanel>

                <HexPanel className="transition-all duration-300">
                    <div 
                        onClick={toggleProtocol}
                        onMouseEnter={playHoverSound}
                        className="flex items-center justify-between p-6 cursor-pointer hover:bg-[color-mix(in_srgb,var(--t-text)_5%,transparent)] transition-colors group"
                    >
                         <h2 className="text-xl font-bold text-[var(--t-text)] uppercase tracking-widest flex items-center gap-2 group-hover:text-[var(--t-accent)] transition-colors">
                            <Activity className="text-[var(--t-accent)]" />
                            XP Reward Protocol
                         </h2>
                         <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-[var(--t-accent)] animate-pulse"></div>
                                <div className="text-xs text-[var(--t-muted)] font-mono group-hover:text-[var(--t-text)] transition-colors">LIVE SYNC ACTIVE</div>
                            </div>
                            <div className={`transition-transform duration-300 ${isProtocolExpanded ? 'rotate-180' : ''}`}>
                                <ChevronDown className="text-[var(--t-muted)] group-hover:text-[var(--t-text)]" />
                            </div>
                         </div>
                    </div>

                    {isProtocolExpanded && (
                        <div className="px-6 pb-6 space-y-4 animate-fade-in border-t border-[var(--t-border)] pt-4">
                            {rewardConfigs.map((config) => {
                                const isAchieved = currentXP >= config.threshold;
                                const progressPercent = Math.min(100, Math.max(0, (currentXP / config.threshold) * 100));

                                return (
                                    <div 
                                        key={config.level} 
                                        className={`
                                            grid grid-cols-1 md:grid-cols-12 gap-4 items-start p-4 border transition-colors group relative overflow-hidden
                                            ${isAchieved ? 'border-[var(--t-accent)] bg-[color-mix(in_srgb,var(--t-accent)_5%,transparent)]' : 'border-[var(--t-border)] bg-[var(--t-panel)] hover:border-[var(--t-muted)]'}
                                        `}
                                    >
                                        {/* Achieved Watermark */}
                                        {isAchieved && (
                                            <div className="absolute top-0 right-0 p-2 opacity-20 pointer-events-none">
                                                <CheckCircle size={64} className="text-[var(--t-accent)]" />
                                            </div>
                                        )}
                                        
                                        {/* Level Label */}
                                        <div className="md:col-span-1 text-center pt-2 relative z-10">
                                            <div className="text-[10px] text-[var(--t-muted)] uppercase font-bold mb-1">Level</div>
                                            <div className={`text-2xl font-black ${isAchieved ? 'text-[var(--t-accent)]' : 'text-[var(--t-text)]'}`}>
                                                0{config.level}
                                            </div>
                                            {isAchieved ? (
                                                <div className="mt-1 text-[8px] font-bold text-[var(--t-accent)] border border-[var(--t-accent)] px-1 inline-block">ACQUIRED</div>
                                            ) : (
                                                <div className="mt-1 text-[8px] font-bold text-[var(--t-muted)] border border-[var(--t-border)] px-1 inline-block">LOCKED</div>
                                            )}
                                        </div>

                                        {/* Threshold Input & Progress */}
                                        <div className="md:col-span-2 relative z-10">
                                            <label className="text-[10px] text-[var(--t-muted)] uppercase font-bold block mb-1">XP Threshold</label>
                                            <div className="relative mb-2">
                                                <input 
                                                    type="number" 
                                                    value={config.threshold}
                                                    onChange={(e) => handleThresholdChange(config.level, e.target.value)}
                                                    className={`w-full bg-[var(--t-bg)] border p-2 text-[var(--t-text)] font-mono outline-none transition-colors ${isAchieved ? 'border-[var(--t-accent)] text-[var(--t-accent)]' : 'border-[var(--t-border)] focus:border-[var(--t-accent)]'}`}
                                                />
                                                <div className="absolute right-2 top-2 text-[var(--t-muted)] text-xs font-bold">XP</div>
                                            </div>
                                            
                                            {/* Progress Bar */}
                                            <div className="w-full h-20 bg-[var(--t-panel-2)] border border-[var(--t-border)] relative overflow-hidden rounded-sm">
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
                                                            <div className="w-full h-full bg-gradient-to-r from-[var(--t-panel)] via-[var(--t-panel-2)] to-[var(--t-panel-2)] flex items-center px-3 text-[10px] uppercase tracking-[0.2em] text-[var(--t-muted)]">
                                                                Custom Visual Preview
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                {/* Progress bar overlay at bottom */}
                                                <div className="absolute bottom-0 left-0 right-0 h-2 bg-[color-mix(in_srgb,var(--t-bg)_40%,transparent)] border-t border-[var(--t-border)]">
                                                    <div 
                                                        className={`h-full transition-all duration-500 ${isAchieved ? 'bg-[var(--t-accent)]' : 'bg-[var(--t-muted)]'}`} 
                                                        style={{ width: `${progressPercent}%` }}
                                                    ></div>
                                                </div>
                                                <div className="absolute inset-0 pointer-events-none border border-[color-mix(in_srgb,var(--t-border)_60%,transparent)]"></div>
                                            </div>
                                            <div className="flex justify-between mt-1 text-[8px] font-mono text-[var(--t-muted)]">
                                                <span>{currentXP} / {config.threshold}</span>
                                                <span>{Math.floor(progressPercent)}%</span>
                                            </div>
                                        </div>

                                        {/* Animation Selector & Upload */}
                                        <div className="md:col-span-6 relative z-10 flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] text-[var(--t-muted)] uppercase font-bold">Visual Effect</label>
                                                <label className="cursor-pointer flex items-center gap-1 text-[8px] uppercase text-[var(--t-accent)] hover:text-[var(--t-text)] transition-colors border border-[var(--t-border)] px-2 py-0.5 hover:border-[var(--t-accent)]">
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
                                                <div className="text-[9px] text-[var(--t-muted)] truncate max-w-full bg-[var(--t-panel-2)] px-2 py-1 border border-[var(--t-border)]">
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
            </div>
        </div>
    );
};
