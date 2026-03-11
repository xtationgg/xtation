import { describe, expect, it } from 'vitest';
import {
  resolveGuidedSetupResumeActionLabel,
  shouldOfferGuidedSetupResumeAction,
} from '../src/onboarding/guidedSetupResume';

describe('guided setup resume helpers', () => {
  it('returns continue for a resumed guided setup state', () => {
    expect(
      resolveGuidedSetupResumeActionLabel(
        {
          mode: 'guided',
          entryState: 'resume',
        },
        null
      )
    ).toBe('Continue Guided Setup');
  });

  it('returns return for a skipped starter setup transition', () => {
    expect(
      resolveGuidedSetupResumeActionLabel(
        {
          mode: 'resume',
          entryState: 'resume',
        },
        {
          title: 'Starter setup skipped',
          detail:
            'XTATION left the local Play station open without seeding a starter loop. You can return to guided setup any time from Play.',
        }
      )
    ).toBe('Return to Guided Setup');
  });

  it('does not offer a guided setup action for fresh setup state', () => {
    expect(
      shouldOfferGuidedSetupResumeAction(
        {
          mode: 'guided',
          entryState: 'fresh',
        },
        null
      )
    ).toBe(false);
  });
});
