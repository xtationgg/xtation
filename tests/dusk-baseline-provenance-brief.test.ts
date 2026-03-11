import { describe, expect, it } from 'vitest';
import {
  buildBaselineProvenanceAlignment,
  buildBaselineProvenanceRevisionNote,
  createBaselineProvenanceContext,
  parseBaselineProvenanceBrief,
} from '../src/dusk/baselineProvenanceBrief';
import type { StoredDuskBrief } from '../src/dusk/bridge';

const brief: StoredDuskBrief = {
  title: 'Ops accepted baseline',
  body: [
    'Baseline title: Bureau Station baseline',
    'Baseline status: accepted baseline',
    'Record updated: 3/11/2026, 10:30:00 AM',
    '',
    'Provider · Managed OpenAI / gpt-5',
    'Accepted · Mar 11, 10:25',
    'Next action · Open the runtime deck',
    'Revision note · Keep the station shell tighter.',
    'Accepted compare current: Bureau Station baseline',
    'Accepted compare previous: Bureau Station prior',
    'Accepted compare drift: 1 quest added · tags unchanged',
    'Accepted compare loadedAt: 123',
    '',
    'Baseline content',
    'Accepted Dusk plan baseline',
    'Main body',
  ].join('\n'),
  source: 'lab',
  tags: ['dusk', 'baseline-provenance', 'baseline-history'],
  linkedQuestIds: ['quest-a'],
  linkedProjectIds: ['project-a'],
  createdAt: 1,
  receivedAt: 2,
};

describe('dusk baseline provenance brief', () => {
  it('parses structured provenance briefs', () => {
    expect(parseBaselineProvenanceBrief(brief)).toEqual({
      baselineTitle: 'Bureau Station baseline',
      baselineStatus: 'accepted baseline',
      recordUpdated: '3/11/2026, 10:30:00 AM',
      providerLabel: 'Managed OpenAI',
      model: 'gpt-5',
      acceptedLabel: 'Mar 11, 10:25',
      nextAction: 'Open the runtime deck',
      revisionNote: 'Keep the station shell tighter.',
      compareCurrentTitle: 'Bureau Station baseline',
      comparePreviousTitle: 'Bureau Station prior',
      compareDriftSummary: '1 quest added · tags unchanged',
      compareLoadedAt: 123,
      baselineContent: ['Accepted Dusk plan baseline', 'Main body'].join('\n'),
    });
  });

  it('builds a compact revision note and context snapshot', () => {
    const parsed = parseBaselineProvenanceBrief(brief)!;
    expect(buildBaselineProvenanceRevisionNote(parsed)).toBe(
      [
        'Accepted baseline: Bureau Station baseline',
        'Accepted: Mar 11, 10:25',
        'Next action: Open the runtime deck',
        'Compare drift: 1 quest added · tags unchanged',
      ].join('\n')
    );
    expect(createBaselineProvenanceContext(parsed, 456)).toEqual({
      baselineTitle: 'Bureau Station baseline',
      acceptedLabel: 'Mar 11, 10:25',
      nextAction: 'Open the runtime deck',
      revisionNote: 'Keep the station shell tighter.',
      providerLabel: 'Managed OpenAI',
      model: 'gpt-5',
      compareCurrentTitle: 'Bureau Station baseline',
      comparePreviousTitle: 'Bureau Station prior',
      compareDriftSummary: '1 quest added · tags unchanged',
      compareLoadedAt: 123,
      loadedAt: 456,
    });
  });

  it('compares a parsed provenance brief against an accepted target', () => {
    const parsed = parseBaselineProvenanceBrief(brief)!;
    expect(
      buildBaselineProvenanceAlignment(parsed, {
        acceptedBaselineTitle: 'Bureau Station baseline',
        acceptedNextAction: 'Open the runtime deck',
      })
    ).toEqual({
      status: 'aligned',
      acceptedBaselineTitle: 'Bureau Station baseline',
      baselineMatchesAccepted: true,
      nextActionMatchesAccepted: true,
      summary: 'Accepted baseline provenance is aligned with the accepted plan.',
      recommendation:
        'Use this provenance as the current decision anchor for the plan unless you intend to revise away from the accepted baseline.',
    });
  });
});
