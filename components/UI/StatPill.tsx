import React from 'react';

type StatPillTone = 'neutral' | 'active' | 'paused';

interface StatPillProps {
  label: string;
  value: string;
  tone?: StatPillTone;
}

const toneClass: Record<StatPillTone, string> = {
  neutral: 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)]',
  active: 'border-[var(--ui-accent)] bg-[color-mix(in_srgb,var(--ui-accent)_20%,transparent)] text-[var(--ui-text)] ui-glow',
  paused:
    'border-[color-mix(in_srgb,var(--ui-muted)_70%,var(--ui-border))] bg-[color-mix(in_srgb,var(--ui-muted)_16%,transparent)] text-[color-mix(in_srgb,var(--ui-text)_85%,var(--ui-muted))]',
};

export const StatPill: React.FC<StatPillProps> = ({ label, value, tone = 'neutral' }) => {
  return (
    <div className={`ui-shape-all inline-flex items-center gap-2 border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] ${toneClass[tone]}`}>
      <span>{label}</span>
      <span className="text-[var(--ui-text)]">{value}</span>
    </div>
  );
};
