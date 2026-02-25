import React from 'react';
import { useTheme } from '../../src/theme/ThemeProvider';

interface ThemeSwitcherProps {
  compact?: boolean;
  className?: string;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ compact = false, className = '' }) => {
  const { theme, setTheme, options } = useTheme();

  return (
    <div className={`grid gap-2 ${className}`}>
      {!compact ? (
        <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ui-muted)]">Theme</div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              className={`ui-pressable chamfer-all border px-3 py-1.5 text-[10px] font-semibold uppercase ${
                active
                  ? 'border-[var(--ui-accent)] text-[var(--ui-text)] ui-glow'
                  : 'border-[var(--ui-border)] bg-[var(--ui-panel-2)] text-[var(--ui-muted)] hover:border-[var(--ui-accent)] hover:text-[var(--ui-text)]'
              } ${compact ? 'tracking-[0.18em]' : 'tracking-[0.2em]'}`}
              style={active ? { backgroundColor: 'color-mix(in srgb, var(--ui-accent) 22%, transparent)' } : undefined}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSwitcher;
