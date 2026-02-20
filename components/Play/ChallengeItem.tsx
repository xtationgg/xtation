import React, { useState } from 'react';
import { ChallengeConfig } from './types';
import { ChallengeModeSelect } from './ChallengeModeSelect';
import { ChallengeDetailsForm } from './ChallengeDetailsForm';
import { ChallengeRunningCompact } from './ChallengeRunningCompact';
import { useXP } from '../XP/xpStore';
import { XPSessionImpact } from '../XP/xpTypes';

export type ChallengeState =
  | 'collapsed'
  | 'modeSelect'
  | 'detailsSolo'
  | 'detailsMulti'
  | 'runningSolo'
  | 'runningMulti';

interface ChallengeItemProps {
  onStart?: (config: ChallengeConfig) => void;
  onCancel?: () => void;
}

// TODO: Replace defaults with backend-provided ChallengeConfig values.
const defaultSoloConfig: ChallengeConfig = {
  name: 'Daily Sprint',
  rules: '',
  timeLimitSec: 300,
  mode: 'SOLO',
  difficulty: 'HARD',
  points: 100
};

// TODO: Persist edits to backend when wiring data flow.
const defaultMultiConfig: ChallengeConfig = {
  name: 'Daily Sprint',
  rules: '',
  timeLimitSec: 300,
  mode: 'MULTI',
  multiType: 'PVP',
  server: 'EU-West',
  role: 'Carry'
};

export const ChallengeItem: React.FC<ChallengeItemProps> = ({ onStart, onCancel }) => {
  const [state, setState] = useState<ChallengeState>('collapsed');
  const [soloConfig, setSoloConfig] = useState<ChallengeConfig>(defaultSoloConfig);
  const [multiConfig, setMultiConfig] = useState<ChallengeConfig>(defaultMultiConfig);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [impactOpen, setImpactOpen] = useState(false);
  const [impactRating, setImpactRating] = useState<XPSessionImpact>('normal');
  const { createChallenge, updateChallenge, startSession, stopSession, cancelSession, updateSession } = useXP();

  const isCollapsed = state === 'collapsed';
  const isRunning = state === 'runningSolo' || state === 'runningMulti';

  const handleClose = () => {
    if (activeSessionId) {
      cancelSession(activeSessionId);
      setActiveSessionId(null);
    }
    setImpactOpen(false);
    setState('collapsed');
  };

  const handleStart = (mode: 'solo' | 'multi') => {
    const config = mode === 'solo' ? soloConfig : multiConfig;
    const challenge = createChallenge({
      mode: mode === 'solo' ? 'solo' : 'multiplayer',
      name: config.name,
      details: config.rules || '',
      rules: {
        timeType: 'countdown',
        durationMinutes: Math.max(1, Math.round(config.timeLimitSec / 60)),
      },
      privacy: mode === 'solo' ? 'private' : 'friends',
    });
    const sessionId = startSession({
      title: config.name,
      tag: mode === 'solo' ? 'SOLO' : 'MULTI',
      source: 'challenge',
      linkedChallengeId: challenge.id,
    });
    if (!sessionId) {
      updateChallenge(challenge.id, { status: 'canceled' });
      return;
    }
    setActiveSessionId(sessionId);
    if (mode === 'solo') {
      setState('runningSolo');
      onStart?.(soloConfig);
      return;
    }
    setState('runningMulti');
    onStart?.(multiConfig);
  };

  const handleCancel = () => {
    if (activeSessionId) {
      cancelSession(activeSessionId);
      setActiveSessionId(null);
    }
    if (state === 'runningSolo') {
      setState('detailsSolo');
    } else if (state === 'runningMulti') {
      setState('detailsMulti');
    }
    onCancel?.();
  };

  const containerHeight = isCollapsed
    ? 'max-h-[56px]'
    : isRunning
      ? 'max-h-[200px]'
      : 'max-h-[900px]';

  return (
    <div
      className={`w-full rounded-xl border border-white/10 bg-gradient-to-b from-[#242427] to-[#1a1a1c] shadow-[0_10px_24px_rgba(0,0,0,0.45)] overflow-hidden transition-all duration-300 ${containerHeight}`}
    >
      {isCollapsed && (
        <button
          type="button"
          onClick={() => setState('modeSelect')}
          className="w-full px-4 py-3 flex items-center justify-between uppercase tracking-[0.32em] text-[11px] text-[#f3f0e8]"
        >
          <span>Challenge</span>
          <span className="w-7 h-7 rounded-lg bg-white/90 text-black flex items-center justify-center text-lg font-bold">+</span>
        </button>
      )}

      {!isCollapsed && (
        <div className="p-3 transition-all duration-300">
          {state === 'modeSelect' && (
            <ChallengeModeSelect
              onClose={handleClose}
              onSelect={(mode) => setState(mode === 'solo' ? 'detailsSolo' : 'detailsMulti')}
            />
          )}

          {state === 'detailsSolo' && (
            <ChallengeDetailsForm
              mode="solo"
              config={soloConfig}
              onChange={(patch) => setSoloConfig((prev) => ({ ...prev, ...patch }))}
              onStart={() => handleStart('solo')}
              onClose={handleClose}
              onBack={() => setState('modeSelect')}
            />
          )}

          {state === 'detailsMulti' && (
            <ChallengeDetailsForm
              mode="multi"
              config={multiConfig}
              onChange={(patch) => setMultiConfig((prev) => ({ ...prev, ...patch }))}
              onStart={() => handleStart('multi')}
              onClose={handleClose}
              onBack={() => setState('modeSelect')}
            />
          )}

          {(state === 'runningSolo' || state === 'runningMulti') && (
            <div className="space-y-3">
              <ChallengeRunningCompact
                mode={state === 'runningMulti' ? 'multi' : 'solo'}
                onCancel={handleCancel}
              />
              <button
                type="button"
                onClick={() => {
                  stopSession();
                  setImpactRating('normal');
                  setImpactOpen(true);
                }}
                className="w-full px-4 py-2 rounded-lg border border-[#5ef48a]/40 text-[11px] uppercase tracking-[0.2em] text-[#5ef48a]"
              >
                Finish
              </button>
            </div>
          )}
        </div>
      )}

      {impactOpen && activeSessionId && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#141418] p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-[0.3em] text-white">Impact Rating</div>
            <select
              value={impactRating}
              onChange={(e) => setImpactRating(e.target.value as XPSessionImpact)}
              className="w-full bg-[#111114] border border-white/10 rounded px-2 py-2 text-[11px] text-white"
            >
              <option value="normal">Normal impact</option>
              <option value="medium">Medium impact</option>
              <option value="hard">Hard impact</option>
            </select>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setImpactOpen(false);
                  setActiveSessionId(null);
                  setState(state === 'runningMulti' ? 'detailsMulti' : 'detailsSolo');
                }}
                className="px-3 py-2 rounded border border-white/10 text-[10px] uppercase tracking-[0.25em] text-[#8b847a]"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => {
                  updateSession(activeSessionId, { impactRating });
                  setImpactOpen(false);
                  setActiveSessionId(null);
                  setState(state === 'runningMulti' ? 'detailsMulti' : 'detailsSolo');
                }}
                className="px-3 py-2 rounded border border-[#f46a2e]/40 text-[10px] uppercase tracking-[0.25em] text-[#f46a2e]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
