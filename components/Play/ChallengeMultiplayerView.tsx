import React, { useState } from 'react';
import { FriendOption, MultiplayerDraft, MultiplayerMessage } from './challengeWidgetTypes';

interface ChallengeMultiplayerViewProps {
  draft: MultiplayerDraft;
  friends: FriendOption[];
  onChange: (patch: Partial<MultiplayerDraft>) => void;
  onClose: () => void;
  onStartRunning: () => void;
}

export const ChallengeMultiplayerView: React.FC<ChallengeMultiplayerViewProps> = ({
  draft,
  friends,
  onChange,
  onClose,
  onStartRunning,
}) => {
  const [inviteSent, setInviteSent] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [messages, setMessages] = useState<MultiplayerMessage[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const sendInvite = () => {
    setInviteSent(true);
  };

  const toggleInvite = (id: string) => {
    const current = draft.inviteFriendIds || [];
    if (current.includes(id)) {
      onChange({ inviteFriendIds: current.filter(item => item !== id) });
      return;
    }
    onChange({ inviteFriendIds: [...current, id] });
  };

  const sendMessage = () => {
    if (!draftMessage.trim()) return;
    const msg: MultiplayerMessage = {
      id: `msg-${Date.now()}`,
      from: 'You',
      text: draftMessage.trim(),
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    setDraftMessage('');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] uppercase tracking-[0.35em] text-white">Multiplayer</div>
        <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg border border-white/10 text-[#f3f0e8]">
          X
        </button>
      </div>

      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#8b847a]">Create challenge</div>
        <input
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Challenge name"
          className="w-full bg-[#111114] border border-white/10 rounded px-3 py-2 text-[11px] text-white"
        />
        <textarea
          value={draft.rules}
          onChange={(e) => onChange({ rules: e.target.value })}
          placeholder="Challenge rules"
          className="w-full bg-[#111114] border border-white/10 rounded px-3 py-2 text-[11px] text-white"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={draft.timeType}
            onChange={(e) => onChange({ timeType: e.target.value as MultiplayerDraft['timeType'] })}
            className="bg-[#111114] border border-white/10 rounded px-2 py-1 text-[11px] text-white"
          >
            <option value="countdown">Countdown</option>
            <option value="period">Period</option>
          </select>
          <input
            type="number"
            min={1}
            value={draft.durationMin}
            onChange={(e) => onChange({ durationMin: Number(e.target.value) })}
            className="bg-[#111114] border border-white/10 rounded px-2 py-1 text-[11px] text-white"
            placeholder="Minutes"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={draft.visibility}
            onChange={(e) => onChange({ visibility: e.target.value as MultiplayerDraft['visibility'] })}
            className="bg-[#111114] border border-white/10 rounded px-2 py-1 text-[11px] text-white"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
          <button
            type="button"
            onClick={() => setIsInviteOpen((prev) => !prev)}
            className="rounded border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.25em] text-[#f3f0e8]"
          >
            Invite
          </button>
        </div>
        {isInviteOpen && (
          <div className="rounded-xl border border-white/10 bg-[#141418] p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#8b847a]">Invite friends</div>
            <div className="grid gap-2">
              {friends.map((friend) => {
                const selected = (draft.inviteFriendIds || []).includes(friend.id);
                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => toggleInvite(friend.id)}
                    className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-[11px] uppercase tracking-[0.2em] ${
                      selected ? 'border-[#f46a2e]/60 bg-[#2a1a12] text-white' : 'border-white/10 text-[#f3f0e8]'
                    }`}
                  >
                    {friend.name}
                    {selected && <span className="text-[9px]">Selected</span>}
                  </button>
                );
              })}
              {!friends.length && <div className="text-[10px] text-[#8b847a]">No friends yet.</div>}
            </div>
            {(draft.inviteFriendIds || []).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {(draft.inviteFriendIds || []).map((id) => {
                  const friend = friends.find((f) => f.id === id);
                  if (!friend) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-2 py-1 text-[10px] text-[#f3f0e8]">
                      {friend.name}
                      <button
                        type="button"
                        onClick={() => toggleInvite(id)}
                        className="text-[10px] text-[#f46a2e]"
                      >
                        Remove
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={sendInvite}
          className="w-full rounded-xl border border-white/10 py-2 text-[11px] uppercase tracking-[0.25em] text-[#f3f0e8]"
        >
          Send request
        </button>
      </div>

      {inviteSent && !accepted && (
        <div className="rounded-xl border border-white/10 bg-[#141418] p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#8b847a]">Pending / Lobby</div>
          <div className="text-[11px] text-white">Waiting for response…</div>
          <button
            type="button"
            onClick={() => setAccepted(true)}
            className="px-3 py-2 rounded border border-white/15 text-[10px] uppercase tracking-[0.25em] text-[#f3f0e8]"
          >
            Simulate accept
          </button>
        </div>
      )}

      {accepted && (
        <div className="rounded-xl border border-white/10 bg-[#141418] p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#8b847a]">Party chat</div>
          <div className="max-h-32 overflow-auto space-y-2">
            {messages.length === 0 && <div className="text-[10px] text-[#8b847a]">No messages yet.</div>}
            {messages.map((msg) => (
              <div key={msg.id} className="text-[11px] text-white">
                <span className="text-[#8b847a]">{msg.from}:</span> {msg.text}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
              className="flex-1 bg-[#111114] border border-white/10 rounded px-2 py-1 text-[11px] text-white"
              placeholder="Type message"
            />
            <button
              type="button"
              onClick={sendMessage}
              className="px-3 py-1 rounded border border-white/15 text-[10px] uppercase tracking-[0.25em] text-[#f3f0e8]"
            >
              Send
            </button>
          </div>
          <button
            type="button"
            onClick={onStartRunning}
            className="w-full rounded-xl border border-[#f46a2e]/50 bg-[#2a1a12] py-2 text-[11px] uppercase tracking-[0.28em] text-white"
          >
            Start match
          </button>
        </div>
      )}

      <div className="text-[9px] uppercase tracking-[0.28em] text-[#8b847a]">
        TODO: wire invites + chat transport
      </div>
    </div>
  );
};
