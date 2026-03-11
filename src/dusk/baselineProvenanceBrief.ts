import type { StoredDuskBrief } from './bridge';

export interface DuskBaselineProvenanceBrief {
  baselineTitle: string | null;
  baselineStatus: string | null;
  recordUpdated: string | null;
  providerLabel: string | null;
  model: string | null;
  acceptedLabel: string | null;
  nextAction: string | null;
  revisionNote: string | null;
  compareCurrentTitle: string | null;
  comparePreviousTitle: string | null;
  compareDriftSummary: string | null;
  compareLoadedAt: number | null;
  baselineContent: string | null;
}

export interface DuskBaselineProvenanceContext {
  baselineTitle: string | null;
  acceptedLabel: string | null;
  nextAction: string | null;
  revisionNote: string | null;
  providerLabel: string | null;
  model: string | null;
  compareCurrentTitle: string | null;
  comparePreviousTitle: string | null;
  compareDriftSummary: string | null;
  compareLoadedAt: number | null;
  loadedAt: number;
}

export interface DuskBaselineProvenanceTarget {
  acceptedBaselineTitle?: string | null;
  acceptedNextAction?: string | null;
}

export interface DuskBaselineProvenanceAlignment {
  status: 'aligned' | 'action-drift' | 'mismatch';
  acceptedBaselineTitle: string | null;
  baselineMatchesAccepted: boolean | null;
  nextActionMatchesAccepted: boolean | null;
  summary: string;
  recommendation: string;
}

const extractLineValue = (body: string, prefix: string) => {
  const line = body
    .split('\n')
    .find((entry) => entry.startsWith(prefix));
  const value = line?.slice(prefix.length).trim();
  return value || null;
};

const extractSection = (body: string, heading: string) => {
  const startToken = `${heading}\n`;
  const startIndex = body.indexOf(startToken);
  if (startIndex === -1) return null;
  const contentStart = startIndex + startToken.length;
  const value = body.slice(contentStart).trim();
  return value || null;
};

const parseProviderLine = (value: string | null) => {
  if (!value) {
    return { providerLabel: null, model: null };
  }
  const [providerLabel, model] = value.split('/').map((item) => item.trim());
  return {
    providerLabel: providerLabel || null,
    model: model || null,
  };
};

export const isBaselineProvenanceBrief = (brief: StoredDuskBrief | null | undefined) =>
  !!brief &&
  !!brief.tags?.some((tag) => tag === 'baseline-provenance') &&
  !brief.tags?.some((tag) => tag === 'baseline-compare');

export const parseBaselineProvenanceBrief = (brief: StoredDuskBrief | null | undefined): DuskBaselineProvenanceBrief | null => {
  if (!isBaselineProvenanceBrief(brief)) return null;

  const body = brief?.body || '';
  const provider = parseProviderLine(extractLineValue(body, 'Provider · '));
  const compareLoadedAtValue = extractLineValue(body, 'Accepted compare loadedAt: ');
  const compareLoadedAt =
    compareLoadedAtValue && Number.isFinite(Number(compareLoadedAtValue)) ? Number(compareLoadedAtValue) : null;

  return {
    baselineTitle: extractLineValue(body, 'Baseline title: '),
    baselineStatus: extractLineValue(body, 'Baseline status: '),
    recordUpdated: extractLineValue(body, 'Record updated: '),
    providerLabel: provider.providerLabel,
    model: provider.model,
    acceptedLabel: extractLineValue(body, 'Accepted · '),
    nextAction: extractLineValue(body, 'Next action · '),
    revisionNote: extractLineValue(body, 'Revision note · '),
    compareCurrentTitle: extractLineValue(body, 'Accepted compare current: '),
    comparePreviousTitle: extractLineValue(body, 'Accepted compare previous: '),
    compareDriftSummary: extractLineValue(body, 'Accepted compare drift: '),
    compareLoadedAt,
    baselineContent: extractSection(body, 'Baseline content'),
  };
};

export const buildBaselineProvenanceRevisionNote = (provenance: DuskBaselineProvenanceBrief) =>
  [
    provenance.baselineTitle ? `Accepted baseline: ${provenance.baselineTitle}` : null,
    provenance.acceptedLabel ? `Accepted: ${provenance.acceptedLabel}` : null,
    provenance.nextAction ? `Next action: ${provenance.nextAction}` : null,
    provenance.compareDriftSummary ? `Compare drift: ${provenance.compareDriftSummary}` : null,
  ]
    .filter(Boolean)
    .join('\n');

export const createBaselineProvenanceContext = (
  provenance: DuskBaselineProvenanceBrief | null | undefined,
  loadedAt = Date.now()
): DuskBaselineProvenanceContext | undefined => {
  if (!provenance) return undefined;
  return {
    baselineTitle: provenance.baselineTitle,
    acceptedLabel: provenance.acceptedLabel,
    nextAction: provenance.nextAction,
    revisionNote: provenance.revisionNote,
    providerLabel: provenance.providerLabel,
    model: provenance.model,
    compareCurrentTitle: provenance.compareCurrentTitle,
    comparePreviousTitle: provenance.comparePreviousTitle,
    compareDriftSummary: provenance.compareDriftSummary,
    compareLoadedAt: provenance.compareLoadedAt,
    loadedAt,
  };
};

export const formatBaselineProvenanceBriefProvider = (provenance: DuskBaselineProvenanceBrief | DuskBaselineProvenanceContext | null | undefined) =>
  [provenance?.providerLabel, provenance?.model].filter(Boolean).join(' / ') || 'Unknown';

const normalizeValue = (value?: string | null) => value?.trim().toLowerCase() || null;

export const buildBaselineProvenanceAlignment = (
  provenance: DuskBaselineProvenanceBrief | DuskBaselineProvenanceContext | null | undefined,
  target: DuskBaselineProvenanceTarget | null | undefined
): DuskBaselineProvenanceAlignment | null => {
  if (!provenance || !target?.acceptedBaselineTitle) return null;

  const acceptedBaselineTitle = target.acceptedBaselineTitle;
  const acceptedNormalized = normalizeValue(acceptedBaselineTitle);
  const baselineMatchesAccepted = provenance.baselineTitle ? normalizeValue(provenance.baselineTitle) === acceptedNormalized : null;
  const nextActionMatchesAccepted =
    provenance.nextAction && target.acceptedNextAction
      ? normalizeValue(provenance.nextAction) === normalizeValue(target.acceptedNextAction)
      : null;

  if (baselineMatchesAccepted && (nextActionMatchesAccepted === true || nextActionMatchesAccepted === null)) {
    return {
      status: 'aligned',
      acceptedBaselineTitle,
      baselineMatchesAccepted,
      nextActionMatchesAccepted,
      summary: 'Accepted baseline provenance is aligned with the accepted plan.',
      recommendation: 'Use this provenance as the current decision anchor for the plan unless you intend to revise away from the accepted baseline.',
    };
  }

  if (baselineMatchesAccepted) {
    return {
      status: 'action-drift',
      acceptedBaselineTitle,
      baselineMatchesAccepted,
      nextActionMatchesAccepted,
      summary: 'Accepted baseline matches, but the saved next action differs from the current accepted plan.',
      recommendation: 'Review the accepted next action before replacing the revision note or running the draft.',
    };
  }

  return {
    status: 'mismatch',
    acceptedBaselineTitle,
    baselineMatchesAccepted,
    nextActionMatchesAccepted,
    summary: 'Accepted baseline provenance points to a different baseline than the current accepted plan.',
    recommendation: 'Load the accepted plan or review Lab baseline history before using this provenance as a decision anchor.',
  };
};
