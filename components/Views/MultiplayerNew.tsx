import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player, Pin, Collaboration, LocationShareState, XpLog, CollaborationProposal, SavedLocation } from '../../types';
import { getEffectivePermissions } from '../../utils/permissions';
import { mpStorage } from '../../utils/mpStorage';
import { defaultPlayers } from '../../utils/defaultPlayers';
import { EarthView } from './multiplayer/EarthView';
import { Test01View } from './multiplayer/Test01View';
import { CollaborationView } from './multiplayer/CollaborationView';
import { RankView } from './multiplayer/RankView';
import { readUserScopedString, removeUserScopedString } from '../../src/lib/userScopedStorage';

type TabKey = 'PLAYERS' | 'EARTH' | 'COLLAB' | 'RANK';

const defaultPins: Pin[] = [
  {
    id: 'pin-1',
    title: 'Safe House',
    note: 'Rally point',
    lat: 37.7749,
    lng: -122.4194,
    scope: 'close',
    sharedWith: ['p1'],
    createdBy: 'me',
  },
];

const defaultCollabs: Collaboration[] = [
  {
    id: 'c1',
    title: 'Operation Dawn',
    goal: 'Scout and secure entry points',
    members: ['me', 'p1'],
    tasks: [
      { id: 't1', title: 'Mark entry', done: false },
      { id: 't2', title: 'Secure rooftop', done: false },
    ],
    activity: [],
    proposals: [
      { id: 'pr1', type: 'task', payload: { title: 'Add camera sweep' }, createdBy: 'p1', status: 'pending', createdAt: Date.now() },
    ],
  },
];

class MultiplayerErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message?: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: undefined };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, message: error?.message || 'Unknown error' };
  }
  componentDidCatch(error: any, info: any) {
    console.error('Multiplayer render error', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-sm text-[#ff2a3a] border border-[#ff2a3a] bg-[#fff5f6] rounded">
          Multiplayer failed to load. {this.state.message || ''} Check console for details.
        </div>
      );
    }
    return this.props.children;
  }
}

export const Multiplayer: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('PLAYERS');
  const [players, setPlayers] = useState<Player[]>(() => {
    const val = mpStorage.loadPlayers(defaultPlayers);
    return Array.isArray(val) && val.length ? val : defaultPlayers;
  });
  const [pins, setPins] = useState<Pin[]>(() => {
    const val = mpStorage.loadPins(defaultPins);
    return Array.isArray(val) ? val : defaultPins;
  });
  const [collabs, setCollabs] = useState<Collaboration[]>(() => {
    const val = mpStorage.loadCollabs(defaultCollabs);
    return Array.isArray(val) ? val : defaultCollabs;
  });
  const [xpLogs, setXpLogs] = useState<XpLog[]>(() => {
    const val = mpStorage.loadXpLogs([]);
    return Array.isArray(val) ? val : [];
  });
  const [sharingByPlayer, setSharingByPlayer] = useState<Record<string, LocationShareState>>(() => {
    const val = mpStorage.loadSharingByPlayer({});
    return val && typeof val === 'object' ? val : {};
  });
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(() => mpStorage.loadMyLocation(null));
  const [viewAsId, setViewAsId] = useState(() => mpStorage.loadViewAs(defaultPlayers[0]?.id || 'me'));
  const [toast, setToast] = useState<string>('');
  const [focusPlayerId, setFocusPlayerId] = useState<string | null>(null);

  // Earth view extras
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [pickPlayerId, setPickPlayerId] = useState<string | null>(null);
  const [earthFocus, setEarthFocus] = useState<{ playerId: string; loc: { lat: number; lng: number; label?: string } } | null>(null);

  const watchId = useRef<number | null>(null);
  const liveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!players.find(p => p.id === viewAsId)) {
      setViewAsId(players[0]?.id || 'me');
    }
  }, [players, viewAsId]);

  useEffect(() => {
    const pending = readUserScopedString('mp_focusPlayerId', null);
    if (!pending) return;
    setTab('PLAYERS');
    setFocusPlayerId(pending);
    removeUserScopedString('mp_focusPlayerId');
  }, []);

  useEffect(() => {
    const handleOpenPlayer = (event: Event) => {
      const detail = (event as CustomEvent<{ playerId?: string }>).detail;
      if (!detail?.playerId) return;
      setTab('PLAYERS');
      setFocusPlayerId(detail.playerId);
    };

    window.addEventListener('dusk:openPlayerDossier', handleOpenPlayer as EventListener);
    return () => window.removeEventListener('dusk:openPlayerDossier', handleOpenPlayer as EventListener);
  }, []);

  useEffect(() => mpStorage.save('mp_players', players), [players]);
  useEffect(() => mpStorage.save('mp_pins', pins), [pins]);
  useEffect(() => mpStorage.save('mp_collabs', collabs), [collabs]);
  useEffect(() => mpStorage.save('mp_xpLogs', xpLogs), [xpLogs]);
  useEffect(() => mpStorage.save('mp_sharingByPlayer', sharingByPlayer), [sharingByPlayer]);
  useEffect(() => mpStorage.save('mp_myLocation', myLocation), [myLocation]);
  useEffect(() => mpStorage.save('mp_viewAs', viewAsId), [viewAsId]);

  const startLive = (durationMs: number, playerIds: string[]) => {
    const expires = Date.now() + durationMs;
    setSharingByPlayer(prev => {
      const next = { ...prev };
      playerIds.forEach(id => {
        next[id] = { ...next[id], mode: 'live', liveExpiresAt: expires, lastUpdatedAt: Date.now() };
      });
      return next;
    });
    if (navigator.geolocation) {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = navigator.geolocation.watchPosition(
        pos => {
          setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setSharingByPlayer(prev => {
            const next = { ...prev };
            playerIds.forEach(id => {
              next[id] = { ...next[id], mode: 'live', lastUpdatedAt: Date.now(), liveExpiresAt: expires };
            });
            return next;
          });
        },
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }
    if (liveTimer.current) window.clearInterval(liveTimer.current);
    liveTimer.current = window.setInterval(() => {
      setSharingByPlayer(prev => {
        const now = Date.now();
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          const state = next[id];
          if (state?.mode === 'live' && state.liveExpiresAt && state.liveExpiresAt <= now) {
            next[id] = { mode: 'off' };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
  };

  const stopLive = (playerIds: string[]) => {
    if (watchId.current && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (liveTimer.current) {
      window.clearInterval(liveTimer.current);
      liveTimer.current = null;
    }
    setSharingByPlayer(prev => {
      const next = { ...prev };
      playerIds.forEach(id => {
        next[id] = { mode: 'off' };
      });
      return next;
    });
  };

  const onUpdatePlayer = (id: string, updates: Partial<Player>) => {
    setPlayers(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
  };

  const onAddPlayer = (data: Omit<Player, 'id'>) => {
    const newPlayer: Player = {
      ...data,
      id: `p-${Date.now()}`,
      permissions: data.permissions || {
        profileLevel: 'basic',
        location: 'off',
        pinVisibility: 'none',
        rankVisibility: true,
        appearsInRank: true,
        closeCircle: false,
      },
      accepted: data.accepted ?? true,
    };
    setPlayers(prev => [newPlayer, ...prev]);
    setToast('Player added');
  };

  const onDeletePlayer = (id: string) => {
    setPlayers(prev => prev.filter(p => p.id !== id));
    // also clean up any focus/pick state
    setPickPlayerId(prev => (prev === id ? null : prev));
    setEarthFocus(prev => (prev?.playerId === id ? null : prev));
    if (viewAsId === id) setViewAsId('me');
    setToast('Player deleted');
  };

  const onAddPin = (pin: Pin) => setPins(prev => [pin, ...prev]);

  const onGoToEarth = (focus: { playerId: string; loc: { lat: number; lng: number; label?: string } }) => {
    setEarthFocus(focus);
    setTab('EARTH');
    setToast('Opened map');
  };

  const onClearPickPlayer = () => setPickPlayerId(null);

  const onSetPlayerLocation = (playerId: string, loc: Player['location'] | undefined, extras?: Partial<Player>) => {
    setPlayers(prev =>
      prev.map(p =>
        p.id === playerId
          ? {
              ...p,
              ...(extras || {}),
              location: loc,
            }
          : p
      )
    );
  };
  const onUpdatePin = (id: string, updates: Partial<Pin>) => {
    setPins(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
  };
  const onDeletePin = (id: string) => setPins(prev => prev.filter(p => p.id !== id));

  const onUpdateTask = (collabId: string, taskId: string) => {
    setCollabs(prev =>
      prev.map(c =>
        c.id === collabId
          ? { ...c, tasks: c.tasks.map(t => (t.id === taskId ? { ...t, done: !t.done } : t)) }
          : c
      )
    );
  };

  const onApprove = (collabId: string, proposalId: string, approve: boolean) => {
    setCollabs(prev =>
      prev.map(c => {
        if (c.id !== collabId) return c;
        const proposal = c.proposals.find(p => p.id === proposalId);
        if (!proposal) return c;
        const updates: CollaborationProposal = {
          ...proposal,
          status: approve ? 'approved' : 'rejected',
          reviewedBy: viewAsId,
          reviewedAt: Date.now(),
        };

        let updatedCollab: Collaboration = {
          ...c,
          proposals: c.proposals.map(p => (p.id === proposalId ? updates : p)),
          activity: [
            {
              id: `act-${Date.now()}`,
              action: approve ? 'proposal_approved' : 'proposal_rejected',
              actorId: viewAsId,
              summary: `${approve ? 'Approved' : 'Rejected'} proposal ${proposal.type}`,
              ts: Date.now(),
            },
            ...c.activity,
          ],
        };

        if (approve) {
          if (proposal.type === 'task' && proposal.payload?.title) {
            updatedCollab = {
              ...updatedCollab,
              tasks: [...updatedCollab.tasks, { id: `task-${Date.now()}`, title: proposal.payload.title, done: false }],
              activity: [
                {
                  id: `act-${Date.now()}-task`,
                  action: 'task_added',
                  actorId: viewAsId,
                  summary: `Task added: ${proposal.payload.title}`,
                  ts: Date.now(),
                },
                ...updatedCollab.activity,
              ],
            };
          }
          if (proposal.type === 'goal' && proposal.payload?.goal) {
            updatedCollab = {
              ...updatedCollab,
              goal: proposal.payload.goal,
              activity: [
                {
                  id: `act-${Date.now()}-goal`,
                  action: 'goal_updated',
                  actorId: viewAsId,
                  summary: `Goal updated: ${proposal.payload.goal}`,
                  ts: Date.now(),
                },
                ...updatedCollab.activity,
              ],
            };
          }
          if (proposal.type === 'pin' && proposal.payload?.lat && proposal.payload?.lng) {
            setPins(prevPins => [
              {
                id: `pin-${Date.now()}`,
                title: proposal.payload.title || 'Collab Pin',
                note: proposal.payload.note || '',
                lat: proposal.payload.lat,
                lng: proposal.payload.lng,
                scope: proposal.payload.scope || 'specific',
                sharedWith: proposal.payload.sharedWith || [],
                createdBy: proposal.createdBy,
              },
              ...prevPins,
            ]);
            updatedCollab = {
              ...updatedCollab,
              activity: [
                {
                  id: `act-${Date.now()}-pin`,
                  action: 'pin_added',
                  actorId: viewAsId,
                  summary: `Pin added: ${proposal.payload.title || 'Collab Pin'}`,
                  ts: Date.now(),
                },
                ...updatedCollab.activity,
              ],
            };
          }
        }
        return updatedCollab;
      })
    );
  };

  const onCreateProposal = (collabId: string, type: CollaborationProposal['type'], payload: any) => {
    setCollabs(prev =>
      prev.map(c => {
        if (c.id !== collabId) return c;
        const proposal: CollaborationProposal = {
          id: `pr-${Date.now()}`,
          type,
          payload,
          createdBy: viewAsId,
          status: 'pending',
          createdAt: Date.now(),
        };
        return {
          ...c,
          proposals: [proposal, ...c.proposals],
          activity: [
            {
              id: `act-${Date.now()}`,
              action: 'proposal_created',
              actorId: viewAsId,
              summary: `Proposal: ${type}`,
              ts: Date.now(),
            },
            ...c.activity,
          ],
        };
      })
    );
    setToast('Proposal submitted');
  };

  const onAddXp = (playerId: string, amount: number, category?: string, note?: string) => {
    const log: XpLog = {
      id: `xp-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      playerId,
      amount,
      timestamp: Date.now(),
      tag: category,
      note,
    };
    setXpLogs(prev => [log, ...prev]);
    setToast(`${amount >= 0 ? '+' : ''}${amount} XP added`);
  };

  const feed = useMemo(() => {
    const xpEvents = xpLogs.slice(0, 10).map(log => ({
      ts: log.timestamp,
      summary: `${log.amount >= 0 ? '+' : ''}${log.amount} XP • ${players.find(p => p.id === log.playerId)?.name || 'Unknown'}`,
    }));
    const collabEvents = collabs.flatMap(c =>
      c.activity.slice(0, 5).map(a => ({
        ts: a.ts,
        summary: a.summary,
      }))
    );
    const combined = [...xpEvents, ...collabEvents].sort((a, b) => b.ts - a.ts).slice(0, 5);
    return combined;
  }, [xpLogs, collabs, players]);

  return (
    <MultiplayerErrorBoundary>
    <div className="p-8 min-h-[70vh] overflow-y-auto bg-[var(--ui-bg)] text-[var(--ui-text)]">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-black text-white px-4 py-2 rounded shadow transition-opacity animate-fade-in">
          {toast}
        </div>
      )}
      <div className="flex items-start gap-4 flex-wrap border-b border-[#e2e4ea] pb-3 mb-6">
        <div className="flex flex-col gap-2 flex-1 min-w-[260px]">
          <div className="text-xs uppercase tracking-[0.3em] text-[#555]">Multiplayer</div>
          <div className="flex items-center gap-2 flex-wrap">
        {(['PLAYERS', 'EARTH', 'COLLAB', 'RANK'] as TabKey[]).map(k => {
          const pending = k === 'COLLAB' && viewAsId === 'me'
            ? collabs.reduce((sum, c) => sum + c.proposals.filter(p => p.status === 'pending').length, 0)
            : 0;
          return (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1 border rounded-sm text-xs tracking-[0.2em] uppercase transition-colors flex items-center gap-2 ${
              tab === k
                ? 'border-[var(--ui-accent)] bg-[var(--ui-accent)] text-white shadow-sm'
                : 'border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-muted)] hover:border-[var(--ui-accent)]'
            }`}
          >
            {k.toLowerCase()}
            {pending > 0 && (
              <span className="ml-1 text-[10px] px-1 rounded bg-[#ff2a3a] text-white transition-transform duration-200">
                {pending}
              </span>
            )}
          </button>
        )})}
        <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] ml-auto">Viewing as:</div>
        <select
          value={viewAsId}
          onChange={e => setViewAsId(e.target.value)}
          className="border border-[var(--ui-border)] rounded px-2 py-1 text-[11px] bg-[var(--ui-panel)] text-[var(--ui-text)]"
        >
          {players.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] border border-dashed border-[var(--ui-border)] rounded px-2 py-1">
          Debug: {JSON.stringify(getEffectivePermissions(players.find(p => p.id === viewAsId)))}
        </div>
          </div>
        </div>
        <div className="w-64 max-h-56 overflow-hidden flex-shrink-0 bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded shadow-sm p-3 text-xs uppercase tracking-[0.15em] text-[var(--ui-muted)] self-start">
          <div className="font-semibold text-[var(--ui-text)] mb-2">Multiplayer Activity</div>
          <div className="max-h-40 overflow-y-auto pr-1 space-y-1">
            {feed.map(item => (
              <div key={item.ts} className="text-[11px] text-[var(--ui-text)]">
                <div className="font-semibold">{item.summary}</div>
                <div className="text-[10px] text-[var(--ui-muted)]">{new Date(item.ts).toLocaleTimeString()}</div>
              </div>
            ))}
            {!feed.length && <div className="text-[11px] text-[var(--ui-muted)]">No recent activity</div>}
          </div>
        </div>
      </div>

      {tab === 'PLAYERS' && (
        <Test01View
          players={players}
          onUpdatePlayer={onUpdatePlayer}
          onAddPlayer={onAddPlayer}
          onDeletePlayer={onDeletePlayer}
          onGoToEarth={onGoToEarth}
          setToast={setToast}
          focusPlayerId={focusPlayerId}
          onClearFocusPlayer={() => setFocusPlayerId(null)}
        />
      )}
      {tab === 'EARTH' && (
        <EarthView
          pins={pins}
          onAddPin={onAddPin}
          onUpdatePin={onUpdatePin}
          onDeletePin={onDeletePin}
          myLocation={myLocation}
          setMyLocation={setMyLocation}
          sharingByPlayer={sharingByPlayer}
          setSharingByPlayer={setSharingByPlayer}
          viewAsId={viewAsId}
          players={players}
          startLive={startLive}
          stopLive={stopLive}
          setToast={setToast}
          focusLocation={earthFocus}
          savedLocations={savedLocations}
          setSavedLocations={setSavedLocations}
          pickPlayerId={pickPlayerId}
          onClearPickPlayer={onClearPickPlayer}
          onSetPlayerLocation={onSetPlayerLocation}
        />
      )}
      {tab === 'COLLAB' && (
        <CollaborationView
          collabs={collabs}
          onUpdateTask={onUpdateTask}
          onApprove={onApprove}
          onCreateProposal={onCreateProposal}
          viewAsId={viewAsId}
          setToast={setToast}
        />
      )}
      {tab === 'RANK' && <RankView players={players} viewAsId={viewAsId} xpLogs={xpLogs} />}
    </div>
    </MultiplayerErrorBoundary>
  );
};
