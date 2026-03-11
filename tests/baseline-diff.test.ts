import { describe, expect, it } from 'vitest';
import type { LabNote } from '../src/lab/types';
import { diffBaselineNote, summarizeBaselineDrift } from '../src/lab/baselineDiff';

const buildNote = (overrides: Partial<LabNote> = {}): LabNote => ({
  id: 'note-1',
  title: 'Baseline A',
  content: 'Original content',
  kind: 'plan',
  status: 'active',
  pinned: true,
  tags: ['baseline', 'managed-provider'],
  linkedQuestIds: ['quest-a'],
  linkedProjectIds: ['project-a'],
  updatedAt: 10,
  createdAt: 1,
  ...overrides,
});

describe('baseline diff', () => {
  it('detects title, content, tag, project, and quest changes', () => {
    const previous = buildNote();
    const current = buildNote({
      title: 'Baseline B',
      content: 'Changed content',
      tags: ['baseline', 'ops', 'managed-provider'],
      linkedProjectIds: ['project-a', 'project-b'],
      linkedQuestIds: [],
    });

    const drift = diffBaselineNote(current, previous);

    expect(drift.changed).toBe(true);
    expect(drift.titleChanged).toBe(true);
    expect(drift.contentChanged).toBe(true);
    expect(drift.addedTags).toEqual(['ops']);
    expect(drift.addedProjectIds).toEqual(['project-b']);
    expect(drift.removedQuestIds).toEqual(['quest-a']);
  });

  it('summarizes drift compactly', () => {
    const summary = summarizeBaselineDrift(
      diffBaselineNote(
        buildNote({
          title: 'Baseline B',
          tags: ['baseline', 'managed-provider', 'ops'],
          linkedQuestIds: ['quest-a', 'quest-b'],
        }),
        buildNote()
      )
    );

    expect(summary).toBe('title · +1 tag · +1 quest');
  });

  it('reports identical records cleanly', () => {
    const summary = summarizeBaselineDrift(diffBaselineNote(buildNote(), buildNote()));
    expect(summary).toBe('Matches previous record');
  });
});
