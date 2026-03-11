import React from 'react';
import { Flag, Plus, Users, Workflow } from 'lucide-react';
import { Collaboration, Player } from '../../../types';

export interface CollaborationViewProps {
  collabs: Collaboration[];
  players: Player[];
  onAddCollab: (draft: { title: string; goal: string; members: string[] }) => void;
  onUpdateTask: (collabId: string, taskId: string) => void;
  onApprove: (collabId: string, proposalId: string, approve: boolean) => void;
  onCreateProposal: (collabId: string, type: Collaboration['proposals'][number]['type'], payload: any) => void;
  viewAsId: string;
  setToast: (msg: string) => void;
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

export const CollaborationView: React.FC<CollaborationViewProps> = ({
  collabs,
  players,
  onAddCollab,
  onUpdateTask,
  onApprove,
  onCreateProposal,
  viewAsId,
  setToast,
}) => {
  const isAdmin = viewAsId === 'me';
  const visible = collabs.filter((collab) => isAdmin || collab.members.includes(viewAsId));
  const [selectedId, setSelectedId] = React.useState<string>(() => visible[0]?.id || '');
  const [proposalFilter, setProposalFilter] = React.useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [createTitle, setCreateTitle] = React.useState('');
  const [createGoal, setCreateGoal] = React.useState('');
  const [createMembers, setCreateMembers] = React.useState<string[]>(() => [viewAsId]);
  const [formState, setFormState] = React.useState<Record<string, { type: 'task' | 'goal' | 'pin'; title?: string; goal?: string; lat?: string; lng?: string; note?: string }>>({});

  React.useEffect(() => {
    if (!visible.find((collab) => collab.id === selectedId)) {
      setSelectedId(visible[0]?.id || '');
    }
  }, [selectedId, visible]);

  const selected = visible.find((collab) => collab.id === selectedId) || visible[0] || null;
  const totalPending = visible.reduce((sum, collab) => sum + collab.proposals.filter((proposal) => proposal.status === 'pending').length, 0);
  const totalOpenTasks = visible.reduce((sum, collab) => sum + collab.tasks.filter((task) => !task.done).length, 0);
  const totalCompletedTasks = visible.reduce((sum, collab) => sum + collab.tasks.filter((task) => task.done).length, 0);

  const toggleCreateMember = (playerId: string) => {
    setCreateMembers((prev) =>
      prev.includes(playerId) ? prev.filter((entry) => entry !== playerId) : [...prev, playerId]
    );
  };

  const submitCreate = () => {
    const title = createTitle.trim();
    const goal = createGoal.trim();
    const members = Array.from(new Set(createMembers.filter(Boolean)));
    if (!title || !goal || !members.length) {
      setToast('Add a title, goal, and at least one member');
      return;
    }

    onAddCollab({ title, goal, members });
    setCreateTitle('');
    setCreateGoal('');
    setCreateMembers([viewAsId]);
    setToast('Collaboration space created');
  };

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
    } else {
      setToast('Complete the proposal fields first');
      return;
    }

    setFormState((prev) => ({ ...prev, [collabId]: { type: state.type } }));
    setToast('Proposal submitted');
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Spaces</div>
              <div className="mt-2 text-3xl font-black text-[var(--app-text)]">{visible.length}</div>
            </div>
            <Flag size={18} className="text-[var(--app-accent)]" />
          </div>
        </div>
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Pending</div>
              <div className="mt-2 text-3xl font-black text-[var(--app-text)]">{totalPending}</div>
            </div>
            <Workflow size={18} className="text-[var(--app-accent)]" />
          </div>
        </div>
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Open Tasks</div>
              <div className="mt-2 text-3xl font-black text-[var(--app-text)]">{totalOpenTasks}</div>
            </div>
            <Flag size={18} className="text-[var(--app-accent)]" />
          </div>
        </div>
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">Completed</div>
              <div className="mt-2 text-3xl font-black text-[var(--app-text)]">{totalCompletedTasks}</div>
            </div>
            <Users size={18} className="text-[var(--app-accent)]" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px,1fr] items-start">
        <div className="space-y-6">
          <Panel title="Create Space" subtitle="Spin up a new collaboration room">
            <div className="space-y-3">
              <input
                value={createTitle}
                onChange={(event) => setCreateTitle(event.target.value)}
                placeholder="Space title"
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-sm text-[var(--app-text)]"
              />
              <textarea
                value={createGoal}
                onChange={(event) => setCreateGoal(event.target.value)}
                placeholder="Mission goal"
                rows={3}
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-sm text-[var(--app-text)]"
              />
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Members</div>
                <div className="flex flex-wrap gap-2">
                  {players.filter((player) => player.accepted).map((player) => {
                    const selectedMember = createMembers.includes(player.id);
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => toggleCreateMember(player.id)}
                        className={`ui-pressable rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
                          selectedMember
                            ? 'border-[var(--app-accent)] bg-[var(--app-accent-weak)] text-[var(--app-text)]'
                            : 'border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] text-[var(--app-muted)]'
                        }`}
                      >
                        {player.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={submitCreate}
                className="ui-pressable flex w-full items-center justify-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--app-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--app-text)]"
              >
                <Plus size={14} />
                Create Collaboration
              </button>
            </div>
          </Panel>

          <Panel title="Spaces" subtitle="Select an active collaboration">
            <div className="space-y-2">
              {visible.map((collab) => {
                const selectedCard = collab.id === selected?.id;
                const pending = collab.proposals.filter((proposal) => proposal.status === 'pending').length;
                return (
                  <button
                    key={collab.id}
                    type="button"
                    onClick={() => setSelectedId(collab.id)}
                    className={`ui-pressable w-full rounded-lg border px-3 py-3 text-left ${
                      selectedCard
                        ? 'border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel))]'
                        : 'border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--app-text)]">{collab.title}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{collab.goal}</div>
                      </div>
                      <div className="text-right text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                        {pending} pending
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                      <span>{collab.members.length} members</span>
                      <span>{collab.tasks.length} tasks</span>
                    </div>
                  </button>
                );
              })}
              {!visible.length ? (
                <div className="rounded-lg border border-dashed border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-4 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                  No collaboration spaces visible yet.
                </div>
              ) : null}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          {selected ? (
            <>
              <Panel title={selected.title} subtitle={selected.goal}>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Members</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selected.members.map((memberId) => (
                        <span key={memberId} className="rounded-full border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                          {players.find((player) => player.id === memberId)?.name || memberId}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Task Flow</div>
                    <div className="mt-2 text-2xl font-black text-[var(--app-text)]">{selected.tasks.filter((task) => task.done).length}/{selected.tasks.length}</div>
                  </div>
                  <div className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Proposals</div>
                    <div className="mt-2 text-2xl font-black text-[var(--app-text)]">{selected.proposals.length}</div>
                  </div>
                </div>
              </Panel>

              <Panel title="Tasks" subtitle="Work tracked inside this collaboration">
                <div className="space-y-2">
                  {selected.tasks.map((task) => (
                    <label
                      key={task.id}
                      className="flex items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2"
                    >
                      <input type="checkbox" checked={task.done} onChange={() => onUpdateTask(selected.id, task.id)} />
                      <span className={`text-sm ${task.done ? 'line-through text-[var(--app-muted)]' : 'text-[var(--app-text)]'}`}>{task.title}</span>
                    </label>
                  ))}
                  {!selected.tasks.length ? (
                    <div className="rounded-lg border border-dashed border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-4 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                      No tasks in this space yet.
                    </div>
                  ) : null}
                </div>
              </Panel>

              <Panel title="Proposals" subtitle="Pending and historical change requests">
                <div className="mb-3 flex flex-wrap gap-2">
                  {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setProposalFilter(filter)}
                      className={`ui-pressable rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
                        proposalFilter === filter
                          ? 'border-[var(--app-accent)] bg-[var(--app-accent-weak)] text-[var(--app-text)]'
                          : 'border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] text-[var(--app-muted)]'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {selected.proposals
                    .filter((proposal) => proposalFilter === 'all' || proposal.status === proposalFilter)
                    .map((proposal) => (
                      <div
                        key={proposal.id}
                        className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold capitalize text-[var(--app-text)]">{proposal.type}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
                              {proposal.status} • by {players.find((player) => player.id === proposal.createdBy)?.name || proposal.createdBy}
                            </div>
                            {proposal.reviewedBy ? (
                              <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                                reviewed by {players.find((player) => player.id === proposal.reviewedBy)?.name || proposal.reviewedBy}
                              </div>
                            ) : null}
                          </div>
                          {isAdmin ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => { onApprove(selected.id, proposal.id, true); setToast('Proposal approved'); }}
                                className="ui-pressable rounded border border-[#2ecc71] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#2ecc71]"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => { onApprove(selected.id, proposal.id, false); setToast('Proposal rejected'); }}
                                className="ui-pressable rounded border border-[var(--app-accent)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Admin only</div>
                          )}
                        </div>
                      </div>
                    ))}
                  {!selected.proposals.length ? (
                    <div className="rounded-lg border border-dashed border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-4 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                      No proposals recorded yet.
                    </div>
                  ) : null}
                </div>
              </Panel>

              <Panel title="New Proposal" subtitle="Suggest the next collaboration change">
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={formState[selected.id]?.type || 'task'}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        [selected.id]: { ...(prev[selected.id] || {}), type: event.target.value as 'task' | 'goal' | 'pin' },
                      }))
                    }
                    className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-sm text-[var(--app-text)]"
                  >
                    <option value="task">Add task</option>
                    <option value="goal">Change goal</option>
                    <option value="pin">Add pin</option>
                  </select>
                  <input
                    value={formState[selected.id]?.title || formState[selected.id]?.goal || ''}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        [selected.id]: {
                          ...(prev[selected.id] || { type: 'task' }),
                          title: event.target.value,
                          goal: event.target.value,
                        },
                      }))
                    }
                    placeholder="Title or goal"
                    className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-sm text-[var(--app-text)]"
                  />
                  <input
                    value={formState[selected.id]?.note || ''}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        [selected.id]: { ...(prev[selected.id] || { type: 'task' }), note: event.target.value },
                      }))
                    }
                    placeholder="Optional note"
                    className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-sm text-[var(--app-text)]"
                  />
                  {formState[selected.id]?.type === 'pin' ? (
                    <>
                      <input
                        value={formState[selected.id]?.lat || ''}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            [selected.id]: { ...(prev[selected.id] || { type: 'pin' }), lat: event.target.value },
                          }))
                        }
                        placeholder="Latitude"
                        className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-sm text-[var(--app-text)]"
                      />
                      <input
                        value={formState[selected.id]?.lng || ''}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            [selected.id]: { ...(prev[selected.id] || { type: 'pin' }), lng: event.target.value },
                          }))
                        }
                        placeholder="Longitude"
                        className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-sm text-[var(--app-text)]"
                      />
                    </>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => submitProposal(selected.id)}
                  className="ui-pressable mt-3 rounded-lg border border-[color-mix(in_srgb,var(--app-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--app-text)]"
                >
                  Submit Proposal
                </button>
              </Panel>

              <Panel title="Activity" subtitle="Recent actions inside this space">
                <div className="space-y-2">
                  {selected.activity.map((activity) => (
                    <div
                      key={activity.id}
                      className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-3"
                    >
                      <div className="text-sm font-semibold text-[var(--app-text)]">{activity.action}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{activity.summary}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                        {new Date(activity.ts).toLocaleString()} • {players.find((player) => player.id === activity.actorId)?.name || activity.actorId}
                      </div>
                    </div>
                  ))}
                  {!selected.activity.length ? (
                    <div className="rounded-lg border border-dashed border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-4 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                      No activity recorded in this space yet.
                    </div>
                  ) : null}
                </div>
              </Panel>
            </>
          ) : (
            <Panel title="No Space Selected" subtitle="Create or select a collaboration to continue">
              <div className="rounded-lg border border-dashed border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-6 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                No collaboration space is available for the current viewer.
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
};
