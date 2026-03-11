import React, { useMemo } from 'react';
import {
  ArrowRightLeft,
  Boxes,
  Cloud,
  DatabaseBackup,
  HardDriveDownload,
  ShieldAlert,
  Sparkles,
  Waypoints,
} from 'lucide-react';
import { AuthDrawer } from '../UI/AuthDrawer';
import type { GuestStationSummary } from '../../src/auth/guestStation';
import { playClickSound, playHoverSound } from '../../utils/SoundEffects';
import { readXtationOnboardingHandoff } from '../../src/onboarding/storage';
import { readStoredXtationLastView } from '../../src/navigation/lastView';
import type { ClientView } from '../../types';

interface GuestStationHandoffProps {
  open: boolean;
  localSummary: GuestStationSummary;
  accountSummary: GuestStationSummary;
  accountLabel: string;
  accountWorkspace: ClientView;
  importWorkspace: ClientView;
  onKeepAccount: () => void;
  onImportLocal: () => void;
  onReturnToLocal: () => void;
}

const formatWorkspaceLabel = (view: ClientView | null | undefined) => {
  switch (view) {
    case 'LOBBY':
      return 'Play';
    case 'HOME':
    case 'LAB':
      return 'Lab';
    case 'PROFILE':
      return 'Profile';
    case 'MULTIPLAYER':
      return 'Multiplayer';
    case 'INVENTORY':
      return 'Inventory';
    case 'STORE':
      return 'Store';
    case 'SETTINGS':
      return 'Settings';
    case 'ADMIN':
      return 'Admin';
    case 'TFT':
      return 'Earth';
    case 'UI_KIT':
      return 'UI Kit';
    default:
      return 'Play';
  }
};

const SummaryCard: React.FC<{
  title: string;
  accent: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  summary: GuestStationSummary;
  workspace: string;
  relayTitle?: string | null;
}> = ({ title, accent, icon: Icon, summary, workspace, relayTitle }) => (
  <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_82%,transparent)] p-4">
    <div className="flex items-center justify-between gap-3">
      <div className={`text-[10px] uppercase tracking-[0.22em] ${accent}`}>{title}</div>
      <Icon size={16} className={accent} />
    </div>
    <div className="mt-4 grid gap-2 border-y border-[color-mix(in_srgb,var(--app-border)_78%,transparent)] py-3">
      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
        <span>Workspace</span>
        <span className="text-[var(--app-text)]">{workspace}</span>
      </div>
      {relayTitle ? (
        <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
          <span>Starter relay</span>
          <span className="max-w-[55%] truncate text-right text-[var(--app-text)]">{relayTitle}</span>
        </div>
      ) : null}
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-[16px] border border-[color-mix(in_srgb,var(--app-border)_78%,transparent)] px-3 py-3">
        <div className="text-lg font-semibold text-[var(--app-text)]">{summary.tasks}</div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Quests</div>
      </div>
      <div className="rounded-[16px] border border-[color-mix(in_srgb,var(--app-border)_78%,transparent)] px-3 py-3">
        <div className="text-lg font-semibold text-[var(--app-text)]">{summary.sessions}</div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Sessions</div>
      </div>
      <div className="rounded-[16px] border border-[color-mix(in_srgb,var(--app-border)_78%,transparent)] px-3 py-3">
        <div className="text-lg font-semibold text-[var(--app-text)]">{summary.selfTreeNodes}</div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Tree Nodes</div>
      </div>
      <div className="rounded-[16px] border border-[color-mix(in_srgb,var(--app-border)_78%,transparent)] px-3 py-3">
        <div className="text-lg font-semibold text-[var(--app-text)]">{summary.activeDays}</div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Active Days</div>
      </div>
    </div>
    <div className="mt-4 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
      {summary.latestActivityAt
        ? `Latest activity ${new Date(summary.latestActivityAt).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : 'No recent activity detected'}
    </div>
  </div>
);

const DecisionCard: React.FC<{
  eyebrow: string;
  title: string;
  detail: string;
  outcomeLabel: string;
  outcomeValue: string;
  carryItems: string[];
  tone?: 'default' | 'accent';
}> = ({ eyebrow, title, detail, outcomeLabel, outcomeValue, carryItems, tone = 'default' }) => (
  <div
    className={`rounded-[20px] border p-4 ${
      tone === 'accent'
        ? 'border-[color-mix(in_srgb,var(--app-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel))]'
        : 'border-[color-mix(in_srgb,var(--app-border)_82%,transparent)] bg-[color-mix(in_srgb,var(--app-panel)_82%,transparent)]'
    }`}
  >
    <div className={`text-[10px] uppercase tracking-[0.18em] ${tone === 'accent' ? 'text-[var(--app-accent)]' : 'text-[var(--app-muted)]'}`}>
      {eyebrow}
    </div>
    <div className="mt-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--app-text)]">{title}</div>
    <div className="mt-2 text-sm leading-7 text-[var(--app-muted)]">{detail}</div>
    <div className="mt-4 border-t border-[color-mix(in_srgb,var(--app-border)_74%,transparent)] pt-4">
      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
        <span>{outcomeLabel}</span>
        <span className="text-[var(--app-text)]">{outcomeValue}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {carryItems.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-2 rounded-[999px] border border-[color-mix(in_srgb,var(--app-border)_74%,transparent)] bg-[color-mix(in_srgb,var(--app-panel-2)_78%,#050505)] px-2.5 py-1.5 text-[9px] uppercase tracking-[0.18em] text-[var(--app-muted)]"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  </div>
);

export const GuestStationHandoff: React.FC<GuestStationHandoffProps> = ({
  open,
  localSummary,
  accountSummary,
  accountLabel,
  accountWorkspace,
  importWorkspace,
  onKeepAccount,
  onImportLocal,
  onReturnToLocal,
}) => {
  const guestHandoff = useMemo(() => readXtationOnboardingHandoff(), []);
  const guestLastView = useMemo(() => readStoredXtationLastView(), []);
  const localWorkspace = formatWorkspaceLabel(guestLastView);
  const importedDestination = formatWorkspaceLabel(importWorkspace);
  const accountDestination = formatWorkspaceLabel(accountWorkspace);

  return (
    <AuthDrawer
      open={open}
      onClose={onKeepAccount}
      variant="center"
      panelClassName="!w-[min(96vw,1180px)] !max-h-[92dvh] overflow-y-auto rounded-[28px] border border-[color-mix(in_srgb,var(--app-border)_88%,transparent)] bg-[radial-gradient(circle_at_top_left,rgba(111,178,255,0.12),transparent_28%),linear-gradient(180deg,rgba(10,12,18,0.98),rgba(8,10,16,0.98))] shadow-[0_34px_140px_rgba(0,0,0,0.46)]"
    >
      <div className="grid gap-6 p-5 md:p-7 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-5">
          <div className="rounded-[24px] border border-[color-mix(in_srgb,var(--app-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--app-panel)_84%,transparent)] p-5">
            <div className="flex items-center gap-3">
              <ShieldAlert size={18} className="text-[var(--app-accent)]" />
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--app-accent)]">Station Handoff</div>
            </div>
            <h2 className="mt-3 text-3xl font-semibold text-[var(--app-text)]">Local station found</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--app-muted)]">
              XTATION detected a guest-mode station on this device and an existing account station for {accountLabel}.
              Choose how to continue before anything gets overwritten.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SummaryCard
              title="Local Station"
              accent="text-[var(--app-accent)]"
              icon={HardDriveDownload}
              summary={localSummary}
              workspace={localWorkspace}
              relayTitle={guestHandoff && !guestHandoff.dismissedAt ? guestHandoff.title : null}
            />
            <SummaryCard
              title="Account Station"
              accent="text-[#90efc4]"
              icon={Cloud}
              summary={accountSummary}
              workspace={accountDestination}
            />
          </div>

          <div className="rounded-[22px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_84%,transparent)] p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">
              <DatabaseBackup size={14} className="text-[var(--app-accent)]" />
              Safety rule
            </div>
            <div className="mt-3 text-sm leading-7 text-[var(--app-muted)]">
              If you import the local station, XTATION first saves a recovery snapshot of the current account ledger on this device.
              The safe default is to keep the current account data unchanged.
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <DecisionCard
              eyebrow="Keep account"
              title="Leave cloud state untouched"
              detail="Use the account station as the source of truth right now. XTATION keeps the guest record on this device, but the signed-in session continues from the account workspace."
              outcomeLabel="Continue in"
              outcomeValue={accountDestination}
              carryItems={['Account stays live', 'Guest station remains local', 'Cloud record unchanged']}
            />

            <DecisionCard
              eyebrow="Import local"
              title="Carry the local working context"
              detail={`Move the guest station into this account and reopen directly in ${importedDestination}. XTATION creates a recovery snapshot of the current account record first.`}
              outcomeLabel="Reopen in"
              outcomeValue={importedDestination}
              carryItems={[
                'Guest quests and sessions',
                'Guest tree and loadout state',
                'Guest workspace continuity',
                guestHandoff && !guestHandoff.dismissedAt ? `Starter relay: ${guestHandoff.title}` : 'No starter relay',
              ]}
              tone="accent"
            />

            <DecisionCard
              eyebrow="Return local"
              title="Go back without importing"
              detail="Leave the account session and reopen the guest-mode station as it is now. Use this when the local station is still your working area and you are not ready to merge yet."
              outcomeLabel="Return to"
              outcomeValue={localWorkspace}
              carryItems={['Guest station resumes', 'Account left unchanged', 'Import decision deferred']}
            />
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[20px] border border-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] bg-[color-mix(in_srgb,var(--app-panel)_82%,transparent)] p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-accent)]">
              <Waypoints size={14} />
              Continuation map
            </div>
            <div className="mt-3 grid gap-3">
              <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                <span>Account resume</span>
                <span className="text-[var(--app-text)]">{accountDestination}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                <span>Guest resume</span>
                <span className="text-[var(--app-text)]">{localWorkspace}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                <span>Import target</span>
                <span className="text-[var(--app-text)]">{importedDestination}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onMouseEnter={playHoverSound}
            onClick={() => {
              playClickSound();
              onKeepAccount();
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_86%,transparent)] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-text)] transition-colors hover:border-[var(--app-accent)]"
          >
            Keep Account Station
          </button>

          <button
            type="button"
            onMouseEnter={playHoverSound}
            onClick={() => {
              playClickSound();
              onImportLocal();
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-text)]"
          >
            <ArrowRightLeft size={14} />
            Import Local Station Into Account
          </button>

          <button
            type="button"
            onMouseEnter={playHoverSound}
            onClick={() => {
              playClickSound();
              onReturnToLocal();
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] border border-[color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-transparent px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
          >
            Return To Local Station
          </button>

          <div className="rounded-[20px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_82%,transparent)] p-4 text-sm leading-7 text-[var(--app-muted)]">
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-accent)]">
              <Sparkles size={14} />
              Recommendation
            </div>
            Keep the account station if the synced cloud record is already your source of truth.
            Import local only when the guest station is the workspace you want this account to become next.
          </div>
        </aside>
      </div>
    </AuthDrawer>
  );
};
