import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Box, Loader2, RefreshCw } from 'lucide-react';
import type { XtationTheme } from '../../src/theme/ThemeProvider';
import { createSceneApiClient, type SceneApiCapabilities, type SceneApiEventMessage, type SceneApiResponseMessage } from '../../src/scene/sceneApiClient';
import { usePresentationEvents } from '../../src/presentation/PresentationEventsProvider';
import { XTATION_SCENE_CUE_EVENT, type SceneCueRequest } from '../../src/presentation/sceneDirectorBus';
import {
  CREATIVE_OPS_SYNC_EVENT,
  readCreativeOpsStateSnapshot,
  resolveCreativeAvatarPresencePreset,
  resolveCreativeSceneAvatarPreset,
  resolveCreativeSceneScreenPreset,
  resolveCreativeSceneStateBinding,
  resolveCreativeSceneState,
  resolvePublishedCreativeSkin,
  type CreativeAvatarProfile,
  type CreativeSceneStateKey,
  type CreativeSceneScreenMode,
} from '../../src/admin/creativeOps';
import { useAuth } from '../../src/auth/AuthProvider';
import { useXtationSettings } from '../../src/settings/SettingsProvider';

type SceneStatus = 'booting' | 'syncing' | 'ready' | 'error';

interface ProfileLobbySceneProps {
  displayName: string;
  roleText: string;
  theme: XtationTheme;
  stageState: 'active' | 'productive' | 'idle';
  totalXP: number;
  completedToday: number;
  currentMissionTitle: string | null;
  activeSessionLabel: string | null;
  stationLabel: string;
  plan: string;
  capabilityHighlights: string[];
  loadoutOccupancyState?: 'empty' | 'partial' | 'ready';
  occupiedLoadoutSlots?: number;
  totalLoadoutSlots?: number;
  missingLoadoutBindings?: string[];
  timeOfDayOverride?: 'day' | 'night';
  sceneProfileOverride?: 'bureau' | 'void' | 'ops';
  avatarProfileOverride?: CreativeAvatarProfile;
}

const SCENE_SRC = '/avatar-lobby/index.html?presentation=profile';

type SceneBridgeLike = {
  hello: (requestedVersion?: string) => Promise<SceneApiResponseMessage>;
  command: (
    name: string,
    payload?: unknown,
    options?: {
      idempotencyKey?: string;
      expectedStateVersion?: number;
      timeoutMs?: number;
    }
  ) => Promise<SceneApiResponseMessage>;
  getCapabilities?: () => SceneApiCapabilities | Promise<SceneApiCapabilities | null> | null;
  onEvent?: (listener: (event: SceneApiEventMessage) => void) => (() => void) | void;
  destroy?: () => void;
};

const resolveEnvironmentMode = (theme: XtationTheme, stageState: ProfileLobbySceneProps['stageState']) => {
  if (theme === 'notion_light') return 'light';
  if (theme === 'bureau') return 'bureau';
  if (theme === 'void') return stageState === 'idle' ? 'mono' : 'glacier';
  if (stageState === 'active') return 'dusk';
  if (stageState === 'productive') return 'core';
  return 'glacier';
};

const resolveCameraShot = (
  _stageState: ProfileLobbySceneProps['stageState'],
  _currentMissionTitle: string | null
) => 'hero';

const resolveDefaultSceneProfile = (
  theme: XtationTheme
): 'bureau' | 'void' | 'ops' => {
  if (theme === 'void') return 'void';
  return 'bureau';
};

const buildMissionText = (missionTitle: string | null, activeSessionLabel: string | null) => {
  if (missionTitle && activeSessionLabel) return `${missionTitle}\n${activeSessionLabel}`;
  if (missionTitle) return missionTitle;
  if (activeSessionLabel) return activeSessionLabel;
  return 'No active mission.\nOpen Play to seed the next loop.';
};

const buildTraceText = (props: Pick<
  ProfileLobbySceneProps,
  'totalXP' | 'completedToday' | 'stationLabel' | 'plan' | 'capabilityHighlights'
>) => {
  const capabilityLine = props.capabilityHighlights.length
    ? props.capabilityHighlights.slice(0, 2).join(' • ')
    : 'System assets online';
  return `XP ${props.totalXP} • ${props.completedToday} completed\n${props.plan.toUpperCase()} • ${props.stationLabel}\n${capabilityLine}`;
};

const readSceneMetaText = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const formatRuntimeKey = (value: string | null | undefined) => {
  if (!value) return 'idle';
  const compact = value
    .replace(/^profile\./, '')
    .replace(/^ambient\./, '')
    .replace(/^station\./, '')
    .replace(/^notification\./, '')
    .replace(/^play\./, '')
    .replace(/^quest\./, '')
    .replace(/^dusk\./, '')
    .replace(/\./g, ' ')
    .replace(/-/g, ' ')
    .trim();
  return compact || 'idle';
};

const formatSceneEventLabel = (eventName: string | null | undefined) => {
  if (!eventName) return null;
  return formatRuntimeKey(eventName);
};

const resolveDefaultScreenMode = (
  stageState: ProfileLobbySceneProps['stageState']
): CreativeSceneScreenMode => (stageState === 'active' ? 'focus' : 'base');

const resolveBaseCameraMotion = (
  motionProfile: 'calm' | 'sharp' | 'cinematic' | undefined,
  stageState: ProfileLobbySceneProps['stageState']
) => {
  if (motionProfile === 'sharp') {
    return {
      enabled: false,
      speed: 0.64,
    };
  }
  if (motionProfile === 'cinematic') {
    return {
      enabled: true,
      speed: stageState === 'active' ? 0.72 : 0.56,
    };
  }
  return {
    enabled: true,
    speed: stageState === 'active' ? 0.32 : stageState === 'productive' ? 0.26 : 0.18,
  };
};

const resolveBasePortraitLightRig = ({
  baseLightRig,
  sceneProfile,
  stageState,
  isNight,
}: {
  baseLightRig:
    | {
        keyIntensity: number;
        fillIntensity: number;
        keyColor: string;
        fillColor: string;
      }
    | null
    | undefined;
  sceneProfile: 'bureau' | 'void' | 'ops';
  stageState: ProfileLobbySceneProps['stageState'];
  isNight: boolean;
}) => {
  if (baseLightRig) {
    return baseLightRig;
  }

  if (sceneProfile === 'void') {
    return {
      keyIntensity: isNight ? 1.62 : 1.48,
      fillIntensity: isNight ? 0.12 : 0.16,
      keyColor: '#f5f8ff',
      fillColor: '#7b8dbf',
    };
  }

  if (sceneProfile === 'ops') {
    return {
      keyIntensity: stageState === 'active' ? 2.04 : 1.86,
      fillIntensity: 0.14,
      keyColor: '#f7f2e8',
      fillColor: '#ba7f49',
    };
  }

  return {
    keyIntensity: isNight ? 2.84 : stageState === 'active' ? 3.02 : 2.74,
    fillIntensity: isNight ? 0.04 : 0.06,
    keyColor: '#fff8f1',
    fillColor: '#8fa0b8',
  };
};

const resolvePortraitModelState = ({
  sceneProfile,
  stageState,
  isNight,
}: {
  sceneProfile: 'bureau' | 'void' | 'ops';
  stageState: ProfileLobbySceneProps['stageState'];
  isNight: boolean;
}) => {
  const scale =
    sceneProfile === 'void'
      ? 0.96
      : sceneProfile === 'ops'
      ? 0.98
      : 0.97;
  const bureauLift = isNight ? 0.3 : stageState === 'active' ? 0.28 : 0.34;

  return {
    modelScale: sceneProfile === 'bureau' ? scale + 0.07 : scale,
    modelYaw: sceneProfile === 'void' ? -28 : sceneProfile === 'ops' ? -40 : 8,
    modelPosX: sceneProfile === 'void' ? 0.02 : sceneProfile === 'ops' ? 0.05 : 0.01,
    modelPosY:
      sceneProfile === 'bureau'
        ? bureauLift
        : isNight
        ? -0.04
        : stageState === 'active'
        ? -0.035
        : -0.015,
  };
};

const resolveCueTransitionImmediate = (style: 'calm' | 'sharp' | 'surge' | null | undefined) =>
  style === 'sharp';

const resolveCueCameraMotion = (
  style: 'calm' | 'sharp' | 'surge' | null | undefined,
  orbitSpeed: number | null | undefined
) => {
  if (style === 'sharp') {
    return {
      enabled: false,
      speed: orbitSpeed ?? 0.8,
    };
  }
  if (style === 'surge') {
    return {
      enabled: true,
      speed: orbitSpeed ?? 1.08,
    };
  }
  return {
    enabled: true,
    speed: orbitSpeed ?? 0.5,
  };
};

const applySceneLightRig = async (
  bridge: SceneBridgeLike,
  lightRig:
    | {
        keyIntensity: number;
        fillIntensity: number;
        keyColor: string;
        fillColor: string;
      }
    | null
    | undefined
) => {
  if (!lightRig) return;
  await bridge.command('setLight', {
    lightId: 'key',
    props: {
      intensity: lightRig.keyIntensity,
      color: lightRig.keyColor,
    },
  });
  await bridge.command('setLight', {
    lightId: 'fill',
    props: {
      intensity: lightRig.fillIntensity,
      color: lightRig.fillColor,
    },
  });
};

type ProfileSceneScreenPatch = {
  x?: number;
  y?: number;
  z?: number;
  yaw?: number;
  scale?: number;
  width?: number;
  height?: number;
  bend?: number;
  showFrame?: boolean;
  visible?: boolean;
  shape?: 'panel' | 'round' | 'diamond';
};

const buildSceneScreenPayloads = ({
  mode,
  preset,
  missionText,
  roleText,
  traceText,
  contextTitle,
  contextNote,
}: {
  mode: CreativeSceneScreenMode;
  preset: {
    missionLabel: string;
    roleLabel: string;
    traceLabel: string;
    fallbackMissionText: string;
    fallbackRoleText: string;
  } | null;
  missionText: string;
  roleText: string;
  traceText: string;
  contextTitle?: string | null;
  contextNote?: string | null;
}) => {
  const screens = {
    missionLabel: preset?.missionLabel || 'MISSION',
    missionText: missionText || preset?.fallbackMissionText || 'No active mission.',
    roleLabel: preset?.roleLabel || (roleText ? roleText.slice(0, 18).toUpperCase() : 'AVATAR'),
    roleText: roleText || preset?.fallbackRoleText || 'Profile link online',
    traceLabel: preset?.traceLabel || 'TRACE',
    traceText,
  };

  switch (mode) {
    case 'focus':
      return {
        ...screens,
        missionText: contextTitle ? `${contextTitle}\n${preset?.fallbackMissionText || 'Stay inside the active loop.'}` : screens.missionText,
        roleText: contextNote || screens.roleText,
      };
    case 'brief':
      return {
        ...screens,
        missionText: contextTitle ? `${contextTitle}\n${preset?.fallbackMissionText || 'Dusk relay loaded.'}` : screens.missionText,
        roleText: contextNote || screens.roleText,
      };
    case 'urgent':
      return {
        ...screens,
        missionText: contextTitle ? `${contextTitle}\n${preset?.fallbackMissionText || 'Immediate review required.'}` : screens.missionText,
        roleText: contextNote || screens.roleText,
      };
    case 'success':
      return {
        ...screens,
        missionText: contextTitle ? `${contextTitle}\n${preset?.fallbackMissionText || 'Objective confirmed.'}` : screens.missionText,
        roleText: contextNote || screens.roleText,
      };
    case 'base':
    default:
      return screens;
  }
};

const resolveProfileScreenLayout = ({
  sceneProfile,
  mode,
}: {
  sceneProfile: 'bureau' | 'void' | 'ops';
  mode: CreativeSceneScreenMode;
}): Record<'screen-a' | 'screen-b' | 'screen-c', ProfileSceneScreenPatch> => {
  const baseLayouts: Record<'screen-a' | 'screen-b' | 'screen-c', ProfileSceneScreenPatch> = {
    'screen-a': {
      x: -2.02,
      y: 1.44,
      z: -0.02,
      yaw: 8,
      scale: 0.28,
      width: 0.52,
      height: 0.46,
      bend: -0.03,
      showFrame: false,
      visible: true,
      shape: 'panel',
    },
    'screen-b': {
      x: 2.8,
      y: 0.72,
      z: -0.82,
      yaw: -12,
      scale: 0.01,
      width: 0.52,
      height: 0.52,
      bend: 0.04,
      showFrame: false,
      visible: false,
      shape: 'round',
    },
    'screen-c': {
      x: 0,
      y: 1.94,
      z: -1.18,
      yaw: 180,
      scale: 0.54,
      width: 0.92,
      height: 0.62,
      bend: -0.08,
      showFrame: false,
      visible: false,
      shape: 'panel',
    },
  };

  if (sceneProfile === 'void') {
    baseLayouts['screen-a'] = {
      ...baseLayouts['screen-a'],
      x: -1.62,
      z: 0.02,
      yaw: 16,
      scale: 0.36,
    };
    baseLayouts['screen-b'] = {
      ...baseLayouts['screen-b'],
      x: 2.7,
      y: 0.74,
      z: -0.94,
      scale: 0.01,
      showFrame: true,
    };
    baseLayouts['screen-c'] = {
      ...baseLayouts['screen-c'],
      y: 1.9,
      z: -1.26,
      scale: 0.5,
    };
  }

  if (sceneProfile === 'ops') {
    baseLayouts['screen-a'] = {
      ...baseLayouts['screen-a'],
      x: -1.46,
      y: 1.44,
      scale: 0.4,
      showFrame: false,
    };
    baseLayouts['screen-b'] = {
      ...baseLayouts['screen-b'],
      x: 2.56,
      y: 0.78,
      z: -0.86,
      scale: 0.01,
      showFrame: true,
    };
    baseLayouts['screen-c'] = {
      ...baseLayouts['screen-c'],
      y: 1.96,
      z: -1.04,
      scale: 0.56,
    };
  }

  if (mode === 'brief' || mode === 'urgent' || mode === 'success') {
    baseLayouts['screen-c'] = {
      ...baseLayouts['screen-c'],
      visible: true,
      showFrame: mode !== 'success',
      scale: mode === 'urgent' ? 0.58 : 0.54,
      y: mode === 'urgent' ? 1.98 : 1.94,
    };
    baseLayouts['screen-b'] = {
      ...baseLayouts['screen-b'],
      visible: false,
      showFrame: false,
      x: 2.8,
      y: 0.72,
      z: -0.82,
      scale: 0.01,
    };
  }

  if (mode === 'focus') {
    baseLayouts['screen-a'] = {
      ...baseLayouts['screen-a'],
      x: -1.92,
      y: 1.48,
      scale: 0.3,
      width: 0.52,
    };
    baseLayouts['screen-b'] = {
      ...baseLayouts['screen-b'],
      x: 2.8,
      y: 0.72,
      z: -0.82,
      scale: 0.01,
    };
  }

  return baseLayouts;
};

const injectHostSceneStyles = (frame: HTMLIFrameElement) => {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    let style = doc.getElementById('xtation-profile-scene-style') as HTMLStyleElement | null;
    if (!style) {
      style = doc.createElement('style');
      style.id = 'xtation-profile-scene-style';
      doc.head.appendChild(style);
    }
    style.textContent = `
      html, body {
        overflow: hidden !important;
        background: transparent !important;
      }
      body {
        user-select: none !important;
      }
    `;
  } catch {
    // Same-origin styling is best-effort.
  }
};

const isSuccessfulResponse = (response: SceneApiResponseMessage | null | undefined) => Boolean(response?.ok);

const waitForDirectBridge = async (frame: HTMLIFrameElement, timeoutMs = 12000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const directBridge = (frame.contentWindow as Window & {
      xtationScene?: SceneBridgeLike;
    } | null)?.xtationScene;
    if (directBridge) return directBridge;
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }
  return null;
};

export const ProfileLobbyScene: React.FC<ProfileLobbySceneProps> = ({
  roleText,
  theme,
  stageState,
  totalXP,
  completedToday,
  currentMissionTitle,
  activeSessionLabel,
  stationLabel,
  plan,
  capabilityHighlights,
  loadoutOccupancyState = 'empty',
  occupiedLoadoutSlots = 0,
  totalLoadoutSlots = 0,
  missingLoadoutBindings = [],
  timeOfDayOverride,
  sceneProfileOverride,
  avatarProfileOverride,
}) => {
  const { user } = useAuth();
  const { settings } = useXtationSettings();
  const { emitEvent, lastEvent } = usePresentationEvents();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<SceneBridgeLike | null>(null);
  const bridgeCleanupRef = useRef<(() => void) | null>(null);
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>('booting');
  const [statusMessage, setStatusMessage] = useState('Booting stage');
  const [capabilities, setCapabilities] = useState<SceneApiCapabilities | null>(null);
  const [lastSceneRuntimeEvent, setLastSceneRuntimeEvent] = useState<SceneApiEventMessage | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [creativeSyncTick, setCreativeSyncTick] = useState(0);
  const [timeBucket, setTimeBucket] = useState(() => Math.floor(Date.now() / 60000));
  const [heldSceneState, setHeldSceneState] = useState<{
    stateKey: CreativeSceneStateKey;
    until: number;
    eventName: string;
    previewScenario?: string | null;
    contextTitle?: string | null;
    contextNote?: string | null;
  } | null>(null);
  const cueResetTimerRef = useRef<number | null>(null);
  const heldStateTimerRef = useRef<number | null>(null);
  const seenPresentationEventIdRef = useRef<string | null>(null);
  const userId = user?.id || null;
  const creativeState = useMemo(
    () => readCreativeOpsStateSnapshot(userId),
    [creativeSyncTick, userId]
  );
  const resolvedCreativeSkin = useMemo(
    () =>
      resolvePublishedCreativeSkin(
        creativeState,
        settings.unlocks.activeThemeId?.startsWith('creative:')
          ? settings.unlocks.activeThemeId.slice('creative:'.length)
          : undefined,
        settings.unlocks.activeSoundPackId
      ),
    [creativeState, settings.unlocks.activeSoundPackId, settings.unlocks.activeThemeId]
  );
  const currentHour = useMemo(() => new Date(timeBucket * 60000).getHours(), [timeBucket]);
  const isNight =
    timeOfDayOverride === 'night' ? true : timeOfDayOverride === 'day' ? false : currentHour >= 19 || currentHour < 6;
  const defaultSceneStateKey: CreativeSceneStateKey =
    stageState === 'active'
      ? 'profile.active'
      : stageState === 'productive'
      ? 'profile.focus'
      : isNight
      ? 'profile.night'
      : 'profile.day';
  const isHoldingSceneState = Boolean(heldSceneState && heldSceneState.until > Date.now());
  const activeSceneProfile =
    sceneProfileOverride ||
    resolvedCreativeSkin?.sceneProfile ||
    resolveDefaultSceneProfile(theme);
  const activeAvatarProfile =
    avatarProfileOverride ||
    resolvedCreativeSkin?.avatarProfile ||
    'station';
  const currentAvatarPreset = useMemo(
    () =>
      resolveCreativeSceneAvatarPreset(
        creativeState,
        activeAvatarProfile,
        activeSceneProfile,
        sceneProfileOverride ? 'draft' : 'published'
      ),
    [activeAvatarProfile, activeSceneProfile, creativeState, sceneProfileOverride]
  );
  const activeAvatarPresencePreset = useMemo(
    () => resolveCreativeAvatarPresencePreset(currentAvatarPreset, loadoutOccupancyState),
    [currentAvatarPreset, loadoutOccupancyState]
  );
  const effectiveBaseSceneStateKey =
    activeAvatarPresencePreset?.sceneStateOverride || defaultSceneStateKey;
  const effectiveSceneStateKey = isHoldingSceneState
    ? heldSceneState!.stateKey
    : effectiveBaseSceneStateKey;
  const baseSceneState = useMemo(
    () =>
      resolveCreativeSceneState(
        creativeState,
        effectiveSceneStateKey,
        activeSceneProfile,
        sceneProfileOverride ? 'draft' : 'published'
      ),
    [activeSceneProfile, creativeState, effectiveSceneStateKey, sceneProfileOverride]
  );
  const loadoutStatusLine = `${occupiedLoadoutSlots}/${totalLoadoutSlots} slots • ${loadoutOccupancyState}`;
  const loadoutMissingLine = missingLoadoutBindings.length
    ? `missing • ${missingLoadoutBindings.join(' • ')}`
    : 'all authored bindings satisfied';
  const loadoutPresenceModeLine =
    activeAvatarPresencePreset?.sceneStateOverride || activeAvatarPresencePreset?.screenModeOverride
      ? `${activeAvatarPresencePreset.sceneStateOverride || 'inherit'} • ${activeAvatarPresencePreset.screenModeOverride || 'inherit'}`
      : null;

  const environmentMode = useMemo(
    () => baseSceneState?.environmentMode || resolveEnvironmentMode(theme, stageState),
    [baseSceneState?.environmentMode, theme, stageState]
  );
  const cameraShot = useMemo(
    () => baseSceneState?.cameraShot || resolveCameraShot(stageState, currentMissionTitle),
    [baseSceneState?.cameraShot, stageState, currentMissionTitle]
  );
  const baseAmbientAtmosphere = baseSceneState?.ambientAtmosphere ?? (stageState === 'active' ? 0.2 : 0.14);
  const baseLightRig = useMemo(
    () =>
      resolveBasePortraitLightRig({
        baseLightRig: baseSceneState?.lightRig,
        sceneProfile: activeSceneProfile,
        stageState,
        isNight,
      }),
    [activeSceneProfile, baseSceneState?.lightRig, isNight, stageState]
  );
  const baseBeatPulse = baseSceneState?.beatPulse ?? false;
  const baseRingPulse = baseSceneState?.ringPulse ?? false;
  const baseGroundMotion = baseSceneState?.groundMotion ?? false;
  const baseModelFloat = baseSceneState?.modelFloat ?? stageState !== 'active';
  const baseHideLightSource = baseSceneState?.hideLightSource ?? true;
  const portraitModelState = useMemo(
    () =>
      resolvePortraitModelState({
        sceneProfile: activeSceneProfile,
        stageState,
        isNight,
      }),
    [activeSceneProfile, isNight, stageState]
  );
  const currentScreenMode = useMemo(
    () => {
      const fallback = resolveDefaultScreenMode(stageState);
      if (isHoldingSceneState) {
        return baseSceneState?.screenMode ?? fallback;
      }
      return activeAvatarPresencePreset?.screenModeOverride ?? baseSceneState?.screenMode ?? fallback;
    },
    [activeAvatarPresencePreset?.screenModeOverride, baseSceneState?.screenMode, isHoldingSceneState, stageState]
  );
  const baseCameraMotion = useMemo(
    () => {
      const fallback = resolveBaseCameraMotion(resolvedCreativeSkin?.motionProfile, stageState);
      if (baseSceneState?.cameraOrbitSpeed == null) return fallback;
      return {
        enabled: baseSceneState.cameraOrbitSpeed > 0,
        speed: baseSceneState.cameraOrbitSpeed,
      };
    },
    [baseSceneState?.cameraOrbitSpeed, resolvedCreativeSkin?.motionProfile, stageState]
  );
  const currentScreenPreset = useMemo(
    () =>
      resolveCreativeSceneScreenPreset(
        creativeState,
        currentScreenMode,
        activeSceneProfile,
        sceneProfileOverride ? 'draft' : 'published'
      ),
    [activeSceneProfile, creativeState, currentScreenMode, sceneProfileOverride]
  );
  const missionText = useMemo(
    () => buildMissionText(currentMissionTitle, activeSessionLabel),
    [currentMissionTitle, activeSessionLabel]
  );
  const traceText = useMemo(
    () =>
      buildTraceText({
        totalXP,
        completedToday,
        stationLabel,
        plan,
        capabilityHighlights,
      }),
    [totalXP, completedToday, stationLabel, plan, capabilityHighlights]
  );
  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeBucket(Math.floor(Date.now() / 60000));
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleCreativeSync = () => setCreativeSyncTick((value) => value + 1);
    window.addEventListener(CREATIVE_OPS_SYNC_EVENT, handleCreativeSync as EventListener);
    return () => {
      window.removeEventListener(CREATIVE_OPS_SYNC_EVENT, handleCreativeSync as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!lastEvent) return;
    if (seenPresentationEventIdRef.current === null) {
      seenPresentationEventIdRef.current = lastEvent.id;
      return;
    }
    if (seenPresentationEventIdRef.current === lastEvent.id) return;
    seenPresentationEventIdRef.current = lastEvent.id;

    const isPreviewEvent = lastEvent.metadata?.preview === true;
    if (isPreviewEvent && !sceneProfileOverride) return;
    if (!isPreviewEvent && sceneProfileOverride) return;

    const binding = resolveCreativeSceneStateBinding(
      creativeState,
      lastEvent.name,
      activeSceneProfile,
      sceneProfileOverride ? 'draft' : 'published'
    );
    if (!binding) return;

    const until = Date.now() + Math.max(800, binding.holdMs);
    setHeldSceneState({
      stateKey: binding.stateKey,
      until,
      eventName: lastEvent.name,
      previewScenario:
        typeof lastEvent.metadata?.previewScenario === 'string'
          ? lastEvent.metadata.previewScenario
          : null,
      contextTitle:
        readSceneMetaText(lastEvent.metadata?.title) ||
        readSceneMetaText(lastEvent.metadata?.briefTitle) ||
        readSceneMetaText(lastEvent.metadata?.releasedStateKey) ||
        null,
      contextNote:
        readSceneMetaText(lastEvent.metadata?.reason) ||
        readSceneMetaText(lastEvent.metadata?.source) ||
        readSceneMetaText(lastEvent.metadata?.via) ||
        null,
    });
    emitEvent('profile.scene.state.hold', {
      source: 'scene',
      metadata: {
        eventName: lastEvent.name,
        stateKey: binding.stateKey,
        holdMs: binding.holdMs,
        sceneProfile: activeSceneProfile,
        previewScenario:
          typeof lastEvent.metadata?.previewScenario === 'string'
            ? lastEvent.metadata.previewScenario
            : null,
      },
    });

    if (heldStateTimerRef.current) {
      window.clearTimeout(heldStateTimerRef.current);
    }
    heldStateTimerRef.current = window.setTimeout(() => {
      setHeldSceneState((current) => {
        if (current?.until !== until) return current;
        emitEvent('profile.scene.state.release', {
          source: 'scene',
          metadata: {
            eventName: current.eventName,
            releasedStateKey: current.stateKey,
            fallbackStateKey: defaultSceneStateKey,
            sceneProfile: activeSceneProfile,
            previewScenario: current.previewScenario || null,
          },
        });
        return null;
      });
    }, Math.max(850, binding.holdMs + 40));
  }, [activeSceneProfile, creativeState, defaultSceneStateKey, emitEvent, lastEvent, sceneProfileOverride]);

  useEffect(() => {
    emitEvent(isNight ? 'ambient.night.enter' : 'ambient.day.enter', {
      source: 'scene',
      metadata: {
        sceneProfile: activeSceneProfile,
        sceneStateKey: defaultSceneStateKey,
      },
    });
  }, [activeSceneProfile, defaultSceneStateKey, emitEvent, isNight]);

  useEffect(() => {
    return () => {
      if (cueResetTimerRef.current) {
        window.clearTimeout(cueResetTimerRef.current);
      }
      if (heldStateTimerRef.current) {
        window.clearTimeout(heldStateTimerRef.current);
      }
      bridgeCleanupRef.current?.();
      bridgeCleanupRef.current = null;
      bridgeRef.current?.destroy?.();
      bridgeRef.current = null;
    };
  }, []);

  const applySceneScreens = async (
    bridge: SceneBridgeLike,
    screenMode: CreativeSceneScreenMode,
    contextTitle?: string | null,
    contextNote?: string | null
  ) => {
    const screens = buildSceneScreenPayloads({
      mode: screenMode,
      preset:
        resolveCreativeSceneScreenPreset(
          creativeState,
          screenMode,
          activeSceneProfile,
          sceneProfileOverride ? 'draft' : 'published'
        ) || currentScreenPreset,
      missionText,
      roleText:
        roleText ||
        activeAvatarPresencePreset?.roleFallbackText ||
        currentAvatarPreset?.roleFallbackText ||
        '',
      traceText,
      contextTitle,
      contextNote,
    });
    const screenLayouts = resolveProfileScreenLayout({
      sceneProfile: activeSceneProfile,
      mode: screenMode,
    });
    await bridge.command('setScreen', {
      screenId: 'screen-a',
      props: {
        ...screenLayouts['screen-a'],
        clearMedia: true,
        label: screens.missionLabel,
        text: screens.missionText,
      },
      select: false,
    });
    await bridge.command('setScreen', {
      screenId: 'screen-b',
      props: {
        ...screenLayouts['screen-b'],
        clearMedia: true,
        label: screens.roleLabel,
        text: screens.roleText,
      },
      select: false,
    });
    await bridge.command('setScreen', {
      screenId: 'screen-c',
      props: {
        ...screenLayouts['screen-c'],
        clearMedia: true,
        label: screens.traceLabel,
        text: screens.traceText,
      },
      select: false,
    });
    return screens;
  };

  const applyBaseSceneState = async (bridge: SceneBridgeLike) => {
    await bridge.command('setEnvironmentMode', { mode: environmentMode });
    await bridge.command('setCameraShot', { shot: cameraShot, immediate: true });
    await bridge.command('setCameraMotion', {
      enabled: baseCameraMotion.enabled,
      speed: baseCameraMotion.speed,
    });
    await applySceneLightRig(bridge, baseLightRig);
    await bridge.command('setStatePartial', {
      presentationMode: 'profile',
      heroTitleText: '',
      titleSync: false,
      advancedPanelVisible: false,
      autoEntityTab: false,
      contextFocus: true,
      uiMode: 'basic',
      panelTab: 'render',
      autoQuality: true,
      performanceTier: 'balanced',
      beatPulse: baseBeatPulse,
      modelFloat: baseModelFloat,
      modelScale: portraitModelState.modelScale,
      modelYaw: portraitModelState.modelYaw,
      modelPosX: portraitModelState.modelPosX,
      modelPosY: portraitModelState.modelPosY,
      hideLightSource: baseHideLightSource,
      showLightMarkers: false,
      ringPulse: baseRingPulse,
      groundMotion: baseGroundMotion,
      ambientAtmosphere: baseAmbientAtmosphere,
    });
    const screens = await applySceneScreens(
      bridge,
      currentScreenMode,
      heldSceneState?.contextTitle,
      heldSceneState?.contextNote
    );
    return screens;
  };

  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge || !capabilities || sceneStatus === 'error') return;

    let cancelled = false;
    const syncScene = async () => {
      setSceneStatus('syncing');
      setStatusMessage('Syncing stage');

      try {
        const screens = await applyBaseSceneState(bridge);
        if (!cancelled) {
          setSceneStatus('ready');
          setStatusMessage('Stage ready');
          emitEvent('profile.scene.sync', {
            source: 'scene',
            metadata: {
              environmentMode,
              cameraShot,
              stageState,
              sceneProfile: activeSceneProfile,
              avatarProfile: activeAvatarProfile,
              sceneStateKey: effectiveSceneStateKey,
              screenMode: currentScreenMode,
              sceneStateMode: heldSceneState ? 'held' : 'default',
              triggerEvent: heldSceneState?.eventName || null,
              previewScenario: heldSceneState?.previewScenario || null,
              identityBadge: currentAvatarPreset?.identityBadge ?? null,
              avatarPresenceLabel: activeAvatarPresencePreset?.label ?? null,
              avatarPresenceStateOverride: activeAvatarPresencePreset?.sceneStateOverride ?? null,
              avatarPresenceScreenModeOverride: activeAvatarPresencePreset?.screenModeOverride ?? null,
              shellLabel: currentAvatarPreset?.shellLabel ?? null,
              relayLabel: currentAvatarPreset?.relayLabel ?? null,
              statusLabel: activeAvatarPresencePreset?.statusLabel ?? currentAvatarPreset?.statusLabel ?? null,
              loadoutTitle: currentAvatarPreset?.loadoutTitle ?? null,
              loadoutSlotSummary:
                currentAvatarPreset?.loadoutSlots?.map((slot) => slot.label).join(' • ') ?? null,
              loadoutBindingSummary:
                currentAvatarPreset?.loadoutSlots?.map((slot) => slot.binding).join(' • ') ?? null,
              loadoutSlotCount: currentAvatarPreset?.loadoutSlots?.length ?? 0,
              loadoutOccupancyState,
              occupiedLoadoutSlots,
              totalLoadoutSlots,
              missingLoadoutBindings,
              keyLight: baseLightRig?.keyIntensity ?? null,
              fillLight: baseLightRig?.fillIntensity ?? null,
              keyLightColor: baseLightRig?.keyColor ?? null,
              fillLightColor: baseLightRig?.fillColor ?? null,
              missionLabel: screens.missionLabel,
              roleLabel: screens.roleLabel,
              traceLabel: screens.traceLabel,
            },
          });
        }
      } catch (error) {
        if (!cancelled) {
          setSceneStatus('error');
          setStatusMessage(error instanceof Error ? error.message : 'Scene sync failed.');
          emitEvent('profile.scene.error', {
            source: 'scene',
            metadata: {
              message: error instanceof Error ? error.message : 'Profile scene sync failed.',
            },
          });
        }
      }
    };

    void syncScene();
    return () => {
      cancelled = true;
    };
  }, [
    cameraShot,
    capabilities,
    completedToday,
    environmentMode,
    missionText,
    plan,
    roleText,
    stageState,
    stationLabel,
    totalXP,
    traceText,
    emitEvent,
    activeSceneProfile,
    activeAvatarProfile,
    baseAmbientAtmosphere,
    baseBeatPulse,
    baseCameraMotion,
    baseGroundMotion,
    baseHideLightSource,
    baseLightRig,
    baseModelFloat,
    portraitModelState,
    baseRingPulse,
    currentScreenMode,
    currentScreenPreset,
    currentAvatarPreset,
    activeAvatarPresencePreset?.label,
    activeAvatarPresencePreset?.sceneStateOverride,
    activeAvatarPresencePreset?.screenModeOverride,
    activeAvatarPresencePreset?.statusLabel,
    defaultSceneStateKey,
    effectiveSceneStateKey,
    heldSceneState,
    loadoutOccupancyState,
    occupiedLoadoutSlots,
    totalLoadoutSlots,
    missingLoadoutBindings,
    creativeState,
    sceneProfileOverride,
  ]);

  useEffect(() => {
    const handleSceneCue = (event: Event) => {
      const customEvent = event as CustomEvent<SceneCueRequest>;
      const request = customEvent.detail;
      const bridge = bridgeRef.current;
      if (!bridge || !request?.cue) return;

      const runCue = async () => {
        try {
          if (request.cue.environmentMode) {
            await bridge.command('setEnvironmentMode', { mode: request.cue.environmentMode });
          }
          const cueMotion = resolveCueCameraMotion(
            request.cue.transitionStyle,
            request.cue.cameraOrbitSpeed
          );
          if (request.cue.cameraShot) {
            await bridge.command('setCameraShot', {
              shot: request.cue.cameraShot,
              immediate: resolveCueTransitionImmediate(request.cue.transitionStyle),
            });
          }
          await bridge.command('setCameraMotion', {
            enabled: cueMotion.enabled,
            speed: cueMotion.speed,
          });
          await applySceneLightRig(bridge, request.cue.lightRig);
          await bridge.command('setStatePartial', {
            presentationMode: 'profile',
            beatPulse: request.cue.beatPulse,
            ringPulse: request.cue.ringPulse,
            groundMotion: request.cue.groundMotion,
            ambientAtmosphere: request.cue.ambientAtmosphere,
          });
          const screens = await applySceneScreens(
            bridge,
            request.cue.screenMode || currentScreenMode,
            heldSceneState?.contextTitle,
            heldSceneState?.contextNote
          );
          setStatusMessage(`Cue • ${formatSceneEventLabel(request.eventName) || 'update'}`);
          emitEvent('profile.scene.cue.applied', {
            source: 'scene',
            metadata: {
              eventName: request.eventName,
              previewScenario:
                typeof request.metadata?.previewScenario === 'string'
                  ? request.metadata.previewScenario
                  : null,
              environmentMode: request.cue.environmentMode,
              cameraShot: request.cue.cameraShot,
              screenMode: request.cue.screenMode || currentScreenMode,
              avatarProfile: activeAvatarProfile,
              identityBadge: currentAvatarPreset?.identityBadge ?? null,
              avatarPresenceLabel: activeAvatarPresencePreset?.label ?? null,
              avatarPresenceStateOverride: activeAvatarPresencePreset?.sceneStateOverride ?? null,
              avatarPresenceScreenModeOverride: activeAvatarPresencePreset?.screenModeOverride ?? null,
              loadoutBindingSummary:
                currentAvatarPreset?.loadoutSlots?.map((slot) => slot.binding).join(' • ') ?? null,
              loadoutOccupancyState,
              occupiedLoadoutSlots,
              totalLoadoutSlots,
              missingLoadoutBindings,
              transitionStyle: request.cue.transitionStyle,
              cameraOrbitSpeed: request.cue.cameraOrbitSpeed,
              keyLight: request.cue.lightRig?.keyIntensity ?? null,
              fillLight: request.cue.lightRig?.fillIntensity ?? null,
              keyLightColor: request.cue.lightRig?.keyColor ?? null,
              fillLightColor: request.cue.lightRig?.fillColor ?? null,
              missionLabel: screens.missionLabel,
              roleLabel: screens.roleLabel,
              traceLabel: screens.traceLabel,
            },
          });
          if (cueResetTimerRef.current) {
            window.clearTimeout(cueResetTimerRef.current);
          }
          cueResetTimerRef.current = window.setTimeout(() => {
            void applyBaseSceneState(bridgeRef.current as SceneBridgeLike).catch(() => {});
          }, request.cue.cueDurationMs);
        } catch (error) {
          emitEvent('profile.scene.cue.error', {
            source: 'scene',
            metadata: {
              eventName: request.eventName,
              previewScenario:
                typeof request.metadata?.previewScenario === 'string'
                  ? request.metadata.previewScenario
                  : null,
              message: error instanceof Error ? error.message : 'Scene cue failed.',
            },
          });
        }
      };

      void runCue();
    };

    window.addEventListener(XTATION_SCENE_CUE_EVENT, handleSceneCue as EventListener);
    return () => {
      window.removeEventListener(XTATION_SCENE_CUE_EVENT, handleSceneCue as EventListener);
    };
  }, [
    activeAvatarProfile,
    currentAvatarPreset,
    activeAvatarPresencePreset?.label,
    activeAvatarPresencePreset?.roleFallbackText,
    activeAvatarPresencePreset?.sceneStateOverride,
    activeAvatarPresencePreset?.screenModeOverride,
    currentScreenMode,
    emitEvent,
    heldSceneState?.contextNote,
    heldSceneState?.contextTitle,
    loadoutOccupancyState,
    occupiedLoadoutSlots,
    totalLoadoutSlots,
    missingLoadoutBindings,
    missionText,
    roleText,
    traceText,
  ]);

  const connectScene = async () => {
    const frame = iframeRef.current;
    if (!frame) return;
    injectHostSceneStyles(frame);
    bridgeCleanupRef.current?.();
    bridgeCleanupRef.current = null;
    bridgeRef.current?.destroy?.();
    bridgeRef.current = null;

    setSceneStatus('booting');
    setStatusMessage('Linking stage');
    try {
      const directBridge = await waitForDirectBridge(frame, 14000);
      let nextBridge: SceneBridgeLike | null = directBridge;
      if (!nextBridge) {
        nextBridge = createSceneApiClient({
          target: frame,
          targetOrigin: window.location.origin,
        });
      }
      bridgeRef.current = nextBridge;

      if (nextBridge.onEvent) {
        const stop = nextBridge.onEvent((event) => {
          setLastSceneRuntimeEvent(event);
          if (event.name === 'ready') {
            setStatusMessage('Stage linked');
            emitEvent('profile.scene.runtime.ready', {
              source: 'scene',
              metadata: {
                eventName: event.name,
                avatarProfile: activeAvatarProfile,
                identityBadge: currentAvatarPreset?.identityBadge ?? null,
                avatarPresenceLabel: activeAvatarPresencePreset?.label ?? null,
                avatarPresenceStateOverride: activeAvatarPresencePreset?.sceneStateOverride ?? null,
                avatarPresenceScreenModeOverride: activeAvatarPresencePreset?.screenModeOverride ?? null,
                loadoutBindingSummary:
                  currentAvatarPreset?.loadoutSlots?.map((slot) => slot.binding).join(' • ') ?? null,
                loadoutOccupancyState,
                occupiedLoadoutSlots,
                totalLoadoutSlots,
                missingLoadoutBindings,
              },
            });
          }
        });
        if (typeof stop === 'function') {
          bridgeCleanupRef.current = stop;
        }
      }

      const hello = await nextBridge.hello('1.0');
      if (!isSuccessfulResponse(hello)) {
        throw new Error(hello.error?.message || 'Scene handshake failed.');
      }
      const nextCapabilities = nextBridge.getCapabilities
        ? await nextBridge.getCapabilities()
        : null;
      setCapabilities(nextCapabilities);
      setSceneStatus('ready');
      setStatusMessage('Stage ready');
      emitEvent('profile.scene.connected', {
        source: 'scene',
        metadata: {
          environmentMode,
          cameraShot,
          sceneProfile: activeSceneProfile,
          avatarProfile: activeAvatarProfile,
          avatarPresenceLabel: activeAvatarPresencePreset?.label ?? null,
          avatarPresenceStateOverride: activeAvatarPresencePreset?.sceneStateOverride ?? null,
          avatarPresenceScreenModeOverride: activeAvatarPresencePreset?.screenModeOverride ?? null,
          commands: nextCapabilities?.commands.length ?? 0,
          loadoutOccupancyState,
          occupiedLoadoutSlots,
          totalLoadoutSlots,
          missingLoadoutBindings,
        },
      });
    } catch (error) {
      setSceneStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Scene runtime failed to start.');
      emitEvent('profile.scene.error', {
        source: 'scene',
        metadata: {
          message: error instanceof Error ? error.message : 'Scene runtime failed to start.',
        },
      });
    }
  };

  const handleSceneReload = useCallback(() => {
    emitEvent('profile.scene.reload', {
      source: 'scene',
      metadata: {
        environmentMode,
        cameraShot,
      },
    });
    setCapabilities(null);
    setLastSceneRuntimeEvent(null);
    setSceneStatus('booting');
    setStatusMessage('Reloading stage');
    setReloadNonce((value) => value + 1);
  }, [cameraShot, emitEvent, environmentMode]);

  const statusTone =
    sceneStatus === 'error' ? 'error' : sceneStatus === 'ready' ? 'ready' : 'syncing';
  const effectiveStateLabel = formatRuntimeKey(effectiveSceneStateKey);
  const baseStateLabel = formatRuntimeKey(effectiveBaseSceneStateKey);
  const statusLabel =
    activeAvatarPresencePreset?.statusLabel || currentAvatarPreset?.statusLabel || 'Profile scene';
  const relayLabel = currentAvatarPreset?.relayLabel || 'Profile Relay';
  const holdEventLabel = formatSceneEventLabel(heldSceneState?.eventName);
  const hudStatusCopy =
    sceneStatus === 'error'
      ? statusMessage
      : isHoldingSceneState
      ? holdEventLabel
        ? `Cue live • ${holdEventLabel}`
        : 'Cue live'
      : statusMessage;
  const relayTitle =
    currentMissionTitle ||
    currentAvatarPreset?.identityBadge ||
    activeAvatarPresencePreset?.label ||
    'Standby station';
  const relayBadge =
    currentAvatarPreset?.identityBadge &&
    currentAvatarPreset.identityBadge.trim().toLowerCase() !== relayTitle.trim().toLowerCase()
      ? currentAvatarPreset.identityBadge
      : null;
  const relayCopy = activeSessionLabel || `${plan.toUpperCase()} • ${stationLabel}`;
  const relayStateCopy = isHoldingSceneState
    ? holdEventLabel
      ? `cue • ${holdEventLabel}`
      : 'cue active'
    : `state • ${baseStateLabel}`;
  const loadoutMetaCopy =
    loadoutOccupancyState === 'ready'
      ? `loadout • ${loadoutStatusLine}`
      : `loadout • ${occupiedLoadoutSlots}/${totalLoadoutSlots} • ${loadoutOccupancyState}`;

  return (
    <div className="absolute inset-0">
      <div className="xt-profile-scene-shell absolute inset-0 overflow-hidden rounded-[18px]">
        <iframe
          key={reloadNonce}
          ref={iframeRef}
          src={SCENE_SRC}
          title="XTATION Profile Lobby Scene"
          className="xt-profile-scene-iframe absolute inset-0 border-0"
          style={{
            width: '103%',
            height: '103%',
            marginLeft: '-1.5%',
            marginTop: '-1%',
            transform: 'scale(1)',
            transformOrigin: 'center center',
            background: 'transparent',
          }}
          allow="autoplay; xr-spatial-tracking; fullscreen"
          onLoad={() => {
            emitEvent('profile.scene.load', {
              source: 'scene',
              metadata: {
                presentationMode: 'profile',
              },
            });
            void connectScene();
          }}
        />
      </div>

      <div className="absolute inset-0 pointer-events-none">
        <div className="xt-profile-scene-spotlight" />
        <div className="xt-profile-scene-silhouette-glow" />
        <div className="xt-profile-scene-focus-frame" />
        <div className="xt-profile-scene-focus-core" />
        <div
          className="absolute left-1/2 top-[20%] h-[48vh] w-[24vw] min-w-[220px] max-w-[300px] -translate-x-1/2 rounded-[50%]"
          style={{
            background:
              'radial-gradient(circle at center, color-mix(in srgb, var(--app-accent) 12%, rgba(255,255,255,0.09)) 0%, color-mix(in srgb, var(--app-accent) 8%, transparent) 34%, transparent 76%)',
            filter: 'blur(28px)',
            opacity: 0.3,
          }}
        />
        <div
          className="absolute left-1/2 top-[13%] bottom-[18%] w-px -translate-x-1/2"
          style={{
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--app-accent) 22%, transparent), color-mix(in srgb, var(--app-accent) 4%, transparent) 28%, transparent 100%)',
            opacity: 0.16,
          }}
        />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/48 via-black/18 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/58 via-black/20 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/52 via-black/20 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/56 via-black/22 to-transparent" />
        <div
          className="absolute inset-x-[14%] bottom-[8%] h-20"
          style={{
            background:
              'radial-gradient(ellipse at center, color-mix(in srgb, var(--app-accent) 18%, transparent) 0%, transparent 72%)',
            opacity: 0.86,
          }}
        />
        <div className="xt-profile-scene-floor-glow" />
      </div>

      {/* Minimal connection indicator — always visible */}
      {sceneStatus !== 'ready' ? (
        <div className="absolute left-4 top-4 z-10">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-black/40 backdrop-blur-sm pointer-events-none">
            {sceneStatus === 'error' ? <AlertCircle size={11} className="text-red-400/80" /> : <Loader2 size={11} className="animate-spin text-white/50" />}
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/50">{sceneStatus === 'error' ? 'Scene error' : 'Linking'}</span>
            {sceneStatus === 'error' ? (
              <button
                type="button"
                onClick={handleSceneReload}
                className="xt-runtime-action xt-runtime-action--compact pointer-events-auto"
                aria-label="Retry profile scene"
                title="Retry profile scene"
              >
                <RefreshCw size={11} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Verbose debug HUD — dev mode only */}
      {import.meta.env.DEV && settings.device.devHudEnabled ? (
        <div className="absolute left-4 top-4 right-4 z-10 flex items-start justify-between gap-3">
          <div className="xt-runtime-hud xt-runtime-hud--compact">
            <div className="xt-runtime-hud-card xt-runtime-hud-card--compact pointer-events-auto" data-tone={statusTone}>
              <div className="xt-runtime-hud-row">
                <div className="xt-runtime-hud-label">
                  {sceneStatus === 'error' ? <AlertCircle size={13} /> : sceneStatus === 'ready' ? <Box size={13} /> : <Loader2 size={13} className="animate-spin" />}
                  <span>{statusLabel}</span>
                </div>
                <div className="xt-runtime-hud-chip">{effectiveStateLabel}</div>
              </div>
              <div className="xt-runtime-hud-meta xt-runtime-hud-meta--compact">
                <span>{hudStatusCopy}</span>
                <span>{environmentMode}</span>
                <span>{cameraShot}</span>
                <span>{currentScreenMode}</span>
              </div>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleSceneReload}
              className="xt-runtime-action xt-runtime-action--compact"
              aria-label="Reload Scene"
              title="Reload Scene"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>
      ) : null}

      <div className="absolute left-4 bottom-4 z-10 max-w-[420px] pointer-events-none">
        <div className="xt-runtime-relay">
          {relayBadge ? (
            <div className="xt-runtime-relay-badge">
              {relayBadge}
            </div>
          ) : null}
          <div className="xt-runtime-relay-title">{relayTitle}</div>
          <div className="xt-runtime-relay-copy">{relayCopy}</div>
          <div className="xt-runtime-relay-meta">{loadoutMetaCopy}</div>
        </div>
      </div>
    </div>
  );
};
