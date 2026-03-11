import { describe, expect, it } from 'vitest';
import {
  buildPresentationEventRecord,
  getPresentationEventAction,
  getPresentationEventDomain,
  getPresentationEventFamily,
  normalizePresentationEventName,
  summarizePresentationEventFamilies,
} from '../src/presentation/events';

describe('presentation events', () => {
  it('normalizes semantic event names into stable dotted slugs', () => {
    expect(normalizePresentationEventName('Profile Status Open')).toBe('profile_status_open');
    expect(normalizePresentationEventName('profile.status.open')).toBe('profile.status.open');
    expect(normalizePresentationEventName('nav.section.MATCH_FOUND.open')).toBe('nav.section.match_found.open');
  });

  it('derives family, domain, and action from a semantic event', () => {
    expect(getPresentationEventFamily('profile.status.open')).toBe('profile');
    expect(getPresentationEventDomain('profile.status.open')).toBe('profile.status');
    expect(getPresentationEventAction('profile.status.open')).toBe('open');
  });

  it('builds records with stable semantic slices', () => {
    const record = buildPresentationEventRecord({
      name: 'quest.completed',
      source: 'system',
      metadata: { level: 3 },
    });
    expect(record.name).toBe('quest.completed');
    expect(record.family).toBe('quest');
    expect(record.domain).toBe('quest.completed');
    expect(record.action).toBe('completed');
    expect(record.metadata).toEqual({ level: 3 });
  });

  it('summarizes counts by family', () => {
    const events = [
      buildPresentationEventRecord({ name: 'profile.deck.open', source: 'profile' }),
      buildPresentationEventRecord({ name: 'profile.deck.close', source: 'profile' }),
      buildPresentationEventRecord({ name: 'dusk.brief.loaded', source: 'dusk' }),
    ];
    const summary = summarizePresentationEventFamilies(events);
    expect(summary[0]?.family).toBe('profile');
    expect(summary[0]?.count).toBe(2);
    expect(summary[1]?.family).toBe('dusk');
    expect(summary[1]?.count).toBe(1);
  });
});
