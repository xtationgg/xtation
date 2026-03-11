import React, { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { readCreativeOpsStateSnapshot, previewCreativeSoundAsset, resolveCreativeSoundCue } from '../admin/creativeOps';
import { useXtationSettings } from '../settings/SettingsProvider';
import { usePresentationEvents } from './PresentationEventsProvider';
import { getXtationEffectiveCueVolumeScale, resolveXtationAudioMixLevel } from './audioMix';

export const PresentationAudioRuntime: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { settings } = useXtationSettings();
  const { lastEvent, emitEvent } = usePresentationEvents();
  const seenEventIdRef = useRef<string | null>(null);
  const cooldownRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!lastEvent) return;
    if (seenEventIdRef.current === null) {
      seenEventIdRef.current = lastEvent.id;
      return;
    }
    if (seenEventIdRef.current === lastEvent.id) return;
    seenEventIdRef.current = lastEvent.id;

    if (!settings.device.audioEnabled) return;
    const previewSoundPackId =
      typeof lastEvent.metadata?.previewSoundPackId === 'string' ? lastEvent.metadata.previewSoundPackId : undefined;
    const previewMode =
      lastEvent.metadata?.previewMode === 'draft' || lastEvent.metadata?.previewMode === 'published'
        ? lastEvent.metadata.previewMode
        : undefined;
    const soundPackId = previewSoundPackId || settings.unlocks.activeSoundPackId;
    if (!soundPackId) return;

    const creativeState = readCreativeOpsStateSnapshot(user?.id || null);
    const { entry, asset } = resolveCreativeSoundCue(
      creativeState,
      lastEvent.name,
      soundPackId,
      previewSoundPackId ? previewMode || 'draft' : 'published'
    );
    if (!entry || !asset) return;

    const lastPlayedAt = cooldownRef.current.get(entry.eventName) || 0;
    const now = Date.now();
    if (now - lastPlayedAt < entry.cooldownMs) {
      return;
    }

    cooldownRef.current.set(entry.eventName, now);
    const groupVolume = resolveXtationAudioMixLevel(settings.device.audioMixLevels, entry.mixGroup);
    if (settings.device.audioVolume <= 0 || groupVolume <= 0) {
      return;
    }
    const volumeScale = getXtationEffectiveCueVolumeScale({
      cueVolume: entry.volume,
      masterVolume: settings.device.audioVolume,
      groupVolume,
    });
    previewCreativeSoundAsset(asset, volumeScale);
    emitEvent('presentation.audio.cue.played', {
      source: 'presentation',
      metadata: {
        eventName: lastEvent.name,
        assetId: asset.id,
        soundPackId,
        mixGroup: entry.mixGroup,
        volume: entry.volume,
        masterVolume: settings.device.audioVolume,
        groupVolume,
        preview: lastEvent.metadata?.preview === true,
        previewMode,
        previewScenario:
          typeof lastEvent.metadata?.previewScenario === 'string'
            ? lastEvent.metadata.previewScenario
            : null,
        previewSceneProfile:
          typeof lastEvent.metadata?.previewSceneProfile === 'string'
            ? lastEvent.metadata.previewSceneProfile
            : null,
        previewSoundPackId,
      },
    });
  }, [
    emitEvent,
    lastEvent,
    settings.device.audioEnabled,
    settings.device.audioMixLevels,
    settings.device.audioVolume,
    settings.unlocks.activeSoundPackId,
    user?.id,
  ]);

  return <>{children}</>;
};
