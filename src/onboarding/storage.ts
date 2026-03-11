import type { SelfTreeBranch } from '../../components/XP/xpTypes';
import { readUserScopedJSON, writeUserScopedJSON } from '../lib/userScopedStorage';

const ONBOARDING_STORAGE_KEY = 'xtation_onboarding_v1';
const GUEST_ONBOARDING_STORAGE_KEY = `${ONBOARDING_STORAGE_KEY}:guest`;
const ONBOARDING_HANDOFF_STORAGE_KEY = 'xtation_onboarding_handoff_v1';
const GUEST_ONBOARDING_HANDOFF_STORAGE_KEY = `${ONBOARDING_HANDOFF_STORAGE_KEY}:guest`;
export const XTATION_ONBOARDING_STORAGE_EVENT = 'xtation:onboarding-storage-change';

export type XtationOnboardingStatus = 'pending' | 'skipped' | 'completed';
export type XtationStarterTrack = 'mission' | 'practice' | 'system';

export interface XtationOnboardingState {
  status: XtationOnboardingStatus;
  updatedAt: number | null;
}

export interface XtationOnboardingHandoff {
  questId: string;
  title: string;
  branch: SelfTreeBranch;
  track: XtationStarterTrack;
  nodeTitle?: string;
  createdAt: number;
  dismissedAt?: number | null;
}

export const defaultXtationOnboardingState: XtationOnboardingState = {
  status: 'pending',
  updatedAt: null,
};

export const readXtationOnboardingState = (userId?: string | null): XtationOnboardingState => {
  if (typeof window === 'undefined') return defaultXtationOnboardingState;

  if (userId) {
    return readUserScopedJSON<XtationOnboardingState>(ONBOARDING_STORAGE_KEY, defaultXtationOnboardingState, userId);
  }

  try {
    const raw = window.localStorage.getItem(GUEST_ONBOARDING_STORAGE_KEY);
    if (!raw) return defaultXtationOnboardingState;
    const parsed = JSON.parse(raw) as Partial<XtationOnboardingState>;
    if (
      (parsed.status === 'pending' || parsed.status === 'skipped' || parsed.status === 'completed') &&
      (parsed.updatedAt === null || typeof parsed.updatedAt === 'number')
    ) {
      return {
        status: parsed.status,
        updatedAt: parsed.updatedAt ?? null,
      };
    }
  } catch {
    // Ignore malformed guest onboarding state.
  }

  return defaultXtationOnboardingState;
};

export const writeXtationOnboardingState = (state: XtationOnboardingState, userId?: string | null) => {
  if (typeof window === 'undefined') return false;

  if (userId) {
    const result = writeUserScopedJSON(ONBOARDING_STORAGE_KEY, state, userId);
    window.dispatchEvent(
      new CustomEvent(XTATION_ONBOARDING_STORAGE_EVENT, {
        detail: {
          userId,
        },
      })
    );
    return result;
  }

  try {
    window.localStorage.setItem(GUEST_ONBOARDING_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(
      new CustomEvent(XTATION_ONBOARDING_STORAGE_EVENT, {
        detail: {
          userId: null,
        },
      })
    );
    return true;
  } catch {
    return false;
  }
};

export const readXtationOnboardingHandoff = (userId?: string | null): XtationOnboardingHandoff | null => {
  if (typeof window === 'undefined') return null;

  if (userId) {
    return readUserScopedJSON<XtationOnboardingHandoff | null>(ONBOARDING_HANDOFF_STORAGE_KEY, null, userId);
  }

  try {
    const raw = window.localStorage.getItem(GUEST_ONBOARDING_HANDOFF_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<XtationOnboardingHandoff>;
    if (
      typeof parsed.questId === 'string' &&
      typeof parsed.title === 'string' &&
      typeof parsed.branch === 'string' &&
      typeof parsed.track === 'string' &&
      typeof parsed.createdAt === 'number'
    ) {
      return {
        questId: parsed.questId,
        title: parsed.title,
        branch: parsed.branch as SelfTreeBranch,
        track: parsed.track as XtationStarterTrack,
        nodeTitle: typeof parsed.nodeTitle === 'string' ? parsed.nodeTitle : undefined,
        createdAt: parsed.createdAt,
        dismissedAt: typeof parsed.dismissedAt === 'number' ? parsed.dismissedAt : null,
      };
    }
  } catch {
    // Ignore malformed guest onboarding handoff.
  }

  return null;
};

export const writeXtationOnboardingHandoff = (handoff: XtationOnboardingHandoff | null, userId?: string | null) => {
  if (typeof window === 'undefined') return false;

  if (userId) {
    const result = writeUserScopedJSON(ONBOARDING_HANDOFF_STORAGE_KEY, handoff, userId);
    window.dispatchEvent(
      new CustomEvent(XTATION_ONBOARDING_STORAGE_EVENT, {
        detail: {
          userId,
        },
      })
    );
    return result;
  }

  try {
    if (!handoff) {
      window.localStorage.removeItem(GUEST_ONBOARDING_HANDOFF_STORAGE_KEY);
      window.dispatchEvent(
        new CustomEvent(XTATION_ONBOARDING_STORAGE_EVENT, {
          detail: {
            userId: null,
          },
        })
      );
      return true;
    }
    window.localStorage.setItem(GUEST_ONBOARDING_HANDOFF_STORAGE_KEY, JSON.stringify(handoff));
    window.dispatchEvent(
      new CustomEvent(XTATION_ONBOARDING_STORAGE_EVENT, {
        detail: {
          userId: null,
        },
      })
    );
    return true;
  } catch {
    return false;
  }
};
