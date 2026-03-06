import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronUp, Pause, Pencil, Pin, Play, Plus, Save, Timer, Video, Volume2, X } from 'lucide-react';
import { useXP } from '../XP/xpStore';
import { Task } from '../XP/xpTypes';
import { ConfirmModal } from '../UI/ConfirmModal';
import { QuestCard } from '../Play/QuestCard';
import { playClickSound, playErrorSound, playSuccessSound } from '../../utils/SoundEffects';

interface HextechAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

type QuestFilter = 'all' | 'active' | 'completed';
type FocusPriority = 'normal' | 'high' | 'urgent' | 'extreme';
type FocusStep = { id: string; text: string; done: boolean };
type FocusMode = 'default' | 'schedule' | 'media' | 'sound' | 'countdown';
type WorkspaceMode = 'create' | 'focus' | 'edit';

const isCompletedTask = (task: Task) => !!task.completedAt || task.status === 'done';
const isHiddenTask = (task: Task) => !!task.archivedAt || task.status === 'dropped';
const STEPS_BLOCK_REGEX = /\n?---\s*\n\[xstation_steps_v1\]\s*\n([\s\S]*?)\n---\s*$/;
const createStepId = () => `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatTimer = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const parseQuestSteps = (details?: string) => {
  if (!details) return [] as Array<{ text: string; done: boolean }>;
  const match = details.match(STEPS_BLOCK_REGEX);
  if (!match?.[1]) return [] as Array<{ text: string; done: boolean }>;
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed?.steps)) return [] as Array<{ text: string; done: boolean }>;
    return parsed.steps
      .map((step: unknown) => {
        const next = step as { text?: string; done?: boolean };
        if (!next?.text || typeof next.text !== 'string') return null;
        return { text: next.text, done: !!next.done };
      })
      .filter(Boolean) as Array<{ text: string; done: boolean }>;
  } catch {
    return [] as Array<{ text: string; done: boolean }>;
  }
};

const parseQuestStepsForEditor = (details?: string): FocusStep[] =>
  parseQuestSteps(details).map((step) => ({ ...step, id: createStepId() }));

const stripStepsFromDetails = (details?: string) => {
  if (!details) return '';
  return details.replace(STEPS_BLOCK_REGEX, '').trim();
};

const buildDetailsWithSteps = (plainDetails: string, steps: FocusStep[]) => {
  const base = plainDetails.trim();
  const normalizedSteps = steps
    .map((step) => ({ text: step.text.trim(), done: !!step.done }))
    .filter((step) => !!step.text);

  if (!normalizedSteps.length) return base;

  const stepsBlock = `---\n[xstation_steps_v1]\n${JSON.stringify({ steps: normalizedSteps }, null, 2)}\n---`;
  if (!base) return stepsBlock;
  return `${base}\n\n${stepsBlock}`;
};

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
          <div
            className={`relative grid max-h-[calc(100dvh-24px)] w-[min(1500px,calc(100vw-clamp(320px,34vw,380px)-18px))] min-w-[640px] gap-2 overflow-hidden rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_96%,black)] p-2 ${
              mode === 'focus'
                ? 'h-[clamp(460px,68vh,760px)] grid-cols-[minmax(0,2.05fr)_minmax(320px,1.08fr)_minmax(200px,0.82fr)]'
                : 'h-[clamp(420px,62vh,700px)] grid-cols-[52px_minmax(0,1.84fr)_64px_minmax(310px,1.08fr)_minmax(200px,0.82fr)]'
            }`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close focus workspace"
              onClick={() => requestExit('close')}
              className="absolute -right-11 -top-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
            >
              <X size={14} />
            </button>
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
  const [taskMediaSelections, setTaskMediaSelections] = useState<Record<string, string>>({});
  const [taskSoundSelections, setTaskSoundSelections] = useState<Record<string, string>>({});
  const [taskPriorityVisuals, setTaskPriorityVisuals] = useState<Record<string, string>>({});
  const [taskMediaPinned, setTaskMediaPinned] = useState<Record<string, string>>({});
  const [, setUiRevision] = useState(0);
  const [runtimeTick, setRuntimeTick] = useState(() => Date.now());

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
    if (isOpen) {
      setFilter('active');
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
    setCreateSeed((prev) => prev + 1);
    setWorkspaceMode('create');
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
      });
      setTaskMediaSelections((prev) => ({ ...prev, [createdId]: draft.mediaAssetId || 'focus-animation' }));
      setTaskSoundSelections((prev) => ({ ...prev, [createdId]: draft.soundAssetId || null }));
      setTaskPriorityVisuals((prev) => ({ ...prev, [createdId]: draft.priorityLabel }));
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
        title: '',
        details: '',
        priority: 'normal',
        status: 'todo',
        linkedSessionIds: [],
        icon: 'sword',
        createdAt: now,
        updatedAt: now,
      };
    }
    return focusedTask;
  }, [workspaceMode, createSeed, focusedTask]);
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
          className={`absolute right-0 top-0 h-[100dvh] border-l border-[var(--app-border)] bg-[var(--app-panel)] transition-transform duration-200 ease-out ${
            visible ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ width: 'clamp(320px, 34vw, 380px)' }}
        >
          <div className="flex h-full flex-col">
            <header className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">Quests</div>
              <button
                type="button"
                onClick={requestClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                aria-label="Close quests drawer"
              >
                <X size={16} />
              </button>
            </header>

            <div className="border-b border-[var(--app-border)] p-4">
              <button
                type="button"
                onClick={openCreateWorkspace}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel-2))] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text)]"
              >
                <Plus size={16} />
                Add Quest
              </button>

              <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] p-1">
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
                    className={`h-8 rounded-lg border px-2 text-[10px] font-medium uppercase tracking-[0.1em] transition-colors ${
                      filter === option.key
                        ? 'border-transparent bg-[color-mix(in_srgb,var(--app-accent)_22%,var(--app-panel))] text-[var(--app-text)]'
                        : 'border-[color-mix(in_srgb,var(--app-border)_70%,transparent)] bg-transparent text-[var(--app-muted)] hover:text-[var(--app-text)]'
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
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--app-muted)]">Running</div>
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
                <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--app-muted)]">Quest list</div>
                <div className="space-y-2">
                  {filteredTasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-panel-2)] p-4 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
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
          <div className="pointer-events-none absolute right-[calc(clamp(320px,34vw,380px)+16px)] top-4 rounded-lg border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_94%,black)] px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-text)]">
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
