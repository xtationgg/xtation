import type { CreativeSceneCueEntry } from '../admin/creativeOps';

export const XTATION_SCENE_CUE_EVENT = 'xtation:scene-cue';

export interface SceneCueRequest {
  eventName: string;
  cue: CreativeSceneCueEntry;
  emittedAt: number;
  metadata?: Record<string, unknown>;
}

export const dispatchSceneCueRequest = (request: SceneCueRequest) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(XTATION_SCENE_CUE_EVENT, {
      detail: request,
    })
  );
};
