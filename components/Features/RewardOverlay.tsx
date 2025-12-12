
import React from 'react';
import { RewardConfig } from '../../types';
import { RewardVisual } from '../UI/RewardVisual';

interface RewardOverlayProps {
    config: RewardConfig;
    onDismiss: () => void;
    onDurationResolved?: (ms: number) => void;
}

export const RewardOverlay: React.FC<RewardOverlayProps> = ({ config, onDismiss, onDurationResolved }) => {
    
    return (
        <div 
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in cursor-pointer"
            onClick={onDismiss}
        >
            <div className={`mb-12 w-[30vw] h-[30vw] flex items-center justify-center ${config.animation === 'CUSTOM' ? '' : 'scale-150'}`}>
                <RewardVisual 
                    config={config} 
                    className="w-full h-full" 
                    onDurationResolved={onDurationResolved}
                    allowSound
                />
            </div>
            
            <div className="text-center z-10 animate-[scanline_0.5s_ease-out]">
                <div className="text-[#FF2A3A] text-xl font-mono font-bold tracking-[0.5em] mb-2 uppercase">System_Alert</div>
                <h1 className="text-6xl font-black text-white tracking-tighter uppercase mb-4">Level {config.level} Reached</h1>
                <div className="text-2xl font-mono text-white border border-white px-6 py-2 inline-block">
                    {config.threshold} XP ACQUIRED
                </div>
            </div>
        </div>
    );
};
