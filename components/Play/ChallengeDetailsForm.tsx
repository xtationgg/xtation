import React from 'react';
import { ChallengeConfig } from './types';

interface ChallengeDetailsFormProps {
  mode: 'solo' | 'multi';
  config: ChallengeConfig;
  onChange: (patch: Partial<ChallengeConfig>) => void;
  onStart: () => void;
  onClose: () => void;
  onBack?: () => void;
}

const TIME_LIMITS = [
  { label: '1m', value: 60 },
  { label: '3m', value: 180 },
  { label: '5m', value: 300 },
  { label: '10m', value: 600 },
  { label: '20m', value: 1200 }
];

export const ChallengeDetailsForm: React.FC<ChallengeDetailsFormProps> = ({
  mode,
  config,
  onChange,
  onStart,
  onClose,
  onBack
}) => {
  const isMulti = mode === 'multi';

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-gradient-to-b from-[var(--app-panel-2)] to-[var(--app-panel)] p-4 shadow-[0_14px_26px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[10px] uppercase tracking-[0.32em] text-[var(--app-muted)]">
          {isMulti ? 'Multiplayer' : 'Solo'}
        </div>
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)] hover:text-white transition"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-white/20 bg-[var(--app-border)] text-[var(--app-text)] flex items-center justify-center text-sm hover:border-white/40"
            aria-label="Close"
          >
            X
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[var(--app-bg)] px-3 py-3 text-center">
        <button
          type="button"
          onClick={onStart}
          className="w-full py-2 rounded-lg border border-white/10 bg-[var(--app-panel)] text-[var(--app-text)] text-[12px] tracking-[0.32em] uppercase hover:border-white/40 transition"
        >
          Start
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        <label className="border border-white/10 bg-white/5 rounded-lg px-2 py-1 flex flex-col gap-1">
          <span className="text-[8px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Challenge Name</span>
          <input
            value={config.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Daily Sprint"
            className="bg-transparent text-[11px] uppercase tracking-[0.18em] text-[var(--app-text)] placeholder:text-[#5e5850] focus:outline-none"
          />
        </label>

        <label className="border border-white/10 bg-white/5 rounded-lg px-2 py-1 flex flex-col gap-1">
          <span className="text-[8px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Rules</span>
          <textarea
            rows={2}
            value={config.rules}
            onChange={(event) => onChange({ rules: event.target.value })}
            placeholder="No pauses. Focus mode."
            className="bg-transparent text-[11px] uppercase tracking-[0.18em] text-[var(--app-text)] placeholder:text-[#5e5850] focus:outline-none resize-none"
          />
        </label>

        <label className="border border-white/10 bg-white/5 rounded-lg px-2 py-1 flex flex-col gap-1">
          <span className="text-[8px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Time Limit</span>
          <select
            value={config.timeLimitSec}
            onChange={(event) => onChange({ timeLimitSec: Number(event.target.value) })}
            className="bg-transparent text-[11px] uppercase tracking-[0.18em] text-[var(--app-text)] focus:outline-none"
          >
            {TIME_LIMITS.map((option) => (
              <option key={option.value} value={option.value} className="text-black">
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="border border-white/10 bg-white/5 rounded-lg px-2 py-1 flex flex-col gap-1">
          <span className="text-[8px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Mode</span>
          {isMulti ? (
            <select
              value={config.multiType}
              onChange={(event) => onChange({ multiType: event.target.value as ChallengeConfig['multiType'] })}
              className="bg-transparent text-[11px] uppercase tracking-[0.18em] text-[var(--app-text)] focus:outline-none"
            >
              <option value="PVP" className="text-black">PVP</option>
              <option value="COOP" className="text-black">CO-OP</option>
            </select>
          ) : (
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--app-text)]">HARD</div>
          )}
        </label>

        {isMulti ? (
          <>
            <label className="border border-white/10 bg-white/5 rounded-lg px-2 py-1 flex flex-col gap-1">
              <span className="text-[8px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Server</span>
              <select
                value={config.server}
                onChange={(event) => onChange({ server: event.target.value })}
                className="bg-transparent text-[11px] uppercase tracking-[0.18em] text-[var(--app-text)] focus:outline-none"
              >
                <option value="EU-West" className="text-black">EU-West</option>
                <option value="NA-East" className="text-black">NA-East</option>
                <option value="Local" className="text-black">Local</option>
              </select>
            </label>

            <label className="border border-white/10 bg-white/5 rounded-lg px-2 py-1 flex flex-col gap-1">
              <span className="text-[8px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Role</span>
              <select
                value={config.role}
                onChange={(event) => onChange({ role: event.target.value })}
                className="bg-transparent text-[11px] uppercase tracking-[0.18em] text-[var(--app-text)] focus:outline-none"
              >
                <option value="Carry" className="text-black">Carry</option>
                <option value="Support" className="text-black">Support</option>
                <option value="Flex" className="text-black">Flex</option>
              </select>
            </label>
          </>
        ) : (
          <label className="border border-white/10 bg-white/5 rounded-lg px-2 py-1 flex flex-col gap-1">
            <span className="text-[8px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Points</span>
            <input
              type="number"
              value={config.points ?? 0}
              onChange={(event) => onChange({ points: Number(event.target.value) })}
              className="bg-transparent text-[11px] uppercase tracking-[0.18em] text-[var(--app-text)] focus:outline-none"
            />
          </label>
        )}
      </div>
    </div>
  );
};
