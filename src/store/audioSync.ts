import type { CreativeOpsState, CreativeSkinPack } from '../admin/creativeOps';
import { findPublishedCreativeSkinByTheme } from '../admin/creativeOps';
import type { XtationTheme } from '../theme/ThemeProvider';
import type { StoreItem } from './catalog';

export type StoreAudioSyncStatus = 'unavailable' | 'inactive' | 'aligned' | 'split';

export interface StoreCompanionAudioState {
  themeValue: XtationTheme | null;
  companionSkin: CreativeSkinPack | null;
  companionSoundPackId: string | null;
  status: StoreAudioSyncStatus;
}

export const getStoreItemThemeValue = (item: StoreItem): XtationTheme | null => {
  if (item.install.kind === 'theme') return item.install.themeValue;
  if (item.install.kind === 'bundle' && item.install.theme) return item.install.theme.themeValue;
  return null;
};

export const resolveStoreCompanionAudioState = (
  item: StoreItem,
  creativeState: CreativeOpsState,
  activeThemeId: string | undefined,
  activeThemeValue: XtationTheme,
  activeSoundPackId: string | undefined
): StoreCompanionAudioState => {
  const themeValue = getStoreItemThemeValue(item);
  if (!themeValue) {
    return {
      themeValue: null,
      companionSkin: null,
      companionSoundPackId: null,
      status: 'unavailable',
    };
  }

  const companionSkin = findPublishedCreativeSkinByTheme(creativeState, themeValue);
  const companionSoundPackId = companionSkin?.soundPackId ?? null;

  if (!companionSoundPackId) {
    return {
      themeValue,
      companionSkin,
      companionSoundPackId: null,
      status: 'unavailable',
    };
  }

  const themeInstalled =
    (item.install.kind === 'theme' && activeThemeId === item.install.themeId) ||
    (item.install.kind === 'bundle' && !!item.install.theme && activeThemeId === item.install.theme.themeId) ||
    activeThemeValue === themeValue;

  if (!themeInstalled) {
    return {
      themeValue,
      companionSkin,
      companionSoundPackId,
      status: 'inactive',
    };
  }

  return {
    themeValue,
    companionSkin,
    companionSoundPackId,
    status: activeSoundPackId === companionSoundPackId ? 'aligned' : 'split',
  };
};
