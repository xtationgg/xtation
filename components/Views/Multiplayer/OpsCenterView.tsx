import React from 'react';
import { Copy, Cpu, Download, Eye, Flag, Globe, Map, MessageSquare, Shield, Users } from 'lucide-react';
import { Player } from '../../../types';
import { MultiplayerSnapshot } from '../../../src/multiplayer/metrics';
import { MultiplayerRouteTarget } from '../../../src/multiplayer/routes';
import { XtationFeatureSettings, XtationPrivacySettings, XtationUserSettings } from '../../../src/settings/SettingsProvider';

export interface OpsCenterViewProps {
  snapshot: MultiplayerSnapshot;
  players: Player[];
  viewAsId: string;
  userSettings: XtationUserSettings;
  privacy: XtationPrivacySettings;
  features: XtationFeatureSettings;
  onSetViewAsId: (playerId: string) => void;
  onOpenTarget: (target: MultiplayerRouteTarget) => void;
  onFocusPlayer: (playerId: string) => void;
  onStopAllLiveShares: () => void;
  onCopyDiagnostics: () => void;
  onExportSnapshot: () => void;
}

const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] shadow-sm">
    <div className="border-b border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] px-4 py-3">
      <div className="text-xs uppercase tracking-[0.22em] text-[var(--app-muted)]">{title}</div>
      {subtitle ? <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{subtitle}</div> : null}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const PolicyCard: React.FC<{ label: string; value: string; detail: string; icon: React.ReactNode }> = ({
  label,
  value,
  detail,
  icon,
}) => (
  <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">{label}</div>
        <div className="mt-2 text-2xl font-black uppercase tracking-[0.04em] text-[var(--app-text)]">{value}</div>
      </div>
      <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))] p-2 text-[var(--app-accent)]">
        {icon}
      </div>
    </div>
    <div className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{detail}</div>
  </div>
);

const ActionButton: React.FC<{ label: string; onClick: () => void; icon: React.ReactNode }> = ({ label, onClick, icon }) => (
  <button
    type="button"
    onClick={onClick}
    className="ui-pressable flex items-center justify-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--app-text)] hover:border-[color-mix(in_srgb,var(--app-accent)_40%,transparent)]"
  >
    {icon}
    <span>{label}</span>
  </button>
);

const Badge: React.FC<{ tone?: 'neutral' | 'accent'; children: React.ReactNode }> = ({ tone = 'neutral', children }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${
      tone === 'accent'
        ? 'border-[color-mix(in_srgb,var(--app-accent)_38%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))] text-[var(--app-text)]'
        : 'border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] text-[var(--app-muted)]'
    }`}
  >
    {children}
  </span>
);

export const OpsCenterView: React.FC<OpsCenterViewProps> = ({
  snapshot,
  players,
  viewAsId,
  userSettings,
  privacy,
  features,
  onSetViewAsId,
  onOpenTarget,
  onFocusPlayer,
  onStopAllLiveShares,
  onCopyDiagnostics,
  onExportSnapshot,
}) => {
  const viewer = players.find((player) => player.id === viewAsId);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PolicyCard
          label="Presence"
          value={userSettings.presenceMode}
          detail="Controlled by the canonical settings engine."
          icon={<Eye size={18} />}
        />
        <PolicyCard
          label="Location"
          value={privacy.locationMode}
          detail={`${snapshot.liveShareCount} live and ${snapshot.cityShareCount} city-level shares active.`}
          icon={<Map size={18} />}
        />
        <PolicyCard
          label="Profile Scope"
          value={privacy.profileDetailLevel}
          detail={`${privacy.pinVisibility} pin visibility • ${privacy.closeCircle ? 'close-circle enabled' : 'close-circle off'}`}
          icon={<Shield size={18} />}
        />
        <PolicyCard
          label="Modules"
          value={`${[features.multiplayerEnabled, features.labEnabled, features.storeEnabled].filter(Boolean).length}/3`}
          detail="Multiplayer, Lab, and Store are now feature-gated subsystems."
          icon={<Cpu size={18} />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Panel title="Operational Controls" subtitle="Safe actions and export tools">
          <div className="grid gap-3 md:grid-cols-2">
            <ActionButton label="Copy Diagnostics" onClick={onCopyDiagnostics} icon={<Copy size={14} />} />
            <ActionButton label="Export Snapshot" onClick={onExportSnapshot} icon={<Download size={14} />} />
            <ActionButton label="Stop Live Shares" onClick={onStopAllLiveShares} icon={<Shield size={14} />} />
            <ActionButton label="Open Overview" onClick={() => onOpenTarget('OVERVIEW')} icon={<Globe size={14} />} />
            <ActionButton label="Open Intel" onClick={() => onOpenTarget('INTEL')} icon={<Eye size={14} />} />
            <ActionButton label="Open Network" onClick={() => onOpenTarget('NETWORK')} icon={<Users size={14} />} />
            <ActionButton label="Open Comms" onClick={() => onOpenTarget('COMMS')} icon={<MessageSquare size={14} />} />
            <ActionButton label="Open Earth" onClick={() => onOpenTarget('EARTH')} icon={<Map size={14} />} />
            <ActionButton label="Open Collaboration" onClick={() => onOpenTarget('COLLAB')} icon={<Flag size={14} />} />
            <ActionButton label="Open Trace" onClick={() => onOpenTarget('TRACE')} icon={<Cpu size={14} />} />
          </div>
          <div className="mt-4 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
            Policy changes belong in Settings. The ops center is for observing, exporting, routing, and operational safety actions.
          </div>
        </Panel>

        <Panel title="Viewer Simulation" subtitle="Switch the observer profile for the whole network view">
          <div className="space-y-3">
            <select
              value={viewAsId}
              onChange={(event) => onSetViewAsId(event.target.value)}
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-sm text-[var(--app-text)]"
            >
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <Badge tone="accent">{viewer?.name || 'Unknown viewer'}</Badge>
              <Badge>{viewer?.role || 'Unknown role'}</Badge>
              <Badge>{viewer?.permissions?.profileLevel || 'basic'} profile</Badge>
              <Badge>{viewer?.permissions?.location || 'off'} location</Badge>
            </div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
              This is useful for validating how privacy and permission rules affect other surfaces before real sync is introduced.
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <Panel title="Diagnostics" subtitle="Current network and collaboration state">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Players</div>
              <div className="mt-2 text-2xl font-black text-[var(--app-text)]">{snapshot.totalPlayers}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{snapshot.acceptedPlayers} accepted / {snapshot.pendingPlayers} pending</div>
            </div>
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Geo Assets</div>
              <div className="mt-2 text-2xl font-black text-[var(--app-text)]">{snapshot.visiblePins + snapshot.savedLocations}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{snapshot.visiblePins} pins / {snapshot.savedLocations} saved places</div>
            </div>
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Collaboration Load</div>
              <div className="mt-2 text-2xl font-black text-[var(--app-text)]">{snapshot.pendingProposals}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{snapshot.openTasks} open tasks / {snapshot.completedTasks} completed</div>
            </div>
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Readiness</div>
              <div className="mt-2 text-2xl font-black text-[var(--app-text)]">{snapshot.readinessScore}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">Derived from coverage, activity, geo, and collaboration state</div>
            </div>
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Communications</div>
              <div className="mt-2 text-2xl font-black text-[var(--app-text)]">{snapshot.threads}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{snapshot.unreadMessages} unread / {snapshot.orphanThreads} orphaned</div>
            </div>
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Trace Load</div>
              <div className="mt-2 text-2xl font-black text-[var(--app-text)]">{snapshot.auditEntries}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{snapshot.attentionEvents} attention-grade actions</div>
            </div>
          </div>
        </Panel>

        <Panel title="Hot Targets" subtitle="Best next people to inspect">
          <div className="space-y-2">
            {snapshot.xpLeaders.map(({ player, totalXp }) => (
              <button
                key={player.id}
                type="button"
                onClick={() => onFocusPlayer(player.id)}
                className="ui-pressable flex w-full items-center justify-between rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-left hover:border-[color-mix(in_srgb,var(--app-accent)_40%,transparent)]"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))] p-2 text-[var(--app-accent)]">
                    <Users size={14} />
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-[var(--app-text)]">{player.name}</div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">{player.role}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-bold text-[var(--app-text)]">{totalXp} XP</div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">focus dossier</div>
                </div>
              </button>
            ))}
            {!snapshot.xpLeaders.length ? (
              <div className="rounded-lg border border-dashed border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-4 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                No targets available until the network records more activity.
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
};
