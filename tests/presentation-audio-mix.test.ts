import { describe, expect, it } from 'vitest';
import {
  defaultXtationAudioMixLevels,
  getXtationEffectiveCueVolumeScale,
  normalizeXtationAudioMixLevels,
} from '../src/presentation/audioMix';

describe('presentation audio mix', () => {
  it('normalizes partial mix settings and preserves defaults for missing groups', () => {
    expect(normalizeXtationAudioMixLevels({ ui: 40, dusk: 115, ambient: -12 })).toEqual({
      ...defaultXtationAudioMixLevels(),
      ui: 40,
      dusk: 100,
      ambient: 0,
    });
  });

  it('combines cue, master, and group volume into the final runtime scale', () => {
    expect(
      getXtationEffectiveCueVolumeScale({
        cueVolume: 80,
        masterVolume: 50,
        groupVolume: 25,
      })
    ).toBeCloseTo(0.1, 5);
  });
});
