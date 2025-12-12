import React, { useEffect, useState } from 'react';
import { Player } from '../../../types';
import { getEffectivePermissions } from '../../../utils/permissions';

export interface PlayersViewProps {
  players: Player[];
  onUpdatePlayer: (id: string, updates: Partial<Player>) => void;
  onAddPlayer: (data: Omit<Player, 'id'>) => void;
  viewAsId: string;
  onSetViewAs: (id: string) => void;
  onAddXp: (playerId: string, amount: number, category?: string, note?: string) => void;
  setToast: (msg: string) => void;
}

export const PlayersView: React.FC<PlayersViewProps> = ({ players, onUpdatePlayer, onAddPlayer, viewAsId, onSetViewAs, onAddXp, setToast }) => {
  const viewer = players.find(p => p.id === viewAsId);
  const [selectedId, setSelectedId] = useState(players[0]?.id ?? '');
  const selected = players.find(p => p.id === selectedId);
  const effective = getEffectivePermissions(viewer);
  const canSeeDetails = selected ? (selected.permissions?.profileLevel === 'details' || viewer?.id === selected.id || viewer?.id === 'me') : false;
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [newPlayer, setNewPlayer] = useState<{ name: string; role: string; email?: string; accepted: boolean }>({ name: '', role: '', email: '', accepted: true });

  useEffect(() => {
    if (!selected && players.length) setSelectedId(players[0].id);
  }, [players, selected]);

  const applyXp = (amount: number) => {
    if (!selected) return;
    onAddXp(selected.id, amount, category || undefined, note || undefined);
    setFeedback(`${amount >= 0 ? '+' : ''}${amount} XP added`);
    setToast(`${amount >= 0 ? '+' : ''}${amount} XP added`);
    if (customAmount === amount) setCustomAmount(0);
    setTimeout(() => setFeedback(''), 2000);
  };

  const toggleAccepted = () => {
    if (!selected) return;
    onUpdatePlayer(selected.id, { accepted: !selected.accepted });
    setToast(selected.accepted ? 'Member set to unaccepted' : 'Member accepted');
  };

  const submitNewPlayer = () => {
    if (!newPlayer.name.trim() || !newPlayer.role.trim()) {
      setToast('Name and role required');
      return;
    }
    onAddPlayer({
      name: newPlayer.name.trim(),
      role: newPlayer.role.trim(),
      email: newPlayer.email?.trim(),
      permissions: {
        profileLevel: 'basic',
        location: 'off',
        pinVisibility: 'none',
        rankVisibility: true,
        appearsInRank: true,
        closeCircle: false,
      },
      accepted: newPlayer.accepted,
    });
    setNewPlayer({ name: '', role: '', email: '', accepted: true });
    setShowAdd(false);
  };

  const filteredPlayers = players.filter(p =>
    [p.name, p.role, p.email || ''].some(field => field.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="grid lg:grid-cols-[360px,1fr] gap-6">
      <div className="bg-white border border-[#e2e4ea] rounded shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-[#666]">
          <span>Players</span>
          <div className="flex items-center gap-2">
            <span>Viewing as:</span>
            <select
              value={viewAsId}
              onChange={e => onSetViewAs(e.target.value)}
              className="border border-[#d8dae0] rounded px-2 py-1 text-[11px] bg-white"
            >
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name/role/email"
            className="w-full border border-[#d8dae0] rounded px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="px-3 py-1 border border-[#ff2a3a] text-[#ff2a3a] rounded text-[11px] uppercase tracking-[0.15em]"
          >
            {showAdd ? 'Close' : 'Add player'}
          </button>
        </div>
        {showAdd && (
          <div className="border border-dashed border-[#d8dae0] rounded p-3 space-y-2 animate-fade-in">
            <div className="grid gap-2 text-sm">
              <input
                value={newPlayer.name}
                onChange={e => setNewPlayer(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Name"
                className="border border-[#d8dae0] rounded px-2 py-1"
              />
              <input
                value={newPlayer.role}
                onChange={e => setNewPlayer(prev => ({ ...prev, role: e.target.value }))}
                placeholder="Role"
                className="border border-[#d8dae0] rounded px-2 py-1"
              />
              <input
                value={newPlayer.email}
                onChange={e => setNewPlayer(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Email (optional)"
                className="border border-[#d8dae0] rounded px-2 py-1"
              />
              <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#777]">
                <input
                  type="checkbox"
                  checked={newPlayer.accepted}
                  onChange={e => setNewPlayer(prev => ({ ...prev, accepted: e.target.checked }))}
                />
                Accepted member
              </label>
            </div>
            <button
              type="button"
              onClick={submitNewPlayer}
              className="px-3 py-1 border border-[#ff2a3a] text-[#ff2a3a] rounded text-[11px] uppercase tracking-[0.15em]"
            >
              Save player
            </button>
          </div>
        )}
        {players.length === 0 ? (
          <div className="text-sm text-[#777] border border-dashed border-[#d8dae0] rounded p-3">
            No players yet. Add a player to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPlayers.map(p => {
              const limited = p.permissions?.profileLevel === 'basic' && viewer?.id !== 'me' && viewer?.id !== p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left border rounded px-3 py-2 transition ${selectedId === p.id ? 'border-[#ff2a3a] bg-[#fff5f6]' : 'border-[#e2e4ea] bg-white hover:border-[#ff2a3a]'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-[#0f1115]">{p.name}</div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-[#777]">{p.role}</div>
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#555]">
                      {limited ? 'Basic view' : 'Details'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="text-[11px] uppercase tracking-[0.2em] text-[#777] border border-dashed border-[#d8dae0] rounded px-2 py-1">
          Perms: Profile {effective.profileLevel} | Location {effective.locationMode} | Pins {effective.pinVisibility} | Rank {effective.rankVisible ? 'On' : 'Off'} | Close {effective.closeCircle ? 'Yes' : 'No'}
        </div>
      </div>

      {selected && (
        <div className="bg-white border border-[#e2e4ea] rounded shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-[#666]">
            <span>Player Details</span>
            <span className="text-[#ff2a3a]">{selected.permissions?.profileLevel === 'basic' ? 'Basic' : 'Details'}</span>
          </div>
            <div className="grid md:grid-cols-2 gap-3 text-sm text-[#0f1115]">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#777] mb-1">Name</div>
                <div className="font-semibold">{selected.name}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#777] mb-1">Role</div>
                <div>{selected.role}</div>
              </div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#777]">
                <span>Status:</span>
                <button
                  onClick={toggleAccepted}
                  className={`px-2 py-1 border rounded text-[11px] ${selected.accepted ? 'border-[#2ecc71] text-[#2ecc71]' : 'border-[#ff2a3a] text-[#ff2a3a]'}`}
                >
                  {selected.accepted ? 'Accepted' : 'Accept member'}
                </button>
              </div>
            {canSeeDetails && (
              <>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#777] mb-1">Email</div>
                  <input
                    value={selected.email || ''}
                    onChange={e => onUpdatePlayer(selected.id, { email: e.target.value })}
                    className="w-full border border-[#d8dae0] rounded px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[#777] mb-1">Phone</div>
                  <input
                    value={selected.phone || ''}
                    onChange={e => onUpdatePlayer(selected.id, { phone: e.target.value })}
                    className="w-full border border-[#d8dae0] rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs uppercase tracking-[0.2em] text-[#777] mb-1">Notes</div>
                  <textarea
                    value={selected.notes || ''}
                    onChange={e => onUpdatePlayer(selected.id, { notes: e.target.value })}
                    className="w-full border border-[#d8dae0] rounded px-2 py-2 text-sm"
                    rows={3}
                  />
                </div>
              </>
            )}
            {!canSeeDetails && (
              <div className="md:col-span-2 text-sm text-[#777] border border-dashed border-[#d8dae0] rounded p-3">
                Basic profile only. Details hidden by permissions.
              </div>
            )}
            {selected && (
              <div className="md:col-span-2 border border-[#e2e4ea] rounded p-3 space-y-2">
                <div className="text-xs uppercase tracking-[0.2em] text-[#666]">Quick XP</div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {[10, 50, 100, -10].map(val => (
                    <button
                      key={val}
                      onClick={() => applyXp(val)}
                      className="px-2 py-1 border border-[#d8dae0] rounded hover:border-[#ff2a3a] hover:text-[#ff2a3a]"
                    >
                      {val > 0 ? `+${val}` : val} XP
                    </button>
                  ))}
                </div>
                <div className="grid md:grid-cols-3 gap-2 text-sm">
                  <input
                    type="number"
                    value={customAmount}
                    onChange={e => setCustomAmount(parseInt(e.target.value) || 0)}
                    placeholder="Custom amount"
                    className="border border-[#d8dae0] rounded px-2 py-1"
                  />
                  <input
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="Category"
                    className="border border-[#d8dae0] rounded px-2 py-1"
                  />
                  <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Note"
                    className="border border-[#d8dae0] rounded px-2 py-1"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => customAmount !== 0 && applyXp(customAmount)}
                  className="px-3 py-1 border border-[#ff2a3a] text-[#ff2a3a] rounded text-[11px] uppercase tracking-[0.15em]"
                  disabled={customAmount === 0}
                >
                  Apply XP
                </button>
                {feedback && <div className="text-[11px] text-[#0f1115]">{feedback}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
