import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  DUSK_BRIEF_EVENT,
  persistLatestDuskBrief,
  readLatestDuskBrief,
  type StoredDuskBrief,
} from './bridge';

const GUEST_SCOPE_ID = 'anon';

export const useLatestDuskBrief = () => {
  const { user } = useAuth();
  const scopeId = user?.id || GUEST_SCOPE_ID;
  const [latestBrief, setLatestBrief] = useState<StoredDuskBrief | null>(() => readLatestDuskBrief(scopeId));

  useEffect(() => {
    setLatestBrief(readLatestDuskBrief(scopeId));
  }, [scopeId]);

  useEffect(() => {
    const handleAssistantBrief = (event: Event) => {
      const detail = (event as CustomEvent<StoredDuskBrief>).detail;
      if (!detail?.title || !detail?.body) return;
      setLatestBrief(persistLatestDuskBrief(detail, scopeId));
    };

    window.addEventListener(DUSK_BRIEF_EVENT, handleAssistantBrief as EventListener);
    return () => window.removeEventListener(DUSK_BRIEF_EVENT, handleAssistantBrief as EventListener);
  }, [scopeId]);

  return latestBrief;
};
