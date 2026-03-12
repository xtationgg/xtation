import {
  readSessionString,
  removeSessionString,
  writeSessionString,
} from '../lib/safeSessionStorage';

export const GUEST_MODE_SESSION_KEY = 'xtation_guest_mode';

export const readGuestModeSession = () => {
  return readSessionString(GUEST_MODE_SESSION_KEY) === 'true';
};

export const writeGuestModeSession = (isGuestMode: boolean) => {
  return isGuestMode
    ? writeSessionString(GUEST_MODE_SESSION_KEY, 'true')
    : removeSessionString(GUEST_MODE_SESSION_KEY);
};

export const clearGuestModeSession = () => writeGuestModeSession(false);
