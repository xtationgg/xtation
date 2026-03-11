import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  CREATIVE_OPS_STORAGE_KEY,
  CREATIVE_OPS_SYNC_EVENT,
  LOCAL_CREATIVE_OPS_STORAGE_KEY,
  getCreativeSkinIdFromThemeId,
  persistCreativeActiveSkinId,
  readCreativeOpsStateSnapshot,
  resolvePublishedCreativeSkin,
} from '../admin/creativeOps';
import { useXtationSettings } from '../settings/SettingsProvider';
import { useTheme } from '../theme/ThemeProvider';
import { getUserScopedKey } from '../lib/userScopedStorage';
import { usePresentationEvents } from './PresentationEventsProvider';

export const CreativeOpsRuntime: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id || null;
  const { theme, accent, setTheme, setAccent } = useTheme();
  const { settings, setActiveThemeId, setActiveSoundPackId } = useXtationSettings();
  const { emitEvent } = usePresentationEvents();
  const [syncTick, setSyncTick] = useState(0);
  const lastFallbackKeyRef = useRef<string | null>(null);

  const runtimeScopeKey = useMemo(() => userId || 'local', [userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const scheduleRefresh = () => setSyncTick((value) => value + 1);
    const scopedStorageKey = userId ? getUserScopedKey(CREATIVE_OPS_STORAGE_KEY, userId) : null;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_CREATIVE_OPS_STORAGE_KEY || event.key === scopedStorageKey) {
        scheduleRefresh();
      }
    };

    const handleSync = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      if (!detail?.scope || detail.scope === runtimeScopeKey) {
        scheduleRefresh();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(CREATIVE_OPS_SYNC_EVENT, handleSync as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CREATIVE_OPS_SYNC_EVENT, handleSync as EventListener);
    };
  }, [runtimeScopeKey, userId]);

  useEffect(() => {
    const creativeState = readCreativeOpsStateSnapshot(userId);
    const currentThemeSkinId = getCreativeSkinIdFromThemeId(settings.unlocks.activeThemeId);
    const currentSoundPackId = settings.unlocks.activeSoundPackId || null;
    const currentSkin =
      (currentThemeSkinId
        ? creativeState.skinPacks.find((pack) => pack.id === currentThemeSkinId) || null
        : currentSoundPackId
        ? creativeState.skinPacks.find((pack) => pack.soundPackId === currentSoundPackId) || null
        : null) || null;

    if (!currentSkin) {
      lastFallbackKeyRef.current = null;
      return;
    }

    if (currentSkin.status === 'published') {
      if (creativeState.activeSkinId !== currentSkin.id) {
        persistCreativeActiveSkinId(currentSkin.id, userId);
      }
      lastFallbackKeyRef.current = null;
      return;
    }

    const fallbackSkin = resolvePublishedCreativeSkin(creativeState, currentSkin.id, currentSoundPackId);
    if (!fallbackSkin) return;

    const fallbackThemeId = `creative:${fallbackSkin.id}`;
    const fallbackEventKey = `${runtimeScopeKey}:${currentSkin.id}->${fallbackSkin.id}`;
    const alreadyApplied =
      settings.unlocks.activeThemeId === fallbackThemeId &&
      settings.unlocks.activeSoundPackId === fallbackSkin.soundPackId &&
      theme === fallbackSkin.theme &&
      accent === fallbackSkin.accent &&
      creativeState.activeSkinId === fallbackSkin.id;

    if (alreadyApplied) {
      lastFallbackKeyRef.current = null;
      return;
    }

    persistCreativeActiveSkinId(fallbackSkin.id, userId);
    setTheme(fallbackSkin.theme);
    setAccent(fallbackSkin.accent);
    setActiveThemeId(fallbackThemeId);
    setActiveSoundPackId(fallbackSkin.soundPackId);

    if (lastFallbackKeyRef.current !== fallbackEventKey) {
      emitEvent('station.skin.fallback', {
        source: 'runtime',
        metadata: {
          scope: runtimeScopeKey,
          fromSkinId: currentSkin.id,
          toSkinId: fallbackSkin.id,
          reason: 'draft_pack_blocked',
        },
      });
      lastFallbackKeyRef.current = fallbackEventKey;
    }
  }, [
    accent,
    emitEvent,
    runtimeScopeKey,
    settings.unlocks.activeSoundPackId,
    settings.unlocks.activeThemeId,
    setAccent,
    setActiveSoundPackId,
    setActiveThemeId,
    setTheme,
    syncTick,
    theme,
    userId,
  ]);

  return <>{children}</>;
};
