import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronUp, Copy, Pause, Pencil, Pin, Play, Plus, Save, Timer, Video, Volume2, X } from 'lucide-react';
import { useXP } from '../XP/xpStore';
import { Task } from '../XP/xpTypes';
import { ConfirmModal } from '../UI/ConfirmModal';
import { QuestCard } from '../Play/QuestCard';
import { playClickSound, playErrorSound, playSuccessSound } from '../../utils/SoundEffects';
import { useOptionalAuth } from '../../src/auth/AuthProvider';
import { useOptionalAdminConsole } from '../../src/admin/AdminConsoleProvider';
import { useOptionalLab } from '../../src/lab/LabProvider';
import { getActiveUserId } from '../../src/lib/userScopedStorage';
import {
  clearLatestDuskBrief,
  DUSK_BRIEF_EVENT,
  readLatestDuskBrief,
  type StoredDuskBrief,
} from '../../src/dusk/bridge';
import {
  type DuskLabNoteSeed,
  deriveDuskActionDeck,
} from '../../src/dusk/actionDeck';
import {
  acceptManagedProviderSession,
  appendManagedProviderSession,
  clearManagedProviderSessions,
  discardManagedProviderSession,
  diffManagedProviderRequests,
  markManagedProviderSessionPromoted,
  markManagedProviderSessionExecuted,
  reviseManagedProviderSession,
  summarizeManagedProviderRequestDiff,
} from '../../src/dusk/managedProviderSession';
import { appendDuskToolAuditEntry } from '../../src/dusk/toolAudit';
import { useDuskToolAudit } from '../../src/dusk/useDuskToolAudit';
import { useManagedProviderSessions } from '../../src/dusk/useManagedProviderSessions';
import { buildDuskProviderEnvelopeText, buildDuskProviderRequestEnvelope } from '../../src/dusk/providerEnvelope';
import { requestManagedDuskProviderRun } from '../../src/dusk/managedProvider';
import {
  buildDuskProviderRunRequest,
  buildDuskProviderRunRequestText,
  executeDuskProviderRunRequest,
  parseDuskProviderRunRequestText,
  type DuskProviderRunReport,
} from '../../src/dusk/providerRun';
import { buildDuskStationSnapshot } from '../../src/dusk/stationSnapshot';
import { getDuskProviderTools } from '../../src/dusk/providerAdapter';
import { executeDuskTool, type DuskToolRuntimeContext } from '../../src/dusk/toolRuntime';
import { encodeQuestNotesWithSteps, parseQuestNotesAndSteps, stripQuestStepsBlock } from '../../src/lib/quests/steps';
import { useOptionalPresentationEvents } from '../../src/presentation/PresentationEventsProvider';
import { openLabNavigation } from '../../src/lab/bridge';
import {
  buildBaselineCompareAlignment,
  createBaselineCompareContext,
  buildBaselineCompareRevisionNote,
  isBaselineCompareBrief,
  parseBaselineCompareBrief,
  type DuskBaselineCompareProvenance,
} from '../../src/dusk/baselineCompare';
import {
  buildBaselineProvenanceAlignment,
  buildBaselineProvenanceRevisionNote,
  createBaselineProvenanceContext,
  formatBaselineProvenanceBriefProvider,
  parseBaselineProvenanceBrief,
} from '../../src/dusk/baselineProvenanceBrief';

interface HextechAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

type QuestFilter = 'all' | 'active' | 'completed';
type FocusPriority = 'normal' | 'high' | 'urgent' | 'extreme';
type FocusStep = { id: string; text: string; done: boolean };
type FocusMode = 'default' | 'schedule' | 'media' | 'sound' | 'countdown';
type WorkspaceMode = 'create' | 'focus' | 'edit';
type CreateSeedPayload = {
  title: string;
  details: string;
  tags?: string[];
  linkedQuestIds?: string[];
  source?: StoredDuskBrief['source'];
};

const isCompletedTask = (task: Task) => !!task.completedAt || task.status === 'done';
const isHiddenTask = (task: Task) => !!task.archivedAt || task.status === 'dropped';
const createStepId = () => `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatTimer = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatPlanStamp = (value?: number | null) => {
  if (!value) return null;
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCompareProvenanceProvider = (provenance: DuskBaselineCompareProvenance | null | undefined) =>
  [provenance?.providerLabel, provenance?.model].filter(Boolean).join(' / ') || 'Unknown';

const parseQuestSteps = (details?: string) => parseQuestNotesAndSteps(details).steps;

const parseQuestStepsForEditor = (details?: string): FocusStep[] =>
  parseQuestSteps(details).map((step) => ({ ...step, id: createStepId() }));

const stripStepsFromDetails = (details?: string) => stripQuestStepsBlock(details);

const buildDetailsWithSteps = (plainDetails: string, steps: FocusStep[]) =>
  encodeQuestNotesWithSteps(
    plainDetails.trim(),
    steps.map((step) => ({ text: step.text, done: step.done }))
  );

const pad = (value: number) => String(value).padStart(2, '0');

const toLocalDateTimeValue = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

const parseLocalDateTimeValue = (value: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.getTime();
};

const roundToFiveMinutes = (timestamp: number) => {
  const date = new Date(timestamp);
  const minutes = date.getMinutes();
  const next = Math.ceil(minutes / 5) * 5;
  date.setMinutes(next, 0, 0);
  return date.getTime();
};

const formatShortTime = (timestamp?: number) => {
  if (!timestamp) return 'None';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatRelativeTime = (timestamp?: number | null) => {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(Math.abs(diff) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const formatBriefSource = (source?: StoredDuskBrief['source']) => {
  if (!source) return 'Unknown';
  return source.charAt(0).toUpperCase() + source.slice(1);
};

type FocusMediaAsset = {
  id: string;
  label: string;
  type: 'animation' | 'image' | 'video';
  src?: string;
};

const FOCUS_MEDIA_LIBRARY: FocusMediaAsset[] = [
  { id: 'focus-animation', label: 'Focus Animation', type: 'animation' },
  {
    id: 'sample-video',
    label: 'Sample Video',
    type: 'video',
    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  },
  { id: 'mission-reference', label: 'Mission Reference', type: 'image', src: '/ui-reference/mission-02.png' },
  { id: 'auth-illustration', label: 'Auth Illustration', type: 'image', src: '/ui-reference/auth/illustration-up.svg' },
  { id: 'character', label: 'Character Portrait', type: 'image', src: '/ui-reference/auth/character.svg' },
];

type FocusSoundAsset = {
  id: string;
  label: string;
  src: string;
};

const FOCUS_SOUND_LIBRARY: FocusSoundAsset[] = [
  { id: 'ambient-forest', label: 'Forest Ambience', src: 'https://cdn.pixabay.com/audio/2022/03/15/audio_ef39f7f4d8.mp3' },
  { id: 'ambient-rain', label: 'Rain Ambience', src: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8d4f0d4e1.mp3' },
  { id: 'ambient-night', label: 'Night Focus', src: 'https://cdn.pixabay.com/audio/2022/10/25/audio_902197f978.mp3' },
];

const QUEST_MEDIA_STORAGE_KEY = 'xtation.quest_media_selections.v1';
const QUEST_SOUND_STORAGE_KEY = 'xtation.quest_sound_selections.v1';
const QUEST_PRIORITY_STORAGE_KEY = 'xtation.quest_priority_selections.v1';
const QUEST_MEDIA_PINNED_STORAGE_KEY = 'xtation.quest_media_pinned.v1';

const loadSelectionMap = (storageKey: string): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
      if (!key || typeof value !== 'string') return acc;
      acc[key] = value;
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const persistSelectionMap = (storageKey: string, value: Record<string, string>) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

type SerializedMediaAsset = {
  src: string;
  type: FocusMediaAsset['type'];
  label?: string;
};

type SerializedSoundAsset = {
  src: string;
  label?: string;
};

const serializeCustomAsset = <T,>(prefix: string, payload: T) => {
  return `${prefix}${encodeURIComponent(JSON.stringify(payload))}`;
};

const parseCustomAsset = <T,>(assetId: string | null, prefix: string): T | null => {
  if (!assetId?.startsWith(prefix)) return null;
  try {
    const payload = JSON.parse(safeDecode(assetId.slice(prefix.length)));
    return payload as T;
  } catch {
    return null;
  }
};

const inferMediaTypeFromUrl = (url: string): FocusMediaAsset['type'] => {
  const normalized = url.trim();
  const lower = normalized.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'video';
  if (lower.includes('vimeo.com')) return 'video';
  if (url.startsWith('data:image/')) return 'image';
  if (url.startsWith('data:video/')) return 'video';
  if (url.startsWith('blob:')) return 'video';
  try {
    const parsed = new URL(normalized);
    const cleanPath = parsed.pathname.toLowerCase();
    if (/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(cleanPath)) return 'image';
    if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(cleanPath)) return 'video';
    if (cleanPath.includes('/video') || cleanPath.includes('/stream') || cleanPath.includes('/watch')) return 'video';
    if (cleanPath.includes('/image') || cleanPath.includes('/photo') || cleanPath.includes('/thumbnail')) return 'image';
  } catch {
    const clean = lower.split('?')[0].split('#')[0];
    if (/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(clean)) return 'image';
    if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(clean)) return 'video';
  }
  return 'video';
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('invalid-data-url'));
      }
    };
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });

const extractYouTubeVideoId = (url: string) => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace('www.', '');
    if (hostname.includes('youtu.be')) {
      return parsed.pathname.split('/').filter(Boolean)[0] || null;
    }
    if (hostname.includes('youtube.com') || hostname.includes('youtube-nocookie.com')) {
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/shorts/')[1]?.split('/')[0] || null;
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/embed/')[1]?.split('/')[0] || null;
      }
      if (parsed.pathname.startsWith('/live/')) {
        return parsed.pathname.split('/live/')[1]?.split('/')[0] || null;
      }
      return parsed.searchParams.get('v') || parsed.searchParams.get('vi');
    }
  } catch {
    return null;
  }
  return null;
};

const getYouTubeEmbedUrl = (url: string, startSeconds = 0) => {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  const start = Math.max(0, Math.floor(startSeconds));
  const end = start + 60;
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&controls=1&autoplay=1&mute=1&playsinline=1&loop=1&playlist=${videoId}&start=${start}&end=${end}`;
};

const getYouTubeThumbnailUrl = (url: string) => {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
};

const isDirectVideoSource = (src?: string | null) => {
  if (!src) return false;
  if (src.startsWith('blob:') || src.startsWith('data:video/')) return true;
  try {
    const parsed = new URL(src);
    const clean = parsed.pathname.toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v)$/i.test(clean);
  } catch {
    const clean = src.toLowerCase().split('?')[0].split('#')[0];
    return /\.(mp4|webm|ogg|mov|m4v)$/i.test(clean);
  }
};

const getFocusMediaAsset = (assetId: string | null) => {
  const serialized = parseCustomAsset<SerializedMediaAsset>(assetId, 'media-custom:');
  if (serialized?.src) {
    return {
      id: assetId!,
      label: serialized.label || 'Custom media',
      type: serialized.type || inferMediaTypeFromUrl(serialized.src),
      src: serialized.src,
    } satisfies FocusMediaAsset;
  }
  if (assetId?.startsWith('url:')) {
    const src = safeDecode(assetId.slice(4));
    return {
      id: assetId,
      label: 'Custom URL',
      type: inferMediaTypeFromUrl(src),
      src,
    } satisfies FocusMediaAsset;
  }
  return FOCUS_MEDIA_LIBRARY.find((asset) => asset.id === assetId) || FOCUS_MEDIA_LIBRARY[0];
};

const getFocusSoundAsset = (assetId: string | null) => {
  const serialized = parseCustomAsset<SerializedSoundAsset>(assetId, 'sound-custom:');
  if (serialized?.src) {
    return {
      id: assetId!,
      label: serialized.label || 'Custom sound',
      src: serialized.src,
    } satisfies FocusSoundAsset;
  }
  if (assetId?.startsWith('sound-url:')) {
    return {
      id: assetId,
      label: 'Custom Sound',
      src: safeDecode(assetId.slice('sound-url:'.length)),
    } satisfies FocusSoundAsset;
  }
  return FOCUS_SOUND_LIBRARY.find((asset) => asset.id === assetId) || null;
};

const shouldPersistAssetId = (assetId: string) => {
  const mediaCustom = parseCustomAsset<SerializedMediaAsset>(assetId, 'media-custom:');
  if (mediaCustom?.src?.startsWith('blob:')) return false;
  const soundCustom = parseCustomAsset<SerializedSoundAsset>(assetId, 'sound-custom:');
  if (soundCustom?.src?.startsWith('blob:')) return false;
  return true;
};

type ActiveSession = ReturnType<ReturnType<typeof useXP>['selectors']['getActiveSession']>;

const LeftControlStrip: React.FC<{
  workspaceMode: WorkspaceMode;
  activeMode: FocusMode;
  canConfigureAssets: boolean;
  onOpenMedia: () => void;
  onOpenSound: () => void;
}> = ({
  workspaceMode,
  activeMode,
  canConfigureAssets,
  onOpenMedia,
  onOpenSound,
}) => {
  if (!canConfigureAssets) {
    return (
      <section className="grid h-full grid-rows-[1fr_1fr] gap-2">
        <div className="h-full rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)]/40" />
        <div className="h-full rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)]/40" />
      </section>
    );
  }

  const mediaActive = activeMode === 'media';
  const soundActive = activeMode === 'sound';
  return (
    <section className="grid h-full grid-rows-[1fr_1fr] gap-2">
      <button
        type="button"
        onClick={onOpenMedia}
        disabled={!canConfigureAssets}
        title={canConfigureAssets ? (workspaceMode === 'focus' ? 'Media panel' : 'Media library') : 'Switch to Edit to change media'}
        className={`inline-flex h-full min-h-[68px] items-center justify-center rounded-[10px] border text-[var(--app-text)] transition-colors ${
          mediaActive
            ? 'border-transparent bg-[color-mix(in_srgb,var(--app-accent)_24%,var(--app-panel))]'
            : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel))] hover:bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))]'
        } ${!canConfigureAssets ? 'cursor-not-allowed opacity-55 hover:bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel))]' : ''}`}
        aria-label="Open media library"
      >
        <Video size={24} />
      </button>
      <button
        type="button"
        onClick={onOpenSound}
        disabled={!canConfigureAssets}
        title={canConfigureAssets ? (workspaceMode === 'focus' ? 'Sound panel' : 'Sound library') : 'Switch to Edit to change sound'}
        className={`inline-flex h-full min-h-[68px] items-center justify-center rounded-[10px] border text-[var(--app-text)] transition-colors ${
          soundActive
            ? 'border-transparent bg-[color-mix(in_srgb,var(--app-accent)_24%,var(--app-panel))]'
            : 'border-[var(--app-border)] bg-[var(--app-panel)] hover:bg-[var(--app-panel-2)]'
        } ${!canConfigureAssets ? 'cursor-not-allowed opacity-55 hover:bg-[var(--app-panel)]' : ''}`}
        aria-label="Open sound library"
      >
        <Volume2 size={24} />
      </button>
    </section>
  );
};

const ActiveAreaDefault: React.FC<{
  selectedAssetId: string | null;
  selectedSoundAsset: string | null;
  elapsedMs: number;
  isRunning: boolean;
  allowAudioPlayback?: boolean;
}> = ({ selectedAssetId, selectedSoundAsset, elapsedMs, isRunning, allowAudioPlayback = true }) => {
  const selectedAsset = getFocusMediaAsset(selectedAssetId);
  const selectedSound = getFocusSoundAsset(selectedSoundAsset);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioFadeRef = useRef<number | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [youtubeStart, setYoutubeStart] = useState(() => Math.max(0, Math.floor(elapsedMs / 1000)));
  const youtubeEmbedUrl = useMemo(
    () =>
      selectedAsset.type === 'video' && selectedAsset.src
        ? getYouTubeEmbedUrl(selectedAsset.src, youtubeStart)
        : null,
    [selectedAsset.type, selectedAsset.src, youtubeStart]
  );

  useEffect(() => {
    setVideoFailed(false);
    setImageFailed(false);
    setYoutubeStart(Math.max(0, Math.floor(elapsedMs / 1000)));
  }, [selectedAsset.id]);

  useEffect(() => {
    if (selectedAsset.type !== 'video' || videoFailed || youtubeEmbedUrl) return;
    const video = videoRef.current;
    if (!video) return;

    const syncVideo = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration <= 0) return;
      const loopWindow = Math.max(1, Math.min(duration, 60));
      const target = (elapsedMs / 1000) % loopWindow;
      if (Math.abs(video.currentTime - target) > 1.25) {
        video.currentTime = target;
      }
      if (isRunning) {
        void video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    syncVideo();
  }, [selectedAsset.id, selectedAsset.type, elapsedMs, isRunning, videoFailed, youtubeEmbedUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioFadeRef.current) {
      window.clearInterval(audioFadeRef.current);
      audioFadeRef.current = null;
    }
    audio.volume = 0.6;
  }, [selectedSound?.id]);

  const fadeOutAudio = (reset = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    const targetVolume = audio.volume || 0.6;
    if (audioFadeRef.current) {
      window.clearInterval(audioFadeRef.current);
    }
    audioFadeRef.current = window.setInterval(() => {
      const next = Math.max(0, audio.volume - 0.1);
      audio.volume = next;
      if (next <= 0.01) {
        audio.pause();
        if (reset) audio.currentTime = 0;
        audio.volume = targetVolume;
        if (audioFadeRef.current) {
          window.clearInterval(audioFadeRef.current);
          audioFadeRef.current = null;
        }
      }
    }, 30);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!allowAudioPlayback || !selectedSound || !isRunning) {
      fadeOutAudio(true);
      return;
    }

    if (audio.src !== selectedSound.src) {
      audio.src = selectedSound.src;
    }
    audio.loop = true;
    audio.volume = 0.6;
    void audio.play().catch(() => {});
    return () => {
      fadeOutAudio(false);
    };
  }, [selectedSound?.id, selectedSound?.src, isRunning, allowAudioPlayback]);

  useEffect(() => {
    return () => {
      fadeOutAudio(true);
      if (audioFadeRef.current) {
        window.clearInterval(audioFadeRef.current);
        audioFadeRef.current = null;
      }
    };
  }, []);

  const animationProgress = ((elapsedMs / 1000) % 120) / 120;
  const orbLeft = `${18 + animationProgress * 64}%`;

  return (
    <section className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)]">
      {selectedAsset.type === 'image' && selectedAsset.src && !imageFailed ? (
        <img
          src={selectedAsset.src}
          alt={selectedAsset.label}
          className="h-full w-full object-cover opacity-95"
          onError={() => setImageFailed(true)}
        />
      ) : null}

      {selectedAsset.type === 'video' && youtubeEmbedUrl ? (
        <iframe
          src={youtubeEmbedUrl}
          title={selectedAsset.label}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      ) : null}

      {selectedAsset.type === 'video' && selectedAsset.src && !videoFailed && !youtubeEmbedUrl ? (
        <video
          ref={videoRef}
          src={selectedAsset.src}
          muted
          loop
          playsInline
          className="h-full w-full object-cover"
          onError={() => setVideoFailed(true)}
          onLoadedMetadata={() => {
            const video = videoRef.current;
            if (!video) return;
            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            if (duration > 0) {
              const loopWindow = Math.max(1, Math.min(duration, 60));
              video.currentTime = (elapsedMs / 1000) % loopWindow;
            }
          }}
        />
      ) : null}

      {selectedAsset.type === 'animation' || (selectedAsset.type === 'video' && videoFailed && !youtubeEmbedUrl) || imageFailed ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5">
          <div className="relative h-16 w-[72%] rounded-full border border-[color-mix(in_srgb,var(--app-accent)_30%,transparent)]">
            <div className="absolute inset-x-6 top-1/2 h-10 -translate-y-1/2 rounded-full border border-[color-mix(in_srgb,var(--app-accent)_22%,transparent)]" />
            <div
              className="absolute top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_#f2f7ff_0%,_#b6c6dd_42%,_#58627b_100%)] shadow-[0_0_24px_rgba(214,232,255,0.45)] transition-all duration-700"
              style={{ left: orbLeft }}
            />
          </div>
          <div className="text-center text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
            active empty space
            <div className="mt-2 text-[9px] text-[var(--app-text)]">
              {isRunning ? 'synced with quest timer' : 'ready'}
              {selectedSound?.label ? ` • ${selectedSound.label}` : ''}
            </div>
          </div>
        </div>
      ) : null}

      <audio ref={audioRef} preload="auto" />
    </section>
  );
};

const ActiveLibraryView: React.FC<{
  kind: 'media' | 'sound';
  selectedAsset: string | null;
  onSelect: (assetId: string, closeAfterSelect?: boolean) => void;
  isPinned?: boolean;
  onTogglePinned?: () => void;
}> = ({ kind, selectedAsset, onSelect, isPinned = false, onTogglePinned }) => {
  const [customUrl, setCustomUrl] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [hoverSoundId, setHoverSoundId] = useState<string | null>(null);
  const items = kind === 'media' ? FOCUS_MEDIA_LIBRARY : FOCUS_SOUND_LIBRARY;
  const listHeightClass = 'h-[calc(100%-92px)]';

  const isValidCustomUrl = (url: string) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return true;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const stopHoverPreview = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setHoverSoundId(null);
  };

  useEffect(() => () => stopHoverPreview(), []);

  const selectedMedia = kind === 'media' ? getFocusMediaAsset(selectedAsset) : null;
  const selectedSound = kind === 'sound' ? getFocusSoundAsset(selectedAsset) : null;
  const selectedMediaEmbedUrl = useMemo(() => {
    if (kind !== 'media' || selectedMedia?.type !== 'video' || !selectedMedia.src) return null;
    return getYouTubeEmbedUrl(selectedMedia.src, 0);
  }, [kind, selectedMedia?.type, selectedMedia?.src]);
  const selectedMediaThumbnail = useMemo(() => {
    if (kind !== 'media' || selectedMedia?.type !== 'video' || !selectedMedia.src) return null;
    return getYouTubeThumbnailUrl(selectedMedia.src);
  }, [kind, selectedMedia?.type, selectedMedia?.src]);
  const selectedMediaDirectVideo = useMemo(() => {
    if (kind !== 'media' || selectedMedia?.type !== 'video') return false;
    return isDirectVideoSource(selectedMedia.src);
  }, [kind, selectedMedia?.type, selectedMedia?.src]);
  const currentSource = kind === 'media' ? selectedMedia?.src : selectedSound?.src;
  const selectedLabel = kind === 'media' ? selectedMedia?.label || 'Focus Animation' : selectedSound?.label || 'None';
  const currentSourceLabel = useMemo(() => {
    if (!currentSource) return '';
    if (currentSource.startsWith('data:')) return 'Local uploaded file';
    if (currentSource.startsWith('blob:')) return 'Local blob source';
    return currentSource;
  }, [currentSource]);

  useEffect(() => {
    if (!currentSource) {
      setCustomUrl('');
      return;
    }
    // Keep large local data/blob sources out of the input to avoid UI glitches.
    if (currentSource.startsWith('data:') || currentSource.startsWith('blob:')) {
      setCustomUrl('');
      return;
    }
    setCustomUrl((prev) => (prev === currentSource ? prev : currentSource));
  }, [currentSource]);

  const applyCustomUrl = () => {
    const url = customUrl.trim();
    if (!url) return;
    if (!isValidCustomUrl(url)) {
      setCustomError('Invalid URL. Use https://, data:, or blob:');
      return;
    }
    const nextId =
      kind === 'media'
        ? serializeCustomAsset<SerializedMediaAsset>('media-custom:', {
            src: url,
            type: inferMediaTypeFromUrl(url),
            label: 'Custom URL',
          })
        : serializeCustomAsset<SerializedSoundAsset>('sound-custom:', {
            src: url,
            label: 'Custom URL',
          });
    onSelect(nextId, false);
    setCustomError(null);
    setCustomUrl(url);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const isMediaFile = file.type.startsWith('image/') || file.type.startsWith('video/');
      const isAudioFile = file.type.startsWith('audio/');
      if ((kind === 'media' && !isMediaFile) || (kind === 'sound' && !isAudioFile)) {
        throw new Error('unsupported-file');
      }
      const src =
        kind === 'media' && file.type.startsWith('video/')
          ? URL.createObjectURL(file)
          : await readFileAsDataUrl(file);
      const nextId =
        kind === 'media'
          ? serializeCustomAsset<SerializedMediaAsset>('media-custom:', {
              src,
              type: file.type.startsWith('video/') ? 'video' : 'image',
              label: file.name || 'Uploaded file',
            })
          : serializeCustomAsset<SerializedSoundAsset>('sound-custom:', {
              src,
              label: file.name || 'Uploaded audio',
            });
      onSelect(nextId, false);
      setCustomError(null);
      setCustomUrl('');
    } catch {
      setCustomError(
        kind === 'media'
          ? 'Use an image/video file. Unsupported media type.'
          : 'Use an audio file. Unsupported sound type.'
      );
    } finally {
      setUploading(false);
      event.currentTarget.value = '';
    }
  };

  const queueHoverPreview = (sound: FocusSoundAsset) => {
    if (kind !== 'sound') return;
    stopHoverPreview();
    hoverTimerRef.current = window.setTimeout(() => {
      if (!previewAudioRef.current) {
        previewAudioRef.current = new Audio();
      }
      const audio = previewAudioRef.current;
      audio.src = sound.src;
      audio.volume = 0.55;
      audio.loop = false;
      audio.currentTime = 0;
      void audio.play().catch(() => {});
      setHoverSoundId(sound.id);
      hoverTimerRef.current = null;
    }, 1000);
  };

  return (
    <section className="min-h-0 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
          {kind === 'media' ? 'Media library' : 'Sound library'}
        </div>
        <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">Pick one</div>
      </div>
      {kind === 'media' && selectedMedia?.src ? (
        <div className="mb-2 overflow-hidden rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)]">
          <div className="relative h-[88px] w-full">
            {selectedMedia.type === 'image' ? (
              <img src={selectedMedia.src} alt={selectedMedia.label} className="h-full w-full object-cover" />
            ) : selectedMedia.type === 'video' ? (
              selectedMediaDirectVideo ? (
                <video src={selectedMedia.src} className="h-full w-full object-cover" muted autoPlay loop playsInline />
              ) : selectedMediaEmbedUrl ? (
                <iframe
                  src={selectedMediaEmbedUrl}
                  title={selectedMedia.label}
                  className="h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : selectedMediaThumbnail ? (
                <img src={selectedMediaThumbnail} alt={selectedMedia.label} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                  Video selected
                </div>
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                Focus animation
              </div>
            )}
            {onTogglePinned ? (
              <button
                type="button"
                onClick={onTogglePinned}
                className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
                  isPinned
                    ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_24%,var(--app-panel))] text-[var(--app-text)]'
                    : 'border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:text-[var(--app-text)]'
                }`}
                aria-label={isPinned ? 'Unpin media preview' : 'Pin selected media preview'}
                title={isPinned ? 'Unpin preview' : 'Pin selected media preview'}
              >
                <Pin size={13} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className={`grid ${listHeightClass} grid-cols-3 gap-2 overflow-y-auto pr-1`}>
        {items.map((item) => (
          <div key={item.id} className="relative">
            <button
              type="button"
              onClick={() => onSelect(item.id, false)}
              onPointerEnter={() => {
                if (kind === 'sound') queueHoverPreview(item as FocusSoundAsset);
              }}
              onFocus={() => {
                if (kind === 'sound') queueHoverPreview(item as FocusSoundAsset);
              }}
              onPointerLeave={stopHoverPreview}
              onBlur={stopHoverPreview}
              className={`flex min-h-[78px] w-full items-center justify-center rounded-[10px] border transition-colors ${
                selectedAsset === item.id
                  ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel-2))] text-[var(--app-text)]'
                  : 'border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                {kind === 'media' ? <Video size={18} /> : <Volume2 size={18} />}
                <span className="text-[9px] uppercase tracking-[0.1em]">{item.label}</span>
                {kind === 'sound' && hoverSoundId === item.id ? (
                  <span className="text-[8px] uppercase tracking-[0.12em] text-[var(--app-accent)]">Preview</span>
                ) : null}
              </div>
            </button>
            {kind === 'media' && selectedAsset === item.id && onTogglePinned ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePinned();
                }}
                className={`absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${
                  isPinned
                    ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_24%,var(--app-panel))] text-[var(--app-text)]'
                    : 'border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:text-[var(--app-text)]'
                }`}
                aria-label={isPinned ? 'Unpin media preview' : 'Pin media preview'}
                title={isPinned ? 'Unpin media preview' : 'Pin selected media preview'}
              >
                <Pin size={12} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={customUrl}
          onChange={(event) => {
            setCustomUrl(event.target.value);
            if (customError) setCustomError(null);
          }}
          placeholder={kind === 'media' ? 'Paste media URL' : 'Paste audio URL'}
          className="h-9 min-w-0 flex-1 rounded-md border border-[var(--app-border)] bg-[var(--app-panel-2)] px-2 text-[10px] tracking-[0.06em] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
        />
        <button
          type="button"
          onClick={applyCustomUrl}
          className="h-9 rounded-md border border-[var(--app-accent)] px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--app-text)]"
        >
          Use URL
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="h-9 rounded-md border border-[var(--app-border)] px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
        >
          {uploading ? 'Loading' : 'Upload'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={kind === 'media' ? 'image/*,video/*' : 'audio/*'}
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
      <div className="mt-2 rounded-md border border-[var(--app-border)] bg-[var(--app-panel-2)] px-2 py-1.5 text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
        <span className="mr-1 text-[var(--app-text)]">Current:</span>
        {selectedLabel}
      </div>
      {currentSource ? (
        <div className="mt-1 truncate rounded-md border border-[var(--app-border)] bg-[var(--app-panel-2)] px-2 py-1.5 text-[9px] tracking-[0.04em] text-[var(--app-muted)]">
          {currentSourceLabel}
        </div>
      ) : null}
      {customError ? <div className="mt-1 text-[10px] tracking-[0.03em] text-[#ef6f83]">{customError}</div> : null}
    </section>
  );
};

const ActiveCountdownView: React.FC<{
  countdownMin?: number;
  onChange: (nextMinutes?: number) => void;
}> = ({ countdownMin, onChange }) => {
  const totalSeconds = Math.max(0, Math.round((countdownMin || 0) * 60));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hourDragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const minuteDragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const secondDragRef = useRef<{ startY: number; startValue: number } | null>(null);

  const updatePart = (part: 'h' | 'm' | 's', value: number) => {
    const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const nextH = part === 'h' ? safe : hours;
    const nextM = part === 'm' ? Math.min(59, safe) : minutes;
    const nextS = part === 's' ? Math.min(59, safe) : seconds;
    const nextTotal = nextH * 3600 + nextM * 60 + nextS;
    onChange(nextTotal > 0 ? nextTotal / 60 : undefined);
  };

  useEffect(() => {
    const releaseDrag = () => {
      hourDragRef.current = null;
      minuteDragRef.current = null;
      secondDragRef.current = null;
    };
    window.addEventListener('pointerup', releaseDrag);
    return () => window.removeEventListener('pointerup', releaseDrag);
  }, []);

  const setPreset = (minutesPreset: number) => onChange(minutesPreset);

  const dragHandler =
    (ref: React.MutableRefObject<{ startY: number; startValue: number } | null>, part: 'h' | 'm' | 's', step = 12) =>
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!ref.current) return;
      const deltaY = ref.current.startY - event.clientY;
      const deltaStep = Math.trunc(deltaY / step);
      updatePart(part, ref.current.startValue + deltaStep);
    };

  const wheelHandler = (part: 'h' | 'm' | 's') => (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dir = event.deltaY > 0 ? -1 : 1;
    if (part === 'h') updatePart(part, hours + dir);
    if (part === 'm') updatePart(part, minutes + dir);
    if (part === 's') updatePart(part, seconds + dir);
  };

  const dialClass =
    'cursor-ns-resize rounded-md bg-[color-mix(in_srgb,var(--app-accent)_24%,var(--app-panel))] px-2 py-2 transition-colors hover:bg-[color-mix(in_srgb,var(--app-accent)_32%,var(--app-panel))]';

  return (
    <section className="min-h-0 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Countdown</div>
      <div className="grid grid-cols-3 gap-2.5 text-center">
        <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
          H
          <div
            className={`${dialClass} mt-1`}
            tabIndex={0}
            role="spinbutton"
            aria-label="Countdown hours"
            aria-valuemin={0}
            aria-valuenow={hours}
            onPointerDown={(event) => {
              hourDragRef.current = { startY: event.clientY, startValue: hours };
              (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
            }}
            onPointerMove={dragHandler(hourDragRef, 'h', 16)}
            onPointerUp={() => {
              hourDragRef.current = null;
            }}
            onWheel={wheelHandler('h')}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                updatePart('h', hours + 1);
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                updatePart('h', hours - 1);
              }
            }}
          >
            <div className="w-full select-none text-center text-[50px] font-semibold leading-[1.02] text-[var(--app-text)]">
              {pad(hours)}
            </div>
          </div>
        </div>
        <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
          M
          <div
            className={`${dialClass} mt-1`}
            tabIndex={0}
            role="spinbutton"
            aria-label="Countdown minutes"
            aria-valuemin={0}
            aria-valuemax={59}
            aria-valuenow={minutes}
            onPointerDown={(event) => {
              minuteDragRef.current = { startY: event.clientY, startValue: minutes };
              (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
            }}
            onPointerMove={dragHandler(minuteDragRef, 'm')}
            onPointerUp={() => {
              minuteDragRef.current = null;
            }}
            onWheel={wheelHandler('m')}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                updatePart('m', minutes + 1);
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                updatePart('m', minutes - 1);
              }
            }}
          >
            <div className="w-full select-none text-center text-[50px] font-semibold leading-[1.02] text-[var(--app-text)]">
              {pad(minutes)}
            </div>
          </div>
        </div>
        <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
          S
          <div
            className={`${dialClass} mt-1`}
            tabIndex={0}
            role="spinbutton"
            aria-label="Countdown seconds"
            aria-valuemin={0}
            aria-valuemax={59}
            aria-valuenow={seconds}
            onPointerDown={(event) => {
              secondDragRef.current = { startY: event.clientY, startValue: seconds };
              (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
            }}
            onPointerMove={dragHandler(secondDragRef, 's')}
            onPointerUp={() => {
              secondDragRef.current = null;
            }}
            onWheel={wheelHandler('s')}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                updatePart('s', seconds + 1);
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                updatePart('s', seconds - 1);
              }
            }}
          >
            <div className="w-full select-none text-center text-[50px] font-semibold leading-[1.02] text-[var(--app-text)]">
              {pad(seconds)}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[5, 15, 30].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setPreset(preset)}
            className="h-9 rounded-md border border-[var(--app-border)] text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
          >
            {preset}m
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange(undefined)}
        className="mt-2 h-9 w-full rounded-md border border-[var(--app-border)] text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]"
      >
        Clear
      </button>
    </section>
  );
};

const ActiveScheduleView: React.FC<{
  value: string;
  onValueChange: (value: string) => void;
  hour: number;
  minute: number;
  meridiem: 'AM' | 'PM';
  onHourInput: (next: number) => void;
  onMinuteInput: (next: number) => void;
  onMeridiemChange: (next: 'AM' | 'PM') => void;
  onNow: () => void;
  onToday: () => void;
  onClear: () => void;
  onApply: () => void;
  scheduledAt?: number;
}> = ({
  value,
  onValueChange,
  hour,
  minute,
  meridiem,
  onHourInput,
  onMinuteInput,
  onMeridiemChange,
  onNow,
  onToday,
  onClear,
  onApply,
  scheduledAt,
}) => {
  const WEEKDAY_LABELS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const hourDragRef = useRef<{ startY: number; startHour: number } | null>(null);
  const minuteDragRef = useRef<{ startY: number; startMinute: number } | null>(null);
  const hourKeyBufferRef = useRef('');
  const minuteKeyBufferRef = useRef('');
  const keyBufferTimerRef = useRef<number | null>(null);

  const handleHourWheel = (event: React.WheelEvent<HTMLElement>) => {
    event.preventDefault();
    const next = hour + (event.deltaY > 0 ? -1 : 1);
    onHourInput(next);
  };

  const handleMinuteWheel = (event: React.WheelEvent<HTMLElement>) => {
    event.preventDefault();
    const next = minute + (event.deltaY > 0 ? -1 : 1);
    onMinuteInput(next);
  };

  const now = new Date();
  const parsedValueDate = useMemo(() => {
    if (!value) return new Date();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [value]);
  const datePart = `${parsedValueDate.getFullYear()}-${pad(parsedValueDate.getMonth() + 1)}-${pad(parsedValueDate.getDate())}`;
  const selectedMonthToken = `${parsedValueDate.getFullYear()}-${parsedValueDate.getMonth()}`;
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(parsedValueDate.getFullYear(), parsedValueDate.getMonth(), 1)
  );

  useEffect(() => {
    setVisibleMonth(new Date(parsedValueDate.getFullYear(), parsedValueDate.getMonth(), 1));
  }, [selectedMonthToken]);

  const monthLabel = visibleMonth.toLocaleDateString([], { month: 'long', year: 'numeric' });
  const hour24 = meridiem === 'PM' ? (hour % 12) + 12 : hour % 12;
  const composeScheduleValue = (nextDatePart: string, nextHour24 = hour24, nextMinute = minute) => {
    if (!nextDatePart) return '';
    return `${nextDatePart}T${String(nextHour24).padStart(2, '0')}:${pad(Math.max(0, Math.min(59, nextMinute)))}`;
  };

  const firstWeekday = (new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const selectedDateKey = datePart;

  const dayCells = Array.from({ length: totalCells }, (_, index) => {
    const day = index - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) return null;
    const dateKey = `${visibleMonth.getFullYear()}-${pad(visibleMonth.getMonth() + 1)}-${pad(day)}`;
    return { day, dateKey };
  });

  const shiftMonth = (offset: number) => {
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  useEffect(() => {
    const releaseDrag = () => {
      hourDragRef.current = null;
      minuteDragRef.current = null;
    };
    window.addEventListener('pointerup', releaseDrag);
    return () => window.removeEventListener('pointerup', releaseDrag);
  }, []);

  useEffect(() => {
    return () => {
      if (keyBufferTimerRef.current) {
        window.clearTimeout(keyBufferTimerRef.current);
      }
    };
  }, []);

  const refreshKeyBufferTimer = () => {
    if (keyBufferTimerRef.current) {
      window.clearTimeout(keyBufferTimerRef.current);
    }
    keyBufferTimerRef.current = window.setTimeout(() => {
      hourKeyBufferRef.current = '';
      minuteKeyBufferRef.current = '';
      keyBufferTimerRef.current = null;
    }, 900);
  };

  const handleHourTyping = (digit: string) => {
    const nextRaw = (hourKeyBufferRef.current + digit).slice(-2);
    hourKeyBufferRef.current = nextRaw;
    const parsed = Number(nextRaw);
    if (!Number.isFinite(parsed)) return;
    if (parsed === 0) {
      onHourInput(12);
      return;
    }
    if (parsed >= 1 && parsed <= 12) {
      onHourInput(parsed);
      return;
    }
    onHourInput(Number(digit));
  };

  const handleMinuteTyping = (digit: string) => {
    const nextRaw = (minuteKeyBufferRef.current + digit).slice(-2);
    minuteKeyBufferRef.current = nextRaw;
    const parsed = Number(nextRaw);
    if (!Number.isFinite(parsed)) return;
    if (parsed <= 59) {
      onMinuteInput(parsed);
      return;
    }
    onMinuteInput(Number(digit));
  };

  const handleHourPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    hourDragRef.current = { startY: event.clientY, startHour: hour };
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
  };

  const handleMinutePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    minuteDragRef.current = { startY: event.clientY, startMinute: minute };
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
  };

  const handleHourPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!hourDragRef.current) return;
    const deltaY = hourDragRef.current.startY - event.clientY;
    const deltaStep = Math.trunc(deltaY / 16);
    onHourInput(hourDragRef.current.startHour + deltaStep);
  };

  const handleMinutePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!minuteDragRef.current) return;
    const deltaY = minuteDragRef.current.startY - event.clientY;
    const deltaStep = Math.trunc(deltaY / 12);
    onMinuteInput(minuteDragRef.current.startMinute + deltaStep);
  };

  return (
    <section
      data-testid="schedule-panel"
      className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-3"
    >
      <div className="flex items-center justify-between">
        <div className="text-[12px] uppercase tracking-[0.16em] text-[var(--app-text)]">{monthLabel}</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--app-border)] text-[11px] text-[var(--app-muted)] hover:text-[var(--app-text)]"
            aria-label="Previous month"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--app-border)] text-[11px] text-[var(--app-muted)] hover:text-[var(--app-text)]"
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>
      <div className="inline-flex h-11 items-center rounded-md border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 text-[15px] font-medium tracking-[0.05em] text-[var(--app-text)]">
        {new Date(`${datePart}T00:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
      <div className="grid min-h-0 grid-cols-7 gap-1 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-2">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[13px] uppercase tracking-[0.11em] text-[var(--app-muted)]">
            {label}
          </div>
        ))}
        {dayCells.map((cell, index) =>
          cell ? (
              <button
              key={cell.dateKey}
              type="button"
              onClick={() => onValueChange(composeScheduleValue(cell.dateKey))}
                className={`h-9 rounded-md border text-[13px] font-medium transition-colors ${
                  cell.dateKey === selectedDateKey
                    ? 'border-transparent bg-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-panel))] text-[var(--app-text)]'
                    : 'border-transparent text-[var(--app-muted)] hover:border-[var(--app-border)] hover:text-[var(--app-text)]'
                }`}
            >
              {cell.day}
            </button>
          ) : (
            <span key={`empty-${index}`} className="h-7" />
          )
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-2 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-2.5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center text-[22px] font-semibold text-[var(--app-text)]">
          <div
            className="cursor-ns-resize rounded-md bg-[color-mix(in_srgb,var(--app-accent)_24%,var(--app-panel))] px-2 py-1 transition-colors hover:bg-[color-mix(in_srgb,var(--app-accent)_32%,var(--app-panel))]"
            onPointerDown={handleHourPointerDown}
            onPointerMove={handleHourPointerMove}
            onPointerUp={() => {
              hourDragRef.current = null;
            }}
            onWheel={handleHourWheel}
            tabIndex={0}
            onKeyDown={(event) => {
              if (/^\d$/.test(event.key)) {
                event.preventDefault();
                handleHourTyping(event.key);
                refreshKeyBufferTimer();
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                onHourInput(hour + 1);
                refreshKeyBufferTimer();
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                onHourInput(hour - 1);
                refreshKeyBufferTimer();
              }
            }}
            aria-label="Hour"
            role="spinbutton"
            aria-valuemin={1}
            aria-valuemax={12}
            aria-valuenow={hour}
          >
            <div className="w-full select-none text-center text-[24px] font-semibold leading-8 text-[var(--app-text)]">
              {pad(hour)}
            </div>
          </div>
          <span className="text-[18px] text-[var(--app-muted)]">:</span>
          <div
            className="cursor-ns-resize rounded-md bg-[color-mix(in_srgb,var(--app-accent)_24%,var(--app-panel))] px-2 py-1 transition-colors hover:bg-[color-mix(in_srgb,var(--app-accent)_32%,var(--app-panel))]"
            onPointerDown={handleMinutePointerDown}
            onPointerMove={handleMinutePointerMove}
            onPointerUp={() => {
              minuteDragRef.current = null;
            }}
            onWheel={handleMinuteWheel}
            tabIndex={0}
            onKeyDown={(event) => {
              if (/^\d$/.test(event.key)) {
                event.preventDefault();
                handleMinuteTyping(event.key);
                refreshKeyBufferTimer();
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                onMinuteInput(minute + 1);
                refreshKeyBufferTimer();
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                onMinuteInput(minute - 1);
                refreshKeyBufferTimer();
              }
            }}
            aria-label="Minute"
            role="spinbutton"
            aria-valuemin={0}
            aria-valuemax={59}
            aria-valuenow={minute}
          >
            <div className="w-full select-none text-center text-[24px] font-semibold leading-8 text-[var(--app-text)]">
              {pad(minute)}
            </div>
          </div>
          <div className="col-span-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onMeridiemChange('AM')}
              className={`h-8 rounded-md border text-[10px] font-semibold uppercase tracking-[0.12em] ${
                meridiem === 'AM'
                  ? 'border-transparent bg-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-panel))] text-[var(--app-text)]'
                  : 'border-[var(--app-border)] text-[var(--app-muted)]'
              }`}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => onMeridiemChange('PM')}
              className={`h-8 rounded-md border text-[10px] font-semibold uppercase tracking-[0.12em] ${
                meridiem === 'PM'
                  ? 'border-transparent bg-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-panel))] text-[var(--app-text)]'
                  : 'border-[var(--app-border)] text-[var(--app-muted)]'
              }`}
            >
              PM
            </button>
          </div>
        </div>
        <div className="grid grid-rows-2 gap-2">
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={onNow} className="h-8 rounded-md border border-[var(--app-border)] text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
              Now
            </button>
            <button type="button" onClick={onToday} className="h-8 rounded-md border border-[var(--app-border)] text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
              Today
            </button>
            <button type="button" onClick={onClear} className="h-8 rounded-md border border-[var(--app-border)] text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
              Clear
            </button>
          </div>
          <button
            type="button"
            onClick={onApply}
            data-testid="schedule-add"
            className="h-10 rounded-md border border-transparent bg-[color-mix(in_srgb,var(--app-accent)_26%,var(--app-panel))] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)]"
          >
            Add Scheduled
          </button>
        </div>
      </div>
      <div className="text-center text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
        {scheduledAt
          ? `Scheduled ${new Date(scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : 'No schedule applied'}
      </div>
    </section>
  );
};

const PriorityStrip: React.FC<{
  disabled?: boolean;
  value: FocusPriority;
  onChange: (value: FocusPriority) => void;
}> = ({ disabled = false, value, onChange }) => {
  const priorities: Array<{ key: FocusPriority; level: number }> = [
    { key: 'extreme', level: 4 },
    { key: 'urgent', level: 3 },
    { key: 'high', level: 2 },
    { key: 'normal', level: 1 },
  ];
  const currentLevel = value === 'extreme' ? 4 : value === 'urgent' ? 3 : value === 'high' ? 2 : 1;

  return (
    <section className="grid h-full grid-rows-4 gap-1.5 overflow-hidden rounded-[12px] bg-[var(--app-panel)] p-1">
      {priorities.map((priority) => (
        <button
          key={priority.key}
          type="button"
          disabled={disabled}
          onClick={() => onChange(priority.key)}
          title={`Set ${priority.key} priority`}
          className={`flex h-full w-full items-center justify-center rounded-[10px] text-[11px] font-medium tracking-[0.03em] transition-colors ${
            currentLevel >= priority.level
              ? 'bg-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-panel))] text-[var(--app-text)]'
              : 'bg-[color-mix(in_srgb,var(--app-panel-2)_82%,transparent)] text-[var(--app-muted)] hover:bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel-2))]'
          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          <ChevronUp size={18} strokeWidth={2.2} />
        </button>
      ))}
    </section>
  );
};

type CharacterVisual = 'default' | 'schedule' | 'countdown';

const CharacterPanel: React.FC<{
  visual: CharacterVisual;
  showRuntime: boolean;
  timerLabel: string;
  isRunningSession: boolean;
  isCountdownFinished: boolean;
  onToggleRun: () => void;
  onComplete: () => void;
  onEdit: () => void;
}> = ({ visual, showRuntime, timerLabel, isRunningSession, isCountdownFinished, onToggleRun, onComplete, onEdit }) => {
  const visualConfig =
    visual === 'schedule'
      ? {
          src: '/ui-reference/auth/illustration-up.svg',
          alt: 'Schedule state illustration',
          bg: 'bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel))]',
        }
      : visual === 'countdown'
      ? {
          src: '/ui-reference/brand/eye-orb.svg',
          alt: 'Countdown state illustration',
          bg: 'bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))]',
        }
      : {
          src: '/ui-reference/auth/character.svg',
          alt: 'Default character illustration',
          bg: 'bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))]',
        };

  return (
    <section className={`flex min-h-0 flex-col rounded-[12px] border border-[var(--app-border)] p-3 ${visualConfig.bg}`}>
      {showRuntime ? (
        <div className="mb-5 flex flex-col items-center gap-4.5">
          <div className="font-mono text-[52px] font-semibold leading-none tracking-[0.07em] text-[var(--app-text)]">
            {timerLabel}
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label={isCountdownFinished ? 'Countdown finished' : isRunningSession ? 'Pause quest' : 'Start quest'}
              title={isCountdownFinished ? 'Countdown finished' : isRunningSession ? 'Pause quest' : 'Start quest'}
              onClick={onToggleRun}
              disabled={isCountdownFinished}
              className="inline-flex h-11 w-14 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-text)] transition-colors hover:border-[var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCountdownFinished ? <Check size={18} /> : isRunningSession ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              type="button"
              aria-label="Complete quest"
              title="Complete quest"
              onClick={onComplete}
              className="inline-flex h-11 w-14 items-center justify-center rounded-md border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] text-[var(--app-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-panel))]"
            >
              <Check size={18} />
            </button>
            <button
              type="button"
              aria-label="Edit quest"
              title="Edit quest"
              onClick={onEdit}
              className="inline-flex h-11 w-14 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-text)] transition-colors hover:border-[var(--app-accent)]"
            >
              <Pencil size={18} />
            </button>
          </div>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <img src={visualConfig.src} alt={visualConfig.alt} className="max-h-full w-full object-contain" />
      </div>
    </section>
  );
};

const QuestPanel: React.FC<{
  workspaceMode: WorkspaceMode;
  title: string;
  details: string;
  setTitle: (value: string) => void;
  setDetails: (value: string) => void;
  activeMode: FocusMode;
  onToggleSchedule: () => void;
  onToggleCountdown: () => void;
  stepsDone: number;
  stepsTotal: number;
  steps: FocusStep[];
  onToggleStep: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;
  onAddStep: (text: string) => void;
  scheduleChipLabel: string;
  isDirty: boolean;
  timerLabel: string;
  isRunningSession: boolean;
  isCountdownFinished: boolean;
  onToggleRun: () => void;
  onComplete: () => void;
  onEditMode: () => void;
  onBackToFocus: () => void;
  onSave: () => void;
  onCloseWorkspace: () => void;
}> = ({
  workspaceMode,
  title,
  details,
  setTitle,
  setDetails,
  activeMode,
  onToggleSchedule,
  onToggleCountdown,
  stepsDone,
  stepsTotal,
  steps,
  onToggleStep,
  onDeleteStep,
  onAddStep,
  scheduleChipLabel,
  isDirty,
  timerLabel,
  isRunningSession,
  isCountdownFinished,
  onToggleRun,
  onComplete,
  onEditMode,
  onBackToFocus,
  onSave,
  onCloseWorkspace,
}) => {
  const [stepInput, setStepInput] = useState('');
  const isFocusMode = workspaceMode === 'focus';
  const canEditDraft = workspaceMode === 'create' || workspaceMode === 'edit';
  const showChecklist = true;
  const showChecklistComposer = canEditDraft;

  const modeOptions: Array<{ key: FocusMode; label: string; icon: React.ReactNode; onClick: () => void }> = [
    { key: 'schedule', label: 'Schedule', icon: <CalendarDays size={14} />, onClick: onToggleSchedule },
    { key: 'countdown', label: 'Countdown', icon: <Timer size={14} />, onClick: onToggleCountdown },
  ];

  const submitStep = () => {
    const value = stepInput.trim();
    if (!value) return;
    onAddStep(value);
    setStepInput('');
  };

  return (
    <section className="min-h-0 w-full overflow-hidden rounded-[12px] bg-[var(--app-panel)]">
      <span className="sr-only">Quest workspace</span>
      <div className="flex h-full flex-col gap-3">
        {canEditDraft ? (
          <>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-11 w-full rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 text-[14px] font-semibold tracking-[0.03em] text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent)]"
              placeholder="Quest title"
            />

            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              className="h-24 w-full resize-none rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[12px] leading-relaxed tracking-[0.03em] text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--app-accent)]"
              placeholder="Quest notes"
            />
          </>
        ) : (
          <>
            <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[14px] font-semibold tracking-[0.03em] text-[var(--app-text)]">
              {title || 'Untitled quest'}
            </div>

            <div className="h-24 overflow-y-auto whitespace-pre-wrap rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[12px] leading-relaxed tracking-[0.03em] text-[var(--app-text)]">
              {details?.trim() || 'No details set'}
            </div>
          </>
        )}

        {canEditDraft ? (
          <div className="grid grid-cols-2 gap-1.5">
            {modeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={option.onClick}
                data-testid={option.key === 'schedule' ? 'schedule-toggle' : undefined}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border text-[9px] font-semibold uppercase tracking-[0.1em] ${
                  activeMode === option.key
                    ? 'border-transparent bg-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-panel))] text-[var(--app-text)]'
                    : 'border-[var(--app-border)] text-[var(--app-muted)]'
                }`}
                aria-label={`Open ${option.label.toLowerCase()} mode`}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        {canEditDraft ? (
          <div className="flex items-center justify-between gap-2 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-2.5 py-2 text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
            <span>{scheduleChipLabel}</span>
            {isDirty ? <span className="text-[var(--app-accent)]">Unsaved</span> : null}
          </div>
        ) : null}

        {isFocusMode ? (
          <>
            <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">Timer</div>
              <div className="font-mono text-[38px] font-semibold leading-[1.05] tracking-[0.06em] text-[var(--app-text)]">
                {timerLabel}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                aria-label={isCountdownFinished ? 'Countdown finished' : isRunningSession ? 'Pause quest' : 'Start quest'}
                title={isCountdownFinished ? 'Countdown finished' : isRunningSession ? 'Pause quest' : 'Start quest'}
                onClick={onToggleRun}
                disabled={isCountdownFinished}
                className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-text)] transition-colors hover:border-[var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCountdownFinished ? <Check size={16} /> : isRunningSession ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button
                type="button"
                aria-label="Complete quest"
                title="Complete quest"
                onClick={onComplete}
                className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] text-[var(--app-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-panel))]"
              >
                <Check size={16} />
              </button>
              <button
                type="button"
                aria-label="Edit quest"
                title="Edit quest"
                onClick={onEditMode}
                className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-text)] transition-colors hover:border-[var(--app-accent)]"
              >
                <Pencil size={16} />
              </button>
            </div>
          </>
        ) : null}

        {showChecklist ? (
          <div className="flex min-h-0 flex-1 flex-col rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2">
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
              Checklist steps ({stepsDone}/{stepsTotal || 0})
            </div>
            {showChecklistComposer ? (
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={stepInput}
                  onChange={(event) => setStepInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      submitStep();
                    }
                  }}
                  className="h-8 min-w-0 flex-1 rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-2 text-[11px] tracking-[0.03em] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                  placeholder="Add step"
                />
                <button
                  type="button"
                  onClick={submitStep}
                  aria-label="Add step"
                  className="h-8 rounded-md border border-[var(--app-border)] px-2 text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)] transition-colors hover:text-[var(--app-text)]"
                >
                  Add
                </button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
              {steps.length === 0 ? (
                <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                  {canEditDraft ? 'No checklist steps yet.' : 'No checklist steps.'}
                </div>
              ) : (
                steps.map((step) => (
                  <div
                    key={step.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onToggleStep(step.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onToggleStep(step.id);
                      }
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1 transition-all duration-150 hover:border-[color-mix(in_srgb,var(--app-accent)_35%,var(--app-border))] hover:bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel))] active:scale-[0.996]"
                  >
                    <span
                      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-150 ${
                        step.done
                          ? 'border-[color-mix(in_srgb,var(--app-text)_72%,transparent)] bg-[var(--app-text)] text-[var(--app-panel)]'
                          : 'border-[color-mix(in_srgb,var(--app-muted)_65%,transparent)] bg-[color-mix(in_srgb,var(--app-muted)_24%,var(--app-panel))] text-transparent'
                      }`}
                      aria-hidden="true"
                    >
                      <Check size={10} strokeWidth={3.1} />
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-[11px] tracking-[0.03em] ${
                        step.done ? 'text-[var(--app-muted)] line-through' : 'text-[var(--app-text)]'
                      }`}
                    >
                      {step.text}
                    </span>
                    {canEditDraft ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteStep(step.id);
                        }}
                        className="text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)] transition-colors hover:text-[var(--app-text)]"
                        aria-label="Delete step"
                      >
                        Del
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {isFocusMode ? null : (
          <div className="mt-auto grid grid-cols-3 gap-2">
            <button
              type="button"
              aria-label={workspaceMode === 'create' ? 'Cancel create quest' : 'Back to focus'}
              onClick={workspaceMode === 'create' ? onCloseWorkspace : onBackToFocus}
              className="h-10 rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)]"
            >
              {workspaceMode === 'create' ? 'Cancel' : 'Back'}
            </button>
            <button
              type="button"
              aria-label="Save"
              onClick={onSave}
              disabled={!isDirty}
              className="col-span-2 inline-flex h-10 items-center justify-center gap-1 rounded-md border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)] disabled:opacity-50"
            >
              <Save size={12} />
              Save
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

const FocusWorkspace: React.FC<{
  open: boolean;
  mode: WorkspaceMode;
  task: Task;
  runningSession: ActiveSession;
  getTaskTrackedMs: (taskId: string, now?: number) => number;
  selectedMediaAsset: string | null;
  selectedSoundAsset: string | null;
  isMediaPinned: boolean;
  onClose: () => void;
  onBackToFocus: () => void;
  onEditMode: () => void;
  initialPriorityLabel?: FocusPriority;
  onSaveDraft: (draft: {
    title: string;
    details: string;
    priority: Task['priority'];
    priorityLabel: FocusPriority;
    scheduledAt?: number;
    countdownMin?: number;
    mediaAssetId: string;
    soundAssetId: string | null;
  }) => void;
  onPersistSteps: (taskId: string, nextDetails: string) => void;
  onToggleMediaPinned: () => void;
  onToggleRun: () => void;
  onComplete: () => void;
  initialMode?: FocusMode;
}> = ({
  open,
  mode,
  task,
  runningSession,
  getTaskTrackedMs,
  selectedMediaAsset,
  selectedSoundAsset,
  isMediaPinned,
  onClose,
  onBackToFocus,
  onEditMode,
  initialPriorityLabel,
  onSaveDraft,
  onPersistSteps,
  onToggleMediaPinned,
  onToggleRun,
  onComplete,
  initialMode = 'default',
}) => {
  const [tickNow, setTickNow] = useState(() => Date.now());
  const [activeMode, setActiveMode] = useState<FocusMode>(initialMode);
  const isRunning = !!runningSession && runningSession.status === 'running';
  const isCreateMode = mode === 'create';
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDetails, setDraftDetails] = useState(stripStepsFromDetails(task.details));
  const [draftSteps, setDraftSteps] = useState<FocusStep[]>(parseQuestStepsForEditor(task.details));
  const [draftPriority, setDraftPriority] = useState<Task['priority']>(task.priority || 'normal');
  const [draftPriorityLabel, setDraftPriorityLabel] = useState<FocusPriority>(
    initialPriorityLabel || (task.priority as FocusPriority) || 'normal'
  );
  const [draftScheduledAt, setDraftScheduledAt] = useState<number | undefined>(task.scheduledAt);
  const [draftCountdownMin, setDraftCountdownMin] = useState<number | undefined>(task.countdownMin);
  const [draftScheduleValue, setDraftScheduleValue] = useState<string>(
    task.scheduledAt ? toLocalDateTimeValue(task.scheduledAt) : toLocalDateTimeValue(roundToFiveMinutes(Date.now()))
  );
  const [draftMediaAsset, setDraftMediaAsset] = useState<string>(selectedMediaAsset || 'focus-animation');
  const [draftSoundAsset, setDraftSoundAsset] = useState<string | null>(selectedSoundAsset || null);
  const [discardIntent, setDiscardIntent] = useState<'close' | 'back' | null>(null);
  const elapsedCarryRef = useRef(0);

  useEffect(() => {
    if (!open || !isRunning || !runningSession) return;
    const interval = window.setInterval(() => setTickNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [open, isRunning, runningSession]);

  useEffect(() => {
    setDraftTitle(task.title);
    setDraftDetails(stripStepsFromDetails(task.details));
    setDraftSteps(parseQuestStepsForEditor(task.details));
    setDraftPriority(task.priority || 'normal');
    setDraftPriorityLabel(initialPriorityLabel || (task.priority as FocusPriority) || 'normal');
    setDraftScheduledAt(task.scheduledAt);
    setDraftCountdownMin(task.countdownMin);
    setDraftScheduleValue(task.scheduledAt ? toLocalDateTimeValue(task.scheduledAt) : toLocalDateTimeValue(roundToFiveMinutes(Date.now())));
    setDraftMediaAsset(selectedMediaAsset || 'focus-animation');
    setDraftSoundAsset(selectedSoundAsset || null);
    setActiveMode(mode === 'create' ? initialMode : 'default');
  }, [task.id, task.title, task.details, task.priority, task.scheduledAt, mode, initialMode, initialPriorityLabel, selectedMediaAsset, selectedSoundAsset]);

  useEffect(() => {
    elapsedCarryRef.current = 0;
  }, [task.id]);

  if (!open) return null;

  const elapsed = isCreateMode ? 0 : getTaskTrackedMs(task.id, tickNow);
  if (elapsed > elapsedCarryRef.current) {
    elapsedCarryRef.current = elapsed;
  }
  const stableElapsed = Math.max(elapsed, elapsedCarryRef.current);
  const hasCountdown = typeof draftCountdownMin === 'number' && draftCountdownMin > 0;
  const countdownMs = hasCountdown ? Math.max(0, Math.round(draftCountdownMin * 60_000)) : 0;
  const isCountdownFinished = hasCountdown && stableElapsed >= countdownMs;
  const timerDisplayMs = hasCountdown
    ? Math.max(0, countdownMs - stableElapsed)
    : stableElapsed;
  const stepsDone = draftSteps.filter((step) => step.done).length;
  const scheduleDateCandidate = draftScheduleValue ? new Date(draftScheduleValue) : null;
  const scheduleDate =
    scheduleDateCandidate && !Number.isNaN(scheduleDateCandidate.getTime())
      ? scheduleDateCandidate
      : new Date(roundToFiveMinutes(Date.now()));
  const scheduleHour24 = scheduleDate.getHours();
  const meridiem = scheduleHour24 >= 12 ? 'PM' : 'AM';
  const displayHour = ((scheduleHour24 + 11) % 12) + 1;
  const displayMinute = scheduleDate.getMinutes();
  const originalDetails = stripStepsFromDetails(task.details);
  const originalSteps = parseQuestSteps(task.details);
  const initialVisualPriority = initialPriorityLabel || (task.priority as FocusPriority) || 'normal';
  const normalizedDraftSteps = draftSteps
    .map((step) => ({ text: step.text.trim(), done: !!step.done }))
    .filter((step) => !!step.text);

  const hasStepsChanged =
    originalSteps.length !== normalizedDraftSteps.length ||
    originalSteps.some((step, index) => step.text !== normalizedDraftSteps[index]?.text || step.done !== normalizedDraftSteps[index]?.done);
  const isDirty =
    draftTitle.trim() !== task.title ||
    draftDetails.trim() !== originalDetails ||
    draftPriority !== (task.priority || 'normal') ||
    draftPriorityLabel !== initialVisualPriority ||
    (draftScheduledAt || 0) !== (task.scheduledAt || 0) ||
    (draftCountdownMin || 0) !== (task.countdownMin || 0) ||
    draftMediaAsset !== (selectedMediaAsset || 'focus-animation') ||
    (draftSoundAsset || null) !== (selectedSoundAsset || null) ||
    hasStepsChanged;

  const scheduleChipLabel =
    draftScheduledAt && draftScheduledAt !== task.scheduledAt
      ? `Schedule: Draft ${formatShortTime(draftScheduledAt)}`
      : task.scheduledAt
      ? `Schedule: Applied ${formatShortTime(task.scheduledAt)}`
      : 'Schedule: None';
  const characterVisual: CharacterVisual =
    activeMode === 'countdown' || (!!draftCountdownMin && draftCountdownMin > 0)
      ? 'countdown'
      : activeMode === 'schedule' || !!draftScheduledAt
      ? 'schedule'
      : 'default';
  const saveDraft = () => {
    if (!draftTitle.trim() || mode === 'focus') return;
    onSaveDraft({
      title: draftTitle.trim(),
      details: buildDetailsWithSteps(draftDetails, draftSteps),
      priority: draftPriority,
      priorityLabel: draftPriorityLabel,
      scheduledAt: draftScheduledAt,
      countdownMin: draftCountdownMin,
      mediaAssetId: draftMediaAsset,
      soundAssetId: draftSoundAsset,
    });
  };

  const shouldGuardExit = (mode === 'create' || mode === 'edit') && isDirty;
  const performExit = (intent: 'close' | 'back') => {
    if (intent === 'close') {
      onClose();
      return;
    }
    onBackToFocus();
  };
  const requestExit = (intent: 'close' | 'back') => {
    if (shouldGuardExit) {
      setDiscardIntent(intent);
      return;
    }
    performExit(intent);
  };

  const handleNow = () => {
    setDraftScheduleValue(toLocalDateTimeValue(roundToFiveMinutes(Date.now())));
  };

  const handleToday = () => {
    const base = draftScheduleValue ? new Date(draftScheduleValue) : new Date();
    const today = new Date();
    const merged = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      base.getHours(),
      base.getMinutes(),
      0,
      0
    );
    setDraftScheduleValue(toLocalDateTimeValue(merged.getTime()));
  };

  const updateScheduleParts = (nextHour: number, nextMinute: number, nextMeridiem: 'AM' | 'PM') => {
    const base = draftScheduleValue ? new Date(draftScheduleValue) : new Date();
    const normalizedHour = nextHour % 12;
    const computedHour = nextMeridiem === 'PM' ? normalizedHour + 12 : normalizedHour;
    const next = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      computedHour % 24,
      Math.max(0, Math.min(59, nextMinute)),
      0,
      0
    );
    setDraftScheduleValue(toLocalDateTimeValue(next.getTime()));
  };

  const updateHourInput = (nextHour: number) => {
    if (!Number.isFinite(nextHour)) return;
    const normalized = ((Math.floor(nextHour) - 1 + 12) % 12) + 1;
    updateScheduleParts(normalized, displayMinute, meridiem);
  };

  const updateMinuteInput = (nextMinute: number) => {
    if (!Number.isFinite(nextMinute)) return;
    const normalized = ((Math.floor(nextMinute) % 60) + 60) % 60;
    updateScheduleParts(displayHour, normalized, meridiem);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestExit('close');
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.key !== 'Enter') return;
      event.preventDefault();
      if (mode === 'focus' || !isDirty || !draftTitle.trim()) return;
      saveDraft();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mode, isDirty, draftTitle, draftDetails, draftPriority, draftScheduledAt, draftCountdownMin, draftSteps]);

  return (
    <>
      <div
        className="absolute inset-y-3 left-3 right-[calc(clamp(320px,34vw,380px)+10px)] z-[170] max-sm:hidden"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            requestExit('close');
          }
        }}
      >
        <div className="flex h-full items-center justify-center">
          <div className="relative">
            <button
              type="button"
              aria-label="Close focus workspace"
              onClick={() => requestExit('close')}
              className="absolute -top-3 -right-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)] shadow-md hover:text-[var(--app-text)] transition-colors"
            >
              <X size={14} />
            </button>
          <div
            className={`relative grid max-h-[calc(100dvh-24px)] w-[min(1500px,calc(100vw-clamp(320px,34vw,380px)-18px))] min-w-[640px] gap-2 overflow-hidden rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_96%,black)] p-2 ${
              mode === 'focus'
                ? 'h-[clamp(460px,68vh,760px)] grid-cols-[minmax(0,2.05fr)_minmax(320px,1.08fr)_minmax(200px,0.82fr)]'
                : 'h-[clamp(420px,62vh,700px)] grid-cols-[52px_minmax(0,1.84fr)_64px_minmax(310px,1.08fr)_minmax(200px,0.82fr)]'
            }`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {mode !== 'focus' ? (
              <LeftControlStrip
                workspaceMode={mode}
                activeMode={activeMode}
                canConfigureAssets={mode !== 'focus'}
                onOpenMedia={() => {
                  if (mode === 'focus') return;
                  setActiveMode((prev) => (prev === 'media' ? 'default' : 'media'));
                }}
                onOpenSound={() => {
                  if (mode === 'focus') return;
                  setActiveMode((prev) => (prev === 'sound' ? 'default' : 'sound'));
                }}
              />
            ) : null}
            <div className="h-full min-h-0 overflow-hidden">
              {activeMode === 'default' ? (
                <ActiveAreaDefault
                  selectedAssetId={draftMediaAsset}
                  selectedSoundAsset={draftSoundAsset}
                  elapsedMs={stableElapsed}
                  isRunning={isRunning}
                  allowAudioPlayback={mode === 'focus'}
                />
              ) : null}
              {activeMode === 'schedule' ? (
                <ActiveScheduleView
                  value={draftScheduleValue}
                  onValueChange={setDraftScheduleValue}
                  hour={displayHour}
                  minute={displayMinute}
                  meridiem={meridiem}
                  onHourInput={updateHourInput}
                  onMinuteInput={updateMinuteInput}
                  onMeridiemChange={(nextMeridiem) => updateScheduleParts(displayHour, displayMinute, nextMeridiem)}
                  onNow={handleNow}
                  onToday={handleToday}
                  onClear={() => {
                    setDraftScheduledAt(undefined);
                    setDraftScheduleValue('');
                  }}
                  onApply={() => {
                    setDraftScheduledAt(parseLocalDateTimeValue(draftScheduleValue));
                    setActiveMode('default');
                  }}
                  scheduledAt={draftScheduledAt}
                />
              ) : null}
              {activeMode === 'media' ? (
                <ActiveLibraryView
                  kind="media"
                  selectedAsset={draftMediaAsset}
                  isPinned={isMediaPinned}
                  onTogglePinned={onToggleMediaPinned}
                  onSelect={(assetId, closeAfterSelect = true) => {
                    setDraftMediaAsset(assetId);
                    if (closeAfterSelect) setActiveMode('default');
                  }}
                />
              ) : null}
              {activeMode === 'sound' ? (
                <ActiveLibraryView
                  kind="sound"
                  selectedAsset={draftSoundAsset}
                  onSelect={(assetId, closeAfterSelect = true) => {
                    setDraftSoundAsset(assetId);
                    if (closeAfterSelect) setActiveMode('default');
                  }}
                />
              ) : null}
              {activeMode === 'countdown' ? (
                <ActiveCountdownView countdownMin={draftCountdownMin} onChange={setDraftCountdownMin} />
              ) : null}
            </div>
            {mode !== 'focus' ? (
              <PriorityStrip
                disabled={mode === 'focus'}
                value={draftPriorityLabel}
                onChange={(nextPriority) => {
                  setDraftPriorityLabel(nextPriority);
                  setDraftPriority(nextPriority === 'extreme' ? 'urgent' : nextPriority);
                }}
              />
            ) : null}
            <QuestPanel
          workspaceMode={mode}
          title={draftTitle}
          details={draftDetails}
          setTitle={setDraftTitle}
          setDetails={setDraftDetails}
          activeMode={activeMode}
          onToggleSchedule={() => setActiveMode((prev) => (prev === 'schedule' ? 'default' : 'schedule'))}
          onToggleCountdown={() => setActiveMode((prev) => (prev === 'countdown' ? 'default' : 'countdown'))}
          stepsDone={stepsDone}
          stepsTotal={draftSteps.length}
          steps={draftSteps}
          onToggleStep={(stepId) =>
            setDraftSteps((prev) => {
              const next = prev.map((step) => (step.id === stepId ? { ...step, done: !step.done } : step));
              if (mode === 'focus') {
                onPersistSteps(task.id, buildDetailsWithSteps(draftDetails, next));
              }
              return next;
            })
          }
          onDeleteStep={(stepId) => setDraftSteps((prev) => prev.filter((step) => step.id !== stepId))}
          onAddStep={(text) =>
            setDraftSteps((prev) => [...prev, { id: createStepId(), text: text.trim(), done: false }])
          }
          scheduleChipLabel={scheduleChipLabel}
          isDirty={isDirty}
          timerLabel={formatTimer(timerDisplayMs)}
          isRunningSession={isRunning}
          isCountdownFinished={isCountdownFinished}
          onToggleRun={onToggleRun}
          onComplete={onComplete}
          onEditMode={onEditMode}
          onBackToFocus={() => requestExit('back')}
          onSave={saveDraft}
          onCloseWorkspace={() => requestExit('close')}
            />
            <CharacterPanel
              visual={characterVisual}
              showRuntime={false}
              timerLabel={formatTimer(timerDisplayMs)}
              isRunningSession={isRunning}
              isCountdownFinished={isCountdownFinished}
              onToggleRun={onToggleRun}
              onComplete={onComplete}
              onEdit={onEditMode}
            />
          </div>
          </div>
        </div>
      </div>
      <ConfirmModal
        open={!!discardIntent}
        title="Discard changes?"
        message="You have unsaved quest setup changes. Discard them?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setDiscardIntent(null)}
        onConfirm={() => {
          if (!discardIntent) return;
          const intent = discardIntent;
          setDiscardIntent(null);
          performExit(intent);
        }}
      />
    </>
  );
};


export const HextechAssistant: React.FC<HextechAssistantProps> = ({ isOpen, onClose }) => {
  const auth = useOptionalAuth();
  const adminConsole = useOptionalAdminConsole();
  const lab = useOptionalLab();
  const user = auth?.user || null;
  const currentStation =
    adminConsole?.currentStation || {
      id: 'station:local',
      kind: 'local-station',
      label: 'Local Station',
      email: null,
      releaseChannel: 'internal',
      plan: 'trial',
      trialEndsAt: null,
      betaCohort: null,
      supportNotes: '',
      featureFlags: {},
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    };
  const platformCloudEnabled = adminConsole?.platformCloudEnabled ?? false;
  const platformSyncStatus = adminConsole?.platformSyncStatus ?? 'local_only';
  const presentationEvents = useOptionalPresentationEvents();
  const activeScope = user?.id || getActiveUserId() || 'local';
  const assistantProjects = lab?.assistantProjects || [];
  const notes = lab?.notes || [];
  const automations = lab?.automations || [];
  const mediaCampaigns = lab?.mediaCampaigns || [];
  const duskToolAudit = useDuskToolAudit();
  const managedProviderSessions = useManagedProviderSessions();
  const addLabNote = lab?.addNote;
  const updateLabNote = lab?.updateNote;
  const updateAssistantProject = lab?.updateAssistantProject;
  const {
    tasks,
    selectors,
    addTask,
    updateTask,
    startSession,
    pauseSession,
    completeTask,
  } = useXP();

  const [filter, setFilter] = useState<QuestFilter>('active');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmCompleteTaskId, setConfirmCompleteTaskId] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [createSeed, setCreateSeed] = useState(0);
  const [createSeedPayload, setCreateSeedPayload] = useState<CreateSeedPayload | null>(null);
  const [latestBrief, setLatestBrief] = useState<StoredDuskBrief | null>(null);
  const [providerRunInput, setProviderRunInput] = useState('');
  const [providerRunError, setProviderRunError] = useState<string | null>(null);
  const [providerRunReport, setProviderRunReport] = useState<DuskProviderRunReport | null>(null);
  const [managedProviderMessage, setManagedProviderMessage] = useState<string | null>(null);
  const [isManagedProviderLoading, setIsManagedProviderLoading] = useState(false);
  const [activeManagedSessionId, setActiveManagedSessionId] = useState<string | null>(null);
  const [managedRevisionNote, setManagedRevisionNote] = useState('');
  const [taskMediaSelections, setTaskMediaSelections] = useState<Record<string, string>>({});
  const [taskSoundSelections, setTaskSoundSelections] = useState<Record<string, string>>({});
  const [taskPriorityVisuals, setTaskPriorityVisuals] = useState<Record<string, string>>({});
  const [taskMediaPinned, setTaskMediaPinned] = useState<Record<string, string>>({});
  const [, setUiRevision] = useState(0);
  const [runtimeTick, setRuntimeTick] = useState(() => Date.now());
  const latestBriefEventKeyRef = useRef<string | null>(null);

  const [rendered, setRendered] = useState(isOpen);
  const [visible, setVisible] = useState(isOpen);

  const closeTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const actionLockedRef = useRef(false);
  const countdownOpenRef = useRef<string | null>(null);

  const activeSession = selectors.getActiveSession();
  const runningTaskId = activeSession?.taskId || activeSession?.linkedTaskIds?.[0] || null;

  const getTaskTrackedMs = useMemo(
    () => (taskId: string, now = Date.now()) => {
      if (typeof selectors.getTaskSessions === 'function' && typeof selectors.getSessionDisplayMs === 'function') {
        return selectors
          .getTaskSessions(taskId)
          .reduce((sum, session) => sum + selectors.getSessionDisplayMs(session, now), 0);
      }

      if (typeof selectors.getTaskTrackedMinutes === 'function') {
        return Math.max(0, selectors.getTaskTrackedMinutes(taskId)) * 60_000;
      }

      return 0;
    },
    [selectors]
  );

  const availableTasks = useMemo(() => {
    return tasks
      .filter((task) => !isHiddenTask(task))
      .sort((a, b) => {
        const aCompleted = isCompletedTask(a) ? 1 : 0;
        const bCompleted = isCompletedTask(b) ? 1 : 0;
        if (aCompleted !== bCompleted) return aCompleted - bCompleted;
        return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
      });
  }, [tasks]);

  const runningTask = useMemo(
    () => availableTasks.find((task) => task.id === runningTaskId) || null,
    [availableTasks, runningTaskId]
  );
  const nextQueuedTask = useMemo(
    () => availableTasks.find((task) => !isCompletedTask(task)) || null,
    [availableTasks]
  );
  const primaryStationTask = runningTask || nextQueuedTask;
  const leadAssistantProject = useMemo(
    () =>
      [...assistantProjects]
        .sort((a, b) => {
          const aActive = a.status === 'active' ? 1 : 0;
          const bActive = b.status === 'active' ? 1 : 0;
          if (aActive !== bActive) return bActive - aActive;
          return b.updatedAt - a.updatedAt;
        })[0] || null,
    [assistantProjects]
  );
  const pinnedLabNote = useMemo(
    () =>
      [...notes]
        .sort((a, b) => {
          const aPinned = a.pinned ? 1 : 0;
          const bPinned = b.pinned ? 1 : 0;
          if (aPinned !== bPinned) return bPinned - aPinned;
          return b.updatedAt - a.updatedAt;
        })[0] || null,
    [notes]
  );
  const leadCampaign = useMemo(
    () =>
      [...mediaCampaigns]
        .sort((a, b) => {
          const aActive = a.status === 'active' ? 1 : 0;
          const bActive = b.status === 'active' ? 1 : 0;
          if (aActive !== bActive) return bActive - aActive;
          return b.updatedAt - a.updatedAt;
        })[0] || null,
    [mediaCampaigns]
  );
  const enabledAutomationCount = useMemo(
    () => automations.filter((automation) => automation.enabled).length,
    [automations]
  );
  const stationSnapshot = useMemo(
    () =>
      buildDuskStationSnapshot({
        signedIn: !!user?.id,
        userLabel: user?.email || user?.name || 'Local operator',
        stationLabel: currentStation.label,
        plan: currentStation.plan,
        releaseChannel: currentStation.releaseChannel,
        platformCloudEnabled,
        platformSyncStatus,
        primaryTaskId: primaryStationTask?.id || null,
        primaryTaskTitle: primaryStationTask?.title || null,
        primaryTaskPriority: primaryStationTask?.priority || null,
        primaryTaskRunning: !!runningTask && primaryStationTask?.id === runningTask.id,
        openQuestCount: availableTasks.filter((task) => !isCompletedTask(task)).length,
        enabledAutomationCount,
        leadProjectTitle: leadAssistantProject?.title || null,
        leadProjectNextAction: leadAssistantProject?.nextAction || null,
        pinnedNoteTitle: pinnedLabNote?.title || null,
        activeCampaignTitle: leadCampaign?.title || null,
      }),
    [
      user?.id,
      user?.email,
      user?.name,
      currentStation.label,
      currentStation.plan,
      currentStation.releaseChannel,
      platformCloudEnabled,
      platformSyncStatus,
      primaryStationTask?.id,
      primaryStationTask?.title,
      primaryStationTask?.priority,
      runningTask?.id,
      availableTasks,
      enabledAutomationCount,
      leadAssistantProject?.title,
      leadAssistantProject?.nextAction,
      pinnedLabNote?.title,
      leadCampaign?.title,
    ]
  );
  const duskActionDeck = useMemo(
    () =>
      deriveDuskActionDeck({
        snapshot: stationSnapshot,
        hasLab: !!addLabNote,
        primaryTaskRunning: !!runningTask && primaryStationTask?.id === runningTask.id,
        leadProjectId: leadAssistantProject?.id || null,
        leadProjectTitle: leadAssistantProject?.title || null,
        leadProjectNextAction: leadAssistantProject?.nextAction || null,
        latestBrief,
      }),
    [
      stationSnapshot,
      addLabNote,
      runningTask,
      primaryStationTask?.id,
      leadAssistantProject?.id,
      leadAssistantProject?.title,
      leadAssistantProject?.nextAction,
      latestBrief,
    ]
  );
  const duskProviderTools = useMemo(() => getDuskProviderTools(duskActionDeck), [duskActionDeck]);
  const providerEnvelope = useMemo(
    () =>
      buildDuskProviderRequestEnvelope({
        snapshot: stationSnapshot,
        latestBrief,
        actionDeck: duskActionDeck,
        tools: duskProviderTools,
        auditTail: duskToolAudit,
      }),
    [stationSnapshot, latestBrief, duskActionDeck, duskProviderTools, duskToolAudit]
  );
  const providerEnvelopeText = useMemo(
    () => buildDuskProviderEnvelopeText(providerEnvelope),
    [providerEnvelope]
  );
  const providerRunSampleText = useMemo(() => {
    if (!duskProviderTools.length) return '';
    return buildDuskProviderRunRequestText(
      buildDuskProviderRunRequest(
        duskProviderTools.slice(0, 2).map((tool) => tool.name),
        {
          requestedBy: 'provider-simulator',
          stopOnBlocked: true,
        }
      )
    );
  }, [duskProviderTools]);
  const activeManagedSession = useMemo(
    () => managedProviderSessions.find((session) => session.id === activeManagedSessionId) || null,
    [activeManagedSessionId, managedProviderSessions]
  );
  const activeManagedSessionText = useMemo(
    () => (activeManagedSession ? buildDuskProviderRunRequestText(activeManagedSession.request) : ''),
    [activeManagedSession]
  );
  const parsedCurrentManagedDraft = useMemo(
    () => (activeManagedSession ? parseDuskProviderRunRequestText(providerRunInput) : null),
    [activeManagedSession, providerRunInput]
  );
  const currentManagedDraftRequest = parsedCurrentManagedDraft?.ok ? parsedCurrentManagedDraft.request : undefined;
  const currentManagedDraftDiffFromLoaded = useMemo(
    () =>
      activeManagedSession && currentManagedDraftRequest
        ? diffManagedProviderRequests(currentManagedDraftRequest, activeManagedSession.request)
        : null,
    [activeManagedSession, currentManagedDraftRequest]
  );
  const activeManagedSessionAcceptedDiff = useMemo(
    () =>
      activeManagedSession
        ? diffManagedProviderRequests(activeManagedSession.request, activeManagedSession.acceptedRequest)
        : null,
    [activeManagedSession]
  );
  const currentManagedDraftDiffFromAccepted = useMemo(
    () =>
      activeManagedSession && currentManagedDraftRequest
        ? diffManagedProviderRequests(currentManagedDraftRequest, activeManagedSession.acceptedRequest)
        : null,
    [activeManagedSession, currentManagedDraftRequest]
  );
  const providerInputDirtyForSession =
    !!activeManagedSession && providerRunInput.trim() !== activeManagedSessionText.trim();
  const managedRevisionNoteDirty =
    !!activeManagedSession && managedRevisionNote.trim() !== (activeManagedSession.latestRevisionNote || '');
  const activeManagedSessionNeedsAcceptance =
    !!activeManagedSession && (activeManagedSession.status === 'planned' || activeManagedSession.status === 'revised');
  const latestBaselineCompare = useMemo(() => parseBaselineCompareBrief(latestBrief), [latestBrief]);
  const latestBaselineProvenance = useMemo(() => parseBaselineProvenanceBrief(latestBrief), [latestBrief]);
  const getManagedSessionAcceptedBaselineTitle = (session: (typeof managedProviderSessions)[number] | null | undefined) =>
    session?.promotedNoteTitle || (session?.acceptedRequest ? `Dusk baseline · ${session.envelopeHeadline}` : null);
  const latestBaselineCompareAlignment = useMemo(
    () =>
      buildBaselineCompareAlignment(latestBaselineCompare, {
        acceptedBaselineTitle: getManagedSessionAcceptedBaselineTitle(activeManagedSession),
        acceptedNextAction: activeManagedSession?.acceptedNextAction || null,
      }),
    [activeManagedSession, latestBaselineCompare]
  );
  const latestBaselineProvenanceAlignment = useMemo(
    () =>
      buildBaselineProvenanceAlignment(latestBaselineProvenance, {
        acceptedBaselineTitle: getManagedSessionAcceptedBaselineTitle(activeManagedSession),
        acceptedNextAction: activeManagedSession?.acceptedNextAction || null,
      }),
    [activeManagedSession, latestBaselineProvenance]
  );
  const activeManagedPlanningRecommendation = useMemo(() => {
    if (!activeManagedSession) return null;
    if (!activeManagedSession.acceptedRequest) {
      return latestBaselineCompare
        ? 'Accept the current plan before treating the baseline compare as an authoritative revision anchor.'
        : latestBaselineProvenance
          ? 'Accept the current plan before using the accepted baseline provenance as a revision anchor.'
        : 'Review the draft, then accept it when it becomes the next station baseline.';
    }
    if (latestBaselineCompareAlignment?.status === 'aligned') {
      return currentManagedDraftDiffFromAccepted?.changed
        ? 'The compare brief matches the accepted baseline. Revise the draft against it, then save or re-accept.'
        : 'The draft still matches the accepted baseline. Use the compare brief only if you intend to change direction.';
    }
    if (latestBaselineCompareAlignment?.status === 'previous') {
      return 'The compare brief is one baseline behind the accepted plan. Review drift before replacing the current revision note.';
    }
    if (latestBaselineCompareAlignment?.status === 'mismatch') {
      return 'The compare brief points to a different baseline. Load the accepted plan or review Lab history before saving changes.';
    }
    if (latestBaselineProvenance) {
      if (latestBaselineProvenanceAlignment?.status === 'aligned') {
        return currentManagedDraftDiffFromAccepted?.changed
          ? 'The accepted baseline provenance is aligned with the accepted plan. Review the current draft drift before re-accepting it.'
          : 'The accepted baseline provenance matches the current plan context. Use it to confirm provider, next action, and compare anchor before executing.';
      }
      if (latestBaselineProvenanceAlignment?.status === 'action-drift') {
        return 'The accepted baseline matches, but the stored next action has drifted. Review the next action before replacing the revision note or executing.';
      }
      if (latestBaselineProvenanceAlignment?.status === 'mismatch') {
        return 'The accepted baseline provenance points to a different baseline. Load the accepted plan or review Lab history before using it as a decision anchor.';
      }
      return currentManagedDraftDiffFromAccepted?.changed
        ? 'The current draft differs from the accepted plan. Use the accepted baseline provenance to confirm the next action before re-accepting it.'
        : 'The accepted baseline provenance is available as a decision anchor for this plan.';
    }
    return currentManagedDraftDiffFromAccepted?.changed
      ? 'The current draft differs from the accepted baseline. Review the drift before executing it.'
      : 'The current draft matches the accepted baseline.';
  }, [
    activeManagedSession,
    currentManagedDraftDiffFromAccepted,
    latestBaselineCompare,
    latestBaselineCompareAlignment,
    latestBaselineProvenance,
    latestBaselineProvenanceAlignment,
  ]);

  useEffect(() => {
    if (!activeManagedSessionId) return;
    if (managedProviderSessions.some((session) => session.id === activeManagedSessionId)) return;
    setActiveManagedSessionId(null);
  }, [activeManagedSessionId, managedProviderSessions]);

  useEffect(() => {
    if (!activeManagedSession) {
      setManagedRevisionNote('');
      return;
    }
    setManagedRevisionNote(activeManagedSession.latestRevisionNote || '');
  }, [activeManagedSession]);

  useEffect(() => {
    if (!runningTaskId) return;
    const timer = window.setInterval(() => setRuntimeTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [runningTaskId]);

  const focusedTask = useMemo(
    () => (focusedTaskId ? availableTasks.find((task) => task.id === focusedTaskId) || null : null),
    [availableTasks, focusedTaskId]
  );

  const focusedTaskSession = useMemo(() => {
    if (!focusedTask || !activeSession) return null;
    const isFocusedRunning =
      activeSession.status === 'running' &&
      (activeSession.taskId === focusedTask.id || (activeSession.linkedTaskIds || []).includes(focusedTask.id));
    return isFocusedRunning ? activeSession : null;
  }, [activeSession, focusedTask]);

  useEffect(() => {
    if (!runningTask || !runningTask.countdownMin || runningTask.countdownMin <= 0) {
      countdownOpenRef.current = null;
      return;
    }
    const targetMs = runningTask.countdownMin * 60_000;
    const elapsedMs = getTaskTrackedMs(runningTask.id, runtimeTick);
    if (elapsedMs < targetMs) {
      if (countdownOpenRef.current === runningTask.id) countdownOpenRef.current = null;
      return;
    }
    if (countdownOpenRef.current === runningTask.id) return;
    countdownOpenRef.current = runningTask.id;
    setFocusedTaskId(runningTask.id);
    setWorkspaceMode('focus');
    pushToast(`Countdown finished: ${runningTask.title}`);
  }, [runningTask?.id, runningTask?.countdownMin, runtimeTick, getTaskTrackedMs]);

  useEffect(() => {
    if (!focusedTaskId || workspaceMode === 'create') return;
    if (!focusedTask) {
      setWorkspaceMode(null);
      setFocusedTaskId(null);
    }
  }, [focusedTaskId, focusedTask, workspaceMode]);

  const filteredTasks = useMemo(() => {
    const byFilter = availableTasks.filter((task) => {
      if (filter === 'active') return !isCompletedTask(task);
      if (filter === 'completed') return isCompletedTask(task);
      return true;
    });

    if (!runningTaskId) return byFilter;
    return byFilter.filter((task) => task.id !== runningTaskId);
  }, [availableTasks, filter, runningTaskId]);

  const getTaskPreview = (taskId: string) => {
    const asset = getFocusMediaAsset(taskMediaSelections[taskId] || 'focus-animation');
    if (asset.type === 'video' && asset.src) {
      const ytThumb = getYouTubeThumbnailUrl(asset.src);
      if (ytThumb) {
        return {
          url: ytThumb,
          type: 'image' as const,
        };
      }
    }
    return {
      url: asset.src || null,
      type: asset.type,
    };
  };

  useEffect(() => {
    setTaskMediaSelections(loadSelectionMap(QUEST_MEDIA_STORAGE_KEY));
    setTaskSoundSelections(loadSelectionMap(QUEST_SOUND_STORAGE_KEY));
    setTaskPriorityVisuals(loadSelectionMap(QUEST_PRIORITY_STORAGE_KEY));
    setTaskMediaPinned(loadSelectionMap(QUEST_MEDIA_PINNED_STORAGE_KEY));
  }, []);

  useEffect(() => {
    const serializable = Object.entries(taskMediaSelections).reduce<Record<string, string>>((acc, [taskId, assetId]) => {
      if (!assetId || !shouldPersistAssetId(assetId)) return acc;
      acc[taskId] = assetId;
      return acc;
    }, {});
    persistSelectionMap(QUEST_MEDIA_STORAGE_KEY, serializable);
  }, [taskMediaSelections]);

  useEffect(() => {
    const serializable = Object.entries(taskSoundSelections).reduce<Record<string, string>>((acc, [taskId, assetId]) => {
      if (!assetId || !shouldPersistAssetId(assetId)) return acc;
      acc[taskId] = assetId;
      return acc;
    }, {});
    persistSelectionMap(QUEST_SOUND_STORAGE_KEY, serializable);
  }, [taskSoundSelections]);

  useEffect(() => {
    persistSelectionMap(QUEST_PRIORITY_STORAGE_KEY, taskPriorityVisuals);
  }, [taskPriorityVisuals]);

  useEffect(() => {
    persistSelectionMap(QUEST_MEDIA_PINNED_STORAGE_KEY, taskMediaPinned);
  }, [taskMediaPinned]);

  useEffect(() => {
    loadLatestBrief();
    const handleBrief = () => loadLatestBrief();
    window.addEventListener(DUSK_BRIEF_EVENT, handleBrief as EventListener);
    return () => window.removeEventListener(DUSK_BRIEF_EVENT, handleBrief as EventListener);
  }, []);

  useEffect(() => {
    const eventKey = latestBrief ? `${latestBrief.id}:${latestBrief.receivedAt}` : null;
    if (!eventKey) {
      latestBriefEventKeyRef.current = null;
      return;
    }
    if (latestBriefEventKeyRef.current === eventKey) return;
    latestBriefEventKeyRef.current = eventKey;
    presentationEvents?.emitEvent('dusk.brief.loaded', {
      source: 'dusk',
      metadata: {
        briefId: latestBrief.id,
        source: latestBrief.source,
        linkedQuestIds: latestBrief.linkedQuestIds || [],
        tagCount: latestBrief.tags?.length || 0,
      },
    });
  }, [latestBrief, presentationEvents]);

  useEffect(() => {
    if (isOpen) {
      setFilter('active');
      loadLatestBrief();
      setRendered(true);
      window.requestAnimationFrame(() => setVisible(true));
      return;
    }

    setVisible(false);
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setRendered(false);
      closeTimerRef.current = null;
    }, 210);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!rendered) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (workspaceMode === 'edit' || workspaceMode === 'create' || confirmCompleteTaskId) return;
      event.preventDefault();
      requestClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [rendered, workspaceMode, confirmCompleteTaskId]);

  const runGuarded = (fn: () => void) => {
    if (actionLockedRef.current) return;
    actionLockedRef.current = true;
    try {
      fn();
    } finally {
      window.setTimeout(() => {
        actionLockedRef.current = false;
      }, 60);
    }
  };

  const bumpUiRevision = () => {
    setUiRevision((value) => value + 1);
  };

  const pushToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2200);
  };

  const requestClose = () => {
    playClickSound();
    setWorkspaceMode(null);
    setConfirmCompleteTaskId(null);
    setFocusedTaskId(null);
    onClose();
  };

  const openCreateWorkspace = () => {
    playClickSound();
    setFocusedTaskId(null);
    setCreateSeedPayload(null);
    setCreateSeed((prev) => prev + 1);
    setWorkspaceMode('create');
  };

  const loadLatestBrief = () => {
    setLatestBrief(readLatestDuskBrief(getActiveUserId() || 'local'));
  };

  const clearLatestBrief = () => {
    clearLatestDuskBrief(getActiveUserId() || 'local');
    setLatestBrief(null);
    pushToast('Dusk brief cleared');
  };

  const useLatestBrief = () => {
    if (!latestBrief) return;
    playClickSound();
    setFocusedTaskId(null);
    setCreateSeedPayload({
      title: latestBrief.title,
      details: latestBrief.body,
      tags: Array.from(new Set(['dusk', latestBrief.source, ...(latestBrief.tags || [])])),
      linkedQuestIds: latestBrief.linkedQuestIds,
      source: latestBrief.source,
    });
    setCreateSeed((prev) => prev + 1);
    setWorkspaceMode('create');
    pushToast('Brief loaded into quest draft');
  };

  const useLatestBaselineCompareInPlan = () => {
    if (!latestBaselineCompare) return;
    if (!activeManagedSession) {
      setManagedProviderMessage('Open a planning session first, then load the baseline compare into the revision note.');
      pushToast('No active planning session');
      return;
    }

    const revisionNote = buildBaselineCompareRevisionNote(latestBaselineCompare);
    setManagedRevisionNote((current) => {
      const trimmedCurrent = current.trim();
      if (!trimmedCurrent) return revisionNote;
      if (trimmedCurrent.includes(revisionNote)) return current;
      return `${trimmedCurrent}\n\n${revisionNote}`;
    });
    setManagedProviderMessage('Baseline compare loaded into the active revision note.');
    pushToast('Baseline compare loaded');
    playClickSound();
  };

  const useLatestBaselineProvenanceInPlan = () => {
    if (!latestBaselineProvenance) return;
    if (!activeManagedSession) {
      setManagedProviderMessage('Open a planning session first, then load the baseline provenance into the revision note.');
      pushToast('No active planning session');
      return;
    }

    const revisionNote = buildBaselineProvenanceRevisionNote(latestBaselineProvenance);
    setManagedRevisionNote((current) => {
      const trimmedCurrent = current.trim();
      if (!trimmedCurrent) return revisionNote;
      if (trimmedCurrent.includes(revisionNote)) return current;
      return `${trimmedCurrent}\n\n${revisionNote}`;
    });
    setManagedProviderMessage('Accepted baseline provenance loaded into the active revision note.');
    pushToast('Baseline provenance loaded');
    playClickSound();
  };

  const replaceLatestBaselineProvenanceInPlan = () => {
    if (!latestBaselineProvenance) return;
    if (!activeManagedSession) {
      setManagedProviderMessage('Open a planning session first, then replace the revision note with the accepted baseline provenance.');
      pushToast('No active planning session');
      return;
    }

    setManagedRevisionNote(buildBaselineProvenanceRevisionNote(latestBaselineProvenance));
    setManagedProviderMessage('Revision note replaced with the accepted baseline provenance summary.');
    pushToast('Revision note replaced');
    playClickSound();
  };

  const replaceLatestBaselineCompareInPlan = () => {
    if (!latestBaselineCompare) return;
    if (!activeManagedSession) {
      setManagedProviderMessage('Open a planning session first, then replace the revision note with the baseline compare.');
      pushToast('No active planning session');
      return;
    }

    setManagedRevisionNote(buildBaselineCompareRevisionNote(latestBaselineCompare));
    setManagedProviderMessage('Revision note replaced with the latest baseline compare summary.');
    pushToast('Revision note replaced');
    playClickSound();
  };

  const useStationSnapshot = () => {
    playClickSound();
    setFocusedTaskId(null);
    setCreateSeedPayload({
      title: stationSnapshot.suggestedTitle,
      details: stationSnapshot.suggestedBody,
      tags: stationSnapshot.tags,
      linkedQuestIds: stationSnapshot.primaryTaskId ? [stationSnapshot.primaryTaskId] : [],
    });
    setCreateSeed((prev) => prev + 1);
    setWorkspaceMode('create');
    pushToast('Station snapshot loaded into quest draft');
  };

  const createQuestDirect = (seed: CreateSeedPayload, options?: { priority?: Task['priority']; onCreated?: (taskId: string) => void }) => {
    const title = seed.title.trim();
    if (!title) {
      return null;
    }

    let createdId: string | null = null;
    runGuarded(() => {
      createdId = addTask({
        title,
        details: seed.details.trim(),
        priority: options?.priority || 'high',
        status: 'todo',
        icon: 'zap',
        tags: seed.tags,
      });
      if (!createdId) return;
      setFocusedTaskId(createdId);
      setWorkspaceMode('focus');
      setTaskPriorityVisuals((prev) => ({ ...prev, [createdId!]: options?.priority === 'urgent' ? 'urgent' : 'high' }));
      options?.onCreated?.(createdId);
    });
    return createdId;
  };

  const captureNote = (payload: DuskLabNoteSeed) => {
    if (!addLabNote) return null;
    return addLabNote({
      title: payload.title,
      content: payload.content,
      tags: payload.tags,
      linkedQuestIds: payload.linkedQuestIds,
      linkedProjectIds: payload.linkedProjectIds,
      kind: 'brief',
      status: 'active',
      pinned: payload.pinned,
    });
  };

  const buildManagedPlanNoteContent = (session: NonNullable<typeof activeManagedSession>) => {
    const lines = [
      `Accepted Dusk plan baseline`,
      ``,
      `Provider · ${session.providerLabel} / ${session.model}`,
      `Accepted · ${formatPlanStamp(session.acceptedAt) || 'Not accepted yet'}`,
      `Next action · ${session.acceptedNextAction || session.nextAction}`,
      session.latestRevisionNote ? `Revision note · ${session.latestRevisionNote}` : null,
      session.acceptedBaselineCompareContext?.currentTitle
        ? `Accepted compare current: ${session.acceptedBaselineCompareContext.currentTitle}`
        : null,
      session.acceptedBaselineCompareContext?.previousTitle
        ? `Accepted compare previous: ${session.acceptedBaselineCompareContext.previousTitle}`
        : null,
      session.acceptedBaselineCompareContext?.driftSummary
        ? `Accepted compare drift: ${session.acceptedBaselineCompareContext.driftSummary}`
        : null,
      session.acceptedBaselineCompareContext?.loadedAt
        ? `Accepted compare loadedAt: ${session.acceptedBaselineCompareContext.loadedAt}`
        : null,
      session.outputText ? `Provider note · ${session.outputText}` : null,
      session.linkedProjectId ? `Linked project · ${session.linkedProjectId}` : null,
      session.linkedQuestIds?.length ? `Linked quests · ${session.linkedQuestIds.join(', ')}` : null,
      ``,
      `Requested tools`,
      ...((session.acceptedRequest || session.request).tools.map((tool, index) =>
        `${index + 1}. ${tool.name}${tool.reason ? ` — ${tool.reason}` : ''}`
      )),
      ``,
      `Accepted request JSON`,
      '```json',
      JSON.stringify(session.acceptedRequest || session.request, null, 2),
      '```',
    ].filter(Boolean);

    return lines.join('\n');
  };

  const openKnownQuest = (taskId: string) => {
    const taskExists = availableTasks.some((task) => task.id === taskId);
    if (!taskExists) {
      return false;
    }
    openFocusPanel(taskId);
    return true;
  };

  const linkProjectQuest = (projectId: string, taskId: string) => {
    const project = assistantProjects.find((entry) => entry.id === projectId);
    if (!project || !updateAssistantProject) return;
    updateAssistantProject(project.id, {
      linkedQuestIds: Array.from(new Set([...(project.linkedQuestIds || []), taskId])),
    });
  };

  const linkProjectNote = (projectId: string, noteId: string) => {
    const project = assistantProjects.find((entry) => entry.id === projectId);
    if (!project || !updateAssistantProject) return;
    updateAssistantProject(project.id, {
      linkedNoteIds: Array.from(new Set([...(project.linkedNoteIds || []), noteId])),
    });
  };

  const promoteAcceptedManagedPlanToLab = (session: NonNullable<typeof activeManagedSession>) => {
    if (!session.acceptedRequest) {
      playErrorSound();
      pushToast('Accept the plan before promoting it to Lab');
      return;
    }
    if (!addLabNote) {
      playErrorSound();
      pushToast('Lab is not available for plan promotion');
      return;
    }

    const noteTitle = `Dusk baseline · ${session.envelopeHeadline}`;
    const notePayload = {
      title: noteTitle,
      content: buildManagedPlanNoteContent(session),
      kind: 'plan' as const,
      status: 'active' as const,
      pinned: true,
      tags: Array.from(
        new Set([
          'dusk',
          'baseline',
          'dusk-baseline',
          'managed-provider',
          session.model.toLowerCase(),
          session.status,
        ])
      ),
      linkedQuestIds: session.linkedQuestIds || [],
      linkedProjectIds: session.linkedProjectId ? [session.linkedProjectId] : [],
    };

    const noteId = session.promotedNoteId && updateLabNote
      ? (updateLabNote(session.promotedNoteId, notePayload), session.promotedNoteId)
      : addLabNote(notePayload);

    if (session.linkedProjectId) {
      linkProjectNote(session.linkedProjectId, noteId);
    }
    markManagedProviderSessionPromoted(session.id, noteId, noteTitle, activeScope);
    setManagedProviderMessage('Accepted plan promoted to Lab as a pinned baseline note.');
    playSuccessSound();
    pushToast(session.promotedNoteId ? 'Lab baseline note refreshed' : 'Accepted plan promoted to Lab');
  };

  const buildRuntimeContext = (): DuskToolRuntimeContext => ({
    snapshot: stationSnapshot,
    latestBrief,
    leadProject: leadAssistantProject
      ? {
          id: leadAssistantProject.id,
          title: leadAssistantProject.title,
          nextAction: leadAssistantProject.nextAction,
        }
      : null,
    availableTaskIds: availableTasks.map((task) => task.id),
    createQuest: (seed, options) =>
      createQuestDirect(
        {
          title: seed.title,
          details: seed.details,
          tags: seed.tags,
        },
        {
          priority: options?.priority || 'high',
        }
      ),
    openQuest: (taskId) => openKnownQuest(taskId),
    saveNote: captureNote,
    linkProjectQuest,
  });

  const handleDuskAction = (actionId: ReturnType<typeof deriveDuskActionDeck>[number]['id']) => {
    const result = executeDuskTool(actionId, buildRuntimeContext());
    appendDuskToolAuditEntry(actionId, 'relay', result, activeScope);

    if (result.status === 'blocked') {
      playErrorSound();
      pushToast(result.message);
      return;
    }

    playSuccessSound();
    pushToast(result.message);
  };

  const loadProviderRunSample = () => {
    if (!providerRunSampleText) {
      playErrorSound();
      pushToast('No provider tools are ready yet');
      return;
    }
    playClickSound();
    setProviderRunInput(providerRunSampleText);
    setProviderRunError(null);
    setManagedProviderMessage(null);
    pushToast('Provider run sample loaded');
  };

  const clearProviderRun = () => {
    playClickSound();
    setProviderRunInput('');
    setProviderRunError(null);
    setProviderRunReport(null);
    setManagedProviderMessage(null);
    setActiveManagedSessionId(null);
    setManagedRevisionNote('');
  };

  const reviseActiveManagedPlan = () => {
    if (!activeManagedSession) {
      playErrorSound();
      pushToast('No managed plan is loaded');
      return false;
    }

    const parsed = parseDuskProviderRunRequestText(providerRunInput);
    if (!parsed.ok || !parsed.request) {
      setProviderRunError(parsed.message || 'Provider request is invalid');
      playErrorSound();
      pushToast(parsed.message || 'Provider request is invalid');
      return false;
    }

    reviseManagedProviderSession(
      activeManagedSession.id,
      {
        request: parsed.request,
        nextAction: activeManagedSession.nextAction,
        revisionNote: managedRevisionNote,
        baselineCompareContext: createBaselineCompareContext(latestBaselineCompare),
        baselineProvenanceContext: createBaselineProvenanceContext(latestBaselineProvenance),
      },
      activeScope
    );
    setProviderRunError(null);
    setProviderRunReport(null);
    setManagedProviderMessage('Plan revision saved. Review and accept before running it.');
    playClickSound();
    pushToast('Managed plan revised');
    return parsed.request;
  };

  const acceptActiveManagedPlan = () => {
    if (!activeManagedSession) {
      playErrorSound();
      pushToast('No managed plan is loaded');
      return;
    }

    if (providerInputDirtyForSession || managedRevisionNoteDirty) {
      const revisedRequest = reviseActiveManagedPlan();
      if (!revisedRequest) return;
    }

    acceptManagedProviderSession(
      activeManagedSession.id,
      activeScope,
      createBaselineCompareContext(latestBaselineCompare),
      createBaselineProvenanceContext(latestBaselineProvenance)
    );
    setProviderRunError(null);
    setManagedProviderMessage('Plan accepted. Run the provider request when you want Dusk to execute it.');
    playSuccessSound();
    pushToast('Managed plan accepted');
  };

  const discardActiveManagedPlan = () => {
    if (!activeManagedSession) {
      playErrorSound();
      pushToast('No managed plan is loaded');
      return;
    }
    discardManagedProviderSession(activeManagedSession.id, activeScope);
    setProviderRunError(null);
    setProviderRunReport(null);
    setManagedProviderMessage('Plan discarded. The trace is kept for review, but it will not be executed.');
    setActiveManagedSessionId(null);
    setManagedRevisionNote('');
    playClickSound();
    pushToast('Managed plan discarded');
  };

  const loadAcceptedManagedPlan = () => {
    if (!activeManagedSession?.acceptedRequest) {
      playErrorSound();
      pushToast('No accepted baseline is available for this plan');
      return;
    }
    setProviderRunInput(buildDuskProviderRunRequestText(activeManagedSession.acceptedRequest));
    setProviderRunError(null);
    setProviderRunReport(null);
    setManagedProviderMessage('Accepted baseline loaded into the provider request editor.');
    playClickSound();
    pushToast('Accepted baseline loaded');
  };

  const runProviderRequest = () => {
    const parsed = parseDuskProviderRunRequestText(providerRunInput);
    if (!parsed.ok || !parsed.request) {
      setProviderRunError(parsed.message || 'Provider request is invalid');
      playErrorSound();
      pushToast(parsed.message || 'Provider request is invalid');
      return;
    }

    if (activeManagedSessionNeedsAcceptance) {
      const message = 'Accept the active managed plan before running it.';
      setProviderRunError(message);
      playErrorSound();
      pushToast(message);
      return;
    }

    const report = executeDuskProviderRunRequest(parsed.request, buildRuntimeContext(), activeScope);
    setProviderRunError(null);
    setProviderRunReport(report);
    if (activeManagedSessionId) {
      markManagedProviderSessionExecuted(activeManagedSessionId, report, activeScope);
    }

    if (report.blockedCount > 0) {
      playErrorSound();
    } else {
      playSuccessSound();
    }
    pushToast(`Provider run complete: ${report.succeededCount} success, ${report.blockedCount} blocked`);
  };

  const askManagedProvider = async () => {
    if (!duskProviderTools.length) {
      playErrorSound();
      pushToast('No provider tools are available right now');
      return;
    }

    setIsManagedProviderLoading(true);
    setManagedProviderMessage(null);

    const result = await requestManagedDuskProviderRun({
      envelopeText: providerEnvelopeText,
      tools: duskProviderTools,
      operatorPrompt: stationSnapshot.nextAction,
    });

    setIsManagedProviderLoading(false);

    if (!result.ok) {
      setProviderRunError(result.message);
      setManagedProviderMessage(result.message);
      playErrorSound();
      pushToast(result.message);
      return;
    }

    setProviderRunInput(buildDuskProviderRunRequestText(result.request));
    setProviderRunError(null);
    setProviderRunReport(null);
    const session = appendManagedProviderSession(
      {
        suggestion: result,
        envelopeHeadline: stationSnapshot.headline,
        nextAction: stationSnapshot.nextAction,
        linkedProjectId: leadAssistantProject?.id || null,
        linkedQuestIds: stationSnapshot.primaryTaskId ? [stationSnapshot.primaryTaskId] : [],
      },
      activeScope
    );
    setActiveManagedSessionId(session.id);
    setManagedProviderMessage(
      `${result.provider.label} (${result.provider.model}) prepared ${result.request.tools.length} tool action${
        result.request.tools.length === 1 ? '' : 's'
      }. Review, revise, accept, then run.`
    );
    playSuccessSound();
    pushToast(`Managed provider prepared ${result.request.tools.length} tool action${result.request.tools.length === 1 ? '' : 's'}`);
  };

  const copyProviderEnvelope = async () => {
    playClickSound();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(providerEnvelopeText);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = providerEnvelopeText;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } else {
        throw new Error('Clipboard unavailable');
      }
      playSuccessSound();
      pushToast('Provider contract copied');
    } catch {
      playErrorSound();
      pushToast('Provider contract could not be copied');
    }
  };

  const openFocusPanel = (taskId: string) => {
    playClickSound();
    setFocusedTaskId(taskId);
    setWorkspaceMode('focus');
  };

  const closeFocusPanel = () => {
    setWorkspaceMode(null);
    setFocusedTaskId(null);
  };

  const openEditInWorkspace = () => setWorkspaceMode('edit');
  const backToFocus = () => setWorkspaceMode('focus');

  const handleSaveWorkspace = (draft: {
    title: string;
    details: string;
    priority: Task['priority'];
    priorityLabel: FocusPriority;
    scheduledAt?: number;
    countdownMin?: number;
    mediaAssetId: string;
    soundAssetId: string | null;
  }) => {
    if (!draft.title.trim()) {
      playErrorSound();
      return;
    }

    if (workspaceMode === 'create') {
      const createdId = addTask({
        title: draft.title,
        details: draft.details,
        priority: draft.priority,
        status: 'todo',
        scheduledAt: draft.scheduledAt,
        countdownMin: draft.countdownMin,
        icon: 'sword',
        tags: createSeedPayload?.tags,
      });
      setTaskMediaSelections((prev) => ({ ...prev, [createdId]: draft.mediaAssetId || 'focus-animation' }));
      setTaskSoundSelections((prev) => ({ ...prev, [createdId]: draft.soundAssetId || null }));
      setTaskPriorityVisuals((prev) => ({ ...prev, [createdId]: draft.priorityLabel }));
      setCreateSeedPayload(null);
      setFocusedTaskId(createdId);
      setWorkspaceMode('focus');
    } else if (focusedTaskId) {
      updateTask(focusedTaskId, {
        title: draft.title,
        details: draft.details,
        priority: draft.priority,
        scheduledAt: draft.scheduledAt,
        countdownMin: draft.countdownMin,
      });
      setTaskMediaSelections((prev) => ({ ...prev, [focusedTaskId]: draft.mediaAssetId || 'focus-animation' }));
      setTaskSoundSelections((prev) => ({ ...prev, [focusedTaskId]: draft.soundAssetId || null }));
      setTaskPriorityVisuals((prev) => ({ ...prev, [focusedTaskId]: draft.priorityLabel }));
      setWorkspaceMode('focus');
    }

    playSuccessSound();
  };

  const handleToggleRun = (task: Task) => {
    if (isCompletedTask(task)) return;

    runGuarded(() => {
      const isRunningCurrent = runningTaskId === task.id && activeSession?.status === 'running';
      if (isRunningCurrent) {
        pauseSession();
        bumpUiRevision();
        playClickSound();
        return;
      }

      if (runningTask && runningTask.id !== task.id) {
        pauseSession();
        pushToast(`Paused ${runningTask.title}`);
      }

      startSession({
        title: task.title,
        tag: task.priority.toUpperCase(),
        source: 'timer',
        linkedTaskIds: [task.id],
      });
      bumpUiRevision();
      playSuccessSound();
    });
  };

  const handleComplete = (task: Task) => {
    if (isCompletedTask(task)) return;

    const runningThisTask =
      !!activeSession &&
      activeSession.status === 'running' &&
      (activeSession.taskId === task.id || (activeSession.linkedTaskIds || []).includes(task.id));

    if (runningThisTask) {
      setConfirmCompleteTaskId(task.id);
      return;
    }

    runGuarded(() => {
      completeTask(task.id, { source: 'manual_done' });
      bumpUiRevision();
      playSuccessSound();
    });
  };

  const counts = useMemo(() => {
    const active = availableTasks.filter((task) => !isCompletedTask(task)).length;
    const completed = availableTasks.filter((task) => isCompletedTask(task)).length;
    return { all: availableTasks.length, active, completed };
  }, [availableTasks]);

  const completeTarget = confirmCompleteTaskId
    ? availableTasks.find((task) => task.id === confirmCompleteTaskId) || null
    : null;
  const hasBlockingModal = workspaceMode === 'create' || workspaceMode === 'edit' || !!completeTarget;
  const workspaceTask = useMemo<Task | null>(() => {
    if (workspaceMode === 'create') {
      const now = Date.now();
      return {
        id: `draft-${createSeed}`,
        title: createSeedPayload?.title || '',
        details: createSeedPayload?.details || '',
        priority: 'normal',
        status: 'todo',
        linkedSessionIds: [],
        icon: 'sword',
        tags: createSeedPayload?.tags,
        createdAt: now,
        updatedAt: now,
      };
    }
    return focusedTask;
  }, [workspaceMode, createSeed, focusedTask, createSeedPayload]);
  const workspaceKey = workspaceTask?.id || null;

  if (!rendered) return null;

  return (
    <>
      <div className="fixed inset-0 z-[160]" data-quests-overlay="true" aria-hidden={!visible}>
        <button
          type="button"
          aria-label="Close quests drawer"
          onClick={() => {
            if (workspaceMode === 'focus') {
              closeFocusPanel();
              return;
            }
            if (hasBlockingModal) return;
            requestClose();
          }}
          className={`absolute inset-0 bg-black/35 transition-opacity duration-200 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {workspaceMode && workspaceTask ? (
          <FocusWorkspace
            open={!!workspaceMode}
            mode={workspaceMode}
            task={workspaceTask}
            runningSession={workspaceMode === 'create' ? null : focusedTaskSession}
            getTaskTrackedMs={getTaskTrackedMs}
            selectedMediaAsset={workspaceKey ? taskMediaSelections[workspaceKey] || 'focus-animation' : 'focus-animation'}
            selectedSoundAsset={workspaceKey ? taskSoundSelections[workspaceKey] || null : null}
            isMediaPinned={workspaceKey ? taskMediaPinned[workspaceKey] === '1' : false}
            onClose={closeFocusPanel}
            onBackToFocus={backToFocus}
            onEditMode={openEditInWorkspace}
            initialPriorityLabel={workspaceKey ? (taskPriorityVisuals[workspaceKey] as FocusPriority | undefined) : undefined}
            onSaveDraft={handleSaveWorkspace}
            onPersistSteps={(taskId, nextDetails) => {
              updateTask(taskId, { details: nextDetails });
            }}
            onToggleMediaPinned={() => {
              if (!workspaceKey) return;
              setTaskMediaPinned((prev) => ({
                ...prev,
                [workspaceKey]: prev[workspaceKey] === '1' ? '0' : '1',
              }));
            }}
            initialMode={workspaceMode === 'create' ? 'default' : 'default'}
            onToggleRun={() => {
              if (workspaceMode === 'create' || !focusedTask) return;
              handleToggleRun(focusedTask);
            }}
            onComplete={() => {
              if (workspaceMode === 'create' || !focusedTask) return;
              handleComplete(focusedTask);
            }}
          />
        ) : null}

        <aside
          className={`xt-dusk-shell absolute right-0 top-0 h-[100dvh] transition-transform duration-200 ease-out ${
            visible ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ width: 'clamp(320px, 34vw, 380px)' }}
        >
          <div className="flex h-full flex-col">
            <header className="xt-dusk-header flex items-center justify-between px-4 py-3.5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--app-accent)]">Dusk</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Quest Relay</div>
              </div>
              <button
                type="button"
                onClick={requestClose}
                className="xt-dusk-icon-btn inline-flex h-8 w-8 items-center justify-center text-[var(--app-muted)] hover:text-[var(--app-text)]"
                aria-label="Close quests drawer"
              >
                <X size={16} />
              </button>
            </header>

            <div className="border-b border-[var(--app-border)] p-4">
              <div className="xt-dusk-section xt-dusk-section--accent mb-3 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--app-accent)]">Station Snapshot</div>
                    <div className="mt-1 text-sm font-medium text-[var(--app-text)]">{stationSnapshot.headline}</div>
                    <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">{stationSnapshot.summary}</div>
                    <div className="mt-2 text-[11px] leading-5 text-[var(--app-muted)]">{stationSnapshot.nextAction}</div>
                  </div>
                  <div className="xt-dusk-chip">
                    {user?.id ? 'account' : 'local'}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {stationSnapshot.cues.map((cue) => (
                    <div
                      key={cue.label}
                      className="xt-dusk-subcard px-3 py-2"
                    >
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{cue.label}</div>
                      <div className="mt-1 text-[12px] font-medium text-[var(--app-text)]">{cue.value}</div>
                      <div className="mt-1 text-[10px] leading-5 text-[var(--app-muted)]">{cue.detail}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={useStationSnapshot}
                    className="xt-dusk-btn xt-dusk-btn--accent inline-flex h-9 flex-1 items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text)]"
                  >
                    <Save size={14} />
                    Load Station Brief
                  </button>
                  {stationSnapshot.primaryTaskId ? (
                    <button
                      type="button"
                      onClick={() => openFocusPanel(stationSnapshot.primaryTaskId!)}
                      className="xt-dusk-btn inline-flex h-9 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                    >
                      Open Quest
                    </button>
                  ) : null}
                </div>
              </div>

              {latestBrief ? (
                <div className="xt-dusk-section xt-dusk-section--accent mb-3 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--app-accent)]">Dusk Inbox</div>
                      <div className="mt-1 truncate text-sm font-medium text-[var(--app-text)]">{latestBrief.title}</div>
                      <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                        {formatBriefSource(latestBrief.source)} · received {formatRelativeTime(latestBrief.receivedAt)}
                      </div>
                      {latestBrief.tags?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {latestBrief.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="xt-dusk-chip xt-dusk-chip--accent"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {latestBrief.linkedQuestIds?.length ? (
                        <div className="mt-2 text-[11px] leading-5 text-[var(--app-muted)]">
                          Linked quests: {latestBrief.linkedQuestIds.length}
                        </div>
                      ) : null}
                      {latestBaselineCompare ? (
                        <div className="mt-3 grid gap-2 text-[11px] leading-5 text-[var(--app-muted)]">
                          <div>
                            <span className="text-[var(--app-text)]">Current</span>
                            {' · '}
                            {latestBaselineCompare.currentTitle || 'Unknown'}
                          </div>
                          <div>
                            <span className="text-[var(--app-text)]">Previous</span>
                            {' · '}
                            {latestBaselineCompare.previousTitle || 'Unknown'}
                          </div>
                          <div>
                            <span className="text-[var(--app-text)]">Drift</span>
                            {' · '}
                            {latestBaselineCompare.driftSummary || 'No drift summary'}
                          </div>
                          {latestBaselineCompare.currentContent ? (
                            <div className="xt-dusk-subcard px-3 py-2 text-[11px] leading-5 text-[var(--app-muted)]">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                                Current baseline
                              </div>
                              <div className="mt-2 line-clamp-3">{latestBaselineCompare.currentContent}</div>
                            </div>
                          ) : null}
                          {latestBaselineCompare.currentProvenance ? (
                            <div className="xt-dusk-subcard px-3 py-2 text-[11px] leading-5 text-[var(--app-muted)]">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                                Current accepted plan
                              </div>
                              <div className="mt-2">
                                <span className="text-[var(--app-text)]">Provider</span>
                                {' · '}
                                {formatCompareProvenanceProvider(latestBaselineCompare.currentProvenance)}
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Accepted</span>
                                {' · '}
                                {latestBaselineCompare.currentProvenance.acceptedLabel || 'Unknown'}
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Next action</span>
                                {' · '}
                                {latestBaselineCompare.currentProvenance.nextAction || 'None'}
                              </div>
                              {latestBaselineCompare.currentProvenance.revisionNote ? (
                                <div className="mt-2">{latestBaselineCompare.currentProvenance.revisionNote}</div>
                              ) : null}
                            </div>
                          ) : null}
                          {latestBaselineCompare.previousProvenance ? (
                            <div className="xt-dusk-subcard px-3 py-2 text-[11px] leading-5 text-[var(--app-muted)]">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                                Previous accepted plan
                              </div>
                              <div className="mt-2">
                                <span className="text-[var(--app-text)]">Provider</span>
                                {' · '}
                                {formatCompareProvenanceProvider(latestBaselineCompare.previousProvenance)}
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Accepted</span>
                                {' · '}
                                {latestBaselineCompare.previousProvenance.acceptedLabel || 'Unknown'}
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Next action</span>
                                {' · '}
                                {latestBaselineCompare.previousProvenance.nextAction || 'None'}
                              </div>
                              {latestBaselineCompare.previousProvenance.revisionNote ? (
                                <div className="mt-2">{latestBaselineCompare.previousProvenance.revisionNote}</div>
                              ) : null}
                            </div>
                          ) : null}
                          {latestBaselineCompareAlignment ? (
                            <div className="xt-dusk-subcard px-3 py-2 text-[11px] leading-5 text-[var(--app-muted)]">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                                Accepted Plan Alignment
                              </div>
                              <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                Status · {latestBaselineCompareAlignment.status}
                              </div>
                              <div className="mt-2">{latestBaselineCompareAlignment.summary}</div>
                              <div className="mt-2">{latestBaselineCompareAlignment.recommendation}</div>
                              <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                Accepted baseline · {latestBaselineCompareAlignment.acceptedBaselineTitle}
                              </div>
                              {activeManagedSession?.acceptedNextAction ? (
                                <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                  Accepted next action · {activeManagedSession.acceptedNextAction}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : latestBaselineProvenance ? (
                        <div className="mt-3 grid gap-2 text-[11px] leading-5 text-[var(--app-muted)]">
                          <div>
                            <span className="text-[var(--app-text)]">Baseline</span>
                            {' · '}
                            {latestBaselineProvenance.baselineTitle || 'Unknown'}
                          </div>
                          <div>
                            <span className="text-[var(--app-text)]">Accepted</span>
                            {' · '}
                            {latestBaselineProvenance.acceptedLabel || 'Unknown'}
                          </div>
                          <div>
                            <span className="text-[var(--app-text)]">Next action</span>
                            {' · '}
                            {latestBaselineProvenance.nextAction || 'None'}
                          </div>
                          <div>
                            <span className="text-[var(--app-text)]">Provider</span>
                            {' · '}
                            {formatBaselineProvenanceBriefProvider(latestBaselineProvenance)}
                          </div>
                          {latestBaselineProvenance.compareCurrentTitle ? (
                            <div>
                              <span className="text-[var(--app-text)]">Compare anchor</span>
                              {' · '}
                              {latestBaselineProvenance.compareCurrentTitle}
                              {latestBaselineProvenance.comparePreviousTitle ? ` vs ${latestBaselineProvenance.comparePreviousTitle}` : ''}
                            </div>
                          ) : null}
                          {latestBaselineProvenance.compareDriftSummary ? (
                            <div>
                              <span className="text-[var(--app-text)]">Compare drift</span>
                              {' · '}
                              {latestBaselineProvenance.compareDriftSummary}
                            </div>
                          ) : null}
                          {latestBaselineProvenance.revisionNote ? (
                            <div className="xt-dusk-subcard px-3 py-2 text-[11px] leading-5 text-[var(--app-muted)]">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                                Accepted revision note
                              </div>
                              <div className="mt-2">{latestBaselineProvenance.revisionNote}</div>
                            </div>
                          ) : null}
                          {latestBaselineProvenance.baselineContent ? (
                            <div className="xt-dusk-subcard px-3 py-2 text-[11px] leading-5 text-[var(--app-muted)]">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                                Baseline content
                              </div>
                              <div className="mt-2 line-clamp-3">{latestBaselineProvenance.baselineContent}</div>
                            </div>
                          ) : null}
                          {latestBaselineProvenanceAlignment ? (
                            <div className="xt-dusk-subcard px-3 py-2 text-[11px] leading-5 text-[var(--app-muted)]">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                                Decision anchor
                              </div>
                              <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                Status · {latestBaselineProvenanceAlignment.status}
                              </div>
                              <div className="mt-2">{latestBaselineProvenanceAlignment.summary}</div>
                              <div className="mt-2">{latestBaselineProvenanceAlignment.recommendation}</div>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-2 line-clamp-3 text-[11px] leading-5 text-[var(--app-muted)]">{latestBrief.body}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearLatestBrief}
                      className="xt-dusk-icon-btn inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--app-muted)] hover:text-[var(--app-text)]"
                      aria-label="Clear latest Dusk brief"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={useLatestBrief}
                      className="xt-dusk-btn xt-dusk-btn--accent inline-flex h-9 flex-1 items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text)]"
                    >
                      <Save size={14} />
                      Promote To Quest
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        pushToast('Dusk brief kept for later');
                      }}
                      className="xt-dusk-btn inline-flex h-9 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                    >
                      Later
                    </button>
                    {latestBaselineCompare ? (
                      <button
                        type="button"
                        onClick={useLatestBaselineCompareInPlan}
                        className="xt-dusk-btn inline-flex h-9 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                      >
                        Use In Plan
                      </button>
                    ) : latestBaselineProvenance ? (
                      <button
                        type="button"
                        onClick={useLatestBaselineProvenanceInPlan}
                        className="xt-dusk-btn inline-flex h-9 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                      >
                        Use In Plan
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {duskActionDeck.length ? (
                <div className="xt-dusk-section mb-3 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--app-accent)]">Action Deck</div>
                      <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                      Direct local actions Dusk can take safely right now.
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <div className="xt-dusk-chip">
                        {duskActionDeck.length} ready
                      </div>
                      <div className="xt-dusk-chip">
                        {duskProviderTools.length} tools
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {duskActionDeck.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => handleDuskAction(action.id)}
                        className={`xt-dusk-subcard xt-dusk-subcard--action px-3 py-3 text-left transition-colors ${
                          action.tone === 'accent'
                            ? 'xt-dusk-subcard--accent'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)]">{action.title}</div>
                            <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">{action.description}</div>
                          </div>
                          <span className="xt-dusk-chip">
                            {action.source}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {duskToolAudit.length ? (
                <div className="xt-dusk-section mb-3 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--app-accent)]">Tool Timeline</div>
                      <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                        Recent Dusk tool executions for this station scope.
                      </div>
                    </div>
                    <div className="xt-dusk-chip">
                      {duskToolAudit.length} logged
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {duskToolAudit.slice(0, 4).map((entry) => (
                      <div
                        key={entry.id}
                        className="xt-dusk-subcard px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)]">
                              {entry.actionId.replace(/-/g, ' ')}
                            </div>
                            <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">{entry.message}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="xt-dusk-chip">
                              {entry.actor}
                            </span>
                            <span className="xt-dusk-chip">
                              {entry.status}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                          {formatRelativeTime(entry.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="xt-dusk-section mb-3 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--app-accent)]">Provider Bridge</div>
                    <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                      Export the current Dusk tool contract and station context as one provider-safe envelope.
                    </div>
                  </div>
                  <div className="xt-dusk-chip">
                    v1
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {duskProviderTools.slice(0, 3).map((tool) => (
                    <span
                      key={tool.name}
                      className="xt-dusk-chip"
                    >
                      {tool.name.replace(/^xtation_/, '')}
                    </span>
                  ))}
                  {duskProviderTools.length > 3 ? (
                    <span className="xt-dusk-chip">
                      +{duskProviderTools.length - 3} more
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void copyProviderEnvelope();
                    }}
                    className="xt-dusk-btn xt-dusk-btn--accent inline-flex h-9 flex-1 items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text)]"
                  >
                    <Copy size={14} />
                    Copy Provider Contract
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void askManagedProvider();
                    }}
                    disabled={isManagedProviderLoading || !duskProviderTools.length}
                    className="xt-dusk-btn inline-flex h-9 items-center justify-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isManagedProviderLoading ? 'Bridging…' : 'Ask Managed Provider'}
                  </button>
                </div>
                <div className="mt-3">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                    Provider Run
                  </div>
                  <div className="text-[11px] leading-5 text-[var(--app-muted)]">
                    Managed provider uses a server-side OpenAI bridge. The JSON run request stays explicit so XTATION still controls the final write step.
                  </div>
                  {managedProviderMessage ? (
                    <div className="xt-dusk-subcard mt-3 px-3 py-2 text-[11px] leading-5 text-[var(--app-text)]">
                      {managedProviderMessage}
                    </div>
                  ) : null}
                  {managedProviderSessions.length ? (
                    <div className="xt-dusk-subcard mt-3 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-accent)]">
                            Managed Trace
                          </div>
                          <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                            Recent provider plans for this station scope.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            clearManagedProviderSessions(activeScope);
                            setActiveManagedSessionId(null);
                            setManagedProviderMessage(null);
                            playClickSound();
                          }}
                          className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                        >
                          Clear Trace
                        </button>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {managedProviderSessions.slice(0, 4).map((session) => {
                          const sessionBaselineAlignment = buildBaselineCompareAlignment(latestBaselineCompare, {
                            acceptedBaselineTitle: getManagedSessionAcceptedBaselineTitle(session),
                            acceptedNextAction: session.acceptedNextAction || null,
                          });
                          const sessionProvenanceAlignment = buildBaselineProvenanceAlignment(latestBaselineProvenance, {
                            acceptedBaselineTitle: getManagedSessionAcceptedBaselineTitle(session),
                            acceptedNextAction: session.acceptedNextAction || null,
                          });
                          const sessionAcceptedCompareContext =
                            session.acceptedBaselineCompareContext || session.baselineCompareContext;
                          return (
                            <div
                              key={session.id}
                              className="xt-dusk-subcard px-3 py-2"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)]">
                                    {session.providerLabel} · {session.model}
                                  </div>
                                  <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                                    {session.envelopeHeadline}
                                  </div>
                                  <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                                    {session.nextAction}
                                  </div>
                                  <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                    {session.request.tools.map((tool) => tool.name.replace(/^xtation_/, '')).join(' · ')}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className="xt-dusk-chip">
                                    {session.status}
                                  </span>
                                  {session.revisionCount ? (
                                    <span className="xt-dusk-chip">
                                      r{session.revisionCount}
                                    </span>
                                  ) : null}
                                  {sessionBaselineAlignment ? (
                                    <span className="xt-dusk-chip">
                                      {sessionBaselineAlignment.status}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              {session.outputText ? (
                                <div className="mt-2 text-[11px] leading-5 text-[var(--app-muted)]">
                                  {session.outputText}
                                </div>
                              ) : null}
                              {session.latestRevisionNote ? (
                                <div className="mt-2 text-[11px] leading-5 text-[var(--app-text)]">
                                  Revision note · {session.latestRevisionNote}
                                </div>
                              ) : null}
                              {session.acceptedAt ? (
                                <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                  Accepted {formatPlanStamp(session.acceptedAt)}
                                </div>
                              ) : null}
                              {session.promotedAt ? (
                                <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                  Lab baseline · {formatPlanStamp(session.promotedAt)}
                                </div>
                              ) : null}
                              {session.acceptedRequest ? (
                                (() => {
                                  const diff = diffManagedProviderRequests(session.request, session.acceptedRequest);
                                  return (
                                    <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                      {summarizeManagedProviderRequestDiff(diff)}
                                    </div>
                                  );
                                })()
                              ) : null}
                              {sessionAcceptedCompareContext ? (
                                <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                  Compare anchor · {sessionAcceptedCompareContext.currentTitle || 'Unknown'}
                                  {sessionAcceptedCompareContext.previousTitle
                                    ? ` vs ${sessionAcceptedCompareContext.previousTitle}`
                                    : ''}
                                </div>
                              ) : null}
                              {sessionAcceptedCompareContext?.currentProvenance ? (
                                <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                  Current plan · {formatCompareProvenanceProvider(sessionAcceptedCompareContext.currentProvenance)}
                                </div>
                              ) : null}
                              {sessionAcceptedCompareContext?.previousProvenance ? (
                                <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                  Previous plan · {formatCompareProvenanceProvider(sessionAcceptedCompareContext.previousProvenance)}
                                </div>
                              ) : null}
                              {session.acceptedBaselineProvenanceContext ? (
                                <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                  Provenance · {formatBaselineProvenanceBriefProvider(session.acceptedBaselineProvenanceContext)}
                                  {session.acceptedBaselineProvenanceContext.acceptedLabel
                                    ? ` · ${session.acceptedBaselineProvenanceContext.acceptedLabel}`
                                    : ''}
                                </div>
                              ) : null}
                              {sessionProvenanceAlignment ? (
                                <div className="mt-2 grid gap-1 text-[11px] leading-5 text-[var(--app-muted)]">
                                  <div>{sessionProvenanceAlignment.summary}</div>
                                  <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                    {sessionProvenanceAlignment.recommendation}
                                  </div>
                                </div>
                              ) : null}
                              {sessionBaselineAlignment ? (
                                <div className="mt-2 grid gap-1 text-[11px] leading-5 text-[var(--app-muted)]">
                                  <div>{sessionBaselineAlignment.summary}</div>
                                  <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                    {sessionBaselineAlignment.recommendation}
                                  </div>
                                </div>
                              ) : latestBaselineCompare ? (
                                <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                  No accepted baseline to compare yet
                                </div>
                              ) : null}
                              {session.reportSummary ? (
                                <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                  {session.reportSummary.succeededCount} success · {session.reportSummary.blockedCount} blocked
                                </div>
                              ) : null}
                              <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setProviderRunInput(buildDuskProviderRunRequestText(session.request));
                                  setProviderRunError(null);
                                  setProviderRunReport(null);
                                  setActiveManagedSessionId(session.id);
                                  setManagedRevisionNote(session.latestRevisionNote || '');
                                  if (sessionBaselineAlignment) {
                                    setManagedProviderMessage(sessionBaselineAlignment.recommendation);
                                  }
                                  playClickSound();
                                }}
                                className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                                >
                                  Load Plan
                                </button>
                              {session.acceptedRequest ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProviderRunInput(buildDuskProviderRunRequestText(session.acceptedRequest!));
                                    setProviderRunError(null);
                                    setProviderRunReport(null);
                                    setActiveManagedSessionId(session.id);
                                    setManagedRevisionNote(session.latestRevisionNote || '');
                                    setManagedProviderMessage(
                                      sessionBaselineAlignment?.recommendation ||
                                        'Accepted baseline loaded into the provider request editor.'
                                    );
                                    playClickSound();
                                  }}
                                  className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                                >
                                  Load Accepted
                                </button>
                              ) : null}
                              {session.status !== 'discarded' && session.status !== 'executed' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProviderRunInput(buildDuskProviderRunRequestText(session.request));
                                    setProviderRunError(null);
                                    setProviderRunReport(null);
                                    setActiveManagedSessionId(session.id);
                                    setManagedRevisionNote(session.latestRevisionNote || '');
                                    acceptManagedProviderSession(
                                      session.id,
                                      activeScope,
                                      createBaselineCompareContext(latestBaselineCompare),
                                      createBaselineProvenanceContext(latestBaselineProvenance)
                                    );
                                    setManagedProviderMessage('Plan accepted. Run the provider request when you want Dusk to execute it.');
                                    playSuccessSound();
                                  }}
                                  className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                                >
                                  Accept
                                </button>
                              ) : null}
                              {session.acceptedRequest ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveManagedSessionId(session.id);
                                    setManagedRevisionNote(session.latestRevisionNote || '');
                                    promoteAcceptedManagedPlanToLab(session);
                                  }}
                                  className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                                >
                                  {session.promotedNoteId ? 'Refresh Lab' : 'Promote to Lab'}
                                </button>
                              ) : null}
                              {session.promotedNoteId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    openLabNavigation({
                                      section: 'knowledge',
                                      collection: 'baselines',
                                      noteId: session.promotedNoteId,
                                      requestedBy: 'dusk',
                                    });
                                    setManagedProviderMessage('Opening promoted Lab baseline.');
                                    playClickSound();
                                  }}
                                  className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                                >
                                  Open Lab
                                </button>
                              ) : null}
                              {session.status !== 'discarded' && session.status !== 'executed' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    discardManagedProviderSession(session.id, activeScope);
                                    if (activeManagedSessionId === session.id) {
                                      setActiveManagedSessionId(null);
                                    }
                                    setManagedProviderMessage('Plan discarded. The trace is kept for review, but it will not be executed.');
                                    playClickSound();
                                  }}
                                  className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                                >
                                  Discard
                                </button>
                              ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {activeManagedSession ? (
                    <div className="xt-dusk-subcard mt-3 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-accent)]">
                            Planning Session
                          </div>
                          <div className="mt-1 text-[11px] leading-5 text-[var(--app-text)]">
                            {activeManagedSession.providerLabel} · {activeManagedSession.model}
                          </div>
                          <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                            {activeManagedSession.nextAction}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="xt-dusk-chip">{activeManagedSession.status}</span>
                          {providerInputDirtyForSession ? <span className="xt-dusk-chip">dirty</span> : null}
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                        {activeManagedSession.request.tools.map((tool) => tool.name.replace(/^xtation_/, '')).join(' · ')}
                      </div>
                      {activeManagedSession.acceptedAt ? (
                        <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                          Accepted baseline · {formatPlanStamp(activeManagedSession.acceptedAt)}
                        </div>
                      ) : null}
                      <div className="mt-3">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">
                          Revision note
                        </div>
                        <textarea
                          value={managedRevisionNote}
                          onChange={(event) => setManagedRevisionNote(event.target.value)}
                          placeholder="What changed in this revision?"
                          className="xt-dusk-textarea min-h-[84px] w-full px-3 py-3 text-[11px] leading-5 text-[var(--app-text)] outline-none transition-colors placeholder:text-[var(--app-muted)]"
                          spellCheck={false}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            reviseActiveManagedPlan();
                          }}
                          disabled={!providerInputDirtyForSession && !managedRevisionNoteDirty}
                          className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Save Revision
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            acceptActiveManagedPlan();
                          }}
                          disabled={activeManagedSession.status === 'accepted' || activeManagedSession.status === 'executed'}
                          className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {activeManagedSession.status === 'accepted' || activeManagedSession.status === 'executed' ? 'Accepted' : 'Accept Plan'}
                        </button>
                        {activeManagedSession.acceptedRequest ? (
                          <button
                            type="button"
                            onClick={() => {
                              loadAcceptedManagedPlan();
                            }}
                            className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                          >
                            Load Accepted
                          </button>
                        ) : null}
                        {activeManagedSession.acceptedRequest ? (
                          <button
                            type="button"
                            onClick={() => {
                              promoteAcceptedManagedPlanToLab(activeManagedSession);
                            }}
                            className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                          >
                            {activeManagedSession.promotedNoteId ? 'Refresh Lab' : 'Promote to Lab'}
                          </button>
                        ) : null}
                        {activeManagedSession.promotedNoteId ? (
                          <button
                            type="button"
                            onClick={() => {
                              openLabNavigation({
                                section: 'knowledge',
                                collection: 'baselines',
                                noteId: activeManagedSession.promotedNoteId,
                                requestedBy: 'dusk',
                              });
                              setManagedProviderMessage('Opening promoted Lab baseline.');
                              playClickSound();
                            }}
                            className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                          >
                            Open Lab
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            discardActiveManagedPlan();
                          }}
                          disabled={activeManagedSession.status === 'discarded' || activeManagedSession.status === 'executed'}
                          className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Discard
                        </button>
                      </div>
                      <div className="xt-dusk-subcard mt-3 px-3 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-accent)]">
                          Revision Decision
                        </div>
                        <div className="mt-2 text-[11px] leading-5 text-[var(--app-muted)]">
                          {activeManagedPlanningRecommendation || 'Review the editor draft before saving or executing it.'}
                        </div>
                        <div className="mt-3 grid gap-3">
                          {activeManagedSession.acceptedRequest && activeManagedSessionAcceptedDiff ? (
                            <div className="grid gap-2 text-[11px] leading-5 text-[var(--app-muted)]">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                                Accepted plan
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Status</span>
                                {' · '}
                                {activeManagedSessionAcceptedDiff.changed
                                  ? 'Current draft differs from the last accepted plan.'
                                  : 'Current draft matches the last accepted plan.'}
                              </div>
                              {activeManagedSession.promotedAt ? (
                                <div>
                                  <span className="text-[var(--app-text)]">Promoted</span>
                                  {' · '}
                                  {formatPlanStamp(activeManagedSession.promotedAt)}
                                </div>
                              ) : null}
                              <div>
                                <span className="text-[var(--app-text)]">Accepted next action</span>
                                {' · '}
                            {activeManagedSession.acceptedNextAction || 'None'}
                          </div>
                              {activeManagedSession.acceptedBaselineCompareContext ? (
                                <div>
                                  <span className="text-[var(--app-text)]">Compare anchor</span>
                                  {' · '}
                                  {activeManagedSession.acceptedBaselineCompareContext.currentTitle || 'Unknown'}
                                  {activeManagedSession.acceptedBaselineCompareContext.previousTitle
                                    ? ` vs ${activeManagedSession.acceptedBaselineCompareContext.previousTitle}`
                                    : ''}
                                </div>
                              ) : null}
                              <div>
                                <span className="text-[var(--app-text)]">Current next action</span>
                                {' · '}
                                {activeManagedSession.nextAction}
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Added</span>
                                {' · '}
                                {activeManagedSessionAcceptedDiff.addedTools.length
                                  ? activeManagedSessionAcceptedDiff.addedTools.join(' · ')
                                  : 'None'}
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Removed</span>
                                {' · '}
                                {activeManagedSessionAcceptedDiff.removedTools.length
                                  ? activeManagedSessionAcceptedDiff.removedTools.join(' · ')
                                  : 'None'}
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Reason changes</span>
                                {' · '}
                                {activeManagedSessionAcceptedDiff.reasonChangedTools.length
                                  ? activeManagedSessionAcceptedDiff.reasonChangedTools.join(' · ')
                                  : 'None'}
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Stop mode</span>
                                {' · '}
                                {activeManagedSessionAcceptedDiff.stopOnBlockedChanged ? 'Changed' : 'Unchanged'}
                              </div>
                            </div>
                          ) : null}
                          {latestBaselineCompare ? (
                            <div className="grid gap-2 text-[11px] leading-5 text-[var(--app-muted)]">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                                Baseline compare
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Current</span>
                                {' · '}
                                {latestBaselineCompare.currentTitle || 'Unknown'}
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Previous</span>
                                {' · '}
                                {latestBaselineCompare.previousTitle || 'Unknown'}
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Drift</span>
                                {' · '}
                                {latestBaselineCompare.driftSummary || 'No drift summary'}
                              </div>
                              {latestBaselineCompare.currentProvenance ? (
                                <div>
                                  <span className="text-[var(--app-text)]">Current plan</span>
                                  {' · '}
                                  {formatCompareProvenanceProvider(latestBaselineCompare.currentProvenance)}
                                </div>
                              ) : null}
                              {latestBaselineCompare.previousProvenance ? (
                                <div>
                                  <span className="text-[var(--app-text)]">Previous plan</span>
                                  {' · '}
                                  {formatCompareProvenanceProvider(latestBaselineCompare.previousProvenance)}
                                </div>
                              ) : null}
                              {latestBaselineCompareAlignment ? (
                                <>
                                  <div>
                                    <span className="text-[var(--app-text)]">Status</span>
                                    {' · '}
                                    {latestBaselineCompareAlignment.status}
                                  </div>
                                  <div>{latestBaselineCompareAlignment.recommendation}</div>
                                </>
                              ) : (
                                <div>No accepted baseline is attached to this plan yet.</div>
                              )}
                            </div>
                          ) : latestBaselineProvenance ? (
                            <div className="grid gap-2 text-[11px] leading-5 text-[var(--app-muted)]">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                                Accepted baseline provenance
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Baseline</span>
                                {' · '}
                                {latestBaselineProvenance.baselineTitle || 'Unknown'}
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Accepted</span>
                                {' · '}
                                {latestBaselineProvenance.acceptedLabel || 'Unknown'}
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Next action</span>
                                {' · '}
                                {latestBaselineProvenance.nextAction || 'None'}
                              </div>
                              <div>
                                <span className="text-[var(--app-text)]">Provider</span>
                                {' · '}
                                {formatBaselineProvenanceBriefProvider(latestBaselineProvenance)}
                              </div>
                              {latestBaselineProvenance.compareCurrentTitle ? (
                                <div>
                                  <span className="text-[var(--app-text)]">Compare anchor</span>
                                  {' · '}
                                  {latestBaselineProvenance.compareCurrentTitle}
                                  {latestBaselineProvenance.comparePreviousTitle
                                    ? ` vs ${latestBaselineProvenance.comparePreviousTitle}`
                                    : ''}
                                </div>
                              ) : null}
                              {latestBaselineProvenance.compareDriftSummary ? (
                                <div>
                                  <span className="text-[var(--app-text)]">Compare drift</span>
                                  {' · '}
                                  {latestBaselineProvenance.compareDriftSummary}
                                </div>
                              ) : null}
                              {latestBaselineProvenanceAlignment ? (
                                <>
                                  <div>
                                    <span className="text-[var(--app-text)]">Status</span>
                                    {' · '}
                                    {latestBaselineProvenanceAlignment.status}
                                  </div>
                                  <div>{latestBaselineProvenanceAlignment.recommendation}</div>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                          {!providerRunInput.trim() ? (
                            <div className="text-[11px] leading-5 text-[var(--app-muted)]">
                              Provider request editor is empty.
                            </div>
                          ) : parsedCurrentManagedDraft?.ok && currentManagedDraftRequest ? (
                            <div className="grid gap-2 text-[11px] leading-5 text-[var(--app-muted)]">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-accent)]">
                                Current draft
                              </div>
                            <div>
                              <span className="text-[var(--app-text)]">Draft</span>
                              {' · '}
                              {currentManagedDraftRequest.tools.length} tools
                            </div>
                            <div>
                              <span className="text-[var(--app-text)]">Against loaded session</span>
                              {' · '}
                              {currentManagedDraftDiffFromLoaded
                                ? summarizeManagedProviderRequestDiff(currentManagedDraftDiffFromLoaded)
                                : 'Unavailable'}
                            </div>
                            {activeManagedSession.acceptedRequest ? (
                              <div>
                                <span className="text-[var(--app-text)]">Against accepted baseline</span>
                                {' · '}
                                {currentManagedDraftDiffFromAccepted
                                  ? summarizeManagedProviderRequestDiff(currentManagedDraftDiffFromAccepted)
                                  : 'Unavailable'}
                              </div>
                            ) : null}
                            <div>
                              <span className="text-[var(--app-text)]">Current requester</span>
                              {' · '}
                              {currentManagedDraftRequest.requestedBy || 'None'}
                            </div>
                            <div>
                              <span className="text-[var(--app-text)]">Current stop mode</span>
                              {' · '}
                              {currentManagedDraftRequest.stopOnBlocked === false ? 'Continue on blocked' : 'Stop on blocked'}
                            </div>
                          </div>
                        ) : (
                            <div className="text-[11px] leading-5 text-[var(--app-text)]">
                              {parsedCurrentManagedDraft?.message || 'Current draft is invalid.'}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {latestBaselineCompare ? (
                              <>
                                <button
                                  type="button"
                                  onClick={useLatestBaselineCompareInPlan}
                                  className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                                >
                                  Append Compare Note
                                </button>
                                <button
                                  type="button"
                                  onClick={replaceLatestBaselineCompareInPlan}
                                  className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                                >
                                  Replace Revision Note
                                </button>
                              </>
                            ) : latestBaselineProvenance ? (
                              <>
                                <button
                                  type="button"
                                  onClick={useLatestBaselineProvenanceInPlan}
                                  className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                                >
                                  Append Provenance Note
                                </button>
                                <button
                                  type="button"
                                  onClick={replaceLatestBaselineProvenanceInPlan}
                                  className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                                >
                                  Replace Revision Note
                                </button>
                              </>
                            ) : null}
                            {activeManagedSession.acceptedRequest ? (
                              <button
                                type="button"
                                onClick={loadAcceptedManagedPlan}
                                className="xt-dusk-btn inline-flex h-8 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                              >
                                Load Accepted
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      {activeManagedSession.revisionHistory?.length ? (
                        <div className="xt-dusk-subcard mt-3 px-3 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-accent)]">
                            Recent Revisions
                          </div>
                          <div className="mt-3 grid gap-2">
                            {activeManagedSession.revisionHistory.slice(0, 3).map((revision, index) => (
                              <div key={`${revision.savedAt}-${index}`} className="xt-dusk-subcard px-3 py-2">
                                {(() => {
                                  const revisionDiff = activeManagedSession.acceptedRequest
                                    ? diffManagedProviderRequests(revision.request, activeManagedSession.acceptedRequest)
                                    : null;
                                  return (
                                    <>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                    {formatPlanStamp(revision.savedAt)}
                                  </div>
                                  <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                    {revision.request.tools.length} tools
                                  </div>
                                </div>
                                <div className="mt-1 text-[11px] leading-5 text-[var(--app-text)]">
                                {revision.note || 'No revision note'}
                                </div>
                                {revision.baselineCompareContext ? (
                                  <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                    Compare · {revision.baselineCompareContext.currentTitle || 'Unknown'}
                                    {revision.baselineCompareContext.previousTitle
                                      ? ` vs ${revision.baselineCompareContext.previousTitle}`
                                      : ''}
                                  </div>
                                ) : null}
                                {revisionDiff ? (
                                  <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                    {summarizeManagedProviderRequestDiff(revisionDiff)}
                                  </div>
                                ) : null}
                                {activeManagedSession.acceptedNextAction ? (
                                  <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                    {revision.nextAction === activeManagedSession.acceptedNextAction
                                      ? 'Next action matches accepted'
                                      : 'Next action drifted'}
                                  </div>
                                ) : null}
                                <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                  {revision.request.tools.map((tool) => tool.name.replace(/^xtation_/, '')).join(' · ')}
                                </div>
                                    </>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <textarea
                    value={providerRunInput}
                    onChange={(event) => {
                      setProviderRunInput(event.target.value);
                      if (providerRunError) setProviderRunError(null);
                    }}
                    placeholder={providerRunSampleText || 'No provider tools are available right now.'}
                    className="xt-dusk-textarea mt-3 min-h-[132px] w-full px-3 py-3 text-[11px] leading-5 text-[var(--app-text)] outline-none transition-colors placeholder:text-[var(--app-muted)]"
                    spellCheck={false}
                  />
                  {providerRunError ? (
                    <div className="xt-dusk-subcard xt-dusk-subcard--alert mt-2 px-3 py-2 text-[11px] leading-5 text-[var(--app-text)]">
                      {providerRunError}
                    </div>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={loadProviderRunSample}
                      className="xt-dusk-btn inline-flex h-9 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                    >
                      Load Sample
                    </button>
                    <button
                      type="button"
                      onClick={runProviderRequest}
                      className="xt-dusk-btn xt-dusk-btn--accent inline-flex h-9 flex-1 items-center justify-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text)]"
                    >
                      <Play size={14} />
                      Run Provider Request
                    </button>
                    <button
                      type="button"
                      onClick={clearProviderRun}
                      className="xt-dusk-btn inline-flex h-9 items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                    >
                      Clear
                    </button>
                  </div>
                  {providerRunReport ? (
                    <div className="xt-dusk-subcard mt-3 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-accent)]">
                            Provider Run Report
                          </div>
                          <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                            {providerRunReport.requestedBy || 'Unknown provider'} · {formatRelativeTime(providerRunReport.receivedAt)}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <span className="xt-dusk-chip">
                            {providerRunReport.succeededCount} success
                          </span>
                          <span className="xt-dusk-chip">
                            {providerRunReport.blockedCount} blocked
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {providerRunReport.results.map((result, index) => (
                          <div
                            key={`${result.name}-${index}`}
                            className="xt-dusk-subcard px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)]">
                                  {result.name.replace(/^xtation_/, '')}
                                </div>
                                {result.reason ? (
                                  <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                                    {result.reason}
                                  </div>
                                ) : null}
                                <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">{result.message}</div>
                              </div>
                              <span className="xt-dusk-chip">
                                {result.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                aria-label="Add Quest"
                onClick={openCreateWorkspace}
                className="xt-dusk-btn xt-dusk-btn--accent inline-flex h-11 w-full items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text)]"
              >
                <Plus size={16} />
                New Quest Draft
              </button>

              <div className="xt-dusk-filterbar mt-3 grid grid-cols-3 gap-1 p-1">
                {([
                  { key: 'all', label: 'All', count: counts.all },
                  { key: 'active', label: 'Active', count: counts.active },
                  { key: 'completed', label: 'Completed', count: counts.completed },
                ] as const).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setFilter(option.key);
                    }}
                    className={`xt-dusk-filter h-8 px-2 text-[10px] font-medium uppercase tracking-[0.1em] transition-colors ${
                      filter === option.key ? 'is-active' : ''
                    }`}
                  >
                    {option.label} ({option.count})
                  </button>
                ))}
              </div>

            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {runningTask ? (
                <section className="mb-4">
                  <div className="xt-dusk-section-label mb-2">Running</div>
                  {(() => {
                    const preview = getTaskPreview(runningTask.id);
                    return (
                  <QuestCard
                    task={runningTask}
                    isRunning
                    runningSession={activeSession}
                    getTaskTrackedMs={getTaskTrackedMs}
                    isFocused={focusedTaskId === runningTask.id}
                    mediaPreviewUrl={preview.url}
                    mediaPreviewType={preview.type}
                    priorityVisual={(taskPriorityVisuals[runningTask.id] as FocusPriority | undefined) || (runningTask.priority as FocusPriority) || 'normal'}
                    onOpen={() => openFocusPanel(runningTask.id)}
                    onToggleRun={() => handleToggleRun(runningTask)}
                    onComplete={() => handleComplete(runningTask)}
                  />
                    );
                  })()}
                </section>
              ) : null}

              <section>
                <div className="xt-dusk-section-label mb-2">Quest list</div>
                <div className="space-y-2">
                  {filteredTasks.length === 0 ? (
                    <div className="xt-dusk-empty p-4 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                      No quests in this filter.
                    </div>
                  ) : (
                    filteredTasks.map((task) => {
                      const preview = getTaskPreview(task.id);
                      const isRunning =
                        !!activeSession &&
                        activeSession.status === 'running' &&
                        (activeSession.taskId === task.id || (activeSession.linkedTaskIds || []).includes(task.id));

                      return (
                        <QuestCard
                          key={task.id}
                          task={task}
                          isRunning={isRunning}
                          runningSession={isRunning ? activeSession : null}
                          getTaskTrackedMs={getTaskTrackedMs}
                          isFocused={focusedTaskId === task.id}
                          mediaPreviewUrl={preview.url}
                          mediaPreviewType={preview.type}
                          priorityVisual={(taskPriorityVisuals[task.id] as FocusPriority | undefined) || (task.priority as FocusPriority) || 'normal'}
                          onOpen={() => openFocusPanel(task.id)}
                          onToggleRun={() => handleToggleRun(task)}
                          onComplete={() => handleComplete(task)}
                        />
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </div>
        </aside>

        {toastMessage ? (
          <div className="xt-dusk-toast pointer-events-none absolute right-[calc(clamp(320px,34vw,380px)+16px)] top-4 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-text)]">
            {toastMessage}
          </div>
        ) : null}
      </div>

      <ConfirmModal
        open={!!completeTarget}
        title="Quest is running"
        message="Pause and complete this quest?"
        confirmLabel="Pause + Complete"
        cancelLabel="Cancel"
        onCancel={() => setConfirmCompleteTaskId(null)}
        onConfirm={() => {
          if (!completeTarget) return;
          const targetId = completeTarget.id;
          runGuarded(() => {
            const liveSession = selectors.getActiveSession();
            const isRunningTarget =
              !!liveSession &&
              liveSession.status === 'running' &&
              (liveSession.taskId === targetId || (liveSession.linkedTaskIds || []).includes(targetId));

            setConfirmCompleteTaskId(null);

            if (isRunningTarget) {
              pauseSession();
            }

            window.requestAnimationFrame(() => {
              completeTask(targetId, { source: 'manual_done' });
              bumpUiRevision();
              playSuccessSound();
            });
          });
        }}
      />
    </>
  );
};

export const DuskRelay = HextechAssistant;
