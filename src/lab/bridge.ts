export type LabNavigationSection = 'workspace' | 'assistants' | 'knowledge' | 'automations' | 'media' | 'templates';
export type LabNavigationCollection = 'all' | 'pinned' | 'linked' | 'plans' | 'baselines' | 'research';

export interface LabNavigationPayload {
  section?: LabNavigationSection;
  collection?: LabNavigationCollection;
  noteId?: string | null;
  projectId?: string | null;
  automationId?: string | null;
  mediaAccountId?: string | null;
  mediaCampaignId?: string | null;
  mediaQueueId?: string | null;
  requestedBy?: 'lab' | 'dusk' | 'admin';
}

export const LAB_NAVIGATION_EVENT = 'xtation:lab:navigate';
export const LAB_NAVIGATION_STORAGE_KEY = 'xtation.lab.navigation.pending';

const getNavigationStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;

  try {
    if (window.sessionStorage) return window.sessionStorage;
  } catch {
    // Ignore sessionStorage access issues.
  }

  try {
    if (window.localStorage) return window.localStorage;
  } catch {
    // Ignore localStorage access issues.
  }

  return null;
};

export const readPendingLabNavigation = (): LabNavigationPayload | null => {
  const storage = getNavigationStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(LAB_NAVIGATION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LabNavigationPayload;
  } catch {
    return null;
  }
};

export const clearPendingLabNavigation = () => {
  const storage = getNavigationStorage();
  if (!storage) return;

  try {
    storage.removeItem(LAB_NAVIGATION_STORAGE_KEY);
  } catch {
    // Ignore cleanup issues.
  }
};

export const openLabNavigation = (payload: LabNavigationPayload) => {
  if (typeof window === 'undefined') return;

  const detail: LabNavigationPayload = {
    requestedBy: payload.requestedBy || 'lab',
    ...payload,
  };

  const storage = getNavigationStorage();
  if (storage) {
    try {
      storage.setItem(LAB_NAVIGATION_STORAGE_KEY, JSON.stringify(detail));
    } catch {
      // Ignore storage failures and still emit the event.
    }
  }

  window.dispatchEvent(
    new CustomEvent<LabNavigationPayload>(LAB_NAVIGATION_EVENT, {
      detail,
    })
  );
};
