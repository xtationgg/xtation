import { describe, expect, it } from 'vitest';
import {
  buildBaselineCompareAlignment,
  createBaselineCompareContext,
  buildBaselineCompareRevisionNote,
  parseBaselineCompareBrief,
} from '../src/dusk/baselineCompare';
import type { StoredDuskBrief } from '../src/dusk/bridge';

const brief: StoredDuskBrief = {
  title: 'Ops baseline compare',
  body: [
    'Current baseline: Alpha',
    'Previous baseline: Bravo',
    '',
    'Drift summary: title · +1 tag · +1 quest',
    'Structure: title changed · content unchanged',
    'Tags added: ops',
    'Tags removed: none',
    'Projects added: none',
    'Projects removed: none',
    'Quests added: quest-b',
    'Quests removed: none',
    '',
    'Current provider · Managed OpenAI / gpt-5',
    'Current accepted · Mar 11, 02:00',
    'Current next action · Queue the next action',
    'Current revision note · Tighten the baseline',
    'Current accepted compare current: Alpha',
    'Current accepted compare previous: Bravo',
    'Current accepted compare drift: title · +1 tag',
    '',
    'Previous provider · Managed OpenAI / gpt-5',
    'Previous accepted · Mar 10, 23:30',
    'Previous next action · Re-check the prior brief',
    'Previous revision note · Compare against the older record',
    'Previous accepted compare current: Bravo',
    'Previous accepted compare previous: Gamma',
    'Previous accepted compare drift: content · +1 quest',
    '',
    'Current content',
    'Current body',
    '',
    'Previous content',
    'Previous body',
  ].join('\n'),
  source: 'lab',
  tags: ['dusk', 'baseline-compare', 'baseline-history'],
  linkedQuestIds: ['quest-a'],
  linkedProjectIds: ['project-a'],
  createdAt: 1,
  receivedAt: 2,
};

describe('dusk baseline compare', () => {
  it('parses structured compare briefs', () => {
    const parsed = parseBaselineCompareBrief(brief);

    expect(parsed).toEqual({
      currentTitle: 'Alpha',
      previousTitle: 'Bravo',
      driftSummary: 'title · +1 tag · +1 quest',
      currentContent: 'Current body',
      previousContent: 'Previous body',
      currentProvenance: {
        providerLabel: 'Managed OpenAI',
        model: 'gpt-5',
        acceptedLabel: 'Mar 11, 02:00',
        nextAction: 'Queue the next action',
        revisionNote: 'Tighten the baseline',
        compareCurrentTitle: 'Alpha',
        comparePreviousTitle: 'Bravo',
        compareDriftSummary: 'title · +1 tag',
      },
      previousProvenance: {
        providerLabel: 'Managed OpenAI',
        model: 'gpt-5',
        acceptedLabel: 'Mar 10, 23:30',
        nextAction: 'Re-check the prior brief',
        revisionNote: 'Compare against the older record',
        compareCurrentTitle: 'Bravo',
        comparePreviousTitle: 'Gamma',
        compareDriftSummary: 'content · +1 quest',
      },
    });
  });

  it('builds compact revision note text', () => {
    const parsed = parseBaselineCompareBrief(brief)!;
    expect(buildBaselineCompareRevisionNote(parsed)).toBe(
      ['Current baseline: Alpha', 'Previous baseline: Bravo', 'Drift summary: title · +1 tag · +1 quest'].join('\n')
    );
  });

  it('creates a persistent compare context snapshot', () => {
    const parsed = parseBaselineCompareBrief(brief)!;
    expect(createBaselineCompareContext(parsed, 123)).toEqual({
      currentTitle: 'Alpha',
      previousTitle: 'Bravo',
      driftSummary: 'title · +1 tag · +1 quest',
      loadedAt: 123,
      currentProvenance: {
        providerLabel: 'Managed OpenAI',
        model: 'gpt-5',
        acceptedLabel: 'Mar 11, 02:00',
        nextAction: 'Queue the next action',
        revisionNote: 'Tighten the baseline',
        compareCurrentTitle: 'Alpha',
        comparePreviousTitle: 'Bravo',
        compareDriftSummary: 'title · +1 tag',
      },
      previousProvenance: {
        providerLabel: 'Managed OpenAI',
        model: 'gpt-5',
        acceptedLabel: 'Mar 10, 23:30',
        nextAction: 'Re-check the prior brief',
        revisionNote: 'Compare against the older record',
        compareCurrentTitle: 'Bravo',
        comparePreviousTitle: 'Gamma',
        compareDriftSummary: 'content · +1 quest',
      },
    });
  });

  it('compares a parsed brief against an accepted baseline target', () => {
    const parsed = parseBaselineCompareBrief(brief)!;
    const alignment = buildBaselineCompareAlignment(parsed, {
      acceptedBaselineTitle: 'Alpha',
      acceptedNextAction: 'Do the next thing',
    });

    expect(alignment).toEqual({
      status: 'aligned',
      acceptedBaselineTitle: 'Alpha',
      currentMatchesAccepted: true,
      previousMatchesAccepted: false,
      summary: 'Compare brief is aligned with the accepted baseline.',
      recommendation: 'Use this compare brief to revise the current accepted plan against the latest accepted record.',
    });
  });
});
