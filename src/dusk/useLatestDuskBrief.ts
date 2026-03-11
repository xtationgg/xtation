import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { readUserScopedJSON } from '../lib/userScopedStorage';
import { DUSK_BRIEF_EVENT, LATEST_DUSK_BRIEF_KEY, type DuskBriefPayload, type StoredDuskBrief } from './bridge';

const readStoredBrief = (userId: string | null) =>
  readUserScopedJSON<StoredDuskBrief | null>(LATEST_DUSK_BRIEF_KEY, null, userId || 'local');

export const useLatestDuskBrief = () => {
  const { user } = useAuth();
  const activeUserId = user?.id || null;
  const [latestBrief, setLatestBrief] = useState<StoredDuskBrief | null>(() => readStoredBrief(activeUserId));

  useEffect(() => {
    setLatestBrief(readStoredBrief(activeUserId));
  }, [activeUserId]);

  useEffect(() => {
    const handleAssistantBrief = (event: Event) => {
      const detail = (event as CustomEvent<DuskBriefPayload>).detail;
      if (!detail?.title || !detail?.body) return;
      setLatestBrief({
        ...detail,
        createdAt: detail.createdAt || Date.now(),
        receivedAt: Date.now(),
      });
    };

    window.addEventListener(DUSK_BRIEF_EVENT, handleAssistantBrief as EventListener);
    return () => window.removeEventListener(DUSK_BRIEF_EVENT, handleAssistantBrief as EventListener);
  }, []);

  return latestBrief;
};
