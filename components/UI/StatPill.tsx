import React from 'react';

type StatPillTone = 'neutral' | 'active' | 'paused';

interface StatPillProps {
  label: string;
  value: string;
  tone?: StatPillTone;
}

const toneClass: Record<StatPillTone, string> = {
  neutral: 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)]',
  active: 'border-[var(--ui-accent)] bg-[rgba(143,99,255,0.2)] text-[var(--ui-text)] ui-glow',
  paused: 'border-[#7f88a9] bg-[rgba(127,136,169,0.16)] text-[#c7d0f0]',
};

export const StatPill: React.FC<StatPillProps> = ({ label, value, tone = 'neutral' }) => {
  return (
    <div className={`chamfer-all inline-flex items-center gap-2 border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] ${toneClass[tone]}`}>
      <span>{label}</span>
      <span className="text-[var(--ui-text)]">{value}</span>
    </div>
  );
};
