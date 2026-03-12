import { describe, expect, it } from 'vitest';
import { createDefaultCreativeOpsState, resolveCreativeSceneCue, resolveCreativeSoundCue } from '../src/admin/creativeOps';
import {
  applySceneStudioRuntimePack,
  isSceneStudioRuntimePackV1,
  resolveSceneStudioRuntimePackSegments,
  summarizeSceneStudioRuntimePack,
  type SceneStudioRuntimePackV1,
} from '../src/sceneStudio/runtimePack';

const createRuntimePack = (): SceneStudioRuntimePackV1 => ({
  manifest: {
    format: 'xtation.scene-runtime-pack',
    version: 1,
    exportId: 'export-bureau-refresh',
    name: 'Bureau Refresh',
    description: 'Updated bureau runtime package',
    sceneProfile: 'bureau',
    exportedAt: '2026-03-12T12:00:00Z',
  },
  scenePack: {
    id: 'scene-pack-bureau-refresh',
    name: 'Bureau Refresh Pack',
    description: 'Imported from Scene Studio',
  },
  skin: {
    theme: 'bureau',
    accent: 'amber',
    soundPackId: 'soundpack-bureau-amber',
    motionProfile: 'cinematic',
    screenProfile: 'bureau',
    avatarProfile: 'station',
  },
  soundEventMap: [
    {
      soundPackId: 'soundpack-bureau-amber',
      eventName: 'profile.deck.open',
      mixGroup: 'ui',
      assetId: 'builtin-success',
      volume: 0.76,
      cooldownMs: 120,
    },
  ],
  sceneCues: [
    {
      sceneProfile: 'bureau',
      eventName: 'profile.deck.open',
      environmentMode: 'bureau',
      cameraShot: 'hero',
      screenMode: 'brief',
      transitionStyle: 'sharp',
      cameraOrbitSpeed: 0.08,
      beatPulse: false,
      ringPulse: true,
      groundMotion: false,
      ambientAtmosphere: 0.64,
      cueDurationMs: 720,
      lightRig: {
        keyIntensity: 1.3,
        fillIntensity: 0.6,
        keyColor: '#f1bf78',
        fillColor: '#5e4426',
      },
    },
  ],
  sceneStates: [
    {
      sceneProfile: 'bureau',
      stateKey: 'profile.focus',
      environmentMode: 'bureau',
      cameraShot: 'hero',
      screenMode: 'focus',
      cameraOrbitSpeed: 0.04,
      ambientAtmosphere: 0.56,
      beatPulse: false,
      ringPulse: false,
      groundMotion: false,
      modelFloat: false,
      hideLightSource: false,
      lightRig: {
        keyIntensity: 1.2,
        fillIntensity: 0.55,
        keyColor: '#ffcc8d',
        fillColor: '#5f4527',
      },
    },
  ],
  sceneStateBindings: [
    {
      sceneProfile: 'bureau',
      eventName: 'play.session.start',
      stateKey: 'profile.focus',
      holdMs: 4200,
    },
  ],
  sceneScreenPresets: [
    {
      sceneProfile: 'bureau',
      mode: 'focus',
      missionLabel: 'FOCUS',
      roleLabel: 'OPERATOR',
      traceLabel: 'TRACK',
      fallbackMissionText: 'Focus screen live.',
      fallbackRoleText: 'Maintain the loop.',
    },
  ],
  sceneAvatarPresets: [
    {
      sceneProfile: 'bureau',
      avatarProfile: 'station',
      shellLabel: 'Profile Deck',
      identityBadge: 'Bureau Station',
      deckPrompt: 'Return to the shell.',
      loadoutTitle: 'Operational Layer',
      loadoutDescription: 'Runtime-equipped station assets.',
      capabilityLabel: 'Capability',
      relayLabel: 'Profile Relay',
      statusLabel: 'Stage ready',
      roleFallbackText: 'Station Core',
      previewRoleText: 'Profile preview',
      loadoutSlots: [
        {
          id: 'slot-shell',
          label: 'shell',
          icon: 'hexagon',
          equipped: true,
          binding: 'theme',
        },
      ],
      presencePresets: [
        {
          state: 'ready',
          label: 'READY',
          deckPrompt: 'Station shell ready.',
          statusLabel: 'Ready',
          roleFallbackText: 'Ready state',
          previewRoleText: 'Ready preview',
          sceneStateOverride: 'profile.active',
          screenModeOverride: 'success',
        },
      ],
    },
  ],
  sceneResponsePresets: [
    {
      sceneProfile: 'bureau',
      responseType: 'reward',
      environmentMode: 'bureau',
      cameraShot: 'hero',
      screenMode: 'success',
      transitionStyle: 'surge',
      cameraOrbitSpeed: 0.09,
      targetStateKey: 'profile.active',
      holdMs: 2600,
      beatPulse: true,
      ringPulse: true,
      groundMotion: false,
      ambientAtmosphere: 0.74,
      cueDurationMs: 900,
      lightRig: {
        keyIntensity: 1.45,
        fillIntensity: 0.72,
        keyColor: '#ffd18f',
        fillColor: '#6f4f2b',
      },
    },
  ],
  sceneLightPresets: [
    {
      sceneProfile: 'bureau',
      presetKey: 'reward',
      lightRig: {
        keyIntensity: 1.45,
        fillIntensity: 0.72,
        keyColor: '#ffd18f',
        fillColor: '#6f4f2b',
      },
    },
  ],
  sceneMotionPresets: [
    {
      sceneProfile: 'bureau',
      presetKey: 'reward',
      transitionStyle: 'surge',
      cameraOrbitSpeed: 0.09,
      cueDurationMs: 900,
    },
  ],
});

describe('scene studio runtime pack integration', () => {
  it('detects the v1 runtime pack contract and included segments', () => {
    const pack = createRuntimePack();
    expect(isSceneStudioRuntimePackV1(pack)).toBe(true);
    expect(resolveSceneStudioRuntimePackSegments(pack)).toEqual([
      'soundEventMap',
      'sceneCues',
      'sceneStates',
      'sceneStateBindings',
      'sceneScreenPresets',
      'sceneAvatarPresets',
      'sceneResponsePresets',
      'sceneLightPresets',
      'sceneMotionPresets',
    ]);
  });

  it('summarizes the runtime pack against the current creative state', () => {
    const state = createDefaultCreativeOpsState();
    const summary = summarizeSceneStudioRuntimePack(createRuntimePack(), state);
    expect(summary.sceneProfile).toBe('bureau');
    expect(summary.scenePack.name).toBe('Bureau Refresh Pack');
    expect(summary.skinPatch.motionProfile).toBe('cinematic');
    expect(summary.includedSegments).toContain('sceneAvatarPresets');
  });

  it('applies a draft runtime pack without mutating published scene data', () => {
    const state = createDefaultCreativeOpsState();
    const next = applySceneStudioRuntimePack(state, createRuntimePack(), {
      mode: 'draft',
      occurredAt: 1000,
    });

    expect(resolveCreativeSceneCue(next, 'profile.deck.open', 'bureau', 'draft')?.transitionStyle).toBe('sharp');
    expect(resolveCreativeSceneCue(next, 'profile.deck.open', 'bureau', 'published')?.transitionStyle).not.toBe('sharp');
    expect(resolveCreativeSoundCue(next, 'profile.deck.open', 'soundpack-bureau-amber', 'draft').entry?.assetId).toBe(
      'builtin-success'
    );
    expect(resolveCreativeSoundCue(next, 'profile.deck.open', 'soundpack-bureau-amber', 'published').entry?.assetId).not.toBe(
      'builtin-success'
    );
    expect(next.scenePacks.find((entry) => entry.sceneProfile === 'bureau')?.status).toBe('draft');
  });

  it('applies a published runtime pack into both draft and published runtime state', () => {
    const state = createDefaultCreativeOpsState();
    const next = applySceneStudioRuntimePack(state, createRuntimePack(), {
      mode: 'published',
      occurredAt: 5000,
    });

    expect(resolveCreativeSceneCue(next, 'profile.deck.open', 'bureau', 'published')?.transitionStyle).toBe('sharp');
    expect(resolveCreativeSoundCue(next, 'profile.deck.open', 'soundpack-bureau-amber', 'published').entry?.assetId).toBe(
      'builtin-success'
    );
    const scenePack = next.scenePacks.find((entry) => entry.sceneProfile === 'bureau');
    expect(scenePack?.status).toBe('published');
    expect(scenePack?.publishedRevision).toBeGreaterThanOrEqual(1);
    expect(scenePack?.lastPublishedAt).toBe(5000);
  });
});
