import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  buildPresentationEventRecord,
  MAX_PRESENTATION_EVENTS,
  type PresentationEventFamilySummary,
  type PresentationEventInput,
  type PresentationEventRecord,
  PRESENTATION_EVENTS_CHANGE_EVENT,
  PRESENTATION_EVENTS_STORAGE_KEY,
  summarizePresentationEventFamilies,
} from './events';

interface PresentationEventsContextValue {
  recentEvents: PresentationEventRecord[];
  lastEvent: PresentationEventRecord | null;
  familySummaries: PresentationEventFamilySummary[];
  storageScope: string;
  emitEvent: (name: string, options?: Omit<PresentationEventInput, 'name'>) => PresentationEventRecord;
  clearEvents: () => void;
}

const PresentationEventsContext = createContext<PresentationEventsContextValue | null>(null);

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  const storage = window.localStorage as Partial<Storage> | undefined;
  if (!storage || typeof storage.getItem !== 'function') return null;
  return storage;
};

const resolveStorageScope = (userId?: string | null) => {
  if (!userId) return 'guest';
  return userId.trim() || 'guest';
};

const resolveStorageKey = (userId?: string | null) =>
  `${PRESENTATION_EVENTS_STORAGE_KEY}:${resolveStorageScope(userId)}`;

const readStoredEvents = (userId?: string | null) => {
  const storage = getStorage();
  if (!storage) return [] as PresentationEventRecord[];
  const raw = storage.getItem(resolveStorageKey(userId));
  if (!raw) return [] as PresentationEventRecord[];
  try {
    const parsed = JSON.parse(raw) as PresentationEventRecord[];
    if (!Array.isArray(parsed)) return [] as PresentationEventRecord[];
    return parsed.filter((entry) => Boolean(entry?.id && entry?.name));
  } catch {
    return [] as PresentationEventRecord[];
  }
};

const writeStoredEvents = (events: PresentationEventRecord[], userId?: string | null) => {
  const storage = getStorage();
  if (!storage || typeof storage.setItem !== 'function') return;
  storage.setItem(resolveStorageKey(userId), JSON.stringify(events));
};

const clearStoredEvents = (userId?: string | null) => {
  const storage = getStorage();
  if (!storage || typeof storage.removeItem !== 'function') return;
  storage.removeItem(resolveStorageKey(userId));
};

const buildFingerprint = (record: Pick<PresentationEventRecord, 'name' | 'source' | 'metadata'>) => {
  const metadata = record.metadata ? JSON.stringify(record.metadata, Object.keys(record.metadata).sort()) : '';
  return `${record.name}::${record.source}::${metadata}`;
};

export const PresentationEventsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [recentEvents, setRecentEvents] = useState<PresentationEventRecord[]>(() => readStoredEvents(userId));
  const lastEmittedRef = useRef<{ fingerprint: string; occurredAt: number; record: PresentationEventRecord } | null>(null);

  useEffect(() => {
    setRecentEvents(readStoredEvents(userId));
  }, [userId]);

  const storageScope = useMemo(() => resolveStorageScope(userId), [userId]);

  const emitEvent = useCallback(
    (name: string, options: Omit<PresentationEventInput, 'name'> = {}) => {
      const nextRecord = buildPresentationEventRecord({
        name,
        source: options.source,
        metadata: options.metadata,
      });
      const fingerprint = buildFingerprint(nextRecord);
      const previous = lastEmittedRef.current;
      if (previous && previous.fingerprint === fingerprint && nextRecord.occurredAt - previous.occurredAt < 450) {
        return previous.record;
      }
      lastEmittedRef.current = {
        fingerprint,
        occurredAt: nextRecord.occurredAt,
        record: nextRecord,
      };
      setRecentEvents((current) => {
        const nextEvents = [nextRecord, ...current].slice(0, MAX_PRESENTATION_EVENTS);
        writeStoredEvents(nextEvents, userId);
        return nextEvents;
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(PRESENTATION_EVENTS_CHANGE_EVENT, {
            detail: {
              scope: resolveStorageScope(userId),
              event: nextRecord,
            },
          })
        );
      }
      return nextRecord;
    },
    [userId]
  );

  const clearEvents = useCallback(() => {
    clearStoredEvents(userId);
    setRecentEvents([]);
    lastEmittedRef.current = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(PRESENTATION_EVENTS_CHANGE_EVENT, {
          detail: {
            scope: resolveStorageScope(userId),
            event: null,
            cleared: true,
          },
        })
      );
    }
  }, [userId]);

  const familySummaries = useMemo(() => summarizePresentationEventFamilies(recentEvents), [recentEvents]);

  const value = useMemo<PresentationEventsContextValue>(
    () => ({
      recentEvents,
      lastEvent: recentEvents[0] || null,
      familySummaries,
      storageScope,
      emitEvent,
      clearEvents,
    }),
    [clearEvents, emitEvent, familySummaries, recentEvents, storageScope]
  );

  return <PresentationEventsContext.Provider value={value}>{children}</PresentationEventsContext.Provider>;
};

export const usePresentationEvents = () => {
  const context = useContext(PresentationEventsContext);
  if (!context) {
    throw new Error('usePresentationEvents must be used inside PresentationEventsProvider');
  }
  return context;
};

export const useOptionalPresentationEvents = () => useContext(PresentationEventsContext);
