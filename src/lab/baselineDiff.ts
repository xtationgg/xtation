import type { LabNote } from './types';

export interface BaselineNoteDrift {
  changed: boolean;
  titleChanged: boolean;
  contentChanged: boolean;
  addedTags: string[];
  removedTags: string[];
  addedProjectIds: string[];
  removedProjectIds: string[];
  addedQuestIds: string[];
  removedQuestIds: string[];
}

const normalize = (values: string[]) =>
  Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

const diffList = (current: string[], previous: string[]) => {
  const currentSet = new Set(current);
  const previousSet = new Set(previous);

  return {
    added: current.filter((value) => !previousSet.has(value)),
    removed: previous.filter((value) => !currentSet.has(value)),
  };
};

export const diffBaselineNote = (current: LabNote, previous: LabNote): BaselineNoteDrift => {
  const currentTags = normalize(current.tags);
  const previousTags = normalize(previous.tags);
  const currentProjects = normalize(current.linkedProjectIds);
  const previousProjects = normalize(previous.linkedProjectIds);
  const currentQuests = normalize(current.linkedQuestIds);
  const previousQuests = normalize(previous.linkedQuestIds);

  const tagDiff = diffList(currentTags, previousTags);
  const projectDiff = diffList(currentProjects, previousProjects);
  const questDiff = diffList(currentQuests, previousQuests);

  const titleChanged = current.title.trim() !== previous.title.trim();
  const contentChanged = current.content.trim() !== previous.content.trim();
  const changed =
    titleChanged ||
    contentChanged ||
    tagDiff.added.length > 0 ||
    tagDiff.removed.length > 0 ||
    projectDiff.added.length > 0 ||
    projectDiff.removed.length > 0 ||
    questDiff.added.length > 0 ||
    questDiff.removed.length > 0;

  return {
    changed,
    titleChanged,
    contentChanged,
    addedTags: tagDiff.added,
    removedTags: tagDiff.removed,
    addedProjectIds: projectDiff.added,
    removedProjectIds: projectDiff.removed,
    addedQuestIds: questDiff.added,
    removedQuestIds: questDiff.removed,
  };
};

export const summarizeBaselineDrift = (drift: BaselineNoteDrift) => {
  if (!drift.changed) return 'Matches previous record';

  const parts: string[] = [];
  if (drift.titleChanged) parts.push('title');
  if (drift.contentChanged) parts.push('content');
  if (drift.addedTags.length) parts.push(`+${drift.addedTags.length} tag${drift.addedTags.length === 1 ? '' : 's'}`);
  if (drift.removedTags.length) parts.push(`-${drift.removedTags.length} tag${drift.removedTags.length === 1 ? '' : 's'}`);
  if (drift.addedProjectIds.length) {
    parts.push(`+${drift.addedProjectIds.length} project${drift.addedProjectIds.length === 1 ? '' : 's'}`);
  }
  if (drift.removedProjectIds.length) {
    parts.push(`-${drift.removedProjectIds.length} project${drift.removedProjectIds.length === 1 ? '' : 's'}`);
  }
  if (drift.addedQuestIds.length) parts.push(`+${drift.addedQuestIds.length} quest${drift.addedQuestIds.length === 1 ? '' : 's'}`);
  if (drift.removedQuestIds.length) {
    parts.push(`-${drift.removedQuestIds.length} quest${drift.removedQuestIds.length === 1 ? '' : 's'}`);
  }

  return parts.join(' · ');
};
