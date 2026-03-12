import type {
  CreativeMixGroup,
  CreativeOpsState,
  CreativeSceneAvatarPreset,
  CreativeSceneCueEntry,
  CreativeSceneLightPreset,
  CreativeSceneMotionPreset,
  CreativeScenePack,
  CreativeSceneResponsePreset,
  CreativeSceneScreenPreset,
  CreativeSceneStateBinding,
  CreativeSceneStateEntry,
  CreativeSkinPack,
  CreativeSoundEventMapEntry,
} from '../admin/creativeOps';

export type SceneStudioRuntimePackVersion = 1;

export type SceneStudioRuntimePackSegment =
  | 'soundEventMap'
  | 'sceneCues'
  | 'sceneStates'
  | 'sceneStateBindings'
  | 'sceneScreenPresets'
  | 'sceneAvatarPresets'
  | 'sceneResponsePresets'
  | 'sceneLightPresets'
  | 'sceneMotionPresets';

export interface SceneStudioRuntimePackManifestV1 {
  format: 'xtation.scene-runtime-pack';
  version: SceneStudioRuntimePackVersion;
  exportId: string;
  name: string;
  sceneProfile: CreativeSkinPack['sceneProfile'];
  exportedAt: string;
  description?: string;
  sourceProjectId?: string;
  sourceProjectName?: string;
  segments?: SceneStudioRuntimePackSegment[];
}

export interface SceneStudioRuntimePackSkinV1 {
  theme?: CreativeSkinPack['theme'];
  accent?: CreativeSkinPack['accent'];
  soundPackId?: string | null;
  motionProfile?: CreativeSkinPack['motionProfile'];
  screenProfile?: CreativeSkinPack['screenProfile'];
  avatarProfile?: CreativeSkinPack['avatarProfile'];
}

export interface SceneStudioRuntimePackV1 {
  manifest: SceneStudioRuntimePackManifestV1;
  scenePack?: Pick<CreativeScenePack, 'id' | 'name' | 'description'>;
  skin?: SceneStudioRuntimePackSkinV1;
  soundEventMap?: CreativeSoundEventMapEntry[];
  sceneCues?: CreativeSceneCueEntry[];
  sceneStates?: CreativeSceneStateEntry[];
  sceneStateBindings?: CreativeSceneStateBinding[];
  sceneScreenPresets?: CreativeSceneScreenPreset[];
  sceneAvatarPresets?: CreativeSceneAvatarPreset[];
  sceneResponsePresets?: CreativeSceneResponsePreset[];
  sceneLightPresets?: CreativeSceneLightPreset[];
  sceneMotionPresets?: CreativeSceneMotionPreset[];
}

export interface SceneStudioRuntimePackImportResult {
  sceneProfile: CreativeSkinPack['sceneProfile'];
  includedSegments: SceneStudioRuntimePackSegment[];
  scenePack: CreativeScenePack;
  skinPatch: Partial<Pick<
    CreativeSkinPack,
    'theme' | 'accent' | 'soundPackId' | 'motionProfile' | 'screenProfile' | 'avatarProfile'
  >>;
}

export interface ApplySceneStudioRuntimePackOptions {
  mode?: 'draft' | 'published';
  occurredAt?: number;
}

const SEGMENT_KEYS: readonly SceneStudioRuntimePackSegment[] = [
  'soundEventMap',
  'sceneCues',
  'sceneStates',
  'sceneStateBindings',
  'sceneScreenPresets',
  'sceneAvatarPresets',
  'sceneResponsePresets',
  'sceneLightPresets',
  'sceneMotionPresets',
] as const;

const hasSegmentRows = <T>(value: T[] | undefined): boolean => Array.isArray(value) && value.length > 0;

const replaceBySceneProfile = <T extends { sceneProfile: CreativeSkinPack['sceneProfile'] }>(
  source: T[],
  sceneProfile: CreativeSkinPack['sceneProfile'],
  nextEntries: T[] | undefined
): T[] => {
  if (!hasSegmentRows(nextEntries)) return source;
  return [...source.filter((entry) => entry.sceneProfile !== sceneProfile), ...nextEntries];
};

const replaceBySoundPackId = (
  source: CreativeSoundEventMapEntry[],
  soundPackId: string | null | undefined,
  nextEntries: CreativeSoundEventMapEntry[] | undefined
): CreativeSoundEventMapEntry[] => {
  if (!soundPackId || !hasSegmentRows(nextEntries)) return source;
  return [...source.filter((entry) => entry.soundPackId !== soundPackId), ...nextEntries];
};

const buildScenePackFromRuntimePack = (
  pack: SceneStudioRuntimePackV1,
  current: CreativeScenePack | undefined,
  occurredAt: number,
  mode: 'draft' | 'published'
): CreativeScenePack => {
  const baseId = pack.scenePack?.id || `scene-pack-${pack.manifest.sceneProfile}`;
  const baseName = pack.scenePack?.name || `${pack.manifest.name} Scene Pack`;
  const description = pack.scenePack?.description || pack.manifest.description || '';

  if (!current) {
    return {
      id: baseId,
      name: baseName,
      description,
      sceneProfile: pack.manifest.sceneProfile,
      status: mode === 'published' ? 'published' : 'draft',
      draftRevision: 1,
      publishedRevision: mode === 'published' ? 1 : 0,
      lastPublishedAt: mode === 'published' ? occurredAt : null,
    };
  }

  const nextPublishedRevision =
    mode === 'published' ? Math.max(current.publishedRevision + 1, 1) : current.publishedRevision;

  return {
    ...current,
    id: baseId,
    name: baseName,
    description,
    sceneProfile: pack.manifest.sceneProfile,
    status: mode === 'published' ? 'published' : 'draft',
    draftRevision: mode === 'published' ? nextPublishedRevision : current.draftRevision + 1,
    publishedRevision: nextPublishedRevision,
    lastPublishedAt: mode === 'published' ? occurredAt : current.lastPublishedAt,
  };
};

export const isSceneStudioRuntimePackV1 = (value: unknown): value is SceneStudioRuntimePackV1 => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { manifest?: SceneStudioRuntimePackManifestV1 };
  return (
    candidate.manifest?.format === 'xtation.scene-runtime-pack' &&
    candidate.manifest.version === 1 &&
    typeof candidate.manifest.sceneProfile === 'string'
  );
};

export const resolveSceneStudioRuntimePackSegments = (
  pack: SceneStudioRuntimePackV1
): SceneStudioRuntimePackSegment[] => {
  if (Array.isArray(pack.manifest.segments) && pack.manifest.segments.length > 0) {
    return pack.manifest.segments.filter((segment): segment is SceneStudioRuntimePackSegment =>
      SEGMENT_KEYS.includes(segment)
    );
  }
  return SEGMENT_KEYS.filter((segment) => hasSegmentRows(pack[segment]));
};

export const summarizeSceneStudioRuntimePack = (
  pack: SceneStudioRuntimePackV1,
  currentState: CreativeOpsState
): SceneStudioRuntimePackImportResult => {
  const sceneProfile = pack.manifest.sceneProfile;
  const currentScenePack = currentState.scenePacks.find((entry) => entry.sceneProfile === sceneProfile);
  const includedSegments = resolveSceneStudioRuntimePackSegments(pack);

  return {
    sceneProfile,
    includedSegments,
    scenePack: buildScenePackFromRuntimePack(pack, currentScenePack, Date.now(), 'draft'),
    skinPatch: {
      theme: pack.skin?.theme,
      accent: pack.skin?.accent,
      soundPackId: pack.skin?.soundPackId ?? undefined,
      motionProfile: pack.skin?.motionProfile,
      screenProfile: pack.skin?.screenProfile,
      avatarProfile: pack.skin?.avatarProfile,
    },
  };
};

export const applySceneStudioRuntimePack = (
  currentState: CreativeOpsState,
  pack: SceneStudioRuntimePackV1,
  options: ApplySceneStudioRuntimePackOptions = {}
): CreativeOpsState => {
  const mode = options.mode || 'draft';
  const occurredAt = options.occurredAt || Date.now();
  const sceneProfile = pack.manifest.sceneProfile;
  const currentScenePack = currentState.scenePacks.find((entry) => entry.sceneProfile === sceneProfile);
  const nextScenePack = buildScenePackFromRuntimePack(pack, currentScenePack, occurredAt, mode);
  const soundPackId =
    pack.skin?.soundPackId ??
    currentState.skinPacks.find((entry) => entry.sceneProfile === sceneProfile)?.soundPackId ??
    null;

  const nextSkinPacks = currentState.skinPacks.map((entry) =>
    entry.sceneProfile === sceneProfile
      ? {
          ...entry,
          theme: pack.skin?.theme ?? entry.theme,
          accent: pack.skin?.accent ?? entry.accent,
          soundPackId: pack.skin?.soundPackId ?? entry.soundPackId,
          motionProfile: pack.skin?.motionProfile ?? entry.motionProfile,
          screenProfile: pack.skin?.screenProfile ?? entry.screenProfile,
          avatarProfile: pack.skin?.avatarProfile ?? entry.avatarProfile,
          status: mode === 'published' ? 'published' : 'draft',
        }
      : entry
  );

  const nextScenePacks = currentState.scenePacks.some((entry) => entry.sceneProfile === sceneProfile)
    ? currentState.scenePacks.map((entry) => (entry.sceneProfile === sceneProfile ? nextScenePack : entry))
    : [...currentState.scenePacks, nextScenePack];

  const nextDraftState = {
    ...currentState,
    skinPacks: nextSkinPacks,
    scenePacks: nextScenePacks,
    eventMap: replaceBySoundPackId(currentState.eventMap, soundPackId, pack.soundEventMap),
    sceneCues: replaceBySceneProfile(currentState.sceneCues, sceneProfile, pack.sceneCues),
    sceneStates: replaceBySceneProfile(currentState.sceneStates, sceneProfile, pack.sceneStates),
    sceneStateBindings: replaceBySceneProfile(
      currentState.sceneStateBindings,
      sceneProfile,
      pack.sceneStateBindings
    ),
    sceneScreenPresets: replaceBySceneProfile(
      currentState.sceneScreenPresets,
      sceneProfile,
      pack.sceneScreenPresets
    ),
    sceneAvatarPresets: replaceBySceneProfile(
      currentState.sceneAvatarPresets,
      sceneProfile,
      pack.sceneAvatarPresets
    ),
    sceneResponsePresets: replaceBySceneProfile(
      currentState.sceneResponsePresets,
      sceneProfile,
      pack.sceneResponsePresets
    ),
    sceneLightPresets: replaceBySceneProfile(
      currentState.sceneLightPresets,
      sceneProfile,
      pack.sceneLightPresets
    ),
    sceneMotionPresets: replaceBySceneProfile(
      currentState.sceneMotionPresets,
      sceneProfile,
      pack.sceneMotionPresets
    ),
  };

  if (mode !== 'published') {
    return nextDraftState;
  }

  return {
    ...nextDraftState,
    publishedEventMap: replaceBySoundPackId(currentState.publishedEventMap, soundPackId, pack.soundEventMap),
    publishedSceneCues: replaceBySceneProfile(currentState.publishedSceneCues, sceneProfile, pack.sceneCues),
    publishedSceneStates: replaceBySceneProfile(currentState.publishedSceneStates, sceneProfile, pack.sceneStates),
    publishedSceneStateBindings: replaceBySceneProfile(
      currentState.publishedSceneStateBindings,
      sceneProfile,
      pack.sceneStateBindings
    ),
    publishedSceneScreenPresets: replaceBySceneProfile(
      currentState.publishedSceneScreenPresets,
      sceneProfile,
      pack.sceneScreenPresets
    ),
    publishedSceneAvatarPresets: replaceBySceneProfile(
      currentState.publishedSceneAvatarPresets,
      sceneProfile,
      pack.sceneAvatarPresets
    ),
    publishedSceneResponsePresets: replaceBySceneProfile(
      currentState.publishedSceneResponsePresets,
      sceneProfile,
      pack.sceneResponsePresets
    ),
    publishedSceneLightPresets: replaceBySceneProfile(
      currentState.publishedSceneLightPresets,
      sceneProfile,
      pack.sceneLightPresets
    ),
    publishedSceneMotionPresets: replaceBySceneProfile(
      currentState.publishedSceneMotionPresets,
      sceneProfile,
      pack.sceneMotionPresets
    ),
  };
};
