import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { readUserScopedJSON, writeUserScopedJSON } from '../lib/userScopedStorage';
import type { InventoryCapabilitySlotBinding } from '../inventory/models';
import {
  getBuiltInThemePackId,
  type XtationAccent,
  type XtationTheme,
} from '../theme/ThemeProvider';
import type { PresentationEventRecord } from '../presentation/events';
import {
  applySceneStudioRuntimePack,
  resolveSceneStudioRuntimePackSegments,
  type SceneStudioRuntimePackSegment,
  type SceneStudioRuntimePackV1,
} from '../sceneStudio/runtimePack';
import {
  playClickSound,
  playErrorSound,
  playHoverSound,
  playPanelOpenSound,
  playSuccessSound,
} from '../../utils/SoundEffects';

export const CREATIVE_OPS_STORAGE_KEY = 'xtation_creative_ops_v1';
export const LOCAL_CREATIVE_OPS_STORAGE_KEY = `${CREATIVE_OPS_STORAGE_KEY}:local`;
export const CREATIVE_OPS_SYNC_EVENT = 'xtation:creative-ops-sync';

export type CreativeMixGroup =
  | 'ui'
  | 'notifications'
  | 'quest'
  | 'dusk'
  | 'ambient'
  | 'music'
  | 'scene_fx';

export type CreativeSkinStatus = 'published' | 'draft';
export type CreativeScenePackStatus = 'published' | 'draft';
export type CreativeSceneScreenMode = 'base' | 'focus' | 'brief' | 'urgent' | 'success';
export type CreativeSceneResponseType = 'focus' | 'brief' | 'reward' | 'alert';
export type CreativeSceneTransitionStyle = 'calm' | 'sharp' | 'surge';
export type CreativeAvatarProfile = 'station' | 'ops' | 'minimal';
export type CreativeAvatarLoadoutPresenceState = 'empty' | 'partial' | 'ready';
export type CreativeSceneLightPresetKey =
  | 'day'
  | 'night'
  | 'focus'
  | 'active'
  | 'base'
  | 'brief'
  | 'reward'
  | 'alert';
export type CreativeSceneMotionPresetKey =
  | 'day'
  | 'night'
  | 'focus'
  | 'active'
  | 'base'
  | 'brief'
  | 'reward'
  | 'alert';

export interface CreativeSceneLightRig {
  keyIntensity: number;
  fillIntensity: number;
  keyColor: string;
  fillColor: string;
}

export interface CreativeSceneLightPreset {
  sceneProfile: CreativeSkinPack['sceneProfile'];
  presetKey: CreativeSceneLightPresetKey;
  lightRig: CreativeSceneLightRig;
}

export interface CreativeSceneMotionPreset {
  sceneProfile: CreativeSkinPack['sceneProfile'];
  presetKey: CreativeSceneMotionPresetKey;
  transitionStyle: CreativeSceneTransitionStyle;
  cameraOrbitSpeed: number | null;
  cueDurationMs: number;
}

type CreativeMotionProfileTemplate = Pick<
  CreativeSceneMotionPreset,
  'transitionStyle' | 'cameraOrbitSpeed' | 'cueDurationMs'
>;

export interface CreativeSkinPack {
  id: string;
  name: string;
  description: string;
  theme: XtationTheme;
  accent: XtationAccent;
  soundPackId?: string;
  status: CreativeSkinStatus;
  motionProfile: 'calm' | 'sharp' | 'cinematic';
  screenProfile: 'bureau' | 'void' | 'ops';
  sceneProfile: 'bureau' | 'void' | 'ops';
  avatarProfile: CreativeAvatarProfile;
}

export interface CreativeScenePack {
  id: string;
  name: string;
  description: string;
  sceneProfile: CreativeSkinPack['sceneProfile'];
  status: CreativeScenePackStatus;
  draftRevision: number;
  publishedRevision: number;
  lastPublishedAt: number | null;
}

export interface CreativePublishLogEntry {
  id: string;
  targetType: 'skin' | 'scene';
  targetId: string;
  label: string;
  action: 'published' | 'set_draft' | 'revised' | 'restored';
  revision: number;
  occurredAt: number;
  actorScope: 'guest' | 'account';
}

export interface CreativeSoundAsset {
  id: string;
  name: string;
  kind: CreativeMixGroup;
  source: 'builtin' | 'upload';
  createdAt: number;
  audioDataUrl?: string;
  mimeType?: string;
}

export interface CreativeSoundEventMapEntry {
  soundPackId: string;
  eventName: string;
  mixGroup: CreativeMixGroup;
  assetId: string | null;
  volume: number;
  cooldownMs: number;
}

export interface CreativeSceneCueEntry {
  sceneProfile: CreativeSkinPack['sceneProfile'];
  eventName: string;
  environmentMode: 'light' | 'bureau' | 'mono' | 'glacier' | 'core' | 'dusk' | null;
  cameraShot: 'wide' | 'hero' | 'mid' | null;
  screenMode: CreativeSceneScreenMode | null;
  transitionStyle: CreativeSceneTransitionStyle;
  cameraOrbitSpeed: number | null;
  lightRig?: CreativeSceneLightRig;
  beatPulse: boolean;
  ringPulse: boolean;
  groundMotion: boolean;
  ambientAtmosphere: number;
  cueDurationMs: number;
}

export type CreativeSceneStateKey =
  | 'profile.day'
  | 'profile.night'
  | 'profile.focus'
  | 'profile.active';

export interface CreativeSceneStateEntry {
  sceneProfile: CreativeSkinPack['sceneProfile'];
  stateKey: CreativeSceneStateKey;
  environmentMode: 'light' | 'bureau' | 'mono' | 'glacier' | 'core' | 'dusk' | null;
  cameraShot: 'wide' | 'hero' | 'mid' | null;
  screenMode: CreativeSceneScreenMode;
  cameraOrbitSpeed: number | null;
  lightRig?: CreativeSceneLightRig;
  ambientAtmosphere: number;
  beatPulse: boolean;
  ringPulse: boolean;
  groundMotion: boolean;
  modelFloat: boolean;
  hideLightSource: boolean;
}

export interface CreativeSceneStateBinding {
  sceneProfile: CreativeSkinPack['sceneProfile'];
  eventName: string;
  stateKey: CreativeSceneStateKey;
  holdMs: number;
}

export interface CreativeSceneScreenPreset {
  sceneProfile: CreativeSkinPack['sceneProfile'];
  mode: CreativeSceneScreenMode;
  missionLabel: string;
  roleLabel: string;
  traceLabel: string;
  fallbackMissionText: string;
  fallbackRoleText: string;
}

export interface CreativeAvatarLoadoutSlot {
  id: string;
  label: string;
  icon: string;
  equipped: boolean;
  binding: InventoryCapabilitySlotBinding;
}

export interface CreativeAvatarPresencePreset {
  state: CreativeAvatarLoadoutPresenceState;
  label: string;
  deckPrompt: string;
  statusLabel: string;
  roleFallbackText: string;
  previewRoleText: string;
  sceneStateOverride: CreativeSceneStateKey | null;
  screenModeOverride: CreativeSceneScreenMode | null;
}

export interface CreativeSceneAvatarPreset {
  sceneProfile: CreativeSkinPack['sceneProfile'];
  avatarProfile: CreativeAvatarProfile;
  shellLabel: string;
  identityBadge: string;
  deckPrompt: string;
  loadoutTitle: string;
  loadoutDescription: string;
  capabilityLabel: string;
  relayLabel: string;
  statusLabel: string;
  roleFallbackText: string;
  previewRoleText: string;
  loadoutSlots: CreativeAvatarLoadoutSlot[];
  presencePresets: CreativeAvatarPresencePreset[];
}

export interface CreativeSceneResponsePreset {
  sceneProfile: CreativeSkinPack['sceneProfile'];
  responseType: CreativeSceneResponseType;
  environmentMode: 'light' | 'bureau' | 'mono' | 'glacier' | 'core' | 'dusk' | null;
  cameraShot: 'wide' | 'hero' | 'mid' | null;
  screenMode: CreativeSceneScreenMode;
  transitionStyle: CreativeSceneTransitionStyle;
  cameraOrbitSpeed: number | null;
  lightRig?: CreativeSceneLightRig;
  targetStateKey: CreativeSceneStateKey;
  holdMs: number;
  beatPulse: boolean;
  ringPulse: boolean;
  groundMotion: boolean;
  ambientAtmosphere: number;
  cueDurationMs: number;
}

export interface CreativeRuntimePackRollbackSnapshot {
  sceneProfile: CreativeSkinPack['sceneProfile'];
  soundPackId: string | null;
  skinPacks: CreativeSkinPack[];
  scenePack: CreativeScenePack | null;
  eventMap: CreativeSoundEventMapEntry[];
  sceneCues: CreativeSceneCueEntry[];
  sceneStates: CreativeSceneStateEntry[];
  sceneStateBindings: CreativeSceneStateBinding[];
  sceneScreenPresets: CreativeSceneScreenPreset[];
  sceneAvatarPresets: CreativeSceneAvatarPreset[];
  sceneResponsePresets: CreativeSceneResponsePreset[];
  sceneLightPresets: CreativeSceneLightPreset[];
  sceneMotionPresets: CreativeSceneMotionPreset[];
  publishedEventMap: CreativeSoundEventMapEntry[];
  publishedSceneCues: CreativeSceneCueEntry[];
  publishedSceneStates: CreativeSceneStateEntry[];
  publishedSceneStateBindings: CreativeSceneStateBinding[];
  publishedSceneScreenPresets: CreativeSceneScreenPreset[];
  publishedSceneAvatarPresets: CreativeSceneAvatarPreset[];
  publishedSceneResponsePresets: CreativeSceneResponsePreset[];
  publishedSceneLightPresets: CreativeSceneLightPreset[];
  publishedSceneMotionPresets: CreativeSceneMotionPreset[];
}

export interface CreativeRuntimePackImportEntry {
  id: string;
  mode: 'draft' | 'published';
  actorScope: 'guest' | 'account';
  occurredAt: number;
  fileName: string | null;
  includedSegments: SceneStudioRuntimePackSegment[];
  manifest: SceneStudioRuntimePackV1['manifest'];
  pack: SceneStudioRuntimePackV1;
  rollback: CreativeRuntimePackRollbackSnapshot;
  rolledBackAt: number | null;
}

export interface CreativeOpsState {
  selectedSkinId: string;
  activeSkinId: string;
  skinPacks: CreativeSkinPack[];
  scenePacks: CreativeScenePack[];
  soundAssets: CreativeSoundAsset[];
  eventMap: CreativeSoundEventMapEntry[];
  sceneCues: CreativeSceneCueEntry[];
  sceneStates: CreativeSceneStateEntry[];
  sceneStateBindings: CreativeSceneStateBinding[];
  sceneScreenPresets: CreativeSceneScreenPreset[];
  sceneAvatarPresets: CreativeSceneAvatarPreset[];
  sceneResponsePresets: CreativeSceneResponsePreset[];
  sceneLightPresets: CreativeSceneLightPreset[];
  sceneMotionPresets: CreativeSceneMotionPreset[];
  publishedEventMap: CreativeSoundEventMapEntry[];
  publishedSceneCues: CreativeSceneCueEntry[];
  publishedSceneStates: CreativeSceneStateEntry[];
  publishedSceneStateBindings: CreativeSceneStateBinding[];
  publishedSceneScreenPresets: CreativeSceneScreenPreset[];
  publishedSceneAvatarPresets: CreativeSceneAvatarPreset[];
  publishedSceneResponsePresets: CreativeSceneResponsePreset[];
  publishedSceneLightPresets: CreativeSceneLightPreset[];
  publishedSceneMotionPresets: CreativeSceneMotionPreset[];
  publishLog: CreativePublishLogEntry[];
  runtimePackHistory: CreativeRuntimePackImportEntry[];
}

export interface CreativeDifferenceEntry {
  eventName: string;
  changes: string[];
}

export interface CreativeSkinPackageSummary {
  skinId: string;
  skinName: string;
  sceneProfile: CreativeSkinPack['sceneProfile'];
  soundPackId: string | null;
  skinStatus: CreativeSkinStatus;
  scenePackStatus: CreativeScenePackStatus | 'missing';
  totalDiffCount: number;
  soundDiffCount: number;
  sceneDiffCount: number;
  stateDiffCount: number;
  bindingDiffCount: number;
  screenDiffCount: number;
  avatarDiffCount: number;
  responseDiffCount: number;
  lightDiffCount: number;
  motionDiffCount: number;
  blockers: string[];
  readyToPublish: boolean;
  liveSafe: boolean;
}

export const RECOMMENDED_PRESENTATION_EVENT_NAMES = [
  'nav.section.play.open',
  'nav.section.profile.open',
  'nav.section.lab.open',
  'nav.section.admin.open',
  'profile.deck.open',
  'profile.deck.close',
  'profile.tab.profile.open',
  'profile.tab.health.open',
  'profile.tab.achievements.open',
  'profile.tab.activity.open',
  'profile.tab.log.open',
  'profile.panel.identity.open',
  'profile.panel.stats.open',
  'profile.scene.load',
  'profile.scene.sync',
  'profile.scene.state.hold',
  'profile.scene.state.release',
  'profile.scene.reload',
  'profile.avatar.loadout.empty',
  'profile.avatar.loadout.partial',
  'profile.avatar.loadout.ready',
  'dusk.brief.loaded',
  'quest.completed',
  'quest.debrief.opened',
  'quest.reward.burst',
  'play.session.start',
  'notification.urgent',
  'station.skin.fallback',
  'ambient.night.enter',
] as const;

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  const storage = window.localStorage as Partial<Storage> | undefined;
  if (!storage || typeof storage.getItem !== 'function') return null;
  return storage;
};

const createBuiltInSoundAsset = (
  id: string,
  name: string,
  kind: CreativeMixGroup
): CreativeSoundAsset => ({
  id,
  name,
  kind,
  source: 'builtin',
  createdAt: 0,
});

export const DEFAULT_CREATIVE_SKIN_PACKS: CreativeSkinPack[] = [
  {
    id: 'skin-bureau-amber',
    name: 'Bureau / Amber',
    description: 'Institutional amber command skin with calm motion and restrained scene response.',
    theme: 'bureau',
    accent: 'amber',
    soundPackId: 'soundpack-bureau-amber',
    status: 'published',
    motionProfile: 'calm',
    screenProfile: 'bureau',
    sceneProfile: 'bureau',
    avatarProfile: 'station',
  },
  {
    id: 'skin-void-command',
    name: 'Void Command',
    description: 'Sharper dark tactical presentation with higher contrast panels and stricter motion.',
    theme: 'void',
    accent: 'teal',
    soundPackId: 'soundpack-void-command',
    status: 'published',
    motionProfile: 'sharp',
    screenProfile: 'void',
    sceneProfile: 'void',
    avatarProfile: 'ops',
  },
  {
    id: 'skin-ops-amber',
    name: 'Ops / Amber',
    description: 'Operator-focused pack with command-room rhythm, amber signals, and stronger scene reactions.',
    theme: 'bureau',
    accent: 'amber',
    soundPackId: 'soundpack-ops-amber',
    status: 'draft',
    motionProfile: 'cinematic',
    screenProfile: 'ops',
    sceneProfile: 'ops',
    avatarProfile: 'ops',
  },
  {
    id: 'skin-control',
    name: 'CONTROL',
    description: 'The Oldest House. Brutalist atmosphere with concrete textures, CRT scan lines, angular chamfers, Hiss-red breathing glows, and glitch effects.',
    theme: 'control',
    accent: 'crimson',
    soundPackId: 'soundpack-void-command',
    status: 'published',
    motionProfile: 'sharp',
    screenProfile: 'ops',
    sceneProfile: 'ops',
    avatarProfile: 'ops',
  },
];

export const DEFAULT_CREATIVE_SOUND_ASSETS: CreativeSoundAsset[] = [
  createBuiltInSoundAsset('builtin-ui-select', 'UI Select Tone', 'ui'),
  createBuiltInSoundAsset('builtin-panel-open', 'Panel Open Sweep', 'scene_fx'),
  createBuiltInSoundAsset('builtin-quest-complete', 'Quest Complete Signal', 'quest'),
  createBuiltInSoundAsset('builtin-notify-soft', 'Soft Notification Ping', 'notifications'),
  createBuiltInSoundAsset('builtin-dusk-relay', 'Dusk Relay Tone', 'dusk'),
];

export const DEFAULT_CREATIVE_SCENE_PACKS: CreativeScenePack[] = [
  {
    id: 'scenepack-bureau',
    name: 'Bureau Scene Pack',
    description: 'Institutional profile lobby cues with restrained motion and amber bureau atmosphere.',
    sceneProfile: 'bureau',
    status: 'published',
    draftRevision: 3,
    publishedRevision: 3,
    lastPublishedAt: 1760000000000,
  },
  {
    id: 'scenepack-void',
    name: 'Void Scene Pack',
    description: 'Sharper dark profile cues with colder transitions and more aggressive framing.',
    sceneProfile: 'void',
    status: 'published',
    draftRevision: 2,
    publishedRevision: 2,
    lastPublishedAt: 1760500000000,
  },
  {
    id: 'scenepack-ops',
    name: 'Ops Scene Pack',
    description: 'Operator-facing profile cues with higher motion energy and command-room emphasis.',
    sceneProfile: 'ops',
    status: 'draft',
    draftRevision: 4,
    publishedRevision: 2,
    lastPublishedAt: 1760800000000,
  },
];

export const DEFAULT_CREATIVE_EVENT_MAP: CreativeSoundEventMapEntry[] = [
  { soundPackId: 'soundpack-bureau-amber', eventName: 'nav.section.profile.open', mixGroup: 'ui', assetId: 'builtin-ui-select', volume: 74, cooldownMs: 120 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'nav.section.lab.open', mixGroup: 'ui', assetId: 'builtin-ui-select', volume: 74, cooldownMs: 120 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'profile.deck.open', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 78, cooldownMs: 180 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'profile.tab.profile.open', mixGroup: 'ui', assetId: 'builtin-ui-select', volume: 72, cooldownMs: 120 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'profile.tab.health.open', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 74, cooldownMs: 150 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'profile.tab.achievements.open', mixGroup: 'quest', assetId: 'builtin-quest-complete', volume: 78, cooldownMs: 180 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'profile.tab.activity.open', mixGroup: 'ui', assetId: 'builtin-ui-select', volume: 72, cooldownMs: 120 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'profile.tab.log.open', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 70, cooldownMs: 150 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'profile.scene.sync', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 72, cooldownMs: 220 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'profile.avatar.loadout.empty', mixGroup: 'notifications', assetId: 'builtin-notify-soft', volume: 82, cooldownMs: 260 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'profile.avatar.loadout.partial', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 74, cooldownMs: 220 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'profile.avatar.loadout.ready', mixGroup: 'quest', assetId: 'builtin-quest-complete', volume: 80, cooldownMs: 320 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'quest.completed', mixGroup: 'quest', assetId: 'builtin-quest-complete', volume: 86, cooldownMs: 360 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'quest.reward.burst', mixGroup: 'quest', assetId: 'builtin-quest-complete', volume: 82, cooldownMs: 220 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'quest.debrief.opened', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 72, cooldownMs: 220 },
  { soundPackId: 'soundpack-bureau-amber', eventName: 'dusk.brief.loaded', mixGroup: 'dusk', assetId: 'builtin-dusk-relay', volume: 74, cooldownMs: 220 },
  { soundPackId: 'soundpack-void-command', eventName: 'nav.section.profile.open', mixGroup: 'ui', assetId: 'builtin-ui-select', volume: 82, cooldownMs: 90 },
  { soundPackId: 'soundpack-void-command', eventName: 'profile.deck.open', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 84, cooldownMs: 140 },
  { soundPackId: 'soundpack-void-command', eventName: 'profile.tab.profile.open', mixGroup: 'ui', assetId: 'builtin-ui-select', volume: 80, cooldownMs: 100 },
  { soundPackId: 'soundpack-void-command', eventName: 'profile.tab.health.open', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 82, cooldownMs: 130 },
  { soundPackId: 'soundpack-void-command', eventName: 'profile.tab.achievements.open', mixGroup: 'quest', assetId: 'builtin-quest-complete', volume: 88, cooldownMs: 150 },
  { soundPackId: 'soundpack-void-command', eventName: 'profile.tab.activity.open', mixGroup: 'ui', assetId: 'builtin-ui-select', volume: 80, cooldownMs: 100 },
  { soundPackId: 'soundpack-void-command', eventName: 'profile.tab.log.open', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 80, cooldownMs: 130 },
  { soundPackId: 'soundpack-void-command', eventName: 'profile.avatar.loadout.empty', mixGroup: 'notifications', assetId: 'builtin-notify-soft', volume: 88, cooldownMs: 220 },
  { soundPackId: 'soundpack-void-command', eventName: 'profile.avatar.loadout.partial', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 80, cooldownMs: 180 },
  { soundPackId: 'soundpack-void-command', eventName: 'profile.avatar.loadout.ready', mixGroup: 'quest', assetId: 'builtin-quest-complete', volume: 88, cooldownMs: 280 },
  { soundPackId: 'soundpack-void-command', eventName: 'quest.completed', mixGroup: 'quest', assetId: 'builtin-quest-complete', volume: 92, cooldownMs: 320 },
  { soundPackId: 'soundpack-void-command', eventName: 'quest.reward.burst', mixGroup: 'quest', assetId: 'builtin-quest-complete', volume: 90, cooldownMs: 220 },
  { soundPackId: 'soundpack-void-command', eventName: 'quest.debrief.opened', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 80, cooldownMs: 200 },
  { soundPackId: 'soundpack-void-command', eventName: 'dusk.brief.loaded', mixGroup: 'dusk', assetId: 'builtin-dusk-relay', volume: 80, cooldownMs: 160 },
  { soundPackId: 'soundpack-ops-amber', eventName: 'nav.section.profile.open', mixGroup: 'ui', assetId: 'builtin-ui-select', volume: 78, cooldownMs: 80 },
  { soundPackId: 'soundpack-ops-amber', eventName: 'profile.deck.open', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 88, cooldownMs: 120 },
  { soundPackId: 'soundpack-ops-amber', eventName: 'profile.tab.profile.open', mixGroup: 'ui', assetId: 'builtin-ui-select', volume: 76, cooldownMs: 90 },
  { soundPackId: 'soundpack-ops-amber', eventName: 'profile.tab.health.open', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 86, cooldownMs: 110 },
  { soundPackId: 'soundpack-ops-amber', eventName: 'profile.tab.achievements.open', mixGroup: 'quest', assetId: 'builtin-quest-complete', volume: 92, cooldownMs: 140 },
  { soundPackId: 'soundpack-ops-amber', eventName: 'profile.tab.activity.open', mixGroup: 'ui', assetId: 'builtin-ui-select', volume: 76, cooldownMs: 90 },
  { soundPackId: 'soundpack-ops-amber', eventName: 'profile.tab.log.open', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 84, cooldownMs: 110 },
  { soundPackId: 'soundpack-ops-amber', eventName: 'profile.avatar.loadout.empty', mixGroup: 'notifications', assetId: 'builtin-notify-soft', volume: 90, cooldownMs: 180 },
  { soundPackId: 'soundpack-ops-amber', eventName: 'profile.avatar.loadout.partial', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 84, cooldownMs: 140 },
  { soundPackId: 'soundpack-ops-amber', eventName: 'profile.avatar.loadout.ready', mixGroup: 'quest', assetId: 'builtin-quest-complete', volume: 94, cooldownMs: 260 },
  { soundPackId: 'soundpack-ops-amber', eventName: 'quest.completed', mixGroup: 'quest', assetId: 'builtin-quest-complete', volume: 96, cooldownMs: 280 },
  { soundPackId: 'soundpack-ops-amber', eventName: 'quest.reward.burst', mixGroup: 'quest', assetId: 'builtin-quest-complete', volume: 92, cooldownMs: 200 },
  { soundPackId: 'soundpack-ops-amber', eventName: 'quest.debrief.opened', mixGroup: 'scene_fx', assetId: 'builtin-panel-open', volume: 86, cooldownMs: 180 },
  { soundPackId: 'soundpack-ops-amber', eventName: 'dusk.brief.loaded', mixGroup: 'dusk', assetId: 'builtin-dusk-relay', volume: 82, cooldownMs: 140 },
];

export const DEFAULT_CREATIVE_SCENE_CUES: CreativeSceneCueEntry[] = [
  {
    sceneProfile: 'bureau',
    eventName: 'nav.section.profile.open',
    environmentMode: 'bureau',
    cameraShot: 'hero',
    screenMode: 'base',
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.18,
    cueDurationMs: 1600,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'profile.deck.open',
    environmentMode: 'bureau',
    cameraShot: 'mid',
    screenMode: 'focus',
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.2,
    cueDurationMs: 1400,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'profile.tab.profile.open',
    environmentMode: 'bureau',
    cameraShot: 'hero',
    screenMode: 'base',
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.18,
    cueDurationMs: 1200,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'profile.tab.health.open',
    environmentMode: 'bureau',
    cameraShot: 'hero',
    screenMode: 'focus',
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.24,
    cueDurationMs: 1600,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'profile.tab.achievements.open',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'success',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.28,
    cueDurationMs: 2000,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'profile.tab.activity.open',
    environmentMode: 'bureau',
    cameraShot: 'mid',
    screenMode: 'focus',
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.22,
    cueDurationMs: 1500,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'profile.tab.log.open',
    environmentMode: 'glacier',
    cameraShot: 'mid',
    screenMode: 'brief',
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.2,
    cueDurationMs: 1600,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'profile.scene.reload',
    environmentMode: 'bureau',
    cameraShot: 'wide',
    screenMode: 'base',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.24,
    cueDurationMs: 1800,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'dusk.brief.loaded',
    environmentMode: 'glacier',
    cameraShot: 'mid',
    screenMode: 'brief',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.22,
    cueDurationMs: 2200,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'quest.completed',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'success',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.28,
    cueDurationMs: 2800,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'quest.reward.burst',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'success',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.3,
    cueDurationMs: 1800,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'play.session.start',
    environmentMode: 'bureau',
    cameraShot: 'mid',
    screenMode: 'focus',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.22,
    cueDurationMs: 2000,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'notification.urgent',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'urgent',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.3,
    cueDurationMs: 2600,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'profile.avatar.loadout.empty',
    environmentMode: 'mono',
    cameraShot: 'wide',
    screenMode: 'urgent',
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.16,
    cueDurationMs: 2200,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'profile.avatar.loadout.partial',
    environmentMode: 'bureau',
    cameraShot: 'mid',
    screenMode: 'focus',
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.2,
    cueDurationMs: 1800,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'profile.avatar.loadout.ready',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'success',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.28,
    cueDurationMs: 2600,
  },
  {
    sceneProfile: 'bureau',
    eventName: 'ambient.night.enter',
    environmentMode: 'mono',
    cameraShot: 'wide',
    screenMode: 'base',
    beatPulse: false,
    ringPulse: false,
    groundMotion: false,
    ambientAtmosphere: 0.12,
    cueDurationMs: 3200,
  },
  {
    sceneProfile: 'void',
    eventName: 'nav.section.profile.open',
    environmentMode: 'glacier',
    cameraShot: 'hero',
    screenMode: 'base',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.2,
    cueDurationMs: 1800,
  },
  {
    sceneProfile: 'void',
    eventName: 'dusk.brief.loaded',
    environmentMode: 'glacier',
    cameraShot: 'mid',
    screenMode: 'brief',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.24,
    cueDurationMs: 2400,
  },
  {
    sceneProfile: 'void',
    eventName: 'profile.tab.health.open',
    environmentMode: 'glacier',
    cameraShot: 'hero',
    screenMode: 'focus',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.26,
    cueDurationMs: 1700,
  },
  {
    sceneProfile: 'void',
    eventName: 'profile.tab.achievements.open',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'success',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.34,
    cueDurationMs: 2200,
  },
  {
    sceneProfile: 'void',
    eventName: 'profile.tab.activity.open',
    environmentMode: 'glacier',
    cameraShot: 'mid',
    screenMode: 'focus',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.24,
    cueDurationMs: 1600,
  },
  {
    sceneProfile: 'void',
    eventName: 'profile.tab.log.open',
    environmentMode: 'mono',
    cameraShot: 'mid',
    screenMode: 'brief',
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.18,
    cueDurationMs: 1700,
  },
  {
    sceneProfile: 'void',
    eventName: 'quest.completed',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'success',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.32,
    cueDurationMs: 3000,
  },
  {
    sceneProfile: 'void',
    eventName: 'quest.reward.burst',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'success',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.34,
    cueDurationMs: 1900,
  },
  {
    sceneProfile: 'void',
    eventName: 'play.session.start',
    environmentMode: 'glacier',
    cameraShot: 'mid',
    screenMode: 'focus',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.24,
    cueDurationMs: 2200,
  },
  {
    sceneProfile: 'void',
    eventName: 'notification.urgent',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'urgent',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.34,
    cueDurationMs: 2800,
  },
  {
    sceneProfile: 'void',
    eventName: 'profile.avatar.loadout.empty',
    environmentMode: 'mono',
    cameraShot: 'wide',
    screenMode: 'urgent',
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.18,
    cueDurationMs: 2100,
  },
  {
    sceneProfile: 'void',
    eventName: 'profile.avatar.loadout.partial',
    environmentMode: 'glacier',
    cameraShot: 'mid',
    screenMode: 'focus',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.22,
    cueDurationMs: 1900,
  },
  {
    sceneProfile: 'void',
    eventName: 'profile.avatar.loadout.ready',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'success',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.3,
    cueDurationMs: 2800,
  },
  {
    sceneProfile: 'ops',
    eventName: 'nav.section.profile.open',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'base',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.24,
    cueDurationMs: 1700,
  },
  {
    sceneProfile: 'ops',
    eventName: 'profile.deck.open',
    environmentMode: 'core',
    cameraShot: 'mid',
    screenMode: 'focus',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.26,
    cueDurationMs: 1500,
  },
  {
    sceneProfile: 'ops',
    eventName: 'profile.tab.health.open',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'focus',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.28,
    cueDurationMs: 1500,
  },
  {
    sceneProfile: 'ops',
    eventName: 'profile.tab.achievements.open',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'success',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.36,
    cueDurationMs: 2100,
  },
  {
    sceneProfile: 'ops',
    eventName: 'profile.tab.activity.open',
    environmentMode: 'bureau',
    cameraShot: 'mid',
    screenMode: 'focus',
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.24,
    cueDurationMs: 1400,
  },
  {
    sceneProfile: 'ops',
    eventName: 'profile.tab.log.open',
    environmentMode: 'glacier',
    cameraShot: 'mid',
    screenMode: 'brief',
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.2,
    cueDurationMs: 1500,
  },
  {
    sceneProfile: 'ops',
    eventName: 'dusk.brief.loaded',
    environmentMode: 'core',
    cameraShot: 'mid',
    screenMode: 'brief',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.3,
    cueDurationMs: 2200,
  },
  {
    sceneProfile: 'ops',
    eventName: 'quest.completed',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'success',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.36,
    cueDurationMs: 3200,
  },
  {
    sceneProfile: 'ops',
    eventName: 'quest.reward.burst',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'success',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.38,
    cueDurationMs: 2000,
  },
  {
    sceneProfile: 'ops',
    eventName: 'play.session.start',
    environmentMode: 'core',
    cameraShot: 'mid',
    screenMode: 'focus',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.3,
    cueDurationMs: 2200,
  },
  {
    sceneProfile: 'ops',
    eventName: 'notification.urgent',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'urgent',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.38,
    cueDurationMs: 3000,
  },
  {
    sceneProfile: 'ops',
    eventName: 'profile.avatar.loadout.empty',
    environmentMode: 'dusk',
    cameraShot: 'hero',
    screenMode: 'urgent',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.28,
    cueDurationMs: 2200,
  },
  {
    sceneProfile: 'ops',
    eventName: 'profile.avatar.loadout.partial',
    environmentMode: 'core',
    cameraShot: 'mid',
    screenMode: 'focus',
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    ambientAtmosphere: 0.28,
    cueDurationMs: 1800,
  },
  {
    sceneProfile: 'ops',
    eventName: 'profile.avatar.loadout.ready',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'success',
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    ambientAtmosphere: 0.34,
    cueDurationMs: 2600,
  },
];

export const DEFAULT_CREATIVE_SCENE_STATES: CreativeSceneStateEntry[] = [
  {
    sceneProfile: 'bureau',
    stateKey: 'profile.day',
    environmentMode: 'bureau',
    cameraShot: 'hero',
    screenMode: 'base',
    cameraOrbitSpeed: 0.22,
    ambientAtmosphere: 0.18,
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    modelFloat: true,
    hideLightSource: true,
  },
  {
    sceneProfile: 'bureau',
    stateKey: 'profile.night',
    environmentMode: 'mono',
    cameraShot: 'hero',
    screenMode: 'base',
    cameraOrbitSpeed: 0.16,
    ambientAtmosphere: 0.14,
    beatPulse: false,
    ringPulse: false,
    groundMotion: false,
    modelFloat: true,
    hideLightSource: true,
  },
  {
    sceneProfile: 'bureau',
    stateKey: 'profile.focus',
    environmentMode: 'bureau',
    cameraShot: 'hero',
    screenMode: 'focus',
    cameraOrbitSpeed: 0.24,
    ambientAtmosphere: 0.26,
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    modelFloat: true,
    hideLightSource: true,
  },
  {
    sceneProfile: 'bureau',
    stateKey: 'profile.active',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'focus',
    cameraOrbitSpeed: 0.32,
    ambientAtmosphere: 0.3,
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    modelFloat: false,
    hideLightSource: true,
  },
  {
    sceneProfile: 'void',
    stateKey: 'profile.day',
    environmentMode: 'glacier',
    cameraShot: 'hero',
    screenMode: 'base',
    cameraOrbitSpeed: 0.44,
    ambientAtmosphere: 0.2,
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    modelFloat: true,
    hideLightSource: true,
  },
  {
    sceneProfile: 'void',
    stateKey: 'profile.night',
    environmentMode: 'mono',
    cameraShot: 'wide',
    screenMode: 'base',
    cameraOrbitSpeed: 0.32,
    ambientAtmosphere: 0.12,
    beatPulse: false,
    ringPulse: false,
    groundMotion: false,
    modelFloat: true,
    hideLightSource: true,
  },
  {
    sceneProfile: 'void',
    stateKey: 'profile.focus',
    environmentMode: 'glacier',
    cameraShot: 'mid',
    screenMode: 'focus',
    cameraOrbitSpeed: 0.62,
    ambientAtmosphere: 0.24,
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    modelFloat: true,
    hideLightSource: true,
  },
  {
    sceneProfile: 'void',
    stateKey: 'profile.active',
    environmentMode: 'core',
    cameraShot: 'mid',
    screenMode: 'focus',
    cameraOrbitSpeed: 0.78,
    ambientAtmosphere: 0.28,
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    modelFloat: false,
    hideLightSource: true,
  },
  {
    sceneProfile: 'ops',
    stateKey: 'profile.day',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'base',
    cameraOrbitSpeed: 0.3,
    ambientAtmosphere: 0.22,
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    modelFloat: true,
    hideLightSource: true,
  },
  {
    sceneProfile: 'ops',
    stateKey: 'profile.night',
    environmentMode: 'dusk',
    cameraShot: 'wide',
    screenMode: 'base',
    cameraOrbitSpeed: 0.22,
    ambientAtmosphere: 0.16,
    beatPulse: false,
    ringPulse: true,
    groundMotion: false,
    modelFloat: true,
    hideLightSource: true,
  },
  {
    sceneProfile: 'ops',
    stateKey: 'profile.focus',
    environmentMode: 'core',
    cameraShot: 'mid',
    screenMode: 'focus',
    cameraOrbitSpeed: 0.1,
    ambientAtmosphere: 0.28,
    beatPulse: true,
    ringPulse: true,
    groundMotion: false,
    modelFloat: true,
    hideLightSource: true,
  },
  {
    sceneProfile: 'ops',
    stateKey: 'profile.active',
    environmentMode: 'core',
    cameraShot: 'hero',
    screenMode: 'focus',
    cameraOrbitSpeed: 0.16,
    ambientAtmosphere: 0.34,
    beatPulse: true,
    ringPulse: true,
    groundMotion: true,
    modelFloat: false,
    hideLightSource: true,
  },
];

export const DEFAULT_CREATIVE_SCENE_STATE_BINDINGS: CreativeSceneStateBinding[] = [
  { sceneProfile: 'bureau', eventName: 'play.session.start', stateKey: 'profile.active', holdMs: 18000 },
  { sceneProfile: 'bureau', eventName: 'dusk.brief.loaded', stateKey: 'profile.focus', holdMs: 16000 },
  { sceneProfile: 'bureau', eventName: 'profile.tab.health.open', stateKey: 'profile.focus', holdMs: 12000 },
  { sceneProfile: 'bureau', eventName: 'profile.tab.achievements.open', stateKey: 'profile.focus', holdMs: 12000 },
  { sceneProfile: 'bureau', eventName: 'profile.tab.activity.open', stateKey: 'profile.focus', holdMs: 10000 },
  { sceneProfile: 'bureau', eventName: 'profile.tab.log.open', stateKey: 'profile.focus', holdMs: 10000 },
  { sceneProfile: 'bureau', eventName: 'quest.completed', stateKey: 'profile.focus', holdMs: 12000 },
  { sceneProfile: 'bureau', eventName: 'quest.reward.burst', stateKey: 'profile.focus', holdMs: 9000 },
  { sceneProfile: 'bureau', eventName: 'notification.urgent', stateKey: 'profile.active', holdMs: 15000 },
  { sceneProfile: 'bureau', eventName: 'profile.avatar.loadout.empty', stateKey: 'profile.night', holdMs: 12000 },
  { sceneProfile: 'bureau', eventName: 'profile.avatar.loadout.partial', stateKey: 'profile.focus', holdMs: 12000 },
  { sceneProfile: 'bureau', eventName: 'profile.avatar.loadout.ready', stateKey: 'profile.focus', holdMs: 12000 },
  { sceneProfile: 'bureau', eventName: 'station.skin.fallback', stateKey: 'profile.focus', holdMs: 10000 },
  { sceneProfile: 'void', eventName: 'play.session.start', stateKey: 'profile.active', holdMs: 20000 },
  { sceneProfile: 'void', eventName: 'dusk.brief.loaded', stateKey: 'profile.focus', holdMs: 18000 },
  { sceneProfile: 'void', eventName: 'profile.tab.health.open', stateKey: 'profile.focus', holdMs: 14000 },
  { sceneProfile: 'void', eventName: 'profile.tab.achievements.open', stateKey: 'profile.focus', holdMs: 14000 },
  { sceneProfile: 'void', eventName: 'profile.tab.activity.open', stateKey: 'profile.focus', holdMs: 12000 },
  { sceneProfile: 'void', eventName: 'profile.tab.log.open', stateKey: 'profile.focus', holdMs: 12000 },
  { sceneProfile: 'void', eventName: 'quest.completed', stateKey: 'profile.focus', holdMs: 14000 },
  { sceneProfile: 'void', eventName: 'quest.reward.burst', stateKey: 'profile.focus', holdMs: 10000 },
  { sceneProfile: 'void', eventName: 'notification.urgent', stateKey: 'profile.active', holdMs: 18000 },
  { sceneProfile: 'void', eventName: 'profile.avatar.loadout.empty', stateKey: 'profile.night', holdMs: 14000 },
  { sceneProfile: 'void', eventName: 'profile.avatar.loadout.partial', stateKey: 'profile.focus', holdMs: 14000 },
  { sceneProfile: 'void', eventName: 'profile.avatar.loadout.ready', stateKey: 'profile.focus', holdMs: 14000 },
  { sceneProfile: 'void', eventName: 'station.skin.fallback', stateKey: 'profile.focus', holdMs: 12000 },
  { sceneProfile: 'ops', eventName: 'play.session.start', stateKey: 'profile.active', holdMs: 22000 },
  { sceneProfile: 'ops', eventName: 'dusk.brief.loaded', stateKey: 'profile.focus', holdMs: 20000 },
  { sceneProfile: 'ops', eventName: 'profile.tab.health.open', stateKey: 'profile.focus', holdMs: 14000 },
  { sceneProfile: 'ops', eventName: 'profile.tab.achievements.open', stateKey: 'profile.active', holdMs: 14000 },
  { sceneProfile: 'ops', eventName: 'profile.tab.activity.open', stateKey: 'profile.focus', holdMs: 12000 },
  { sceneProfile: 'ops', eventName: 'profile.tab.log.open', stateKey: 'profile.focus', holdMs: 12000 },
  { sceneProfile: 'ops', eventName: 'quest.completed', stateKey: 'profile.active', holdMs: 14000 },
  { sceneProfile: 'ops', eventName: 'quest.reward.burst', stateKey: 'profile.active', holdMs: 10000 },
  { sceneProfile: 'ops', eventName: 'notification.urgent', stateKey: 'profile.active', holdMs: 22000 },
  { sceneProfile: 'ops', eventName: 'profile.avatar.loadout.empty', stateKey: 'profile.active', holdMs: 16000 },
  { sceneProfile: 'ops', eventName: 'profile.avatar.loadout.partial', stateKey: 'profile.focus', holdMs: 14000 },
  { sceneProfile: 'ops', eventName: 'profile.avatar.loadout.ready', stateKey: 'profile.active', holdMs: 14000 },
  { sceneProfile: 'ops', eventName: 'station.skin.fallback', stateKey: 'profile.active', holdMs: 12000 },
];

export const DEFAULT_CREATIVE_SCENE_SCREEN_PRESETS: CreativeSceneScreenPreset[] = [
  { sceneProfile: 'bureau', mode: 'base', missionLabel: 'MISSION', roleLabel: 'AVATAR', traceLabel: 'TRACE', fallbackMissionText: 'No active mission.\nOpen Play to seed the next loop.', fallbackRoleText: 'Profile link online' },
  { sceneProfile: 'bureau', mode: 'focus', missionLabel: 'FOCUS', roleLabel: 'MODE', traceLabel: 'WINDOW', fallbackMissionText: 'Lock into the active loop.\nKeep the session clean and controlled.', fallbackRoleText: 'Focus lock active' },
  { sceneProfile: 'bureau', mode: 'brief', missionLabel: 'BRIEF', roleLabel: 'DUSK', traceLabel: 'INTEL', fallbackMissionText: 'Dusk relay loaded.\nReview the brief and route the next move.', fallbackRoleText: 'Relay channel online' },
  { sceneProfile: 'bureau', mode: 'urgent', missionLabel: 'URGENT', roleLabel: 'STATUS', traceLabel: 'ALERT', fallbackMissionText: 'Immediate review required.\nReturn to Play and resolve the pressure signal.', fallbackRoleText: 'Urgent watch active' },
  { sceneProfile: 'bureau', mode: 'success', missionLabel: 'COMPLETE', roleLabel: 'STATUS', traceLabel: 'REWARD', fallbackMissionText: 'Objective confirmed.\nReward and debrief ready.', fallbackRoleText: 'Completion signal locked' },
  { sceneProfile: 'void', mode: 'base', missionLabel: 'VECTOR', roleLabel: 'FRAME', traceLabel: 'SIGNAL', fallbackMissionText: 'No mission in frame.\nAcquire the next vector through Play.', fallbackRoleText: 'Profile relay online' },
  { sceneProfile: 'void', mode: 'focus', missionLabel: 'CHANNEL', roleLabel: 'MODE', traceLabel: 'BAND', fallbackMissionText: 'Narrow to the active thread.\nSustain precision until release.', fallbackRoleText: 'Focus channel active' },
  { sceneProfile: 'void', mode: 'brief', missionLabel: 'RELAY', roleLabel: 'DUSK', traceLabel: 'ECHO', fallbackMissionText: 'External brief received.\nTranslate signal into action.', fallbackRoleText: 'Relay stream active' },
  { sceneProfile: 'void', mode: 'urgent', missionLabel: 'THREAT', roleLabel: 'STATUS', traceLabel: 'SPIKE', fallbackMissionText: 'Pressure spike detected.\nResolve the active threat line.', fallbackRoleText: 'Urgent pressure rising' },
  { sceneProfile: 'void', mode: 'success', missionLabel: 'CLEARED', roleLabel: 'STATUS', traceLabel: 'TRACE', fallbackMissionText: 'Objective cleared.\nStabilize and route the next thread.', fallbackRoleText: 'Completion trace stable' },
  { sceneProfile: 'ops', mode: 'base', missionLabel: 'OPS', roleLabel: 'UNIT', traceLabel: 'BOARD', fallbackMissionText: 'Standby until the next op is assigned.', fallbackRoleText: 'Operator shell active' },
  { sceneProfile: 'ops', mode: 'focus', missionLabel: 'LOCK', roleLabel: 'MODE', traceLabel: 'WINDOW', fallbackMissionText: 'Task window active.\nHold the lane until handoff.', fallbackRoleText: 'Focus lock armed' },
  { sceneProfile: 'ops', mode: 'brief', missionLabel: 'ORDERS', roleLabel: 'DUSK', traceLabel: 'INTEL', fallbackMissionText: 'Brief packet received.\nReview and execute without drift.', fallbackRoleText: 'Relay orders online' },
  { sceneProfile: 'ops', mode: 'urgent', missionLabel: 'ALERT', roleLabel: 'STATUS', traceLabel: 'PRIORITY', fallbackMissionText: 'Immediate operator response required.', fallbackRoleText: 'Urgent command state' },
  { sceneProfile: 'ops', mode: 'success', missionLabel: 'SECURED', roleLabel: 'STATUS', traceLabel: 'AFTER', fallbackMissionText: 'Objective secured.\nDebrief and prepare the next op.', fallbackRoleText: 'Success signal confirmed' },
];

const buildDefaultCreativeAvatarLoadoutSlots = (
  sceneProfile: CreativeSkinPack['sceneProfile'],
  avatarProfile: CreativeAvatarProfile
): CreativeAvatarLoadoutSlot[] => {
  if (avatarProfile === 'ops') {
    return [
      { id: `${sceneProfile}-insignia`, label: 'insignia', icon: '🪪', equipped: true, binding: 'theme' },
      { id: `${sceneProfile}-comms`, label: 'comms', icon: '📡', equipped: true, binding: 'sound' },
      { id: `${sceneProfile}-panel`, label: 'panel', icon: '🖥', equipped: true, binding: 'widget' },
      { id: `${sceneProfile}-protocol`, label: 'protocol', icon: '📘', equipped: true, binding: 'module' },
      { id: `${sceneProfile}-field`, label: 'field', icon: '🎒', equipped: false, binding: 'any' },
      { id: `${sceneProfile}-mod`, label: 'mod', icon: '🔧', equipped: true, binding: 'any' },
    ];
  }
  if (avatarProfile === 'minimal') {
    return [
      { id: `${sceneProfile}-shell`, label: 'shell', icon: '◼', equipped: true, binding: 'theme' },
      { id: `${sceneProfile}-tone`, label: 'tone', icon: '◎', equipped: true, binding: 'sound' },
      { id: `${sceneProfile}-signal`, label: 'signal', icon: '↗', equipped: true, binding: 'widget' },
      { id: `${sceneProfile}-rule`, label: 'rule', icon: '▣', equipped: true, binding: 'module' },
      { id: `${sceneProfile}-token`, label: 'token', icon: '◇', equipped: false, binding: 'any' },
      { id: `${sceneProfile}-note`, label: 'note', icon: '✎', equipped: false, binding: 'any' },
    ];
  }
  return [
    { id: `${sceneProfile}-shell`, label: 'shell', icon: '⚙', equipped: true, binding: 'theme' },
    { id: `${sceneProfile}-audio`, label: 'audio', icon: '🔊', equipped: true, binding: 'sound' },
    { id: `${sceneProfile}-widget`, label: 'widget', icon: '✦', equipped: true, binding: 'widget' },
    { id: `${sceneProfile}-module`, label: 'module', icon: '🧰', equipped: true, binding: 'module' },
    { id: `${sceneProfile}-relay`, label: 'relay', icon: '📶', equipped: false, binding: 'any' },
    { id: `${sceneProfile}-vault`, label: 'vault', icon: '🗂', equipped: false, binding: 'any' },
  ];
};

const buildDefaultCreativeAvatarPresencePresets = (
  sceneProfile: CreativeSkinPack['sceneProfile'],
  avatarProfile: CreativeAvatarProfile
): CreativeAvatarPresencePreset[] => {
  const defaultBehaviorByScene: Record<
    CreativeSkinPack['sceneProfile'],
    Record<
      CreativeAvatarLoadoutPresenceState,
      Pick<CreativeAvatarPresencePreset, 'sceneStateOverride' | 'screenModeOverride'>
    >
  > = {
    bureau: {
      empty: { sceneStateOverride: 'profile.night', screenModeOverride: 'base' },
      partial: { sceneStateOverride: 'profile.focus', screenModeOverride: 'focus' },
      ready: { sceneStateOverride: 'profile.active', screenModeOverride: 'focus' },
    },
    void: {
      empty: { sceneStateOverride: 'profile.night', screenModeOverride: 'base' },
      partial: { sceneStateOverride: 'profile.focus', screenModeOverride: 'brief' },
      ready: { sceneStateOverride: 'profile.active', screenModeOverride: 'focus' },
    },
    ops: {
      empty: { sceneStateOverride: 'profile.night', screenModeOverride: 'brief' },
      partial: { sceneStateOverride: 'profile.focus', screenModeOverride: 'focus' },
      ready: { sceneStateOverride: 'profile.active', screenModeOverride: 'focus' },
    },
  };
  const byScene: Record<
    CreativeSkinPack['sceneProfile'],
    Record<
      CreativeAvatarProfile,
      Record<
        CreativeAvatarLoadoutPresenceState,
        Omit<CreativeAvatarPresencePreset, 'state' | 'sceneStateOverride' | 'screenModeOverride'>
      >
    >
  > = {
    bureau: {
      station: {
        empty: {
          label: 'shell offline',
          deckPrompt: 'Author the first station assets to bring this bureau shell online.',
          statusLabel: 'Shell Offline',
          roleFallbackText: 'Core assets not yet assigned',
          previewRoleText: 'Empty shell awaiting first asset',
        },
        partial: {
          label: 'shell aligning',
          deckPrompt: 'The station shell is aligning. Finish the missing bindings to stabilize the bureau profile.',
          statusLabel: 'Shell Aligning',
          roleFallbackText: 'Core assets are partially mapped',
          previewRoleText: 'Partial shell alignment in progress',
        },
        ready: {
          label: 'station ready',
          deckPrompt: 'The bureau station is ready. Use the deck to route identity, stats, and loadout.',
          statusLabel: 'Station Ready',
          roleFallbackText: 'Bureau station fully online',
          previewRoleText: 'Ready bureau station shell',
        },
      },
      ops: {
        empty: {
          label: 'field shell offline',
          deckPrompt: 'Field protocol is missing key assets. Restore command, sound, widget, and module bindings.',
          statusLabel: 'Field Shell Offline',
          roleFallbackText: 'Field assets missing',
          previewRoleText: 'Empty operator shell',
        },
        partial: {
          label: 'field shell staging',
          deckPrompt: 'Field shell staging in progress. Complete the missing bindings before launch.',
          statusLabel: 'Field Shell Staging',
          roleFallbackText: 'Field shell partially online',
          previewRoleText: 'Operator shell staging',
        },
        ready: {
          label: 'field shell ready',
          deckPrompt: 'Operator shell is ready. Open the deck for field status, loadout, and relay.',
          statusLabel: 'Field Shell Ready',
          roleFallbackText: 'Operator shell fully online',
          previewRoleText: 'Ready operator shell',
        },
      },
      minimal: {
        empty: {
          label: 'minimal shell idle',
          deckPrompt: 'This shell is intentionally light, but it still needs core bindings to become useful.',
          statusLabel: 'Minimal Shell Idle',
          roleFallbackText: 'Minimal shell not yet equipped',
          previewRoleText: 'Minimal shell empty',
        },
        partial: {
          label: 'minimal shell steady',
          deckPrompt: 'The minimal shell is steady. Complete the missing bindings to lock the carry set.',
          statusLabel: 'Minimal Shell Steady',
          roleFallbackText: 'Minimal shell partially equipped',
          previewRoleText: 'Minimal shell partial',
        },
        ready: {
          label: 'minimal shell ready',
          deckPrompt: 'The minimal shell is ready. Open the deck for the active carry set.',
          statusLabel: 'Minimal Shell Ready',
          roleFallbackText: 'Minimal shell fully equipped',
          previewRoleText: 'Ready minimal shell',
        },
      },
    },
    void: {
      station: {
        empty: {
          label: 'signal frame dark',
          deckPrompt: 'The signal frame is dark. Route the missing station assets to restore the feed.',
          statusLabel: 'Signal Frame Dark',
          roleFallbackText: 'Signal frame missing assets',
          previewRoleText: 'Empty signal frame',
        },
        partial: {
          label: 'signal frame stabilizing',
          deckPrompt: 'The frame is stabilizing. Complete the remaining bindings to lock the vector.',
          statusLabel: 'Signal Stabilizing',
          roleFallbackText: 'Signal frame partially online',
          previewRoleText: 'Partial signal frame',
        },
        ready: {
          label: 'signal frame ready',
          deckPrompt: 'The signal frame is ready. Open the deck and route the next vector.',
          statusLabel: 'Signal Frame Ready',
          roleFallbackText: 'Signal frame fully online',
          previewRoleText: 'Ready signal frame',
        },
      },
      ops: {
        empty: {
          label: 'command frame dark',
          deckPrompt: 'Command frame is dark. Restore tactical bindings before issuing the next directive.',
          statusLabel: 'Command Frame Dark',
          roleFallbackText: 'Command frame offline',
          previewRoleText: 'Empty command shell',
        },
        partial: {
          label: 'command frame syncing',
          deckPrompt: 'Command frame is syncing. Complete the missing tactical bindings to stabilize it.',
          statusLabel: 'Command Frame Syncing',
          roleFallbackText: 'Command frame partially online',
          previewRoleText: 'Command shell syncing',
        },
        ready: {
          label: 'command frame ready',
          deckPrompt: 'Command frame is ready. Open the deck for tactical loadout and relay.',
          statusLabel: 'Command Frame Ready',
          roleFallbackText: 'Command frame online',
          previewRoleText: 'Ready command shell',
        },
      },
      minimal: {
        empty: {
          label: 'frame idle',
          deckPrompt: 'The frame is idle. Route the first bindings to wake the shell.',
          statusLabel: 'Frame Idle',
          roleFallbackText: 'Frame not yet equipped',
          previewRoleText: 'Empty frame',
        },
        partial: {
          label: 'frame tracing',
          deckPrompt: 'The frame is tracing. Resolve the missing bindings to close the circuit.',
          statusLabel: 'Frame Tracing',
          roleFallbackText: 'Frame partially equipped',
          previewRoleText: 'Partial frame',
        },
        ready: {
          label: 'frame ready',
          deckPrompt: 'The frame is ready. Open the deck to inspect the active set.',
          statusLabel: 'Frame Ready',
          roleFallbackText: 'Frame fully equipped',
          previewRoleText: 'Ready frame',
        },
      },
    },
    ops: {
      station: {
        empty: {
          label: 'station cold',
          deckPrompt: 'Mission station is cold. Restore the required bindings before running the lane.',
          statusLabel: 'Station Cold',
          roleFallbackText: 'Mission station missing assets',
          previewRoleText: 'Cold station shell',
        },
        partial: {
          label: 'station staging',
          deckPrompt: 'Mission station is staging. Finish the missing bindings before deployment.',
          statusLabel: 'Station Staging',
          roleFallbackText: 'Mission station partially online',
          previewRoleText: 'Staging station shell',
        },
        ready: {
          label: 'station hot',
          deckPrompt: 'Mission station is hot. Open the deck for live status and active mission loadout.',
          statusLabel: 'Station Hot',
          roleFallbackText: 'Mission station online',
          previewRoleText: 'Hot station shell',
        },
      },
      ops: {
        empty: {
          label: 'operator cold',
          deckPrompt: 'Operator shell is cold. Restore essential bindings before field deployment.',
          statusLabel: 'Operator Cold',
          roleFallbackText: 'Operator shell missing assets',
          previewRoleText: 'Cold operator shell',
        },
        partial: {
          label: 'operator staging',
          deckPrompt: 'Operator shell is staging. Complete the missing tactical bindings.',
          statusLabel: 'Operator Staging',
          roleFallbackText: 'Operator shell partially online',
          previewRoleText: 'Staging operator shell',
        },
        ready: {
          label: 'operator ready',
          deckPrompt: 'Operator shell is ready. Open the deck for field status, relay, and active loadout.',
          statusLabel: 'Operator Ready',
          roleFallbackText: 'Operator shell fully online',
          previewRoleText: 'Ready operator shell',
        },
      },
      minimal: {
        empty: {
          label: 'shell cold',
          deckPrompt: 'Minimal shell is cold. Route the essential bindings to activate it.',
          statusLabel: 'Shell Cold',
          roleFallbackText: 'Minimal shell missing assets',
          previewRoleText: 'Cold minimal shell',
        },
        partial: {
          label: 'shell aligning',
          deckPrompt: 'Minimal shell is aligning. Finish the remaining bindings to lock the carry set.',
          statusLabel: 'Shell Aligning',
          roleFallbackText: 'Minimal shell partially online',
          previewRoleText: 'Aligning minimal shell',
        },
        ready: {
          label: 'shell ready',
          deckPrompt: 'Minimal shell is ready. Open the deck for the active carry set.',
          statusLabel: 'Shell Ready',
          roleFallbackText: 'Minimal shell fully online',
          previewRoleText: 'Ready minimal shell',
        },
      },
    },
  };

  return (['empty', 'partial', 'ready'] as const).map((state) => ({
    state,
    ...defaultBehaviorByScene[sceneProfile][state],
    ...byScene[sceneProfile][avatarProfile][state],
  }));
};

const buildDefaultCreativeSceneAvatarPreset = (
  sceneProfile: CreativeSkinPack['sceneProfile'],
  avatarProfile: CreativeAvatarProfile
): CreativeSceneAvatarPreset => {
  const byScene: Record<
    CreativeSkinPack['sceneProfile'],
    Record<
      CreativeAvatarProfile,
      Omit<CreativeSceneAvatarPreset, 'sceneProfile' | 'avatarProfile' | 'loadoutSlots'>
    >
  > = {
    bureau: {
      station: {
        shellLabel: 'Profile Deck',
        identityBadge: 'Bureau Station',
        deckPrompt: 'Open the deck for identity, stats, and loadout.',
        loadoutTitle: 'System Loadout',
        loadoutDescription: 'Active XTATION capabilities currently shaping this station.',
        capabilityLabel: 'Station Assets',
        relayLabel: 'Profile Relay',
        statusLabel: 'Scene Lobby',
        roleFallbackText: 'Profile link online',
        previewRoleText: 'Station shell active',
      },
      ops: {
        shellLabel: 'Operator Deck',
        identityBadge: 'Field Operator',
        deckPrompt: 'Open the deck for operator status, field stats, and loadout.',
        loadoutTitle: 'Field Loadout',
        loadoutDescription: 'Active XTATION capabilities currently shaping this operator shell.',
        capabilityLabel: 'Field Assets',
        relayLabel: 'Operator Relay',
        statusLabel: 'Operator Lobby',
        roleFallbackText: 'Operator shell online',
        previewRoleText: 'Operator shell active',
      },
      minimal: {
        shellLabel: 'Identity Deck',
        identityBadge: 'Minimal Shell',
        deckPrompt: 'Open the deck for identity and current station state.',
        loadoutTitle: 'Carry Set',
        loadoutDescription: 'Only the essential XTATION capabilities remain in this shell.',
        capabilityLabel: 'Active Slots',
        relayLabel: 'Identity Relay',
        statusLabel: 'Identity Lobby',
        roleFallbackText: 'Minimal shell online',
        previewRoleText: 'Minimal shell active',
      },
    },
    void: {
      station: {
        shellLabel: 'Vector Deck',
        identityBadge: 'Signal Frame',
        deckPrompt: 'Open the deck for identity, stats, and live signal loadout.',
        loadoutTitle: 'Signal Loadout',
        loadoutDescription: 'Active XTATION capabilities currently shaping this signal frame.',
        capabilityLabel: 'Live Signals',
        relayLabel: 'Signal Relay',
        statusLabel: 'Signal Lobby',
        roleFallbackText: 'Relay frame online',
        previewRoleText: 'Signal shell active',
      },
      ops: {
        shellLabel: 'Command Deck',
        identityBadge: 'Command Frame',
        deckPrompt: 'Open the deck for operator status, command stats, and tactical loadout.',
        loadoutTitle: 'Tactical Loadout',
        loadoutDescription: 'Active XTATION capabilities currently shaping this command shell.',
        capabilityLabel: 'Tactical Assets',
        relayLabel: 'Command Relay',
        statusLabel: 'Command Lobby',
        roleFallbackText: 'Command shell online',
        previewRoleText: 'Command shell active',
      },
      minimal: {
        shellLabel: 'Frame Deck',
        identityBadge: 'Minimal Frame',
        deckPrompt: 'Open the deck for identity and the current signal frame.',
        loadoutTitle: 'Active Set',
        loadoutDescription: 'Only the most essential XTATION capabilities remain in the frame.',
        capabilityLabel: 'Active Signals',
        relayLabel: 'Frame Relay',
        statusLabel: 'Frame Lobby',
        roleFallbackText: 'Minimal frame online',
        previewRoleText: 'Minimal frame active',
      },
    },
    ops: {
      station: {
        shellLabel: 'Station Deck',
        identityBadge: 'Mission Station',
        deckPrompt: 'Open the deck for mission identity, status, and station loadout.',
        loadoutTitle: 'Mission Loadout',
        loadoutDescription: 'Active XTATION capabilities currently shaping this station shell.',
        capabilityLabel: 'Mission Assets',
        relayLabel: 'Station Relay',
        statusLabel: 'Station Lobby',
        roleFallbackText: 'Station shell online',
        previewRoleText: 'Station shell active',
      },
      ops: {
        shellLabel: 'Operator Deck',
        identityBadge: 'Ops Operator',
        deckPrompt: 'Open the deck for operator status, mission stats, and field loadout.',
        loadoutTitle: 'Field Loadout',
        loadoutDescription: 'Active XTATION capabilities currently shaping this field operator shell.',
        capabilityLabel: 'Field Assets',
        relayLabel: 'Operator Relay',
        statusLabel: 'Operator Lobby',
        roleFallbackText: 'Operator shell online',
        previewRoleText: 'Operator shell active',
      },
      minimal: {
        shellLabel: 'Shell Deck',
        identityBadge: 'Active Shell',
        deckPrompt: 'Open the deck for identity and the active operator shell.',
        loadoutTitle: 'Carry Set',
        loadoutDescription: 'Only the essential XTATION capabilities remain active in this shell.',
        capabilityLabel: 'Active Slots',
        relayLabel: 'Shell Relay',
        statusLabel: 'Shell Lobby',
        roleFallbackText: 'Minimal shell online',
        previewRoleText: 'Minimal shell active',
      },
    },
  };

  return {
    sceneProfile,
    avatarProfile,
    ...byScene[sceneProfile][avatarProfile],
    loadoutSlots: buildDefaultCreativeAvatarLoadoutSlots(sceneProfile, avatarProfile),
    presencePresets: buildDefaultCreativeAvatarPresencePresets(sceneProfile, avatarProfile),
  };
};

export const DEFAULT_CREATIVE_SCENE_AVATAR_PRESETS: CreativeSceneAvatarPreset[] = (
  ['bureau', 'void', 'ops'] as const
).flatMap((sceneProfile) =>
  (['station', 'ops', 'minimal'] as const).map((avatarProfile) =>
    buildDefaultCreativeSceneAvatarPreset(sceneProfile, avatarProfile)
  )
);

export const DEFAULT_CREATIVE_SCENE_RESPONSE_PRESETS: CreativeSceneResponsePreset[] = [
  { sceneProfile: 'bureau', responseType: 'focus', environmentMode: 'bureau', cameraShot: 'hero', screenMode: 'focus', transitionStyle: 'calm', cameraOrbitSpeed: 0.28, targetStateKey: 'profile.active', holdMs: 18000, beatPulse: true, ringPulse: true, groundMotion: false, ambientAtmosphere: 0.26, cueDurationMs: 2000 },
  { sceneProfile: 'bureau', responseType: 'brief', environmentMode: 'glacier', cameraShot: 'hero', screenMode: 'brief', transitionStyle: 'calm', cameraOrbitSpeed: 0.34, targetStateKey: 'profile.focus', holdMs: 16000, beatPulse: true, ringPulse: true, groundMotion: false, ambientAtmosphere: 0.26, cueDurationMs: 2200 },
  { sceneProfile: 'bureau', responseType: 'reward', environmentMode: 'core', cameraShot: 'hero', screenMode: 'success', transitionStyle: 'surge', cameraOrbitSpeed: 0.72, targetStateKey: 'profile.focus', holdMs: 12000, beatPulse: true, ringPulse: true, groundMotion: true, ambientAtmosphere: 0.28, cueDurationMs: 2800 },
  { sceneProfile: 'bureau', responseType: 'alert', environmentMode: 'core', cameraShot: 'hero', screenMode: 'urgent', transitionStyle: 'sharp', cameraOrbitSpeed: null, targetStateKey: 'profile.active', holdMs: 15000, beatPulse: true, ringPulse: true, groundMotion: true, ambientAtmosphere: 0.3, cueDurationMs: 2600 },
  { sceneProfile: 'void', responseType: 'focus', environmentMode: 'glacier', cameraShot: 'mid', screenMode: 'focus', transitionStyle: 'surge', cameraOrbitSpeed: 0.9, targetStateKey: 'profile.active', holdMs: 20000, beatPulse: true, ringPulse: true, groundMotion: false, ambientAtmosphere: 0.24, cueDurationMs: 2200 },
  { sceneProfile: 'void', responseType: 'brief', environmentMode: 'glacier', cameraShot: 'mid', screenMode: 'brief', transitionStyle: 'calm', cameraOrbitSpeed: 0.68, targetStateKey: 'profile.focus', holdMs: 18000, beatPulse: true, ringPulse: true, groundMotion: false, ambientAtmosphere: 0.24, cueDurationMs: 2400 },
  { sceneProfile: 'void', responseType: 'reward', environmentMode: 'core', cameraShot: 'hero', screenMode: 'success', transitionStyle: 'surge', cameraOrbitSpeed: 1.05, targetStateKey: 'profile.focus', holdMs: 14000, beatPulse: true, ringPulse: true, groundMotion: true, ambientAtmosphere: 0.32, cueDurationMs: 3000 },
  { sceneProfile: 'void', responseType: 'alert', environmentMode: 'core', cameraShot: 'hero', screenMode: 'urgent', transitionStyle: 'sharp', cameraOrbitSpeed: null, targetStateKey: 'profile.active', holdMs: 18000, beatPulse: true, ringPulse: true, groundMotion: true, ambientAtmosphere: 0.34, cueDurationMs: 2800 },
  { sceneProfile: 'ops', responseType: 'focus', environmentMode: 'core', cameraShot: 'mid', screenMode: 'focus', transitionStyle: 'sharp', cameraOrbitSpeed: null, targetStateKey: 'profile.active', holdMs: 22000, beatPulse: true, ringPulse: true, groundMotion: false, ambientAtmosphere: 0.3, cueDurationMs: 2200 },
  { sceneProfile: 'ops', responseType: 'brief', environmentMode: 'core', cameraShot: 'mid', screenMode: 'brief', transitionStyle: 'sharp', cameraOrbitSpeed: null, targetStateKey: 'profile.focus', holdMs: 20000, beatPulse: true, ringPulse: true, groundMotion: false, ambientAtmosphere: 0.3, cueDurationMs: 2200 },
  { sceneProfile: 'ops', responseType: 'reward', environmentMode: 'core', cameraShot: 'hero', screenMode: 'success', transitionStyle: 'surge', cameraOrbitSpeed: 1.1, targetStateKey: 'profile.active', holdMs: 14000, beatPulse: true, ringPulse: true, groundMotion: true, ambientAtmosphere: 0.36, cueDurationMs: 3200 },
  { sceneProfile: 'ops', responseType: 'alert', environmentMode: 'core', cameraShot: 'hero', screenMode: 'urgent', transitionStyle: 'sharp', cameraOrbitSpeed: null, targetStateKey: 'profile.active', holdMs: 22000, beatPulse: true, ringPulse: true, groundMotion: true, ambientAtmosphere: 0.38, cueDurationMs: 3000 },
];

const DEFAULT_SCENE_STATE_KEYS: CreativeSceneStateKey[] = [
  'profile.day',
  'profile.night',
  'profile.focus',
  'profile.active',
];

const DEFAULT_SCREEN_MODES: CreativeSceneScreenMode[] = ['base', 'focus', 'brief', 'urgent', 'success'];
const DEFAULT_RESPONSE_TYPES: CreativeSceneResponseType[] = ['focus', 'brief', 'reward', 'alert'];
const DEFAULT_LIGHT_PRESET_KEYS: CreativeSceneLightPresetKey[] = [
  'day',
  'night',
  'focus',
  'active',
  'base',
  'brief',
  'reward',
  'alert',
];
const DEFAULT_MOTION_PRESET_KEYS: CreativeSceneMotionPresetKey[] = [
  'day',
  'night',
  'focus',
  'active',
  'base',
  'brief',
  'reward',
  'alert',
];
const RESPONSE_PRESET_EVENT_MAP: Record<CreativeSceneResponseType, readonly string[]> = {
  focus: ['play.session.start', 'profile.avatar.loadout.partial'],
  brief: ['dusk.brief.loaded'],
  reward: ['quest.completed', 'quest.reward.burst', 'profile.avatar.loadout.ready'],
  alert: ['notification.urgent', 'profile.avatar.loadout.empty'],
};
const LIGHT_PRESET_TO_STATE_KEY: Partial<Record<CreativeSceneLightPresetKey, CreativeSceneStateKey>> = {
  day: 'profile.day',
  night: 'profile.night',
  focus: 'profile.focus',
  active: 'profile.active',
};
const LIGHT_PRESET_TO_RESPONSE_TYPE: Partial<Record<CreativeSceneLightPresetKey, CreativeSceneResponseType>> = {
  focus: 'focus',
  brief: 'brief',
  reward: 'reward',
  alert: 'alert',
};
const MOTION_PRESET_TO_STATE_KEY: Partial<Record<CreativeSceneMotionPresetKey, CreativeSceneStateKey>> = {
  day: 'profile.day',
  night: 'profile.night',
  focus: 'profile.focus',
  active: 'profile.active',
};
const MOTION_PRESET_TO_RESPONSE_TYPE: Partial<Record<CreativeSceneMotionPresetKey, CreativeSceneResponseType>> = {
  focus: 'focus',
  brief: 'brief',
  reward: 'reward',
  alert: 'alert',
};

const createCreativeSceneLightRig = (
  keyIntensity: number,
  fillIntensity: number,
  keyColor: string,
  fillColor: string
): CreativeSceneLightRig => ({
  keyIntensity,
  fillIntensity,
  keyColor,
  fillColor,
});

const DEFAULT_CREATIVE_LIGHT_RIGS = {
  bureau: {
    day: createCreativeSceneLightRig(1.32, 0.32, '#ffcf78', '#f6dfb2'),
    night: createCreativeSceneLightRig(1.02, 0.1, '#e4bf84', '#66718e'),
    focus: createCreativeSceneLightRig(1.44, 0.34, '#ffc565', '#f7d79d'),
    active: createCreativeSceneLightRig(1.56, 0.38, '#ffb34e', '#f4cc84'),
    base: createCreativeSceneLightRig(1.3, 0.28, '#f7c56f', '#efd8ab'),
    brief: createCreativeSceneLightRig(1.28, 0.38, '#cde6ff', '#bdd2ff'),
    reward: createCreativeSceneLightRig(1.62, 0.46, '#ffd65e', '#ffe8a8'),
    alert: createCreativeSceneLightRig(1.7, 0.34, '#ff8b46', '#f8c08c'),
  },
  void: {
    day: createCreativeSceneLightRig(1.06, 0.36, '#8fd3ff', '#aab7ff'),
    night: createCreativeSceneLightRig(0.68, 0.14, '#8cb4d6', '#556074'),
    focus: createCreativeSceneLightRig(1.24, 0.42, '#77dcff', '#94bbff'),
    active: createCreativeSceneLightRig(1.36, 0.48, '#73d0ff', '#9ec1ff'),
    base: createCreativeSceneLightRig(1.1, 0.34, '#8dcfff', '#a2b8ff'),
    brief: createCreativeSceneLightRig(1.18, 0.46, '#b0f2ff', '#9dbeff'),
    reward: createCreativeSceneLightRig(1.42, 0.58, '#7af0ff', '#d0fdff'),
    alert: createCreativeSceneLightRig(1.54, 0.46, '#ff5c72', '#ffb2c2'),
  },
  ops: {
    day: createCreativeSceneLightRig(1.2, 0.46, '#ffb24b', '#ffd08f'),
    night: createCreativeSceneLightRig(0.84, 0.22, '#c78b43', '#786852'),
    focus: createCreativeSceneLightRig(1.36, 0.52, '#ffae3f', '#ffd48b'),
    active: createCreativeSceneLightRig(1.48, 0.58, '#ff9f30', '#ffd178'),
    base: createCreativeSceneLightRig(1.22, 0.44, '#ffb04c', '#ffd18f'),
    brief: createCreativeSceneLightRig(1.3, 0.54, '#ffbf66', '#ffe1a3'),
    reward: createCreativeSceneLightRig(1.58, 0.68, '#ffd24a', '#fff0a8'),
    alert: createCreativeSceneLightRig(1.68, 0.54, '#ff6a34', '#ffbf93'),
  },
} satisfies Record<CreativeSkinPack['sceneProfile'], Record<string, CreativeSceneLightRig>>;

const DEFAULT_CREATIVE_MOTION_PRESETS = {
  bureau: {
    day: { transitionStyle: 'calm', cameraOrbitSpeed: 0.24, cueDurationMs: 1800 },
    night: { transitionStyle: 'calm', cameraOrbitSpeed: 0.16, cueDurationMs: 2000 },
    focus: { transitionStyle: 'calm', cameraOrbitSpeed: 0.34, cueDurationMs: 2000 },
    active: { transitionStyle: 'surge', cameraOrbitSpeed: 0.42, cueDurationMs: 2200 },
    base: { transitionStyle: 'calm', cameraOrbitSpeed: 0.26, cueDurationMs: 1800 },
    brief: { transitionStyle: 'calm', cameraOrbitSpeed: 0.34, cueDurationMs: 2200 },
    reward: { transitionStyle: 'surge', cameraOrbitSpeed: 0.62, cueDurationMs: 2800 },
    alert: { transitionStyle: 'sharp', cameraOrbitSpeed: null, cueDurationMs: 2600 },
  },
  void: {
    day: { transitionStyle: 'calm', cameraOrbitSpeed: 0.44, cueDurationMs: 1800 },
    night: { transitionStyle: 'calm', cameraOrbitSpeed: 0.32, cueDurationMs: 2100 },
    focus: { transitionStyle: 'surge', cameraOrbitSpeed: 0.62, cueDurationMs: 2200 },
    active: { transitionStyle: 'surge', cameraOrbitSpeed: 0.78, cueDurationMs: 2400 },
    base: { transitionStyle: 'calm', cameraOrbitSpeed: 0.48, cueDurationMs: 1900 },
    brief: { transitionStyle: 'calm', cameraOrbitSpeed: 0.68, cueDurationMs: 2400 },
    reward: { transitionStyle: 'surge', cameraOrbitSpeed: 1.05, cueDurationMs: 3000 },
    alert: { transitionStyle: 'sharp', cameraOrbitSpeed: null, cueDurationMs: 2800 },
  },
  ops: {
    day: { transitionStyle: 'sharp', cameraOrbitSpeed: 0.3, cueDurationMs: 1700 },
    night: { transitionStyle: 'sharp', cameraOrbitSpeed: 0.22, cueDurationMs: 1900 },
    focus: { transitionStyle: 'sharp', cameraOrbitSpeed: 0.1, cueDurationMs: 2200 },
    active: { transitionStyle: 'sharp', cameraOrbitSpeed: 0.16, cueDurationMs: 2400 },
    base: { transitionStyle: 'sharp', cameraOrbitSpeed: 0.24, cueDurationMs: 1700 },
    brief: { transitionStyle: 'sharp', cameraOrbitSpeed: null, cueDurationMs: 2200 },
    reward: { transitionStyle: 'surge', cameraOrbitSpeed: 1.1, cueDurationMs: 3200 },
    alert: { transitionStyle: 'sharp', cameraOrbitSpeed: null, cueDurationMs: 3000 },
  },
} satisfies Record<
  CreativeSkinPack['sceneProfile'],
  Record<CreativeSceneMotionPresetKey, Pick<CreativeSceneMotionPreset, 'transitionStyle' | 'cameraOrbitSpeed' | 'cueDurationMs'>>
>;

const buildMotionProfileTemplateValue = (
  sceneProfile: CreativeSkinPack['sceneProfile'],
  motionProfile: CreativeSkinPack['motionProfile'],
  presetKey: CreativeSceneMotionPresetKey
): CreativeMotionProfileTemplate => {
  const base = DEFAULT_CREATIVE_MOTION_PRESETS[sceneProfile][presetKey];
  if (motionProfile === 'sharp') {
    return {
      transitionStyle: presetKey === 'reward' ? 'surge' : 'sharp',
      cameraOrbitSpeed:
        presetKey === 'focus' || presetKey === 'active' || presetKey === 'brief' || presetKey === 'alert'
          ? null
          : base.cameraOrbitSpeed === null
          ? null
          : Math.max(0, Number((base.cameraOrbitSpeed * 0.72).toFixed(2))),
      cueDurationMs: Math.max(1200, base.cueDurationMs - 250),
    };
  }
  if (motionProfile === 'cinematic') {
    return {
      transitionStyle:
        presetKey === 'alert' ? 'sharp' : presetKey === 'day' || presetKey === 'night' ? 'calm' : 'surge',
      cameraOrbitSpeed:
        base.cameraOrbitSpeed === null
          ? presetKey === 'brief' ? 0.78 : null
          : Number(Math.min(1.4, base.cameraOrbitSpeed * 1.28 + 0.04).toFixed(2)),
      cueDurationMs: Math.min(4200, base.cueDurationMs + 320),
    };
  }
  return {
    transitionStyle:
      presetKey === 'reward' ? 'surge' : presetKey === 'alert' ? 'sharp' : 'calm',
    cameraOrbitSpeed:
      base.cameraOrbitSpeed === null ? null : Number(Math.max(0, base.cameraOrbitSpeed * 0.9).toFixed(2)),
    cueDurationMs: Math.min(3600, base.cueDurationMs + 80),
  };
};

const buildCreativeSceneMotionPresetsForMotionProfile = (
  sceneProfile: CreativeSkinPack['sceneProfile'],
  motionProfile: CreativeSkinPack['motionProfile']
) =>
  DEFAULT_MOTION_PRESET_KEYS.map((presetKey) => ({
    sceneProfile,
    presetKey,
    ...buildMotionProfileTemplateValue(sceneProfile, motionProfile, presetKey),
  })) satisfies CreativeSceneMotionPreset[];

const resolveDefaultCreativeSceneStateLightRig = (
  sceneProfile: CreativeSkinPack['sceneProfile'],
  stateKey: CreativeSceneStateKey
) => {
  switch (stateKey) {
    case 'profile.night':
      return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].night;
    case 'profile.focus':
      return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].focus;
    case 'profile.active':
      return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].active;
    case 'profile.day':
    default:
      return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].day;
  }
};

const resolveDefaultCreativeSceneResponseLightRig = (
  sceneProfile: CreativeSkinPack['sceneProfile'],
  responseType: CreativeSceneResponseType
) => {
  switch (responseType) {
    case 'brief':
      return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].brief;
    case 'reward':
      return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].reward;
    case 'alert':
      return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].alert;
    case 'focus':
    default:
      return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].focus;
  }
};

const resolveDefaultCreativeSceneCueLightRig = (
  sceneProfile: CreativeSkinPack['sceneProfile'],
  eventName: string
) => {
  if (eventName === 'dusk.brief.loaded') return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].brief;
  if (
    eventName === 'quest.completed' ||
    eventName === 'quest.reward.burst' ||
    eventName === 'profile.avatar.loadout.ready'
  ) {
    return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].reward;
  }
  if (eventName === 'notification.urgent' || eventName === 'station.skin.fallback') {
    return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].alert;
  }
  if (
    eventName === 'play.session.start' ||
    eventName === 'profile.deck.open' ||
    eventName === 'profile.avatar.loadout.partial'
  ) {
    return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].focus;
  }
  if (eventName === 'profile.avatar.loadout.empty') {
    return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].night;
  }
  if (eventName === 'ambient.night.enter') return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].night;
  return DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile].base;
};

const normalizeCreativeSceneLightRig = (
  lightRig: Partial<CreativeSceneLightRig> | null | undefined,
  fallback: CreativeSceneLightRig
): CreativeSceneLightRig => ({
  keyIntensity:
    typeof lightRig?.keyIntensity === 'number' ? lightRig.keyIntensity : fallback.keyIntensity,
  fillIntensity:
    typeof lightRig?.fillIntensity === 'number' ? lightRig.fillIntensity : fallback.fillIntensity,
  keyColor: typeof lightRig?.keyColor === 'string' && lightRig.keyColor ? lightRig.keyColor : fallback.keyColor,
  fillColor:
    typeof lightRig?.fillColor === 'string' && lightRig.fillColor ? lightRig.fillColor : fallback.fillColor,
});

const normalizeCreativeSkinPacks = (skinPacks: CreativeSkinPack[]) =>
  skinPacks.map((pack, index) => {
    const fallback =
      DEFAULT_CREATIVE_SKIN_PACKS.find((entry) => entry.id === pack.id) ||
      DEFAULT_CREATIVE_SKIN_PACKS[index] ||
      DEFAULT_CREATIVE_SKIN_PACKS[0];
    return {
      ...pack,
      motionProfile: pack.motionProfile ?? fallback.motionProfile,
      screenProfile: pack.screenProfile ?? fallback.screenProfile,
      sceneProfile: pack.sceneProfile ?? fallback.sceneProfile,
      avatarProfile: pack.avatarProfile ?? fallback.avatarProfile,
    };
  });

const buildPublishedEventMap = (
  eventMap: CreativeSoundEventMapEntry[],
  skinPacks: CreativeSkinPack[]
) => {
  const publishedSoundPackIds = new Set(
    skinPacks
      .filter((pack) => pack.status === 'published' && pack.soundPackId)
      .map((pack) => pack.soundPackId as string)
  );
  return eventMap.filter((entry) => publishedSoundPackIds.has(entry.soundPackId));
};

const buildPublishedSceneCues = (
  sceneCues: CreativeSceneCueEntry[],
  scenePacks: CreativeScenePack[]
) => {
  const publishedSceneProfiles = new Set(
    scenePacks.filter((pack) => pack.status === 'published').map((pack) => pack.sceneProfile)
  );
  return sceneCues.filter((entry) => publishedSceneProfiles.has(entry.sceneProfile));
};

const normalizeSceneCueEntries = (entries: CreativeSceneCueEntry[]) =>
  entries.map((entry) => ({
    ...entry,
    transitionStyle: entry.transitionStyle ?? 'calm',
    cameraOrbitSpeed: entry.cameraOrbitSpeed ?? 0.5,
    lightRig: normalizeCreativeSceneLightRig(
      entry.lightRig,
      resolveDefaultCreativeSceneCueLightRig(entry.sceneProfile, entry.eventName)
    ),
  }));

const normalizeSceneStateEntries = (entries: CreativeSceneStateEntry[]) =>
  entries.map((entry) => ({
    ...entry,
    cameraOrbitSpeed: entry.cameraOrbitSpeed ?? 0.4,
    lightRig: normalizeCreativeSceneLightRig(
      entry.lightRig,
      resolveDefaultCreativeSceneStateLightRig(entry.sceneProfile, entry.stateKey)
    ),
  }));

const normalizeSceneResponsePresetEntries = (entries: CreativeSceneResponsePreset[]) =>
  entries.map((entry) => ({
    ...entry,
    transitionStyle: entry.transitionStyle ?? 'calm',
    cameraOrbitSpeed: entry.cameraOrbitSpeed ?? 0.5,
    lightRig: normalizeCreativeSceneLightRig(
      entry.lightRig,
      resolveDefaultCreativeSceneResponseLightRig(entry.sceneProfile, entry.responseType)
    ),
  }));

const normalizeSceneAvatarPresetEntries = (entries: CreativeSceneAvatarPreset[]) =>
  entries.map((entry) => {
    const fallback = buildDefaultCreativeSceneAvatarPreset(entry.sceneProfile, entry.avatarProfile);
    const fallbackById = new Map(fallback.loadoutSlots.map((slot) => [slot.id, slot]));
    const providedSlots = Array.isArray(entry.loadoutSlots) && entry.loadoutSlots.length
      ? entry.loadoutSlots
      : fallback.loadoutSlots;
    const normalizedSlots = providedSlots.map((slot, index) => {
      const indexedFallback = fallback.loadoutSlots[index] || fallback.loadoutSlots[0];
      const slotValue = slot && typeof slot === 'object' ? slot : {};
      const namedFallback =
        typeof (slotValue as CreativeAvatarLoadoutSlot).id === 'string'
          ? fallbackById.get((slotValue as CreativeAvatarLoadoutSlot).id)
          : null;
      const base = namedFallback || indexedFallback;
      return {
        id:
          typeof (slotValue as CreativeAvatarLoadoutSlot).id === 'string' &&
          (slotValue as CreativeAvatarLoadoutSlot).id.trim()
            ? (slotValue as CreativeAvatarLoadoutSlot).id
            : base.id,
        label:
          typeof (slotValue as CreativeAvatarLoadoutSlot).label === 'string' &&
          (slotValue as CreativeAvatarLoadoutSlot).label.trim()
            ? (slotValue as CreativeAvatarLoadoutSlot).label
            : base.label,
        icon:
          typeof (slotValue as CreativeAvatarLoadoutSlot).icon === 'string' &&
          (slotValue as CreativeAvatarLoadoutSlot).icon.trim()
            ? (slotValue as CreativeAvatarLoadoutSlot).icon
            : base.icon,
        equipped:
          typeof (slotValue as CreativeAvatarLoadoutSlot).equipped === 'boolean'
            ? (slotValue as CreativeAvatarLoadoutSlot).equipped
            : base.equipped,
        binding:
          typeof (slotValue as CreativeAvatarLoadoutSlot).binding === 'string' &&
          ['theme', 'sound', 'widget', 'module', 'any'].includes(
            (slotValue as CreativeAvatarLoadoutSlot).binding
          )
            ? (slotValue as CreativeAvatarLoadoutSlot).binding
            : base.binding,
      } satisfies CreativeAvatarLoadoutSlot;
    });
    const normalizedPresencePresets = (Array.isArray(entry.presencePresets) && entry.presencePresets.length
      ? entry.presencePresets
      : fallback.presencePresets
    ).map((preset, index) => {
      const fallbackPreset = fallback.presencePresets[index] || fallback.presencePresets[0];
      const presetValue = preset && typeof preset === 'object' ? preset : {};
      const normalizedPreset = {
        state:
          typeof (presetValue as CreativeAvatarPresencePreset).state === 'string' &&
          ['empty', 'partial', 'ready'].includes(
            (presetValue as CreativeAvatarPresencePreset).state
          )
            ? (presetValue as CreativeAvatarPresencePreset).state
            : fallbackPreset.state,
        label:
          typeof (presetValue as CreativeAvatarPresencePreset).label === 'string' &&
          (presetValue as CreativeAvatarPresencePreset).label.trim()
            ? (presetValue as CreativeAvatarPresencePreset).label
            : fallbackPreset.label,
        deckPrompt:
          typeof (presetValue as CreativeAvatarPresencePreset).deckPrompt === 'string' &&
          (presetValue as CreativeAvatarPresencePreset).deckPrompt.trim()
            ? (presetValue as CreativeAvatarPresencePreset).deckPrompt
            : fallbackPreset.deckPrompt,
        statusLabel:
          typeof (presetValue as CreativeAvatarPresencePreset).statusLabel === 'string' &&
          (presetValue as CreativeAvatarPresencePreset).statusLabel.trim()
            ? (presetValue as CreativeAvatarPresencePreset).statusLabel
            : fallbackPreset.statusLabel,
        roleFallbackText:
          typeof (presetValue as CreativeAvatarPresencePreset).roleFallbackText === 'string' &&
          (presetValue as CreativeAvatarPresencePreset).roleFallbackText.trim()
            ? (presetValue as CreativeAvatarPresencePreset).roleFallbackText
            : fallbackPreset.roleFallbackText,
        previewRoleText:
          typeof (presetValue as CreativeAvatarPresencePreset).previewRoleText === 'string' &&
          (presetValue as CreativeAvatarPresencePreset).previewRoleText.trim()
            ? (presetValue as CreativeAvatarPresencePreset).previewRoleText
            : fallbackPreset.previewRoleText,
        sceneStateOverride:
          typeof (presetValue as CreativeAvatarPresencePreset).sceneStateOverride === 'string' &&
          ['profile.day', 'profile.night', 'profile.focus', 'profile.active'].includes(
            (presetValue as CreativeAvatarPresencePreset).sceneStateOverride as string
          )
            ? (presetValue as CreativeAvatarPresencePreset).sceneStateOverride
            : fallbackPreset.sceneStateOverride,
        screenModeOverride:
          typeof (presetValue as CreativeAvatarPresencePreset).screenModeOverride === 'string' &&
          ['base', 'focus', 'brief', 'urgent', 'success'].includes(
            (presetValue as CreativeAvatarPresencePreset).screenModeOverride as string
          )
            ? (presetValue as CreativeAvatarPresencePreset).screenModeOverride
            : fallbackPreset.screenModeOverride,
      } satisfies CreativeAvatarPresencePreset;
      if (
        entry.sceneProfile === 'bureau' &&
        normalizedPreset.state === 'partial' &&
        normalizedPreset.sceneStateOverride === 'profile.focus' &&
        normalizedPreset.screenModeOverride === 'brief' &&
        normalizedPreset.label === fallbackPreset.label &&
        normalizedPreset.deckPrompt === fallbackPreset.deckPrompt &&
        normalizedPreset.statusLabel === fallbackPreset.statusLabel &&
        normalizedPreset.roleFallbackText === fallbackPreset.roleFallbackText &&
        normalizedPreset.previewRoleText === fallbackPreset.previewRoleText
      ) {
        return {
          ...normalizedPreset,
          screenModeOverride: fallbackPreset.screenModeOverride,
        };
      }
      return normalizedPreset;
    });

    return {
      ...entry,
      identityBadge:
        typeof entry.identityBadge === 'string' && entry.identityBadge.trim()
          ? entry.identityBadge
          : fallback.identityBadge,
      loadoutSlots: normalizedSlots,
      presencePresets: normalizedPresencePresets,
    };
  });

const normalizeSceneLightPresetEntries = (entries: CreativeSceneLightPreset[]) =>
  entries.map((entry) => ({
    ...entry,
    lightRig: normalizeCreativeSceneLightRig(
      entry.lightRig,
      DEFAULT_CREATIVE_LIGHT_RIGS[entry.sceneProfile][entry.presetKey]
    ),
  }));

const normalizeSceneMotionPresetEntries = (entries: CreativeSceneMotionPreset[]) =>
  entries.map((entry) => ({
    ...entry,
    transitionStyle:
      entry.transitionStyle ?? DEFAULT_CREATIVE_MOTION_PRESETS[entry.sceneProfile][entry.presetKey].transitionStyle,
    cameraOrbitSpeed:
      entry.cameraOrbitSpeed ?? DEFAULT_CREATIVE_MOTION_PRESETS[entry.sceneProfile][entry.presetKey].cameraOrbitSpeed,
    cueDurationMs:
      entry.cueDurationMs ?? DEFAULT_CREATIVE_MOTION_PRESETS[entry.sceneProfile][entry.presetKey].cueDurationMs,
  }));

const buildPublishedSceneStates = (
  sceneStates: CreativeSceneStateEntry[],
  scenePacks: CreativeScenePack[]
) => {
  const publishedSceneProfiles = new Set(
    scenePacks.filter((pack) => pack.status === 'published').map((pack) => pack.sceneProfile)
  );
  return sceneStates.filter((entry) => publishedSceneProfiles.has(entry.sceneProfile));
};

const buildPublishedSceneStateBindings = (
  bindings: CreativeSceneStateBinding[],
  scenePacks: CreativeScenePack[]
) => {
  const publishedSceneProfiles = new Set(
    scenePacks.filter((pack) => pack.status === 'published').map((pack) => pack.sceneProfile)
  );
  return bindings.filter((entry) => publishedSceneProfiles.has(entry.sceneProfile));
};

const buildPublishedSceneScreenPresets = (
  presets: CreativeSceneScreenPreset[],
  scenePacks: CreativeScenePack[]
) => {
  const publishedSceneProfiles = new Set(
    scenePacks.filter((pack) => pack.status === 'published').map((pack) => pack.sceneProfile)
  );
  return presets.filter((entry) => publishedSceneProfiles.has(entry.sceneProfile));
};

const buildPublishedSceneAvatarPresets = (
  presets: CreativeSceneAvatarPreset[],
  scenePacks: CreativeScenePack[]
) => {
  const publishedSceneProfiles = new Set(
    scenePacks.filter((pack) => pack.status === 'published').map((pack) => pack.sceneProfile)
  );
  return presets.filter((entry) => publishedSceneProfiles.has(entry.sceneProfile));
};

const buildPublishedSceneLightPresets = (
  presets: CreativeSceneLightPreset[],
  scenePacks: CreativeScenePack[]
) => {
  const publishedSceneProfiles = new Set(
    scenePacks.filter((pack) => pack.status === 'published').map((pack) => pack.sceneProfile)
  );
  return presets.filter((entry) => publishedSceneProfiles.has(entry.sceneProfile));
};

const buildPublishedSceneMotionPresets = (
  presets: CreativeSceneMotionPreset[],
  scenePacks: CreativeScenePack[]
) => {
  const publishedSceneProfiles = new Set(
    scenePacks.filter((pack) => pack.status === 'published').map((pack) => pack.sceneProfile)
  );
  return presets.filter((entry) => publishedSceneProfiles.has(entry.sceneProfile));
};

const migrateBureauProfileSceneStates = (
  entries: CreativeSceneStateEntry[]
): CreativeSceneStateEntry[] =>
  entries.map((entry) => {
    if (
      entry.sceneProfile === 'bureau' &&
      entry.stateKey === 'profile.day' &&
      entry.cameraShot === 'hero' &&
      entry.cameraOrbitSpeed === 0.36 &&
      entry.ambientAtmosphere === 0.16
    ) {
      return {
        ...entry,
        cameraOrbitSpeed: 0.22,
        ambientAtmosphere: 0.18,
      };
    }
    if (
      entry.sceneProfile === 'bureau' &&
      entry.stateKey === 'profile.night' &&
      entry.cameraShot === 'wide' &&
      entry.cameraOrbitSpeed === 0.28 &&
      entry.ambientAtmosphere === 0.1
    ) {
      return {
        ...entry,
        cameraShot: 'hero',
        cameraOrbitSpeed: 0.16,
        ambientAtmosphere: 0.14,
      };
    }
    if (
      entry.sceneProfile === 'bureau' &&
      entry.stateKey === 'profile.focus' &&
      ((entry.cameraShot === 'mid' &&
        entry.cameraOrbitSpeed === 0.46 &&
        entry.ambientAtmosphere === 0.2) ||
        (entry.cameraShot === 'hero' &&
          entry.cameraOrbitSpeed === 0.34 &&
          entry.ambientAtmosphere === 0.24))
    ) {
      return {
        ...entry,
        cameraShot: 'hero',
        cameraOrbitSpeed: 0.24,
        ambientAtmosphere: 0.26,
      };
    }
    if (
      entry.sceneProfile === 'bureau' &&
      entry.stateKey === 'profile.active' &&
      ((entry.cameraShot === 'mid' &&
        entry.cameraOrbitSpeed === 0.54 &&
        entry.ambientAtmosphere === 0.22) ||
        (entry.cameraShot === 'hero' &&
          entry.cameraOrbitSpeed === 0.42 &&
          entry.ambientAtmosphere === 0.28))
    ) {
      return {
        ...entry,
        cameraShot: 'hero',
        cameraOrbitSpeed: 0.32,
        ambientAtmosphere: 0.3,
      };
    }
    return entry;
  });

const migrateBureauProfileLightPresets = (
  entries: CreativeSceneLightPreset[]
): CreativeSceneLightPreset[] =>
  entries.map((entry) => {
    if (entry.sceneProfile !== 'bureau') return entry;
    const lightRig = entry.lightRig;
    const matches =
      (entry.presetKey === 'day' &&
        lightRig.keyIntensity === 1.12 &&
        lightRig.fillIntensity === 0.44 &&
        lightRig.keyColor === '#f9c86f' &&
        lightRig.fillColor === '#f4e3bc') ||
      (entry.presetKey === 'night' &&
        lightRig.keyIntensity === 0.76 &&
        lightRig.fillIntensity === 0.18 &&
        lightRig.keyColor === '#d6b27a' &&
        lightRig.fillColor === '#72809a') ||
      (entry.presetKey === 'focus' &&
        lightRig.keyIntensity === 1.24 &&
        lightRig.fillIntensity === 0.48 &&
        lightRig.keyColor === '#ffbf57' &&
        lightRig.fillColor === '#f8ddb0') ||
      (entry.presetKey === 'active' &&
        lightRig.keyIntensity === 1.36 &&
        lightRig.fillIntensity === 0.54 &&
        lightRig.keyColor === '#ffb446' &&
        lightRig.fillColor === '#f8dd92') ||
      (entry.presetKey === 'base' &&
        lightRig.keyIntensity === 1.14 &&
        lightRig.fillIntensity === 0.42 &&
        lightRig.keyColor === '#f5c26d' &&
        lightRig.fillColor === '#f0dfbc') ||
      (entry.presetKey === 'brief' &&
        lightRig.keyIntensity === 1.18 &&
        lightRig.fillIntensity === 0.52 &&
        lightRig.keyColor === '#c7e4ff' &&
        lightRig.fillColor === '#d6e9ff') ||
      (entry.presetKey === 'reward' &&
        lightRig.keyIntensity === 1.44 &&
        lightRig.fillIntensity === 0.64 &&
        lightRig.keyColor === '#ffd24d' &&
        lightRig.fillColor === '#ffe6a3') ||
      (entry.presetKey === 'alert' &&
        lightRig.keyIntensity === 1.52 &&
        lightRig.fillIntensity === 0.52 &&
        lightRig.keyColor === '#ff8540' &&
        lightRig.fillColor === '#ffd0a3');
    if (!matches) return entry;
    return {
      ...entry,
      lightRig: DEFAULT_CREATIVE_LIGHT_RIGS.bureau[entry.presetKey],
    };
  });

const migrateBureauProfileMotionPresets = (
  entries: CreativeSceneMotionPreset[]
): CreativeSceneMotionPreset[] =>
  entries.map((entry) => {
    if (entry.sceneProfile !== 'bureau') return entry;
    const preset = DEFAULT_CREATIVE_MOTION_PRESETS.bureau[entry.presetKey];
    const matches =
      (entry.presetKey === 'day' &&
        entry.transitionStyle === 'calm' &&
        entry.cameraOrbitSpeed === 0.36 &&
        entry.cueDurationMs === 1800) ||
      (entry.presetKey === 'night' &&
        entry.transitionStyle === 'calm' &&
        entry.cameraOrbitSpeed === 0.28 &&
        entry.cueDurationMs === 2000) ||
      (entry.presetKey === 'focus' &&
        entry.transitionStyle === 'calm' &&
        entry.cameraOrbitSpeed === 0.46 &&
        entry.cueDurationMs === 2000) ||
      (entry.presetKey === 'active' &&
        entry.transitionStyle === 'surge' &&
        entry.cameraOrbitSpeed === 0.54 &&
        entry.cueDurationMs === 2200) ||
      (entry.presetKey === 'base' &&
        entry.transitionStyle === 'calm' &&
        entry.cameraOrbitSpeed === 0.38 &&
        entry.cueDurationMs === 1800) ||
      (entry.presetKey === 'brief' &&
        entry.transitionStyle === 'calm' &&
        entry.cameraOrbitSpeed === 0.5 &&
        entry.cueDurationMs === 2200) ||
      (entry.presetKey === 'reward' &&
        entry.transitionStyle === 'surge' &&
        entry.cameraOrbitSpeed === 0.72 &&
        entry.cueDurationMs === 2800);
    if (!matches) return entry;
    return {
      ...entry,
      ...preset,
    };
  });

const migrateBureauProfileResponsePresets = (
  entries: CreativeSceneResponsePreset[]
): CreativeSceneResponsePreset[] =>
  entries.map((entry) => {
    if (
      entry.sceneProfile === 'bureau' &&
      entry.responseType === 'focus' &&
      ((entry.cameraShot === 'mid' &&
        entry.cameraOrbitSpeed === 0.42 &&
        entry.ambientAtmosphere === 0.22) ||
        (entry.cameraShot === 'hero' &&
          entry.cameraOrbitSpeed === 0.34 &&
          entry.ambientAtmosphere === 0.24))
    ) {
      return {
        ...entry,
        cameraShot: 'hero',
        cameraOrbitSpeed: 0.28,
        ambientAtmosphere: 0.26,
      };
    }
    if (
      entry.sceneProfile === 'bureau' &&
      entry.responseType === 'brief' &&
      ((entry.cameraShot === 'mid' &&
        entry.cameraOrbitSpeed === 0.5 &&
        entry.ambientAtmosphere === 0.22) ||
        (entry.cameraShot === 'hero' &&
          entry.cameraOrbitSpeed === 0.42 &&
          entry.ambientAtmosphere === 0.24))
    ) {
      return {
        ...entry,
        cameraShot: 'hero',
        cameraOrbitSpeed: 0.34,
        ambientAtmosphere: 0.26,
      };
    }
    return entry;
  });

export const createDefaultCreativeOpsState = (): CreativeOpsState => ({
  selectedSkinId: DEFAULT_CREATIVE_SKIN_PACKS[0].id,
  activeSkinId: DEFAULT_CREATIVE_SKIN_PACKS[0].id,
  skinPacks: DEFAULT_CREATIVE_SKIN_PACKS,
  scenePacks: DEFAULT_CREATIVE_SCENE_PACKS,
  soundAssets: DEFAULT_CREATIVE_SOUND_ASSETS,
  eventMap: DEFAULT_CREATIVE_EVENT_MAP,
  sceneCues: normalizeSceneCueEntries(DEFAULT_CREATIVE_SCENE_CUES),
  sceneStates: normalizeSceneStateEntries(DEFAULT_CREATIVE_SCENE_STATES),
  sceneStateBindings: DEFAULT_CREATIVE_SCENE_STATE_BINDINGS,
  sceneScreenPresets: DEFAULT_CREATIVE_SCENE_SCREEN_PRESETS,
  sceneAvatarPresets: normalizeSceneAvatarPresetEntries(DEFAULT_CREATIVE_SCENE_AVATAR_PRESETS),
  sceneResponsePresets: normalizeSceneResponsePresetEntries(DEFAULT_CREATIVE_SCENE_RESPONSE_PRESETS),
  sceneLightPresets: normalizeSceneLightPresetEntries(
    (Object.entries(DEFAULT_CREATIVE_LIGHT_RIGS) as Array<
      [CreativeSkinPack['sceneProfile'], Record<string, CreativeSceneLightRig>]
    >).flatMap(([sceneProfile, rigs]) =>
      DEFAULT_LIGHT_PRESET_KEYS.map((presetKey) => ({
        sceneProfile,
        presetKey,
        lightRig: rigs[presetKey],
      }))
    )
  ),
  sceneMotionPresets: normalizeSceneMotionPresetEntries(
    (Object.entries(DEFAULT_CREATIVE_MOTION_PRESETS) as Array<
      [CreativeSkinPack['sceneProfile'], Record<CreativeSceneMotionPresetKey, Pick<CreativeSceneMotionPreset, 'transitionStyle' | 'cameraOrbitSpeed' | 'cueDurationMs'>>]
    >).flatMap(([sceneProfile, presets]) =>
      DEFAULT_MOTION_PRESET_KEYS.map((presetKey) => ({
        sceneProfile,
        presetKey,
        ...presets[presetKey],
      }))
    )
  ),
  publishedEventMap: buildPublishedEventMap(DEFAULT_CREATIVE_EVENT_MAP, DEFAULT_CREATIVE_SKIN_PACKS),
  publishedSceneCues: buildPublishedSceneCues(normalizeSceneCueEntries(DEFAULT_CREATIVE_SCENE_CUES), DEFAULT_CREATIVE_SCENE_PACKS),
  publishedSceneStates: buildPublishedSceneStates(
    normalizeSceneStateEntries(DEFAULT_CREATIVE_SCENE_STATES),
    DEFAULT_CREATIVE_SCENE_PACKS
  ),
  publishedSceneStateBindings: buildPublishedSceneStateBindings(
    DEFAULT_CREATIVE_SCENE_STATE_BINDINGS,
    DEFAULT_CREATIVE_SCENE_PACKS
  ),
  publishedSceneScreenPresets: buildPublishedSceneScreenPresets(
    DEFAULT_CREATIVE_SCENE_SCREEN_PRESETS,
    DEFAULT_CREATIVE_SCENE_PACKS
  ),
  publishedSceneAvatarPresets: buildPublishedSceneAvatarPresets(
    normalizeSceneAvatarPresetEntries(DEFAULT_CREATIVE_SCENE_AVATAR_PRESETS),
    DEFAULT_CREATIVE_SCENE_PACKS
  ),
  publishedSceneResponsePresets: normalizeSceneResponsePresetEntries(DEFAULT_CREATIVE_SCENE_RESPONSE_PRESETS).filter((entry) =>
    DEFAULT_CREATIVE_SCENE_PACKS.some((pack) => pack.sceneProfile === entry.sceneProfile && pack.status === 'published')
  ),
  publishedSceneLightPresets: buildPublishedSceneLightPresets(
    normalizeSceneLightPresetEntries(
      (Object.entries(DEFAULT_CREATIVE_LIGHT_RIGS) as Array<
        [CreativeSkinPack['sceneProfile'], Record<string, CreativeSceneLightRig>]
      >).flatMap(([sceneProfile, rigs]) =>
        DEFAULT_LIGHT_PRESET_KEYS.map((presetKey) => ({
          sceneProfile,
          presetKey,
          lightRig: rigs[presetKey],
        }))
      )
    ),
    DEFAULT_CREATIVE_SCENE_PACKS
  ),
  publishedSceneMotionPresets: buildPublishedSceneMotionPresets(
    normalizeSceneMotionPresetEntries(
      (Object.entries(DEFAULT_CREATIVE_MOTION_PRESETS) as Array<
        [CreativeSkinPack['sceneProfile'], Record<CreativeSceneMotionPresetKey, Pick<CreativeSceneMotionPreset, 'transitionStyle' | 'cameraOrbitSpeed' | 'cueDurationMs'>>]
      >).flatMap(([sceneProfile, presets]) =>
        DEFAULT_MOTION_PRESET_KEYS.map((presetKey) => ({
          sceneProfile,
          presetKey,
          ...presets[presetKey],
        }))
      )
    ),
    DEFAULT_CREATIVE_SCENE_PACKS
  ),
  publishLog: [],
  runtimePackHistory: [],
});

const normalizeCreativeOpsState = (input: Partial<CreativeOpsState> | null | undefined): CreativeOpsState => {
  const fallback = createDefaultCreativeOpsState();
  if (!input) return fallback;
  return {
    selectedSkinId:
      typeof input.selectedSkinId === 'string' && input.selectedSkinId
        ? input.selectedSkinId
        : fallback.selectedSkinId,
    activeSkinId:
      typeof input.activeSkinId === 'string' && input.activeSkinId
        ? input.activeSkinId
        : fallback.activeSkinId,
    skinPacks:
      Array.isArray(input.skinPacks) && input.skinPacks.length
        ? normalizeCreativeSkinPacks(input.skinPacks)
        : fallback.skinPacks,
    scenePacks: Array.isArray(input.scenePacks) && input.scenePacks.length ? input.scenePacks : fallback.scenePacks,
    soundAssets: Array.isArray(input.soundAssets) && input.soundAssets.length ? input.soundAssets : fallback.soundAssets,
    eventMap: Array.isArray(input.eventMap) ? input.eventMap : fallback.eventMap,
    sceneCues: Array.isArray(input.sceneCues) ? normalizeSceneCueEntries(input.sceneCues) : fallback.sceneCues,
    sceneStates:
      Array.isArray(input.sceneStates) && input.sceneStates.length
        ? migrateBureauProfileSceneStates(normalizeSceneStateEntries(input.sceneStates))
        : fallback.sceneStates,
    sceneStateBindings:
      Array.isArray(input.sceneStateBindings) && input.sceneStateBindings.length
        ? input.sceneStateBindings
        : fallback.sceneStateBindings,
    sceneScreenPresets:
      Array.isArray(input.sceneScreenPresets) && input.sceneScreenPresets.length
        ? input.sceneScreenPresets
        : fallback.sceneScreenPresets,
    sceneAvatarPresets:
      Array.isArray(input.sceneAvatarPresets) && input.sceneAvatarPresets.length
        ? normalizeSceneAvatarPresetEntries(input.sceneAvatarPresets)
        : fallback.sceneAvatarPresets,
    sceneResponsePresets:
      Array.isArray(input.sceneResponsePresets) && input.sceneResponsePresets.length
        ? migrateBureauProfileResponsePresets(normalizeSceneResponsePresetEntries(input.sceneResponsePresets))
        : fallback.sceneResponsePresets,
    sceneLightPresets:
      Array.isArray(input.sceneLightPresets) && input.sceneLightPresets.length
        ? migrateBureauProfileLightPresets(normalizeSceneLightPresetEntries(input.sceneLightPresets))
        : fallback.sceneLightPresets,
    sceneMotionPresets:
      Array.isArray(input.sceneMotionPresets) && input.sceneMotionPresets.length
        ? migrateBureauProfileMotionPresets(normalizeSceneMotionPresetEntries(input.sceneMotionPresets))
        : fallback.sceneMotionPresets,
    publishedEventMap:
      Array.isArray(input.publishedEventMap) && input.publishedEventMap.length
        ? input.publishedEventMap
        : buildPublishedEventMap(
            Array.isArray(input.eventMap) ? input.eventMap : fallback.eventMap,
            Array.isArray(input.skinPacks) && input.skinPacks.length ? input.skinPacks : fallback.skinPacks
          ),
    publishedSceneCues:
      Array.isArray(input.publishedSceneCues) && input.publishedSceneCues.length
        ? input.publishedSceneCues
        : buildPublishedSceneCues(
            Array.isArray(input.sceneCues) ? normalizeSceneCueEntries(input.sceneCues) : fallback.sceneCues,
            Array.isArray(input.scenePacks) && input.scenePacks.length ? input.scenePacks : fallback.scenePacks
          ),
    publishedSceneStates:
      Array.isArray(input.publishedSceneStates) && input.publishedSceneStates.length
        ? migrateBureauProfileSceneStates(normalizeSceneStateEntries(input.publishedSceneStates))
        : buildPublishedSceneStates(
            Array.isArray(input.sceneStates) && input.sceneStates.length
              ? migrateBureauProfileSceneStates(normalizeSceneStateEntries(input.sceneStates))
              : fallback.sceneStates,
            Array.isArray(input.scenePacks) && input.scenePacks.length ? input.scenePacks : fallback.scenePacks
          ),
    publishedSceneStateBindings:
      Array.isArray(input.publishedSceneStateBindings) && input.publishedSceneStateBindings.length
        ? input.publishedSceneStateBindings
        : buildPublishedSceneStateBindings(
            Array.isArray(input.sceneStateBindings) && input.sceneStateBindings.length
              ? input.sceneStateBindings
              : fallback.sceneStateBindings,
            Array.isArray(input.scenePacks) && input.scenePacks.length ? input.scenePacks : fallback.scenePacks
          ),
    publishedSceneScreenPresets:
      Array.isArray(input.publishedSceneScreenPresets) && input.publishedSceneScreenPresets.length
        ? input.publishedSceneScreenPresets
        : buildPublishedSceneScreenPresets(
            Array.isArray(input.sceneScreenPresets) && input.sceneScreenPresets.length
              ? input.sceneScreenPresets
              : fallback.sceneScreenPresets,
            Array.isArray(input.scenePacks) && input.scenePacks.length ? input.scenePacks : fallback.scenePacks
          ),
    publishedSceneAvatarPresets:
      Array.isArray(input.publishedSceneAvatarPresets) && input.publishedSceneAvatarPresets.length
        ? normalizeSceneAvatarPresetEntries(input.publishedSceneAvatarPresets)
        : buildPublishedSceneAvatarPresets(
            Array.isArray(input.sceneAvatarPresets) && input.sceneAvatarPresets.length
              ? normalizeSceneAvatarPresetEntries(input.sceneAvatarPresets)
              : fallback.sceneAvatarPresets,
            Array.isArray(input.scenePacks) && input.scenePacks.length ? input.scenePacks : fallback.scenePacks
          ),
    publishedSceneResponsePresets:
      Array.isArray(input.publishedSceneResponsePresets) && input.publishedSceneResponsePresets.length
        ? migrateBureauProfileResponsePresets(input.publishedSceneResponsePresets)
        : (Array.isArray(input.sceneResponsePresets) && input.sceneResponsePresets.length
            ? migrateBureauProfileResponsePresets(normalizeSceneResponsePresetEntries(input.sceneResponsePresets))
            : fallback.sceneResponsePresets
          ).filter((entry) =>
            (Array.isArray(input.scenePacks) && input.scenePacks.length ? input.scenePacks : fallback.scenePacks).some(
              (pack) => pack.sceneProfile === entry.sceneProfile && pack.status === 'published'
            )
          ),
    publishedSceneLightPresets:
      Array.isArray(input.publishedSceneLightPresets) && input.publishedSceneLightPresets.length
        ? migrateBureauProfileLightPresets(normalizeSceneLightPresetEntries(input.publishedSceneLightPresets))
        : buildPublishedSceneLightPresets(
            Array.isArray(input.sceneLightPresets) && input.sceneLightPresets.length
              ? migrateBureauProfileLightPresets(normalizeSceneLightPresetEntries(input.sceneLightPresets))
              : fallback.sceneLightPresets,
            Array.isArray(input.scenePacks) && input.scenePacks.length ? input.scenePacks : fallback.scenePacks
          ),
    publishedSceneMotionPresets:
      Array.isArray(input.publishedSceneMotionPresets) && input.publishedSceneMotionPresets.length
        ? migrateBureauProfileMotionPresets(normalizeSceneMotionPresetEntries(input.publishedSceneMotionPresets))
        : buildPublishedSceneMotionPresets(
            Array.isArray(input.sceneMotionPresets) && input.sceneMotionPresets.length
              ? migrateBureauProfileMotionPresets(normalizeSceneMotionPresetEntries(input.sceneMotionPresets))
              : fallback.sceneMotionPresets,
            Array.isArray(input.scenePacks) && input.scenePacks.length ? input.scenePacks : fallback.scenePacks
          ),
    publishLog: Array.isArray(input.publishLog) ? input.publishLog : fallback.publishLog,
    runtimePackHistory:
      Array.isArray(input.runtimePackHistory) && input.runtimePackHistory.length
        ? input.runtimePackHistory
            .filter((entry): entry is CreativeRuntimePackImportEntry => {
              if (!entry || typeof entry !== 'object') return false;
              const candidate = entry as Partial<CreativeRuntimePackImportEntry>;
              return (
                typeof candidate.id === 'string' &&
                !!candidate.id &&
                (candidate.mode === 'draft' || candidate.mode === 'published') &&
                (candidate.actorScope === 'guest' || candidate.actorScope === 'account') &&
                typeof candidate.occurredAt === 'number' &&
                candidate.manifest?.format === 'xtation.scene-runtime-pack' &&
                candidate.manifest?.version === 1 &&
                isSceneStudioRuntimePackV1(candidate.pack) &&
                candidate.rollback != null
              );
            })
            .slice(0, 20)
        : fallback.runtimePackHistory,
  };
};

const readCreativeOpsState = (userId?: string | null): CreativeOpsState => {
  if (userId) {
    const scoped = readUserScopedJSON<CreativeOpsState | null>(CREATIVE_OPS_STORAGE_KEY, null, userId);
    if (scoped) return normalizeCreativeOpsState(scoped);
  }
  const storage = getStorage();
  if (!storage) return createDefaultCreativeOpsState();
  const raw = storage.getItem(LOCAL_CREATIVE_OPS_STORAGE_KEY);
  if (!raw) return createDefaultCreativeOpsState();
  try {
    return normalizeCreativeOpsState(JSON.parse(raw) as Partial<CreativeOpsState>);
  } catch {
    return createDefaultCreativeOpsState();
  }
};

export const readCreativeOpsStateSnapshot = (userId?: string | null) => readCreativeOpsState(userId);

const dispatchCreativeOpsSync = (userId?: string | null) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(CREATIVE_OPS_SYNC_EVENT, {
      detail: {
        scope: userId || 'local',
        occurredAt: Date.now(),
      },
    })
  );
};

const writeCreativeOpsState = (state: CreativeOpsState, userId?: string | null) => {
  if (userId) {
    writeUserScopedJSON(CREATIVE_OPS_STORAGE_KEY, state, userId);
    dispatchCreativeOpsSync(userId);
    return;
  }
  const storage = getStorage();
  if (!storage || typeof storage.setItem !== 'function') return;
  storage.setItem(LOCAL_CREATIVE_OPS_STORAGE_KEY, JSON.stringify(state));
  dispatchCreativeOpsSync();
};

const guessMixGroupForEvent = (eventName: string): CreativeMixGroup => {
  if (eventName.startsWith('dusk.')) return 'dusk';
  if (eventName.startsWith('profile.avatar.loadout.')) return 'notifications';
  if (eventName.startsWith('quest.') || eventName.startsWith('play.session')) return 'quest';
  if (eventName.startsWith('notification.')) return 'notifications';
  if (eventName.startsWith('ambient.')) return 'ambient';
  if (eventName.startsWith('profile.scene')) return 'scene_fx';
  if (eventName.startsWith('music.')) return 'music';
  return 'ui';
};

export const collectCreativeEventNames = (
  recentEvents: PresentationEventRecord[],
  eventMap: CreativeSoundEventMapEntry[]
) => {
  const names = new Set<string>(RECOMMENDED_PRESENTATION_EVENT_NAMES);
  recentEvents.forEach((event) => names.add(event.name));
  eventMap.forEach((entry) => names.add(entry.eventName));
  return Array.from(names).sort((left, right) => left.localeCompare(right));
};

export const ensureCreativeEventCoverage = (
  eventMap: CreativeSoundEventMapEntry[],
  recentEvents: PresentationEventRecord[],
  soundPackIds: string[]
) => {
  const existing = new Map(eventMap.map((entry) => [`${entry.soundPackId}::${entry.eventName}`, entry]));
  return soundPackIds.flatMap((soundPackId) =>
    collectCreativeEventNames(recentEvents, eventMap).map((eventName) => {
      const current = existing.get(`${soundPackId}::${eventName}`);
      if (current) return current;
      return {
        soundPackId,
        eventName,
        mixGroup: guessMixGroupForEvent(eventName),
        assetId: null,
        volume: soundPackId === 'soundpack-ops-amber' ? 82 : 72,
        cooldownMs: soundPackId === 'soundpack-void-command' ? 140 : 180,
      } satisfies CreativeSoundEventMapEntry;
    })
  );
};

export const ensureCreativeSceneCueCoverage = (
  sceneCues: CreativeSceneCueEntry[],
  recentEvents: PresentationEventRecord[],
  sceneProfiles: CreativeSkinPack['sceneProfile'][]
) => {
  const existing = new Map(sceneCues.map((entry) => [`${entry.sceneProfile}::${entry.eventName}`, entry]));
  return sceneProfiles.flatMap((sceneProfile) =>
    collectCreativeEventNames(recentEvents, []).map((eventName) => {
      const current = existing.get(`${sceneProfile}::${eventName}`);
      if (current) return current;
      return {
        sceneProfile,
        eventName,
        environmentMode: null,
        cameraShot: null,
        screenMode: null,
        transitionStyle: 'calm',
        cameraOrbitSpeed: 0.5,
        lightRig: resolveDefaultCreativeSceneCueLightRig(sceneProfile, eventName),
        beatPulse: false,
        ringPulse: false,
        groundMotion: false,
        ambientAtmosphere: sceneProfile === 'ops' ? 0.24 : 0.18,
        cueDurationMs: 1800,
      } satisfies CreativeSceneCueEntry;
    })
  );
};

export const ensureCreativeSceneStateCoverage = (
  sceneStates: CreativeSceneStateEntry[],
  sceneProfiles: CreativeSkinPack['sceneProfile'][]
) => {
  const existing = new Map(sceneStates.map((entry) => [`${entry.sceneProfile}::${entry.stateKey}`, entry]));
  return sceneProfiles.flatMap((sceneProfile) =>
    DEFAULT_SCENE_STATE_KEYS.map((stateKey) => {
      const current = existing.get(`${sceneProfile}::${stateKey}`);
      if (current) return current;
      const fallback =
        DEFAULT_CREATIVE_SCENE_STATES.find(
          (entry) => entry.sceneProfile === sceneProfile && entry.stateKey === stateKey
        ) ||
        DEFAULT_CREATIVE_SCENE_STATES.find(
          (entry) => entry.sceneProfile === 'bureau' && entry.stateKey === stateKey
        );
      return (
        fallback || {
          sceneProfile,
          stateKey,
          environmentMode: null,
          cameraShot: null,
          screenMode: stateKey === 'profile.day' || stateKey === 'profile.night' ? 'base' : 'focus',
          cameraOrbitSpeed: sceneProfile === 'ops' ? 0.2 : sceneProfile === 'void' ? 0.48 : 0.38,
          ambientAtmosphere: 0.18,
          lightRig: resolveDefaultCreativeSceneStateLightRig(sceneProfile, stateKey),
          beatPulse: false,
          ringPulse: false,
          groundMotion: false,
          modelFloat: true,
          hideLightSource: true,
        }
      );
    })
  );
};

export const ensureCreativeSceneStateBindingCoverage = (
  bindings: CreativeSceneStateBinding[],
  sceneProfiles: CreativeSkinPack['sceneProfile'][]
) => {
  const existing = new Map(bindings.map((entry) => [`${entry.sceneProfile}::${entry.eventName}`, entry]));
  return sceneProfiles.flatMap((sceneProfile) =>
    DEFAULT_CREATIVE_SCENE_STATE_BINDINGS.filter((entry) => entry.sceneProfile === sceneProfile).map((binding) => {
      const current = existing.get(`${sceneProfile}::${binding.eventName}`);
      return current || binding;
    })
  );
};

export const ensureCreativeSceneScreenPresetCoverage = (
  presets: CreativeSceneScreenPreset[],
  sceneProfiles: CreativeSkinPack['sceneProfile'][]
) => {
  const existing = new Map(presets.map((entry) => [`${entry.sceneProfile}::${entry.mode}`, entry]));
  return sceneProfiles.flatMap((sceneProfile) =>
    DEFAULT_SCREEN_MODES.map((mode) => {
      const current = existing.get(`${sceneProfile}::${mode}`);
      if (current) return current;
      const fallback =
        DEFAULT_CREATIVE_SCENE_SCREEN_PRESETS.find(
          (entry) => entry.sceneProfile === sceneProfile && entry.mode === mode
        ) ||
        DEFAULT_CREATIVE_SCENE_SCREEN_PRESETS.find(
          (entry) => entry.sceneProfile === 'bureau' && entry.mode === mode
        );
      return (
        fallback || {
          sceneProfile,
          mode,
          missionLabel: 'MISSION',
          roleLabel: 'STATUS',
          traceLabel: 'TRACE',
          fallbackMissionText: 'Profile screen preset not configured.',
          fallbackRoleText: 'Preset offline',
        }
      );
    })
  );
};

export const ensureCreativeSceneResponsePresetCoverage = (
  presets: CreativeSceneResponsePreset[],
  sceneProfiles: CreativeSkinPack['sceneProfile'][]
) => {
  const existing = new Map(presets.map((entry) => [`${entry.sceneProfile}::${entry.responseType}`, entry]));
  return sceneProfiles.flatMap((sceneProfile) =>
    DEFAULT_RESPONSE_TYPES.map((responseType) => {
      const current = existing.get(`${sceneProfile}::${responseType}`);
      if (current) return current;
      const fallback =
        DEFAULT_CREATIVE_SCENE_RESPONSE_PRESETS.find(
          (entry) => entry.sceneProfile === sceneProfile && entry.responseType === responseType
        ) ||
        DEFAULT_CREATIVE_SCENE_RESPONSE_PRESETS.find(
          (entry) => entry.sceneProfile === 'bureau' && entry.responseType === responseType
        );
      return (
        fallback || {
          sceneProfile,
          responseType,
          environmentMode: null,
          cameraShot: null,
          screenMode: responseType === 'brief' ? 'brief' : responseType === 'reward' ? 'success' : responseType === 'alert' ? 'urgent' : 'focus',
          targetStateKey: responseType === 'reward' || responseType === 'brief' ? 'profile.focus' : 'profile.active',
          holdMs: 15000,
          transitionStyle: responseType === 'alert' ? 'sharp' : responseType === 'reward' ? 'surge' : 'calm',
          cameraOrbitSpeed: responseType === 'alert' ? null : 0.5,
          lightRig: resolveDefaultCreativeSceneResponseLightRig(sceneProfile, responseType),
          beatPulse: true,
          ringPulse: true,
          groundMotion: responseType !== 'focus',
          ambientAtmosphere: 0.24,
          cueDurationMs: 2200,
        }
      );
    })
  );
};

export const ensureCreativeSceneLightPresetCoverage = (
  presets: CreativeSceneLightPreset[],
  sceneProfiles: CreativeSkinPack['sceneProfile'][]
) => {
  const existing = new Map(presets.map((entry) => [`${entry.sceneProfile}::${entry.presetKey}`, entry]));
  return sceneProfiles.flatMap((sceneProfile) =>
    DEFAULT_LIGHT_PRESET_KEYS.map((presetKey) => {
      const current = existing.get(`${sceneProfile}::${presetKey}`);
      if (current) return current;
      return {
        sceneProfile,
        presetKey,
        lightRig: DEFAULT_CREATIVE_LIGHT_RIGS[sceneProfile][presetKey],
      } satisfies CreativeSceneLightPreset;
    })
  );
};

export const ensureCreativeSceneMotionPresetCoverage = (
  presets: CreativeSceneMotionPreset[],
  sceneProfiles: CreativeSkinPack['sceneProfile'][]
) => {
  const existing = new Map(presets.map((entry) => [`${entry.sceneProfile}::${entry.presetKey}`, entry]));
  return sceneProfiles.flatMap((sceneProfile) =>
    DEFAULT_MOTION_PRESET_KEYS.map((presetKey) => {
      const current = existing.get(`${sceneProfile}::${presetKey}`);
      if (current) return current;
      return {
        sceneProfile,
        presetKey,
        ...DEFAULT_CREATIVE_MOTION_PRESETS[sceneProfile][presetKey],
      } satisfies CreativeSceneMotionPreset;
    })
  );
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Failed to read audio file.'));
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read audio file.'));
    reader.readAsDataURL(file);
  });

export const previewCreativeSoundAsset = (asset: CreativeSoundAsset | null | undefined, volumeScale = 1) => {
  if (!asset) return;
  if (asset.source === 'upload' && asset.audioDataUrl) {
    const audio = new Audio(asset.audioDataUrl);
    audio.volume = Math.min(1, Math.max(0, 0.55 * volumeScale));
    void audio.play().catch(() => {});
    return;
  }

  switch (asset.id) {
    case 'builtin-panel-open':
      playPanelOpenSound();
      return;
    case 'builtin-quest-complete':
      playSuccessSound();
      return;
    case 'builtin-notify-soft':
      playHoverSound();
      return;
    case 'builtin-dusk-relay':
      playErrorSound();
      return;
    case 'builtin-ui-select':
    default:
      playClickSound();
  }
};

const resolveActiveSkin = (state: CreativeOpsState) =>
  state.skinPacks.find((pack) => pack.id === state.activeSkinId) || state.skinPacks[0] || null;

const isPublishedSoundPack = (state: CreativeOpsState, soundPackId: string | null | undefined) =>
  Boolean(
    soundPackId &&
      state.skinPacks.some((pack) => pack.soundPackId === soundPackId && pack.status === 'published')
  );

const isPublishedSceneProfile = (
  state: CreativeOpsState,
  sceneProfile: CreativeSkinPack['sceneProfile'] | null | undefined
) =>
  Boolean(
    sceneProfile &&
      state.scenePacks.some((pack) => pack.sceneProfile === sceneProfile && pack.status === 'published')
  );

export const getCreativeSkinIdFromThemeId = (themeId?: string | null) => {
  if (!themeId || typeof themeId !== 'string') return null;
  if (!themeId.startsWith('creative:')) return null;
  const skinId = themeId.slice('creative:'.length).trim();
  return skinId.length ? skinId : null;
};

export const resolvePublishedCreativeSkin = (
  state: CreativeOpsState,
  requestedSkinId?: string | null,
  requestedSoundPackId?: string | null
) => {
  const publishedSkins = state.skinPacks.filter((pack) => pack.status === 'published');
  if (publishedSkins.length === 0) return null;

  const requestedById = requestedSkinId
    ? state.skinPacks.find((pack) => pack.id === requestedSkinId) || null
    : null;
  if (requestedById?.status === 'published') return requestedById;

  const requestedBySound = requestedSoundPackId
    ? state.skinPacks.find((pack) => pack.soundPackId === requestedSoundPackId) || null
    : null;
  if (requestedBySound?.status === 'published') return requestedBySound;

  const activeSkin = resolveActiveSkin(state);
  if (activeSkin?.status === 'published') return activeSkin;

  return (
    publishedSkins.find((pack) => pack.id === 'skin-bureau-amber') ||
    publishedSkins.find((pack) => pack.theme === 'bureau' && pack.accent === 'amber') ||
    publishedSkins[0]
  );
};

export const listPublishedCreativeSoundSkins = (state: CreativeOpsState) =>
  state.skinPacks.filter((pack) => pack.status === 'published' && !!pack.soundPackId);

export const findPublishedCreativeSkinByTheme = (
  state: CreativeOpsState,
  theme: CreativeSkinPack['theme'] | null | undefined
) => {
  if (!theme) return null;
  return state.skinPacks.find((pack) => pack.status === 'published' && pack.theme === theme && !!pack.soundPackId) || null;
};

export const getCreativeSoundPackLabel = (state: CreativeOpsState, soundPackId?: string | null) => {
  if (!soundPackId) return 'System audio';
  const pack = state.skinPacks.find((entry) => entry.status === 'published' && entry.soundPackId === soundPackId) || null;
  return pack ? `${pack.name} Audio` : soundPackId;
};

export const persistCreativeActiveSkinId = (skinId: string, userId?: string | null) => {
  const current = readCreativeOpsState(userId);
  if (current.activeSkinId === skinId) return current;
  const next = {
    ...current,
    activeSkinId: skinId,
  };
  writeCreativeOpsState(next, userId);
  return next;
};

export const collectCreativeSoundDifferences = (
  draftEntries: CreativeSoundEventMapEntry[],
  publishedEntries: CreativeSoundEventMapEntry[]
): CreativeDifferenceEntry[] => {
  const publishedByEvent = new Map(publishedEntries.map((entry) => [entry.eventName, entry]));
  return draftEntries.reduce<CreativeDifferenceEntry[]>((acc, entry) => {
    const published = publishedByEvent.get(entry.eventName);
    const changes: string[] = [];
    if (!published) {
      changes.push('new mapping');
    } else {
      if (published.assetId !== entry.assetId) changes.push('asset');
      if (published.mixGroup !== entry.mixGroup) changes.push('mix group');
      if (published.volume !== entry.volume) changes.push('volume');
      if (published.cooldownMs !== entry.cooldownMs) changes.push('cooldown');
    }
    if (changes.length) {
      acc.push({
        eventName: entry.eventName,
        changes,
      });
    }
    return acc;
  }, []);
};

export const collectCreativeSceneDifferences = (
  draftEntries: CreativeSceneCueEntry[],
  publishedEntries: CreativeSceneCueEntry[]
): CreativeDifferenceEntry[] => {
  const publishedByEvent = new Map(publishedEntries.map((entry) => [entry.eventName, entry]));
  return draftEntries.reduce<CreativeDifferenceEntry[]>((acc, entry) => {
    const published = publishedByEvent.get(entry.eventName);
    const changes: string[] = [];
    if (!published) {
      changes.push('new cue');
    } else {
      if (published.environmentMode !== entry.environmentMode) changes.push('environment');
      if (published.cameraShot !== entry.cameraShot) changes.push('camera');
      if (published.screenMode !== entry.screenMode) changes.push('screen mode');
      if (published.transitionStyle !== entry.transitionStyle) changes.push('transition');
      if (published.cameraOrbitSpeed !== entry.cameraOrbitSpeed) changes.push('orbit');
      if (published.beatPulse !== entry.beatPulse) changes.push('beat pulse');
      if (published.ringPulse !== entry.ringPulse) changes.push('ring pulse');
      if (published.groundMotion !== entry.groundMotion) changes.push('ground motion');
      if (published.ambientAtmosphere !== entry.ambientAtmosphere) changes.push('atmosphere');
      if (published.lightRig?.keyIntensity !== entry.lightRig?.keyIntensity) changes.push('key light');
      if (published.lightRig?.fillIntensity !== entry.lightRig?.fillIntensity) changes.push('fill light');
      if (published.lightRig?.keyColor !== entry.lightRig?.keyColor) changes.push('key color');
      if (published.lightRig?.fillColor !== entry.lightRig?.fillColor) changes.push('fill color');
      if (published.cueDurationMs !== entry.cueDurationMs) changes.push('duration');
    }
    if (changes.length) {
      acc.push({
        eventName: entry.eventName,
        changes,
      });
    }
    return acc;
  }, []);
};

export const collectCreativeSceneStateDifferences = (
  draftEntries: CreativeSceneStateEntry[],
  publishedEntries: CreativeSceneStateEntry[]
): CreativeDifferenceEntry[] => {
  const publishedByKey = new Map(publishedEntries.map((entry) => [entry.stateKey, entry]));
  return draftEntries.reduce<CreativeDifferenceEntry[]>((acc, entry) => {
    const published = publishedByKey.get(entry.stateKey);
    const changes: string[] = [];
    if (!published) {
      changes.push('new state');
    } else {
      if (published.environmentMode !== entry.environmentMode) changes.push('environment');
      if (published.cameraShot !== entry.cameraShot) changes.push('camera');
      if (published.screenMode !== entry.screenMode) changes.push('screen mode');
      if (published.cameraOrbitSpeed !== entry.cameraOrbitSpeed) changes.push('orbit');
      if (published.ambientAtmosphere !== entry.ambientAtmosphere) changes.push('atmosphere');
      if (published.lightRig?.keyIntensity !== entry.lightRig?.keyIntensity) changes.push('key light');
      if (published.lightRig?.fillIntensity !== entry.lightRig?.fillIntensity) changes.push('fill light');
      if (published.lightRig?.keyColor !== entry.lightRig?.keyColor) changes.push('key color');
      if (published.lightRig?.fillColor !== entry.lightRig?.fillColor) changes.push('fill color');
      if (published.beatPulse !== entry.beatPulse) changes.push('beat pulse');
      if (published.ringPulse !== entry.ringPulse) changes.push('ring pulse');
      if (published.groundMotion !== entry.groundMotion) changes.push('ground motion');
      if (published.modelFloat !== entry.modelFloat) changes.push('float');
      if (published.hideLightSource !== entry.hideLightSource) changes.push('light source');
    }
    if (changes.length) {
      acc.push({
        eventName: entry.stateKey,
        changes,
      });
    }
    return acc;
  }, []);
};

export const collectCreativeSceneStateBindingDifferences = (
  draftEntries: CreativeSceneStateBinding[],
  publishedEntries: CreativeSceneStateBinding[]
): CreativeDifferenceEntry[] => {
  const publishedByEvent = new Map(publishedEntries.map((entry) => [entry.eventName, entry]));
  return draftEntries.reduce<CreativeDifferenceEntry[]>((acc, entry) => {
    const published = publishedByEvent.get(entry.eventName);
    const changes: string[] = [];
    if (!published) {
      changes.push('new binding');
    } else {
      if (published.stateKey !== entry.stateKey) changes.push('state');
      if (published.holdMs !== entry.holdMs) changes.push('hold');
    }
    if (changes.length) {
      acc.push({
        eventName: entry.eventName,
        changes,
      });
    }
    return acc;
  }, []);
};

export const collectCreativeSceneScreenPresetDifferences = (
  draftEntries: CreativeSceneScreenPreset[],
  publishedEntries: CreativeSceneScreenPreset[]
): CreativeDifferenceEntry[] => {
  const publishedByMode = new Map(publishedEntries.map((entry) => [entry.mode, entry]));
  return draftEntries.reduce<CreativeDifferenceEntry[]>((acc, entry) => {
    const published = publishedByMode.get(entry.mode);
    const changes: string[] = [];
    if (!published) {
      changes.push('new preset');
    } else {
      if (published.missionLabel !== entry.missionLabel) changes.push('mission label');
      if (published.roleLabel !== entry.roleLabel) changes.push('role label');
      if (published.traceLabel !== entry.traceLabel) changes.push('trace label');
      if (published.fallbackMissionText !== entry.fallbackMissionText) changes.push('mission text');
      if (published.fallbackRoleText !== entry.fallbackRoleText) changes.push('role text');
    }
    if (changes.length) {
      acc.push({
        eventName: entry.mode,
        changes,
      });
    }
    return acc;
  }, []);
};

export const collectCreativeSceneAvatarPresetDifferences = (
  draftEntries: CreativeSceneAvatarPreset[],
  publishedEntries: CreativeSceneAvatarPreset[]
): CreativeDifferenceEntry[] => {
  const publishedByKey = new Map(
    publishedEntries.map((entry) => [entry.avatarProfile, entry])
  );
  return draftEntries.reduce<CreativeDifferenceEntry[]>((acc, entry) => {
    const published = publishedByKey.get(entry.avatarProfile);
    const changes: string[] = [];
    if (!published) {
      changes.push('new preset');
    } else {
      if (published.shellLabel !== entry.shellLabel) changes.push('shell label');
      if (published.identityBadge !== entry.identityBadge) changes.push('identity badge');
      if (published.deckPrompt !== entry.deckPrompt) changes.push('deck prompt');
      if (published.loadoutTitle !== entry.loadoutTitle) changes.push('loadout title');
      if (published.loadoutDescription !== entry.loadoutDescription) changes.push('loadout description');
      if (published.capabilityLabel !== entry.capabilityLabel) changes.push('capability label');
      if (published.relayLabel !== entry.relayLabel) changes.push('relay label');
      if (published.statusLabel !== entry.statusLabel) changes.push('status label');
      if (published.roleFallbackText !== entry.roleFallbackText) changes.push('role fallback');
      if (published.previewRoleText !== entry.previewRoleText) changes.push('preview role');
      const presenceChanges =
        published.presencePresets.length !== entry.presencePresets.length ||
        published.presencePresets.some((preset, index) => {
          const draftPreset = entry.presencePresets[index];
          return (
            !draftPreset ||
            preset.state !== draftPreset.state ||
            preset.label !== draftPreset.label ||
            preset.deckPrompt !== draftPreset.deckPrompt ||
            preset.statusLabel !== draftPreset.statusLabel ||
            preset.roleFallbackText !== draftPreset.roleFallbackText ||
            preset.previewRoleText !== draftPreset.previewRoleText ||
            preset.sceneStateOverride !== draftPreset.sceneStateOverride ||
            preset.screenModeOverride !== draftPreset.screenModeOverride
          );
        });
      if (presenceChanges) changes.push('presence presets');
      const slotChanges =
        published.loadoutSlots.length !== entry.loadoutSlots.length ||
        published.loadoutSlots.some((slot, index) => {
          const draftSlot = entry.loadoutSlots[index];
          return (
            !draftSlot ||
            slot.id !== draftSlot.id ||
            slot.label !== draftSlot.label ||
            slot.icon !== draftSlot.icon ||
            slot.equipped !== draftSlot.equipped ||
            slot.binding !== draftSlot.binding
          );
        });
      if (slotChanges) changes.push('loadout slots');
    }
    if (changes.length) {
      acc.push({
        eventName: entry.avatarProfile,
        changes,
      });
    }
    return acc;
  }, []);
};

export const collectCreativeSceneResponsePresetDifferences = (
  draftEntries: CreativeSceneResponsePreset[],
  publishedEntries: CreativeSceneResponsePreset[]
): CreativeDifferenceEntry[] => {
  const publishedByType = new Map(publishedEntries.map((entry) => [entry.responseType, entry]));
  return draftEntries.reduce<CreativeDifferenceEntry[]>((acc, entry) => {
    const published = publishedByType.get(entry.responseType);
    const changes: string[] = [];
    if (!published) {
      changes.push('new preset');
    } else {
      if (published.environmentMode !== entry.environmentMode) changes.push('environment');
      if (published.cameraShot !== entry.cameraShot) changes.push('camera');
      if (published.screenMode !== entry.screenMode) changes.push('screen mode');
      if (published.transitionStyle !== entry.transitionStyle) changes.push('transition');
      if (published.cameraOrbitSpeed !== entry.cameraOrbitSpeed) changes.push('orbit');
      if (published.targetStateKey !== entry.targetStateKey) changes.push('state');
      if (published.holdMs !== entry.holdMs) changes.push('hold');
      if (published.beatPulse !== entry.beatPulse) changes.push('beat pulse');
      if (published.ringPulse !== entry.ringPulse) changes.push('ring pulse');
      if (published.groundMotion !== entry.groundMotion) changes.push('ground motion');
      if (published.ambientAtmosphere !== entry.ambientAtmosphere) changes.push('atmosphere');
      if (published.lightRig?.keyIntensity !== entry.lightRig?.keyIntensity) changes.push('key light');
      if (published.lightRig?.fillIntensity !== entry.lightRig?.fillIntensity) changes.push('fill light');
      if (published.lightRig?.keyColor !== entry.lightRig?.keyColor) changes.push('key color');
      if (published.lightRig?.fillColor !== entry.lightRig?.fillColor) changes.push('fill color');
      if (published.cueDurationMs !== entry.cueDurationMs) changes.push('duration');
    }
    if (changes.length) {
      acc.push({
        eventName: entry.responseType,
        changes,
      });
    }
    return acc;
  }, []);
};

export const collectCreativeSceneLightPresetDifferences = (
  draftEntries: CreativeSceneLightPreset[],
  publishedEntries: CreativeSceneLightPreset[]
): CreativeDifferenceEntry[] => {
  const publishedByKey = new Map(publishedEntries.map((entry) => [entry.presetKey, entry]));
  return draftEntries.reduce<CreativeDifferenceEntry[]>((acc, entry) => {
    const published = publishedByKey.get(entry.presetKey);
    const changes: string[] = [];
    if (!published) {
      changes.push('new preset');
    } else {
      if (published.lightRig.keyIntensity !== entry.lightRig.keyIntensity) changes.push('key light');
      if (published.lightRig.fillIntensity !== entry.lightRig.fillIntensity) changes.push('fill light');
      if (published.lightRig.keyColor !== entry.lightRig.keyColor) changes.push('key color');
      if (published.lightRig.fillColor !== entry.lightRig.fillColor) changes.push('fill color');
    }
    if (changes.length) {
      acc.push({
        eventName: entry.presetKey,
        changes,
      });
    }
    return acc;
  }, []);
};

export const collectCreativeSceneMotionPresetDifferences = (
  draftEntries: CreativeSceneMotionPreset[],
  publishedEntries: CreativeSceneMotionPreset[]
): CreativeDifferenceEntry[] => {
  const publishedByKey = new Map(publishedEntries.map((entry) => [entry.presetKey, entry]));
  return draftEntries.reduce<CreativeDifferenceEntry[]>((acc, entry) => {
    const published = publishedByKey.get(entry.presetKey);
    const changes: string[] = [];
    if (!published) {
      changes.push('new preset');
    } else {
      if (published.transitionStyle !== entry.transitionStyle) changes.push('transition');
      if (published.cameraOrbitSpeed !== entry.cameraOrbitSpeed) changes.push('orbit');
      if (published.cueDurationMs !== entry.cueDurationMs) changes.push('duration');
    }
    if (changes.length) {
      acc.push({
        eventName: entry.presetKey,
        changes,
      });
    }
    return acc;
  }, []);
};

export const buildCreativeSkinPackageSummary = (
  state: CreativeOpsState,
  skinId: string
): CreativeSkinPackageSummary | null => {
  const skin = state.skinPacks.find((entry) => entry.id === skinId);
  if (!skin) return null;
  const scenePack = state.scenePacks.find((entry) => entry.sceneProfile === skin.sceneProfile) || null;
  const draftEventMap = state.eventMap.filter((entry) => entry.soundPackId === skin.soundPackId);
  const publishedEventMap = state.publishedEventMap.filter((entry) => entry.soundPackId === skin.soundPackId);
  const draftSceneCues = state.sceneCues.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const publishedSceneCues = state.publishedSceneCues.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const draftSceneStates = state.sceneStates.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const publishedSceneStates = state.publishedSceneStates.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const draftSceneBindings = state.sceneStateBindings.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const publishedSceneBindings = state.publishedSceneStateBindings.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const draftSceneScreens = state.sceneScreenPresets.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const publishedSceneScreens = state.publishedSceneScreenPresets.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const draftSceneAvatars = state.sceneAvatarPresets.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const publishedSceneAvatars = state.publishedSceneAvatarPresets.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const draftSceneResponses = state.sceneResponsePresets.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const publishedSceneResponses = state.publishedSceneResponsePresets.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const draftSceneLights = state.sceneLightPresets.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const publishedSceneLights = state.publishedSceneLightPresets.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const draftSceneMotions = state.sceneMotionPresets.filter((entry) => entry.sceneProfile === skin.sceneProfile);
  const publishedSceneMotions = state.publishedSceneMotionPresets.filter((entry) => entry.sceneProfile === skin.sceneProfile);

  const soundDiffCount = collectCreativeSoundDifferences(draftEventMap, publishedEventMap).length;
  const sceneDiffCount = collectCreativeSceneDifferences(draftSceneCues, publishedSceneCues).length;
  const stateDiffCount = collectCreativeSceneStateDifferences(draftSceneStates, publishedSceneStates).length;
  const bindingDiffCount = collectCreativeSceneStateBindingDifferences(draftSceneBindings, publishedSceneBindings).length;
  const screenDiffCount = collectCreativeSceneScreenPresetDifferences(draftSceneScreens, publishedSceneScreens).length;
  const avatarDiffCount = collectCreativeSceneAvatarPresetDifferences(draftSceneAvatars, publishedSceneAvatars).length;
  const responseDiffCount = collectCreativeSceneResponsePresetDifferences(draftSceneResponses, publishedSceneResponses).length;
  const lightDiffCount = collectCreativeSceneLightPresetDifferences(draftSceneLights, publishedSceneLights).length;
  const motionDiffCount = collectCreativeSceneMotionPresetDifferences(draftSceneMotions, publishedSceneMotions).length;

  const blockers: string[] = [];
  if (!skin.soundPackId) blockers.push('missing sound pack');
  if (!scenePack) blockers.push('missing scene pack');
  if (draftEventMap.length === 0) blockers.push('no draft sound mappings');
  if (draftSceneCues.length === 0) blockers.push('no draft scene cues');
  if (draftSceneStates.length === 0) blockers.push('no base scene states');
  if (draftSceneScreens.length === 0) blockers.push('no screen presets');
  if (draftSceneAvatars.length === 0) blockers.push('no avatar presets');
  if (draftSceneResponses.length === 0) blockers.push('no response presets');
  if (draftSceneLights.length === 0) blockers.push('no light presets');
  if (draftSceneMotions.length === 0) blockers.push('no motion presets');

  const totalDiffCount =
    soundDiffCount +
    sceneDiffCount +
    stateDiffCount +
    bindingDiffCount +
    screenDiffCount +
    avatarDiffCount +
    responseDiffCount +
    lightDiffCount +
    motionDiffCount;

  const liveSafe =
    skin.status === 'published' &&
    Boolean(scenePack && scenePack.status === 'published') &&
    publishedSceneAvatars.length > 0 &&
    (!skin.soundPackId || publishedEventMap.length > 0);

  return {
    skinId: skin.id,
    skinName: skin.name,
    sceneProfile: skin.sceneProfile,
    soundPackId: skin.soundPackId || null,
    skinStatus: skin.status,
    scenePackStatus: scenePack?.status || 'missing',
    totalDiffCount,
    soundDiffCount,
    sceneDiffCount,
    stateDiffCount,
    bindingDiffCount,
    screenDiffCount,
    avatarDiffCount,
    responseDiffCount,
    lightDiffCount,
    motionDiffCount,
    blockers,
    readyToPublish: blockers.length === 0 && totalDiffCount > 0,
    liveSafe,
  };
};

export const resolveCreativeSoundCue = (
  state: CreativeOpsState,
  eventName: string,
  soundPackId?: string | null,
  mode: 'draft' | 'published' = 'published'
) => {
  const activeSoundPackId = soundPackId || resolveActiveSkin(state)?.soundPackId || null;
  if (mode === 'published' && !isPublishedSoundPack(state, activeSoundPackId)) {
    return {
      entry: null,
      asset: null,
    };
  }
  const source = mode === 'draft' ? state.eventMap : state.publishedEventMap;
  const entry =
    source.find((item) => item.eventName === eventName && item.soundPackId === activeSoundPackId) || null;
  if (!entry || !entry.assetId) {
    return {
      entry,
      asset: null,
    };
  }
  const asset = state.soundAssets.find((item) => item.id === entry.assetId) || null;
  return {
    entry,
    asset,
  };
};

export const resolveCreativeSceneCue = (
  state: CreativeOpsState,
  eventName: string,
  sceneProfile?: CreativeSkinPack['sceneProfile'] | null,
  mode: 'draft' | 'published' = 'published'
) => {
  const activeSceneProfile = sceneProfile || resolveActiveSkin(state)?.sceneProfile || null;
  if (mode === 'published' && !isPublishedSceneProfile(state, activeSceneProfile)) {
    return null;
  }
  const source = mode === 'draft' ? state.sceneCues : state.publishedSceneCues;
  return (
    source.find((entry) => entry.eventName === eventName && entry.sceneProfile === activeSceneProfile) || null
  );
};

export const resolveCreativeSceneState = (
  state: CreativeOpsState,
  stateKey: CreativeSceneStateKey,
  sceneProfile?: CreativeSkinPack['sceneProfile'] | null,
  mode: 'draft' | 'published' = 'published'
) => {
  const activeSceneProfile = sceneProfile || resolveActiveSkin(state)?.sceneProfile || null;
  if (mode === 'published' && !isPublishedSceneProfile(state, activeSceneProfile)) {
    return null;
  }
  const source = mode === 'draft' ? state.sceneStates : state.publishedSceneStates;
  return (
    source.find((entry) => entry.stateKey === stateKey && entry.sceneProfile === activeSceneProfile) || null
  );
};

export const resolveCreativeSceneStateBinding = (
  state: CreativeOpsState,
  eventName: string,
  sceneProfile?: CreativeSkinPack['sceneProfile'] | null,
  mode: 'draft' | 'published' = 'published'
) => {
  const activeSceneProfile = sceneProfile || resolveActiveSkin(state)?.sceneProfile || null;
  if (mode === 'published' && !isPublishedSceneProfile(state, activeSceneProfile)) {
    return null;
  }
  const source = mode === 'draft' ? state.sceneStateBindings : state.publishedSceneStateBindings;
  return (
    source.find((entry) => entry.eventName === eventName && entry.sceneProfile === activeSceneProfile) || null
  );
};

export const resolveCreativeSceneScreenPreset = (
  state: CreativeOpsState,
  mode: CreativeSceneScreenMode,
  sceneProfile?: CreativeSkinPack['sceneProfile'] | null,
  sourceMode: 'draft' | 'published' = 'published'
) => {
  const activeSceneProfile = sceneProfile || resolveActiveSkin(state)?.sceneProfile || null;
  if (sourceMode === 'published' && !isPublishedSceneProfile(state, activeSceneProfile)) {
    return null;
  }
  const source =
    sourceMode === 'draft' ? state.sceneScreenPresets : state.publishedSceneScreenPresets;
  return source.find((entry) => entry.mode === mode && entry.sceneProfile === activeSceneProfile) || null;
};

export const resolveCreativeSceneAvatarPreset = (
  state: CreativeOpsState,
  avatarProfile?: CreativeAvatarProfile | null,
  sceneProfile?: CreativeSkinPack['sceneProfile'] | null,
  sourceMode: 'draft' | 'published' = 'published'
) => {
  const activeSkin = resolveActiveSkin(state);
  const activeSceneProfile = sceneProfile || activeSkin?.sceneProfile || null;
  const activeAvatarProfile = avatarProfile || activeSkin?.avatarProfile || null;
  if (sourceMode === 'published' && !isPublishedSceneProfile(state, activeSceneProfile)) {
    return null;
  }
  const source =
    sourceMode === 'draft' ? state.sceneAvatarPresets : state.publishedSceneAvatarPresets;
  return (
    source.find(
      (entry) =>
        entry.sceneProfile === activeSceneProfile && entry.avatarProfile === activeAvatarProfile
    ) || null
  );
};

export const resolveCreativeAvatarPresencePreset = (
  preset: CreativeSceneAvatarPreset | null | undefined,
  presenceState: CreativeAvatarLoadoutPresenceState
) =>
  preset?.presencePresets.find((entry) => entry.state === presenceState) || null;

export const applyCreativeSceneResponsePresetToEntries = (
  sceneCues: CreativeSceneCueEntry[],
  bindings: CreativeSceneStateBinding[],
  preset: CreativeSceneResponsePreset
) => {
  const targetEvents = RESPONSE_PRESET_EVENT_MAP[preset.responseType] || [];
  return {
    sceneCues: sceneCues.map((entry) =>
      entry.sceneProfile === preset.sceneProfile && targetEvents.includes(entry.eventName)
        ? {
            ...entry,
            environmentMode: preset.environmentMode,
            cameraShot: preset.cameraShot,
            screenMode: preset.screenMode,
            transitionStyle: preset.transitionStyle,
            cameraOrbitSpeed: preset.cameraOrbitSpeed,
            lightRig: preset.lightRig,
            beatPulse: preset.beatPulse,
            ringPulse: preset.ringPulse,
            groundMotion: preset.groundMotion,
            ambientAtmosphere: preset.ambientAtmosphere,
            cueDurationMs: preset.cueDurationMs,
          }
        : entry
    ),
    bindings: bindings.map((entry) =>
      entry.sceneProfile === preset.sceneProfile && targetEvents.includes(entry.eventName)
        ? {
            ...entry,
            stateKey: preset.targetStateKey,
            holdMs: preset.holdMs,
          }
        : entry
    ),
  };
};

export const applyCreativeSceneLightPresetToStates = (
  sceneStates: CreativeSceneStateEntry[],
  preset: CreativeSceneLightPreset
) => {
  const targetStateKey = LIGHT_PRESET_TO_STATE_KEY[preset.presetKey];
  if (!targetStateKey) return sceneStates;
  return sceneStates.map((entry) =>
    entry.sceneProfile === preset.sceneProfile && entry.stateKey === targetStateKey
      ? {
          ...entry,
          lightRig: preset.lightRig,
        }
      : entry
  );
};

export const applyCreativeSceneLightPresetToResponsePresets = (
  responsePresets: CreativeSceneResponsePreset[],
  preset: CreativeSceneLightPreset
) => {
  const targetResponseType = LIGHT_PRESET_TO_RESPONSE_TYPE[preset.presetKey];
  if (!targetResponseType) return responsePresets;
  return responsePresets.map((entry) =>
    entry.sceneProfile === preset.sceneProfile && entry.responseType === targetResponseType
      ? {
          ...entry,
          lightRig: preset.lightRig,
        }
      : entry
  );
};

export const applyCreativeSceneMotionPresetToStates = (
  sceneStates: CreativeSceneStateEntry[],
  preset: CreativeSceneMotionPreset
) => {
  const targetStateKey = MOTION_PRESET_TO_STATE_KEY[preset.presetKey];
  if (!targetStateKey) return sceneStates;
  return sceneStates.map((entry) =>
    entry.sceneProfile === preset.sceneProfile && entry.stateKey === targetStateKey
      ? {
          ...entry,
          cameraOrbitSpeed: preset.cameraOrbitSpeed,
        }
      : entry
  );
};

export const applyCreativeSceneMotionPresetToResponsePresets = (
  responsePresets: CreativeSceneResponsePreset[],
  preset: CreativeSceneMotionPreset
) => {
  const targetResponseType = MOTION_PRESET_TO_RESPONSE_TYPE[preset.presetKey];
  if (!targetResponseType) return responsePresets;
  return responsePresets.map((entry) =>
    entry.sceneProfile === preset.sceneProfile && entry.responseType === targetResponseType
      ? {
          ...entry,
          transitionStyle: preset.transitionStyle,
          cameraOrbitSpeed: preset.cameraOrbitSpeed,
          cueDurationMs: preset.cueDurationMs,
        }
      : entry
  );
};

export const applyCreativeMotionProfileTemplateToSceneMotionPresets = (
  presets: CreativeSceneMotionPreset[],
  sceneProfile: CreativeSkinPack['sceneProfile'],
  motionProfile: CreativeSkinPack['motionProfile']
) => {
  const template = buildCreativeSceneMotionPresetsForMotionProfile(sceneProfile, motionProfile);
  const templateByKey = new Map(template.map((entry) => [entry.presetKey, entry]));
  return presets.map((entry) => {
    if (entry.sceneProfile !== sceneProfile) return entry;
    const next = templateByKey.get(entry.presetKey);
    return next
      ? {
          ...entry,
          transitionStyle: next.transitionStyle,
          cameraOrbitSpeed: next.cameraOrbitSpeed,
          cueDurationMs: next.cueDurationMs,
        }
      : entry;
  });
};

const buildCreativeSceneScreenPresetsForScreenProfile = (
  targetSceneProfile: CreativeSkinPack['sceneProfile'],
  screenProfile: CreativeSkinPack['screenProfile']
) =>
  DEFAULT_SCREEN_MODES.map((mode) => {
    const template =
      DEFAULT_CREATIVE_SCENE_SCREEN_PRESETS.find(
        (entry) => entry.sceneProfile === screenProfile && entry.mode === mode
      ) ||
      DEFAULT_CREATIVE_SCENE_SCREEN_PRESETS.find(
        (entry) => entry.sceneProfile === 'bureau' && entry.mode === mode
      );
    return {
      sceneProfile: targetSceneProfile,
      mode,
      missionLabel: template?.missionLabel || 'MISSION',
      roleLabel: template?.roleLabel || 'STATUS',
      traceLabel: template?.traceLabel || 'TRACE',
      fallbackMissionText: template?.fallbackMissionText || 'Profile screen preset not configured.',
      fallbackRoleText: template?.fallbackRoleText || 'Preset offline',
    } satisfies CreativeSceneScreenPreset;
  });

export const applyCreativeScreenProfileTemplateToSceneScreenPresets = (
  screenPresets: CreativeSceneScreenPreset[],
  targetSceneProfile: CreativeSkinPack['sceneProfile'],
  screenProfile: CreativeSkinPack['screenProfile']
) => {
  const template = buildCreativeSceneScreenPresetsForScreenProfile(targetSceneProfile, screenProfile);
  const templateByMode = new Map(template.map((entry) => [entry.mode, entry]));
  return screenPresets.map((entry) => {
    if (entry.sceneProfile !== targetSceneProfile) return entry;
    const next = templateByMode.get(entry.mode);
    return next
      ? {
          ...entry,
          missionLabel: next.missionLabel,
          roleLabel: next.roleLabel,
          traceLabel: next.traceLabel,
          fallbackMissionText: next.fallbackMissionText,
          fallbackRoleText: next.fallbackRoleText,
        }
      : entry;
  });
};

const buildCreativeSceneAvatarPresetsForAvatarProfile = (
  targetSceneProfile: CreativeSkinPack['sceneProfile'],
  avatarProfile: CreativeAvatarProfile
) => {
  return buildDefaultCreativeSceneAvatarPreset(targetSceneProfile, avatarProfile);
};

export const applyCreativeAvatarProfileTemplateToSceneAvatarPresets = (
  avatarPresets: CreativeSceneAvatarPreset[],
  targetSceneProfile: CreativeSkinPack['sceneProfile'],
  avatarProfile: CreativeAvatarProfile
) => {
  const template = buildCreativeSceneAvatarPresetsForAvatarProfile(targetSceneProfile, avatarProfile);
  if (!template) return avatarPresets;
  return avatarPresets.map((entry) =>
    entry.sceneProfile === targetSceneProfile && entry.avatarProfile === avatarProfile
      ? {
          ...entry,
          shellLabel: template.shellLabel,
          identityBadge: template.identityBadge,
          deckPrompt: template.deckPrompt,
          loadoutTitle: template.loadoutTitle,
          loadoutDescription: template.loadoutDescription,
          capabilityLabel: template.capabilityLabel,
          relayLabel: template.relayLabel,
          statusLabel: template.statusLabel,
          roleFallbackText: template.roleFallbackText,
          previewRoleText: template.previewRoleText,
          presencePresets: template.presencePresets.map((preset) => ({ ...preset })),
          loadoutSlots: template.loadoutSlots.map((slot) => ({ ...slot })),
        }
      : entry
  );
};

export interface ApplyCreativeSceneStudioRuntimePackOptions {
  mode?: 'draft' | 'published';
  occurredAt?: number;
  actorScope?: 'guest' | 'account';
  fileName?: string | null;
}

export interface RollbackCreativeSceneStudioRuntimePackImportOptions {
  occurredAt?: number;
  actorScope?: 'guest' | 'account';
}

const restoreBySceneProfile = <T extends { sceneProfile: CreativeSkinPack['sceneProfile'] }>(
  source: T[],
  sceneProfile: CreativeSkinPack['sceneProfile'],
  snapshotEntries: T[]
): T[] => [...source.filter((entry) => entry.sceneProfile !== sceneProfile), ...snapshotEntries];

const restoreBySoundPackId = (
  source: CreativeSoundEventMapEntry[],
  soundPackId: string | null,
  snapshotEntries: CreativeSoundEventMapEntry[]
) => {
  if (!soundPackId) return source;
  return [...source.filter((entry) => entry.soundPackId !== soundPackId), ...snapshotEntries];
};

const resolveRuntimePackSoundPackIdFromState = (
  state: CreativeOpsState,
  pack: SceneStudioRuntimePackV1
) =>
  pack.skin?.soundPackId ??
  state.skinPacks.find((entry) => entry.sceneProfile === pack.manifest.sceneProfile)?.soundPackId ??
  null;

const buildRuntimePackRollbackSnapshot = (
  state: CreativeOpsState,
  pack: SceneStudioRuntimePackV1
): CreativeRuntimePackRollbackSnapshot => {
  const sceneProfile = pack.manifest.sceneProfile;
  const soundPackId = resolveRuntimePackSoundPackIdFromState(state, pack);
  return {
    sceneProfile,
    soundPackId,
    skinPacks: state.skinPacks.filter((entry) => entry.sceneProfile === sceneProfile),
    scenePack: state.scenePacks.find((entry) => entry.sceneProfile === sceneProfile) || null,
    eventMap: soundPackId ? state.eventMap.filter((entry) => entry.soundPackId === soundPackId) : [],
    sceneCues: state.sceneCues.filter((entry) => entry.sceneProfile === sceneProfile),
    sceneStates: state.sceneStates.filter((entry) => entry.sceneProfile === sceneProfile),
    sceneStateBindings: state.sceneStateBindings.filter((entry) => entry.sceneProfile === sceneProfile),
    sceneScreenPresets: state.sceneScreenPresets.filter((entry) => entry.sceneProfile === sceneProfile),
    sceneAvatarPresets: state.sceneAvatarPresets.filter((entry) => entry.sceneProfile === sceneProfile),
    sceneResponsePresets: state.sceneResponsePresets.filter((entry) => entry.sceneProfile === sceneProfile),
    sceneLightPresets: state.sceneLightPresets.filter((entry) => entry.sceneProfile === sceneProfile),
    sceneMotionPresets: state.sceneMotionPresets.filter((entry) => entry.sceneProfile === sceneProfile),
    publishedEventMap: soundPackId ? state.publishedEventMap.filter((entry) => entry.soundPackId === soundPackId) : [],
    publishedSceneCues: state.publishedSceneCues.filter((entry) => entry.sceneProfile === sceneProfile),
    publishedSceneStates: state.publishedSceneStates.filter((entry) => entry.sceneProfile === sceneProfile),
    publishedSceneStateBindings: state.publishedSceneStateBindings.filter(
      (entry) => entry.sceneProfile === sceneProfile
    ),
    publishedSceneScreenPresets: state.publishedSceneScreenPresets.filter(
      (entry) => entry.sceneProfile === sceneProfile
    ),
    publishedSceneAvatarPresets: state.publishedSceneAvatarPresets.filter(
      (entry) => entry.sceneProfile === sceneProfile
    ),
    publishedSceneResponsePresets: state.publishedSceneResponsePresets.filter(
      (entry) => entry.sceneProfile === sceneProfile
    ),
    publishedSceneLightPresets: state.publishedSceneLightPresets.filter(
      (entry) => entry.sceneProfile === sceneProfile
    ),
    publishedSceneMotionPresets: state.publishedSceneMotionPresets.filter(
      (entry) => entry.sceneProfile === sceneProfile
    ),
  };
};

const restoreCreativeStateFromRuntimePackRollbackSnapshot = (
  state: CreativeOpsState,
  snapshot: CreativeRuntimePackRollbackSnapshot
): CreativeOpsState => {
  const { sceneProfile, soundPackId } = snapshot;
  const nextScenePacks = snapshot.scenePack
    ? [
        ...state.scenePacks.filter((entry) => entry.sceneProfile !== sceneProfile),
        snapshot.scenePack,
      ]
    : state.scenePacks.filter((entry) => entry.sceneProfile !== sceneProfile);

  return {
    ...state,
    skinPacks: restoreBySceneProfile(state.skinPacks, sceneProfile, snapshot.skinPacks),
    scenePacks: nextScenePacks,
    eventMap: restoreBySoundPackId(state.eventMap, soundPackId, snapshot.eventMap),
    sceneCues: restoreBySceneProfile(state.sceneCues, sceneProfile, snapshot.sceneCues),
    sceneStates: restoreBySceneProfile(state.sceneStates, sceneProfile, snapshot.sceneStates),
    sceneStateBindings: restoreBySceneProfile(
      state.sceneStateBindings,
      sceneProfile,
      snapshot.sceneStateBindings
    ),
    sceneScreenPresets: restoreBySceneProfile(
      state.sceneScreenPresets,
      sceneProfile,
      snapshot.sceneScreenPresets
    ),
    sceneAvatarPresets: restoreBySceneProfile(
      state.sceneAvatarPresets,
      sceneProfile,
      snapshot.sceneAvatarPresets
    ),
    sceneResponsePresets: restoreBySceneProfile(
      state.sceneResponsePresets,
      sceneProfile,
      snapshot.sceneResponsePresets
    ),
    sceneLightPresets: restoreBySceneProfile(
      state.sceneLightPresets,
      sceneProfile,
      snapshot.sceneLightPresets
    ),
    sceneMotionPresets: restoreBySceneProfile(
      state.sceneMotionPresets,
      sceneProfile,
      snapshot.sceneMotionPresets
    ),
    publishedEventMap: restoreBySoundPackId(
      state.publishedEventMap,
      soundPackId,
      snapshot.publishedEventMap
    ),
    publishedSceneCues: restoreBySceneProfile(
      state.publishedSceneCues,
      sceneProfile,
      snapshot.publishedSceneCues
    ),
    publishedSceneStates: restoreBySceneProfile(
      state.publishedSceneStates,
      sceneProfile,
      snapshot.publishedSceneStates
    ),
    publishedSceneStateBindings: restoreBySceneProfile(
      state.publishedSceneStateBindings,
      sceneProfile,
      snapshot.publishedSceneStateBindings
    ),
    publishedSceneScreenPresets: restoreBySceneProfile(
      state.publishedSceneScreenPresets,
      sceneProfile,
      snapshot.publishedSceneScreenPresets
    ),
    publishedSceneAvatarPresets: restoreBySceneProfile(
      state.publishedSceneAvatarPresets,
      sceneProfile,
      snapshot.publishedSceneAvatarPresets
    ),
    publishedSceneResponsePresets: restoreBySceneProfile(
      state.publishedSceneResponsePresets,
      sceneProfile,
      snapshot.publishedSceneResponsePresets
    ),
    publishedSceneLightPresets: restoreBySceneProfile(
      state.publishedSceneLightPresets,
      sceneProfile,
      snapshot.publishedSceneLightPresets
    ),
    publishedSceneMotionPresets: restoreBySceneProfile(
      state.publishedSceneMotionPresets,
      sceneProfile,
      snapshot.publishedSceneMotionPresets
    ),
  };
};

export const applySceneStudioRuntimePackImportToCreativeOpsState = (
  currentState: CreativeOpsState,
  pack: SceneStudioRuntimePackV1,
  options: ApplyCreativeSceneStudioRuntimePackOptions = {}
): CreativeOpsState => {
  const mode = options.mode || 'draft';
  const occurredAt = options.occurredAt || Date.now();
  const actorScope = options.actorScope || 'guest';
  const rollbackSnapshot = buildRuntimePackRollbackSnapshot(currentState, pack);
  const importId = `runtime-pack-${Math.random().toString(36).slice(2, 10)}`;
  const next = applySceneStudioRuntimePack(currentState, pack, { mode, occurredAt });
  const sceneProfile = pack.manifest.sceneProfile;
  const scenePack = next.scenePacks.find((entry) => entry.sceneProfile === sceneProfile) || null;
  const revision =
    mode === 'published'
      ? scenePack?.publishedRevision ?? scenePack?.draftRevision ?? 1
      : scenePack?.draftRevision ?? scenePack?.publishedRevision ?? 1;
  const segmentCount = resolveSceneStudioRuntimePackSegments(pack).length;
  const label =
    scenePack?.name ||
    pack.scenePack?.name ||
    `${pack.manifest.name} (${sceneProfile.toUpperCase()} • ${segmentCount} segments)`;

  return {
    ...next,
    publishLog: [
      {
        id: `creative-log-${Math.random().toString(36).slice(2, 10)}`,
        targetType: 'scene',
        targetId: scenePack?.id || `scene-pack-${sceneProfile}`,
        label,
        action: mode === 'published' ? 'published' : 'revised',
        revision,
        occurredAt,
        actorScope,
      },
      ...next.publishLog,
    ].slice(0, 40),
    runtimePackHistory: [
      {
        id: importId,
        mode,
        actorScope,
        occurredAt,
        fileName: options.fileName || null,
        includedSegments: resolveSceneStudioRuntimePackSegments(pack),
        manifest: pack.manifest,
        pack,
        rollback: rollbackSnapshot,
        rolledBackAt: null,
      },
      ...next.runtimePackHistory,
    ].slice(0, 20),
  };
};

export const rollbackSceneStudioRuntimePackImportInCreativeOpsState = (
  currentState: CreativeOpsState,
  importId: string,
  options: RollbackCreativeSceneStudioRuntimePackImportOptions = {}
): CreativeOpsState => {
  const targetIndex = currentState.runtimePackHistory.findIndex((entry) => entry.id === importId);
  if (targetIndex === -1) return currentState;
  const target = currentState.runtimePackHistory[targetIndex];
  if (target.rolledBackAt) return currentState;

  const hasNewerActiveImportForSceneProfile = currentState.runtimePackHistory
    .slice(0, targetIndex)
    .some(
      (entry) =>
        !entry.rolledBackAt && entry.manifest.sceneProfile === target.manifest.sceneProfile
    );
  if (hasNewerActiveImportForSceneProfile) return currentState;

  const occurredAt = options.occurredAt || Date.now();
  const actorScope = options.actorScope || target.actorScope;
  const restored = restoreCreativeStateFromRuntimePackRollbackSnapshot(currentState, target.rollback);
  const restoredScenePack =
    restored.scenePacks.find((entry) => entry.sceneProfile === target.rollback.sceneProfile) ||
    target.rollback.scenePack;
  const revision = restoredScenePack
    ? Math.max(restoredScenePack.draftRevision, restoredScenePack.publishedRevision)
    : 1;

  return {
    ...restored,
    runtimePackHistory: currentState.runtimePackHistory.map((entry) =>
      entry.id === target.id
        ? {
            ...entry,
            rolledBackAt: occurredAt,
          }
        : entry
    ),
    publishLog: [
      {
        id: `creative-log-${Math.random().toString(36).slice(2, 10)}`,
        targetType: 'scene',
        targetId: restoredScenePack?.id || `scene-pack-${target.rollback.sceneProfile}`,
        label: `${target.manifest.name} rollback`,
        action: 'restored',
        revision,
        occurredAt,
        actorScope,
      },
      ...restored.publishLog,
    ].slice(0, 40),
  };
};

export const useCreativeOpsStudio = (recentEvents: PresentationEventRecord[]) => {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [state, setState] = useState<CreativeOpsState>(() => readCreativeOpsState(userId));

  useEffect(() => {
    setState(readCreativeOpsState(userId));
  }, [userId]);

  useEffect(() => {
    setState((current) => {
      const soundPackIds = Array.from(new Set(current.skinPacks.map((pack) => pack.soundPackId).filter(Boolean))) as string[];
      const covered = ensureCreativeEventCoverage(current.eventMap, recentEvents, soundPackIds);
      if (covered.length === current.eventMap.length) {
        const unchanged = covered.every((entry, index) => entry === current.eventMap[index]);
        if (unchanged) return current;
      }
      return {
        ...current,
        eventMap: covered,
      };
    });
  }, [recentEvents]);

  useEffect(() => {
    setState((current) => {
      const sceneProfiles = Array.from(new Set(current.skinPacks.map((pack) => pack.sceneProfile)));
      const covered = ensureCreativeSceneCueCoverage(current.sceneCues, recentEvents, sceneProfiles);
      if (covered.length === current.sceneCues.length) {
        const unchanged = covered.every((entry, index) => entry === current.sceneCues[index]);
        if (unchanged) return current;
      }
      return {
        ...current,
        sceneCues: covered,
      };
    });
  }, [recentEvents]);

  useEffect(() => {
    setState((current) => {
      const sceneProfiles = Array.from(new Set(current.skinPacks.map((pack) => pack.sceneProfile)));
      const covered = ensureCreativeSceneStateCoverage(current.sceneStates, sceneProfiles);
      if (covered.length === current.sceneStates.length) {
        const unchanged = covered.every((entry, index) => entry === current.sceneStates[index]);
        if (unchanged) return current;
      }
      return {
        ...current,
        sceneStates: covered,
      };
    });
  }, []);

  useEffect(() => {
    setState((current) => {
      const sceneProfiles = Array.from(new Set(current.skinPacks.map((pack) => pack.sceneProfile)));
      const covered = ensureCreativeSceneStateBindingCoverage(current.sceneStateBindings, sceneProfiles);
      if (covered.length === current.sceneStateBindings.length) {
        const unchanged = covered.every((entry, index) => entry === current.sceneStateBindings[index]);
        if (unchanged) return current;
      }
      return {
        ...current,
        sceneStateBindings: covered,
      };
    });
  }, []);

  useEffect(() => {
    setState((current) => {
      const sceneProfiles = Array.from(new Set(current.skinPacks.map((pack) => pack.sceneProfile)));
      const covered = ensureCreativeSceneScreenPresetCoverage(current.sceneScreenPresets, sceneProfiles);
      if (covered.length === current.sceneScreenPresets.length) {
        const unchanged = covered.every((entry, index) => entry === current.sceneScreenPresets[index]);
        if (unchanged) return current;
      }
      return {
        ...current,
        sceneScreenPresets: covered,
      };
    });
  }, []);

  useEffect(() => {
    setState((current) => {
      const sceneProfiles = Array.from(new Set(current.skinPacks.map((pack) => pack.sceneProfile)));
      const covered = ensureCreativeSceneResponsePresetCoverage(current.sceneResponsePresets, sceneProfiles);
      if (covered.length === current.sceneResponsePresets.length) {
        const unchanged = covered.every((entry, index) => entry === current.sceneResponsePresets[index]);
        if (unchanged) return current;
      }
      return {
        ...current,
        sceneResponsePresets: covered,
      };
    });
  }, []);

  useEffect(() => {
    setState((current) => {
      const sceneProfiles = Array.from(new Set(current.skinPacks.map((pack) => pack.sceneProfile)));
      const covered = ensureCreativeSceneLightPresetCoverage(current.sceneLightPresets, sceneProfiles);
      if (covered.length === current.sceneLightPresets.length) {
        const unchanged = covered.every((entry, index) => entry === current.sceneLightPresets[index]);
        if (unchanged) return current;
      }
      return {
        ...current,
        sceneLightPresets: covered,
      };
    });
  }, []);

  useEffect(() => {
    setState((current) => {
      const sceneProfiles = Array.from(new Set(current.skinPacks.map((pack) => pack.sceneProfile)));
      const covered = ensureCreativeSceneMotionPresetCoverage(current.sceneMotionPresets, sceneProfiles);
      if (covered.length === current.sceneMotionPresets.length) {
        const unchanged = covered.every((entry, index) => entry === current.sceneMotionPresets[index]);
        if (unchanged) return current;
      }
      return {
        ...current,
        sceneMotionPresets: covered,
      };
    });
  }, []);

  useEffect(() => {
    writeCreativeOpsState(state, userId);
  }, [state, userId]);

  const selectedSkin = useMemo(
    () => state.skinPacks.find((pack) => pack.id === state.selectedSkinId) || state.skinPacks[0] || null,
    [state.selectedSkinId, state.skinPacks]
  );
  const activeSkin = useMemo(
    () => state.skinPacks.find((pack) => pack.id === state.activeSkinId) || state.skinPacks[0] || null,
    [state.activeSkinId, state.skinPacks]
  );
  const soundAssetMap = useMemo(
    () => new Map(state.soundAssets.map((asset) => [asset.id, asset])),
    [state.soundAssets]
  );
  const selectedScenePack = useMemo(
    () => state.scenePacks.find((pack) => pack.sceneProfile === selectedSkin?.sceneProfile) || null,
    [selectedSkin?.sceneProfile, state.scenePacks]
  );
  const selectedEventMap = useMemo(
    () => state.eventMap.filter((entry) => entry.soundPackId === selectedSkin?.soundPackId),
    [selectedSkin?.soundPackId, state.eventMap]
  );
  const selectedPublishedEventMap = useMemo(
    () => state.publishedEventMap.filter((entry) => entry.soundPackId === selectedSkin?.soundPackId),
    [selectedSkin?.soundPackId, state.publishedEventMap]
  );
  const selectedSceneCues = useMemo(
    () => state.sceneCues.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.sceneCues]
  );
  const selectedPublishedSceneCues = useMemo(
    () => state.publishedSceneCues.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.publishedSceneCues]
  );
  const selectedSceneStates = useMemo(
    () => state.sceneStates.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.sceneStates]
  );
  const selectedPublishedSceneStates = useMemo(
    () => state.publishedSceneStates.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.publishedSceneStates]
  );
  const selectedSceneStateBindings = useMemo(
    () => state.sceneStateBindings.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.sceneStateBindings]
  );
  const selectedPublishedSceneStateBindings = useMemo(
    () => state.publishedSceneStateBindings.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.publishedSceneStateBindings]
  );
  const selectedSceneScreenPresets = useMemo(
    () => state.sceneScreenPresets.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.sceneScreenPresets]
  );
  const selectedPublishedSceneScreenPresets = useMemo(
    () =>
      state.publishedSceneScreenPresets.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.publishedSceneScreenPresets]
  );
  const selectedSceneAvatarPresets = useMemo(
    () => state.sceneAvatarPresets.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.sceneAvatarPresets]
  );
  const selectedPublishedSceneAvatarPresets = useMemo(
    () =>
      state.publishedSceneAvatarPresets.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.publishedSceneAvatarPresets]
  );
  const selectedSceneResponsePresets = useMemo(
    () => state.sceneResponsePresets.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.sceneResponsePresets]
  );
  const selectedPublishedSceneResponsePresets = useMemo(
    () =>
      state.publishedSceneResponsePresets.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.publishedSceneResponsePresets]
  );
  const selectedSceneLightPresets = useMemo(
    () => state.sceneLightPresets.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.sceneLightPresets]
  );
  const selectedPublishedSceneLightPresets = useMemo(
    () =>
      state.publishedSceneLightPresets.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.publishedSceneLightPresets]
  );
  const selectedSceneMotionPresets = useMemo(
    () => state.sceneMotionPresets.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.sceneMotionPresets]
  );
  const selectedPublishedSceneMotionPresets = useMemo(
    () =>
      state.publishedSceneMotionPresets.filter((entry) => entry.sceneProfile === selectedSkin?.sceneProfile),
    [selectedSkin?.sceneProfile, state.publishedSceneMotionPresets]
  );

  const setSelectedSkinId = useCallback((skinId: string) => {
    setState((current) => ({ ...current, selectedSkinId: skinId }));
  }, []);

  const setActiveSkinId = useCallback((skinId: string) => {
    setState((current) => ({ ...current, activeSkinId: skinId }));
  }, []);

  const setSkinStatus = useCallback((skinId: string, status: CreativeSkinStatus) => {
    setState((current) => {
      const nextSkinPacks = current.skinPacks.map((pack) => (pack.id === skinId ? { ...pack, status } : pack));
      const target = current.skinPacks.find((pack) => pack.id === skinId);
      return {
        ...current,
        skinPacks: nextSkinPacks,
        publishedEventMap:
          status === 'published' && target?.soundPackId
            ? [
                ...current.publishedEventMap.filter((entry) => entry.soundPackId !== target.soundPackId),
                ...current.eventMap.filter((entry) => entry.soundPackId === target.soundPackId),
              ]
            : current.publishedEventMap,
        publishLog: [
          {
            id: `creative-log-${Math.random().toString(36).slice(2, 10)}`,
            targetType: 'skin',
            targetId: skinId,
            label: target?.name || skinId,
            action: status === 'published' ? 'published' : 'set_draft',
            revision: 1,
            occurredAt: Date.now(),
            actorScope: userId ? 'account' : 'guest',
          },
          ...current.publishLog,
        ].slice(0, 40),
      };
    });
  }, [userId]);

  const updateSkinMotionProfile = useCallback(
    (skinId: string, motionProfile: CreativeSkinPack['motionProfile']) => {
      setState((current) => ({
        ...current,
        skinPacks: current.skinPacks.map((pack) =>
          pack.id === skinId
            ? {
                ...pack,
                motionProfile,
                status: 'draft',
              }
            : pack
        ),
      }));
    },
    []
  );

  const updateSkinScreenProfile = useCallback(
    (skinId: string, screenProfile: CreativeSkinPack['screenProfile']) => {
      setState((current) => ({
        ...current,
        skinPacks: current.skinPacks.map((pack) =>
          pack.id === skinId
            ? {
                ...pack,
                screenProfile,
                status: 'draft',
              }
            : pack
        ),
      }));
    },
    []
  );

  const updateSkinAvatarProfile = useCallback(
    (skinId: string, avatarProfile: CreativeAvatarProfile) => {
      setState((current) => ({
        ...current,
        skinPacks: current.skinPacks.map((pack) =>
          pack.id === skinId
            ? {
                ...pack,
                avatarProfile,
                status: 'draft',
              }
            : pack
        ),
      }));
    },
    []
  );

  const publishScenePack = useCallback((sceneProfile: CreativeSkinPack['sceneProfile']) => {
    setState((current) => {
      const target = current.scenePacks.find((pack) => pack.sceneProfile === sceneProfile);
      if (!target) return current;
      const nextRevision = Math.max(target.draftRevision, target.publishedRevision + 1);
      return {
        ...current,
        scenePacks: current.scenePacks.map((pack) =>
          pack.sceneProfile === sceneProfile
            ? {
                ...pack,
                status: 'published',
                draftRevision: nextRevision,
                publishedRevision: nextRevision,
                lastPublishedAt: Date.now(),
              }
            : pack
        ),
        publishedSceneCues: [
          ...current.publishedSceneCues.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.sceneCues.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        publishedSceneStates: [
          ...current.publishedSceneStates.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.sceneStates.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        publishedSceneStateBindings: [
          ...current.publishedSceneStateBindings.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.sceneStateBindings.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        publishedSceneScreenPresets: [
          ...current.publishedSceneScreenPresets.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.sceneScreenPresets.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        publishedSceneAvatarPresets: [
          ...current.publishedSceneAvatarPresets.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.sceneAvatarPresets.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        publishedSceneResponsePresets: [
          ...current.publishedSceneResponsePresets.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.sceneResponsePresets.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        publishedSceneLightPresets: [
          ...current.publishedSceneLightPresets.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.sceneLightPresets.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        publishedSceneMotionPresets: [
          ...current.publishedSceneMotionPresets.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.sceneMotionPresets.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        publishLog: [
          {
            id: `creative-log-${Math.random().toString(36).slice(2, 10)}`,
            targetType: 'scene',
            targetId: target.id,
            label: target.name,
            action: 'published',
            revision: nextRevision,
            occurredAt: Date.now(),
            actorScope: userId ? 'account' : 'guest',
          },
          ...current.publishLog,
        ].slice(0, 40),
      };
    });
  }, [userId]);

  const setScenePackDraft = useCallback((sceneProfile: CreativeSkinPack['sceneProfile']) => {
    setState((current) => {
      const target = current.scenePacks.find((pack) => pack.sceneProfile === sceneProfile);
      if (!target || target.status === 'draft') return current;
      return {
        ...current,
        scenePacks: current.scenePacks.map((pack) =>
          pack.sceneProfile === sceneProfile
            ? {
                ...pack,
                status: 'draft',
              }
            : pack
        ),
        publishedSceneCues: current.publishedSceneCues,
        publishedSceneStates: current.publishedSceneStates,
        publishedSceneStateBindings: current.publishedSceneStateBindings,
        publishedSceneScreenPresets: current.publishedSceneScreenPresets,
        publishedSceneResponsePresets: current.publishedSceneResponsePresets,
        publishedSceneLightPresets: current.publishedSceneLightPresets,
        publishedSceneMotionPresets: current.publishedSceneMotionPresets,
        publishLog: [
          {
            id: `creative-log-${Math.random().toString(36).slice(2, 10)}`,
            targetType: 'scene',
            targetId: target.id,
            label: target.name,
            action: 'set_draft',
            revision: target.draftRevision,
            occurredAt: Date.now(),
            actorScope: userId ? 'account' : 'guest',
          },
          ...current.publishLog,
        ].slice(0, 40),
      };
    });
  }, [userId]);

  const assignSoundToEvent = useCallback((soundPackId: string, eventName: string, assetId: string | null) => {
    setState((current) => ({
      ...current,
      eventMap: current.eventMap.map((entry) =>
        entry.eventName === eventName && entry.soundPackId === soundPackId ? { ...entry, assetId } : entry
      ),
      skinPacks: current.skinPacks.map((pack) =>
        pack.soundPackId === soundPackId ? { ...pack, status: 'draft' } : pack
      ),
    }));
  }, []);

  const updateEventMapEntry = useCallback(
    (
      soundPackId: string,
      eventName: string,
      patch: Partial<Pick<CreativeSoundEventMapEntry, 'mixGroup' | 'volume' | 'cooldownMs'>>
    ) => {
      setState((current) => ({
        ...current,
        eventMap: current.eventMap.map((entry) =>
          entry.eventName === eventName && entry.soundPackId === soundPackId
            ? {
                ...entry,
                ...patch,
              }
            : entry
        ),
        skinPacks: current.skinPacks.map((pack) =>
          pack.soundPackId === soundPackId ? { ...pack, status: 'draft' } : pack
        ),
      }));
    },
    []
  );

  const updateSceneCueEntry = useCallback(
    (
      sceneProfile: CreativeSkinPack['sceneProfile'],
      eventName: string,
      patch: Partial<
        Pick<
          CreativeSceneCueEntry,
          | 'environmentMode'
          | 'cameraShot'
          | 'screenMode'
          | 'transitionStyle'
          | 'cameraOrbitSpeed'
          | 'lightRig'
          | 'beatPulse'
          | 'ringPulse'
          | 'groundMotion'
          | 'ambientAtmosphere'
          | 'cueDurationMs'
        >
      >
    ) => {
      setState((current) => ({
        ...current,
        sceneCues: current.sceneCues.map((entry) =>
          entry.eventName === eventName && entry.sceneProfile === sceneProfile
            ? {
                ...entry,
                ...patch,
              }
            : entry
        ),
        scenePacks: current.scenePacks.map((pack) =>
          pack.sceneProfile === sceneProfile
            ? {
                ...pack,
                status: 'draft',
                draftRevision:
                  Object.keys(patch).length > 0 ? pack.draftRevision + 1 : pack.draftRevision,
              }
            : pack
        ),
        publishLog: current.publishLog,
      }));
    },
    []
  );

  const updateSceneStateEntry = useCallback(
    (
      sceneProfile: CreativeSkinPack['sceneProfile'],
      stateKey: CreativeSceneStateKey,
      patch: Partial<
        Pick<
          CreativeSceneStateEntry,
          | 'environmentMode'
          | 'cameraShot'
          | 'screenMode'
          | 'cameraOrbitSpeed'
          | 'lightRig'
          | 'ambientAtmosphere'
          | 'beatPulse'
          | 'ringPulse'
          | 'groundMotion'
          | 'modelFloat'
          | 'hideLightSource'
        >
      >
    ) => {
      setState((current) => ({
        ...current,
        sceneStates: current.sceneStates.map((entry) =>
          entry.stateKey === stateKey && entry.sceneProfile === sceneProfile
            ? {
                ...entry,
                ...patch,
              }
            : entry
        ),
        scenePacks: current.scenePacks.map((pack) =>
          pack.sceneProfile === sceneProfile
            ? {
                ...pack,
                status: 'draft',
                draftRevision:
                  Object.keys(patch).length > 0 ? pack.draftRevision + 1 : pack.draftRevision,
              }
            : pack
        ),
        publishLog: current.publishLog,
      }));
    },
    []
  );

  const updateSceneLightPreset = useCallback(
    (
      sceneProfile: CreativeSkinPack['sceneProfile'],
      presetKey: CreativeSceneLightPresetKey,
      patch: Partial<Pick<CreativeSceneLightPreset, 'lightRig'>>
    ) => {
      setState((current) => ({
        ...current,
        sceneLightPresets: current.sceneLightPresets.map((entry) =>
          entry.sceneProfile === sceneProfile && entry.presetKey === presetKey
            ? {
                ...entry,
                ...patch,
              }
            : entry
        ),
        scenePacks: current.scenePacks.map((pack) =>
          pack.sceneProfile === sceneProfile
            ? {
                ...pack,
                status: 'draft',
                draftRevision:
                  Object.keys(patch).length > 0 ? pack.draftRevision + 1 : pack.draftRevision,
              }
            : pack
        ),
        publishLog: current.publishLog,
      }));
    },
    []
  );

  const updateSceneMotionPreset = useCallback(
    (
      sceneProfile: CreativeSkinPack['sceneProfile'],
      presetKey: CreativeSceneMotionPresetKey,
      patch: Partial<
        Pick<CreativeSceneMotionPreset, 'transitionStyle' | 'cameraOrbitSpeed' | 'cueDurationMs'>
      >
    ) => {
      setState((current) => ({
        ...current,
        sceneMotionPresets: current.sceneMotionPresets.map((entry) =>
          entry.sceneProfile === sceneProfile && entry.presetKey === presetKey
            ? {
                ...entry,
                ...patch,
              }
            : entry
        ),
        scenePacks: current.scenePacks.map((pack) =>
          pack.sceneProfile === sceneProfile
            ? {
                ...pack,
                status: 'draft',
                draftRevision:
                  Object.keys(patch).length > 0 ? pack.draftRevision + 1 : pack.draftRevision,
              }
            : pack
        ),
        publishLog: current.publishLog,
      }));
    },
    []
  );

  const updateSceneStateBinding = useCallback(
    (
      sceneProfile: CreativeSkinPack['sceneProfile'],
      eventName: string,
      patch: Partial<Pick<CreativeSceneStateBinding, 'stateKey' | 'holdMs'>>
    ) => {
      setState((current) => ({
        ...current,
        sceneStateBindings: current.sceneStateBindings.map((entry) =>
          entry.sceneProfile === sceneProfile && entry.eventName === eventName
            ? {
                ...entry,
                ...patch,
              }
            : entry
        ),
        scenePacks: current.scenePacks.map((pack) =>
          pack.sceneProfile === sceneProfile
            ? {
                ...pack,
                status: 'draft',
                draftRevision:
                  Object.keys(patch).length > 0 ? pack.draftRevision + 1 : pack.draftRevision,
              }
            : pack
        ),
        publishLog: current.publishLog,
      }));
    },
    []
  );

  const updateSceneScreenPreset = useCallback(
    (
      sceneProfile: CreativeSkinPack['sceneProfile'],
      screenMode: CreativeSceneScreenMode,
      patch: Partial<
        Pick<
          CreativeSceneScreenPreset,
          'missionLabel' | 'roleLabel' | 'traceLabel' | 'fallbackMissionText' | 'fallbackRoleText'
        >
      >
    ) => {
      setState((current) => ({
        ...current,
        sceneScreenPresets: current.sceneScreenPresets.map((entry) =>
          entry.sceneProfile === sceneProfile && entry.mode === screenMode
            ? {
                ...entry,
                ...patch,
              }
            : entry
        ),
        scenePacks: current.scenePacks.map((pack) =>
          pack.sceneProfile === sceneProfile
            ? {
                ...pack,
                status: 'draft',
                draftRevision:
                  Object.keys(patch).length > 0 ? pack.draftRevision + 1 : pack.draftRevision,
              }
            : pack
        ),
        publishLog: current.publishLog,
      }));
    },
    []
  );

  const updateSceneAvatarPreset = useCallback(
    (
      sceneProfile: CreativeSkinPack['sceneProfile'],
      avatarProfile: CreativeAvatarProfile,
      patch: Partial<
        Pick<
          CreativeSceneAvatarPreset,
          | 'shellLabel'
          | 'identityBadge'
          | 'deckPrompt'
          | 'loadoutTitle'
          | 'loadoutDescription'
          | 'capabilityLabel'
          | 'relayLabel'
          | 'statusLabel'
          | 'roleFallbackText'
          | 'previewRoleText'
          | 'presencePresets'
          | 'loadoutSlots'
        >
      >
    ) => {
      setState((current) => ({
        ...current,
        sceneAvatarPresets: current.sceneAvatarPresets.map((entry) =>
          entry.sceneProfile === sceneProfile && entry.avatarProfile === avatarProfile
            ? {
                ...entry,
                ...patch,
              }
            : entry
        ),
        scenePacks: current.scenePacks.map((pack) =>
          pack.sceneProfile === sceneProfile
            ? {
                ...pack,
                status: 'draft',
                draftRevision:
                  Object.keys(patch).length > 0 ? pack.draftRevision + 1 : pack.draftRevision,
              }
            : pack
        ),
        publishLog: current.publishLog,
      }));
    },
    []
  );

  const updateSceneResponsePreset = useCallback(
    (
      sceneProfile: CreativeSkinPack['sceneProfile'],
      responseType: CreativeSceneResponseType,
      patch: Partial<
        Pick<
          CreativeSceneResponsePreset,
          | 'environmentMode'
          | 'cameraShot'
          | 'screenMode'
          | 'transitionStyle'
          | 'cameraOrbitSpeed'
          | 'lightRig'
          | 'targetStateKey'
          | 'holdMs'
          | 'beatPulse'
          | 'ringPulse'
          | 'groundMotion'
          | 'ambientAtmosphere'
          | 'cueDurationMs'
        >
      >
    ) => {
      setState((current) => ({
        ...current,
        sceneResponsePresets: current.sceneResponsePresets.map((entry) =>
          entry.sceneProfile === sceneProfile && entry.responseType === responseType
            ? {
                ...entry,
                ...patch,
              }
            : entry
        ),
        scenePacks: current.scenePacks.map((pack) =>
          pack.sceneProfile === sceneProfile
            ? {
                ...pack,
                status: 'draft',
                draftRevision:
                  Object.keys(patch).length > 0 ? pack.draftRevision + 1 : pack.draftRevision,
              }
            : pack
        ),
        publishLog: current.publishLog,
      }));
    },
    []
  );

  const applySceneResponsePreset = useCallback(
    (sceneProfile: CreativeSkinPack['sceneProfile'], responseType: CreativeSceneResponseType) => {
      setState((current) => {
        const preset = current.sceneResponsePresets.find(
          (entry) => entry.sceneProfile === sceneProfile && entry.responseType === responseType
        );
        if (!preset) return current;
        const next = applyCreativeSceneResponsePresetToEntries(
          current.sceneCues,
          current.sceneStateBindings,
          preset
        );
        return {
          ...current,
          sceneCues: next.sceneCues,
          sceneStateBindings: next.bindings,
          scenePacks: current.scenePacks.map((pack) =>
            pack.sceneProfile === sceneProfile
              ? {
                  ...pack,
                  status: 'draft',
                  draftRevision: pack.draftRevision + 1,
                }
              : pack
          ),
          publishLog: current.publishLog,
        };
      });
    },
    []
  );

  const applySceneLightPresetToStatesForProfile = useCallback(
    (sceneProfile: CreativeSkinPack['sceneProfile'], presetKey: CreativeSceneLightPresetKey) => {
      setState((current) => {
        const preset = current.sceneLightPresets.find(
          (entry) => entry.sceneProfile === sceneProfile && entry.presetKey === presetKey
        );
        if (!preset) return current;
        return {
          ...current,
          sceneStates: applyCreativeSceneLightPresetToStates(current.sceneStates, preset),
          scenePacks: current.scenePacks.map((pack) =>
            pack.sceneProfile === sceneProfile
              ? {
                  ...pack,
                  status: 'draft',
                  draftRevision: pack.draftRevision + 1,
                }
              : pack
          ),
          publishLog: current.publishLog,
        };
      });
    },
    []
  );

  const applySceneLightPresetToResponsesForProfile = useCallback(
    (sceneProfile: CreativeSkinPack['sceneProfile'], presetKey: CreativeSceneLightPresetKey) => {
      setState((current) => {
        const preset = current.sceneLightPresets.find(
          (entry) => entry.sceneProfile === sceneProfile && entry.presetKey === presetKey
        );
        if (!preset) return current;
        return {
          ...current,
          sceneResponsePresets: applyCreativeSceneLightPresetToResponsePresets(
            current.sceneResponsePresets,
            preset
          ),
          scenePacks: current.scenePacks.map((pack) =>
            pack.sceneProfile === sceneProfile
              ? {
                  ...pack,
                  status: 'draft',
                  draftRevision: pack.draftRevision + 1,
                }
              : pack
          ),
          publishLog: current.publishLog,
        };
      });
    },
    []
  );

  const applySceneMotionPresetToStatesForProfile = useCallback(
    (sceneProfile: CreativeSkinPack['sceneProfile'], presetKey: CreativeSceneMotionPresetKey) => {
      setState((current) => {
        const preset = current.sceneMotionPresets.find(
          (entry) => entry.sceneProfile === sceneProfile && entry.presetKey === presetKey
        );
        if (!preset) return current;
        return {
          ...current,
          sceneStates: applyCreativeSceneMotionPresetToStates(current.sceneStates, preset),
          scenePacks: current.scenePacks.map((pack) =>
            pack.sceneProfile === sceneProfile
              ? {
                  ...pack,
                  status: 'draft',
                  draftRevision: pack.draftRevision + 1,
                }
              : pack
          ),
          publishLog: current.publishLog,
        };
      });
    },
    []
  );

  const applySceneMotionPresetToResponsesForProfile = useCallback(
    (sceneProfile: CreativeSkinPack['sceneProfile'], presetKey: CreativeSceneMotionPresetKey) => {
      setState((current) => {
        const preset = current.sceneMotionPresets.find(
          (entry) => entry.sceneProfile === sceneProfile && entry.presetKey === presetKey
        );
        if (!preset) return current;
        return {
          ...current,
          sceneResponsePresets: applyCreativeSceneMotionPresetToResponsePresets(
            current.sceneResponsePresets,
            preset
          ),
          scenePacks: current.scenePacks.map((pack) =>
            pack.sceneProfile === sceneProfile
              ? {
                  ...pack,
                  status: 'draft',
                  draftRevision: pack.draftRevision + 1,
                }
              : pack
          ),
          publishLog: current.publishLog,
        };
      });
    },
    []
  );

  const applySkinMotionProfileTemplate = useCallback(
    (skinId: string) => {
      setState((current) => {
        const skin = current.skinPacks.find((entry) => entry.id === skinId);
        if (!skin) return current;
        return {
          ...current,
          sceneMotionPresets: applyCreativeMotionProfileTemplateToSceneMotionPresets(
            current.sceneMotionPresets,
            skin.sceneProfile,
            skin.motionProfile
          ),
          scenePacks: current.scenePacks.map((pack) =>
            pack.sceneProfile === skin.sceneProfile
              ? {
                  ...pack,
                  status: 'draft',
                  draftRevision: pack.draftRevision + 1,
                }
              : pack
          ),
          publishLog: current.publishLog,
        };
      });
    },
    []
  );

  const applySkinScreenProfileTemplate = useCallback(
    (skinId: string) => {
      setState((current) => {
        const skin = current.skinPacks.find((entry) => entry.id === skinId);
        if (!skin) return current;
        return {
          ...current,
          sceneScreenPresets: applyCreativeScreenProfileTemplateToSceneScreenPresets(
            current.sceneScreenPresets,
            skin.sceneProfile,
            skin.screenProfile
          ),
          scenePacks: current.scenePacks.map((pack) =>
            pack.sceneProfile === skin.sceneProfile
              ? {
                  ...pack,
                  status: 'draft',
                  draftRevision: pack.draftRevision + 1,
                }
              : pack
          ),
          publishLog: current.publishLog,
        };
      });
    },
    []
  );

  const applySkinAvatarProfileTemplate = useCallback(
    (skinId: string) => {
      setState((current) => {
        const skin = current.skinPacks.find((entry) => entry.id === skinId);
        if (!skin) return current;
        return {
          ...current,
          sceneAvatarPresets: applyCreativeAvatarProfileTemplateToSceneAvatarPresets(
            current.sceneAvatarPresets,
            skin.sceneProfile,
            skin.avatarProfile
          ),
          scenePacks: current.scenePacks.map((pack) =>
            pack.sceneProfile === skin.sceneProfile
              ? {
                  ...pack,
                  status: 'draft',
                  draftRevision: pack.draftRevision + 1,
                }
              : pack
          ),
          publishLog: current.publishLog,
        };
      });
    },
    []
  );

  const restorePublishedScenePack = useCallback((sceneProfile: CreativeSkinPack['sceneProfile']) => {
    setState((current) => {
      const publishedEntries = current.publishedSceneCues.filter((entry) => entry.sceneProfile === sceneProfile);
      const target = current.scenePacks.find((pack) => pack.sceneProfile === sceneProfile);
      if (!target || publishedEntries.length === 0) return current;
      return {
        ...current,
        sceneCues: [
          ...current.sceneCues.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...publishedEntries,
        ],
        sceneStates: [
          ...current.sceneStates.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.publishedSceneStates.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        sceneStateBindings: [
          ...current.sceneStateBindings.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.publishedSceneStateBindings.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        sceneScreenPresets: [
          ...current.sceneScreenPresets.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.publishedSceneScreenPresets.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        sceneAvatarPresets: [
          ...current.sceneAvatarPresets.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.publishedSceneAvatarPresets.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        sceneResponsePresets: [
          ...current.sceneResponsePresets.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.publishedSceneResponsePresets.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        sceneLightPresets: [
          ...current.sceneLightPresets.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.publishedSceneLightPresets.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        sceneMotionPresets: [
          ...current.sceneMotionPresets.filter((entry) => entry.sceneProfile !== sceneProfile),
          ...current.publishedSceneMotionPresets.filter((entry) => entry.sceneProfile === sceneProfile),
        ],
        scenePacks: current.scenePacks.map((pack) =>
          pack.sceneProfile === sceneProfile
            ? {
                ...pack,
                status: 'published',
                draftRevision: pack.publishedRevision,
              }
            : pack
        ),
        publishLog: [
          {
            id: `creative-log-${Math.random().toString(36).slice(2, 10)}`,
            targetType: 'scene',
            targetId: target.id,
            label: target.name,
            action: 'restored',
            revision: target.publishedRevision,
            occurredAt: Date.now(),
            actorScope: userId ? 'account' : 'guest',
          },
          ...current.publishLog,
        ].slice(0, 40),
      };
    });
  }, [userId]);

  const restorePublishedSoundPack = useCallback((soundPackId: string) => {
    setState((current) => {
      const publishedEntries = current.publishedEventMap.filter((entry) => entry.soundPackId === soundPackId);
      const target = current.skinPacks.find((pack) => pack.soundPackId === soundPackId);
      if (!target || publishedEntries.length === 0) return current;
      return {
        ...current,
        eventMap: [
          ...current.eventMap.filter((entry) => entry.soundPackId !== soundPackId),
          ...publishedEntries,
        ],
        skinPacks: current.skinPacks.map((pack) =>
          pack.soundPackId === soundPackId ? { ...pack, status: 'published' } : pack
        ),
        publishLog: [
          {
            id: `creative-log-${Math.random().toString(36).slice(2, 10)}`,
            targetType: 'skin',
            targetId: target.id,
            label: target.name,
            action: 'restored',
            revision: 1,
            occurredAt: Date.now(),
            actorScope: userId ? 'account' : 'guest',
          },
          ...current.publishLog,
        ].slice(0, 40),
      };
    });
  }, [userId]);

  const uploadSoundAssetForEvent = useCallback(
    async (soundPackId: string, eventName: string, file: File) => {
      const audioDataUrl = await readFileAsDataUrl(file);
      const nextAsset: CreativeSoundAsset = {
        id: `upload-audio-${Math.random().toString(36).slice(2, 10)}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        kind: guessMixGroupForEvent(eventName),
        source: 'upload',
        createdAt: Date.now(),
        audioDataUrl,
        mimeType: file.type || 'audio/mpeg',
      };
      setState((current) => ({
        ...current,
        soundAssets: [nextAsset, ...current.soundAssets],
        eventMap: current.eventMap.map((entry) =>
          entry.eventName === eventName && entry.soundPackId === soundPackId
            ? {
                ...entry,
                assetId: nextAsset.id,
                mixGroup: nextAsset.kind,
              }
            : entry
        ),
        skinPacks: current.skinPacks.map((pack) =>
          pack.soundPackId === soundPackId ? { ...pack, status: 'draft' } : pack
        ),
      }));
      return nextAsset;
    },
    []
  );

  const importSceneStudioRuntimePack = useCallback(
    (
      pack: SceneStudioRuntimePackV1,
      options: {
        mode?: 'draft' | 'published';
        fileName?: string | null;
      } = {}
    ) => {
      setState((current) =>
        applySceneStudioRuntimePackImportToCreativeOpsState(current, pack, {
          mode: options.mode || 'draft',
          fileName: options.fileName || null,
          actorScope: userId ? 'account' : 'guest',
        })
      );
    },
    [userId]
  );

  const rollbackSceneStudioRuntimePackImport = useCallback(
    (importId: string) => {
      setState((current) =>
        rollbackSceneStudioRuntimePackImportInCreativeOpsState(current, importId, {
          actorScope: userId ? 'account' : 'guest',
        })
      );
    },
    [userId]
  );

  return {
    state,
    runtimePackHistory: state.runtimePackHistory,
    selectedSkin,
    activeSkin,
    soundAssetMap,
    selectedScenePack,
    selectedEventMap,
    selectedPublishedEventMap,
    selectedSceneCues,
    selectedPublishedSceneCues,
    selectedSceneStates,
    selectedPublishedSceneStates,
    selectedSceneStateBindings,
    selectedPublishedSceneStateBindings,
    selectedSceneScreenPresets,
    selectedPublishedSceneScreenPresets,
    selectedSceneAvatarPresets,
    selectedPublishedSceneAvatarPresets,
    selectedSceneResponsePresets,
    selectedPublishedSceneResponsePresets,
    selectedSceneLightPresets,
    selectedPublishedSceneLightPresets,
    selectedSceneMotionPresets,
    selectedPublishedSceneMotionPresets,
    setSelectedSkinId,
    setActiveSkinId,
    setSkinStatus,
    updateSkinMotionProfile,
    updateSkinScreenProfile,
    updateSkinAvatarProfile,
    publishScenePack,
    setScenePackDraft,
    restorePublishedScenePack,
    restorePublishedSoundPack,
    assignSoundToEvent,
    updateEventMapEntry,
    updateSceneCueEntry,
    updateSceneStateEntry,
    updateSceneStateBinding,
    updateSceneScreenPreset,
    updateSceneAvatarPreset,
    updateSceneResponsePreset,
    updateSceneLightPreset,
    updateSceneMotionPreset,
    applySceneResponsePreset,
    applySceneLightPresetToStatesForProfile,
    applySceneLightPresetToResponsesForProfile,
    applySceneMotionPresetToStatesForProfile,
    applySceneMotionPresetToResponsesForProfile,
    applySkinMotionProfileTemplate,
    applySkinScreenProfileTemplate,
    applySkinAvatarProfileTemplate,
    uploadSoundAssetForEvent,
    importSceneStudioRuntimePack,
    rollbackSceneStudioRuntimePackImport,
  };
};

export const getCreativeSkinThemeLabel = (pack: CreativeSkinPack) =>
  `${pack.theme.toUpperCase()} / ${pack.accent.toUpperCase()}`;

export const getCreativeSkinRuntimeLabel = (pack: CreativeSkinPack) =>
  `${pack.sceneProfile.toUpperCase()} • ${pack.avatarProfile.toUpperCase()} avatar • ${pack.motionProfile.toUpperCase()} motion • ${pack.screenProfile.toUpperCase()} screens • ${getBuiltInThemePackId(pack.theme)}`;
