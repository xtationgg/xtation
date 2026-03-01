import React, { useEffect, useMemo, useRef, useState } from 'react';

type DayTimeOrbProps = {
  showLiveLabel?: boolean;
  className?: string;
  size?: number;
};

type OrbMetrics = {
  progress: number;
  passedHours: number;
  partialHour: number;
  remainingHours: number;
  remainingMinutes: number;
};

type OrbTooltipState = {
  visible: boolean;
  x: number;
  y: number;
  text: string;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const pad2 = (value: number) => String(value).padStart(2, '0');

const SEGMENT_PATHS = [
  'M90.16,30.69c0-.76-.62-1.37-1.38-1.34-3.98.14-7.95.65-11.83,1.55-.74.17-1.2.92-1,1.66h0s4.19,15.65,4.19,15.65c.06.23.29.38.53.35l9.07-1.23c.24-.03.41-.23.41-.47v-16.16Z',
  'M105.87,32.55c.2-.73-.24-1.48-.98-1.65-3.89-.9-7.86-1.42-11.85-1.55-.76-.03-1.38.59-1.38,1.34v16.13c0,.24.18.45.42.48l9.11,1.13c.24.03.46-.12.52-.35l4.16-15.51Z',
  'M120.56,38.42c.38-.65.15-1.5-.52-1.85-3.53-1.89-7.23-3.42-11.04-4.58-.72-.22-1.48.21-1.68.94l-4.15,15.49c-.06.23.06.48.28.57l8.53,3.46c.22.09.48,0,.59-.2l7.98-13.82Z',
  'M133.24,47.89c.54-.54.53-1.41-.02-1.92-2.91-2.71-6.08-5.14-9.49-7.27-.64-.4-1.49-.18-1.86.48l-7.97,13.81c-.12.21-.07.47.12.62l7.34,5.58c.19.14.46.13.63-.04l11.25-11.25Z',
  'M143.01,60.33c.66-.38.88-1.22.48-1.86-2.12-3.4-4.56-6.58-7.27-9.49-.52-.55-1.39-.56-1.92-.02l-11.23,11.24c-.17.17-.19.44-.04.63l5.67,7.3c.15.19.41.24.62.12l13.7-7.91Z',
  'M149.25,74.86c.73-.2,1.16-.95.94-1.67-1.16-3.81-2.69-7.51-4.58-11.04-.36-.67-1.2-.9-1.85-.52l-13.7,7.91c-.21.12-.3.38-.2.6l3.56,8.54c.09.22.33.34.57.28l15.26-4.09Z',
  'M151.5,90.52c.76,0,1.37-.62,1.34-1.37-.14-3.98-.65-7.95-1.55-11.83-.17-.74-.92-1.2-1.66-1h0l-15.24,4.08c-.23.06-.38.29-.35.52l1.2,9.18c.03.24.23.42.47.42h15.78Z',
  'M151.5,92.03h-15.78c-.24,0-.44.18-.47.42l-1.2,9.18c-.03.24.12.46.35.52l15.24,4.08h0c.74.2,1.49-.26,1.66-1,.89-3.88,1.41-7.85,1.55-11.83.03-.76-.59-1.37-1.34-1.37Z',
  'M135.81,116.33l7.96,4.59c.65.38,1.5.15,1.85-.52,1.88-3.53,3.42-7.23,4.58-11.04.22-.72-.21-1.48-.94-1.67l-15.26-4.09c-.23-.06-.47.06-.57.28l-3.56,8.54c-.09.22,0,.48.2.6l5.74,3.31Z',
  'M134.3,133.6c.54.54,1.41.53,1.92-.02,2.71-2.9,5.14-6.08,7.27-9.49.4-.64.18-1.49-.48-1.86l-13.7-7.91c-.21-.12-.47-.07-.62.12l-5.67,7.3c-.15.19-.13.46.04.63l11.23,11.23Z',
  'M121.86,143.37c.38.66,1.22.88,1.86.48,3.4-2.12,6.58-4.56,9.49-7.27.55-.52.56-1.39.02-1.92l-11.25-11.25c-.17-.17-.44-.19-.63-.04l-7.34,5.58c-.19.15-.25.41-.12.62l7.97,13.81Z',
  'M107.32,149.61c.2.73.95,1.16,1.67.94,3.81-1.16,7.51-2.69,11.04-4.58.67-.36.9-1.2.52-1.85l-7.98-13.82c-.12-.21-.37-.29-.59-.2l-8.53,3.46c-.22.09-.35.33-.28.57l4.15,15.49Z',
  'M91.67,151.86c0,.76.62,1.37,1.38,1.34,3.98-.14,7.95-.65,11.83-1.55.74-.17,1.2-.92,1-1.66h0s-4.16-15.51-4.16-15.51c-.06-.23-.28-.38-.52-.35l-9.11,1.13c-.24.03-.42.23-.42.48v16.13Z',
  'M75.96,150h0c-.2.74.26,1.49,1,1.66,3.88.9,7.85,1.41,11.83,1.55.76.03,1.38-.59,1.38-1.34v-16.16c0-.24-.18-.44-.41-.47l-9.07-1.23c-.24-.03-.46.12-.53.35l-4.19,15.65Z',
  'M61.27,144.13c-.38.65-.15,1.5.52,1.85,3.53,1.88,7.23,3.42,11.04,4.58.72.22,1.48-.21,1.67-.94l4.2-15.7c.06-.23-.06-.47-.28-.56l-8.41-3.55c-.22-.09-.48,0-.6.2l-8.15,14.12Z',
  'M48.59,134.66c-.54.54-.53,1.41.02,1.92,2.9,2.71,6.08,5.14,9.49,7.27.64.4,1.49.18,1.86-.48l7.81-13.53.7-1.22c-2.69-1.65-5.19-3.58-7.45-5.75-.19-.18-.48-.18-.66,0l-11.77,11.77Z',
  'M38.81,122.22c-.66.38-.88,1.22-.48,1.86,2.12,3.41,4.56,6.59,7.27,9.49.52.55,1.39.56,1.92.02l11.62-11.62c.17-.17.19-.44.04-.63l-5.51-7.23c-.15-.19-.41-.24-.62-.12l-14.24,8.22Z',
  'M32.57,107.68c-.73.2-1.16.95-.94,1.67,1.16,3.81,2.69,7.51,4.58,11.04.36.67,1.2.9,1.85.52l14.25-8.23c.21-.12.29-.37.2-.6l-3.44-8.4c-.09-.22-.33-.34-.57-.28l-15.93,4.27Z',
  'M30.32,92.03c-.76,0-1.37.62-1.34,1.37.14,3.98.65,7.95,1.55,11.83.17.74.92,1.2,1.66,1h0l15.93-4.27c.23-.06.38-.29.35-.52l-1.16-8.99c-.03-.24-.23-.42-.47-.42h-16.51Z',
  'M32.19,76.32h0c-.74-.2-1.49.26-1.66,1-.89,3.88-1.41,7.85-1.55,11.83-.03.76.59,1.37,1.34,1.37h16.51c.24,0,.44-.18.47-.42l1.16-9c.03-.24-.12-.46-.35-.52l-15.93-4.27Z',
  'M45.59,65.98l-7.53-4.35c-.65-.38-1.49-.15-1.85.52-1.89,3.53-3.42,7.23-4.58,11.04-.22.72.21,1.48.94,1.67l15.93,4.27c.23.06.48-.06.57-.28l3.44-8.4c.09-.22,0-.48-.2-.6l-6.72-3.88Z',
  'M47.53,48.95c-.54-.54-1.41-.53-1.92.02-2.71,2.9-5.14,6.08-7.27,9.49-.4.64-.18,1.49.48,1.86l13.71,7.92,1.14.66c1.61-2.71,3.51-5.22,5.66-7.51.17-.19.17-.48,0-.66l-11.78-11.78Z',
  'M59.96,39.17c-.38-.66-1.22-.88-1.86-.48-3.41,2.13-6.58,4.56-9.49,7.27-.55.52-.56,1.39-.02,1.92l11.6,11.6c.17.17.44.19.63.04l7.19-5.6c.19-.15.24-.41.12-.62l-8.17-14.14Z',
  'M74.5,32.93c-.2-.73-.95-1.16-1.67-.94-3.81,1.16-7.51,2.69-11.04,4.58-.67.36-.9,1.2-.52,1.85l8.16,14.12c.12.21.38.3.6.2l8.41-3.55c.22-.09.34-.33.28-.56l-4.2-15.7Z',
];

const HOUR_LABELS = [
  'Midnight',
  '1 AM',
  '2 AM',
  '3 AM',
  '4 AM',
  '5 AM',
  '6 AM',
  '7 AM',
  '8 AM',
  '9 AM',
  '10 AM',
  '11 AM',
  'Noon',
  '1 PM',
  '2 PM',
  '3 PM',
  '4 PM',
  '5 PM',
  '6 PM',
  '7 PM',
  '8 PM',
  '9 PM',
  '10 PM',
  '11 PM',
];

const SEGMENT_ORIGINS = Array.from({ length: 24 }, (_, index) => {
  const centerX = 91.27;
  const centerY = 91.27;
  const radius = 75;
  const radians = ((-90 + index * 15) * Math.PI) / 180;
  return {
    x: (centerX + radius * Math.cos(radians)).toFixed(2),
    y: (centerY + radius * Math.sin(radians)).toFixed(2),
  };
});

const getTodayMetrics = (timestamp: number): OrbMetrics => {
  const now = new Date(timestamp);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const nextMidnight = dayStart + 86400000;

  const minutesPassed = clamp(Math.floor((timestamp - dayStart) / 60000), 0, 1440);
  const minutesRemaining = clamp(Math.ceil((nextMidnight - timestamp) / 60000), 0, 1440);

  return {
    progress: clamp(minutesPassed / 1440, 0, 1),
    passedHours: clamp(Math.floor(minutesPassed / 60), 0, 24),
    partialHour: clamp((minutesPassed % 60) / 60, 0, 1),
    remainingHours: Math.floor(minutesRemaining / 60),
    remainingMinutes: minutesRemaining % 60,
  };
};

export const DayTimeOrb: React.FC<DayTimeOrbProps> = ({ showLiveLabel = false, className = '', size = 92 }) => {
  const [now, setNow] = useState(() => Date.now());
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const [clickedSegment, setClickedSegment] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<OrbTooltipState>({
    visible: false,
    x: 0,
    y: 0,
    text: '',
  });
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    if (clickedSegment === null) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setClickedSegment(null);
    }, 420);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [clickedSegment]);

  const metrics = useMemo(() => getTodayMetrics(now), [now]);

  const clampedSize = clamp(size, 92, 600);
  const arcRadius = 37.96;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const arcDashOffset = arcCircumference * (1 - metrics.progress);

  const textSize = Math.max(11, Math.round(clampedSize * 0.075));
  const liveSize = Math.max(8, Math.round(clampedSize * 0.07));

  const updateTooltip = (segmentIndex: number, clientX: number, clientY: number) => {
    const suffix =
      segmentIndex < metrics.passedHours
        ? ' · past'
        : segmentIndex === metrics.passedHours
          ? ' · now'
          : ' · upcoming';

    const nextTooltip: OrbTooltipState = {
      visible: true,
      x: clientX,
      y: clientY,
      text: `${HOUR_LABELS[segmentIndex]}${suffix}`,
    };

    setTooltip(nextTooltip);
  };

  const getTooltipStyle = (): React.CSSProperties => {
    if (!tooltip.visible) {
      return { left: -9999, top: -9999 };
    }

    const tooltipWidth = tooltipRef.current?.offsetWidth ?? 140;
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 36;

    let x = tooltip.x + 14;
    let y = tooltip.y - tooltipHeight / 2;

    if (x + tooltipWidth > window.innerWidth - 8) {
      x = tooltip.x - tooltipWidth - 14;
    }

    if (y < 8) {
      y = 8;
    }

    if (y + tooltipHeight > window.innerHeight - 8) {
      y = window.innerHeight - tooltipHeight - 8;
    }

    return {
      left: x,
      top: y,
    };
  };

  return (
    <div className={`day-time-orb-root ${className}`.trim()}>
      <svg
        viewBox="0 0 182.55 182.55"
        role="img"
        aria-label="Today time orb"
        className="day-time-orb-svg"
        style={{ width: clampedSize, height: clampedSize }}
      >
        <defs>
          <radialGradient id="orb-core-gradient" cx="46%" cy="36%" r="64%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#f0ebfa" />
            <stop offset="100%" stopColor="#cfc0e8" />
          </radialGradient>
          <radialGradient id="orb-glow-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#b89fdc" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#b89fdc" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="91.27" cy="91.27" r="90.27" fill="#191322" />

        <g id="orb-segments">
          {SEGMENT_PATHS.map((pathData, index) => {
            const distance = hoveredSegment === null
              ? Infinity
              : Math.min(Math.abs(index - hoveredSegment), 24 - Math.abs(index - hoveredSegment));

            const classNames = ['day-time-orb-segment'];

            if (distance === 0) {
              classNames.push('seg-hovered');
            } else if (distance === 1) {
              classNames.push('seg-neighbor-1');
            } else if (distance === 2) {
              classNames.push('seg-neighbor-2');
            }

            if (clickedSegment === index) {
              classNames.push('seg-clicked');
            }

            const isPast = index < metrics.passedHours;
            const isCurrent = index === metrics.passedHours && metrics.passedHours < 24;

            const opacity = isCurrent ? (0.38 + metrics.partialHour * 0.62).toFixed(3) : '1';

            return (
              <path
                key={`orb-segment-${index}`}
                id={`orb-segment-${index}`}
                d={pathData}
                fill={isPast || isCurrent ? '#63448f' : '#241b33'}
                opacity={opacity}
                className={classNames.join(' ')}
                style={{
                  transformOrigin: `${SEGMENT_ORIGINS[index].x}px ${SEGMENT_ORIGINS[index].y}px`,
                }}
                onMouseEnter={(event) => {
                  setHoveredSegment(index);
                  updateTooltip(index, event.clientX, event.clientY);
                }}
                onMouseMove={(event) => {
                  updateTooltip(index, event.clientX, event.clientY);
                }}
                onMouseLeave={() => {
                  setHoveredSegment(null);
                  setTooltip((previous) => ({ ...previous, visible: false }));
                }}
                onMouseDown={() => {
                  setClickedSegment(index);
                }}
              />
            );
          })}
        </g>

        <circle
          cx="91.27"
          cy="91.27"
          r="37.96"
          fill="none"
          stroke="#8d74b4"
          strokeWidth="2.17"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.1"
        />

        <circle
          cx="91.27"
          cy="91.27"
          r={arcRadius}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.17"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={arcCircumference}
          strokeDashoffset={arcDashOffset}
          transform="rotate(-90 91.27 91.27)"
        />

        <circle className="day-time-orb-glow" cx="91.27" cy="91.27" r="24" fill="url(#orb-glow-grad)" />

        <g className="day-time-orb-core" style={{ mixBlendMode: 'screen' }}>
          <circle cx="91.27" cy="91.27" r="11.64" fill="url(#orb-core-gradient)" />
        </g>
      </svg>

      <div className="day-time-orb-time" style={{ fontSize: `${textSize}px` }}>
        {pad2(metrics.remainingHours)}:{pad2(metrics.remainingMinutes)} left for the day
      </div>

      {showLiveLabel ? (
        <div className="day-time-orb-live" style={{ fontSize: `${liveSize}px` }}>
          Live Today
        </div>
      ) : null}

      <div
        ref={tooltipRef}
        className={`day-time-orb-tooltip ${tooltip.visible ? 'visible' : ''}`}
        style={getTooltipStyle()}
      >
        {tooltip.text}
      </div>
    </div>
  );
};
