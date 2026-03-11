import { useEffect, useState } from 'react';
import { useOptionalAuth } from '../auth/AuthProvider';
import { USER_SCOPED_STORAGE_EVENT } from '../lib/userScopedStorage';
import {
  DUSK_MANAGED_PROVIDER_SESSIONS_EVENT,
  readManagedProviderSessions,
  type DuskManagedProviderSessionEntry,
} from './managedProviderSession';

export const useManagedProviderSessions = () => {
  const auth = useOptionalAuth();
  const userId = auth?.user?.id || null;
  const [sessions, setSessions] = useState<DuskManagedProviderSessionEntry[]>(() => readManagedProviderSessions(userId));

  useEffect(() => {
    const refresh = () => setSessions(readManagedProviderSessions(userId));
    refresh();
    window.addEventListener(DUSK_MANAGED_PROVIDER_SESSIONS_EVENT, refresh as EventListener);
    window.addEventListener(USER_SCOPED_STORAGE_EVENT, refresh as EventListener);
    return () => {
      window.removeEventListener(DUSK_MANAGED_PROVIDER_SESSIONS_EVENT, refresh as EventListener);
      window.removeEventListener(USER_SCOPED_STORAGE_EVENT, refresh as EventListener);
    };
  }, [userId]);

  return sessions;
};
