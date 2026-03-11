import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  DUSK_BRIEF_EVENT,
  persistLatestDuskBrief,
  readLatestDuskBrief,
  type StoredDuskBrief,
} from './bridge';

export const useLatestDuskBrief = () => {
  const { user } = useAuth();
  const activeUserId = user?.id || null;
  const [latestBrief, setLatestBrief] = useState<StoredDuskBrief | null>(() => readLatestDuskBrief(activeUserId));

  useEffect(() => {
    setLatestBrief(readLatestDuskBrief(activeUserId));
  }, [activeUserId]);

  useEffect(() => {
    const handleAssistantBrief = (event: Event) => {
      const detail = (event as CustomEvent<StoredDuskBrief>).detail;
      if (!detail?.title || !detail?.body) return;
      setLatestBrief(persistLatestDuskBrief(detail, activeUserId));
    };

    window.addEventListener(DUSK_BRIEF_EVENT, handleAssistantBrief as EventListener);
    return () => window.removeEventListener(DUSK_BRIEF_EVENT, handleAssistantBrief as EventListener);
  }, [activeUserId]);

  return latestBrief;
};
