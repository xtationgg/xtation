
import React, { useEffect, useState } from 'react';
import { RewardConfig, RewardAnimation } from '../../types';

interface RewardVisualProps {
    config: RewardConfig;
    className?: string;
    onDurationResolved?: (ms: number) => void;
    allowSound?: boolean;
}

export const RewardVisual: React.FC<RewardVisualProps> = ({ config, className = "", onDurationResolved, allowSound = false }) => {
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        let objectUrl: string | null = null;

        const resolveCustomUrl = async () => {
            if (config.animation !== 'CUSTOM' || !config.customVisualUrl) {
                setResolvedUrl(null);
                return;
            }

            if (!config.customVisualUrl.startsWith('idb:')) {
                setResolvedUrl(config.customVisualUrl);
                return;
            }

            try {
                const blob = await loadVisualBlob(config.level);
                if (!blob || !isMounted) return;
                objectUrl = URL.createObjectURL(blob);
                setResolvedUrl(objectUrl);
            } catch (err) {
                console.error('Failed to resolve reward visual', err);
            }
        };

        resolveCustomUrl();

        return () => {
            isMounted = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [config.animation, config.customVisualUrl, config.level]);

    const customUrl = resolvedUrl || (config.customVisualUrl && !config.customVisualUrl.startsWith('idb:') ? config.customVisualUrl : null);
    
    if (config.animation === 'CUSTOM') {
        return (
            <div className={`relative rounded-full overflow-hidden border-2 border-[#FF2A3A] bg-black shadow-[0_0_20px_rgba(255,42,58,0.3)] flex items-center justify-center ${className}`}>
                {customUrl ? (
                    config.customVisualType === 'video' ? (
                        <video 
                            src={customUrl} 
                            autoPlay 
                            loop 
                            playsInline
                            controls={false}
                            muted={!allowSound}
                            className="w-full h-full object-cover"
                            style={{ objectFit: 'cover', objectPosition: 'center' }}
                            onLoadedMetadata={(e) => {
                                const dur = e.currentTarget.duration;
                                if (Number.isFinite(dur) && dur > 0 && onDurationResolved) {
                                    onDurationResolved(dur * 1000);
                                }
                            }}
                        />
                    ) : (
                        <img 
                            src={customUrl} 
                            alt="Custom Reward" 
                            className="w-full h-full object-cover"
                            style={{ objectFit: 'cover', objectPosition: 'center' }}
                        />
                    )
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-xs uppercase tracking-[0.2em] bg-[#111]">
                        Loading visual...
                    </div>
                )}
                {/* Overlay scanline effect */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-30 pointer-events-none"></div>
            </div>
        );
    }

    return (
        <div className={`flex items-center justify-center ${className}`}>
            {renderCSSAnimation(config.animation)}
        </div>
    );
};

const renderCSSAnimation = (animation: RewardAnimation) => {
    switch(animation) {
        case 'CYBER_PULSE':
            return (
                <div className="relative flex items-center justify-center">
                    <div className="absolute w-[100%] h-[100%] border-4 border-[#FF2A3A] rounded-full animate-ping opacity-20"></div>
                    <div className="absolute w-[70%] h-[70%] border-2 border-white rounded-full animate-ping opacity-40 delay-100"></div>
                     <div className="w-[50%] h-[50%] bg-[#FF2A3A] rounded-full blur-xl animate-pulse"></div>
                </div>
            );
        case 'ORBITAL_STRIKE':
            return (
                <div className="relative flex flex-col items-center justify-center w-full h-full">
                    <div className="w-[80%] h-[80%] border-x-4 border-[#FF2A3A] rounded-full animate-spin-slow opacity-50 absolute"></div>
                    <div className="w-[50%] h-1 bg-white blur-md animate-pulse"></div>
                </div>
            );
        case 'GLITCH_STORM':
            return (
                <div className="relative flex items-center justify-center w-full h-full overflow-hidden">
                    <div className="text-4xl font-black text-white mix-blend-difference animate-pulse">RANK</div>
                    <div className="absolute text-4xl font-black text-[#FF2A3A] opacity-50 animate-bounce">RANK</div>
                </div>
            );
        case 'GOLDEN_HEX':
            return (
                <div className="relative flex items-center justify-center w-full h-full">
                    <svg viewBox="0 0 100 100" className="w-[90%] h-[90%] animate-spin-slow">
                        <polygon points="50 0, 100 25, 100 75, 50 100, 0 75, 0 25" fill="none" stroke="#C8AA6E" strokeWidth="2" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-[50%] h-[50%] border border-[#C8AA6E] rotate-45 animate-pulse"></div>
                    </div>
                </div>
            );
        case 'NEON_BURST':
            return (
                 <div className="relative flex items-center justify-center w-full h-full">
                    {[...Array(8)].map((_, i) => (
                         <div 
                            key={i}
                            className="absolute w-1 h-16 bg-gradient-to-t from-transparent to-[#0AC8B9] origin-bottom animate-fade-in"
                            style={{ transform: `rotate(${i * 45}deg) translateY(-20px)` }}
                         ></div>
                    ))}
                    <div className="w-[40%] h-[40%] bg-white rounded-full blur-xl animate-pulse"></div>
                </div>
            );
        default: return null;
    }
};

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

const loadVisualBlob = async (level: number) => {
    const db = await openVisualDB();
    const tx = db.transaction('visuals', 'readonly');
    const req = tx.objectStore('visuals').get(`visual-${level}`);
    const blob: Blob | undefined = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result as Blob | undefined);
        req.onerror = () => reject(req.error);
    });
    return blob || null;
};
