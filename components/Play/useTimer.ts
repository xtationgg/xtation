import { useEffect, useRef, useState } from 'react';

export const useTimer = (isRunning: boolean) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSecondsRef = useRef(0);

  useEffect(() => {
    if (!isRunning) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      startRef.current = null;
      lastSecondsRef.current = 0;
      setElapsedSeconds(0);
      return;
    }

    startRef.current = performance.now();
    lastSecondsRef.current = 0;
    setElapsedSeconds(0);

    const tick = (now: number) => {
      if (startRef.current === null) return;
      const seconds = Math.floor((now - startRef.current) / 1000);
      if (seconds !== lastSecondsRef.current) {
        lastSecondsRef.current = seconds;
        setElapsedSeconds(seconds);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isRunning]);

  return elapsedSeconds;
};
