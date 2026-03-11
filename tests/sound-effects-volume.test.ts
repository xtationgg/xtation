import { describe, expect, it } from 'vitest';
import { resolveLegacySoundVolumeFromSettings } from '../utils/SoundEffects';

describe('legacy sound volume resolution', () => {
  it('respects the device audio toggle and mix-group levels', () => {
    expect(
      resolveLegacySoundVolumeFromSettings(
        {
          enabled: true,
          masterVolume: 50,
          mixLevels: {
            ui: 40,
            notifications: 86,
            quest: 88,
            dusk: 82,
            ambient: 58,
            music: 52,
            scene_fx: 76,
          },
        },
        'ui',
        0.5
      )
    ).toBeCloseTo(0.1, 5);
  });

  it('mutes legacy sounds completely when device audio is disabled', () => {
    expect(
      resolveLegacySoundVolumeFromSettings(
        {
          enabled: false,
          masterVolume: 100,
          mixLevels: {
            ui: 40,
            notifications: 86,
            quest: 88,
            dusk: 82,
            ambient: 58,
            music: 52,
            scene_fx: 76,
          },
        },
        'ui',
        0.5
      )
    ).toBe(0);
  });
});
