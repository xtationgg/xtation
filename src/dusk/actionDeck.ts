import type { StoredDuskBrief } from './bridge';
import type { DuskStationSnapshot } from './stationSnapshot';

export type DuskActionSource = 'station' | 'brief';
export type DuskActionTone = 'accent' | 'neutral';
export type DuskActionId =
  | 'open-primary-quest'
  | 'queue-lead-project-quest'
  | 'capture-station-note'
  | 'open-brief-quest'
  | 'create-brief-quest'
  | 'save-brief-note';

export interface DuskActionDeckItem {
  id: DuskActionId;
  source: DuskActionSource;
  tone: DuskActionTone;
  title: string;
  description: string;
}

export interface DuskActionDeckInput {
  snapshot: DuskStationSnapshot;
  hasLab: boolean;
  primaryTaskRunning: boolean;
  leadProjectId?: string | null;
  leadProjectTitle?: string | null;
  leadProjectNextAction?: string | null;
  latestBrief?: StoredDuskBrief | null;
}

export interface DuskQuestSeed {
  title: string;
  details: string;
  tags: string[];
}

export interface DuskLabNoteSeed {
  title: string;
  content: string;
  tags: string[];
  linkedQuestIds: string[];
  linkedProjectIds: string[];
  pinned: boolean;
}

const unique = (items: Array<string | null | undefined>) =>
  Array.from(new Set(items.map((item) => item?.trim()).filter(Boolean) as string[]));

export const deriveDuskActionDeck = (input: DuskActionDeckInput): DuskActionDeckItem[] => {
  const actions: DuskActionDeckItem[] = [];

  if (input.snapshot.primaryTaskId) {
    actions.push({
      id: 'open-primary-quest',
      source: 'station',
      tone: 'accent',
      title: input.primaryTaskRunning ? 'Open Running Quest' : 'Open Priority Quest',
      description: input.primaryTaskRunning
        ? 'Jump back into the current session without opening a new thread.'
        : 'Return to the current priority quest and make it the next focused block.',
    });
  }

  if (input.leadProjectTitle) {
    actions.push({
      id: 'queue-lead-project-quest',
      source: 'station',
      tone: input.snapshot.primaryTaskId ? 'neutral' : 'accent',
      title: 'Queue Lab Next Action',
      description: input.leadProjectNextAction
        ? `Turn the lead action for ${input.leadProjectTitle} into one concrete quest.`
        : `Create the next concrete quest for ${input.leadProjectTitle}.`,
    });
  }

  if (input.hasLab) {
    actions.push({
      id: 'capture-station-note',
      source: 'station',
      tone: 'neutral',
      title: 'Capture Station Note',
      description: 'Save the current station state into Lab so the context stays pinned and reusable.',
    });
  }

  if (input.latestBrief?.linkedQuestIds?.[0]) {
    actions.push({
      id: 'open-brief-quest',
      source: 'brief',
      tone: 'accent',
      title: 'Open Brief Quest',
      description: 'Re-open the quest already linked to the latest Dusk brief.',
    });
  } else if (input.latestBrief) {
    actions.push({
      id: 'create-brief-quest',
      source: 'brief',
      tone: 'accent',
      title: 'Create Quest From Brief',
      description: 'Turn the latest Dusk brief into a real quest immediately instead of leaving it in draft.',
    });
  }

  if (input.latestBrief && input.hasLab) {
    actions.push({
      id: 'save-brief-note',
      source: 'brief',
      tone: 'neutral',
      title: 'Save Brief To Lab',
      description: 'Keep the latest Dusk brief as a pinned Lab note linked to its current context.',
    });
  }

  return actions;
};

export const buildQuestFromLeadProject = (input: {
  leadProjectTitle: string;
  leadProjectNextAction?: string | null;
  snapshot: DuskStationSnapshot;
}): DuskQuestSeed => {
  const title = input.leadProjectNextAction?.trim() || `${input.leadProjectTitle} next action`;
  const details = [
    `Generated from Dusk station snapshot.`,
    `Lead project: ${input.leadProjectTitle}`,
    `Project next action: ${input.leadProjectNextAction?.trim() || 'Define the next concrete move.'}`,
    `Station summary: ${input.snapshot.summary}`,
    `Recommended next action: ${input.snapshot.nextAction}`,
  ].join('\n');

  return {
    title,
    details,
    tags: unique(['dusk', 'lab', 'next-action', input.leadProjectTitle.toLowerCase().replace(/\s+/g, '-')]),
  };
};

export const buildQuestFromBrief = (brief: StoredDuskBrief): DuskQuestSeed => ({
  title: brief.title.trim() || 'Dusk brief quest',
  details: brief.body.trim(),
  tags: unique(['dusk', brief.source, ...(brief.tags || [])]),
});

export const buildStationNoteSeed = (input: {
  snapshot: DuskStationSnapshot;
  leadProjectId?: string | null;
}): DuskLabNoteSeed => ({
  title: input.snapshot.suggestedTitle,
  content: input.snapshot.suggestedBody,
  tags: unique(['dusk', 'station', ...(input.snapshot.tags || [])]),
  linkedQuestIds: input.snapshot.primaryTaskId ? [input.snapshot.primaryTaskId] : [],
  linkedProjectIds: input.leadProjectId ? [input.leadProjectId] : [],
  pinned: true,
});

export const buildBriefNoteSeed = (brief: StoredDuskBrief): DuskLabNoteSeed => ({
  title: brief.title.trim() || 'Dusk brief',
  content: brief.body.trim(),
  tags: unique(['dusk', brief.source, ...(brief.tags || [])]),
  linkedQuestIds: brief.linkedQuestIds || [],
  linkedProjectIds: brief.linkedProjectIds || [],
  pinned: true,
});
