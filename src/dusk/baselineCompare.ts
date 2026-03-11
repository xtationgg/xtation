import type { StoredDuskBrief } from './bridge';

export interface DuskBaselineCompareBrief {
  currentTitle: string | null;
  previousTitle: string | null;
  driftSummary: string | null;
  currentContent: string | null;
  previousContent: string | null;
  currentProvenance: DuskBaselineCompareProvenance | null;
  previousProvenance: DuskBaselineCompareProvenance | null;
}

export interface DuskBaselineCompareProvenance {
  providerLabel: string | null;
  model: string | null;
  acceptedLabel: string | null;
  nextAction: string | null;
  revisionNote: string | null;
  compareCurrentTitle: string | null;
  comparePreviousTitle: string | null;
  compareDriftSummary: string | null;
}

export interface DuskBaselineCompareContext {
  currentTitle: string | null;
  previousTitle: string | null;
  driftSummary: string | null;
  loadedAt: number;
  currentProvenance: DuskBaselineCompareProvenance | null;
  previousProvenance: DuskBaselineCompareProvenance | null;
}

export interface DuskAcceptedBaselineTarget {
  acceptedBaselineTitle?: string | null;
  acceptedNextAction?: string | null;
}

export interface DuskBaselineCompareAlignment {
  status: 'aligned' | 'previous' | 'mismatch';
  acceptedBaselineTitle: string | null;
  currentMatchesAccepted: boolean | null;
  previousMatchesAccepted: boolean | null;
  summary: string;
  recommendation: string;
}

const extractSection = (body: string, heading: string, nextHeading: string | null) => {
  const startToken = `${heading}\n`;
  const startIndex = body.indexOf(startToken);
  if (startIndex === -1) return null;
  const contentStart = startIndex + startToken.length;

  if (!nextHeading) {
    const value = body.slice(contentStart).trim();
    return value || null;
  }

  const endToken = `\n\n${nextHeading}\n`;
  const endIndex = body.indexOf(endToken, contentStart);
  const value = (endIndex === -1 ? body.slice(contentStart) : body.slice(contentStart, endIndex)).trim();
  return value || null;
};

const extractLineValue = (body: string, prefix: string) => {
  const line = body
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

const parseCompareProvenance = (body: string, prefix: 'Current' | 'Previous'): DuskBaselineCompareProvenance | null => {
  const provider = parseProviderLine(extractLineValue(body, `${prefix} provider · `));
  const acceptedLabel = extractLineValue(body, `${prefix} accepted · `);
  const nextAction = extractLineValue(body, `${prefix} next action · `);
  const revisionNote = extractLineValue(body, `${prefix} revision note · `);
  const compareCurrentTitle = extractLineValue(body, `${prefix} accepted compare current: `);
  const comparePreviousTitle = extractLineValue(body, `${prefix} accepted compare previous: `);
  const compareDriftSummary = extractLineValue(body, `${prefix} accepted compare drift: `);

  if (
    !provider.providerLabel &&
    !provider.model &&
    !acceptedLabel &&
    !nextAction &&
    !revisionNote &&
    !compareCurrentTitle &&
    !comparePreviousTitle &&
    !compareDriftSummary
  ) {
    return null;
  }

  return {
    providerLabel: provider.providerLabel,
    model: provider.model,
    acceptedLabel,
    nextAction,
    revisionNote,
    compareCurrentTitle,
    comparePreviousTitle,
    compareDriftSummary,
  };
};

export const isBaselineCompareBrief = (brief: StoredDuskBrief | null | undefined) =>
  !!brief && !!brief.tags?.some((tag) => tag === 'baseline-compare');

export const parseBaselineCompareBrief = (brief: StoredDuskBrief | null | undefined): DuskBaselineCompareBrief | null => {
  if (!isBaselineCompareBrief(brief)) return null;

  const body = brief?.body || '';
  return {
    currentTitle: extractLineValue(body, 'Current baseline: '),
    previousTitle: extractLineValue(body, 'Previous baseline: '),
    driftSummary: extractLineValue(body, 'Drift summary: '),
    currentContent: extractSection(body, 'Current content', 'Previous content'),
    previousContent: extractSection(body, 'Previous content', null),
    currentProvenance: parseCompareProvenance(body, 'Current'),
    previousProvenance: parseCompareProvenance(body, 'Previous'),
  };
};

export const buildBaselineCompareRevisionNote = (compare: DuskBaselineCompareBrief) => {
  const parts = [
    compare.currentTitle ? `Current baseline: ${compare.currentTitle}` : null,
    compare.previousTitle ? `Previous baseline: ${compare.previousTitle}` : null,
    compare.driftSummary ? `Drift summary: ${compare.driftSummary}` : null,
  ].filter(Boolean);

  return parts.join('\n');
};

export const createBaselineCompareContext = (
  compare: DuskBaselineCompareBrief | null | undefined,
  loadedAt = Date.now()
): DuskBaselineCompareContext | undefined => {
  if (!compare) return undefined;
  return {
    currentTitle: compare.currentTitle,
    previousTitle: compare.previousTitle,
    driftSummary: compare.driftSummary,
    loadedAt,
    currentProvenance: compare.currentProvenance,
    previousProvenance: compare.previousProvenance,
  };
};

const normalizeTitle = (value?: string | null) => value?.trim().toLowerCase() || null;

export const buildBaselineCompareAlignment = (
  compare: DuskBaselineCompareBrief | null | undefined,
  target: DuskAcceptedBaselineTarget | null | undefined
): DuskBaselineCompareAlignment | null => {
  if (!compare || !target?.acceptedBaselineTitle) return null;

  const acceptedBaselineTitle = target.acceptedBaselineTitle;
  const acceptedNormalized = normalizeTitle(acceptedBaselineTitle);
  const currentMatchesAccepted = compare.currentTitle ? normalizeTitle(compare.currentTitle) === acceptedNormalized : null;
  const previousMatchesAccepted = compare.previousTitle ? normalizeTitle(compare.previousTitle) === acceptedNormalized : null;

  let status: DuskBaselineCompareAlignment['status'] = 'mismatch';
  let summary = 'Compare brief does not match the accepted baseline.';
  let recommendation = 'Review the accepted plan and baseline history before saving a new revision.';
  if (currentMatchesAccepted) {
    status = 'aligned';
    summary = 'Compare brief is aligned with the accepted baseline.';
    recommendation = 'Use this compare brief to revise the current accepted plan against the latest accepted record.';
  } else if (previousMatchesAccepted) {
    status = 'previous';
    summary = 'Compare brief points to the baseline immediately before the accepted one.';
    recommendation = 'The accepted plan is ahead of this compare brief. Review drift before replacing the current revision note.';
  }

  return {
    status,
    acceptedBaselineTitle,
    currentMatchesAccepted,
    previousMatchesAccepted,
    summary,
    recommendation,
  };
};
