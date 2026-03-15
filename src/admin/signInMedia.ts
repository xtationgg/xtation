/**
 * Sign-in media configuration — admin-only.
 * Stores the media URLs shown on the sign-in page.
 */

const STORAGE_KEY = 'xtation_signin_media_v1';

export interface SignInMediaConfig {
  /** Media shown in default/idle state (image or video URL) */
  mediaSrc: string;
  /** Media shown after successful auth (image or video URL) */
  mediaSuccessSrc: string;
}

const DEFAULTS: SignInMediaConfig = {
  mediaSrc: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80',
  mediaSuccessSrc: 'https://images.unsplash.com/photo-1534996858221-380b92700493?w=1920&q=80',
};

export const readSignInMediaConfig = (): SignInMediaConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SignInMediaConfig>;
    return {
      mediaSrc: typeof parsed.mediaSrc === 'string' && parsed.mediaSrc ? parsed.mediaSrc : DEFAULTS.mediaSrc,
      mediaSuccessSrc: typeof parsed.mediaSuccessSrc === 'string' && parsed.mediaSuccessSrc ? parsed.mediaSuccessSrc : DEFAULTS.mediaSuccessSrc,
    };
  } catch {
    return { ...DEFAULTS };
  }
};

export const writeSignInMediaConfig = (config: SignInMediaConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // storage full or blocked
  }
};

export const resetSignInMediaConfig = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const SIGNIN_MEDIA_DEFAULTS = DEFAULTS;
