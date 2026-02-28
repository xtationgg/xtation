import React, { useEffect, useId, useMemo, useState } from 'react';

type DayTimeOrbProps = {
  showLiveLabel?: boolean;
  className?: string;
  size?: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const pad2 = (value: number) => String(value).padStart(2, '0');

export const DayTimeOrb: React.FC<DayTimeOrbProps> = ({ showLiveLabel = false, className = '', size = 92 }) => {
  const [now, setNow] = useState(() => Date.now());
  const gradientId = useId().replace(/:/g, '');

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const metrics = useMemo(() => {
    const current = new Date(now);
    const dayStart = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
      0,
      0,
      0,
      0
    ).getTime();
    const nextMidnight = dayStart + 86400000;

    const minutesPassedToday = clamp(Math.floor((now - dayStart) / 60000), 0, 1440);
    const minutesUntilMidnight = clamp(Math.ceil((nextMidnight - now) / 60000), 0, 1440);

    const progress = clamp(minutesPassedToday / 1440, 0, 1);
    const passedHours = clamp(Math.floor(minutesPassedToday / 60), 0, 24);
    const partialHourProgress = clamp((minutesPassedToday % 60) / 60, 0, 1);

    return {
      progress,
      passedHours,
      partialHourProgress,
      remainingHours: Math.floor(minutesUntilMidnight / 60),
      remainingMinutes: minutesUntilMidnight % 60,
    };
  }, [now]);

  const arcRadius = 40;
  const arcLength = 2 * Math.PI * arcRadius;
  const arcDashOffset = arcLength * (1 - metrics.progress);

  const clampedSize = clamp(size, 72, 240);
  const wrapperWidth = Math.round(clampedSize * 1.35);
  const textSize = Math.max(9, Math.round(clampedSize * 0.1));
  const liveSize = Math.max(8, Math.round(clampedSize * 0.085));

  return (
    <div className={`flex flex-col items-center ${className}`} style={{ width: wrapperWidth }}>
      <svg
        viewBox="0 0 144 144"
        className="shrink-0"
        style={{ width: clampedSize, height: clampedSize }}
        role="img"
        aria-label="Today time orb"
      >
        <defs>
          <radialGradient id={`orb-core-${gradientId}`} cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#eef2fb" />
            <stop offset="60%" stopColor="#d8deed" />
            <stop offset="100%" stopColor="#b7c1d8" />
          </radialGradient>
        </defs>

        {Array.from({ length: 24 }, (_, index) => {
          const rotation = index * 15;
          const isPast = index < metrics.passedHours;
          const isCurrent = index === metrics.passedHours && metrics.passedHours < 24;
          const fill = isPast
            ? 'color-mix(in srgb, var(--app-accent) 68%, #2a1f42)'
            : isCurrent
              ? `color-mix(in srgb, var(--app-accent) ${Math.round(30 + metrics.partialHourProgress * 45)}%, #271d3e)`
              : '#241a3b';

          return (
            <rect
              key={`segment-${index}`}
              x={67}
              y={4}
              width={10}
              height={24}
              rx={3}
              fill={fill}
              transform={`rotate(${rotation} 72 72)`}
              opacity={isPast || isCurrent ? 1 : 0.95}
            />
          );
        })}

        <circle cx="72" cy="72" r="47" fill="none" stroke="color-mix(in srgb, var(--app-text) 10%, transparent)" strokeWidth="7" />
        <circle
          cx="72"
          cy="72"
          r={arcRadius}
          fill="none"
          stroke="#f4f5f8"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={arcDashOffset}
          transform="rotate(-90 72 72)"
        />

        <circle cx="72" cy="72" r="12.5" fill={`url(#orb-core-${gradientId})`} className="day-time-orb-core" />
        <circle cx="72" cy="72" r="17" fill="none" stroke="color-mix(in srgb, #e8edf7 40%, transparent)" strokeWidth="2.5" className="day-time-orb-glow" />
      </svg>

      <div className="mt-1 text-center uppercase tracking-[0.1em] text-[var(--app-text)]" style={{ fontSize: `${textSize}px` }}>
        {pad2(metrics.remainingHours)}:{pad2(metrics.remainingMinutes)} left for the day
      </div>
      {showLiveLabel ? (
        <div className="mt-0.5 uppercase tracking-[0.18em] text-[var(--app-accent)]" style={{ fontSize: `${liveSize}px` }}>
          Live Today
        </div>
      ) : null}
    </div>
  );
};
