import React from 'react';
import { ArrowRightLeft, HardDriveDownload, ShieldCheck } from 'lucide-react';
import type { LocalStationStatus } from '../../src/welcome/localStationStatus';
import type { LocalEntryTransitionDescriptor } from '../../src/welcome/localEntryTransition';
import type { StationActivityEntry } from '../../src/station/stationActivity';
import type { StationStarterFlowSummary } from '../../src/station/starterFlow';
import { buildContinuityActivityPreview } from '../../src/station/continuityActivity';
import {
  resolveGuidedSetupResumeActionLabel,
  shouldOfferGuidedSetupResumeAction,
} from '../../src/onboarding/guidedSetupResume';

interface StationContinuityPanelProps {
  status: LocalStationStatus;
  releaseChannel?: string;
  plan?: string;
  trialDays?: number | null;
  activity?: StationActivityEntry[];
  starterFlowSummary?: StationStarterFlowSummary | null;
  latestTransitionActivity?: StationActivityEntry | null;
  entryDescriptor?: LocalEntryTransitionDescriptor | null;
  onOpenGuidedSetup?: (() => void) | null;
  variant: 'welcome' | 'drawer';
}

const formatActivityTime = (createdAt: number) => {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Recent';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const normalizeCopy = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';

const primarySummaryCoversLatestTransition = (
  status: LocalStationStatus,
  latestTransitionActivity: StationActivityEntry | null
) => {
  if (!latestTransitionActivity) return false;

  const latestTitle = normalizeCopy(latestTransitionActivity.title);
  const latestDetail = normalizeCopy(latestTransitionActivity.detail);
  const statusTitle = normalizeCopy(status.title);
  const statusDetail = normalizeCopy(status.detail);
  const relayTitle = normalizeCopy(status.relayTitle);

  return (
    statusTitle === latestTitle ||
    relayTitle === latestTitle ||
    (latestDetail.length > 0 && statusDetail.includes(latestDetail))
  );
};

const primarySummaryCoversEntryDescriptor = (
  status: LocalStationStatus,
  entryDescriptor: LocalEntryTransitionDescriptor | null
) => {
  if (!entryDescriptor) return false;

  const statusTitle = normalizeCopy(status.title);
  const statusDetail = normalizeCopy(status.detail);
  const relayTitle = normalizeCopy(status.relayTitle);
  const entryTitle = normalizeCopy(entryDescriptor.title);
  const entryDetail = normalizeCopy(entryDescriptor.detail);
  const sameWorkspace = status.workspaceLabel === entryDescriptor.workspaceLabel;
  const bothLocalStation =
    statusTitle.includes('local station') && entryTitle.includes('local station');
  const bothStarterLoop =
    statusTitle.includes('starter loop') && entryTitle.includes('starter loop');

  return (
    sameWorkspace &&
    (statusTitle === entryTitle ||
      relayTitle === entryTitle ||
      bothLocalStation ||
      bothStarterLoop ||
      (entryDetail.length > 0 && statusDetail.includes(entryDetail)))
  );
};

export const StationContinuityPanel: React.FC<StationContinuityPanelProps> = ({
  status,
  releaseChannel,
  plan,
  trialDays,
  activity = [],
  starterFlowSummary = null,
  latestTransitionActivity = null,
  entryDescriptor = null,
  onOpenGuidedSetup = null,
  variant,
}) => {
  const continuityActivity = buildContinuityActivityPreview(
    activity,
    starterFlowSummary,
    latestTransitionActivity
  );
  const showNextOpenRow =
    entryDescriptor && entryDescriptor.workspaceLabel !== status.workspaceLabel;
  const showEntryDescriptorRule =
    Boolean(entryDescriptor) &&
    (status.mode === 'relay' || status.entryState === 'resume') &&
    !primarySummaryCoversEntryDescriptor(status, entryDescriptor);
  const guidedSetupActionLabel = resolveGuidedSetupResumeActionLabel(status, latestTransitionActivity);
  const showGuidedSetupAction =
    Boolean(onOpenGuidedSetup) &&
    shouldOfferGuidedSetupResumeAction(status, latestTransitionActivity) &&
    Boolean(guidedSetupActionLabel);
  const showLatestTransitionRule =
    Boolean(latestTransitionActivity) &&
    !primarySummaryCoversLatestTransition(status, latestTransitionActivity);
  const drawerMetrics = status.metrics.slice(0, 2);
  const drawerActivity = continuityActivity.slice(0, 2);
  const drawerSecondaryMode: 'entry' | 'transition' | 'starter' | null = showEntryDescriptorRule
    ? 'entry'
    : showLatestTransitionRule
      ? 'transition'
      : starterFlowSummary
        ? 'starter'
        : null;

  if (variant === 'drawer') {
    return (
      <div className="auth-station-brief auth-drawer-stagger absolute left-[53.2%] top-[46.8%] z-10 max-h-[50.8%] w-[42.4%] overflow-y-auto rounded-[16px]">
        <div className="auth-station-brief-eyebrow">
          <HardDriveDownload size={13} className="text-[var(--app-accent)]" />
          Station continuity
        </div>
        <div className="auth-station-brief-title">{status.title}</div>
        <div className="auth-station-brief-detail">{status.detail}</div>
        <div className="auth-station-brief-path">
          <div className="auth-station-brief-path-row">
            <span>Resume workspace</span>
            <span>{status.workspaceLabel}</span>
          </div>
          {showNextOpenRow ? (
            <div className="auth-station-brief-path-row">
              <span>Next open</span>
              <span>{entryDescriptor?.workspaceLabel}</span>
            </div>
          ) : null}
          {status.relayTitle ? (
            <div className="auth-station-brief-path-row">
              <span>Starter relay</span>
              <span>{status.relayTitle}</span>
            </div>
          ) : null}
        </div>

        <div className="auth-station-brief-status">
          <div>
            <div className="auth-station-brief-status-label">{status.statusLabel}</div>
            <div className="auth-station-brief-status-value">{status.statusValue}</div>
          </div>
          <div className="auth-station-brief-status-icon">
            <ArrowRightLeft size={14} />
          </div>
        </div>

        <div className="auth-station-brief-chip-row">
          {status.chips.slice(0, 3).map((chip) => (
            <div key={chip} className="auth-station-brief-chip">
              {chip}
            </div>
          ))}
          {releaseChannel ? <div className="auth-station-brief-chip">{releaseChannel}</div> : null}
          {plan ? <div className="auth-station-brief-chip">{plan}</div> : null}
        </div>

        {drawerMetrics.length ? (
          <div className="auth-station-brief-metrics">
            {drawerMetrics.map((metric) => (
              <div key={metric.label} className="auth-station-brief-metric">
                <div className="auth-station-brief-metric-value">{metric.value}</div>
                <div className="auth-station-brief-metric-label">{metric.label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {drawerActivity.length ? (
          <div className="auth-station-brief-activity">
            <div className="auth-station-brief-rule-head">
              <ArrowRightLeft size={13} className="text-[var(--app-accent)]" />
              Recent continuity
            </div>
            <div className="auth-station-brief-activity-list">
              {drawerActivity.map((entry) => (
                <div key={entry.id} className="auth-station-brief-activity-row">
                  <div>
                    <div className="auth-station-brief-activity-title">{entry.title}</div>
                    <div className="auth-station-brief-activity-detail">
                      {entry.workspaceLabel ? `${entry.workspaceLabel} • ` : ''}
                      {entry.detail}
                    </div>
                  </div>
                  <div className="auth-station-brief-activity-time">
                    {formatActivityTime(entry.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {drawerSecondaryMode === 'entry' && entryDescriptor ? (
          <div className="auth-station-brief-rule">
            <div className="auth-station-brief-rule-head">
              <ArrowRightLeft size={13} className="text-[var(--app-accent)]" />
              Next local resume
            </div>
            <div className="auth-station-brief-title mt-3">{entryDescriptor.title}</div>
            <div className="auth-station-brief-detail mt-1">{entryDescriptor.detail}</div>
            <div className="auth-station-brief-chip-row mt-3">
              <div className="auth-station-brief-chip auth-station-brief-chip--accent">
                {entryDescriptor.workspaceLabel}
              </div>
              {entryDescriptor.chips.map((chip) => (
                <div key={`drawer-entry-${chip}`} className="auth-station-brief-chip">
                  {chip}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {drawerSecondaryMode === 'transition' && latestTransitionActivity ? (
          <div className="auth-station-brief-rule">
            <div className="auth-station-brief-rule-head">
              <ArrowRightLeft size={13} className="text-[var(--app-accent)]" />
              Latest transition
            </div>
            <div className="auth-station-brief-title mt-3">{latestTransitionActivity.title}</div>
            <div className="auth-station-brief-detail mt-1">{latestTransitionActivity.detail}</div>
            <div className="auth-station-brief-chip-row mt-3">
              {latestTransitionActivity.workspaceLabel ? (
                <div className="auth-station-brief-chip">{latestTransitionActivity.workspaceLabel}</div>
              ) : null}
              {latestTransitionActivity.chips?.slice(0, 3).map((chip) => (
                <div key={`drawer-transition-${chip}`} className="auth-station-brief-chip">
                  {chip}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {showGuidedSetupAction ? (
          <button
            type="button"
            onClick={() => onOpenGuidedSetup?.()}
            className="auth-station-brief-guided ui-pressable mt-3 inline-flex w-full items-center justify-center rounded-[10px] border border-[color-mix(in_srgb,var(--app-accent)_55%,var(--app-border))] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
          >
            {guidedSetupActionLabel}
          </button>
        ) : null}

        {drawerSecondaryMode === 'starter' && starterFlowSummary ? (
          <div className="auth-station-brief-rule">
            <div className="auth-station-brief-rule-head">
              <ArrowRightLeft size={13} className="text-[var(--app-accent)]" />
              Starter loop
            </div>
            <div className="auth-station-brief-title mt-3">{starterFlowSummary.title}</div>
            <div className="auth-station-brief-detail mt-1">{starterFlowSummary.detail}</div>
            <div className="auth-station-brief-chip-row mt-3">
              <div className="auth-station-brief-chip">{starterFlowSummary.statusLabel}</div>
              {starterFlowSummary.workspaceLabel ? (
                <div className="auth-station-brief-chip">{starterFlowSummary.workspaceLabel}</div>
              ) : null}
              {starterFlowSummary.chips.map((chip) => (
                <div key={`drawer-starter-${chip}`} className="auth-station-brief-chip">
                  {chip}
                </div>
              ))}
            </div>
            <div className="mt-3 text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
              {starterFlowSummary.statusDetail}
            </div>
          </div>
        ) : null}

        <div className="auth-station-brief-rule">
          <div className="auth-station-brief-rule-head">
            <ShieldCheck size={13} className="text-[var(--app-accent)]" />
            After sign-in
          </div>
          <div className="auth-station-brief-rule-copy">{status.connectHint}</div>
          {trialDays !== null ? (
            <div className="mt-2 text-[9px] uppercase tracking-[0.16em] text-[var(--app-accent)]">
              {trialDays}d local preview window
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="xt-welcome-panel">
      <div className="xt-welcome-panel-eyebrow">{status.eyebrow}</div>
      <div className="xt-welcome-station-head">
        <div>
          <div className="xt-welcome-station-title">{status.title}</div>
          <div className="xt-welcome-station-detail">{status.detail}</div>
        </div>
        <div className="xt-welcome-station-status">
          <div className="xt-welcome-station-status-label">{status.statusLabel}</div>
          <div className="xt-welcome-station-status-value">{status.statusValue}</div>
        </div>
      </div>
      <div className="xt-welcome-offline-copy">
        Enter local station mode to use Play, Lab, Inventory, and Dusk without signing in. You can connect an account later when you want sync.
      </div>
      <div className="xt-welcome-station-path">
        <div className="xt-welcome-station-path-row">
          <span>Resume workspace</span>
          <span>{status.workspaceLabel}</span>
        </div>
        {showNextOpenRow ? (
          <div className="xt-welcome-station-path-row">
            <span>Next open</span>
            <span>{entryDescriptor?.workspaceLabel}</span>
          </div>
        ) : null}
        {status.relayTitle ? (
          <div className="xt-welcome-station-path-row">
            <span>Starter relay</span>
            <span>{status.relayTitle}</span>
          </div>
        ) : null}
      </div>
      <div className="xt-welcome-chip-row">
        {status.chips.map((chip) => (
          <div key={chip} className="xt-welcome-chip">
            {chip}
          </div>
        ))}
        {releaseChannel ? <div className="xt-welcome-chip">{releaseChannel}</div> : null}
        {plan ? <div className="xt-welcome-chip">{plan}</div> : null}
        {trialDays !== null ? <div className="xt-welcome-chip xt-welcome-chip--accent">{trialDays}d local preview</div> : null}
      </div>
      {status.metrics.length ? (
        <div className="xt-welcome-station-metrics">
          {status.metrics.map((metric) => (
            <div key={metric.label} className="xt-welcome-station-metric">
              <div className="xt-welcome-station-metric-value">{metric.value}</div>
              <div className="xt-welcome-station-metric-label">{metric.label}</div>
            </div>
          ))}
        </div>
      ) : null}
      {continuityActivity.length ? (
        <div className="xt-welcome-station-activity">
          <div className="xt-welcome-panel-eyebrow">Recent continuity</div>
          <div className="xt-welcome-station-activity-list">
            {continuityActivity.map((entry) => (
              <div key={entry.id} className="xt-welcome-station-activity-row">
                <div>
                  <div className="xt-welcome-station-activity-title">{entry.title}</div>
                  <div className="xt-welcome-station-activity-detail">
                    {entry.workspaceLabel ? `${entry.workspaceLabel} • ` : ''}
                    {entry.detail}
                  </div>
                </div>
                <div className="xt-welcome-station-activity-time">
                  {formatActivityTime(entry.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
        {showEntryDescriptorRule ? (
          <div className="xt-welcome-station-activity">
          <div className="xt-welcome-panel-eyebrow">Next local resume</div>
          <div className="xt-welcome-station-activity-list">
            <div className="xt-welcome-station-activity-row">
              <div>
                <div className="xt-welcome-station-activity-title">{entryDescriptor.title}</div>
                <div className="xt-welcome-station-activity-detail">{entryDescriptor.detail}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <div className="xt-welcome-chip xt-welcome-chip--accent">
                    {entryDescriptor.workspaceLabel}
                  </div>
                  {entryDescriptor.chips.map((chip) => (
                    <div key={`entry-${chip}`} className="xt-welcome-chip">
                      {chip}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showLatestTransitionRule && latestTransitionActivity ? (
        <div className="xt-welcome-station-activity">
          <div className="xt-welcome-panel-eyebrow">Latest transition outcome</div>
          <div className="xt-welcome-station-activity-list">
            <div className="xt-welcome-station-activity-row">
              <div>
                <div className="xt-welcome-station-activity-title">{latestTransitionActivity.title}</div>
                <div className="xt-welcome-station-activity-detail">{latestTransitionActivity.detail}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {latestTransitionActivity.workspaceLabel ? (
                    <div className="xt-welcome-chip xt-welcome-chip--accent">
                      {latestTransitionActivity.workspaceLabel}
                    </div>
                  ) : null}
                  {latestTransitionActivity.chips?.slice(0, 3).map((chip) => (
                    <div key={`welcome-transition-${chip}`} className="xt-welcome-chip">
                      {chip}
                    </div>
                  ))}
                </div>
              </div>
              <div className="xt-welcome-station-activity-time">
                {formatActivityTime(latestTransitionActivity.createdAt)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {starterFlowSummary ? (
        <div className="xt-welcome-station-activity">
          <div className="xt-welcome-panel-eyebrow">Starter loop</div>
          <div className="xt-welcome-station-activity-list">
            <div className="xt-welcome-station-activity-row">
              <div>
                <div className="xt-welcome-station-activity-title">{starterFlowSummary.title}</div>
                <div className="xt-welcome-station-activity-detail">{starterFlowSummary.detail}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <div className="xt-welcome-chip xt-welcome-chip--accent">{starterFlowSummary.statusLabel}</div>
                  {starterFlowSummary.workspaceLabel ? (
                    <div className="xt-welcome-chip">{starterFlowSummary.workspaceLabel}</div>
                  ) : null}
                  {starterFlowSummary.chips.map((chip) => (
                    <div key={`welcome-starter-${chip}`} className="xt-welcome-chip">
                      {chip}
                    </div>
                  ))}
                </div>
              </div>
              <div className="xt-welcome-station-activity-time">
                {formatActivityTime(starterFlowSummary.createdAt)}
              </div>
            </div>
          </div>
          <div className="xt-welcome-station-connect-copy">{starterFlowSummary.statusDetail}</div>
        </div>
      ) : null}
      {showGuidedSetupAction ? (
        <button
          type="button"
          onClick={() => onOpenGuidedSetup?.()}
          className="xt-welcome-secondary ui-pressable mt-4 inline-flex items-center justify-center gap-2 self-start border border-[color-mix(in_srgb,var(--app-accent)_55%,var(--app-border))] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
        >
          {guidedSetupActionLabel}
        </button>
      ) : null}
      <div className="xt-welcome-station-connect-copy">{status.connectHint}</div>
    </div>
  );
};
