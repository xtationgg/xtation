import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { Mission, XpLog, Collaboration } from '../../types';
import { isUserScopedStorageKey, readUserScopedJSON, readUserScopedNumber, writeUserScopedNumber } from '../../src/lib/userScopedStorage';

const KEY_SEEN = 'ui_seen_trophy_ts_v1';
const KEY_XP_LOGS = 'mp_xpLogs';
const KEY_COLLABS = 'mp_collabs';

type TrophyOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  missions: Mission[];
};

export const TrophyOverlay: React.FC<TrophyOverlayProps> = ({ isOpen, onClose, missions }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pull other event sources from storage (Multiplayer saves there)
  const [storageVersion, setStorageVersion] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    // refresh any time we open (and on storage changes)
    const onStorage = (event: StorageEvent) => {
      if (
        isUserScopedStorageKey(event.key, KEY_XP_LOGS) ||
        isUserScopedStorageKey(event.key, KEY_COLLABS) ||
        isUserScopedStorageKey(event.key, KEY_SEEN)
      ) {
        setStorageVersion(v => v + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [isOpen]);

  const xpLogs = useMemo(() => readUserScopedJSON<XpLog[]>(KEY_XP_LOGS, []), [storageVersion, isOpen]);
  const collabs = useMemo(() => readUserScopedJSON<Collaboration[]>(KEY_COLLABS, []), [storageVersion, isOpen]);

  // This overlay is meant to be synced with “Terminal missions” state, not a permanent history log.
  const currentMissions = useMemo(() => {
    const list = (missions || []).slice().sort((a, b) => {
      // Active first, then by deadline
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.deadline || 0) - (b.deadline || 0);
    });
    return list;
  }, [missions]);

  const activityItems = useMemo(() => {
    const xp = xpLogs.map(x => ({ ts: x.timestamp, title: `${x.amount >= 0 ? '+' : ''}${x.amount} XP • ${x.note || x.tag || 'update'}`, type: 'xp' as const }));
    const collabActs = collabs.flatMap(c => (c.activity || []).map(a => ({ ts: a.ts, title: `[${c.title}] ${a.summary}`, type: 'collab' as const })));
    return [...xp, ...collabActs].filter(i => Number.isFinite(i.ts)).sort((a, b) => b.ts - a.ts).slice(0, 60);
  }, [xpLogs, collabs]);

  const seenTs = readUserScopedNumber(KEY_SEEN, 0);
  const newCount = useMemo(() => activityItems.filter(i => i.ts > seenTs).length, [activityItems, seenTs]);

  // mark seen when opened
  useEffect(() => {
    if (!isOpen) return;
    writeUserScopedNumber(KEY_SEEN, Date.now());
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isOpen) return;

      const target = event.target as Element;
      const toggleBtn = document.getElementById('trophy-toggle');

      if (containerRef.current && containerRef.current.contains(target as Node)) return;
      if (toggleBtn && (toggleBtn === target || toggleBtn.contains(target as Node))) return;
      if (target.closest?.('[data-portal-ignore-outside-click]')) return;

      onClose();
    };

    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" />

      <div ref={containerRef} className="absolute right-6 top-[72px] w-[860px] max-w-[95vw] h-[520px] bg-[var(--ui-panel)] border border-black/20 shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
        <div className="h-12 px-4 border-b border-black/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy size={18} />
            <div className="text-xs font-bold tracking-widest uppercase">Trophy / Activity</div>
            <div className="text-[10px] text-[var(--ui-muted)]">New: {newCount}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5"><X size={18} /></button>
        </div>

        <div className="h-[calc(100%-48px)] overflow-auto p-4 bg-[#fafbfc] space-y-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-3">Missions (synced)</div>
            <div className="space-y-2">
              {currentMissions.map(m => (
                <div key={m.id} className={'border rounded px-3 py-2 bg-[var(--ui-panel)] ' + (m.completed ? 'border-[var(--ui-border)]' : 'border-[#0f1115]')}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-[#e6e8ee] font-semibold truncate">{m.title}</div>
                    <div className={'text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded border ' + (m.completed ? 'border-[var(--ui-border)] text-[var(--ui-muted)]' : 'border-[var(--ui-accent)] text-[var(--ui-accent)]')}>
                      {m.completed ? 'completed' : 'active'}
                    </div>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)] mt-1">
                    XP: {m.xp || 0} • Due: {new Date(m.deadline).toLocaleString()}
                  </div>
                </div>
              ))}
              {!currentMissions.length && <div className="text-sm text-[var(--ui-muted)]">No missions.</div>}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-3">Activity (XP / Collab)</div>
            <div className="space-y-2">
              {activityItems.map((i, idx) => (
                <div key={idx} className={'border rounded px-3 py-2 bg-[var(--ui-panel)] ' + (i.ts > seenTs ? 'border-[var(--ui-accent)]' : 'border-[var(--ui-border)]')}>
                  <div className="text-sm text-[#e6e8ee] font-semibold">{i.title}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">{new Date(i.ts).toLocaleString()}</div>
                </div>
              ))}
              {!activityItems.length && <div className="text-sm text-[var(--ui-muted)]">No activity yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
