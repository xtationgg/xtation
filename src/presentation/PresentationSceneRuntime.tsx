import React, { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { readCreativeOpsStateSnapshot, resolveCreativeSceneCue } from '../admin/creativeOps';
import { usePresentationEvents } from './PresentationEventsProvider';
import { dispatchSceneCueRequest } from './sceneDirectorBus';

export const PresentationSceneRuntime: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { lastEvent } = usePresentationEvents();
  const seenEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastEvent) return;
    if (seenEventIdRef.current === null) {
      seenEventIdRef.current = lastEvent.id;
      return;
    }
    if (seenEventIdRef.current === lastEvent.id) return;
    seenEventIdRef.current = lastEvent.id;

    const creativeState = readCreativeOpsStateSnapshot(user?.id || null);
    const previewSceneProfile =
      lastEvent.metadata?.previewSceneProfile === 'bureau' ||
      lastEvent.metadata?.previewSceneProfile === 'void' ||
      lastEvent.metadata?.previewSceneProfile === 'ops'
        ? lastEvent.metadata.previewSceneProfile
        : undefined;
    const previewMode =
      lastEvent.metadata?.previewMode === 'draft' || lastEvent.metadata?.previewMode === 'published'
        ? lastEvent.metadata.previewMode
        : undefined;
    const cue = resolveCreativeSceneCue(
      creativeState,
      lastEvent.name,
      previewSceneProfile,
      previewSceneProfile ? previewMode || 'draft' : 'published'
    );
    if (!cue) return;
    if (!cue.environmentMode && !cue.cameraShot && !cue.beatPulse && !cue.ringPulse && !cue.groundMotion) return;

    dispatchSceneCueRequest({
      eventName: lastEvent.name,
      cue,
      emittedAt: Date.now(),
      metadata: {
        preview: lastEvent.metadata?.preview === true,
        previewMode,
        previewScenario:
          typeof lastEvent.metadata?.previewScenario === 'string'
            ? lastEvent.metadata.previewScenario
            : null,
        previewSceneProfile,
        previewSoundPackId:
          typeof lastEvent.metadata?.previewSoundPackId === 'string'
            ? lastEvent.metadata.previewSoundPackId
            : null,
        skinId: typeof lastEvent.metadata?.skinId === 'string' ? lastEvent.metadata.skinId : null,
      },
    });
  }, [lastEvent, user?.id]);

  return <>{children}</>;
};
