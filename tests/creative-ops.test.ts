import { describe, expect, it } from 'vitest';
import {
  applyCreativeAvatarProfileTemplateToSceneAvatarPresets,
  buildCreativeSkinPackageSummary,
  collectCreativeSceneAvatarPresetDifferences,
  applyCreativeSceneLightPresetToResponsePresets,
  applyCreativeSceneLightPresetToStates,
  applyCreativeMotionProfileTemplateToSceneMotionPresets,
  applyCreativeScreenProfileTemplateToSceneScreenPresets,
  applyCreativeSceneMotionPresetToResponsePresets,
  applyCreativeSceneMotionPresetToStates,
  applyCreativeSceneResponsePresetToEntries,
  collectCreativeSceneDifferences,
  collectCreativeSceneLightPresetDifferences,
  collectCreativeSceneMotionPresetDifferences,
  collectCreativeSceneResponsePresetDifferences,
  collectCreativeSceneScreenPresetDifferences,
  collectCreativeSceneStateBindingDifferences,
  collectCreativeSceneStateDifferences,
  collectCreativeSoundDifferences,
  collectCreativeEventNames,
  createDefaultCreativeOpsState,
  ensureCreativeSceneResponsePresetCoverage,
  ensureCreativeSceneScreenPresetCoverage,
  ensureCreativeSceneStateBindingCoverage,
  ensureCreativeSceneStateCoverage,
  getCreativeSkinIdFromThemeId,
  LOCAL_CREATIVE_OPS_STORAGE_KEY,
  readCreativeOpsStateSnapshot,
  resolvePublishedCreativeSkin,
  resolveCreativeSceneScreenPreset,
  resolveCreativeSceneAvatarPreset,
  resolveCreativeSceneStateBinding,
  resolveCreativeSceneState,
  ensureCreativeEventCoverage,
  ensureCreativeSceneCueCoverage,
  ensureCreativeSceneLightPresetCoverage,
  ensureCreativeSceneMotionPresetCoverage,
  resolveCreativeSoundCue,
  resolveCreativeSceneCue,
} from '../src/admin/creativeOps';
import { buildPresentationEventRecord } from '../src/presentation/events';

describe('creative ops helpers', () => {
  it('builds a stable default creative ops state', () => {
    const state = createDefaultCreativeOpsState();
    expect(state.skinPacks.length).toBeGreaterThanOrEqual(3);
    expect(state.soundAssets.length).toBeGreaterThanOrEqual(5);
    expect(state.activeSkinId).toBe(state.skinPacks[0]?.id);
    expect(state.publishedEventMap.length).toBeGreaterThan(0);
    expect(state.publishedSceneCues.length).toBeGreaterThan(0);
    expect(state.sceneStates.length).toBeGreaterThan(0);
    expect(state.publishedSceneStates.length).toBeGreaterThan(0);
    expect(state.sceneAvatarPresets.length).toBeGreaterThanOrEqual(9);
    expect(state.publishedSceneAvatarPresets.length).toBeGreaterThan(0);
  });

  it('collects recent event names alongside recommended presentation events', () => {
    const state = createDefaultCreativeOpsState();
    const names = collectCreativeEventNames(
      [
        buildPresentationEventRecord({ name: 'profile.scene.sync', source: 'scene' }),
        buildPresentationEventRecord({ name: 'station.skin.changed', source: 'admin' }),
      ],
      state.eventMap
    );
    expect(names).toContain('profile.scene.sync');
    expect(names).toContain('station.skin.changed');
    expect(names).toContain('profile.deck.open');
    expect(names).toContain('station.skin.fallback');
    expect(names).toContain('profile.scene.state.hold');
  });

  it('creates default unmapped rows for unseen events', () => {
    const state = createDefaultCreativeOpsState();
    const covered = ensureCreativeEventCoverage(state.eventMap, [
      buildPresentationEventRecord({ name: 'profile.scene.connected', source: 'scene' }),
      buildPresentationEventRecord({ name: 'dusk.brief.loaded', source: 'dusk' }),
    ], ['soundpack-bureau-amber']);
    const sceneEntry = covered.find((entry) => entry.eventName === 'profile.scene.connected' && entry.soundPackId === 'soundpack-bureau-amber');
    expect(sceneEntry?.mixGroup).toBe('scene_fx');
    expect(sceneEntry?.assetId ?? null).toBeNull();
  });

  it('resolves a mapped sound cue for a semantic event', () => {
    const state = createDefaultCreativeOpsState();
    const cue = resolveCreativeSoundCue(state, 'profile.deck.open', 'soundpack-bureau-amber');
    expect(cue.entry?.assetId).toBe('builtin-panel-open');
    expect(cue.asset?.id).toBe('builtin-panel-open');
  });

  it('routes cue lookups through the requested skin pack/profile', () => {
    const state = createDefaultCreativeOpsState();
    const voidSound = resolveCreativeSoundCue(state, 'quest.completed', 'soundpack-void-command', 'published');
    const opsScene = resolveCreativeSceneCue(state, 'nav.section.profile.open', 'ops', 'draft');
    expect(voidSound.entry?.soundPackId).toBe('soundpack-void-command');
    expect(opsScene?.sceneProfile).toBe('ops');
    expect(opsScene?.environmentMode).toBe('core');
    expect(opsScene?.screenMode).toBe('base');
    expect(opsScene?.transitionStyle).toBeDefined();
  });

  it('keeps draft-only packs out of published runtime lookups', () => {
    const state = createDefaultCreativeOpsState();
    const publishedOpsSound = resolveCreativeSoundCue(state, 'quest.completed', 'soundpack-ops-amber', 'published');
    const draftOpsSound = resolveCreativeSoundCue(state, 'quest.completed', 'soundpack-ops-amber', 'draft');
    const publishedOpsScene = resolveCreativeSceneCue(state, 'quest.completed', 'ops', 'published');
    const draftOpsScene = resolveCreativeSceneCue(state, 'quest.completed', 'ops', 'draft');
    expect(publishedOpsSound.asset).toBeNull();
    expect(draftOpsSound.asset?.id).toBe('builtin-quest-complete');
    expect(publishedOpsScene).toBeNull();
    expect(draftOpsScene?.environmentMode).toBe('core');
  });

  it('keeps scene cues aligned with semantic event coverage', () => {
    const state = createDefaultCreativeOpsState();
    const covered = ensureCreativeSceneCueCoverage(state.sceneCues, [
      buildPresentationEventRecord({ name: 'profile.scene.connected', source: 'scene' }),
    ], ['bureau']);
    expect(covered.some((entry) => entry.eventName === 'profile.scene.connected' && entry.sceneProfile === 'bureau')).toBe(true);
    expect(resolveCreativeSceneCue({ ...state, sceneCues: covered }, 'quest.completed', 'bureau')?.cameraShot).toBe('hero');
  });

  it('resolves published base scene states for the current profile layer', () => {
    const state = createDefaultCreativeOpsState();
    const baseState = resolveCreativeSceneState(state, 'profile.night', 'bureau', 'published');
    const focusState = resolveCreativeSceneState(state, 'profile.focus', 'bureau', 'published');
    const activeState = resolveCreativeSceneState(state, 'profile.active', 'bureau', 'published');
    const basePreset = resolveCreativeSceneScreenPreset(state, 'base', 'bureau', 'published');
    const avatarPreset = resolveCreativeSceneAvatarPreset(state, 'station', 'bureau', 'published');
    expect(baseState?.environmentMode).toBe('mono');
    expect(baseState?.cameraShot).toBe('hero');
    expect(focusState?.cameraShot).toBe('hero');
    expect(activeState?.cameraShot).toBe('hero');
    expect(baseState?.screenMode).toBe('base');
    expect(baseState?.cameraOrbitSpeed).toBeGreaterThan(0);
    expect(baseState?.lightRig?.keyColor).toBeTruthy();
    expect(basePreset?.missionLabel).toBe('MISSION');
    expect(avatarPreset?.shellLabel).toBe('Profile Deck');
    expect(avatarPreset?.identityBadge).toBe('Bureau Station');
    expect(avatarPreset?.loadoutSlots).toHaveLength(6);
    expect(avatarPreset?.loadoutSlots[0]?.label).toBe('shell');
    expect(avatarPreset?.loadoutSlots[0]?.binding).toBe('theme');
  });

  it('migrates stored bureau profile framing from legacy mid shots to hero framing', () => {
    const legacy = createDefaultCreativeOpsState();
    legacy.sceneStates = legacy.sceneStates.map((entry) => {
      if (entry.sceneProfile === 'bureau' && entry.stateKey === 'profile.focus') {
        return { ...entry, cameraShot: 'mid', cameraOrbitSpeed: 0.46, ambientAtmosphere: 0.2 };
      }
      if (entry.sceneProfile === 'bureau' && entry.stateKey === 'profile.active') {
        return { ...entry, cameraShot: 'mid', cameraOrbitSpeed: 0.54, ambientAtmosphere: 0.22 };
      }
      return entry;
    });
    legacy.publishedSceneStates = legacy.publishedSceneStates.map((entry) => {
      if (entry.sceneProfile === 'bureau' && entry.stateKey === 'profile.focus') {
        return { ...entry, cameraShot: 'mid', cameraOrbitSpeed: 0.46, ambientAtmosphere: 0.2 };
      }
      if (entry.sceneProfile === 'bureau' && entry.stateKey === 'profile.active') {
        return { ...entry, cameraShot: 'mid', cameraOrbitSpeed: 0.54, ambientAtmosphere: 0.22 };
      }
      return entry;
    });
    legacy.sceneResponsePresets = legacy.sceneResponsePresets.map((entry) => {
      if (entry.sceneProfile === 'bureau' && entry.responseType === 'focus') {
        return { ...entry, cameraShot: 'mid', cameraOrbitSpeed: 0.42, ambientAtmosphere: 0.22 };
      }
      if (entry.sceneProfile === 'bureau' && entry.responseType === 'brief') {
        return { ...entry, cameraShot: 'mid', cameraOrbitSpeed: 0.5, ambientAtmosphere: 0.22 };
      }
      return entry;
    });
    legacy.publishedSceneResponsePresets = legacy.publishedSceneResponsePresets.map((entry) => {
      if (entry.sceneProfile === 'bureau' && entry.responseType === 'focus') {
        return { ...entry, cameraShot: 'mid', cameraOrbitSpeed: 0.42, ambientAtmosphere: 0.22 };
      }
      if (entry.sceneProfile === 'bureau' && entry.responseType === 'brief') {
        return { ...entry, cameraShot: 'mid', cameraOrbitSpeed: 0.5, ambientAtmosphere: 0.22 };
      }
      return entry;
    });

    const storageMap = new Map<string, string>();
    const originalLocalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storageMap.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storageMap.set(key, value);
        },
        removeItem: (key: string) => {
          storageMap.delete(key);
        },
      },
    });

    window.localStorage.setItem(LOCAL_CREATIVE_OPS_STORAGE_KEY, JSON.stringify(legacy));
    const migrated = readCreativeOpsStateSnapshot();

    expect(resolveCreativeSceneState(migrated, 'profile.focus', 'bureau', 'published')?.cameraShot).toBe('hero');
    expect(resolveCreativeSceneState(migrated, 'profile.active', 'bureau', 'published')?.cameraShot).toBe('hero');
    expect(
      migrated.publishedSceneResponsePresets.find(
        (entry) => entry.sceneProfile === 'bureau' && entry.responseType === 'focus'
      )?.cameraShot
    ).toBe('hero');
    expect(
      migrated.publishedSceneResponsePresets.find(
        (entry) => entry.sceneProfile === 'bureau' && entry.responseType === 'brief'
      )?.cameraShot
    ).toBe('hero');

    window.localStorage.removeItem(LOCAL_CREATIVE_OPS_STORAGE_KEY);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it('applies avatar profile templates to the target scene profile', () => {
    const state = createDefaultCreativeOpsState();
    const applied = applyCreativeAvatarProfileTemplateToSceneAvatarPresets(
      state.sceneAvatarPresets,
      'bureau',
      'ops'
    );
    const preset = applied.find((entry) => entry.sceneProfile === 'bureau' && entry.avatarProfile === 'ops');
    expect(preset?.shellLabel).toBe('Operator Deck');
    expect(preset?.relayLabel).toBe('Operator Relay');
    expect(preset?.identityBadge).toBe('Field Operator');
    expect(preset?.loadoutSlots[0]?.label).toBe('insignia');
    expect(preset?.loadoutSlots[0]?.binding).toBe('theme');
    expect(preset?.presencePresets).toHaveLength(3);
    expect(preset?.presencePresets[0]?.sceneStateOverride).toBeTruthy();
  });

  it('collects avatar preset differences for draft publishing', () => {
    const state = createDefaultCreativeOpsState();
    const draft = state.sceneAvatarPresets.map((entry) =>
      entry.sceneProfile === 'bureau' && entry.avatarProfile === 'station'
        ? {
            ...entry,
            shellLabel: 'Station Deck',
            identityBadge: 'Station Core',
            presencePresets: entry.presencePresets.map((presencePreset, index) =>
              index === 0
                ? {
                    ...presencePreset,
                    sceneStateOverride: 'profile.focus',
                  }
                : presencePreset
            ),
            loadoutSlots: entry.loadoutSlots.map((slot, index) =>
              index === 0
                ? {
                    ...slot,
                    label: 'anchor',
                    binding: 'any',
                  }
                : slot
            ),
          }
        : entry
    );
    const diffs = collectCreativeSceneAvatarPresetDifferences(
      draft.filter((entry) => entry.sceneProfile === 'bureau'),
      state.publishedSceneAvatarPresets.filter((entry) => entry.sceneProfile === 'bureau')
    );
    expect(diffs.some((entry) => entry.eventName === 'station' && entry.changes.includes('shell label'))).toBe(true);
    expect(diffs.some((entry) => entry.eventName === 'station' && entry.changes.includes('identity badge'))).toBe(true);
    expect(diffs.some((entry) => entry.eventName === 'station' && entry.changes.includes('presence presets'))).toBe(true);
    expect(diffs.some((entry) => entry.eventName === 'station' && entry.changes.includes('loadout slots'))).toBe(true);
  });

  it('fills missing base scene states for each scene profile', () => {
    const state = createDefaultCreativeOpsState();
    const covered = ensureCreativeSceneStateCoverage(
      state.sceneStates.filter((entry) => !(entry.sceneProfile === 'void' && entry.stateKey === 'profile.night')),
      ['bureau', 'void']
    );
    expect(covered.some((entry) => entry.sceneProfile === 'void' && entry.stateKey === 'profile.night')).toBe(true);
  });

  it('fills missing scene-state bindings for each scene profile', () => {
    const state = createDefaultCreativeOpsState();
    const covered = ensureCreativeSceneStateBindingCoverage(
      state.sceneStateBindings.filter((entry) => !(entry.sceneProfile === 'bureau' && entry.eventName === 'station.skin.fallback')),
      ['bureau']
    );
    expect(covered.some((entry) => entry.sceneProfile === 'bureau' && entry.eventName === 'station.skin.fallback')).toBe(true);
  });

  it('fills missing screen presets for each scene profile', () => {
    const state = createDefaultCreativeOpsState();
    const covered = ensureCreativeSceneScreenPresetCoverage(
      state.sceneScreenPresets.filter((entry) => !(entry.sceneProfile === 'void' && entry.mode === 'urgent')),
      ['bureau', 'void']
    );
    expect(covered.some((entry) => entry.sceneProfile === 'void' && entry.mode === 'urgent')).toBe(true);
  });

  it('fills missing response presets for each scene profile', () => {
    const state = createDefaultCreativeOpsState();
    const covered = ensureCreativeSceneResponsePresetCoverage(
      state.sceneResponsePresets.filter((entry) => !(entry.sceneProfile === 'ops' && entry.responseType === 'alert')),
      ['bureau', 'ops']
    );
    expect(covered.some((entry) => entry.sceneProfile === 'ops' && entry.responseType === 'alert')).toBe(true);
  });

  it('fills missing light presets for each scene profile', () => {
    const state = createDefaultCreativeOpsState();
    const covered = ensureCreativeSceneLightPresetCoverage(
      state.sceneLightPresets.filter((entry) => !(entry.sceneProfile === 'bureau' && entry.presetKey === 'brief')),
      ['bureau', 'ops']
    );
    expect(covered.some((entry) => entry.sceneProfile === 'bureau' && entry.presetKey === 'brief')).toBe(true);
  });

  it('fills missing motion presets for each scene profile', () => {
    const state = createDefaultCreativeOpsState();
    const covered = ensureCreativeSceneMotionPresetCoverage(
      state.sceneMotionPresets.filter((entry) => !(entry.sceneProfile === 'bureau' && entry.presetKey === 'brief')),
      ['bureau', 'ops']
    );
    expect(covered.some((entry) => entry.sceneProfile === 'bureau' && entry.presetKey === 'brief')).toBe(true);
  });

  it('applies a response preset to its mapped scene events', () => {
    const state = createDefaultCreativeOpsState();
    const preset = state.sceneResponsePresets.find(
      (entry) => entry.sceneProfile === 'bureau' && entry.responseType === 'brief'
    );
    expect(preset).toBeTruthy();
    const next = applyCreativeSceneResponsePresetToEntries(
      state.sceneCues,
      state.sceneStateBindings,
      {
        ...preset!,
        cameraShot: 'hero',
        holdMs: 9999,
        transitionStyle: 'surge',
        cameraOrbitSpeed: 1.25,
        lightRig: {
          ...preset!.lightRig!,
          keyIntensity: 1.88,
          fillColor: '#ffcc88',
        },
      }
    );
    expect(
      next.sceneCues.find((entry) => entry.sceneProfile === 'bureau' && entry.eventName === 'dusk.brief.loaded')
        ?.cameraShot
    ).toBe('hero');
    expect(
      next.sceneCues.find((entry) => entry.sceneProfile === 'bureau' && entry.eventName === 'dusk.brief.loaded')
        ?.transitionStyle
    ).toBe('surge');
    expect(
      next.sceneCues.find((entry) => entry.sceneProfile === 'bureau' && entry.eventName === 'dusk.brief.loaded')
        ?.lightRig?.keyIntensity
    ).toBe(1.88);
    expect(
      next.bindings.find((entry) => entry.sceneProfile === 'bureau' && entry.eventName === 'dusk.brief.loaded')
        ?.holdMs
    ).toBe(9999);
  });

  it('maps avatar loadout readiness events into response presets', () => {
    const state = createDefaultCreativeOpsState();
    const rewardPreset = state.sceneResponsePresets.find(
      (entry) => entry.sceneProfile === 'bureau' && entry.responseType === 'reward'
    );
    const alertPreset = state.sceneResponsePresets.find(
      (entry) => entry.sceneProfile === 'bureau' && entry.responseType === 'alert'
    );
    expect(rewardPreset).toBeTruthy();
    expect(alertPreset).toBeTruthy();

    const rewardApplied = applyCreativeSceneResponsePresetToEntries(
      state.sceneCues,
      state.sceneStateBindings,
      {
        ...rewardPreset!,
        cameraShot: 'hero',
        holdMs: 8888,
      }
    );
    const alertApplied = applyCreativeSceneResponsePresetToEntries(
      state.sceneCues,
      state.sceneStateBindings,
      {
        ...alertPreset!,
        screenMode: 'urgent',
        holdMs: 7777,
      }
    );

    expect(
      rewardApplied.sceneCues.find(
        (entry) => entry.sceneProfile === 'bureau' && entry.eventName === 'profile.avatar.loadout.ready'
      )?.cameraShot
    ).toBe('hero');
    expect(
      rewardApplied.bindings.find(
        (entry) => entry.sceneProfile === 'bureau' && entry.eventName === 'profile.avatar.loadout.ready'
      )?.holdMs
    ).toBe(8888);
    expect(
      alertApplied.sceneCues.find(
        (entry) => entry.sceneProfile === 'bureau' && entry.eventName === 'profile.avatar.loadout.empty'
      )?.screenMode
    ).toBe('urgent');
    expect(
      alertApplied.bindings.find(
        (entry) => entry.sceneProfile === 'bureau' && entry.eventName === 'profile.avatar.loadout.empty'
      )?.holdMs
    ).toBe(7777);
  });

  it('applies a light preset to mapped base states and response presets', () => {
    const state = createDefaultCreativeOpsState();
    const focusPreset = state.sceneLightPresets.find(
      (entry) => entry.sceneProfile === 'bureau' && entry.presetKey === 'focus'
    );
    const briefPreset = state.sceneLightPresets.find(
      (entry) => entry.sceneProfile === 'bureau' && entry.presetKey === 'brief'
    );
    expect(focusPreset).toBeTruthy();
    expect(briefPreset).toBeTruthy();
    const nextStates = applyCreativeSceneLightPresetToStates(state.sceneStates, {
      ...focusPreset!,
      lightRig: {
        ...focusPreset!.lightRig,
        keyIntensity: 1.77,
      },
    });
    const nextResponses = applyCreativeSceneLightPresetToResponsePresets(state.sceneResponsePresets, {
      ...briefPreset!,
      lightRig: {
        ...briefPreset!.lightRig,
        fillColor: '#cceeff',
      },
    });
    expect(
      nextStates.find((entry) => entry.sceneProfile === 'bureau' && entry.stateKey === 'profile.focus')?.lightRig
        ?.keyIntensity
    ).toBe(1.77);
    expect(
      nextResponses.find((entry) => entry.sceneProfile === 'bureau' && entry.responseType === 'brief')?.lightRig
        ?.fillColor
    ).toBe('#cceeff');
  });

  it('applies a motion preset to mapped base states and response presets', () => {
    const state = createDefaultCreativeOpsState();
    const focusPreset = state.sceneMotionPresets.find(
      (entry) => entry.sceneProfile === 'bureau' && entry.presetKey === 'focus'
    );
    const briefPreset = state.sceneMotionPresets.find(
      (entry) => entry.sceneProfile === 'bureau' && entry.presetKey === 'brief'
    );
    expect(focusPreset).toBeTruthy();
    expect(briefPreset).toBeTruthy();
    const nextStates = applyCreativeSceneMotionPresetToStates(state.sceneStates, {
      ...focusPreset!,
      cameraOrbitSpeed: 0.88,
      cueDurationMs: 2600,
    });
    const nextResponses = applyCreativeSceneMotionPresetToResponsePresets(state.sceneResponsePresets, {
      ...briefPreset!,
      transitionStyle: 'sharp',
      cameraOrbitSpeed: 0.91,
      cueDurationMs: 3100,
    });
    expect(
      nextStates.find((entry) => entry.sceneProfile === 'bureau' && entry.stateKey === 'profile.focus')
        ?.cameraOrbitSpeed
    ).toBe(0.88);
    expect(
      nextResponses.find((entry) => entry.sceneProfile === 'bureau' && entry.responseType === 'brief')
        ?.transitionStyle
    ).toBe('sharp');
    expect(
      nextResponses.find((entry) => entry.sceneProfile === 'bureau' && entry.responseType === 'brief')
        ?.cameraOrbitSpeed
    ).toBe(0.91);
    expect(
      nextResponses.find((entry) => entry.sceneProfile === 'bureau' && entry.responseType === 'brief')
        ?.cueDurationMs
    ).toBe(3100);
  });

  it('applies a skin motion profile template across scene motion presets', () => {
    const state = createDefaultCreativeOpsState();
    const next = applyCreativeMotionProfileTemplateToSceneMotionPresets(
      state.sceneMotionPresets,
      'bureau',
      'sharp'
    );
    const bureauBrief = next.find((entry) => entry.sceneProfile === 'bureau' && entry.presetKey === 'brief');
    const bureauDay = next.find((entry) => entry.sceneProfile === 'bureau' && entry.presetKey === 'day');
    const voidBrief = next.find((entry) => entry.sceneProfile === 'void' && entry.presetKey === 'brief');
    expect(bureauBrief?.transitionStyle).toBe('sharp');
    expect(bureauBrief?.cameraOrbitSpeed).toBeNull();
    expect(bureauDay?.transitionStyle).toBe('sharp');
    expect(voidBrief?.cameraOrbitSpeed).toBe(
      state.sceneMotionPresets.find((entry) => entry.sceneProfile === 'void' && entry.presetKey === 'brief')
        ?.cameraOrbitSpeed
    );
  });

  it('applies a skin screen profile template across scene screen presets', () => {
    const state = createDefaultCreativeOpsState();
    const next = applyCreativeScreenProfileTemplateToSceneScreenPresets(
      state.sceneScreenPresets,
      'bureau',
      'ops'
    );
    const bureauBase = next.find((entry) => entry.sceneProfile === 'bureau' && entry.mode === 'base');
    const bureauBrief = next.find((entry) => entry.sceneProfile === 'bureau' && entry.mode === 'brief');
    const voidBase = next.find((entry) => entry.sceneProfile === 'void' && entry.mode === 'base');
    expect(bureauBase?.missionLabel).toBe('OPS');
    expect(bureauBase?.roleLabel).toBe('UNIT');
    expect(bureauBrief?.missionLabel).toBe('ORDERS');
    expect(voidBase?.missionLabel).toBe(
      state.sceneScreenPresets.find((entry) => entry.sceneProfile === 'void' && entry.mode === 'base')?.missionLabel
    );
  });

  it('builds a publish-readiness summary for a skin package', () => {
    const state = createDefaultCreativeOpsState();
    const bureauSummary = buildCreativeSkinPackageSummary(state, 'skin-bureau-amber');
    const opsSummary = buildCreativeSkinPackageSummary(state, 'skin-ops-amber');
    expect(bureauSummary?.liveSafe).toBe(true);
    expect(bureauSummary?.blockers.length).toBe(0);
    expect(opsSummary?.scenePackStatus).toBe('draft');
    expect(opsSummary?.readyToPublish).toBe(true);
    expect(opsSummary?.totalDiffCount).toBeGreaterThan(0);
  });

  it('resolves published scene-state bindings for richer XTATION events', () => {
    const state = createDefaultCreativeOpsState();
    const binding = resolveCreativeSceneStateBinding(state, 'dusk.brief.loaded', 'bureau', 'published');
    expect(binding?.stateKey).toBe('profile.focus');
    expect(binding?.holdMs).toBeGreaterThan(1000);
    expect(resolveCreativeSceneStateBinding(state, 'notification.urgent', 'ops', 'draft')?.stateKey).toBe('profile.active');
  });

  it('resolves a published fallback skin when the requested runtime skin is draft', () => {
    const state = createDefaultCreativeOpsState();
    const fallback = resolvePublishedCreativeSkin(state, 'skin-ops-amber', 'soundpack-ops-amber');
    expect(fallback?.id).toBe('skin-bureau-amber');
  });

  it('parses creative theme ids cleanly', () => {
    expect(getCreativeSkinIdFromThemeId('creative:skin-bureau-amber')).toBe('skin-bureau-amber');
    expect(getCreativeSkinIdFromThemeId('builtin:bureau')).toBeNull();
  });

  it('collects explicit audio and scene draft differences for compare mode', () => {
    const state = createDefaultCreativeOpsState();
    const soundDiffs = collectCreativeSoundDifferences(
      state.eventMap.filter((entry) => entry.soundPackId === 'soundpack-bureau-amber').map((entry) =>
        entry.eventName === 'profile.deck.open' ? { ...entry, volume: entry.volume + 5 } : entry
      ),
      state.publishedEventMap.filter((entry) => entry.soundPackId === 'soundpack-bureau-amber')
    );
    const sceneDiffs = collectCreativeSceneDifferences(
      state.sceneCues
        .filter((entry) => entry.sceneProfile === 'bureau')
        .map((entry) =>
          entry.eventName === 'profile.deck.open' ? { ...entry, cameraShot: 'hero', screenMode: 'brief' } : entry
        ),
      state.publishedSceneCues.filter((entry) => entry.sceneProfile === 'bureau')
    );
    const stateDiffs = collectCreativeSceneStateDifferences(
      state.sceneStates
        .filter((entry) => entry.sceneProfile === 'bureau')
        .map((entry) =>
          entry.stateKey === 'profile.focus'
            ? {
                ...entry,
                cameraOrbitSpeed: (entry.cameraOrbitSpeed ?? 0) + 0.1,
                ambientAtmosphere: entry.ambientAtmosphere + 0.1,
                screenMode: 'brief',
                lightRig: {
                  ...entry.lightRig!,
                  keyIntensity: entry.lightRig!.keyIntensity + 0.2,
                },
              }
            : entry
        ),
      state.publishedSceneStates.filter((entry) => entry.sceneProfile === 'bureau')
    );
    const bindingDiffs = collectCreativeSceneStateBindingDifferences(
      state.sceneStateBindings
        .filter((entry) => entry.sceneProfile === 'bureau')
        .map((entry) =>
          entry.eventName === 'dusk.brief.loaded' ? { ...entry, holdMs: entry.holdMs + 1000 } : entry
        ),
      state.publishedSceneStateBindings.filter((entry) => entry.sceneProfile === 'bureau')
    );
    const screenPresetDiffs = collectCreativeSceneScreenPresetDifferences(
      state.sceneScreenPresets
        .filter((entry) => entry.sceneProfile === 'bureau')
        .map((entry) =>
          entry.mode === 'brief' ? { ...entry, missionLabel: 'DISPATCH', fallbackMissionText: 'Updated brief lane.' } : entry
        ),
      state.publishedSceneScreenPresets.filter((entry) => entry.sceneProfile === 'bureau')
    );
    const responsePresetDiffs = collectCreativeSceneResponsePresetDifferences(
      state.sceneResponsePresets
        .filter((entry) => entry.sceneProfile === 'bureau')
        .map((entry) =>
          entry.responseType === 'alert'
            ? {
                ...entry,
                holdMs: entry.holdMs + 5000,
                cameraShot: 'mid',
                transitionStyle: 'surge',
                cameraOrbitSpeed: 1.4,
                lightRig: {
                  ...entry.lightRig!,
                  fillColor: '#ffbb99',
                },
              }
            : entry
        ),
      state.publishedSceneResponsePresets.filter((entry) => entry.sceneProfile === 'bureau')
    );
    const lightPresetDiffs = collectCreativeSceneLightPresetDifferences(
      state.sceneLightPresets
        .filter((entry) => entry.sceneProfile === 'bureau')
        .map((entry) =>
          entry.presetKey === 'alert'
            ? {
                ...entry,
                lightRig: {
                  ...entry.lightRig,
                  keyColor: '#ffaa66',
                },
              }
            : entry
        ),
      state.publishedSceneLightPresets.filter((entry) => entry.sceneProfile === 'bureau')
    );
    const motionPresetDiffs = collectCreativeSceneMotionPresetDifferences(
      state.sceneMotionPresets
        .filter((entry) => entry.sceneProfile === 'bureau')
        .map((entry) =>
          entry.presetKey === 'alert'
            ? {
                ...entry,
                transitionStyle: 'surge',
                cameraOrbitSpeed: 1.2,
                cueDurationMs: entry.cueDurationMs + 400,
              }
            : entry
        ),
      state.publishedSceneMotionPresets.filter((entry) => entry.sceneProfile === 'bureau')
    );
    expect(soundDiffs.find((entry) => entry.eventName === 'profile.deck.open')?.changes).toContain('volume');
    expect(sceneDiffs.find((entry) => entry.eventName === 'profile.deck.open')?.changes).toContain('camera');
    expect(sceneDiffs.find((entry) => entry.eventName === 'profile.deck.open')?.changes).toContain('screen mode');
    expect(stateDiffs.find((entry) => entry.eventName === 'profile.focus')?.changes).toContain('atmosphere');
    expect(stateDiffs.find((entry) => entry.eventName === 'profile.focus')?.changes).toContain('screen mode');
    expect(stateDiffs.find((entry) => entry.eventName === 'profile.focus')?.changes).toContain('orbit');
    expect(stateDiffs.find((entry) => entry.eventName === 'profile.focus')?.changes).toContain('key light');
    expect(bindingDiffs.find((entry) => entry.eventName === 'dusk.brief.loaded')?.changes).toContain('hold');
    expect(screenPresetDiffs.find((entry) => entry.eventName === 'brief')?.changes).toContain('mission label');
    expect(screenPresetDiffs.find((entry) => entry.eventName === 'brief')?.changes).toContain('mission text');
    expect(responsePresetDiffs.find((entry) => entry.eventName === 'alert')?.changes).toContain('hold');
    expect(responsePresetDiffs.find((entry) => entry.eventName === 'alert')?.changes).toContain('camera');
    expect(responsePresetDiffs.find((entry) => entry.eventName === 'alert')?.changes).toContain('transition');
    expect(responsePresetDiffs.find((entry) => entry.eventName === 'alert')?.changes).toContain('orbit');
    expect(responsePresetDiffs.find((entry) => entry.eventName === 'alert')?.changes).toContain('fill color');
    expect(lightPresetDiffs.find((entry) => entry.eventName === 'alert')?.changes).toContain('key color');
    expect(motionPresetDiffs.find((entry) => entry.eventName === 'alert')?.changes).toContain('transition');
    expect(motionPresetDiffs.find((entry) => entry.eventName === 'alert')?.changes).toContain('orbit');
    expect(motionPresetDiffs.find((entry) => entry.eventName === 'alert')?.changes).toContain('duration');
  });
});
