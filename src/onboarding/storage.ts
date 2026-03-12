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

const ONBOARDING_STATUS_VALUES: XtationOnboardingStatus[] = ['pending', 'skipped', 'completed'];
const STARTER_TRACK_VALUES: XtationStarterTrack[] = ['mission', 'practice', 'system'];
const SELF_TREE_BRANCH_VALUES: SelfTreeBranch[] = [
  'Knowledge',
  'Creation',
  'Systems',
  'Communication',
  'Physical',
  'Inner',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOnboardingStatus = (value: unknown): value is XtationOnboardingStatus =>
  typeof value === 'string' && ONBOARDING_STATUS_VALUES.includes(value as XtationOnboardingStatus);

const isStarterTrack = (value: unknown): value is XtationStarterTrack =>
  typeof value === 'string' && STARTER_TRACK_VALUES.includes(value as XtationStarterTrack);

const isSelfTreeBranch = (value: unknown): value is SelfTreeBranch =>
  typeof value === 'string' && SELF_TREE_BRANCH_VALUES.includes(value as SelfTreeBranch);

const parseOnboardingState = (value: unknown): XtationOnboardingState | null => {
  if (!isRecord(value) || !isOnboardingStatus(value.status)) return null;
  if (value.updatedAt !== null && value.updatedAt !== undefined && typeof value.updatedAt !== 'number') return null;
  return {
    status: value.status,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : null,
  };
};

const parseOnboardingHandoff = (value: unknown): XtationOnboardingHandoff | null => {
  if (!isRecord(value)) return null;
  if (typeof value.questId !== 'string' || !value.questId.trim()) return null;
  if (typeof value.title !== 'string' || !value.title.trim()) return null;
  if (!isSelfTreeBranch(value.branch)) return null;
  if (!isStarterTrack(value.track)) return null;
  if (typeof value.createdAt !== 'number') return null;
  return {
    questId: value.questId,
    title: value.title,
    branch: value.branch,
    track: value.track,
    nodeTitle: typeof value.nodeTitle === 'string' && value.nodeTitle.trim() ? value.nodeTitle : undefined,
    createdAt: value.createdAt,
    dismissedAt: typeof value.dismissedAt === 'number' ? value.dismissedAt : null,
  };
};

export const readXtationOnboardingState = (userId?: string | null): XtationOnboardingState => {
  if (typeof window === 'undefined') return defaultXtationOnboardingState;

  if (userId) {
    const parsed = parseOnboardingState(
      readUserScopedJSON<unknown>(ONBOARDING_STORAGE_KEY, null, userId)
    );
    return parsed ?? defaultXtationOnboardingState;
  }

  try {
    const raw = window.localStorage.getItem(GUEST_ONBOARDING_STORAGE_KEY);
    if (!raw) return defaultXtationOnboardingState;
    const parsed = parseOnboardingState(JSON.parse(raw) as unknown);
    if (parsed) return parsed;
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
    return parseOnboardingHandoff(
      readUserScopedJSON<unknown>(ONBOARDING_HANDOFF_STORAGE_KEY, null, userId)
    );
  }

  try {
    const raw = window.localStorage.getItem(GUEST_ONBOARDING_HANDOFF_STORAGE_KEY);
    if (!raw) return null;
    return parseOnboardingHandoff(JSON.parse(raw) as unknown);
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
