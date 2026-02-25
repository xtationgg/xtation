import React from 'react';

export interface TabItem {
  value: string;
  label: string;
}

interface TabBarProps {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

interface TabButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

export const TabButton: React.FC<TabButtonProps> = ({ label, selected, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ui-pressable ui-shape-all border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.25em] ${
        selected
          ? 'border-[var(--ui-accent)] bg-[color-mix(in_srgb,var(--ui-accent)_24%,transparent)] text-[var(--ui-text)] ui-glow'
          : 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)] hover:border-[var(--ui-accent)] hover:text-[var(--ui-text)]'
      }`}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
};

export const TabBar: React.FC<TabBarProps> = ({ tabs, value, onChange, className = '' }) => {
  return (
    <div className={`inline-flex items-center gap-2 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-panel)] p-1 ${className}`}>
      {tabs.map((tab) => (
        <TabButton key={tab.value} label={tab.label} selected={tab.value === value} onClick={() => onChange(tab.value)} />
      ))}
    </div>
  );
};
