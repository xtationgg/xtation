import { useEffect, useState } from 'react';
import { useOptionalAuth } from '../auth/AuthProvider';
import { USER_SCOPED_STORAGE_EVENT } from '../lib/userScopedStorage';
import { DUSK_TOOL_AUDIT_EVENT, readDuskToolAudit, type DuskToolAuditEntry } from './toolAudit';

const readAudit = (userId: string | null) => readDuskToolAudit(userId || 'local');

export const useDuskToolAudit = () => {
  const auth = useOptionalAuth();
  const activeUserId = auth?.user?.id || null;
  const [audit, setAudit] = useState<DuskToolAuditEntry[]>(() => readAudit(activeUserId));

  useEffect(() => {
    setAudit(readAudit(activeUserId));
  }, [activeUserId]);

  useEffect(() => {
    const refresh = () => setAudit(readAudit(activeUserId));
    window.addEventListener(DUSK_TOOL_AUDIT_EVENT, refresh as EventListener);
    window.addEventListener(USER_SCOPED_STORAGE_EVENT, refresh as EventListener);
    return () => {
      window.removeEventListener(DUSK_TOOL_AUDIT_EVENT, refresh as EventListener);
      window.removeEventListener(USER_SCOPED_STORAGE_EVENT, refresh as EventListener);
    };
  }, [activeUserId]);

  return audit;
};
