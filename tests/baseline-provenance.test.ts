import { describe, expect, it } from 'vitest';
import { parseBaselineNoteProvenance } from '../src/lab/baselineProvenance';
import type { LabNote } from '../src/lab/types';

const baselineNote: LabNote = {
  id: 'note-1',
  title: 'Dusk baseline · Resume XTATION architecture',
  content: [
    'Accepted Dusk plan baseline',
    '',
    'Provider · Managed OpenAI / gpt-5',
    'Accepted · Mar 11, 02:00',
    'Next action · Capture the current station state before queuing the next action.',
    'Revision note · Save the station state before running anything destructive.',
    'Accepted compare current: Alpha',
    'Accepted compare previous: Bravo',
    'Accepted compare drift: title · +1 tag',
    'Accepted compare loadedAt: 123',
    '',
    'Requested tools',
    '1. xtation_capture_station_note — Preserve the latest planning state.',
  ].join('\n'),
  kind: 'plan',
  status: 'active',
  pinned: true,
  tags: ['baseline', 'dusk-baseline'],
  linkedQuestIds: [],
  linkedProjectIds: [],
  updatedAt: 1,
  createdAt: 1,
};

describe('baseline note provenance', () => {
  it('parses accepted plan provenance from promoted Dusk baseline notes', () => {
    expect(parseBaselineNoteProvenance(baselineNote)).toEqual({
      providerLabel: 'Managed OpenAI',
      model: 'gpt-5',
      acceptedLabel: 'Mar 11, 02:00',
      nextAction: 'Capture the current station state before queuing the next action.',
      revisionNote: 'Save the station state before running anything destructive.',
      compareCurrentTitle: 'Alpha',
      comparePreviousTitle: 'Bravo',
      compareDriftSummary: 'title · +1 tag',
      compareLoadedAt: 123,
    });
  });

  it('returns null for non-baseline notes', () => {
    expect(
      parseBaselineNoteProvenance({
        ...baselineNote,
        content: 'Plain note body',
      })
    ).toBeNull();
  });
});
