import type { LabNote } from './types';

export interface BaselineNoteProvenance {
  providerLabel: string | null;
  model: string | null;
  acceptedLabel: string | null;
  nextAction: string | null;
  revisionNote: string | null;
  compareCurrentTitle: string | null;
  comparePreviousTitle: string | null;
  compareDriftSummary: string | null;
  compareLoadedAt: number | null;
}

export interface BaselineDecisionAnchor {
  status: 'ready' | 'tracked' | 'review';
  summary: string;
  recommendation: string;
}

export const formatBaselineProvenanceProvider = (provenance: BaselineNoteProvenance | null | undefined) => {
  if (!provenance) return null;
  return [provenance.providerLabel, provenance.model].filter(Boolean).join(' / ') || null;
};

export const buildBaselineDecisionAnchor = (provenance: BaselineNoteProvenance | null | undefined): BaselineDecisionAnchor | null => {
  if (!provenance) return null;

  const hasAccepted = !!provenance.acceptedLabel;
  const hasNextAction = !!provenance.nextAction;
  const hasCompare = !!(provenance.compareCurrentTitle || provenance.compareDriftSummary);

  if (hasAccepted && hasNextAction && hasCompare) {
    return {
      status: 'ready',
      summary: 'Accepted plan, next action, and compare anchor are preserved.',
      recommendation: 'Use this baseline as a decision anchor when sending it back to Dusk or comparing newer records.',
    };
  }

  if (hasAccepted && hasNextAction) {
    return {
      status: 'tracked',
      summary: 'Accepted plan and next action are preserved.',
      recommendation: 'This record is reusable, but it does not carry full compare-anchor context yet.',
    };
  }

  return {
    status: 'review',
    summary: 'Accepted provenance is incomplete.',
    recommendation: 'Review this baseline before using it as the main decision anchor for a new revision.',
  };
};

const extractLineValue = (content: string, prefix: string) => {
  const line = content
    .split('\n')
    .find((entry) => entry.startsWith(prefix));
  const value = line?.slice(prefix.length).trim();
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

export const parseBaselineNoteProvenance = (note: LabNote | null | undefined): BaselineNoteProvenance | null => {
  if (!note) return null;
  const content = note.content || '';
  if (!content.includes('Accepted Dusk plan baseline')) return null;

  const provider = parseProviderLine(extractLineValue(content, 'Provider · '));
  const acceptedLabel = extractLineValue(content, 'Accepted · ');
  const nextAction = extractLineValue(content, 'Next action · ');
  const revisionNote = extractLineValue(content, 'Revision note · ');
  const compareCurrentTitle = extractLineValue(content, 'Accepted compare current: ');
  const comparePreviousTitle = extractLineValue(content, 'Accepted compare previous: ');
  const compareDriftSummary = extractLineValue(content, 'Accepted compare drift: ');
  const compareLoadedAtValue = extractLineValue(content, 'Accepted compare loadedAt: ');
  const compareLoadedAt =
    compareLoadedAtValue && Number.isFinite(Number(compareLoadedAtValue)) ? Number(compareLoadedAtValue) : null;

  return {
    providerLabel: provider.providerLabel,
    model: provider.model,
    acceptedLabel,
    nextAction,
    revisionNote,
    compareCurrentTitle,
    comparePreviousTitle,
    compareDriftSummary,
    compareLoadedAt,
  };
};
