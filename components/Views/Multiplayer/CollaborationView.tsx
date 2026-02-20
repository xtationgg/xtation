import React from 'react';
import { Collaboration } from '../../../types';

export interface CollaborationViewProps {
  collabs: Collaboration[];
  onUpdateTask: (collabId: string, taskId: string) => void;
  onApprove: (collabId: string, proposalId: string, approve: boolean) => void;
  onCreateProposal: (collabId: string, type: Collaboration['proposals'][number]['type'], payload: any) => void;
  viewAsId: string;
  setToast: (msg: string) => void;
}

export const CollaborationView: React.FC<CollaborationViewProps> = ({ collabs, onUpdateTask, onApprove, onCreateProposal, viewAsId, setToast }) => {
  const isAdmin = viewAsId === 'me';
  const visible = collabs.filter(c => isAdmin || c.members.includes(viewAsId));
  const [formState, setFormState] = React.useState<Record<string, { type: 'task' | 'goal' | 'pin'; title?: string; goal?: string; lat?: string; lng?: string; note?: string }>>({});
  const [proposalFilter, setProposalFilter] = React.useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const submitProposal = (collabId: string) => {
    const state = formState[collabId] || { type: 'task' };
    if (state.type === 'task' && state.title) {
      onCreateProposal(collabId, 'task', { title: state.title });
    } else if (state.type === 'goal' && state.goal) {
      onCreateProposal(collabId, 'goal', { goal: state.goal });
    } else if (state.type === 'pin' && state.lat && state.lng) {
      onCreateProposal(collabId, 'pin', {
        title: state.title || 'Collab Pin',
        lat: parseFloat(state.lat),
        lng: parseFloat(state.lng),
        note: state.note,
      });
    }
    setFormState(prev => ({ ...prev, [collabId]: { type: state.type } }));
    setToast('Proposal submitted');
  };

  return (
    <div className="grid lg:grid-cols-[380px,1fr] gap-6 items-start">
      <div className="bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded-lg shadow-sm p-4 space-y-3">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)]">Collaborations</div>
        <div className="space-y-2">
          {visible.map(c => (
            <div key={c.id} className="border border-[var(--ui-border)] rounded p-3">
              <div className="text-sm font-semibold text-[#e6e8ee]">{c.title}</div>
              <div className="text-xs text-[var(--ui-muted)]">{c.goal}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)] mt-1">Members: {c.members.length}</div>
            </div>
          ))}
          {!visible.length && <div className="text-sm text-[var(--ui-muted)] border border-dashed border-[var(--ui-border)] rounded p-3">No collaborations visible. Create a space to get started.</div>}
        </div>
      </div>
      <div className="bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded-lg shadow-sm p-4 space-y-3">
        {visible.map(c => (
          <div key={c.id} className="border border-[var(--ui-border)] rounded p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[#e6e8ee]">{c.title}</div>
                <div className="text-xs text-[var(--ui-muted)]">{c.goal}</div>
              </div>
              <div className="flex gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">
                <span>{c.tasks.length} Tasks</span>
                <span>{c.proposals.filter(p => p.status === 'pending').length} Pending</span>
              </div>
            </div>
            <div className="space-y-2">
              {c.tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={t.done} onChange={() => onUpdateTask(c.id, t.id)} />
                  <span className={t.done ? 'line-through text-[var(--ui-muted)]' : ''}>{t.title}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--ui-border)] pt-2 space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)]">
                <span>Proposals</span>
                <div className="flex gap-1 text-[10px]">
                  {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setProposalFilter(f)}
                      className={`px-2 py-0.5 border rounded ${proposalFilter === f ? 'border-[var(--ui-accent)] text-[var(--ui-accent)]' : 'border-[var(--ui-border)] text-[var(--ui-muted)]'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              {c.proposals
                .filter(p => proposalFilter === 'all' || p.status === proposalFilter)
                .map(p => (
                <div key={p.id} className="border border-dashed border-[var(--ui-border)] rounded p-2 text-sm flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#e6e8ee] capitalize">{p.type}</div>
                    <div className="text-[11px] text-[var(--ui-muted)] uppercase tracking-[0.15em]">
                      <span className={`px-2 py-0.5 rounded ${p.status === 'pending' ? 'bg-[#fff5f6] text-[var(--ui-accent)]' : p.status === 'approved' ? 'bg-[#e8f7ef] text-[#2ecc71]' : 'bg-[#fff2f2] text-[var(--ui-accent)]'}`}>
                        {p.status}
                      </span>
                      {!isAdmin && ' (view only)'}
                      {p.reviewedAt && ` • ${new Date(p.reviewedAt).toLocaleString()}`}
                    </div>
                    {p.status !== 'pending' && p.reviewedBy && (
                      <div className="text-[10px] text-[#999]">Reviewed by {p.reviewedBy}</div>
                    )}
                    </div>
                  {isAdmin ? (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { onApprove(c.id, p.id, true); setToast('Proposal approved'); }} className="px-2 py-1 border border-[#2ecc71] text-[#2ecc71] rounded text-[11px] uppercase">Approve</button>
                      <button type="button" onClick={() => { onApprove(c.id, p.id, false); setToast('Proposal rejected'); }} className="px-2 py-1 border border-[var(--ui-accent)] text-[var(--ui-accent)] rounded text-[11px] uppercase">Reject</button>
                    </div>
                  ) : (
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Admin only</div>
                  )}
                </div>
              ))}
              {!c.proposals.length && <div className="text-sm text-[var(--ui-muted)]">No proposals.</div>}
            </div>

            <div className="border-t border-[var(--ui-border)] pt-3 space-y-2">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)]">New Proposal</div>
              <div className="grid md:grid-cols-3 gap-2 text-sm">
                <select
                  value={formState[c.id]?.type || 'task'}
                  onChange={e => setFormState(prev => ({ ...prev, [c.id]: { ...(prev[c.id] || {}), type: e.target.value as any } }))}
                  className="border border-[var(--ui-border)] rounded px-2 py-1 text-[11px]"
                >
                  <option value="task">Add Task</option>
                  <option value="goal">Edit Goal</option>
                  <option value="pin">Add Pin</option>
                </select>
                <input
                  placeholder="Title/Goal"
                  value={formState[c.id]?.title || formState[c.id]?.goal || ''}
                  onChange={e => setFormState(prev => ({ ...prev, [c.id]: { ...(prev[c.id] || { type: 'task' }), title: e.target.value, goal: e.target.value } }))}
                  className="border border-[var(--ui-border)] rounded px-2 py-1"
                />
                <input
                  placeholder="Note"
                  value={formState[c.id]?.note || ''}
                  onChange={e => setFormState(prev => ({ ...prev, [c.id]: { ...(prev[c.id] || { type: 'task' }), note: e.target.value } }))}
                  className="border border-[var(--ui-border)] rounded px-2 py-1"
                />
                {formState[c.id]?.type === 'pin' && (
                  <>
                    <input
                      placeholder="Lat"
                      value={formState[c.id]?.lat || ''}
                      onChange={e => setFormState(prev => ({ ...prev, [c.id]: { ...(prev[c.id] || { type: 'pin' }), lat: e.target.value } }))}
                      className="border border-[var(--ui-border)] rounded px-2 py-1"
                    />
                    <input
                      placeholder="Lng"
                      value={formState[c.id]?.lng || ''}
                      onChange={e => setFormState(prev => ({ ...prev, [c.id]: { ...(prev[c.id] || { type: 'pin' }), lng: e.target.value } }))}
                      className="border border-[var(--ui-border)] rounded px-2 py-1"
                    />
                  </>
                )}
              </div>
            <button
              type="button"
              onClick={() => submitProposal(c.id)}
              className="px-3 py-1 border border-[var(--ui-accent)] text-[var(--ui-accent)] rounded text-[11px] uppercase tracking-[0.15em]"
            >
              Submit proposal
            </button>
            </div>

            <div className="border-t border-[var(--ui-border)] pt-3 space-y-2">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)]">Activity</div>
              <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                {c.activity.map(a => (
                  <div key={a.id} className="text-[11px] text-[var(--ui-muted)] border border-dashed border-[var(--ui-border)] rounded px-2 py-1">
                    <div className="font-semibold text-[#e6e8ee]">{a.action}</div>
                    <div>{a.summary}</div>
                    <div className="text-[10px] text-[var(--ui-muted)]">{new Date(a.ts).toLocaleString()} • by {a.actorId}</div>
                  </div>
                ))}
                {!c.activity.length && <div className="text-sm text-[var(--ui-muted)]">No activity yet.</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
