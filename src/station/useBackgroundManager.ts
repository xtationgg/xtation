/**
 * useBackgroundManager — manages per-view custom backgrounds with IndexedDB persistence.
 *
 * Extracted from App.tsx to reduce monolith size.
 */

import { useCallback, useRef, useState } from 'react';
import { ClientView } from '../../types';

export const defaultViewBackgrounds: Record<ClientView, string | null> = {
  [ClientView.HOME]: null,
  [ClientView.LAB]: null,
  [ClientView.ADMIN]: null,
  [ClientView.TFT]: null,
  [ClientView.MULTIPLAYER]: null,
  [ClientView.PROFILE]: null,
  [ClientView.INVENTORY]: null,
  [ClientView.STORE]: null,
  [ClientView.UI_KIT]: null,
  [ClientView.SETTINGS]: null,
  [ClientView.LOBBY]: null,
  [ClientView.MATCH_FOUND]: null,
  [ClientView.CHAMP_SELECT]: null,
  [ClientView.LOOT]: null,
};

const openBgDB = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('ViewBackgroundDB', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('backgrounds')) {
        db.createObjectStore('backgrounds');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export async function saveBackgroundBlob(file: File) {
  const db = await openBgDB();
  const key = `bg-${Date.now()}`;
  const tx = db.transaction('backgrounds', 'readwrite');
  tx.objectStore('backgrounds').put(file, key);
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(null);
    tx.onerror = () => reject(tx.error);
  });
  return `idb:${key}`;
}

export async function loadBackgroundBlob(idbKey: string) {
  const key = idbKey.replace('idb:', '');
  try {
    const db = await openBgDB();
    const tx = db.transaction('backgrounds', 'readonly');
    const req = tx.objectStore('backgrounds').get(key);
    const blob: Blob | undefined = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
    return blob || null;
  } catch (err) {
    console.error('Failed to load background blob', err);
    return null;
  }
}

export function useBackgroundManager() {
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [viewBackgrounds, setViewBackgrounds] = useState<Record<ClientView, string | null>>(defaultViewBackgrounds);
  const [resolvedBackgrounds, setResolvedBackgrounds] = useState<Record<string, string>>({});
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const updateViewBackground = useCallback(
    (view: ClientView, value: string | null) => {
      setViewBackgrounds((prev) => ({ ...prev, [view]: value }));
    },
    []
  );

  return {
    customBackground,
    setCustomBackground,
    viewBackgrounds,
    setViewBackgrounds,
    resolvedBackgrounds,
    setResolvedBackgrounds,
    backgroundInputRef,
    updateViewBackground,
    saveBackgroundBlob,
    loadBackgroundBlob,
  };
}
