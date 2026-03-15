import React, { useState } from 'react';
import { useXP } from '../XP/xpStore';
import { PlayMenuItem } from './PlayMenuItem';
import { ChallengeItem } from './ChallengeItem';
import { ChallengeWidget } from './ChallengeWidget';
import { QuestsItem } from './QuestsItem';

export const PlaySection: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { tasks } = useXP();

  return (
    <div className="w-full max-w-4xl px-8 py-10">
      <div className="flex flex-col gap-4">
        <PlayMenuItem
          label="Play"
          onClick={() => setIsOpen((prev) => !prev)}
          rightSlot={
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-lg font-bold ${
                isOpen ? 'bg-[var(--app-border)] text-[var(--app-text)] border border-white/20' : 'bg-white/90 text-black'
              }`}
            >
              {isOpen ? 'X' : '+'}
            </span>
          }
        />

        <div
          className={`transition-all duration-300 overflow-hidden ${
            isOpen ? 'max-h-[2400px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="mt-4 grid gap-6 lg:grid-cols-2 items-start">
            <div className="flex flex-col gap-3">
              <ChallengeItem />
              <QuestsItem tasks={tasks} />
              <PlayMenuItem label="Training" subtitle="Placeholder" disabled />
              <PlayMenuItem label="Inventory" subtitle="Placeholder" disabled />
              <PlayMenuItem label="Stats" subtitle="Placeholder" disabled />
            </div>
            <div className="flex flex-col gap-3">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--app-muted)]">
                Challenge widget test (duplicate)
              </div>
              <ChallengeWidget />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
