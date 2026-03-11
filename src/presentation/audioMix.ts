import type { CreativeMixGroup } from '../admin/creativeOps';

export type XtationAudioMixLevels = Record<CreativeMixGroup, number>;

export const XTATION_AUDIO_MIX_GROUPS: CreativeMixGroup[] = [
  'ui',
  'notifications',
  'quest',
  'dusk',
  'ambient',
  'music',
  'scene_fx',
];

export const XTATION_AUDIO_MIX_LABELS: Record<CreativeMixGroup, string> = {
  ui: 'UI',
  notifications: 'Alerts',
  quest: 'Quest',
  dusk: 'Dusk',
  ambient: 'Ambient',
  music: 'Music',
  scene_fx: 'Scene FX',
};

export const defaultXtationAudioMixLevels = (): XtationAudioMixLevels => ({
  ui: 72,
  notifications: 86,
  quest: 88,
  dusk: 82,
  ambient: 58,
  music: 52,
  scene_fx: 76,
});

export const normalizeXtationAudioMixLevels = (
  levels: Partial<Record<string, unknown>> | null | undefined
): XtationAudioMixLevels => {
  const base = defaultXtationAudioMixLevels();
  if (!levels) return base;

  for (const group of XTATION_AUDIO_MIX_GROUPS) {
    const value = levels[group];
    if (typeof value === 'number' && Number.isFinite(value)) {
      base[group] = Math.min(100, Math.max(0, Math.round(value)));
    }
  }

  return base;
};

export const resolveXtationAudioMixLevel = (
  levels: XtationAudioMixLevels | null | undefined,
  group: CreativeMixGroup
) => {
  if (!levels) return defaultXtationAudioMixLevels()[group];
  return levels[group];
};

export const getXtationEffectiveCueVolumeScale = ({
  cueVolume,
  masterVolume,
  groupVolume,
}: {
  cueVolume: number;
  masterVolume: number;
  groupVolume: number;
}) => {
  const cueScale = Math.min(1.2, Math.max(0.15, cueVolume / 100));
  const masterScale = Math.min(1, Math.max(0, masterVolume / 100));
  const groupScale = Math.min(1, Math.max(0, groupVolume / 100));
  return cueScale * masterScale * groupScale;
};
