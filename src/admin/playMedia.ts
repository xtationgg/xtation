/**
 * Play section media configuration — admin-only.
 * Controls images/videos shown on the 3 mode-select cards and the Play background.
 */

const STORAGE_KEY = 'xtation_play_media_v1';

export interface PlayCardMedia {
  label: string;
  imageUrl: string;
}

export interface PlayMediaConfig {
  /** Mission card background */
  missionImage: string;
  /** Vault card background */
  vaultImage: string;
  /** Process card background */
  processImage: string;
  /** Optional custom background for the entire Play section */
  playBackground: string;
}

const DEFAULTS: PlayMediaConfig = {
  missionImage: 'https://images.unsplash.com/photo-1534996858221-380b92700493?w=1200&q=80',
  vaultImage: 'https://images.unsplash.com/photo-1614854262318-831574f15f1f?w=1200&q=80',
  processImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80',
  playBackground: '',
};

export const readPlayMediaConfig = (): PlayMediaConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PlayMediaConfig>;
    return {
      missionImage: typeof parsed.missionImage === 'string' && parsed.missionImage ? parsed.missionImage : DEFAULTS.missionImage,
      vaultImage: typeof parsed.vaultImage === 'string' && parsed.vaultImage ? parsed.vaultImage : DEFAULTS.vaultImage,
      processImage: typeof parsed.processImage === 'string' && parsed.processImage ? parsed.processImage : DEFAULTS.processImage,
      playBackground: typeof parsed.playBackground === 'string' ? parsed.playBackground : DEFAULTS.playBackground,
    };
  } catch {
    return { ...DEFAULTS };
  }
};

export const writePlayMediaConfig = (config: PlayMediaConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
};

export const resetPlayMediaConfig = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
};

export const PLAY_MEDIA_DEFAULTS = DEFAULTS;
