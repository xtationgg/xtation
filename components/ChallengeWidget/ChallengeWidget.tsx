import React, { useMemo, useState } from 'react';
import { ChallengeCollapsedButton } from './ChallengeCollapsedButton';
import { ChallengeModeSelect } from './ChallengeModeSelect';
import { ChallengeDetails, MultiplayerFields, SoloFields } from './ChallengeDetails';
import { Timer } from './Timer';

export interface StartPayload {
  mode: 'solo' | 'multi';
  fields: MultiplayerFields | SoloFields;
}

interface ChallengeWidgetProps {
  onStartChallenge?: (payload: StartPayload) => void;
  onCancelChallenge?: () => void;
  onChange?: (field: string, value: string, mode: 'solo' | 'multi') => void;
}

const DEFAULT_TIMER = '00:00';

export const ChallengeWidget: React.FC<ChallengeWidgetProps> = ({
  onStartChallenge,
  onCancelChallenge,
  onChange
}) => {
  const [view, setView] = useState<'collapsed' | 'modeSelect' | 'details' | 'queue'>('collapsed');
  const [mode, setMode] = useState<'solo' | 'multi' | null>(null);
  const [queueRunId, setQueueRunId] = useState(0);

  // TODO: replace these defaults with backend payloads when wiring data.
  const [multiplayerFields, setMultiplayerFields] = useState<MultiplayerFields>({
    challengeName: 'Warm Up',
    mode: 'PVP',
    rules: '',
    timeLimit: '10 Minutes',
    server: '',
    role: 'General',
    timer: DEFAULT_TIMER
  });

  const [soloFields, setSoloFields] = useState<SoloFields>({
    challengeName: 'Warm Up',
    rules: '',
    timeLimit: '10 Minutes',
    points: '40',
    timer: DEFAULT_TIMER
  });

  const activeFields = useMemo(() => {
    if (mode === 'multi') return multiplayerFields;
    if (mode === 'solo') return soloFields;
    return null;
  }, [mode, multiplayerFields, soloFields]);

  const handleOpen = () => {
    setView('modeSelect');
  };

  const handleClose = () => {
    setView('collapsed');
    setMode(null);
  };

  const handleModeSelect = (selected: 'solo' | 'multi') => {
    setMode(selected);
    setView('details');
  };

  const handleBack = () => {
    setView('modeSelect');
  };

  const handleFieldChange = (field: string, value: string, activeMode: 'solo' | 'multi') => {
    if (activeMode === 'multi') {
      setMultiplayerFields((prev) => ({ ...prev, [field]: value }));
    } else {
      setSoloFields((prev) => ({ ...prev, [field]: value }));
    }

    // TODO: pipe field edits to backend patch when wiring API.
    onChange?.(field, value, activeMode);
  };

  const handleStart = () => {
    if (!mode || !activeFields) return;
    setQueueRunId((prev) => prev + 1);
    setView('queue');
    onStartChallenge?.({ mode, fields: activeFields });
  };

  const handleCancel = () => {
    setView('details');
    onCancelChallenge?.();
  };

  const showBody = view !== 'collapsed';

  return (
    <div className="relative w-full max-w-3xl mx-auto rounded-2xl border border-white/10 bg-[#0b0b0b]/80 shadow-[0_18px_45px_rgba(0,0,0,0.65)] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,122,62,0.16),transparent_55%)] opacity-70 pointer-events-none" />
      <div className="relative p-4">
        {view === 'collapsed' && <ChallengeCollapsedButton onClick={handleOpen} />}

        <div
          className={`transition-all duration-300 overflow-hidden ${
            showBody ? 'max-h-[1600px] opacity-100 translate-y-0 mt-4' : 'max-h-0 opacity-0 -translate-y-1'
          }`}
        >
          {view === 'modeSelect' && (
            <div className="animate-fade-in">
              <ChallengeModeSelect onClose={handleClose} onSelect={handleModeSelect} />
            </div>
          )}

          {view === 'details' && mode && activeFields && (
            <div className="animate-fade-in">
              <ChallengeDetails
                mode={mode}
                fields={activeFields}
                onTimerChange={(value) => handleFieldChange('timer', value, mode)}
                onFieldChange={(field, value) => handleFieldChange(field, value, mode)}
                onStart={handleStart}
                onClose={handleClose}
                onBack={handleBack}
              />
            </div>
          )}

          {view === 'queue' && mode && (
            <div className="animate-fade-in">
              <div className="w-full rounded-2xl border border-white/10 bg-gradient-to-b from-[#2a2a2d] to-[#1b1b1d] p-5 shadow-[0_14px_26px_rgba(0,0,0,0.6)] flex flex-col items-center gap-4">
                <div className="text-[10px] uppercase tracking-[0.32em] text-[#9a9288]">
                  {mode === 'multi' ? 'Searching...' : 'Running...'}
                </div>
                <Timer key={queueRunId} isRunning={true} className="text-3xl tracking-[0.3em] text-[#f6e9c8]" />
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-lg border border-[#f46a2e]/70 bg-[#2d2017] text-[#f3f0e8] text-[12px] tracking-[0.32em] uppercase"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
