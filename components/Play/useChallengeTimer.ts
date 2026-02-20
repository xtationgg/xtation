import { useCallback, useEffect, useRef, useState } from 'react';

export type TimerMode = 'up' | 'down';

export const useChallengeTimer = () => {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const initialRef = useRef(0);
  const modeRef = useRef<TimerMode>('up');

  const reset = useCallback((nextSeconds = 0) => {
    setRunning(false);
    setSeconds(nextSeconds);
    startRef.current = null;
    initialRef.current = nextSeconds;
  }, []);

  const start = useCallback((initialSeconds: number, mode: TimerMode) => {
    modeRef.current = mode;
    initialRef.current = initialSeconds;
    startRef.current = Date.now();
    setSeconds(initialSeconds);
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      if (!startRef.current) return;
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      if (modeRef.current === 'up') {
        setSeconds(initialRef.current + elapsed);
        return;
      }
      const next = Math.max(initialRef.current - elapsed, 0);
      setSeconds(next);
      if (next === 0) {
        setRunning(false);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [running]);

  return { seconds, running, start, stop, reset };
};
