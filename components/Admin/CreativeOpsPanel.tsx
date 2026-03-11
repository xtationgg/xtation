import React, { useMemo, useRef, useState } from 'react';
import { Clapperboard, Paintbrush2, Volume2, Workflow, Upload, Play, ShieldCheck } from 'lucide-react';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useXtationSettings } from '../../src/settings/SettingsProvider';
import { type PresentationEventFamilySummary, type PresentationEventRecord } from '../../src/presentation/events';
import { usePresentationEvents } from '../../src/presentation/PresentationEventsProvider';
import {
  buildCreativeSkinPackageSummary,
  collectCreativeSceneAvatarPresetDifferences,
  collectCreativeSceneDifferences,
  collectCreativeSceneLightPresetDifferences,
  collectCreativeSceneMotionPresetDifferences,
  collectCreativeSceneResponsePresetDifferences,
  collectCreativeSceneScreenPresetDifferences,
  collectCreativeSceneStateBindingDifferences,
  collectCreativeSceneStateDifferences,
  collectCreativeSoundDifferences,
  getCreativeSkinRuntimeLabel,
  getCreativeSkinThemeLabel,
  previewCreativeSoundAsset,
  resolveCreativeAvatarPresencePreset,
  resolveCreativeSceneAvatarPreset,
  resolveCreativeSceneCue,
  resolveCreativeSceneStateBinding,
  resolveCreativeSoundCue,
  useCreativeOpsStudio,
  type CreativeMixGroup,
} from '../../src/admin/creativeOps';
import { ProfileLobbyScene } from '../Views/ProfileLobbyScene';

interface CreativeOpsPanelProps {
  recentEvents: PresentationEventRecord[];
  familySummaries: PresentationEventFamilySummary[];
  storageScope: string;
}

const sectionCard =
  'xt-admin-card';

const panelButton =
  'xt-admin-pill';

const mixGroups: CreativeMixGroup[] = ['ui', 'notifications', 'quest', 'dusk', 'ambient', 'music', 'scene_fx'];
const environmentOptions = ['inherit', 'bureau', 'light', 'mono', 'glacier', 'core', 'dusk'] as const;
const cameraOptions = ['inherit', 'wide', 'hero', 'mid'] as const;
const screenModeOptions = ['base', 'focus', 'brief', 'urgent', 'success'] as const;
const transitionOptions = ['calm', 'sharp', 'surge'] as const;
const responsePreviewEventMap = {
  focus: 'play.session.start',
  brief: 'dusk.brief.loaded',
  reward: 'quest.completed',
  alert: 'notification.urgent',
} as const;
const previewScenarioBundles = [
  {
    id: 'focus-loop',
    label: 'Focus Loop',
    detail: 'productive / day / partial',
    eventName: 'play.session.start',
    stageState: 'productive',
    avatarState: 'partial',
    timeOfDay: 'day',
  },
  {
    id: 'dusk-brief',
    label: 'Dusk Brief',
    detail: 'productive / night / ready',
    eventName: 'dusk.brief.loaded',
    stageState: 'productive',
    avatarState: 'ready',
    timeOfDay: 'night',
  },
  {
    id: 'reward-pulse',
    label: 'Reward Pulse',
    detail: 'active / day / ready',
    eventName: 'quest.completed',
    stageState: 'active',
    avatarState: 'ready',
    timeOfDay: 'day',
  },
  {
    id: 'alert-surge',
    label: 'Alert Surge',
    detail: 'active / night / empty',
    eventName: 'notification.urgent',
    stageState: 'active',
    avatarState: 'empty',
    timeOfDay: 'night',
  },
] as const;

const SummaryCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}> = ({ icon, label, value, detail }) => (
  <div className="xt-runtime-summary-card">
    <div className="xt-runtime-summary-head">
      <div className="xt-runtime-summary-icon">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="xt-runtime-summary-label">{label}</div>
        <div className="xt-runtime-summary-value">{value}</div>
      </div>
    </div>
    {detail ? <div className="xt-runtime-summary-detail">{detail}</div> : null}
  </div>
);

const formatDateTime = (value: number | null | undefined) => {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString();
};

const readMetaString = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);
const describeSkinPackage = (
  pack:
    | {
        sceneProfile: string;
        avatarProfile: string;
        motionProfile: string;
        screenProfile: string;
      }
    | null
) => {
  if (!pack) return 'No authored package selected.';
  return `${pack.sceneProfile} scene • ${pack.avatarProfile} avatar • ${pack.motionProfile} motion • ${pack.screenProfile} screens`;
};
const describeScenarioCheck = (
  expected: boolean,
  observed: boolean,
  matched: boolean
): 'match' | 'missing' | 'mismatch' | 'n/a' | 'unexpected' => {
  if (!expected && !observed) return 'n/a';
  if (!expected && observed) return 'unexpected';
  if (expected && !observed) return 'missing';
  return matched ? 'match' : 'mismatch';
};

const scenarioCheckTone = (
  value: ReturnType<typeof describeScenarioCheck>
) => {
  if (value === 'match') return 'text-[var(--app-accent)]';
  if (value === 'missing' || value === 'mismatch' || value === 'unexpected') return 'text-[#ff9b7a]';
  return 'text-[var(--app-muted)]';
};

export const CreativeOpsPanel: React.FC<CreativeOpsPanelProps> = ({
  recentEvents,
  familySummaries,
  storageScope,
}) => {
  const { emitEvent, clearEvents } = usePresentationEvents();
  const { theme, accent, setTheme, setAccent } = useTheme();
  const { settings, setActiveThemeId, setActiveSoundPackId } = useXtationSettings();
  const {
    state,
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
  } = useCreativeOpsStudio(recentEvents);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const previewScenarioTimerRef = useRef<number | null>(null);
  const [uploadTargetEvent, setUploadTargetEvent] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'draft' | 'published'>('draft');
  const [previewAvatarState, setPreviewAvatarState] = useState<'empty' | 'partial' | 'ready'>('ready');
  const [previewStageState, setPreviewStageState] = useState<'idle' | 'productive' | 'active'>('productive');
  const [previewTimeOfDay, setPreviewTimeOfDay] = useState<'day' | 'night'>('day');
  const [activePreviewScenarioId, setActivePreviewScenarioId] = useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewScenarioTimerRef.current) {
        window.clearTimeout(previewScenarioTimerRef.current);
      }
    };
  }, []);

  const activeStationMatchesSkin = useMemo(() => {
    if (!activeSkin) return false;
    return (
      activeSkin.theme === theme &&
      activeSkin.accent === accent &&
      settings.unlocks.activeSoundPackId === activeSkin.soundPackId
    );
  }, [accent, activeSkin, settings.unlocks.activeSoundPackId, theme]);

  const topFamilies = familySummaries.slice(0, 6);
  const draftPreviewSkin = selectedSkin || activeSkin;
  const publishedPreviewSkin = useMemo(() => {
    if (!selectedSkin) return activeSkin;
    if (selectedSkin.status === 'published') return selectedSkin;
    return (
      state.skinPacks.find(
        (pack) => pack.status === 'published' && pack.sceneProfile === selectedSkin.sceneProfile
      ) ||
      state.skinPacks.find(
        (pack) => pack.status === 'published' && pack.soundPackId === selectedSkin.soundPackId
      ) ||
      activeSkin ||
      null
    );
  }, [activeSkin, selectedSkin, state.skinPacks]);
  const previewSkin = previewMode === 'published' ? publishedPreviewSkin : draftPreviewSkin;
  const sceneDraftDeltaCount = useMemo(() => {
    const publishedByEvent = new Map(selectedPublishedSceneCues.map((cue) => [cue.eventName, cue]));
    let delta = 0;
    selectedSceneCues.forEach((cue) => {
      const published = publishedByEvent.get(cue.eventName);
      if (!published) {
        delta += 1;
        return;
      }
      if (
        published.environmentMode !== cue.environmentMode ||
        published.cameraShot !== cue.cameraShot ||
        published.screenMode !== cue.screenMode ||
        published.beatPulse !== cue.beatPulse ||
        published.ringPulse !== cue.ringPulse ||
        published.groundMotion !== cue.groundMotion ||
        published.ambientAtmosphere !== cue.ambientAtmosphere ||
        published.cueDurationMs !== cue.cueDurationMs
      ) {
        delta += 1;
      }
    });
    return delta;
  }, [selectedPublishedSceneCues, selectedSceneCues]);
  const soundDraftDeltaCount = useMemo(() => {
    const publishedByEvent = new Map(selectedPublishedEventMap.map((entry) => [entry.eventName, entry]));
    let delta = 0;
    selectedEventMap.forEach((entry) => {
      const published = publishedByEvent.get(entry.eventName);
      if (!published) {
        delta += 1;
        return;
      }
      if (
        published.assetId !== entry.assetId ||
        published.mixGroup !== entry.mixGroup ||
        published.volume !== entry.volume ||
        published.cooldownMs !== entry.cooldownMs
      ) {
        delta += 1;
      }
    });
    return delta;
  }, [selectedEventMap, selectedPublishedEventMap]);
  const sceneDraftDifferences = useMemo(
    () => collectCreativeSceneDifferences(selectedSceneCues, selectedPublishedSceneCues),
    [selectedPublishedSceneCues, selectedSceneCues]
  );
  const soundDraftDifferences = useMemo(
    () => collectCreativeSoundDifferences(selectedEventMap, selectedPublishedEventMap),
    [selectedEventMap, selectedPublishedEventMap]
  );
  const sceneStateDraftDifferences = useMemo(
    () => collectCreativeSceneStateDifferences(selectedSceneStates, selectedPublishedSceneStates),
    [selectedPublishedSceneStates, selectedSceneStates]
  );
  const sceneStateBindingDraftDifferences = useMemo(
    () =>
      collectCreativeSceneStateBindingDifferences(
        selectedSceneStateBindings,
        selectedPublishedSceneStateBindings
      ),
    [selectedPublishedSceneStateBindings, selectedSceneStateBindings]
  );
  const sceneScreenPresetDraftDifferences = useMemo(
    () =>
      collectCreativeSceneScreenPresetDifferences(
        selectedSceneScreenPresets,
        selectedPublishedSceneScreenPresets
      ),
    [selectedPublishedSceneScreenPresets, selectedSceneScreenPresets]
  );
  const sceneAvatarPresetDraftDifferences = useMemo(
    () =>
      collectCreativeSceneAvatarPresetDifferences(
        selectedSceneAvatarPresets,
        selectedPublishedSceneAvatarPresets
      ),
    [selectedPublishedSceneAvatarPresets, selectedSceneAvatarPresets]
  );
  const sceneResponsePresetDraftDifferences = useMemo(
    () =>
      collectCreativeSceneResponsePresetDifferences(
        selectedSceneResponsePresets,
        selectedPublishedSceneResponsePresets
      ),
    [selectedPublishedSceneResponsePresets, selectedSceneResponsePresets]
  );
  const sceneLightPresetDraftDifferences = useMemo(
    () =>
      collectCreativeSceneLightPresetDifferences(
        selectedSceneLightPresets,
        selectedPublishedSceneLightPresets
      ),
    [selectedPublishedSceneLightPresets, selectedSceneLightPresets]
  );
  const sceneMotionPresetDraftDifferences = useMemo(
    () =>
      collectCreativeSceneMotionPresetDifferences(
        selectedSceneMotionPresets,
        selectedPublishedSceneMotionPresets
      ),
    [selectedPublishedSceneMotionPresets, selectedSceneMotionPresets]
  );
  const packageSummary = useMemo(
    () => (selectedSkin ? buildCreativeSkinPackageSummary(state, selectedSkin.id) : null),
    [selectedSkin, state]
  );
  const previewAvatarPreset = useMemo(
    () =>
      previewSkin
        ? resolveCreativeSceneAvatarPreset(
            state,
            previewSkin.avatarProfile,
            previewSkin.sceneProfile,
            previewMode
          )
        : null,
    [previewMode, previewSkin, state]
  );
  const previewAvatarPresencePreset = useMemo(
    () => resolveCreativeAvatarPresencePreset(previewAvatarPreset, previewAvatarState),
    [previewAvatarPreset, previewAvatarState]
  );
  const previewTotalLoadoutSlots = previewAvatarPreset?.loadoutSlots?.length ?? 6;
  const previewOccupiedLoadoutSlots =
    previewAvatarState === 'ready'
      ? previewTotalLoadoutSlots
      : previewAvatarState === 'partial'
      ? Math.max(1, Math.ceil(previewTotalLoadoutSlots / 2))
      : 0;
  const previewMissingLoadoutBindings =
    previewAvatarState === 'ready'
      ? []
      : (previewAvatarPreset?.loadoutSlots ?? [])
          .slice(previewOccupiedLoadoutSlots)
          .map((slot) => slot.binding);
  const runtimeSceneState = useMemo(() => {
    const latestSync = recentEvents.find((event) => event.name === 'profile.scene.sync') || null;
    const latestHold = recentEvents.find((event) => event.name === 'profile.scene.state.hold') || null;
    const latestRelease = recentEvents.find((event) => event.name === 'profile.scene.state.release') || null;
    const latestCue = recentEvents.find((event) => event.name === 'profile.scene.cue.applied') || null;
    const latestFallback = recentEvents.find((event) => event.name === 'station.skin.fallback') || null;

    const holdActive = Boolean(
      latestHold && (!latestRelease || latestHold.occurredAt >= latestRelease.occurredAt)
    );
    const sceneProfile =
      readMetaString((holdActive ? latestHold : latestSync)?.metadata?.sceneProfile) ||
      readMetaString(latestRelease?.metadata?.sceneProfile) ||
      previewSkin?.sceneProfile ||
      null;
    const stateKey =
      readMetaString((holdActive ? latestHold : latestSync)?.metadata?.stateKey) ||
      readMetaString(latestSync?.metadata?.sceneStateKey) ||
      readMetaString(latestRelease?.metadata?.fallbackStateKey) ||
      'unknown';
    const screenMode =
      readMetaString(latestSync?.metadata?.screenMode) ||
      (holdActive ? 'held' : 'base');
    const missionLabel = readMetaString(latestSync?.metadata?.missionLabel) || null;
    const roleLabel = readMetaString(latestSync?.metadata?.roleLabel) || null;
    const traceLabel = readMetaString(latestSync?.metadata?.traceLabel) || null;
    const avatarProfile = readMetaString(latestSync?.metadata?.avatarProfile) || null;
    const identityBadge = readMetaString(latestSync?.metadata?.identityBadge) || null;
    const avatarPresenceLabel = readMetaString(latestSync?.metadata?.avatarPresenceLabel) || null;
    const avatarPresenceStateOverride =
      readMetaString(latestSync?.metadata?.avatarPresenceStateOverride) || null;
    const avatarPresenceScreenModeOverride =
      readMetaString(latestSync?.metadata?.avatarPresenceScreenModeOverride) || null;
    const shellLabel = readMetaString(latestSync?.metadata?.shellLabel) || null;
    const relayLabel = readMetaString(latestSync?.metadata?.relayLabel) || null;
    const statusLabel = readMetaString(latestSync?.metadata?.statusLabel) || null;
    const loadoutSlotSummary = readMetaString(latestSync?.metadata?.loadoutSlotSummary) || null;
    const loadoutBindingSummary = readMetaString(latestSync?.metadata?.loadoutBindingSummary) || null;
    const loadoutOccupancyState = readMetaString(latestSync?.metadata?.loadoutOccupancyState) || null;
    const occupiedLoadoutSlots =
      typeof latestSync?.metadata?.occupiedLoadoutSlots === 'number'
        ? latestSync.metadata.occupiedLoadoutSlots
        : null;
    const totalLoadoutSlots =
      typeof latestSync?.metadata?.totalLoadoutSlots === 'number'
        ? latestSync.metadata.totalLoadoutSlots
        : null;
    const missingLoadoutBindings = Array.isArray(latestSync?.metadata?.missingLoadoutBindings)
      ? latestSync.metadata.missingLoadoutBindings.filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0
        )
      : [];
    const triggerEvent =
      readMetaString((holdActive ? latestHold : latestSync)?.metadata?.eventName) ||
      readMetaString(latestSync?.metadata?.triggerEvent) ||
      readMetaString(latestRelease?.metadata?.eventName) ||
      null;

    return {
      stateKey,
      sceneProfile,
      screenMode,
      missionLabel,
      roleLabel,
      traceLabel,
      avatarProfile,
      identityBadge,
      avatarPresenceLabel,
      avatarPresenceStateOverride,
      avatarPresenceScreenModeOverride,
      shellLabel,
      relayLabel,
      statusLabel,
      loadoutSlotSummary,
      loadoutBindingSummary,
      loadoutOccupancyState,
      occupiedLoadoutSlots,
      totalLoadoutSlots,
      missingLoadoutBindings,
      mode: holdActive ? 'held' : 'base',
      triggerEvent,
      cueEvent: readMetaString(latestCue?.metadata?.eventName),
      fallbackEvent:
        readMetaString(latestFallback?.metadata?.fromSkinId) && readMetaString(latestFallback?.metadata?.toSkinId)
          ? `${readMetaString(latestFallback?.metadata?.fromSkinId)} -> ${readMetaString(latestFallback?.metadata?.toSkinId)}`
          : null,
      syncedAt: latestSync?.occurredAt || null,
    };
  }, [previewSkin?.sceneProfile, recentEvents]);
  const scenarioCaptures = useMemo(
    () =>
      previewScenarioBundles.map((scenario) => {
        const captureEvents = recentEvents.filter(
          (event) => event.metadata?.previewScenario === scenario.id
        );
        const expectedSceneCue =
          previewSkin?.sceneProfile
            ? resolveCreativeSceneCue(state, scenario.eventName, previewSkin.sceneProfile, previewMode)
            : null;
        const expectedStateBinding =
          previewSkin?.sceneProfile
            ? resolveCreativeSceneStateBinding(state, scenario.eventName, previewSkin.sceneProfile, previewMode)
            : null;
        const expectedSoundCue =
          previewSkin?.soundPackId
            ? resolveCreativeSoundCue(state, scenario.eventName, previewSkin.soundPackId, previewMode)
            : { entry: null, asset: null };
        const semanticEvent = captureEvents.find((event) => event.name === scenario.eventName) || null;
        const sceneCueEvent =
          captureEvents.find((event) => event.name === 'profile.scene.cue.applied') || null;
        const sceneHoldEvent =
          captureEvents.find((event) => event.name === 'profile.scene.state.hold') || null;
        const sceneReleaseEvent =
          captureEvents.find((event) => event.name === 'profile.scene.state.release') || null;
        const audioCueEvent =
          captureEvents.find((event) => event.name === 'presentation.audio.cue.played') || null;
        const lastOccurredAt = captureEvents.reduce<number | null>(
          (latest, event) => (latest === null || event.occurredAt > latest ? event.occurredAt : latest),
          null
        );
        const sceneCueMatched = Boolean(
          expectedSceneCue &&
            sceneCueEvent &&
            readMetaString(sceneCueEvent.metadata?.environmentMode) === expectedSceneCue.environmentMode &&
            readMetaString(sceneCueEvent.metadata?.cameraShot) === expectedSceneCue.cameraShot &&
            readMetaString(sceneCueEvent.metadata?.screenMode) === expectedSceneCue.screenMode &&
            readMetaString(sceneCueEvent.metadata?.transitionStyle) === expectedSceneCue.transitionStyle
        );
        const stateHoldMatched = Boolean(
          expectedStateBinding &&
            sceneHoldEvent &&
            readMetaString(sceneHoldEvent.metadata?.stateKey) === expectedStateBinding.stateKey
        );
        const stateReleaseMatched = Boolean(
          expectedStateBinding &&
            sceneReleaseEvent &&
            readMetaString(sceneReleaseEvent.metadata?.releasedStateKey) === expectedStateBinding.stateKey
        );
        const audioCueMatched = Boolean(
          expectedSoundCue.asset &&
            audioCueEvent &&
            readMetaString(audioCueEvent.metadata?.assetId) === expectedSoundCue.asset.id &&
            readMetaString(audioCueEvent.metadata?.soundPackId) === previewSkin?.soundPackId
        );
        const checks = {
          event: describeScenarioCheck(true, Boolean(semanticEvent), Boolean(semanticEvent)),
          sceneCue: describeScenarioCheck(Boolean(expectedSceneCue), Boolean(sceneCueEvent), sceneCueMatched),
          stateHold: describeScenarioCheck(
            Boolean(expectedStateBinding),
            Boolean(sceneHoldEvent),
            stateHoldMatched
          ),
          stateRelease: describeScenarioCheck(
            Boolean(expectedStateBinding),
            Boolean(sceneReleaseEvent),
            stateReleaseMatched
          ),
          audioCue: describeScenarioCheck(
            Boolean(expectedSoundCue.asset),
            Boolean(audioCueEvent),
            audioCueMatched
          ),
        };
        const isPublishReady = Object.values(checks).every(
          (value) => value === 'match' || value === 'n/a'
        );
        return {
          scenario,
          captureEvents,
          expectedSceneCue,
          expectedStateBinding,
          expectedSoundCue,
          semanticEvent,
          sceneCueEvent,
          sceneHoldEvent,
          sceneReleaseEvent,
          audioCueEvent,
          lastOccurredAt,
          checks,
          isPublishReady,
        };
      }),
    [previewMode, previewSkin?.sceneProfile, previewSkin?.soundPackId, recentEvents, state]
  );
  const scenarioPublishCheck = useMemo(() => {
    const completeCount = scenarioCaptures.filter((entry) => entry.isPublishReady).length;
    return {
      total: scenarioCaptures.length,
      complete: completeCount,
      missing: scenarioCaptures.length - completeCount,
    };
  }, [scenarioCaptures]);
  const previewEventNames = useMemo(() => {
    const names = new Set<string>();
    selectedSceneCues.slice(0, 10).forEach((cue) => names.add(cue.eventName));
    recentEvents.slice(0, 6).forEach((event) => names.add(event.name));
    selectedEventMap.slice(0, 10).forEach((entry) => names.add(entry.eventName));
    return Array.from(names).slice(0, 12);
  }, [recentEvents, selectedEventMap, selectedSceneCues]);

  const handleApplySkin = (skinId: string) => {
    const target = state.skinPacks.find((pack) => pack.id === skinId);
    if (!target) return;
    setSelectedSkinId(skinId);
    if (target.status !== 'published') {
      emitEvent('station.skin.apply.blocked', {
        source: 'admin',
        metadata: {
          skinId: target.id,
          reason: 'draft_only',
        },
      });
      return;
    }
    setActiveSkinId(skinId);
    setTheme(target.theme);
    setAccent(target.accent);
    setActiveThemeId(`creative:${target.id}`);
    setActiveSoundPackId(target.soundPackId);
    emitEvent('station.skin.changed', {
      source: 'admin',
      metadata: {
        skinId: target.id,
        preview: false,
      },
    });
  };

  const handleUploadClick = (eventName: string) => {
    setUploadTargetEvent(eventName);
    uploadInputRef.current?.click();
  };

  const triggerPreviewEvent = (eventName: string, extraMetadata?: Record<string, unknown>) => {
    emitEvent(eventName, {
      source: 'admin',
      metadata: {
        surface: 'creative-ops',
        preview: true,
        previewMode,
        skinId: previewSkin?.id || null,
        previewSceneProfile: previewSkin?.sceneProfile || null,
        previewSoundPackId: previewSkin?.soundPackId || null,
        previewAvatarState,
        previewStageState,
        previewTimeOfDay,
        ...extraMetadata,
      },
    });
  };

  const runPreviewScenario = (
    scenario: (typeof previewScenarioBundles)[number]
  ) => {
    if (previewScenarioTimerRef.current) {
      window.clearTimeout(previewScenarioTimerRef.current);
    }
    setActivePreviewScenarioId(scenario.id);
    setPreviewAvatarState(scenario.avatarState);
    setPreviewStageState(scenario.stageState);
    setPreviewTimeOfDay(scenario.timeOfDay);
    previewScenarioTimerRef.current = window.setTimeout(() => {
      triggerPreviewEvent(scenario.eventName, {
        previewScenario: scenario.id,
      });
    }, 120);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
      <input
        ref={uploadInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          const targetEvent = uploadTargetEvent;
          event.target.value = '';
          if (!file || !targetEvent || !selectedSkin?.soundPackId) return;
          await uploadSoundAssetForEvent(selectedSkin.soundPackId, targetEvent, file);
          setUploadTargetEvent(null);
        }}
      />

      <div className="space-y-4">
        <div className="xt-runtime-console xt-runtime-console--summary">
          <div className="xt-runtime-console-head">
            <div>
              <div className="xt-runtime-console-kicker">Skin Package Summary</div>
              <div className="xt-runtime-console-copy">
                Review the selected package as one publish unit across sound, scene, state, screen, avatar, light, and motion.
              </div>
            </div>
            <div className="xt-runtime-console-indicator">
              {packageSummary?.readyToPublish ? 'publish ready' : packageSummary?.liveSafe ? 'live safe' : 'review'}
            </div>
          </div>

          {packageSummary ? (
            <>
              <div className="xt-runtime-package-strip">
                <div className="xt-runtime-package-strip-head">
                  <div className="xt-runtime-package-title">{packageSummary.skinName}</div>
                  <div className="xt-runtime-package-copy">
                    {describeSkinPackage(selectedSkin)}
                  </div>
                </div>
                <div className="xt-runtime-package-strip-tags">
                  <span className="xt-runtime-relay-tag">{packageSummary.skinStatus}</span>
                  <span className="xt-runtime-relay-tag">{packageSummary.scenePackStatus}</span>
                  <span className="xt-runtime-relay-tag">{packageSummary.liveSafe ? 'live safe' : 'review live'}</span>
                  <span className="xt-runtime-relay-tag">{packageSummary.soundPackId || 'sound missing'}</span>
                </div>
              </div>
              <div className="xt-runtime-summary-grid xt-runtime-summary-grid--package">
                <SummaryCard
                  icon={<Clapperboard size={18} />}
                  label="Statuses"
                  value={`${packageSummary.skinStatus} / ${packageSummary.scenePackStatus}`}
                  detail={`Sound route ${packageSummary.soundPackId || 'missing'} • live ${packageSummary.liveSafe ? 'safe' : 'not safe'}`}
                />
                <SummaryCard
                  icon={<Workflow size={18} />}
                  label="Draft Drift"
                  value={`${packageSummary.totalDiffCount} changes`}
                  detail={`scene ${packageSummary.sceneDiffCount} • state ${packageSummary.stateDiffCount} • avatar ${packageSummary.avatarDiffCount} • screen ${packageSummary.screenDiffCount} • motion ${packageSummary.motionDiffCount}`}
                />
                <SummaryCard
                  icon={<ShieldCheck size={18} />}
                  label="Blockers"
                  value={packageSummary.blockers.length ? `${packageSummary.blockers.length} blockers` : 'None'}
                  detail={
                    packageSummary.blockers.length
                      ? packageSummary.blockers.join(' • ')
                      : 'Draft package has the required authored layers.'
                  }
                />
              </div>
            </>
          ) : null}
        </div>

        <div className={`${sectionCard} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Preview Lab</div>
              <div className="mt-2 text-sm text-[var(--app-muted)]">
                Run semantic XTATION events against the live preview stage. Scene and audio use the same runtime as the station.
              </div>
            </div>
            <div className="xt-runtime-toolbar">
              <button
                type="button"
                onClick={() => setPreviewMode('draft')}
                className={`${panelButton} ${
                  previewMode === 'draft'
                    ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-text)]'
                    : 'border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
                }`}
              >
                Draft Preview
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('published')}
                className={`${panelButton} ${
                  previewMode === 'published'
                    ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-text)]'
                    : 'border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
                }`}
              >
                Published Preview
              </button>
              <div className="xt-runtime-console-indicator">
                {previewMode} skin • {previewSkin?.name || 'none'}
              </div>
              <label className="xt-runtime-field xt-runtime-field--push">
                <span>Avatar State</span>
                <select
                  value={previewAvatarState}
                  onChange={(event) =>
                    setPreviewAvatarState(event.target.value as 'empty' | 'partial' | 'ready')
                  }
                  className="xt-runtime-select"
                >
                  <option value="empty">empty</option>
                  <option value="partial">partial</option>
                  <option value="ready">ready</option>
                </select>
              </label>
              <label className="xt-runtime-field">
                <span>Stage</span>
                <select
                  value={previewStageState}
                  onChange={(event) =>
                    setPreviewStageState(event.target.value as 'idle' | 'productive' | 'active')
                  }
                  className="xt-runtime-select"
                >
                  <option value="idle">idle</option>
                  <option value="productive">productive</option>
                  <option value="active">active</option>
                </select>
              </label>
              <label className="xt-runtime-field">
                <span>Time</span>
                <select
                  value={previewTimeOfDay}
                  onChange={(event) =>
                    setPreviewTimeOfDay(event.target.value as 'day' | 'night')
                  }
                  className="xt-runtime-select"
                >
                  <option value="day">day</option>
                  <option value="night">night</option>
                </select>
              </label>
            </div>
          </div>

          <div className="xt-runtime-director mt-4">
            <div className="xt-runtime-stage-column">
              <div className="xt-runtime-stage-shell">
                <div className="xt-runtime-stage-head">
                  <div className="xt-runtime-package-strip-head">
                    <div className="xt-runtime-console-kicker">Preview Stage</div>
                    <div className="xt-runtime-package-title">{previewSkin?.name || 'No preview skin'}</div>
                    <div className="xt-runtime-package-copy">
                      {previewSkin ? describeSkinPackage(previewSkin) : 'Select or publish a skin package to preview the runtime.'}
                    </div>
                  </div>
                  <div className="xt-runtime-stage-tags">
                    <div className="xt-runtime-console-indicator">{previewMode}</div>
                    <div className="xt-runtime-console-indicator">
                      {previewAvatarPreset?.identityBadge || 'No avatar badge'}
                    </div>
                  </div>
                </div>
                <div className="xt-runtime-package-strip-tags">
                  <span className="xt-runtime-relay-tag">{previewSkin?.theme || theme}</span>
                  <span className="xt-runtime-relay-tag">{previewStageState}</span>
                  <span className="xt-runtime-relay-tag">{previewAvatarState}</span>
                  <span className="xt-runtime-relay-tag">{previewTimeOfDay}</span>
                </div>
                <div className="xt-admin-preview-stage overflow-hidden">
                  <ProfileLobbyScene
                    displayName="XTATION Preview"
                    roleText={
                      previewAvatarPresencePreset?.previewRoleText ||
                      previewAvatarPreset?.previewRoleText ||
                      'Station preview active'
                    }
                    theme={previewSkin?.theme || theme}
                    sceneProfileOverride={previewSkin?.sceneProfile}
                    avatarProfileOverride={previewSkin?.avatarProfile}
                    stageState={previewStageState}
                    timeOfDayOverride={previewTimeOfDay}
                    totalXP={18420}
                    completedToday={6}
                    currentMissionTitle="Preview authored cues"
                    activeSessionLabel={previewSkin ? `${previewSkin.name} runtime` : 'Creative Ops preview'}
                    stationLabel={previewSkin?.name || 'Preview station'}
                    plan={previewMode === 'published' ? 'published-preview' : 'draft-preview'}
                    loadoutOccupancyState={previewAvatarState}
                    occupiedLoadoutSlots={previewOccupiedLoadoutSlots}
                    totalLoadoutSlots={previewTotalLoadoutSlots}
                    missingLoadoutBindings={previewMissingLoadoutBindings}
                    capabilityHighlights={[
                      previewSkin?.sceneProfile ? `${previewSkin.sceneProfile} scene` : 'scene ready',
                      previewSkin?.avatarProfile ? `${previewSkin.avatarProfile} avatar` : 'avatar ready',
                      previewAvatarPreset?.identityBadge || 'identity badge ready',
                      previewSkin?.motionProfile ? `${previewSkin.motionProfile} motion` : 'motion ready',
                      previewSkin?.screenProfile ? `${previewSkin.screenProfile} screens` : 'screen voice ready',
                      settings.unlocks.activeSoundPackId || 'sound route ready',
                    ]}
                  />
                </div>
              </div>

              <div className="xt-runtime-package-grid">
                <div className="xt-runtime-package-card">
                  <div className="xt-runtime-console-kicker">Draft Package</div>
                  <div className="xt-runtime-package-title">{draftPreviewSkin?.name || 'none'}</div>
                  <div className="xt-runtime-package-copy">
                    {describeSkinPackage(draftPreviewSkin)}
                  </div>
                  <div className="xt-runtime-package-badge">
                    {previewMode === 'draft' ? previewAvatarPreset?.identityBadge || 'No avatar badge' : 'Draft preview inactive'}
                  </div>
                </div>
                <div className="xt-runtime-package-card">
                  <div className="xt-runtime-console-kicker">Published Package</div>
                  <div className="xt-runtime-package-title">{publishedPreviewSkin?.name || 'none'}</div>
                  <div className="xt-runtime-package-copy">
                    {describeSkinPackage(publishedPreviewSkin)}
                  </div>
                  <div className="xt-runtime-package-badge">
                    {previewMode === 'published' ? previewAvatarPreset?.identityBadge || 'No avatar badge' : 'Published preview inactive'}
                  </div>
                </div>
              </div>
            </div>

            <div className="xt-runtime-console-stack">
              <div className="xt-runtime-console">
                <div className="xt-runtime-console-head">
                  <div>
                    <div className="xt-runtime-console-kicker">
                      Scenario Bundles
                    </div>
                    <div className="xt-runtime-console-copy">
                      One-click loops for previewing authored lobby behavior.
                    </div>
                  </div>
                  {activePreviewScenarioId ? (
                    <div className="xt-runtime-console-indicator">
                      active • {activePreviewScenarioId}
                    </div>
                  ) : null}
                </div>
                <div className="xt-runtime-console-grid">
                  {previewScenarioBundles.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => runPreviewScenario(scenario)}
                      className={`xt-runtime-scenario-card ${
                        activePreviewScenarioId === scenario.id ? 'is-active' : ''
                      }`}
                    >
                      <div className="xt-runtime-scenario-title">
                        {scenario.label}
                      </div>
                      <div className="xt-runtime-scenario-event">
                        {scenario.eventName}
                      </div>
                      <div className="xt-runtime-scenario-detail">{scenario.detail}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="xt-runtime-console">
                <div className="xt-runtime-console-head">
                  <div>
                    <div className="xt-runtime-console-kicker">
                      Scenario Capture
                    </div>
                    <div className="xt-runtime-console-copy">
                      Preview bundles report what actually fired before you publish.
                    </div>
                  </div>
                  <div className="xt-runtime-console-indicator">
                    checks • {scenarioPublishCheck.complete}/{scenarioPublishCheck.total}
                  </div>
                </div>
                <div className="xt-runtime-console-grid">
                  {scenarioCaptures.map((capture) => (
                    <div
                      key={`${capture.scenario.id}-capture`}
                      className={`xt-runtime-scenario-card xt-runtime-scenario-card--capture ${
                        capture.isPublishReady ? 'is-ready' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="xt-runtime-scenario-title">
                            {capture.scenario.label}
                          </div>
                          <div className="xt-runtime-scenario-event">
                            {capture.scenario.eventName}
                          </div>
                        </div>
                        <div className="xt-runtime-scenario-state">
                          {capture.isPublishReady ? 'ready' : 'review'}
                        </div>
                      </div>
                      <div className="xt-runtime-checklist">
                        <div className={scenarioCheckTone(capture.checks.event)}>event • {capture.checks.event}</div>
                        <div className={scenarioCheckTone(capture.checks.sceneCue)}>scene cue • {capture.checks.sceneCue}</div>
                        <div className={scenarioCheckTone(capture.checks.stateHold)}>state hold • {capture.checks.stateHold}</div>
                        <div className={scenarioCheckTone(capture.checks.stateRelease)}>state release • {capture.checks.stateRelease}</div>
                        <div className={scenarioCheckTone(capture.checks.audioCue)}>audio cue • {capture.checks.audioCue}</div>
                      </div>
                      <div className="xt-runtime-expected">
                        <div>
                          expected cue •{' '}
                          {capture.expectedSceneCue
                            ? [
                                capture.expectedSceneCue.environmentMode || 'inherit',
                                capture.expectedSceneCue.cameraShot || 'inherit',
                                capture.expectedSceneCue.screenMode || 'inherit',
                                capture.expectedSceneCue.transitionStyle,
                              ].join(' / ')
                            : 'none'}
                        </div>
                        <div>
                          expected state •{' '}
                          {capture.expectedStateBinding ? capture.expectedStateBinding.stateKey : 'none'}
                        </div>
                        <div>
                          expected audio •{' '}
                          {capture.expectedSoundCue.asset
                            ? `${capture.expectedSoundCue.asset.name} (${previewSkin?.soundPackId || 'pack'})`
                            : 'none'}
                        </div>
                      </div>
                      <div className="xt-runtime-scenario-time">
                        {capture.lastOccurredAt ? formatDateTime(capture.lastOccurredAt) : 'Awaiting run'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="xt-runtime-console">
                <div className="xt-runtime-console-head">
                  <div>
                    <div className="xt-runtime-console-kicker">Manual Event Triggers</div>
                    <div className="xt-runtime-console-copy">
                      Fire semantic runtime events directly against the current preview package.
                    </div>
                  </div>
                </div>
                <div className="xt-runtime-chip-grid">
                  {previewEventNames.map((eventName) => (
                    <button
                      key={eventName}
                      type="button"
                      onClick={() => triggerPreviewEvent(eventName)}
                      className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                    >
                      {eventName}
                    </button>
                  ))}
                </div>
              </div>

              <div className="xt-runtime-console xt-runtime-console--inline">
                <div>
                  Last live event: <span className="font-semibold text-[var(--app-text)]">{recentEvents[0]?.name || 'none yet'}</span>
                </div>
                <button
                  type="button"
                  onClick={clearEvents}
                  className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-red-400 hover:text-red-200`}
                >
                  Clear Feed
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="xt-runtime-console xt-runtime-console--summary">
          <div className="xt-runtime-console-head">
            <div>
              <div className="xt-runtime-console-kicker">Presentation Runtime</div>
              <div className="xt-runtime-console-copy">
                Semantic XTATION events are the source of truth for scene, audio, motion, and future skin behavior.
              </div>
            </div>
            <div className="xt-runtime-console-indicator">
              scope • {storageScope}
            </div>
          </div>

          <div className="xt-runtime-summary-grid xt-runtime-summary-grid--runtime">
            <SummaryCard
              icon={<Paintbrush2 size={18} />}
              label="Skin Studio"
              value={selectedSkin?.name || 'No skin'}
              detail={selectedSkin ? getCreativeSkinThemeLabel(selectedSkin) : 'Choose a presentation pack to shape the station.'}
            />
            <SummaryCard
              icon={<Clapperboard size={18} />}
              label="Scene Director"
              value={selectedScenePack ? `R${selectedScenePack.draftRevision}` : activeSkin?.sceneProfile.toUpperCase() || 'STANDBY'}
              detail={
                selectedScenePack
                  ? `${selectedScenePack.name} • published R${selectedScenePack.publishedRevision}`
                  : activeSkin
                  ? getCreativeSkinRuntimeLabel(activeSkin)
                  : 'No active scene profile.'
              }
            />
            <SummaryCard
              icon={<Volume2 size={18} />}
              label="Audio Studio"
              value={`${state.soundAssets.length} assets`}
              detail={`${selectedEventMap.filter((entry) => entry.assetId).length} mapped events ready for sound binding. ${soundDraftDeltaCount} draft differences from published.`}
            />
            <SummaryCard
              icon={<Workflow size={18} />}
              label="Live Coverage"
              value={`${recentEvents.length} events`}
              detail={topFamilies.length ? `Top family: ${topFamilies[0].family}` : 'Open XTATION surfaces to populate the event feed.'}
            />
            <SummaryCard
              icon={<ShieldCheck size={18} />}
              label="Scene Runtime"
              value={runtimeSceneState.stateKey}
              detail={
                runtimeSceneState.sceneProfile
                  ? `${runtimeSceneState.sceneProfile} • ${runtimeSceneState.screenMode} • ${runtimeSceneState.mode} • ${runtimeSceneState.triggerEvent || 'ambient/base'}`
                  : 'Open Profile or Preview Lab to hydrate live scene state.'
              }
            />
          </div>
        </div>

        <div className={`${sectionCard} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Skin Studio</div>
              <div className="mt-2 text-sm text-[var(--app-muted)]">
                Publish the feel of XTATION without touching logic. Users consume skins. Admin authors them.
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
              current station • {theme} / {accent}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {state.skinPacks.map((pack) => {
              const selected = selectedSkin?.id === pack.id;
              const active = activeSkin?.id === pack.id;
              return (
                <div
                  key={pack.id}
                  className={`xt-creative-card ${selected ? 'xt-creative-card--selected' : ''}`}
                >
                  <div className="xt-creative-card-head">
                    <div className="min-w-0">
                      <div className="xt-creative-card-title">{pack.name}</div>
                      <div className="xt-creative-card-kicker">
                        {getCreativeSkinThemeLabel(pack)} • {pack.status}
                      </div>
                      <div className="xt-creative-card-copy">{pack.description}</div>
                      <div className="xt-creative-card-runtime">{getCreativeSkinRuntimeLabel(pack)}</div>
                  <div className="xt-creative-field-grid">
                    <label className="xt-creative-field">
                      Motion Profile
                      <select
                        value={pack.motionProfile}
                        onChange={(event) =>
                          updateSkinMotionProfile(pack.id, event.target.value as typeof pack.motionProfile)
                        }
                        className="xt-creative-select"
                      >
                        <option value="calm">calm</option>
                        <option value="sharp">sharp</option>
                        <option value="cinematic">cinematic</option>
                      </select>
                    </label>
                    <label className="xt-creative-field">
                      Screen Profile
                      <select
                        value={pack.screenProfile}
                        onChange={(event) =>
                          updateSkinScreenProfile(pack.id, event.target.value as typeof pack.screenProfile)
                        }
                        className="xt-creative-select"
                      >
                        <option value="bureau">bureau</option>
                        <option value="void">void</option>
                        <option value="ops">ops</option>
                      </select>
                    </label>
                    <label className="xt-creative-field">
                      Avatar Profile
                      <select
                        value={pack.avatarProfile}
                        onChange={(event) =>
                          updateSkinAvatarProfile(pack.id, event.target.value as typeof pack.avatarProfile)
                        }
                        className="xt-creative-select"
                      >
                        <option value="station">station</option>
                        <option value="ops">ops</option>
                        <option value="minimal">minimal</option>
                      </select>
                    </label>
                  </div>
                  <div className="xt-creative-action-row">
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => applySkinMotionProfileTemplate(pack.id)}
                        className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                      >
                        Apply Motion Pack
                      </button>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => applySkinScreenProfileTemplate(pack.id)}
                        className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                      >
                        Apply Screen Pack
                      </button>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => applySkinAvatarProfileTemplate(pack.id)}
                        className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                      >
                        Apply Avatar Pack
                      </button>
                    </div>
                  </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSkinId(pack.id)}
                        className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                      >
                        Inspect
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplySkin(pack.id)}
                        disabled={pack.status !== 'published'}
                        className={`${panelButton} border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-text)] disabled:cursor-not-allowed disabled:border-[var(--app-border)] disabled:bg-transparent disabled:text-[var(--app-muted)]`}
                      >
                        {pack.status === 'published' ? 'Apply' : 'Draft Only'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSkinStatus(pack.id, pack.status === 'published' ? 'draft' : 'published')}
                        className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                      >
                        {pack.status === 'published' ? 'Set Draft' : 'Publish'}
                      </button>
                    </div>
                  </div>

                  <div className="xt-creative-tag-row">
                    {active ? (
                      <span className="xt-creative-tag xt-creative-tag--accent">active skin</span>
                    ) : null}
                    {selected ? (
                      <span className="xt-creative-tag">selected</span>
                    ) : null}
                    {settings.unlocks.activeThemeId === `creative:${pack.id}` ? (
                      <span className="xt-creative-tag">applied to station</span>
                    ) : null}
                    {active && pack.status !== 'published' ? (
                      <span className="xt-creative-tag xt-creative-tag--warn">fallback enforced</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="xt-creative-note">
            {activeStationMatchesSkin ? (
              <>
                <span className="font-semibold text-[var(--app-text)]">Station aligned.</span> XTATION is rendering through the selected published pack.
              </>
            ) : (
              <>
                <span className="font-semibold text-[var(--app-text)]">Station diverges.</span> Apply the active skin to realign theme, accent, and sound routing.
              </>
            )}
          </div>
        </div>

        <div className={`${sectionCard} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Scene Director</div>
              <div className="mt-2 text-sm text-[var(--app-muted)]">
                Author temporary camera, light, and motion responses for semantic XTATION events. Cues override the scene briefly and then return to the base profile state.
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
              {selectedSceneCues.filter((cue) => cue.environmentMode || cue.cameraShot || cue.beatPulse || cue.ringPulse || cue.groundMotion).length} active cues
            </div>
          </div>

          {selectedScenePack ? (
            <div className="mt-4 rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[var(--app-text)]">{selectedScenePack.name}</div>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    {selectedScenePack.sceneProfile} • {selectedScenePack.status} • draft R{selectedScenePack.draftRevision} • published R{selectedScenePack.publishedRevision}
                  </div>
                  <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">{selectedScenePack.description}</div>
                  <div className="mt-3 text-xs leading-5 text-[var(--app-muted)]">
                    Last published: {formatDateTime(selectedScenePack.lastPublishedAt)}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                    Draft vs published: <span className="font-semibold text-[var(--app-text)]">{sceneDraftDeltaCount} cue changes</span>
                    {' • '}
                    <span className="font-semibold text-[var(--app-text)]">{sceneStateDraftDifferences.length} state changes</span>
                    {' • '}
                    <span className="font-semibold text-[var(--app-text)]">{sceneResponsePresetDraftDifferences.length} response preset changes</span>
                    {' • '}
                    <span className="font-semibold text-[var(--app-text)]">{sceneScreenPresetDraftDifferences.length} screen preset changes</span>
                    {' • '}
                    <span className="font-semibold text-[var(--app-text)]">{sceneStateBindingDraftDifferences.length} trigger changes</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => restorePublishedScenePack(selectedScenePack.sceneProfile)}
                    disabled={selectedPublishedSceneCues.length === 0}
                    className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    Restore Published
                  </button>
                  <button
                    type="button"
                    onClick={() => setScenePackDraft(selectedScenePack.sceneProfile)}
                    className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                  >
                    Set Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => publishScenePack(selectedScenePack.sceneProfile)}
                    className={`${panelButton} border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-text)]`}
                  >
                    Publish Scene Pack
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {selectedSceneStates.map((sceneState) => (
              <div
                key={`${sceneState.sceneProfile}:${sceneState.stateKey}`}
                className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--app-text)]">{sceneState.stateKey}</div>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      {sceneState.environmentMode || 'inherit'} • {sceneState.cameraShot || 'inherit'} • {sceneState.screenMode} • orbit {sceneState.cameraOrbitSpeed ?? 0} • atmosphere {sceneState.ambientAtmosphere.toFixed(2)} • key {sceneState.lightRig?.keyIntensity?.toFixed(2) ?? '0.00'} • fill {sceneState.lightRig?.fillIntensity?.toFixed(2) ?? '0.00'}
                      </div>
                    </div>
                  <button
                    type="button"
                    onClick={() => emitEvent('profile.scene.sync', {
                      source: 'admin',
                      metadata: {
                        preview: true,
                        surface: 'creative-ops',
                        skinId: previewSkin?.id || null,
                        previewSceneProfile: previewSkin?.sceneProfile || null,
                        previewSoundPackId: previewSkin?.soundPackId || null,
                      },
                    })}
                    className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                  >
                    Preview State
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[140px_120px_120px_110px_110px_1fr]">
                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Environment
                    <select
                      value={sceneState.environmentMode || 'inherit'}
                      onChange={(event) =>
                        updateSceneStateEntry(sceneState.sceneProfile, sceneState.stateKey, {
                          environmentMode:
                            event.target.value === 'inherit'
                              ? null
                              : (event.target.value as Exclude<(typeof environmentOptions)[number], 'inherit'>),
                        })
                      }
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                    >
                      {environmentOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Camera
                    <select
                      value={sceneState.cameraShot || 'inherit'}
                      onChange={(event) =>
                        updateSceneStateEntry(sceneState.sceneProfile, sceneState.stateKey, {
                          cameraShot:
                            event.target.value === 'inherit'
                              ? null
                              : (event.target.value as Exclude<(typeof cameraOptions)[number], 'inherit'>),
                        })
                      }
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                    >
                      {cameraOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Screen
                    <select
                      value={sceneState.screenMode}
                      onChange={(event) =>
                        updateSceneStateEntry(sceneState.sceneProfile, sceneState.stateKey, {
                          screenMode: event.target.value as (typeof screenModeOptions)[number],
                        })
                      }
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                    >
                      {screenModeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Atmosphere
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={sceneState.ambientAtmosphere}
                      onChange={(event) =>
                        updateSceneStateEntry(sceneState.sceneProfile, sceneState.stateKey, {
                          ambientAtmosphere: Math.min(1, Math.max(0, Number(event.target.value) || 0)),
                        })
                      }
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Orbit
                    <input
                      type="number"
                      min={0}
                      max={2.5}
                      step={0.01}
                      value={sceneState.cameraOrbitSpeed ?? 0}
                      onChange={(event) =>
                        updateSceneStateEntry(sceneState.sceneProfile, sceneState.stateKey, {
                          cameraOrbitSpeed: Math.min(2.5, Math.max(0, Number(event.target.value) || 0)),
                        })
                      }
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                    />
                  </label>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      { key: 'beatPulse', label: 'Beat Pulse', checked: sceneState.beatPulse },
                      { key: 'ringPulse', label: 'Ring Pulse', checked: sceneState.ringPulse },
                      { key: 'groundMotion', label: 'Ground Motion', checked: sceneState.groundMotion },
                      { key: 'modelFloat', label: 'Model Float', checked: sceneState.modelFloat },
                      { key: 'hideLightSource', label: 'Hide Light', checked: sceneState.hideLightSource },
                    ].map((toggle) => (
                      <label
                        key={`${sceneState.stateKey}:${toggle.key}`}
                        className="flex items-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--app-text)]"
                      >
                        <input
                          type="checkbox"
                          checked={toggle.checked}
                          onChange={(event) =>
                            updateSceneStateEntry(sceneState.sceneProfile, sceneState.stateKey, {
                              [toggle.key]: event.target.checked,
                            })
                          }
                        />
                        <span>{toggle.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-[110px_110px_120px_120px]">
                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Key Light
                    <input
                      type="number"
                      min={0}
                      max={3}
                      step={0.01}
                      value={sceneState.lightRig?.keyIntensity ?? 0}
                      onChange={(event) =>
                        updateSceneStateEntry(sceneState.sceneProfile, sceneState.stateKey, {
                          lightRig: {
                            ...sceneState.lightRig,
                            keyIntensity: Math.min(3, Math.max(0, Number(event.target.value) || 0)),
                            fillIntensity: sceneState.lightRig?.fillIntensity ?? 0,
                            keyColor: sceneState.lightRig?.keyColor ?? '#ffffff',
                            fillColor: sceneState.lightRig?.fillColor ?? '#ffffff',
                          },
                        })
                      }
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Fill Light
                    <input
                      type="number"
                      min={0}
                      max={3}
                      step={0.01}
                      value={sceneState.lightRig?.fillIntensity ?? 0}
                      onChange={(event) =>
                        updateSceneStateEntry(sceneState.sceneProfile, sceneState.stateKey, {
                          lightRig: {
                            ...sceneState.lightRig,
                            keyIntensity: sceneState.lightRig?.keyIntensity ?? 0,
                            fillIntensity: Math.min(3, Math.max(0, Number(event.target.value) || 0)),
                            keyColor: sceneState.lightRig?.keyColor ?? '#ffffff',
                            fillColor: sceneState.lightRig?.fillColor ?? '#ffffff',
                          },
                        })
                      }
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Key Color
                    <input
                      type="color"
                      value={sceneState.lightRig?.keyColor ?? '#ffffff'}
                      onChange={(event) =>
                        updateSceneStateEntry(sceneState.sceneProfile, sceneState.stateKey, {
                          lightRig: {
                            ...sceneState.lightRig,
                            keyIntensity: sceneState.lightRig?.keyIntensity ?? 0,
                            fillIntensity: sceneState.lightRig?.fillIntensity ?? 0,
                            keyColor: event.target.value,
                            fillColor: sceneState.lightRig?.fillColor ?? '#ffffff',
                          },
                        })
                      }
                      className="h-11 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Fill Color
                    <input
                      type="color"
                      value={sceneState.lightRig?.fillColor ?? '#ffffff'}
                      onChange={(event) =>
                        updateSceneStateEntry(sceneState.sceneProfile, sceneState.stateKey, {
                          lightRig: {
                            ...sceneState.lightRig,
                            keyIntensity: sceneState.lightRig?.keyIntensity ?? 0,
                            fillIntensity: sceneState.lightRig?.fillIntensity ?? 0,
                            keyColor: sceneState.lightRig?.keyColor ?? '#ffffff',
                            fillColor: event.target.value,
                          },
                        })
                      }
                      className="h-11 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-2"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Light Presets</div>
              <div className="text-xs text-[var(--app-muted)]">
                {selectedSceneLightPresets.length} presets • {sceneLightPresetDraftDifferences.length} draft changes
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {selectedSceneLightPresets.map((preset) => {
                const canApplyToStates = ['day', 'night', 'focus', 'active'].includes(preset.presetKey);
                const canApplyToResponses = ['focus', 'brief', 'reward', 'alert'].includes(preset.presetKey);
                return (
                  <div
                    key={`${preset.sceneProfile}:${preset.presetKey}`}
                    className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--app-text)]">{preset.presetKey}</div>
                        <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                          key {preset.lightRig.keyIntensity.toFixed(2)} • fill {preset.lightRig.fillIntensity.toFixed(2)} • {preset.lightRig.keyColor} • {preset.lightRig.fillColor}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canApplyToStates ? (
                          <button
                            type="button"
                            onClick={() => applySceneLightPresetToStatesForProfile(preset.sceneProfile, preset.presetKey)}
                            className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                          >
                            Apply To States
                          </button>
                        ) : null}
                        {canApplyToResponses ? (
                          <button
                            type="button"
                            onClick={() => applySceneLightPresetToResponsesForProfile(preset.sceneProfile, preset.presetKey)}
                            className={`${panelButton} border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-text)]`}
                          >
                            Apply To Responses
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-[110px_110px_120px_120px]">
                      <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        Key Light
                        <input
                          type="number"
                          min={0}
                          max={3}
                          step={0.01}
                          value={preset.lightRig.keyIntensity}
                          onChange={(event) =>
                            updateSceneLightPreset(preset.sceneProfile, preset.presetKey, {
                              lightRig: {
                                ...preset.lightRig,
                                keyIntensity: Math.min(3, Math.max(0, Number(event.target.value) || 0)),
                              },
                            })
                          }
                          className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        Fill Light
                        <input
                          type="number"
                          min={0}
                          max={3}
                          step={0.01}
                          value={preset.lightRig.fillIntensity}
                          onChange={(event) =>
                            updateSceneLightPreset(preset.sceneProfile, preset.presetKey, {
                              lightRig: {
                                ...preset.lightRig,
                                fillIntensity: Math.min(3, Math.max(0, Number(event.target.value) || 0)),
                              },
                            })
                          }
                          className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        Key Color
                        <input
                          type="color"
                          value={preset.lightRig.keyColor}
                          onChange={(event) =>
                            updateSceneLightPreset(preset.sceneProfile, preset.presetKey, {
                              lightRig: {
                                ...preset.lightRig,
                                keyColor: event.target.value,
                              },
                            })
                          }
                          className="h-11 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-2"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        Fill Color
                        <input
                          type="color"
                          value={preset.lightRig.fillColor}
                          onChange={(event) =>
                            updateSceneLightPreset(preset.sceneProfile, preset.presetKey, {
                              lightRig: {
                                ...preset.lightRig,
                                fillColor: event.target.value,
                              },
                            })
                          }
                          className="h-11 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-2"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Motion Presets</div>
              <div className="text-xs text-[var(--app-muted)]">
                {selectedSceneMotionPresets.length} presets • {sceneMotionPresetDraftDifferences.length} draft changes
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {selectedSceneMotionPresets.map((preset) => {
                const canApplyToStates = ['day', 'night', 'focus', 'active'].includes(preset.presetKey);
                const canApplyToResponses = ['focus', 'brief', 'reward', 'alert'].includes(preset.presetKey);
                return (
                  <div
                    key={`${preset.sceneProfile}:${preset.presetKey}`}
                    className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--app-text)]">{preset.presetKey}</div>
                        <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                          {preset.transitionStyle} • orbit {preset.cameraOrbitSpeed ?? 0} • {preset.cueDurationMs}ms
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canApplyToStates ? (
                          <button
                            type="button"
                            onClick={() => applySceneMotionPresetToStatesForProfile(preset.sceneProfile, preset.presetKey)}
                            className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                          >
                            Apply To States
                          </button>
                        ) : null}
                        {canApplyToResponses ? (
                          <button
                            type="button"
                            onClick={() =>
                              applySceneMotionPresetToResponsesForProfile(preset.sceneProfile, preset.presetKey)
                            }
                            className={`${panelButton} border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-text)]`}
                          >
                            Apply To Responses
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-[140px_120px_120px]">
                      <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        Transition
                        <select
                          value={preset.transitionStyle}
                          onChange={(event) =>
                            updateSceneMotionPreset(preset.sceneProfile, preset.presetKey, {
                              transitionStyle: event.target.value as (typeof transitionOptions)[number],
                            })
                          }
                          className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                        >
                          {transitionOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        Orbit
                        <input
                          type="number"
                          min={0}
                          max={2.5}
                          step={0.01}
                          value={preset.cameraOrbitSpeed ?? 0}
                          onChange={(event) =>
                            updateSceneMotionPreset(preset.sceneProfile, preset.presetKey, {
                              cameraOrbitSpeed: Math.min(2.5, Math.max(0, Number(event.target.value) || 0)),
                            })
                          }
                          className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                        />
                      </label>

                      <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        Duration
                        <input
                          type="number"
                          min={300}
                          max={8000}
                          step={100}
                          value={preset.cueDurationMs}
                          onChange={(event) =>
                            updateSceneMotionPreset(preset.sceneProfile, preset.presetKey, {
                              cueDurationMs: Math.min(8000, Math.max(300, Number(event.target.value) || 0)),
                            })
                          }
                          className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Response Presets</div>
              <div className="text-xs text-[var(--app-muted)]">
                {selectedSceneResponsePresets.length} presets • {sceneResponsePresetDraftDifferences.length} draft changes
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {selectedSceneResponsePresets.map((preset) => (
                <div
                  key={`${preset.sceneProfile}:${preset.responseType}`}
                  className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--app-text)]">{preset.responseType}</div>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        {preset.environmentMode || 'inherit'} • {preset.cameraShot || 'inherit'} • {preset.screenMode} • {preset.transitionStyle} • {preset.targetStateKey} • key {preset.lightRig?.keyIntensity?.toFixed(2) ?? '0.00'} • fill {preset.lightRig?.fillIntensity?.toFixed(2) ?? '0.00'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => triggerPreviewEvent(responsePreviewEventMap[preset.responseType])}
                        className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                      >
                        <Play size={13} className="mr-1.5" />
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => applySceneResponsePreset(preset.sceneProfile, preset.responseType)}
                        className={`${panelButton} border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-text)]`}
                      >
                        Apply To Events
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[140px_120px_120px_120px_1fr]">
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Environment
                      <select
                        value={preset.environmentMode || 'inherit'}
                        onChange={(event) =>
                          updateSceneResponsePreset(preset.sceneProfile, preset.responseType, {
                            environmentMode:
                              event.target.value === 'inherit'
                                ? null
                                : (event.target.value as Exclude<(typeof environmentOptions)[number], 'inherit'>),
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      >
                        {environmentOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Camera
                      <select
                        value={preset.cameraShot || 'inherit'}
                        onChange={(event) =>
                          updateSceneResponsePreset(preset.sceneProfile, preset.responseType, {
                            cameraShot:
                              event.target.value === 'inherit'
                                ? null
                                : (event.target.value as Exclude<(typeof cameraOptions)[number], 'inherit'>),
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      >
                        {cameraOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Screen
                      <select
                        value={preset.screenMode}
                        onChange={(event) =>
                          updateSceneResponsePreset(preset.sceneProfile, preset.responseType, {
                            screenMode: event.target.value as (typeof screenModeOptions)[number],
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      >
                        {screenModeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Transition
                      <select
                        value={preset.transitionStyle}
                        onChange={(event) =>
                          updateSceneResponsePreset(preset.sceneProfile, preset.responseType, {
                            transitionStyle: event.target.value as (typeof transitionOptions)[number],
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      >
                        {transitionOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Target State
                      <select
                        value={preset.targetStateKey}
                        onChange={(event) =>
                          updateSceneResponsePreset(preset.sceneProfile, preset.responseType, {
                            targetStateKey: event.target.value as typeof preset.targetStateKey,
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      >
                        {selectedSceneStates.map((sceneState) => (
                          <option key={sceneState.stateKey} value={sceneState.stateKey}>
                            {sceneState.stateKey}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[110px_110px_130px_1fr]">
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Hold
                      <input
                        type="number"
                        min={500}
                        max={60000}
                        step={100}
                        value={preset.holdMs}
                        onChange={(event) =>
                          updateSceneResponsePreset(preset.sceneProfile, preset.responseType, {
                            holdMs: Math.min(60000, Math.max(500, Number(event.target.value) || 500)),
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Duration
                      <input
                        type="number"
                        min={300}
                        max={8000}
                        step={100}
                        value={preset.cueDurationMs}
                        onChange={(event) =>
                          updateSceneResponsePreset(preset.sceneProfile, preset.responseType, {
                            cueDurationMs: Math.min(8000, Math.max(300, Number(event.target.value) || 300)),
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Orbit
                      <input
                        type="number"
                        min={0}
                        max={2.5}
                        step={0.01}
                        value={preset.cameraOrbitSpeed ?? 0}
                        onChange={(event) =>
                          updateSceneResponsePreset(preset.sceneProfile, preset.responseType, {
                            cameraOrbitSpeed: Math.min(2.5, Math.max(0, Number(event.target.value) || 0)),
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Key Light
                      <input
                        type="number"
                        min={0}
                        max={3}
                        step={0.01}
                        value={preset.lightRig?.keyIntensity ?? 0}
                        onChange={(event) =>
                          updateSceneResponsePreset(preset.sceneProfile, preset.responseType, {
                            lightRig: {
                              ...preset.lightRig,
                              keyIntensity: Math.min(3, Math.max(0, Number(event.target.value) || 0)),
                              fillIntensity: preset.lightRig?.fillIntensity ?? 0,
                              keyColor: preset.lightRig?.keyColor ?? '#ffffff',
                              fillColor: preset.lightRig?.fillColor ?? '#ffffff',
                            },
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Fill Light
                      <input
                        type="number"
                        min={0}
                        max={3}
                        step={0.01}
                        value={preset.lightRig?.fillIntensity ?? 0}
                        onChange={(event) =>
                          updateSceneResponsePreset(preset.sceneProfile, preset.responseType, {
                            lightRig: {
                              ...preset.lightRig,
                              keyIntensity: preset.lightRig?.keyIntensity ?? 0,
                              fillIntensity: Math.min(3, Math.max(0, Number(event.target.value) || 0)),
                              keyColor: preset.lightRig?.keyColor ?? '#ffffff',
                              fillColor: preset.lightRig?.fillColor ?? '#ffffff',
                            },
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        { key: 'beatPulse', label: 'Beat Pulse', checked: preset.beatPulse },
                        { key: 'ringPulse', label: 'Ring Pulse', checked: preset.ringPulse },
                        { key: 'groundMotion', label: 'Ground Motion', checked: preset.groundMotion },
                      ].map((toggle) => (
                        <label
                          key={`${preset.responseType}:${toggle.key}`}
                          className="flex items-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--app-text)]"
                        >
                          <input
                            type="checkbox"
                            checked={toggle.checked}
                            onChange={(event) =>
                              updateSceneResponsePreset(preset.sceneProfile, preset.responseType, {
                                [toggle.key]: event.target.checked,
                              })
                            }
                          />
                          <span>{toggle.label}</span>
                        </label>
                      ))}
                      <label className="flex items-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--app-text)]">
                        <span>Atmosphere</span>
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          value={preset.ambientAtmosphere}
                          onChange={(event) =>
                            updateSceneResponsePreset(preset.sceneProfile, preset.responseType, {
                              ambientAtmosphere: Math.min(1, Math.max(0, Number(event.target.value) || 0)),
                            })
                          }
                          className="ml-auto w-16 rounded-xl border border-[var(--app-border)] bg-transparent px-2 py-1 text-right text-xs outline-none"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[140px_140px]">
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Key Color
                      <input
                        type="color"
                        value={preset.lightRig?.keyColor ?? '#ffffff'}
                        onChange={(event) =>
                          updateSceneResponsePreset(preset.sceneProfile, preset.responseType, {
                            lightRig: {
                              ...preset.lightRig,
                              keyIntensity: preset.lightRig?.keyIntensity ?? 0,
                              fillIntensity: preset.lightRig?.fillIntensity ?? 0,
                              keyColor: event.target.value,
                              fillColor: preset.lightRig?.fillColor ?? '#ffffff',
                            },
                          })
                        }
                        className="h-11 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Fill Color
                      <input
                        type="color"
                        value={preset.lightRig?.fillColor ?? '#ffffff'}
                        onChange={(event) =>
                          updateSceneResponsePreset(preset.sceneProfile, preset.responseType, {
                            lightRig: {
                              ...preset.lightRig,
                              keyIntensity: preset.lightRig?.keyIntensity ?? 0,
                              fillIntensity: preset.lightRig?.fillIntensity ?? 0,
                              keyColor: preset.lightRig?.keyColor ?? '#ffffff',
                              fillColor: event.target.value,
                            },
                          })
                        }
                        className="h-11 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-2"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Screen Presets</div>
              <div className="text-xs text-[var(--app-muted)]">
                {selectedSceneScreenPresets.length} modes • {sceneScreenPresetDraftDifferences.length} draft changes
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {selectedSceneScreenPresets.map((preset) => (
                <div
                  key={`${preset.sceneProfile}:${preset.mode}`}
                  className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--app-text)]">{preset.mode}</div>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        {preset.missionLabel} • {preset.roleLabel} • {preset.traceLabel}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerPreviewEvent(`profile.scene.sync`)}
                      className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                    >
                      Refresh Preview
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Mission Label
                      <input
                        type="text"
                        value={preset.missionLabel}
                        onChange={(event) =>
                          updateSceneScreenPreset(preset.sceneProfile, preset.mode, {
                            missionLabel: event.target.value.toUpperCase().slice(0, 18),
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Role Label
                      <input
                        type="text"
                        value={preset.roleLabel}
                        onChange={(event) =>
                          updateSceneScreenPreset(preset.sceneProfile, preset.mode, {
                            roleLabel: event.target.value.toUpperCase().slice(0, 18),
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Trace Label
                      <input
                        type="text"
                        value={preset.traceLabel}
                        onChange={(event) =>
                          updateSceneScreenPreset(preset.sceneProfile, preset.mode, {
                            traceLabel: event.target.value.toUpperCase().slice(0, 18),
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3">
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Fallback Mission Text
                      <textarea
                        value={preset.fallbackMissionText}
                        onChange={(event) =>
                          updateSceneScreenPreset(preset.sceneProfile, preset.mode, {
                            fallbackMissionText: event.target.value,
                          })
                        }
                        rows={3}
                        className="rounded-[20px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Fallback Role Text
                      <input
                        type="text"
                        value={preset.fallbackRoleText}
                        onChange={(event) =>
                          updateSceneScreenPreset(preset.sceneProfile, preset.mode, {
                            fallbackRoleText: event.target.value,
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Avatar Packs</div>
              <div className="text-xs text-[var(--app-muted)]">
                {selectedSceneAvatarPresets.length} authored presets • {sceneAvatarPresetDraftDifferences.length} draft changes
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {selectedSceneAvatarPresets.map((preset) => (
                <div
                  key={`${preset.sceneProfile}:${preset.avatarProfile}`}
                  className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--app-text)]">{preset.avatarProfile}</div>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        {preset.identityBadge} • {preset.shellLabel} • {preset.relayLabel}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerPreviewEvent('profile.scene.sync')}
                      className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                    >
                      Refresh Preview
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Shell Label
                      <input
                        type="text"
                        value={preset.shellLabel}
                        onChange={(event) =>
                          updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                            shellLabel: event.target.value,
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Identity Badge
                      <input
                        type="text"
                        value={preset.identityBadge}
                        onChange={(event) =>
                          updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                            identityBadge: event.target.value,
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Relay Label
                      <input
                        type="text"
                        value={preset.relayLabel}
                        onChange={(event) =>
                          updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                            relayLabel: event.target.value,
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Status Label
                      <input
                        type="text"
                        value={preset.statusLabel}
                        onChange={(event) =>
                          updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                            statusLabel: event.target.value,
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Loadout Title
                      <input
                        type="text"
                        value={preset.loadoutTitle}
                        onChange={(event) =>
                          updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                            loadoutTitle: event.target.value,
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Capability Label
                      <input
                        type="text"
                        value={preset.capabilityLabel}
                        onChange={(event) =>
                          updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                            capabilityLabel: event.target.value,
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Role Fallback
                      <input
                        type="text"
                        value={preset.roleFallbackText}
                        onChange={(event) =>
                          updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                            roleFallbackText: event.target.value,
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Preview Role
                      <input
                        type="text"
                        value={preset.previewRoleText}
                        onChange={(event) =>
                          updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                            previewRoleText: event.target.value,
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Deck Prompt
                      <textarea
                        rows={3}
                        value={preset.deckPrompt}
                        onChange={(event) =>
                          updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                            deckPrompt: event.target.value,
                          })
                        }
                        className="rounded-[20px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Loadout Description
                      <textarea
                        rows={3}
                        value={preset.loadoutDescription}
                        onChange={(event) =>
                          updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                            loadoutDescription: event.target.value,
                          })
                        }
                        className="rounded-[20px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <div className="rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_88%,transparent)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                          Presence States
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-accent)]">
                          {preset.presencePresets.length} states
                        </div>
                      </div>
                      <div className="mt-3 space-y-3">
                        {preset.presencePresets.map((presencePreset, presenceIndex) => (
                          <div
                            key={`${preset.sceneProfile}:${preset.avatarProfile}:${presencePreset.state}`}
                            className="rounded-[16px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.02)] p-3"
                          >
                            <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--app-accent)]">
                              {presencePreset.state}
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <label className="flex flex-col gap-1 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                Presence Label
                                <input
                                  type="text"
                                  value={presencePreset.label}
                                  onChange={(event) =>
                                    updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                                      presencePresets: preset.presencePresets.map((entry, entryIndex) =>
                                        entryIndex === presenceIndex
                                          ? { ...entry, label: event.target.value }
                                          : entry
                                      ),
                                    })
                                  }
                                  className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                Status Label
                                <input
                                  type="text"
                                  value={presencePreset.statusLabel}
                                  onChange={(event) =>
                                    updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                                      presencePresets: preset.presencePresets.map((entry, entryIndex) =>
                                        entryIndex === presenceIndex
                                          ? { ...entry, statusLabel: event.target.value }
                                          : entry
                                      ),
                                    })
                                  }
                                  className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                Role Fallback
                                <input
                                  type="text"
                                  value={presencePreset.roleFallbackText}
                                  onChange={(event) =>
                                    updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                                      presencePresets: preset.presencePresets.map((entry, entryIndex) =>
                                        entryIndex === presenceIndex
                                          ? { ...entry, roleFallbackText: event.target.value }
                                          : entry
                                      ),
                                    })
                                  }
                                  className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                Preview Role
                                <input
                                  type="text"
                                  value={presencePreset.previewRoleText}
                                  onChange={(event) =>
                                    updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                                      presencePresets: preset.presencePresets.map((entry, entryIndex) =>
                                        entryIndex === presenceIndex
                                          ? { ...entry, previewRoleText: event.target.value }
                                          : entry
                                      ),
                                    })
                                  }
                                  className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                Scene State
                                <select
                                  value={presencePreset.sceneStateOverride || ''}
                                  onChange={(event) =>
                                    updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                                      presencePresets: preset.presencePresets.map((entry, entryIndex) =>
                                        entryIndex === presenceIndex
                                          ? {
                                              ...entry,
                                              sceneStateOverride: event.target.value
                                                ? (event.target.value as typeof entry.sceneStateOverride)
                                                : null,
                                            }
                                          : entry
                                      ),
                                    })
                                  }
                                  className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                                >
                                  <option value="">inherit</option>
                                  <option value="profile.day">profile.day</option>
                                  <option value="profile.night">profile.night</option>
                                  <option value="profile.focus">profile.focus</option>
                                  <option value="profile.active">profile.active</option>
                                </select>
                              </label>
                              <label className="flex flex-col gap-1 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                                Screen Mode
                                <select
                                  value={presencePreset.screenModeOverride || ''}
                                  onChange={(event) =>
                                    updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                                      presencePresets: preset.presencePresets.map((entry, entryIndex) =>
                                        entryIndex === presenceIndex
                                          ? {
                                              ...entry,
                                              screenModeOverride: event.target.value
                                                ? (event.target.value as typeof entry.screenModeOverride)
                                                : null,
                                            }
                                          : entry
                                      ),
                                    })
                                  }
                                  className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                                >
                                  <option value="">inherit</option>
                                  <option value="base">base</option>
                                  <option value="focus">focus</option>
                                  <option value="brief">brief</option>
                                  <option value="urgent">urgent</option>
                                  <option value="success">success</option>
                                </select>
                              </label>
                            </div>
                            <label className="mt-3 flex flex-col gap-1 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                              Deck Prompt
                              <textarea
                                rows={2}
                                value={presencePreset.deckPrompt}
                                onChange={(event) =>
                                  updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                                    presencePresets: preset.presencePresets.map((entry, entryIndex) =>
                                      entryIndex === presenceIndex
                                        ? { ...entry, deckPrompt: event.target.value }
                                        : entry
                                    ),
                                  })
                                }
                                className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_88%,transparent)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                          Loadout Slots
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-accent)]">
                          {preset.loadoutSlots.length} slots
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {preset.loadoutSlots.map((slot, slotIndex) => (
                          <div
                            key={slot.id}
                            className="grid gap-2 rounded-[16px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.02)] p-3 md:grid-cols-[minmax(0,1fr)_90px_110px_110px_84px]"
                          >
                            <div>
                              <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                                Slot {slotIndex + 1}
                              </div>
                              <div className="mt-1 truncate text-[11px] text-[var(--app-text)]">{slot.id}</div>
                            </div>
                            <label className="flex flex-col gap-1 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                              Icon
                              <input
                                type="text"
                                value={slot.icon}
                                onChange={(event) =>
                                  updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                                    loadoutSlots: preset.loadoutSlots.map((entry, entryIndex) =>
                                      entryIndex === slotIndex
                                        ? {
                                            ...entry,
                                            icon: event.target.value,
                                          }
                                        : entry
                                    ),
                                  })
                                }
                                className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                              Label
                              <input
                                type="text"
                                value={slot.label}
                                onChange={(event) =>
                                  updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                                    loadoutSlots: preset.loadoutSlots.map((entry, entryIndex) =>
                                      entryIndex === slotIndex
                                        ? {
                                            ...entry,
                                            label: event.target.value,
                                          }
                                        : entry
                                    ),
                                  })
                                }
                                className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                              Binding
                              <select
                                value={slot.binding}
                                onChange={(event) =>
                                  updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                                    loadoutSlots: preset.loadoutSlots.map((entry, entryIndex) =>
                                      entryIndex === slotIndex
                                        ? {
                                            ...entry,
                                            binding: event.target.value as typeof slot.binding,
                                          }
                                        : entry
                                    ),
                                  })
                                }
                                className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                              >
                                <option value="theme">theme</option>
                                <option value="sound">sound</option>
                                <option value="widget">widget</option>
                                <option value="module">module</option>
                                <option value="any">any</option>
                              </select>
                            </label>
                            <label className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
                              Equipped
                              <input
                                type="checkbox"
                                checked={slot.equipped}
                                onChange={(event) =>
                                  updateSceneAvatarPreset(preset.sceneProfile, preset.avatarProfile, {
                                    loadoutSlots: preset.loadoutSlots.map((entry, entryIndex) =>
                                      entryIndex === slotIndex
                                        ? {
                                            ...entry,
                                            equipped: event.target.checked,
                                          }
                                        : entry
                                    ),
                                  })
                                }
                                className="h-4 w-4 accent-[var(--app-accent)]"
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">State Triggers</div>
              <div className="text-xs text-[var(--app-muted)]">
                {selectedSceneStateBindings.length} authored event bindings
              </div>
            </div>
            {selectedSceneStateBindings.map((binding) => (
              <div
                key={`${binding.sceneProfile}:${binding.eventName}`}
                className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--app-text)]">{binding.eventName}</div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      {binding.stateKey} • hold {binding.holdMs}ms
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerPreviewEvent(binding.eventName)}
                    className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                  >
                    <Play size={13} className="mr-1.5" />
                    Trigger
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_130px]">
                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Scene State
                    <select
                      value={binding.stateKey}
                      onChange={(event) =>
                        updateSceneStateBinding(binding.sceneProfile, binding.eventName, {
                          stateKey: event.target.value as typeof binding.stateKey,
                        })
                      }
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                    >
                      {selectedSceneStates.map((sceneState) => (
                        <option key={sceneState.stateKey} value={sceneState.stateKey}>
                          {sceneState.stateKey}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Hold
                    <input
                      type="number"
                      min={500}
                      max={60000}
                      step={100}
                      value={binding.holdMs}
                      onChange={(event) =>
                        updateSceneStateBinding(binding.sceneProfile, binding.eventName, {
                          holdMs: Math.min(60000, Math.max(500, Number(event.target.value) || 500)),
                        })
                      }
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {selectedSceneCues.slice(0, 12).map((cue) => (
              <div
                key={`${cue.sceneProfile}:${cue.eventName}`}
                className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--app-text)]">{cue.eventName}</div>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      {cue.environmentMode || 'inherit'} • {cue.cameraShot || 'inherit'} • {cue.screenMode || 'base'} • {cue.transitionStyle} • orbit {cue.cameraOrbitSpeed ?? 0} • key {cue.lightRig?.keyIntensity?.toFixed(2) ?? '0.00'} • fill {cue.lightRig?.fillIntensity?.toFixed(2) ?? '0.00'} • {cue.cueDurationMs}ms
                      </div>
                    </div>
                  <button
                    type="button"
                    onClick={() => triggerPreviewEvent(cue.eventName)}
                    className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                  >
                    <Play size={13} className="mr-1.5" />
                    Trigger
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[140px_120px_120px_120px_130px_1fr]">
                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Environment
                    <select
                      value={cue.environmentMode || 'inherit'}
                      onChange={(event) =>
                        updateSceneCueEntry(cue.sceneProfile, cue.eventName, {
                          environmentMode:
                            event.target.value === 'inherit'
                              ? null
                              : (event.target.value as Exclude<(typeof environmentOptions)[number], 'inherit'>),
                        })
                      }
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                    >
                      {environmentOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Camera
                    <select
                      value={cue.cameraShot || 'inherit'}
                      onChange={(event) =>
                        updateSceneCueEntry(cue.sceneProfile, cue.eventName, {
                          cameraShot:
                            event.target.value === 'inherit'
                              ? null
                              : (event.target.value as Exclude<(typeof cameraOptions)[number], 'inherit'>),
                        })
                      }
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                    >
                      {cameraOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Screen
                    <select
                      value={cue.screenMode || 'base'}
                      onChange={(event) =>
                        updateSceneCueEntry(cue.sceneProfile, cue.eventName, {
                          screenMode: event.target.value as (typeof screenModeOptions)[number],
                        })
                      }
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                    >
                      {screenModeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                    Duration
                    <input
                      type="number"
                      min={300}
                      max={8000}
                      step={100}
                      value={cue.cueDurationMs}
                      onChange={(event) =>
                        updateSceneCueEntry(cue.sceneProfile, cue.eventName, {
                          cueDurationMs: Math.min(8000, Math.max(300, Number(event.target.value) || 300)),
                        })
                      }
                      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Transition
                      <select
                        value={cue.transitionStyle}
                        onChange={(event) =>
                          updateSceneCueEntry(cue.sceneProfile, cue.eventName, {
                            transitionStyle: event.target.value as (typeof transitionOptions)[number],
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      >
                        {transitionOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { key: 'beatPulse', label: 'Beat Pulse', checked: cue.beatPulse },
                      { key: 'ringPulse', label: 'Ring Pulse', checked: cue.ringPulse },
                      { key: 'groundMotion', label: 'Ground Motion', checked: cue.groundMotion },
                    ].map((toggle) => (
                      <label
                        key={toggle.key}
                        className="flex items-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--app-text)]"
                      >
                        <input
                          type="checkbox"
                          checked={toggle.checked}
                          onChange={(event) =>
                            updateSceneCueEntry(cue.sceneProfile, cue.eventName, {
                              [toggle.key]: event.target.checked,
                            })
                          }
                        />
                        <span>{toggle.label}</span>
                      </label>
                    ))}
                      <label className="flex items-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--app-text)]">
                        <span>Atmosphere</span>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={cue.ambientAtmosphere}
                        onChange={(event) =>
                          updateSceneCueEntry(cue.sceneProfile, cue.eventName, {
                            ambientAtmosphere: Math.min(1, Math.max(0, Number(event.target.value) || 0)),
                          })
                        }
                        className="ml-auto w-16 rounded-xl border border-[var(--app-border)] bg-transparent px-2 py-1 text-right text-xs outline-none"
                        />
                      </label>
                      <label className="flex items-center gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-xs text-[var(--app-text)]">
                        <span>Orbit</span>
                        <input
                          type="number"
                          min={0}
                          max={2.5}
                          step={0.01}
                          value={cue.cameraOrbitSpeed ?? 0}
                          onChange={(event) =>
                            updateSceneCueEntry(cue.sceneProfile, cue.eventName, {
                              cameraOrbitSpeed: Math.min(2.5, Math.max(0, Number(event.target.value) || 0)),
                            })
                          }
                          className="ml-auto w-16 rounded-xl border border-[var(--app-border)] bg-transparent px-2 py-1 text-right text-xs outline-none"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[110px_110px_120px_120px]">
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Key Light
                      <input
                        type="number"
                        min={0}
                        max={3}
                        step={0.01}
                        value={cue.lightRig?.keyIntensity ?? 0}
                        onChange={(event) =>
                          updateSceneCueEntry(cue.sceneProfile, cue.eventName, {
                            lightRig: {
                              ...cue.lightRig,
                              keyIntensity: Math.min(3, Math.max(0, Number(event.target.value) || 0)),
                              fillIntensity: cue.lightRig?.fillIntensity ?? 0,
                              keyColor: cue.lightRig?.keyColor ?? '#ffffff',
                              fillColor: cue.lightRig?.fillColor ?? '#ffffff',
                            },
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Fill Light
                      <input
                        type="number"
                        min={0}
                        max={3}
                        step={0.01}
                        value={cue.lightRig?.fillIntensity ?? 0}
                        onChange={(event) =>
                          updateSceneCueEntry(cue.sceneProfile, cue.eventName, {
                            lightRig: {
                              ...cue.lightRig,
                              keyIntensity: cue.lightRig?.keyIntensity ?? 0,
                              fillIntensity: Math.min(3, Math.max(0, Number(event.target.value) || 0)),
                              keyColor: cue.lightRig?.keyColor ?? '#ffffff',
                              fillColor: cue.lightRig?.fillColor ?? '#ffffff',
                            },
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Key Color
                      <input
                        type="color"
                        value={cue.lightRig?.keyColor ?? '#ffffff'}
                        onChange={(event) =>
                          updateSceneCueEntry(cue.sceneProfile, cue.eventName, {
                            lightRig: {
                              ...cue.lightRig,
                              keyIntensity: cue.lightRig?.keyIntensity ?? 0,
                              fillIntensity: cue.lightRig?.fillIntensity ?? 0,
                              keyColor: event.target.value,
                              fillColor: cue.lightRig?.fillColor ?? '#ffffff',
                            },
                          })
                        }
                        className="h-11 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Fill Color
                      <input
                        type="color"
                        value={cue.lightRig?.fillColor ?? '#ffffff'}
                        onChange={(event) =>
                          updateSceneCueEntry(cue.sceneProfile, cue.eventName, {
                            lightRig: {
                              ...cue.lightRig,
                              keyIntensity: cue.lightRig?.keyIntensity ?? 0,
                              fillIntensity: cue.lightRig?.fillIntensity ?? 0,
                              keyColor: cue.lightRig?.keyColor ?? '#ffffff',
                              fillColor: event.target.value,
                            },
                          })
                        }
                        className="h-11 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-2"
                      />
                    </label>
                  </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${sectionCard} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Preview Compare</div>
              <div className="mt-2 text-sm text-[var(--app-muted)]">
                Review exactly which semantic events differ between draft authoring and the published runtime before you push a new pack live.
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
              {sceneStateBindingDraftDifferences.length +
                sceneStateDraftDifferences.length +
                sceneLightPresetDraftDifferences.length +
                sceneMotionPresetDraftDifferences.length +
                sceneAvatarPresetDraftDifferences.length +
                sceneResponsePresetDraftDifferences.length +
                sceneScreenPresetDraftDifferences.length +
                sceneDraftDifferences.length +
                soundDraftDifferences.length}{' '}
              changed items
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-9">
            <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Trigger Diff</div>
                <div className="text-xs text-[var(--app-muted)]">{sceneStateBindingDraftDifferences.length} bindings</div>
              </div>
              <div className="mt-3 space-y-2">
                {sceneStateBindingDraftDifferences.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[var(--app-border)] px-3 py-4 text-sm text-[var(--app-muted)]">
                    Draft state triggers match the published bindings.
                  </div>
                ) : (
                  sceneStateBindingDraftDifferences.slice(0, 6).map((entry) => (
                    <div
                      key={`scene-binding-diff:${entry.eventName}`}
                      className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3"
                    >
                      <div className="text-sm font-semibold text-[var(--app-text)]">{entry.eventName}</div>
                      <div className="mt-1 text-xs text-[var(--app-muted)]">{entry.changes.join(' • ')}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="xt-runtime-monitor">
                <div className="xt-runtime-console-kicker">Live Runtime</div>
                <div className="xt-runtime-monitor-title">
                  {runtimeSceneState.stateKey}
                </div>
                <div className="xt-runtime-monitor-subtitle">
                  {runtimeSceneState.sceneProfile || 'no profile'} • {runtimeSceneState.screenMode} • {runtimeSceneState.mode}
                  {runtimeSceneState.triggerEvent ? ` • via ${runtimeSceneState.triggerEvent}` : ''}
                </div>
                {runtimeSceneState.avatarProfile || runtimeSceneState.shellLabel || runtimeSceneState.relayLabel ? (
                  <div className="xt-runtime-monitor-row">
                    avatar • {[runtimeSceneState.avatarProfile, runtimeSceneState.shellLabel, runtimeSceneState.relayLabel]
                      .filter(Boolean)
                      .join(' / ')}
                  </div>
                ) : null}
                {runtimeSceneState.identityBadge ? (
                  <div className="xt-runtime-monitor-row">
                    badge • {runtimeSceneState.identityBadge}
                  </div>
                ) : null}
                {runtimeSceneState.avatarPresenceLabel ? (
                  <div className="xt-runtime-monitor-row">
                    presence • {runtimeSceneState.avatarPresenceLabel}
                  </div>
                ) : null}
                {runtimeSceneState.avatarPresenceStateOverride || runtimeSceneState.avatarPresenceScreenModeOverride ? (
                  <div className="xt-runtime-monitor-row">
                    presence mode • {[runtimeSceneState.avatarPresenceStateOverride, runtimeSceneState.avatarPresenceScreenModeOverride]
                      .filter(Boolean)
                      .join(' / ')}
                  </div>
                ) : null}
                {runtimeSceneState.missionLabel || runtimeSceneState.roleLabel || runtimeSceneState.traceLabel ? (
                  <div className="xt-runtime-monitor-row">
                    labels • {[runtimeSceneState.missionLabel, runtimeSceneState.roleLabel, runtimeSceneState.traceLabel]
                      .filter(Boolean)
                      .join(' / ')}
                  </div>
                ) : null}
                {runtimeSceneState.loadoutSlotSummary ? (
                  <div className="xt-runtime-monitor-row">
                    slots • {runtimeSceneState.loadoutSlotSummary}
                  </div>
                ) : null}
                {runtimeSceneState.loadoutBindingSummary ? (
                  <div className="xt-runtime-monitor-row">
                    bindings • {runtimeSceneState.loadoutBindingSummary}
                  </div>
                ) : null}
                {runtimeSceneState.loadoutOccupancyState ? (
                  <div className="xt-runtime-monitor-row">
                    occupancy • {runtimeSceneState.occupiedLoadoutSlots ?? 0}/{runtimeSceneState.totalLoadoutSlots ?? 0} • {runtimeSceneState.loadoutOccupancyState}
                  </div>
                ) : null}
                {runtimeSceneState.missingLoadoutBindings?.length ? (
                  <div className="xt-runtime-monitor-row">
                    missing • {runtimeSceneState.missingLoadoutBindings.join(' • ')}
                  </div>
                ) : null}
                {runtimeSceneState.statusLabel ? (
                  <div className="xt-runtime-monitor-row">
                    status • {runtimeSceneState.statusLabel}
                  </div>
                ) : null}
                {runtimeSceneState.cueEvent ? (
                  <div className="xt-runtime-monitor-row">
                    last cue • {runtimeSceneState.cueEvent}
                  </div>
                ) : null}
                {runtimeSceneState.fallbackEvent ? (
                  <div className="xt-runtime-monitor-row xt-runtime-monitor-row--warning">
                    last fallback • {runtimeSceneState.fallbackEvent}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">State Diff</div>
                <div className="text-xs text-[var(--app-muted)]">{sceneStateDraftDifferences.length} states</div>
              </div>
              <div className="mt-3 space-y-2">
                {sceneStateDraftDifferences.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[var(--app-border)] px-3 py-4 text-sm text-[var(--app-muted)]">
                    Draft scene states match the published base pack.
                  </div>
                ) : (
                  sceneStateDraftDifferences.slice(0, 6).map((entry) => (
                    <div
                      key={`scene-state-diff:${entry.eventName}`}
                      className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3"
                    >
                      <div className="text-sm font-semibold text-[var(--app-text)]">{entry.eventName}</div>
                      <div className="mt-1 text-xs text-[var(--app-muted)]">{entry.changes.join(' • ')}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Light Preset Diff</div>
                <div className="text-xs text-[var(--app-muted)]">{sceneLightPresetDraftDifferences.length} presets</div>
              </div>
              <div className="mt-3 space-y-2">
                {sceneLightPresetDraftDifferences.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[var(--app-border)] px-3 py-4 text-sm text-[var(--app-muted)]">
                    Draft light presets match the published pack.
                  </div>
                ) : (
                  sceneLightPresetDraftDifferences.slice(0, 6).map((entry) => (
                    <div
                      key={`scene-light-diff:${entry.eventName}`}
                      className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3"
                    >
                      <div className="text-sm font-semibold text-[var(--app-text)]">{entry.eventName}</div>
                      <div className="mt-1 text-xs text-[var(--app-muted)]">{entry.changes.join(' • ')}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Motion Preset Diff</div>
                <div className="text-xs text-[var(--app-muted)]">{sceneMotionPresetDraftDifferences.length} presets</div>
              </div>
              <div className="mt-3 space-y-2">
                {sceneMotionPresetDraftDifferences.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[var(--app-border)] px-3 py-4 text-sm text-[var(--app-muted)]">
                    Draft motion presets match the published pack.
                  </div>
                ) : (
                  sceneMotionPresetDraftDifferences.slice(0, 6).map((entry) => (
                    <div
                      key={`scene-motion-diff:${entry.eventName}`}
                      className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3"
                    >
                      <div className="text-sm font-semibold text-[var(--app-text)]">{entry.eventName}</div>
                      <div className="mt-1 text-xs text-[var(--app-muted)]">{entry.changes.join(' • ')}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Response Diff</div>
                <div className="text-xs text-[var(--app-muted)]">{sceneResponsePresetDraftDifferences.length} presets</div>
              </div>
              <div className="mt-3 space-y-2">
                {sceneResponsePresetDraftDifferences.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[var(--app-border)] px-3 py-4 text-sm text-[var(--app-muted)]">
                    Draft response presets match the published pack behavior.
                  </div>
                ) : (
                  sceneResponsePresetDraftDifferences.slice(0, 6).map((entry) => (
                    <div
                      key={`scene-response-diff:${entry.eventName}`}
                      className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3"
                    >
                      <div className="text-sm font-semibold text-[var(--app-text)]">{entry.eventName}</div>
                      <div className="mt-1 text-xs text-[var(--app-muted)]">{entry.changes.join(' • ')}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Screen Diff</div>
                <div className="text-xs text-[var(--app-muted)]">{sceneScreenPresetDraftDifferences.length} presets</div>
              </div>
              <div className="mt-3 space-y-2">
                {sceneScreenPresetDraftDifferences.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[var(--app-border)] px-3 py-4 text-sm text-[var(--app-muted)]">
                    Draft screen presets match the published screen layer.
                  </div>
                ) : (
                  sceneScreenPresetDraftDifferences.slice(0, 6).map((entry) => (
                    <div
                      key={`scene-screen-diff:${entry.eventName}`}
                      className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3"
                    >
                      <div className="text-sm font-semibold text-[var(--app-text)]">{entry.eventName}</div>
                      <div className="mt-1 text-xs text-[var(--app-muted)]">{entry.changes.join(' • ')}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Avatar Diff</div>
                <div className="text-xs text-[var(--app-muted)]">{sceneAvatarPresetDraftDifferences.length} presets</div>
              </div>
              <div className="mt-3 space-y-2">
                {sceneAvatarPresetDraftDifferences.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[var(--app-border)] px-3 py-4 text-sm text-[var(--app-muted)]">
                    Draft avatar packs match the published identity layer.
                  </div>
                ) : (
                  sceneAvatarPresetDraftDifferences.slice(0, 6).map((entry) => (
                    <div
                      key={`scene-avatar-diff:${entry.eventName}`}
                      className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3"
                    >
                      <div className="text-sm font-semibold text-[var(--app-text)]">{entry.eventName}</div>
                      <div className="mt-1 text-xs text-[var(--app-muted)]">{entry.changes.join(' • ')}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Scene Diff</div>
                <div className="text-xs text-[var(--app-muted)]">{sceneDraftDifferences.length} events</div>
              </div>
              <div className="mt-3 space-y-2">
                {sceneDraftDifferences.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[var(--app-border)] px-3 py-4 text-sm text-[var(--app-muted)]">
                    Draft scene cues match the published scene pack.
                  </div>
                ) : (
                  sceneDraftDifferences.slice(0, 8).map((entry) => (
                    <div
                      key={`scene-diff:${entry.eventName}`}
                      className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--app-text)]">{entry.eventName}</div>
                          <div className="mt-1 text-xs text-[var(--app-muted)]">{entry.changes.join(' • ')}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => triggerPreviewEvent(entry.eventName)}
                          className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                        >
                          Trigger
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Audio Diff</div>
                <div className="text-xs text-[var(--app-muted)]">{soundDraftDifferences.length} events</div>
              </div>
              <div className="mt-3 space-y-2">
                {soundDraftDifferences.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[var(--app-border)] px-3 py-4 text-sm text-[var(--app-muted)]">
                    Draft sound mappings match the published sound pack.
                  </div>
                ) : (
                  soundDraftDifferences.slice(0, 8).map((entry) => (
                    <div
                      key={`sound-diff:${entry.eventName}`}
                      className="rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--app-text)]">{entry.eventName}</div>
                          <div className="mt-1 text-xs text-[var(--app-muted)]">{entry.changes.join(' • ')}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => triggerPreviewEvent(entry.eventName)}
                          className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                        >
                          Trigger
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className={`${sectionCard} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Event Family Coverage</div>
              <div className="mt-2 text-sm text-[var(--app-muted)]">
                Highest-volume semantic families in the current XTATION runtime.
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-accent)]">
              {recentEvents[0] ? `last • ${recentEvents[0].name}` : 'waiting for events'}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {topFamilies.length === 0 ? (
              <div className="sm:col-span-2 rounded-[22px] border border-dashed border-[var(--app-border)] px-4 py-6 text-sm text-[var(--app-muted)]">
                No semantic events recorded yet.
              </div>
            ) : (
              topFamilies.map((family) => (
                <div
                  key={family.family}
                  className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4"
                >
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">{family.family}</div>
                  <div className="mt-2 text-xl font-semibold text-[var(--app-text)]">{family.count}</div>
                  <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">Last event: {formatDateTime(family.lastOccurredAt)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`${sectionCard} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Audio Studio Event Map</div>
              <div className="mt-2 text-sm text-[var(--app-muted)]">
                Assign sound cues to semantic XTATION events. Upload per event, preview instantly, and keep sound behavior tied to meaning.
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
              {selectedEventMap.filter((entry) => entry.assetId).length} mapped
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {selectedEventMap.slice(0, 18).map((entry) => {
              const assignedAsset = entry.assetId ? soundAssetMap.get(entry.assetId) || null : null;
              return (
                <div
                  key={`${entry.soundPackId}:${entry.eventName}`}
                  className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
                        <Volume2 size={15} className="text-[var(--app-accent)]" />
                        <span>{entry.eventName}</span>
                      </div>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        {entry.mixGroup} • volume {entry.volume}% • cooldown {entry.cooldownMs}ms
                      </div>
                      <div className="mt-2 text-sm text-[var(--app-muted)]">
                        {assignedAsset ? (
                          <>
                            <span className="font-semibold text-[var(--app-text)]">{assignedAsset.name}</span> • {assignedAsset.source}
                          </>
                        ) : (
                          'No sound cue assigned yet.'
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => previewCreativeSoundAsset(assignedAsset)}
                        className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                      >
                        <Play size={13} className="mr-1.5" />
                        Asset
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerPreviewEvent(entry.eventName)}
                        className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                      >
                        <Play size={13} className="mr-1.5" />
                        Trigger
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUploadClick(entry.eventName)}
                        className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                      >
                        <Upload size={13} className="mr-1.5" />
                        Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => assignSoundToEvent(entry.soundPackId, entry.eventName, null)}
                        className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-red-400 hover:text-red-200`}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_120px_120px]">
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Sound
                      <select
                        value={entry.assetId || ''}
                        onChange={(event) => assignSoundToEvent(entry.soundPackId, entry.eventName, event.target.value || null)}
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      >
                        <option value="">Unassigned</option>
                        {state.soundAssets
                          .filter((asset) => asset.kind === entry.mixGroup || asset.kind === 'ui' || asset.kind === 'scene_fx')
                          .map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {asset.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Mix Group
                      <select
                        value={entry.mixGroup}
                        onChange={(event) => updateEventMapEntry(entry.soundPackId, entry.eventName, { mixGroup: event.target.value as CreativeMixGroup })}
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      >
                        {mixGroups.map((group) => (
                          <option key={group} value={group}>
                            {group}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Volume
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={entry.volume}
                        onChange={(event) =>
                          updateEventMapEntry(entry.soundPackId, entry.eventName, {
                            volume: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      Cooldown
                      <input
                        type="number"
                        min={0}
                        max={5000}
                        step={10}
                        value={entry.cooldownMs}
                        onChange={(event) =>
                          updateEventMapEntry(entry.soundPackId, entry.eventName, {
                            cooldownMs: Math.min(5000, Math.max(0, Number(event.target.value) || 0)),
                          })
                        }
                        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[var(--app-muted)]">
                Draft vs published: <span className="font-semibold text-[var(--app-text)]">{soundDraftDeltaCount} sound mappings changed</span>
              </div>
              <button
                type="button"
                onClick={() => selectedSkin?.soundPackId && restorePublishedSoundPack(selectedSkin.soundPackId)}
                disabled={!selectedSkin?.soundPackId || selectedPublishedEventMap.length === 0}
                className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Restore Published Sound Pack
              </button>
            </div>
          </div>
        </div>

        <div className={`${sectionCard} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Sound Library</div>
              <div className="mt-2 text-sm text-[var(--app-muted)]">
                Current cue assets available to the Audio Studio. Uploaded files stay local-first for now.
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-accent)]">
              {state.soundAssets.length} assets
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {state.soundAssets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--app-text)]">{asset.name}</div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      {asset.kind} • {asset.source}
                    </div>
                    <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                      {asset.source === 'upload' ? `Uploaded ${formatDateTime(asset.createdAt)}` : 'Built-in XTATION preview asset'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => previewCreativeSoundAsset(asset)}
                    className={`${panelButton} border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]`}
                  >
                    <Play size={13} className="mr-1.5" />
                    Preview
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4 text-sm leading-6 text-[var(--app-muted)]">
            <div className="flex items-start gap-2">
              <ShieldCheck size={16} className="mt-1 text-[var(--app-accent)]" />
              <div>
                Admin owns authoring here. Users should only consume published skins and simple volume controls in normal Settings.
              </div>
            </div>
          </div>
        </div>

        <div className={`${sectionCard} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Publish Log</div>
              <div className="mt-2 text-sm text-[var(--app-muted)]">
                Recent scene and skin publishing actions for this station scope.
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-accent)]">
              {state.publishLog.length} records
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {state.publishLog.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-[var(--app-border)] px-4 py-6 text-sm text-[var(--app-muted)]">
                No creative publishing activity yet.
              </div>
            ) : (
              state.publishLog.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--app-text)]">{entry.label}</div>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        {entry.targetType} • {entry.action.replace('_', ' ')} • revision {entry.revision}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--app-muted)]">{formatDateTime(entry.occurredAt)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
