// Synthesized XTATION sound effects using the Web Audio API.
// Audio stays dormant until the first real user interaction so browser autoplay
// policy warnings do not fire during initial page load or hover.

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let audioUnlocked = false;
let unlockBound = false;
const DEVICE_SETTINGS_KEY = 'xtation_device_settings_v1';

type LegacyAudioMixGroup = 'ui' | 'notifications' | 'quest' | 'dusk' | 'ambient' | 'music' | 'scene_fx';

const defaultLegacyMixLevels: Record<LegacyAudioMixGroup, number> = {
  ui: 72,
  notifications: 86,
  quest: 88,
  dusk: 82,
  ambient: 58,
  music: 52,
  scene_fx: 76,
};

const canUseWindow = () => typeof window !== 'undefined';

const readLegacyAudioSettings = () => {
  if (!canUseWindow()) {
    return {
      enabled: true,
      masterVolume: 80,
      mixLevels: { ...defaultLegacyMixLevels },
    };
  }

  try {
    const raw = window.localStorage.getItem(DEVICE_SETTINGS_KEY);
    if (!raw) {
      return {
        enabled: true,
        masterVolume: 80,
        mixLevels: { ...defaultLegacyMixLevels },
      };
    }

    const parsed = JSON.parse(raw) as {
      audioEnabled?: boolean;
      audioVolume?: number;
      audioMixLevels?: Partial<Record<LegacyAudioMixGroup, number>>;
    };

    const mixLevels = { ...defaultLegacyMixLevels };
    for (const group of Object.keys(defaultLegacyMixLevels) as LegacyAudioMixGroup[]) {
      const value = parsed.audioMixLevels?.[group];
      if (typeof value === 'number' && Number.isFinite(value)) {
        mixLevels[group] = Math.min(100, Math.max(0, Math.round(value)));
      }
    }

    return {
      enabled: parsed.audioEnabled ?? true,
      masterVolume:
        typeof parsed.audioVolume === 'number' && Number.isFinite(parsed.audioVolume)
          ? Math.min(100, Math.max(0, Math.round(parsed.audioVolume)))
          : 80,
      mixLevels,
    };
  } catch {
    return {
      enabled: true,
      masterVolume: 80,
      mixLevels: { ...defaultLegacyMixLevels },
    };
  }
};

export const resolveLegacySoundVolumeFromSettings = (
  settings: {
    enabled: boolean;
    masterVolume: number;
    mixLevels: Record<LegacyAudioMixGroup, number>;
  },
  group: LegacyAudioMixGroup,
  baseVolume: number
) => {
  if (!settings.enabled) return 0;
  const masterScale = settings.masterVolume / 100;
  const groupScale = settings.mixLevels[group] / 100;
  return Math.max(0, Math.min(1, baseVolume * masterScale * groupScale));
};

export const resolveLegacySoundVolume = (group: LegacyAudioMixGroup, baseVolume: number) => {
  const settings = readLegacyAudioSettings();
  return resolveLegacySoundVolumeFromSettings(settings, group, baseVolume);
};

const getAudioContextClass = () => {
  if (!canUseWindow()) return null;
  return window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null;
};

const unlockAudio = () => {
  audioUnlocked = true;
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
};

const bindUnlockListeners = () => {
  if (!canUseWindow() || unlockBound) return;
  unlockBound = true;

  const onceOptions = { capture: true, once: true } as const;
  const oncePassiveOptions = { capture: true, passive: true, once: true } as const;

  window.addEventListener('pointerdown', unlockAudio, oncePassiveOptions);
  window.addEventListener('touchstart', unlockAudio, oncePassiveOptions);
  window.addEventListener('keydown', unlockAudio, onceOptions);
  window.addEventListener('mousedown', unlockAudio, oncePassiveOptions);
};

const getAudioGraph = () => {
  bindUnlockListeners();
  if (!audioUnlocked) return null;

  if (!audioCtx) {
    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) return null;
    try {
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.4;
      masterGain.connect(audioCtx.destination);
    } catch {
      audioCtx = null;
      masterGain = null;
      return null;
    }
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx && masterGain ? { ctx: audioCtx, master: masterGain } : null;
};

const createOscillatorLane = (ctx: AudioContext, master: GainNode) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(master);
  return { osc, gain };
};

bindUnlockListeners();

export const playHoverSound = () => {
  const audio = getAudioGraph();
  if (!audio) return;
  const { ctx, master } = audio;
  const level = resolveLegacySoundVolume('ui', 0.22);
  if (level <= 0) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(2000, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.05);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2500, ctx.currentTime);

  gain.gain.setValueAtTime(0.02 * level, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

  osc.start();
  osc.stop(ctx.currentTime + 0.05);
};

export const playClickSound = () => {
  const audio = getAudioGraph();
  if (!audio) return;
  const { ctx, master } = audio;
  const level = resolveLegacySoundVolume('ui', 0.42);
  if (level <= 0) return;

  const { osc, gain } = createOscillatorLane(ctx, master);
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.15 * level, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);

  const { osc: osc2, gain: gain2 } = createOscillatorLane(ctx, master);
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(2000, ctx.currentTime);
  gain2.gain.setValueAtTime(0.02 * level, ctx.currentTime);
  gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
  osc2.start();
  osc2.stop(ctx.currentTime + 0.02);
};

export const playSuccessSound = () => {
  const audio = getAudioGraph();
  if (!audio) return;
  const { ctx, master } = audio;
  const level = resolveLegacySoundVolume('quest', 0.56);
  if (level <= 0) return;

  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
    const { osc, gain } = createOscillatorLane(ctx, master);
    const now = ctx.currentTime;
    const startOffset = index * 0.04;

    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + startOffset);
    gain.gain.linearRampToValueAtTime(0.1 * level, now + startOffset + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + 1.2);

    osc.start(now + startOffset);
    osc.stop(now + startOffset + 1.5);
  });

  const oscNoise = ctx.createOscillator();
  const gainNoise = ctx.createGain();
  oscNoise.type = 'sawtooth';
  oscNoise.frequency.setValueAtTime(3000, ctx.currentTime);
  oscNoise.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.5);
  oscNoise.connect(gainNoise);
  gainNoise.connect(master);
  gainNoise.gain.setValueAtTime(0.01 * level, ctx.currentTime);
  gainNoise.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  oscNoise.start();
  oscNoise.stop(ctx.currentTime + 0.5);
};

export const playMatchFoundSound = () => {
  const audio = getAudioGraph();
  if (!audio) return;
  const { ctx, master } = audio;
  const level = resolveLegacySoundVolume('notifications', 0.75);
  if (level <= 0) return;

  const { osc, gain } = createOscillatorLane(ctx, master);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 2);
  gain.gain.setValueAtTime(0.6 * level, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
  osc.start();
  osc.stop(ctx.currentTime + 2.5);

  const { osc: osc2, gain: gain2 } = createOscillatorLane(ctx, master);
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(200, ctx.currentTime);
  gain2.gain.setValueAtTime(0.1 * level, ctx.currentTime);
  gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
  osc2.start();
  osc2.stop(ctx.currentTime + 1.5);
};

export const playPanelOpenSound = () => {
  const audio = getAudioGraph();
  if (!audio) return;
  const { ctx, master } = audio;
  const level = resolveLegacySoundVolume('scene_fx', 0.4);
  if (level <= 0) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(100, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.2);

  gain.gain.setValueAtTime(0.05 * level, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
};

export const playErrorSound = () => {
  const audio = getAudioGraph();
  if (!audio) return;
  const { ctx, master } = audio;
  const level = resolveLegacySoundVolume('notifications', 0.5);
  if (level <= 0) return;

  const { osc, gain } = createOscillatorLane(ctx, master);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.1 * level, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
};

export const playRewardSound = (type: string, customUrl?: string) => {
  if (!audioUnlocked) return;
  const level = resolveLegacySoundVolume('quest', 0.65);
  if (level <= 0) return;

  if (type === 'CUSTOM' && customUrl) {
    try {
      const audio = new Audio(customUrl);
      audio.volume = level;
      audio.play().catch((error) => console.error('Error playing custom sound:', error));
    } catch (error) {
      console.error('Error initializing custom audio', error);
    }
    return;
  }

  const audio = getAudioGraph();
  if (!audio) return;
  const { ctx, master } = audio;

  const now = ctx.currentTime;
  const { osc, gain } = createOscillatorLane(ctx, master);

  switch (type) {
    case 'LEVEL_UP':
      [440, 554, 659, 880].forEach((freq, index) => {
        const { osc: levelOsc, gain: levelGain } = createOscillatorLane(ctx, master);
        levelOsc.type = 'square';
        levelOsc.frequency.value = freq;
        levelGain.gain.setValueAtTime(0, now + index * 0.1);
        levelGain.gain.linearRampToValueAtTime(0.1 * level, now + index * 0.1 + 0.05);
        levelGain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.1 + 0.5);
        levelOsc.start(now + index * 0.1);
        levelOsc.stop(now + index * 0.1 + 0.5);
      });
      break;
    case 'TECH_POWER':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(50, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 1);
      gain.gain.setValueAtTime(0.2 * level, now);
      gain.gain.linearRampToValueAtTime(0, now + 1.2);
      osc.start(now);
      osc.stop(now + 1.2);
      break;
    case 'ALARM':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
      osc.frequency.linearRampToValueAtTime(800, now + 0.4);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.6);
      gain.gain.setValueAtTime(0.1 * level, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.8);
      osc.start(now);
      osc.stop(now + 0.8);
      break;
    case 'CHIME':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2 * level, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2);
      osc.start(now);
      osc.stop(now + 2);
      break;
    case 'BASS_DROP':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 1);
      gain.gain.setValueAtTime(0.5 * level, now);
      gain.gain.linearRampToValueAtTime(0, now + 1.2);
      osc.start(now);
      osc.stop(now + 1.2);
      break;
    default:
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.08 * level, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
      break;
  }
};
