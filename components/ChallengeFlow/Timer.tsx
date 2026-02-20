import React, { useEffect, useRef, useState } from 'react';

interface TimerProps {
  initialSeconds: number;
  isActive: boolean;
  direction?: 'down' | 'up';
  className?: string;
  onComplete?: () => void;
}

export const Timer: React.FC<TimerProps> = ({
  initialSeconds,
  isActive,
  direction = 'down',
  className = '',
  onComplete
}) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const wasActive = useRef(isActive);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (isActive && !wasActive.current) {
      setSeconds(initialSeconds);
    }
    wasActive.current = isActive;
  }, [isActive, initialSeconds]);

  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => {
      setSeconds((current) => {
        if (direction === 'down') {
          const next = Math.max(0, current - 1);
          if (current === 1) {
            onComplete?.();
          }
          return next;
        }
        return current + 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [isActive, direction, onComplete]);

  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  return <span className={className}>{minutes}:{secs}</span>;
};
