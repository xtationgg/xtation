import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Clapperboard, Pause, Play, Plus, Save, Timer, Volume2, X } from 'lucide-react';
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

const inferMediaTypeFromUrl = (url: string): FocusMediaAsset['type'] => {
  if (url.startsWith('data:image/')) return 'image';
  if (url.startsWith('data:video/')) return 'video';
  const clean = url.toLowerCase().split('?')[0].split('#')[0];
  if (/\.(png|jpe?g|webp|gif|avif|svg)$/.test(clean)) return 'image';
  return 'video';
};

const getFocusMediaAsset = (assetId: string | null) =>
  assetId?.startsWith('url:')
    ? ({
        id: assetId,
        label: 'Custom URL',
        type: inferMediaTypeFromUrl(decodeURIComponent(assetId.slice(4))),
        src: decodeURIComponent(assetId.slice(4)),
      } satisfies FocusMediaAsset)
    : FOCUS_MEDIA_LIBRARY.find((asset) => asset.id === assetId) || FOCUS_MEDIA_LIBRARY[0];

const getFocusSoundAsset = (assetId: string | null) =>
  assetId?.startsWith('sound-url:')
    ? ({
        id: assetId,
        label: 'Custom Sound',
        src: decodeURIComponent(assetId.slice('sound-url:'.length)),
      } satisfies FocusSoundAsset)
    : FOCUS_SOUND_LIBRARY.find((asset) => asset.id === assetId) || null;

type ActiveSession = ReturnType<ReturnType<typeof useXP>['selectors']['getActiveSession']>;

const LeftControlStrip: React.FC<{
  workspaceMode: WorkspaceMode;
  activeMode: FocusMode;
  onOpenMedia: () => void;
  onOpenSound: () => void;
}> = ({
  workspaceMode,
  activeMode,
  onOpenMedia,
  onOpenSound,
}) => {
  const mediaActive = activeMode === 'media';
  const soundActive = activeMode === 'sound';
  return (
    <section className="grid h-full grid-rows-[1fr_1fr] gap-2">
      <button
        type="button"
        onClick={onOpenMedia}
        title={workspaceMode === 'focus' ? 'Media panel' : 'Media library'}
        className={`inline-flex h-full min-h-[68px] items-center justify-center rounded-[10px] border text-[var(--app-text)] transition-colors ${
          mediaActive
            ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-panel))]'
            : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel))] hover:bg-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-panel))]'
        }`}
        aria-label="Open media library"
      >
        <Clapperboard size={24} />
      </button>
      <button
        type="button"
        onClick={onOpenSound}
        title={workspaceMode === 'focus' ? 'Sound panel' : 'Sound library'}
        className={`inline-flex h-full min-h-[68px] items-center justify-center rounded-[10px] border text-[var(--app-text)] transition-colors ${
          soundActive
            ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-panel))]'
            : 'border-[var(--app-border)] bg-[var(--app-panel)] hover:bg-[var(--app-panel-2)]'
        }`}
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
}> = ({ selectedAssetId, selectedSoundAsset, elapsedMs, isRunning }) => {
  const selectedAsset = getFocusMediaAsset(selectedAssetId);
  const selectedSound = getFocusSoundAsset(selectedSoundAsset);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setVideoFailed(false);
  }, [selectedAsset.id]);

  useEffect(() => {
    if (selectedAsset.type !== 'video' || videoFailed) return;
    const video = videoRef.current;
    if (!video) return;

    const syncVideo = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration <= 0) return;
      const target = (elapsedMs / 1000) % duration;
      if (Math.abs(video.currentTime - target) > 0.75) {
        video.currentTime = target;
      }
      if (isRunning) {
        void video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    syncVideo();
  }, [selectedAsset.id, selectedAsset.type, elapsedMs, isRunning]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!selectedSound || !isRunning) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    if (audio.src !== selectedSound.src) {
      audio.src = selectedSound.src;
    }
    audio.loop = true;
    audio.volume = 0.5;
    void audio.play().catch(() => {});
  }, [selectedSound?.id, selectedSound?.src, isRunning]);

  const animationProgress = ((elapsedMs / 1000) % 120) / 120;
  const orbLeft = `${18 + animationProgress * 64}%`;

  return (
    <section className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)]">
      {selectedAsset.type === 'image' && selectedAsset.src ? (
        <img src={selectedAsset.src} alt={selectedAsset.label} className="h-full w-full object-cover opacity-90" />
      ) : null}

      {selectedAsset.type === 'video' && selectedAsset.src && !videoFailed ? (
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
              video.currentTime = (elapsedMs / 1000) % duration;
            }
          }}
        />
      ) : null}

      {selectedAsset.type === 'animation' || videoFailed ? (
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

      {selectedAsset.type !== 'animation' ? (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_88%,black)] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
          {selectedAsset.label}
          {selectedSound?.label ? ` • ${selectedSound.label}` : ''}
        </div>
      ) : null}

      <audio ref={audioRef} preload="auto" />
    </section>
  );
};

const ActiveLibraryView: React.FC<{
  kind: 'media' | 'sound';
  selectedAsset: string | null;
  onSelect: (assetId: string) => void;
}> = ({ kind, selectedAsset, onSelect }) => {
  const [customUrl, setCustomUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const items = kind === 'media' ? FOCUS_MEDIA_LIBRARY : FOCUS_SOUND_LIBRARY;
  const listHeightClass = 'h-[calc(100%-92px)]';

  const applyCustomUrl = () => {
    const url = customUrl.trim();
    if (!url) return;
    const nextId = kind === 'media' ? `url:${encodeURIComponent(url)}` : `sound-url:${encodeURIComponent(url)}`;
    onSelect(nextId);
    setCustomUrl('');
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    const base64 = await new Promise<string | null>((resolve) => {
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    if (!base64) return;
    const nextId = kind === 'media' ? `url:${encodeURIComponent(base64)}` : `sound-url:${encodeURIComponent(base64)}`;
    onSelect(nextId);
    event.currentTarget.value = '';
  };

  return (
    <section className="min-h-0 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
          {kind === 'media' ? 'Media library' : 'Sound library'}
        </div>
        <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">Pick one</div>
      </div>
      <div className={`grid ${listHeightClass} grid-cols-3 gap-2 overflow-y-auto pr-1`}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`flex min-h-[78px] items-center justify-center rounded-[10px] border transition-colors ${
              selectedAsset === item.id
                ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel-2))] text-[var(--app-text)]'
                : 'border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:text-[var(--app-text)]'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              {kind === 'media' ? <Play size={18} /> : <Volume2 size={18} />}
              <span className="text-[9px] uppercase tracking-[0.1em]">{item.label}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={customUrl}
          onChange={(event) => setCustomUrl(event.target.value)}
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
          className="h-9 rounded-md border border-[var(--app-border)] px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
        >
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={kind === 'media' ? 'image/*,video/*' : 'audio/*'}
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
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

  const updatePart = (part: 'h' | 'm' | 's', value: number) => {
    const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const nextH = part === 'h' ? safe : hours;
    const nextM = part === 'm' ? Math.min(59, safe) : minutes;
    const nextS = part === 's' ? Math.min(59, safe) : seconds;
    const nextTotal = nextH * 3600 + nextM * 60 + nextS;
    onChange(nextTotal > 0 ? nextTotal / 60 : undefined);
  };

  const setPreset = (minutesPreset: number) => onChange(minutesPreset);

  return (
    <section className="min-h-0 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Countdown</div>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
          H
          <input
            type="number"
            min={0}
            value={hours}
            onChange={(event) => updatePart('h', Number(event.target.value))}
            className="mt-1 h-10 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-panel-2)] px-2 text-center text-[16px] font-semibold text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
          />
        </label>
        <label className="text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
          M
          <input
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(event) => updatePart('m', Number(event.target.value))}
            className="mt-1 h-10 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-panel-2)] px-2 text-center text-[16px] font-semibold text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
          />
        </label>
        <label className="text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
          S
          <input
            type="number"
            min={0}
            max={59}
            value={seconds}
            onChange={(event) => updatePart('s', Number(event.target.value))}
            className="mt-1 h-10 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-panel-2)] px-2 text-center text-[16px] font-semibold text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
          />
        </label>
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

  const handleHourWheel = (event: React.WheelEvent<HTMLInputElement>) => {
    event.preventDefault();
    const next = hour + (event.deltaY > 0 ? -1 : 1);
    onHourInput(next);
  };

  const handleMinuteWheel = (event: React.WheelEvent<HTMLInputElement>) => {
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

  const handleDateInputChange = (nextDatePart: string) => {
    onValueChange(composeScheduleValue(nextDatePart));
    if (!nextDatePart) return;
    const [year, month] = nextDatePart.split('-').map(Number);
    if (!year || !month) return;
    setVisibleMonth(new Date(year, month - 1, 1));
  };

  return (
    <section
      data-testid="schedule-panel"
      className="grid min-h-0 grid-cols-[minmax(0,1fr)_244px] gap-3 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-3"
    >
      <div className="grid min-h-0 grid-rows-[auto_auto_1fr_auto] gap-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">{monthLabel}</div>
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
        <input
          type="date"
          value={datePart}
          onChange={(event) => handleDateInputChange(event.target.value)}
          className="h-9 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 text-[11px] tracking-[0.03em] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
        />
        <div className="grid min-h-0 grid-cols-7 gap-1 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-2">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-center text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
              {label}
            </div>
          ))}
          {dayCells.map((cell, index) =>
            cell ? (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => onValueChange(composeScheduleValue(cell.dateKey))}
                className={`h-7 rounded-md border text-[10px] font-medium transition-colors ${
                  cell.dateKey === selectedDateKey
                    ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] text-[var(--app-text)]'
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
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClear} className="h-8 rounded-md border border-[var(--app-border)] text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
            Clear
          </button>
          <button type="button" onClick={onToday} className="h-8 rounded-md border border-[var(--app-border)] text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
            Today
          </button>
        </div>
      </div>
      <div className="grid min-h-0 grid-rows-[auto_1fr_auto] gap-2 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-2.5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center text-[22px] font-semibold text-[var(--app-text)]">
          <div className="rounded-md bg-[color-mix(in_srgb,var(--app-accent)_24%,var(--app-panel))] px-2 py-1">
            <input
              type="number"
              min={1}
              max={12}
              value={hour}
              onChange={(event) => onHourInput(Number(event.target.value || hour))}
              onWheel={handleHourWheel}
              className="w-full bg-transparent text-center text-[22px] font-semibold leading-8 text-[var(--app-text)] outline-none"
              aria-label="Hour"
            />
          </div>
          <span className="text-[18px] text-[var(--app-muted)]">:</span>
          <div className="rounded-md bg-[color-mix(in_srgb,var(--app-accent)_24%,var(--app-panel))] px-2 py-1">
            <input
              type="number"
              min={0}
              max={59}
              value={minute}
              onChange={(event) => onMinuteInput(Number(event.target.value || minute))}
              onWheel={handleMinuteWheel}
              className="w-full bg-transparent text-center text-[22px] font-semibold leading-8 text-[var(--app-text)] outline-none"
              aria-label="Minute"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onMeridiemChange('AM')}
            className={`h-9 rounded-md border text-[10px] font-semibold uppercase tracking-[0.12em] ${
              meridiem === 'AM'
                ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] text-[var(--app-text)]'
                : 'border-[var(--app-border)] text-[var(--app-muted)]'
            }`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => onMeridiemChange('PM')}
            className={`h-9 rounded-md border text-[10px] font-semibold uppercase tracking-[0.12em] ${
              meridiem === 'PM'
                ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] text-[var(--app-text)]'
                : 'border-[var(--app-border)] text-[var(--app-muted)]'
            }`}
          >
            PM
          </button>
          <button type="button" onClick={onNow} className="col-span-2 h-9 rounded-md border border-[var(--app-border)] text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
            Now
          </button>
        </div>
        <div className="grid grid-cols-1 gap-1">
          <button
            type="button"
            onClick={onApply}
            data-testid="schedule-add"
            className="h-10 rounded-md border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)]"
          >
            Add Scheduled
          </button>
          <div className="text-center text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
            {scheduledAt
              ? `Scheduled ${new Date(scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'No schedule applied'}
          </div>
        </div>
      </div>
    </section>
  );
};

const PriorityStrip: React.FC<{
  disabled?: boolean;
  value: FocusPriority;
  onChange: (value: FocusPriority) => void;
}> = ({ disabled = false, value, onChange }) => {
  const priorities: Array<{ key: FocusPriority; label: string }> = [
    { key: 'extreme', label: 'Extreme' },
    { key: 'urgent', label: 'Urgent' },
    { key: 'high', label: 'High' },
    { key: 'normal', label: 'Normal' },
  ];

  return (
    <section className="grid h-full grid-rows-4 gap-1.5 overflow-hidden rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-1.5">
      {priorities.map((priority) => (
        <button
          key={priority.key}
          type="button"
          disabled={disabled}
          onClick={() => onChange(priority.key)}
          title={`Set ${priority.label} priority`}
          className={`flex h-full w-full items-center justify-center rounded-[10px] border border-[var(--app-border)] text-[11px] font-medium tracking-[0.03em] transition-colors ${
            value === priority.key
              ? 'bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] text-[var(--app-text)]'
              : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-2)]'
          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          {priority.label}
        </button>
      ))}
    </section>
  );
};

const CharacterPanel: React.FC = () => (
  <section className="min-h-0 rounded-[12px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] p-3">
    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Character</div>
    <div className="flex h-[calc(100%-20px)] items-center justify-center">
      <img src="/ui-reference/auth/character.svg" alt="Character" className="max-h-full w-full object-contain" />
    </div>
  </section>
);

const QuestPanel: React.FC<{
  workspaceMode: WorkspaceMode;
  title: string;
  details: string;
  setTitle: (value: string) => void;
  setDetails: (value: string) => void;
  activeMode: FocusMode;
  onToggleSchedule: () => void;
  onToggleCountdown: () => void;
  onOpenDefault: () => void;
  isRunning: boolean;
  elapsed: number;
  countdownMin?: number;
  stepsDone: number;
  stepsTotal: number;
  steps: FocusStep[];
  onToggleStep: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;
  onAddStep: (text: string) => void;
  selectedMediaLabel: string;
  selectedSoundLabel: string | null;
  scheduleChipLabel: string;
  countdownChipLabel: string;
  isDirty: boolean;
  onClose: () => void;
  onBackToFocus: () => void;
  onEdit: () => void;
  onSave: () => void;
  onToggleRun: () => void;
  onComplete: () => void;
}> = ({
  workspaceMode,
  title,
  details,
  setTitle,
  setDetails,
  activeMode,
  onToggleSchedule,
  onToggleCountdown,
  onOpenDefault,
  isRunning,
  elapsed,
  countdownMin,
  stepsDone,
  stepsTotal,
  steps,
  onToggleStep,
  onDeleteStep,
  onAddStep,
  selectedMediaLabel,
  selectedSoundLabel,
  scheduleChipLabel,
  countdownChipLabel,
  isDirty,
  onClose,
  onBackToFocus,
  onEdit,
  onSave,
  onToggleRun,
  onComplete,
}) => {
  const [stepInput, setStepInput] = useState('');
  const isFocusMode = workspaceMode === 'focus';
  const isCreateMode = workspaceMode === 'create';
  const canEditDraft = workspaceMode === 'create' || workspaceMode === 'edit';
  const showTimer = workspaceMode === 'focus';
  const showChecklist = true;
  const showChecklistComposer = canEditDraft;
  const modeLabel = isCreateMode ? 'Create quest' : workspaceMode === 'edit' ? 'Edit quest' : 'Quest workspace';
  const hasCountdown = typeof countdownMin === 'number' && countdownMin > 0;
  const countdownMs = hasCountdown ? Math.max(0, Math.round(countdownMin * 60_000)) : 0;
  const timerDisplayMs = hasCountdown ? Math.max(0, countdownMs - elapsed) : elapsed;

  const modeOptions: Array<{ key: FocusMode; label: string; icon: React.ReactNode; onClick: () => void }> = [
    { key: 'default', label: 'Focus', icon: <Play size={13} />, onClick: onOpenDefault },
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
    <section className="min-h-0 w-full rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">{modeLabel}</div>
          <button
            type="button"
            aria-label="Close focus workspace"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
          >
            <X size={14} />
          </button>
        </div>

        {canEditDraft ? (
          <>
            <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-2.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">Quest name</div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded-md border border-transparent bg-transparent px-1 py-1 text-[14px] font-semibold tracking-[0.03em] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                placeholder="Quest title"
              />
            </div>

            <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-2.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">Details</div>
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                className="mt-1 h-20 w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-1 text-[12px] leading-relaxed tracking-[0.03em] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                placeholder="Quest notes"
              />
            </div>
          </>
        ) : (
          <>
            <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-2.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">Quest name</div>
              <div className="mt-1 truncate text-[14px] font-semibold tracking-[0.03em] text-[var(--app-text)]">
                {title || 'Untitled quest'}
              </div>
            </div>

            <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-2.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">Details</div>
              <div className="mt-1 h-16 overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed tracking-[0.03em] text-[var(--app-text)]">
                {details?.trim() || 'No details set'}
              </div>
            </div>
          </>
        )}

        {canEditDraft ? (
          <div className="grid grid-cols-3 gap-1.5">
            {modeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={option.onClick}
                data-testid={option.key === 'schedule' ? 'schedule-toggle' : undefined}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border text-[9px] font-semibold uppercase tracking-[0.1em] ${
                  activeMode === option.key
                    ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] text-[var(--app-text)]'
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
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
              Mode: {activeMode}
            </span>
            <span className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
              Media: {selectedMediaLabel}
            </span>
            <span className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
              Sound: {selectedSoundLabel || 'None'}
            </span>
            <span className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
              {scheduleChipLabel}
            </span>
            <span className="rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
              {countdownChipLabel}
            </span>
            {isDirty ? (
              <span className="rounded-md border border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-[var(--app-text)]">
                Unsaved
              </span>
            ) : null}
          </div>
        ) : null}

        {showTimer ? (
          <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
              {hasCountdown ? 'Countdown' : 'Timer'}
            </div>
            <div className="mt-1 text-center text-[34px] font-semibold leading-none tracking-[0.04em] text-[var(--app-text)]">
              {formatTimer(timerDisplayMs)}
            </div>
          </div>
        ) : null}

        {showChecklist ? (
          <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2">
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
              Checklist steps ({stepsDone}/{stepsTotal || 0})
            </div>
            <div className={`space-y-1.5 overflow-y-auto pr-0.5 ${canEditDraft ? 'max-h-[140px]' : 'max-h-[110px]'}`}>
              {steps.length === 0 ? (
                <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
                  {canEditDraft ? 'No checklist steps. Add one below.' : 'No checklist steps.'}
                </div>
              ) : (
                steps.map((step) => (
                  <div key={step.id} className="flex items-center gap-2 rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1">
                    <button
                      type="button"
                      onClick={() => onToggleStep(step.id)}
                      role="checkbox"
                      aria-checked={step.done}
                      className={`h-4 w-4 rounded-sm border ${step.done ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_30%,var(--app-panel))]' : 'border-[var(--app-border)]'}`}
                      aria-label={step.done ? 'Mark step incomplete' : 'Mark step complete'}
                    />
                    <span className={`min-w-0 flex-1 truncate text-[11px] tracking-[0.03em] ${step.done ? 'text-[var(--app-muted)] line-through' : 'text-[var(--app-text)]'}`}>
                      {step.text}
                    </span>
                    {canEditDraft ? (
                      <button
                        type="button"
                        onClick={() => onDeleteStep(step.id)}
                        className="text-[10px] uppercase tracking-[0.1em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                        aria-label="Delete step"
                      >
                        Del
                      </button>
                    ) : null}
                  </div>
                ))
              )}
              {showChecklistComposer ? (
                <div className="flex items-center gap-2">
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
                    className="h-8 rounded-md border border-[var(--app-border)] px-2 text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)] hover:text-[var(--app-text)]"
                  >
                    Add
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {isFocusMode ? (
          <div className="mt-auto grid grid-cols-3 gap-2">
            <button
              type="button"
              aria-label={isRunning ? 'Pause quest' : 'Start quest'}
              onClick={onToggleRun}
              className="h-10 rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)]"
            >
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <button
              type="button"
              aria-label="Complete quest"
              onClick={onComplete}
              className="h-10 rounded-md border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel))] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)]"
            >
              Complete
            </button>
            <button
              type="button"
              aria-label="Edit quest"
              onClick={onEdit}
              className="h-10 rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)]"
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="mt-auto grid grid-cols-3 gap-2">
            <button
              type="button"
              aria-label={workspaceMode === 'create' ? 'Cancel create quest' : 'Back to focus'}
              onClick={workspaceMode === 'create' ? onClose : onBackToFocus}
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
  getSessionDisplayMs: (session: NonNullable<ActiveSession>, now?: number) => number;
  getTaskTrackedMs: (taskId: string, now?: number) => number;
  selectedMediaAsset: string | null;
  selectedSoundAsset: string | null;
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
  onToggleRun: () => void;
  onComplete: () => void;
  initialMode?: FocusMode;
}> = ({
  open,
  mode,
  task,
  runningSession,
  getSessionDisplayMs,
  getTaskTrackedMs,
  selectedMediaAsset,
  selectedSoundAsset,
  onClose,
  onBackToFocus,
  onEditMode,
  initialPriorityLabel,
  onSaveDraft,
  onPersistSteps,
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
    if (mode === 'focus' && activeMode !== 'default') {
      setActiveMode('default');
    }
  }, [mode, activeMode]);

  if (!open) return null;

  const elapsed = isCreateMode ? 0 : getTaskTrackedMs(task.id, tickNow);
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
  const countdownChipLabel =
    typeof draftCountdownMin === 'number' && draftCountdownMin > 0
      ? `Countdown: ${Math.round(draftCountdownMin)}m`
      : 'Countdown: None';

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
      <div className="pointer-events-none absolute inset-y-4 left-4 right-[calc(clamp(320px,34vw,380px)+16px)] z-[170] max-sm:hidden">
        <div className="flex h-full items-center justify-center">
          <div className="pointer-events-auto grid aspect-[3/1] w-full max-w-[min(1240px,calc(100vw-clamp(320px,34vw,380px)-64px))] grid-cols-[48px_minmax(0,1.95fr)_56px_minmax(320px,1.15fr)_minmax(210px,0.95fr)] gap-2.5 rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_96%,black)] p-2.5">
            <LeftControlStrip
              workspaceMode={mode}
              activeMode={activeMode}
              onOpenMedia={() => setActiveMode('media')}
              onOpenSound={() => setActiveMode('sound')}
            />
            <div className="min-h-0">
              {activeMode === 'default' ? (
                <ActiveAreaDefault
                  selectedAssetId={draftMediaAsset}
                  selectedSoundAsset={draftSoundAsset}
                  elapsedMs={elapsed}
                  isRunning={isRunning}
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
                  onSelect={(assetId) => {
                    setDraftMediaAsset(assetId);
                    setActiveMode('default');
                  }}
                />
              ) : null}
              {activeMode === 'sound' ? (
                <ActiveLibraryView
                  kind="sound"
                  selectedAsset={draftSoundAsset}
                  onSelect={(assetId) => {
                    setDraftSoundAsset(assetId);
                    setActiveMode('default');
                  }}
                />
              ) : null}
              {activeMode === 'countdown' ? (
                <ActiveCountdownView countdownMin={draftCountdownMin} onChange={setDraftCountdownMin} />
              ) : null}
            </div>
            <PriorityStrip
          disabled={mode === 'focus'}
          value={draftPriorityLabel}
          onChange={(nextPriority) => {
            setDraftPriorityLabel(nextPriority);
            setDraftPriority(nextPriority === 'extreme' ? 'urgent' : nextPriority);
          }}
            />
            <QuestPanel
          workspaceMode={mode}
          title={draftTitle}
          details={draftDetails}
          setTitle={setDraftTitle}
          setDetails={setDraftDetails}
          activeMode={activeMode}
          onToggleSchedule={() => setActiveMode((prev) => (prev === 'schedule' ? 'default' : 'schedule'))}
          onToggleCountdown={() => setActiveMode((prev) => (prev === 'countdown' ? 'default' : 'countdown'))}
          onOpenDefault={() => setActiveMode('default')}
          isRunning={isRunning}
          elapsed={elapsed}
          countdownMin={draftCountdownMin}
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
          selectedMediaLabel={getFocusMediaAsset(draftMediaAsset).label}
          selectedSoundLabel={getFocusSoundAsset(draftSoundAsset)?.label || null}
          scheduleChipLabel={scheduleChipLabel}
          countdownChipLabel={countdownChipLabel}
          isDirty={isDirty}
          onClose={() => requestExit('close')}
          onBackToFocus={() => requestExit('back')}
          onEdit={onEditMode}
          onSave={saveDraft}
          onToggleRun={onToggleRun}
          onComplete={onComplete}
            />
            <CharacterPanel />
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
  const [, setUiRevision] = useState(0);

  const [rendered, setRendered] = useState(isOpen);
  const [visible, setVisible] = useState(isOpen);

  const closeTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const actionLockedRef = useRef(false);

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
    return {
      url: asset.type === 'image' && asset.src ? asset.src : null,
      type: asset.type,
      label: asset.label,
    };
  };

  useEffect(() => {
    setTaskMediaSelections(loadSelectionMap(QUEST_MEDIA_STORAGE_KEY));
    setTaskSoundSelections(loadSelectionMap(QUEST_SOUND_STORAGE_KEY));
    setTaskPriorityVisuals(loadSelectionMap(QUEST_PRIORITY_STORAGE_KEY));
  }, []);

  useEffect(() => {
    persistSelectionMap(QUEST_MEDIA_STORAGE_KEY, taskMediaSelections);
  }, [taskMediaSelections]);

  useEffect(() => {
    persistSelectionMap(QUEST_SOUND_STORAGE_KEY, taskSoundSelections);
  }, [taskSoundSelections]);

  useEffect(() => {
    persistSelectionMap(QUEST_PRIORITY_STORAGE_KEY, taskPriorityVisuals);
  }, [taskPriorityVisuals]);

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
            getSessionDisplayMs={selectors.getSessionDisplayMs}
            getTaskTrackedMs={getTaskTrackedMs}
            selectedMediaAsset={workspaceKey ? taskMediaSelections[workspaceKey] || 'focus-animation' : 'focus-animation'}
            selectedSoundAsset={workspaceKey ? taskSoundSelections[workspaceKey] || null : null}
            onClose={closeFocusPanel}
            onBackToFocus={backToFocus}
            onEditMode={openEditInWorkspace}
            initialPriorityLabel={workspaceKey ? (taskPriorityVisuals[workspaceKey] as FocusPriority | undefined) : undefined}
            onSaveDraft={handleSaveWorkspace}
            onPersistSteps={(taskId, nextDetails) => {
              updateTask(taskId, { details: nextDetails });
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
                        ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] text-[var(--app-text)]'
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
                    mediaLabel={preview.label}
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
                          mediaLabel={preview.label}
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
