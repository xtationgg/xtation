import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArchiveRestore,
  BadgeCheck,
  Boxes,
  Cloud,
  Flag,
  FlaskConical,
  LayoutDashboard,
  LifeBuoy,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../src/auth/AuthProvider';
import {
  useAdminConsole,
  type OperatorPlan,
  type OperatorStationRecord,
  type ReleaseChannel,
} from '../../src/admin/AdminConsoleProvider';
import {
  MissingOperatorLookupFunctionError,
  OperatorLookupAccessDeniedError,
  searchOperatorStationProfiles,
  type OperatorLookupResult,
} from '../../src/admin/operatorLookup';
import { readOperatorClaimState } from '../../src/admin/operatorClaims';
import {
  applyOperatorStationRollout,
  MissingOperatorRolloutFunctionError,
} from '../../src/admin/operatorRollout';
import {
  loadCloudOperatorAudit,
  MissingOperatorAuditFunctionError,
  type CloudOperatorAuditEntry,
} from '../../src/admin/operatorAudit';
import {
  buildCloudReadinessReport,
} from '../../src/admin/cloudReadiness';
import {
  loadOperatorDiagnostics,
  MissingOperatorDiagnosticsFunctionError,
  OperatorDiagnosticsAuthRequiredError,
  type OperatorDiagnostics,
} from '../../src/admin/operatorDiagnostics';
import {
  readGuestStationRecoverySnapshot,
} from '../../src/auth/guestStation';
import {
  readXtationStationRestoreRecoverySnapshot,
} from '../../src/backup/station';
import { STORE_ITEMS } from '../../src/store/catalog';
import { useXtationSettings } from '../../src/settings/SettingsProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useXP } from '../XP/xpStore';
import { useLatestDuskBrief } from '../../src/dusk/useLatestDuskBrief';
import { usePresentationEvents } from '../../src/presentation/PresentationEventsProvider';
import { ClientView } from '../../types';
import { CreativeOpsPanel } from '../Admin/CreativeOpsPanel';

type AdminTab = 'overview' | 'rollout' | 'support' | 'catalog' | 'creativeops' | 'audit' | 'testlab';

interface AdminProps {
  onChangeView?: (view: ClientView) => void;
}

const ADMIN_TABS: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'rollout', label: 'Rollout', icon: Flag },
  { id: 'support', label: 'Support', icon: LifeBuoy },
  { id: 'catalog', label: 'Catalog', icon: Boxes },
  { id: 'creativeops', label: 'Creative Ops', icon: Sparkles },
  { id: 'audit', label: 'Audit', icon: Activity },
  { id: 'testlab', label: 'Test Lab', icon: FlaskConical },
];

const RELEASE_CHANNELS: ReleaseChannel[] = ['internal', 'beta', 'stable'];
const PLAN_OPTIONS: OperatorPlan[] = ['free', 'trial', 'pro', 'team'];

const formatDateTime = (value: number | null | undefined) => {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString();
};

const formatRelativeDays = (value: number | null) => {
  if (!value) return 'None';
  const diff = value - Date.now();
  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  return `${days}d remaining`;
};

const sectionCard =
  'xt-admin-card';

const panelButton =
  'xt-admin-pill';

const PillButton: React.FC<{
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active = false, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`${panelButton} ${
      active
        ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] text-[var(--app-text)]'
        : 'border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
    }`}
  >
    {children}
  </button>
);

const SummaryCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}> = ({ icon, label, value, detail }) => (
  <div className={`${sectionCard} p-5`}>
    <div className="flex items-center gap-3">
      <div className="xt-admin-summary-icon">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">{label}</div>
        <div className="mt-1 text-lg font-semibold text-[var(--app-text)]">{value}</div>
      </div>
    </div>
    {detail ? <div className="mt-4 text-sm leading-6 text-[var(--app-muted)]">{detail}</div> : null}
  </div>
);

const StationListRow: React.FC<{
  station: OperatorStationRecord;
  selected: boolean;
  onSelect: () => void;
  extra?: React.ReactNode;
}> = ({ station, selected, onSelect, extra }) => (
  <button
    type="button"
    onClick={onSelect}
    className={`xt-admin-list-row w-full px-4 py-4 text-left transition-colors ${
      selected
        ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]'
        : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_70%,transparent)] hover:border-[var(--app-accent)]'
    }`}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--app-text)]">{station.label}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">
          {station.kind.replace('-', ' ')} • {station.releaseChannel} • {station.plan}
        </div>
        {station.email ? (
          <div className="mt-2 truncate text-sm text-[var(--app-muted)]">{station.email}</div>
        ) : null}
      </div>
      {extra}
    </div>
  </button>
);

export const Admin: React.FC<AdminProps> = ({ onChangeView }) => {
  const { user, session } = useAuth();
  const {
    access,
    state,
    currentStation,
    platformSyncStatus,
    platformSyncMessage,
    platformCloudUpdatedAt,
    platformCloudEnabled,
    setReleaseChannel,
    setPlan,
    setTrialDays,
    setBetaCohort,
    toggleFeatureFlag,
    setSupportNotes,
    createTestAccount,
    removeStation,
    startSupportLens,
    startSupportLensExternal,
    stopSupportLens,
    markAuditReviewed,
  } = useAdminConsole();
  const { settings, setFeatureEnabled } = useXtationSettings();
  const { theme, accent, resolution } = useTheme();
  const { recentEvents, familySummaries, storageScope } = usePresentationEvents();
  const latestBrief = useLatestDuskBrief();
  const { tasks, sessions, stats, syncStatus, lastSyncedAt, authStatus } = useXP();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [selectedStationId, setSelectedStationId] = useState(currentStation.id);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState<OperatorLookupResult[]>([]);
  const [selectedLookupUserId, setSelectedLookupUserId] = useState<string | null>(null);
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'unavailable'>('idle');
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupActionState, setLookupActionState] = useState<'idle' | 'saving' | 'success' | 'error' | 'unavailable'>('idle');
  const [lookupActionMessage, setLookupActionMessage] = useState<string | null>(null);
  const [lookupCohortDraft, setLookupCohortDraft] = useState('');
  const [cloudAuditEntries, setCloudAuditEntries] = useState<CloudOperatorAuditEntry[]>([]);
  const [cloudAuditState, setCloudAuditState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'unavailable'>('idle');
  const [cloudAuditMessage, setCloudAuditMessage] = useState<string | null>(null);
  const [cloudDiagnostics, setCloudDiagnostics] = useState<OperatorDiagnostics | null>(null);
  const [cloudDiagnosticsState, setCloudDiagnosticsState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'unavailable'>('idle');
  const [cloudDiagnosticsMessage, setCloudDiagnosticsMessage] = useState<string | null>(null);

  const stations = state.stations;
  const selectedStation =
    stations.find((station) => station.id === selectedStationId) ||
    currentStation;

  const guestRecoverySnapshot = useMemo(
    () => (user?.id ? readGuestStationRecoverySnapshot(user.id) : null),
    [user?.id]
  );
  const restoreSnapshot = useMemo(
    () => readXtationStationRestoreRecoverySnapshot(user?.id || null),
    [user?.id]
  );
  const operatorClaimState = useMemo(() => readOperatorClaimState(session), [session]);
  const catalogCounts = useMemo(
    () =>
      STORE_ITEMS.reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {}),
    []
  );
  const selectedLookupResult =
    lookupResults.find((result) => result.userId === selectedLookupUserId) || lookupResults[0] || null;
  const cloudAuditTargetUserId = selectedLookupResult?.userId || null;
  const cloudAuditTargetLabel = selectedLookupResult?.email || selectedLookupResult?.userId || 'recent operator activity';
  const cloudReadiness = useMemo(
    () =>
      buildCloudReadinessReport({
        hasSession: !!user?.id,
        claimState: operatorClaimState,
        platformCloudEnabled,
        platformSyncStatus,
        platformSyncMessage,
        diagnosticsState: cloudDiagnosticsState,
        diagnosticsMessage: cloudDiagnosticsMessage,
        diagnostics: cloudDiagnostics,
      }),
    [
      user?.id,
      operatorClaimState,
      platformCloudEnabled,
      platformSyncStatus,
      platformSyncMessage,
      cloudDiagnosticsState,
      cloudDiagnosticsMessage,
      cloudDiagnostics,
    ]
  );
  const exportAudit = () => {
    const payload = {
      exportedAt: Date.now(),
      operator: user?.email || 'local-operator',
      access,
      audit: state.audit,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `xtation-admin-audit-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const runCloudLookup = async (searchTerm: string) => {
    if (!user?.id) {
      setLookupState('unavailable');
      setLookupMessage('Sign in with an operator account before using cloud lookup.');
      setLookupResults([]);
      return;
    }

    setLookupState('loading');
    setLookupMessage(null);

    try {
      const results = await searchOperatorStationProfiles(searchTerm);
      setLookupResults(results);
      setSelectedLookupUserId((current) =>
        current && results.some((result) => result.userId === current) ? current : results[0]?.userId ?? null
      );
      setLookupCohortDraft((current) =>
        current ? current : (results[0]?.betaCohort || '')
      );
      setLookupState('ready');
      setLookupMessage(results.length === 0 ? 'No station profiles matched this search.' : null);
    } catch (error) {
      if (error instanceof MissingOperatorLookupFunctionError) {
        setLookupState('unavailable');
        setLookupMessage('Install supabase/operator_lookup.sql to enable cloud account lookup.');
      } else if (error instanceof OperatorLookupAccessDeniedError) {
        setLookupState('unavailable');
        setLookupMessage('This signed-in account does not have the required XTATION operator claim yet.');
      } else {
        setLookupState('error');
        setLookupMessage(error instanceof Error ? error.message : 'Cloud lookup failed.');
      }
      setLookupResults([]);
      setSelectedLookupUserId(null);
    }
  };

  const applyLookupResult = (nextResult: OperatorLookupResult) => {
    setLookupResults((current) =>
      current.map((result) => (result.userId === nextResult.userId ? nextResult : result))
    );
    setSelectedLookupUserId(nextResult.userId);
    setLookupCohortDraft(nextResult.betaCohort || '');
  };

  const loadCloudAuditFeed = async (targetUserId?: string | null) => {
    if (!user?.id) {
      setCloudAuditState('unavailable');
      setCloudAuditMessage('Sign in with an operator account before using cloud audit.');
      setCloudAuditEntries([]);
      return;
    }

    setCloudAuditState('loading');
    setCloudAuditMessage(null);
    try {
      const entries = await loadCloudOperatorAudit(targetUserId, 18);
      setCloudAuditEntries(entries);
      setCloudAuditState('ready');
      setCloudAuditMessage(entries.length === 0 ? 'No cloud audit entries matched this scope yet.' : null);
    } catch (error) {
      if (error instanceof MissingOperatorAuditFunctionError) {
        setCloudAuditState('unavailable');
        setCloudAuditMessage('Install supabase/operator_audit_feed.sql to view backend operator history.');
      } else if (error instanceof OperatorLookupAccessDeniedError) {
        setCloudAuditState('unavailable');
        setCloudAuditMessage('This signed-in account does not have the required XTATION operator claim yet.');
      } else {
        setCloudAuditState('error');
        setCloudAuditMessage(error instanceof Error ? error.message : 'Cloud audit feed failed.');
      }
      setCloudAuditEntries([]);
    }
  };

  const applyRemoteRollout = async (
    summary: string,
    patch: Parameters<typeof applyOperatorStationRollout>[1]
  ) => {
    if (!selectedLookupResult) return;
    setLookupActionState('saving');
    setLookupActionMessage(null);
    try {
      const updated = await applyOperatorStationRollout(selectedLookupResult.userId, patch);
      applyLookupResult(updated);
      setLookupActionState('success');
      setLookupActionMessage(`${summary}. Audit id: ${updated.auditId || 'recorded'}.`);
      void loadCloudAuditFeed(updated.userId);
    } catch (error) {
      if (error instanceof MissingOperatorRolloutFunctionError) {
        setLookupActionState('unavailable');
        setLookupActionMessage('Install supabase/operator_rollout.sql to enable cloud rollout actions.');
      } else if (error instanceof OperatorLookupAccessDeniedError) {
        setLookupActionState('unavailable');
        setLookupActionMessage('This signed-in account does not have the required XTATION operator claim yet.');
      } else {
        setLookupActionState('error');
        setLookupActionMessage(error instanceof Error ? error.message : 'Cloud rollout update failed.');
      }
    }
  };

  const loadCloudReadiness = async () => {
    if (!user?.id) {
      setCloudDiagnostics(null);
      setCloudDiagnosticsState('unavailable');
      setCloudDiagnosticsMessage('Sign in to run XTATION cloud readiness checks.');
      return;
    }

    setCloudDiagnosticsState('loading');
    setCloudDiagnosticsMessage(null);

    try {
      const diagnostics = await loadOperatorDiagnostics();
      setCloudDiagnostics(diagnostics);
      setCloudDiagnosticsState('ready');
      setCloudDiagnosticsMessage(null);
    } catch (error) {
      if (error instanceof MissingOperatorDiagnosticsFunctionError) {
        setCloudDiagnostics(null);
        setCloudDiagnosticsState('unavailable');
        setCloudDiagnosticsMessage('Install supabase/operator_diagnostics.sql to unlock cloud readiness checks.');
      } else if (error instanceof OperatorDiagnosticsAuthRequiredError) {
        setCloudDiagnostics(null);
        setCloudDiagnosticsState('unavailable');
        setCloudDiagnosticsMessage('Sign in before using XTATION cloud diagnostics.');
      } else {
        setCloudDiagnostics(null);
        setCloudDiagnosticsState('error');
        setCloudDiagnosticsMessage(error instanceof Error ? error.message : 'Cloud diagnostics failed.');
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'support') {
      if (cloudAuditTargetUserId) {
        void loadCloudAuditFeed(cloudAuditTargetUserId);
      } else {
        setCloudAuditEntries([]);
        setCloudAuditState('idle');
        setCloudAuditMessage(null);
      }
      return;
    }

    if (activeTab === 'audit') {
      void loadCloudAuditFeed(cloudAuditTargetUserId);
    }
  }, [activeTab, cloudAuditTargetUserId, user?.id]);

  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'support') {
      void loadCloudReadiness();
    }
  }, [activeTab, user?.id, session?.access_token]);

  const dot = (ok: boolean) => (
    <span className={`inline-block w-[5px] h-[5px] flex-shrink-0 ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ borderRadius: 0 }} />
  );

  return (
    <div className="xt-admin-shell min-h-full px-4 pb-10 pt-4 md:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-0">

        {/* ── Header — inventory-style bar ── */}
        <div className="flex items-center justify-between border-b-2 border-[var(--app-accent)] pb-3 mb-0">
          <div className="flex items-center gap-4">
            <h1 className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--app-accent)]">Operator Console</h1>
            <span className="text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">{currentStation.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {access.roles.map((role) => (
              <span key={role} className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--app-accent)] border border-[color-mix(in_srgb,var(--app-accent)_30%,transparent)] px-2 py-0.5">{role.replace('_', ' ')}</span>
            ))}
            {state.supportLens ? (
              <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--app-accent)] border border-[var(--app-accent)] px-2 py-0.5">
                <span className="inline-block w-[5px] h-[5px] bg-[var(--app-accent)] animate-pulse" />
                Lens: {state.supportLens.stationLabel}
                <button type="button" onClick={stopSupportLens} className="text-[var(--app-muted)] hover:text-[var(--app-text)] ml-1">&times;</button>
              </span>
            ) : null}
          </div>
        </div>

        {/* ── Tabs — inventory topbar style ── */}
        <div className="flex items-center gap-0 border-b border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] mb-5">
          {ADMIN_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors border-b-2 -mb-px ${
                activeTab === id
                  ? 'border-[var(--app-accent)] text-[var(--app-text)]'
                  : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              {activeTab === id ? <span className="inline-block w-[5px] h-[5px] bg-[var(--app-accent)] mr-0.5" /> : null}
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW ═══ */}
        {activeTab === 'overview' ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">

            {/* Left column */}
            <div className="flex flex-col gap-5">

              {/* Station Status */}
              <div className="border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] border-t-2 border-t-[var(--app-accent)]">
                <div className="px-5 pt-4 pb-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--app-accent)]">Station Status</div>
                </div>
                <div className="px-5 pb-4">
                  {[
                    { ok: access.allowed, label: 'Access', value: access.source === 'env_allowlist' ? 'Allowlisted' : access.source === 'dev_preview' ? 'Dev preview' : 'Locked', meta: access.source.replace('_', ' ') },
                    { ok: true, label: 'Plan', value: `${currentStation.plan} / ${currentStation.releaseChannel}`, meta: formatRelativeDays(currentStation.trialEndsAt) },
                    { ok: platformCloudEnabled, label: 'Cloud', value: platformCloudEnabled ? platformSyncStatus.replace('_', ' ') : 'local only', meta: '' },
                    { ok: cloudReadiness.level === 'ready' || cloudReadiness.level === 'partial', label: 'Readiness', value: cloudReadiness.level, meta: cloudReadiness.nextStep },
                    { ok: !!operatorClaimState.role, label: 'JWT Role', value: operatorClaimState.role || 'none', meta: '' },
                    { ok: !!latestBrief, label: 'Dusk Relay', value: latestBrief ? latestBrief.title : 'No active brief', meta: '' },
                  ].map(({ ok, label, value, meta }, i, arr) => (
                    <div key={label} className={`flex items-center gap-4 py-3 ${i < arr.length - 1 ? 'border-b border-[color-mix(in_srgb,var(--app-text)_7%,transparent)]' : ''}`}>
                      {dot(ok)}
                      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--app-muted)] w-24 flex-shrink-0">{label}</span>
                      <span className="text-[13px] font-semibold text-[var(--app-text)] truncate">{value}</span>
                      {meta ? <span className="ml-auto text-[10px] uppercase tracking-[0.08em] text-[var(--app-muted)] flex-shrink-0">{meta}</span> : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* Surface Snapshot */}
              <div className="border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)]">
                <div className="px-5 pt-4 pb-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--app-muted)]">Surface Snapshot</div>
                </div>
                <div className="px-5 pb-4 grid gap-0 sm:grid-cols-3">
                  {[
                    { label: 'Theme', value: `${theme} / ${accent}` },
                    { label: 'Level', value: `Lv.${stats.playerLevel} · ${stats.totalEarnedXP} XP` },
                    { label: 'Data', value: `${tasks.length} quests · ${sessions.length} sessions` },
                    { label: 'Unlocks', value: `${settings.unlocks.activeWidgetIds.length} widgets · ${settings.unlocks.activeLabModuleIds.length} modules` },
                    { label: 'Features', value: `Lab ${settings.features.labEnabled ? '\u2713' : '\u2717'}  MP ${settings.features.multiplayerEnabled ? '\u2713' : '\u2717'}  Store ${settings.features.storeEnabled ? '\u2713' : '\u2717'}` },
                    { label: 'Sync', value: `${syncStatus} / ${authStatus}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-3 py-2.5 border-b border-[color-mix(in_srgb,var(--app-text)_5%,transparent)] last:border-0">
                      <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--app-muted)]">{label}</span>
                      <span className="text-[13px] font-medium text-[var(--app-text)] text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Audit feed */}
            <div className="border border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] border-t-2 border-t-[color-mix(in_srgb,var(--app-text)_18%,transparent)]">
              <div className="px-5 pt-4 pb-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--app-muted)]">Audit Trail</div>
              </div>
              <div className="px-5 pb-4">
                {state.audit.length === 0 ? (
                  <div className="text-[12px] text-[var(--app-muted)] py-6 border border-dashed border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] text-center mt-2">No actions recorded yet</div>
                ) : (
                  state.audit.slice(0, 10).map((entry, i, arr) => (
                    <div key={entry.id} className={`py-3 ${i < arr.length - 1 ? 'border-b border-[color-mix(in_srgb,var(--app-text)_7%,transparent)]' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[13px] font-medium text-[var(--app-text)]">{entry.summary}</span>
                        <span className="text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)] flex-shrink-0 border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-2 py-0.5 mt-0.5">{entry.scope}</span>
                      </div>
                      <div className="text-[11px] text-[var(--app-muted)] mt-1">{formatDateTime(entry.createdAt)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'rollout' ? (
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className={`${sectionCard} p-5`}>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Managed Stations</div>
              <div className="mt-4 space-y-3">
                {stations.map((station) => (
                  <StationListRow
                    key={station.id}
                    station={station}
                    selected={station.id === selectedStation.id}
                    onSelect={() => setSelectedStationId(station.id)}
                  />
                ))}
              </div>
            </div>

            <div className={`${sectionCard} p-5`}>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Rollout Controls</div>
              <div className="mt-3 text-sm text-[var(--app-muted)]">
                Adjust the selected station safely. App surface toggles below affect the live current station only.
              </div>

              <div className="mt-5 space-y-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Release Channel</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {RELEASE_CHANNELS.map((channel) => (
                      <PillButton
                        key={channel}
                        active={selectedStation.releaseChannel === channel}
                        onClick={() => setReleaseChannel(selectedStation.id, channel)}
                      >
                        {channel}
                      </PillButton>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Plan</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PLAN_OPTIONS.map((plan) => (
                      <PillButton
                        key={plan}
                        active={selectedStation.plan === plan}
                        onClick={() => setPlan(selectedStation.id, plan)}
                      >
                        {plan}
                      </PillButton>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Trial Window</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[7, 14, 30].map((days) => (
                      <PillButton key={days} onClick={() => setTrialDays(selectedStation.id, days)}>
                        {days} days
                      </PillButton>
                    ))}
                    <PillButton onClick={() => setTrialDays(selectedStation.id, null)}>Clear</PillButton>
                  </div>
                  <div className="mt-2 text-sm text-[var(--app-muted)]">{formatRelativeDays(selectedStation.trialEndsAt)}</div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Beta Cohort</div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <input
                      value={selectedStation.betaCohort || ''}
                      onChange={(event) => setBetaCohort(selectedStation.id, event.target.value)}
                      placeholder="launch-wave"
                      className="min-w-[220px] flex-1 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_84%,transparent)] px-4 py-2 text-sm text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)]"
                    />
                    <PillButton onClick={() => setBetaCohort(selectedStation.id, null)}>Clear</PillButton>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Rollout Flags</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {Object.entries(selectedStation.featureFlags).map(([flag, enabled]) => (
                      <button
                        key={flag}
                        type="button"
                        onClick={() => toggleFeatureFlag(selectedStation.id, flag)}
                        className={`rounded-[20px] border px-4 py-3 text-left transition-colors ${
                          enabled
                            ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]'
                            : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)]'
                        }`}
                      >
                        <div className="text-sm font-semibold text-[var(--app-text)]">{flag}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                          {enabled ? 'enabled' : 'disabled'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedStation.id === currentStation.id ? (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Live Surface Gates</div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      {[
                        ['labEnabled', 'Lab'],
                        ['multiplayerEnabled', 'Multiplayer'],
                        ['storeEnabled', 'Store'],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFeatureEnabled(key as 'labEnabled' | 'multiplayerEnabled' | 'storeEnabled', !settings.features[key as 'labEnabled' | 'multiplayerEnabled' | 'storeEnabled'])}
                          className={`rounded-[20px] border px-4 py-3 text-left transition-colors ${
                            settings.features[key as 'labEnabled' | 'multiplayerEnabled' | 'storeEnabled']
                              ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]'
                              : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)]'
                          }`}
                        >
                          <div className="text-sm font-semibold text-[var(--app-text)]">{label}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                            {settings.features[key as 'labEnabled' | 'multiplayerEnabled' | 'storeEnabled'] ? 'visible' : 'hidden'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'support' ? (
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className={`${sectionCard} p-5`}>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Continuity Diagnostics</div>
              <div className="mt-4 space-y-4">
                <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
                  <div className="flex items-center gap-2 text-[var(--app-text)]">
                    <ArchiveRestore size={16} />
                    <span className="text-sm font-semibold">Guest import recovery</span>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
                    {guestRecoverySnapshot
                      ? `Captured ${formatDateTime(guestRecoverySnapshot.createdAt)} for ${guestRecoverySnapshot.importedUserEmail || guestRecoverySnapshot.importedUserId}.`
                      : 'No guest handoff recovery snapshot stored for this account.'}
                  </div>
                  {guestRecoverySnapshot?.guestContext ? (
                    <div className="mt-3 grid gap-2 text-[11px] leading-6 text-[var(--app-muted)] sm:grid-cols-3">
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Guest workspace</div>
                        <div className="mt-1 text-[var(--app-text)]">{guestRecoverySnapshot.guestContext.lastView || 'LOBBY'}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Imported into</div>
                        <div className="mt-1 text-[var(--app-text)]">{guestRecoverySnapshot.guestContext.importedView || 'LOBBY'}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Starter relay</div>
                        <div className="mt-1 text-[var(--app-text)]">{guestRecoverySnapshot.guestContext.onboardingHandoff?.title || 'None'}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
                  <div className="flex items-center gap-2 text-[var(--app-text)]">
                    <ArchiveRestore size={16} />
                    <span className="text-sm font-semibold">Restore safeguard</span>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
                    {restoreSnapshot
                      ? `Last restore landed ${formatDateTime(restoreSnapshot.createdAt)} into ${restoreSnapshot.restoredIntoScope}.`
                      : 'No restore safeguard snapshot stored for the current station.'}
                  </div>
                  {restoreSnapshot ? (
                    <div className="mt-3 grid gap-2 text-[11px] leading-6 text-[var(--app-muted)] sm:grid-cols-2">
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Current workspace</div>
                        <div className="mt-1 text-[var(--app-text)]">{restoreSnapshot.currentStation.navigation?.lastView || 'LOBBY'}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Imported workspace</div>
                        <div className="mt-1 text-[var(--app-text)]">{restoreSnapshot.importedStation.navigation?.lastView || 'unchanged'}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Quick jump</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PillButton onClick={() => onChangeView?.(ClientView.SETTINGS)}>Open Settings</PillButton>
                    <PillButton onClick={() => onChangeView?.(ClientView.LAB)}>Open Lab</PillButton>
                    <PillButton onClick={() => onChangeView?.(ClientView.LOBBY)}>Open Play</PillButton>
                  </div>
                </div>

                <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Operator Bootstrap</div>
                  <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                    Recommended files:
                    <br />
                    `xtation_cloud_stack.sql`
                    <br />
                    Or apply the individual SQL files if you prefer split migrations.
                    <br />
                    Then enable the Supabase custom access token hook and seed your first operator role. Full guide:
                    <br />
                    <span className="font-mono text-[var(--app-text)]">XTATION_OPERATOR_SETUP_V1.md</span>
                  </div>
                </div>

                <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Cloud Readiness</div>
                      <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">{cloudReadiness.summary}</div>
                      <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">{cloudReadiness.nextStep}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${
                          cloudReadiness.level === 'ready'
                            ? 'border-[color-mix(in_srgb,var(--app-accent)_42%,transparent)] text-[var(--app-accent)]'
                            : cloudReadiness.level === 'attention'
                              ? 'border-[rgba(255,191,102,0.35)] text-[#f6c56d]'
                              : 'border-[rgba(255,120,120,0.35)] text-[#ff9d9d]'
                        }`}
                      >
                        {cloudReadiness.level}
                      </span>
                      <PillButton onClick={() => void loadCloudReadiness()}>Refresh</PillButton>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {cloudReadiness.checks.map((check) => (
                      <div
                        key={check.id}
                        className="rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-[var(--app-text)]">{check.label}</div>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
                              check.status === 'ready'
                                ? 'border-[color-mix(in_srgb,var(--app-accent)_42%,transparent)] text-[var(--app-accent)]'
                                : check.status === 'attention'
                                  ? 'border-[rgba(255,191,102,0.35)] text-[#f6c56d]'
                                  : 'border-[rgba(255,120,120,0.35)] text-[#ff9d9d]'
                            }`}
                          >
                            {check.status}
                          </span>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">{check.detail}</div>
                      </div>
                    ))}
                  </div>

                  {(cloudDiagnosticsMessage || cloudDiagnostics) ? (
                    <div className="mt-4 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-4 py-3 text-sm leading-6 text-[var(--app-muted)]">
                      {cloudDiagnosticsMessage ? (
                        <div>{cloudDiagnosticsMessage}</div>
                      ) : null}
                      {cloudDiagnostics ? (
                        <div className={cloudDiagnosticsMessage ? 'mt-2' : ''}>
                          Assignment: <span className="font-mono text-[var(--app-text)]">{cloudDiagnostics.assignmentRole || 'none'}</span>
                          {' • '}
                          Claim: <span className="font-mono text-[var(--app-text)]">{cloudDiagnostics.roleClaim || 'none'}</span>
                          {' • '}
                          Profile row: <span className="font-mono text-[var(--app-text)]">{cloudDiagnostics.currentProfileExists ? 'present' : 'missing'}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Cloud Account Lookup</div>
                      <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
                        Search signed-in account profiles from Supabase. This stays read-only and opens a loud support lens instead of silent impersonation.
                      </div>
                    </div>
                    <Cloud size={16} className="text-[var(--app-accent)]" />
                  </div>

                  <div className="mt-4 flex flex-col gap-3 md:flex-row">
                    <input
                      value={lookupQuery}
                      onChange={(event) => setLookupQuery(event.target.value)}
                      placeholder="Search by email, user id, or cohort"
                      className="min-w-[220px] flex-1 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_82%,transparent)] px-4 py-2 text-sm text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)]"
                    />
                    <div className="flex gap-2">
                      <PillButton onClick={() => runCloudLookup(lookupQuery)}>
                        <Search size={12} className="mr-2" />
                        Search
                      </PillButton>
                      <PillButton onClick={() => runCloudLookup('')}>Recent</PillButton>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Operator claim status</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                        {operatorClaimState.role || 'no xtation_role'}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${
                          operatorClaimState.lookupReady
                            ? 'border-[color-mix(in_srgb,var(--app-accent)_40%,transparent)] text-[var(--app-accent)]'
                            : 'border-[var(--app-border)] text-[var(--app-muted)]'
                        }`}
                      >
                        {operatorClaimState.lookupReady ? 'lookup ready' : 'lookup blocked'}
                      </span>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                      {operatorClaimState.reason}
                    </div>
                  </div>

                  {lookupMessage ? (
                    <div className="mt-4 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-4 py-3 text-sm leading-6 text-[var(--app-muted)]">
                      {lookupMessage}
                    </div>
                  ) : null}

                  {lookupState === 'loading' ? (
                    <div className="mt-4 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-4 py-3 text-sm text-[var(--app-muted)]">
                      Querying cloud station profiles…
                    </div>
                  ) : null}

                  {lookupResults.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {lookupResults.map((result) => (
                        <div
                          key={result.userId}
                          className={`rounded-[20px] border p-4 ${
                            selectedLookupResult?.userId === result.userId
                              ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)]'
                              : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)]'
                          }`}
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[var(--app-text)]">{result.email || result.userId}</div>
                              <div className="mt-1 break-all text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                                {result.userId}
                              </div>
                              <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                                {result.releaseChannel} • {result.plan} • cohort {result.betaCohort || 'none'}
                                <br />
                                Updated {formatDateTime(result.updatedAt)}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <PillButton onClick={() => {
                                setSelectedLookupUserId(result.userId);
                                setLookupCohortDraft(result.betaCohort || '');
                              }}>
                                Manage
                              </PillButton>
                              <PillButton
                                onClick={() =>
                                  startSupportLensExternal(
                                    `lookup:${result.userId}`,
                                    result.email || result.userId,
                                    `Cloud support lens -> ${result.email || result.userId}`
                                  )
                                }
                              >
                                Open Lens
                              </PillButton>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedLookupResult ? (
                    <div className="mt-4 rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_82%,transparent)] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Cloud Rollout Staging</div>
                          <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">
                            {selectedLookupResult.email || selectedLookupResult.userId}
                          </div>
                          <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
                            Current: {selectedLookupResult.releaseChannel} • {selectedLookupResult.plan}
                            <br />
                            Trial: {formatRelativeDays(selectedLookupResult.trialEndsAt)}
                            <br />
                            Cohort: {selectedLookupResult.betaCohort || 'none'}
                          </div>
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                          Writes through audited Supabase RPC
                        </div>
                      </div>

                      <div className="mt-5 space-y-5">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Release channel</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {RELEASE_CHANNELS.map((channel) => (
                              <PillButton
                                key={`remote-${channel}`}
                                active={selectedLookupResult.releaseChannel === channel}
                                onClick={() => applyRemoteRollout(`Release channel set to ${channel}`, { releaseChannel: channel })}
                              >
                                {channel}
                              </PillButton>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Plan</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {PLAN_OPTIONS.map((plan) => (
                              <PillButton
                                key={`remote-plan-${plan}`}
                                active={selectedLookupResult.plan === plan}
                                onClick={() => applyRemoteRollout(`Plan set to ${plan}`, { plan })}
                              >
                                {plan}
                              </PillButton>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Trial window</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {[7, 14, 30].map((days) => (
                              <PillButton
                                key={`remote-trial-${days}`}
                                onClick={() => applyRemoteRollout(`Trial set to ${days} days`, { trialDays: days })}
                              >
                                {days} days
                              </PillButton>
                            ))}
                            <PillButton onClick={() => applyRemoteRollout('Trial cleared', { clearTrial: true })}>Clear</PillButton>
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Beta cohort</div>
                          <div className="mt-3 flex flex-col gap-3 md:flex-row">
                            <input
                              value={lookupCohortDraft}
                              onChange={(event) => setLookupCohortDraft(event.target.value)}
                              placeholder="launch-wave"
                              className="min-w-[220px] flex-1 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_82%,transparent)] px-4 py-2 text-sm text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)]"
                            />
                            <div className="flex gap-2">
                              <PillButton
                                onClick={() =>
                                  applyRemoteRollout(`Beta cohort set to ${lookupCohortDraft || 'none'}`, {
                                    betaCohort: lookupCohortDraft,
                                  })
                                }
                              >
                                Apply
                              </PillButton>
                              <PillButton onClick={() => applyRemoteRollout('Beta cohort cleared', { clearBetaCohort: true })}>
                                Clear
                              </PillButton>
                            </div>
                          </div>
                        </div>

                        {Object.keys(selectedLookupResult.featureFlags).length > 0 ? (
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Feature flags</div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              {Object.entries(selectedLookupResult.featureFlags).map(([flag, enabled]) => (
                                <button
                                  key={`remote-flag-${flag}`}
                                  type="button"
                                  onClick={() =>
                                    applyRemoteRollout(`Feature flag ${flag} ${enabled ? 'disabled' : 'enabled'}`, {
                                      featureFlagsPatch: {
                                        [flag]: !enabled,
                                      },
                                    })
                                  }
                                  className={`rounded-[20px] border px-4 py-3 text-left transition-colors ${
                                    enabled
                                      ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)]'
                                      : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)]'
                                  }`}
                                >
                                  <div className="text-sm font-semibold text-[var(--app-text)]">{flag}</div>
                                  <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                                    {enabled ? 'enabled' : 'disabled'}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {lookupActionMessage ? (
                        <div className="mt-4 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] px-4 py-3 text-sm leading-6 text-[var(--app-muted)]">
                          {lookupActionState === 'saving' ? 'Applying rollout update… ' : ''}
                          {lookupActionMessage}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_82%,transparent)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Cloud Audit Feed</div>
                        <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
                          {selectedLookupResult
                            ? `Backend audit history for ${cloudAuditTargetLabel}.`
                            : 'Search a cloud account above to inspect its backend rollout history.'}
                        </div>
                      </div>
                      <PillButton onClick={() => cloudAuditTargetUserId ? loadCloudAuditFeed(cloudAuditTargetUserId) : undefined}>
                        Refresh
                      </PillButton>
                    </div>

                    {cloudAuditMessage ? (
                      <div className="mt-4 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] px-4 py-3 text-sm leading-6 text-[var(--app-muted)]">
                        {cloudAuditMessage}
                      </div>
                    ) : null}

                    {cloudAuditState === 'loading' ? (
                      <div className="mt-4 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] px-4 py-3 text-sm text-[var(--app-muted)]">
                        Loading backend audit…
                      </div>
                    ) : null}

                    {cloudAuditEntries.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {cloudAuditEntries.slice(0, 6).map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] px-4 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-[var(--app-text)]">{entry.summary}</div>
                                <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                                  {entry.action} • {entry.actorEmail || entry.actorUserId || 'unknown actor'} • {entry.actorRole || 'no role'}
                                </div>
                              </div>
                              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">{formatDateTime(entry.createdAt)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className={`${sectionCard} p-5`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Support Lens</div>
                  <div className="mt-2 text-sm text-[var(--app-muted)]">Use a loud, explicit lens instead of silent impersonation.</div>
                </div>
                {state.supportLens?.stationId === selectedStation.id ? (
                  <PillButton onClick={stopSupportLens}>Clear Lens</PillButton>
                ) : (
                  <PillButton onClick={() => startSupportLens(selectedStation.id)}>Start Lens</PillButton>
                )}
              </div>

              <div className="mt-5">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Support Notes</div>
                <textarea
                  value={selectedStation.supportNotes}
                  onChange={(event) => setSupportNotes(selectedStation.id, event.target.value)}
                  placeholder="Capture support context, rollout notes, or recovery instructions."
                  className="mt-3 min-h-[180px] w-full rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_82%,transparent)] px-4 py-3 text-sm leading-6 text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)]"
                />
              </div>

              <div className="mt-5 rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Latest Dusk Brief</div>
                {latestBrief ? (
                  <>
                    <div className="mt-2 text-sm font-semibold text-[var(--app-text)]">{latestBrief.title}</div>
                    <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">{latestBrief.body}</div>
                  </>
                ) : (
                  <div className="mt-2 text-sm text-[var(--app-muted)]">No stored Dusk brief yet.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'catalog' ? (
          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className={`${sectionCard} p-5`}>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Catalog Summary</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(catalogCounts).map(([category, count]) => (
                  <div
                    key={category}
                    className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4"
                  >
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">{category}</div>
                    <div className="mt-2 text-xl font-semibold text-[var(--app-text)]">{count}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Current Station Installs</div>
                <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
                  Theme pack: {settings.unlocks.activeThemeId || 'builtin'}<br />
                  Widgets: {settings.unlocks.activeWidgetIds.join(', ') || 'none'}<br />
                  Lab modules: {settings.unlocks.activeLabModuleIds.join(', ') || 'none'}
                </div>
              </div>
            </div>

            <div className={`${sectionCard} p-5`}>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Catalog Items</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {STORE_ITEMS.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--app-text)]">{item.name}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">{item.category}</div>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-accent)]">
                        {item.price.kind === 'free' ? 'Free' : `${item.price.currency} ${item.price.amount}`}
                      </div>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-[var(--app-muted)]">{item.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'creativeops' ? (
          <CreativeOpsPanel
            recentEvents={recentEvents}
            familySummaries={familySummaries}
            storageScope={storageScope}
          />
        ) : null}

        {activeTab === 'audit' ? (
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className={`${sectionCard} p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Client Audit Trail</div>
                  <div className="mt-2 text-sm text-[var(--app-muted)]">
                    Last review checkpoint: {formatDateTime(state.lastReviewedAt)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PillButton onClick={markAuditReviewed}>Mark Reviewed</PillButton>
                  <PillButton onClick={exportAudit}>Export JSON</PillButton>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {state.audit.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-[var(--app-border)] px-4 py-6 text-sm text-[var(--app-muted)]">
                    No audit entries yet.
                  </div>
                ) : (
                  state.audit.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--app-text)]">{entry.summary}</div>
                          <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                            {entry.scope} • {entry.action} • {entry.actorLabel}
                          </div>
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">{formatDateTime(entry.createdAt)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={`${sectionCard} p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Cloud Operator Audit</div>
                  <div className="mt-2 text-sm text-[var(--app-muted)]">
                    {selectedLookupResult
                      ? `Showing backend audit for ${cloudAuditTargetLabel}.`
                      : 'Showing the most recent backend operator actions.'}
                  </div>
                </div>
                <PillButton onClick={() => loadCloudAuditFeed(activeTab === 'audit' ? cloudAuditTargetUserId : null)}>Refresh Feed</PillButton>
              </div>

              {cloudAuditMessage ? (
                <div className="mt-4 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] px-4 py-3 text-sm leading-6 text-[var(--app-muted)]">
                  {cloudAuditMessage}
                </div>
              ) : null}

              {cloudAuditState === 'loading' ? (
                <div className="mt-4 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] px-4 py-3 text-sm text-[var(--app-muted)]">
                  Loading backend audit…
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                {cloudAuditEntries.length === 0 && cloudAuditState === 'ready' ? (
                  <div className="rounded-[22px] border border-dashed border-[var(--app-border)] px-4 py-6 text-sm text-[var(--app-muted)]">
                    No backend operator entries yet.
                  </div>
                ) : null}
                {cloudAuditEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--app-text)]">{entry.summary}</div>
                        <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                          {entry.action} • {entry.actorEmail || entry.actorUserId || 'unknown actor'} • {entry.actorRole || 'no role'}
                        </div>
                        <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                          Target • {entry.targetEmail || entry.targetUserId || 'unknown target'}
                        </div>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">{formatDateTime(entry.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'testlab' ? (
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className={`${sectionCard} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Test Cohorts</div>
                  <div className="mt-2 text-sm text-[var(--app-muted)]">Build beta and trial scenarios without touching live users.</div>
                </div>
                <PillButton onClick={createTestAccount}>Create Test Record</PillButton>
              </div>
              <div className="mt-4 space-y-3">
                {stations
                  .filter((station) => station.kind === 'test-account')
                  .map((station) => (
                    <StationListRow
                      key={station.id}
                      station={station}
                      selected={station.id === selectedStation.id}
                      onSelect={() => setSelectedStationId(station.id)}
                      extra={
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeStation(station.id);
                            if (selectedStation.id === station.id) {
                              setSelectedStationId(currentStation.id);
                            }
                          }}
                          className="rounded-full border border-[var(--app-border)] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
                        >
                          Remove
                        </button>
                      }
                    />
                  ))}
              </div>
            </div>

            <div className={`${sectionCard} p-5`}>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">Selected Scenario</div>
              <div className="mt-4 rounded-[24px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_76%,transparent)] p-5">
                <div className="text-xl font-semibold text-[var(--app-text)]">{selectedStation.label}</div>
                <div className="mt-2 text-sm text-[var(--app-muted)]">
                  {selectedStation.email || 'No linked email'} • {selectedStation.releaseChannel} • {selectedStation.plan}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <PillButton onClick={() => setReleaseChannel(selectedStation.id, 'beta')}>Send to Beta</PillButton>
                  <PillButton onClick={() => setPlan(selectedStation.id, 'trial')}>Set Trial</PillButton>
                  <PillButton onClick={() => startSupportLens(selectedStation.id)}>Open Lens</PillButton>
                </div>
                <div className="mt-5 text-sm leading-7 text-[var(--app-muted)]">
                  Trial window: {formatRelativeDays(selectedStation.trialEndsAt)}
                  <br />
                  Cohort: {selectedStation.betaCohort || 'none'}
                  <br />
                  Flags enabled: {Object.values(selectedStation.featureFlags).filter(Boolean).length}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
