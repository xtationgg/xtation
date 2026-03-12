import { ClientView } from '../../types';
import {
  readSessionString,
  removeSessionString,
  writeSessionString,
} from '../lib/safeSessionStorage';
import { resolveLocalStationEntryView } from '../welcome/localEntryView';

export type StationTransitionNoticeScope = 'guest' | 'account' | 'any';
export type StationTransitionNoticeTone = 'default' | 'accent';

export interface StationTransitionNotice {
  id: string;
  createdAt: number;
  scope: StationTransitionNoticeScope;
  title: string;
  detail: string;
  workspaceLabel?: string | null;
  targetView?: ClientView | null;
  chips?: string[];
  tone?: StationTransitionNoticeTone;
}

export interface StationTransitionScopeContext {
  activeUserId?: string | null;
  isGuestMode?: boolean;
}

interface StationTransitionAccess {
  canAccessAdmin?: boolean;
  featureVisibility?: {
    lab?: boolean;
    multiplayer?: boolean;
    store?: boolean;
  };
}

const STATION_TRANSITION_NOTICE_KEY = 'xtation_station_transition_notice_v1';

export const XTATION_STATION_TRANSITION_NOTICE_EVENT = 'xtation:station-transition-notice';

const buildNoticeId = () => `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatWorkspaceLabel = (view: ClientView | null | undefined) => {
  switch (view) {
    case ClientView.LOBBY:
      return 'Play';
    case ClientView.HOME:
    case ClientView.LAB:
      return 'Lab';
    case ClientView.PROFILE:
      return 'Profile';
    case ClientView.MULTIPLAYER:
      return 'Multiplayer';
    case ClientView.INVENTORY:
      return 'Inventory';
    case ClientView.STORE:
      return 'Store';
    case ClientView.SETTINGS:
      return 'Settings';
    case ClientView.ADMIN:
      return 'Admin';
    case ClientView.TFT:
      return 'Earth';
    case ClientView.UI_KIT:
      return 'UI Kit';
    default:
      return 'Play';
  }
};

export const readStationTransitionNotice = (): StationTransitionNotice | null => {
  const raw = readSessionString(STATION_TRANSITION_NOTICE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StationTransitionNotice;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.title !== 'string' || typeof parsed.detail !== 'string') return null;
    return {
      ...parsed,
      chips: Array.isArray(parsed.chips) ? parsed.chips.filter((chip): chip is string => typeof chip === 'string') : [],
      tone: parsed.tone === 'accent' ? 'accent' : 'default',
      workspaceLabel: typeof parsed.workspaceLabel === 'string' ? parsed.workspaceLabel : null,
      targetView: Object.values(ClientView).includes(parsed.targetView as ClientView)
        ? (parsed.targetView as ClientView)
        : null,
      scope:
        parsed.scope === 'guest' || parsed.scope === 'account' || parsed.scope === 'any'
          ? parsed.scope
          : 'any',
    };
  } catch {
    return null;
  }
};

export const isStationTransitionNoticeVisible = (
  notice: StationTransitionNotice | null,
  context: StationTransitionScopeContext
) => {
  if (!notice) return false;
  if (notice.scope === 'any') return true;
  if (notice.scope === 'account') return Boolean(context.activeUserId);
  return !context.activeUserId && Boolean(context.isGuestMode);
};

export const resolveVisibleStationTransitionNotice = (
  notice: StationTransitionNotice | null,
  fallbackView: ClientView | null | undefined,
  access?: StationTransitionAccess
): StationTransitionNotice | null => {
  if (!notice) return null;

  const resolvedTargetView = resolveLocalStationEntryView(notice.targetView ?? fallbackView ?? null, access);
  const resolvedWorkspaceLabel = formatWorkspaceLabel(resolvedTargetView);
  const noticeWorkspaceLabel = notice.workspaceLabel || formatWorkspaceLabel(notice.targetView ?? fallbackView ?? null);

  if (noticeWorkspaceLabel === resolvedWorkspaceLabel && notice.targetView === resolvedTargetView) {
    return notice;
  }

  const fallbackChip = `${resolvedWorkspaceLabel} fallback`;
  return {
    ...notice,
    workspaceLabel: resolvedWorkspaceLabel,
    targetView: resolvedTargetView,
    detail: `${notice.detail} XTATION will reopen ${resolvedWorkspaceLabel} because the recorded workspace is not currently available.`,
    chips: Array.from(new Set([...(notice.chips ?? []), fallbackChip])).slice(0, 4),
  };
};

export const resolveGuidedSetupTransitionActionLabel = (
  notice: StationTransitionNotice | null
) => {
  if (!notice) return 'Start Guided Setup';

  const title = notice.title.trim().toLowerCase();
  const detail = notice.detail.trim().toLowerCase();

  if (title.includes('starter setup skipped') || detail.includes('return to guided setup')) {
    return 'Return to Guided Setup';
  }

  if (title.includes('guided setup opened') || detail.includes('guided setup flow')) {
    return 'Continue Guided Setup';
  }

  return 'Start Guided Setup';
};

export const writeStationTransitionNotice = (
  notice: Omit<StationTransitionNotice, 'id' | 'createdAt'>
): StationTransitionNotice | null => {
  const normalized: StationTransitionNotice = {
    id: buildNoticeId(),
    createdAt: Date.now(),
    scope: notice.scope,
    title: notice.title,
    detail: notice.detail,
    workspaceLabel: notice.workspaceLabel ?? null,
    targetView: notice.targetView ?? null,
    chips: Array.isArray(notice.chips) ? notice.chips.filter(Boolean) : [],
    tone: notice.tone === 'accent' ? 'accent' : 'default',
  };

  if (!writeSessionString(STATION_TRANSITION_NOTICE_KEY, JSON.stringify(normalized))) {
    return null;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<StationTransitionNotice | null>(XTATION_STATION_TRANSITION_NOTICE_EVENT, {
        detail: normalized,
      })
    );
  }
  return normalized;
};

export const clearStationTransitionNotice = () => {
  removeSessionString(STATION_TRANSITION_NOTICE_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<StationTransitionNotice | null>(XTATION_STATION_TRANSITION_NOTICE_EVENT, {
        detail: null,
      })
    );
  }
};
