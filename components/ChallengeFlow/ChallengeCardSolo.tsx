import React, { useEffect, useState } from 'react';
import { Timer } from './Timer';

export interface SoloFields {
  challengeName: string;
  mode: string;
  rules: string;
  timeLimit: string;
  points: string;
}

interface ChallengeCardSoloProps {
  isOpen: boolean;
  initialSeconds?: number;
  values: SoloFields;
  onChange: (field: keyof SoloFields, value: string) => void;
}

const EditableRow: React.FC<{
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <label className="border border-white/10 bg-white/5 rounded-lg px-2 py-1 flex flex-col gap-1">
    <span className="text-[8px] uppercase tracking-[0.22em] text-[#8b847a]">{label}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="bg-transparent text-[11px] uppercase tracking-[0.18em] text-[#f3f0e8] placeholder:text-[#5e5850] focus:outline-none"
    />
  </label>
);

export const ChallengeCardSolo: React.FC<ChallengeCardSoloProps> = ({
  isOpen,
  initialSeconds = 43,
  values,
  onChange
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setIsRunning(false);
    }
  }, [isOpen]);

  const handleStart = () => {
    setRunKey((prev) => prev + 1);
    setIsRunning(true);
  };

  return (
    <div
      className={`w-full transition-all duration-300 ${
        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      <div className="w-full rounded-2xl border border-white/10 bg-gradient-to-b from-[#2a2a2d] to-[#1b1b1d] p-4 shadow-[0_14px_26px_rgba(0,0,0,0.6)]">
        <div className="text-[10px] uppercase tracking-[0.32em] text-[#9a9288] text-center mb-2">Solo</div>
        <div className="rounded-xl border border-white/10 bg-[#1a1a1c] px-3 py-4 text-center">
          <button
            type="button"
            onClick={handleStart}
            className="w-full py-2 rounded-lg border border-white/10 bg-[#262629] text-[#f3f0e8] text-[12px] tracking-[0.32em] uppercase hover:border-white/40 transition"
          >
            Start
          </button>
          <Timer
            key={runKey}
            initialSeconds={initialSeconds}
            isActive={isOpen && isRunning}
            className="mt-2 block text-2xl tracking-[0.3em] text-[#f6e9c8]"
            onComplete={() => setIsRunning(false)}
          />
        </div>
        <div className="mt-3 grid gap-2">
          <EditableRow
            label="Challenge Name"
            value={values.challengeName}
            placeholder="Warm Up"
            onChange={(value) => onChange('challengeName', value)}
          />
          <EditableRow
            label="Mode"
            value={values.mode}
            placeholder="Hard"
            onChange={(value) => onChange('mode', value)}
          />
          <EditableRow
            label="Rules"
            value={values.rules}
            placeholder="Rules (backend)"
            onChange={(value) => onChange('rules', value)}
          />
          <EditableRow
            label="Time Limit"
            value={values.timeLimit}
            placeholder="10 Minutes"
            onChange={(value) => onChange('timeLimit', value)}
          />
          <EditableRow
            label="Points"
            value={values.points}
            placeholder="40"
            onChange={(value) => onChange('points', value)}
          />
        </div>
      </div>
    </div>
  );
};
