export type AnnouncerTier = 'voice' | 'sound' | 'visual' | 'silent';

export interface AnnouncerEvent {
  tier: AnnouncerTier;
  title: string;        // short phrase: "Station online." "Mission complete."
  detail?: string;      // optional longer text
  sound?: string;       // sound cue event name
}

/**
 * Classify an event into an announcer tier and generate the announcement.
 */
export function classifyEvent(
  eventName: string,
  metadata?: Record<string, unknown>
): AnnouncerEvent | null {
  // Tier 1: VOICE — rare, earned moments (full announcer voice + visual)
  switch (eventName) {
    case 'quest.completed':
      return { tier: 'voice', title: 'Mission complete.', sound: 'dusk.announcement.complete' };
    case 'profile.level.up':
      return { tier: 'voice', title: `Level ${metadata?.level || 'up'}.`, sound: 'dusk.announcement.levelup' };
    case 'app.session.first':
      return { tier: 'voice', title: 'Station online.', sound: 'dusk.announcement.online' };
    case 'profile.streak.milestone':
      const days = metadata?.days || 7;
      return { tier: 'voice', title: `${days} days. Locked in.`, sound: 'dusk.announcement.streak' };
    case 'wire:fired':
      return { tier: 'sound', title: 'Circuit fired.', sound: 'dusk.announcement.circuit' };
  }

  // Tier 2: SOUND — a few times a day (sound only, no voice)
  switch (eventName) {
    case 'session.completed':
      return { tier: 'sound', title: 'Session closed.', sound: 'quest.completed' };
    case 'session.started':
      return { tier: 'sound', title: 'Session started.', sound: 'quest.started' };
    case 'checklist.complete':
      return { tier: 'sound', title: 'Checklist done.', sound: 'ui.button.confirm' };
  }

  // Tier 3: VISUAL — brief text overlay only
  switch (eventName) {
    case 'quest.started':
      return { tier: 'visual', title: 'Quest active.' };
    case 'node:created':
      return { tier: 'silent', title: '' }; // too frequent
  }

  return null; // unrecognized event — silent
}
