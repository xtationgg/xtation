import { describe, expect, it } from 'vitest';
import { buildBaselineCompareHandoff, buildBaselineProvenanceHandoff } from '../src/lab/baselineHandoff';
import type { LabNote } from '../src/lab/types';

const createBaselineNote = (overrides: Partial<LabNote> = {}): LabNote => ({
  id: overrides.id || 'note-1',
  title: overrides.title || 'Accepted station plan',
  content:
    overrides.content ||
    [
      'Accepted Dusk plan baseline',
      'Provider · OpenAI / gpt-5.4',
      'Accepted · Mar 11, 09:00',
      'Next action · Open the control room',
      'Revision note · Tighten the execution lane.',
      'Accepted compare current: Accepted station plan',
      'Accepted compare previous: Earlier station plan',
      'Accepted compare drift: 1 quest added · tags unchanged',
      '',
      'Main baseline body.',
    ].join('\n'),
  kind: overrides.kind || 'plan',
  status: overrides.status || 'active',
  pinned: overrides.pinned ?? true,
  tags: overrides.tags || ['lab', 'baseline', 'dusk-baseline'],
  linkedProjectIds: overrides.linkedProjectIds || ['project-1'],
  linkedQuestIds: overrides.linkedQuestIds || ['quest-1'],
  createdAt: overrides.createdAt || 1,
  updatedAt: overrides.updatedAt || 2,
});

describe('baseline handoff builders', () => {
  it('builds a provenance handoff for a standalone accepted baseline', () => {
    const note = createBaselineNote();
    const payload = buildBaselineProvenanceHandoff(note);

    expect(payload.mode).toBe('provenance');
    expect(payload.title).toContain('accepted baseline');
    expect(payload.tags).toContain('baseline-provenance');
    expect(payload.body).toContain('Provider · OpenAI / gpt-5.4');
    expect(payload.body).toContain('Accepted compare drift: 1 quest added · tags unchanged');
    expect(payload.body).toContain('Baseline content');
  });

  it('builds a compare handoff with merged provenance and linked scope', () => {
    const current = createBaselineNote({
      id: 'current',
      title: 'Current baseline',
      linkedProjectIds: ['project-1', 'project-2'],
      linkedQuestIds: ['quest-1', 'quest-2'],
      tags: ['lab', 'baseline', 'dusk-baseline'],
    });
    const previous = createBaselineNote({
      id: 'previous',
      title: 'Previous baseline',
      content:
        [
          'Accepted Dusk plan baseline',
          'Provider · Anthropic / claude-sonnet',
          'Accepted · Mar 10, 18:00',
          'Next action · Review the prior lane',
          '',
          'Earlier baseline body.',
        ].join('\n'),
      linkedProjectIds: ['project-9'],
      linkedQuestIds: ['quest-7'],
      tags: ['lab', 'baseline'],
    });

    const payload = buildBaselineCompareHandoff(current, previous);

    expect(payload.mode).toBe('compare');
    expect(payload.tags).toContain('baseline-compare');
    expect(payload.body).toContain('Current provider · OpenAI / gpt-5.4');
    expect(payload.body).toContain('Previous provider · Anthropic / claude-sonnet');
    expect(payload.body).toContain('Current content');
    expect(payload.body).toContain('Previous content');
    expect(payload.linkedProjectIds).toEqual(expect.arrayContaining(['project-1', 'project-2', 'project-9']));
    expect(payload.linkedQuestIds).toEqual(expect.arrayContaining(['quest-1', 'quest-2', 'quest-7']));
  });
});
