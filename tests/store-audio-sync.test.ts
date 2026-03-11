import { describe, expect, it } from 'vitest';
import {
  createDefaultCreativeOpsState,
} from '../src/admin/creativeOps';
import { resolveStoreCompanionAudioState } from '../src/store/audioSync';
import type { StoreItem } from '../src/store/catalog';

const themeItem: StoreItem = {
  id: 'theme-bureau-warm',
  name: 'Bureau Warm',
  category: 'Themes',
  price: { kind: 'free' },
  description: 'Test theme',
  highlights: [],
  install: { kind: 'theme', themeId: 'theme-bureau-warm', themeValue: 'bureau' },
};

describe('resolveStoreCompanionAudioState', () => {
  it('returns inactive when a published companion exists but the theme is not active', () => {
    const result = resolveStoreCompanionAudioState(
      themeItem,
      createDefaultCreativeOpsState(),
      undefined,
      'void',
      'soundpack-void-command'
    );

    expect(result.status).toBe('inactive');
    expect(result.companionSoundPackId).toBe('soundpack-bureau-amber');
  });

  it('returns split when the theme is active but the companion sound pack is not', () => {
    const result = resolveStoreCompanionAudioState(
      themeItem,
      createDefaultCreativeOpsState(),
      'theme-bureau-warm',
      'bureau',
      'soundpack-void-command'
    );

    expect(result.status).toBe('split');
  });

  it('returns aligned when both the theme and companion sound pack are active', () => {
    const result = resolveStoreCompanionAudioState(
      themeItem,
      createDefaultCreativeOpsState(),
      'theme-bureau-warm',
      'bureau',
      'soundpack-bureau-amber'
    );

    expect(result.status).toBe('aligned');
  });
});
