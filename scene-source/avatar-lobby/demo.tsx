import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

type PresetKey = "studio" | "noir" | "neon";
type CameraShotKey = "hero" | "mid" | "wide";
type GradeKey = "clean" | "film" | "cold";
type CompareSlotKey = "a" | "b" | "c";
type QualityMode = "draft" | "final";
type EnvironmentModeKey = "core" | "light" | "dusk" | "glacier" | "mono" | "bureau";
type FloorMode = "topo" | "grid" | "pulse" | "scan" | "none";
type ParticleStyle = "dust" | "embers" | "snow" | "orbit-balls" | "ribbons" | "glyphs" | "shards" | "beams";
type SecondaryParticleStyle = ParticleStyle | "none";
type ModelMaterialMode = "original" | "clay" | "wire" | "hologram";
type HdriPresetKey = "off" | "studio" | "sunset" | "city" | "custom";
type FxPresetKey = "halo" | "storm" | "glyph-net" | "snow-room" | "arc-reactor" | "crystal-drift" | "beam-cage" | "dual-mix";
type ProviderName = "youtube" | "vimeo";
type PlaybackAuthority = "scene" | "dock" | "api" | "timeline";
type ScreenSourceMode = "auto" | "integrated" | "provider";
type MediaDockMode = "inspector" | "player";
type SceneSelectionKind = "none" | "screen" | "light-key" | "light-fill" | "light-target" | "model";
type ScreenAttachmentMode = "world" | "follow-pos" | "follow-pos-yaw" | "follow-full";
type LightFollowPoint = "rig" | "hips";
type AudioPolicy = "normal" | "solo" | "background" | "duck";
type PerformanceTier = "ultra" | "balanced" | "fast";

type ScenePreset = {
  ambientSky: string;
  ambientGround: string;
  ambientIntensity: number;
  keyColor: string;
  keyIntensity: number;
  fillColor: string;
  fillIntensity: number;
  ringColorA: string;
  ringColorB: string;
  floorColor: string;
  bloom: number;
  fogColor: string;
  fogAmount: number;
};

type ShotConfig = {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
};

type GradeConfig = {
  exposure: number;
  bloomBoost: number;
  vignetteOffset: number;
  vignetteDarkness: number;
};

type UiMode = "basic" | "pro";
type PanelTab = "scene" | "lighting" | "fx" | "model" | "render";
type CategoryIcon = "scene" | "lighting" | "fx" | "model" | "render";
type PresentationMode = "editor" | "profile";
type FocusSection =
  | "scene"
  | "camera"
  | "orbit"
  | "lighting"
  | "post"
  | "fx"
  | "model"
  | "presets"
  | "motion"
  | "constraints"
  | "capture"
  | "debug";

type LightRigState = {
  lightAnchorMode: "follow" | "world";
  worldAnchorX: number;
  worldAnchorY: number;
  worldAnchorZ: number;
  keyAzimuth: number;
  keyElevation: number;
  keyDistance: number;
  fillAzimuth: number;
  fillElevation: number;
  fillDistance: number;
  keyOffsetX: number;
  keyOffsetY: number;
  keyOffsetZ: number;
  fillOffsetX: number;
  fillOffsetY: number;
  fillOffsetZ: number;
  keyColor: string;
  keyIntensity: number;
  fillColor: string;
  fillIntensity: number;
  hideLightSource: boolean;
};

type RigKeyframe = {
  id: string;
  name: string;
  t: number;
  rig: LightRigState;
};

type LightPaintPoint = {
  azimuth: number;
  elevation: number;
  distance: number;
};

type ModelStats = {
  meshes: number;
  triangles: number;
  vertices: number;
  materials: number;
  animations: number;
  skinnedMeshes: number;
};

type HdriPreset = {
  label: string;
  url: string;
};

type ScreenCard = {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  width: number;
  height: number;
  bend: number;
  text: string;
  mediaUrl: string | null;
  mediaOriginalUrl?: string | null;
  mediaKind: "none" | "image" | "gif" | "video" | "provider";
  mediaSourceType: SceneApiSourceType;
  mediaProvider: ProviderName | null;
  mediaEmbedBase: string | null;
  sourceMode: ScreenSourceMode;
  mediaPlaying: boolean;
  mediaMuted: boolean;
  audioUrl: string | null;
  audioPlaying: boolean;
  audioOnly: boolean;
  audioPolicy: AudioPolicy;
  showFrame: boolean;
  visible: boolean;
  shape: "panel" | "round" | "diamond";
};

type SceneSettings = {
  preset: PresetKey;
  shot: CameraShotKey;
  grade: GradeKey;
  presentationMode: PresentationMode;
  uiMode: UiMode;
  panelTab: PanelTab;
  advancedPanelVisible: boolean;
  autoEntityTab: boolean;
  inspectorLock: boolean;
  contextFocus: boolean;
  environmentMode: EnvironmentModeKey;
  environmentAutoHdri: boolean;
  environmentObjectImpact: number;
  shotLinkedRigs: boolean;
  minLightHeight: number;
  maxLightDistance: number;
  stayLightsInFront: boolean;
  avoidBodyIntersection: boolean;
  bodyClearance: number;
  timelineDuration: number;
  timelineLoop: boolean;
  lightAnchorMode: "follow" | "world";
  lightFollowPoint: LightFollowPoint;
  worldAnchorX: number;
  worldAnchorY: number;
  worldAnchorZ: number;
  showLightMarkers: boolean;
  lockLightsAboveGround: boolean;
  activeOrbitalLight: "key" | "fill";
  keyAzimuth: number;
  keyElevation: number;
  keyDistance: number;
  fillAzimuth: number;
  fillElevation: number;
  fillDistance: number;
  keyColor: string;
  keyIntensity: number;
  keyOffsetX: number;
  keyOffsetY: number;
  keyOffsetZ: number;
  fillColor: string;
  fillIntensity: number;
  fillOffsetX: number;
  fillOffsetY: number;
  fillOffsetZ: number;
  hideLightSource: boolean;
  lightGain: number;
  lightSoftness: number;
  floorMode: FloorMode;
  groundGloss: number;
  groundMotion: boolean;
  particleStyle: ParticleStyle;
  secondaryParticleStyle: SecondaryParticleStyle;
  effectBlend: number;
  effectAmount: number;
  effectSpeed: number;
  effectScale: number;
  effectSpread: number;
  orbitCenterLift: number;
  bloomStrength: number;
  fogAmount: number;
  ambientAtmosphere: number;
  atmosphereSpread: number;
  autoOrbit: boolean;
  ringPulse: boolean;
  ringImpact: number;
  particlesEnabled: boolean;
  particleDensity: number;
  titleSync: boolean;
  beatPulse: boolean;
  modelPosX: number;
  modelPosY: number;
  modelPosZ: number;
  modelYaw: number;
  modelScale: number;
  modelFloat: boolean;
  modelAnimationPlaying: boolean;
  modelAnimationSpeed: number;
  modelMaterialMode: ModelMaterialMode;
  modelTint: string;
  modelMetalness: number;
  modelRoughness: number;
  screenAttachmentMode: ScreenAttachmentMode;
  autoFitMediaAspect: boolean;
  mediaFidelity: number;
  performanceTier: PerformanceTier;
  autoQuality: boolean;
  cameraFovOffset: number;
  cameraDamping: number;
  cameraOrbitSpeed: number;
  cameraNear: number;
  cameraFar: number;
  hdriPreset: HdriPresetKey;
  hdriIntensity: number;
  hdriRotation: number;
  hdriBackground: boolean;
  hdriBlur: number;
  hdriExposure: number;
  heroTitleText: string;
};

type SavedScenePreset = {
  id: string;
  name: string;
  updatedAt: number;
  settings: SceneSettings;
};

type SceneApiInspectorLogKind = "command" | "response" | "event" | "error" | "info";

type SceneApiInspectorEntry = {
  id: string;
  ts: number;
  kind: SceneApiInspectorLogKind;
  name: string;
  summary: string;
};

type SceneApiMacro = {
  id: string;
  name: string;
  command: SceneApiCommandName;
  payload: string;
  tags: string[];
  pinned: boolean;
  updatedAt: number;
};

type SceneApiTemplateVar = {
  id: string;
  key: string;
  value: string;
};

type SceneApiSequenceStep = {
  id: string;
  macroId: string;
  delayMs: number;
  enabled: boolean;
};

type SceneApiSequence = {
  id: string;
  name: string;
  steps: SceneApiSequenceStep[];
  stopOnError: boolean;
  updatedAt: number;
};

type SceneApiCommandHistoryEntry = {
  id: string;
  ts: number;
  command: SceneApiCommandName;
  payloadText: string;
  resolvedPayloadText: string;
  source: "manual" | "macro" | "sequence" | "replay";
  context: string;
  ok: boolean;
  attempts: number;
  summary: string;
};

type ApiTimeoutPreset = "fast" | "balanced" | "reliable" | "custom";

type PendingProfileImport = {
  fileName: string;
  sceneSettings: SceneSettings | null;
  sceneDiffKeys: string[];
  macros: SceneApiMacro[];
  templateVars: SceneApiTemplateVar[];
  sequences: SceneApiSequence[];
  macroDiff: {
    add: number;
    update: number;
  };
  templateVarDiff: {
    add: number;
    update: number;
  };
  sequenceDiff: {
    add: number;
    update: number;
  };
  execution: {
    timeoutPreset: ApiTimeoutPreset | null;
    timeoutCustomMs: number | null;
    retryCount: number | null;
    confirmDestructive: boolean | null;
  };
  hideStateChanged: boolean | null;
};

const SCENE_API_CHANNEL = "xtation.scene";
const SCENE_API_VERSION = "1.0";
const SCENE_API_IDEMPOTENCY_TTL_MS = 45_000;
/*
Scene API Quick Notes (Host Integration):
1) Use channel "xtation.scene" for all command/response/event messages.
2) Start with command "hello" to receive sessionId + capabilities + ready event.
3) Include the returned sessionId in every later command.
4) Envelope keys: channel, sessionId, apiVersion, kind, domain, name, requestId, payload.
5) kind = command | response | event, domain = "scene".
6) For postMessage mode, configure allowed origins via window.__XTATION_SCENE_ALLOWED_ORIGINS__.
7) stateVersion increments on each committed scene change and is returned in responses/events.
8) Long side-effect commands support idempotencyKey (captureStill/exportPack).
9) Use getCapabilities before advanced automation flows.
10) Media telemetry events include screenMediaChanged, providerLoading/providerReady/providerState/mediaError.
11) API payload templates support ${var} placeholders (e.g. ${activeScreenId}, ${timestamp}, ${sessionId}).
*/
const SCENE_API_COMMANDS = [
  "hello",
  "getState",
  "getCapabilities",
  "setStatePartial",
  "applyPreset",
  "setEnvironmentMode",
  "setHdriProfile",
  "setCameraShot",
  "setCameraMotion",
  "setLight",
  "setScreen",
  "setScreenMedia",
  "setScreenAudio",
  "playPauseMedia",
  "captureStill",
  "exportPack",
] as const;
const SCENE_API_EVENTS = [
  "ready",
  "stateChanged",
  "commandAccepted",
  "commandCompleted",
  "commandFailed",
  "selectionChanged",
  "playbackOwnerChanged",
  "screenMediaChanged",
  "screenRemoved",
  "providerPlaybackSync",
  "providerMuteSync",
  "providerReady",
  "providerLoading",
  "providerState",
  "mediaError",
] as const;
const SCENE_API_ERROR_CODES = [
  "INVALID_REQUEST",
  "UNSUPPORTED_COMMAND",
  "VALIDATION_FAILED",
  "UNAUTHORIZED_ORIGIN",
  "RATE_LIMITED",
  "BUSY",
  "TIMEOUT",
  "CORS_BLOCKED",
  "MEDIA_UNSUPPORTED",
  "INTERNAL_ERROR",
] as const;

type SceneApiCommandName = (typeof SCENE_API_COMMANDS)[number];
type SceneApiKind = "command" | "response" | "event";
type SceneApiErrorCode = (typeof SCENE_API_ERROR_CODES)[number];
type SceneApiSourceType = "directUrl" | "provider" | "localAsset";
type SceneApiOriginKind = "host" | "scene";
type SceneApiAdapterSource = "window" | "postMessage";

type SceneApiError = {
  code: SceneApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
};

type SceneApiEnvelopeBase = {
  channel: string;
  sessionId: string;
  apiVersion: string;
  kind: SceneApiKind;
  domain: "scene";
  name: string;
  requestId: string;
  ts: number;
  origin: SceneApiOriginKind;
};

type SceneApiCommandMessage = SceneApiEnvelopeBase & {
  kind: "command";
  origin: "host";
  name: SceneApiCommandName;
  payload?: unknown;
  idempotencyKey?: string;
  expectedStateVersion?: number;
  timeoutMs?: number;
};

type SceneApiResponseMessage = SceneApiEnvelopeBase & {
  kind: "response";
  origin: "scene";
  ok: boolean;
  result: unknown;
  error: SceneApiError | null;
  stateVersion: number;
};

type SceneApiEventMessage = SceneApiEnvelopeBase & {
  kind: "event";
  origin: "scene";
  payload: unknown;
  stateVersion: number;
};

type SceneApiCapabilities = {
  apiVersion: string;
  supportedApiVersions: string[];
  channel: string;
  commands: SceneApiCommandName[];
  events: string[];
  errors: SceneApiErrorCode[];
  limits: {
    maxScreens: number;
    supportedProviders: string[];
    maxTextureSize: number;
    captureFormats: Array<"png" | "jpg">;
    exportFormats: string[];
    maxModelUploadMB: number;
  };
  execution: {
    minTimeoutMs: number;
    defaultTimeoutMs: number;
    maxTimeoutMs: number;
    maxRetryCount: number;
    idempotencyTtlMs: number;
  };
  featureFlags: {
    providerMedia: boolean;
    serverMediaResolver: boolean;
    stateVersioning: boolean;
    idempotency: boolean;
    postMessageBridge: boolean;
    windowBridge: boolean;
    screenDirectManipulation: boolean;
    lightDirectManipulation: boolean;
  };
};

type SceneApiCommandMeta = {
  source: SceneApiAdapterSource;
  origin: string;
  sourceWindow?: Window;
};

type SceneApiClient = {
  source: Window;
  origin: string;
};

type SceneApiWindowBridge = {
  readonly channel: string;
  readonly apiVersion: string;
  getSessionId: () => string;
  hello: (requestedVersion?: string) => Promise<SceneApiResponseMessage>;
  send: (command: Partial<SceneApiCommandMessage>) => Promise<SceneApiResponseMessage>;
  command: (
    name: SceneApiCommandName,
    payload?: unknown,
    options?: {
      requestId?: string;
      idempotencyKey?: string;
      expectedStateVersion?: number;
      timeoutMs?: number;
    }
  ) => Promise<SceneApiResponseMessage>;
  getState: () => SceneSettings;
  getCapabilities: () => SceneApiCapabilities;
  onEvent: (listener: (event: SceneApiEventMessage) => void) => () => void;
};

const SCENE_API_READ_COMMAND_SET = new Set<SceneApiCommandName>(["hello", "getState", "getCapabilities"]);
const SCENE_API_SIDE_EFFECT_COMMAND_SET = new Set<SceneApiCommandName>(["captureStill", "exportPack"]);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value !== "boolean") return null;
  return value;
};

const normalizeAudioPolicy = (value: unknown): AudioPolicy =>
  value === "solo" || value === "background" || value === "duck" ? value : "normal";

const hasAudibleScreenSource = (card: ScreenCard) => {
  if (card.audioUrl) return card.audioPlaying;
  if (card.mediaKind === "video" || card.mediaKind === "provider") {
    return card.mediaPlaying && !card.mediaMuted;
  }
  return false;
};

const collectSoloAudioScreenIds = (cards: ScreenCard[]) => {
  const soloIds = new Set<string>();
  cards.forEach((card) => {
    if (normalizeAudioPolicy(card.audioPolicy) !== "solo") return;
    if (!hasAudibleScreenSource(card)) return;
    soloIds.add(card.id);
  });
  return soloIds;
};

const resolveAudioPolicyGain = (policy: AudioPolicy, hasSolo: boolean) => {
  if (policy === "background") return hasSolo ? 0 : 0.34;
  if (policy === "duck") return hasSolo ? 0.16 : 0.72;
  return 1;
};

const vec3Changed = (
  prev: { x: number; y: number; z: number },
  next: { x: number; y: number; z: number },
  epsilon = 0.01
) =>
  Math.abs(prev.x - next.x) > epsilon ||
  Math.abs(prev.y - next.y) > epsilon ||
  Math.abs(prev.z - next.z) > epsilon;

const createSceneApiId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `scene-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
};

const resolveInitialPresentationMode = (): PresentationMode => {
  if (typeof window === "undefined") return "editor";
  try {
    const mode = new URLSearchParams(window.location.search).get("presentation");
    return mode === "profile" ? "profile" : "editor";
  } catch {
    return "editor";
  }
};

const toSceneApiCommandName = (value: unknown): SceneApiCommandName | null => {
  if (typeof value !== "string") return null;
  return (SCENE_API_COMMANDS as readonly string[]).includes(value) ? (value as SceneApiCommandName) : null;
};

const safeUpperUrl = (value: string) => value.trim();

declare global {
  interface Window {
    xtationScene?: SceneApiWindowBridge;
    __XTATION_SCENE_ALLOWED_ORIGINS__?: string[];
  }
}

const DEFAULT_MODEL_SRC = `${import.meta.env.BASE_URL}models/male_anatomy.glb`;
const SERVER_MEDIA_MODE = (import.meta.env.VITE_SERVER_MEDIA_MODE ?? "auto").toLowerCase();
const SERVER_MEDIA_MODE_FULL = SERVER_MEDIA_MODE === "full";
const SERVER_MEDIA_MODE_SAFE = SERVER_MEDIA_MODE === "safe";
const PRESET_STORAGE_KEY = "halide-scene-presets-v1";
const COMPARE_STORAGE_KEY = "halide-compare-slots-v1";
const PANEL_POSITION_STORAGE_KEY = "halide-panel-position-v1";
const API_MACROS_STORAGE_KEY = "halide-api-macros-v1";
const API_TEMPLATE_VARS_STORAGE_KEY = "halide-api-template-vars-v1";
const API_SEQUENCES_STORAGE_KEY = "halide-api-sequences-v1";
const API_HISTORY_STORAGE_KEY = "halide-api-history-v1";
const MEDIA_UI_STORAGE_KEY = "halide-media-ui-v1";
const SCREEN_GEOMETRY_WIDTH = 1.2;
const SCREEN_GEOMETRY_HEIGHT = 0.75;
const SCREEN_GEOMETRY_ASPECT = SCREEN_GEOMETRY_WIDTH / SCREEN_GEOMETRY_HEIGHT;
const SCREEN_HALF_WIDTH = SCREEN_GEOMETRY_WIDTH * 0.5;
const SCREEN_HALF_HEIGHT = SCREEN_GEOMETRY_HEIGHT * 0.5;

const DESTRUCTIVE_API_COMMANDS = new Set<SceneApiCommandName>([
  "setStatePartial",
  "setEnvironmentMode",
  "setHdriProfile",
  "setCameraShot",
  "setLight",
  "setScreen",
  "setScreenMedia",
  "setScreenAudio",
  "playPauseMedia",
  "exportPack",
]);

type EnvironmentModeHdriProfile = {
  preset: Exclude<HdriPresetKey, "custom">;
  intensity: number;
  rotation: number;
  blur: number;
  exposure: number;
  background: boolean;
};

type EnvironmentModeLightingProfile = {
  keyMul: number;
  fillMul: number;
  atmoMul: number;
  reflectionMul: number;
  keyTint: string;
  fillTint: string;
};

const ENVIRONMENT_MODE_CONFIG: Record<
  EnvironmentModeKey,
  {
    label: string;
    hint: string;
    vars: Record<string, string>;
    hdri: EnvironmentModeHdriProfile;
    lighting: EnvironmentModeLightingProfile;
  }
> = {
  core: {
    label: "Core Dark",
    hint: "Default environment. Keeps the current look exactly as-is.",
    vars: {
      "--bg": "#0a0a0a",
      "--silver": "#e0e0e0",
      "--accent": "#ff3c00",
      "--grain-opacity": "0.15",
      "--env-backdrop": "none",
      "--panel-bg": "rgba(7, 9, 14, 0.62)",
      "--panel-bg-soft": "rgba(12, 15, 24, 0.52)",
      "--panel-border": "rgba(196, 218, 255, 0.2)",
      "--panel-highlight": "rgba(180, 214, 255, 0.4)",
      "--hero-blend": "difference",
    },
    hdri: {
      preset: "off",
      intensity: 0.85,
      rotation: 0,
      blur: 0.05,
      exposure: 0,
      background: false,
    },
    lighting: {
      keyMul: 1,
      fillMul: 1,
      atmoMul: 1,
      reflectionMul: 1,
      keyTint: "#ffffff",
      fillTint: "#ff3c00",
    },
  },
  light: {
    label: "Light Lab",
    hint: "Bright neutral environment for readability and contrast testing.",
    vars: {
      "--bg": "#e7edf5",
      "--silver": "#171f2b",
      "--accent": "#2563ff",
      "--grain-opacity": "0.06",
      "--env-backdrop": "radial-gradient(circle at 20% 14%, rgba(255,255,255,0.82), rgba(236,242,249,0.95) 42%, rgba(216,224,236,1) 100%)",
      "--panel-bg": "rgba(10, 14, 24, 0.72)",
      "--panel-bg-soft": "rgba(16, 20, 34, 0.58)",
      "--panel-border": "rgba(158, 192, 240, 0.34)",
      "--panel-highlight": "rgba(155, 203, 255, 0.5)",
      "--hero-blend": "normal",
    },
    hdri: {
      preset: "studio",
      intensity: 1.12,
      rotation: 18,
      blur: 0.02,
      exposure: 0.22,
      background: false,
    },
    lighting: {
      keyMul: 1.14,
      fillMul: 0.92,
      atmoMul: 0.86,
      reflectionMul: 1.32,
      keyTint: "#f5fbff",
      fillTint: "#9bc4ff",
    },
  },
  dusk: {
    label: "Dusk Bloom",
    hint: "Warm twilight gradients to test cinematic warm/cool balance.",
    vars: {
      "--bg": "#13121a",
      "--silver": "#ece7e2",
      "--accent": "#ff6f3d",
      "--grain-opacity": "0.14",
      "--env-backdrop": "radial-gradient(circle at 82% 14%, rgba(255,130,96,0.26), rgba(33,24,34,0.12) 42%), radial-gradient(circle at 18% 76%, rgba(93,123,255,0.2), rgba(15,14,20,0.9) 58%)",
      "--panel-bg": "rgba(10, 10, 16, 0.66)",
      "--panel-bg-soft": "rgba(17, 15, 24, 0.54)",
      "--panel-border": "rgba(236, 188, 172, 0.24)",
      "--panel-highlight": "rgba(255, 196, 177, 0.36)",
      "--hero-blend": "difference",
    },
    hdri: {
      preset: "sunset",
      intensity: 1.26,
      rotation: -24,
      blur: 0.08,
      exposure: 0.18,
      background: false,
    },
    lighting: {
      keyMul: 1.07,
      fillMul: 1.08,
      atmoMul: 1.18,
      reflectionMul: 1.18,
      keyTint: "#ffe2c9",
      fillTint: "#ff7f63",
    },
  },
  glacier: {
    label: "Glacier Mist",
    hint: "Cool cyan atmosphere for edge-light and fog tests.",
    vars: {
      "--bg": "#0d1218",
      "--silver": "#e4f1ff",
      "--accent": "#32d0ff",
      "--grain-opacity": "0.13",
      "--env-backdrop": "radial-gradient(circle at 70% 20%, rgba(76,200,255,0.2), rgba(19,34,46,0.08) 45%), radial-gradient(circle at 12% 80%, rgba(126,154,255,0.18), rgba(10,14,19,0.92) 60%)",
      "--panel-bg": "rgba(6, 12, 18, 0.66)",
      "--panel-bg-soft": "rgba(10, 18, 28, 0.56)",
      "--panel-border": "rgba(151, 212, 255, 0.25)",
      "--panel-highlight": "rgba(171, 233, 255, 0.42)",
      "--hero-blend": "difference",
    },
    hdri: {
      preset: "city",
      intensity: 1.18,
      rotation: 32,
      blur: 0.07,
      exposure: 0.08,
      background: false,
    },
    lighting: {
      keyMul: 1.09,
      fillMul: 0.96,
      atmoMul: 1.24,
      reflectionMul: 1.36,
      keyTint: "#d9f8ff",
      fillTint: "#4dd7ff",
    },
  },
  mono: {
    label: "Mono Fog",
    hint: "High-contrast monochrome environment to test shape clarity.",
    vars: {
      "--bg": "#0f1012",
      "--silver": "#efefef",
      "--accent": "#f4f4f4",
      "--grain-opacity": "0.12",
      "--env-backdrop": "radial-gradient(circle at 50% 8%, rgba(255,255,255,0.08), rgba(17,18,21,0.94) 58%)",
      "--panel-bg": "rgba(8, 9, 12, 0.7)",
      "--panel-bg-soft": "rgba(14, 15, 19, 0.58)",
      "--panel-border": "rgba(210, 210, 210, 0.24)",
      "--panel-highlight": "rgba(236, 236, 236, 0.34)",
      "--hero-blend": "difference",
    },
    hdri: {
      preset: "studio",
      intensity: 0.92,
      rotation: 0,
      blur: 0.04,
      exposure: -0.1,
      background: false,
    },
    lighting: {
      keyMul: 1.08,
      fillMul: 0.8,
      atmoMul: 0.9,
      reflectionMul: 1.1,
      keyTint: "#ffffff",
      fillTint: "#d7d7d7",
    },
  },
  bureau: {
    label: "Bureau Amber",
    hint: "Institutional dark environment with warm signal amber and restrained contrast.",
    vars: {
      "--bg": "#0b0d10",
      "--silver": "#f4efe6",
      "--accent": "#d6a45d",
      "--grain-opacity": "0.08",
      "--env-backdrop":
        "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(11,13,16,0.02) 14%, rgba(11,13,16,0.96) 72%), radial-gradient(circle at 50% 18%, rgba(214,164,93,0.58), rgba(11,13,16,0.9) 38%), radial-gradient(circle at 49% 42%, rgba(247,240,229,0.22), rgba(11,13,16,0) 28%), radial-gradient(ellipse at 50% 56%, rgba(140,153,177,0.14), rgba(11,13,16,0) 38%), radial-gradient(circle at 50% 78%, rgba(214,164,93,0.08), rgba(11,13,16,0) 22%)",
      "--panel-bg": "rgba(9, 11, 13, 0.74)",
      "--panel-bg-soft": "rgba(16, 18, 21, 0.62)",
      "--panel-border": "rgba(244, 239, 230, 0.16)",
      "--panel-highlight": "rgba(244, 239, 230, 0.2)",
      "--hero-blend": "normal",
    },
    hdri: {
      preset: "studio",
      intensity: 0.98,
      rotation: 6,
      blur: 0.03,
      exposure: -0.01,
      background: false,
    },
    lighting: {
      keyMul: 1.84,
      fillMul: 0.34,
      atmoMul: 0.32,
      reflectionMul: 1.12,
      keyTint: "#fff8f0",
      fillTint: "#93a2bb",
    },
  },
};

const DEFAULT_FILL_OFFSET = {
  x: 0.02,
  y: 0.56,
  z: 0.36,
};

const HISTORY_LIMIT = 60;
const DEFAULT_HINT = "Hover a control to see contextual guidance.";

const DEFAULT_RIG: LightRigState = {
  lightAnchorMode: "follow",
  worldAnchorX: 0,
  worldAnchorY: 1.1,
  worldAnchorZ: 0,
  keyAzimuth: 24,
  keyElevation: 68,
  keyDistance: 3.12,
  fillAzimuth: -84,
  fillElevation: 24,
  fillDistance: 4.2,
  keyOffsetX: 0,
  keyOffsetY: 0,
  keyOffsetZ: 0,
  fillOffsetX: DEFAULT_FILL_OFFSET.x,
  fillOffsetY: DEFAULT_FILL_OFFSET.y,
  fillOffsetZ: DEFAULT_FILL_OFFSET.z,
  keyColor: "#ffffff",
  keyIntensity: 1.54,
  fillColor: "#96a5be",
  fillIntensity: 0.16,
  hideLightSource: true,
};

const cloneRig = (rig: LightRigState): LightRigState => ({ ...rig });

const createShotRigMap = (): Record<CameraShotKey, LightRigState> => ({
  hero: cloneRig(DEFAULT_RIG),
  mid: cloneRig(DEFAULT_RIG),
  wide: cloneRig(DEFAULT_RIG),
});

const PRESETS: Record<PresetKey, ScenePreset> = {
  studio: {
    ambientSky: "#ffffff",
    ambientGround: "#11111a",
    ambientIntensity: 0.9,
    keyColor: "#ffffff",
    keyIntensity: 1.25,
    fillColor: "#ff3c00",
    fillIntensity: 0.36,
    ringColorA: "#ffffff",
    ringColorB: "#8793ad",
    floorColor: "#0c0c0f",
    bloom: 0.25,
    fogColor: "#e6ecff",
    fogAmount: 0.18,
  },
  noir: {
    ambientSky: "#bfc8dc",
    ambientGround: "#08080c",
    ambientIntensity: 0.76,
    keyColor: "#d7e2ff",
    keyIntensity: 1.05,
    fillColor: "#6f82ff",
    fillIntensity: 0.36,
    ringColorA: "#c9d2ff",
    ringColorB: "#6f82ff",
    floorColor: "#0a0a10",
    bloom: 0.2,
    fogColor: "#b4bfd6",
    fogAmount: 0.14,
  },
  neon: {
    ambientSky: "#f2ffff",
    ambientGround: "#0a0912",
    ambientIntensity: 1.0,
    keyColor: "#d7fffd",
    keyIntensity: 1.35,
    fillColor: "#1ef4d8",
    fillIntensity: 0.55,
    ringColorA: "#8af9ff",
    ringColorB: "#ff4df2",
    floorColor: "#0f0a1a",
    bloom: 0.36,
    fogColor: "#72fff2",
    fogAmount: 0.24,
  },
};

const SHOTS: Record<CameraShotKey, ShotConfig> = {
  hero: {
    position: [0.08, 1.6, 1.02],
    target: [0.0, 1.3, 0.06],
    fov: 18.9,
  },
  mid: {
    position: [0, 6.4, 0.01],
    target: [0, 0.45, 0],
    fov: 40,
  },
  wide: {
    position: [-2.4, 2.45, 10.8],
    target: [0, 0.52, 0],
    fov: 40,
  },
};

const GRADES: Record<GradeKey, GradeConfig> = {
  clean: {
    exposure: 1.1,
    bloomBoost: 0,
    vignetteOffset: 0.92,
    vignetteDarkness: 1.2,
  },
  film: {
    exposure: 1.0,
    bloomBoost: 0.08,
    vignetteOffset: 0.87,
    vignetteDarkness: 1.34,
  },
  cold: {
    exposure: 1.22,
    bloomBoost: 0.03,
    vignetteOffset: 0.95,
    vignetteDarkness: 1.14,
  },
};

const KEY_INTENSITY_MAX = 5;
const FILL_INTENSITY_MAX = 3;
const LIGHT_GAIN_MAX = 4;

const PANEL_TAB_CONFIG: Array<{ key: PanelTab; label: string; icon: CategoryIcon }> = [
  { key: "scene", label: "Scene", icon: "scene" },
  { key: "lighting", label: "Lighting", icon: "lighting" },
  { key: "fx", label: "FX", icon: "fx" },
  { key: "model", label: "3D Object", icon: "model" },
  { key: "render", label: "Render", icon: "render" },
];

const FX_STYLE_OPTIONS: ParticleStyle[] = [
  "dust",
  "embers",
  "snow",
  "orbit-balls",
  "ribbons",
  "glyphs",
  "shards",
  "beams",
];

const FX_STYLE_UI_OPTIONS: ParticleStyle[] = FX_STYLE_OPTIONS.filter((style) => style !== "beams");

const HDRI_PRESETS: Record<Exclude<HdriPresetKey, "off" | "custom">, HdriPreset> = {
  studio: {
    label: "Studio",
    url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr",
  },
  sunset: {
    label: "Sunset",
    url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/venice_sunset_1k.hdr",
  },
  city: {
    label: "City",
    url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/potsdamer_platz_1k.hdr",
  },
};

const DEFAULT_SCREEN_CARDS: ScreenCard[] = [
  {
    id: "screen-a",
    label: "A",
    x: -1.05,
    y: 1.55,
    z: 0.45,
    yaw: 22,
    scale: 1,
    width: 1,
    height: 1,
    bend: 0,
    text: "ANATOMY / CORE",
    mediaUrl: null,
    mediaOriginalUrl: null,
    mediaKind: "none",
    mediaSourceType: "directUrl",
    mediaProvider: null,
    mediaEmbedBase: null,
    sourceMode: "auto",
    mediaPlaying: true,
    mediaMuted: true,
    audioUrl: null,
    audioPlaying: false,
    audioOnly: false,
    audioPolicy: "normal",
    showFrame: true,
    visible: true,
    shape: "panel",
  },
  {
    id: "screen-b",
    label: "B",
    x: 1.18,
    y: 1.34,
    z: 0.2,
    yaw: -18,
    scale: 0.92,
    width: 1,
    height: 1,
    bend: 0.08,
    text: "SCAN READY",
    mediaUrl: null,
    mediaOriginalUrl: null,
    mediaKind: "none",
    mediaSourceType: "directUrl",
    mediaProvider: null,
    mediaEmbedBase: null,
    sourceMode: "auto",
    mediaPlaying: true,
    mediaMuted: true,
    audioUrl: null,
    audioPlaying: false,
    audioOnly: false,
    audioPolicy: "normal",
    showFrame: true,
    visible: true,
    shape: "round",
  },
  {
    id: "screen-c",
    label: "C",
    x: 0,
    y: 2.05,
    z: -0.75,
    yaw: 180,
    scale: 0.84,
    width: 1.15,
    height: 0.92,
    bend: -0.12,
    text: "NEURAL MAP",
    mediaUrl: null,
    mediaOriginalUrl: null,
    mediaKind: "none",
    mediaSourceType: "directUrl",
    mediaProvider: null,
    mediaEmbedBase: null,
    sourceMode: "auto",
    mediaPlaying: true,
    mediaMuted: true,
    audioUrl: null,
    audioPlaying: false,
    audioOnly: false,
    audioPolicy: "normal",
    showFrame: true,
    visible: false,
    shape: "diamond",
  },
];

const cloneScreenCards = (cards: ScreenCard[]) =>
  cards.map((card) => ({
    ...card,
  }));

const createDefaultScreenCards = (): ScreenCard[] => cloneScreenCards(DEFAULT_SCREEN_CARDS);

const createProfilePresentationScreenCards = (): ScreenCard[] =>
  cloneScreenCards(
    DEFAULT_SCREEN_CARDS.map((card) => {
      if (card.id === "screen-a") {
        return {
          ...card,
          x: -1.3,
          y: 1.44,
          z: 0.22,
          yaw: 12,
          scale: 0.54,
          width: 0.82,
          height: 0.68,
          bend: -0.03,
          showFrame: true,
          visible: true,
          shape: "panel",
          mediaUrl: null,
          mediaOriginalUrl: null,
          mediaKind: "none" as const,
          mediaSourceType: "directUrl" as const,
          mediaProvider: null,
          mediaEmbedBase: null,
          mediaPlaying: true,
          mediaMuted: true,
          audioUrl: null,
          audioPlaying: false,
          audioOnly: false,
          text: "MISSION LINK",
        };
      }
      if (card.id === "screen-b") {
        return {
          ...card,
          x: 2.8,
          y: 0.72,
          z: -0.82,
          yaw: -12,
          scale: 0.01,
          showFrame: false,
          visible: false,
          mediaUrl: null,
          mediaOriginalUrl: null,
          mediaKind: "none" as const,
          mediaSourceType: "directUrl" as const,
          mediaProvider: null,
          mediaEmbedBase: null,
          mediaPlaying: true,
          mediaMuted: true,
          audioUrl: null,
          audioPlaying: false,
          audioOnly: false,
        };
      }
      return {
        ...card,
        y: 1.94,
        z: -1.18,
        scale: 0.54,
        showFrame: false,
        visible: false,
        mediaUrl: null,
        mediaOriginalUrl: null,
        mediaKind: "none" as const,
        mediaSourceType: "directUrl" as const,
        mediaProvider: null,
        mediaEmbedBase: null,
        mediaPlaying: true,
        mediaMuted: true,
        audioUrl: null,
        audioPlaying: false,
        audioOnly: false,
      };
    })
  );

const LEGACY_TAB_MAP: Record<string, PanelTab> = {
  create: "lighting",
  look: "scene",
  effects: "fx",
  output: "render",
};

const normalizePanelTab = (value: unknown): PanelTab => {
  if (typeof value !== "string") return "scene";
  if (PANEL_TAB_CONFIG.some((entry) => entry.key === value)) {
    return value as PanelTab;
  }
  return LEGACY_TAB_MAP[value] ?? "scene";
};

const CategoryIconGlyph: React.FC<{ kind: CategoryIcon; className?: string }> = ({ kind, className }) => {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  if (kind === "scene") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4v16M4 12h16" />
      </svg>
    );
  }

  if (kind === "lighting") {
    return (
      <svg {...props}>
        <path d="M8 11a4 4 0 1 1 8 0c0 1.4-.6 2.6-1.7 3.4-.6.5-.9 1.1-.9 1.8V17H10.6v-.8c0-.7-.3-1.3-.9-1.8A4.2 4.2 0 0 1 8 11Z" />
        <path d="M10 20h4M10.8 17.8h2.4" />
      </svg>
    );
  }

  if (kind === "fx") {
    return (
      <svg {...props}>
        <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" />
        <path d="m18.5 15.5.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8.8-1.9Z" />
      </svg>
    );
  }

  if (kind === "model") {
    return (
      <svg {...props}>
        <path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z" />
        <path d="M12 7v14M5 7l7 4 7-4" />
      </svg>
    );
  }

  return (
    <svg {...props}>
      <rect x="3.5" y="6.5" width="17" height="11" rx="2.2" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M7.2 4.5h9.6" />
    </svg>
  );
};

const clampBloom = (value: number) => THREE.MathUtils.clamp(value, 0, 1.2);
const clampElevation = (value: number) => THREE.MathUtils.clamp(value, -170, 170);
const softFillBoost = (softness: number) => 0.78 + THREE.MathUtils.clamp(softness, 0, 1) * 1.18;
const wrapAngle = (value: number) => {
  let next = value % 360;
  if (next < 0) next += 360;
  return next;
};

const shortestAngleDelta = (from: number, to: number) => {
  let delta = (to - from + 540) % 360 - 180;
  if (delta < -180) delta += 360;
  return delta;
};

const lerpAngle = (from: number, to: number, alpha: number) => wrapAngle(from + shortestAngleDelta(from, to) * alpha);

const quantizeToStep = (value: number, step: number) => {
  if (!Number.isFinite(step) || step <= 0) return value;
  return Math.round(value / step) * step;
};

const getOrbitalMarker = (azimuthDeg: number, elevationDeg: number) => {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const x = Math.sin(az) * Math.cos(el);
  const y = -Math.sin(el);
  const z = Math.cos(az) * Math.cos(el);
  return {
    left: 50 + x * 42,
    top: 50 + y * 42,
    back: z < 0,
  };
};

const VIGNETTE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 0.92 },
    darkness: { value: 1.2 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float dist = distance(vUv, vec2(0.5, 0.5));
      float vignette = smoothstep(offset, 1.25, dist * darkness);
      color.rgb *= (1.0 - vignette * 0.58);
      gl_FragColor = color;
    }
  `,
};

function makeRadialTexture(inner: string, outer: string, size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.5);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeGridTexture(lineColor: string, bgColor: string, size = 512, cell = 32): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i += cell) {
      ctx.beginPath();
      ctx.moveTo(i + 0.5, 0);
      ctx.lineTo(i + 0.5, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i + 0.5);
      ctx.lineTo(size, i + 0.5);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeGlyphTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    const c = size / 2;
    const arm = size * 0.18;
    const thick = size * 0.06;
    ctx.fillStyle = "rgba(236, 244, 255, 0.95)";
    ctx.fillRect(c - thick / 2, c - arm, thick, arm * 2);
    ctx.fillRect(c - arm, c - thick / 2, arm * 2, thick);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const HalideLanding: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const screenHudRef = useRef<HTMLDivElement>(null);
  const providerLayerRef = useRef<HTMLDivElement>(null);
  const profileImportInputRef = useRef<HTMLInputElement>(null);
  const mediaDockVideoRef = useRef<HTMLVideoElement>(null);
  const mediaDockProviderFrameRef = useRef<HTMLIFrameElement>(null);

  const [preset, setPreset] = useState<PresetKey>("studio");
  const [shot, setShot] = useState<CameraShotKey>("hero");
  const [grade, setGrade] = useState<GradeKey>("clean");
  const [presentationMode, setPresentationMode] = useState<PresentationMode>(resolveInitialPresentationMode);
  const [uiMode, setUiMode] = useState<UiMode>("basic");
  const [panelTab, setPanelTab] = useState<PanelTab>("scene");
  const [environmentMode, setEnvironmentMode] = useState<EnvironmentModeKey>("core");
  const [environmentAutoHdri, setEnvironmentAutoHdri] = useState<boolean>(false);
  const [environmentObjectImpact, setEnvironmentObjectImpact] = useState<number>(0.62);
  const [hintText, setHintText] = useState<string>(DEFAULT_HINT);
  const [shotLinkedRigs, setShotLinkedRigs] = useState<boolean>(true);
  const [shotRigMap, setShotRigMap] = useState<Record<CameraShotKey, LightRigState>>(createShotRigMap);
  const [minLightHeight, setMinLightHeight] = useState<number>(0.03);
  const [maxLightDistance, setMaxLightDistance] = useState<number>(4.7);
  const [stayLightsInFront, setStayLightsInFront] = useState<boolean>(false);
  const [avoidBodyIntersection, setAvoidBodyIntersection] = useState<boolean>(true);
  const [bodyClearance, setBodyClearance] = useState<number>(0.55);
  const [undoStack, setUndoStack] = useState<SceneSettings[]>([]);
  const [redoStack, setRedoStack] = useState<SceneSettings[]>([]);
  const [timelineFrames, setTimelineFrames] = useState<RigKeyframe[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState<string>("");
  const [timelineCursor, setTimelineCursor] = useState<number>(0);
  const [timelineDuration, setTimelineDuration] = useState<number>(6);
  const [timelineLoop, setTimelineLoop] = useState<boolean>(true);
  const [timelinePlaying, setTimelinePlaying] = useState<boolean>(false);
  const [lightAnchorMode, setLightAnchorMode] = useState<"follow" | "world">("follow");
  const [worldAnchorX, setWorldAnchorX] = useState<number>(0);
  const [worldAnchorY, setWorldAnchorY] = useState<number>(1.1);
  const [worldAnchorZ, setWorldAnchorZ] = useState<number>(0);
  const [showLightMarkers, setShowLightMarkers] = useState<boolean>(false);
  const [lockLightsAboveGround, setLockLightsAboveGround] = useState<boolean>(false);
  const [activeOrbitalLight, setActiveOrbitalLight] = useState<"key" | "fill">("key");
  const [keyAzimuth, setKeyAzimuth] = useState<number>(36);
  const [keyElevation, setKeyElevation] = useState<number>(61);
  const [keyDistance, setKeyDistance] = useState<number>(3.45);
  const [fillAzimuth, setFillAzimuth] = useState<number>(-26);
  const [fillElevation, setFillElevation] = useState<number>(48);
  const [fillDistance, setFillDistance] = useState<number>(3.15);
  const [fillColor, setFillColor] = useState<string>(PRESETS.studio.fillColor);
  const [fillIntensity, setFillIntensity] = useState<number>(PRESETS.studio.fillIntensity);
  const [fillOffsetX, setFillOffsetX] = useState<number>(DEFAULT_FILL_OFFSET.x);
  const [fillOffsetY, setFillOffsetY] = useState<number>(DEFAULT_FILL_OFFSET.y);
  const [fillOffsetZ, setFillOffsetZ] = useState<number>(DEFAULT_FILL_OFFSET.z);
  const [keyColor, setKeyColor] = useState<string>(PRESETS.studio.keyColor);
  const [keyIntensity, setKeyIntensity] = useState<number>(PRESETS.studio.keyIntensity);
  const [keyOffsetX, setKeyOffsetX] = useState<number>(0);
  const [keyOffsetY, setKeyOffsetY] = useState<number>(0);
  const [keyOffsetZ, setKeyOffsetZ] = useState<number>(0);
  const [hideLightSource, setHideLightSource] = useState<boolean>(true);
  const [lightGain, setLightGain] = useState<number>(1.25);
  const [lightSoftness, setLightSoftness] = useState<number>(0.62);
  const [floorMode, setFloorMode] = useState<FloorMode>("topo");
  const [groundGloss, setGroundGloss] = useState<number>(0.34);
  const [groundMotion, setGroundMotion] = useState<boolean>(false);
  const [particleStyle, setParticleStyle] = useState<ParticleStyle>("dust");
  const [secondaryParticleStyle, setSecondaryParticleStyle] = useState<SecondaryParticleStyle>("none");
  const [activeFxPreset, setActiveFxPreset] = useState<FxPresetKey | null>(null);
  const [effectBlend, setEffectBlend] = useState<number>(0.34);
  const [effectAmount, setEffectAmount] = useState<number>(1.15);
  const [effectSpeed, setEffectSpeed] = useState<number>(1);
  const [effectScale, setEffectScale] = useState<number>(1.25);
  const [effectSpread, setEffectSpread] = useState<number>(1.08);
  const [orbitCenterLift, setOrbitCenterLift] = useState<number>(0.56);
  const [fillWorld, setFillWorld] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const [keyWorld, setKeyWorld] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const [orbitCenterWorld, setOrbitCenterWorld] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 1.1, z: 0 });
  const [bloomStrength, setBloomStrength] = useState<number>(PRESETS.studio.bloom);
  const [fogAmount, setFogAmount] = useState<number>(PRESETS.studio.fogAmount);
  const [ambientAtmosphere, setAmbientAtmosphere] = useState<number>(0.62);
  const [atmosphereSpread, setAtmosphereSpread] = useState<number>(0.56);
  const [autoOrbit, setAutoOrbit] = useState<boolean>(false);
  const [ringPulse, setRingPulse] = useState<boolean>(true);
  const [ringImpact, setRingImpact] = useState<number>(0.48);
  const [particlesEnabled, setParticlesEnabled] = useState<boolean>(true);
  const [particleDensity, setParticleDensity] = useState<number>(0.58);
  const [titleSync, setTitleSync] = useState<boolean>(true);
  const [beatPulse, setBeatPulse] = useState<boolean>(false);
  const [captureFlash, setCaptureFlash] = useState<boolean>(false);
  const [captureFormat, setCaptureFormat] = useState<"png" | "jpg">("png");
  const [extrasOpen, setExtrasOpen] = useState<boolean>(true);
  const [panelClosed, setPanelClosed] = useState<boolean>(false);
  const [panelMinimized, setPanelMinimized] = useState<boolean>(false);
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number }>(() => {
    const fallback = { x: 12, y: 84 };
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(PANEL_POSITION_STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
      if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
        return fallback;
      }
      return {
        x: Number.isFinite(parsed.x) ? parsed.x : fallback.x,
        y: Number.isFinite(parsed.y) ? parsed.y : fallback.y,
      };
    } catch {
      return fallback;
    }
  });
  const [modelSource, setModelSource] = useState<string>(DEFAULT_MODEL_SRC);
  const [modelName, setModelName] = useState<string>("male_anatomy.glb");
  const [modelPosX, setModelPosX] = useState<number>(0);
  const [modelPosY, setModelPosY] = useState<number>(0);
  const [modelPosZ, setModelPosZ] = useState<number>(0);
  const [modelYaw, setModelYaw] = useState<number>(0);
  const [modelScale, setModelScale] = useState<number>(1);
  const [modelFloat, setModelFloat] = useState<boolean>(false);
  const [modelAnimationPlaying, setModelAnimationPlaying] = useState<boolean>(true);
  const [modelAnimationSpeed, setModelAnimationSpeed] = useState<number>(1);
  const [modelMaterialMode, setModelMaterialMode] = useState<ModelMaterialMode>("original");
  const [modelTint, setModelTint] = useState<string>("#d7deea");
  const [modelMetalness, setModelMetalness] = useState<number>(0.15);
  const [modelRoughness, setModelRoughness] = useState<number>(0.65);
  const [modelClipNames, setModelClipNames] = useState<string[]>([]);
  const [activeModelClip, setActiveModelClip] = useState<number>(0);
  const [modelStats, setModelStats] = useState<ModelStats>({
    meshes: 0,
    triangles: 0,
    vertices: 0,
    materials: 0,
    animations: 0,
    skinnedMeshes: 0,
  });
  const [autoQuality, setAutoQuality] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [heroTitleText, setHeroTitleText] = useState<string>("Sary Nassar");
  const [cameraFovOffset, setCameraFovOffset] = useState<number>(0);
  const [cameraDamping, setCameraDamping] = useState<number>(0.06);
  const [cameraOrbitSpeed, setCameraOrbitSpeed] = useState<number>(0.65);
  const [cameraNear, setCameraNear] = useState<number>(0.1);
  const [cameraFar, setCameraFar] = useState<number>(100);
  const [hdriPreset, setHdriPreset] = useState<HdriPresetKey>("off");
  const [hdriIntensity, setHdriIntensity] = useState<number>(0.85);
  const [hdriRotation, setHdriRotation] = useState<number>(0);
  const [hdriBackground, setHdriBackground] = useState<boolean>(false);
  const [hdriBlur, setHdriBlur] = useState<number>(0.05);
  const [hdriExposure, setHdriExposure] = useState<number>(0);
  const [hdriName, setHdriName] = useState<string>("None");
  const [screensEnabled, setScreensEnabled] = useState<boolean>(true);
  const [screens, setScreens] = useState<ScreenCard[]>(() =>
    resolveInitialPresentationMode() === "profile"
      ? createProfilePresentationScreenCards()
      : createDefaultScreenCards()
  );
  const [activeScreenId, setActiveScreenId] = useState<string>(DEFAULT_SCREEN_CARDS[0].id);
  const [sceneSelection, setSceneSelection] = useState<SceneSelectionKind>("none");
  const [selectionLocked, setSelectionLocked] = useState<boolean>(false);
  const [screenMediaUrlInput, setScreenMediaUrlInput] = useState<string>("");
  const [screenAudioUrlInput, setScreenAudioUrlInput] = useState<string>("");
  const [screenStatusById, setScreenStatusById] = useState<Record<string, string>>({});
  const [screenMediaHasAudioById, setScreenMediaHasAudioById] = useState<Record<string, boolean>>({});
  const [screenMediaResolutionById, setScreenMediaResolutionById] = useState<Record<string, string>>({});
  const [serverMediaAvailable, setServerMediaAvailable] = useState<boolean>(() => {
    if (SERVER_MEDIA_MODE_FULL) return true;
    if (SERVER_MEDIA_MODE_SAFE) return false;
    return false;
  });
  const [serverMediaProbeDone, setServerMediaProbeDone] = useState<boolean>(() => SERVER_MEDIA_MODE_FULL || SERVER_MEDIA_MODE_SAFE);
  const serverMediaEnabled = SERVER_MEDIA_MODE_FULL ? true : SERVER_MEDIA_MODE_SAFE ? false : serverMediaAvailable;
  const [preferIntegratedProvider, setPreferIntegratedProvider] = useState<boolean>(() => {
    if (SERVER_MEDIA_MODE_SAFE) return false;
    if (typeof window === "undefined") return true;
    try {
      const raw = window.localStorage.getItem(MEDIA_UI_STORAGE_KEY);
      if (!raw) return true;
      const parsed = JSON.parse(raw) as { preferIntegratedProvider?: unknown };
      return parsed.preferIntegratedProvider !== false;
    } catch {
      return true;
    }
  });
  const [autoFitMediaAspect, setAutoFitMediaAspect] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = window.localStorage.getItem(MEDIA_UI_STORAGE_KEY);
      if (!raw) return true;
      const parsed = JSON.parse(raw) as { autoFitMediaAspect?: unknown };
      return parsed.autoFitMediaAspect !== false;
    } catch {
      return true;
    }
  });
  const [mediaFidelity, setMediaFidelity] = useState<number>(() => {
    if (typeof window === "undefined") return 0.62;
    try {
      const raw = window.localStorage.getItem(MEDIA_UI_STORAGE_KEY);
      if (!raw) return 0.62;
      const parsed = JSON.parse(raw) as { mediaFidelity?: unknown };
      const next = Number(parsed.mediaFidelity);
      return Number.isFinite(next) ? THREE.MathUtils.clamp(next, 0, 1) : 0.62;
    } catch {
      return 0.62;
    }
  });
  const [screenAttachmentMode, setScreenAttachmentMode] = useState<ScreenAttachmentMode>(() => {
    if (typeof window === "undefined") return "follow-pos-yaw";
    try {
      const raw = window.localStorage.getItem(MEDIA_UI_STORAGE_KEY);
      if (!raw) return "follow-pos-yaw";
      const parsed = JSON.parse(raw) as { screenAttachmentMode?: unknown };
      if (
        parsed.screenAttachmentMode === "world" ||
        parsed.screenAttachmentMode === "follow-pos" ||
        parsed.screenAttachmentMode === "follow-pos-yaw" ||
        parsed.screenAttachmentMode === "follow-full"
      ) {
        return parsed.screenAttachmentMode;
      }
      return "follow-pos-yaw";
    } catch {
      return "follow-pos-yaw";
    }
  });
  const [lightFollowPoint, setLightFollowPoint] = useState<LightFollowPoint>(() => {
    if (typeof window === "undefined") return "rig";
    try {
      const raw = window.localStorage.getItem(MEDIA_UI_STORAGE_KEY);
      if (!raw) return "rig";
      const parsed = JSON.parse(raw) as { lightFollowPoint?: unknown };
      return parsed.lightFollowPoint === "hips" ? "hips" : "rig";
    } catch {
      return "rig";
    }
  });
  const [mediaDockMode, setMediaDockMode] = useState<MediaDockMode>(() => {
    if (typeof window === "undefined") return "inspector";
    try {
      const raw = window.localStorage.getItem(MEDIA_UI_STORAGE_KEY);
      if (!raw) return "inspector";
      const parsed = JSON.parse(raw) as { dockMode?: unknown };
      return parsed.dockMode === "player" ? "player" : "inspector";
    } catch {
      return "inspector";
    }
  });
  const [providerScreenPrimary, setProviderScreenPrimary] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = window.localStorage.getItem(MEDIA_UI_STORAGE_KEY);
      if (!raw) return true;
      const parsed = JSON.parse(raw) as { providerScreenPrimary?: unknown };
      return parsed.providerScreenPrimary !== false;
    } catch {
      return true;
    }
  });
  const [contextFocus, setContextFocus] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = window.localStorage.getItem(MEDIA_UI_STORAGE_KEY);
      if (!raw) return true;
      const parsed = JSON.parse(raw) as { contextFocus?: unknown };
      return parsed.contextFocus !== false;
    } catch {
      return true;
    }
  });
  const [advancedPanelVisible, setAdvancedPanelVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = window.localStorage.getItem(MEDIA_UI_STORAGE_KEY);
      if (!raw) return true;
      const parsed = JSON.parse(raw) as { advancedPanelVisible?: unknown };
      return parsed.advancedPanelVisible !== false;
    } catch {
      return true;
    }
  });
  const [autoEntityTab, setAutoEntityTab] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = window.localStorage.getItem(MEDIA_UI_STORAGE_KEY);
      if (!raw) return true;
      const parsed = JSON.parse(raw) as { autoEntityTab?: unknown };
      return parsed.autoEntityTab !== false;
    } catch {
      return true;
    }
  });
  const [inspectorLock, setInspectorLock] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem(MEDIA_UI_STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { inspectorLock?: unknown };
      return parsed.inspectorLock === true;
    } catch {
      return false;
    }
  });
  const [performanceTier, setPerformanceTier] = useState<PerformanceTier>(() => {
    if (typeof window === "undefined") return "balanced";
    try {
      const raw = window.localStorage.getItem(MEDIA_UI_STORAGE_KEY);
      if (!raw) return "balanced";
      const parsed = JSON.parse(raw) as { performanceTier?: unknown };
      return parsed.performanceTier === "ultra" || parsed.performanceTier === "fast" ? parsed.performanceTier : "balanced";
    } catch {
      return "balanced";
    }
  });
  const [mediaDockCollapsed, setMediaDockCollapsed] = useState<boolean>(false);
  const [playbackAuthority, setPlaybackAuthority] = useState<PlaybackAuthority>("scene");
  const [savedPresets, setSavedPresets] = useState<SavedScenePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [presetNameInput, setPresetNameInput] = useState<string>("");
  const [qualityMode, setQualityMode] = useState<QualityMode>("final");
  const [overlaySilhouette, setOverlaySilhouette] = useState<boolean>(true);
  const [compareSlots, setCompareSlots] = useState<Record<CompareSlotKey, SceneSettings | null>>({
    a: null,
    b: null,
    c: null,
  });
  const [activeComparePreview, setActiveComparePreview] = useState<CompareSlotKey | null>(null);
  const [lightPaintMode, setLightPaintMode] = useState<boolean>(false);
  const [lightPaintTarget, setLightPaintTarget] = useState<"key" | "fill">("key");
  const [lightPaintPoints, setLightPaintPoints] = useState<LightPaintPoint[]>([]);
  const [lightPaintPlaying, setLightPaintPlaying] = useState<boolean>(false);
  const [lightPaintLoop, setLightPaintLoop] = useState<boolean>(true);
  const [lightPaintSpeed, setLightPaintSpeed] = useState<number>(1);
  const isProfilePresentation = presentationMode === "profile";
  const [lightPaintProgress, setLightPaintProgress] = useState<number>(0);
  const [gizmoSnapEnabled, setGizmoSnapEnabled] = useState<boolean>(true);
  const [gizmoSnapGrid, setGizmoSnapGrid] = useState<number>(0.1);
  const [gizmoSnapAngle, setGizmoSnapAngle] = useState<number>(5);
  const [apiInspectorOpen, setApiInspectorOpen] = useState<boolean>(false);
  const [apiInspectorCommand, setApiInspectorCommand] = useState<SceneApiCommandName>("getState");
  const [apiInspectorPayload, setApiInspectorPayload] = useState<string>("{}");
  const [apiDryRunResolvedPayload, setApiDryRunResolvedPayload] = useState<string>("");
  const [apiDryRunError, setApiDryRunError] = useState<string>("");
  const [apiInspectorLogs, setApiInspectorLogs] = useState<SceneApiInspectorEntry[]>([]);
  const [apiInspectorHideStateChanged, setApiInspectorHideStateChanged] = useState<boolean>(true);
  const [apiMacros, setApiMacros] = useState<SceneApiMacro[]>([]);
  const [selectedApiMacroId, setSelectedApiMacroId] = useState<string>("");
  const [apiMacroNameInput, setApiMacroNameInput] = useState<string>("");
  const [apiMacroTagsInput, setApiMacroTagsInput] = useState<string>("");
  const [apiMacroSearch, setApiMacroSearch] = useState<string>("");
  const [apiTemplateVars, setApiTemplateVars] = useState<SceneApiTemplateVar[]>([]);
  const [apiVarKeyInput, setApiVarKeyInput] = useState<string>("");
  const [apiVarValueInput, setApiVarValueInput] = useState<string>("");
  const [apiSequences, setApiSequences] = useState<SceneApiSequence[]>([]);
  const [selectedApiSequenceId, setSelectedApiSequenceId] = useState<string>("");
  const [apiSequenceNameInput, setApiSequenceNameInput] = useState<string>("");
  const [apiSequenceRunning, setApiSequenceRunning] = useState<boolean>(false);
  const [apiTimeoutPreset, setApiTimeoutPreset] = useState<ApiTimeoutPreset>("balanced");
  const [apiTimeoutCustomMs, setApiTimeoutCustomMs] = useState<number>(12000);
  const [apiRetryCount, setApiRetryCount] = useState<number>(1);
  const [apiConfirmDestructive, setApiConfirmDestructive] = useState<boolean>(true);
  const [apiCommandHistory, setApiCommandHistory] = useState<SceneApiCommandHistoryEntry[]>([]);
  const [apiEventStats, setApiEventStats] = useState<{
    accepted: number;
    completed: number;
    failed: number;
    timeout: number;
  }>({
    accepted: 0,
    completed: 0,
    failed: 0,
    timeout: 0,
  });
  const [pendingProfileImport, setPendingProfileImport] = useState<PendingProfileImport | null>(null);

  const ambientRef = useRef<THREE.HemisphereLight | null>(null);
  const atmoLightRef = useRef<THREE.PointLight | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.SpotLight | null>(null);
  const softFillRef = useRef<THREE.DirectionalLight | null>(null);
  const floorMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const floorRef = useRef<THREE.Mesh | null>(null);
  const floorGridTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const ringGroupRef = useRef<THREE.Group | null>(null);
  const fogGroupRef = useRef<THREE.Group | null>(null);
  const contactShadowRef = useRef<THREE.Mesh | null>(null);
  const shadowMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const ringMatsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const fogMatsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const particleMatRef = useRef<THREE.PointsMaterial | null>(null);
  const glyphMatRef = useRef<THREE.PointsMaterial | null>(null);
  const orbitBallMatsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const ribbonMatsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const shardMatsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const beamMatsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const controlsRef = useRef<OrbitControls | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);
  const vignetteRef = useRef<ShaderPass | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const resetViewRef = useRef<(() => void) | null>(null);
  const triggerShotRef = useRef<((next: CameraShotKey, immediate?: boolean) => void) | null>(null);
  const captureStillRef = useRef<(() => void) | null>(null);
  const capturePackRef = useRef<(() => void) | null>(null);
  const fillOffsetRef = useRef(new THREE.Vector3(DEFAULT_FILL_OFFSET.x, DEFAULT_FILL_OFFSET.y, DEFAULT_FILL_OFFSET.z));
  const keyOffsetRef = useRef(new THREE.Vector3(0, 0, 0));
  const activeShotRef = useRef<CameraShotKey>("hero");
  const gradeRef = useRef<GradeKey>("clean");
  const environmentModeRef = useRef<EnvironmentModeKey>("core");
  const environmentObjectImpactRef = useRef<number>(0.62);
  const lightAnchorModeRef = useRef<"follow" | "world">("follow");
  const worldAnchorRef = useRef(new THREE.Vector3(0, 1.1, 0));
  const showLightMarkersRef = useRef<boolean>(false);
  const lockLightsAboveGroundRef = useRef<boolean>(false);
  const minLightHeightRef = useRef<number>(0.03);
  const maxLightDistanceRef = useRef<number>(4.7);
  const stayLightsInFrontRef = useRef<boolean>(false);
  const avoidBodyIntersectionRef = useRef<boolean>(true);
  const bodyClearanceRef = useRef<number>(0.55);
  const keyAzimuthRef = useRef<number>(36);
  const keyElevationRef = useRef<number>(61);
  const keyDistanceRef = useRef<number>(3.45);
  const fillAzimuthRef = useRef<number>(-26);
  const fillElevationRef = useRef<number>(48);
  const fillDistanceRef = useRef<number>(3.15);
  const keyColorRef = useRef<string>(PRESETS.studio.keyColor);
  const fillColorRef = useRef<string>(PRESETS.studio.fillColor);
  const fillIntensityRef = useRef<number>(PRESETS.studio.fillIntensity);
  const keyIntensityRef = useRef<number>(PRESETS.studio.keyIntensity);
  const bloomStrengthRef = useRef<number>(PRESETS.studio.bloom);
  const fogAmountRef = useRef<number>(PRESETS.studio.fogAmount);
  const ambientAtmosphereRef = useRef<number>(0.62);
  const atmosphereSpreadRef = useRef<number>(0.56);
  const hideLightSourceRef = useRef<boolean>(true);
  const lightGainRef = useRef<number>(1.25);
  const lightSoftnessRef = useRef<number>(0.62);
  const floorModeRef = useRef<FloorMode>("topo");
  const groundGlossRef = useRef<number>(0.34);
  const groundMotionRef = useRef<boolean>(false);
  const particleStyleRef = useRef<ParticleStyle>("dust");
  const secondaryParticleStyleRef = useRef<SecondaryParticleStyle>("none");
  const effectBlendRef = useRef<number>(0.34);
  const effectAmountRef = useRef<number>(1.15);
  const effectSpeedRef = useRef<number>(1);
  const effectScaleRef = useRef<number>(1.25);
  const effectSpreadRef = useRef<number>(1.08);
  const orbitCenterLiftRef = useRef<number>(0.56);
  const captureFormatRef = useRef<"png" | "jpg">("png");
  const uploadedModelUrlRef = useRef<string | null>(null);
  const orbDragRef = useRef<{ dragging: boolean; x: number; y: number }>({ dragging: false, x: 0, y: 0 });
  const ringPulseRef = useRef<boolean>(true);
  const ringImpactRef = useRef<number>(0.48);
  const particlesEnabledRef = useRef<boolean>(true);
  const particleDensityRef = useRef<number>(0.58);
  const titleSyncRef = useRef<boolean>(true);
  const beatPulseRef = useRef<boolean>(false);
  const shotLinkedRigsRef = useRef<boolean>(true);
  const shotRigMapRef = useRef<Record<CameraShotKey, LightRigState>>(createShotRigMap());
  const applyingShotRigRef = useRef<boolean>(false);
  const timelineFramesRef = useRef<RigKeyframe[]>([]);
  const timelineCursorRef = useRef<number>(0);
  const timelineDurationRef = useRef<number>(6);
  const timelineLoopRef = useRef<boolean>(true);
  const timelinePlayingRef = useRef<boolean>(false);
  const wasTimelinePlayingRef = useRef<boolean>(false);
  const historySuspendRef = useRef<boolean>(false);
  const historyReadyRef = useRef<boolean>(false);
  const historyLastRef = useRef<SceneSettings | null>(null);
  const historySigRef = useRef<string>("");
  const timelineRafRef = useRef<number | null>(null);
  const timelineLastTsRef = useRef<number>(0);
  const latestSettingsRef = useRef<SceneSettings | null>(null);
  const qualityModeRef = useRef<QualityMode>("final");
  const modelPosXRef = useRef<number>(0);
  const modelPosYRef = useRef<number>(0);
  const modelPosZRef = useRef<number>(0);
  const modelYawRef = useRef<number>(0);
  const modelScaleRef = useRef<number>(1);
  const modelFloatRef = useRef<boolean>(false);
  const modelAnimationPlayingRef = useRef<boolean>(true);
  const modelAnimationSpeedRef = useRef<number>(1);
  const modelMaterialModeRef = useRef<ModelMaterialMode>("original");
  const modelTintRef = useRef<string>("#d7deea");
  const modelMetalnessRef = useRef<number>(0.15);
  const modelRoughnessRef = useRef<number>(0.65);
  const activeModelClipRef = useRef<number>(0);
  const autoQualityRef = useRef<boolean>(false);
  const fpsRef = useRef<number>(60);
  const cameraFovOffsetRef = useRef<number>(0);
  const cameraDampingRef = useRef<number>(0.06);
  const cameraOrbitSpeedRef = useRef<number>(0.65);
  const cameraNearRef = useRef<number>(0.1);
  const cameraFarRef = useRef<number>(100);
  const hdriPresetRef = useRef<HdriPresetKey>("off");
  const hdriIntensityRef = useRef<number>(0.85);
  const hdriRotationRef = useRef<number>(0);
  const hdriBackgroundRef = useRef<boolean>(false);
  const hdriBlurRef = useRef<number>(0.05);
  const hdriExposureRef = useRef<number>(0);
  const hdriCustomSourceRef = useRef<string | null>(null);
  const hdriCustomIsHdrRef = useRef<boolean>(true);
  const hdriCustomNameRef = useRef<string>("None");
  const applyHdriRef = useRef<(() => void) | null>(null);
  const uploadedHdriUrlRef = useRef<string | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const panelDragRef = useRef<{ active: boolean; pointerId: number; offsetX: number; offsetY: number }>({
    active: false,
    pointerId: -1,
    offsetX: 0,
    offsetY: 0,
  });
  const screensEnabledRef = useRef<boolean>(true);
  const screensRef = useRef<ScreenCard[]>(createDefaultScreenCards());
  const activeScreenIdRef = useRef<string>(DEFAULT_SCREEN_CARDS[0].id);
  const sceneSelectionRef = useRef<SceneSelectionKind>("screen");
  const selectionLockedRef = useRef<boolean>(false);
  const inspectorLockRef = useRef<boolean>(false);
  const performanceTierRef = useRef<PerformanceTier>("balanced");
  const mediaDockModeRef = useRef<MediaDockMode>("inspector");
  const mediaDockCollapsedRef = useRef<boolean>(false);
  const playbackAuthorityRef = useRef<PlaybackAuthority>("scene");
  const mediaFidelityRef = useRef<number>(0.62);
  const uiModeRef = useRef<UiMode>("basic");
  const panelTabRef = useRef<PanelTab>("scene");
  const panelClosedRef = useRef<boolean>(false);
  const panelMinimizedRef = useRef<boolean>(false);
  const screenAttachmentModeRef = useRef<ScreenAttachmentMode>("follow-pos-yaw");
  const lightFollowPointRef = useRef<LightFollowPoint>("rig");
  const frameSelectionRef = useRef<(() => void) | null>(null);
  const cycleSelectionRef = useRef<((direction: 1 | -1) => void) | null>(null);
  const screenAssetUrlsRef = useRef<Set<string>>(new Set());
  const screenAudioMapRef = useRef<Map<string, { audio: HTMLAudioElement; src: string }>>(new Map());
  const screenMediaTimeRef = useRef<Map<string, number>>(new Map());
  const screenMediaResolutionRef = useRef<Record<string, string>>({});
  const mediaDockAudioMasterRef = useRef<boolean>(false);
  const mediaDockVideoEventLockUntilRef = useRef<number>(0);
  const mediaDockProviderRuntimeRef = useRef<{
    screenId: string;
    provider: ProviderName | null;
    embedBase: string;
    src: string;
    ready: boolean;
    appliedPlaying: boolean | null;
    appliedMuted: boolean | null;
  }>({
    screenId: "",
    provider: null,
    embedBase: "",
    src: "",
    ready: false,
    appliedPlaying: null,
    appliedMuted: null,
  });
  const comparePreviewOriginRef = useRef<SceneSettings | null>(null);
  const comparePreviewKeyRef = useRef<CompareSlotKey | null>(null);
  const compareSlotsRef = useRef<Record<CompareSlotKey, SceneSettings | null>>({
    a: null,
    b: null,
    c: null,
  });
  const lightPaintPointsRef = useRef<LightPaintPoint[]>([]);
  const lightPaintPlayingRef = useRef<boolean>(false);
  const lightPaintLoopRef = useRef<boolean>(true);
  const lightPaintSpeedRef = useRef<number>(1);
  const lightPaintTargetRef = useRef<"key" | "fill">("key");
  const lightPaintPlayheadRef = useRef<number>(0);
  const lastLightPaintCaptureRef = useRef<number>(0);
  const gizmoSnapEnabledRef = useRef<boolean>(true);
  const gizmoSnapGridRef = useRef<number>(0.1);
  const gizmoSnapAngleRef = useRef<number>(5);
  const sceneApiSessionIdRef = useRef<string>(createSceneApiId());
  const sceneApiStateVersionRef = useRef<number>(0);
  const sceneApiLastSignatureRef = useRef<string>("");
  const sceneApiSelectionSigRef = useRef<string>("");
  const sceneApiPlaybackOwnerSigRef = useRef<string>("");
  const sceneApiClientsRef = useRef<Map<string, SceneApiClient>>(new Map());
  const sceneApiListenersRef = useRef<Set<(event: SceneApiEventMessage) => void>>(new Set());
  const sceneApiIdempotencyRef = useRef<Map<string, { response: SceneApiResponseMessage; expiresAt: number }>>(new Map());
  const sceneApiScreenMediaSigRef = useRef<Map<string, string>>(new Map());
  const apiSequenceRunTokenRef = useRef<number>(0);
  const sceneApiHandleCommandRef = useRef<((command: SceneApiCommandMessage, meta: SceneApiCommandMeta) => Promise<SceneApiResponseMessage>) | null>(null);
  const sceneApiGetStateRef = useRef<(() => SceneSettings) | null>(null);
  const sceneApiGetCapabilitiesRef = useRef<(() => SceneApiCapabilities) | null>(null);

  const applyPreset = (next: PresetKey) => {
    const p = PRESETS[next];
    setPreset(next);
    setKeyColor(p.keyColor);
    setKeyIntensity(p.keyIntensity);
    setFillColor(p.fillColor);
    setFillIntensity(p.fillIntensity);
    setBloomStrength(p.bloom);
    setFogAmount(p.fogAmount);
  };

  const applyConstraintPreset = (presetKey: "portrait" | "no-spill" | "rim" | "soft-front") => {
    if (presetKey === "portrait") {
      setMinLightHeight(0.22);
      setMaxLightDistance(4);
      setStayLightsInFront(true);
      setAvoidBodyIntersection(true);
      setBodyClearance(0.62);
      return;
    }
    if (presetKey === "no-spill") {
      setMinLightHeight(0.4);
      setMaxLightDistance(3.8);
      setStayLightsInFront(false);
      setAvoidBodyIntersection(true);
      setBodyClearance(0.55);
      return;
    }
    if (presetKey === "rim") {
      setMinLightHeight(0.03);
      setMaxLightDistance(4.8);
      setStayLightsInFront(false);
      setAvoidBodyIntersection(true);
      setBodyClearance(0.72);
      setFillIntensity(0.42);
      setKeyIntensity(1.0);
      return;
    }
    setMinLightHeight(0.08);
    setMaxLightDistance(4.6);
    setStayLightsInFront(true);
    setAvoidBodyIntersection(true);
    setBodyClearance(0.52);
    setKeyIntensity(1.2);
    setFillIntensity(0.3);
  };

  const applyAutoRelight = (mode: "cinematic" | "rim" | "studio-soft" | "neon-edge") => {
    if (mode === "cinematic") {
      setPreset("noir");
      setGrade("film");
      setKeyAzimuth(38);
      setKeyElevation(54);
      setKeyDistance(3.4);
      setFillAzimuth(328);
      setFillElevation(24);
      setFillDistance(3.1);
      setKeyIntensity(1.18);
      setFillIntensity(0.28);
      setHideLightSource(true);
      return;
    }
    if (mode === "rim") {
      setPreset("noir");
      setGrade("cold");
      setKeyAzimuth(18);
      setKeyElevation(48);
      setFillAzimuth(210);
      setFillElevation(12);
      setKeyIntensity(1.02);
      setFillIntensity(0.45);
      setHideLightSource(true);
      return;
    }
    if (mode === "studio-soft") {
      setPreset("studio");
      setGrade("clean");
      setKeyAzimuth(32);
      setKeyElevation(62);
      setFillAzimuth(334);
      setFillElevation(36);
      setKeyIntensity(1.28);
      setFillIntensity(0.34);
      setHideLightSource(true);
      return;
    }
    setPreset("neon");
    setGrade("cold");
    setKeyAzimuth(46);
    setKeyElevation(52);
    setFillAzimuth(292);
    setFillElevation(21);
    setKeyIntensity(1.34);
    setFillIntensity(0.62);
    setFillColor("#00ffd4");
    setHideLightSource(true);
  };

  const applyFXPreset = (presetKey: FxPresetKey) => {
    setActiveFxPreset(presetKey);
    setParticlesEnabled(true);
    setGroundMotion(false);
    setSecondaryParticleStyle("none");
    setEffectBlend(0.34);
    if (presetKey === "halo") {
      setParticleStyle("orbit-balls");
      setEffectAmount(1.28);
      setEffectSpeed(0.9);
      setEffectScale(1.25);
      setEffectSpread(1.25);
      setParticleDensity(0.66);
      setRingPulse(true);
      setRingImpact(0.44);
      return;
    }
    if (presetKey === "storm") {
      setParticleStyle("embers");
      setSecondaryParticleStyle("shards");
      setEffectBlend(0.42);
      setEffectAmount(1.8);
      setEffectSpeed(1.72);
      setEffectScale(1.36);
      setEffectSpread(1.45);
      setParticleDensity(1.2);
      setRingPulse(true);
      setRingImpact(0.86);
      setGroundMotion(true);
      return;
    }
    if (presetKey === "glyph-net") {
      setParticleStyle("glyphs");
      setSecondaryParticleStyle("ribbons");
      setEffectBlend(0.38);
      setEffectAmount(1.35);
      setEffectSpeed(1.26);
      setEffectScale(1.52);
      setEffectSpread(1.22);
      setParticleDensity(0.95);
      setRingPulse(false);
      setRingImpact(0.22);
      return;
    }
    if (presetKey === "snow-room") {
      setParticleStyle("snow");
      setEffectAmount(1.42);
      setEffectSpeed(0.58);
      setEffectScale(1.74);
      setEffectSpread(1.36);
      setParticleDensity(1.28);
      setRingPulse(false);
      setRingImpact(0.2);
      return;
    }
    if (presetKey === "arc-reactor") {
      setParticleStyle("ribbons");
      setSecondaryParticleStyle("orbit-balls");
      setEffectBlend(0.28);
      setEffectAmount(1.56);
      setEffectSpeed(1.48);
      setEffectScale(1.34);
      setEffectSpread(1.18);
      setParticleDensity(0.9);
      setRingPulse(true);
      setRingImpact(0.52);
      return;
    }
    if (presetKey === "crystal-drift") {
      setParticleStyle("shards");
      setSecondaryParticleStyle("snow");
      setEffectBlend(0.34);
      setEffectAmount(1.44);
      setEffectSpeed(0.82);
      setEffectScale(1.62);
      setEffectSpread(1.54);
      setParticleDensity(1.08);
      setRingPulse(false);
      setRingImpact(0.12);
      return;
    }
    if (presetKey === "beam-cage") {
      setParticleStyle("shards");
      setSecondaryParticleStyle("glyphs");
      setEffectBlend(0.3);
      setEffectAmount(1.62);
      setEffectSpeed(1.14);
      setEffectScale(1.48);
      setEffectSpread(1.08);
      setParticleDensity(0.86);
      setRingPulse(true);
      setRingImpact(0.34);
      return;
    }
    setParticleStyle("orbit-balls");
    setSecondaryParticleStyle("ribbons");
    setEffectBlend(0.5);
    setEffectAmount(1.9);
    setEffectSpeed(1.45);
    setEffectScale(1.56);
    setEffectSpread(1.4);
    setParticleDensity(1.35);
    setRingPulse(true);
    setRingImpact(0.72);
  };

  const disableAllFx = () => {
    setActiveFxPreset(null);
    setParticlesEnabled(false);
    setSecondaryParticleStyle("none");
  };

  const toggleFxPreset = (presetKey: FxPresetKey) => {
    if (activeFxPreset === presetKey && particlesEnabled) {
      disableAllFx();
      return;
    }
    applyFXPreset(presetKey);
  };

  const toggleFxStyle = (style: ParticleStyle) => {
    if (particlesEnabled && particleStyle === style && secondaryParticleStyle === "none") {
      disableAllFx();
      return;
    }
    setActiveFxPreset(null);
    setParticlesEnabled(true);
    setParticleStyle(style);
  };

  const handleModelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".glb") && !lower.endsWith(".gltf")) {
      event.target.value = "";
      return;
    }

    if (uploadedModelUrlRef.current) {
      URL.revokeObjectURL(uploadedModelUrlRef.current);
      uploadedModelUrlRef.current = null;
    }

    const objectUrl = URL.createObjectURL(file);
    uploadedModelUrlRef.current = objectUrl;
    setModelSource(objectUrl);
    setModelName(file.name);
    event.target.value = "";
  };

  const resetModelSource = () => {
    if (uploadedModelUrlRef.current) {
      URL.revokeObjectURL(uploadedModelUrlRef.current);
      uploadedModelUrlRef.current = null;
    }
    setModelSource(DEFAULT_MODEL_SRC);
    setModelName("male_anatomy.glb");
    setModelClipNames([]);
    setActiveModelClip(0);
  };

  const selectHdriPreset = (next: HdriPresetKey) => {
    setHdriPreset(next);
    if (next === "custom") {
      setHdriName(hdriCustomNameRef.current || "Custom");
    } else if (next === "off") {
      setHdriName("None");
    } else {
      setHdriName(HDRI_PRESETS[next].label);
    }
  };

  const handleHdriUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isHdr = lower.endsWith(".hdr");
    const isLdrPanorama = lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp");
    if (!isHdr && !isLdrPanorama) {
      event.target.value = "";
      return;
    }
    if (uploadedHdriUrlRef.current) {
      URL.revokeObjectURL(uploadedHdriUrlRef.current);
      uploadedHdriUrlRef.current = null;
    }
    const objectUrl = URL.createObjectURL(file);
    uploadedHdriUrlRef.current = objectUrl;
    hdriCustomSourceRef.current = objectUrl;
    hdriCustomIsHdrRef.current = isHdr;
    hdriCustomNameRef.current = file.name;
    setHdriName(file.name);
    const wasCustom = hdriPresetRef.current === "custom";
    setHdriPreset("custom");
    if (wasCustom) {
      applyHdriRef.current?.();
    }
    event.target.value = "";
  };

  const activeScreen = screens.find((entry) => entry.id === activeScreenId) ?? null;
  const activeScreenStatus = activeScreen ? screenStatusById[activeScreen.id] ?? "" : "";
  const selectionLabel =
    sceneSelection === "none"
      ? "None"
      : sceneSelection === "screen"
        ? activeScreen
          ? `Screen ${activeScreen.label}`
          : "Screen"
        : sceneSelection === "light-key"
          ? "Light Key"
          : sceneSelection === "light-fill"
            ? "Light Fill"
            : sceneSelection === "light-target"
              ? "Light Target"
              : "Model";
  const showModelContextControls = !contextFocus || sceneSelection === "model" || sceneSelection === "none";
  const showScreenContextControls = !contextFocus || sceneSelection === "screen" || sceneSelection === "none";
  const showLightContextControls = !contextFocus || sceneSelection.startsWith("light-") || sceneSelection === "none";
  const sceneHudMode: "none" | "screen" | "model" | "light" =
    sceneSelection === "screen" && activeScreen
      ? "screen"
      : sceneSelection === "model"
        ? "model"
        : sceneSelection === "light-key" || sceneSelection === "light-fill" || sceneSelection === "light-target"
          ? "light"
          : "none";
  const sceneHudLightLabel =
    sceneSelection === "light-key"
      ? "Key"
      : sceneSelection === "light-fill"
        ? "Fill"
        : sceneSelection === "light-target"
          ? "Target"
          : "Light";

  const setScreenStatusMessage = useCallback((screenId: string, message: string) => {
    const nextMessage = message.trim();
    setScreenStatusById((prev) => {
      if (!screenId) return prev;
      const current = prev[screenId] ?? "";
      if (current === nextMessage) return prev;
      if (!nextMessage) {
        if (!(screenId in prev)) return prev;
        const next = { ...prev };
        delete next[screenId];
        return next;
      }
      return {
        ...prev,
        [screenId]: nextMessage,
      };
    });
  }, []);
  const setScreenMediaHasAudio = useCallback((screenId: string, hasAudio: boolean | null) => {
    if (!screenId) return;
    setScreenMediaHasAudioById((prev) => {
      if (hasAudio === null) {
        if (!(screenId in prev)) return prev;
        const next = { ...prev };
        delete next[screenId];
        return next;
      }
      const current = prev[screenId];
      if (current === hasAudio) return prev;
      return {
        ...prev,
        [screenId]: hasAudio,
      };
    });
  }, []);
  const setScreenMediaResolution = useCallback((screenId: string, width: number | null, height: number | null) => {
    if (!screenId) return;
    const nextValue =
      typeof width === "number" &&
      Number.isFinite(width) &&
      width > 0 &&
      typeof height === "number" &&
      Number.isFinite(height) &&
      height > 0
        ? `${Math.round(width)}x${Math.round(height)}`
        : null;
    const currentMap = screenMediaResolutionRef.current;
    const currentValue = currentMap[screenId];
    if (!nextValue) {
      if (!(screenId in currentMap)) return;
      const next = { ...currentMap };
      delete next[screenId];
      screenMediaResolutionRef.current = next;
      setScreenMediaResolutionById(next);
      return;
    }
    if (currentValue === nextValue) return;
    const next = {
      ...currentMap,
      [screenId]: nextValue,
    };
    screenMediaResolutionRef.current = next;
    setScreenMediaResolutionById(next);
  }, []);

  const parseProviderMedia = (url: string): { provider: ProviderName; id: string; embedBase: string } | null => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    const safeUrl = (() => {
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return `https://${trimmed}`;
    })();
    let parsed: URL;
    try {
      parsed = new URL(safeUrl);
    } catch {
      return null;
    }
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const path = parsed.pathname;

    if (host === "youtu.be" || host.endsWith("youtube.com")) {
      let id = "";
      if (host === "youtu.be") {
        id = path.replace(/^\/+/, "").split("/")[0] ?? "";
      } else if (path.startsWith("/watch")) {
        id = parsed.searchParams.get("v") ?? "";
      } else if (path.startsWith("/shorts/")) {
        id = path.split("/")[2] ?? "";
      } else if (path.startsWith("/embed/")) {
        id = path.split("/")[2] ?? "";
      }
      if (/^[A-Za-z0-9_-]{6,}$/.test(id)) {
        return {
          provider: "youtube",
          id,
          embedBase: `https://www.youtube.com/embed/${id}`,
        };
      }
    }

    if (host === "vimeo.com" || host.endsWith("vimeo.com")) {
      const segments = path.split("/").filter(Boolean);
      const found = segments.reverse().find((segment) => /^\d{5,}$/.test(segment));
      if (found) {
        return {
          provider: "vimeo",
          id: found,
          embedBase: `https://player.vimeo.com/video/${found}`,
        };
      }
    }

    return null;
  };

  const buildProviderEmbedUrl = (
    provider: ProviderName,
    embedBase: string,
    options: {
      autoplay: boolean;
      muted: boolean;
      loop?: boolean;
    }
  ) => {
    const url = new URL(embedBase);
    const autoplay = options.autoplay ? "1" : "0";
    const muted = options.muted ? "1" : "0";
    const loop = options.loop ? "1" : "0";
    if (provider === "youtube") {
      url.searchParams.set("autoplay", autoplay);
      url.searchParams.set("mute", muted);
      url.searchParams.set("controls", "1");
      url.searchParams.set("rel", "1");
      url.searchParams.set("fs", "1");
      url.searchParams.set("playsinline", "1");
      url.searchParams.set("enablejsapi", "1");
      if (typeof window !== "undefined") {
        url.searchParams.set("origin", window.location.origin);
      }
      if (options.loop) {
        const videoId = embedBase.split("/").pop()?.split("?")[0];
        if (videoId) {
          url.searchParams.set("loop", "1");
          url.searchParams.set("playlist", videoId);
        }
      }
      return url.toString();
    }
    url.searchParams.set("autoplay", autoplay);
    url.searchParams.set("muted", muted);
    url.searchParams.set("loop", loop);
    url.searchParams.set("controls", "1");
    url.searchParams.set("api", "1");
    url.searchParams.set("dnt", "1");
    return url.toString();
  };

  const isTrustedProviderOrigin = (provider: ProviderName | null, origin: string) => {
    if (!provider || !origin) return false;
    try {
      const parsed = new URL(origin);
      const host = parsed.hostname.toLowerCase();
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
      if (provider === "youtube") {
        return (
          host === "youtube.com" ||
          host === "www.youtube.com" ||
          host === "youtube-nocookie.com" ||
          host === "www.youtube-nocookie.com"
        );
      }
      return host === "player.vimeo.com" || host === "vimeo.com" || host === "www.vimeo.com";
    } catch {
      return false;
    }
  };

  const inferMediaKindFromUrl = (url: string, typeHint?: string): ScreenCard["mediaKind"] => {
    const lower = url.toLowerCase();
    if (parseProviderMedia(url)) return "provider";
    if (typeHint?.startsWith("video/")) return "video";
    if (typeHint === "image/gif") return "gif";
    if (typeHint?.startsWith("image/")) return "image";
    if (/\.(mp4|webm|ogg|mov|m4v)([?#].*)?$/.test(lower)) return "video";
    if (/\.gif([?#].*)?$/.test(lower)) return "gif";
    if (/\.(png|jpe?g|webp|avif|svg)([?#].*)?$/.test(lower)) return "image";
    return "image";
  };

  const normalizeRemoteAssetUrl = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (/^(blob:|data:|https?:)/i.test(trimmed)) return trimmed;
    if (/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}([/:?#].*)?$/i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };

  const isSupportedAssetUrl = (url: string) => /^(blob:|data:|https?:)/i.test(url);
  const isLocalSceneShell =
    typeof window !== "undefined" &&
    /^(127\.0\.0\.1|localhost)$/i.test(window.location.hostname) &&
    (window.location.port === "5176" || window.location.port === "5173");

  const toRuntimeMediaUrl = (url: string) => {
    if (!/^https?:/i.test(url)) return url;
    if (typeof window === "undefined") return url;
    if (!serverMediaEnabled) return url;
    return `/api/media-proxy?url=${encodeURIComponent(url)}`;
  };

  const fromRuntimeMediaUrl = (url: string | null) => {
    if (!url) return "";
    if (typeof window === "undefined") return url;
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.pathname === "/api/media-proxy") {
        return parsed.searchParams.get("url") || url;
      }
      return url;
    } catch {
      return url;
    }
  };

  const mediaDockVisible = Boolean(activeScreen && sceneSelection === "screen");
  const activeScreenCanControlAudio = Boolean(
    activeScreen &&
      (activeScreen.mediaKind === "provider" ||
        (activeScreen.mediaKind === "video" && (screenMediaHasAudioById[activeScreen.id] ?? true)))
  );
  const activeScreenPolicyMuted = useMemo(() => {
    if (!activeScreen) return false;
    const soloIds = collectSoloAudioScreenIds(screens);
    return soloIds.size > 0 && !soloIds.has(activeScreen.id);
  }, [activeScreen, screens]);
  const activeScreenAudioTrackLabel = !activeScreen
    ? "N/A"
    : activeScreen.mediaKind === "provider"
      ? "Provider"
      : activeScreen.mediaKind === "video"
        ? screenMediaHasAudioById[activeScreen.id] === false
          ? "No"
          : screenMediaHasAudioById[activeScreen.id] === true
            ? "Yes"
            : "Detecting"
        : "No";
  const resolveScreenSourceMode = (card: ScreenCard | null): ScreenSourceMode => {
    if (!card) return "auto";
    if (card.sourceMode === "integrated" || card.sourceMode === "provider") return card.sourceMode;
    return "auto";
  };
  const activeScreenSourceMode = resolveScreenSourceMode(activeScreen);
  const activeScreenDockVideoUrl =
    activeScreen && activeScreen.mediaKind === "video" && activeScreen.mediaUrl
      ? activeScreen.mediaUrl
      : null;
  const activeScreenDockImageUrl =
    activeScreen && (activeScreen.mediaKind === "image" || activeScreen.mediaKind === "gif") && activeScreen.mediaUrl
      ? activeScreen.mediaUrl
      : null;
  const activeScreenDockProviderMeta = useMemo(() => {
    if (!activeScreen) return null;
    if (activeScreen.mediaKind !== "provider") return null;
    const providerSource = activeScreen.mediaOriginalUrl ?? activeScreen.mediaUrl;
    if (!providerSource) return null;
    const parsed = parseProviderMedia(fromRuntimeMediaUrl(providerSource));
    if (!parsed) return null;
    return {
      provider: parsed.provider,
      embedBase: parsed.embedBase,
      source: fromRuntimeMediaUrl(providerSource),
    };
  }, [activeScreen]);
  const activeScreenDockProviderUrl = useMemo(() => {
    if (!activeScreenDockProviderMeta) return null;
    return buildProviderEmbedUrl(activeScreenDockProviderMeta.provider, activeScreenDockProviderMeta.embedBase, {
      autoplay: true,
      muted: true,
      loop: false,
    });
  }, [activeScreenDockProviderMeta]);
  const activeScreenMediaResolution = activeScreen ? screenMediaResolutionById[activeScreen.id] ?? "Auto" : "Auto";
  const activeScreenMediaSource = activeScreen?.mediaUrl ? fromRuntimeMediaUrl(activeScreen.mediaUrl) : "";
  const activeScreenUsesRemoteMedia = Boolean(
    activeScreen &&
      activeScreen.mediaUrl &&
      /^https?:/i.test(activeScreenMediaSource) &&
      activeScreen.mediaSourceType !== "localAsset"
  );
  const providerSingleSourceActive = Boolean(activeScreenDockProviderMeta && providerScreenPrimary);
  const showDockProviderPlayer = Boolean(activeScreenDockProviderUrl && mediaDockMode === "player" && !providerSingleSourceActive);
  const showDockVideoPlayer = Boolean(activeScreenDockVideoUrl && mediaDockMode === "player");
  const activeScreenSyncMode: "hard-sync" | "state-sync" | "single-source" = activeScreenDockProviderMeta
    ? providerSingleSourceActive
      ? "single-source"
      : "state-sync"
    : mediaDockMode === "player"
      ? "hard-sync"
      : "single-source";
  const activeScreenCapabilityLabel = activeScreenDockProviderMeta
    ? providerSingleSourceActive
      ? "Screen Native"
      : "Native UI"
    : mediaDockMode === "player"
      ? "Projected"
      : "Scene Texture";
  const activeScreenPipelineLabel = activeScreenDockProviderMeta
    ? providerSingleSourceActive
      ? "Native provider on screen"
      : "Provider mirrored via dock"
    : mediaDockMode === "player"
      ? "Dock player -> screen projection"
      : "Scene texture only";
  const activeScreenSyncLabel =
    activeScreenSyncMode === "hard-sync"
      ? "Hard Sync"
      : activeScreenSyncMode === "state-sync"
        ? "State Sync"
        : "Single Source";
  const activePlaybackOwner = !activeScreen
    ? "none"
    : activeScreenDockProviderMeta
      ? providerSingleSourceActive
        ? "screen-provider"
        : mediaDockMode === "player"
          ? "dock-provider"
          : "screen-provider"
      : mediaDockMode === "player"
        ? "dock-video"
        : "screen-video";
  const mediaDockAudioMaster = Boolean(
    !mediaDockCollapsed &&
      mediaDockVisible &&
      activeScreen &&
      mediaDockMode === "player" &&
      (showDockProviderPlayer || showDockVideoPlayer)
  );
  mediaDockAudioMasterRef.current = mediaDockAudioMaster;
  const lockMediaDockVideoEvents = (durationMs = 180) => {
    mediaDockVideoEventLockUntilRef.current = Math.max(mediaDockVideoEventLockUntilRef.current, Date.now() + durationMs);
  };
  const activeScreenSourceLabel = useMemo(() => {
    if (!activeScreen || !activeScreen.mediaUrl) return "No source";
    const providerSource = activeScreen.mediaOriginalUrl ?? (activeScreen.mediaKind === "provider" ? activeScreen.mediaUrl : null);
    if (providerSource) {
      const parsedProvider = parseProviderMedia(fromRuntimeMediaUrl(providerSource));
      if (parsedProvider) {
        return `${parsedProvider.provider.toUpperCase()} embed`;
      }
    }
    const source = fromRuntimeMediaUrl(activeScreen.mediaUrl);
    if (source.startsWith("blob:")) return "Local file";
    if (source.startsWith("data:")) return "Inline data URL";
    try {
      const parsed = new URL(source);
      return parsed.hostname.replace(/^www\./i, "");
    } catch {
      return source.slice(0, 48);
    }
  }, [activeScreen]);

  const resolveProviderToIntegratedVideo = useCallback(async (rawUrl: string) => {
    if (!serverMediaEnabled) return null;
    if (typeof window === "undefined") return null;
    try {
      const response = await fetch(`/api/resolve-media?url=${encodeURIComponent(rawUrl)}`, {
        method: "GET",
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as { ok?: boolean; url?: string };
      if (!payload?.ok || typeof payload.url !== "string") return null;
      const resolved = payload.url.trim();
      if (!resolved || !/^https?:/i.test(resolved)) return null;
      return resolved;
    } catch {
      return null;
    }
  }, [serverMediaEnabled]);

  const resolveMediaInput = (
    url: string,
    typeHint?: string,
    sourceHint: SceneApiSourceType = "directUrl"
  ): {
    kind: ScreenCard["mediaKind"];
    sourceType: SceneApiSourceType;
    provider: ProviderName | null;
    embedBase: string | null;
  } | null => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (sourceHint === "provider") {
      const provider = parseProviderMedia(trimmed);
      if (!provider) return null;
      return {
        kind: "provider",
        sourceType: "provider",
        provider: provider.provider,
        embedBase: provider.embedBase,
      };
    }
    const provider = parseProviderMedia(trimmed);
    if (provider) {
      return {
        kind: "provider",
        sourceType: "provider",
        provider: provider.provider,
        embedBase: provider.embedBase,
      };
    }
    return {
      kind: inferMediaKindFromUrl(trimmed, typeHint),
      sourceType: sourceHint,
      provider: null,
      embedBase: null,
    };
  };

  const fitScreenToAspect = useCallback((screenId: string, rawAspect: number) => {
    if (!screenId) return;
    if (!Number.isFinite(rawAspect) || rawAspect <= 0) return;
    const safeAspect = THREE.MathUtils.clamp(rawAspect, 0.2, 5);
    setScreens((prev) =>
      prev.map((entry) => {
        if (entry.id !== screenId) return entry;
        // Compensate for underlying screen mesh aspect so visible media ratio is exact.
        const scalarAspect = safeAspect / SCREEN_GEOMETRY_ASPECT;
        let width = scalarAspect >= 1 ? scalarAspect : 1;
        let height = scalarAspect >= 1 ? 1 : 1 / scalarAspect;

        // Preserve current perceived size while changing aspect.
        const currentScale = THREE.MathUtils.clamp(entry.scale, 0.2, 3.5);
        const currentArea = Math.max(0.12, entry.width * entry.height * currentScale * currentScale);
        const baseArea = Math.max(0.0001, width * height);
        const areaFactor = Math.sqrt(currentArea / baseArea);
        width *= areaFactor;
        height *= areaFactor;

        const maxEdge = Math.max(width, height);
        if (maxEdge > 2.6) {
          const down = 2.6 / maxEdge;
          width *= down;
          height *= down;
        }
        const minEdge = Math.min(width, height);
        if (minEdge < 0.35) {
          const up = 0.35 / Math.max(0.0001, minEdge);
          width *= up;
          height *= up;
        }
        width = THREE.MathUtils.clamp(width, 0.35, 2.6);
        height = THREE.MathUtils.clamp(height, 0.35, 2.6);
        return {
          ...entry,
          scale: 1,
          width,
          height,
        };
      })
    );
  }, []);

  const probeImageAspect = useCallback((url: string) => {
    return new Promise<number | null>((resolve) => {
      const image = new Image();
      let settled = false;
      const finish = (value: number | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const timer = window.setTimeout(() => finish(null), 7000);
      image.onload = () => {
        window.clearTimeout(timer);
        finish(image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : null);
      };
      image.onerror = () => {
        window.clearTimeout(timer);
        finish(null);
      };
      image.src = url;
    });
  }, []);

  const probeVideoAspect = useCallback((url: string) => {
    return new Promise<number | null>((resolve) => {
      const video = document.createElement("video");
      let settled = false;
      const finish = (value: number | null) => {
        if (settled) return;
        settled = true;
        video.pause();
        video.removeAttribute("src");
        video.load();
        resolve(value);
      };
      const timer = window.setTimeout(() => finish(null), 8000);
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      video.onloadedmetadata = () => {
        window.clearTimeout(timer);
        finish(video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : null);
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        finish(null);
      };
      video.src = url;
    });
  }, []);

  const applyAspectFitForMedia = useCallback(
    (screenId: string, mediaUrl: string | null, mediaKind: ScreenCard["mediaKind"], force = false) => {
      if (!screenId || !mediaUrl) return;
      if (!force && !autoFitMediaAspect) return;
      if (mediaKind === "provider") {
        fitScreenToAspect(screenId, 16 / 9);
        return;
      }
      if (mediaKind === "video" || mediaKind === "gif") {
        void probeVideoAspect(mediaUrl).then((aspect) => {
          if (!aspect) return;
          fitScreenToAspect(screenId, aspect);
        });
        return;
      }
      if (mediaKind === "image") {
        void probeImageAspect(mediaUrl).then((aspect) => {
          if (!aspect) return;
          fitScreenToAspect(screenId, aspect);
        });
      }
    },
    [autoFitMediaAspect, fitScreenToAspect, probeImageAspect, probeVideoAspect]
  );

  const fitActiveScreenToMediaAspect = useCallback(() => {
    if (!activeScreen?.mediaUrl) return;
    applyAspectFitForMedia(activeScreen.id, activeScreen.mediaUrl, activeScreen.mediaKind, true);
  }, [activeScreen, applyAspectFitForMedia]);

  const revokeBlobIfUnused = (url: string | null, excludingId?: string) => {
    if (!url || !url.startsWith("blob:")) return;
    const stillUsed = screens.some(
      (entry) => entry.id !== excludingId && (entry.mediaUrl === url || entry.audioUrl === url)
    );
    if (!stillUsed) {
      URL.revokeObjectURL(url);
      screenAssetUrlsRef.current.delete(url);
    }
  };

  const updateScreenCard = (id: string, patch: Partial<ScreenCard>) => {
    setScreens((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...patch,
            }
          : entry
      )
    );
  };

  const clearActiveScreenMedia = () => {
    if (!activeScreen?.mediaUrl) return;
    const activeId = activeScreen.id;
    const previousAudioUrl = activeScreen.audioUrl;
    setScreens((prev) =>
      prev.map((entry) =>
        entry.id === activeId
          ? {
              ...entry,
              mediaUrl: null,
              mediaOriginalUrl: null,
              mediaKind: "none",
              mediaSourceType: "directUrl",
              mediaProvider: null,
              mediaEmbedBase: null,
              mediaPlaying: true,
              mediaMuted: true,
              audioOnly: false,
              audioUrl: null,
              audioPlaying: false,
            }
          : entry
      )
    );
    revokeBlobIfUnused(activeScreen.mediaUrl, activeId);
    if (previousAudioUrl) {
      revokeBlobIfUnused(previousAudioUrl, activeId);
    }
    const runtime = screenAudioMapRef.current.get(activeId);
    if (runtime) {
      runtime.audio.pause();
      runtime.audio.src = "";
      screenAudioMapRef.current.delete(activeId);
    }
    screenMediaTimeRef.current.delete(activeId);
    setScreenMediaHasAudio(activeId, null);
    setScreenMediaResolution(activeId, null, null);
    setScreenMediaUrlInput("");
    setScreenAudioUrlInput("");
    setScreenStatusMessage(activeId, "");
  };

  const clearActiveScreenAudio = () => {
    if (!activeScreen?.audioUrl) return;
    const activeId = activeScreen.id;
    setScreens((prev) =>
      prev.map((entry) =>
        entry.id === activeId
          ? {
              ...entry,
              audioUrl: null,
              audioPlaying: false,
              audioOnly: entry.mediaUrl ? entry.audioOnly : false,
            }
          : entry
      )
    );
    const runtime = screenAudioMapRef.current.get(activeId);
    if (runtime) {
      runtime.audio.pause();
      runtime.audio.src = "";
      screenAudioMapRef.current.delete(activeId);
    }
    revokeBlobIfUnused(activeScreen.audioUrl, activeId);
    setScreenAudioUrlInput("");
    if (!activeScreen.mediaUrl) {
      setScreenMediaResolution(activeId, null, null);
    }
    setScreenStatusMessage(activeId, "");
  };

  const addScreenCard = () => {
    if (screens.length >= 8) return;
    const nextId = `screen-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const index = screens.length;
    const nextCard: ScreenCard = {
      id: nextId,
      label: String.fromCharCode(65 + (index % 26)),
      x: THREE.MathUtils.clamp(-0.8 + index * 0.55, -3.5, 3.5),
      y: 1.25 + (index % 3) * 0.26,
      z: index % 2 === 0 ? 0.45 : -0.45,
      yaw: index % 2 === 0 ? 22 : -22,
      scale: 0.9,
      width: 1,
      height: 1,
      bend: 0,
      text: `PANEL ${index + 1}`,
      mediaUrl: null,
      mediaOriginalUrl: null,
      mediaKind: "none",
      mediaSourceType: "directUrl",
      mediaProvider: null,
      mediaEmbedBase: null,
      sourceMode: "auto",
      mediaPlaying: true,
      mediaMuted: true,
      audioUrl: null,
      audioPlaying: false,
      audioOnly: false,
      audioPolicy: "normal",
      showFrame: true,
      visible: true,
      shape: "panel",
    };
    setScreens((prev) => [...prev, nextCard]);
    setActiveScreenId(nextId);
    setSceneSelection("screen");
  };

  const duplicateActiveScreen = () => {
    if (!activeScreen || screens.length >= 8) return;
    const nextId = `${activeScreen.id}-copy-${Math.floor(Math.random() * 1000)}`;
    const copy: ScreenCard = {
      ...activeScreen,
      id: nextId,
      label: `${activeScreen.label}*`,
      x: THREE.MathUtils.clamp(activeScreen.x + 0.32, -4, 4),
      y: THREE.MathUtils.clamp(activeScreen.y + 0.12, -0.5, 4),
      z: THREE.MathUtils.clamp(activeScreen.z + 0.1, -4, 4),
    };
    setScreens((prev) => [...prev, copy]);
    setActiveScreenId(nextId);
    setSceneSelection("screen");
  };

  const removeActiveScreen = () => {
    if (!activeScreen || screens.length <= 1) return;
    const toRemove = activeScreen;
    const next = screens.filter((entry) => entry.id !== toRemove.id);
    setScreens(next);
    const nextId = next[0]?.id ?? "";
    setActiveScreenId(nextId);
    setSceneSelection(nextId ? "screen" : "none");
    const audioRuntime = screenAudioMapRef.current.get(toRemove.id);
    if (audioRuntime) {
      audioRuntime.audio.pause();
      audioRuntime.audio.src = "";
      screenAudioMapRef.current.delete(toRemove.id);
    }
    if (toRemove.mediaUrl?.startsWith("blob:") && !next.some((entry) => entry.mediaUrl === toRemove.mediaUrl)) {
      URL.revokeObjectURL(toRemove.mediaUrl);
      screenAssetUrlsRef.current.delete(toRemove.mediaUrl);
    }
    if (toRemove.audioUrl?.startsWith("blob:") && !next.some((entry) => entry.audioUrl === toRemove.audioUrl)) {
      URL.revokeObjectURL(toRemove.audioUrl);
      screenAssetUrlsRef.current.delete(toRemove.audioUrl);
    }
    screenMediaTimeRef.current.delete(toRemove.id);
    setScreenMediaHasAudio(toRemove.id, null);
    setScreenMediaResolution(toRemove.id, null, null);
  };

  const applyActiveScreenMediaUrl = async (overrideUrl?: string) => {
    if (!activeScreen) return;
    setPlaybackAuthority("scene");
    const nextUrl = normalizeRemoteAssetUrl(overrideUrl ?? screenMediaUrlInput);
    const activeId = activeScreen.id;
    const previous = activeScreen.mediaUrl;
    const previousAudio = activeScreen.audioUrl;
    const sourceMode = resolveScreenSourceMode(activeScreen);
    if (!nextUrl) {
      clearActiveScreenMedia();
      return;
    }
    if (!isSupportedAssetUrl(nextUrl)) {
      setScreenStatusMessage(activeId, "Unsupported URL. Use https://, blob:, data:, or upload a file.");
      return;
    }
    const nextMedia = resolveMediaInput(nextUrl, undefined, "directUrl");
    if (!nextMedia) {
      setScreenStatusMessage(activeId, "Media URL is not supported. Use direct media or YouTube/Vimeo.");
      return;
    }
    let effectiveSourceMode = sourceMode;
    if (nextMedia.kind === "provider" && sourceMode === "integrated" && !serverMediaEnabled) {
      effectiveSourceMode = "provider";
      setScreenStatusMessage(activeId, "Safe deploy mode: integrated provider stream is unavailable. Using native provider.");
    }
    const shouldIntegrateProvider =
      nextMedia.kind === "provider" &&
      (effectiveSourceMode === "integrated" || (effectiveSourceMode === "auto" && preferIntegratedProvider)) &&
      serverMediaEnabled;
    if (nextMedia.kind === "provider" && shouldIntegrateProvider) {
      setScreenStatusMessage(activeId, "Resolving provider into integrated video...");
      const resolvedStreamUrl = await resolveProviderToIntegratedVideo(nextUrl);
      if (resolvedStreamUrl) {
        const runtimeResolvedUrl = toRuntimeMediaUrl(resolvedStreamUrl);
        setScreens((prev) =>
          prev.map((entry) =>
            entry.id === activeId
              ? {
                  ...entry,
                  mediaUrl: runtimeResolvedUrl,
                  mediaOriginalUrl: nextUrl,
                  mediaKind: "video",
                  mediaSourceType: "directUrl",
                  mediaProvider: null,
                  mediaEmbedBase: null,
                  sourceMode: effectiveSourceMode,
                  mediaPlaying: true,
                  mediaMuted: false,
                  audioOnly: false,
                  audioUrl: null,
                  audioPlaying: false,
                }
              : entry
          )
        );
        if (previous && previous !== runtimeResolvedUrl) {
          revokeBlobIfUnused(previous, activeId);
        }
        if (previousAudio) {
          revokeBlobIfUnused(previousAudio, activeId);
        }
        const runtimeAudio = screenAudioMapRef.current.get(activeId);
        if (runtimeAudio) {
          runtimeAudio.audio.pause();
          runtimeAudio.audio.src = "";
          screenAudioMapRef.current.delete(activeId);
        }
        setScreenAudioUrlInput("");
        setScreenMediaHasAudio(activeId, true);
        setScreenMediaResolution(activeId, null, null);
        setScreenMediaUrlInput(nextUrl);
        setScreenStatusMessage(activeId, "Integrated video stream active.");
        applyAspectFitForMedia(activeId, runtimeResolvedUrl, "video", true);
        return;
      }
      if (effectiveSourceMode === "integrated") {
        setScreenStatusMessage(activeId, "Integrated mode requires a resolvable stream. Switch to Native Provider if needed.");
        return;
      }
      setScreenStatusMessage(
        activeId,
        "Provider integration failed. Falling back to native provider player."
      );
    }
    const runtimeMediaUrl = nextMedia.kind === "provider" ? nextUrl : toRuntimeMediaUrl(nextUrl);
    setScreens((prev) =>
      prev.map((entry) =>
        entry.id === activeId
          ? {
              ...entry,
              mediaUrl: runtimeMediaUrl,
              mediaOriginalUrl: nextMedia.kind === "provider" ? nextUrl : null,
              mediaKind: nextMedia.kind,
              mediaSourceType: nextMedia.sourceType,
              mediaProvider: nextMedia.provider,
              mediaEmbedBase: nextMedia.embedBase,
              sourceMode: effectiveSourceMode,
              mediaPlaying:
                nextMedia.kind === "video" || nextMedia.kind === "gif" || nextMedia.kind === "provider"
                  ? true
                  : entry.mediaPlaying,
              mediaMuted:
                nextMedia.kind === "provider"
                  ? true
                  : nextMedia.kind === "video"
                    ? false
                    : entry.mediaMuted,
              audioOnly: false,
              audioUrl: null,
              audioPlaying: false,
            }
          : entry
      )
    );
    if (previous && previous !== runtimeMediaUrl) {
      revokeBlobIfUnused(previous, activeId);
    }
    if (previousAudio) {
      revokeBlobIfUnused(previousAudio, activeId);
    }
    const runtimeAudio = screenAudioMapRef.current.get(activeId);
    if (runtimeAudio) {
      runtimeAudio.audio.pause();
      runtimeAudio.audio.src = "";
      screenAudioMapRef.current.delete(activeId);
    }
    setScreenAudioUrlInput("");
    if (nextMedia.kind === "provider" || nextMedia.kind === "video") {
      setScreenMediaHasAudio(activeId, true);
    } else {
      setScreenMediaHasAudio(activeId, null);
    }
    setScreenMediaResolution(activeId, null, null);
    setScreenMediaUrlInput(nextUrl);
    setScreenStatusMessage(
      activeId,
      nextMedia.kind === "provider"
        ? providerScreenPrimary
          ? "Native provider active on screen."
          : "Loading provider stream..."
        : "Loading media..."
    );
    applyAspectFitForMedia(activeId, runtimeMediaUrl, nextMedia.kind, true);
  };

  const promptApplyActiveScreenMediaUrl = async () => {
    if (!activeScreen || typeof window === "undefined") return;
    const currentUrl = fromRuntimeMediaUrl(activeScreen.mediaOriginalUrl ?? activeScreen.mediaUrl ?? "");
    const input = window.prompt("Paste media URL", currentUrl);
    if (input === null) return;
    const next = input.trim();
    setScreenMediaUrlInput(next);
    await applyActiveScreenMediaUrl(next);
  };

  const applyActiveScreenAudioUrl = async () => {
    if (!activeScreen) return;
    setPlaybackAuthority("scene");
    const nextUrl = normalizeRemoteAssetUrl(screenAudioUrlInput);
    const activeId = activeScreen.id;
    const previous = activeScreen.audioUrl;
    const sourceMode = resolveScreenSourceMode(activeScreen);
    if (!nextUrl) {
      clearActiveScreenAudio();
      return;
    }
    if (!isSupportedAssetUrl(nextUrl)) {
      setScreenStatusMessage(activeId, "Unsupported URL. Use https://, blob:, data:, or upload a file.");
      return;
    }
    const providerMedia = parseProviderMedia(nextUrl);
    const isLikelyVideoUrl = /\.(mp4|webm|ogg|mov|m4v)([?#].*)?$/i.test(nextUrl);
    if (providerMedia || isLikelyVideoUrl) {
      let effectiveSourceMode = sourceMode;
      if (providerMedia && sourceMode === "integrated" && !serverMediaEnabled) {
        effectiveSourceMode = "provider";
        setScreenStatusMessage(activeId, "Safe deploy mode: integrated provider stream is unavailable. Using native provider.");
      }
      const shouldIntegrateProvider =
        Boolean(providerMedia) &&
        (effectiveSourceMode === "integrated" || (effectiveSourceMode === "auto" && preferIntegratedProvider)) &&
        serverMediaEnabled;
      let mediaUrlForAudioMode = nextUrl;
      let mediaKindForAudioMode: ScreenCard["mediaKind"] = providerMedia ? "provider" : "video";
      let mediaSourceTypeForAudioMode: SceneApiSourceType = providerMedia ? "provider" : "directUrl";
      let mediaProviderForAudioMode: ProviderName | null = providerMedia ? providerMedia.provider : null;
      let mediaEmbedBaseForAudioMode: string | null = providerMedia ? providerMedia.embedBase : null;
      if (providerMedia && shouldIntegrateProvider) {
        setScreenStatusMessage(activeId, "Resolving provider audio into integrated stream...");
        const resolvedStreamUrl = await resolveProviderToIntegratedVideo(nextUrl);
        if (resolvedStreamUrl) {
          mediaUrlForAudioMode = toRuntimeMediaUrl(resolvedStreamUrl);
          mediaKindForAudioMode = "video";
          mediaSourceTypeForAudioMode = "directUrl";
          mediaProviderForAudioMode = null;
          mediaEmbedBaseForAudioMode = null;
        } else {
          if (effectiveSourceMode === "integrated") {
            setScreenStatusMessage(activeId, "Integrated mode requires a resolvable stream. Switch to Native Provider if needed.");
            return;
          }
          setScreenStatusMessage(
            activeId,
            "Provider audio integration failed. Falling back to native provider player."
          );
        }
      } else if (!providerMedia) {
        mediaUrlForAudioMode = toRuntimeMediaUrl(nextUrl);
      }
      const previousMedia = activeScreen.mediaUrl;
      setScreens((prev) =>
        prev.map((entry) =>
          entry.id === activeId
            ? {
              ...entry,
                mediaUrl: mediaUrlForAudioMode,
                mediaOriginalUrl: providerMedia ? nextUrl : null,
                mediaKind: mediaKindForAudioMode,
                mediaSourceType: mediaSourceTypeForAudioMode,
                mediaProvider: mediaProviderForAudioMode,
                mediaEmbedBase: mediaEmbedBaseForAudioMode,
                sourceMode: effectiveSourceMode,
                mediaPlaying: true,
                mediaMuted: false,
                audioOnly: true,
                audioUrl: null,
                audioPlaying: false,
              }
            : entry
        )
      );
      if (previousMedia && previousMedia !== mediaUrlForAudioMode) {
        revokeBlobIfUnused(previousMedia, activeId);
      }
      if (previous && previous !== nextUrl) {
        revokeBlobIfUnused(previous, activeId);
      }
      setScreenMediaUrlInput(nextUrl);
      setScreenMediaResolution(activeId, null, null);
      setScreenStatusMessage(
        activeId,
        mediaKindForAudioMode === "provider" ? "Loading provider audio..." : "Loading video audio..."
      );
      applyAspectFitForMedia(activeId, mediaUrlForAudioMode, mediaKindForAudioMode);
      return;
    }
    setScreens((prev) =>
      prev.map((entry) =>
        entry.id === activeId
          ? {
              ...entry,
              audioUrl: nextUrl,
              audioPlaying: true,
              audioOnly: true,
            }
          : entry
      )
    );
    setScreenMediaResolution(activeId, null, null);
    if (previous && previous !== nextUrl) {
      revokeBlobIfUnused(previous, activeId);
    }
    setScreenStatusMessage(activeId, "Loading audio...");
  };

  const toggleActiveScreenMediaPlayback = () => {
    if (!activeScreen || activeScreen.mediaKind === "none" || activeScreen.mediaKind === "image") return;
    setPlaybackAuthority("scene");
    updateScreenCard(activeScreen.id, { mediaPlaying: !activeScreen.mediaPlaying });
  };

  const toggleActiveScreenMediaMute = () => {
    if (!activeScreen) return;
    if (activeScreen.mediaKind !== "video" && activeScreen.mediaKind !== "provider") return;
    setPlaybackAuthority("scene");
    updateScreenCard(activeScreen.id, { mediaMuted: !activeScreen.mediaMuted });
  };

  const toggleActiveScreenAudioPlayback = () => {
    if (!activeScreen) return;
    if (activeScreen.audioUrl) {
      setPlaybackAuthority("scene");
      updateScreenCard(activeScreen.id, { audioPlaying: !activeScreen.audioPlaying });
      return;
    }
    if (activeScreen.mediaKind === "provider" || activeScreen.mediaKind === "video") {
      setPlaybackAuthority("scene");
      updateScreenCard(activeScreen.id, { mediaMuted: !activeScreen.mediaMuted });
    }
  };

  const handleScreenMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeScreen) return;
    setPlaybackAuthority("scene");
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      event.target.value = "";
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    screenAssetUrlsRef.current.add(objectUrl);
    const mediaKind = inferMediaKindFromUrl(file.name, file.type);
    const activeId = activeScreen.id;
    const previousAudio = activeScreen.audioUrl;
    setScreens((prev) =>
      prev.map((entry) =>
        entry.id === activeId
          ? {
              ...entry,
              mediaUrl: objectUrl,
              mediaOriginalUrl: null,
              mediaKind,
              mediaSourceType: "localAsset",
              mediaProvider: null,
              mediaEmbedBase: null,
              mediaPlaying: mediaKind === "video" || mediaKind === "gif" ? true : entry.mediaPlaying,
              mediaMuted: mediaKind === "video" ? false : entry.mediaMuted,
              audioOnly: false,
              audioUrl: null,
              audioPlaying: false,
            }
          : entry
      )
    );
    setScreenMediaUrlInput(objectUrl);
    const previous = activeScreen.mediaUrl;
    if (
      previous &&
      previous.startsWith("blob:") &&
      !screens.some((entry) => entry.id !== activeId && entry.mediaUrl === previous)
    ) {
      URL.revokeObjectURL(previous);
      screenAssetUrlsRef.current.delete(previous);
    }
    if (previousAudio) {
      revokeBlobIfUnused(previousAudio, activeId);
    }
    const runtimeAudio = screenAudioMapRef.current.get(activeId);
    if (runtimeAudio) {
      runtimeAudio.audio.pause();
      runtimeAudio.audio.src = "";
      screenAudioMapRef.current.delete(activeId);
    }
    setScreenAudioUrlInput("");
    if (mediaKind === "video" || mediaKind === "provider") {
      setScreenMediaHasAudio(activeId, true);
    } else {
      setScreenMediaHasAudio(activeId, null);
    }
    setScreenMediaResolution(activeId, null, null);
    setScreenStatusMessage(activeId, "Loading local media...");
    applyAspectFitForMedia(activeId, objectUrl, mediaKind, true);
    event.target.value = "";
  };

  const handleScreenAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeScreen) return;
    setPlaybackAuthority("scene");
    const isAudio = file.type.startsWith("audio/");
    const isVideo = file.type.startsWith("video/");
    if (!isAudio && !isVideo) {
      event.target.value = "";
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    screenAssetUrlsRef.current.add(objectUrl);
    const activeId = activeScreen.id;
    const previousAudio = activeScreen.audioUrl;
    const previousMedia = activeScreen.mediaUrl;
    if (isVideo) {
      setScreens((prev) =>
        prev.map((entry) =>
          entry.id === activeId
            ? {
                ...entry,
                mediaUrl: objectUrl,
                mediaOriginalUrl: null,
                mediaKind: "video",
                mediaSourceType: "localAsset",
                mediaProvider: null,
                mediaEmbedBase: null,
                mediaPlaying: true,
                mediaMuted: false,
                audioOnly: true,
                audioUrl: null,
                audioPlaying: false,
              }
            : entry
        )
      );
      setScreenMediaUrlInput(objectUrl);
      if (
        previousMedia &&
        previousMedia.startsWith("blob:") &&
        !screens.some((entry) => entry.id !== activeId && entry.mediaUrl === previousMedia)
      ) {
        URL.revokeObjectURL(previousMedia);
        screenAssetUrlsRef.current.delete(previousMedia);
      }
      if (
        previousAudio &&
        previousAudio.startsWith("blob:") &&
        !screens.some((entry) => entry.id !== activeId && entry.audioUrl === previousAudio)
      ) {
        URL.revokeObjectURL(previousAudio);
        screenAssetUrlsRef.current.delete(previousAudio);
      }
      setScreenMediaResolution(activeId, null, null);
      setScreenStatusMessage(activeId, "Loading local video audio...");
      applyAspectFitForMedia(activeId, objectUrl, "video", true);
      event.target.value = "";
      return;
    }
    setScreens((prev) =>
      prev.map((entry) =>
        entry.id === activeId
          ? {
              ...entry,
              audioUrl: objectUrl,
              audioPlaying: true,
              audioOnly: true,
            }
          : entry
      )
    );
    setScreenAudioUrlInput(objectUrl);
    if (
      previousAudio &&
      previousAudio.startsWith("blob:") &&
      !screens.some((entry) => entry.id !== activeId && entry.audioUrl === previousAudio)
    ) {
      URL.revokeObjectURL(previousAudio);
      screenAssetUrlsRef.current.delete(previousAudio);
    }
    setScreenMediaResolution(activeId, null, null);
    setScreenStatusMessage(activeId, "Loading local audio...");
    event.target.value = "";
  };

  const clampPanelToViewport = (x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    const panelWidth = panelRef.current?.offsetWidth ?? (panelMinimized ? 138 : 300);
    const panelHeight = panelRef.current?.offsetHeight ?? (panelMinimized ? 112 : 560);
    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - panelWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - panelHeight - margin);
    return {
      x: THREE.MathUtils.clamp(x, margin, maxX),
      y: THREE.MathUtils.clamp(y, margin, maxY),
    };
  };

  const handlePanelDragStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const panelRect = panelRef.current?.getBoundingClientRect();
    if (!panelRect) return;
    panelDragRef.current.active = true;
    panelDragRef.current.pointerId = event.pointerId;
    panelDragRef.current.offsetX = event.clientX - panelRect.left;
    panelDragRef.current.offsetY = event.clientY - panelRect.top;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const activeOrbitalAzimuth = activeOrbitalLight === "key" ? keyAzimuth : fillAzimuth;
  const activeOrbitalElevation = activeOrbitalLight === "key" ? keyElevation : fillElevation;
  const activeOrbitalDistance = activeOrbitalLight === "key" ? keyDistance : fillDistance;
  const activeOrbitalLift = activeOrbitalLight === "key" ? keyOffsetY : fillOffsetY;
  const orbitalMarker = getOrbitalMarker(activeOrbitalAzimuth, activeOrbitalElevation);

  const setActiveOrbitalAngles = (azimuth: number, elevation: number) => {
    const nextAz = wrapAngle(azimuth);
    const nextEl = clampElevation(elevation);
    if (activeOrbitalLight === "key") {
      setKeyAzimuth(nextAz);
      setKeyElevation(nextEl);
      return;
    }
    setFillAzimuth(nextAz);
    setFillElevation(nextEl);
  };

  const setActiveOrbitalDistance = (distance: number) => {
    const next = THREE.MathUtils.clamp(distance, 0.6, 12);
    if (activeOrbitalLight === "key") {
      setKeyDistance(next);
      return;
    }
    setFillDistance(next);
  };

  const setActiveOrbitalLift = (value: number) => {
    const next = THREE.MathUtils.clamp(value, -4, 4);
    if (activeOrbitalLight === "key") {
      setKeyOffsetY(next);
      return;
    }
    setFillOffsetY(next);
  };

  const handleOrbitalPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    orbDragRef.current = {
      dragging: true,
      x: event.clientX,
      y: event.clientY,
    };
    if (lightPaintMode) {
      setLightPaintTarget(activeOrbitalLight);
      const start: LightPaintPoint = {
        azimuth: activeOrbitalAzimuth,
        elevation: activeOrbitalElevation,
        distance: activeOrbitalDistance,
      };
      lastLightPaintCaptureRef.current = performance.now();
      setLightPaintPoints([start]);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleOrbitalPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!orbDragRef.current.dragging) return;
    const dx = event.clientX - orbDragRef.current.x;
    const dy = event.clientY - orbDragRef.current.y;
    orbDragRef.current.x = event.clientX;
    orbDragRef.current.y = event.clientY;
    let nextAz = 0;
    let nextEl = 0;
    if (activeOrbitalLight === "key") {
      nextAz = wrapAngle(keyAzimuthRef.current + dx * 0.9);
      nextEl = clampElevation(keyElevationRef.current - dy * 0.72);
      const invert = event.metaKey || event.ctrlKey;
      const snapActive = invert ? !gizmoSnapEnabledRef.current : gizmoSnapEnabledRef.current;
      if (snapActive) {
        const step = gizmoSnapAngleRef.current;
        nextAz = wrapAngle(quantizeToStep(nextAz, step));
        nextEl = clampElevation(quantizeToStep(nextEl, step));
      }
      keyAzimuthRef.current = nextAz;
      keyElevationRef.current = nextEl;
      setKeyAzimuth(nextAz);
      setKeyElevation(nextEl);
    } else {
      nextAz = wrapAngle(fillAzimuthRef.current + dx * 0.9);
      nextEl = clampElevation(fillElevationRef.current - dy * 0.72);
      const invert = event.metaKey || event.ctrlKey;
      const snapActive = invert ? !gizmoSnapEnabledRef.current : gizmoSnapEnabledRef.current;
      if (snapActive) {
        const step = gizmoSnapAngleRef.current;
        nextAz = wrapAngle(quantizeToStep(nextAz, step));
        nextEl = clampElevation(quantizeToStep(nextEl, step));
      }
      fillAzimuthRef.current = nextAz;
      fillElevationRef.current = nextEl;
      setFillAzimuth(nextAz);
      setFillElevation(nextEl);
    }

    if (!lightPaintMode) return;
    const now = performance.now();
    if (now - lastLightPaintCaptureRef.current < 28) return;
    lastLightPaintCaptureRef.current = now;
    const point: LightPaintPoint = {
      azimuth: nextAz,
      elevation: nextEl,
      distance: activeOrbitalDistance,
    };
    setLightPaintPoints((prev) => [...prev, point].slice(-600));
  };

  const handleOrbitalPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!orbDragRef.current.dragging) return;
    orbDragRef.current.dragging = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // no-op
    }
  };

  const handleOrbitalWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    if (event.shiftKey) {
      if (activeOrbitalLight === "key") {
        setKeyIntensity((prev) => THREE.MathUtils.clamp(prev + direction * 0.08, 0, KEY_INTENSITY_MAX));
      } else {
        setFillIntensity((prev) => THREE.MathUtils.clamp(prev + direction * 0.065, 0, FILL_INTENSITY_MAX));
      }
      return;
    }
    setActiveOrbitalDistance(activeOrbitalDistance + direction * 0.1);
  };

  const saveCompareSlot = (slot: CompareSlotKey) => {
    setCompareSlots((prev) => ({
      ...prev,
      [slot]: readCurrentSettings(),
    }));
  };

  const applyCompareSlot = (slot: CompareSlotKey) => {
    const scene = compareSlots[slot];
    if (!scene) return;
    historySuspendRef.current = true;
    applySceneSettings(scene);
    releaseHistorySuspension();
  };

  const withHint = (text: string) => ({
    onMouseEnter: () => setHintText(text),
    onFocus: () => setHintText(text),
    onMouseLeave: () => setHintText(DEFAULT_HINT),
    onBlur: () => setHintText(DEFAULT_HINT),
  });

  const parseMacroTags = (value: string) =>
    Array.from(
      new Set(
        value
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
      )
    ).slice(0, 10);

  const summarizeInspectorData = (value: unknown) => {
    if (typeof value === "undefined") return "no payload";
    if (value === null) return "null";
    if (typeof value === "string") {
      const compact = value.replace(/\s+/g, " ").trim();
      if (compact.length <= 180) return compact;
      return `${compact.slice(0, 177)}...`;
    }
    try {
      const text = JSON.stringify(value);
      if (typeof text !== "string") return String(value);
      if (text.length <= 180) return text;
      return `${text.slice(0, 177)}...`;
    } catch {
      return String(value);
    }
  };

  const appendApiInspectorLog = useCallback((kind: SceneApiInspectorLogKind, name: string, payload: unknown) => {
    setApiInspectorLogs((prev) => {
      const next: SceneApiInspectorEntry = {
        id: createSceneApiId(),
        ts: Date.now(),
        kind,
        name,
        summary: summarizeInspectorData(payload),
      };
      return [...prev.slice(-79), next];
    });
  }, []);

  const appendApiCommandHistory = useCallback((entry: Omit<SceneApiCommandHistoryEntry, "id" | "ts">) => {
    setApiCommandHistory((prev) => [
      ...prev.slice(-149),
      {
        id: createSceneApiId(),
        ts: Date.now(),
        ...entry,
      },
    ]);
  }, []);

  const getApiTimeoutMs = () => {
    if (apiTimeoutPreset === "fast") return 4000;
    if (apiTimeoutPreset === "reliable") return 25000;
    if (apiTimeoutPreset === "custom") return THREE.MathUtils.clamp(apiTimeoutCustomMs, 500, 120_000);
    return 12_000;
  };

  const resolvePayloadTemplate = (payloadText: string, promptMissing: boolean) => {
    const template = payloadText.trim().length > 0 ? payloadText : "{}";
    const userVars: Record<string, string> = {};
    apiTemplateVars.forEach((entry) => {
      const key = entry.key.trim();
      if (!key) return;
      userVars[key] = entry.value;
    });
    const context: Record<string, string> = {
      sessionId: sceneApiSessionIdRef.current,
      activeScreenId: activeScreenIdRef.current || "screen-a",
      shot: activeShotRef.current,
      preset: presetRef.current,
      timestamp: String(Date.now()),
      isoTime: new Date().toISOString(),
      date: new Date().toISOString().slice(0, 10),
      uuid: createSceneApiId(),
      ...userVars,
    };
    const prompted = new Map<string, string>();
    const missing = new Set<string>();

    const resolved = template.replace(/\$\{([A-Za-z0-9_]+)\}/g, (match, rawName: string) => {
      const name = String(rawName);
      if (Object.prototype.hasOwnProperty.call(context, name)) {
        return context[name];
      }
      if (!promptMissing || typeof window === "undefined") {
        missing.add(name);
        return match;
      }
      if (prompted.has(name)) {
        return prompted.get(name) ?? "";
      }
      const value = window.prompt(`Value for ${name}`, "");
      if (value === null) {
        missing.add(name);
        return match;
      }
      prompted.set(name, value);
      return value;
    });

    return {
      resolved,
      missing: [...missing],
    };
  };

  const previewApiPayload = (
    payloadText: string,
    options?: {
      promptMissing?: boolean;
      updateState?: boolean;
    }
  ): {
    ok: boolean;
    payload: unknown;
    resolvedPayloadText: string;
    error: string | null;
  } => {
    const promptMissing = options?.promptMissing ?? false;
    const updateState = options?.updateState ?? false;
    const templated = resolvePayloadTemplate(payloadText, promptMissing);
    if (templated.missing.length > 0) {
      const message = `Missing template vars: ${templated.missing.join(", ")}`;
      if (updateState) {
        setApiDryRunError(message);
        setApiDryRunResolvedPayload(templated.resolved);
      }
      return {
        ok: false,
        payload: null,
        resolvedPayloadText: templated.resolved,
        error: message,
      };
    }
    const trimmed = templated.resolved.trim();
    try {
      const payload = trimmed.length > 0 ? JSON.parse(trimmed) : {};
      const pretty = JSON.stringify(payload, null, 2);
      if (updateState) {
        setApiDryRunError("");
        setApiDryRunResolvedPayload(pretty);
      }
      return {
        ok: true,
        payload,
        resolvedPayloadText: pretty,
        error: null,
      };
    } catch {
      const message = "Invalid JSON after template resolution";
      if (updateState) {
        setApiDryRunError(message);
        setApiDryRunResolvedPayload(templated.resolved);
      }
      return {
        ok: false,
        payload: null,
        resolvedPayloadText: templated.resolved,
        error: message,
      };
    }
  };

  const normalizeProfileMacros = (source: unknown): SceneApiMacro[] => {
    if (!Array.isArray(source)) return [];
    return source
      .map((entry) => {
        if (!isObjectRecord(entry)) return null;
        if (typeof entry.id !== "string" || typeof entry.name !== "string" || typeof entry.command !== "string") {
          return null;
        }
        if (!toSceneApiCommandName(entry.command)) return null;
        return {
          id: entry.id,
          name: entry.name,
          command: entry.command as SceneApiCommandName,
          payload: typeof entry.payload === "string" ? entry.payload : "{}",
          tags: Array.isArray(entry.tags)
            ? entry.tags
                .filter((tag): tag is string => typeof tag === "string")
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0)
                .slice(0, 10)
            : [],
          pinned: Boolean(entry.pinned),
          updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : Date.now(),
        } as SceneApiMacro;
      })
      .filter((entry): entry is SceneApiMacro => Boolean(entry))
      .slice(0, 40);
  };

  const normalizeProfileTemplateVars = (source: unknown): SceneApiTemplateVar[] => {
    if (!Array.isArray(source)) return [];
    return source
      .map((entry) => {
        if (!isObjectRecord(entry)) return null;
        if (typeof entry.id !== "string" || typeof entry.key !== "string") return null;
        return {
          id: entry.id,
          key: entry.key.trim(),
          value: typeof entry.value === "string" ? entry.value : "",
        } as SceneApiTemplateVar;
      })
      .filter((entry): entry is SceneApiTemplateVar => Boolean(entry))
      .filter((entry) => entry.key.length > 0)
      .slice(0, 40);
  };

  const normalizeProfileSequences = (source: unknown): SceneApiSequence[] => {
    if (!Array.isArray(source)) return [];
    return source
      .map((entry) => {
        if (!isObjectRecord(entry)) return null;
        if (typeof entry.id !== "string" || typeof entry.name !== "string") return null;
        const rawSteps = Array.isArray(entry.steps) ? entry.steps : [];
        const steps = rawSteps
          .map((step) => {
            if (!isObjectRecord(step)) return null;
            if (typeof step.id !== "string" || typeof step.macroId !== "string") return null;
            return {
              id: step.id,
              macroId: step.macroId,
              delayMs: typeof step.delayMs === "number" ? THREE.MathUtils.clamp(step.delayMs, 0, 30_000) : 0,
              enabled: step.enabled !== false,
            } as SceneApiSequenceStep;
          })
          .filter((step): step is SceneApiSequenceStep => Boolean(step))
          .slice(0, 60);
        return {
          id: entry.id,
          name: entry.name,
          steps,
          stopOnError: entry.stopOnError !== false,
          updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : Date.now(),
        } as SceneApiSequence;
      })
      .filter((entry): entry is SceneApiSequence => Boolean(entry))
      .slice(0, 30);
  };

  const computeSceneDiffKeys = (incoming: SceneSettings) => {
    const current = readCurrentSettings();
    return (Object.keys(current) as Array<keyof SceneSettings>)
      .filter((key) => JSON.stringify(current[key]) !== JSON.stringify(incoming[key]))
      .map((key) => String(key));
  };

  const computeEntityDiff = <T extends { id: string }>(incoming: T[], existing: T[]) => {
    const existingIds = new Set(existing.map((entry) => entry.id));
    let add = 0;
    let update = 0;
    incoming.forEach((entry) => {
      if (existingIds.has(entry.id)) {
        update += 1;
      } else {
        add += 1;
      }
    });
    return { add, update };
  };

  const executeApiInspectorCommand = async (
    command: SceneApiCommandName,
    payloadText: string,
    options?: {
      promptMissing?: boolean;
      source?: "manual" | "macro" | "sequence" | "replay";
      context?: string;
      skipConfirm?: boolean;
    }
  ): Promise<{ ok: boolean; attempts: number }> => {
    const bridge = window.xtationScene;
    const source = options?.source ?? "manual";
    const context = options?.context ?? command;
    if (!bridge) {
      appendApiInspectorLog("error", "bridge", "window.xtationScene is not ready");
      appendApiCommandHistory({
        command,
        payloadText,
        resolvedPayloadText: payloadText,
        source,
        context,
        ok: false,
        attempts: 0,
        summary: "window.xtationScene is not ready",
      });
      return { ok: false, attempts: 0 };
    }

    const preview = previewApiPayload(payloadText, {
      promptMissing: options?.promptMissing ?? false,
      updateState: source === "manual",
    });
    if (!preview.ok) {
      appendApiInspectorLog("error", "payload", preview.error ?? "Invalid payload");
      appendApiCommandHistory({
        command,
        payloadText,
        resolvedPayloadText: preview.resolvedPayloadText,
        source,
        context,
        ok: false,
        attempts: 0,
        summary: preview.error ?? "Invalid payload",
      });
      return { ok: false, attempts: 0 };
    }

    if (apiConfirmDestructive && !options?.skipConfirm && DESTRUCTIVE_API_COMMANDS.has(command) && typeof window !== "undefined") {
      const approved = window.confirm(`Run ${command}?`);
      if (!approved) {
        appendApiInspectorLog("info", command, "Cancelled by user");
        appendApiCommandHistory({
          command,
          payloadText,
          resolvedPayloadText: preview.resolvedPayloadText,
          source,
          context,
          ok: false,
          attempts: 0,
          summary: "Cancelled by user",
        });
        return { ok: false, attempts: 0 };
      }
    }

    appendApiInspectorLog("command", command, preview.payload);
    const retries = THREE.MathUtils.clamp(apiRetryCount, 0, 6);
    const maxAttempts = retries + 1;
    const timeoutMs = getApiTimeoutMs();
    const idempotencyKey =
      command === "captureStill" || command === "exportPack"
        ? `inspector-${command}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        : undefined;

    let attempts = 0;
    let response: SceneApiResponseMessage | null = null;
    let thrownError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      attempts = attempt;
      try {
        response =
          command === "hello"
            ? await bridge.send({
                name: "hello",
                payload: {
                  requestedVersion: SCENE_API_VERSION,
                },
                timeoutMs,
              })
            : await bridge.command(command, preview.payload, {
                timeoutMs,
                ...(idempotencyKey ? { idempotencyKey } : {}),
              });
        thrownError = null;
        const shouldRetry = !response.ok && response.error?.retryable === true && attempt < maxAttempts;
        if (!shouldRetry) {
          break;
        }
      } catch (error) {
        thrownError = error;
        if (attempt >= maxAttempts) {
          break;
        }
      }
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 220);
      });
    }

    if (response && response.ok) {
      appendApiInspectorLog("response", response.name, response.result);
      appendApiCommandHistory({
        command,
        payloadText,
        resolvedPayloadText: preview.resolvedPayloadText,
        source,
        context,
        ok: true,
        attempts,
        summary: `OK after ${attempts} attempt${attempts > 1 ? "s" : ""}`,
      });
      return { ok: true, attempts };
    }

    const summary = response?.error?.message ?? (thrownError instanceof Error ? thrownError.message : "Command failed");
    appendApiInspectorLog("error", command, response?.error ?? summary);
    appendApiCommandHistory({
      command,
      payloadText,
      resolvedPayloadText: preview.resolvedPayloadText,
      source,
      context,
      ok: false,
      attempts,
      summary,
    });
    return { ok: false, attempts };
  };

  const runApiInspectorCommand = async () => {
    await executeApiInspectorCommand(apiInspectorCommand, apiInspectorPayload);
  };

  const runApiInspectorCommandPrompted = async () => {
    await executeApiInspectorCommand(apiInspectorCommand, apiInspectorPayload, {
      promptMissing: true,
    });
  };

  const runApiInspectorDryRun = () => {
    previewApiPayload(apiInspectorPayload, {
      promptMissing: false,
      updateState: true,
    });
  };

  const saveApiMacro = () => {
    const nextName = apiMacroNameInput.trim() || `${apiInspectorCommand} macro`;
    const payloadValue = apiInspectorPayload.trim().length > 0 ? apiInspectorPayload : "{}";
    const tags = parseMacroTags(apiMacroTagsInput);
    setApiMacros((prev) => {
      const existing = selectedApiMacroId ? prev.find((entry) => entry.id === selectedApiMacroId) : null;
      if (existing) {
        return prev.map((entry) =>
          entry.id === selectedApiMacroId
            ? {
                ...entry,
                name: nextName,
                command: apiInspectorCommand,
                payload: payloadValue,
                tags,
                updatedAt: Date.now(),
              }
            : entry
        );
      }
      const created: SceneApiMacro = {
        id: createSceneApiId(),
        name: nextName,
        command: apiInspectorCommand,
        payload: payloadValue,
        tags,
        pinned: false,
        updatedAt: Date.now(),
      };
      setSelectedApiMacroId(created.id);
      return [created, ...prev].slice(0, 40);
    });
    setApiMacroNameInput("");
    setApiMacroTagsInput("");
  };

  const applySelectedApiMacro = () => {
    const macro = apiMacros.find((entry) => entry.id === selectedApiMacroId);
    if (!macro) return;
    setApiInspectorCommand(macro.command);
    setApiInspectorPayload(macro.payload || "{}");
    setApiMacroNameInput(macro.name);
    setApiMacroTagsInput(macro.tags.join(", "));
  };

  const duplicateSelectedApiMacro = () => {
    const macro = apiMacros.find((entry) => entry.id === selectedApiMacroId);
    if (!macro) return;
    const duplicate: SceneApiMacro = {
      ...macro,
      id: createSceneApiId(),
      name: `${macro.name} Copy`,
      pinned: false,
      updatedAt: Date.now(),
    };
    setApiMacros((prev) => [duplicate, ...prev].slice(0, 40));
    setSelectedApiMacroId(duplicate.id);
    setApiMacroNameInput(duplicate.name);
    setApiMacroTagsInput(duplicate.tags.join(", "));
  };

  const toggleSelectedApiMacroPinned = () => {
    if (!selectedApiMacroId) return;
    setApiMacros((prev) =>
      prev.map((entry) =>
        entry.id === selectedApiMacroId
          ? {
              ...entry,
              pinned: !entry.pinned,
              updatedAt: Date.now(),
            }
          : entry
      )
    );
  };

  const moveSelectedApiMacro = (direction: -1 | 1) => {
    if (!selectedApiMacroId) return;
    setApiMacros((prev) => {
      const index = prev.findIndex((entry) => entry.id === selectedApiMacroId);
      if (index < 0) return prev;
      const nextIndex = THREE.MathUtils.clamp(index + direction, 0, prev.length - 1);
      if (nextIndex === index) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const runMacroById = async (
    macroId: string,
    promptMissing = false,
    source: "macro" | "sequence" | "replay" = "macro",
    context = "macro"
  ) => {
    const macro = apiMacros.find((entry) => entry.id === macroId);
    if (!macro) {
      appendApiInspectorLog("error", "macro", `Macro not found: ${macroId}`);
      return { ok: false, attempts: 0 };
    }
    setApiInspectorCommand(macro.command);
    setApiInspectorPayload(macro.payload || "{}");
    return executeApiInspectorCommand(macro.command, macro.payload || "{}", {
      promptMissing,
      source,
      context,
      skipConfirm: source === "sequence",
    });
  };

  const runSelectedApiMacro = async () => {
    await runMacroById(selectedApiMacroId, false, "macro", "selected macro");
  };

  const runSelectedApiMacroPrompted = async () => {
    await runMacroById(selectedApiMacroId, true, "macro", "selected macro prompted");
  };

  const deleteSelectedApiMacro = () => {
    if (!selectedApiMacroId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete selected macro?")) {
      return;
    }
    setApiMacros((prev) => {
      const next = prev.filter((entry) => entry.id !== selectedApiMacroId);
      setSelectedApiMacroId(next[0]?.id ?? "");
      return next;
    });
    setApiMacroNameInput("");
    setApiMacroTagsInput("");
  };

  const filteredApiMacros = apiMacros
    .filter((entry) => {
      const query = apiMacroSearch.trim().toLowerCase();
      if (!query) return true;
      if (entry.name.toLowerCase().includes(query)) return true;
      if (entry.command.toLowerCase().includes(query)) return true;
      return entry.tags.some((tag) => tag.toLowerCase().includes(query));
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

  const ensureSequenceTarget = (id: string) => {
    const found = apiSequences.find((entry) => entry.id === id);
    if (!found) return null;
    return found;
  };

  const createSequenceStep = (macroId: string): SceneApiSequenceStep => ({
    id: createSceneApiId(),
    macroId,
    delayMs: 300,
    enabled: true,
  });

  const createApiSequence = () => {
    const preferredMacro = selectedApiMacroId || apiMacros[0]?.id || "";
    const sequence: SceneApiSequence = {
      id: createSceneApiId(),
      name: `Sequence ${apiSequences.length + 1}`,
      steps: preferredMacro ? [createSequenceStep(preferredMacro)] : [],
      stopOnError: true,
      updatedAt: Date.now(),
    };
    setApiSequences((prev) => [sequence, ...prev].slice(0, 30));
    setSelectedApiSequenceId(sequence.id);
    setApiSequenceNameInput(sequence.name);
  };

  const saveSelectedApiSequence = () => {
    const name = apiSequenceNameInput.trim();
    if (!selectedApiSequenceId) {
      createApiSequence();
      return;
    }
    if (!name) return;
    setApiSequences((prev) =>
      prev.map((entry) =>
        entry.id === selectedApiSequenceId
          ? {
              ...entry,
              name,
              updatedAt: Date.now(),
            }
          : entry
      )
    );
  };

  const deleteSelectedApiSequence = () => {
    if (!selectedApiSequenceId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete selected sequence?")) {
      return;
    }
    setApiSequences((prev) => {
      const next = prev.filter((entry) => entry.id !== selectedApiSequenceId);
      setSelectedApiSequenceId(next[0]?.id ?? "");
      setApiSequenceNameInput(next[0]?.name ?? "");
      return next;
    });
  };

  const patchSelectedSequence = (patcher: (sequence: SceneApiSequence) => SceneApiSequence) => {
    if (!selectedApiSequenceId) return;
    setApiSequences((prev) =>
      prev.map((entry) => (entry.id === selectedApiSequenceId ? patcher(entry) : entry))
    );
  };

  const addSelectedSequenceStep = () => {
    const defaultMacroId = selectedApiMacroId || apiMacros[0]?.id || "";
    if (!defaultMacroId) return;
    patchSelectedSequence((sequence) => ({
      ...sequence,
      steps: [...sequence.steps, createSequenceStep(defaultMacroId)],
      updatedAt: Date.now(),
    }));
  };

  const updateSelectedSequenceStep = (stepId: string, patch: Partial<SceneApiSequenceStep>) => {
    patchSelectedSequence((sequence) => ({
      ...sequence,
      steps: sequence.steps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              ...patch,
            }
          : step
      ),
      updatedAt: Date.now(),
    }));
  };

  const moveSelectedSequenceStep = (stepId: string, direction: -1 | 1) => {
    patchSelectedSequence((sequence) => {
      const index = sequence.steps.findIndex((step) => step.id === stepId);
      if (index < 0) return sequence;
      const nextIndex = THREE.MathUtils.clamp(index + direction, 0, sequence.steps.length - 1);
      if (nextIndex === index) return sequence;
      const nextSteps = [...sequence.steps];
      const [picked] = nextSteps.splice(index, 1);
      nextSteps.splice(nextIndex, 0, picked);
      return {
        ...sequence,
        steps: nextSteps,
        updatedAt: Date.now(),
      };
    });
  };

  const removeSelectedSequenceStep = (stepId: string) => {
    patchSelectedSequence((sequence) => ({
      ...sequence,
      steps: sequence.steps.filter((step) => step.id !== stepId),
      updatedAt: Date.now(),
    }));
  };

  const runSelectedApiSequence = async () => {
    const sequence = ensureSequenceTarget(selectedApiSequenceId);
    if (!sequence) return;
    if (apiSequenceRunning) return;
    const runnableSteps = sequence.steps.filter((step) => step.enabled);
    if (runnableSteps.length === 0) {
      appendApiInspectorLog("error", "sequence", "No enabled steps in selected sequence");
      return;
    }
    const runToken = Date.now();
    apiSequenceRunTokenRef.current = runToken;
    setApiSequenceRunning(true);
    appendApiInspectorLog("info", "sequence", `Running sequence: ${sequence.name}`);
    for (let i = 0; i < runnableSteps.length; i += 1) {
      if (apiSequenceRunTokenRef.current !== runToken) break;
      const step = runnableSteps[i];
      if (step.delayMs > 0) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, step.delayMs);
        });
      }
      if (apiSequenceRunTokenRef.current !== runToken) break;
      const macro = apiMacros.find((entry) => entry.id === step.macroId);
      if (!macro) {
        appendApiInspectorLog("error", "sequence", `Missing macro in step ${i + 1}`);
        if (sequence.stopOnError) {
          break;
        }
        continue;
      }
      const result = await runMacroById(
        step.macroId,
        false,
        "sequence",
        `${sequence.name} · step ${i + 1}/${runnableSteps.length}`
      );
      if (!result.ok && sequence.stopOnError) {
        appendApiInspectorLog("error", "sequence", `Stopped on error at step ${i + 1}`);
        break;
      }
    }
    if (apiSequenceRunTokenRef.current === runToken) {
      appendApiInspectorLog("info", "sequence", `Sequence finished: ${sequence.name}`);
      setApiSequenceRunning(false);
    }
  };

  const stopApiSequenceRun = () => {
    if (!apiSequenceRunning) return;
    apiSequenceRunTokenRef.current = Date.now() + 1;
    setApiSequenceRunning(false);
    appendApiInspectorLog("info", "sequence", "Sequence stopped");
  };

  const quickMacroSlots = useMemo(
    () =>
      [...apiMacros]
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        })
        .slice(0, 9),
    [apiMacros]
  );

  const selectedSequence = selectedApiSequenceId
    ? apiSequences.find((entry) => entry.id === selectedApiSequenceId) ?? null
    : null;

  const addTemplateVariable = () => {
    const key = apiVarKeyInput.trim();
    if (!key) return;
    const value = apiVarValueInput;
    setApiTemplateVars((prev) => {
      const existing = prev.find((entry) => entry.key === key);
      if (existing) {
        return prev.map((entry) =>
          entry.key === key
            ? {
                ...entry,
                value,
              }
            : entry
        );
      }
      const created: SceneApiTemplateVar = {
        id: createSceneApiId(),
        key,
        value,
      };
      return [created, ...prev].slice(0, 40);
    });
    setApiVarKeyInput("");
    setApiVarValueInput("");
  };

  const removeTemplateVariable = (id: string) => {
    setApiTemplateVars((prev) => prev.filter((entry) => entry.id !== id));
  };

  const exportAutomationProfile = () => {
    try {
      const payload = {
        format: "xtation-scene-profile",
        version: 2,
        exportedAt: new Date().toISOString(),
        sceneSettings: readCurrentSettings(),
        apiInspector: {
          hideStateChanged: apiInspectorHideStateChanged,
          macros: apiMacros,
          templateVars: apiTemplateVars,
          sequences: apiSequences,
          execution: {
            timeoutPreset: apiTimeoutPreset,
            timeoutCustomMs: apiTimeoutCustomMs,
            retryCount: apiRetryCount,
            confirmDestructive: apiConfirmDestructive,
          },
        },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `xtation-profile-${Date.now()}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
      appendApiInspectorLog("info", "profile", "Exported automation profile");
    } catch (error) {
      appendApiInspectorLog("error", "profile", error instanceof Error ? error.message : String(error));
    }
  };

  const applyPendingProfileImport = (
    mode: "scene" | "api-merge" | "api-replace" | "all-merge" | "all-replace"
  ) => {
    if (!pendingProfileImport) return;
    const applyScene = mode === "scene" || mode.startsWith("all");
    const applyApi = mode !== "scene";
    const replaceApi = mode === "api-replace" || mode === "all-replace";

    if (applyScene && pendingProfileImport.sceneSettings) {
      historySuspendRef.current = true;
      applySceneSettings(pendingProfileImport.sceneSettings);
      releaseHistorySuspension();
    }

    if (applyApi) {
      if (pendingProfileImport.hideStateChanged !== null) {
        setApiInspectorHideStateChanged(pendingProfileImport.hideStateChanged);
      }
      if (pendingProfileImport.execution.timeoutPreset) {
        setApiTimeoutPreset(pendingProfileImport.execution.timeoutPreset);
      }
      if (typeof pendingProfileImport.execution.timeoutCustomMs === "number") {
        setApiTimeoutCustomMs(pendingProfileImport.execution.timeoutCustomMs);
      }
      if (typeof pendingProfileImport.execution.retryCount === "number") {
        setApiRetryCount(THREE.MathUtils.clamp(pendingProfileImport.execution.retryCount, 0, 6));
      }
      if (typeof pendingProfileImport.execution.confirmDestructive === "boolean") {
        setApiConfirmDestructive(pendingProfileImport.execution.confirmDestructive);
      }

      if (replaceApi) {
        setApiMacros(pendingProfileImport.macros.slice(0, 40));
        setSelectedApiMacroId(pendingProfileImport.macros[0]?.id ?? "");
        setApiTemplateVars(pendingProfileImport.templateVars.slice(0, 40));
        setApiSequences(pendingProfileImport.sequences.slice(0, 30));
        setSelectedApiSequenceId(pendingProfileImport.sequences[0]?.id ?? "");
        setApiSequenceNameInput(pendingProfileImport.sequences[0]?.name ?? "");
      } else {
        setApiMacros((prev) => {
          const merged = new Map<string, SceneApiMacro>(prev.map((entry) => [entry.id, entry]));
          pendingProfileImport.macros.forEach((entry) => {
            merged.set(entry.id, entry);
          });
          const next = Array.from(merged.values())
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 40);
          setSelectedApiMacroId((current) => (current && next.some((entry) => entry.id === current) ? current : next[0]?.id ?? ""));
          return next;
        });
        setApiTemplateVars((prev) => {
          const merged = new Map<string, SceneApiTemplateVar>(prev.map((entry) => [entry.id, entry]));
          pendingProfileImport.templateVars.forEach((entry) => {
            merged.set(entry.id, entry);
          });
          return Array.from(merged.values()).slice(0, 40);
        });
        setApiSequences((prev) => {
          const merged = new Map<string, SceneApiSequence>(prev.map((entry) => [entry.id, entry]));
          pendingProfileImport.sequences.forEach((entry) => {
            merged.set(entry.id, entry);
          });
          const next = Array.from(merged.values())
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 30);
          setSelectedApiSequenceId((current) => (current && next.some((entry) => entry.id === current) ? current : next[0]?.id ?? ""));
          return next;
        });
      }
    }

    appendApiInspectorLog("info", "profile", `Applied imported profile (${mode})`);
    setPendingProfileImport(null);
  };

  const importAutomationProfile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result ?? "");
        const parsed = JSON.parse(raw) as unknown;
        if (!isObjectRecord(parsed)) {
          appendApiInspectorLog("error", "profile", "Invalid profile JSON object");
          return;
        }
        if (parsed.format !== "xtation-scene-profile") {
          appendApiInspectorLog("error", "profile", "Unsupported profile format");
          return;
        }
        const importedScene = isObjectRecord(parsed.sceneSettings)
          ? ({
              ...readCurrentSettings(),
              ...(parsed.sceneSettings as Partial<SceneSettings>),
            } as SceneSettings)
          : null;
        const importedApiInspector = isObjectRecord(parsed.apiInspector) ? parsed.apiInspector : null;
        const importedMacros = normalizeProfileMacros(importedApiInspector?.macros);
        const importedTemplateVars = normalizeProfileTemplateVars(importedApiInspector?.templateVars);
        const importedSequences = normalizeProfileSequences(importedApiInspector?.sequences);
        const importedHideState = importedApiInspector ? asBoolean(importedApiInspector.hideStateChanged) : null;
        const importedExecution = isObjectRecord(importedApiInspector?.execution) ? importedApiInspector.execution : null;
        const sceneDiffKeys = importedScene ? computeSceneDiffKeys(importedScene) : [];

        setPendingProfileImport({
          fileName: file.name,
          sceneSettings: importedScene,
          sceneDiffKeys,
          macros: importedMacros,
          templateVars: importedTemplateVars,
          sequences: importedSequences,
          macroDiff: computeEntityDiff(importedMacros, apiMacros),
          templateVarDiff: computeEntityDiff(importedTemplateVars, apiTemplateVars),
          sequenceDiff: computeEntityDiff(importedSequences, apiSequences),
          execution: {
            timeoutPreset:
              importedExecution &&
              (importedExecution.timeoutPreset === "fast" ||
                importedExecution.timeoutPreset === "balanced" ||
                importedExecution.timeoutPreset === "reliable" ||
                importedExecution.timeoutPreset === "custom")
                ? importedExecution.timeoutPreset
                : null,
            timeoutCustomMs: importedExecution ? asFiniteNumber(importedExecution.timeoutCustomMs) : null,
            retryCount: importedExecution ? asFiniteNumber(importedExecution.retryCount) : null,
            confirmDestructive: importedExecution ? asBoolean(importedExecution.confirmDestructive) : null,
          },
          hideStateChanged: importedHideState,
        });
        appendApiInspectorLog("info", "profile", `Profile queued for review: ${file.name}`);
      } catch (error) {
        appendApiInspectorLog("error", "profile", error instanceof Error ? error.message : String(error));
      } finally {
        input.value = "";
      }
    };
    reader.onerror = () => {
      appendApiInspectorLog("error", "profile", "Failed to read profile file");
      input.value = "";
    };
    reader.readAsText(file);
  };

  const captureRigState = (): LightRigState => ({
    lightAnchorMode,
    worldAnchorX,
    worldAnchorY,
    worldAnchorZ,
    keyAzimuth,
    keyElevation,
    keyDistance,
    fillAzimuth,
    fillElevation,
    fillDistance,
    keyOffsetX,
    keyOffsetY,
    keyOffsetZ,
    fillOffsetX,
    fillOffsetY,
    fillOffsetZ,
    keyColor,
    keyIntensity,
    fillColor,
    fillIntensity,
    hideLightSource,
  });

  const applyRigToRefs = (rig: LightRigState) => {
    lightAnchorModeRef.current = rig.lightAnchorMode;
    worldAnchorRef.current.set(rig.worldAnchorX, rig.worldAnchorY, rig.worldAnchorZ);
    keyAzimuthRef.current = rig.keyAzimuth;
    keyElevationRef.current = rig.keyElevation;
    keyDistanceRef.current = rig.keyDistance;
    fillAzimuthRef.current = rig.fillAzimuth;
    fillElevationRef.current = rig.fillElevation;
    fillDistanceRef.current = rig.fillDistance;
    keyOffsetRef.current.set(rig.keyOffsetX, rig.keyOffsetY, rig.keyOffsetZ);
    fillOffsetRef.current.set(rig.fillOffsetX, rig.fillOffsetY, rig.fillOffsetZ);
    keyIntensityRef.current = rig.keyIntensity;
    fillIntensityRef.current = rig.fillIntensity;
    keyColorRef.current = rig.keyColor;
    fillColorRef.current = rig.fillColor;
    hideLightSourceRef.current = rig.hideLightSource;

    if (keyLightRef.current) {
      keyLightRef.current.color.set(rig.keyColor);
      keyLightRef.current.intensity = rig.keyIntensity * lightGainRef.current;
    }
    if (fillLightRef.current) {
      fillLightRef.current.color.set(rig.fillColor);
      fillLightRef.current.visible = !rig.hideLightSource;
      fillLightRef.current.intensity = rig.hideLightSource ? 0 : rig.fillIntensity * lightGainRef.current;
    }
    if (softFillRef.current) {
      softFillRef.current.color.set(rig.fillColor);
      softFillRef.current.intensity = rig.hideLightSource
        ? rig.fillIntensity * softFillBoost(lightSoftnessRef.current) * lightGainRef.current
        : 0;
    }
  };

  const applyRigToState = (rig: LightRigState) => {
    applyRigToRefs(rig);
    setLightAnchorMode(rig.lightAnchorMode);
    setWorldAnchorX(rig.worldAnchorX);
    setWorldAnchorY(rig.worldAnchorY);
    setWorldAnchorZ(rig.worldAnchorZ);
    setKeyAzimuth(rig.keyAzimuth);
    setKeyElevation(rig.keyElevation);
    setKeyDistance(rig.keyDistance);
    setFillAzimuth(rig.fillAzimuth);
    setFillElevation(rig.fillElevation);
    setFillDistance(rig.fillDistance);
    setKeyOffsetX(rig.keyOffsetX);
    setKeyOffsetY(rig.keyOffsetY);
    setKeyOffsetZ(rig.keyOffsetZ);
    setFillOffsetX(rig.fillOffsetX);
    setFillOffsetY(rig.fillOffsetY);
    setFillOffsetZ(rig.fillOffsetZ);
    setKeyColor(rig.keyColor);
    setKeyIntensity(rig.keyIntensity);
    setFillColor(rig.fillColor);
    setFillIntensity(rig.fillIntensity);
    setHideLightSource(rig.hideLightSource);
  };

  const sampleTimelineRig = (frames: RigKeyframe[], progress: number): LightRigState | null => {
    if (frames.length === 0) return null;
    const sorted = [...frames].sort((a, b) => a.t - b.t);
    if (sorted.length === 1) return cloneRig(sorted[0].rig);
    const t = THREE.MathUtils.clamp(progress, 0, 1);
    if (t <= sorted[0].t) return cloneRig(sorted[0].rig);
    if (t >= sorted[sorted.length - 1].t) return cloneRig(sorted[sorted.length - 1].rig);

    let left = sorted[0];
    let right = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i += 1) {
      if (t >= sorted[i].t && t <= sorted[i + 1].t) {
        left = sorted[i];
        right = sorted[i + 1];
        break;
      }
    }

    const span = Math.max(0.0001, right.t - left.t);
    const alpha = THREE.MathUtils.clamp((t - left.t) / span, 0, 1);

    return {
      lightAnchorMode: alpha < 0.5 ? left.rig.lightAnchorMode : right.rig.lightAnchorMode,
      worldAnchorX: THREE.MathUtils.lerp(left.rig.worldAnchorX, right.rig.worldAnchorX, alpha),
      worldAnchorY: THREE.MathUtils.lerp(left.rig.worldAnchorY, right.rig.worldAnchorY, alpha),
      worldAnchorZ: THREE.MathUtils.lerp(left.rig.worldAnchorZ, right.rig.worldAnchorZ, alpha),
      keyAzimuth: lerpAngle(left.rig.keyAzimuth, right.rig.keyAzimuth, alpha),
      keyElevation: THREE.MathUtils.lerp(left.rig.keyElevation, right.rig.keyElevation, alpha),
      keyDistance: THREE.MathUtils.lerp(left.rig.keyDistance, right.rig.keyDistance, alpha),
      fillAzimuth: lerpAngle(left.rig.fillAzimuth, right.rig.fillAzimuth, alpha),
      fillElevation: THREE.MathUtils.lerp(left.rig.fillElevation, right.rig.fillElevation, alpha),
      fillDistance: THREE.MathUtils.lerp(left.rig.fillDistance, right.rig.fillDistance, alpha),
      keyOffsetX: THREE.MathUtils.lerp(left.rig.keyOffsetX, right.rig.keyOffsetX, alpha),
      keyOffsetY: THREE.MathUtils.lerp(left.rig.keyOffsetY, right.rig.keyOffsetY, alpha),
      keyOffsetZ: THREE.MathUtils.lerp(left.rig.keyOffsetZ, right.rig.keyOffsetZ, alpha),
      fillOffsetX: THREE.MathUtils.lerp(left.rig.fillOffsetX, right.rig.fillOffsetX, alpha),
      fillOffsetY: THREE.MathUtils.lerp(left.rig.fillOffsetY, right.rig.fillOffsetY, alpha),
      fillOffsetZ: THREE.MathUtils.lerp(left.rig.fillOffsetZ, right.rig.fillOffsetZ, alpha),
      keyColor: alpha < 0.5 ? left.rig.keyColor : right.rig.keyColor,
      keyIntensity: THREE.MathUtils.lerp(left.rig.keyIntensity, right.rig.keyIntensity, alpha),
      fillColor: alpha < 0.5 ? left.rig.fillColor : right.rig.fillColor,
      fillIntensity: THREE.MathUtils.lerp(left.rig.fillIntensity, right.rig.fillIntensity, alpha),
      hideLightSource: alpha < 0.5 ? left.rig.hideLightSource : right.rig.hideLightSource,
    };
  };

  const applyTimelineAt = (nextProgress: number, commitState = false) => {
    const rig = sampleTimelineRig(timelineFramesRef.current, nextProgress);
    if (!rig) return;
    if (commitState) {
      applyingShotRigRef.current = true;
      applyRigToState(rig);
      window.setTimeout(() => {
        applyingShotRigRef.current = false;
      }, 0);
      return;
    }
    applyRigToRefs(rig);
  };

  const readCurrentSettings = (): SceneSettings => ({
    preset,
    shot,
    grade,
    presentationMode,
    uiMode,
    panelTab,
    advancedPanelVisible,
    autoEntityTab,
    inspectorLock,
    contextFocus,
    environmentMode,
    environmentAutoHdri,
    environmentObjectImpact,
    shotLinkedRigs,
    minLightHeight,
    maxLightDistance,
    stayLightsInFront,
    avoidBodyIntersection,
    bodyClearance,
    timelineDuration,
    timelineLoop,
    lightAnchorMode,
    lightFollowPoint,
    worldAnchorX,
    worldAnchorY,
    worldAnchorZ,
    showLightMarkers,
    lockLightsAboveGround,
    activeOrbitalLight,
    keyAzimuth,
    keyElevation,
    keyDistance,
    fillAzimuth,
    fillElevation,
    fillDistance,
    keyColor,
    keyIntensity,
    keyOffsetX,
    keyOffsetY,
    keyOffsetZ,
    fillColor,
    fillIntensity,
    fillOffsetX,
    fillOffsetY,
    fillOffsetZ,
    hideLightSource,
    lightGain,
    lightSoftness,
    floorMode,
    groundGloss,
    groundMotion,
    particleStyle,
    secondaryParticleStyle,
    effectBlend,
    effectAmount,
    effectSpeed,
    effectScale,
    effectSpread,
    orbitCenterLift,
    bloomStrength,
    fogAmount,
    ambientAtmosphere,
    atmosphereSpread,
    autoOrbit,
    ringPulse,
    ringImpact,
    particlesEnabled,
    particleDensity,
    titleSync,
    beatPulse,
    modelPosX,
    modelPosY,
    modelPosZ,
    modelYaw,
    modelScale,
    modelFloat,
    modelAnimationPlaying,
    modelAnimationSpeed,
    modelMaterialMode,
    modelTint,
    modelMetalness,
    modelRoughness,
    screenAttachmentMode,
    autoFitMediaAspect,
    mediaFidelity,
    performanceTier,
    autoQuality,
    cameraFovOffset,
    cameraDamping,
    cameraOrbitSpeed,
    cameraNear,
    cameraFar,
    hdriPreset,
    hdriIntensity,
    hdriRotation,
    hdriBackground,
    hdriBlur,
    hdriExposure,
    heroTitleText,
  });

  const applySceneSettings = (settings: SceneSettings) => {
    applyingShotRigRef.current = true;
    setPreset(settings.preset);
    setShot(settings.shot);
    setGrade(settings.grade);
    setPresentationMode(settings.presentationMode === "profile" ? "profile" : "editor");
    setUiMode(settings.uiMode ?? "basic");
    setPanelTab(normalizePanelTab(settings.panelTab as unknown));
    setAdvancedPanelVisible(settings.advancedPanelVisible ?? true);
    setAutoEntityTab(settings.autoEntityTab ?? true);
    setInspectorLock(settings.inspectorLock ?? false);
    setContextFocus(settings.contextFocus ?? true);
    setEnvironmentMode(
      settings.environmentMode === "core" ||
        settings.environmentMode === "light" ||
        settings.environmentMode === "dusk" ||
        settings.environmentMode === "glacier" ||
        settings.environmentMode === "mono" ||
        settings.environmentMode === "bureau"
        ? settings.environmentMode
        : "core"
    );
    setEnvironmentAutoHdri(settings.environmentAutoHdri ?? false);
    setEnvironmentObjectImpact(THREE.MathUtils.clamp(settings.environmentObjectImpact ?? 0.62, 0, 1));
    setShotLinkedRigs(settings.shotLinkedRigs ?? true);
    setMinLightHeight(settings.minLightHeight ?? 0.03);
    setMaxLightDistance(settings.maxLightDistance ?? 4.7);
    setStayLightsInFront(settings.stayLightsInFront ?? false);
    setAvoidBodyIntersection(settings.avoidBodyIntersection ?? true);
    setBodyClearance(settings.bodyClearance ?? 0.55);
    setTimelineDuration(settings.timelineDuration ?? 6);
    setTimelineLoop(settings.timelineLoop ?? true);
    setLightAnchorMode(settings.lightAnchorMode ?? "follow");
    setLightFollowPoint(settings.lightFollowPoint === "hips" ? "hips" : "rig");
    setWorldAnchorX(settings.worldAnchorX ?? 0);
    setWorldAnchorY(settings.worldAnchorY ?? 1.1);
    setWorldAnchorZ(settings.worldAnchorZ ?? 0);
    setShowLightMarkers(settings.showLightMarkers ?? false);
    setLockLightsAboveGround(settings.lockLightsAboveGround ?? false);
    setActiveOrbitalLight(settings.activeOrbitalLight ?? "key");
    setKeyAzimuth(settings.keyAzimuth ?? 36);
    setKeyElevation(settings.keyElevation ?? 61);
    setKeyDistance(settings.keyDistance ?? 3.45);
    setFillAzimuth(settings.fillAzimuth ?? -26);
    setFillElevation(settings.fillElevation ?? 48);
    setFillDistance(settings.fillDistance ?? 3.15);
    setKeyColor(settings.keyColor);
    setKeyIntensity(settings.keyIntensity);
    setKeyOffsetX(settings.keyOffsetX);
    setKeyOffsetY(settings.keyOffsetY);
    setKeyOffsetZ(settings.keyOffsetZ);
    setFillColor(settings.fillColor);
    setFillIntensity(settings.fillIntensity);
    setFillOffsetX(settings.fillOffsetX);
    setFillOffsetY(settings.fillOffsetY);
    setFillOffsetZ(settings.fillOffsetZ);
    setHideLightSource(settings.hideLightSource);
    setLightGain(settings.lightGain ?? 1.25);
    setLightSoftness(THREE.MathUtils.clamp(settings.lightSoftness ?? 0.62, 0, 1));
    setFloorMode(settings.floorMode ?? "topo");
    setGroundGloss(THREE.MathUtils.clamp(settings.groundGloss ?? 0.34, 0, 1));
    setGroundMotion(settings.groundMotion ?? false);
    const requestedPrimary = FX_STYLE_OPTIONS.includes(settings.particleStyle as ParticleStyle)
      ? (settings.particleStyle as ParticleStyle)
      : "dust";
    setParticleStyle(requestedPrimary === "beams" ? "shards" : requestedPrimary);
    const safeSecondary =
      settings.secondaryParticleStyle === "none" ||
      FX_STYLE_OPTIONS.includes(settings.secondaryParticleStyle as ParticleStyle)
        ? (settings.secondaryParticleStyle as SecondaryParticleStyle)
        : "none";
    setSecondaryParticleStyle(safeSecondary === "beams" ? "none" : safeSecondary ?? "none");
    setEffectBlend(settings.effectBlend ?? 0.34);
    setEffectAmount(settings.effectAmount ?? 1.15);
    setEffectSpeed(settings.effectSpeed ?? 1);
    setEffectScale(settings.effectScale ?? 1.25);
    setEffectSpread(settings.effectSpread ?? 1.08);
    setOrbitCenterLift(settings.orbitCenterLift ?? 0.56);
    setBloomStrength(settings.bloomStrength);
    setFogAmount(settings.fogAmount);
    setAmbientAtmosphere(settings.ambientAtmosphere);
    setAtmosphereSpread(settings.atmosphereSpread);
    setAutoOrbit(settings.autoOrbit);
    setRingPulse(settings.ringPulse);
    setRingImpact(settings.ringImpact);
    setParticlesEnabled(settings.particlesEnabled);
    setParticleDensity(settings.particleDensity);
    setTitleSync(settings.titleSync);
    setBeatPulse(settings.beatPulse);
    setModelPosX(settings.modelPosX ?? 0);
    setModelPosY(settings.modelPosY ?? 0);
    setModelPosZ(settings.modelPosZ ?? 0);
    setModelYaw(settings.modelYaw ?? 0);
    setModelScale(settings.modelScale ?? 1);
    setModelFloat(settings.modelFloat ?? false);
    setModelAnimationPlaying(settings.modelAnimationPlaying ?? true);
    setModelAnimationSpeed(settings.modelAnimationSpeed ?? 1);
    const safeModelMaterialMode: ModelMaterialMode =
      settings.modelMaterialMode === "clay" ||
      settings.modelMaterialMode === "wire" ||
      settings.modelMaterialMode === "hologram" ||
      settings.modelMaterialMode === "original"
        ? settings.modelMaterialMode
        : "original";
    setModelMaterialMode(safeModelMaterialMode);
    setModelTint(settings.modelTint ?? "#d7deea");
    setModelMetalness(settings.modelMetalness ?? 0.15);
    setModelRoughness(settings.modelRoughness ?? 0.65);
    setScreenAttachmentMode(
      settings.screenAttachmentMode === "world" ||
        settings.screenAttachmentMode === "follow-pos" ||
        settings.screenAttachmentMode === "follow-pos-yaw" ||
        settings.screenAttachmentMode === "follow-full"
        ? settings.screenAttachmentMode
        : "follow-pos-yaw"
    );
    setAutoFitMediaAspect(settings.autoFitMediaAspect ?? true);
    setMediaFidelity(THREE.MathUtils.clamp(settings.mediaFidelity ?? 0.62, 0, 1));
    setPerformanceTier(
      settings.performanceTier === "ultra" || settings.performanceTier === "fast" ? settings.performanceTier : "balanced"
    );
    setAutoQuality(settings.autoQuality ?? false);
    setCameraFovOffset(THREE.MathUtils.clamp(settings.cameraFovOffset ?? 0, -20, 20));
    setCameraDamping(THREE.MathUtils.clamp(settings.cameraDamping ?? 0.06, 0.01, 0.3));
    setCameraOrbitSpeed(THREE.MathUtils.clamp(settings.cameraOrbitSpeed ?? 0.65, 0.1, 2.5));
    const safeNear = THREE.MathUtils.clamp(settings.cameraNear ?? 0.1, 0.02, 10);
    const safeFar = THREE.MathUtils.clamp(settings.cameraFar ?? 100, Math.max(safeNear + 1, 20), 300);
    setCameraNear(safeNear);
    setCameraFar(safeFar);
    const safeHdriPreset: HdriPresetKey =
      settings.hdriPreset === "studio" ||
      settings.hdriPreset === "sunset" ||
      settings.hdriPreset === "city" ||
      settings.hdriPreset === "custom" ||
      settings.hdriPreset === "off"
        ? settings.hdriPreset
        : "off";
    setHdriPreset(safeHdriPreset);
    setHdriIntensity(THREE.MathUtils.clamp(settings.hdriIntensity ?? 0.85, 0, 4));
    setHdriRotation(THREE.MathUtils.clamp(settings.hdriRotation ?? 0, -180, 180));
    setHdriBackground(settings.hdriBackground ?? false);
    setHdriBlur(THREE.MathUtils.clamp(settings.hdriBlur ?? 0.05, 0, 1));
    setHdriExposure(THREE.MathUtils.clamp(settings.hdriExposure ?? 0, -1.5, 1.5));
    setHeroTitleText(settings.heroTitleText ?? "Sary Nassar");
    window.setTimeout(() => {
      applyingShotRigRef.current = false;
    }, 0);
  };

  const releaseHistorySuspension = () => {
    window.setTimeout(() => {
      historySuspendRef.current = false;
    }, 0);
  };

  const undoSettings = () => {
    if (undoStack.length === 0) return;
    const current = readCurrentSettings();
    const previous = undoStack[undoStack.length - 1];
    historySuspendRef.current = true;
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [current, ...prev].slice(0, HISTORY_LIMIT));
    applySceneSettings(previous);
    releaseHistorySuspension();
  };

  const redoSettings = () => {
    if (redoStack.length === 0) return;
    const current = readCurrentSettings();
    const next = redoStack[0];
    historySuspendRef.current = true;
    setRedoStack((prev) => prev.slice(1));
    setUndoStack((prev) => [...prev, current].slice(-HISTORY_LIMIT));
    applySceneSettings(next);
    releaseHistorySuspension();
  };

  const createPresetId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `p-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  };

  const switchShot = (next: CameraShotKey) => {
    if (next === shot) return;
    if (!shotLinkedRigsRef.current) {
      setShot(next);
      return;
    }
    const currentRig = captureRigState();
    const nextMap = {
      ...shotRigMapRef.current,
      [shot]: currentRig,
    };
    const nextRig = nextMap[next] ?? cloneRig(DEFAULT_RIG);
    shotRigMapRef.current = nextMap;
    setShotRigMap(nextMap);
    applyingShotRigRef.current = true;
    applyRigToState(nextRig);
    window.setTimeout(() => {
      applyingShotRigRef.current = false;
    }, 0);
    setShot(next);
  };

  const addTimelineFrame = () => {
    const nextFrame: RigKeyframe = {
      id: createPresetId(),
      name: `K${timelineFrames.length + 1}`,
      t: THREE.MathUtils.clamp(timelineCursor, 0, 1),
      rig: captureRigState(),
    };
    setTimelineFrames((prev) => [...prev, nextFrame].sort((a, b) => a.t - b.t));
    setSelectedFrameId(nextFrame.id);
  };

  const updateSelectedFrame = () => {
    if (!selectedFrameId) return;
    const rig = captureRigState();
    const targetT = THREE.MathUtils.clamp(timelineCursor, 0, 1);
    setTimelineFrames((prev) =>
      prev
        .map((frame) =>
          frame.id === selectedFrameId
            ? {
                ...frame,
                t: targetT,
                rig,
              }
            : frame
        )
        .sort((a, b) => a.t - b.t)
    );
  };

  const removeSelectedFrame = () => {
    if (!selectedFrameId) return;
    setTimelineFrames((prev) => {
      const next = prev.filter((frame) => frame.id !== selectedFrameId);
      setSelectedFrameId(next[0]?.id ?? "");
      return next;
    });
  };

  const applySelectedFrame = () => {
    const frame = timelineFrames.find((item) => item.id === selectedFrameId);
    if (!frame) return;
    setTimelineCursor(frame.t);
    timelineCursorRef.current = frame.t;
    applyTimelineAt(frame.t, true);
  };

  const resetCameraModule = () => {
    setAutoOrbit(false);
    setShotLinkedRigs(true);
    setShot("mid");
    setCameraFovOffset(0);
    setCameraDamping(0.06);
    setCameraOrbitSpeed(0.65);
    setCameraNear(0.1);
    setCameraFar(100);
    triggerShotRef.current?.("mid", true);
  };

  const resetOrbitModule = () => {
    const current = captureRigState();
    applyRigToState({
      ...current,
      lightAnchorMode: "follow",
      worldAnchorX: 0,
      worldAnchorY: 1.1,
      worldAnchorZ: 0,
      keyAzimuth: 36,
      keyElevation: 61,
      keyDistance: 3.45,
      fillAzimuth: -26,
      fillElevation: 48,
      fillDistance: 3.15,
      keyOffsetX: 0,
      keyOffsetY: 0,
      keyOffsetZ: 0,
      fillOffsetX: DEFAULT_FILL_OFFSET.x,
      fillOffsetY: DEFAULT_FILL_OFFSET.y,
      fillOffsetZ: DEFAULT_FILL_OFFSET.z,
    });
    setOrbitCenterLift(0.56);
    setShowLightMarkers(true);
    setLockLightsAboveGround(false);
  };

  const resetLightingModule = () => {
    const p = PRESETS[preset];
    setKeyIntensity(p.keyIntensity);
    setKeyColor(p.keyColor);
    setKeyOffsetX(0);
    setKeyOffsetY(0);
    setKeyOffsetZ(0);
    setFillIntensity(p.fillIntensity);
    setFillColor(p.fillColor);
    setFillOffsetX(DEFAULT_FILL_OFFSET.x);
    setFillOffsetY(DEFAULT_FILL_OFFSET.y);
    setFillOffsetZ(DEFAULT_FILL_OFFSET.z);
    setHideLightSource(true);
    setLightGain(1.25);
    setLightSoftness(0.62);
  };

  const resetLookModule = () => {
    applyPreset("studio");
    setGrade("clean");
    setEnvironmentMode("core");
    setEnvironmentAutoHdri(false);
    setEnvironmentObjectImpact(0.62);
    setOverlaySilhouette(true);
  };

  const resetFXModule = () => {
    setActiveFxPreset(null);
    setRingPulse(true);
    setRingImpact(0.48);
    setFloorMode("topo");
    setGroundGloss(0.34);
    setGroundMotion(false);
    setParticlesEnabled(true);
    setParticleStyle("dust");
    setSecondaryParticleStyle("none");
    setEffectBlend(0.34);
    setEffectAmount(1.15);
    setEffectSpeed(1);
    setEffectScale(1.25);
    setEffectSpread(1.08);
    setParticleDensity(0.58);
    setTitleSync(true);
    setBeatPulse(false);
  };

  const resetModelModule = () => {
    setModelPosX(0);
    setModelPosY(0);
    setModelPosZ(0);
    setModelYaw(0);
    setModelScale(1);
    setModelFloat(false);
    setModelAnimationPlaying(true);
    setModelAnimationSpeed(1);
    setActiveModelClip(0);
    setModelMaterialMode("original");
    setModelTint("#d7deea");
    setModelMetalness(0.15);
    setModelRoughness(0.65);
    const defaults = createDefaultScreenCards();
    setScreensEnabled(true);
    setScreens(defaults);
    setActiveScreenId(defaults[0].id);
  };

  const resetEnvironmentModule = () => {
    setHdriPreset("off");
    setHdriIntensity(0.85);
    setHdriRotation(0);
    setHdriBackground(false);
    setHdriBlur(0.05);
    setHdriExposure(0);
    hdriCustomSourceRef.current = null;
    hdriCustomIsHdrRef.current = true;
    hdriCustomNameRef.current = "None";
    setHdriName("None");
    if (uploadedHdriUrlRef.current) {
      URL.revokeObjectURL(uploadedHdriUrlRef.current);
      uploadedHdriUrlRef.current = null;
    }
  };

  const resetConstraintsModule = () => {
    setMinLightHeight(0.03);
    setMaxLightDistance(4.7);
    setStayLightsInFront(false);
    setAvoidBodyIntersection(true);
    setBodyClearance(0.55);
  };

  const resetMotionModule = () => {
    setTimelineFrames([]);
    setTimelineCursor(0);
    setTimelineDuration(6);
    setTimelineLoop(true);
    setTimelinePlaying(false);
    setSelectedFrameId("");
    setLightPaintMode(false);
    setLightPaintPoints([]);
    setLightPaintPlaying(false);
    setLightPaintLoop(true);
    setLightPaintSpeed(1);
    setLightPaintProgress(0);
  };

  const resetOutputModule = () => {
    setCaptureFormat("png");
    setQualityMode("final");
    setAutoQuality(false);
    setPerformanceTier("balanced");
    setPanelMinimized(false);
  };

  const saveCurrentPreset = () => {
    const nextName = presetNameInput.trim() || `Preset ${savedPresets.length + 1}`;
    const nextPreset: SavedScenePreset = {
      id: createPresetId(),
      name: nextName,
      updatedAt: Date.now(),
      settings: readCurrentSettings(),
    };
    setSavedPresets((prev) => [nextPreset, ...prev].slice(0, 30));
    setSelectedPresetId(nextPreset.id);
    setPresetNameInput("");
  };

  const applySelectedPreset = () => {
    const selected = savedPresets.find((item) => item.id === selectedPresetId);
    if (!selected) return;
    applySceneSettings({ ...readCurrentSettings(), ...selected.settings } as SceneSettings);
  };

  const updateSelectedPreset = () => {
    if (!selectedPresetId) return;
    setSavedPresets((prev) =>
      prev.map((item) =>
        item.id === selectedPresetId
          ? {
              ...item,
              updatedAt: Date.now(),
              settings: readCurrentSettings(),
            }
          : item
      )
    );
  };

  const renameSelectedPreset = () => {
    const nextName = presetNameInput.trim();
    if (!selectedPresetId || !nextName) return;
    setSavedPresets((prev) =>
      prev.map((item) =>
        item.id === selectedPresetId
          ? {
              ...item,
              name: nextName,
              updatedAt: Date.now(),
            }
          : item
      )
    );
    setPresetNameInput("");
  };

  const deleteSelectedPreset = () => {
    if (!selectedPresetId) return;
    setSavedPresets((prev) => {
      const next = prev.filter((item) => item.id !== selectedPresetId);
      setSelectedPresetId(next[0]?.id ?? "");
      return next;
    });
    setPresetNameInput("");
  };

  const buildSceneApiCapabilities = (): SceneApiCapabilities => ({
    apiVersion: SCENE_API_VERSION,
    supportedApiVersions: [SCENE_API_VERSION],
    channel: SCENE_API_CHANNEL,
    commands: [...SCENE_API_COMMANDS],
    events: [...SCENE_API_EVENTS],
    errors: [...SCENE_API_ERROR_CODES],
    limits: {
      maxScreens: 8,
      supportedProviders: ["youtube", "vimeo"],
      maxTextureSize: 4096,
      captureFormats: ["png", "jpg"],
      exportFormats: ["pack-json"],
      maxModelUploadMB: 200,
    },
    execution: {
      minTimeoutMs: 250,
      defaultTimeoutMs: 12_000,
      maxTimeoutMs: 120_000,
      maxRetryCount: 6,
      idempotencyTtlMs: SCENE_API_IDEMPOTENCY_TTL_MS,
    },
    featureFlags: {
      providerMedia: true,
      serverMediaResolver: serverMediaEnabled,
      stateVersioning: true,
      idempotency: true,
      postMessageBridge: true,
      windowBridge: true,
      screenDirectManipulation: true,
      lightDirectManipulation: true,
    },
  });

  const buildSceneApiError = (
    code: SceneApiErrorCode,
    message: string,
    details?: Record<string, unknown>,
    retryable = false
  ): SceneApiError => ({
    code,
    message,
    details,
    retryable,
  });

  const createSceneApiResponse = (
    command: SceneApiCommandMessage,
    ok: boolean,
    result: unknown,
    error: SceneApiError | null
  ): SceneApiResponseMessage => ({
    channel: SCENE_API_CHANNEL,
    sessionId: sceneApiSessionIdRef.current,
    apiVersion: SCENE_API_VERSION,
    kind: "response",
    domain: "scene",
    name: command.name,
    requestId: command.requestId,
    ts: Date.now(),
    origin: "scene",
    ok,
    result,
    error,
    stateVersion: sceneApiStateVersionRef.current,
  });

  const postSceneApiMessage = (
    target: Window | undefined,
    origin: string,
    payload: SceneApiResponseMessage | SceneApiEventMessage
  ) => {
    if (!target) return;
    try {
      target.postMessage(payload, origin);
    } catch {
      // Ignore postMessage transport errors.
    }
  };

  const isSceneApiOriginAllowed = (origin: string) => {
    if (typeof window === "undefined") return false;
    const custom = Array.isArray(window.__XTATION_SCENE_ALLOWED_ORIGINS__)
      ? window.__XTATION_SCENE_ALLOWED_ORIGINS__.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      : [];
    if (custom.includes("*")) return true;
    if (origin === window.location.origin) return true;
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) return true;
    return custom.includes(origin);
  };

  const registerSceneApiClient = (origin: string, source: Window | undefined) => {
    if (!source) return;
    sceneApiClientsRef.current.set(origin, { origin, source });
  };

  const pruneSceneApiIdempotency = () => {
    const now = Date.now();
    sceneApiIdempotencyRef.current.forEach((value, key) => {
      if (value.expiresAt <= now) {
        sceneApiIdempotencyRef.current.delete(key);
      }
    });
  };

  const emitSceneApiEvent = (
    name: string,
    payload: unknown,
    requestId?: string,
    target?: SceneApiClient
  ): SceneApiEventMessage => {
    const eventMessage: SceneApiEventMessage = {
      channel: SCENE_API_CHANNEL,
      sessionId: sceneApiSessionIdRef.current,
      apiVersion: SCENE_API_VERSION,
      kind: "event",
      domain: "scene",
      name,
      requestId: requestId && requestId.length > 0 ? requestId : createSceneApiId(),
      ts: Date.now(),
      origin: "scene",
      payload,
      stateVersion: sceneApiStateVersionRef.current,
    };

    sceneApiListenersRef.current.forEach((listener) => {
      try {
        listener(eventMessage);
      } catch {
        // Ignore subscriber failures to keep event bus resilient.
      }
    });

    if (target) {
      postSceneApiMessage(target.source, target.origin, eventMessage);
      return eventMessage;
    }

    sceneApiClientsRef.current.forEach((client) => {
      postSceneApiMessage(client.source, client.origin, eventMessage);
    });
    return eventMessage;
  };

  const resolveScreenIdFromPayload = (payload: Record<string, unknown>) => {
    const requested = typeof payload.screenId === "string" && payload.screenId.length > 0 ? payload.screenId : activeScreenIdRef.current;
    const found = screensRef.current.find((entry) => entry.id === requested);
    return found ? found.id : null;
  };

  const handleSceneApiCommand = async (
    command: SceneApiCommandMessage,
    meta: SceneApiCommandMeta
  ): Promise<SceneApiResponseMessage> => {
    pruneSceneApiIdempotency();
    const targetClient = meta.sourceWindow ? { source: meta.sourceWindow, origin: meta.origin } : undefined;
    const isMutating = !SCENE_API_READ_COMMAND_SET.has(command.name);
    const stateVersionBefore = sceneApiStateVersionRef.current;
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

    const getDurationMs = () => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      return Math.max(0, Math.round(now - startedAt));
    };

    const fail = (error: SceneApiError): SceneApiResponseMessage => {
      if (isMutating) {
        emitSceneApiEvent(
          "commandFailed",
          {
            command: command.name,
            code: error.code,
            message: error.message,
            retryable: error.retryable,
            durationMs: getDurationMs(),
            stateVersionBefore,
            stateVersionAfter: sceneApiStateVersionRef.current,
          },
          command.requestId,
          targetClient
        );
      }
      return createSceneApiResponse(command, false, null, error);
    };

    if (isMutating && typeof command.expectedStateVersion === "number" && command.expectedStateVersion !== sceneApiStateVersionRef.current) {
      return fail(
        buildSceneApiError("BUSY", "State version mismatch", {
          expectedStateVersion: command.expectedStateVersion,
          currentStateVersion: sceneApiStateVersionRef.current,
        })
      );
    }

    if (SCENE_API_SIDE_EFFECT_COMMAND_SET.has(command.name) && typeof command.idempotencyKey === "string" && command.idempotencyKey.length > 0) {
      const cacheKey = `${command.name}:${command.idempotencyKey}`;
      const cached = sceneApiIdempotencyRef.current.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return {
          ...cached.response,
          ts: Date.now(),
        };
      }
    }

    if (isMutating) {
      emitSceneApiEvent(
        "commandAccepted",
        {
          command: command.name,
          expectedStateVersion: typeof command.expectedStateVersion === "number" ? command.expectedStateVersion : null,
          timeoutMs: typeof command.timeoutMs === "number" ? THREE.MathUtils.clamp(command.timeoutMs, 250, 120_000) : null,
          source: meta.source,
        },
        command.requestId,
        targetClient
      );
    }

    try {
      let result: unknown = null;
      let completionDetails: Record<string, unknown> = {};
      const payload = isObjectRecord(command.payload) ? command.payload : {};
      const commandApiVersion = command.apiVersion.trim();
      if (commandApiVersion.length > 0 && commandApiVersion !== SCENE_API_VERSION) {
        return fail(
          buildSceneApiError("INVALID_REQUEST", "Unsupported apiVersion", {
            provided: commandApiVersion,
            supported: [SCENE_API_VERSION],
          })
        );
      }

      switch (command.name) {
        case "hello": {
          registerSceneApiClient(meta.origin, meta.sourceWindow);
          const requestedVersion = typeof payload.requestedVersion === "string" ? payload.requestedVersion.trim() : SCENE_API_VERSION;
          result = {
            sessionId: sceneApiSessionIdRef.current,
            apiVersion: SCENE_API_VERSION,
            negotiatedVersion: SCENE_API_VERSION,
            versionMatch: requestedVersion === SCENE_API_VERSION,
            channel: SCENE_API_CHANNEL,
            stateVersion: sceneApiStateVersionRef.current,
            capabilities: buildSceneApiCapabilities(),
          };
          emitSceneApiEvent("ready", result, command.requestId, targetClient);
          break;
        }
        case "getState": {
          result = {
            stateVersion: sceneApiStateVersionRef.current,
            state: readCurrentSettings(),
          };
          break;
        }
        case "getCapabilities": {
          result = {
            stateVersion: sceneApiStateVersionRef.current,
            capabilities: buildSceneApiCapabilities(),
          };
          break;
        }
        case "setStatePartial": {
          if (!isObjectRecord(command.payload)) {
            return fail(buildSceneApiError("VALIDATION_FAILED", "setStatePartial requires an object payload"));
          }
          const next = {
            ...readCurrentSettings(),
            ...command.payload,
          } as SceneSettings;
          applySceneSettings(next);
          result = {
            applied: true,
          };
          break;
        }
        case "applyPreset": {
          const presetValue = typeof payload.preset === "string" ? payload.preset : null;
          if (presetValue !== "studio" && presetValue !== "noir" && presetValue !== "neon") {
            return fail(
              buildSceneApiError("VALIDATION_FAILED", "Invalid preset", {
                preset: payload.preset,
              })
            );
          }
          applyPreset(presetValue);
          result = {
            preset: presetValue,
          };
          break;
        }
        case "setEnvironmentMode": {
          const modeValue = typeof payload.mode === "string" ? payload.mode : null;
          if (
            modeValue !== "core" &&
            modeValue !== "light" &&
            modeValue !== "dusk" &&
            modeValue !== "glacier" &&
            modeValue !== "mono" &&
            modeValue !== "bureau"
          ) {
            return fail(
              buildSceneApiError("VALIDATION_FAILED", "Invalid environment mode", {
                mode: payload.mode,
              })
            );
          }
          setEnvironmentMode(modeValue);
          result = {
            environmentMode: modeValue,
          };
          break;
        }
        case "setHdriProfile": {
          if (typeof payload.preset === "string") {
            const presetValue = payload.preset;
            if (presetValue === "off" || presetValue === "studio" || presetValue === "sunset" || presetValue === "city" || presetValue === "custom") {
              selectHdriPreset(presetValue);
            } else {
              return fail(
                buildSceneApiError("VALIDATION_FAILED", "Invalid HDRI preset", {
                  preset: payload.preset,
                })
              );
            }
          }
          const intensity = asFiniteNumber(payload.intensity);
          const rotation = asFiniteNumber(payload.rotation);
          const blur = asFiniteNumber(payload.blur);
          const exposure = asFiniteNumber(payload.exposure);
          const background = asBoolean(payload.background);
          if (intensity !== null) setHdriIntensity(THREE.MathUtils.clamp(intensity, 0, 4));
          if (rotation !== null) setHdriRotation(THREE.MathUtils.clamp(rotation, -180, 180));
          if (blur !== null) setHdriBlur(THREE.MathUtils.clamp(blur, 0, 1));
          if (exposure !== null) setHdriExposure(THREE.MathUtils.clamp(exposure, -1.5, 1.5));
          if (background !== null) setHdriBackground(background);
          result = {
            hdriPreset: hdriPresetRef.current,
          };
          break;
        }
        case "setCameraShot": {
          const shotValue = typeof payload.shot === "string" ? payload.shot : null;
          if (shotValue !== "hero" && shotValue !== "mid" && shotValue !== "wide") {
            return fail(
              buildSceneApiError("VALIDATION_FAILED", "Invalid shot value", {
                shot: payload.shot,
              })
            );
          }
          const immediate = asBoolean(payload.immediate) ?? false;
          if (immediate) {
            setShot(shotValue);
            triggerShotRef.current?.(shotValue, true);
          } else {
            switchShot(shotValue);
          }
          const linkRigs = asBoolean(payload.linkRigs);
          if (linkRigs !== null) setShotLinkedRigs(linkRigs);
          result = {
            shot: shotValue,
            immediate,
          };
          break;
        }
        case "setCameraMotion": {
          const enabled = asBoolean(payload.enabled);
          if (enabled !== null) {
            setAutoOrbit(enabled);
          }
          const speed = asFiniteNumber(payload.speed);
          if (speed !== null) {
            setCameraOrbitSpeed(THREE.MathUtils.clamp(speed, 0.1, 2.5));
          }
          result = {
            autoOrbit: enabled ?? autoOrbit,
            orbitSpeed: speed ?? cameraOrbitSpeedRef.current,
          };
          break;
        }
        case "setLight": {
          const lightId = payload.lightId;
          const props = isObjectRecord(payload.props) ? payload.props : {};
          if (lightId !== "key" && lightId !== "fill") {
            return fail(
              buildSceneApiError("VALIDATION_FAILED", "Invalid lightId", {
                lightId,
              })
            );
          }
          const intensity = asFiniteNumber(props.intensity);
          const azimuth = asFiniteNumber(props.azimuth);
          const elevation = asFiniteNumber(props.elevation);
          const distance = asFiniteNumber(props.distance);
          const offsetX = asFiniteNumber(props.offsetX);
          const offsetY = asFiniteNumber(props.offsetY);
          const offsetZ = asFiniteNumber(props.offsetZ);
          const color = typeof props.color === "string" ? props.color : null;
          const target = isObjectRecord(props.target) ? props.target : null;

          if (lightId === "key") {
            if (intensity !== null) setKeyIntensity(THREE.MathUtils.clamp(intensity, 0, KEY_INTENSITY_MAX));
            if (azimuth !== null) setKeyAzimuth(wrapAngle(azimuth));
            if (elevation !== null) setKeyElevation(clampElevation(elevation));
            if (distance !== null) setKeyDistance(THREE.MathUtils.clamp(distance, 0.6, 12));
            if (offsetX !== null) setKeyOffsetX(THREE.MathUtils.clamp(offsetX, -4, 4));
            if (offsetY !== null) setKeyOffsetY(THREE.MathUtils.clamp(offsetY, -4, 4));
            if (offsetZ !== null) setKeyOffsetZ(THREE.MathUtils.clamp(offsetZ, -4, 4));
            if (color) setKeyColor(color);
          } else {
            if (intensity !== null) setFillIntensity(THREE.MathUtils.clamp(intensity, 0, FILL_INTENSITY_MAX));
            if (azimuth !== null) setFillAzimuth(wrapAngle(azimuth));
            if (elevation !== null) setFillElevation(clampElevation(elevation));
            if (distance !== null) setFillDistance(THREE.MathUtils.clamp(distance, 0.6, 12));
            if (offsetX !== null) setFillOffsetX(THREE.MathUtils.clamp(offsetX, -4, 4));
            if (offsetY !== null) setFillOffsetY(THREE.MathUtils.clamp(offsetY, -4, 4));
            if (offsetZ !== null) setFillOffsetZ(THREE.MathUtils.clamp(offsetZ, -4, 4));
            if (color) setFillColor(color);
          }

          if (target) {
            const tx = asFiniteNumber(target.x);
            const ty = asFiniteNumber(target.y);
            const tz = asFiniteNumber(target.z);
            if (tx !== null && ty !== null && tz !== null) {
              setLightAnchorMode("world");
              setWorldAnchorX(THREE.MathUtils.clamp(tx, -4, 4));
              setWorldAnchorY(THREE.MathUtils.clamp(ty, -2, 4));
              setWorldAnchorZ(THREE.MathUtils.clamp(tz, -4, 4));
            }
          }
          result = {
            lightId,
            updated: true,
          };
          break;
        }
        case "setScreen": {
          const screenId = resolveScreenIdFromPayload(payload);
          if (!screenId) {
            return fail(
              buildSceneApiError("VALIDATION_FAILED", "Unknown screenId", {
                screenId: payload.screenId,
              })
            );
          }
          const props = isObjectRecord(payload.props) ? payload.props : {};
          const patch: Partial<ScreenCard> = {};
          const x = asFiniteNumber(props.x);
          const y = asFiniteNumber(props.y);
          const z = asFiniteNumber(props.z);
          const yaw = asFiniteNumber(props.yaw);
          const scale = asFiniteNumber(props.scale);
          const width = asFiniteNumber(props.width);
          const height = asFiniteNumber(props.height);
          const bend = asFiniteNumber(props.bend);
          if (x !== null) patch.x = THREE.MathUtils.clamp(x, -4, 4);
          if (y !== null) patch.y = THREE.MathUtils.clamp(y, -0.5, 4);
          if (z !== null) patch.z = THREE.MathUtils.clamp(z, -4, 4);
          if (yaw !== null) patch.yaw = THREE.MathUtils.clamp(yaw, -180, 180);
          if (scale !== null) patch.scale = THREE.MathUtils.clamp(scale, 0.3, 2.2);
          if (width !== null) patch.width = THREE.MathUtils.clamp(width, 0.35, 2.6);
          if (height !== null) patch.height = THREE.MathUtils.clamp(height, 0.35, 2.6);
          if (bend !== null) patch.bend = THREE.MathUtils.clamp(bend, -2.5, 2.5);
          if (typeof props.text === "string") patch.text = props.text.slice(0, 520);
          if (typeof props.label === "string") patch.label = (props.label.slice(0, 10) || "S");
          if (props.shape === "panel" || props.shape === "round" || props.shape === "diamond") patch.shape = props.shape;
          if (props.sourceMode === "auto" || props.sourceMode === "integrated" || props.sourceMode === "provider") {
            patch.sourceMode = !serverMediaEnabled && props.sourceMode === "integrated" ? "provider" : props.sourceMode;
          }
          if (
            props.audioPolicy === "normal" ||
            props.audioPolicy === "solo" ||
            props.audioPolicy === "background" ||
            props.audioPolicy === "duck"
          ) {
            patch.audioPolicy = props.audioPolicy;
          }
          const visible = asBoolean(props.visible);
          const showFrame = asBoolean(props.showFrame);
          const mediaMuted = asBoolean(props.mediaMuted);
          const audioOnly = asBoolean(props.audioOnly);
          const clearMedia = props.clearMedia === true;
          if (visible !== null) patch.visible = visible;
          if (showFrame !== null) patch.showFrame = showFrame;
          if (mediaMuted !== null) patch.mediaMuted = mediaMuted;
          if (audioOnly !== null) patch.audioOnly = audioOnly;
          if (clearMedia) {
            patch.mediaUrl = null;
            patch.mediaOriginalUrl = null;
            patch.mediaKind = "none";
            patch.mediaSourceType = "directUrl";
            patch.mediaProvider = null;
            patch.mediaEmbedBase = null;
            patch.mediaPlaying = true;
            patch.mediaMuted = true;
            patch.audioUrl = null;
            patch.audioPlaying = false;
            patch.audioOnly = false;
          }

          updateScreenCard(screenId, patch);
          if ((asBoolean(payload.select) ?? true) === true) {
            setActiveScreenId(screenId);
            setSceneSelection("screen");
          }
          result = {
            screenId,
            updated: true,
          };
          break;
        }
        case "setScreenMedia": {
          setPlaybackAuthority("api");
          const screenId = resolveScreenIdFromPayload(payload);
          if (!screenId) {
            return fail(
              buildSceneApiError("VALIDATION_FAILED", "Unknown screenId", {
                screenId: payload.screenId,
              })
            );
          }
          const sourceType = payload.sourceType;
          if (sourceType !== "directUrl" && sourceType !== "provider" && sourceType !== "localAsset") {
            return fail(
              buildSceneApiError("VALIDATION_FAILED", "Invalid sourceType", {
                sourceType,
              })
            );
          }
          const url = typeof payload.url === "string" ? safeUpperUrl(payload.url) : "";
          if (!url) {
            return fail(
              buildSceneApiError("VALIDATION_FAILED", "Media URL is required", {
                sourceType,
              })
            );
          }
          const resolved = resolveMediaInput(url, undefined, sourceType);
          if (!resolved) {
            return fail(
              buildSceneApiError("MEDIA_UNSUPPORTED", "Unable to resolve media from URL/sourceType", {
                sourceType,
                url,
              })
            );
          }
          const mediaPlaying = asBoolean(payload.playing);
          const mediaMuted = asBoolean(payload.muted);
          const showFrame = asBoolean(payload.showFrame);
          const audioOnly = asBoolean(payload.audioOnly);
          const sourceMode =
            payload.sourceMode === "auto" || payload.sourceMode === "integrated" || payload.sourceMode === "provider"
              ? payload.sourceMode
              : null;
          const effectiveSourceMode =
            sourceMode === "integrated" && !serverMediaEnabled
              ? "provider"
              : sourceMode;
          const runtimeMediaUrl = resolved.kind === "provider" ? url : toRuntimeMediaUrl(url);
          updateScreenCard(screenId, {
            mediaUrl: runtimeMediaUrl,
            mediaOriginalUrl: resolved.kind === "provider" ? url : null,
            mediaKind: resolved.kind,
            mediaSourceType: resolved.sourceType,
            mediaProvider: resolved.provider,
            mediaEmbedBase: resolved.embedBase,
            ...(effectiveSourceMode !== null ? { sourceMode: effectiveSourceMode } : {}),
            mediaPlaying: mediaPlaying ?? (resolved.kind === "video" || resolved.kind === "gif" || resolved.kind === "provider"),
            mediaMuted: mediaMuted ?? (resolved.kind === "provider" ? true : resolved.kind === "video" ? false : true),
            ...(showFrame !== null ? { showFrame } : {}),
            ...(audioOnly !== null ? { audioOnly } : {}),
          });
          result = {
            screenId,
            sourceType: resolved.sourceType,
            mediaKind: resolved.kind,
          };
          break;
        }
        case "setScreenAudio": {
          setPlaybackAuthority("api");
          const screenId = resolveScreenIdFromPayload(payload);
          if (!screenId) {
            return fail(
              buildSceneApiError("VALIDATION_FAILED", "Unknown screenId", {
                screenId: payload.screenId,
              })
            );
          }
          const sourceType = payload.sourceType;
          if (sourceType !== "directUrl" && sourceType !== "localAsset") {
            return fail(
              buildSceneApiError("VALIDATION_FAILED", "Invalid audio sourceType", {
                sourceType,
              })
            );
          }
          const url = typeof payload.url === "string" ? safeUpperUrl(payload.url) : "";
          if (!url) {
            return fail(buildSceneApiError("VALIDATION_FAILED", "Audio URL is required"));
          }
          const runtimeAudioUrl = sourceType === "directUrl" ? toRuntimeMediaUrl(url) : url;
          const playing = asBoolean(payload.playing);
          const audioOnly = asBoolean(payload.audioOnly);
          updateScreenCard(screenId, {
            audioUrl: runtimeAudioUrl,
            audioPlaying: playing ?? true,
            ...(audioOnly !== null ? { audioOnly } : {}),
          });
          result = {
            screenId,
            sourceType: sourceType as SceneApiSourceType,
          };
          break;
        }
        case "playPauseMedia": {
          setPlaybackAuthority("api");
          const screenId = resolveScreenIdFromPayload(payload);
          if (!screenId) {
            return fail(
              buildSceneApiError("VALIDATION_FAILED", "Unknown screenId", {
                screenId: payload.screenId,
              })
            );
          }
          const playing = asBoolean(payload.playing);
          if (playing === null) {
            return fail(buildSceneApiError("VALIDATION_FAILED", "playPauseMedia requires a boolean `playing` value"));
          }
          const target = payload.media;
          const mediaMode = target === "audio" || target === "video" || target === "both" || target === "mute" ? target : "video";
          const current = screensRef.current.find((entry) => entry.id === screenId);
          if (!current) {
            return fail(
              buildSceneApiError("VALIDATION_FAILED", "Unknown screenId", {
                screenId,
              })
            );
          }
          const patch: Partial<ScreenCard> = {};
          if (mediaMode === "video" || mediaMode === "both") {
            if (current.mediaKind === "video" || current.mediaKind === "gif" || current.mediaKind === "provider") {
              patch.mediaPlaying = playing;
            }
          }
          if (mediaMode === "mute") {
            patch.mediaMuted = !playing;
          }
          if (mediaMode === "audio" || mediaMode === "both") {
            if (current.audioUrl) {
              patch.audioPlaying = playing;
            }
          }
          if (Object.keys(patch).length > 0) {
            updateScreenCard(screenId, patch);
          }
          result = {
            screenId,
            media: mediaMode,
            playing,
          };
          break;
        }
        case "captureStill": {
          const format = payload.format;
          if (format === "png" || format === "jpg") {
            setCaptureFormat(format);
          }
          const resolvedFormat = format === "png" || format === "jpg" ? format : captureFormatRef.current;
          captureStillRef.current?.();
          completionDetails = {
            format: resolvedFormat,
          };
          result = {
            captured: true,
            format: resolvedFormat,
          };
          break;
        }
        case "exportPack": {
          capturePackRef.current?.();
          completionDetails = {
            exported: true,
          };
          result = {
            exported: true,
          };
          break;
        }
        default: {
          return fail(
            buildSceneApiError("UNSUPPORTED_COMMAND", "Unsupported command", {
              name: command.name,
            })
          );
        }
      }

      const response = createSceneApiResponse(command, true, result, null);
      if (SCENE_API_SIDE_EFFECT_COMMAND_SET.has(command.name) && typeof command.idempotencyKey === "string" && command.idempotencyKey.length > 0) {
        const cacheKey = `${command.name}:${command.idempotencyKey}`;
        sceneApiIdempotencyRef.current.set(cacheKey, {
          response,
          expiresAt: Date.now() + SCENE_API_IDEMPOTENCY_TTL_MS,
        });
      }
      if (isMutating) {
        emitSceneApiEvent(
          "commandCompleted",
          {
            command: command.name,
            durationMs: getDurationMs(),
            stateVersionBefore,
            stateVersionAfter: sceneApiStateVersionRef.current,
            ...completionDetails,
          },
          command.requestId,
          targetClient
        );
      }
      return response;
    } catch (error) {
      return fail(
        buildSceneApiError("INTERNAL_ERROR", "Command execution failed", {
          reason: error instanceof Error ? error.message : String(error),
        })
      );
    }
  };

  sceneApiHandleCommandRef.current = handleSceneApiCommand;
  sceneApiGetStateRef.current = readCurrentSettings;
  sceneApiGetCapabilitiesRef.current = buildSceneApiCapabilities;

  useEffect(() => {
    const cfg = PRESETS[preset];

    if (ambientRef.current) {
      ambientRef.current.color.set(cfg.ambientSky);
      ambientRef.current.groundColor.set(cfg.ambientGround);
      ambientRef.current.intensity = cfg.ambientIntensity * (0.52 + ambientAtmosphereRef.current * 1.38);
    }

    if (atmoLightRef.current) {
      atmoLightRef.current.color.set(cfg.fogColor);
      atmoLightRef.current.intensity = (0.06 + ambientAtmosphereRef.current * 0.98) * (0.35 + fogAmountRef.current * 1.2);
      atmoLightRef.current.distance = 4 + atmosphereSpreadRef.current * 10.5;
      atmoLightRef.current.decay = 1.4 - atmosphereSpreadRef.current * 0.55;
    }

    if (keyLightRef.current) {
      keyLightRef.current.color.set(keyColor);
      keyLightRef.current.intensity = keyIntensity * lightGainRef.current;
    }

    if (floorMatRef.current) {
      floorMatRef.current.color.set(cfg.floorColor);
    }

    ringMatsRef.current.forEach((mat, i) => {
      mat.color.set(i % 4 === 0 ? cfg.ringColorB : cfg.ringColorA);
    });

    fogMatsRef.current.forEach((mat) => {
      mat.color.set(cfg.fogColor);
    });

    if (particleMatRef.current) {
      particleMatRef.current.color.set(cfg.fogColor);
    }
    if (glyphMatRef.current) {
      glyphMatRef.current.color.set(cfg.fogColor);
    }
    orbitBallMatsRef.current.forEach((mat, index) => {
      mat.color.set(index % 2 === 0 ? keyColorRef.current : fillColorRef.current);
    });
    ribbonMatsRef.current.forEach((mat, index) => {
      mat.color.set(index % 2 === 0 ? fillColorRef.current : keyColorRef.current);
    });
    shardMatsRef.current.forEach((mat, index) => {
      mat.color.set(index % 2 === 0 ? keyColorRef.current : fillColorRef.current);
    });
    beamMatsRef.current.forEach((mat, index) => {
      mat.color.set(index % 2 === 0 ? fillColorRef.current : keyColorRef.current);
    });
  }, [preset, keyColor, keyIntensity]);

  useEffect(() => {
    if (!keyLightRef.current) return;
    keyIntensityRef.current = keyIntensity;
    keyColorRef.current = keyColor;
    keyLightRef.current.color.set(keyColor);
    keyLightRef.current.intensity = keyIntensity * lightGainRef.current;
    orbitBallMatsRef.current.forEach((mat, index) => {
      if (index % 2 === 0) {
        mat.color.set(keyColor);
      }
    });
    ribbonMatsRef.current.forEach((mat, index) => {
      if (index % 2 === 1) {
        mat.color.set(keyColor);
      }
    });
    shardMatsRef.current.forEach((mat, index) => {
      if (index % 2 === 0) {
        mat.color.set(keyColor);
      }
    });
    beamMatsRef.current.forEach((mat, index) => {
      if (index % 2 === 1) {
        mat.color.set(keyColor);
      }
    });
  }, [keyColor, keyIntensity]);

  useEffect(() => {
    if (!fillLightRef.current) return;
    fillIntensityRef.current = fillIntensity;
    fillColorRef.current = fillColor;
    fillLightRef.current.color.set(fillColor);
    fillLightRef.current.intensity = hideLightSourceRef.current ? 0 : fillIntensity * lightGainRef.current;
    if (softFillRef.current) {
      softFillRef.current.color.set(fillColor);
      softFillRef.current.intensity = hideLightSourceRef.current
        ? fillIntensity * softFillBoost(lightSoftnessRef.current) * lightGainRef.current
        : 0;
    }
    orbitBallMatsRef.current.forEach((mat, index) => {
      if (index % 2 === 1) {
        mat.color.set(fillColor);
      }
    });
    ribbonMatsRef.current.forEach((mat, index) => {
      if (index % 2 === 0) {
        mat.color.set(fillColor);
      }
    });
    shardMatsRef.current.forEach((mat, index) => {
      if (index % 2 === 1) {
        mat.color.set(fillColor);
      }
    });
    beamMatsRef.current.forEach((mat, index) => {
      if (index % 2 === 0) {
        mat.color.set(fillColor);
      }
    });
  }, [fillColor, fillIntensity]);

  useEffect(() => {
    fillOffsetRef.current.set(fillOffsetX, fillOffsetY, fillOffsetZ);
  }, [fillOffsetX, fillOffsetY, fillOffsetZ]);

  useEffect(() => {
    keyOffsetRef.current.set(keyOffsetX, keyOffsetY, keyOffsetZ);
  }, [keyOffsetX, keyOffsetY, keyOffsetZ]);

  useEffect(() => {
    lightAnchorModeRef.current = lightAnchorMode;
  }, [lightAnchorMode]);

  useEffect(() => {
    worldAnchorRef.current.set(worldAnchorX, worldAnchorY, worldAnchorZ);
  }, [worldAnchorX, worldAnchorY, worldAnchorZ]);

  useEffect(() => {
    showLightMarkersRef.current = showLightMarkers;
  }, [showLightMarkers]);

  useEffect(() => {
    lockLightsAboveGroundRef.current = lockLightsAboveGround;
  }, [lockLightsAboveGround]);

  useEffect(() => {
    shotLinkedRigsRef.current = shotLinkedRigs;
    if (!shotLinkedRigs) return;
    const seeded = {
      ...shotRigMapRef.current,
      [shot]: captureRigState(),
    };
    shotRigMapRef.current = seeded;
    setShotRigMap(seeded);
  }, [shotLinkedRigs]);

  useEffect(() => {
    shotRigMapRef.current = shotRigMap;
  }, [shotRigMap]);

  useEffect(() => {
    minLightHeightRef.current = minLightHeight;
  }, [minLightHeight]);

  useEffect(() => {
    maxLightDistanceRef.current = maxLightDistance;
  }, [maxLightDistance]);

  useEffect(() => {
    stayLightsInFrontRef.current = stayLightsInFront;
  }, [stayLightsInFront]);

  useEffect(() => {
    avoidBodyIntersectionRef.current = avoidBodyIntersection;
  }, [avoidBodyIntersection]);

  useEffect(() => {
    bodyClearanceRef.current = bodyClearance;
  }, [bodyClearance]);

  useEffect(() => {
    keyAzimuthRef.current = keyAzimuth;
  }, [keyAzimuth]);

  useEffect(() => {
    keyElevationRef.current = keyElevation;
  }, [keyElevation]);

  useEffect(() => {
    keyDistanceRef.current = keyDistance;
  }, [keyDistance]);

  useEffect(() => {
    fillAzimuthRef.current = fillAzimuth;
  }, [fillAzimuth]);

  useEffect(() => {
    fillElevationRef.current = fillElevation;
  }, [fillElevation]);

  useEffect(() => {
    fillDistanceRef.current = fillDistance;
  }, [fillDistance]);

  useEffect(() => {
    if (!bloomRef.current) return;
    bloomStrengthRef.current = bloomStrength;
    bloomRef.current.strength = clampBloom(bloomStrength + GRADES[grade].bloomBoost);
  }, [bloomStrength, grade]);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.autoRotate = autoOrbit;
  }, [autoOrbit]);

  useEffect(() => {
    activeShotRef.current = shot;
    triggerShotRef.current?.(shot);
    if (!shotLinkedRigsRef.current || applyingShotRigRef.current) return;
    const rig = shotRigMapRef.current[shot];
    if (!rig) return;
    applyingShotRigRef.current = true;
    applyRigToState(rig);
    window.setTimeout(() => {
      applyingShotRigRef.current = false;
    }, 0);
  }, [shot]);

  useEffect(() => {
    gradeRef.current = grade;
    if (vignetteRef.current) {
      const uniforms = (vignetteRef.current.material as THREE.ShaderMaterial).uniforms;
      uniforms.offset.value = GRADES[grade].vignetteOffset;
      uniforms.darkness.value = GRADES[grade].vignetteDarkness;
    }
  }, [grade]);

  useEffect(() => {
    ringPulseRef.current = ringPulse;
  }, [ringPulse]);

  useEffect(() => {
    ringImpactRef.current = ringImpact;
  }, [ringImpact]);

  useEffect(() => {
    particlesEnabledRef.current = particlesEnabled;
  }, [particlesEnabled]);

  useEffect(() => {
    particleDensityRef.current = particleDensity;
  }, [particleDensity]);

  useEffect(() => {
    titleSyncRef.current = titleSync;
  }, [titleSync]);

  useEffect(() => {
    beatPulseRef.current = beatPulse;
  }, [beatPulse]);

  useEffect(() => {
    qualityModeRef.current = qualityMode;
    if (!rendererRef.current) return;
    const tierRatio =
      performanceTier === "ultra"
        ? 1
        : performanceTier === "fast"
          ? 0.74
          : 0.88;
    const baseCeiling = qualityMode === "draft" ? 1.1 : 2;
    const ratio = THREE.MathUtils.clamp(Math.min(window.devicePixelRatio, baseCeiling * tierRatio), 0.65, 2);
    rendererRef.current.setPixelRatio(ratio);
    const mount = mountRef.current;
    if (mount) {
      rendererRef.current.setSize(mount.clientWidth, mount.clientHeight);
    }
  }, [performanceTier, qualityMode]);

  useEffect(() => {
    modelPosXRef.current = modelPosX;
  }, [modelPosX]);

  useEffect(() => {
    modelPosYRef.current = modelPosY;
  }, [modelPosY]);

  useEffect(() => {
    modelPosZRef.current = modelPosZ;
  }, [modelPosZ]);

  useEffect(() => {
    modelYawRef.current = modelYaw;
  }, [modelYaw]);

  useEffect(() => {
    modelScaleRef.current = modelScale;
  }, [modelScale]);

  useEffect(() => {
    modelFloatRef.current = modelFloat;
  }, [modelFloat]);

  useEffect(() => {
    modelAnimationPlayingRef.current = modelAnimationPlaying;
  }, [modelAnimationPlaying]);

  useEffect(() => {
    modelAnimationSpeedRef.current = modelAnimationSpeed;
  }, [modelAnimationSpeed]);

  useEffect(() => {
    modelMaterialModeRef.current = modelMaterialMode;
  }, [modelMaterialMode]);

  useEffect(() => {
    modelTintRef.current = modelTint;
  }, [modelTint]);

  useEffect(() => {
    modelMetalnessRef.current = modelMetalness;
  }, [modelMetalness]);

  useEffect(() => {
    modelRoughnessRef.current = modelRoughness;
  }, [modelRoughness]);

  useEffect(() => {
    const safeIndex = THREE.MathUtils.clamp(activeModelClip, 0, Math.max(0, modelClipNames.length - 1));
    activeModelClipRef.current = safeIndex;
    if (safeIndex !== activeModelClip) {
      setActiveModelClip(safeIndex);
    }
  }, [activeModelClip, modelClipNames.length]);

  useEffect(() => {
    autoQualityRef.current = autoQuality;
  }, [autoQuality]);

  useEffect(() => {
    fpsRef.current = fps;
  }, [fps]);

  useEffect(() => {
    screensEnabledRef.current = screensEnabled;
  }, [screensEnabled]);

  useEffect(() => {
    screensRef.current = screens;
  }, [screens]);

  useEffect(() => {
    const previous = sceneApiScreenMediaSigRef.current;
    const next = new Map<string, string>();

    screens.forEach((card) => {
      const signature = [
        card.mediaKind,
        card.sourceMode,
        card.mediaSourceType,
        card.mediaProvider ?? "",
        card.mediaEmbedBase ?? "",
        card.mediaUrl ?? "",
        card.mediaOriginalUrl ?? "",
        card.mediaPlaying ? "1" : "0",
        card.mediaMuted ? "1" : "0",
        card.audioUrl ?? "",
        card.audioPlaying ? "1" : "0",
        card.audioOnly ? "1" : "0",
        card.audioPolicy,
      ].join("|");
      next.set(card.id, signature);
      const prevSig = previous.get(card.id);
      if (prevSig !== signature) {
        emitSceneApiEvent("screenMediaChanged", {
          screenId: card.id,
          mediaKind: card.mediaKind,
          sourceMode: card.sourceMode,
          sourceType: card.mediaSourceType,
          provider: card.mediaProvider,
          mediaUrl: card.mediaUrl,
          mediaOriginalUrl: card.mediaOriginalUrl ?? null,
          mediaPlaying: card.mediaPlaying,
          mediaMuted: card.mediaMuted,
          audioUrl: card.audioUrl,
          audioPlaying: card.audioPlaying,
          audioOnly: card.audioOnly,
          audioPolicy: card.audioPolicy,
        });
      }
    });

    previous.forEach((_value, screenId) => {
      if (next.has(screenId)) return;
      emitSceneApiEvent("screenRemoved", {
        screenId,
      });
    });

    sceneApiScreenMediaSigRef.current = next;
  }, [screens]);

  useEffect(() => {
    const payload = {
      selection: sceneSelection,
      selectionLabel,
      activeScreenId: activeScreenId || null,
      selectionLocked,
    };
    const signature = JSON.stringify(payload);
    if (sceneApiSelectionSigRef.current === signature) return;
    sceneApiSelectionSigRef.current = signature;
    emitSceneApiEvent("selectionChanged", payload);
  }, [activeScreenId, sceneSelection, selectionLabel, selectionLocked]);

  useEffect(() => {
    const payload = {
      owner: activePlaybackOwner,
      screenId: activeScreen?.id ?? null,
      mediaKind: activeScreen?.mediaKind ?? "none",
      syncMode: activeScreenSyncMode,
      pipeline: activeScreenPipelineLabel,
      dockMode: mediaDockMode,
    };
    const signature = JSON.stringify(payload);
    if (sceneApiPlaybackOwnerSigRef.current === signature) return;
    sceneApiPlaybackOwnerSigRef.current = signature;
    emitSceneApiEvent("playbackOwnerChanged", payload);
  }, [activePlaybackOwner, activeScreen?.id, activeScreen?.mediaKind, activeScreenPipelineLabel, activeScreenSyncMode, mediaDockMode]);

  useEffect(() => {
    if (screens.length === 0) {
      const defaults = createDefaultScreenCards();
      setScreens(defaults);
      setActiveScreenId(defaults[0]?.id ?? "");
      setSceneSelection(defaults[0] ? "screen" : "none");
      return;
    }
    if (activeScreenId && !screens.some((entry) => entry.id === activeScreenId)) {
      const fallback = screens[0]?.id ?? "";
      setActiveScreenId(fallback);
      setSceneSelection(fallback ? "screen" : "none");
    }
  }, [screens, activeScreenId]);

  useEffect(() => {
    activeScreenIdRef.current = activeScreenId;
  }, [activeScreenId]);

  useEffect(() => {
    if (!activeScreenId && sceneSelection === "screen") {
      setSceneSelection("none");
    }
  }, [activeScreenId, sceneSelection]);

  useEffect(() => {
    if (!autoEntityTab) return;
    if (inspectorLock) return;
    if (!contextFocus) return;
    if (sceneSelection === "screen" || sceneSelection === "model") {
      setPanelTab("model");
      return;
    }
    if (sceneSelection === "light-key" || sceneSelection === "light-fill" || sceneSelection === "light-target") {
      setPanelTab("lighting");
    }
  }, [autoEntityTab, contextFocus, inspectorLock, sceneSelection]);

  useEffect(() => {
    sceneSelectionRef.current = sceneSelection;
  }, [sceneSelection]);

  useEffect(() => {
    selectionLockedRef.current = selectionLocked;
  }, [selectionLocked]);

  useEffect(() => {
    inspectorLockRef.current = inspectorLock;
  }, [inspectorLock]);

  useEffect(() => {
    performanceTierRef.current = performanceTier;
  }, [performanceTier]);

  useEffect(() => {
    mediaDockModeRef.current = mediaDockMode;
  }, [mediaDockMode]);

  useEffect(() => {
    mediaDockCollapsedRef.current = mediaDockCollapsed;
  }, [mediaDockCollapsed]);

  useEffect(() => {
    playbackAuthorityRef.current = playbackAuthority;
  }, [playbackAuthority]);

  useEffect(() => {
    mediaFidelityRef.current = mediaFidelity;
  }, [mediaFidelity]);

  useEffect(() => {
    uiModeRef.current = uiMode;
  }, [uiMode]);

  useEffect(() => {
    panelTabRef.current = panelTab;
  }, [panelTab]);

  useEffect(() => {
    panelClosedRef.current = panelClosed;
  }, [panelClosed]);

  useEffect(() => {
    panelMinimizedRef.current = panelMinimized;
  }, [panelMinimized]);

  useEffect(() => {
    screenAttachmentModeRef.current = screenAttachmentMode;
  }, [screenAttachmentMode]);

  useEffect(() => {
    lightFollowPointRef.current = lightFollowPoint;
  }, [lightFollowPoint]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() ?? "";
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) {
        return;
      }
      if (event.key === "Tab") {
        const cycle = cycleSelectionRef.current;
        if (!cycle) return;
        event.preventDefault();
        cycle(event.shiftKey ? -1 : 1);
        return;
      }
      const lower = event.key.toLowerCase();
      if (lower === "f") {
        const frame = frameSelectionRef.current;
        if (!frame) return;
        event.preventDefault();
        frame();
        return;
      }
      if (lower === "v") {
        event.preventDefault();
        setAdvancedPanelVisible((prev) => !prev);
        return;
      }
      if (event.key === "Escape") {
        if (selectionLockedRef.current) return;
        setSceneSelection("none");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const screen = screens.find((entry) => entry.id === activeScreenId) ?? null;
    setScreenMediaUrlInput(fromRuntimeMediaUrl(screen?.mediaUrl ?? ""));
    setScreenAudioUrlInput(fromRuntimeMediaUrl(screen?.audioUrl ?? (screen?.audioOnly ? screen?.mediaUrl ?? "" : "")));
  }, [activeScreenId, screens]);

  const postToDockProvider = useCallback((payload: Record<string, unknown> | string) => {
    const target = mediaDockProviderFrameRef.current?.contentWindow;
    if (!target) return false;
    try {
      target.postMessage(payload, "*");
      return true;
    } catch {
      return false;
    }
  }, []);

  const primeDockProviderEvents = useCallback(() => {
    const runtime = mediaDockProviderRuntimeRef.current;
    if (!runtime.provider) return;
    if (runtime.provider === "youtube") {
      postToDockProvider(JSON.stringify({ event: "listening" }));
      postToDockProvider(JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] }));
      postToDockProvider(JSON.stringify({ event: "command", func: "addEventListener", args: ["onError"] }));
      return;
    }
    postToDockProvider({ method: "addEventListener", value: "play" });
    postToDockProvider({ method: "addEventListener", value: "pause" });
    postToDockProvider({ method: "addEventListener", value: "ended" });
    postToDockProvider({ method: "addEventListener", value: "volumechange" });
    postToDockProvider({ method: "addEventListener", value: "error" });
  }, [postToDockProvider]);

  const syncDockProviderState = useCallback(
    (force = false) => {
      const runtime = mediaDockProviderRuntimeRef.current;
      if (!runtime.ready || !runtime.provider || !runtime.screenId) return;
      const card = screensRef.current.find((entry) => entry.id === runtime.screenId);
      if (!card) return;
      const soloIds = collectSoloAudioScreenIds(screensRef.current);
      const hasSolo = soloIds.size > 0;
      const policyMute = hasSolo && !soloIds.has(card.id);
      const policyVolume = resolveAudioPolicyGain(normalizeAudioPolicy(card.audioPolicy), hasSolo);
      const shouldPlay = card.mediaPlaying;
      const shouldMute = card.mediaMuted || policyMute;

      if (force || runtime.appliedPlaying !== shouldPlay) {
        if (runtime.provider === "youtube") {
          postToDockProvider(
            JSON.stringify({
              event: "command",
              func: shouldPlay ? "playVideo" : "pauseVideo",
              args: [],
            })
          );
        } else {
          postToDockProvider({ method: shouldPlay ? "play" : "pause" });
        }
        runtime.appliedPlaying = shouldPlay;
      }

      if (force || runtime.appliedMuted !== shouldMute) {
        if (runtime.provider === "youtube") {
          postToDockProvider(
            JSON.stringify({
              event: "command",
              func: shouldMute ? "mute" : "unMute",
              args: [],
            })
          );
        } else {
          postToDockProvider({ method: "setVolume", value: shouldMute ? 0 : policyVolume });
        }
        runtime.appliedMuted = shouldMute;
      }
    },
    [postToDockProvider]
  );

  const handleDockProviderLoad = useCallback(() => {
    const runtime = mediaDockProviderRuntimeRef.current;
    if (!runtime.provider) return;
    runtime.ready = true;
    runtime.appliedPlaying = null;
    runtime.appliedMuted = null;
    primeDockProviderEvents();
    syncDockProviderState(true);
  }, [primeDockProviderEvents, syncDockProviderState]);

  useEffect(() => {
    const video = mediaDockVideoRef.current;
    if (!video) return;
    if (mediaDockMode !== "player") {
      if (video.dataset.mediaSrc) {
        lockMediaDockVideoEvents();
        video.pause();
        video.removeAttribute("src");
        video.load();
        delete video.dataset.mediaSrc;
      }
      return;
    }
    if (!activeScreen || !activeScreenDockVideoUrl) {
      if (video.dataset.mediaSrc) {
        lockMediaDockVideoEvents();
        video.pause();
        video.removeAttribute("src");
        video.load();
        delete video.dataset.mediaSrc;
      }
      return;
    }
    if (video.dataset.mediaSrc !== activeScreenDockVideoUrl) {
      lockMediaDockVideoEvents();
      video.dataset.mediaSrc = activeScreenDockVideoUrl;
      video.src = activeScreenDockVideoUrl;
      video.load();
    }
    if (mediaDockCollapsed) {
      lockMediaDockVideoEvents();
      video.pause();
      video.muted = true;
      video.volume = 0;
      return;
    }
    const soloIds = collectSoloAudioScreenIds(screens);
    const hasSolo = soloIds.size > 0;
    const policyMute = hasSolo && !soloIds.has(activeScreen.id);
    const policyVolume = resolveAudioPolicyGain(normalizeAudioPolicy(activeScreen.audioPolicy), hasSolo);
    const effectiveMuted = activeScreen.mediaMuted || policyMute;
    const effectiveVolume = effectiveMuted ? 0 : policyVolume;
    video.loop = activeScreen.mediaKind === "gif";
    video.crossOrigin = "anonymous";
    if (video.muted !== effectiveMuted) {
      lockMediaDockVideoEvents();
      video.muted = effectiveMuted;
    }
    if (Math.abs(video.volume - effectiveVolume) > 0.001) {
      lockMediaDockVideoEvents();
      video.volume = effectiveVolume;
    }
    if (activeScreen.mediaPlaying) {
      lockMediaDockVideoEvents();
      video.play().catch(() => {
        // Native controls offer retry play after user interaction.
      });
    } else {
      lockMediaDockVideoEvents();
      video.pause();
    }
  }, [
    activeScreen,
    activeScreen?.mediaKind,
    activeScreen?.mediaMuted,
    activeScreen?.mediaPlaying,
    activeScreenDockVideoUrl,
    mediaDockCollapsed,
    mediaDockMode,
    screens,
  ]);

  useEffect(() => {
    const runtime = mediaDockProviderRuntimeRef.current;
    const iframe = mediaDockProviderFrameRef.current;
    if (
      mediaDockMode !== "player" ||
      !showDockProviderPlayer ||
      !iframe ||
      !activeScreen ||
      !activeScreenDockProviderMeta ||
      !activeScreenDockProviderUrl
    ) {
      runtime.screenId = "";
      runtime.provider = null;
      runtime.embedBase = "";
      runtime.src = "";
      runtime.ready = false;
      runtime.appliedPlaying = null;
      runtime.appliedMuted = null;
      return;
    }
    if (mediaDockCollapsed) {
      return;
    }
    const nextSrc = activeScreenDockProviderUrl;
    const needsReload =
      runtime.screenId !== activeScreen.id ||
      runtime.provider !== activeScreenDockProviderMeta.provider ||
      runtime.embedBase !== activeScreenDockProviderMeta.embedBase ||
      runtime.src !== nextSrc ||
      iframe.getAttribute("src") !== nextSrc;
    if (!needsReload) return;
    runtime.screenId = activeScreen.id;
    runtime.provider = activeScreenDockProviderMeta.provider;
    runtime.embedBase = activeScreenDockProviderMeta.embedBase;
    runtime.src = nextSrc;
    runtime.ready = false;
    runtime.appliedPlaying = null;
    runtime.appliedMuted = null;
    iframe.src = nextSrc;
  }, [activeScreen, activeScreenDockProviderMeta, activeScreenDockProviderUrl, mediaDockCollapsed, mediaDockMode, showDockProviderPlayer]);

  useEffect(() => {
    if (mediaDockMode !== "player" || !showDockProviderPlayer || !activeScreenDockProviderMeta || mediaDockCollapsed) return;
    syncDockProviderState();
  }, [
    activeScreen?.id,
    activeScreen?.mediaPlaying,
    activeScreen?.mediaMuted,
    activeScreenDockProviderMeta,
    mediaDockCollapsed,
    mediaDockMode,
    showDockProviderPlayer,
    syncDockProviderState,
  ]);

  useEffect(() => {
    const parseDockProviderPayload = (raw: unknown): Record<string, unknown> | null => {
      if (isObjectRecord(raw)) return raw;
      if (typeof raw !== "string" || raw.length === 0) return null;
      try {
        const parsed = JSON.parse(raw) as unknown;
        return isObjectRecord(parsed) ? parsed : null;
      } catch {
        return null;
      }
    };

    const patchScreenPlayback = (screenId: string, patch: Partial<Pick<ScreenCard, "mediaPlaying" | "mediaMuted">>) => {
      let changed = false;
      setScreens((prev) => {
        const next = prev.map((entry) => {
          if (entry.id !== screenId) return entry;
          const merged = { ...entry, ...patch };
          if (merged.mediaPlaying !== entry.mediaPlaying || merged.mediaMuted !== entry.mediaMuted) {
            changed = true;
            return merged;
          }
          return entry;
        });
        return changed ? next : prev;
      });
      if (changed) {
        setPlaybackAuthority("dock");
      }
    };

    const onDockProviderMessage = (event: MessageEvent<unknown>) => {
      const iframeWindow = mediaDockProviderFrameRef.current?.contentWindow;
      if (!iframeWindow || event.source !== iframeWindow) return;
      const runtime = mediaDockProviderRuntimeRef.current;
      if (!runtime.provider || !runtime.screenId) return;
      if (!isTrustedProviderOrigin(runtime.provider, event.origin)) return;
      const payload = parseDockProviderPayload(event.data);
      if (!payload) return;

      if (!runtime.ready) {
        runtime.ready = true;
        primeDockProviderEvents();
        syncDockProviderState(true);
      }

      if (runtime.provider === "youtube") {
        const eventName = typeof payload.event === "string" ? payload.event : "";
        if (eventName === "onStateChange") {
          const info = typeof payload.info === "number" ? payload.info : null;
          if (info === 1 || info === 3) {
            patchScreenPlayback(runtime.screenId, { mediaPlaying: true });
          } else if (info === 2 || info === 0) {
            patchScreenPlayback(runtime.screenId, { mediaPlaying: false });
          }
          return;
        }
        if (eventName === "infoDelivery") {
          const info = isObjectRecord(payload.info) ? payload.info : null;
          if (!info) return;
          if (typeof info.playerState === "number") {
            if (info.playerState === 1 || info.playerState === 3) {
              patchScreenPlayback(runtime.screenId, { mediaPlaying: true });
            } else if (info.playerState === 2 || info.playerState === 0) {
              patchScreenPlayback(runtime.screenId, { mediaPlaying: false });
            }
          }
          if (typeof info.muted === "boolean") {
            patchScreenPlayback(runtime.screenId, { mediaMuted: info.muted });
          }
          return;
        }
        if (eventName === "onError") {
          setScreenStatusMessage(runtime.screenId, "Dock provider playback error.");
        }
        return;
      }

      const eventName = typeof payload.event === "string" ? payload.event : "";
      if (eventName === "play") {
        patchScreenPlayback(runtime.screenId, { mediaPlaying: true });
        return;
      }
      if (eventName === "pause" || eventName === "ended") {
        patchScreenPlayback(runtime.screenId, { mediaPlaying: false });
        return;
      }
      if (eventName === "volumechange") {
        const data = isObjectRecord(payload.data) ? payload.data : null;
        if (data && typeof data.volume === "number") {
          patchScreenPlayback(runtime.screenId, { mediaMuted: data.volume <= 0.001 });
        }
        return;
      }
      if (eventName === "error") {
        setScreenStatusMessage(runtime.screenId, "Dock provider playback error.");
      }
    };

    window.addEventListener("message", onDockProviderMessage);
    return () => {
      window.removeEventListener("message", onDockProviderMessage);
    };
  }, [primeDockProviderEvents, setScreenStatusMessage, syncDockProviderState]);

  useEffect(() => {
    const validIds = new Set(screens.map((entry) => entry.id));
    setScreenStatusById((prev) => {
      let changed = false;
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([id, message]) => {
        if (validIds.has(id)) {
          next[id] = message;
          return;
        }
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [screens]);

  useEffect(() => {
    const validIds = new Set(screens.map((entry) => entry.id));
    setScreenMediaHasAudioById((prev) => {
      let changed = false;
      const next: Record<string, boolean> = {};
      Object.entries(prev).forEach(([id, hasAudio]) => {
        if (validIds.has(id)) {
          next[id] = hasAudio;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    const resolutionMap = screenMediaResolutionRef.current;
    let resolutionChanged = false;
    const nextResolutionMap: Record<string, string> = {};
    Object.entries(resolutionMap).forEach(([id, resolution]) => {
      if (validIds.has(id)) {
        nextResolutionMap[id] = resolution;
      } else {
        resolutionChanged = true;
      }
    });
    if (resolutionChanged) {
      screenMediaResolutionRef.current = nextResolutionMap;
      setScreenMediaResolutionById(nextResolutionMap);
    }
    const mediaTimeMap = screenMediaTimeRef.current;
    Array.from(mediaTimeMap.keys()).forEach((id) => {
      if (!validIds.has(id)) {
        mediaTimeMap.delete(id);
      }
    });
  }, [screens]);

  useEffect(() => {
    const audioMap = screenAudioMapRef.current;
    const validIds = new Set(screens.map((entry) => entry.id));
    const soloAudioIds = collectSoloAudioScreenIds(screens);
    const hasSolo = soloAudioIds.size > 0;

    audioMap.forEach((runtime, id) => {
      if (validIds.has(id)) return;
      runtime.audio.pause();
      runtime.audio.src = "";
      audioMap.delete(id);
    });

    screens.forEach((card) => {
      const policy = normalizeAudioPolicy(card.audioPolicy);
      const policyMute = hasSolo && !soloAudioIds.has(card.id);
      const policyVolume = resolveAudioPolicyGain(policy, hasSolo);
      const runtime = audioMap.get(card.id);
      if (!card.audioUrl) {
        if (runtime) {
          runtime.audio.pause();
          runtime.audio.src = "";
          audioMap.delete(card.id);
        }
        return;
      }

      let activeRuntime = runtime;
      if (!activeRuntime || activeRuntime.src !== card.audioUrl) {
        if (activeRuntime) {
          activeRuntime.audio.pause();
          activeRuntime.audio.src = "";
        }
        const audio = new Audio(card.audioUrl);
        audio.preload = "auto";
        audio.loop = true;
        audio.oncanplay = () => {
          setScreenStatusMessage(card.id, "");
        };
        audio.onerror = () => {
          setScreenStatusMessage(card.id, "Audio failed to load. Try another source.");
        };
        activeRuntime = { audio, src: card.audioUrl };
        audioMap.set(card.id, activeRuntime);
      }

      activeRuntime.audio.muted = policyMute;
      activeRuntime.audio.volume = policyMute ? 0 : policyVolume;

      if (card.audioPlaying) {
        activeRuntime.audio.play().catch(() => {
          setScreenStatusMessage(card.id, "Audio playback blocked until user interaction.");
        });
      } else {
        activeRuntime.audio.pause();
      }
    });
  }, [screens]);

  useEffect(() => {
    environmentModeRef.current = environmentMode;
  }, [environmentMode]);

  useEffect(() => {
    environmentObjectImpactRef.current = environmentObjectImpact;
  }, [environmentObjectImpact]);

  useEffect(() => {
    if (!environmentAutoHdri) return;
    const profile = (ENVIRONMENT_MODE_CONFIG[environmentMode] ?? ENVIRONMENT_MODE_CONFIG.core).hdri;
    selectHdriPreset(profile.preset);
    setHdriIntensity(profile.intensity);
    setHdriRotation(profile.rotation);
    setHdriBlur(profile.blur);
    setHdriExposure(profile.exposure);
    setHdriBackground(profile.background);
  }, [environmentMode, environmentAutoHdri]);

  useEffect(() => {
    if (SERVER_MEDIA_MODE_FULL || SERVER_MEDIA_MODE_SAFE) return;
    if (isLocalSceneShell) {
      setServerMediaAvailable(false);
      setServerMediaProbeDone(true);
      return;
    }
    let cancelled = false;
    const detect = async () => {
      let available = false;
      try {
        const response = await fetch("/api/resolve-media", {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });
        const contentType = response.headers.get("content-type") || "";
        let body = "";
        try {
          body = await response.text();
        } catch {
          body = "";
        }
        const trimmed = body.trim();
        const looksJson = contentType.includes("application/json") || trimmed.startsWith("{");
        if (looksJson) {
          available = response.status === 400 || response.status === 403 || response.status === 405 || response.status === 200;
        }
      } catch {
        available = false;
      }
      if (cancelled) return;
      setServerMediaAvailable(available);
      setServerMediaProbeDone(true);
    };
    void detect();
    return () => {
      cancelled = true;
    };
  }, [isLocalSceneShell]);

  useEffect(() => {
    if (!serverMediaProbeDone || serverMediaEnabled) return;
    setPreferIntegratedProvider(false);
    setScreens((prev) => {
      let changed = false;
      const next = prev.map((entry) => {
        if (entry.sourceMode !== "integrated") return entry;
        changed = true;
        return {
          ...entry,
          sourceMode: "provider",
        };
      });
      return changed ? next : prev;
    });
  }, [serverMediaEnabled, serverMediaProbeDone]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = panelDragRef.current;
      if (!drag.active) return;
      const next = clampPanelToViewport(event.clientX - drag.offsetX, event.clientY - drag.offsetY);
      setPanelPosition(next);
    };
    const endDrag = (event: PointerEvent) => {
      const drag = panelDragRef.current;
      if (!drag.active) return;
      if (drag.pointerId !== -1 && event.pointerId !== drag.pointerId) return;
      drag.active = false;
      drag.pointerId = -1;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [panelMinimized]);

  useEffect(() => {
    const clampNow = () => {
      setPanelPosition((prev) => clampPanelToViewport(prev.x, prev.y));
    };
    clampNow();
    window.addEventListener("resize", clampNow);
    return () => {
      window.removeEventListener("resize", clampNow);
    };
  }, [panelMinimized]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PANEL_POSITION_STORAGE_KEY, JSON.stringify(panelPosition));
    } catch {
      // Ignore storage failures in private mode or blocked storage contexts.
    }
  }, [panelPosition]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MEDIA_UI_STORAGE_KEY,
        JSON.stringify({
          dockMode: mediaDockMode,
          providerScreenPrimary,
          preferIntegratedProvider,
          contextFocus,
          advancedPanelVisible,
          autoEntityTab,
          inspectorLock,
          autoFitMediaAspect,
          mediaFidelity,
          performanceTier,
          screenAttachmentMode,
          lightFollowPoint,
        })
      );
    } catch {
      // Ignore storage failures in private mode or blocked storage contexts.
    }
  }, [
    mediaDockMode,
    providerScreenPrimary,
    preferIntegratedProvider,
    contextFocus,
    advancedPanelVisible,
    autoEntityTab,
    inspectorLock,
    autoFitMediaAspect,
    mediaFidelity,
    performanceTier,
    screenAttachmentMode,
    lightFollowPoint,
  ]);

  useEffect(() => {
    cameraFovOffsetRef.current = cameraFovOffset;
  }, [cameraFovOffset]);

  useEffect(() => {
    cameraDampingRef.current = cameraDamping;
    if (controlsRef.current) {
      controlsRef.current.dampingFactor = cameraDamping;
    }
  }, [cameraDamping]);

  useEffect(() => {
    cameraOrbitSpeedRef.current = cameraOrbitSpeed;
    if (controlsRef.current) {
      controlsRef.current.autoRotateSpeed = cameraOrbitSpeed;
      controlsRef.current.rotateSpeed = 0.2 + cameraOrbitSpeed * 1.7;
      controlsRef.current.zoomSpeed = 0.25 + cameraOrbitSpeed * 0.55;
    }
  }, [cameraOrbitSpeed]);

  useEffect(() => {
    cameraNearRef.current = cameraNear;
    const controls = controlsRef.current;
    if (!controls) return;
    const camera = controls.object as THREE.PerspectiveCamera;
    camera.near = cameraNear;
    camera.updateProjectionMatrix();
  }, [cameraNear]);

  useEffect(() => {
    cameraFarRef.current = cameraFar;
    const controls = controlsRef.current;
    if (!controls) return;
    const camera = controls.object as THREE.PerspectiveCamera;
    camera.far = cameraFar;
    camera.updateProjectionMatrix();
  }, [cameraFar]);

  useEffect(() => {
    hdriPresetRef.current = hdriPreset;
    if (hdriPreset === "off") {
      setHdriName("None");
    } else if (hdriPreset === "custom") {
      setHdriName(hdriCustomNameRef.current || "Custom HDRI");
    } else {
      setHdriName(HDRI_PRESETS[hdriPreset].label);
    }
    applyHdriRef.current?.();
  }, [hdriPreset]);

  useEffect(() => {
    hdriIntensityRef.current = hdriIntensity;
  }, [hdriIntensity]);

  useEffect(() => {
    hdriRotationRef.current = hdriRotation;
  }, [hdriRotation]);

  useEffect(() => {
    hdriBackgroundRef.current = hdriBackground;
  }, [hdriBackground]);

  useEffect(() => {
    hdriBlurRef.current = hdriBlur;
  }, [hdriBlur]);

  useEffect(() => {
    hdriExposureRef.current = hdriExposure;
  }, [hdriExposure]);

  useEffect(() => {
    compareSlotsRef.current = compareSlots;
    try {
      localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(compareSlots));
    } catch (error) {
      console.error("Failed to persist compare slots", error);
    }
  }, [compareSlots]);

  useEffect(() => {
    lightPaintPointsRef.current = lightPaintPoints;
    if (lightPaintPoints.length < 2 && lightPaintPlaying) {
      setLightPaintPlaying(false);
    }
  }, [lightPaintPoints]);

  useEffect(() => {
    lightPaintPlayingRef.current = lightPaintPlaying;
    if (lightPaintPlaying) return;
    lightPaintPlayheadRef.current = 0;
    setLightPaintProgress(0);
  }, [lightPaintPlaying]);

  useEffect(() => {
    lightPaintLoopRef.current = lightPaintLoop;
  }, [lightPaintLoop]);

  useEffect(() => {
    lightPaintSpeedRef.current = lightPaintSpeed;
  }, [lightPaintSpeed]);

  useEffect(() => {
    lightPaintTargetRef.current = lightPaintTarget;
  }, [lightPaintTarget]);

  useEffect(() => {
    gizmoSnapEnabledRef.current = gizmoSnapEnabled;
  }, [gizmoSnapEnabled]);

  useEffect(() => {
    gizmoSnapGridRef.current = THREE.MathUtils.clamp(gizmoSnapGrid, 0.01, 1);
  }, [gizmoSnapGrid]);

  useEffect(() => {
    gizmoSnapAngleRef.current = THREE.MathUtils.clamp(gizmoSnapAngle, 1, 45);
  }, [gizmoSnapAngle]);

  useEffect(() => {
    if (lightPaintMode) return;
    setLightPaintPlaying(false);
  }, [lightPaintMode]);

  useEffect(() => {
    if (!shotLinkedRigs || applyingShotRigRef.current) return;
    const rig = captureRigState();
    setShotRigMap((prev) => {
      const existing = prev[shot];
      if (existing && JSON.stringify(existing) === JSON.stringify(rig)) {
        return prev;
      }
      return {
        ...prev,
        [shot]: rig,
      };
    });
  }, [
    shotLinkedRigs,
    shot,
    lightAnchorMode,
    worldAnchorX,
    worldAnchorY,
    worldAnchorZ,
    keyAzimuth,
    keyElevation,
    keyDistance,
    fillAzimuth,
    fillElevation,
    fillDistance,
    keyOffsetX,
    keyOffsetY,
    keyOffsetZ,
    fillOffsetX,
    fillOffsetY,
    fillOffsetZ,
    keyColor,
    keyIntensity,
    fillColor,
    fillIntensity,
    hideLightSource,
  ]);

  useEffect(() => {
    hideLightSourceRef.current = hideLightSource;
    if (fillLightRef.current) {
      fillLightRef.current.visible = !hideLightSource;
      fillLightRef.current.intensity = hideLightSource ? 0 : fillIntensityRef.current * lightGainRef.current;
    }
    if (softFillRef.current) {
      softFillRef.current.intensity = hideLightSource
        ? fillIntensityRef.current * softFillBoost(lightSoftnessRef.current) * lightGainRef.current
        : 0;
    }
  }, [hideLightSource]);

  useEffect(() => {
    lightGainRef.current = lightGain;
    if (keyLightRef.current) {
      keyLightRef.current.intensity = keyIntensityRef.current * lightGain;
    }
    if (fillLightRef.current) {
      fillLightRef.current.intensity = hideLightSourceRef.current ? 0 : fillIntensityRef.current * lightGain;
    }
    if (softFillRef.current) {
      softFillRef.current.intensity = hideLightSourceRef.current
        ? fillIntensityRef.current * softFillBoost(lightSoftnessRef.current) * lightGain
        : 0;
    }
  }, [lightGain]);

  useEffect(() => {
    lightSoftnessRef.current = lightSoftness;
    if (softFillRef.current) {
      softFillRef.current.intensity = hideLightSourceRef.current
        ? fillIntensityRef.current * softFillBoost(lightSoftness) * lightGainRef.current
        : 0;
    }
  }, [lightSoftness]);

  useEffect(() => {
    floorModeRef.current = floorMode;
    const gloss = THREE.MathUtils.clamp(groundGlossRef.current, 0, 1);
    const floor = floorRef.current;
    const rings = ringGroupRef.current;
    const fogGroup = fogGroupRef.current;
    const shadow = contactShadowRef.current;
    const floorMat = floorMatRef.current;
    if (!floor || !rings || !fogGroup || !shadow || !floorMat) return;
    const isNone = floorMode === "none";
    floor.visible = !isNone;
    rings.visible = floorMode === "topo" || floorMode === "scan";
    fogGroup.visible = floorMode === "topo" || floorMode === "scan";
    shadow.visible = !isNone;
    if (floorMode === "grid") {
      if (floorGridTextureRef.current) {
        floorMat.map = floorGridTextureRef.current;
        floorGridTextureRef.current.offset.set(0, 0);
      }
      floorMat.roughness = THREE.MathUtils.lerp(0.88, 0.3, gloss);
      floorMat.metalness = THREE.MathUtils.lerp(0.04, 0.34, gloss);
      floorMat.emissive.set("#000000");
      floorMat.emissiveIntensity = 0;
    } else if (floorMode === "pulse") {
      floorMat.map = null;
      floorMat.roughness = THREE.MathUtils.lerp(0.66, 0.2, gloss);
      floorMat.metalness = THREE.MathUtils.lerp(0.12, 0.46, gloss);
      floorMat.emissive.set("#6ea0ff");
      floorMat.emissiveIntensity = 0.24;
    } else if (floorMode === "scan") {
      if (floorGridTextureRef.current) {
        floorMat.map = floorGridTextureRef.current;
        floorGridTextureRef.current.offset.set(0, 0);
      }
      floorMat.roughness = THREE.MathUtils.lerp(0.52, 0.16, gloss);
      floorMat.metalness = THREE.MathUtils.lerp(0.18, 0.52, gloss);
      floorMat.emissive.set(fillColorRef.current);
      floorMat.emissiveIntensity = 0.34;
    } else {
      floorMat.map = null;
      if (floorGridTextureRef.current) {
        floorGridTextureRef.current.offset.set(0, 0);
      }
      floorMat.roughness = THREE.MathUtils.lerp(0.9, 0.24, gloss);
      floorMat.metalness = THREE.MathUtils.lerp(0.04, 0.48, gloss);
      floorMat.emissive.set("#000000");
      floorMat.emissiveIntensity = 0;
    }
    floorMat.clearcoat = THREE.MathUtils.lerp(0.05, 0.85, gloss);
    floorMat.reflectivity = THREE.MathUtils.lerp(0.08, 0.92, gloss);
    floorMat.needsUpdate = true;
  }, [floorMode]);

  useEffect(() => {
    groundGlossRef.current = groundGloss;
    const floorMat = floorMatRef.current;
    if (!floorMat) return;
    const gloss = THREE.MathUtils.clamp(groundGloss, 0, 1);
    const mode = floorModeRef.current;
    if (mode === "grid") {
      floorMat.roughness = THREE.MathUtils.lerp(0.88, 0.3, gloss);
      floorMat.metalness = THREE.MathUtils.lerp(0.04, 0.34, gloss);
    } else if (mode === "pulse") {
      floorMat.roughness = THREE.MathUtils.lerp(0.66, 0.2, gloss);
      floorMat.metalness = THREE.MathUtils.lerp(0.12, 0.46, gloss);
    } else if (mode === "scan") {
      floorMat.roughness = THREE.MathUtils.lerp(0.52, 0.16, gloss);
      floorMat.metalness = THREE.MathUtils.lerp(0.18, 0.52, gloss);
    } else {
      floorMat.roughness = THREE.MathUtils.lerp(0.9, 0.24, gloss);
      floorMat.metalness = THREE.MathUtils.lerp(0.04, 0.48, gloss);
    }
    floorMat.clearcoat = THREE.MathUtils.lerp(0.05, 0.85, gloss);
    floorMat.reflectivity = THREE.MathUtils.lerp(0.08, 0.92, gloss);
    floorMat.needsUpdate = true;
  }, [groundGloss]);

  useEffect(() => {
    groundMotionRef.current = groundMotion;
  }, [groundMotion]);

  useEffect(() => {
    particleStyleRef.current = particleStyle;
    if (particleMatRef.current) {
      if (particleStyle === "embers") {
        particleMatRef.current.color.set("#ff7a4a");
      } else if (particleStyle === "snow") {
        particleMatRef.current.color.set("#dce9ff");
      } else {
        particleMatRef.current.color.set(PRESETS[preset].fogColor);
      }
    }
    if (glyphMatRef.current) {
      if (particleStyle === "glyphs" || secondaryParticleStyle === "glyphs") {
        glyphMatRef.current.color.set("#dce9ff");
      } else {
        glyphMatRef.current.color.set(PRESETS[preset].fogColor);
      }
    }
  }, [particleStyle, secondaryParticleStyle, preset]);

  useEffect(() => {
    secondaryParticleStyleRef.current = secondaryParticleStyle;
  }, [secondaryParticleStyle]);

  useEffect(() => {
    effectBlendRef.current = effectBlend;
  }, [effectBlend]);

  useEffect(() => {
    effectAmountRef.current = effectAmount;
  }, [effectAmount]);

  useEffect(() => {
    effectSpeedRef.current = effectSpeed;
  }, [effectSpeed]);

  useEffect(() => {
    effectScaleRef.current = effectScale;
  }, [effectScale]);

  useEffect(() => {
    effectSpreadRef.current = effectSpread;
  }, [effectSpread]);

  useEffect(() => {
    orbitCenterLiftRef.current = orbitCenterLift;
  }, [orbitCenterLift]);

  useEffect(() => {
    captureFormatRef.current = captureFormat;
  }, [captureFormat]);

  useEffect(() => {
    timelineFramesRef.current = timelineFrames;
  }, [timelineFrames]);

  useEffect(() => {
    if (timelineFrames.length < 2 && timelinePlaying) {
      setTimelinePlaying(false);
    }
    if (selectedFrameId && !timelineFrames.some((frame) => frame.id === selectedFrameId)) {
      setSelectedFrameId(timelineFrames[0]?.id ?? "");
    }
  }, [timelineFrames, timelinePlaying, selectedFrameId]);

  useEffect(() => {
    timelineCursorRef.current = timelineCursor;
  }, [timelineCursor]);

  useEffect(() => {
    timelineDurationRef.current = timelineDuration;
  }, [timelineDuration]);

  useEffect(() => {
    timelineLoopRef.current = timelineLoop;
  }, [timelineLoop]);

  useEffect(() => {
    timelinePlayingRef.current = timelinePlaying;
    if (!timelinePlaying && wasTimelinePlayingRef.current) {
      applyTimelineAt(timelineCursorRef.current, true);
    }
    wasTimelinePlayingRef.current = timelinePlaying;
  }, [timelinePlaying]);

  useEffect(() => {
    if (!timelinePlaying) {
      timelineLastTsRef.current = 0;
      if (timelineRafRef.current) {
        cancelAnimationFrame(timelineRafRef.current);
        timelineRafRef.current = null;
      }
      return;
    }
    const tick = (ts: number) => {
      if (!timelinePlayingRef.current) return;
      if (!timelineLastTsRef.current) {
        timelineLastTsRef.current = ts;
      }
      const dt = (ts - timelineLastTsRef.current) / 1000;
      timelineLastTsRef.current = ts;
      const duration = Math.max(0.2, timelineDurationRef.current);
      let nextCursor = timelineCursorRef.current + dt / duration;
      if (nextCursor >= 1) {
        if (timelineLoopRef.current) {
          nextCursor %= 1;
        } else {
          nextCursor = 1;
          setTimelinePlaying(false);
        }
      }
      timelineCursorRef.current = nextCursor;
      setTimelineCursor(nextCursor);
      applyTimelineAt(nextCursor, false);
      timelineRafRef.current = requestAnimationFrame(tick);
    };
    timelineRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (timelineRafRef.current) {
        cancelAnimationFrame(timelineRafRef.current);
        timelineRafRef.current = null;
      }
    };
  }, [timelinePlaying]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedScenePreset[];
      if (!Array.isArray(parsed)) return;
      const cleaned = parsed
        .filter((item) => item && typeof item.id === "string" && typeof item.name === "string" && item.settings)
        .slice(0, 30);
      setSavedPresets(cleaned);
      if (cleaned[0]) {
        setSelectedPresetId(cleaned[0].id);
      }
    } catch (error) {
      console.error("Failed to load saved presets", error);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COMPARE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<CompareSlotKey, SceneSettings | null>;
      if (!parsed || typeof parsed !== "object") return;
      setCompareSlots({
        a: parsed.a ?? null,
        b: parsed.b ?? null,
        c: parsed.c ?? null,
      });
    } catch (error) {
      console.error("Failed to load compare slots", error);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(API_MACROS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      const cleaned = normalizeProfileMacros(parsed);
      setApiMacros(cleaned);
      setSelectedApiMacroId(cleaned[0]?.id ?? "");
    } catch (error) {
      console.error("Failed to load API macros", error);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(API_TEMPLATE_VARS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      const cleaned = normalizeProfileTemplateVars(parsed);
      setApiTemplateVars(cleaned);
    } catch (error) {
      console.error("Failed to load API template vars", error);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(API_SEQUENCES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      const cleaned = normalizeProfileSequences(parsed);
      setApiSequences(cleaned);
      setSelectedApiSequenceId(cleaned[0]?.id ?? "");
      setApiSequenceNameInput(cleaned[0]?.name ?? "");
    } catch (error) {
      console.error("Failed to load API sequences", error);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(API_HISTORY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const cleaned = parsed
        .map((entry) => {
          if (!isObjectRecord(entry)) return null;
          if (
            typeof entry.id !== "string" ||
            typeof entry.command !== "string" ||
            !toSceneApiCommandName(entry.command) ||
            typeof entry.ts !== "number"
          ) {
            return null;
          }
          return {
            id: entry.id,
            ts: entry.ts,
            command: entry.command,
            payloadText: typeof entry.payloadText === "string" ? entry.payloadText : "{}",
            resolvedPayloadText: typeof entry.resolvedPayloadText === "string" ? entry.resolvedPayloadText : "{}",
            source:
              entry.source === "manual" || entry.source === "macro" || entry.source === "sequence" || entry.source === "replay"
                ? entry.source
                : "manual",
            context: typeof entry.context === "string" ? entry.context : "",
            ok: entry.ok === true,
            attempts: typeof entry.attempts === "number" ? entry.attempts : 1,
            summary: typeof entry.summary === "string" ? entry.summary : "",
          } as SceneApiCommandHistoryEntry;
        })
        .filter((entry): entry is SceneApiCommandHistoryEntry => Boolean(entry))
        .slice(-150);
      setApiCommandHistory(cleaned);
    } catch (error) {
      console.error("Failed to load API command history", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(savedPresets));
    } catch (error) {
      console.error("Failed to save presets", error);
    }
  }, [savedPresets]);

  useEffect(() => {
    try {
      localStorage.setItem(API_MACROS_STORAGE_KEY, JSON.stringify(apiMacros));
    } catch (error) {
      console.error("Failed to save API macros", error);
    }
  }, [apiMacros]);

  useEffect(() => {
    try {
      localStorage.setItem(API_TEMPLATE_VARS_STORAGE_KEY, JSON.stringify(apiTemplateVars));
    } catch (error) {
      console.error("Failed to save API template vars", error);
    }
  }, [apiTemplateVars]);

  useEffect(() => {
    try {
      localStorage.setItem(API_SEQUENCES_STORAGE_KEY, JSON.stringify(apiSequences));
    } catch (error) {
      console.error("Failed to save API sequences", error);
    }
  }, [apiSequences]);

  useEffect(() => {
    try {
      localStorage.setItem(API_HISTORY_STORAGE_KEY, JSON.stringify(apiCommandHistory.slice(-150)));
    } catch (error) {
      console.error("Failed to save API command history", error);
    }
  }, [apiCommandHistory]);

  useEffect(() => {
    const selected = apiSequences.find((entry) => entry.id === selectedApiSequenceId) ?? null;
    if (!selected) {
      if (selectedApiSequenceId) {
        setSelectedApiSequenceId("");
      }
      if (apiSequenceNameInput) {
        setApiSequenceNameInput("");
      }
      return;
    }
    if (apiSequenceNameInput !== selected.name) {
      setApiSequenceNameInput(selected.name);
    }
  }, [apiSequences, selectedApiSequenceId, apiSequenceNameInput]);

  const settingsSignature = JSON.stringify(readCurrentSettings());

  useEffect(() => {
    const current = readCurrentSettings();
    latestSettingsRef.current = current;
    if (sceneApiStateVersionRef.current === 0) {
      sceneApiStateVersionRef.current = 1;
      sceneApiLastSignatureRef.current = settingsSignature;
    } else if (settingsSignature !== sceneApiLastSignatureRef.current) {
      sceneApiStateVersionRef.current += 1;
      sceneApiLastSignatureRef.current = settingsSignature;
      emitSceneApiEvent("stateChanged", {
        stateVersion: sceneApiStateVersionRef.current,
        state: current,
      });
    }
    if (!historyReadyRef.current) {
      historyReadyRef.current = true;
      historyLastRef.current = current;
      historySigRef.current = settingsSignature;
      return;
    }
    if (historySuspendRef.current) {
      historyLastRef.current = current;
      historySigRef.current = settingsSignature;
      return;
    }
    if (settingsSignature === historySigRef.current) {
      return;
    }
    if (historyLastRef.current) {
      setUndoStack((prev) => [...prev.slice(-(HISTORY_LIMIT - 1)), historyLastRef.current as SceneSettings]);
      setRedoStack([]);
    }
    historyLastRef.current = current;
    historySigRef.current = settingsSignature;
  }, [settingsSignature]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      const raw = event.data;
      if (!isObjectRecord(raw)) return;
      if (raw.channel !== SCENE_API_CHANNEL || raw.kind !== "command") return;

      const sourceWindow =
        event.source && typeof (event.source as Window).postMessage === "function" ? (event.source as Window) : undefined;
      const origin = typeof event.origin === "string" ? event.origin : "";
      const requestId = typeof raw.requestId === "string" && raw.requestId.length > 0 ? raw.requestId : createSceneApiId();
      const rawName = typeof raw.name === "string" ? raw.name : "unknown";
      const respondInline = (ok: boolean, result: unknown, error: SceneApiError | null) => {
        const response: SceneApiResponseMessage = {
          channel: SCENE_API_CHANNEL,
          sessionId: sceneApiSessionIdRef.current,
          apiVersion: SCENE_API_VERSION,
          kind: "response",
          domain: "scene",
          name: rawName,
          requestId,
          ts: Date.now(),
          origin: "scene",
          ok,
          result,
          error,
          stateVersion: sceneApiStateVersionRef.current,
        };
        postSceneApiMessage(sourceWindow, origin, response);
      };

      if (!isSceneApiOriginAllowed(origin)) {
        respondInline(false, null, buildSceneApiError("UNAUTHORIZED_ORIGIN", "Origin is not allowed", { origin }));
        return;
      }

      const commandName = toSceneApiCommandName(raw.name);
      if (!commandName) {
        respondInline(
          false,
          null,
          buildSceneApiError("UNSUPPORTED_COMMAND", "Unsupported command", {
            command: raw.name,
          })
        );
        return;
      }

      const incomingSessionId = typeof raw.sessionId === "string" ? raw.sessionId : "";
      if (commandName !== "hello" && incomingSessionId !== sceneApiSessionIdRef.current) {
        respondInline(
          false,
          null,
          buildSceneApiError("VALIDATION_FAILED", "Invalid sessionId", {
            provided: incomingSessionId,
            expected: sceneApiSessionIdRef.current,
          })
        );
        return;
      }

      if (commandName === "hello") {
        registerSceneApiClient(origin, sourceWindow);
      }

      const expectedStateVersion = asFiniteNumber(raw.expectedStateVersion);
      const timeoutMs = asFiniteNumber(raw.timeoutMs);
      const idempotencyKey = typeof raw.idempotencyKey === "string" ? raw.idempotencyKey : undefined;
      const command: SceneApiCommandMessage = {
        channel: SCENE_API_CHANNEL,
        sessionId: incomingSessionId || sceneApiSessionIdRef.current,
        apiVersion: typeof raw.apiVersion === "string" ? raw.apiVersion : SCENE_API_VERSION,
        kind: "command",
        domain: "scene",
        name: commandName,
        requestId,
        ts: Date.now(),
        origin: "host",
        payload: raw.payload,
        ...(typeof idempotencyKey === "string" && idempotencyKey.length > 0 ? { idempotencyKey } : {}),
        ...(expectedStateVersion !== null ? { expectedStateVersion } : {}),
        ...(timeoutMs !== null ? { timeoutMs } : {}),
      };

      const handler = sceneApiHandleCommandRef.current;
      if (!handler) {
        respondInline(false, null, buildSceneApiError("INTERNAL_ERROR", "Scene API handler is not ready", {}, true));
        return;
      }

      const clampedTimeoutMs =
        typeof command.timeoutMs === "number" ? THREE.MathUtils.clamp(command.timeoutMs, 250, 120_000) : null;
      const commandPromise = handler(command, { source: "postMessage", origin, sourceWindow });
      const responsePromise =
        clampedTimeoutMs === null
          ? commandPromise
          : Promise.race<SceneApiResponseMessage>([
              commandPromise,
              new Promise<SceneApiResponseMessage>((resolve) => {
                window.setTimeout(() => {
                  resolve(
                    createSceneApiResponse(
                      command,
                      false,
                      null,
                      buildSceneApiError(
                        "TIMEOUT",
                        "Command timed out",
                        {
                          timeoutMs: clampedTimeoutMs,
                        },
                        true
                      )
                    )
                  );
                }, clampedTimeoutMs);
              }),
            ]);

      void responsePromise
        .then((response) => {
          postSceneApiMessage(sourceWindow, origin, response);
        })
        .catch((error) => {
          respondInline(
            false,
            null,
            buildSceneApiError("INTERNAL_ERROR", "Failed to process command", {
              reason: error instanceof Error ? error.message : String(error),
            })
          );
        });
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  useEffect(() => {
    const buildBridgeError = (
      name: string,
      requestId: string,
      error: SceneApiError
    ): SceneApiResponseMessage => ({
      channel: SCENE_API_CHANNEL,
      sessionId: sceneApiSessionIdRef.current,
      apiVersion: SCENE_API_VERSION,
      kind: "response",
      domain: "scene",
      name,
      requestId,
      ts: Date.now(),
      origin: "scene",
      ok: false,
      result: null,
      error,
      stateVersion: sceneApiStateVersionRef.current,
    });

    const bridge: SceneApiWindowBridge = {
      channel: SCENE_API_CHANNEL,
      apiVersion: SCENE_API_VERSION,
      getSessionId: () => sceneApiSessionIdRef.current,
      hello: async (requestedVersion?: string) => {
        const requestId = createSceneApiId();
        const handler = sceneApiHandleCommandRef.current;
        if (!handler) {
          return buildBridgeError("hello", requestId, buildSceneApiError("INTERNAL_ERROR", "Scene API is not ready", {}, true));
        }
        const command: SceneApiCommandMessage = {
          channel: SCENE_API_CHANNEL,
          sessionId: sceneApiSessionIdRef.current,
          apiVersion: SCENE_API_VERSION,
          kind: "command",
          domain: "scene",
          name: "hello",
          requestId,
          ts: Date.now(),
          origin: "host",
          payload: {
            requestedVersion: requestedVersion ?? SCENE_API_VERSION,
          },
        };
        const commandPromise = handler(command, {
          source: "window",
          origin: window.location.origin,
        });
        const clampedTimeoutMs =
          typeof command.timeoutMs === "number" ? THREE.MathUtils.clamp(command.timeoutMs, 250, 120_000) : null;
        if (clampedTimeoutMs === null) {
          return commandPromise;
        }
        return Promise.race<SceneApiResponseMessage>([
          commandPromise,
          new Promise<SceneApiResponseMessage>((resolve) => {
            window.setTimeout(() => {
              resolve(
                buildBridgeError(
                  commandName,
                  requestId,
                  buildSceneApiError(
                    "TIMEOUT",
                    "Command timed out",
                    {
                      timeoutMs: clampedTimeoutMs,
                    },
                    true
                  )
                )
              );
            }, clampedTimeoutMs);
          }),
        ]);
      },
      send: async (incoming: Partial<SceneApiCommandMessage>) => {
        const requestId = typeof incoming.requestId === "string" && incoming.requestId.length > 0 ? incoming.requestId : createSceneApiId();
        const commandName = toSceneApiCommandName(incoming.name);
        if (!commandName) {
          return buildBridgeError(
            typeof incoming.name === "string" ? incoming.name : "unknown",
            requestId,
            buildSceneApiError("UNSUPPORTED_COMMAND", "Unsupported command", {
              command: incoming.name,
            })
          );
        }
        const handler = sceneApiHandleCommandRef.current;
        if (!handler) {
          return buildBridgeError(commandName, requestId, buildSceneApiError("INTERNAL_ERROR", "Scene API is not ready", {}, true));
        }
        const command: SceneApiCommandMessage = {
          channel: SCENE_API_CHANNEL,
          sessionId: sceneApiSessionIdRef.current,
          apiVersion: SCENE_API_VERSION,
          kind: "command",
          domain: "scene",
          name: commandName,
          requestId,
          ts: Date.now(),
          origin: "host",
          payload: incoming.payload,
          ...(typeof incoming.idempotencyKey === "string" && incoming.idempotencyKey.length > 0 ? { idempotencyKey: incoming.idempotencyKey } : {}),
          ...(typeof incoming.expectedStateVersion === "number" ? { expectedStateVersion: incoming.expectedStateVersion } : {}),
          ...(typeof incoming.timeoutMs === "number" ? { timeoutMs: incoming.timeoutMs } : {}),
        };
        return handler(command, {
          source: "window",
          origin: window.location.origin,
        });
      },
      command: async (
        name: SceneApiCommandName,
        payload?: unknown,
        options?: {
          requestId?: string;
          idempotencyKey?: string;
          expectedStateVersion?: number;
          timeoutMs?: number;
        }
      ) => {
        return bridge.send({
          name,
          payload,
          requestId: options?.requestId,
          idempotencyKey: options?.idempotencyKey,
          expectedStateVersion: options?.expectedStateVersion,
          timeoutMs: options?.timeoutMs,
        });
      },
      getState: () => {
        const getter = sceneApiGetStateRef.current;
        return getter ? getter() : readCurrentSettings();
      },
      getCapabilities: () => {
        const getter = sceneApiGetCapabilitiesRef.current;
        return getter ? getter() : buildSceneApiCapabilities();
      },
      onEvent: (listener: (event: SceneApiEventMessage) => void) => {
        sceneApiListenersRef.current.add(listener);
        return () => {
          sceneApiListenersRef.current.delete(listener);
        };
      },
    };

    window.xtationScene = bridge;
    return () => {
      if (window.xtationScene === bridge) {
        delete window.xtationScene;
      }
    };
  }, []);

  useEffect(() => {
    const listener = (event: SceneApiEventMessage) => {
      if (apiInspectorHideStateChanged && event.name === "stateChanged") {
        return;
      }
      if (event.name === "commandAccepted" || event.name === "commandCompleted" || event.name === "commandFailed") {
        setApiEventStats((prev) => {
          const next = { ...prev };
          if (event.name === "commandAccepted") next.accepted += 1;
          if (event.name === "commandCompleted") next.completed += 1;
          if (event.name === "commandFailed") {
            next.failed += 1;
            if (isObjectRecord(event.payload) && event.payload.code === "TIMEOUT") {
              next.timeout += 1;
            }
          }
          return next;
        });
      }
      appendApiInspectorLog("event", event.name, event.payload);
    };
    sceneApiListenersRef.current.add(listener);
    return () => {
      sceneApiListenersRef.current.delete(listener);
    };
  }, [appendApiInspectorLog, apiInspectorHideStateChanged]);

  useEffect(() => {
    const slotFromKey = (key: string): CompareSlotKey | null => {
      if (key === "1") return "a";
      if (key === "2") return "b";
      if (key === "3") return "c";
      return null;
    };

    const macroSlotFromCode = (code: string): number | null => {
      if (code === "Digit1") return 0;
      if (code === "Digit2") return 1;
      if (code === "Digit3") return 2;
      if (code === "Digit4") return 3;
      if (code === "Digit5") return 4;
      if (code === "Digit6") return 5;
      if (code === "Digit7") return 6;
      if (code === "Digit8") return 7;
      if (code === "Digit9") return 8;
      return null;
    };

    const isTextInput = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
    };

    const onKeydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const typing = isTextInput(event.target);
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && key === "z") {
        event.preventDefault();
        undoSettings();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && (key === "y" || (event.shiftKey && key === "z"))) {
        event.preventDefault();
        redoSettings();
        return;
      }
      if (!typing && event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const macroIndex = macroSlotFromCode(event.code);
        if (macroIndex !== null) {
          const macro = quickMacroSlots[macroIndex];
          if (macro) {
            event.preventDefault();
            void runMacroById(macro.id, true);
          }
          return;
        }
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (key === "escape") {
        setTimelinePlaying(false);
        setLightPaintPlaying(false);
        return;
      }
      const slot = slotFromKey(key);
      if (!slot) return;
      if (comparePreviewKeyRef.current === slot) return;
      const next = compareSlotsRef.current[slot];
      if (!next) return;
      if (!comparePreviewOriginRef.current) {
        comparePreviewOriginRef.current = readCurrentSettings();
      }
      comparePreviewKeyRef.current = slot;
      setActiveComparePreview(slot);
      historySuspendRef.current = true;
      applySceneSettings(next);
    };

    const onKeyup = (event: KeyboardEvent) => {
      const slot = slotFromKey(event.key.toLowerCase());
      if (!slot) return;
      if (comparePreviewKeyRef.current !== slot) return;
      const origin = comparePreviewOriginRef.current;
      comparePreviewKeyRef.current = null;
      comparePreviewOriginRef.current = null;
      setActiveComparePreview(null);
      if (!origin) {
        releaseHistorySuspension();
        return;
      }
      applySceneSettings(origin);
      releaseHistorySuspension();
    };

    window.addEventListener("keydown", onKeydown);
    window.addEventListener("keyup", onKeyup);
    return () => {
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("keyup", onKeyup);
    };
  }, [undoStack, redoStack, quickMacroSlots]);

  useEffect(() => {
    return () => {
      if (uploadedModelUrlRef.current) {
        URL.revokeObjectURL(uploadedModelUrlRef.current);
        uploadedModelUrlRef.current = null;
      }
      if (uploadedHdriUrlRef.current) {
        URL.revokeObjectURL(uploadedHdriUrlRef.current);
        uploadedHdriUrlRef.current = null;
      }
      screenAssetUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      screenAssetUrlsRef.current.clear();
      screenAudioMapRef.current.forEach((runtime) => {
        runtime.audio.pause();
        runtime.audio.src = "";
      });
      screenAudioMapRef.current.clear();
      applyHdriRef.current = null;
    };
  }, []);

  useEffect(() => {
    fogAmountRef.current = fogAmount;
  }, [fogAmount]);

  useEffect(() => {
    ambientAtmosphereRef.current = ambientAtmosphere;
  }, [ambientAtmosphere]);

  useEffect(() => {
    atmosphereSpreadRef.current = atmosphereSpread;
  }, [atmosphereSpread]);

  useEffect(() => {
    const cfg = PRESETS[preset];

    if (ambientRef.current) {
      ambientRef.current.intensity = cfg.ambientIntensity * (0.52 + ambientAtmosphere * 1.38);
    }

    if (atmoLightRef.current) {
      atmoLightRef.current.color.set(cfg.fogColor);
      atmoLightRef.current.intensity = (0.06 + ambientAtmosphere * 0.98) * (0.35 + fogAmount * 1.2);
      atmoLightRef.current.distance = 4 + atmosphereSpread * 10.5;
      atmoLightRef.current.decay = 1.4 - atmosphereSpread * 0.55;
    }

    const shadow = shadowMatRef.current;
    if (shadow) {
      shadow.opacity = 0.22 + fogAmount * 0.18 + ambientAtmosphere * 0.08;
    }

    fogMatsRef.current.forEach((mat, i) => {
      const base = fogAmount * (i === 0 ? 0.5 : 0.34);
      mat.opacity = base * (0.5 + ambientAtmosphere * 1.05) * (0.72 + atmosphereSpread * 0.55);
    });
  }, [fogAmount, ambientAtmosphere, atmosphereSpread, preset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const mount = mountRef.current;
    if (!canvas || !mount) return;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(32, mount.clientWidth / mount.clientHeight, 0.1, 100);
    const shotHero = SHOTS.hero;
    const introStartPos = new THREE.Vector3(0.18, 7.9, 0.02);
    const introStartTarget = new THREE.Vector3(0, 0.76, 0);
    const baseCamPos = new THREE.Vector3(...shotHero.position);
    const baseTarget = new THREE.Vector3(...shotHero.target);
    camera.fov = shotHero.fov + cameraFovOffsetRef.current;
    camera.near = cameraNearRef.current;
    camera.far = cameraFarRef.current;
    camera.position.copy(introStartPos);
    camera.lookAt(introStartTarget);
    camera.updateProjectionMatrix();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    const initialTierRatio =
      performanceTierRef.current === "ultra"
        ? 1
        : performanceTierRef.current === "fast"
          ? 0.74
          : 0.88;
    const initialRatio = THREE.MathUtils.clamp(
      Math.min(window.devicePixelRatio, (qualityModeRef.current === "draft" ? 1.1 : 2) * initialTierRatio),
      0.65,
      2
    );
    renderer.setPixelRatio(initialRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = GRADES[gradeRef.current].exposure;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const hdriLoader = new HDRLoader();
    let currentHdriSource: THREE.Texture | null = null;
    let currentHdriEnvMap: THREE.Texture | null = null;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(introStartTarget);
    controls.enableDamping = true;
    controls.dampingFactor = cameraDampingRef.current;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.rotateSpeed = 0.2 + cameraOrbitSpeedRef.current * 1.7;
    controls.zoomSpeed = 0.25 + cameraOrbitSpeedRef.current * 0.55;
    // Allow true top-down view while preventing under-floor flips.
    controls.minPolarAngle = 0.001;
    controls.maxPolarAngle = Math.PI * 0.82;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minDistance = 2.25;
    controls.maxDistance = 13.2;
    controls.autoRotate = autoOrbit;
    controls.autoRotateSpeed = cameraOrbitSpeedRef.current;
    controls.enabled = false;
    controls.update();
    controlsRef.current = controls;
    const clock = new THREE.Timer();
    clock.connect(document);

    const shotBlend = {
      active: false,
      start: 0,
      duration: 1.05,
      fromPos: new THREE.Vector3(),
      toPos: new THREE.Vector3(),
      fromTarget: new THREE.Vector3(),
      toTarget: new THREE.Vector3(),
      fromFov: camera.fov,
      toFov: camera.fov,
    };

    const introBlend = {
      active: true,
      start: 0,
      duration: 2.2,
      fromPos: introStartPos.clone(),
      toPos: baseCamPos.clone(),
      fromTarget: introStartTarget.clone(),
      toTarget: baseTarget.clone(),
      fromFov: 38,
      toFov: shotHero.fov + cameraFovOffsetRef.current,
    };

    const moveToShot = (next: CameraShotKey, immediate = false) => {
      const cfg = SHOTS[next];
      const nextPos = new THREE.Vector3(...cfg.position);
      const nextTarget = new THREE.Vector3(...cfg.target);
      const nextFov = cfg.fov + cameraFovOffsetRef.current;
      if (immediate) {
        introBlend.active = false;
        controls.enabled = true;
        camera.position.copy(nextPos);
        controls.target.copy(nextTarget);
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
        controls.update();
        shotBlend.active = false;
        return;
      }
      shotBlend.fromPos.copy(camera.position);
      shotBlend.toPos.copy(nextPos);
      shotBlend.fromTarget.copy(controls.target);
      shotBlend.toTarget.copy(nextTarget);
      shotBlend.fromFov = camera.fov;
      shotBlend.toFov = nextFov;
      shotBlend.start = clock.getElapsed();
      shotBlend.active = true;
      controls.enabled = true;
    };

    triggerShotRef.current = moveToShot;
    if (activeShotRef.current !== "hero") {
      moveToShot(activeShotRef.current, true);
    } else {
      introBlend.start = clock.getElapsed();
    }

    resetViewRef.current = () => {
      moveToShot(activeShotRef.current, true);
      setKeyOffsetX(0);
      setKeyOffsetY(0);
      setKeyOffsetZ(0);
      keyOffsetRef.current.set(0, 0, 0);
      setFillOffsetX(DEFAULT_FILL_OFFSET.x);
      setFillOffsetY(DEFAULT_FILL_OFFSET.y);
      setFillOffsetZ(DEFAULT_FILL_OFFSET.z);
      fillOffsetRef.current.set(DEFAULT_FILL_OFFSET.x, DEFAULT_FILL_OFFSET.y, DEFAULT_FILL_OFFSET.z);
      controls.update();
    };

    const textureLoader = new THREE.TextureLoader();
    let hdriLoadToken = 0;
    const disposeCurrentHdri = () => {
      if (currentHdriSource) {
        currentHdriSource.dispose();
        currentHdriSource = null;
      }
      if (currentHdriEnvMap) {
        currentHdriEnvMap.dispose();
        currentHdriEnvMap = null;
      }
    };

    applyHdriRef.current = () => {
      const presetKey = hdriPresetRef.current;
      if (presetKey === "off") {
        hdriLoadToken += 1;
        disposeCurrentHdri();
        scene.environment = null;
        scene.background = null;
        return;
      }

      let sourceUrl: string | null = null;
      let sourceName = "Custom";
      let useHdr = true;
      if (presetKey === "custom") {
        sourceUrl = hdriCustomSourceRef.current;
        sourceName = hdriCustomNameRef.current || "Custom HDRI";
        useHdr = hdriCustomIsHdrRef.current;
      } else {
        const presetConfig = HDRI_PRESETS[presetKey];
        sourceUrl = presetConfig.url;
        sourceName = presetConfig.label;
        useHdr = true;
      }
      if (!sourceUrl) {
        return;
      }

      const loadToken = ++hdriLoadToken;
      const applyLoaded = (sourceTexture: THREE.Texture) => {
        if (loadToken !== hdriLoadToken) {
          sourceTexture.dispose();
          return;
        }
        const envTexture = pmremGenerator.fromEquirectangular(sourceTexture).texture;
        disposeCurrentHdri();
        currentHdriSource = sourceTexture;
        currentHdriEnvMap = envTexture;
        scene.environment = envTexture;
        scene.background = hdriBackgroundRef.current ? envTexture : null;
        setHdriName(sourceName);
      };

      if (useHdr) {
        hdriLoader.load(
          sourceUrl,
          (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            applyLoaded(texture);
          },
          undefined,
          (error) => {
            console.error("Failed to load HDRI", error);
          }
        );
        return;
      }

      textureLoader.load(
        sourceUrl,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          texture.colorSpace = THREE.SRGBColorSpace;
          applyLoaded(texture);
        },
        undefined,
        (error) => {
          console.error("Failed to load environment image", error);
        }
      );
    };
    applyHdriRef.current();

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(mount.clientWidth, mount.clientHeight), bloomStrength, 0.62, 0.86);
    bloomPass.threshold = 0.74;
    bloomPass.radius = 0.48;
    bloomPass.strength = clampBloom(bloomStrengthRef.current + GRADES[gradeRef.current].bloomBoost);
    composer.addPass(bloomPass);
    bloomRef.current = bloomPass;

    const vignettePass = new ShaderPass(VIGNETTE_SHADER as never);
    const vignetteUniforms = (vignettePass.material as THREE.ShaderMaterial).uniforms;
    vignetteUniforms.offset.value = GRADES[gradeRef.current].vignetteOffset;
    vignetteUniforms.darkness.value = GRADES[gradeRef.current].vignetteDarkness;
    composer.addPass(vignettePass);
    vignetteRef.current = vignettePass;

    const ambient = new THREE.HemisphereLight(
      0xffffff,
      0x11111a,
      PRESETS[preset].ambientIntensity * (0.52 + ambientAtmosphereRef.current * 1.38)
    );
    scene.add(ambient);
    ambientRef.current = ambient;

    const atmoLight = new THREE.PointLight(
      new THREE.Color(PRESETS[preset].fogColor),
      (0.06 + ambientAtmosphereRef.current * 0.98) * (0.35 + fogAmountRef.current * 1.2),
      4 + atmosphereSpreadRef.current * 10.5,
      1.4 - atmosphereSpreadRef.current * 0.55
    );
    atmoLight.position.set(0, 1.2, 0.42);
    scene.add(atmoLight);
    atmoLightRef.current = atmoLight;

    const lightFocus = new THREE.Vector3(0, 1.0, 0);
    const orbitCenter = new THREE.Vector3(0, 1.1, 0);
    const computeRigPosition = (
      distance: number,
      azimuthDeg: number,
      elevationDeg: number,
      target: THREE.Vector3
    ) => {
      const azimuth = THREE.MathUtils.degToRad(azimuthDeg);
      const elevation = THREE.MathUtils.degToRad(elevationDeg);
      const y = Math.sin(elevation) * distance;
      const xz = Math.cos(elevation) * distance;
      const x = Math.sin(azimuth) * xz;
      const z = Math.cos(azimuth) * xz;
      return new THREE.Vector3(target.x + x, target.y + y, target.z + z);
    };

    const keyLight = new THREE.DirectionalLight(new THREE.Color(keyColor), keyIntensity * lightGainRef.current);
    // Keep key light close to the character.
    keyLight.position
      .copy(computeRigPosition(keyDistanceRef.current, keyAzimuthRef.current, keyElevationRef.current, orbitCenter))
      .add(keyOffsetRef.current);
    keyLight.target.position.copy(orbitCenter);
    scene.add(keyLight.target);
    scene.add(keyLight);
    keyLightRef.current = keyLight;

    const fillLight = new THREE.SpotLight(new THREE.Color(fillColor), fillIntensity * lightGainRef.current, 8.5, THREE.MathUtils.degToRad(23), 0.34, 1.15);
    // Fill/accent spotlight: start very close to character pivot; sliders control XYZ offset.
    fillLight.position
      .copy(computeRigPosition(fillDistanceRef.current, fillAzimuthRef.current, fillElevationRef.current, orbitCenter))
      .add(fillOffsetRef.current);
    fillLight.target.position.copy(orbitCenter);
    fillLight.visible = !hideLightSourceRef.current;
    fillLight.intensity = hideLightSourceRef.current ? 0 : fillIntensity * lightGainRef.current;
    scene.add(fillLight.target);
    scene.add(fillLight);
    fillLightRef.current = fillLight;

    const softFill = new THREE.DirectionalLight(
      new THREE.Color(fillColor),
      hideLightSourceRef.current ? fillIntensity * softFillBoost(lightSoftnessRef.current) * lightGainRef.current : 0
    );
    softFill.position
      .copy(computeRigPosition(fillDistanceRef.current, fillAzimuthRef.current, fillElevationRef.current, orbitCenter))
      .add(fillOffsetRef.current);
    softFill.target.position.copy(orbitCenter);
    scene.add(softFill.target);
    scene.add(softFill);
    softFillRef.current = softFill;

    const markerGeometry = new THREE.SphereGeometry(0.09, 16, 16);
    const keyMarkerMaterial = new THREE.MeshBasicMaterial({
      color: 0x7ec8ff,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
    });
    const fillMarkerMaterial = new THREE.MeshBasicMaterial({
      color: 0xff875a,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
    });
    const targetMarkerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      depthTest: false,
      depthWrite: false,
    });
    const keyMarker = new THREE.Mesh(markerGeometry, keyMarkerMaterial);
    const fillMarker = new THREE.Mesh(markerGeometry, fillMarkerMaterial);
    const targetMarker = new THREE.Mesh(markerGeometry, targetMarkerMaterial);
    keyMarker.renderOrder = 998;
    fillMarker.renderOrder = 998;
    targetMarker.renderOrder = 998;
    keyMarker.visible = showLightMarkersRef.current;
    fillMarker.visible = showLightMarkersRef.current;
    targetMarker.visible = showLightMarkersRef.current;
    scene.add(keyMarker);
    scene.add(fillMarker);
    scene.add(targetMarker);

    const keyLinePositions = new Float32Array(6);
    const keyLineGeometry = new THREE.BufferGeometry();
    keyLineGeometry.setAttribute("position", new THREE.BufferAttribute(keyLinePositions, 3));
    const keyLineMaterial = new THREE.LineBasicMaterial({
      color: 0x7ec8ff,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      depthWrite: false,
    });
    const keyLine = new THREE.Line(
      keyLineGeometry,
      keyLineMaterial
    );
    keyLine.renderOrder = 997;
    keyLine.visible = showLightMarkersRef.current;
    scene.add(keyLine);

    const fillLinePositions = new Float32Array(6);
    const fillLineGeometry = new THREE.BufferGeometry();
    fillLineGeometry.setAttribute("position", new THREE.BufferAttribute(fillLinePositions, 3));
    const fillLineMaterial = new THREE.LineBasicMaterial({
      color: 0xff875a,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      depthWrite: false,
    });
    const fillLine = new THREE.Line(
      fillLineGeometry,
      fillLineMaterial
    );
    fillLine.renderOrder = 997;
    fillLine.visible = showLightMarkersRef.current;
    scene.add(fillLine);

    const groundY = -1.22;
    const floorMat = new THREE.MeshPhysicalMaterial({
      color: 0x0c0c0f,
      roughness: 0.72,
      metalness: 0.14,
      clearcoat: 0.08,
      reflectivity: 0.12,
      transmission: 0,
    });
    floorMatRef.current = floorMat;

    const floor = new THREE.Mesh(new THREE.CircleGeometry(5.6, 100), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = groundY;
    scene.add(floor);
    floorRef.current = floor;

    const shadowTexture = makeRadialTexture("rgba(0,0,0,0.9)", "rgba(0,0,0,0)", 512);
    const fogTexture = makeRadialTexture("rgba(255,255,255,0.7)", "rgba(255,255,255,0)", 512);
    const floorGridTexture = makeGridTexture("rgba(177, 198, 230, 0.34)", "rgba(16, 20, 28, 0.9)", 512, 42);
    floorGridTextureRef.current = floorGridTexture;
    const disposeTextures: THREE.Texture[] = [shadowTexture, fogTexture, floorGridTexture];

    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      color: 0x000000,
      transparent: true,
      premultipliedAlpha: true,
      opacity: 0.26,
      depthWrite: false,
      blending: THREE.MultiplyBlending,
    });
    shadowMatRef.current = shadowMat;

    const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = groundY + 0.016;
    scene.add(contactShadow);
    contactShadowRef.current = contactShadow;

    const fogGroup = new THREE.Group();
    scene.add(fogGroup);
    fogGroupRef.current = fogGroup;

    const fogPlaneA = new THREE.Mesh(
      new THREE.PlaneGeometry(6.8, 6.8),
      new THREE.MeshBasicMaterial({
        map: fogTexture,
        color: new THREE.Color(PRESETS[preset].fogColor),
        transparent: true,
        opacity: fogAmount * 0.5 * (0.5 + ambientAtmosphereRef.current * 1.05) * (0.72 + atmosphereSpreadRef.current * 0.55),
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    fogPlaneA.rotation.x = -Math.PI / 2;
    fogPlaneA.position.y = groundY + 0.035;
    fogGroup.add(fogPlaneA);

    const fogPlaneB = new THREE.Mesh(
      new THREE.PlaneGeometry(9.4, 9.4),
      new THREE.MeshBasicMaterial({
        map: fogTexture,
        color: new THREE.Color(PRESETS[preset].fogColor),
        transparent: true,
        opacity: fogAmount * 0.34 * (0.5 + ambientAtmosphereRef.current * 1.05) * (0.72 + atmosphereSpreadRef.current * 0.55),
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    fogPlaneB.rotation.x = -Math.PI / 2;
    fogPlaneB.position.y = groundY + 0.03;
    fogGroup.add(fogPlaneB);

    fogMatsRef.current = [
      fogPlaneA.material as THREE.MeshBasicMaterial,
      fogPlaneB.material as THREE.MeshBasicMaterial,
    ];

    const topoRingGroup = new THREE.Group();
    topoRingGroup.rotation.x = -Math.PI / 2;
    topoRingGroup.position.y = groundY + 0.02;
    scene.add(topoRingGroup);
    ringGroupRef.current = topoRingGroup;

    const ringMaterials: THREE.MeshBasicMaterial[] = [];
    const ringMeshes: THREE.Mesh[] = [];

    for (let i = 0; i < 14; i += 1) {
      const inner = 0.45 + i * 0.24;
      const outer = inner + 0.012;
      const ringMat = new THREE.MeshBasicMaterial({
        color: i % 4 === 0 ? PRESETS[preset].ringColorB : PRESETS[preset].ringColorA,
        transparent: true,
        opacity: Math.max(0.007, 0.028 - i * 0.0012),
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 120), ringMat);
      ring.renderOrder = 3;
      topoRingGroup.add(ring);
      ringMeshes.push(ring);
      ringMaterials.push(ringMat);
    }

    ringMatsRef.current = ringMaterials;

    const initialFloorMode = floorModeRef.current;
    const initialGloss = THREE.MathUtils.clamp(groundGlossRef.current, 0, 1);
    const floorDisabled = initialFloorMode === "none";
    floor.visible = !floorDisabled;
    topoRingGroup.visible = initialFloorMode === "topo" || initialFloorMode === "scan";
    fogGroup.visible = initialFloorMode === "topo" || initialFloorMode === "scan";
    contactShadow.visible = !floorDisabled;
    if (initialFloorMode === "grid") {
      floorMat.map = floorGridTexture;
      floorMat.roughness = THREE.MathUtils.lerp(0.88, 0.3, initialGloss);
      floorMat.metalness = THREE.MathUtils.lerp(0.04, 0.34, initialGloss);
      floorMat.emissive.set("#000000");
      floorMat.emissiveIntensity = 0;
    } else if (initialFloorMode === "pulse") {
      floorMat.map = null;
      floorMat.roughness = THREE.MathUtils.lerp(0.66, 0.2, initialGloss);
      floorMat.metalness = THREE.MathUtils.lerp(0.12, 0.46, initialGloss);
      floorMat.emissive.set("#6ea0ff");
      floorMat.emissiveIntensity = 0.24;
    } else if (initialFloorMode === "scan") {
      floorMat.map = floorGridTexture;
      floorMat.roughness = THREE.MathUtils.lerp(0.52, 0.16, initialGloss);
      floorMat.metalness = THREE.MathUtils.lerp(0.18, 0.52, initialGloss);
      floorMat.emissive.set(fillColorRef.current);
      floorMat.emissiveIntensity = 0.34;
    } else {
      floorMat.map = null;
      floorMat.roughness = THREE.MathUtils.lerp(0.9, 0.24, initialGloss);
      floorMat.metalness = THREE.MathUtils.lerp(0.04, 0.48, initialGloss);
      floorMat.emissive.set("#000000");
      floorMat.emissiveIntensity = 0;
    }
    floorMat.clearcoat = THREE.MathUtils.lerp(0.05, 0.85, initialGloss);
    floorMat.reflectivity = THREE.MathUtils.lerp(0.08, 0.92, initialGloss);
    floorMat.needsUpdate = true;

    const emberParticleColor = new THREE.Color("#ff7a4a");
    const snowParticleColor = new THREE.Color("#dce9ff");

    const particleCount = 360;
    const particlePositions = new Float32Array(particleCount * 3);
    const particlePhase = new Float32Array(particleCount);
    const particleRise = new Float32Array(particleCount);
    const particleGeo = new THREE.BufferGeometry();
    for (let i = 0; i < particleCount; i += 1) {
      const i3 = i * 3;
      const radius = 0.55 + Math.random() * 2.7;
      const angle = Math.random() * Math.PI * 2;
      particlePositions[i3] = Math.cos(angle) * radius;
      particlePositions[i3 + 1] = THREE.MathUtils.lerp(-0.88, 2.42, Math.random());
      particlePositions[i3 + 2] = Math.sin(angle) * radius;
      particlePhase[i] = Math.random() * Math.PI * 2;
      particleRise[i] = THREE.MathUtils.lerp(0.15, 0.72, Math.random());
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setDrawRange(0, Math.floor(particleCount * particleDensityRef.current));
    const particleMat = new THREE.PointsMaterial({
      color: 0xe2eaff,
      size: 0.035,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    particleMatRef.current = particleMat;
    const particleCloud = new THREE.Points(particleGeo, particleMat);
    particleCloud.position.y = groundY + 0.22;
    particleCloud.visible = particlesEnabledRef.current && ["dust", "embers", "snow"].includes(particleStyleRef.current);
    scene.add(particleCloud);

    const glyphTexture = makeGlyphTexture(128);
    disposeTextures.push(glyphTexture);
    const glyphCount = 260;
    const glyphPositions = new Float32Array(glyphCount * 3);
    const glyphPhase = new Float32Array(glyphCount);
    const glyphRise = new Float32Array(glyphCount);
    const glyphGeo = new THREE.BufferGeometry();
    for (let i = 0; i < glyphCount; i += 1) {
      const i3 = i * 3;
      const radius = 0.5 + Math.random() * 3.2;
      const angle = Math.random() * Math.PI * 2;
      glyphPositions[i3] = Math.cos(angle) * radius;
      glyphPositions[i3 + 1] = THREE.MathUtils.lerp(-0.85, 2.75, Math.random());
      glyphPositions[i3 + 2] = Math.sin(angle) * radius;
      glyphPhase[i] = Math.random() * Math.PI * 2;
      glyphRise[i] = THREE.MathUtils.lerp(0.08, 0.32, Math.random());
    }
    glyphGeo.setAttribute("position", new THREE.BufferAttribute(glyphPositions, 3));
    glyphGeo.setDrawRange(0, Math.floor(glyphCount * particleDensityRef.current));
    const glyphMat = new THREE.PointsMaterial({
      color: 0xe2eaff,
      map: glyphTexture,
      alphaTest: 0.12,
      size: 0.08,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    glyphMatRef.current = glyphMat;
    const glyphCloud = new THREE.Points(glyphGeo, glyphMat);
    glyphCloud.position.y = groundY + 0.22;
    glyphCloud.visible = particlesEnabledRef.current && particleStyleRef.current === "glyphs";
    scene.add(glyphCloud);

    const orbitBallGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const orbitBallsGroup = new THREE.Group();
    const orbitBallCount = 28;
    const orbitBallPhases = new Float32Array(orbitBallCount);
    const orbitBallSpeed = new Float32Array(orbitBallCount);
    const orbitBallRadii = new Float32Array(orbitBallCount);
    const orbitBallHeights = new Float32Array(orbitBallCount);
    const orbitBallMats: THREE.MeshBasicMaterial[] = [];
    const orbitBallMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < orbitBallCount; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? keyColorRef.current : fillColorRef.current,
        transparent: true,
        opacity: 0.7,
      });
      const mesh = new THREE.Mesh(orbitBallGeometry, mat);
      orbitBallPhases[i] = Math.random() * Math.PI * 2;
      orbitBallSpeed[i] = THREE.MathUtils.lerp(0.45, 1.25, Math.random());
      orbitBallRadii[i] = THREE.MathUtils.lerp(0.65, 2.35, Math.random());
      orbitBallHeights[i] = THREE.MathUtils.lerp(-0.45, 1.45, Math.random());
      orbitBallMeshes.push(mesh);
      orbitBallMats.push(mat);
      orbitBallsGroup.add(mesh);
    }
    orbitBallMatsRef.current = orbitBallMats;
    orbitBallsGroup.visible = particlesEnabledRef.current && particleStyleRef.current === "orbit-balls";
    scene.add(orbitBallsGroup);

    const ribbonGroup = new THREE.Group();
    const ribbonMats: THREE.MeshBasicMaterial[] = [];
    const ribbonMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? fillColorRef.current : keyColorRef.current,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const torus = new THREE.Mesh(new THREE.TorusGeometry(0.62 + i * 0.21, 0.01 + i * 0.0032, 24, 180), mat);
      torus.rotation.x = THREE.MathUtils.degToRad(55 + i * 11);
      torus.rotation.y = THREE.MathUtils.degToRad(i * 38);
      ribbonMats.push(mat);
      ribbonMeshes.push(torus);
      ribbonGroup.add(torus);
    }
    ribbonMatsRef.current = ribbonMats;
    ribbonGroup.visible = particlesEnabledRef.current && particleStyleRef.current === "ribbons";
    scene.add(ribbonGroup);

    const shardGroup = new THREE.Group();
    const shardGeometry = new THREE.OctahedronGeometry(0.085, 0);
    const shardCount = 90;
    const shardPhases = new Float32Array(shardCount);
    const shardSpeed = new Float32Array(shardCount);
    const shardRadius = new Float32Array(shardCount);
    const shardHeight = new Float32Array(shardCount);
    const shardMats: THREE.MeshBasicMaterial[] = [];
    const shardMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < shardCount; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? keyColorRef.current : fillColorRef.current,
        transparent: true,
        opacity: 0.48,
      });
      const mesh = new THREE.Mesh(shardGeometry, mat);
      shardPhases[i] = Math.random() * Math.PI * 2;
      shardSpeed[i] = THREE.MathUtils.lerp(0.35, 1.45, Math.random());
      shardRadius[i] = THREE.MathUtils.lerp(0.6, 2.4, Math.random());
      shardHeight[i] = THREE.MathUtils.lerp(-0.6, 1.5, Math.random());
      shardMats.push(mat);
      shardMeshes.push(mesh);
      shardGroup.add(mesh);
    }
    shardMatsRef.current = shardMats;
    shardGroup.visible = particlesEnabledRef.current && particleStyleRef.current === "shards";
    scene.add(shardGroup);

    const beamGroup = new THREE.Group();
    const beamMats: THREE.MeshBasicMaterial[] = [];
    const beamMeshes: THREE.Mesh[] = [];
    const beamPhases = new Float32Array(16);
    const beamRadius = new Float32Array(16);
    for (let i = 0; i < 16; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? fillColorRef.current : keyColorRef.current,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.05 + Math.random() * 0.06, 1.7 + Math.random() * 1.8), mat);
      beamPhases[i] = Math.random() * Math.PI * 2;
      beamRadius[i] = THREE.MathUtils.lerp(0.7, 2.3, Math.random());
      beamMats.push(mat);
      beamMeshes.push(strip);
      beamGroup.add(strip);
    }
    beamMatsRef.current = beamMats;
    beamGroup.visible = particlesEnabledRef.current && particleStyleRef.current === "beams";
    scene.add(beamGroup);

    type RuntimeScreen = {
      id: string;
      mesh: THREE.Mesh;
      handleGroup: THREE.Group;
      handles: THREE.Mesh[];
      texture: THREE.CanvasTexture;
      canvas: HTMLCanvasElement;
      ctx: CanvasRenderingContext2D;
      image: HTMLImageElement | null;
      imageSrc: string | null;
      video: HTMLVideoElement | null;
      videoSrc: string | null;
      signature: string;
      basePositions: Float32Array;
      bendSignature: string;
    };

    type ScreenHandleKey = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

    const screenGroup = new THREE.Group();
    scene.add(screenGroup);
    const SCREEN_CANVAS_WIDTH = 1536;
    const SCREEN_CANVAS_HEIGHT = 960;
    const SCREEN_FRAME_INSET_PX = 38;
    const makeScreenGeometry = () => new THREE.PlaneGeometry(SCREEN_GEOMETRY_WIDTH, SCREEN_GEOMETRY_HEIGHT, 26, 14);
    const runtimeScreens = new Map<string, RuntimeScreen>();
    const providerLayer = providerLayerRef.current;
    type ProviderOverlayRuntime = {
      host: HTMLDivElement;
      iframe: HTMLIFrameElement;
      src: string;
      provider: ProviderName | null;
      embedBase: string | null;
      ready: boolean;
      desiredPlaying: boolean;
      desiredMuted: boolean;
      appliedPlaying: boolean | null;
      appliedMuted: boolean | null;
      loadHandler: () => void;
      errorHandler: () => void;
    };
    const providerOverlays = new Map<string, ProviderOverlayRuntime>();
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const dragState = {
      id: "",
      active: false,
      plane: new THREE.Plane(),
      offset: new THREE.Vector3(),
    };
    const screenScaleDragState = {
      active: false,
      screenId: "",
      handle: "" as ScreenHandleKey | "",
      plane: new THREE.Plane(),
      startPoint: new THREE.Vector3(),
      startWorldPos: new THREE.Vector3(),
      startWidth: 1,
      startHeight: 1,
      startScale: 1,
      signX: 0,
      signY: 0,
      axisX: false,
      axisY: false,
    };
    const lightDragState = {
      active: false,
      kind: "" as "" | "key" | "fill" | "target",
      plane: new THREE.Plane(),
      offset: new THREE.Vector3(),
    };
    const dragPlanePoint = new THREE.Vector3();
    const dragPlaneNormal = new THREE.Vector3();
    const dragHit = new THREE.Vector3();
    let hoveredScreenId = "";
    const hudWorldPos = new THREE.Vector3();
    const focusTargetWorld = new THREE.Vector3();
    const focusDirectionWorld = new THREE.Vector3();
    const orbitCenterLive = new THREE.Vector3();
    const handlePos = new THREE.Vector3();
    const worldShift = new THREE.Vector3();
    const nextWorldPos = new THREE.Vector3();
    const screenTargetPos = new THREE.Vector3();
    const screenTargetScale = new THREE.Vector3();
    const providerCenterWorld = new THREE.Vector3();
    const providerNormalWorld = new THREE.Vector3();
    const providerToCamera = new THREE.Vector3();
    const providerWorldQuat = new THREE.Quaternion();
    const providerCornerWorldA = new THREE.Vector3();
    const providerCornerWorldB = new THREE.Vector3();
    const providerCornerWorldC = new THREE.Vector3();
    const providerCornerWorldD = new THREE.Vector3();
    const providerCornerNdcA = new THREE.Vector3();
    const providerCornerNdcB = new THREE.Vector3();
    const providerCornerNdcC = new THREE.Vector3();
    const providerCornerNdcD = new THREE.Vector3();
    const providerOcclusionRaycaster = new THREE.Raycaster();
    const providerOcclusionDirection = new THREE.Vector3();
    const providerCornersFrom = [
      { x: 0, y: 0 },
      { x: SCREEN_CANVAS_WIDTH, y: 0 },
      { x: SCREEN_CANVAS_WIDTH, y: SCREEN_CANVAS_HEIGHT },
      { x: 0, y: SCREEN_CANVAS_HEIGHT },
    ];
    const providerCornersTo = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    const providerOcclusionUvSamples = [
      { u: 0, v: 0 },
      { u: 0.5, v: 0 },
      { u: 1, v: 0 },
      { u: 0, v: 0.5 },
      { u: 0.5, v: 0.5 },
      { u: 1, v: 0.5 },
      { u: 0, v: 1 },
      { u: 0.5, v: 1 },
      { u: 1, v: 1 },
      { u: 0.2, v: 0.2 },
      { u: 0.8, v: 0.2 },
      { u: 0.2, v: 0.8 },
      { u: 0.8, v: 0.8 },
      { u: 0.5, v: 0.2 },
      { u: 0.5, v: 0.8 },
    ];
    const providerOcclusionUvSamplesBalanced = [
      { u: 0, v: 0 },
      { u: 0.5, v: 0 },
      { u: 1, v: 0 },
      { u: 0, v: 0.5 },
      { u: 0.5, v: 0.5 },
      { u: 1, v: 0.5 },
      { u: 0.2, v: 0.8 },
      { u: 0.8, v: 0.8 },
    ];
    const providerOcclusionUvSamplesFast = [
      { u: 0, v: 0 },
      { u: 1, v: 0 },
      { u: 0, v: 1 },
      { u: 1, v: 1 },
      { u: 0.5, v: 0.5 },
    ];
    const providerOcclusionSampleWorld = new THREE.Vector3();

    const solveLinearSystem = (input: number[][]) => {
      const matrix = input.map((row) => row.slice());
      const rowCount = matrix.length;
      const colCount = matrix[0]?.length ?? 0;
      if (rowCount === 0 || colCount === 0) return null;
      const variableCount = colCount - 1;
      for (let col = 0; col < variableCount; col += 1) {
        let pivotRow = col;
        let maxAbs = Math.abs(matrix[pivotRow][col] ?? 0);
        for (let row = col + 1; row < rowCount; row += 1) {
          const value = Math.abs(matrix[row][col] ?? 0);
          if (value > maxAbs) {
            maxAbs = value;
            pivotRow = row;
          }
        }
        if (maxAbs < 1e-10) return null;
        if (pivotRow !== col) {
          const temp = matrix[col];
          matrix[col] = matrix[pivotRow];
          matrix[pivotRow] = temp;
        }
        const pivot = matrix[col][col];
        for (let k = col; k < colCount; k += 1) {
          matrix[col][k] /= pivot;
        }
        for (let row = 0; row < rowCount; row += 1) {
          if (row === col) continue;
          const factor = matrix[row][col];
          if (Math.abs(factor) < 1e-10) continue;
          for (let k = col; k < colCount; k += 1) {
            matrix[row][k] -= factor * matrix[col][k];
          }
        }
      }
      return matrix.slice(0, variableCount).map((row) => row[variableCount]);
    };

    const buildProviderQuadTransform = (
      to: Array<{ x: number; y: number }>
    ) => {
      const equations: number[][] = [];
      for (let i = 0; i < 4; i += 1) {
        const source = providerCornersFrom[i];
        const target = to[i];
        equations.push([
          source.x,
          source.y,
          1,
          0,
          0,
          0,
          -source.x * target.x,
          -source.y * target.x,
          target.x,
        ]);
        equations.push([
          0,
          0,
          0,
          source.x,
          source.y,
          1,
          -source.x * target.y,
          -source.y * target.y,
          target.y,
        ]);
      }
      const solved = solveLinearSystem(equations);
      if (!solved || solved.length !== 8) return null;
      const h11 = solved[0];
      const h12 = solved[1];
      const h13 = solved[2];
      const h21 = solved[3];
      const h22 = solved[4];
      const h23 = solved[5];
      const h31 = solved[6];
      const h32 = solved[7];
      return `matrix3d(${h11},${h21},0,${h31},${h12},${h22},0,${h32},0,0,1,0,${h13},${h23},0,1)`;
    };

    const isProviderSampleOccluded = (sampleWorld: THREE.Vector3) => {
      if (runtimeMeshes.length === 0) return false;
      providerOcclusionDirection.copy(sampleWorld).sub(camera.position);
      const distance = providerOcclusionDirection.length();
      if (!Number.isFinite(distance) || distance <= 0.01) return false;
      providerOcclusionDirection.normalize();
      providerOcclusionRaycaster.set(camera.position, providerOcclusionDirection);
      providerOcclusionRaycaster.near = 0.05;
      providerOcclusionRaycaster.far = Math.max(0.05, distance - 0.04);
      const hits = providerOcclusionRaycaster.intersectObjects(runtimeMeshes, true);
      return hits.length > 0;
    };

    const postToProvider = (entry: ProviderOverlayRuntime, payload: Record<string, unknown> | string) => {
      const target = entry.iframe.contentWindow;
      if (!target) return false;
      try {
        target.postMessage(payload, "*");
        return true;
      } catch {
        return false;
      }
    };

    const sendProviderPlayState = (entry: ProviderOverlayRuntime, playing: boolean) => {
      if (!entry.provider || !entry.ready) return false;
      if (entry.provider === "youtube") {
        return postToProvider(entry, JSON.stringify({
          event: "command",
          func: playing ? "playVideo" : "pauseVideo",
          args: [],
        }));
      }
      return postToProvider(entry, {
        method: playing ? "play" : "pause",
      });
    };

    const sendProviderMuteState = (entry: ProviderOverlayRuntime, muted: boolean) => {
      if (!entry.provider || !entry.ready) return false;
      if (entry.provider === "youtube") {
        return postToProvider(entry, JSON.stringify({
          event: "command",
          func: muted ? "mute" : "unMute",
          args: [],
        }));
      }
      return postToProvider(entry, {
        method: "setVolume",
        value: muted ? 0 : 1,
      });
    };

    const primeProviderEvents = (entry: ProviderOverlayRuntime) => {
      if (!entry.ready || !entry.provider) return;
      if (entry.provider === "youtube") {
        postToProvider(entry, JSON.stringify({ event: "listening" }));
        postToProvider(entry, JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] }));
        postToProvider(entry, JSON.stringify({ event: "command", func: "addEventListener", args: ["onError"] }));
        return;
      }
      postToProvider(entry, { method: "addEventListener", value: "play" });
      postToProvider(entry, { method: "addEventListener", value: "pause" });
      postToProvider(entry, { method: "addEventListener", value: "ended" });
      postToProvider(entry, { method: "addEventListener", value: "error" });
    };

    const applyProviderMediaState = (screenId: string, entry: ProviderOverlayRuntime, force = false) => {
      if (!entry.provider || !entry.ready) return;
      const shouldPlay = entry.desiredPlaying;
      const shouldMute = entry.desiredMuted;
      if (force || entry.appliedPlaying !== shouldPlay) {
        if (sendProviderPlayState(entry, shouldPlay)) {
          entry.appliedPlaying = shouldPlay;
          emitSceneApiEvent("providerPlaybackSync", {
            screenId,
            provider: entry.provider,
            playing: shouldPlay,
          });
        }
      }
      if (force || entry.appliedMuted !== shouldMute) {
        if (sendProviderMuteState(entry, shouldMute)) {
          entry.appliedMuted = shouldMute;
          emitSceneApiEvent("providerMuteSync", {
            screenId,
            provider: entry.provider,
            muted: shouldMute,
          });
        }
      }
    };

    const ensureProviderOverlay = (screenId: string) => {
      if (!providerLayer) return null;
      const existing = providerOverlays.get(screenId);
      if (existing) return existing;
      const host = document.createElement("div");
      host.className = "provider-card";
      host.style.width = `${SCREEN_CANVAS_WIDTH}px`;
      host.style.height = `${SCREEN_CANVAS_HEIGHT}px`;
      host.style.transformOrigin = "0 0";
      host.style.willChange = "transform, opacity";
      host.style.backfaceVisibility = "hidden";
      const iframe = document.createElement("iframe");
      iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      iframe.allowFullscreen = true;
      iframe.loading = "eager";
      host.appendChild(iframe);
      providerLayer.appendChild(host);
      const runtime: ProviderOverlayRuntime = {
        host,
        iframe,
        src: "",
        provider: null,
        embedBase: null,
        ready: false,
        desiredPlaying: true,
        desiredMuted: true,
        appliedPlaying: null,
        appliedMuted: null,
        loadHandler: () => {
          runtime.ready = true;
          primeProviderEvents(runtime);
          applyProviderMediaState(screenId, runtime, true);
          setScreenStatusMessage(screenId, "Provider ready");
          emitSceneApiEvent("providerReady", {
            screenId,
            provider: runtime.provider,
            embedBase: runtime.embedBase,
          });
        },
        errorHandler: () => {
          setScreenStatusMessage(screenId, "Provider failed to load. Check embed/link permissions.");
          emitSceneApiEvent("mediaError", {
            screenId,
            mediaKind: "provider",
            provider: runtime.provider,
            embedBase: runtime.embedBase,
          });
        },
      };
      iframe.addEventListener("load", runtime.loadHandler);
      iframe.addEventListener("error", runtime.errorHandler);
      providerOverlays.set(screenId, runtime);
      return runtime;
    };

    const removeProviderOverlay = (screenId: string) => {
      const entry = providerOverlays.get(screenId);
      if (!entry) return;
      entry.iframe.removeEventListener("load", entry.loadHandler);
      entry.iframe.removeEventListener("error", entry.errorHandler);
      entry.iframe.src = "about:blank";
      if (entry.host.parentNode === providerLayer) {
        providerLayer.removeChild(entry.host);
      }
      providerOverlays.delete(screenId);
    };

    const makeScreenRuntime = (id: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = SCREEN_CANVAS_WIDTH;
      canvas.height = SCREEN_CANVAS_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const geometry = makeScreenGeometry();
      const mesh = new THREE.Mesh(geometry, material);
      screenGroup.add(mesh);
      const handleGroup = new THREE.Group();
      handleGroup.visible = false;
      const handles: THREE.Mesh[] = [];
      const handleConfigs: Array<{ key: ScreenHandleKey; corner: boolean }> = [
        { key: "nw", corner: true },
        { key: "ne", corner: true },
        { key: "sw", corner: true },
        { key: "se", corner: true },
        { key: "n", corner: false },
        { key: "s", corner: false },
        { key: "e", corner: false },
        { key: "w", corner: false },
      ];
      handleConfigs.forEach((config) => {
        const handle = new THREE.Mesh(
          new THREE.SphereGeometry(config.corner ? 0.055 : 0.045, 12, 12),
          new THREE.MeshBasicMaterial({
            color: config.corner ? 0xf0f7ff : 0x9ac2ff,
            transparent: true,
            opacity: config.corner ? 0.95 : 0.82,
            depthTest: false,
            depthWrite: false,
          })
        );
        handle.visible = true;
        handle.renderOrder = 999;
        handle.userData.handleKey = config.key;
        handle.userData.screenId = id;
        handleGroup.add(handle);
        handles.push(handle);
      });
      screenGroup.add(handleGroup);
      const runtime: RuntimeScreen = {
        id,
        mesh,
        handleGroup,
        handles,
        texture,
        canvas,
        ctx,
        image: null,
        imageSrc: null,
        video: null,
        videoSrc: null,
        signature: "",
        basePositions: ((geometry.getAttribute("position").array as Float32Array).slice(0) as Float32Array),
        bendSignature: "",
      };
      runtimeScreens.set(id, runtime);
      return runtime;
    };

    const updateRuntimeScreenGeometry = (runtime: RuntimeScreen, card: ScreenCard) => {
      const bendValue = typeof card.bend === "number" ? card.bend : 0;
      const signature = `${bendValue.toFixed(3)}`;
      if (runtime.bendSignature === signature) return;
      runtime.bendSignature = signature;
      const posAttr = runtime.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const base = runtime.basePositions;
      const bend = THREE.MathUtils.clamp(bendValue, -2.5, 2.5);
      const amplitude = bend * 0.22;
      for (let i = 0; i < arr.length; i += 3) {
        const baseX = base[i];
        const nx = baseX / SCREEN_HALF_WIDTH;
        arr[i] = baseX;
        arr[i + 1] = base[i + 1];
        arr[i + 2] = amplitude * (1 - nx * nx);
      }
      posAttr.needsUpdate = true;
      runtime.mesh.geometry.computeVertexNormals();
    };

    const requestRuntimeVideoPlay = (card: ScreenCard, video: HTMLVideoElement) => {
      const tryPlay = video.play();
      if (!tryPlay) return;
      tryPlay.catch(() => {
        if (video.dataset.autoplayFallback === "1") {
          setScreenStatusMessage(card.id, "Playback blocked until user interaction.");
          return;
        }
        video.dataset.autoplayFallback = "1";
        video.muted = true;
        video.volume = 0;
        video
          .play()
          .then(() => {
            updateScreenCard(card.id, { mediaMuted: true });
            setScreenStatusMessage(card.id, "Autoplay started muted. Use Media Dock to unmute.");
          })
          .catch(() => {
            setScreenStatusMessage(card.id, "Playback blocked until user interaction.");
          });
      });
    };

    const drawRuntimeScreen = (
      runtime: RuntimeScreen,
      card: ScreenCard,
      active: boolean,
      hovered: boolean,
      audioPolicyContext: { soloIds: Set<string>; hasSolo: boolean }
    ) => {
      const dynamicMedia = card.mediaKind === "video" || (card.mediaKind === "gif" && card.mediaPlaying);
      const audioOnly = card.audioOnly || (Boolean(card.audioUrl) && (!card.mediaUrl || card.mediaKind === "none"));
      const cardAudioPolicy = normalizeAudioPolicy(card.audioPolicy);
      const policyMute = audioPolicyContext.hasSolo && !audioPolicyContext.soloIds.has(card.id);
      const policyVolume = resolveAudioPolicyGain(cardAudioPolicy, audioPolicyContext.hasSolo);
      const hasVisualMedia = Boolean(card.mediaUrl) && !audioOnly;
      const frameVisible = card.showFrame && !hasVisualMedia;
      const showChrome = frameVisible && hovered;
      const mediaFidelity = THREE.MathUtils.clamp(mediaFidelityRef.current, 0, 1);
      const mediaFilter = `brightness(${(1 + mediaFidelity * 0.2).toFixed(3)}) saturate(${(1 + mediaFidelity * 0.18).toFixed(
        3
      )}) contrast(${(1 + mediaFidelity * 0.12).toFixed(3)})`;
      const signature =
        `${card.label}|${card.shape}|${card.text}|${card.mediaUrl ?? ""}|${card.mediaKind}|${card.mediaPlaying}|${card.mediaMuted}|` +
        `${card.audioUrl ?? ""}|${card.audioPlaying}|${card.showFrame}|${card.visible}|${audioOnly}|${active}|${hovered}`;
      if (runtime.signature === signature && !dynamicMedia) return;
      runtime.signature = signature;
      if (card.mediaKind !== "video" && runtime.video) {
        screenMediaTimeRef.current.set(card.id, Number.isFinite(runtime.video.currentTime) ? runtime.video.currentTime : 0);
        runtime.video.pause();
        runtime.video.src = "";
        runtime.video = null;
        runtime.videoSrc = null;
      }
      if (card.mediaKind === "provider") {
        runtime.image = null;
        runtime.imageSrc = null;
      }
      const { ctx, canvas } = runtime;
      const w = canvas.width;
      const h = canvas.height;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, w, h);

      const makeShapePath = () => {
        const inset = 18;
        ctx.beginPath();
        if (card.shape === "round") {
          const cx = w / 2;
          const cy = h / 2;
          const rx = w * 0.42;
          const ry = h * 0.39;
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          return;
        }
        if (card.shape === "diamond") {
          ctx.moveTo(w / 2, inset);
          ctx.lineTo(w - inset, h / 2);
          ctx.lineTo(w / 2, h - inset);
          ctx.lineTo(inset, h / 2);
          ctx.closePath();
          return;
        }
        const radius = 24;
        ctx.moveTo(inset + radius, inset);
        ctx.lineTo(w - inset - radius, inset);
        ctx.quadraticCurveTo(w - inset, inset, w - inset, inset + radius);
        ctx.lineTo(w - inset, h - inset - radius);
        ctx.quadraticCurveTo(w - inset, h - inset, w - inset - radius, h - inset);
        ctx.lineTo(inset + radius, h - inset);
        ctx.quadraticCurveTo(inset, h - inset, inset, h - inset - radius);
        ctx.lineTo(inset, inset + radius);
        ctx.quadraticCurveTo(inset, inset, inset + radius, inset);
        ctx.closePath();
      };

      makeShapePath();
      ctx.save();
      ctx.clip();

      if (frameVisible || !card.mediaUrl) {
        const bg = ctx.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, active ? "rgba(100,170,255,0.34)" : "rgba(16,26,44,0.78)");
        bg.addColorStop(1, "rgba(3,9,18,0.68)");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
      }

      const drawRect = frameVisible
        ? {
            x: SCREEN_FRAME_INSET_PX,
            y: SCREEN_FRAME_INSET_PX,
            w: w - SCREEN_FRAME_INSET_PX * 2,
            h: h - SCREEN_FRAME_INSET_PX * 2,
          }
        : { x: 0, y: 0, w, h };
      if (card.mediaUrl) {
        if (card.mediaKind === "video") {
          const dockVideo = mediaDockVideoRef.current;
          const dockMode = mediaDockModeRef.current;
          const dockCollapsed = mediaDockCollapsedRef.current;
          const useDockProjection =
            dockMode === "player" &&
            card.id === activeScreenIdRef.current &&
            !dockCollapsed &&
            !!dockVideo &&
            dockVideo.dataset.mediaSrc === card.mediaUrl;
          // Playback mute should be controlled by screen state, not by selection.
          // Dock ownership can still temporarily claim audio routing for the active screen.
          const dockOwnsAudio = mediaDockAudioMasterRef.current && card.id === activeScreenIdRef.current;
          const sceneMuted = card.mediaMuted || policyMute;
          const runtimeMuted = sceneMuted || dockOwnsAudio;
          const runtimeVolume = runtimeMuted ? 0 : policyVolume;
          const projectionMuted = sceneMuted;
          const projectionVolume = projectionMuted ? 0 : policyVolume;
          const projectionVideo = useDockProjection ? dockVideo : null;
          if (runtime.videoSrc !== card.mediaUrl) {
            if (runtime.video) {
              screenMediaTimeRef.current.set(card.id, Number.isFinite(runtime.video.currentTime) ? runtime.video.currentTime : 0);
              runtime.video.pause();
              runtime.video.src = "";
            }
            runtime.videoSrc = card.mediaUrl;
            const video = document.createElement("video");
            video.src = card.mediaUrl;
            video.loop = true;
            video.muted = runtimeMuted;
            video.volume = runtimeVolume;
            video.playsInline = true;
            video.preload = "auto";
            video.crossOrigin = "anonymous";
            video.setAttribute("crossorigin", "anonymous");
            video.setAttribute("playsinline", "true");
            video.setAttribute("webkit-playsinline", "true");
            video.controls = false;
            video.disablePictureInPicture = true;
            const detectHasAudio = () => {
              const anyVideo = video as HTMLVideoElement & {
                mozHasAudio?: boolean;
                webkitAudioDecodedByteCount?: number;
                audioTracks?: { length: number };
              };
              const hasMoz = typeof anyVideo.mozHasAudio === "boolean" ? anyVideo.mozHasAudio : null;
              const hasTracks =
                typeof anyVideo.audioTracks?.length === "number" ? anyVideo.audioTracks.length > 0 : null;
              const hasDecoded =
                typeof anyVideo.webkitAudioDecodedByteCount === "number"
                  ? anyVideo.webkitAudioDecodedByteCount > 0
                  : null;
              let hasAudio = true;
              if (hasMoz === true || hasTracks === true || hasDecoded === true) {
                hasAudio = true;
              } else if (hasMoz === false && hasTracks === false && (hasDecoded === false || hasDecoded === null)) {
                hasAudio = false;
              }
              setScreenMediaHasAudio(card.id, hasAudio);
            };
            video.onloadedmetadata = () => {
              const saved = screenMediaTimeRef.current.get(card.id);
              if (typeof saved === "number" && Number.isFinite(saved) && saved > 0.05) {
                const target = Math.min(saved, Math.max(0, (video.duration || saved) - 0.05));
                try {
                  video.currentTime = target;
                } catch {
                  // Ignore seek errors on metadata edge cases.
                }
              }
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                setScreenMediaResolution(card.id, video.videoWidth, video.videoHeight);
              }
              detectHasAudio();
            };
            video.onloadeddata = () => {
              setScreenStatusMessage(card.id, "Video ready");
              detectHasAudio();
            };
            video.onerror = () => {
              setScreenStatusMessage(card.id, "Video failed to load. Try another URL/file.");
            };
            if (card.mediaPlaying) {
              requestRuntimeVideoPlay(card, video);
            }
            runtime.video = video;
          }
          if (runtime.video) {
            if (runtime.video.muted !== runtimeMuted) {
              runtime.video.muted = runtimeMuted;
            }
            if (Math.abs(runtime.video.volume - runtimeVolume) > 0.001) {
              runtime.video.volume = runtimeVolume;
            }
            if (card.mediaPlaying) {
              requestRuntimeVideoPlay(card, runtime.video);
            } else {
              runtime.video.pause();
            }
            screenMediaTimeRef.current.set(card.id, Number.isFinite(runtime.video.currentTime) ? runtime.video.currentTime : 0);
          }
          if (projectionVideo) {
            if (projectionVideo.loop !== (card.mediaKind === "gif")) {
              projectionVideo.loop = card.mediaKind === "gif";
            }
            if (projectionVideo.muted !== projectionMuted) {
              projectionVideo.muted = projectionMuted;
            }
            if (Math.abs(projectionVideo.volume - projectionVolume) > 0.001) {
              projectionVideo.volume = projectionVolume;
            }
            if (runtime.video && projectionVideo.readyState >= 2 && runtime.video.readyState >= 1) {
              const projectionTime = Number.isFinite(projectionVideo.currentTime) ? projectionVideo.currentTime : 0;
              const runtimeTime = Number.isFinite(runtime.video.currentTime) ? runtime.video.currentTime : 0;
              const drift = Math.abs(projectionTime - runtimeTime);
              if (drift > 0.16) {
                const authority = playbackAuthorityRef.current;
                if (authority === "dock") {
                  try {
                    runtime.video.currentTime = projectionTime;
                  } catch {
                    // Ignore cross-seek edge cases.
                  }
                } else {
                  try {
                    projectionVideo.currentTime = runtimeTime;
                  } catch {
                    // Ignore cross-seek edge cases.
                  }
                }
              }
            }
            screenMediaTimeRef.current.set(card.id, Number.isFinite(projectionVideo.currentTime) ? projectionVideo.currentTime : 0);
          }
          const drawVideo = projectionVideo ?? runtime.video;
          if (drawVideo) {
            if (drawVideo.readyState >= 2) {
              ctx.globalAlpha = 1;
              try {
                ctx.filter = mediaFilter;
                ctx.drawImage(drawVideo, drawRect.x, drawRect.y, drawRect.w, drawRect.h);
                if (drawVideo.videoWidth > 0 && drawVideo.videoHeight > 0) {
                  setScreenMediaResolution(card.id, drawVideo.videoWidth, drawVideo.videoHeight);
                  setScreenStatusMessage(card.id, "");
                }
              } catch {
                setScreenStatusMessage(card.id, "Video cannot render here (browser/CORS restriction).");
              } finally {
                ctx.filter = "none";
              }
              ctx.globalAlpha = 1;
            }
          }
        } else if (card.mediaKind === "provider") {
          setScreenMediaResolution(card.id, 1920, 1080);
          ctx.fillStyle = "rgba(7, 12, 20, 0.74)";
          ctx.fillRect(drawRect.x, drawRect.y, drawRect.w, drawRect.h);
          ctx.fillStyle = "rgba(194, 218, 255, 0.9)";
          ctx.font = "600 28px 'IBM Plex Mono', monospace";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          const providerLabel = card.mediaProvider ? card.mediaProvider.toUpperCase() : "PROVIDER";
          ctx.fillText(`${providerLabel} STREAM`, drawRect.x + 16, drawRect.y + 14);
          ctx.fillStyle = "rgba(158, 186, 226, 0.82)";
          ctx.font = "500 20px 'IBM Plex Mono', monospace";
          ctx.fillText(card.mediaPlaying ? "LIVE EMBED ON" : "PAUSED EMBED", drawRect.x + 16, drawRect.y + 48);
        } else {
          if (runtime.imageSrc !== card.mediaUrl) {
            runtime.imageSrc = card.mediaUrl;
            runtime.image = new Image();
            runtime.image.onload = () => {
              if (runtime.image) {
                setScreenMediaResolution(card.id, runtime.image.naturalWidth, runtime.image.naturalHeight);
              }
              runtime.signature = "";
              setScreenStatusMessage(card.id, "");
            };
            runtime.image.onerror = () => {
              setScreenStatusMessage(card.id, "Image failed to load. Check URL/CORS policy.");
            };
            runtime.image.src = card.mediaUrl;
          }
          if (runtime.image && runtime.image.complete) {
            ctx.globalAlpha = 1;
            try {
              ctx.filter = mediaFilter;
              ctx.drawImage(runtime.image, drawRect.x, drawRect.y, drawRect.w, drawRect.h);
              setScreenStatusMessage(card.id, "");
            } catch {
              setScreenStatusMessage(card.id, "Image cannot render here (browser/CORS restriction).");
            } finally {
              ctx.filter = "none";
            }
            ctx.globalAlpha = 1;
          }
        }
      }
      if (!card.mediaUrl || audioOnly) {
        setScreenMediaResolution(card.id, null, null);
      }
      if (audioOnly) {
        const iconSize = Math.max(32, Math.min(drawRect.w, drawRect.h) * 0.18);
        const iconX = drawRect.x + drawRect.w * 0.5;
        const iconY = drawRect.y + drawRect.h * 0.5;
        const pulseRadius = iconSize * (card.audioPlaying ? 1.06 : 0.92);
        ctx.fillStyle = card.audioPlaying ? "rgba(94, 172, 255, 0.26)" : "rgba(144, 174, 210, 0.18)";
        ctx.beginPath();
        ctx.arc(iconX, iconY, pulseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = card.audioPlaying ? "rgba(220, 238, 255, 0.95)" : "rgba(190, 205, 226, 0.82)";
        const bodyW = iconSize * 0.3;
        const bodyH = iconSize * 0.34;
        const hornW = iconSize * 0.24;
        const left = iconX - iconSize * 0.32;
        const top = iconY - bodyH * 0.5;
        ctx.beginPath();
        ctx.moveTo(left, top + bodyH * 0.28);
        ctx.lineTo(left + bodyW, top + bodyH * 0.28);
        ctx.lineTo(left + bodyW + hornW, top);
        ctx.lineTo(left + bodyW + hornW, top + bodyH);
        ctx.lineTo(left + bodyW, top + bodyH * 0.72);
        ctx.lineTo(left, top + bodyH * 0.72);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = card.audioPlaying ? "rgba(220, 238, 255, 0.92)" : "rgba(190, 205, 226, 0.74)";
        ctx.lineWidth = Math.max(2, iconSize * 0.06);
        ctx.lineCap = "round";
        ctx.beginPath();
        if (card.audioPlaying) {
          ctx.arc(iconX + iconSize * 0.05, iconY, iconSize * 0.24, -0.7, 0.7);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(iconX + iconSize * 0.12, iconY, iconSize * 0.36, -0.7, 0.7);
          ctx.stroke();
        } else {
          ctx.moveTo(iconX + iconSize * 0.03, iconY - iconSize * 0.3);
          ctx.lineTo(iconX + iconSize * 0.35, iconY + iconSize * 0.3);
          ctx.stroke();
        }
      }

      ctx.restore();
      if (showChrome) {
        makeShapePath();
        ctx.strokeStyle = active ? "rgba(173,220,255,0.95)" : "rgba(157,189,224,0.6)";
        ctx.lineWidth = 8;
        ctx.stroke();
      }

      if ((frameVisible || !card.mediaUrl) && !audioOnly) {
        ctx.font = "700 46px 'IBM Plex Mono', monospace";
        const wrapLines: string[] = [];
        const rawLines = (card.text || "").replace(/\r/g, "").split("\n");
        const maxWidth = w - 106;
        rawLines.forEach((raw) => {
          if (wrapLines.length >= 9) return;
          if (raw.length === 0) {
            wrapLines.push("");
            return;
          }
          const words = raw.split(" ");
          let current = "";
          words.forEach((word) => {
            if (word.length > 0 && ctx.measureText(word.toUpperCase()).width > maxWidth) {
              let chunk = "";
              for (const ch of word) {
                const proposal = `${chunk}${ch}`;
                if (ctx.measureText(proposal.toUpperCase()).width > maxWidth && chunk) {
                  wrapLines.push(chunk);
                  chunk = ch;
                } else {
                  chunk = proposal;
                }
              }
              if (chunk) {
                if (current) wrapLines.push(current);
                current = chunk;
              }
              return;
            }
            const proposal = current ? `${current} ${word}` : word;
            if (ctx.measureText(proposal.toUpperCase()).width > maxWidth && current) {
              wrapLines.push(current);
              current = word;
            } else {
              current = proposal;
            }
          });
          if (current) {
            wrapLines.push(current);
          }
        });
        const lines = wrapLines.slice(0, 9);
        if (lines.length > 0) {
          const lineCount = Math.max(1, lines.length);
          const dynamicFont = Math.max(28, 50 - (lineCount - 1) * 2.6);
          const lineHeight = dynamicFont * 1.2;
          ctx.font = `700 ${dynamicFont}px 'IBM Plex Mono', monospace`;
          ctx.fillStyle = "rgba(241,248,255,0.98)";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          lines.forEach((line, index) => {
            ctx.fillText(line.toUpperCase(), 54, 58 + index * lineHeight);
          });
        }
      }
      if (showChrome) {
        ctx.font = "600 28px 'IBM Plex Mono', monospace";
        ctx.fillStyle = "rgba(186, 216, 255, 0.9)";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(card.label.toUpperCase(), w - 42, h - 34);
      }
      runtime.texture.needsUpdate = true;
    };

    const syncRuntimeScreens = (deltaSeconds = 1 / 60) => {
      const cards = screensRef.current;
      const soloIds = collectSoloAudioScreenIds(cards);
      const hasActiveScreenSelection = sceneSelectionRef.current === "screen";
      const audioPolicyContext = {
        soloIds,
        hasSolo: soloIds.size > 0,
      };
      cards.forEach((card) => {
        const runtime = runtimeScreens.get(card.id) ?? makeScreenRuntime(card.id);
        if (!runtime) return;
        const profilePresentationHiddenScreen =
          isProfilePresentation && (card.id === "screen-b" || card.id === "screen-c");
        const active = hasActiveScreenSelection && activeScreenIdRef.current === card.id;
        const hovered = hoveredScreenId === card.id;
        drawRuntimeScreen(runtime, card, active, hovered, audioPolicyContext);
        updateRuntimeScreenGeometry(runtime, card);
        runtime.mesh.visible = screensEnabledRef.current && card.visible && !profilePresentationHiddenScreen;
        const mediaMaterial = runtime.mesh.material as THREE.MeshBasicMaterial;
        const shouldToneMap = mediaFidelityRef.current < 0.5;
        if (mediaMaterial.toneMapped !== shouldToneMap) {
          mediaMaterial.toneMapped = shouldToneMap;
          mediaMaterial.needsUpdate = true;
        }
        screenTargetPos.set(card.x, card.y, card.z);
        const targetYaw = THREE.MathUtils.degToRad(card.yaw);
        const width = typeof card.width === "number" ? card.width : 1;
        const height = typeof card.height === "number" ? card.height : 1;
        screenTargetScale.set(card.scale * width, card.scale * height, card.scale);
        const directManipulation =
          (dragState.active && dragState.id === card.id) || (screenScaleDragState.active && screenScaleDragState.screenId === card.id);
        if (directManipulation) {
          runtime.mesh.position.copy(screenTargetPos);
          runtime.mesh.rotation.y = targetYaw;
          runtime.mesh.scale.copy(screenTargetScale);
        } else {
          const smooth = THREE.MathUtils.clamp(1 - Math.exp(-deltaSeconds * 16), 0.08, 0.38);
          runtime.mesh.position.lerp(screenTargetPos, smooth);
          runtime.mesh.rotation.y = THREE.MathUtils.lerp(runtime.mesh.rotation.y, targetYaw, smooth);
          runtime.mesh.scale.lerp(screenTargetScale, smooth);
        }
        runtime.handleGroup.visible =
          screensEnabledRef.current && card.visible && active && !profilePresentationHiddenScreen;
        runtime.handleGroup.position.copy(runtime.mesh.position);
        runtime.handleGroup.quaternion.copy(runtime.mesh.quaternion);
        const halfW = SCREEN_HALF_WIDTH * runtime.mesh.scale.x;
        const halfH = SCREEN_HALF_HEIGHT * runtime.mesh.scale.y;
        runtime.handles.forEach((handle) => {
          const handleKey = handle.userData.handleKey as ScreenHandleKey;
          let hx = 0;
          let hy = 0;
          if (handleKey.includes("e")) hx = halfW;
          if (handleKey.includes("w")) hx = -halfW;
          if (handleKey.includes("n")) hy = halfH;
          if (handleKey.includes("s")) hy = -halfH;
          handle.position.set(hx, hy, 0.05);
        });
      });
      runtimeScreens.forEach((runtime, id) => {
        if (!cards.some((card) => card.id === id)) {
          if (runtime.video) {
            runtime.video.pause();
            runtime.video.src = "";
          }
          screenGroup.remove(runtime.mesh);
          screenGroup.remove(runtime.handleGroup);
          runtime.mesh.geometry.dispose();
          const mat = runtime.mesh.material as THREE.MeshBasicMaterial;
          mat.map?.dispose();
          mat.dispose();
          runtime.handles.forEach((handle) => {
            handle.geometry.dispose();
            const handleMaterial = handle.material as THREE.Material;
            handleMaterial.dispose();
          });
          removeProviderOverlay(id);
          runtimeScreens.delete(id);
        }
      });
      screenGroup.visible = screensEnabledRef.current;
    };

    const syncProviderOverlays = () => {
      if (!providerLayer) return;
      const activeIds = new Set<string>();
      const cards = screensRef.current;
      const soloIds = collectSoloAudioScreenIds(cards);
      const hasSolo = soloIds.size > 0;
      const hasActiveScreenSelection = sceneSelectionRef.current === "screen";
      cards.forEach((card) => {
        if (card.mediaKind !== "provider" || !card.mediaProvider || !card.mediaEmbedBase || !card.mediaUrl) return;
        const runtime = runtimeScreens.get(card.id);
        if (!runtime || !runtime.mesh.visible || !screensEnabledRef.current || !card.visible) return;
        const overlay = ensureProviderOverlay(card.id);
        if (!overlay) return;
        activeIds.add(card.id);
        const policyMute = hasSolo && !soloIds.has(card.id);
        const dockOwnsAudio = mediaDockAudioMasterRef.current && card.id === activeScreenIdRef.current;
        overlay.desiredPlaying = card.mediaPlaying;
        overlay.desiredMuted = card.mediaMuted || dockOwnsAudio || policyMute;
        const nextSrc = buildProviderEmbedUrl(card.mediaProvider, card.mediaEmbedBase, {
          autoplay: true,
          muted: true,
          loop: false,
        });
        if (overlay.src !== nextSrc || overlay.provider !== card.mediaProvider || overlay.embedBase !== card.mediaEmbedBase) {
          overlay.provider = card.mediaProvider;
          overlay.embedBase = card.mediaEmbedBase;
          overlay.ready = false;
          overlay.appliedPlaying = null;
          overlay.appliedMuted = null;
          overlay.iframe.src = nextSrc;
          overlay.src = nextSrc;
          setScreenStatusMessage(card.id, "Loading provider stream...");
          emitSceneApiEvent("providerLoading", {
            screenId: card.id,
            provider: card.mediaProvider,
            embedBase: card.mediaEmbedBase,
          });
        } else {
          applyProviderMediaState(card.id, overlay);
        }

        if (card.audioOnly) {
          overlay.host.style.opacity = "0";
          overlay.host.style.pointerEvents = "none";
          return;
        }

        runtime.mesh.getWorldPosition(providerCenterWorld);
        runtime.mesh.getWorldQuaternion(providerWorldQuat);
        providerNormalWorld.set(0, 0, 1).applyQuaternion(providerWorldQuat).normalize();
        providerToCamera.copy(camera.position).sub(providerCenterWorld).normalize();
        const facingCamera = providerNormalWorld.dot(providerToCamera) > 0.02;

        const frameInsetX = 0;
        const frameInsetY = 0;
        const localMinX = -SCREEN_HALF_WIDTH + SCREEN_GEOMETRY_WIDTH * frameInsetX;
        const localMaxX = SCREEN_HALF_WIDTH - SCREEN_GEOMETRY_WIDTH * frameInsetX;
        const localMinY = -SCREEN_HALF_HEIGHT + SCREEN_GEOMETRY_HEIGHT * frameInsetY;
        const localMaxY = SCREEN_HALF_HEIGHT - SCREEN_GEOMETRY_HEIGHT * frameInsetY;
        const depthOffset = 0.001;

        runtime.mesh.localToWorld(providerCornerWorldA.set(localMinX, localMaxY, depthOffset));
        runtime.mesh.localToWorld(providerCornerWorldB.set(localMaxX, localMaxY, depthOffset));
        runtime.mesh.localToWorld(providerCornerWorldC.set(localMaxX, localMinY, depthOffset));
        runtime.mesh.localToWorld(providerCornerWorldD.set(localMinX, localMinY, depthOffset));

        providerCornerNdcA.copy(providerCornerWorldA).project(camera);
        providerCornerNdcB.copy(providerCornerWorldB).project(camera);
        providerCornerNdcC.copy(providerCornerWorldC).project(camera);
        providerCornerNdcD.copy(providerCornerWorldD).project(camera);

        const clipSpaceVisible =
          Number.isFinite(providerCornerNdcA.x) &&
          Number.isFinite(providerCornerNdcA.y) &&
          Number.isFinite(providerCornerNdcA.z) &&
          providerCornerNdcA.z > -1.2 &&
          providerCornerNdcA.z < 1.2 &&
          Number.isFinite(providerCornerNdcB.x) &&
          Number.isFinite(providerCornerNdcB.y) &&
          Number.isFinite(providerCornerNdcB.z) &&
          providerCornerNdcB.z > -1.2 &&
          providerCornerNdcB.z < 1.2 &&
          Number.isFinite(providerCornerNdcC.x) &&
          Number.isFinite(providerCornerNdcC.y) &&
          Number.isFinite(providerCornerNdcC.z) &&
          providerCornerNdcC.z > -1.2 &&
          providerCornerNdcC.z < 1.2 &&
          Number.isFinite(providerCornerNdcD.x) &&
          Number.isFinite(providerCornerNdcD.y) &&
          Number.isFinite(providerCornerNdcD.z) &&
          providerCornerNdcD.z > -1.2 &&
          providerCornerNdcD.z < 1.2;
        if (!facingCamera || !clipSpaceVisible) {
          overlay.host.style.opacity = "0";
          overlay.host.style.pointerEvents = "none";
          return;
        }

        providerCornersTo[0].x = ((providerCornerNdcA.x + 1) * 0.5) * renderer.domElement.clientWidth;
        providerCornersTo[0].y = ((-providerCornerNdcA.y + 1) * 0.5) * renderer.domElement.clientHeight;
        providerCornersTo[1].x = ((providerCornerNdcB.x + 1) * 0.5) * renderer.domElement.clientWidth;
        providerCornersTo[1].y = ((-providerCornerNdcB.y + 1) * 0.5) * renderer.domElement.clientHeight;
        providerCornersTo[2].x = ((providerCornerNdcC.x + 1) * 0.5) * renderer.domElement.clientWidth;
        providerCornersTo[2].y = ((-providerCornerNdcC.y + 1) * 0.5) * renderer.domElement.clientHeight;
        providerCornersTo[3].x = ((providerCornerNdcD.x + 1) * 0.5) * renderer.domElement.clientWidth;
        providerCornersTo[3].y = ((-providerCornerNdcD.y + 1) * 0.5) * renderer.domElement.clientHeight;

        const screenMinX = Math.min(providerCornersTo[0].x, providerCornersTo[1].x, providerCornersTo[2].x, providerCornersTo[3].x);
        const screenMaxX = Math.max(providerCornersTo[0].x, providerCornersTo[1].x, providerCornersTo[2].x, providerCornersTo[3].x);
        const screenMinY = Math.min(providerCornersTo[0].y, providerCornersTo[1].y, providerCornersTo[2].y, providerCornersTo[3].y);
        const screenMaxY = Math.max(providerCornersTo[0].y, providerCornersTo[1].y, providerCornersTo[2].y, providerCornersTo[3].y);
        const occlusionSamples =
          performanceTierRef.current === "fast"
            ? providerOcclusionUvSamplesFast
            : performanceTierRef.current === "balanced"
              ? providerOcclusionUvSamplesBalanced
              : providerOcclusionUvSamples;
        let visibleSampleCount = 0;
        for (let i = 0; i < occlusionSamples.length; i += 1) {
          const sample = occlusionSamples[i];
          providerOcclusionSampleWorld.set(
            THREE.MathUtils.lerp(localMinX, localMaxX, sample.u),
            THREE.MathUtils.lerp(localMinY, localMaxY, sample.v),
            depthOffset
          );
          runtime.mesh.localToWorld(providerOcclusionSampleWorld);
          if (!isProviderSampleOccluded(providerOcclusionSampleWorld)) {
            visibleSampleCount += 1;
          }
        }
        const visibleRatio = visibleSampleCount / occlusionSamples.length;
        const minVisibleRatio =
          performanceTierRef.current === "fast" ? 0.68 : performanceTierRef.current === "balanced" ? 0.8 : 0.9;
        const inView =
          screenMaxX >= -120 &&
          screenMinX <= renderer.domElement.clientWidth + 120 &&
          screenMaxY >= -120 &&
          screenMinY <= renderer.domElement.clientHeight + 120 &&
          (screenMaxX - screenMinX) * (screenMaxY - screenMinY) > 260 &&
          visibleRatio >= minVisibleRatio;
        if (!inView) {
          overlay.host.style.opacity = "0";
          overlay.host.style.pointerEvents = "none";
          return;
        }

        const matrix = buildProviderQuadTransform(providerCornersTo);
        if (!matrix) {
          overlay.host.style.opacity = "0";
          overlay.host.style.pointerEvents = "none";
          return;
        }
        overlay.host.style.opacity = "1";
        overlay.host.style.pointerEvents = hasActiveScreenSelection && activeScreenIdRef.current === card.id ? "auto" : "none";
        overlay.host.style.transform = matrix;
      });

      providerOverlays.forEach((_entry, id) => {
        if (!activeIds.has(id)) {
          removeProviderOverlay(id);
        }
      });
    };

    const resolveProviderOverlayFromSource = (source: MessageEventSource | null) => {
      if (!source) return null;
      for (const [screenId, overlay] of providerOverlays.entries()) {
        if (overlay.iframe.contentWindow === source) {
          return { screenId, overlay };
        }
      }
      return null;
    };

    const parseProviderPayload = (raw: unknown): Record<string, unknown> | null => {
      if (isObjectRecord(raw)) return raw;
      if (typeof raw !== "string" || raw.length === 0) return null;
      try {
        const parsed = JSON.parse(raw) as unknown;
        return isObjectRecord(parsed) ? parsed : null;
      } catch {
        return null;
      }
    };

    const onProviderMessage = (event: MessageEvent<unknown>) => {
      const match = resolveProviderOverlayFromSource(event.source);
      if (!match) return;
      const { screenId, overlay } = match;
      if (!isTrustedProviderOrigin(overlay.provider, event.origin)) return;
      const payload = parseProviderPayload(event.data);
      if (!payload) return;

      if (!overlay.ready) {
        overlay.ready = true;
        primeProviderEvents(overlay);
        applyProviderMediaState(screenId, overlay, true);
        setScreenStatusMessage(screenId, "Provider ready");
        emitSceneApiEvent("providerReady", {
          screenId,
          provider: overlay.provider,
          embedBase: overlay.embedBase,
          via: "message",
        });
      }

      if (overlay.provider === "youtube") {
        const eventName = typeof payload.event === "string" ? payload.event : "";
        if (eventName === "onError") {
          setScreenStatusMessage(screenId, "Provider playback error.");
          emitSceneApiEvent("mediaError", {
            screenId,
            mediaKind: "provider",
            provider: overlay.provider,
            code: payload.info,
          });
          return;
        }
        if (eventName === "onStateChange") {
          const info = typeof payload.info === "number" ? payload.info : null;
          const state =
            info === 1
              ? "playing"
              : info === 2
                ? "paused"
                : info === 3
                  ? "buffering"
                  : info === 0
                    ? "ended"
                    : info === 5
                      ? "cued"
                      : "idle";
          emitSceneApiEvent("providerState", {
            screenId,
            mediaKind: "provider",
            provider: "youtube",
            state,
            code: info,
          });
        }
        return;
      }

      if (overlay.provider === "vimeo") {
        const eventName = typeof payload.event === "string" ? payload.event : "";
        if (eventName === "error") {
          setScreenStatusMessage(screenId, "Provider playback error.");
          emitSceneApiEvent("mediaError", {
            screenId,
            mediaKind: "provider",
            provider: overlay.provider,
            details: payload.data,
          });
          return;
        }
        if (eventName === "play" || eventName === "pause" || eventName === "ended") {
          emitSceneApiEvent("providerState", {
            screenId,
            mediaKind: "provider",
            provider: "vimeo",
            state: eventName,
          });
        }
      }
    };

    window.addEventListener("message", onProviderMessage);

    const toNdc = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const getSelectionFocusPoint = (selection: SceneSelectionKind) => {
      if (selection === "screen") {
        const runtime = runtimeScreens.get(activeScreenIdRef.current);
        if (!runtime || !runtime.mesh.visible) return null;
        runtime.mesh.getWorldPosition(focusTargetWorld);
        focusTargetWorld.y += 0.18 * runtime.mesh.scale.y;
        return { point: focusTargetWorld, distance: Math.max(1.5, runtime.mesh.scale.length() * 1.4) };
      }
      if (selection === "light-key") {
        focusTargetWorld.copy(keyMarker.position);
        return { point: focusTargetWorld, distance: 2.4 };
      }
      if (selection === "light-fill") {
        focusTargetWorld.copy(fillMarker.position);
        return { point: focusTargetWorld, distance: 2.4 };
      }
      if (selection === "light-target") {
        focusTargetWorld.copy(targetMarker.position);
        return { point: focusTargetWorld, distance: 2.2 };
      }
      if (selection === "model" && modelRoot) {
        modelRig.getWorldPosition(focusTargetWorld);
        focusTargetWorld.y += 0.9;
        return { point: focusTargetWorld, distance: 3.2 };
      }
      return null;
    };

    const frameSelectionInView = () => {
      const selection = sceneSelectionRef.current;
      const focus = getSelectionFocusPoint(selection);
      if (!focus) return;
      focusDirectionWorld.copy(camera.position).sub(controls.target);
      if (focusDirectionWorld.lengthSq() < 0.0001) {
        focusDirectionWorld.set(1, 0.35, 1);
      }
      focusDirectionWorld.normalize();
      camera.position.copy(focus.point).addScaledVector(focusDirectionWorld, focus.distance);
      controls.target.copy(focus.point);
      controls.update();
    };

    const cycleSceneSelection = (direction: 1 | -1) => {
      const options: SceneSelectionKind[] = ["none"];
      if (screensRef.current.length > 0) options.push("screen");
      options.push("model", "light-key", "light-fill", "light-target");
      const current = sceneSelectionRef.current;
      const index = options.indexOf(current);
      const base = index >= 0 ? index : 0;
      const next = options[(base + direction + options.length) % options.length];
      if (next === "screen") {
        const nextId = activeScreenIdRef.current || screensRef.current[0]?.id || "";
        setActiveScreenId(nextId);
        setSceneSelection(nextId ? "screen" : "none");
        return;
      }
      if (next === "none") {
        if (!selectionLockedRef.current) {
          setSceneSelection("none");
        }
        return;
      }
      if (next === "light-key" || next === "light-fill") {
        setActiveOrbitalLight(next === "light-key" ? "key" : "fill");
      }
      setSceneSelection(next);
    };

    frameSelectionRef.current = frameSelectionInView;
    cycleSelectionRef.current = cycleSceneSelection;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      toNdc(event);
      raycaster.setFromCamera(pointerNdc, camera);
      const deselectIfAllowed = () => {
        if (selectionLockedRef.current) return;
        if (sceneSelectionRef.current !== "none") {
          setSceneSelection("none");
        }
      };

      const activeRuntime = runtimeScreens.get(activeScreenIdRef.current);
      if (activeRuntime && activeRuntime.handleGroup.visible) {
        const handleHits = raycaster.intersectObjects(activeRuntime.handles, false);
        if (handleHits.length > 0) {
          const hitInfo = handleHits[0];
          const handleKey = hitInfo.object.userData.handleKey as ScreenHandleKey;
          const card = screensRef.current.find((entry) => entry.id === activeRuntime.id);
          if (card) {
            screenScaleDragState.active = true;
            screenScaleDragState.screenId = card.id;
            screenScaleDragState.handle = handleKey;
            screenScaleDragState.axisX = handleKey.includes("e") || handleKey.includes("w");
            screenScaleDragState.axisY = handleKey.includes("n") || handleKey.includes("s");
            screenScaleDragState.signX = handleKey.includes("e") ? 1 : handleKey.includes("w") ? -1 : 0;
            screenScaleDragState.signY = handleKey.includes("n") ? 1 : handleKey.includes("s") ? -1 : 0;
            screenScaleDragState.startWidth = typeof card.width === "number" ? card.width : 1;
            screenScaleDragState.startHeight = typeof card.height === "number" ? card.height : 1;
            screenScaleDragState.startScale = card.scale;
            camera.getWorldDirection(dragPlaneNormal);
            screenScaleDragState.plane.setFromNormalAndCoplanarPoint(dragPlaneNormal, hitInfo.point);
            screenScaleDragState.startPoint.copy(hitInfo.point);
            activeRuntime.mesh.getWorldPosition(screenScaleDragState.startWorldPos);
            controls.enabled = false;
            if (!inspectorLockRef.current) {
              setSceneSelection("screen");
            }
            return;
          }
        }
      }

      const lightHits = showLightMarkersRef.current
        ? raycaster.intersectObjects([keyMarker, fillMarker, targetMarker], false)
        : [];
      if (lightHits.length > 0) {
        const hitInfo = lightHits[0];
        const hitObject = hitInfo.object;
        lightDragState.active = true;
        lightDragState.kind = hitObject === keyMarker ? "key" : hitObject === fillMarker ? "fill" : "target";
        camera.getWorldDirection(dragPlaneNormal);
        lightDragState.plane.setFromNormalAndCoplanarPoint(dragPlaneNormal, hitInfo.point);
        const sourcePos =
          hitObject === keyMarker
            ? keyMarker.position
            : hitObject === fillMarker
              ? fillMarker.position
              : targetMarker.position;
        lightDragState.offset.copy(sourcePos).sub(hitInfo.point);
        controls.enabled = false;
        if (lightDragState.kind === "key" || lightDragState.kind === "fill") {
          setActiveOrbitalLight(lightDragState.kind);
        }
        if (!inspectorLockRef.current) {
          setSceneSelection(
            lightDragState.kind === "key"
              ? "light-key"
              : lightDragState.kind === "fill"
                ? "light-fill"
                : "light-target"
          );
        }
        return;
      }

      const modelHits = raycaster.intersectObjects(runtimeMeshes, true);
      if (modelHits.length > 0) {
        if (!inspectorLockRef.current) {
          setSceneSelection("model");
        }
        return;
      }

      if (!screensEnabledRef.current) {
        deselectIfAllowed();
        return;
      }
      const hits = raycaster.intersectObjects(Array.from(runtimeScreens.values()).map((entry) => entry.mesh), false);
      if (hits.length === 0) {
        deselectIfAllowed();
        return;
      }
      const hitInfo = hits[0];
      const hit = hitInfo.object as THREE.Mesh;
      const picked = Array.from(runtimeScreens.values()).find((entry) => entry.mesh === hit);
      if (!picked) return;
      dragState.id = picked.id;
      dragState.active = true;
      camera.getWorldDirection(dragPlaneNormal);
      dragState.plane.setFromNormalAndCoplanarPoint(dragPlaneNormal, hitInfo.point);
      picked.mesh.getWorldPosition(dragPlanePoint);
      dragState.offset.copy(dragPlanePoint).sub(hitInfo.point);
      controls.enabled = false;
      if (!inspectorLockRef.current || !activeScreenIdRef.current) {
        setActiveScreenId(picked.id);
      }
      if (!inspectorLockRef.current) {
        setSceneSelection("screen");
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      toNdc(event);
      raycaster.setFromCamera(pointerNdc, camera);
      if (screenScaleDragState.active) {
        if (!raycaster.ray.intersectPlane(screenScaleDragState.plane, dragHit)) return;
        const runtime = runtimeScreens.get(screenScaleDragState.screenId);
        if (!runtime) return;
        const startLocal = runtime.mesh.worldToLocal(screenScaleDragState.startPoint.clone());
        const currLocal = runtime.mesh.worldToLocal(dragHit.clone());
        const rawDx = currLocal.x - startLocal.x;
        const rawDy = currLocal.y - startLocal.y;
        const fromCenter = event.altKey;
        const uniform = event.shiftKey;
        const startScale = screenScaleDragState.startScale;
        const startWidth = screenScaleDragState.startWidth;
        const startHeight = screenScaleDragState.startHeight;
        const startHalfW = Math.max(0.0001, SCREEN_HALF_WIDTH * startScale * startWidth);
        const startHalfH = Math.max(0.0001, SCREEN_HALF_HEIGHT * startScale * startHeight);
        let halfW = startHalfW;
        let halfH = startHalfH;

        if (screenScaleDragState.axisX) {
          const delta = screenScaleDragState.signX * rawDx;
          halfW = startHalfW + delta * (fromCenter ? 1 : 0.5);
        }
        if (screenScaleDragState.axisY) {
          const delta = screenScaleDragState.signY * rawDy;
          halfH = startHalfH + delta * (fromCenter ? 1 : 0.5);
        }

        if (uniform) {
          const fx = halfW / startHalfW;
          const fy = halfH / startHalfH;
          const factor =
            screenScaleDragState.axisX && screenScaleDragState.axisY
              ? Math.abs(fx - 1) > Math.abs(fy - 1)
                ? fx
                : fy
              : screenScaleDragState.axisX
                ? fx
                : fy;
          halfW = startHalfW * factor;
          halfH = startHalfH * factor;
        }

        let nextWidth = THREE.MathUtils.clamp(halfW / (SCREEN_HALF_WIDTH * startScale), 0.35, 2.6);
        let nextHeight = THREE.MathUtils.clamp(halfH / (SCREEN_HALF_HEIGHT * startScale), 0.35, 2.6);
        if (uniform) {
          const f = Math.min(nextWidth / startWidth, nextHeight / startHeight);
          nextWidth = THREE.MathUtils.clamp(startWidth * f, 0.35, 2.6);
          nextHeight = THREE.MathUtils.clamp(startHeight * f, 0.35, 2.6);
        }
        const snapInvert = event.metaKey || event.ctrlKey;
        const snapActive = snapInvert ? !gizmoSnapEnabledRef.current : gizmoSnapEnabledRef.current;
        if (snapActive) {
          const grid = gizmoSnapGridRef.current;
          nextWidth = THREE.MathUtils.clamp(quantizeToStep(nextWidth, grid), 0.35, 2.6);
          nextHeight = THREE.MathUtils.clamp(quantizeToStep(nextHeight, grid), 0.35, 2.6);
        }
        const clampedHalfW = SCREEN_HALF_WIDTH * startScale * nextWidth;
        const clampedHalfH = SCREEN_HALF_HEIGHT * startScale * nextHeight;

        let centerShiftX = 0;
        let centerShiftY = 0;
        if (!fromCenter) {
          if (screenScaleDragState.axisX) {
            centerShiftX = (clampedHalfW - startHalfW) * screenScaleDragState.signX;
          }
          if (screenScaleDragState.axisY) {
            centerShiftY = (clampedHalfH - startHalfH) * screenScaleDragState.signY;
          }
        }

        worldShift
          .set(centerShiftX, centerShiftY, 0)
          .applyQuaternion(runtime.mesh.quaternion);
        nextWorldPos.copy(screenScaleDragState.startWorldPos).add(worldShift);
        const localPos = screenGroup.worldToLocal(nextWorldPos.clone());
        const snappedX = snapActive ? quantizeToStep(localPos.x, gizmoSnapGridRef.current) : localPos.x;
        const snappedY = snapActive ? quantizeToStep(localPos.y, gizmoSnapGridRef.current) : localPos.y;
        const snappedZ = snapActive ? quantizeToStep(localPos.z, gizmoSnapGridRef.current) : localPos.z;

        updateScreenCard(screenScaleDragState.screenId, {
          width: nextWidth,
          height: nextHeight,
          x: THREE.MathUtils.clamp(snappedX, -4, 4),
          y: THREE.MathUtils.clamp(snappedY, -0.5, 4),
          z: THREE.MathUtils.clamp(snappedZ, -4, 4),
        });
        return;
      }
      if (lightDragState.active) {
        if (!raycaster.ray.intersectPlane(lightDragState.plane, dragHit)) return;
        dragHit.add(lightDragState.offset);
        const snapInvert = event.metaKey || event.ctrlKey;
        const snapActive = snapInvert ? !gizmoSnapEnabledRef.current : gizmoSnapEnabledRef.current;
        const grid = gizmoSnapGridRef.current;
        const dragX = snapActive ? quantizeToStep(dragHit.x, grid) : dragHit.x;
        const dragY = snapActive ? quantizeToStep(dragHit.y, grid) : dragHit.y;
        const dragZ = snapActive ? quantizeToStep(dragHit.z, grid) : dragHit.z;
        if (lightDragState.kind === "target") {
          setLightAnchorMode("world");
          setWorldAnchorX(THREE.MathUtils.clamp(dragX, -4, 4));
          setWorldAnchorY(THREE.MathUtils.clamp(dragY, -2, 4));
          setWorldAnchorZ(THREE.MathUtils.clamp(dragZ, -4, 4));
          return;
        }
        const basePos =
          lightDragState.kind === "key"
            ? computeRigPosition(keyDistanceRef.current, keyAzimuthRef.current, keyElevationRef.current, orbitCenterLive)
            : computeRigPosition(fillDistanceRef.current, fillAzimuthRef.current, fillElevationRef.current, orbitCenterLive);
        const offset = new THREE.Vector3(dragX, dragY, dragZ).sub(basePos);
        if (lightDragState.kind === "key") {
          setKeyOffsetX(THREE.MathUtils.clamp(offset.x, -4, 4));
          setKeyOffsetY(THREE.MathUtils.clamp(offset.y, -4, 4));
          setKeyOffsetZ(THREE.MathUtils.clamp(offset.z, -4, 4));
        } else {
          setFillOffsetX(THREE.MathUtils.clamp(offset.x, -4, 4));
          setFillOffsetY(THREE.MathUtils.clamp(offset.y, -4, 4));
          setFillOffsetZ(THREE.MathUtils.clamp(offset.z, -4, 4));
        }
        return;
      }
      if (!dragState.active) {
        const hits = raycaster.intersectObjects(Array.from(runtimeScreens.values()).map((entry) => entry.mesh), false);
        const picked = hits.length > 0 ? Array.from(runtimeScreens.values()).find((entry) => entry.mesh === hits[0].object)?.id ?? "" : "";
        if (picked !== hoveredScreenId) {
          hoveredScreenId = picked;
          runtimeScreens.forEach((runtime) => {
            runtime.signature = "";
          });
        }
        return;
      }
      if (!raycaster.ray.intersectPlane(dragState.plane, dragHit)) return;
      dragHit.add(dragState.offset);
      const local = screenGroup.worldToLocal(dragHit.clone());
      const snapInvert = event.metaKey || event.ctrlKey;
      const snapActive = snapInvert ? !gizmoSnapEnabledRef.current : gizmoSnapEnabledRef.current;
      const grid = gizmoSnapGridRef.current;
      const nextX = snapActive ? quantizeToStep(local.x, grid) : local.x;
      const nextY = snapActive ? quantizeToStep(local.y, grid) : local.y;
      const nextZ = snapActive ? quantizeToStep(local.z, grid) : local.z;
      setScreens((prev) =>
        prev.map((entry) =>
          entry.id === dragState.id
            ? {
                ...entry,
                x: THREE.MathUtils.clamp(nextX, -4, 4),
                y: THREE.MathUtils.clamp(nextY, -0.5, 4),
                z: THREE.MathUtils.clamp(nextZ, -4, 4),
              }
            : entry
        )
      );
    };

    const endPointerDrag = () => {
      if (dragState.active) {
        dragState.active = false;
        dragState.id = "";
      }
      if (screenScaleDragState.active) {
        screenScaleDragState.active = false;
        screenScaleDragState.screenId = "";
        screenScaleDragState.handle = "";
      }
      if (lightDragState.active) {
        lightDragState.active = false;
        lightDragState.kind = "";
      }
      controls.enabled = true;
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endPointerDrag);

    const loader = new GLTFLoader();
    const modelRig = new THREE.Group();
    scene.add(modelRig);
    let mixer: THREE.AnimationMixer | null = null;
    let modelRoot: THREE.Object3D | null = null;
    let hipsBone: THREE.Object3D | null = null;
    let rafId = 0;
    let lightPaintUiTick = 0;
    let debugTelemetryTick = 0;
    let fpsTick = 0;
    let fpsFrames = 0;
    let adaptiveTick = 0;
    let providerOverlayTick = 0;
    let hadProviderOverlayWork = false;
    let currentClipIndex = -1;
    let currentMaterialSignature = "";
    const clipActions: THREE.AnimationAction[] = [];
    const runtimeMeshes: THREE.Mesh[] = [];
    const originalMaterials = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const overrideMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const fillWorldPos = new THREE.Vector3();
    const softFillPos = new THREE.Vector3();
    const cameraFront = new THREE.Vector3();
    const toLight = new THREE.Vector3();
    const keyBlendColor = new THREE.Color();
    const fillBlendColor = new THREE.Color();
    const envKeyTint = new THREE.Color();
    const envFillTint = new THREE.Color();
    const atmoTargetPos = new THREE.Vector3();

    const disposeMaterialValue = (value: THREE.Material | THREE.Material[]) => {
      if (Array.isArray(value)) {
        value.forEach((mat) => mat.dispose());
        return;
      }
      value.dispose();
    };

    const disposeOverrideMaterials = () => {
      overrideMaterials.forEach((value) => {
        disposeMaterialValue(value);
      });
      overrideMaterials.clear();
    };

    const applyModelMaterialMode = () => {
      if (runtimeMeshes.length === 0) return;
      const mode = modelMaterialModeRef.current;
      const metalness = THREE.MathUtils.clamp(modelMetalnessRef.current, 0, 1);
      const roughness = THREE.MathUtils.clamp(modelRoughnessRef.current, 0, 1);
      const signature = `${mode}|${modelTintRef.current}|${metalness.toFixed(3)}|${roughness.toFixed(3)}`;
      if (signature === currentMaterialSignature) return;
      const tint = new THREE.Color(modelTintRef.current);

      disposeOverrideMaterials();
      runtimeMeshes.forEach((mesh) => {
        const original = originalMaterials.get(mesh);
        if (!original) return;
        if (mode === "original") {
          mesh.material = original;
          return;
        }

        const makeSingle = () => {
          if (mode === "wire") {
            return new THREE.MeshBasicMaterial({
              color: tint,
              wireframe: true,
              transparent: true,
              opacity: 0.92,
            });
          }
          if (mode === "hologram") {
            return new THREE.MeshPhysicalMaterial({
              color: tint,
              roughness: THREE.MathUtils.clamp(roughness * 0.25, 0, 0.45),
              metalness: THREE.MathUtils.clamp(metalness * 0.2, 0, 0.4),
              clearcoat: 1,
              clearcoatRoughness: 0.1,
              transparent: true,
              opacity: 0.48,
              emissive: tint.clone().multiplyScalar(0.36),
              emissiveIntensity: 1.6,
            });
          }
          return new THREE.MeshStandardMaterial({
            color: tint,
            roughness,
            metalness,
          });
        };

        const replacement = Array.isArray(original) ? original.map(() => makeSingle()) : makeSingle();
        mesh.material = replacement;
        overrideMaterials.set(mesh, replacement);
      });

      currentMaterialSignature = signature;
    };

    loader.load(
      modelSource,
      (gltf) => {
        const root = gltf.scene;

        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const fitHeight = isProfilePresentation ? 3.06 : 2.7;
        const scale = fitHeight / Math.max(size.y, 0.001);

        root.scale.setScalar(scale);
        root.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        // Let the host drive the portrait framing in profile presentation
        // so the subject can stay closer to a direct-facing hero shot.
        root.rotation.y = 0;

        const fittedBox = new THREE.Box3().setFromObject(root);
        root.position.y += groundY - fittedBox.min.y;

        let meshCount = 0;
        let triCount = 0;
        let vertexCount = 0;
        let skinnedCount = 0;
        const materialIds = new Set<string>();

        root.traverse((obj) => {
          if (!hipsBone && obj.name.toLowerCase().includes("hip")) {
            hipsBone = obj;
          }
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          meshCount += 1;
          if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
            skinnedCount += 1;
          }

          runtimeMeshes.push(mesh);
          originalMaterials.set(mesh, mesh.material);
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => materialIds.add(mat.uuid));
          } else {
            materialIds.add(mesh.material.uuid);
          }

          const geometry = mesh.geometry as THREE.BufferGeometry;
          const positionAttr = geometry.getAttribute("position");
          if (positionAttr) {
            vertexCount += positionAttr.count;
          }
          if (geometry.index) {
            triCount += Math.floor(geometry.index.count / 3);
          } else if (positionAttr) {
            triCount += Math.floor(positionAttr.count / 3);
          }
        });

        setModelStats({
          meshes: meshCount,
          triangles: triCount,
          vertices: vertexCount,
          materials: materialIds.size,
          animations: gltf.animations.length,
          skinnedMeshes: skinnedCount,
        });

        const clipNames = gltf.animations.map((clip, index) => clip.name?.trim() || `Clip ${index + 1}`);
        setModelClipNames(clipNames);
        setActiveModelClip((prev) => THREE.MathUtils.clamp(prev, 0, Math.max(0, clipNames.length - 1)));

        modelRig.add(root);
        modelRoot = root;

        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(root);
          gltf.animations.forEach((clip) => {
            const action = mixer!.clipAction(clip);
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = false;
            action.enabled = true;
            clipActions.push(action);
          });
          currentClipIndex = THREE.MathUtils.clamp(activeModelClipRef.current, 0, clipActions.length - 1);
          const initialAction = clipActions[currentClipIndex];
          if (initialAction) {
            initialAction.reset();
            initialAction.play();
            initialAction.paused = !modelAnimationPlayingRef.current;
          }
        }

        applyModelMaterialMode();
      },
      undefined,
      (error) => {
        console.error("Failed to load GLB model:", error);
        setModelStats({
          meshes: 0,
          triangles: 0,
          vertices: 0,
          materials: 0,
          animations: 0,
          skinnedMeshes: 0,
        });
        setModelClipNames([]);
        setActiveModelClip(0);
        if (modelSource !== DEFAULT_MODEL_SRC) {
          resetModelSource();
        }
      }
    );

    canvas.style.opacity = "0";
    canvas.style.transform = "translateY(20px) scale(0.97)";

    const timeout = window.setTimeout(() => {
      canvas.style.transition = "all 2.3s cubic-bezier(0.16, 1, 0.3, 1)";
      canvas.style.opacity = "1";
      canvas.style.transform = "translateY(0) scale(1)";
    }, 220);
    let flashTimeout: number | null = null;

    captureStillRef.current = () => {
      composer.render();
      const format = captureFormatRef.current;
      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      const dataUrl = renderer.domElement.toDataURL(mime, format === "jpg" ? 0.93 : 1);
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `halide-capture-${Date.now()}.${format}`;
      link.click();
      setCaptureFlash(true);
      if (flashTimeout) {
        window.clearTimeout(flashTimeout);
      }
      flashTimeout = window.setTimeout(() => {
        setCaptureFlash(false);
      }, 170);
    };

    const dataUrlToImage = (url: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load capture image"));
        img.src = url;
      });

    capturePackRef.current = () => {
      const stamp = Date.now();
      const format = captureFormatRef.current;
      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      const selectedShot = activeShotRef.current;
      const shotOrder: CameraShotKey[] = ["hero", "mid", "wide"];
      const stripFrames: string[] = [];

      for (const key of shotOrder) {
        moveToShot(key, true);
        composer.render();
        stripFrames.push(renderer.domElement.toDataURL("image/png", 1));
      }

      moveToShot(selectedShot, true);
      composer.render();
      const stillUrl = renderer.domElement.toDataURL(mime, format === "jpg" ? 0.93 : 1);
      const stillLink = document.createElement("a");
      stillLink.href = stillUrl;
      stillLink.download = `halide-still-${stamp}.${format}`;
      stillLink.click();

      Promise.all(stripFrames.map((url) => dataUrlToImage(url)))
        .then((images) => {
          if (images.length === 0) return;
          const stripCanvas = document.createElement("canvas");
          stripCanvas.width = images[0].width * images.length;
          stripCanvas.height = images[0].height;
          const ctx = stripCanvas.getContext("2d");
          if (!ctx) return;
          images.forEach((img, index) => {
            ctx.drawImage(img, index * img.width, 0);
          });
          const stripUrl = stripCanvas.toDataURL("image/png", 1);
          const stripLink = document.createElement("a");
          stripLink.href = stripUrl;
          stripLink.download = `halide-strip-${stamp}.png`;
          stripLink.click();
        })
        .catch((error) => {
          console.error("Failed to build strip capture", error);
        });

      try {
        const payload = latestSettingsRef.current ?? readCurrentSettings();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const jsonUrl = URL.createObjectURL(blob);
        const jsonLink = document.createElement("a");
        jsonLink.href = jsonUrl;
        jsonLink.download = `halide-settings-${stamp}.json`;
        jsonLink.click();
        setTimeout(() => URL.revokeObjectURL(jsonUrl), 1200);
      } catch (error) {
        console.error("Failed to export settings JSON", error);
      }

      setCaptureFlash(true);
      if (flashTimeout) {
        window.clearTimeout(flashTimeout);
      }
      flashTimeout = window.setTimeout(() => {
        setCaptureFlash(false);
      }, 170);
    };

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      clock.update();
      const delta = clock.getDelta();
      const elapsed = clock.getElapsed();
      const perfTier = performanceTierRef.current;
      const gradeCfg = GRADES[gradeRef.current];
      const beatEnergy = beatPulseRef.current ? Math.pow((Math.sin(elapsed * 3.8) + 1) * 0.5, 3) : 0;
      const bloomPerfMul = perfTier === "ultra" ? 1.06 : perfTier === "fast" ? 0.76 : 1;
      const bloomTarget = clampBloom(bloomStrengthRef.current * bloomPerfMul + gradeCfg.bloomBoost + beatEnergy * 0.16);
      fpsTick += delta;
      fpsFrames += 1;
      if (fpsTick >= 0.8) {
        const measured = fpsFrames / Math.max(0.001, fpsTick);
        const prevMeasured = fpsRef.current;
        fpsRef.current = measured;
        if (Math.abs(measured - prevMeasured) > 0.35) {
          setFps(measured);
        }
        fpsTick = 0;
        fpsFrames = 0;
      }

      if (modelRoot) {
        const floatOffset = modelFloatRef.current ? Math.sin(elapsed * 1.08) * 0.08 : 0;
        modelRig.position.set(modelPosXRef.current, modelPosYRef.current + floatOffset, modelPosZRef.current);
        modelRig.rotation.set(0, THREE.MathUtils.degToRad(modelYawRef.current), 0);
        const liveScale = THREE.MathUtils.clamp(modelScaleRef.current, 0.2, 3.5);
        modelRig.scale.setScalar(liveScale);
      }
      const screenAttachment = screenAttachmentModeRef.current;
      if (screenAttachment === "world") {
        screenGroup.position.set(0, 0, 0);
        screenGroup.rotation.set(0, 0, 0);
        screenGroup.scale.set(1, 1, 1);
      } else if (screenAttachment === "follow-pos") {
        screenGroup.position.copy(modelRig.position);
        screenGroup.rotation.set(0, 0, 0);
        screenGroup.scale.set(1, 1, 1);
      } else if (screenAttachment === "follow-pos-yaw") {
        screenGroup.position.copy(modelRig.position);
        screenGroup.rotation.set(0, modelRig.rotation.y, 0);
        screenGroup.scale.set(1, 1, 1);
      } else {
        screenGroup.position.copy(modelRig.position);
        screenGroup.quaternion.copy(modelRig.quaternion);
        screenGroup.scale.copy(modelRig.scale);
      }

      syncRuntimeScreens(delta);
      const hasVisibleProviderCards =
        screensEnabledRef.current &&
        screensRef.current.some(
          (card) => card.visible && card.mediaKind === "provider" && !!card.mediaProvider && !!card.mediaEmbedBase && !!card.mediaUrl
        );
      if (hasVisibleProviderCards) {
        hadProviderOverlayWork = true;
        const overlayInterval = perfTier === "ultra" ? 0 : perfTier === "fast" ? 0.12 : 0.05;
        if (overlayInterval <= 0) {
          syncProviderOverlays();
        } else {
          providerOverlayTick += delta;
          if (providerOverlayTick >= overlayInterval) {
            syncProviderOverlays();
            providerOverlayTick = 0;
          }
        }
      } else if (hadProviderOverlayWork) {
        // Run once to clear stale provider overlays after provider media gets removed/hidden.
        syncProviderOverlays();
        hadProviderOverlayWork = false;
        providerOverlayTick = 0;
      }
      const hud = screenHudRef.current;
      if (hud) {
        const selection = sceneSelectionRef.current;
        let hasHudAnchor = false;
        if (selection === "screen") {
          const activeRuntime = runtimeScreens.get(activeScreenIdRef.current);
          if (activeRuntime && screensEnabledRef.current && activeRuntime.mesh.visible) {
            activeRuntime.mesh.getWorldPosition(hudWorldPos);
            hudWorldPos.y += 0.52 * activeRuntime.mesh.scale.y;
            hasHudAnchor = true;
          }
        } else if (selection === "model" && modelRoot) {
          modelRig.getWorldPosition(hudWorldPos);
          hudWorldPos.y += Math.max(0.72, 0.48 + modelRig.scale.y * 0.64);
          hasHudAnchor = true;
        } else if (selection === "light-key") {
          hudWorldPos.copy(keyMarker.position);
          hudWorldPos.y += 0.12;
          hasHudAnchor = true;
        } else if (selection === "light-fill") {
          hudWorldPos.copy(fillMarker.position);
          hudWorldPos.y += 0.12;
          hasHudAnchor = true;
        } else if (selection === "light-target") {
          hudWorldPos.copy(targetMarker.position);
          hudWorldPos.y += 0.12;
          hasHudAnchor = true;
        }
        if (hasHudAnchor) {
          hudWorldPos.project(camera);
          const viewX = ((hudWorldPos.x + 1) * 0.5) * renderer.domElement.clientWidth;
          const viewY = ((-hudWorldPos.y + 1) * 0.5) * renderer.domElement.clientHeight;
          const inView =
            hudWorldPos.z < 1 &&
            viewX >= 0 &&
            viewX <= renderer.domElement.clientWidth &&
            viewY >= 0 &&
            viewY <= renderer.domElement.clientHeight;
          if (inView) {
            hud.style.opacity = "1";
            hud.style.pointerEvents = "auto";
            hud.style.transform = `translate(-50%, -100%) translate(${viewX.toFixed(1)}px, ${(viewY - 12).toFixed(1)}px)`;
          } else {
            hud.style.opacity = "0";
            hud.style.pointerEvents = "none";
          }
        } else {
          hud.style.opacity = "0";
          hud.style.pointerEvents = "none";
        }
      }
      applyModelMaterialMode();
      const environmentModeCfg = ENVIRONMENT_MODE_CONFIG[environmentModeRef.current] ?? ENVIRONMENT_MODE_CONFIG.core;
      const environmentLightCfg = environmentModeCfg.lighting;
      const environmentMix = THREE.MathUtils.clamp(environmentObjectImpactRef.current, 0, 1);
      const keyLightModeMul = THREE.MathUtils.lerp(1, environmentLightCfg.keyMul, environmentMix);
      const fillLightModeMul = THREE.MathUtils.lerp(1, environmentLightCfg.fillMul, environmentMix);
      const atmoLightModeMul = THREE.MathUtils.lerp(1, environmentLightCfg.atmoMul, environmentMix);
      const reflectionModeMul = THREE.MathUtils.lerp(1, environmentLightCfg.reflectionMul, environmentMix);
      const envIntensity = THREE.MathUtils.clamp(hdriIntensityRef.current, 0, 4);
      const objectEnvIntensity = envIntensity * reflectionModeMul;
      for (let i = 0; i < runtimeMeshes.length; i += 1) {
        const mesh = runtimeMeshes[i];
        const meshMaterial = mesh.material;
        if (Array.isArray(meshMaterial)) {
          for (let j = 0; j < meshMaterial.length; j += 1) {
            const material = meshMaterial[j];
            if ("envMapIntensity" in material) {
              (material as THREE.MeshStandardMaterial).envMapIntensity = objectEnvIntensity;
            }
          }
        } else if ("envMapIntensity" in meshMaterial) {
          (meshMaterial as THREE.MeshStandardMaterial).envMapIntensity = objectEnvIntensity;
        }
      }

      if (clipActions.length > 0 && mixer) {
        const wantedClip = THREE.MathUtils.clamp(activeModelClipRef.current, 0, clipActions.length - 1);
        if (wantedClip !== currentClipIndex) {
          const prev = clipActions[currentClipIndex];
          if (prev) {
            prev.fadeOut(0.16);
          }
          const next = clipActions[wantedClip];
          if (next) {
            next.reset();
            next.fadeIn(0.16);
            next.play();
          }
          currentClipIndex = wantedClip;
        }

        const activeAction = clipActions[currentClipIndex];
        const shouldPlay = modelAnimationPlayingRef.current;
        if (activeAction) {
          activeAction.enabled = true;
          activeAction.paused = !shouldPlay;
          activeAction.setEffectiveTimeScale(Math.max(0.01, modelAnimationSpeedRef.current));
        }
        if (shouldPlay) {
          mixer.update(delta);
        }
      }

      adaptiveTick += delta;
      if (autoQualityRef.current && adaptiveTick > 1.05) {
        const measured = fpsRef.current;
        if (measured < 42 && qualityModeRef.current !== "draft") {
          setQualityMode("draft");
        } else if (measured > 57 && qualityModeRef.current !== "final") {
          setQualityMode("final");
        }
        adaptiveTick = 0;
      } else if (!autoQualityRef.current) {
        adaptiveTick = 0;
      }

      if (introBlend.active) {
        const t = Math.min((elapsed - introBlend.start) / introBlend.duration, 1);
        const eased = 1 - Math.pow(1 - t, 3.2);
        const sideDrift = (1 - eased) * 0.46;
        camera.position.lerpVectors(introBlend.fromPos, introBlend.toPos, eased);
        camera.position.x += sideDrift * 0.42;
        camera.position.z += sideDrift * 0.2;
        controls.target.lerpVectors(introBlend.fromTarget, introBlend.toTarget, eased);
        controls.target.x += sideDrift * 0.18;
        camera.fov = THREE.MathUtils.lerp(introBlend.fromFov, introBlend.toFov, eased);
        camera.updateProjectionMatrix();
        if (t >= 1) {
          introBlend.active = false;
          controls.enabled = true;
          camera.position.copy(introBlend.toPos);
          controls.target.copy(introBlend.toTarget);
        }
      } else if (shotBlend.active) {
        const t = Math.min((elapsed - shotBlend.start) / shotBlend.duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(shotBlend.fromPos, shotBlend.toPos, eased);
        controls.target.lerpVectors(shotBlend.fromTarget, shotBlend.toTarget, eased);
        camera.fov = THREE.MathUtils.lerp(shotBlend.fromFov, shotBlend.toFov, eased);
        camera.updateProjectionMatrix();
        if (t >= 1) {
          shotBlend.active = false;
        }
      } else {
        camera.fov = THREE.MathUtils.lerp(camera.fov, SHOTS[activeShotRef.current].fov + cameraFovOffsetRef.current, 0.16);
        camera.near = cameraNearRef.current;
        camera.far = cameraFarRef.current;
        camera.updateProjectionMatrix();
      }

      if (lightPaintPlayingRef.current && lightPaintPointsRef.current.length > 1) {
        const points = lightPaintPointsRef.current;
        const segments = Math.max(1, points.length - 1);
        lightPaintPlayheadRef.current += delta * lightPaintSpeedRef.current;
        let normalized = lightPaintPlayheadRef.current / segments;
        if (normalized >= 1) {
          if (lightPaintLoopRef.current) {
            normalized %= 1;
            lightPaintPlayheadRef.current = normalized * segments;
          } else {
            normalized = 1;
            lightPaintPlayheadRef.current = segments;
            setLightPaintPlaying(false);
          }
        }
        const indexF = normalized * segments;
        const index = Math.min(segments - 1, Math.floor(indexF));
        const nextIndex = Math.min(points.length - 1, index + 1);
        const alpha = THREE.MathUtils.clamp(indexF - index, 0, 1);
        const left = points[index];
        const right = points[nextIndex];
        const az = lerpAngle(left.azimuth, right.azimuth, alpha);
        const el = THREE.MathUtils.lerp(left.elevation, right.elevation, alpha);
        const dist = THREE.MathUtils.lerp(left.distance, right.distance, alpha);

        if (lightPaintTargetRef.current === "key") {
          keyAzimuthRef.current = az;
          keyElevationRef.current = el;
          keyDistanceRef.current = dist;
        } else {
          fillAzimuthRef.current = az;
          fillElevationRef.current = el;
          fillDistanceRef.current = dist;
        }
        if (elapsed - lightPaintUiTick > 0.12) {
          setLightPaintProgress(normalized);
          if (lightPaintTargetRef.current === "key") {
            setKeyAzimuth(az);
            setKeyElevation(el);
            setKeyDistance(dist);
          } else {
            setFillAzimuth(az);
            setFillElevation(el);
            setFillDistance(dist);
          }
          lightPaintUiTick = elapsed;
        }
      }

      if (lightAnchorModeRef.current === "follow") {
        if (lightFollowPointRef.current === "hips" && hipsBone) {
          hipsBone.getWorldPosition(lightFocus);
        } else {
          modelRig.getWorldPosition(lightFocus);
        }
        lightFocus.y += orbitCenterLiftRef.current;
        orbitCenter.copy(lightFocus);
      } else {
        orbitCenter.copy(worldAnchorRef.current);
      }
      orbitCenterLive.copy(orbitCenter);

      const keyWorldPos = computeRigPosition(
        keyDistanceRef.current,
        keyAzimuthRef.current,
        keyElevationRef.current,
        orbitCenter
      ).add(keyOffsetRef.current);
      fillWorldPos
        .copy(computeRigPosition(fillDistanceRef.current, fillAzimuthRef.current, fillElevationRef.current, orbitCenter))
        .add(fillOffsetRef.current);
      softFillPos.copy(fillWorldPos);

      const sourceSoft = hideLightSourceRef.current;
      const softness = THREE.MathUtils.clamp(lightSoftnessRef.current, 0, 1);
      if (sourceSoft) {
        fillWorldPos.y += 0.2;
        fillWorldPos.z += 0.12;
        softFillPos.y += 0.2;
        softFillPos.z += 0.12;
      }

      const applyConstraints = (position: THREE.Vector3) => {
        const minHeight = Math.max(minLightHeightRef.current, lockLightsAboveGroundRef.current ? 0.03 : -6);
        position.y = Math.max(position.y, groundY + minHeight);

        toLight.copy(position).sub(orbitCenter);
        const maxDist = Math.max(0.35, maxLightDistanceRef.current);
        const dist = toLight.length();
        if (dist > maxDist) {
          toLight.multiplyScalar(maxDist / Math.max(0.0001, dist));
          position.copy(orbitCenter).add(toLight);
        }

        if (stayLightsInFrontRef.current) {
          cameraFront.copy(camera.position).sub(orbitCenter);
          if (cameraFront.lengthSq() > 0.0001) {
            cameraFront.normalize();
            toLight.copy(position).sub(orbitCenter);
            const frontDepth = toLight.dot(cameraFront);
            const minFrontDepth = Math.max(0.04, bodyClearanceRef.current * 0.15);
            if (frontDepth < minFrontDepth) {
              toLight.addScaledVector(cameraFront, minFrontDepth - frontDepth);
              position.copy(orbitCenter).add(toLight);
            }
          }
        }

        if (avoidBodyIntersectionRef.current) {
          toLight.copy(position).sub(orbitCenter);
          const minRadius = Math.max(0.2, bodyClearanceRef.current);
          const lenSq = toLight.lengthSq();
          if (lenSq < minRadius * minRadius) {
            if (lenSq < 1e-5) {
              toLight.set(0, minRadius, 0);
            } else {
              toLight.multiplyScalar(minRadius / Math.sqrt(lenSq));
            }
            position.copy(orbitCenter).add(toLight);
          }
        }
      };

      applyConstraints(keyWorldPos);
      applyConstraints(fillWorldPos);
      applyConstraints(softFillPos);

      const intensityGain = lightGainRef.current;
      keyBlendColor
        .set(keyColorRef.current)
        .lerp(envKeyTint.set(environmentLightCfg.keyTint), environmentMix * 0.42);
      fillBlendColor
        .set(fillColorRef.current)
        .lerp(envFillTint.set(environmentLightCfg.fillTint), environmentMix * 0.42);

      keyLight.position.copy(keyWorldPos);
      keyLight.color.copy(keyBlendColor);
      keyLight.intensity = keyIntensityRef.current * intensityGain * keyLightModeMul;
      keyLight.target.position.copy(orbitCenter);
      keyLight.target.updateMatrixWorld();

      fillLight.position.copy(fillWorldPos);
      fillLight.color.copy(fillBlendColor);
      fillLight.visible = !sourceSoft;
      fillLight.intensity = sourceSoft
        ? 0
        : (fillIntensityRef.current + beatEnergy * 0.25) * intensityGain * fillLightModeMul;
      fillLight.angle = THREE.MathUtils.lerp(fillLight.angle, THREE.MathUtils.degToRad(11 + softness * 27), 0.08);
      fillLight.penumbra = THREE.MathUtils.lerp(fillLight.penumbra, 0.08 + softness * 0.9, 0.08);
      fillLight.distance = THREE.MathUtils.lerp(fillLight.distance, 6.8 + softness * 4.6, 0.08);
      fillLight.decay = THREE.MathUtils.lerp(fillLight.decay, 1.75 - softness * 0.9, 0.08);
      fillLight.target.position.copy(orbitCenter);
      fillLight.target.updateMatrixWorld();
      if (softFillRef.current) {
        softFillRef.current.position.copy(softFillPos);
        softFillRef.current.target.position.copy(orbitCenter);
        softFillRef.current.target.updateMatrixWorld();
        softFillRef.current.color.copy(fillBlendColor);
        softFillRef.current.intensity = sourceSoft
          ? (fillIntensityRef.current * softFillBoost(softness) + beatEnergy * 0.16) * intensityGain * fillLightModeMul
          : 0;
      }

        const showMarkers = showLightMarkersRef.current;
        keyMarkerMaterial.color.set(keyColorRef.current);
        fillMarkerMaterial.color.set(fillColorRef.current);
        keyLineMaterial.color.set(keyColorRef.current);
        fillLineMaterial.color.set(fillColorRef.current);
        keyMarker.visible = showMarkers;
        fillMarker.visible = showMarkers;
        targetMarker.visible = showMarkers;
        keyLine.visible = showMarkers;
        fillLine.visible = showMarkers;
        if (showMarkers) {
          keyMarker.position.copy(keyWorldPos);
          fillMarker.position.copy(fillWorldPos);
          targetMarker.position.copy(orbitCenter);

          keyLinePositions[0] = orbitCenter.x;
          keyLinePositions[1] = orbitCenter.y;
          keyLinePositions[2] = orbitCenter.z;
          keyLinePositions[3] = keyWorldPos.x;
          keyLinePositions[4] = keyWorldPos.y;
          keyLinePositions[5] = keyWorldPos.z;
          (keyLineGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;

          fillLinePositions[0] = orbitCenter.x;
          fillLinePositions[1] = orbitCenter.y;
          fillLinePositions[2] = orbitCenter.z;
          fillLinePositions[3] = fillWorldPos.x;
          fillLinePositions[4] = fillWorldPos.y;
          fillLinePositions[5] = fillWorldPos.z;
          (fillLineGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
        }
      atmoTargetPos.set(
        orbitCenter.x,
        orbitCenter.y + (sourceSoft ? 2.2 : 0.28) + atmosphereSpreadRef.current * (sourceSoft ? 0.5 : 0.2),
        orbitCenter.z + (sourceSoft ? 0.22 : 0.08)
      );
      atmoLight.position.lerp(atmoTargetPos, 0.11);
      atmoLight.intensity = THREE.MathUtils.lerp(
        atmoLight.intensity,
        ((0.06 + ambientAtmosphereRef.current * 0.98) * (0.35 + fogAmountRef.current * 1.2) + beatEnergy * 0.2) *
          (sourceSoft ? 0.38 : 1) *
          atmoLightModeMul,
        0.12
      );
      atmoLight.distance = THREE.MathUtils.lerp(atmoLight.distance, sourceSoft ? 16 + atmosphereSpreadRef.current * 11 : 4 + atmosphereSpreadRef.current * 10.5, 0.08);
      atmoLight.decay = THREE.MathUtils.lerp(atmoLight.decay, sourceSoft ? 1.12 : 1.4 - atmosphereSpreadRef.current * 0.55, 0.08);

      const debugTelemetryActive =
        uiModeRef.current === "pro" &&
        panelTabRef.current === "render" &&
        !panelClosedRef.current &&
        !panelMinimizedRef.current;
      if (debugTelemetryActive) {
        const debugInterval = perfTier === "ultra" ? 0.16 : perfTier === "fast" ? 0.42 : 0.26;
        if (elapsed - debugTelemetryTick > debugInterval) {
          const nextOrbit = {
            x: orbitCenter.x,
            y: orbitCenter.y,
            z: orbitCenter.z,
          };
          const nextKey = {
            x: keyWorldPos.x,
            y: keyWorldPos.y,
            z: keyWorldPos.z,
          };
          const nextFill = {
            x: fillWorldPos.x,
            y: fillWorldPos.y,
            z: fillWorldPos.z,
          };
          setOrbitCenterWorld((prev) => (vec3Changed(prev, nextOrbit, 0.015) ? nextOrbit : prev));
          setKeyWorld((prev) => (vec3Changed(prev, nextKey, 0.015) ? nextKey : prev));
          setFillWorld((prev) => (vec3Changed(prev, nextFill, 0.015) ? nextFill : prev));
          debugTelemetryTick = elapsed;
        }
      }

      renderer.toneMappingExposure = THREE.MathUtils.lerp(
        renderer.toneMappingExposure,
        gradeCfg.exposure + hdriExposureRef.current,
        0.08
      );
      const sceneWithEnv = scene as unknown as {
        environmentIntensity?: number;
        backgroundIntensity?: number;
        backgroundBlurriness?: number;
        environmentRotation?: THREE.Euler;
        backgroundRotation?: THREE.Euler;
      };
      sceneWithEnv.environmentIntensity = envIntensity * reflectionModeMul;
      sceneWithEnv.backgroundIntensity = envIntensity;
      sceneWithEnv.backgroundBlurriness = THREE.MathUtils.clamp(hdriBlurRef.current, 0, 1);
      const hdriRotationRad = THREE.MathUtils.degToRad(hdriRotationRef.current);
      if (!sceneWithEnv.environmentRotation) {
        sceneWithEnv.environmentRotation = new THREE.Euler(0, hdriRotationRad, 0);
      } else {
        sceneWithEnv.environmentRotation.set(0, hdriRotationRad, 0);
      }
      if (!sceneWithEnv.backgroundRotation) {
        sceneWithEnv.backgroundRotation = new THREE.Euler(0, hdriRotationRad, 0);
      } else {
        sceneWithEnv.backgroundRotation.set(0, hdriRotationRad, 0);
      }
      if (currentHdriEnvMap) {
        scene.background = hdriBackgroundRef.current ? currentHdriEnvMap : null;
      }
      bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, bloomTarget, 0.08);
      vignetteUniforms.offset.value = THREE.MathUtils.lerp(vignetteUniforms.offset.value, gradeCfg.vignetteOffset, 0.08);
      vignetteUniforms.darkness.value = THREE.MathUtils.lerp(vignetteUniforms.darkness.value, gradeCfg.vignetteDarkness, 0.08);

      controls.dampingFactor = cameraDampingRef.current;
      controls.autoRotateSpeed = cameraOrbitSpeedRef.current;
      controls.rotateSpeed = 0.2 + cameraOrbitSpeedRef.current * 1.7;
      controls.zoomSpeed = 0.25 + cameraOrbitSpeedRef.current * 0.55;
      controls.update();

      const stepA = Math.max(0, Math.sin(elapsed * 6.2));
      const stepB = Math.max(0, Math.sin(elapsed * 6.2 + Math.PI));
      const gaitPulse = ringPulseRef.current
        ? (Math.pow(stepA, 4) + Math.pow(stepB, 4)) * ringImpactRef.current * 1.6
        : 0;
      const totalPulse = gaitPulse + beatEnergy * 0.95;

      if (groundMotionRef.current) {
        floor.rotation.z = Math.sin(elapsed * 0.26) * 0.014;
        topoRingGroup.rotation.z += delta * 0.045;
      } else {
        floor.rotation.z = THREE.MathUtils.lerp(floor.rotation.z, 0, 0.1);
        topoRingGroup.rotation.z = THREE.MathUtils.lerp(topoRingGroup.rotation.z, 0, 0.1);
      }

      if (floorModeRef.current === "grid" && floorGridTextureRef.current) {
        if (groundMotionRef.current) {
          floorGridTextureRef.current.offset.x = (elapsed * 0.012) % 1;
          floorGridTextureRef.current.offset.y = (elapsed * -0.008) % 1;
        } else {
          floorGridTextureRef.current.offset.set(0, 0);
        }
      }
      if (floorModeRef.current === "scan" && floorGridTextureRef.current) {
        floorGridTextureRef.current.offset.x = (elapsed * 0.034 * effectSpeedRef.current) % 1;
        floorGridTextureRef.current.offset.y = (elapsed * -0.024 * effectSpeedRef.current) % 1;
      }
      if (floorMatRef.current && floorModeRef.current === "pulse") {
        const pulse = 0.16 + Math.pow((Math.sin(elapsed * (groundMotionRef.current ? 3.2 : 1.8)) + 1) * 0.5, 2) * 0.62;
        floorMatRef.current.emissiveIntensity = pulse;
      }
      if (floorMatRef.current && floorModeRef.current === "scan") {
        const scanPulse = 0.24 + Math.pow((Math.sin(elapsed * (groundMotionRef.current ? 4 : 2.4)) + 1) * 0.5, 3) * 0.85;
        floorMatRef.current.emissive.set(fillColorRef.current);
        floorMatRef.current.emissiveIntensity = scanPulse;
      }

      ringMeshes.forEach((ring, index) => {
        const mat = ring.material as THREE.MeshBasicMaterial;
        const wave = Math.sin(elapsed * 1.35 - index * 0.34) * 0.006;
        const falloff = Math.max(0.18, 1 - index / ringMeshes.length);
        const baseOpacity = Math.max(0.005, 0.017 - index * 0.0008 + wave);
        mat.opacity = THREE.MathUtils.clamp(baseOpacity + totalPulse * 0.105 * falloff, 0.005, 0.25);
        ring.scale.setScalar(1 + totalPulse * 0.048 * falloff);
      });

      fogPlaneA.rotation.z = elapsed * 0.028;
      fogPlaneB.rotation.z = -elapsed * 0.016;
      const fogPulse = 1 + Math.sin(elapsed * 0.7) * 0.04;
      fogPlaneA.scale.setScalar(fogPulse);
      fogPlaneB.scale.setScalar(1.02 + Math.cos(elapsed * 0.55) * 0.03);
      fogPlaneA.scale.multiplyScalar(0.92 + atmosphereSpreadRef.current * 0.34);
      fogPlaneB.scale.multiplyScalar(0.94 + atmosphereSpreadRef.current * 0.38);

      const activeParticleStyle = particleStyleRef.current;
      const secondaryStyle = secondaryParticleStyleRef.current;
      const hasLayerB = secondaryStyle !== "none" && secondaryStyle !== activeParticleStyle;
      const layerBMix = hasLayerB ? THREE.MathUtils.clamp(effectBlendRef.current, 0, 1) : 0;
      const layerAMix = hasLayerB ? 1 - layerBMix : 1;
      const styleWeight = (style: ParticleStyle) => {
        let weight = 0;
        if (activeParticleStyle === style) weight += layerAMix;
        if (secondaryStyle === style) weight += layerBMix;
        return weight;
      };

      const perfFxMul = perfTier === "ultra" ? 1.12 : perfTier === "fast" ? 0.66 : 1;
      const perfSpeedMul = perfTier === "fast" ? 0.9 : 1;
      const effectAmountLive = THREE.MathUtils.clamp(effectAmountRef.current * perfFxMul, 0, 3);
      const effectSpeedLive = THREE.MathUtils.clamp(effectSpeedRef.current * perfSpeedMul, 0.1, 4);
      const effectScaleLive = THREE.MathUtils.clamp(effectScaleRef.current, 0.2, 4);
      const effectSpreadLive = THREE.MathUtils.clamp(effectSpreadRef.current, 0.3, 3);
      const densityLive = THREE.MathUtils.clamp(particleDensityRef.current * perfFxMul, 0, 2.4);

      let activePointStyle: ParticleStyle | null = null;
      let pointStyleWeight = 0;
      (["dust", "embers", "snow"] as ParticleStyle[]).forEach((style) => {
        const weight = styleWeight(style);
        if (weight > pointStyleWeight) {
          activePointStyle = style;
          pointStyleWeight = weight;
        }
      });
      const glyphWeight = styleWeight("glyphs");
      const orbitWeight = styleWeight("orbit-balls");
      const ribbonWeight = styleWeight("ribbons");
      const shardWeight = styleWeight("shards");
      const beamWeight = styleWeight("beams");

      particleCloud.visible = particlesEnabledRef.current && !!activePointStyle && pointStyleWeight > 0.03;
      glyphCloud.visible = particlesEnabledRef.current && glyphWeight > 0.03;
      orbitBallsGroup.visible = particlesEnabledRef.current && orbitWeight > 0.03;
      ribbonGroup.visible = particlesEnabledRef.current && ribbonWeight > 0.03;
      shardGroup.visible = particlesEnabledRef.current && shardWeight > 0.03;
      beamGroup.visible = particlesEnabledRef.current && beamWeight > 0.03;

      if (particleCloud.visible && activePointStyle) {
        const pointsAttr = particleGeo.getAttribute("position") as THREE.BufferAttribute;
        const arr = pointsAttr.array as Float32Array;
        const qualityFactor = qualityModeRef.current === "draft" ? 0.58 : 1;
        const styleDensityBoost = activePointStyle === "snow" ? 1.18 : activePointStyle === "embers" ? 1.05 : 1;
        const liveCount = Math.max(
          0,
          Math.floor(particleCount * densityLive * qualityFactor * styleDensityBoost * effectAmountLive * (0.24 + pointStyleWeight * 1.85))
        );
        particleGeo.setDrawRange(0, liveCount);
        if (activePointStyle === "embers") {
          particleMat.color.lerp(emberParticleColor, 0.14);
        } else if (activePointStyle === "snow") {
          particleMat.color.lerp(snowParticleColor, 0.12);
        } else {
          particleMat.color.lerp(new THREE.Color(PRESETS[preset].fogColor), 0.08);
        }
        const styleOpacity = activePointStyle === "embers" ? 1.2 : activePointStyle === "snow" ? 0.78 : 1;
        const styleSize = activePointStyle === "embers" ? 1.2 : activePointStyle === "snow" ? 1.45 : 1;
        particleMat.opacity =
          (0.05 + densityLive * 0.26) *
          (0.44 + ambientAtmosphereRef.current * 0.7) *
          styleOpacity *
          (0.38 + effectAmountLive * 0.46) *
          (0.36 + pointStyleWeight * 0.9);
        particleMat.size =
          (0.018 + densityLive * 0.022) *
          styleSize *
          (0.3 + effectScaleLive * 0.95) *
          (0.55 + effectSpreadLive * 0.32);
        const driftScale = (activePointStyle === "snow" ? 1.2 : activePointStyle === "embers" ? 0.9 : 1) * effectSpreadLive;
        const verticalDirection = activePointStyle === "snow" ? -1 : 1;
        const riseScale = (activePointStyle === "embers" ? 1.35 : activePointStyle === "snow" ? 0.46 : 1) * effectSpeedLive;
        for (let i = 0; i < liveCount; i += 1) {
          const i3 = i * 3;
          arr[i3] += Math.sin(elapsed * 0.42 * effectSpeedLive + particlePhase[i]) * 0.00092 * driftScale;
          arr[i3 + 2] += Math.cos(elapsed * 0.47 * effectSpeedLive + particlePhase[i] * 1.3) * 0.00092 * driftScale;
          arr[i3 + 1] += particleRise[i] * delta * (0.2 + densityLive * 0.56 + ambientAtmosphereRef.current * 0.2) * riseScale * verticalDirection;
          const recycleTop = activePointStyle === "snow" ? 2.8 : 2.65;
          const recycleBottom = -1.0;
          const shouldRecycleUp = activePointStyle !== "snow" && arr[i3 + 1] > recycleTop;
          const shouldRecycleDown = activePointStyle === "snow" && arr[i3 + 1] < recycleBottom;
          if (shouldRecycleUp || shouldRecycleDown) {
            const radius = (0.4 + Math.random() * 2.8) * effectSpreadLive;
            const angle = Math.random() * Math.PI * 2;
            arr[i3] = Math.cos(angle) * radius;
            arr[i3 + 1] =
              activePointStyle === "snow"
                ? THREE.MathUtils.lerp(2.0, 2.95, Math.random())
                : THREE.MathUtils.lerp(-1.0, 0.08, Math.random());
            arr[i3 + 2] = Math.sin(angle) * radius;
            particlePhase[i] = Math.random() * Math.PI * 2;
            if (activePointStyle === "snow") {
              particleRise[i] = THREE.MathUtils.lerp(0.08, 0.34, Math.random());
            } else if (activePointStyle === "embers") {
              particleRise[i] = THREE.MathUtils.lerp(0.2, 1.05, Math.random());
            } else {
              particleRise[i] = THREE.MathUtils.lerp(0.15, 0.78, Math.random());
            }
          }
        }
        pointsAttr.needsUpdate = true;
      }

      if (glyphCloud.visible) {
        const pointsAttr = glyphGeo.getAttribute("position") as THREE.BufferAttribute;
        const arr = pointsAttr.array as Float32Array;
        const qualityFactor = qualityModeRef.current === "draft" ? 0.54 : 1;
        const liveCount = Math.max(0, Math.floor(glyphCount * densityLive * qualityFactor * effectAmountLive * (0.2 + glyphWeight * 1.8)));
        glyphGeo.setDrawRange(0, liveCount);
        glyphMat.size = (0.05 + densityLive * 0.07) * (0.24 + effectScaleLive * 0.92);
        glyphMat.opacity = (0.05 + densityLive * 0.11) * (0.3 + glyphWeight * 0.88);
        for (let i = 0; i < liveCount; i += 1) {
          const i3 = i * 3;
          arr[i3] += Math.sin(elapsed * 0.34 * effectSpeedLive + glyphPhase[i] * 1.17) * 0.0014 * effectSpreadLive;
          arr[i3 + 2] += Math.cos(elapsed * 0.38 * effectSpeedLive + glyphPhase[i] * 0.94) * 0.0014 * effectSpreadLive;
          arr[i3 + 1] += glyphRise[i] * delta * (0.16 + effectSpeedLive * 0.24);
          if (arr[i3 + 1] > 3) {
            const radius = (0.45 + Math.random() * 3.45) * effectSpreadLive;
            const angle = Math.random() * Math.PI * 2;
            arr[i3] = Math.cos(angle) * radius;
            arr[i3 + 1] = THREE.MathUtils.lerp(-1.1, -0.05, Math.random());
            arr[i3 + 2] = Math.sin(angle) * radius;
            glyphPhase[i] = Math.random() * Math.PI * 2;
            glyphRise[i] = THREE.MathUtils.lerp(0.08, 0.34, Math.random());
          }
        }
        pointsAttr.needsUpdate = true;
      }

      if (orbitBallsGroup.visible) {
        const activeBalls = Math.max(1, Math.floor(orbitBallMeshes.length * Math.min(1, orbitWeight * (0.18 + effectAmountLive * 0.34))));
        for (let i = 0; i < orbitBallMeshes.length; i += 1) {
          const mesh = orbitBallMeshes[i];
          const mat = orbitBallMats[i];
          const visible = i < activeBalls;
          mesh.visible = visible;
          if (!visible) continue;
          mat.color.set(i % 2 === 0 ? keyColorRef.current : fillColorRef.current);
          const phase = elapsed * orbitBallSpeed[i] * effectSpeedLive + orbitBallPhases[i];
          const radius = orbitBallRadii[i] * (0.26 + effectSpreadLive * 0.86);
          const wobble = Math.sin(elapsed * 0.75 * effectSpeedLive + orbitBallPhases[i] * 0.7) * (0.08 + effectScaleLive * 0.08);
          mesh.position.set(
            orbitCenter.x + Math.cos(phase) * radius,
            orbitCenter.y + orbitBallHeights[i] * (0.28 + effectScaleLive * 0.36) + wobble,
            orbitCenter.z + Math.sin(phase * 1.07) * radius
          );
          const scale = 0.16 + effectAmountLive * 0.36 + Math.sin(elapsed * 2 + orbitBallPhases[i]) * 0.06;
          mesh.scale.setScalar(scale);
          mat.opacity = (0.12 + effectAmountLive * 0.2) * (0.28 + orbitWeight * 0.88);
        }
      }

      if (ribbonGroup.visible) {
        ribbonGroup.position.set(orbitCenter.x, orbitCenter.y + 0.34, orbitCenter.z);
        ribbonGroup.rotation.y += delta * (0.16 + effectSpeedLive * 0.22);
        ribbonGroup.rotation.x = Math.sin(elapsed * 0.42 * effectSpeedLive) * 0.34;
        ribbonGroup.scale.setScalar(0.24 + effectScaleLive * 0.62);
        const activeRibbons = Math.max(1, Math.floor(ribbonMeshes.length * Math.min(1, ribbonWeight * (0.16 + effectAmountLive * 0.36))));
        ribbonMeshes.forEach((mesh, index) => {
          mesh.visible = index < activeRibbons;
          if (!mesh.visible) return;
          mesh.rotation.z += delta * (0.25 + index * 0.14) * effectSpeedLive;
          mesh.rotation.y += delta * (0.2 + index * 0.1) * effectSpeedLive;
          const mat = ribbonMats[index];
          mat.color.set(index % 2 === 0 ? fillColorRef.current : keyColorRef.current);
          mat.opacity = (0.03 + effectAmountLive * (0.04 + index * 0.007)) * (0.3 + ribbonWeight * 0.9);
        });
      }

      if (shardGroup.visible) {
        const activeShards = Math.max(1, Math.floor(shardMeshes.length * Math.min(1, shardWeight * (0.12 + effectAmountLive * 0.4))));
        for (let i = 0; i < shardMeshes.length; i += 1) {
          const mesh = shardMeshes[i];
          const mat = shardMats[i];
          const visible = i < activeShards;
          mesh.visible = visible;
          if (!visible) continue;
          const phase = elapsed * shardSpeed[i] * effectSpeedLive + shardPhases[i];
          const radius = shardRadius[i] * (0.24 + effectSpreadLive * 0.82);
          mesh.position.set(
            orbitCenter.x + Math.cos(phase * 1.07) * radius,
            orbitCenter.y + shardHeight[i] * (0.22 + effectScaleLive * 0.4) + Math.sin(phase * 0.8) * 0.12,
            orbitCenter.z + Math.sin(phase) * radius
          );
          mesh.rotation.x += delta * (0.8 + shardSpeed[i] * 0.75) * effectSpeedLive;
          mesh.rotation.y += delta * (1 + shardSpeed[i]) * effectSpeedLive;
          mesh.rotation.z += delta * (0.55 + shardSpeed[i] * 0.5) * effectSpeedLive;
          mesh.scale.setScalar(0.4 + effectScaleLive * 0.52 + Math.sin(elapsed * 1.7 + shardPhases[i]) * 0.06);
          mat.opacity = (0.08 + effectAmountLive * 0.16) * (0.28 + shardWeight * 0.9);
        }
      }

      if (beamGroup.visible) {
        beamGroup.position.set(orbitCenter.x, orbitCenter.y + 0.2, orbitCenter.z);
        beamGroup.rotation.y += delta * (0.18 + effectSpeedLive * 0.2);
        const activeBeams = Math.max(1, Math.floor(beamMeshes.length * Math.min(1, beamWeight * (0.16 + effectAmountLive * 0.34))));
        for (let i = 0; i < beamMeshes.length; i += 1) {
          const mesh = beamMeshes[i];
          const mat = beamMats[i];
          const visible = i < activeBeams;
          mesh.visible = visible;
          if (!visible) continue;
          const phase = elapsed * 0.55 * effectSpeedLive + beamPhases[i];
          const radius = beamRadius[i] * (0.3 + effectSpreadLive * 0.8);
          mesh.position.set(Math.cos(phase + i * 0.42) * radius, Math.sin(phase * 0.74 + i) * 0.42, Math.sin(phase + i * 0.31) * radius);
          mesh.rotation.y = phase + i * 0.35;
          mesh.rotation.x = Math.sin(phase + i * 0.45) * 0.22;
          mesh.scale.set(0.45 + effectScaleLive * 0.32, 0.55 + effectScaleLive * 0.64, 1);
          mat.color.set(i % 2 === 0 ? fillColorRef.current : keyColorRef.current);
          mat.opacity = (0.05 + effectAmountLive * 0.12) * (0.32 + beamWeight * 0.9);
        }
      }

      if (heroTitleRef.current) {
        if (titleSyncRef.current) {
          const tx = THREE.MathUtils.clamp((camera.position.x - controls.target.x) * -22, -24, 24);
          const ty = THREE.MathUtils.clamp((camera.position.y - controls.target.y - 1) * -16, -16, 16);
          heroTitleRef.current.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
        } else {
          heroTitleRef.current.style.transform = "translate3d(0px, 0px, 0px)";
        }
      }

      composer.render();
    };

    animate();

    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      composer.setSize(mount.clientWidth, mount.clientHeight);
      bloomPass.setSize(mount.clientWidth, mount.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      clock.disconnect();
      window.clearTimeout(timeout);
      if (flashTimeout) {
        window.clearTimeout(flashTimeout);
      }
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("message", onProviderMessage);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endPointerDrag);
      endPointerDrag();
      runtimeScreens.forEach((runtime) => {
        if (runtime.video) {
          runtime.video.pause();
          runtime.video.src = "";
        }
      });
      runtimeScreens.clear();
      Array.from(providerOverlays.keys()).forEach((screenId) => {
        removeProviderOverlay(screenId);
      });

      controls.dispose();
      controlsRef.current = null;
      resetViewRef.current = null;
      triggerShotRef.current = null;
      captureStillRef.current = null;
      capturePackRef.current = null;
      frameSelectionRef.current = null;
      cycleSelectionRef.current = null;
      bloomRef.current = null;
      vignetteRef.current = null;
      atmoLightRef.current = null;
      particleMatRef.current = null;
      glyphMatRef.current = null;
      orbitBallMatsRef.current = [];
      ribbonMatsRef.current = [];
      shardMatsRef.current = [];
      beamMatsRef.current = [];
      softFillRef.current = null;
      floorMatRef.current = null;
      floorRef.current = null;
      floorGridTextureRef.current = null;
      ringGroupRef.current = null;
      fogGroupRef.current = null;
      contactShadowRef.current = null;
      rendererRef.current = null;
      applyHdriRef.current = null;

      if (mixer) {
        mixer.stopAllAction();
      }

      runtimeMeshes.forEach((mesh) => {
        const original = originalMaterials.get(mesh);
        if (original) {
          mesh.material = original;
        }
      });
      disposeOverrideMaterials();
      disposeCurrentHdri();
      pmremGenerator.dispose();

      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;

        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => mat.dispose());
        } else {
          mesh.material?.dispose();
        }
      });

      disposeTextures.forEach((tex) => tex.dispose());
      markerGeometry.dispose();
      keyMarkerMaterial.dispose();
      fillMarkerMaterial.dispose();
      targetMarkerMaterial.dispose();
      keyLineGeometry.dispose();
      fillLineGeometry.dispose();
      (keyLine.material as THREE.Material).dispose();
      (fillLine.material as THREE.Material).dispose();
      particleGeo.dispose();
      particleMat.dispose();
      glyphGeo.dispose();
      glyphMat.dispose();
      composer.dispose();
      renderer.dispose();

      if (heroTitleRef.current) {
        heroTitleRef.current.style.transform = "translate3d(0px, 0px, 0px)";
      }

      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [modelSource]);

  const sectionsByMode: Record<UiMode, FocusSection[]> = {
    basic: ["scene", "camera", "orbit", "post", "fx", "capture", "model"],
    pro: ["scene", "camera", "orbit", "lighting", "post", "fx", "model", "constraints", "capture", "presets", "motion", "debug"],
  };
  const modeAllowsSection = (section: FocusSection) => sectionsByMode[uiMode].includes(section);
  const sectionInActiveTab = (section: FocusSection) => {
    const tabsBySection: Record<FocusSection, PanelTab[]> = {
      scene: ["scene"],
      camera: ["scene"],
      orbit: ["lighting"],
      lighting: ["lighting"],
      post: ["lighting"],
      fx: ["fx"],
      model: ["model"],
      presets: ["scene"],
      motion: ["lighting"],
      constraints: ["lighting"],
      capture: ["render"],
      debug: ["render"],
    };
    return tabsBySection[section].includes(panelTab);
  };
  const isSectionVisible = (section: FocusSection) => modeAllowsSection(section) && sectionInActiveTab(section);
  const panelTabOrder: PanelTab[] = PANEL_TAB_CONFIG.map((entry) => entry.key);
  const panelTabIndex = panelTabOrder.indexOf(panelTab);
  const nextPanelTab = panelTabOrder[(panelTabIndex + 1) % panelTabOrder.length];
  const activePanelTabConfig = PANEL_TAB_CONFIG.find((entry) => entry.key === panelTab) ?? PANEL_TAB_CONFIG[0];
  const nextPanelTabConfig = PANEL_TAB_CONFIG.find((entry) => entry.key === nextPanelTab) ?? PANEL_TAB_CONFIG[0];
  const silhouetteScore = THREE.MathUtils.clamp((keyIntensity - fillIntensity * 0.6 + (hideLightSource ? 0.14 : 0)) / 1.4, 0, 1);
  const silhouetteLabel = silhouetteScore > 0.72 ? "Strong" : silhouetteScore > 0.46 ? "Balanced" : "Flat";
  const heroLines = heroTitleText.replace(/\r/g, "").split("\n");
  const longestHeroLine = heroLines.reduce((max, line) => Math.max(max, line.length), 1);
  const heroScale = THREE.MathUtils.clamp(
    1.08 - Math.max(0, longestHeroLine - 16) * 0.019 - Math.max(0, heroLines.length - 2) * 0.09,
    0.34,
    1.04
  );
  const activeEnvironmentConfig = ENVIRONMENT_MODE_CONFIG[environmentMode] ?? ENVIRONMENT_MODE_CONFIG.core;
  const environmentCssVars = activeEnvironmentConfig.vars as React.CSSProperties;
  const assistantSuggestions: Array<{ id: string; title: string; apply: () => void }> = [];
  if (keyIntensity < 0.95) {
    assistantSuggestions.push({
      id: "lift-key",
      title: "Lift key light for stronger subject definition",
      apply: () => setKeyIntensity((prev) => THREE.MathUtils.clamp(prev + 0.18, 0, KEY_INTENSITY_MAX)),
    });
  }
  if (fillIntensity > keyIntensity * 0.85) {
    assistantSuggestions.push({
      id: "trim-fill",
      title: "Reduce fill intensity to recover contrast",
      apply: () => setFillIntensity((prev) => THREE.MathUtils.clamp(prev - 0.14, 0, FILL_INTENSITY_MAX)),
    });
  }
  if (bloomStrength > 0.58) {
    assistantSuggestions.push({
      id: "tame-bloom",
      title: "Tone down bloom to improve detail retention",
      apply: () => setBloomStrength((prev) => THREE.MathUtils.clamp(prev - 0.1, 0, 0.9)),
    });
  }
  if (fogAmount < 0.1) {
    assistantSuggestions.push({
      id: "boost-atmos",
      title: "Increase atmosphere for more depth layering",
      apply: () => setFogAmount((prev) => THREE.MathUtils.clamp(prev + 0.07, 0, 0.45)),
    });
  }
  if (keyElevation < 22) {
    assistantSuggestions.push({
      id: "raise-key",
      title: "Raise key elevation to improve face readability",
      apply: () => setKeyElevation((prev) => clampElevation(prev + 12)),
    });
  }

  return (
    <>
      <style>{`
        :root {
          --bg: #0a0a0a;
          --silver: #e0e0e0;
          --accent: #ff3c00;
          --grain-opacity: 0.15;
          --env-backdrop: none;
          --panel-bg: rgba(7, 9, 14, 0.62);
          --panel-bg-soft: rgba(12, 15, 24, 0.52);
          --panel-border: rgba(196, 218, 255, 0.2);
          --panel-highlight: rgba(180, 214, 255, 0.4);
          --panel-shadow: 0 22px 54px rgba(0, 0, 0, 0.48), 0 6px 20px rgba(2, 8, 19, 0.4);
          --hero-blend: difference;
          --motion-standard: cubic-bezier(0.22, 1, 0.36, 1);
          --motion-snappy: cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .halide-body {
          background-color: var(--bg);
          background-image: var(--env-backdrop);
          color: var(--silver);
          font-family: 'Syncopate', sans-serif;
          overflow: hidden;
          height: 100vh;
          width: 100vw;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .halide-grain {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 100;
          opacity: var(--grain-opacity);
        }

        .viewport {
          perspective: 2000px;
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .canvas-3d {
          position: relative;
          width: 100vw;
          height: 100vh;
          transform-style: preserve-3d;
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .model-canvas {
          position: absolute;
          inset: 0;
        }

        .model-canvas canvas {
          width: 100% !important;
          height: 100% !important;
          display: block;
        }

        .interface-grid {
          position: fixed;
          inset: 0;
          padding: 4rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto 1fr auto;
          z-index: 10;
          pointer-events: none;
        }

        .hero-title {
          grid-column: 1 / -1;
          align-self: center;
          max-width: min(30vw, 540px);
          width: fit-content;
          font-size: clamp(
            calc(1.3rem * var(--hero-scale, 1)),
            calc(10vw * var(--hero-scale, 1)),
            calc(9rem * var(--hero-scale, 1))
          );
          line-height: 0.88;
          letter-spacing: -0.04em;
          mix-blend-mode: var(--hero-blend);
          transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: transform;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .cta-button {
          pointer-events: auto;
          background: var(--silver);
          color: var(--bg);
          padding: 1rem 2rem;
          text-decoration: none;
          font-weight: 700;
          clip-path: polygon(0 0, 100% 0, 100% 70%, 85% 100%, 0 100%);
          transition: 0.3s;
        }

        .cta-button:hover {
          background: var(--accent);
          transform: translateY(-5px);
        }

        .scroll-hint {
          position: absolute;
          bottom: 2rem;
          left: 50%;
          width: 1px;
          height: 60px;
          background: linear-gradient(to bottom, var(--silver), transparent);
          animation: flow 2s infinite ease-in-out;
        }

        .scene-controls {
          position: fixed;
          left: 0;
          top: 0;
          transform: translateX(0);
          z-index: 40;
          width: min(300px, calc(100vw - 1.4rem));
          max-height: calc(100vh - 1.2rem);
          border: 1px solid var(--panel-border);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0) 16%),
            radial-gradient(circle at 0% 0%, rgba(135, 183, 255, 0.1), transparent 40%),
            radial-gradient(circle at 100% 100%, rgba(255, 84, 45, 0.08), transparent 46%),
            var(--panel-bg);
          backdrop-filter: blur(14px) saturate(120%);
          padding: 0.62rem;
          display: flex;
          flex-direction: column;
          gap: 0.48rem;
          color: rgba(230, 230, 230, 0.92);
          font-family: "IBM Plex Mono", monospace;
          overflow: visible;
          box-shadow: var(--panel-shadow);
          transition: transform 0.58s var(--motion-standard), opacity 0.38s ease, box-shadow 0.34s ease;
        }

        .scene-controls.closed {
          transform: translateX(calc(-100% - 32px));
          opacity: 0;
          pointer-events: none;
        }

        .scene-controls.open {
          transform: translateX(0);
          opacity: 1;
          animation: panelBreathe 9s ease-in-out infinite;
        }

        .scene-controls.advanced-off .controls-scroll > .panel-section:not(:first-child),
        .scene-controls.advanced-off .kbd-hints,
        .scene-controls.advanced-off .hint-rail {
          display: none;
        }

        .scene-controls.minimized {
          width: 138px;
          max-height: 112px;
          overflow: visible;
        }

        .scene-panel-toggle {
          position: fixed;
          left: 10px;
          top: 18px;
          z-index: 52;
          border: 1px solid rgba(206, 226, 252, 0.38);
          background: linear-gradient(180deg, rgba(18, 26, 41, 0.88), rgba(8, 12, 21, 0.9));
          color: rgba(246, 250, 255, 0.92);
          font-family: "IBM Plex Mono", monospace;
          font-size: 0.5rem;
          letter-spacing: 0.11em;
          text-transform: uppercase;
          padding: 0.32rem 0.44rem;
          cursor: pointer;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.34);
          transition: filter 0.22s ease, transform 0.22s var(--motion-standard), border-color 0.22s ease;
        }

        .scene-panel-toggle:hover {
          transform: translateY(-1px);
          filter: brightness(1.06);
          border-color: rgba(220, 236, 255, 0.58);
        }

        .quick-corner {
          position: fixed;
          right: 16px;
          top: 16px;
          z-index: 58;
          border: 1px solid rgba(188, 215, 248, 0.24);
          background:
            linear-gradient(180deg, rgba(8, 13, 23, 0.9), rgba(5, 9, 17, 0.86)),
            var(--panel-bg-soft);
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.36);
          backdrop-filter: blur(10px) saturate(120%);
          display: grid;
          gap: 0.28rem;
          padding: 0.42rem;
          width: min(242px, calc(100vw - 1.2rem));
        }

        .quick-corner .section-label {
          margin: 0;
        }

        .scene-toggle {
          position: absolute;
          top: 50%;
          right: -35px;
          width: 35px;
          height: 76px;
          transform: translateY(-50%);
          border: 1px solid rgba(215, 231, 255, 0.32);
          border-left: none;
          background: linear-gradient(180deg, rgba(28, 34, 46, 0.84), rgba(7, 9, 14, 0.85));
          color: rgba(246, 249, 255, 0.92);
          display: grid;
          place-items: center;
          font-size: 0.62rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          user-select: none;
          transition: filter 0.24s ease, transform 0.24s var(--motion-standard);
          z-index: 3;
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.36);
        }

        .scene-toggle:hover {
          filter: brightness(1.08);
        }

        .scene-toggle span {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
        }

        .scene-controls h2 {
          margin: 0;
          font-size: 0.63rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(238, 246, 255, 0.82);
        }

        .controls-head {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 0.36rem;
          flex-wrap: wrap;
        }

        .selection-pill {
          border: 1px solid rgba(198, 216, 248, 0.3);
          background: linear-gradient(180deg, rgba(118, 173, 255, 0.26), rgba(86, 138, 214, 0.2));
          color: rgba(233, 245, 255, 0.9);
          font-size: 0.45rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 0.15rem 0.32rem;
          border-radius: 2px;
          white-space: nowrap;
        }

        .panel-drag-handle {
          border: 1px solid rgba(198, 216, 248, 0.26);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.04));
          color: rgba(244, 249, 255, 0.86);
          font-size: 0.46rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 0.18rem 0.3rem;
          cursor: grab;
          user-select: none;
          touch-action: none;
          border-radius: 2px;
        }

        .panel-drag-handle:active {
          cursor: grabbing;
        }

        .head-actions {
          display: flex;
          align-items: center;
          gap: 0.24rem;
          margin-left: auto;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .controls-scroll {
          display: grid;
          gap: 0.5rem;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding-right: 0.24rem;
        }

        .controls-scroll::-webkit-scrollbar,
        .timeline-list::-webkit-scrollbar {
          width: 7px;
          height: 7px;
        }

        .controls-scroll::-webkit-scrollbar-track,
        .timeline-list::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 999px;
        }

        .controls-scroll::-webkit-scrollbar-thumb,
        .timeline-list::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(170, 204, 255, 0.42), rgba(112, 141, 205, 0.42));
          border-radius: 999px;
        }

        .panel-section {
          display: grid;
          gap: 0.34rem;
          padding-bottom: 0.18rem;
          padding-top: 0.04rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          animation: sectionFadeIn 0.42s var(--motion-standard) both;
        }

        .panel-section:first-child {
          border-top: none;
          padding-top: 0;
        }

        .section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.35rem;
        }

        .section-head .mini-btn {
          padding: 0.2rem 0.35rem;
          font-size: 0.46rem;
        }

        .mode-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.32rem;
        }

        .intent-row {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.32rem;
        }

        .fx-style-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.32rem;
        }

        .intent-btn {
          display: grid;
          justify-items: center;
          align-content: center;
          gap: 0.2rem;
          min-height: 2.45rem;
          letter-spacing: 0.09em;
          padding: 0.28rem 0.18rem;
        }

        .intent-btn span {
          font-size: 0.43rem;
          letter-spacing: 0.08em;
          line-height: 1.1;
          text-align: center;
          text-transform: uppercase;
          white-space: normal;
        }

        .tab-icon {
          width: 0.88rem;
          height: 0.88rem;
          opacity: 0.86;
        }

        .intent-btn.active .tab-icon {
          opacity: 1;
        }

        .intent-btn.active {
          border-color: rgba(255, 60, 0, 0.72);
          background: linear-gradient(180deg, rgba(255, 90, 34, 0.22), rgba(255, 60, 0, 0.08));
          color: #ff3c00;
          box-shadow: 0 0 0 1px rgba(255, 60, 0, 0.25), 0 10px 18px rgba(255, 60, 0, 0.18);
        }

        .intent-btn.active span,
        .intent-btn.active .tab-icon {
          color: #ff3c00;
        }

        .scene-controls.minimized .controls-scroll {
          display: none;
        }

        .section-label {
          margin: 0;
          font-size: 0.52rem;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.56);
        }

        .control-help {
          margin: 0;
          font-size: 0.5rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.46);
        }

        .preset-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.35rem;
        }

        .preset-row + .control-line,
        .preset-row + .switch-line,
        .fx-style-grid + .control-line,
        .fx-style-grid + .switch-line {
          margin-top: 0.22rem;
        }

        .preset-btn {
          border: 1px solid rgba(198, 216, 248, 0.26);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.04));
          color: rgba(241, 246, 255, 0.82);
          font-size: 0.58rem;
          text-transform: uppercase;
          letter-spacing: 0.11em;
          padding: 0.34rem 0.32rem;
          cursor: pointer;
          transition: transform 0.22s var(--motion-snappy), border-color 0.24s ease, background 0.24s ease, color 0.24s ease, box-shadow 0.24s ease;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 4px 10px rgba(0, 0, 0, 0.18);
        }

        .preset-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(215, 232, 255, 0.52);
          background: linear-gradient(180deg, rgba(175, 206, 255, 0.2), rgba(255, 255, 255, 0.08));
          color: rgba(252, 255, 255, 0.95);
        }

        .preset-btn.active {
          background: linear-gradient(180deg, rgba(244, 249, 255, 0.96), rgba(221, 235, 255, 0.9));
          color: #0f1218;
          border-color: rgba(255, 255, 255, 0.94);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.34), 0 8px 18px rgba(108, 157, 255, 0.25);
        }

        .preset-btn.intent-btn.active {
          border-color: rgba(255, 60, 0, 0.82);
          background: linear-gradient(180deg, rgba(255, 96, 42, 0.34), rgba(255, 60, 0, 0.14));
          color: #ff3c00;
          box-shadow: 0 0 0 1px rgba(255, 60, 0, 0.28), 0 10px 18px rgba(255, 60, 0, 0.2);
        }

        .preset-btn.intent-btn.active .tab-icon,
        .preset-btn.intent-btn.active span {
          color: #ff3c00;
          opacity: 1;
        }

        .control-line {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 0.42rem;
          font-size: 0.56rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .control-line input[type="range"] {
          width: 100%;
          accent-color: #75a7ff;
          height: 12px;
          background: transparent;
        }

        .control-line input[type="range"]::-webkit-slider-runnable-track {
          height: 4px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(124, 166, 255, 0.95), rgba(240, 245, 255, 0.94));
        }

        .control-line input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 13px;
          height: 13px;
          border-radius: 999px;
          margin-top: -4.5px;
          border: 1px solid rgba(10, 16, 30, 0.6);
          background: radial-gradient(circle at 30% 30%, #ffffff, #c8dcff 64%, #7ea9ff);
          box-shadow: 0 0 0 2px rgba(140, 186, 255, 0.28), 0 4px 10px rgba(0, 0, 0, 0.28);
          transition: transform 0.18s ease;
        }

        .control-line input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.08);
        }

        .control-line input[type="range"]::-moz-range-track {
          height: 4px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(124, 166, 255, 0.95), rgba(240, 245, 255, 0.94));
        }

        .control-line input[type="range"]::-moz-range-thumb {
          width: 13px;
          height: 13px;
          border-radius: 999px;
          border: 1px solid rgba(10, 16, 30, 0.6);
          background: radial-gradient(circle at 30% 30%, #ffffff, #c8dcff 64%, #7ea9ff);
          box-shadow: 0 0 0 2px rgba(140, 186, 255, 0.28), 0 4px 10px rgba(0, 0, 0, 0.28);
        }

        .control-line input[type="color"] {
          width: 26px;
          height: 20px;
          border: 1px solid rgba(255, 255, 255, 0.35);
          background: transparent;
          padding: 0;
        }

        .control-select {
          width: 100%;
          border: 1px solid rgba(190, 209, 241, 0.26);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
          color: rgba(245, 250, 255, 0.9);
          font-size: 0.56rem;
          letter-spacing: 0.06em;
          padding: 0.25rem 0.34rem;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }

        .control-select:hover,
        .control-select:focus {
          border-color: rgba(220, 236, 255, 0.55);
          box-shadow: 0 0 0 1px rgba(163, 202, 255, 0.28), 0 0 0 3px rgba(111, 169, 255, 0.16);
          outline: none;
        }

        .control-textarea {
          width: 100%;
          min-height: 58px;
          max-height: 140px;
          resize: vertical;
          border: 1px solid rgba(190, 209, 241, 0.26);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
          color: rgba(245, 250, 255, 0.9);
          font-size: 0.54rem;
          letter-spacing: 0.06em;
          padding: 0.28rem 0.34rem;
          font-family: "IBM Plex Mono", monospace;
          line-height: 1.4;
        }

        .control-textarea:hover,
        .control-textarea:focus {
          border-color: rgba(220, 236, 255, 0.55);
          box-shadow: 0 0 0 1px rgba(163, 202, 255, 0.28), 0 0 0 3px rgba(111, 169, 255, 0.16);
          outline: none;
        }

        .api-payload {
          min-height: 76px;
          max-height: 160px;
          font-size: 0.5rem;
          line-height: 1.35;
        }

        .api-log-list {
          border: 1px solid rgba(196, 216, 248, 0.2);
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.34));
          max-height: 178px;
          overflow-y: auto;
          padding: 0.3rem;
          display: grid;
          gap: 0.24rem;
        }

        .api-log-item {
          display: grid;
          gap: 0.14rem;
          padding: 0.24rem 0.28rem;
          border-left: 2px solid rgba(178, 205, 248, 0.44);
          background: rgba(255, 255, 255, 0.04);
        }

        .api-log-item.event {
          border-left-color: rgba(145, 205, 255, 0.76);
        }

        .api-log-item.response {
          border-left-color: rgba(122, 221, 174, 0.78);
        }

        .api-log-item.command {
          border-left-color: rgba(187, 195, 255, 0.76);
        }

        .api-log-item.error {
          border-left-color: rgba(255, 130, 130, 0.84);
        }

        .api-log-item.info {
          border-left-color: rgba(194, 204, 218, 0.6);
          opacity: 0.82;
        }

        .api-log-meta {
          font-size: 0.46rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(236, 245, 255, 0.72);
          line-height: 1.25;
        }

        .api-log-summary {
          font-size: 0.48rem;
          letter-spacing: 0.04em;
          color: rgba(245, 250, 255, 0.87);
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .hint-rail {
          border: 1px solid rgba(198, 216, 245, 0.2);
          background:
            linear-gradient(90deg, rgba(113, 170, 255, 0.12) 0 3px, transparent 3px),
            linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.03));
          padding: 0.38rem 0.44rem;
          min-height: 2.2rem;
          display: flex;
          align-items: center;
          font-size: 0.5rem;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: rgba(238, 245, 255, 0.79);
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.22);
        }

        .kbd-hints {
          display: grid;
          gap: 0.2rem;
          border: 1px solid rgba(198, 216, 245, 0.18);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
          padding: 0.28rem 0.34rem;
          font-size: 0.47rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(230, 230, 230, 0.7);
        }

        .kbd-hints kbd {
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.08);
          padding: 0.05rem 0.2rem;
          border-radius: 4px;
          font-size: 0.44rem;
        }

        .file-input {
          width: 100%;
          border: 1px solid rgba(190, 209, 241, 0.26);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
          color: rgba(245, 250, 255, 0.85);
          font-size: 0.56rem;
          letter-spacing: 0.06em;
          padding: 0.28rem 0.34rem;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .file-input:hover,
        .file-input:focus {
          border-color: rgba(220, 236, 255, 0.55);
          box-shadow: 0 0 0 1px rgba(163, 202, 255, 0.28), 0 0 0 3px rgba(111, 169, 255, 0.16);
          outline: none;
        }

        .model-actions {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.32rem;
          align-items: center;
        }

        .mini-btn {
          border: 1px solid rgba(198, 216, 248, 0.28);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.04));
          color: rgba(244, 249, 255, 0.88);
          font-size: 0.52rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 0.32rem 0.42rem;
          cursor: pointer;
          transition: transform 0.2s var(--motion-snappy), border-color 0.22s ease, filter 0.2s ease, box-shadow 0.2s ease;
        }

        .mini-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(220, 236, 255, 0.6);
          filter: brightness(1.06);
          box-shadow: 0 7px 15px rgba(0, 0, 0, 0.2);
        }

        .file-name {
          margin: 0;
          font-size: 0.5rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.5);
        }

        .orbital-card {
          border: 1px solid rgba(198, 216, 245, 0.18);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
            var(--panel-bg-soft);
          padding: 0.4rem;
          display: grid;
          gap: 0.35rem;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
        }

        .orbital-top {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.32rem;
        }

        .orb-sphere {
          width: 100%;
          max-width: 150px;
          aspect-ratio: 1 / 1;
          border-radius: 999px;
          margin: 0 auto;
          position: relative;
          cursor: grab;
          touch-action: none;
          border: 1px solid rgba(198, 216, 245, 0.3);
          background:
            radial-gradient(circle at 30% 28%, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.02) 40%),
            conic-gradient(from 230deg at 50% 50%, rgba(116, 167, 255, 0.12), rgba(255, 255, 255, 0.03), rgba(255, 135, 96, 0.12), rgba(116, 167, 255, 0.12)),
            radial-gradient(circle at 70% 72%, rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.42) 58%),
            linear-gradient(145deg, rgba(255, 255, 255, 0.03), rgba(0, 0, 0, 0.2));
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 10px 18px rgba(0, 0, 0, 0.2);
          transition: border-color 0.24s ease, transform 0.24s var(--motion-standard), box-shadow 0.24s ease;
        }

        .orb-sphere:hover {
          border-color: rgba(225, 236, 255, 0.6);
          transform: translateY(-1px);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 14px 22px rgba(0, 0, 0, 0.28);
        }

        .orb-sphere:active {
          cursor: grabbing;
        }

        .orb-cross-x,
        .orb-cross-y {
          position: absolute;
          background: rgba(255, 255, 255, 0.12);
          pointer-events: none;
        }

        .orb-cross-x {
          left: 8%;
          right: 8%;
          top: 50%;
          height: 1px;
        }

        .orb-cross-y {
          top: 8%;
          bottom: 8%;
          left: 50%;
          width: 1px;
        }

        .orb-dot {
          position: absolute;
          width: 13px;
          height: 13px;
          border-radius: 999px;
          background: #ff754a;
          border: 1px solid rgba(0, 0, 0, 0.45);
          box-shadow: 0 0 12px rgba(255, 117, 74, 0.7);
          transform: translate(-50%, -50%);
          pointer-events: none;
          animation: orbDotPulse 1.8s ease-in-out infinite;
        }

        .orb-dot.back {
          background: rgba(140, 180, 255, 0.55);
          box-shadow: none;
          border-style: dashed;
          opacity: 0.75;
        }

        .control-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: center;
          gap: 0.35rem;
        }

        .coord-readout {
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.03);
          padding: 0.35rem 0.42rem;
          display: grid;
          gap: 0.2rem;
          font-size: 0.52rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.72);
        }

        .timeline-list {
          max-height: 132px;
          overflow-y: auto;
          display: grid;
          gap: 0.24rem;
        }

        .timeline-item {
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(240, 240, 240, 0.84);
          font-size: 0.5rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 0.28rem 0.34rem;
          text-align: left;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          gap: 0.3rem;
        }

        .timeline-item.active {
          border-color: rgba(255, 255, 255, 0.76);
          background: rgba(255, 255, 255, 0.82);
          color: #111;
        }

        .slot-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.28rem;
        }

        .slot-chip {
          border: 1px solid rgba(198, 216, 248, 0.25);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.03));
          color: rgba(244, 249, 255, 0.88);
          font-size: 0.5rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          padding: 0.3rem 0.2rem;
          text-align: center;
          cursor: pointer;
          transition: transform 0.2s var(--motion-snappy), border-color 0.22s ease, box-shadow 0.22s ease;
        }

        .slot-chip:hover {
          transform: translateY(-1px);
          border-color: rgba(220, 236, 255, 0.6);
          box-shadow: 0 8px 14px rgba(0, 0, 0, 0.18);
        }

        .slot-chip.active {
          border-color: rgba(168, 216, 255, 0.9);
          background: linear-gradient(180deg, rgba(151, 205, 255, 0.38), rgba(95, 174, 255, 0.28));
          box-shadow: 0 0 0 1px rgba(132, 195, 255, 0.35), 0 0 18px rgba(82, 160, 255, 0.26);
        }

        .assistant-list {
          display: grid;
          gap: 0.28rem;
        }

        .assistant-item {
          border: 1px solid rgba(198, 216, 245, 0.17);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.03));
          padding: 0.34rem;
          display: grid;
          gap: 0.22rem;
          transition: border-color 0.24s ease, transform 0.24s var(--motion-standard), box-shadow 0.24s ease;
        }

        .assistant-item:hover {
          border-color: rgba(224, 238, 255, 0.55);
          transform: translateY(-1px);
          box-shadow: 0 10px 18px rgba(0, 0, 0, 0.18);
        }

        .assistant-title {
          margin: 0;
          font-size: 0.49rem;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: rgba(243, 243, 243, 0.86);
        }

        .overlay-frame {
          position: absolute;
          inset: 0;
          z-index: 12;
          pointer-events: none;
        }

        .provider-layer {
          position: absolute;
          inset: 0;
          z-index: 14;
          pointer-events: none;
          overflow: hidden;
        }

        .provider-card {
          position: absolute;
          top: 0;
          left: 0;
          transform-origin: 50% 50%;
          border: 1px solid rgba(180, 210, 246, 0.28);
          background: rgba(5, 8, 14, 0.8);
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.38);
          pointer-events: auto;
          overflow: hidden;
        }

        .provider-card iframe {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
          background: #000;
        }

        .silhouette-badge {
          position: absolute;
          top: 14px;
          right: 14px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(0, 0, 0, 0.48);
          padding: 0.24rem 0.4rem;
          font-size: 0.48rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(244, 244, 244, 0.9);
        }

        .screen-hud {
          position: absolute;
          top: 0;
          left: 0;
          z-index: 24;
          display: flex;
          align-items: center;
          gap: 0.24rem;
          padding: 0.28rem 0.32rem;
          border: 1px solid rgba(190, 213, 246, 0.3);
          background: linear-gradient(180deg, rgba(7, 11, 20, 0.9), rgba(9, 13, 24, 0.84));
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.34);
          backdrop-filter: blur(6px) saturate(118%);
          opacity: 0;
          pointer-events: none;
          transform: translate(-50%, -100%);
          transition: opacity 0.2s ease;
        }

        .screen-hud .hud-btn {
          border: 1px solid rgba(198, 216, 248, 0.3);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03));
          color: rgba(245, 250, 255, 0.88);
          font-size: 0.48rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          padding: 0.22rem 0.3rem;
          cursor: pointer;
          transition: border-color 0.2s ease, filter 0.2s ease;
        }

        .screen-hud .hud-btn:hover {
          border-color: rgba(220, 236, 255, 0.62);
          filter: brightness(1.08);
        }

        .screen-hud .hud-title {
          border: 1px solid rgba(198, 216, 245, 0.26);
          background: rgba(255, 255, 255, 0.06);
          color: rgba(234, 244, 255, 0.9);
          font-size: 0.46rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 0.2rem 0.3rem;
          white-space: nowrap;
        }

        .media-dock {
          position: fixed;
          right: 16px;
          bottom: 16px;
          z-index: 62;
          width: min(390px, calc(100vw - 1rem));
          border: 1px solid rgba(188, 215, 248, 0.28);
          background:
            linear-gradient(180deg, rgba(8, 12, 22, 0.92), rgba(6, 10, 18, 0.9)),
            var(--panel-bg-soft);
          box-shadow: 0 18px 42px rgba(0, 0, 0, 0.42);
          backdrop-filter: blur(12px) saturate(125%);
          display: grid;
          gap: 0.48rem;
          padding: 0.55rem;
          transition: transform 0.32s var(--motion-standard), opacity 0.24s ease;
        }

        .media-dock.collapsed {
          width: min(220px, calc(100vw - 1rem));
        }

        .media-dock.collapsed .media-dock-body {
          display: none;
        }

        .media-dock-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.35rem;
          flex-wrap: wrap;
          overflow: hidden;
        }

        .media-dock-tools {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.32rem;
          flex-wrap: wrap;
          max-width: 100%;
        }

        .media-dock-title {
          display: grid;
          gap: 0.12rem;
          min-width: 0;
        }

        .media-dock-title strong {
          font-size: 0.58rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: rgba(244, 248, 255, 0.92);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-dock-title span {
          font-size: 0.5rem;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: rgba(217, 231, 248, 0.66);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .media-dock-kind {
          border: 1px solid rgba(198, 216, 245, 0.2);
          background: rgba(255, 255, 255, 0.06);
          padding: 0.1rem 0.28rem;
          font-size: 0.47rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(234, 244, 255, 0.8);
        }

        .media-dock-sync {
          border: 1px solid rgba(198, 216, 245, 0.2);
          background: rgba(255, 255, 255, 0.05);
          padding: 0.1rem 0.28rem;
          font-size: 0.45rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(215, 232, 255, 0.8);
        }

        .media-dock-sync.hard {
          border-color: rgba(120, 204, 164, 0.42);
          background: rgba(88, 168, 132, 0.18);
          color: rgba(193, 255, 225, 0.9);
        }

        .media-dock-sync.state {
          border-color: rgba(224, 176, 102, 0.45);
          background: rgba(156, 116, 58, 0.22);
          color: rgba(255, 229, 181, 0.9);
        }

        .media-dock-sync.single {
          border-color: rgba(131, 198, 255, 0.46);
          background: rgba(74, 122, 176, 0.24);
          color: rgba(205, 232, 255, 0.95);
        }

        .media-dock-body {
          display: grid;
          gap: 0.48rem;
        }

        .media-dock-info {
          border: 1px solid rgba(198, 216, 245, 0.18);
          background: rgba(255, 255, 255, 0.04);
          padding: 0.32rem 0.36rem;
          display: grid;
          gap: 0.24rem;
        }

        .media-dock-info-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.38rem;
          font-size: 0.48rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(210, 228, 250, 0.74);
        }

        .media-dock-info-row strong {
          color: rgba(241, 248, 255, 0.92);
          font-weight: 600;
        }

        .media-dock-media {
          border: 1px solid rgba(180, 210, 246, 0.24);
          background: rgba(4, 7, 13, 0.84);
          min-height: 90px;
          max-height: 240px;
          overflow: hidden;
        }

        .media-dock-media iframe,
        .media-dock-media video,
        .media-dock-media img {
          width: 100%;
          height: 100%;
          min-height: 90px;
          max-height: 240px;
          display: block;
          border: none;
          object-fit: contain;
          background: #000;
        }

        .media-dock-media audio {
          width: 100%;
          display: block;
        }

        .media-dock-empty {
          font-size: 0.52rem;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: rgba(215, 231, 252, 0.66);
          padding: 0.7rem 0.5rem;
        }

        .media-dock-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.28rem;
        }

        .media-dock-audio {
          border: 1px solid rgba(198, 216, 245, 0.2);
          background: rgba(255, 255, 255, 0.04);
          padding: 0.3rem;
          display: grid;
          gap: 0.28rem;
        }

        .media-dock-controls {
          border: 1px solid rgba(198, 216, 245, 0.18);
          background: rgba(255, 255, 255, 0.03);
          padding: 0.36rem;
          display: grid;
          gap: 0.34rem;
        }

        .switch-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.3rem;
          font-size: 0.56rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .switch-line input[type="checkbox"] {
          accent-color: #6ea0ff;
        }

        .extras-toggle {
          border: 1px solid rgba(198, 216, 248, 0.26);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.03));
          color: rgba(244, 249, 255, 0.9);
          font-size: 0.56rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          padding: 0.35rem 0.45rem;
          cursor: pointer;
          text-align: left;
          transition: transform 0.2s var(--motion-snappy), border-color 0.22s ease, box-shadow 0.22s ease;
        }

        .extras-toggle:hover {
          transform: translateY(-1px);
          border-color: rgba(220, 236, 255, 0.55);
          box-shadow: 0 8px 14px rgba(0, 0, 0, 0.18);
        }

        .action-btn {
          border: 1px solid rgba(198, 216, 248, 0.28);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.04));
          color: rgba(246, 250, 255, 0.88);
          font-size: 0.56rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          padding: 0.35rem 0.45rem;
          cursor: pointer;
          transition: transform 0.2s var(--motion-snappy), border-color 0.22s ease, box-shadow 0.22s ease, filter 0.22s ease;
        }

        .action-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(220, 236, 255, 0.62);
          box-shadow: 0 10px 16px rgba(0, 0, 0, 0.2);
          filter: brightness(1.06);
        }

        .action-btn:disabled,
        .mini-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .action-btn.wide {
          grid-column: 1 / -1;
        }

        .capture-flash {
          position: fixed;
          inset: 0;
          z-index: 120;
          background: rgba(255, 255, 255, 0.45);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.36s ease;
          backdrop-filter: blur(2px);
        }

        .capture-flash.show {
          opacity: 0.26;
        }

        button:focus-visible,
        input:focus-visible,
        select:focus-visible,
        textarea:focus-visible {
          outline: none;
          box-shadow: 0 0 0 1px rgba(203, 229, 255, 0.65), 0 0 0 3px rgba(111, 169, 255, 0.2);
        }

        @keyframes flow {
          0%,
          100% {
            transform: scaleY(0);
            transform-origin: top;
          }

          50% {
            transform: scaleY(1);
            transform-origin: top;
          }

          51% {
            transform: scaleY(1);
            transform-origin: bottom;
          }
        }

        @keyframes sectionFadeIn {
          0% {
            opacity: 0;
            transform: translateY(5px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes orbDotPulse {
          0%, 100% {
            box-shadow: 0 0 10px rgba(255, 117, 74, 0.58);
          }
          50% {
            box-shadow: 0 0 18px rgba(255, 117, 74, 0.85);
          }
        }

        @keyframes panelBreathe {
          0%, 100% {
            box-shadow: var(--panel-shadow);
          }
          50% {
            box-shadow: 0 24px 58px rgba(0, 0, 0, 0.52), 0 8px 20px rgba(42, 95, 190, 0.18);
          }
        }

        .presentation-profile .scene-panel-toggle,
        .presentation-profile .quick-corner,
        .presentation-profile .scene-controls,
        .presentation-profile .screen-hud,
        .presentation-profile .media-dock,
        .presentation-profile .orbital-card,
        .presentation-profile .orb-sphere {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .scene-controls,
          .panel-section,
          .preset-btn,
          .mini-btn,
          .action-btn,
          .orb-sphere,
          .orb-dot,
          .assistant-item,
          .slot-chip {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 900px) {
          .interface-grid {
            padding: 1.5rem;
          }

          .media-dock {
            right: 0.6rem;
            left: 0.6rem;
            width: auto;
            bottom: 0.6rem;
          }

          .intent-row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .fx-style-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .scene-controls {
            width: min(250px, calc(100vw - 1.2rem));
          }

          .scene-controls.closed {
            transform: translateX(calc(-100% - 30px));
          }

          .scene-toggle {
            right: -30px;
            width: 30px;
            height: 68px;
          }

          .scene-panel-toggle {
            left: 8px;
            top: 12px;
          }

          .quick-corner {
            right: 0.6rem;
            top: 0.6rem;
            width: min(220px, calc(100vw - 1.2rem));
          }
        }
      `}</style>

      <div className={`halide-body ${isProfilePresentation ? "presentation-profile" : ""}`} style={environmentCssVars}>
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves={3} />
            <feColorMatrix type="saturate" values={0} />
          </filter>
        </svg>

        <div className="halide-grain" style={{ filter: "url(#grain)" }}></div>

        {!isProfilePresentation ? (
        <div className="interface-grid">
          <div style={{ fontWeight: 700 }}>HALIDE_CORE</div>
          <div style={{ textAlign: "right", fontFamily: "monospace", color: "var(--accent)", fontSize: "0.7rem" }}>
            <div>LATITUDE: 34.0522° N</div>
            <div>FOCAL DEPTH: 80MM</div>
          </div>

          <h1 className="hero-title" ref={heroTitleRef} style={{ "--hero-scale": heroScale } as React.CSSProperties}>
            {heroTitleText.split("\n").map((line, index, arr) => (
              <React.Fragment key={`${line}-${index}`}>
                {line || "\u00A0"}
                {index < arr.length - 1 ? <br /> : null}
              </React.Fragment>
            ))}
          </h1>

          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
              <p>[ ARCHIVE 2024 ]</p>
              <p>SURFACE TENSION & TOPOGRAPHICAL LIGHT · {activePanelTabConfig.label.toUpperCase()}</p>
            </div>
            <button
              type="button"
              className="cta-button"
              onClick={() => {
                setPanelTab(nextPanelTab);
              }}
              title="Cycle main control tab"
            >
              {`NEXT: ${nextPanelTabConfig.label.toUpperCase()}`}
            </button>
          </div>
        </div>
        ) : null}

        <div className="viewport">
          <div className="canvas-3d" ref={canvasRef}>
            <div className="model-canvas" ref={mountRef}></div>
            <div ref={providerLayerRef} className="provider-layer" aria-hidden="false"></div>
            {!isProfilePresentation ? (
            <div className="overlay-frame">
              {overlaySilhouette && <div className="silhouette-badge">Silhouette: {silhouetteLabel}</div>}
            </div>
            ) : null}
            {!isProfilePresentation ? (
            <div ref={screenHudRef} className="screen-hud" aria-label="Selection quick controls">
              <span className="hud-title">
                {sceneHudMode === "screen"
                  ? activeScreen
                    ? `Screen ${activeScreen.label}`
                    : "Screen"
                  : sceneHudMode === "model"
                    ? "Model"
                    : sceneHudMode === "light"
                      ? `${sceneHudLightLabel} Light`
                      : "Selection"}
              </span>
              {sceneHudMode === "model" ? (
                <>
                  <button
                    type="button"
                    className="hud-btn"
                    onClick={() => setModelFloat((prev) => !prev)}
                  >
                    {modelFloat ? "Float On" : "Float Off"}
                  </button>
                  <button
                    type="button"
                    className="hud-btn"
                    onClick={() =>
                      setScreenAttachmentMode((prev) =>
                        prev === "world"
                          ? "follow-pos"
                          : prev === "follow-pos"
                            ? "follow-pos-yaw"
                            : prev === "follow-pos-yaw"
                              ? "follow-full"
                              : "world"
                      )
                    }
                  >
                    {`Attach ${screenAttachmentMode}`}
                  </button>
                </>
              ) : null}
              {sceneHudMode === "light" ? (
                <>
                  <button
                    type="button"
                    className="hud-btn"
                    onClick={() => {
                      setActiveOrbitalLight("key");
                      setSceneSelection("light-key");
                    }}
                  >
                    Key
                  </button>
                  <button
                    type="button"
                    className="hud-btn"
                    onClick={() => {
                      setActiveOrbitalLight("fill");
                      setSceneSelection("light-fill");
                    }}
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    className="hud-btn"
                    onClick={() => {
                      setSceneSelection("light-target");
                    }}
                  >
                    Target
                  </button>
                  <button type="button" className="hud-btn" onClick={() => setHideLightSource((prev) => !prev)}>
                    {hideLightSource ? "Src Off" : "Src On"}
                  </button>
                  <button type="button" className="hud-btn" onClick={() => setShowLightMarkers((prev) => !prev)}>
                    {showLightMarkers ? "Markers" : "No Markers"}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="hud-btn"
                onClick={() => {
                  const frame = frameSelectionRef.current;
                  if (frame) frame();
                }}
              >
                Frame
              </button>
            </div>
            ) : null}
          </div>
        </div>

        {!isProfilePresentation && mediaDockVisible && activeScreen && (
          <aside className={`media-dock ${mediaDockCollapsed ? "collapsed" : ""}`} aria-label="Selected screen media dock">
            <div className="media-dock-head">
              <div className="media-dock-title">
                <strong>{`Media Dock · Screen ${activeScreen.label}`}</strong>
                <span>{`${activeScreenSourceLabel} · ${activeScreenCapabilityLabel}`}</span>
              </div>
              <div className="media-dock-tools">
                <span className="media-dock-kind">{activeScreen.mediaKind}</span>
                <span
                  className={`media-dock-sync ${
                    activeScreenSyncMode === "hard-sync"
                      ? "hard"
                      : activeScreenSyncMode === "state-sync"
                        ? "state"
                        : "single"
                  }`}
                >
                  {activeScreenSyncLabel}
                </span>
                <span className="media-dock-sync">{`Auth: ${playbackAuthority.toUpperCase()}`}</span>
                {(activeScreen.mediaKind === "video" || activeScreen.mediaKind === "gif" || activeScreen.mediaKind === "provider") ? (
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={toggleActiveScreenMediaPlayback}
                    aria-label={activeScreen.mediaPlaying ? "Pause media" : "Play media"}
                  >
                    {activeScreen.mediaPlaying ? "Pause" : "Play"}
                  </button>
                ) : null}
                {activeScreenCanControlAudio ? (
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={toggleActiveScreenMediaMute}
                    aria-label={activeScreen.mediaMuted ? "Unmute media" : "Mute media"}
                  >
                    {activeScreen.mediaMuted ? "Unmute" : "Mute"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => setMediaDockMode((prev) => (prev === "player" ? "inspector" : "player"))}
                  aria-label={mediaDockMode === "player" ? "Switch dock to inspector mode" : "Switch dock to player mode"}
                >
                  {mediaDockMode === "player" ? "Inspector" : "Player"}
                </button>
                {activeScreenUsesRemoteMedia && activeScreen.mediaUrl ? (
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => {
                      const source = fromRuntimeMediaUrl(activeScreen.mediaOriginalUrl ?? activeScreen.mediaUrl);
                      if (!source) return;
                      window.open(source, "_blank", "noopener,noreferrer");
                    }}
                    aria-label="Open source media in new tab"
                  >
                    Open
                  </button>
                ) : null}
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => setMediaDockCollapsed((prev) => !prev)}
                  aria-label={mediaDockCollapsed ? "Expand media dock" : "Collapse media dock"}
                >
                  {mediaDockCollapsed ? "Open" : "Fold"}
                </button>
              </div>
            </div>

            <div className="media-dock-body" aria-hidden={mediaDockCollapsed}>
              <div className="media-dock-info">
                <div className="media-dock-info-row">
                  <span>Pipeline</span>
                  <strong>{activeScreenPipelineLabel}</strong>
                </div>
                <div className="media-dock-info-row">
                  <span>Source Mode</span>
                  <strong>{activeScreenSourceMode.toUpperCase()}</strong>
                </div>
                <div className="media-dock-info-row">
                  <span>Provider Primary</span>
                  <strong>{providerScreenPrimary ? "SCREEN" : "DOCK"}</strong>
                </div>
                <div className="media-dock-info-row">
                  <span>Server Media</span>
                  <strong>{serverMediaEnabled ? "ON" : serverMediaProbeDone ? "OFF" : "CHECKING"}</strong>
                </div>
                <div className="media-dock-info-row">
                  <span>Resolution</span>
                  <strong>{activeScreenMediaResolution.toUpperCase()}</strong>
                </div>
                <div className="media-dock-info-row">
                  <span>Audio Track</span>
                  <strong>{activeScreenAudioTrackLabel.toUpperCase()}</strong>
                </div>
                <div className="media-dock-info-row">
                  <span>Policy Mute</span>
                  <strong>{activeScreenPolicyMuted ? "ON" : "OFF"}</strong>
                </div>
              </div>

              {mediaDockMode === "player" ? (
                <>
                  <div className="media-dock-media">
                    {showDockProviderPlayer ? (
                      <iframe
                        ref={mediaDockProviderFrameRef}
                        src={activeScreenDockProviderUrl ?? undefined}
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        title={`Provider player for screen ${activeScreen.label}`}
                        onLoad={handleDockProviderLoad}
                      />
                    ) : showDockVideoPlayer ? (
                      <video
                        ref={mediaDockVideoRef}
                        controls
                        playsInline
                        onPlay={() => {
                          if (Date.now() < mediaDockVideoEventLockUntilRef.current) return;
                          setPlaybackAuthority("dock");
                          playbackAuthorityRef.current = "dock";
                          updateScreenCard(activeScreen.id, { mediaPlaying: true });
                        }}
                        onPause={() => {
                          if (Date.now() < mediaDockVideoEventLockUntilRef.current) return;
                          setPlaybackAuthority("dock");
                          playbackAuthorityRef.current = "dock";
                          updateScreenCard(activeScreen.id, { mediaPlaying: false });
                        }}
                        onSeeking={(event) => {
                          if (Date.now() < mediaDockVideoEventLockUntilRef.current) return;
                          playbackAuthorityRef.current = "dock";
                          screenMediaTimeRef.current.set(activeScreen.id, event.currentTarget.currentTime);
                        }}
                        onTimeUpdate={(event) => {
                          screenMediaTimeRef.current.set(activeScreen.id, event.currentTarget.currentTime);
                        }}
                        onVolumeChange={(event) => {
                          if (Date.now() < mediaDockVideoEventLockUntilRef.current) return;
                          setPlaybackAuthority("dock");
                          playbackAuthorityRef.current = "dock";
                          const nextMuted = event.currentTarget.muted || event.currentTarget.volume <= 0.01;
                          if (nextMuted !== activeScreen.mediaMuted) {
                            updateScreenCard(activeScreen.id, { mediaMuted: nextMuted });
                          }
                        }}
                        onLoadedMetadata={(event) => {
                          const { videoWidth, videoHeight } = event.currentTarget;
                          if (videoWidth > 0 && videoHeight > 0) {
                            setScreenMediaResolution(activeScreen.id, videoWidth, videoHeight);
                          }
                        }}
                      />
                    ) : activeScreenDockImageUrl ? (
                      <img src={activeScreenDockImageUrl} alt={`Screen ${activeScreen.label} media`} />
                    ) : providerSingleSourceActive ? (
                      <div className="media-dock-empty">Provider playback is owned by screen surface.</div>
                    ) : (
                      <div className="media-dock-empty">No visual media on this screen.</div>
                    )}
                  </div>

                </>
              ) : (
                <p className="control-help">Inspector mode keeps playback on-screen and keeps the scene lightweight.</p>
              )}

              <div className="media-dock-controls">
                <p className="section-label">Screen Media</p>
                <input
                  className="file-input"
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleScreenMediaUpload}
                  aria-label="Upload screen media"
                />
                <label className="control-line">
                  <span>Media URL</span>
                  <input
                    className="control-select"
                    type="url"
                    value={screenMediaUrlInput}
                    onChange={(e) => setScreenMediaUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void applyActiveScreenMediaUrl();
                      }
                    }}
                    placeholder="https://.../asset.mp4"
                    aria-label="Screen media URL"
                  />
                  <span>{activeScreen.mediaKind.toUpperCase()}</span>
                </label>
                <div className="control-actions">
                  <button type="button" className="action-btn" onClick={() => void applyActiveScreenMediaUrl()}>
                    Apply URL
                  </button>
                  <button type="button" className="action-btn" onClick={() => void promptApplyActiveScreenMediaUrl()}>
                    Paste Link
                  </button>
                  <button type="button" className="action-btn" onClick={fitActiveScreenToMediaAspect} disabled={!activeScreen.mediaUrl}>
                    Fit
                  </button>
                  <button type="button" className="action-btn wide" onClick={clearActiveScreenMedia} disabled={!activeScreen.mediaUrl}>
                    Clear Media
                  </button>
                </div>
                {mediaDockMode !== "player" ? (
                  <div className="control-actions">
                    <button
                      type="button"
                      className="action-btn"
                      onClick={toggleActiveScreenMediaPlayback}
                      disabled={activeScreen.mediaKind === "none" || activeScreen.mediaKind === "image"}
                    >
                      {activeScreen.mediaPlaying ? "Pause Media" : "Play Media"}
                    </button>
                    {activeScreenCanControlAudio ? (
                      <button
                        type="button"
                        className="action-btn"
                        onClick={toggleActiveScreenMediaMute}
                      >
                        {activeScreen.mediaMuted ? "Unmute Media" : "Mute Media"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <label className="control-line">
                  <span>Source Mode</span>
                  <select
                    className="control-select"
                    value={resolveScreenSourceMode(activeScreen)}
                    onChange={(e) => {
                      const value = e.target.value;
                      const sourceMode: ScreenSourceMode = value === "integrated" || value === "provider" ? value : "auto";
                      updateScreenCard(activeScreen.id, { sourceMode });
                    }}
                  >
                    <option value="auto">Auto</option>
                    <option value="integrated" disabled={!serverMediaEnabled}>
                      {serverMediaEnabled ? "Integrated" : "Integrated (Unavailable)"}
                    </option>
                    <option value="provider">Native Provider</option>
                  </select>
                  <span>{resolveScreenSourceMode(activeScreen).toUpperCase()}</span>
                </label>
                <label className="switch-line">
                  <span>{`Auto Fit (${autoFitMediaAspect ? "ON" : "OFF"})`}</span>
                  <input type="checkbox" checked={autoFitMediaAspect} onChange={(e) => setAutoFitMediaAspect(e.target.checked)} />
                </label>
                <label className="control-line">
                  <span>Media Fidelity</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(mediaFidelity * 100)}
                    onChange={(event) => setMediaFidelity(THREE.MathUtils.clamp(Number(event.target.value) / 100, 0, 1))}
                  />
                  <span>{`${Math.round(mediaFidelity * 100)}%`}</span>
                </label>
                <p className="control-help">Raise this to reduce scene grading and keep source media colors closer to original.</p>
                <label className="switch-line">
                  <span>{serverMediaEnabled ? "3D Integrate Provider" : "3D Integrate Provider (Unavailable)"}</span>
                  <input
                    type="checkbox"
                    checked={preferIntegratedProvider}
                    disabled={!serverMediaEnabled}
                    onChange={(e) => setPreferIntegratedProvider(e.target.checked)}
                  />
                </label>
                {!serverMediaEnabled ? (
                  <p className="control-help">
                    Safe deploy mode is active: provider stream resolver/proxy is disabled on this host. Native provider playback still works.
                  </p>
                ) : null}
                {activeScreenCanControlAudio ? (
                  <label className="control-line">
                    <span>Audio Policy</span>
                    <select
                      className="control-select"
                      value={normalizeAudioPolicy(activeScreen.audioPolicy)}
                      onChange={(e) =>
                        updateScreenCard(activeScreen.id, {
                          audioPolicy: normalizeAudioPolicy(e.target.value),
                        })
                      }
                    >
                      <option value="normal">Normal</option>
                      <option value="solo">Solo</option>
                      <option value="background">Background</option>
                      <option value="duck">Duck</option>
                    </select>
                    <span>{normalizeAudioPolicy(activeScreen.audioPolicy).toUpperCase()}</span>
                  </label>
                ) : (
                  <p className="control-help">No audio track detected for current media.</p>
                )}
                {activeScreenPolicyMuted ? (
                  <p className="control-help">Audio is currently muted by Solo policy from another screen.</p>
                ) : null}
              </div>

              {activeScreenStatus ? <p className="control-help">{activeScreenStatus}</p> : null}
            </div>
          </aside>
        )}

        {!isProfilePresentation ? (
        <button
          type="button"
          className="scene-panel-toggle"
          onClick={() => setPanelClosed((prev) => !prev)}
          aria-label={panelClosed ? "Show controls panel" : "Hide controls panel"}
        >
          {panelClosed ? "Show Controls" : "Hide Controls"}
        </button>
        ) : null}

        {!isProfilePresentation ? (
        <aside className="quick-corner" aria-label="Quick scene controls">
          <p className="section-label">{`Quick · ${selectionLabel}`}</p>
          <div className="preset-row">
            <button
              type="button"
              className="preset-btn"
              onClick={() => cycleSelectionRef.current?.(-1)}
              aria-label="Select previous entity"
            >
              Prev
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={() => cycleSelectionRef.current?.(1)}
              aria-label="Select next entity"
            >
              Next
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={() => frameSelectionRef.current?.()}
              aria-label="Frame selected entity"
            >
              Frame
            </button>
          </div>
          <div className="preset-row">
            <button
              type="button"
              className="preset-btn"
              onClick={() => {
                if (selectionLocked) return;
                setSceneSelection("none");
              }}
              disabled={selectionLocked || sceneSelection === "none"}
            >
              Clear
            </button>
            <button
              type="button"
              className={`preset-btn ${advancedPanelVisible ? "active" : ""}`}
              onClick={() => setAdvancedPanelVisible((prev) => !prev)}
            >
              {advancedPanelVisible ? "Advanced" : "Compact"}
            </button>
            <button
              type="button"
              className={`preset-btn ${autoEntityTab ? "active" : ""}`}
              onClick={() => setAutoEntityTab((prev) => !prev)}
            >
              {autoEntityTab ? "Auto Tab" : "Manual Tab"}
            </button>
          </div>
        </aside>
        ) : null}

        {!isProfilePresentation ? (
        <aside
          ref={panelRef}
          className={`scene-controls ${panelClosed ? "closed" : "open"} ${panelMinimized ? "minimized" : ""} ${advancedPanelVisible ? "advanced-on" : "advanced-off"}`}
          style={{ left: `${panelPosition.x}px`, top: `${panelPosition.y}px` }}
          aria-label="Scene controls"
        >
          <div className="controls-head">
            <button
              type="button"
              className="panel-drag-handle"
              onPointerDown={handlePanelDragStart}
              aria-label="Drag controls panel"
              title="Drag panel"
            >
              Drag
            </button>
            <h2>Scene Controls</h2>
            <span className="selection-pill">{`Sel: ${selectionLabel}`}</span>
            <div className="head-actions">
              <button
                type="button"
                className="mini-btn"
                onClick={undoSettings}
                disabled={undoStack.length === 0}
                aria-label="Undo latest scene change"
              >
                Undo
              </button>
              <button
                type="button"
                className="mini-btn"
                onClick={redoSettings}
                disabled={redoStack.length === 0}
                aria-label="Redo scene change"
              >
                Redo
              </button>
              <button
                type="button"
                className="mini-btn"
                onClick={() => setPanelMinimized((prev) => !prev)}
                aria-label={panelMinimized ? "Maximize controls panel" : "Minimize controls panel"}
              >
                {panelMinimized ? "Max" : "Min"}
              </button>
            </div>
          </div>

          <div className="controls-scroll">
            <div className="panel-section" {...withHint("Minimal workflow: choose mode, then choose one main tab.")}>
              <p className="section-label">Workflow</p>
              <label className="switch-line">
                <span>{`Selection Lock (${selectionLocked ? "ON" : "OFF"})`}</span>
                <input
                  type="checkbox"
                  checked={selectionLocked}
                  onChange={(e) => setSelectionLocked(e.target.checked)}
                />
              </label>
              <label className="switch-line">
                <span>{`Context Focus (${contextFocus ? "ON" : "OFF"})`}</span>
                <input
                  type="checkbox"
                  checked={contextFocus}
                  onChange={(e) => setContextFocus(e.target.checked)}
                />
              </label>
              <label className="switch-line">
                <span>{`Advanced Panel (${advancedPanelVisible ? "ON" : "OFF"})`}</span>
                <input
                  type="checkbox"
                  checked={advancedPanelVisible}
                  onChange={(e) => setAdvancedPanelVisible(e.target.checked)}
                />
              </label>
              <label className="switch-line">
                <span>{`Auto Entity Tab (${autoEntityTab ? "ON" : "OFF"})`}</span>
                <input
                  type="checkbox"
                  checked={autoEntityTab}
                  onChange={(e) => setAutoEntityTab(e.target.checked)}
                />
              </label>
              <label className="switch-line">
                <span>{`Inspector Lock (${inspectorLock ? "ON" : "OFF"})`}</span>
                <input
                  type="checkbox"
                  checked={inspectorLock}
                  onChange={(e) => setInspectorLock(e.target.checked)}
                />
              </label>
              <div className="control-actions">
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => frameSelectionRef.current?.()}
                  disabled={sceneSelection === "none"}
                >
                  Frame Selection
                </button>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => {
                    if (selectionLocked) return;
                    setSceneSelection("none");
                  }}
                  disabled={sceneSelection === "none" || selectionLocked}
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  className="action-btn wide"
                  onClick={() => setPanelClosed(true)}
                >
                  Hide Panel
                </button>
              </div>
              <p className="control-help">Click empty scene space or press ESC to deselect.</p>
              <div className="preset-row">
                <button
                  type="button"
                  className={`preset-btn ${sceneSelection === "none" ? "active" : ""}`}
                  onClick={() => {
                    if (selectionLocked) return;
                    setSceneSelection("none");
                  }}
                >
                  None
                </button>
                <button
                  type="button"
                  className={`preset-btn ${sceneSelection === "screen" ? "active" : ""}`}
                  onClick={() => {
                    const nextId = activeScreenId || screens[0]?.id || "";
                    setActiveScreenId(nextId);
                    setSceneSelection(nextId ? "screen" : "none");
                  }}
                >
                  Screen
                </button>
                <button
                  type="button"
                  className={`preset-btn ${sceneSelection === "model" ? "active" : ""}`}
                  onClick={() => {
                    setSceneSelection("model");
                  }}
                >
                  Model
                </button>
              </div>
              <div className="preset-row">
                <button
                  type="button"
                  className={`preset-btn ${sceneSelection === "light-key" ? "active" : ""}`}
                  onClick={() => {
                    setActiveOrbitalLight("key");
                    setSceneSelection("light-key");
                  }}
                >
                  Key
                </button>
                <button
                  type="button"
                  className={`preset-btn ${sceneSelection === "light-fill" ? "active" : ""}`}
                  onClick={() => {
                    setActiveOrbitalLight("fill");
                    setSceneSelection("light-fill");
                  }}
                >
                  Fill
                </button>
                <button
                  type="button"
                  className={`preset-btn ${sceneSelection === "light-target" ? "active" : ""}`}
                  onClick={() => {
                    setSceneSelection("light-target");
                  }}
                >
                  Target
                </button>
              </div>
              <div className="mode-row">
                {(["basic", "pro"] as UiMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`preset-btn ${uiMode === mode ? "active" : ""}`}
                    onClick={() => setUiMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="intent-row">
                {PANEL_TAB_CONFIG.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`preset-btn intent-btn ${panelTab === tab.key ? "active" : ""}`}
                    onClick={() => setPanelTab(tab.key)}
                    aria-label={`Open ${tab.label} controls`}
                  >
                    <CategoryIconGlyph kind={tab.icon} className="tab-icon" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
              <div className="preset-row">
                <button
                  type="button"
                  className={`preset-btn ${qualityMode === "draft" ? "active" : ""}`}
                  onClick={() => setQualityMode("draft")}
                >
                  Draft
                </button>
                <button
                  type="button"
                  className={`preset-btn ${qualityMode === "final" ? "active" : ""}`}
                  onClick={() => setQualityMode("final")}
                >
                  Final
                </button>
                <span></span>
              </div>
              {activeComparePreview && <p className="control-help">Previewing slot {activeComparePreview.toUpperCase()} (release key to restore)</p>}
            </div>

            {isSectionVisible("scene") && (
              <div className="panel-section" {...withHint("Global scene look presets and visual direction.")}>
                <div className="section-head">
                  <p className="section-label">Scene Look</p>
                  <button type="button" className="mini-btn" onClick={resetLookModule}>
                    Reset
                  </button>
                </div>
                <div className="preset-row">
                  {(["studio", "noir", "neon"] as PresetKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`preset-btn ${preset === key ? "active" : ""}`}
                      onClick={() => applyPreset(key)}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <p className="section-label">Environment Mode</p>
                <div className="preset-row">
                  {(["core", "light", "dusk"] as EnvironmentModeKey[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`preset-btn ${environmentMode === mode ? "active" : ""}`}
                      onClick={() => setEnvironmentMode(mode)}
                    >
                      {ENVIRONMENT_MODE_CONFIG[mode].label}
                    </button>
                  ))}
                </div>
                <div className="preset-row">
                  {(["glacier", "mono", "bureau"] as EnvironmentModeKey[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`preset-btn ${environmentMode === mode ? "active" : ""}`}
                      onClick={() => setEnvironmentMode(mode)}
                    >
                      {ENVIRONMENT_MODE_CONFIG[mode].label}
                    </button>
                  ))}
                  <span></span>
                </div>
                <p className="control-help">{activeEnvironmentConfig.hint}</p>
                <p className="section-label">Environment Linking</p>
                <label className="switch-line">
                  <span>Auto HDRI Link</span>
                  <input type="checkbox" checked={environmentAutoHdri} onChange={(e) => setEnvironmentAutoHdri(e.target.checked)} />
                </label>
                <label className="control-line">
                  <span>Env Impact</span>
                  <input type="range" min={0} max={1} step={0.01} value={environmentObjectImpact} onChange={(e) => setEnvironmentObjectImpact(Number(e.target.value))} />
                  <span>{environmentObjectImpact.toFixed(2)}</span>
                </label>
                <p className="section-label">Ground Surface</p>
                <div className="preset-row">
                  {(["topo", "pulse", "none"] as FloorMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`preset-btn ${floorMode === mode ? "active" : ""}`}
                      onClick={() => setFloorMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="preset-row">
                  <button type="button" className="preset-btn" onClick={() => setGroundGloss(0.08)}>
                    Matte
                  </button>
                  <button type="button" className="preset-btn" onClick={() => setGroundGloss(0.38)}>
                    Satin
                  </button>
                  <button type="button" className="preset-btn" onClick={() => setGroundGloss(0.86)}>
                    Gloss
                  </button>
                </div>
                <label className="switch-line">
                  <span>Ground Motion</span>
                  <input type="checkbox" checked={groundMotion} onChange={(e) => setGroundMotion(e.target.checked)} />
                </label>
                <label className="switch-line">
                  <span>Ring Pulse</span>
                  <input type="checkbox" checked={ringPulse} onChange={(e) => setRingPulse(e.target.checked)} />
                </label>
                <label className="control-line">
                  <span>Ground Gloss</span>
                  <input type="range" min={0} max={1} step={0.01} value={groundGloss} onChange={(e) => setGroundGloss(Number(e.target.value))} />
                  <span>{groundGloss.toFixed(2)}</span>
                </label>
                {uiMode !== "basic" && (
                  <label className="control-line">
                    <span>Pulse Amt</span>
                    <input type="range" min={0} max={2} step={0.01} value={ringImpact} onChange={(e) => setRingImpact(Number(e.target.value))} />
                    <span>{ringImpact.toFixed(2)}</span>
                  </label>
                )}
                <p className="section-label">Auto Relight</p>
                <div className="preset-row">
                  <button type="button" className="preset-btn" onClick={() => applyAutoRelight("cinematic")}>Cine</button>
                  <button type="button" className="preset-btn" onClick={() => applyAutoRelight("rim")}>Rim</button>
                  <button type="button" className="preset-btn" onClick={() => applyAutoRelight("studio-soft")}>Soft</button>
                </div>
                <div className="preset-row">
                  <button type="button" className="preset-btn" onClick={() => applyAutoRelight("neon-edge")}>Neon Edge</button>
                  <span></span>
                  <span></span>
                </div>
                <label className="control-line">
                  <span>Title</span>
                  <textarea
                    className="control-textarea"
                    value={heroTitleText}
                    onChange={(e) => setHeroTitleText(e.target.value.slice(0, 1400))}
                    aria-label="Hero title text"
                  />
                  <span>{heroTitleText.length}</span>
                </label>
                <div className="section-head" style={{ marginTop: "0.28rem" }}>
                  <p className="section-label">HDRI Environment</p>
                  <button type="button" className="mini-btn" onClick={resetEnvironmentModule}>
                    Reset
                  </button>
                </div>
                <div className="preset-row">
                  <button
                    type="button"
                    className={`preset-btn ${hdriPreset === "off" ? "active" : ""}`}
                    onClick={() => selectHdriPreset("off")}
                  >
                    Off
                  </button>
                  <button
                    type="button"
                    className={`preset-btn ${hdriPreset === "studio" ? "active" : ""}`}
                    onClick={() => selectHdriPreset("studio")}
                  >
                    Studio
                  </button>
                  <button
                    type="button"
                    className={`preset-btn ${hdriPreset === "sunset" ? "active" : ""}`}
                    onClick={() => selectHdriPreset("sunset")}
                  >
                    Sunset
                  </button>
                </div>
                <div className="preset-row">
                  <button
                    type="button"
                    className={`preset-btn ${hdriPreset === "city" ? "active" : ""}`}
                    onClick={() => selectHdriPreset("city")}
                  >
                    City
                  </button>
                  <button
                    type="button"
                    className={`preset-btn ${hdriPreset === "custom" ? "active" : ""}`}
                    onClick={() => selectHdriPreset("custom")}
                  >
                    Custom
                  </button>
                  <span></span>
                </div>
                <input
                  className="file-input"
                  type="file"
                  accept=".hdr,.jpg,.jpeg,.png,.webp,image/*"
                  onChange={handleHdriUpload}
                  aria-label="Upload HDRI or panorama environment"
                />
                <p className="file-name">Environment: {hdriName}</p>
                <label className="control-line">
                  <span>Intensity</span>
                  <input type="range" min={0} max={4} step={0.01} value={hdriIntensity} onChange={(e) => setHdriIntensity(Number(e.target.value))} />
                  <span>{hdriIntensity.toFixed(2)}</span>
                </label>
                <label className="control-line">
                  <span>Rotation</span>
                  <input type="range" min={-180} max={180} step={0.1} value={hdriRotation} onChange={(e) => setHdriRotation(Number(e.target.value))} />
                  <span>{hdriRotation.toFixed(1)}°</span>
                </label>
                <label className="control-line">
                  <span>Exposure</span>
                  <input type="range" min={-1.5} max={1.5} step={0.01} value={hdriExposure} onChange={(e) => setHdriExposure(Number(e.target.value))} />
                  <span>{hdriExposure.toFixed(2)}</span>
                </label>
                <label className="control-line">
                  <span>BG Blur</span>
                  <input type="range" min={0} max={1} step={0.01} value={hdriBlur} onChange={(e) => setHdriBlur(Number(e.target.value))} />
                  <span>{hdriBlur.toFixed(2)}</span>
                </label>
                <label className="switch-line">
                  <span>Show HDRI BG</span>
                  <input type="checkbox" checked={hdriBackground} onChange={(e) => setHdriBackground(e.target.checked)} />
                </label>
              </div>
            )}

            {isSectionVisible("presets") && (
              <div className="panel-section" {...withHint("Save, update, and recall complete scene snapshots.")}>
                <p className="section-label">Saved Presets</p>
                <label className="control-line">
                  <span>Bank</span>
                  <select
                    className="control-select"
                    value={selectedPresetId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedPresetId(nextId);
                      const selected = savedPresets.find((item) => item.id === nextId);
                      setPresetNameInput(selected?.name ?? "");
                    }}
                    aria-label="Saved scene presets"
                  >
                    <option value="">Select preset</option>
                    {savedPresets.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <span>{savedPresets.length}</span>
                </label>
                <label className="control-line">
                  <span>Name</span>
                  <input
                    className="control-select"
                    type="text"
                    value={presetNameInput}
                    onChange={(e) => setPresetNameInput(e.target.value)}
                    placeholder="Preset name"
                    aria-label="Preset name"
                  />
                  <span></span>
                </label>
                <div className="control-actions">
                  <button type="button" className="action-btn" onClick={saveCurrentPreset}>Save</button>
                  <button type="button" className="action-btn" onClick={applySelectedPreset} disabled={!selectedPresetId}>Apply</button>
                  <button type="button" className="action-btn" onClick={updateSelectedPreset} disabled={!selectedPresetId}>Update</button>
                  <button type="button" className="action-btn" onClick={renameSelectedPreset} disabled={!selectedPresetId || !presetNameInput.trim()}>Rename</button>
                  <button type="button" className="action-btn wide" onClick={deleteSelectedPreset} disabled={!selectedPresetId}>Delete</button>
                </div>
              </div>
            )}

            {isSectionVisible("camera") && (
              <div className="panel-section" {...withHint("Shot presets can load dedicated light rigs when linked mode is enabled.")}>
                <div className="section-head">
                  <p className="section-label">Camera Shot</p>
                  <button type="button" className="mini-btn" onClick={resetCameraModule}>
                    Reset
                  </button>
                </div>
                <div className="preset-row">
                  {(["hero", "mid", "wide"] as CameraShotKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`preset-btn ${shot === key ? "active" : ""}`}
                      onClick={() => switchShot(key)}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <label className="switch-line">
                  <span>Shot Linked Rigs</span>
                  <input type="checkbox" checked={shotLinkedRigs} onChange={(e) => setShotLinkedRigs(e.target.checked)} />
                </label>
                <label className="control-line">
                  <span>FOV Offset</span>
                  <input type="range" min={-12} max={12} step={0.1} value={cameraFovOffset} onChange={(e) => setCameraFovOffset(Number(e.target.value))} />
                  <span>{cameraFovOffset.toFixed(1)}°</span>
                </label>
                <label className="control-line">
                  <span>Damping</span>
                  <input type="range" min={0.01} max={0.2} step={0.001} value={cameraDamping} onChange={(e) => setCameraDamping(Number(e.target.value))} />
                  <span>{cameraDamping.toFixed(3)}</span>
                </label>
                <label className="control-line">
                  <span>Orbit Spd</span>
                  <input type="range" min={0.1} max={2.2} step={0.01} value={cameraOrbitSpeed} onChange={(e) => setCameraOrbitSpeed(Number(e.target.value))} />
                  <span>{cameraOrbitSpeed.toFixed(2)}</span>
                </label>
                {uiMode === "pro" && (
                  <>
                    <label className="control-line">
                      <span>Near</span>
                      <input type="range" min={0.02} max={2} step={0.01} value={cameraNear} onChange={(e) => setCameraNear(Number(e.target.value))} />
                      <span>{cameraNear.toFixed(2)}</span>
                    </label>
                    <label className="control-line">
                      <span>Far</span>
                      <input type="range" min={20} max={220} step={1} value={cameraFar} onChange={(e) => setCameraFar(Number(e.target.value))} />
                      <span>{cameraFar.toFixed(0)}</span>
                    </label>
                  </>
                )}
                {uiMode === "pro" && (
                  <>
                    <p className="control-help">Hold keys 1 / 2 / 3 for instant A/B/C preview.</p>
                    <div className="slot-row">
                      {(["a", "b", "c"] as CompareSlotKey[]).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          className={`slot-chip ${activeComparePreview === slot ? "active" : ""}`}
                          onClick={() => (compareSlots[slot] ? applyCompareSlot(slot) : saveCompareSlot(slot))}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            saveCompareSlot(slot);
                          }}
                          title={compareSlots[slot] ? "Click apply, right click save" : "Click save"}
                        >
                          {slot.toUpperCase()} {compareSlots[slot] ? "APPLY" : "SAVE"}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {isSectionVisible("orbit") && (
              <div className="panel-section" {...withHint("Use the orbit sphere to place key/fill lights in full 3D around the subject.")}>
                <div className="section-head">
                  <p className="section-label">Light Orbit</p>
                  <button type="button" className="mini-btn" onClick={resetOrbitModule}>
                    Reset
                  </button>
                </div>
                <div className="orbital-card">
                  <div className="orbital-top">
                    <button
                      type="button"
                      className={`preset-btn ${lightAnchorMode === "follow" ? "active" : ""}`}
                      onClick={() => setLightAnchorMode("follow")}
                    >
                      Follow
                    </button>
                    <button
                      type="button"
                      className={`preset-btn ${lightAnchorMode === "world" ? "active" : ""}`}
                      onClick={() => setLightAnchorMode("world")}
                    >
                      World
                    </button>
                  </div>
                  {lightAnchorMode === "follow" && (
                    <div className="orbital-top">
                      <button
                        type="button"
                        className={`preset-btn ${lightFollowPoint === "rig" ? "active" : ""}`}
                        onClick={() => setLightFollowPoint("rig")}
                      >
                        Rig Center
                      </button>
                      <button
                        type="button"
                        className={`preset-btn ${lightFollowPoint === "hips" ? "active" : ""}`}
                        onClick={() => setLightFollowPoint("hips")}
                      >
                        Hips
                      </button>
                    </div>
                  )}
                  <div className="orbital-top">
                    <button
                      type="button"
                      className={`preset-btn ${activeOrbitalLight === "key" ? "active" : ""}`}
                      onClick={() => setActiveOrbitalLight("key")}
                    >
                      Key
                    </button>
                    <button
                      type="button"
                      className={`preset-btn ${activeOrbitalLight === "fill" ? "active" : ""}`}
                      onClick={() => setActiveOrbitalLight("fill")}
                    >
                      Fill
                    </button>
                  </div>
                  {lightAnchorMode === "world" && (
                    <>
                      <label className="control-line">
                        <span>Anchor X</span>
                        <input type="range" min={-4} max={4} step={0.01} value={worldAnchorX} onChange={(e) => setWorldAnchorX(Number(e.target.value))} />
                        <span>{worldAnchorX.toFixed(2)}</span>
                      </label>
                      <label className="control-line">
                        <span>Anchor Y</span>
                        <input type="range" min={-2} max={4} step={0.01} value={worldAnchorY} onChange={(e) => setWorldAnchorY(Number(e.target.value))} />
                        <span>{worldAnchorY.toFixed(2)}</span>
                      </label>
                      <label className="control-line">
                        <span>Anchor Z</span>
                        <input type="range" min={-4} max={4} step={0.01} value={worldAnchorZ} onChange={(e) => setWorldAnchorZ(Number(e.target.value))} />
                        <span>{worldAnchorZ.toFixed(2)}</span>
                      </label>
                    </>
                  )}
                  <div
                    className="orb-sphere"
                    onPointerDown={handleOrbitalPointerDown}
                    onPointerMove={handleOrbitalPointerMove}
                    onPointerUp={handleOrbitalPointerUp}
                    onPointerCancel={handleOrbitalPointerUp}
                    onWheel={handleOrbitalWheel}
                    aria-label="Light orbit sphere"
                    title="Drag to orbit light. Mouse wheel changes distance. Shift + wheel changes power."
                    role="application"
                  >
                    <span className="orb-cross-x"></span>
                    <span className="orb-cross-y"></span>
                    <span
                      className={`orb-dot ${orbitalMarker.back ? "back" : ""}`}
                      style={{ left: `${orbitalMarker.left}%`, top: `${orbitalMarker.top}%` }}
                    ></span>
                  </div>
                  <label className="control-line">
                    <span>Dist</span>
                    <input
                      type="range"
                      min={0.6}
                      max={12}
                      step={0.01}
                      value={activeOrbitalDistance}
                      onChange={(e) => setActiveOrbitalDistance(Number(e.target.value))}
                    />
                    <span>{activeOrbitalDistance.toFixed(2)}</span>
                  </label>
                  <label className="control-line">
                    <span>Light Y</span>
                    <input
                      type="range"
                      min={-4}
                      max={4}
                      step={0.01}
                      value={activeOrbitalLift}
                      onChange={(e) => setActiveOrbitalLift(Number(e.target.value))}
                    />
                    <span>{activeOrbitalLift.toFixed(2)}</span>
                  </label>
                  <label className="control-line">
                    <span>Pivot Y</span>
                    <input
                      type="range"
                      min={-1.5}
                      max={2.2}
                      step={0.01}
                      value={orbitCenterLift}
                      onChange={(e) => setOrbitCenterLift(Number(e.target.value))}
                    />
                    <span>{orbitCenterLift.toFixed(2)}</span>
                  </label>
                  <label className="control-line">
                    <span>Power</span>
                    <input
                      type="range"
                      min={0.4}
                      max={LIGHT_GAIN_MAX}
                      step={0.01}
                      value={lightGain}
                      onChange={(e) => setLightGain(Number(e.target.value))}
                    />
                    <span>{lightGain.toFixed(2)}x</span>
                  </label>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => {
                      setLightAnchorMode("follow");
                      setOrbitCenterLift(0.56);
                    }}
                  >
                    Center On Model
                  </button>
                  <label className="switch-line">
                    <span>Show Gizmos</span>
                    <input type="checkbox" checked={showLightMarkers} onChange={(e) => setShowLightMarkers(e.target.checked)} />
                  </label>
                  <label className="switch-line">
                    <span>Lock Above</span>
                    <input type="checkbox" checked={lockLightsAboveGround} onChange={(e) => setLockLightsAboveGround(e.target.checked)} />
                  </label>
                  <label className="switch-line">
                    <span>Snap Gizmos</span>
                    <input type="checkbox" checked={gizmoSnapEnabled} onChange={(e) => setGizmoSnapEnabled(e.target.checked)} />
                  </label>
                  <label className="control-line">
                    <span>Snap Grid</span>
                    <input
                      type="range"
                      min={0.01}
                      max={0.5}
                      step={0.01}
                      value={gizmoSnapGrid}
                      onChange={(e) => setGizmoSnapGrid(Number(e.target.value))}
                    />
                    <span>{gizmoSnapGrid.toFixed(2)}</span>
                  </label>
                  <label className="control-line">
                    <span>Snap Angle</span>
                    <input
                      type="range"
                      min={1}
                      max={30}
                      step={1}
                      value={gizmoSnapAngle}
                      onChange={(e) => setGizmoSnapAngle(Number(e.target.value))}
                    />
                    <span>{gizmoSnapAngle.toFixed(0)}°</span>
                  </label>
                  <div className="coord-readout">
                    <div>Azimuth: {activeOrbitalAzimuth.toFixed(1)}°</div>
                    <div>Elevation: {activeOrbitalElevation.toFixed(1)}°</div>
                    <div>Center Y Lift: {orbitCenterLift.toFixed(2)}</div>
                    <div>Wheel = Dist, Shift+Wheel = Power Boost</div>
                    <div>Cmd/Ctrl while dragging toggles snap mode</div>
                  </div>
                </div>
              </div>
            )}

            {isSectionVisible("model") && (
              <div className="panel-section" {...withHint("Object lab: upload a model, stage it, tune materials, and inspect mesh/animation stats.")}>
                <div className="section-head">
                  <p className="section-label">3D Object</p>
                  <button type="button" className="mini-btn" onClick={resetModelModule}>
                    Reset
                  </button>
                </div>
                {showModelContextControls ? (
                  <>
                <input
                  className="file-input"
                  type="file"
                  accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                  onChange={handleModelUpload}
                  aria-label="Upload 3D model"
                />
                <div className="model-actions">
                  <p className="file-name">{modelName}</p>
                  <button type="button" className="mini-btn" onClick={resetModelSource}>
                    Default
                  </button>
                </div>
                <div className="preset-row">
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() => {
                      setModelPosX(0);
                      setModelPosY(0);
                      setModelPosZ(0);
                      setModelScale(1);
                    }}
                  >
                    Center
                  </button>
                  <button type="button" className="preset-btn" onClick={() => setModelYaw(0)}>
                    Front
                  </button>
                  <button type="button" className="preset-btn" onClick={() => setModelYaw(180)}>
                    Back
                  </button>
                </div>
                <label className="control-line">
                  <span>Scale</span>
                  <input type="range" min={0.2} max={3.5} step={0.01} value={modelScale} onChange={(e) => setModelScale(Number(e.target.value))} />
                  <span>{modelScale.toFixed(2)}x</span>
                </label>
                <label className="control-line">
                  <span>Yaw</span>
                  <input type="range" min={-180} max={180} step={0.1} value={modelYaw} onChange={(e) => setModelYaw(Number(e.target.value))} />
                  <span>{modelYaw.toFixed(1)}°</span>
                </label>
                <label className="control-line">
                  <span>Pos X</span>
                  <input type="range" min={-3} max={3} step={0.01} value={modelPosX} onChange={(e) => setModelPosX(Number(e.target.value))} />
                  <span>{modelPosX.toFixed(2)}</span>
                </label>
                <label className="control-line">
                  <span>Pos Y</span>
                  <input type="range" min={-1} max={2} step={0.01} value={modelPosY} onChange={(e) => setModelPosY(Number(e.target.value))} />
                  <span>{modelPosY.toFixed(2)}</span>
                </label>
                <label className="control-line">
                  <span>Pos Z</span>
                  <input type="range" min={-3} max={3} step={0.01} value={modelPosZ} onChange={(e) => setModelPosZ(Number(e.target.value))} />
                  <span>{modelPosZ.toFixed(2)}</span>
                </label>
                <label className="switch-line">
                  <span>Float Idle</span>
                  <input type="checkbox" checked={modelFloat} onChange={(e) => setModelFloat(e.target.checked)} />
                </label>
                <p className="section-label">Animation</p>
                <label className="switch-line">
                  <span>Play</span>
                  <input type="checkbox" checked={modelAnimationPlaying} onChange={(e) => setModelAnimationPlaying(e.target.checked)} disabled={modelClipNames.length === 0} />
                </label>
                <label className="control-line">
                  <span>Speed</span>
                  <input type="range" min={0.1} max={2.5} step={0.01} value={modelAnimationSpeed} onChange={(e) => setModelAnimationSpeed(Number(e.target.value))} disabled={modelClipNames.length === 0} />
                  <span>{modelAnimationSpeed.toFixed(2)}x</span>
                </label>
                <label className="control-line">
                  <span>Clip</span>
                  <select
                    className="control-select"
                    value={activeModelClip}
                    onChange={(e) => setActiveModelClip(Number(e.target.value))}
                    disabled={modelClipNames.length === 0}
                  >
                    {modelClipNames.length === 0 ? (
                      <option value={0}>No clips</option>
                    ) : (
                      modelClipNames.map((clip, index) => (
                        <option key={`${clip}-${index}`} value={index}>
                          {clip}
                        </option>
                      ))
                    )}
                  </select>
                  <span>{modelClipNames.length}</span>
                </label>
                <p className="section-label">Material</p>
                <div className="fx-style-grid">
                  {(["original", "clay", "wire", "hologram"] as ModelMaterialMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`preset-btn ${modelMaterialMode === mode ? "active" : ""}`}
                      onClick={() => setModelMaterialMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <label className="control-line">
                  <span>Tint</span>
                  <input type="color" value={modelTint} onChange={(e) => setModelTint(e.target.value)} aria-label="Model tint color" />
                  <span>{modelTint.toUpperCase()}</span>
                </label>
                <label className="control-line">
                  <span>Metal</span>
                  <input type="range" min={0} max={1} step={0.01} value={modelMetalness} onChange={(e) => setModelMetalness(Number(e.target.value))} />
                  <span>{modelMetalness.toFixed(2)}</span>
                </label>
                <label className="control-line">
                  <span>Rough</span>
                  <input type="range" min={0} max={1} step={0.01} value={modelRoughness} onChange={(e) => setModelRoughness(Number(e.target.value))} />
                  <span>{modelRoughness.toFixed(2)}</span>
                </label>
                  </>
                ) : (
                  <p className="control-help">Context Focus is on. Select the model in scene to edit object controls.</p>
                )}
                {showScreenContextControls ? (
                  <>
                <p className="section-label">Floating Screens</p>
                <label className="switch-line">
                  <span>Enable</span>
                  <input type="checkbox" checked={screensEnabled} onChange={(e) => setScreensEnabled(e.target.checked)} />
                </label>
                <label className="control-line">
                  <span>Dock</span>
                  <select
                    className="control-select"
                    value={mediaDockMode}
                    onChange={(e) => setMediaDockMode(e.target.value === "player" ? "player" : "inspector")}
                  >
                    <option value="inspector">Inspector</option>
                    <option value="player">Player</option>
                  </select>
                  <span>{mediaDockMode === "player" ? "Live" : "Lean"}</span>
                </label>
                <label className="switch-line">
                  <span>Provider Primary</span>
                  <input
                    type="checkbox"
                    checked={providerScreenPrimary}
                    onChange={(e) => setProviderScreenPrimary(e.target.checked)}
                  />
                </label>
                <label className="control-line">
                  <span>Attach</span>
                  <select
                    className="control-select"
                    value={screenAttachmentMode}
                    onChange={(e) => {
                      const value = e.target.value;
                      setScreenAttachmentMode(
                        value === "world" || value === "follow-pos" || value === "follow-full" ? value : "follow-pos-yaw"
                      );
                    }}
                  >
                    <option value="world">World</option>
                    <option value="follow-pos">Follow Pos</option>
                    <option value="follow-pos-yaw">Follow Pos+Yaw</option>
                    <option value="follow-full">Follow Full</option>
                  </select>
                  <span>{screenAttachmentMode}</span>
                </label>
                <p className="control-help">On keeps YouTube/Vimeo as one native player on the screen surface.</p>
                <label className="control-line">
                  <span>Screen</span>
                  <select
                    className="control-select"
                    value={activeScreen?.id ?? ""}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setActiveScreenId(nextId);
                      setSceneSelection(nextId ? "screen" : "none");
                    }}
                    disabled={screens.length === 0}
                  >
                    <option value="">None</option>
                    {screens.map((screen) => (
                      <option key={screen.id} value={screen.id}>
                        {screen.label}
                      </option>
                    ))}
                  </select>
                  <span>{screens.length}</span>
                </label>
                <div className="control-actions">
                  <button type="button" className="action-btn" onClick={addScreenCard} disabled={screens.length >= 8}>
                    Add
                  </button>
                  <button type="button" className="action-btn" onClick={duplicateActiveScreen} disabled={!activeScreen || screens.length >= 8}>
                    Copy
                  </button>
                  <button type="button" className="action-btn wide" onClick={removeActiveScreen} disabled={!activeScreen || screens.length <= 1}>
                    Remove
                  </button>
                </div>
                {activeScreen && (
                  <>
                    <label className="switch-line">
                      <span>Visible</span>
                      <input
                        type="checkbox"
                        checked={activeScreen.visible}
                        onChange={(e) => updateScreenCard(activeScreen.id, { visible: e.target.checked })}
                      />
                    </label>
                    <label className="control-line">
                      <span>Label</span>
                      <input
                        className="control-select"
                        type="text"
                        value={activeScreen.label}
                        onChange={(e) => updateScreenCard(activeScreen.id, { label: e.target.value.slice(0, 10) || "S" })}
                        aria-label="Screen label"
                      />
                      <span>{activeScreen.label.length}</span>
                    </label>
                    <div className="preset-row">
                      {(["panel", "round", "diamond"] as ScreenCard["shape"][]).map((shape) => (
                        <button
                          key={shape}
                          type="button"
                          className={`preset-btn ${activeScreen.shape === shape ? "active" : ""}`}
                          onClick={() => updateScreenCard(activeScreen.id, { shape })}
                        >
                          {shape}
                        </button>
                      ))}
                    </div>
                    <label className="control-line">
                      <span>Text</span>
                      <textarea
                        className="control-textarea"
                        value={activeScreen.text}
                        onChange={(e) => updateScreenCard(activeScreen.id, { text: e.target.value.slice(0, 520) })}
                        aria-label="Screen text content"
                      />
                      <span>{activeScreen.text.length}</span>
                    </label>
                    {!activeScreen.mediaUrl ? (
                      <label className="switch-line">
                        <span>Frame</span>
                        <input
                          type="checkbox"
                          checked={activeScreen.showFrame}
                          onChange={(e) => updateScreenCard(activeScreen.id, { showFrame: e.target.checked })}
                        />
                      </label>
                    ) : (
                      <p className="control-help">Media and audio controls are now in the Media Dock for cleaner editing.</p>
                    )}
                    <label className="control-line">
                      <span>X</span>
                      <input
                        type="range"
                        min={-4}
                        max={4}
                        step={0.01}
                        value={activeScreen.x}
                        onChange={(e) => updateScreenCard(activeScreen.id, { x: Number(e.target.value) })}
                      />
                      <span>{activeScreen.x.toFixed(2)}</span>
                    </label>
                    <label className="control-line">
                      <span>Y</span>
                      <input
                        type="range"
                        min={-0.5}
                        max={4}
                        step={0.01}
                        value={activeScreen.y}
                        onChange={(e) => updateScreenCard(activeScreen.id, { y: Number(e.target.value) })}
                      />
                      <span>{activeScreen.y.toFixed(2)}</span>
                    </label>
                    <label className="control-line">
                      <span>Z</span>
                      <input
                        type="range"
                        min={-4}
                        max={4}
                        step={0.01}
                        value={activeScreen.z}
                        onChange={(e) => updateScreenCard(activeScreen.id, { z: Number(e.target.value) })}
                      />
                      <span>{activeScreen.z.toFixed(2)}</span>
                    </label>
                    <label className="control-line">
                      <span>Yaw</span>
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={0.1}
                        value={activeScreen.yaw}
                        onChange={(e) => updateScreenCard(activeScreen.id, { yaw: Number(e.target.value) })}
                      />
                      <span>{activeScreen.yaw.toFixed(1)}°</span>
                    </label>
                    <label className="control-line">
                      <span>Scale</span>
                      <input
                        type="range"
                        min={0.3}
                        max={2.2}
                        step={0.01}
                        value={activeScreen.scale}
                        onChange={(e) => updateScreenCard(activeScreen.id, { scale: Number(e.target.value) })}
                      />
                      <span>{activeScreen.scale.toFixed(2)}x</span>
                    </label>
                    <label className="control-line">
                      <span>Width</span>
                      <input
                        type="range"
                        min={0.35}
                        max={2.6}
                        step={0.01}
                        value={activeScreen.width ?? 1}
                        onChange={(e) => updateScreenCard(activeScreen.id, { width: Number(e.target.value) })}
                      />
                      <span>{(activeScreen.width ?? 1).toFixed(2)}x</span>
                    </label>
                    <label className="control-line">
                      <span>Height</span>
                      <input
                        type="range"
                        min={0.35}
                        max={2.6}
                        step={0.01}
                        value={activeScreen.height ?? 1}
                        onChange={(e) => updateScreenCard(activeScreen.id, { height: Number(e.target.value) })}
                      />
                      <span>{(activeScreen.height ?? 1).toFixed(2)}x</span>
                    </label>
                    <label className="control-line">
                      <span>Bend</span>
                      <input
                        type="range"
                        min={-2.5}
                        max={2.5}
                        step={0.01}
                        value={activeScreen.bend ?? 0}
                        onChange={(e) => updateScreenCard(activeScreen.id, { bend: Number(e.target.value) })}
                      />
                      <span>{(activeScreen.bend ?? 0).toFixed(2)}</span>
                    </label>
                    <p className="control-help">Drag cards directly in scene to move quickly.</p>
                  </>
                )}
                  </>
                ) : (
                  <p className="control-help">Context Focus is on. Select a screen in scene to edit screen controls.</p>
                )}
                <div className="coord-readout">
                  <div>Meshes: {modelStats.meshes}</div>
                  <div>Tris: {modelStats.triangles.toLocaleString()}</div>
                  <div>Verts: {modelStats.vertices.toLocaleString()}</div>
                  <div>Mats: {modelStats.materials}</div>
                  <div>Skinned: {modelStats.skinnedMeshes}</div>
                  <div>Anim Clips: {modelStats.animations}</div>
                </div>
              </div>
            )}

            {isSectionVisible("lighting") && (
              <div className="panel-section" {...withHint("Tune key/fill color, intensity, and offsets for cinematic shaping.")}>
                <div className="section-head">
                  <p className="section-label">Lighting</p>
                  <button type="button" className="mini-btn" onClick={resetLightingModule}>
                    Reset
                  </button>
                </div>
                {showLightContextControls ? (
                  <>
                <label className="control-line">
                  <span>Key Int</span>
                  <input
                    type="range"
                    min={0}
                    max={KEY_INTENSITY_MAX}
                    step={0.01}
                    value={keyIntensity}
                    onChange={(e) => setKeyIntensity(Number(e.target.value))}
                  />
                  <span>{keyIntensity.toFixed(2)}</span>
                </label>
                <label className="control-line">
                  <span>Key Col</span>
                  <input type="color" value={keyColor} onChange={(e) => setKeyColor(e.target.value)} aria-label="Key light color" />
                  <span>{keyColor.toUpperCase()}</span>
                </label>
                <label className="control-line">
                  <span>Key X</span>
                  <input type="range" min={-4} max={4} step={0.01} value={keyOffsetX} onChange={(e) => setKeyOffsetX(Number(e.target.value))} />
                  <span>{keyOffsetX.toFixed(2)}</span>
                </label>
                <label className="control-line">
                  <span>Key Y</span>
                  <input type="range" min={-4} max={4} step={0.01} value={keyOffsetY} onChange={(e) => setKeyOffsetY(Number(e.target.value))} />
                  <span>{keyOffsetY.toFixed(2)}</span>
                </label>
                <label className="control-line">
                  <span>Key Z</span>
                  <input type="range" min={-4} max={4} step={0.01} value={keyOffsetZ} onChange={(e) => setKeyOffsetZ(Number(e.target.value))} />
                  <span>{keyOffsetZ.toFixed(2)}</span>
                </label>
                <label className="control-line">
                  <span>Fill</span>
                  <input
                    type="range"
                    min={0}
                    max={FILL_INTENSITY_MAX}
                    step={0.01}
                    value={fillIntensity}
                    onChange={(e) => setFillIntensity(Number(e.target.value))}
                  />
                  <span>{fillIntensity.toFixed(2)}</span>
                </label>
                <label className="control-line">
                  <span>Color</span>
                  <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} aria-label="Fill light color" />
                  <span>{fillColor.toUpperCase()}</span>
                </label>
                <label className="control-line">
                  <span>Light X</span>
                  <input type="range" min={-4} max={4} step={0.01} value={fillOffsetX} onChange={(e) => setFillOffsetX(Number(e.target.value))} />
                  <span>{fillOffsetX.toFixed(2)}</span>
                </label>
                <label className="control-line">
                  <span>Light Y</span>
                  <input type="range" min={-4} max={4} step={0.01} value={fillOffsetY} onChange={(e) => setFillOffsetY(Number(e.target.value))} />
                  <span>{fillOffsetY.toFixed(2)}</span>
                </label>
                <label className="control-line">
                  <span>Light Z</span>
                  <input type="range" min={-4} max={4} step={0.01} value={fillOffsetZ} onChange={(e) => setFillOffsetZ(Number(e.target.value))} />
                  <span>{fillOffsetZ.toFixed(2)}</span>
                </label>
                <label className="switch-line">
                  <span>Hide Source</span>
                  <input type="checkbox" checked={hideLightSource} onChange={(e) => setHideLightSource(e.target.checked)} />
                </label>
                <label className="control-line">
                  <span>Softness</span>
                  <input type="range" min={0} max={1} step={0.01} value={lightSoftness} onChange={(e) => setLightSoftness(Number(e.target.value))} />
                  <span>{lightSoftness.toFixed(2)}</span>
                </label>
                  </>
                ) : (
                  <>
                    <p className="control-help">Context Focus is on. Select a light marker (Key/Fill/Target) to edit lighting.</p>
                    <div className="preset-row">
                      <button
                        type="button"
                        className={`preset-btn ${sceneSelection === "light-key" ? "active" : ""}`}
                        onClick={() => {
                          setActiveOrbitalLight("key");
                          setSceneSelection("light-key");
                        }}
                      >
                        Key
                      </button>
                      <button
                        type="button"
                        className={`preset-btn ${sceneSelection === "light-fill" ? "active" : ""}`}
                        onClick={() => {
                          setActiveOrbitalLight("fill");
                          setSceneSelection("light-fill");
                        }}
                      >
                        Fill
                      </button>
                      <button
                        type="button"
                        className={`preset-btn ${sceneSelection === "light-target" ? "active" : ""}`}
                        onClick={() => {
                          setSceneSelection("light-target");
                        }}
                      >
                        Target
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {(isSectionVisible("scene") || isSectionVisible("lighting")) && (
              <div className="panel-section" {...withHint("Auto-DP assistant proposes practical, one-click scene corrections.")}>
                <p className="section-label">Auto DP Assistant</p>
                {assistantSuggestions.length === 0 ? <p className="control-help">Scene balance looks solid.</p> : null}
                {uiMode === "basic" ? (
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => assistantSuggestions[0]?.apply()}
                    disabled={assistantSuggestions.length === 0}
                  >
                    {assistantSuggestions[0] ? "Run Smart Fix" : "No Fix Needed"}
                  </button>
                ) : (
                  <div className="assistant-list">
                    {assistantSuggestions.map((item) => (
                      <div className="assistant-item" key={item.id}>
                        <p className="assistant-title">{item.title}</p>
                        <button type="button" className="action-btn" onClick={item.apply}>Apply</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isSectionVisible("post") && (
              <div className="panel-section" {...withHint("Atmosphere grading and diffusion controls for scene lighting mood.")}>
                <div className="section-head">
                  <p className="section-label">Atmosphere & Grade</p>
                  <button type="button" className="mini-btn" onClick={resetLookModule}>
                    Reset
                  </button>
                </div>
                <div className="preset-row">
                  {(["clean", "film", "cold"] as GradeKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`preset-btn ${grade === key ? "active" : ""}`}
                      onClick={() => setGrade(key)}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                {uiMode !== "basic" && (
                  <>
                    <label className="control-line">
                      <span>Bloom</span>
                      <input type="range" min={0} max={0.9} step={0.01} value={bloomStrength} onChange={(e) => setBloomStrength(Number(e.target.value))} />
                      <span>{bloomStrength.toFixed(2)}</span>
                    </label>
                    <label className="control-line">
                      <span>Atmos</span>
                      <input type="range" min={0} max={0.45} step={0.01} value={fogAmount} onChange={(e) => setFogAmount(Number(e.target.value))} />
                      <span>{fogAmount.toFixed(2)}</span>
                    </label>
                    <label className="control-line">
                      <span>Ambient</span>
                      <input type="range" min={0} max={1} step={0.01} value={ambientAtmosphere} onChange={(e) => setAmbientAtmosphere(Number(e.target.value))} />
                      <span>{ambientAtmosphere.toFixed(2)}</span>
                    </label>
                    <label className="control-line">
                      <span>Spread</span>
                      <input type="range" min={0.15} max={1} step={0.01} value={atmosphereSpread} onChange={(e) => setAtmosphereSpread(Number(e.target.value))} />
                      <span>{atmosphereSpread.toFixed(2)}</span>
                    </label>
                    <p className="control-help">Ambient + spread shape the atmospheric depth envelope around the model.</p>
                  </>
                )}
                <p className="control-help">Grade plus atmosphere controls define your lighting mood and scene depth.</p>
              </div>
            )}

            {isSectionVisible("fx") && (
              <div className="panel-section" {...withHint("Secondary effects for rhythm and motion energy in the scene.")}>
                <div className="section-head">
                  <p className="section-label">Extra FX</p>
                  <button type="button" className="mini-btn" onClick={resetFXModule}>
                    Reset
                  </button>
                </div>
                <button type="button" className="extras-toggle" onClick={() => setExtrasOpen((prev) => !prev)}>
                  {extrasOpen ? "Hide Extra FX" : "Show Extra FX"}
                </button>
                {extrasOpen && (
                  <>
                    <label className="switch-line">
                      <span>Effects</span>
                      <input type="checkbox" checked={particlesEnabled} onChange={(e) => setParticlesEnabled(e.target.checked)} />
                    </label>
                    <p className="section-label">FX Presets</p>
                    <div className="preset-row">
                      <button
                        type="button"
                        className={`preset-btn ${particlesEnabled && activeFxPreset === "halo" ? "active" : ""}`}
                        onClick={() => toggleFxPreset("halo")}
                      >
                        Halo
                      </button>
                      <button
                        type="button"
                        className={`preset-btn ${particlesEnabled && activeFxPreset === "storm" ? "active" : ""}`}
                        onClick={() => toggleFxPreset("storm")}
                      >
                        Storm
                      </button>
                      <button
                        type="button"
                        className={`preset-btn ${particlesEnabled && activeFxPreset === "glyph-net" ? "active" : ""}`}
                        onClick={() => toggleFxPreset("glyph-net")}
                      >
                        Glyph Net
                      </button>
                    </div>
                    <div className="preset-row">
                      <button
                        type="button"
                        className={`preset-btn ${particlesEnabled && activeFxPreset === "arc-reactor" ? "active" : ""}`}
                        onClick={() => toggleFxPreset("arc-reactor")}
                      >
                        Arc Reactor
                      </button>
                      <button
                        type="button"
                        className={`preset-btn ${particlesEnabled && activeFxPreset === "crystal-drift" ? "active" : ""}`}
                        onClick={() => toggleFxPreset("crystal-drift")}
                      >
                        Crystal Drift
                      </button>
                      <button
                        type="button"
                        className={`preset-btn ${particlesEnabled && activeFxPreset === "beam-cage" ? "active" : ""}`}
                        onClick={() => toggleFxPreset("beam-cage")}
                      >
                        Shard Cage
                      </button>
                    </div>
                    <div className="preset-row">
                      <button
                        type="button"
                        className={`preset-btn ${particlesEnabled && activeFxPreset === "dual-mix" ? "active" : ""}`}
                        onClick={() => toggleFxPreset("dual-mix")}
                      >
                        Dual Mix
                      </button>
                      <button
                        type="button"
                        className={`preset-btn ${particlesEnabled && activeFxPreset === "snow-room" ? "active" : ""}`}
                        onClick={() => toggleFxPreset("snow-room")}
                      >
                        Snow Room
                      </button>
                      <button
                        type="button"
                        className={`preset-btn ${!particlesEnabled ? "active" : ""}`}
                        onClick={disableAllFx}
                      >
                        FX Off
                      </button>
                    </div>
                    <p className="section-label">FX Style A</p>
                    {(
                      [
                        ["dust", "embers", "snow", "glyphs"],
                        ["orbit-balls", "ribbons", "shards"],
                      ] as ParticleStyle[][]
                    ).map((row, rowIndex) => (
                      <div className="fx-style-grid" key={`style-row-${rowIndex}`}>
                        {row.map((style) => (
                          <button
                            key={style}
                            type="button"
                            className={`preset-btn ${particlesEnabled && particleStyle === style ? "active" : ""}`}
                            onClick={() => toggleFxStyle(style)}
                          >
                            {style}
                          </button>
                        ))}
                        {row.length === 3 ? <span></span> : null}
                      </div>
                    ))}
                    <label className="control-line">
                      <span>Layer B</span>
                      <select
                        className="control-select"
                        value={secondaryParticleStyle}
                        onChange={(e) => setSecondaryParticleStyle(e.target.value as SecondaryParticleStyle)}
                      >
                        <option value="none">None</option>
                        {FX_STYLE_UI_OPTIONS.map((style) => (
                          <option key={style} value={style}>
                            {style}
                          </option>
                        ))}
                      </select>
                      <span>{secondaryParticleStyle === "none" ? "off" : "on"}</span>
                    </label>
                    <label className="control-line">
                      <span>Layer B Mix</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={effectBlend}
                        onChange={(e) => setEffectBlend(Number(e.target.value))}
                        disabled={secondaryParticleStyle === "none" || secondaryParticleStyle === particleStyle}
                      />
                      <span>{effectBlend.toFixed(2)}</span>
                    </label>
                    <label className="control-line">
                      <span>Amount</span>
                      <input type="range" min={0} max={3} step={0.01} value={effectAmount} onChange={(e) => setEffectAmount(Number(e.target.value))} />
                      <span>{effectAmount.toFixed(2)}</span>
                    </label>
                    <label className="control-line">
                      <span>Speed</span>
                      <input type="range" min={0.1} max={4} step={0.01} value={effectSpeed} onChange={(e) => setEffectSpeed(Number(e.target.value))} />
                      <span>{effectSpeed.toFixed(2)}x</span>
                    </label>
                    <label className="control-line">
                      <span>Scale</span>
                      <input type="range" min={0.2} max={4} step={0.01} value={effectScale} onChange={(e) => setEffectScale(Number(e.target.value))} />
                      <span>{effectScale.toFixed(2)}</span>
                    </label>
                    <label className="control-line">
                      <span>Spread</span>
                      <input type="range" min={0.3} max={3} step={0.01} value={effectSpread} onChange={(e) => setEffectSpread(Number(e.target.value))} />
                      <span>{effectSpread.toFixed(2)}</span>
                    </label>
                    {uiMode !== "basic" && (
                      <label className="control-line">
                        <span>Density</span>
                        <input type="range" min={0} max={2.4} step={0.01} value={particleDensity} onChange={(e) => setParticleDensity(Number(e.target.value))} />
                        <span>{particleDensity.toFixed(2)}</span>
                      </label>
                    )}
                    <label className="switch-line">
                      <span>Title Sync</span>
                      <input type="checkbox" checked={titleSync} onChange={(e) => setTitleSync(e.target.checked)} />
                    </label>
                    <label className="switch-line">
                      <span>Beat Pulse</span>
                      <input type="checkbox" checked={beatPulse} onChange={(e) => setBeatPulse(e.target.checked)} />
                    </label>
                  </>
                )}
                <p className="section-label">Overlays</p>
                <label className="switch-line">
                  <span>Silhouette</span>
                  <input type="checkbox" checked={overlaySilhouette} onChange={(e) => setOverlaySilhouette(e.target.checked)} />
                </label>
                <p className="control-help">Silhouette score: {silhouetteLabel}</p>
              </div>
            )}

            {isSectionVisible("constraints") && (
              <div className="panel-section" {...withHint("Safety constraints for light placement in relation to floor, camera side, and body volume.")}>
                <div className="section-head">
                  <p className="section-label">Constraints</p>
                  <button type="button" className="mini-btn" onClick={resetConstraintsModule}>
                    Reset
                  </button>
                </div>
                <div className="preset-row">
                  <button type="button" className="preset-btn" onClick={() => applyConstraintPreset("portrait")}>Portrait</button>
                  <button type="button" className="preset-btn" onClick={() => applyConstraintPreset("no-spill")}>No Spill</button>
                  <button type="button" className="preset-btn" onClick={() => applyConstraintPreset("rim")}>Rim</button>
                </div>
                <div className="preset-row">
                  <button type="button" className="preset-btn" onClick={() => applyConstraintPreset("soft-front")}>Soft Front</button>
                  <button type="button" className="preset-btn" onClick={() => setStayLightsInFront((prev) => !prev)}>
                    {stayLightsInFront ? "Front On" : "Front Off"}
                  </button>
                  <button type="button" className="preset-btn" onClick={() => setAvoidBodyIntersection((prev) => !prev)}>
                    {avoidBodyIntersection ? "Body Safe" : "Body Free"}
                  </button>
                </div>
                <label className="control-line">
                  <span>Min Height</span>
                  <input type="range" min={-0.2} max={2.2} step={0.01} value={minLightHeight} onChange={(e) => setMinLightHeight(Number(e.target.value))} />
                  <span>{minLightHeight.toFixed(2)}</span>
                </label>
                <label className="control-line">
                  <span>Max Dist</span>
                  <input type="range" min={1.2} max={8} step={0.01} value={maxLightDistance} onChange={(e) => setMaxLightDistance(Number(e.target.value))} />
                  <span>{maxLightDistance.toFixed(2)}</span>
                </label>
                <label className="switch-line">
                  <span>Stay Front</span>
                  <input type="checkbox" checked={stayLightsInFront} onChange={(e) => setStayLightsInFront(e.target.checked)} />
                </label>
                <label className="switch-line">
                  <span>Avoid Body</span>
                  <input type="checkbox" checked={avoidBodyIntersection} onChange={(e) => setAvoidBodyIntersection(e.target.checked)} />
                </label>
                <label className="control-line">
                  <span>Clearance</span>
                  <input type="range" min={0.2} max={2} step={0.01} value={bodyClearance} onChange={(e) => setBodyClearance(Number(e.target.value))} />
                  <span>{bodyClearance.toFixed(2)}</span>
                </label>
              </div>
            )}

            {isSectionVisible("motion") && (
              <div className="panel-section" {...withHint("Motion studio combines keyframe timeline and light paint trajectories.")}>
                <div className="section-head">
                  <p className="section-label">Motion Studio</p>
                  <button type="button" className="mini-btn" onClick={resetMotionModule}>
                    Reset
                  </button>
                </div>
                <p className="section-label">Timeline</p>
                <label className="control-line">
                  <span>Cursor</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.001}
                    value={timelineCursor}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      timelineCursorRef.current = next;
                      setTimelineCursor(next);
                      if (!timelinePlaying) {
                        applyTimelineAt(next, false);
                      }
                    }}
                  />
                  <span>{(timelineCursor * 100).toFixed(1)}%</span>
                </label>
                <label className="control-line">
                  <span>Duration</span>
                  <input type="range" min={1} max={20} step={0.1} value={timelineDuration} onChange={(e) => setTimelineDuration(Number(e.target.value))} />
                  <span>{timelineDuration.toFixed(1)}s</span>
                </label>
                <label className="switch-line">
                  <span>Loop</span>
                  <input type="checkbox" checked={timelineLoop} onChange={(e) => setTimelineLoop(e.target.checked)} />
                </label>
                <div className="control-actions">
                  <button type="button" className="action-btn" onClick={addTimelineFrame}>Add</button>
                  <button type="button" className="action-btn" onClick={updateSelectedFrame} disabled={!selectedFrameId}>Update</button>
                  <button type="button" className="action-btn" onClick={applySelectedFrame} disabled={!selectedFrameId}>Apply</button>
                  <button type="button" className="action-btn" onClick={removeSelectedFrame} disabled={!selectedFrameId}>Delete</button>
                  <button type="button" className="action-btn wide" onClick={() => setTimelinePlaying((prev) => !prev)} disabled={timelineFrames.length < 2}>
                    {timelinePlaying ? "Stop Playback" : "Play Timeline"}
                  </button>
                </div>
                <div className="timeline-list">
                  {timelineFrames.length === 0 ? (
                    <p className="control-help">No keyframes yet. Add at different cursor values.</p>
                  ) : (
                    timelineFrames
                      .slice()
                      .sort((a, b) => a.t - b.t)
                      .map((frame) => (
                        <button
                          key={frame.id}
                          type="button"
                          className={`timeline-item ${selectedFrameId === frame.id ? "active" : ""}`}
                          onClick={() => {
                            setSelectedFrameId(frame.id);
                            setTimelineCursor(frame.t);
                            timelineCursorRef.current = frame.t;
                            if (!timelinePlaying) {
                              applyTimelineAt(frame.t, false);
                            }
                          }}
                        >
                          <span>{frame.name}</span>
                          <span>{(frame.t * 100).toFixed(1)}%</span>
                        </button>
                      ))
                  )}
                </div>
                <p className="section-label">Light Paint</p>
                <p className="control-help">Enable paint, drag in orbit sphere to record path, then play.</p>
                <div className="orbital-top">
                  <button
                    type="button"
                    className={`preset-btn ${lightPaintMode ? "active" : ""}`}
                    onClick={() => setLightPaintMode((prev) => !prev)}
                    title="Toggle paint recording mode"
                  >
                    {lightPaintMode ? "Paint On" : "Paint Off"}
                  </button>
                  <button
                    type="button"
                    className={`preset-btn ${lightPaintPlaying ? "active" : ""}`}
                    onClick={() => setLightPaintPlaying((prev) => !prev)}
                    disabled={lightPaintPoints.length < 2}
                    title="Space-like transport for light paint playback"
                  >
                    {lightPaintPlaying ? "Stop" : "Play"}
                  </button>
                </div>
                <div className="orbital-top">
                  <button
                    type="button"
                    className={`preset-btn ${lightPaintTarget === "key" ? "active" : ""}`}
                    onClick={() => setLightPaintTarget("key")}
                  >
                    Key Path
                  </button>
                  <button
                    type="button"
                    className={`preset-btn ${lightPaintTarget === "fill" ? "active" : ""}`}
                    onClick={() => setLightPaintTarget("fill")}
                  >
                    Fill Path
                  </button>
                </div>
                <label className="control-line">
                  <span>Speed</span>
                  <input type="range" min={0.2} max={2.5} step={0.01} value={lightPaintSpeed} onChange={(e) => setLightPaintSpeed(Number(e.target.value))} />
                  <span>{lightPaintSpeed.toFixed(2)}x</span>
                </label>
                <label className="switch-line">
                  <span>Loop</span>
                  <input type="checkbox" checked={lightPaintLoop} onChange={(e) => setLightPaintLoop(e.target.checked)} />
                </label>
                <label className="control-line">
                  <span>Path</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.001}
                    value={lightPaintProgress}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setLightPaintProgress(next);
                      lightPaintPlayheadRef.current = next * Math.max(1, lightPaintPointsRef.current.length - 1);
                      if (!lightPaintPlaying) {
                        const points = lightPaintPointsRef.current;
                        if (points.length > 1) {
                          const segments = Math.max(1, points.length - 1);
                          const f = next * segments;
                          const idx = Math.min(segments - 1, Math.floor(f));
                          const nidx = Math.min(points.length - 1, idx + 1);
                          const alpha = THREE.MathUtils.clamp(f - idx, 0, 1);
                          const left = points[idx];
                          const right = points[nidx];
                          if (lightPaintTarget === "key") {
                            setKeyAzimuth(lerpAngle(left.azimuth, right.azimuth, alpha));
                            setKeyElevation(THREE.MathUtils.lerp(left.elevation, right.elevation, alpha));
                            setKeyDistance(THREE.MathUtils.lerp(left.distance, right.distance, alpha));
                          } else {
                            setFillAzimuth(lerpAngle(left.azimuth, right.azimuth, alpha));
                            setFillElevation(THREE.MathUtils.lerp(left.elevation, right.elevation, alpha));
                            setFillDistance(THREE.MathUtils.lerp(left.distance, right.distance, alpha));
                          }
                        }
                      }
                    }}
                  />
                  <span>{(lightPaintProgress * 100).toFixed(1)}%</span>
                </label>
                <div className="control-actions">
                  <button type="button" className="action-btn" onClick={() => setLightPaintPoints([])}>
                    Clear Path
                  </button>
                  <button type="button" className="action-btn" onClick={() => setLightPaintProgress(0)} disabled={lightPaintPoints.length < 2}>
                    Reset Path
                  </button>
                </div>
              </div>
            )}

            {isSectionVisible("debug") && (
              <div className="panel-section" {...withHint("Debug readout for rig anchors and world-space light placement.")}>
                <p className="section-label">Debug</p>
                <div className="coord-readout">
                  <div>Anchor: {lightAnchorMode.toUpperCase()}</div>
                  <div>Follow Pt: {lightFollowPoint.toUpperCase()}</div>
                  <div>Screen Attach: {screenAttachmentMode.toUpperCase()}</div>
                  <div>Center: {orbitCenterWorld.x.toFixed(2)}, {orbitCenterWorld.y.toFixed(2)}, {orbitCenterWorld.z.toFixed(2)}</div>
                  <div>Key Pos: {keyWorld.x.toFixed(2)}, {keyWorld.y.toFixed(2)}, {keyWorld.z.toFixed(2)}</div>
                  <div>Fill Pos: {fillWorld.x.toFixed(2)}, {fillWorld.y.toFixed(2)}, {fillWorld.z.toFixed(2)}</div>
                </div>
              </div>
            )}

            {isSectionVisible("capture") && (
              <div className="panel-section" {...withHint("Orbit camera, reset framing, and capture PNG/JPG output.")}>
                <div className="section-head">
                  <p className="section-label">Capture</p>
                  <button type="button" className="mini-btn" onClick={resetOutputModule}>
                    Reset
                  </button>
                </div>
                <div className="control-actions">
                  <label className="switch-line">
                    <span>Auto Orbit</span>
                    <input type="checkbox" checked={autoOrbit} onChange={(e) => setAutoOrbit(e.target.checked)} />
                  </label>
                  <label className="control-line" style={{ gridColumn: "1 / -1" }}>
                    <span>Orbit Spd</span>
                    <input type="range" min={0.1} max={2.5} step={0.01} value={cameraOrbitSpeed} onChange={(e) => setCameraOrbitSpeed(Number(e.target.value))} />
                    <span>{cameraOrbitSpeed.toFixed(2)}x</span>
                  </label>
                  <label className="switch-line">
                    <span>Auto Quality</span>
                    <input type="checkbox" checked={autoQuality} onChange={(e) => setAutoQuality(e.target.checked)} />
                  </label>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <p className="section-label" style={{ marginBottom: "0.24rem" }}>Performance Tier</p>
                    <div className="preset-row">
                      {(["ultra", "balanced", "fast"] as PerformanceTier[]).map((tier) => (
                        <button
                          key={tier}
                          type="button"
                          className={`preset-btn ${performanceTier === tier ? "active" : ""}`}
                          onClick={() => setPerformanceTier(tier)}
                        >
                          {tier}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="button" className="action-btn" onClick={() => resetViewRef.current?.()}>
                    Reset View
                  </button>
                  <div className="coord-readout" style={{ gridColumn: "1 / -1" }}>
                    <div>FPS: {fps.toFixed(1)}</div>
                    <div>Quality: {qualityMode.toUpperCase()}{autoQuality ? " · AUTO" : ""}</div>
                    <div>{`Perf: ${performanceTier.toUpperCase()}`}</div>
                    <div>Mode: {uiMode.toUpperCase()}</div>
                  </div>
                  <label className="control-line" style={{ gridColumn: "1 / -1" }}>
                    <span>Capture</span>
                    <select
                      className="control-select"
                      value={captureFormat}
                      onChange={(e) => setCaptureFormat(e.target.value as "png" | "jpg")}
                      aria-label="Capture image format"
                    >
                      <option value="png">PNG</option>
                      <option value="jpg">JPG</option>
                    </select>
                    <span>{captureFormat.toUpperCase()}</span>
                  </label>
                  <button type="button" className="action-btn wide" onClick={() => captureStillRef.current?.()}>
                    Capture {captureFormat.toUpperCase()}
                  </button>
                  <button type="button" className="action-btn wide" onClick={() => capturePackRef.current?.()}>
                    Export Pack (Still + Strip + JSON)
                  </button>
                </div>
                <div className="section-head" style={{ marginTop: "0.2rem" }}>
                  <p className="section-label">Scene API</p>
                  <div style={{ display: "flex", gap: "0.22rem" }}>
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => setApiInspectorLogs([])}
                      disabled={apiInspectorLogs.length === 0}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() =>
                        setApiEventStats({
                          accepted: 0,
                          completed: 0,
                          failed: 0,
                          timeout: 0,
                        })
                      }
                    >
                      Reset Stats
                    </button>
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => setApiInspectorOpen((prev) => !prev)}
                    >
                      {apiInspectorOpen ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                {apiInspectorOpen && (
                  <>
                    <div className="coord-readout">
                      <div>Accepted: {apiEventStats.accepted}</div>
                      <div>Completed: {apiEventStats.completed}</div>
                      <div>Failed: {apiEventStats.failed}</div>
                      <div>Timeout: {apiEventStats.timeout}</div>
                    </div>
                    <label className="control-line">
                      <span>Command</span>
                      <select
                        className="control-select"
                        value={apiInspectorCommand}
                        onChange={(e) => setApiInspectorCommand(e.target.value as SceneApiCommandName)}
                        aria-label="Scene API command"
                      >
                        {SCENE_API_COMMANDS.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <span>{apiInspectorLogs.length}</span>
                    </label>
                    <label className="control-line">
                      <span>Payload</span>
                      <textarea
                        className="control-textarea api-payload"
                        value={apiInspectorPayload}
                        onChange={(e) => setApiInspectorPayload(e.target.value)}
                        spellCheck={false}
                        aria-label="Scene API command payload JSON"
                      />
                      <span>JSON</span>
                    </label>
                    <label className="control-line">
                      <span>Timeout</span>
                      <select
                        className="control-select"
                        value={apiTimeoutPreset}
                        onChange={(e) => setApiTimeoutPreset(e.target.value as ApiTimeoutPreset)}
                        aria-label="API timeout preset"
                      >
                        <option value="fast">Fast</option>
                        <option value="balanced">Balanced</option>
                        <option value="reliable">Reliable</option>
                        <option value="custom">Custom</option>
                      </select>
                      <span>{apiTimeoutPreset.toUpperCase()}</span>
                    </label>
                    {apiTimeoutPreset === "custom" && (
                      <label className="control-line">
                        <span>Custom MS</span>
                        <input
                          type="range"
                          min={500}
                          max={120000}
                          step={100}
                          value={apiTimeoutCustomMs}
                          onChange={(e) => setApiTimeoutCustomMs(Number(e.target.value))}
                        />
                        <span>{Math.round(apiTimeoutCustomMs)}ms</span>
                      </label>
                    )}
                    <label className="control-line">
                      <span>Retries</span>
                      <input
                        type="range"
                        min={0}
                        max={6}
                        step={1}
                        value={apiRetryCount}
                        onChange={(e) => setApiRetryCount(Number(e.target.value))}
                      />
                      <span>{apiRetryCount}</span>
                    </label>
                    <label className="switch-line">
                      <span>Confirm Destructive</span>
                      <input
                        type="checkbox"
                        checked={apiConfirmDestructive}
                        onChange={(e) => setApiConfirmDestructive(e.target.checked)}
                      />
                    </label>
                    <label className="switch-line">
                      <span>Hide stateChanged</span>
                      <input
                        type="checkbox"
                        checked={apiInspectorHideStateChanged}
                        onChange={(e) => setApiInspectorHideStateChanged(e.target.checked)}
                      />
                    </label>
                    <div className="control-actions">
                      <button type="button" className="action-btn" onClick={runApiInspectorCommand}>
                        Send
                      </button>
                      <button type="button" className="action-btn" onClick={runApiInspectorCommandPrompted}>
                        Run Prompted
                      </button>
                      <button type="button" className="action-btn" onClick={runApiInspectorDryRun}>
                        Dry Run
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => {
                          setApiInspectorCommand("hello");
                          setApiInspectorPayload(`{"requestedVersion":"${SCENE_API_VERSION}"}`);
                        }}
                      >
                        Preset Hello
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => {
                          setApiInspectorCommand("setCameraMotion");
                          setApiInspectorPayload('{"enabled":true,"speed":0.6}');
                        }}
                      >
                        Preset Orbit
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => {
                          setApiInspectorCommand("setScreenMedia");
                          setApiInspectorPayload(
                            '{"screenId":"screen-a","sourceType":"provider","url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","playing":true,"showFrame":false}'
                          );
                        }}
                      >
                        Preset Provider
                      </button>
                      <button
                        type="button"
                        className="action-btn wide"
                        onClick={() => {
                          setApiInspectorCommand("getCapabilities");
                          setApiInspectorPayload("{}");
                        }}
                      >
                        Preset Capabilities
                      </button>
                    </div>
                    {(apiDryRunResolvedPayload || apiDryRunError) && (
                      <div className="coord-readout">
                        <div>Dry Run: {apiDryRunError ? "Invalid Payload" : "Resolved"}</div>
                        {apiDryRunError ? (
                          <div style={{ color: "rgba(255, 150, 150, 0.9)" }}>{apiDryRunError}</div>
                        ) : (
                          <pre
                            style={{
                              margin: 0,
                              whiteSpace: "pre-wrap",
                              fontSize: "0.48rem",
                              lineHeight: 1.35,
                              letterSpacing: "0.03em",
                            }}
                          >
                            {apiDryRunResolvedPayload}
                          </pre>
                        )}
                      </div>
                    )}
                    <label className="control-line">
                      <span>Macro Search</span>
                      <input
                        className="control-select"
                        type="text"
                        value={apiMacroSearch}
                        onChange={(e) => setApiMacroSearch(e.target.value)}
                        placeholder="name, command, or tag"
                        aria-label="Filter API macros"
                      />
                      <span>{filteredApiMacros.length}</span>
                    </label>
                    <label className="control-line">
                      <span>Macro</span>
                      <select
                        className="control-select"
                        value={selectedApiMacroId}
                        onChange={(e) => {
                          const macroId = e.target.value;
                          setSelectedApiMacroId(macroId);
                          const macro = apiMacros.find((entry) => entry.id === macroId);
                          if (!macro) return;
                          setApiMacroNameInput(macro.name);
                          setApiMacroTagsInput(macro.tags.join(", "));
                        }}
                        aria-label="Scene API macros"
                      >
                        <option value="">Select macro</option>
                        {filteredApiMacros.map((macro) => (
                          <option key={macro.id} value={macro.id}>
                            {macro.pinned ? "★ " : ""}
                            {macro.name}
                          </option>
                        ))}
                      </select>
                      <span>{apiMacros.length}</span>
                    </label>
                    <label className="control-line">
                      <span>Name</span>
                      <input
                        className="control-select"
                        type="text"
                        value={apiMacroNameInput}
                        onChange={(e) => setApiMacroNameInput(e.target.value)}
                        placeholder="Macro name"
                        aria-label="API macro name"
                      />
                      <span></span>
                    </label>
                    <label className="control-line">
                      <span>Tags</span>
                      <input
                        className="control-select"
                        type="text"
                        value={apiMacroTagsInput}
                        onChange={(e) => setApiMacroTagsInput(e.target.value)}
                        placeholder="camera, export, lights"
                        aria-label="API macro tags"
                      />
                      <span>CSV</span>
                    </label>
                    <div className="control-actions">
                      <button type="button" className="action-btn" onClick={saveApiMacro}>
                        {selectedApiMacroId ? "Update Macro" : "Save Macro"}
                      </button>
                      <button type="button" className="action-btn" onClick={applySelectedApiMacro} disabled={!selectedApiMacroId}>
                        Load Macro
                      </button>
                      <button type="button" className="action-btn" onClick={() => void runSelectedApiMacro()} disabled={!selectedApiMacroId}>
                        Run Macro
                      </button>
                      <button type="button" className="action-btn" onClick={() => void runSelectedApiMacroPrompted()} disabled={!selectedApiMacroId}>
                        Prompt Run
                      </button>
                      <button type="button" className="action-btn" onClick={duplicateSelectedApiMacro} disabled={!selectedApiMacroId}>
                        Duplicate
                      </button>
                      <button type="button" className="action-btn" onClick={toggleSelectedApiMacroPinned} disabled={!selectedApiMacroId}>
                        Pin / Unpin
                      </button>
                      <button type="button" className="action-btn" onClick={() => moveSelectedApiMacro(-1)} disabled={!selectedApiMacroId}>
                        Move Up
                      </button>
                      <button type="button" className="action-btn" onClick={() => moveSelectedApiMacro(1)} disabled={!selectedApiMacroId}>
                        Move Down
                      </button>
                      <button type="button" className="action-btn wide" onClick={deleteSelectedApiMacro} disabled={!selectedApiMacroId}>
                        Delete Macro
                      </button>
                    </div>
                    {quickMacroSlots.length > 0 && (
                      <div className="coord-readout">
                        <div>Quick Slots (Shift + 1..9)</div>
                        <div className="control-actions" style={{ marginTop: "0.22rem" }}>
                          {quickMacroSlots.map((macro, index) => (
                            <button
                              key={macro.id}
                              type="button"
                              className="action-btn"
                              onClick={() => void runMacroById(macro.id, true, "macro", `quick slot ${index + 1}`)}
                            >
                              {index + 1}. {macro.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <label className="control-line">
                      <span>Var Key</span>
                      <input
                        className="control-select"
                        type="text"
                        value={apiVarKeyInput}
                        onChange={(e) => setApiVarKeyInput(e.target.value)}
                        placeholder="screenId"
                        aria-label="Template variable key"
                      />
                      <span>VAR</span>
                    </label>
                    <label className="control-line">
                      <span>Var Value</span>
                      <input
                        className="control-select"
                        type="text"
                        value={apiVarValueInput}
                        onChange={(e) => setApiVarValueInput(e.target.value)}
                        placeholder="screen-a"
                        aria-label="Template variable value"
                      />
                      <span>VALUE</span>
                    </label>
                    <div className="control-actions">
                      <button type="button" className="action-btn wide" onClick={addTemplateVariable} disabled={!apiVarKeyInput.trim()}>
                        Add / Update Variable
                      </button>
                    </div>
                    {apiTemplateVars.length > 0 && (
                      <div className="api-log-list">
                        {apiTemplateVars.slice(0, 12).map((entry) => (
                          <div key={entry.id} className="api-log-item info">
                            <span className="api-log-meta">{entry.key}</span>
                            <span className="api-log-summary">{entry.value || "(empty)"}</span>
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button type="button" className="mini-btn" onClick={() => removeTemplateVariable(entry.id)}>
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <label className="control-line">
                      <span>Sequence</span>
                      <select
                        className="control-select"
                        value={selectedApiSequenceId}
                        onChange={(e) => setSelectedApiSequenceId(e.target.value)}
                        aria-label="API sequence select"
                      >
                        <option value="">Select sequence</option>
                        {apiSequences.map((sequence) => (
                          <option key={sequence.id} value={sequence.id}>
                            {sequence.name}
                          </option>
                        ))}
                      </select>
                      <span>{apiSequences.length}</span>
                    </label>
                    <label className="control-line">
                      <span>Seq Name</span>
                      <input
                        className="control-select"
                        type="text"
                        value={apiSequenceNameInput}
                        onChange={(e) => setApiSequenceNameInput(e.target.value)}
                        placeholder="Sequence name"
                        aria-label="API sequence name"
                      />
                      <span></span>
                    </label>
                    <div className="control-actions">
                      <button type="button" className="action-btn" onClick={createApiSequence}>
                        New
                      </button>
                      <button type="button" className="action-btn" onClick={saveSelectedApiSequence} disabled={!selectedApiSequenceId}>
                        Save
                      </button>
                      <button type="button" className="action-btn" onClick={deleteSelectedApiSequence} disabled={!selectedApiSequenceId}>
                        Delete
                      </button>
                      <button type="button" className="action-btn" onClick={addSelectedSequenceStep} disabled={!selectedApiSequenceId || apiMacros.length === 0}>
                        Add Step
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => void runSelectedApiSequence()}
                        disabled={!selectedApiSequenceId || apiSequenceRunning}
                      >
                        Run Seq
                      </button>
                      <button type="button" className="action-btn" onClick={stopApiSequenceRun} disabled={!apiSequenceRunning}>
                        Stop Seq
                      </button>
                    </div>
                    {selectedSequence && (
                      <>
                        <label className="switch-line">
                          <span>Stop On Error</span>
                          <input
                            type="checkbox"
                            checked={selectedSequence.stopOnError}
                            onChange={(e) =>
                              patchSelectedSequence((sequence) => ({
                                ...sequence,
                                stopOnError: e.target.checked,
                                updatedAt: Date.now(),
                              }))
                            }
                          />
                        </label>
                        <div className="api-log-list">
                          {selectedSequence.steps.length === 0 ? (
                            <div className="api-log-item info">No steps yet. Add steps from macros.</div>
                          ) : (
                            selectedSequence.steps.map((step, index) => (
                              <div key={step.id} className="api-log-item info">
                                <span className="api-log-meta">Step {index + 1}</span>
                                <label className="switch-line" style={{ margin: "0.1rem 0" }}>
                                  <span>Enabled</span>
                                  <input
                                    type="checkbox"
                                    checked={step.enabled}
                                    onChange={(e) => updateSelectedSequenceStep(step.id, { enabled: e.target.checked })}
                                  />
                                </label>
                                <label className="control-line">
                                  <span>Macro</span>
                                  <select
                                    className="control-select"
                                    value={step.macroId}
                                    onChange={(e) => updateSelectedSequenceStep(step.id, { macroId: e.target.value })}
                                  >
                                    {apiMacros.map((macro) => (
                                      <option key={macro.id} value={macro.id}>
                                        {macro.name}
                                      </option>
                                    ))}
                                  </select>
                                  <span></span>
                                </label>
                                <label className="control-line">
                                  <span>Delay</span>
                                  <input
                                    type="range"
                                    min={0}
                                    max={5000}
                                    step={50}
                                    value={step.delayMs}
                                    onChange={(e) => updateSelectedSequenceStep(step.id, { delayMs: Number(e.target.value) })}
                                  />
                                  <span>{step.delayMs}ms</span>
                                </label>
                                <div className="control-actions">
                                  <button type="button" className="action-btn" onClick={() => moveSelectedSequenceStep(step.id, -1)}>
                                    Up
                                  </button>
                                  <button type="button" className="action-btn" onClick={() => moveSelectedSequenceStep(step.id, 1)}>
                                    Down
                                  </button>
                                  <button type="button" className="action-btn" onClick={() => removeSelectedSequenceStep(step.id)}>
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}

                    <div className="control-actions">
                      <button type="button" className="action-btn" onClick={exportAutomationProfile}>
                        Export Profile
                      </button>
                      <button type="button" className="action-btn" onClick={() => profileImportInputRef.current?.click()}>
                        Import Profile
                      </button>
                    </div>
                    <input
                      ref={profileImportInputRef}
                      type="file"
                      accept="application/json,.json"
                      onChange={importAutomationProfile}
                      style={{ display: "none" }}
                      aria-label="Import scene automation profile"
                    />
                    {pendingProfileImport && (
                      <div className="coord-readout">
                        <div>Pending Profile: {pendingProfileImport.fileName}</div>
                        <div>Scene Fields: {pendingProfileImport.sceneDiffKeys.length}</div>
                        <div>
                          Macros: +{pendingProfileImport.macroDiff.add} / ~{pendingProfileImport.macroDiff.update}
                        </div>
                        <div>
                          Vars: +{pendingProfileImport.templateVarDiff.add} / ~{pendingProfileImport.templateVarDiff.update}
                        </div>
                        <div>
                          Sequences: +{pendingProfileImport.sequenceDiff.add} / ~{pendingProfileImport.sequenceDiff.update}
                        </div>
                        <div>
                          API Flag:{" "}
                          {pendingProfileImport.hideStateChanged === null
                            ? "No change"
                            : pendingProfileImport.hideStateChanged
                              ? "Hide stateChanged ON"
                              : "Hide stateChanged OFF"}
                        </div>
                        <div className="control-actions" style={{ marginTop: "0.22rem" }}>
                          <button type="button" className="action-btn" onClick={() => applyPendingProfileImport("scene")}>
                            Apply Scene
                          </button>
                          <button type="button" className="action-btn" onClick={() => applyPendingProfileImport("api-merge")}>
                            Merge API
                          </button>
                          <button type="button" className="action-btn" onClick={() => applyPendingProfileImport("api-replace")}>
                            Replace API
                          </button>
                          <button type="button" className="action-btn" onClick={() => applyPendingProfileImport("all-merge")}>
                            Merge All
                          </button>
                          <button type="button" className="action-btn" onClick={() => applyPendingProfileImport("all-replace")}>
                            Replace All
                          </button>
                          <button type="button" className="action-btn wide" onClick={() => setPendingProfileImport(null)}>
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="api-log-list">
                      {apiCommandHistory.length === 0 ? (
                        <div className="api-log-item info">No command history yet.</div>
                      ) : (
                        apiCommandHistory
                          .slice(-20)
                          .reverse()
                          .map((entry) => (
                            <div key={entry.id} className={`api-log-item ${entry.ok ? "response" : "error"}`}>
                              <span className="api-log-meta">
                                {new Date(entry.ts).toLocaleTimeString()} · {entry.command} · {entry.source}
                              </span>
                              <span className="api-log-summary">{entry.summary}</span>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.24rem" }}>
                                <button
                                  type="button"
                                  className="mini-btn"
                                  onClick={() => {
                                    setApiInspectorCommand(entry.command);
                                    setApiInspectorPayload(entry.payloadText);
                                  }}
                                >
                                  Load
                                </button>
                                <button
                                  type="button"
                                  className="mini-btn"
                                  onClick={() =>
                                    void executeApiInspectorCommand(entry.command, entry.payloadText, {
                                      source: "replay",
                                      context: `history replay · ${entry.command}`,
                                    })
                                  }
                                >
                                  Replay
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>

                    <div className="api-log-list" aria-live="polite">
                      {apiInspectorLogs.length === 0 ? (
                        <div className="api-log-item info">No messages yet. Send a command to start tracing.</div>
                      ) : (
                        apiInspectorLogs
                          .slice()
                          .reverse()
                          .map((entry) => (
                            <div key={entry.id} className={`api-log-item ${entry.kind}`}>
                              <span className="api-log-meta">
                                {new Date(entry.ts).toLocaleTimeString()} · {entry.kind.toUpperCase()} · {entry.name}
                              </span>
                              <span className="api-log-summary">{entry.summary}</span>
                            </div>
                          ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="kbd-hints">
              {uiMode === "pro" && <div><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> Hold compare preview</div>}
              <div><kbd>Shift</kbd> + <kbd>1..9</kbd> run macro slot (prompted)</div>
              <div><kbd>Shift</kbd> + wheel on orbit: power</div>
              <div><kbd>Cmd/Ctrl</kbd> while dragging toggles snap</div>
              <div>Wheel on orbit: distance, <kbd>Esc</kbd> stops motion</div>
            </div>

            <div className="hint-rail" aria-live="polite">
              {hintText}
            </div>
          </div>
        </aside>
        ) : null}

        <div className={`capture-flash ${captureFlash ? "show" : ""}`} aria-hidden="true"></div>
        <div className="scroll-hint"></div>
      </div>
    </>
  );
};

export default HalideLanding;
