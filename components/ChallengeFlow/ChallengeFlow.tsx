import React, { useState } from 'react';
import { ChallengeButton } from './ChallengeButton';
import { ChallengeModeSelect } from './ChallengeModeSelect';
import { ChallengeCardMultiplayer, MultiplayerFields } from './ChallengeCardMultiplayer';
import { ChallengeCardSolo, SoloFields } from './ChallengeCardSolo';

type ChallengeFlowState = 'collapsed' | 'expanded';

type Mode = 'solo' | 'multi' | null;

interface ChallengeFlowProps {
  onBeginMatch?: () => void;
}

export const ChallengeFlow: React.FC<ChallengeFlowProps> = ({ onBeginMatch }) => {
  const [state, setState] = useState<ChallengeFlowState>('collapsed');
  const [mode, setMode] = useState<Mode>(null);

  const [multiplayerFields, setMultiplayerFields] = useState<MultiplayerFields>({
    challengeName: 'Warm Up',
    mode: 'PVP / CO-OP',
    rules: '',
    timeLimit: '10 Minutes',
    server: '',
    role: 'General'
  });

  const [soloFields, setSoloFields] = useState<SoloFields>({
    challengeName: 'Warm Up',
    mode: 'Hard',
    rules: '',
    timeLimit: '10 Minutes',
    points: '40'
  });

  const isExpanded = state === 'expanded';

  const handleToggle = () => {
    if (isExpanded) {
      setState('collapsed');
      setMode(null);
    } else {
      setState('expanded');
    }
  };

  const handleModeSelect = (value: 'solo' | 'multi') => {
    setMode(value);
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto rounded-2xl border border-white/10 bg-[#0b0b0b]/80 shadow-[0_18px_45px_rgba(0,0,0,0.65)] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,122,62,0.16),transparent_55%)] opacity-70 pointer-events-none" />
      <div className="relative p-4">
        <ChallengeButton isOpen={isExpanded} onToggle={handleToggle} />

        <div
          className={`transition-all duration-300 overflow-hidden ${
            isExpanded ? 'max-h-[1200px] opacity-100 mt-4' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="flex flex-col gap-4">
            <ChallengeModeSelect
              isOpen={isExpanded}
              selectedMode={mode}
              onSelect={handleModeSelect}
            />

            <ChallengeCardMultiplayer
              isOpen={isExpanded && mode === 'multi'}
              values={multiplayerFields}
              onChange={(field, value) =>
                setMultiplayerFields((prev) => ({ ...prev, [field]: value }))
              }
              onStart={onBeginMatch}
            />

            <ChallengeCardSolo
              isOpen={isExpanded && mode === 'solo'}
              values={soloFields}
              onChange={(field, value) => setSoloFields((prev) => ({ ...prev, [field]: value }))}
            />

            {mode === null && (
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#5e5850]">
                Choose a mode to see details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
