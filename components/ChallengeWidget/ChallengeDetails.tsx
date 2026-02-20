import React from 'react';
import { Camera, Mic } from 'lucide-react';
import { ChallengeFields, FieldConfig } from './ChallengeFields';

export interface MultiplayerFields {
  challengeName: string;
  mode: 'PVP' | 'CO-OP' | string;
  rules: string;
  timeLimit: string;
  server: string;
  role: string;
  timer: string;
}

export interface SoloFields {
  challengeName: string;
  rules: string;
  timeLimit: string;
  points: string;
  timer: string;
}

interface ChallengeDetailsProps {
  mode: 'solo' | 'multi';
  fields: MultiplayerFields | SoloFields;
  onTimerChange: (value: string) => void;
  onFieldChange: (field: string, value: string) => void;
  onStart: () => void;
  onClose: () => void;
  onBack?: () => void;
}

export const ChallengeDetails: React.FC<ChallengeDetailsProps> = ({
  mode,
  fields,
  onTimerChange,
  onFieldChange,
  onStart,
  onClose,
  onBack
}) => {
  const isMultiplayer = mode === 'multi';

  const baseFields: FieldConfig[] = [
    {
      key: 'challengeName',
      label: 'Challenge Name',
      type: 'text',
      value: fields.challengeName,
      placeholder: 'Warm Up',
      onChange: (value) => onFieldChange('challengeName', value)
    },
    isMultiplayer
      ? {
          key: 'mode',
          label: 'Mode',
          type: 'select',
          value: (fields as MultiplayerFields).mode,
          options: ['PVP', 'CO-OP'],
          onChange: (value) => onFieldChange('mode', value)
        }
      : {
          key: 'mode',
          label: 'Mode',
          type: 'static',
          value: 'HARD'
        },
    {
      key: 'rules',
      label: 'Rules',
      type: 'textarea',
      value: fields.rules,
      placeholder: 'Rules (backend)',
      onChange: (value) => onFieldChange('rules', value)
    },
    {
      key: 'timeLimit',
      label: 'Time Limit',
      type: 'text',
      value: fields.timeLimit,
      placeholder: '10 Minutes',
      onChange: (value) => onFieldChange('timeLimit', value)
    }
  ];

  const extraFields: FieldConfig[] = isMultiplayer
    ? [
        {
          key: 'server',
          label: 'Server',
          type: 'text',
          value: (fields as MultiplayerFields).server,
          placeholder: 'Server (backend)',
          onChange: (value) => onFieldChange('server', value)
        },
        {
          key: 'role',
          label: 'Role',
          type: 'text',
          value: (fields as MultiplayerFields).role,
          placeholder: 'General',
          onChange: (value) => onFieldChange('role', value)
        }
      ]
    : [
        {
          key: 'points',
          label: 'Points',
          type: 'number',
          value: (fields as SoloFields).points,
          placeholder: '40',
          onChange: (value) => onFieldChange('points', value)
        }
      ];

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-gradient-to-b from-[#2a2a2d] to-[#1b1b1d] p-4 shadow-[0_14px_26px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[10px] uppercase tracking-[0.32em] text-[#9a9288]">
          {isMultiplayer ? 'Multiplayer' : 'Solo'}
        </div>
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-[#8b847a] hover:text-white transition"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-white/20 bg-[#1a1a1d] text-[#f3f0e8] flex items-center justify-center text-sm hover:border-white/40"
            aria-label="Close"
          >
            X
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#1a1a1c] px-3 py-3 text-center">
        <button
          type="button"
          onClick={onStart}
          className="w-full py-2 rounded-lg border border-white/10 bg-[#262629] text-[#f3f0e8] text-[12px] tracking-[0.32em] uppercase hover:border-white/40 transition"
        >
          Start
        </button>

        <input
          value={fields.timer}
          onChange={(event) => onTimerChange(event.target.value)}
          placeholder="00:00"
          className="mt-2 w-full bg-transparent text-2xl tracking-[0.3em] text-[#f6e9c8] text-center focus:outline-none"
        />
      </div>

      <div className="mt-3">
        <ChallengeFields fields={[...baseFields, ...extraFields]} />
      </div>

      {isMultiplayer && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            className="w-10 h-8 rounded-lg border border-white/10 bg-[#1a1a1d] text-[#9a9288]"
          >
            <Camera size={16} className="mx-auto" />
          </button>
          <button
            type="button"
            className="w-10 h-8 rounded-lg border border-white/10 bg-[#1a1a1d] text-[#9a9288]"
          >
            <Mic size={16} className="mx-auto" />
          </button>
        </div>
      )}
    </div>
  );
};
