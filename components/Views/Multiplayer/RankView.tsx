import React, { useMemo, useState } from 'react';
import { Activity, Trophy, Users, Zap } from 'lucide-react';
import { Player, XpLog } from '../../../types';

export interface RankViewProps {
  players: Player[];
  viewAsId: string;
  xpLogs: XpLog[];
}

type RangeKey = 'daily' | 'weekly' | 'monthly' | 'yearly';

const rangeStart = (range: RangeKey) => {
  const now = new Date();
  const start = new Date(now);
  if (range === 'daily') {
    start.setHours(0, 0, 0, 0);
  } else if (range === 'weekly') {
    const day = (now.getDay() + 6) % 7;
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'monthly') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }
  return start.getTime();
};

const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] shadow-sm">
    <div className="border-b border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] px-4 py-3">
      <div className="text-xs uppercase tracking-[0.22em] text-[var(--app-muted)]">{title}</div>
      {subtitle ? <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{subtitle}</div> : null}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

export const RankView: React.FC<RankViewProps> = ({ players, viewAsId, xpLogs }) => {
  const [filterPlayer, setFilterPlayer] = useState<string>('all');
  const viewer = players.find((player) => player.id === viewAsId);
  const acceptedView = viewer?.accepted ?? true;
  const candidates = players.filter((player) => player.permissions?.appearsInRank && player.accepted);
  const ranges: RangeKey[] = ['daily', 'weekly', 'monthly', 'yearly'];

  const leaderboards = useMemo(() => {
    return ranges.map((range) => {
      const start = rangeStart(range);
      const scores = candidates
        .map((player) => {
          const total = xpLogs
            .filter((log) => log.playerId === player.id && log.timestamp >= start)
            .reduce((sum, log) => sum + log.amount, 0);
          return { player, score: total };
        })
        .sort((a, b) => b.score - a.score);
      return { range, scores };
    });
  }, [candidates, xpLogs]);

  const recentActivity = useMemo(() => {
    const filtered = filterPlayer === 'all' ? xpLogs : xpLogs.filter((log) => log.playerId === filterPlayer);
    return filtered
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 18);
  }, [filterPlayer, xpLogs]);

  const yearlyBoard = leaderboards.find((board) => board.range === 'yearly');
  const topPerformer = yearlyBoard?.scores[0];
  const totalNetworkXp = xpLogs.reduce((sum, log) => sum + log.amount, 0);
  const activeContestants = yearlyBoard?.scores.filter((entry) => entry.score !== 0).length || 0;
  const maxYearly = yearlyBoard?.scores[0]?.score || 1;
  const playerName = (id: string) => players.find((player) => player.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Top Performer</div>
              <div className="mt-2 text-2xl font-black text-[var(--app-text)]">{topPerformer?.player.name || 'None'}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{topPerformer?.score || 0} yearly XP</div>
            </div>
            <Trophy size={18} className="text-[var(--app-accent)]" />
          </div>
        </div>
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Network XP</div>
              <div className="mt-2 text-2xl font-black text-[var(--app-text)]">{totalNetworkXp}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">All logged multiplayer XP</div>
            </div>
            <Zap size={18} className="text-[var(--app-accent)]" />
          </div>
        </div>
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Contestants</div>
              <div className="mt-2 text-2xl font-black text-[var(--app-text)]">{activeContestants}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{candidates.length} visible rank candidates</div>
            </div>
            <Users size={18} className="text-[var(--app-accent)]" />
          </div>
        </div>
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Viewer</div>
              <div className="mt-2 text-2xl font-black text-[var(--app-text)]">{viewer?.name || 'Unknown'}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{acceptedView ? 'Rank boards unlocked' : 'Viewer not accepted'}</div>
            </div>
            <Activity size={18} className="text-[var(--app-accent)]" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr,0.9fr]">
        <div className="grid gap-6 lg:grid-cols-2">
          {leaderboards.map((board) => (
            <Panel
              key={board.range}
              title={`${board.range.toUpperCase()} Rank`}
              subtitle="XP board derived from multiplayer logs"
            >
              <div className="space-y-2">
                {acceptedView ? (
                  board.scores.map((entry, index) => (
                    <div
                      key={`${board.range}-${entry.player.id}`}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                        index === 0
                          ? 'border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel))]'
                          : 'border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)]'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-semibold text-[var(--app-text)]">{entry.player.name}</div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">{entry.player.role}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-sm font-bold text-[var(--app-text)]">{entry.score} XP</div>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--app-text)_10%,transparent)]">
                          <div
                            className="h-full rounded-full bg-[var(--app-accent)]"
                            style={{ width: `${Math.min(100, Math.max(0, (entry.score / maxYearly) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-4 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                    Viewer not accepted. Boards stay hidden.
                  </div>
                )}
                {!board.scores.length ? (
                  <div className="rounded-lg border border-dashed border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-4 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                    No players visible for this board.
                  </div>
                ) : null}
              </div>
            </Panel>
          ))}
        </div>

        <Panel title="Recent XP Activity" subtitle="Filterable multiplayer XP log stream">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Activity feed</div>
            <select
              value={filterPlayer}
              onChange={(event) => setFilterPlayer(event.target.value)}
              className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-[11px] text-[var(--app-text)]"
            >
              <option value="all">All players</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {recentActivity.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--app-text)]">{playerName(log.playerId)}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                      {log.tag || 'XP'} • {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                    {log.note ? <div className="mt-2 text-xs text-[var(--app-muted)]">{log.note}</div> : null}
                  </div>
                  <div className={`text-sm font-bold ${log.amount >= 0 ? 'text-[var(--app-text)]' : 'text-[var(--app-accent)]'}`}>
                    {log.amount >= 0 ? '+' : ''}{log.amount}
                  </div>
                </div>
              </div>
            ))}
            {!recentActivity.length ? (
              <div className="rounded-lg border border-dashed border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-4 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                No XP activity yet. Generate it from squad or collaboration flows.
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
};
