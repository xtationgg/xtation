export type DuskBriefSource = 'lab' | 'play' | 'multiplayer' | 'profile' | 'settings';

export interface DuskBriefPayload {
  title: string;
  body: string;
  source: DuskBriefSource;
  tags?: string[];
  linkedQuestIds?: string[];
  linkedProjectIds?: string[];
  createdAt?: number;
}

export const DUSK_BRIEF_EVENT = 'dusk:openAssistantBrief';
export const LATEST_DUSK_BRIEF_KEY = 'latestDuskBrief';

export interface StoredDuskBrief extends DuskBriefPayload {
  receivedAt: number;
}

export const openDuskBrief = (payload: DuskBriefPayload) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<DuskBriefPayload>(DUSK_BRIEF_EVENT, {
      detail: {
        ...payload,
        createdAt: payload.createdAt || Date.now(),
      },
    })
  );
};
