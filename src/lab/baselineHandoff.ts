import { diffBaselineNote, summarizeBaselineDrift } from './baselineDiff';
import { formatBaselineProvenanceProvider, parseBaselineNoteProvenance } from './baselineProvenance';
import type { LabNote } from './types';

export interface BaselineHandoffPayload {
  mode: 'compare' | 'provenance';
  title: string;
  body: string;
  tags: string[];
  linkedQuestIds: string[];
  linkedProjectIds: string[];
}

const mergeIds = (...lists: string[][]) => Array.from(new Set(lists.flat()));

const mergeTags = (...lists: string[][]) => Array.from(new Set(lists.flat().filter(Boolean)));

export const buildBaselineCompareHandoff = (current: LabNote, previous: LabNote): BaselineHandoffPayload => {
  const drift = diffBaselineNote(current, previous);
  const currentProvenance = parseBaselineNoteProvenance(current);
  const previousProvenance = parseBaselineNoteProvenance(previous);

  return {
    mode: 'compare',
    title: `${current.title} · baseline compare`,
    body: [
      `Current baseline: ${current.title}`,
      `Previous baseline: ${previous.title}`,
      '',
      `Drift summary: ${summarizeBaselineDrift(drift)}`,
      `Structure: title ${drift.titleChanged ? 'changed' : 'unchanged'} · content ${drift.contentChanged ? 'changed' : 'unchanged'}`,
      `Tags added: ${drift.addedTags.length ? drift.addedTags.join(', ') : 'none'}`,
      `Tags removed: ${drift.removedTags.length ? drift.removedTags.join(', ') : 'none'}`,
      `Projects added: ${drift.addedProjectIds.length ? drift.addedProjectIds.join(', ') : 'none'}`,
      `Projects removed: ${drift.removedProjectIds.length ? drift.removedProjectIds.join(', ') : 'none'}`,
      `Quests added: ${drift.addedQuestIds.length ? drift.addedQuestIds.join(', ') : 'none'}`,
      `Quests removed: ${drift.removedQuestIds.length ? drift.removedQuestIds.join(', ') : 'none'}`,
      ...(currentProvenance
        ? [
            '',
            `Current provider · ${formatBaselineProvenanceProvider(currentProvenance) || 'Unknown'}`,
            `Current accepted · ${currentProvenance.acceptedLabel || 'Unknown'}`,
            `Current next action · ${currentProvenance.nextAction || 'None'}`,
            `Current revision note · ${currentProvenance.revisionNote || 'None'}`,
            `Current accepted compare current: ${currentProvenance.compareCurrentTitle || 'None'}`,
            `Current accepted compare previous: ${currentProvenance.comparePreviousTitle || 'None'}`,
            `Current accepted compare drift: ${currentProvenance.compareDriftSummary || 'None'}`,
          ]
        : []),
      ...(previousProvenance
        ? [
            '',
            `Previous provider · ${formatBaselineProvenanceProvider(previousProvenance) || 'Unknown'}`,
            `Previous accepted · ${previousProvenance.acceptedLabel || 'Unknown'}`,
            `Previous next action · ${previousProvenance.nextAction || 'None'}`,
            `Previous revision note · ${previousProvenance.revisionNote || 'None'}`,
            `Previous accepted compare current: ${previousProvenance.compareCurrentTitle || 'None'}`,
            `Previous accepted compare previous: ${previousProvenance.comparePreviousTitle || 'None'}`,
            `Previous accepted compare drift: ${previousProvenance.compareDriftSummary || 'None'}`,
          ]
        : []),
      '',
      'Current content',
      current.content.trim() || 'No current content.',
      '',
      'Previous content',
      previous.content.trim() || 'No previous content.',
    ].join('\n'),
    tags: mergeTags(current.tags, previous.tags, ['baseline-compare', 'baseline-history']),
    linkedQuestIds: mergeIds(current.linkedQuestIds, previous.linkedQuestIds),
    linkedProjectIds: mergeIds(current.linkedProjectIds, previous.linkedProjectIds),
  };
};

export const buildBaselineProvenanceHandoff = (note: LabNote): BaselineHandoffPayload => {
  const provenance = parseBaselineNoteProvenance(note);

  return {
    mode: 'provenance',
    title: `${note.title} · accepted baseline`,
    body: [
      `Baseline title: ${note.title}`,
      `Baseline status: accepted baseline`,
      `Record updated: ${new Date(note.updatedAt).toLocaleString()}`,
      '',
      ...(provenance
        ? [
            `Provider · ${formatBaselineProvenanceProvider(provenance) || 'Unknown'}`,
            `Accepted · ${provenance.acceptedLabel || 'Unknown'}`,
            `Next action · ${provenance.nextAction || 'None'}`,
            `Revision note · ${provenance.revisionNote || 'None'}`,
            `Accepted compare current: ${provenance.compareCurrentTitle || 'None'}`,
            `Accepted compare previous: ${provenance.comparePreviousTitle || 'None'}`,
            `Accepted compare drift: ${provenance.compareDriftSummary || 'None'}`,
            ...(provenance.compareLoadedAt ? [`Accepted compare loadedAt: ${provenance.compareLoadedAt}`] : []),
            '',
          ]
        : ['Provider · Unknown', 'Accepted · Unknown', '', '']),
      'Baseline content',
      note.content.trim() || 'No baseline content.',
    ].join('\n'),
    tags: mergeTags(note.tags, ['baseline-provenance', 'baseline-history']),
    linkedQuestIds: [...note.linkedQuestIds],
    linkedProjectIds: [...note.linkedProjectIds],
  };
};
