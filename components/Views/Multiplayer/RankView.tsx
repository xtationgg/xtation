import React, { useMemo, useState } from 'react';
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
    const day = (now.getDay() + 6) % 7; // Monday as start
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'monthly') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'yearly') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }
  return start.getTime();
};

export const RankView: React.FC<RankViewProps> = ({ players, viewAsId, xpLogs }) => {
  const [filterPlayer, setFilterPlayer] = useState<string>('all');
  const viewer = players.find(p => p.id === viewAsId);
  const acceptedView = viewer?.accepted ?? true;
  const candidates = players.filter(p => p.permissions?.appearsInRank && p.accepted);
  const ranges: RangeKey[] = ['daily', 'weekly', 'monthly', 'yearly'];

  const leaderboards = useMemo(() => {
    return ranges.map(range => {
      const start = rangeStart(range);
      const scores = candidates.map(p => {
        const total = xpLogs
          .filter(log => log.playerId === p.id && log.timestamp >= start)
          .reduce((sum, log) => sum + log.amount, 0);
        return { player: p, score: total };
      }).sort((a, b) => b.score - a.score);
      return { range, scores };
    });
  }, [ranges, candidates, xpLogs]);

  const recentActivity = useMemo(() => {
    const filtered = filterPlayer === 'all' ? xpLogs : xpLogs.filter(l => l.playerId === filterPlayer);
    return filtered
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 15);
  }, [xpLogs, filterPlayer]);

  const playerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown';
  const maxYearly = leaderboards.find(b => b.range === 'yearly')?.scores[0]?.score || 1;

  const hasLogs = xpLogs.length > 0;

  return (
    <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
      <div className="grid lg:grid-cols-2 gap-6">
        {leaderboards.map(board => (
          <div key={board.range} className="bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-3">
              <span>{board.range.toUpperCase()} Rank</span>
            </div>
            <div className="space-y-2">
              {acceptedView ? (
                board.scores.map((entry, idx) => (
                  <div
                    key={entry.player.id}
                    className={`flex items-center justify-between border rounded px-3 py-2 ${idx === 0 ? 'border-[var(--ui-accent)] bg-[#fff5f6]' : 'border-[var(--ui-border)]'}`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#e6e8ee]">{entry.player.name}</div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">{entry.player.role}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-sm font-bold text-[#e6e8ee]">{entry.score} XP</div>
                      <div className="w-16 h-1 bg-[#e2e4ea] rounded overflow-hidden">
                        <div
                          className="h-full bg-[var(--ui-accent)]"
                          style={{ width: `${Math.min(100, Math.max(0, (entry.score / maxYearly) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-[var(--ui-muted)]">Viewer not accepted. Boards empty.</div>
              )}
              {!board.scores.length && <div className="text-sm text-[var(--ui-muted)]">No players visible for this board.</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded-lg shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)]">
          <span>Recent XP Activity</span>
          <select
            value={filterPlayer}
            onChange={e => setFilterPlayer(e.target.value)}
            className="border border-[var(--ui-border)] rounded px-2 py-1 text-[11px] bg-[var(--ui-panel)]"
          >
            <option value="all">All players</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {recentActivity.map(log => (
            <div key={log.id} className="border border-[var(--ui-border)] rounded px-3 py-2 text-sm flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#e6e8ee]">{playerName(log.playerId)}</div>
                <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--ui-muted)]">
                  {log.category || 'XP'} • {new Date(log.timestamp).toLocaleTimeString()}
                </div>
                {log.note && <div className="text-xs text-[var(--ui-muted)]">{log.note}</div>}
              </div>
              <div className={`text-sm font-bold ${log.amount >= 0 ? 'text-[#e6e8ee]' : 'text-[var(--ui-accent)]'}`}>
                {log.amount >= 0 ? '+' : ''}{log.amount}
              </div>
            </div>
          ))}
          {!recentActivity.length && (
            <div className="text-sm text-[var(--ui-muted)] border border-dashed border-[var(--ui-border)] rounded p-3">
              No XP activity yet. Add XP from the Players tab to see it here.
            </div>
          )}
        </div>
        {!hasLogs && (
          <div className="text-[11px] text-[var(--ui-muted)]">
            Hint: use the Players tab quick XP buttons or custom XP to populate the leaderboards.
          </div>
        )}
      </div>
    </div>
  );
};
