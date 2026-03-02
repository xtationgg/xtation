import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Collaboration, Mission } from '../../types';
import {
  getUserScopedKey,
  isUserScopedStorageKey,
  readUserScopedJSON,
  readUserScopedNumber,
  writeUserScopedJSON,
  writeUserScopedNumber,
} from '../../src/lib/userScopedStorage';

const KEY_SEEN = 'ui_seen_bell_ts_v1';
const KEY_COLLABS = 'mp_collabs';

type NotificationsOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  missions: Mission[];
};

export const NotificationsOverlay: React.FC<NotificationsOverlayProps> = ({ isOpen, onClose, missions }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [storageVersion, setStorageVersion] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const onStorage = (event: StorageEvent) => {
      if (isUserScopedStorageKey(event.key, KEY_COLLABS) || isUserScopedStorageKey(event.key, KEY_SEEN)) {
        setStorageVersion(v => v + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [isOpen]);

  const collabs = useMemo(() => readUserScopedJSON<Collaboration[]>(KEY_COLLABS, []), [storageVersion, isOpen]);
  const pending = useMemo(() => {
    const items = collabs.flatMap(c =>
      (c.proposals || [])
        .filter(p => p.status === 'pending')
        .map(p => ({
          ts: p.createdAt,
          title: `[${c.title}] Pending proposal: ${p.type}`,
          collabId: c.id,
          proposalId: p.id,
          type: p.type,
          detail: p.payload,
        }))
    );
    return items.sort((a, b) => b.ts - a.ts);
  }, [collabs]);

  const updateProposal = (collabId: string, proposalId: string, approve: boolean) => {
    const list = readUserScopedJSON<Collaboration[]>(KEY_COLLABS, []);
    const next = list.map(c => {
      if (c.id !== collabId) return c;
      const prop = (c.proposals || []).find(p => p.id === proposalId);
      if (!prop) return c;
      const updated = {
        ...prop,
        status: approve ? 'approved' : 'rejected',
        reviewedBy: 'me',
        reviewedAt: Date.now(),
      };
      return {
        ...c,
        proposals: (c.proposals || []).map(p => (p.id === proposalId ? updated : p)),
        activity: [
          {
            id: `act-${Date.now()}`,
            action: approve ? 'proposal_approved' : 'proposal_rejected',
            actorId: 'me',
            summary: `${approve ? 'Approved' : 'Rejected'} proposal ${prop.type}`,
            ts: Date.now(),
          },
          ...(c.activity || []),
        ],
      };
    });
    writeUserScopedJSON(KEY_COLLABS, next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('mp-storage', { detail: { key: KEY_COLLABS, scopedKey: getUserScopedKey(KEY_COLLABS), value: next } })
      );
    }
    setStorageVersion(v => v + 1);
  };

  const dueSoon = useMemo(() => {
    const now = Date.now();
    const soonMs = 2 * 60 * 60 * 1000; // 2 hours
    return (missions || [])
      .filter(m => !m.completed)
      .filter(m => m.deadline <= now + soonMs)
      .sort((a, b) => a.deadline - b.deadline)
      .slice(0, 20)
      .map(m => ({
        ts: m.deadline,
        title: `Mission due: ${m.title}`,
        subtitle: m.deadline <= now ? 'OVERDUE' : 'Due soon',
      }));
  }, [missions]);

  const seenTs = readUserScopedNumber(KEY_SEEN, 0);
  const newCount = useMemo(() => [...pending, ...dueSoon].filter(i => i.ts > seenTs).length, [pending, dueSoon, seenTs]);

  useEffect(() => {
    if (!isOpen) return;
    writeUserScopedNumber(KEY_SEEN, Date.now());
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isOpen) return;
      const target = event.target as Element;
      const toggleBtn = document.getElementById('bell-toggle');
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
            <Bell size={18} />
            <div className="text-xs font-bold tracking-widest uppercase">Notifications</div>
            <div className="text-[10px] text-[var(--ui-muted)]">New: {newCount}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5"><X size={18} /></button>
        </div>

        <div className="h-[calc(100%-48px)] overflow-auto p-4 bg-[#fafbfc] space-y-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-3">Mission deadlines (synced)</div>
            <div className="space-y-2">
              {dueSoon.map((i, idx) => (
                <div key={`due-${idx}`} className={'border rounded px-3 py-2 bg-[var(--ui-panel)] ' + (i.ts > seenTs ? 'border-[var(--ui-accent)]' : 'border-[var(--ui-border)]')}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-[#e6e8ee] font-semibold">{i.title}</div>
                    <div className={'text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded border ' + (i.subtitle === 'OVERDUE' ? 'border-[var(--ui-accent)] text-[var(--ui-accent)]' : 'border-[var(--ui-border)] text-[var(--ui-muted)]')}>
                      {i.subtitle}
                    </div>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">{new Date(i.ts).toLocaleString()}</div>
                </div>
              ))}
              {!dueSoon.length && <div className="text-sm text-[var(--ui-muted)]">No deadlines soon.</div>}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-3">Collaboration (pending)</div>
            <div className="space-y-2">
              {pending.map((i, idx) => (
                <div key={`p-${idx}`} className={'border rounded px-3 py-2 bg-[var(--ui-panel)] ' + (i.ts > seenTs ? 'border-[var(--ui-accent)]' : 'border-[var(--ui-border)]')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-[#e6e8ee] font-semibold">{i.title}</div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">{new Date(i.ts).toLocaleString()}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateProposal(i.collabId, i.proposalId, true)}
                        className="text-[11px] uppercase tracking-[0.2em] border border-[#0f1115] px-2 py-1 rounded hover:bg-[#0f1115] hover:text-white"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => updateProposal(i.collabId, i.proposalId, false)}
                        className="text-[11px] uppercase tracking-[0.2em] border border-[var(--ui-accent)] text-[var(--ui-accent)] px-2 py-1 rounded"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!pending.length && <div className="text-sm text-[var(--ui-muted)]">No notifications.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
