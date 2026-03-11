import type { Task } from '../../components/XP/xpTypes';
import {
  buildBriefNoteSeed,
  buildQuestFromBrief,
  buildQuestFromLeadProject,
  buildStationNoteSeed,
  type DuskActionId,
  type DuskLabNoteSeed,
  type DuskQuestSeed,
} from './actionDeck';
import type { StoredDuskBrief } from './bridge';
import type { DuskStationSnapshot } from './stationSnapshot';

export interface DuskToolLeadProject {
  id: string;
  title: string;
  nextAction?: string | null;
}

export interface DuskToolRuntimeContext {
  snapshot: DuskStationSnapshot;
  latestBrief?: StoredDuskBrief | null;
  leadProject?: DuskToolLeadProject | null;
  availableTaskIds: string[];
  createQuest: (seed: DuskQuestSeed, options?: { priority?: Task['priority'] }) => string | null;
  openQuest: (taskId: string) => boolean;
  saveNote?: (seed: DuskLabNoteSeed) => string | null;
  linkProjectQuest?: (projectId: string, taskId: string) => void;
}

export interface DuskToolExecutionResult {
  status: 'success' | 'blocked';
  message: string;
  createdQuestId?: string;
  openedQuestId?: string;
  noteId?: string;
}

const blocked = (message: string): DuskToolExecutionResult => ({
  status: 'blocked',
  message,
});

const isKnownQuest = (taskId: string, availableTaskIds: string[]) => availableTaskIds.includes(taskId);

const saveLabNote = (
  saveNote: DuskToolRuntimeContext['saveNote'],
  seed: DuskLabNoteSeed,
  successMessage: string
): DuskToolExecutionResult => {
  if (!saveNote) return blocked('Lab is not available in this station');
  const noteId = saveNote(seed);
  if (!noteId) return blocked('Dusk could not save the note right now');
  return {
    status: 'success',
    message: successMessage,
    noteId,
  };
};

export const executeDuskTool = (
  actionId: DuskActionId,
  context: DuskToolRuntimeContext
): DuskToolExecutionResult => {
  if (actionId === 'open-primary-quest') {
    const taskId = context.snapshot.primaryTaskId;
    if (!taskId) return blocked('No primary quest is available yet');
    if (!isKnownQuest(taskId, context.availableTaskIds)) {
      return blocked('Primary quest is no longer available');
    }
    const opened = context.openQuest(taskId);
    if (!opened) return blocked('Dusk could not open the primary quest');
    return {
      status: 'success',
      message: 'Primary quest opened',
      openedQuestId: taskId,
    };
  }

  if (actionId === 'queue-lead-project-quest') {
    if (!context.leadProject?.title) return blocked('No lead Lab project is active');
    const seed = buildQuestFromLeadProject({
      leadProjectTitle: context.leadProject.title,
      leadProjectNextAction: context.leadProject.nextAction,
      snapshot: context.snapshot,
    });
    const createdQuestId = context.createQuest(seed, { priority: 'high' });
    if (!createdQuestId) return blocked(`Dusk could not queue the next action for ${context.leadProject.title}`);
    context.linkProjectQuest?.(context.leadProject.id, createdQuestId);
    return {
      status: 'success',
      message: `Queued next action for ${context.leadProject.title}`,
      createdQuestId,
    };
  }

  if (actionId === 'capture-station-note') {
    return saveLabNote(
      context.saveNote,
      buildStationNoteSeed({
        snapshot: context.snapshot,
        leadProjectId: context.leadProject?.id || null,
      }),
      'Station snapshot captured in Lab'
    );
  }

  if (actionId === 'open-brief-quest') {
    const taskId = context.latestBrief?.linkedQuestIds?.[0];
    if (!taskId) return blocked('The latest brief is not linked to a quest yet');
    if (!isKnownQuest(taskId, context.availableTaskIds)) {
      return blocked('Linked quest from the latest brief is no longer available');
    }
    const opened = context.openQuest(taskId);
    if (!opened) return blocked('Dusk could not open the brief quest');
    return {
      status: 'success',
      message: 'Brief quest opened',
      openedQuestId: taskId,
    };
  }

  if (actionId === 'create-brief-quest') {
    if (!context.latestBrief) return blocked('No latest Dusk brief is available');
    const seed = buildQuestFromBrief(context.latestBrief);
    const createdQuestId = context.createQuest(seed, { priority: 'high' });
    if (!createdQuestId) return blocked('Dusk could not create a quest from the latest brief');
    const linkedProjectId = context.latestBrief.linkedProjectIds?.[0];
    if (linkedProjectId) {
      context.linkProjectQuest?.(linkedProjectId, createdQuestId);
    }
    return {
      status: 'success',
      message: 'Quest created from latest Dusk brief',
      createdQuestId,
    };
  }

  if (actionId === 'save-brief-note') {
    if (!context.latestBrief) return blocked('No latest Dusk brief is available');
    return saveLabNote(context.saveNote, buildBriefNoteSeed(context.latestBrief), 'Latest Dusk brief saved to Lab');
  }

  return blocked('Unknown Dusk tool');
};
