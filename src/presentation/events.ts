export type PresentationEventSource =
  | 'app'
  | 'profile'
  | 'scene'
  | 'admin'
  | 'dusk'
  | 'runtime'
  | 'system'
  | 'user';

export interface PresentationEventRecord {
  id: string;
  name: string;
  family: string;
  domain: string;
  action: string;
  source: PresentationEventSource;
  occurredAt: number;
  metadata?: Record<string, unknown>;
}

export interface PresentationEventInput {
  name: string;
  source?: PresentationEventSource;
  metadata?: Record<string, unknown>;
}

export interface PresentationEventFamilySummary {
  family: string;
  count: number;
  lastOccurredAt: number;
}

export const PRESENTATION_EVENTS_STORAGE_KEY = 'xtation_presentation_events_v1';
export const PRESENTATION_EVENTS_CHANGE_EVENT = 'xtation:presentation-events-change';
export const MAX_PRESENTATION_EVENTS = 120;

const sanitizeSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

export const normalizePresentationEventName = (value: string) =>
  value
    .split('.')
    .map((segment) => sanitizeSegment(segment))
    .filter(Boolean)
    .join('.');

export const getPresentationEventFamily = (name: string) =>
  normalizePresentationEventName(name).split('.')[0] || 'misc';

export const getPresentationEventDomain = (name: string) => {
  const parts = normalizePresentationEventName(name).split('.');
  return parts.slice(0, 2).filter(Boolean).join('.') || getPresentationEventFamily(name);
};

export const getPresentationEventAction = (name: string) => {
  const parts = normalizePresentationEventName(name).split('.');
  if (parts.length <= 2) {
    return parts[parts.length - 1] || 'event';
  }
  return parts.slice(2).join('.');
};

export const buildPresentationEventRecord = ({
  name,
  source = 'system',
  metadata,
}: PresentationEventInput): PresentationEventRecord => {
  const normalizedName = normalizePresentationEventName(name);
  return {
    id: `pe_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`,
    name: normalizedName,
    family: getPresentationEventFamily(normalizedName),
    domain: getPresentationEventDomain(normalizedName),
    action: getPresentationEventAction(normalizedName),
    source,
    occurredAt: Date.now(),
    metadata,
  };
};

export const summarizePresentationEventFamilies = (
  events: PresentationEventRecord[]
): PresentationEventFamilySummary[] => {
  const summaries = new Map<string, PresentationEventFamilySummary>();
  events.forEach((event) => {
    const current = summaries.get(event.family);
    if (current) {
      current.count += 1;
      current.lastOccurredAt = Math.max(current.lastOccurredAt, event.occurredAt);
      return;
    }
    summaries.set(event.family, {
      family: event.family,
      count: 1,
      lastOccurredAt: event.occurredAt,
    });
  });
  return Array.from(summaries.values()).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return right.lastOccurredAt - left.lastOccurredAt;
  });
};
