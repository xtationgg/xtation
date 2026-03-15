import React from 'react';

export const MonoTimer: React.FC<{ seconds: number; size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ seconds, size = 'md', className }) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const display = h > 0
    ? `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
    : `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  return <span className={`play-mono-timer play-mono-timer--${size} ${className || ''}`}>{display}</span>;
};
