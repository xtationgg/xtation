import { describe, expect, it } from 'vitest';
import {
  applySceneStudioRuntimePackImportToCreativeOpsState,
  createDefaultCreativeOpsState,
  rollbackSceneStudioRuntimePackImportInCreativeOpsState,
  resolveCreativeSceneCue,
  resolveCreativeSoundCue,
} from '../src/admin/creativeOps';
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

  it('records a revised publish-log entry when importing a runtime pack into draft via creative ops helper', () => {
    const state = createDefaultCreativeOpsState();
    const next = applySceneStudioRuntimePackImportToCreativeOpsState(state, createRuntimePack(), {
      mode: 'draft',
      occurredAt: 6400,
      actorScope: 'guest',
    });

    expect(next.publishLog[0]?.action).toBe('revised');
    expect(next.publishLog[0]?.targetType).toBe('scene');
    expect(next.publishLog[0]?.occurredAt).toBe(6400);
    expect(next.publishLog[0]?.actorScope).toBe('guest');
    expect(resolveCreativeSceneCue(next, 'profile.deck.open', 'bureau', 'published')?.transitionStyle).not.toBe(
      'sharp'
    );
  });

  it('records a published publish-log entry when importing a runtime pack as published via creative ops helper', () => {
    const state = createDefaultCreativeOpsState();
    const next = applySceneStudioRuntimePackImportToCreativeOpsState(state, createRuntimePack(), {
      mode: 'published',
      occurredAt: 9100,
      actorScope: 'account',
    });

    expect(next.publishLog[0]?.action).toBe('published');
    expect(next.publishLog[0]?.targetType).toBe('scene');
    expect(next.publishLog[0]?.occurredAt).toBe(9100);
    expect(next.publishLog[0]?.actorScope).toBe('account');
    expect(resolveCreativeSceneCue(next, 'profile.deck.open', 'bureau', 'published')?.transitionStyle).toBe(
      'sharp'
    );
  });

  it('rolls back a draft runtime-pack import and restores the previous scene state', () => {
    const state = createDefaultCreativeOpsState();
    const previousDraftTransition =
      resolveCreativeSceneCue(state, 'profile.deck.open', 'bureau', 'draft')?.transitionStyle || null;

    const imported = applySceneStudioRuntimePackImportToCreativeOpsState(state, createRuntimePack(), {
      mode: 'draft',
      occurredAt: 12000,
      actorScope: 'account',
    });
    expect(resolveCreativeSceneCue(imported, 'profile.deck.open', 'bureau', 'draft')?.transitionStyle).toBe(
      'sharp'
    );
    expect(imported.runtimePackHistory[0]?.rolledBackAt).toBeNull();

    const rolledBack = rollbackSceneStudioRuntimePackImportInCreativeOpsState(
      imported,
      imported.runtimePackHistory[0].id,
      {
        occurredAt: 12100,
        actorScope: 'account',
      }
    );

    expect(
      resolveCreativeSceneCue(rolledBack, 'profile.deck.open', 'bureau', 'draft')?.transitionStyle || null
    ).toBe(previousDraftTransition);
    expect(rolledBack.runtimePackHistory[0]?.rolledBackAt).toBe(12100);
    expect(rolledBack.publishLog[0]?.action).toBe('restored');
  });

  it('rolls back a published runtime-pack import and restores published scene data', () => {
    const state = createDefaultCreativeOpsState();
    const previousPublishedTransition =
      resolveCreativeSceneCue(state, 'profile.deck.open', 'bureau', 'published')?.transitionStyle || null;

    const imported = applySceneStudioRuntimePackImportToCreativeOpsState(state, createRuntimePack(), {
      mode: 'published',
      occurredAt: 13000,
      actorScope: 'guest',
    });
    expect(resolveCreativeSceneCue(imported, 'profile.deck.open', 'bureau', 'published')?.transitionStyle).toBe(
      'sharp'
    );

    const rolledBack = rollbackSceneStudioRuntimePackImportInCreativeOpsState(
      imported,
      imported.runtimePackHistory[0].id,
      {
        occurredAt: 13100,
        actorScope: 'guest',
      }
    );

    expect(
      resolveCreativeSceneCue(rolledBack, 'profile.deck.open', 'bureau', 'published')?.transitionStyle || null
    ).toBe(previousPublishedTransition);
    expect(rolledBack.runtimePackHistory[0]?.rolledBackAt).toBe(13100);
    expect(rolledBack.publishLog[0]?.action).toBe('restored');
  });

  it('prevents rolling back an older import while a newer active import exists for the same scene profile', () => {
    const state = createDefaultCreativeOpsState();
    const firstImport = applySceneStudioRuntimePackImportToCreativeOpsState(state, createRuntimePack(), {
      mode: 'draft',
      occurredAt: 15000,
      actorScope: 'account',
    });
    const secondImport = applySceneStudioRuntimePackImportToCreativeOpsState(
      firstImport,
      createRuntimePack(),
      {
        mode: 'draft',
        occurredAt: 15100,
        actorScope: 'account',
      }
    );

    const olderImportId = secondImport.runtimePackHistory[1].id;
    const rollbackAttempt = rollbackSceneStudioRuntimePackImportInCreativeOpsState(
      secondImport,
      olderImportId,
      {
        occurredAt: 15200,
        actorScope: 'account',
      }
    );

    expect(rollbackAttempt).toBe(secondImport);
    expect(rollbackAttempt.runtimePackHistory[1]?.rolledBackAt).toBeNull();
    expect(rollbackAttempt.publishLog[0]?.action).not.toBe('restored');
  });
});
