import React, { useEffect, useState } from 'react';

interface EyeOrbProps {
  onClick: () => void;
  onMouseEnter?: () => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  triggerPulseKey?: string | number | null;
}

export const EyeOrb: React.FC<EyeOrbProps> = ({
  onClick,
  onMouseEnter,
  ariaLabel = 'Play',
  className = '',
  disabled = false,
  triggerPulseKey,
}) => {
  const [eventPulseActive, setEventPulseActive] = useState(false);

  useEffect(() => {
    if (triggerPulseKey === undefined || triggerPulseKey === null) return undefined;
    setEventPulseActive(false);
    const raf = window.requestAnimationFrame(() => {
      setEventPulseActive(true);
    });
    const timer = window.setTimeout(() => {
      setEventPulseActive(false);
    }, 900);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [triggerPulseKey]);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={[
        'eye-orb-trigger group relative flex h-[132px] w-[132px] items-center justify-center p-0 text-[var(--app-text)]',
        'transition-colors focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)]',
        eventPulseActive ? 'eye-orb-trigger--event' : '',
        disabled ? 'opacity-60 cursor-not-allowed' : '',
        className,
      ].join(' ')}
    >
      <span className="eye-orb" aria-hidden="true">
        <svg className="eye-orb__svg" viewBox="0 0 28.35 28.35" role="presentation">
          <defs>
            <style>
              {`
                .st0 { fill: url(#radial-gradient); }
                .st1 { fill: url(#radial-gradient1); }
                .st1, .st2, .st3 { fill-opacity: .5; }
                .st2 { fill: url(#radial-gradient2); }
                .st4 { fill: #fff; }
                .st5 { fill: none; stroke: #ffefde; stroke-miterlimit: 10; stroke-width: .33px; }
                .st6 { fill: #f6f7f7; }
                .st3 { fill: url(#linear-gradient); }
              `}
            </style>
            <radialGradient
              id="radial-gradient"
              cx="113.52"
              cy="4804.09"
              fx="113.52"
              fy="4804.09"
              r="13.46"
              gradientTransform="translate(-3302.42 3491.47) rotate(-135)"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset=".38" stopColor="#000" />
              <stop offset=".57" stopColor="#553478" />
              <stop offset=".59" stopColor="#583477" />
              <stop offset=".61" stopColor="#623774" />
              <stop offset=".63" stopColor="#733b70" />
              <stop offset=".65" stopColor="#8b406a" />
              <stop offset=".66" stopColor="#aa4762" />
              <stop offset=".68" stopColor="#cf5059" />
              <stop offset=".69" stopColor="#ea5753" />
              <stop offset=".73" stopColor="#f6bb4a" />
              <stop offset=".74" stopColor="#f2bb4f" />
              <stop offset=".76" stopColor="#e9bb5f" />
              <stop offset=".78" stopColor="#d9bb79" />
              <stop offset=".8" stopColor="#c3bb9e" />
              <stop offset=".82" stopColor="#aabcc9" />
              <stop offset="1" stopColor="#fff" />
            </radialGradient>
            <radialGradient
              id="radial-gradient1"
              cx="-3487.81"
              cy="3471.88"
              fx="-3487.81"
              fy="3471.88"
              r="12.96"
              gradientTransform="translate(2.75 4934.93) rotate(135)"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset=".4" stopColor="#ffe1ba" stopOpacity="0" />
              <stop offset=".46" stopColor="#ffe2bd" stopOpacity=".05" />
              <stop offset=".56" stopColor="#ffe6c7" stopOpacity=".19" />
              <stop offset=".7" stopColor="#ffedd7" stopOpacity=".42" />
              <stop offset=".87" stopColor="#fff6ec" stopOpacity=".73" />
              <stop offset="1" stopColor="#fff" />
            </radialGradient>
            <radialGradient
              id="radial-gradient2"
              cx="-3487.73"
              cy="3471.41"
              fx="-3487.73"
              fy="3471.41"
              r="13.98"
              gradientTransform="translate(2.75 4934.93) rotate(135)"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset=".39" stopColor="#ffe1ba" stopOpacity="0" />
              <stop offset="1" stopColor="#fff" />
            </radialGradient>
            <linearGradient
              id="linear-gradient"
              x1="-76.01"
              y1="-32.48"
              x2="-81.83"
              y2="-25.99"
              gradientTransform="translate(96.8 41.83) rotate(2.28)"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#ffe1ba" stopOpacity="0" />
            </linearGradient>
          </defs>

          <g id="orb-root">
            <g id="orb-core">
              <circle className="st4" cx="14.17" cy="14.17" r="13.9" />
            </g>
            <g id="orb-ring">
              <circle className="st0" cx="14.17" cy="14.17" r="13.9" />
            </g>
            <g id="orb-gloss">
              <g>
                <path
                  className="st1"
                  d="M6.99,23.98c4.26,3.13,10.1,3.13,14.36,0,.8-.58.88-1.74.18-2.44l-7.36-7.36-7.36,7.36c-.7.7-.61,1.86.18,2.44Z"
                />
                <path
                  className="st2"
                  d="M4.36,6.99c-1.18,1.61-1.92,3.45-2.21,5.35-.15.97.62,1.83,1.6,1.83h10.42s-7.36-7.36-7.36-7.36c-.7-.7-1.86-.61-2.44.18Z"
                />
                <path
                  className="st3"
                  d="M12.83,3.01c.42-1.16,6.12-.32,9.76,3.91,3.64,4.24,3.46,9.46,2.03,9.66-1.43.2-.95-2.32-5.2-7.47-3.97-4.81-7.29-4.17-6.59-6.1Z"
                />
              </g>
              <path
                className="st5"
                d="M13.99,2.51c1-1.42,5.71-.3,9.1,3.65,3.4,3.96,3.23,8.83,1.9,9.01-1.33.19-.89-2.16-4.85-6.97-3.7-4.49-7.04-4.43-6.15-5.7Z"
              />
            </g>
            <g id="reticle-group">
              <g id="arrow-w">
                <polygon className="st6" points="19.62 15.85 19.62 17.49 17.49 17.49 17.49 19.62 15.85 19.62 15.85 15.85 19.62 15.85" />
              </g>
              <g id="arrow-s">
                <polygon className="st6" points="8.73 15.85 8.73 17.49 10.86 17.49 10.86 19.62 12.49 19.62 12.49 15.85 8.73 15.85" />
              </g>
              <g id="arrow-e">
                <polygon className="st6" points="8.73 12.49 8.73 10.86 10.86 10.86 10.86 8.73 12.49 8.73 12.49 12.49 8.73 12.49" />
              </g>
              <g id="arrow-n">
                <polygon className="st6" points="19.62 12.49 19.62 10.86 17.49 10.86 17.49 8.73 15.85 8.73 15.85 12.49 19.62 12.49" />
              </g>
            </g>
          </g>
        </svg>
      </span>
    </button>
  );
};

export default EyeOrb;
