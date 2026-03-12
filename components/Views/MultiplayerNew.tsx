import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Player,
  Pin,
  Collaboration,
  LocationShareState,
  XpLog,
  CollaborationProposal,
  SavedLocation,
} from '../../types';
import { pinVisibleToViewer } from '../../utils/permissions';
import { mpStorage } from '../../utils/mpStorage';
import { defaultPlayers } from '../../utils/defaultPlayers';
import { EarthView } from './Multiplayer/EarthView';
import { Test01View } from './Multiplayer/Test01View';
import { CollaborationView } from './Multiplayer/CollaborationView';
import { RankView } from './Multiplayer/RankView';
import { OpsCenterView } from './Multiplayer/OpsCenterView';
import { Message, Thread, messagesStorage } from '../../utils/messagesStorage';
import {
  USER_SCOPED_STORAGE_EVENT,
  isUserScopedStorageKey,
  readUserScopedString,
  removeUserScopedString,
} from '../../src/lib/userScopedStorage';
import { buildMultiplayerSnapshot } from '../../src/multiplayer/metrics';
import { createMultiplayerAuditEntry, MultiplayerAuditEntry } from '../../src/multiplayer/audit';
import { MultiplayerRouteTarget } from '../../src/multiplayer/routes';
import { useAuth } from '../../src/auth/AuthProvider';
import { useAdminConsole } from '../../src/admin/AdminConsoleProvider';
import { useXtationSettings } from '../../src/settings/SettingsProvider';
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Compass,
  Copy,
  Cpu,
  Download,
  Eye,
  Flag,
  Globe,
  Map as MapIcon,
  MessageSquare,
  Plus,
  Radio,
  Search,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';

type SurfaceKey = 'HQ' | 'PEOPLE' | 'SPACES' | 'MAP' | 'SIGNALS' | 'OPS';
type PeopleMode = 'ROSTER' | 'NETWORK' | 'OUTREACH';
type SignalsMode = 'COMMS' | 'RANK' | 'TRACE';
type TraceFilter = 'all' | 'info' | 'attention' | 'critical';

const seedNow = Date.now();

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
  {
    id: 'pin-2',
    title: 'Atlas Planning Room',
    note: 'Strategy handoff location',
    lat: 1.2983,
    lng: 103.7869,
    scope: 'specific',
    sharedWith: ['p3'],
    createdBy: 'p3',
  },
];

const defaultCollabs: Collaboration[] = [
  {
    id: 'c1',
    title: 'Operation Dawn',
    goal: 'Scout and secure entry points',
    members: ['me', 'p1', 'p3'],
    tasks: [
      { id: 't1', title: 'Mark entry', done: true },
      { id: 't2', title: 'Secure rooftop', done: false },
      { id: 't3', title: 'Confirm fallback lane', done: false },
    ],
    activity: [
      {
        id: 'act-seed-1',
        action: 'status_update',
        actorId: 'p1',
        summary: 'Nova confirmed the safe house pin.',
        ts: seedNow - 1000 * 60 * 28,
      },
      {
        id: 'act-seed-2',
        action: 'plan_update',
        actorId: 'p3',
        summary: 'Atlas updated the fallback route.',
        ts: seedNow - 1000 * 60 * 61,
      },
    ],
    proposals: [
      {
        id: 'pr1',
        type: 'task',
        payload: { title: 'Add camera sweep' },
        createdBy: 'p1',
        status: 'pending',
        createdAt: seedNow - 1000 * 60 * 33,
      },
    ],
  },
];

const defaultXpLogs: XpLog[] = [
  {
    id: 'xp-seed-1',
    playerId: 'p1',
    amount: 42,
    timestamp: seedNow - 1000 * 60 * 18,
    tag: 'scouting',
    note: 'Mapped two viable entry lines.',
  },
  {
    id: 'xp-seed-2',
    playerId: 'p3',
    amount: 28,
    timestamp: seedNow - 1000 * 60 * 42,
    tag: 'planning',
    note: 'Refined handoff plan.',
  },
  {
    id: 'xp-seed-3',
    playerId: 'me',
    amount: 17,
    timestamp: seedNow - 1000 * 60 * 65,
    tag: 'ops',
    note: 'Staged command shell updates.',
  },
];

const defaultThreads: Thread[] = [
  {
    id: 'thread-p1-seed',
    title: 'Nova Direct',
    participantId: 'p1',
    createdAt: seedNow - 1000 * 60 * 90,
    lastMessageAt: seedNow - 1000 * 60 * 12,
  },
  {
    id: 'thread-p3-seed',
    title: 'Atlas Direct',
    participantId: 'p3',
    createdAt: seedNow - 1000 * 60 * 150,
    lastMessageAt: seedNow - 1000 * 60 * 34,
  },
];

const defaultMessages: Message[] = [
  {
    id: 'msg-seed-1',
    threadId: 'thread-p1-seed',
    from: 'p1',
    text: 'Scouting lane is clear. Safe house pin confirmed.',
    ts: seedNow - 1000 * 60 * 12,
    read: false,
  },
  {
    id: 'msg-seed-2',
    threadId: 'thread-p1-seed',
    from: 'me',
    text: 'Copy. Keep city-level share on for the next hour.',
    ts: seedNow - 1000 * 60 * 16,
    read: true,
  },
  {
    id: 'msg-seed-3',
    threadId: 'thread-p3-seed',
    from: 'p3',
    text: 'Drafted the next coordination block. Ready for review.',
    ts: seedNow - 1000 * 60 * 34,
    read: true,
  },
];

class MultiplayerErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message?: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: undefined };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, message: error instanceof Error ? error.message : 'Unknown error' };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('Multiplayer render error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-sm text-[var(--app-accent)] border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_6%,var(--app-panel))] rounded">
          Multiplayer failed to load. {this.state.message || ''} Check console for details.
        </div>
      );
    }

    return this.props.children;
  }
}

const Panel: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, action, children }) => (
  <section className="xt-mp-panel">
    <div className="xt-mp-panel-head">
      <div className="min-w-0">
        <div className="xt-mp-panel-kicker">{title}</div>
        {subtitle ? <div className="xt-mp-panel-subtitle">{subtitle}</div> : null}
      </div>
      {action ? <div className="xt-mp-panel-action">{action}</div> : null}
    </div>
    <div className="xt-mp-panel-body">{children}</div>
  </section>
);

const Badge: React.FC<{ children: React.ReactNode; tone?: 'default' | 'accent' | 'alert' }> = ({ children, tone = 'default' }) => {
  return <span className="xt-mp-badge" data-tone={tone}>{children}</span>;
};

const MetricCard: React.FC<{ label: string; value: string | number; detail: string; icon: React.ReactNode }> = ({
  label,
  value,
  detail,
  icon,
}) => (
  <div className="xt-mp-metric">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="xt-mp-metric-label">{label}</div>
        <div className="xt-mp-metric-value">{value}</div>
      </div>
      <div className="xt-mp-metric-icon">{icon}</div>
    </div>
    <div className="xt-mp-metric-detail">{detail}</div>
  </div>
);

const SurfaceButton: React.FC<{
  label: string;
  badge?: number;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}> = ({ label, badge, icon, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    data-active={active}
    className="xt-mp-nav-btn ui-pressable"
  >
    <div className="flex min-w-0 items-center gap-3">
      <span className="xt-mp-nav-icon">{icon}</span>
      <span className="xt-mp-nav-label">{label}</span>
    </div>
    {badge ? <span className="xt-mp-nav-badge">{badge}</span> : null}
  </button>
);

const ModeButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    data-active={active}
    className="xt-mp-mode-btn ui-pressable"
  >
    {label}
  </button>
);

const ListRow: React.FC<{
  title: string;
  detail: string;
  active?: boolean;
  badge?: React.ReactNode;
  onClick: () => void;
}> = ({ title, detail, active = false, badge, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    data-active={active}
    className="xt-mp-list-row ui-pressable"
  >
    <div className="min-w-0">
      <div className="xt-mp-list-title">{title}</div>
      <div className="xt-mp-list-detail">{detail}</div>
    </div>
    {badge ? badge : <ChevronRight size={14} className="shrink-0 text-[var(--app-muted)]" />}
  </button>
);

const CommandStat: React.FC<{ label: string; value: string | number; hint: string }> = ({ label, value, hint }) => (
  <div className="xt-mp-command-stat">
    <div className="xt-mp-command-stat-label">{label}</div>
    <div className="xt-mp-command-stat-value">{value}</div>
    <div className="xt-mp-command-stat-hint">{hint}</div>
  </div>
);

const RailActivityRow: React.FC<{
  title: string;
  detail: string;
  meta?: string;
  accent?: 'default' | 'alert';
  onClick?: () => void;
}> = ({ title, detail, meta, accent = 'default', onClick }) => {
  const content = (
    <>
      <div className="min-w-0">
        <div className="xt-mp-list-title">{title}</div>
        <div className="xt-mp-list-detail">{detail}</div>
      </div>
      {meta ? <div className="xt-mp-rail-meta">{meta}</div> : null}
    </>
  );

  if (!onClick) {
    return (
      <div className="xt-mp-list-row" data-tone={accent}>
        {content}
      </div>
    );
  }

  return (
    <button type="button" className="xt-mp-list-row ui-pressable" data-tone={accent} onClick={onClick}>
      {content}
    </button>
  );
};

const ActionButton: React.FC<{
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  tone?: 'default' | 'accent';
}> = ({ label, onClick, icon, tone = 'default' }) => (
  <button type="button" onClick={onClick} className="xt-mp-action-btn ui-pressable" data-tone={tone}>
    {icon ? <span className="xt-mp-action-icon">{icon}</span> : null}
    <span>{label}</span>
  </button>
);

const InfoBlock: React.FC<{ label: string; value: React.ReactNode; detail?: React.ReactNode }> = ({ label, value, detail }) => (
  <div className="xt-mp-info-block">
    <div className="xt-mp-panel-kicker">{label}</div>
    <div className="xt-mp-info-value">{value}</div>
    {detail ? <div className="xt-mp-info-detail">{detail}</div> : null}
  </div>
);

const MessageCard: React.FC<{
  title: string;
  timestamp: string;
  body: string;
  own?: boolean;
}> = ({ title, timestamp, body, own = false }) => (
  <div className="xt-mp-message-card" data-own={own}>
    <div className="flex items-center justify-between gap-3">
      <div className="xt-mp-list-title">{title}</div>
      <div className="xt-mp-rail-meta">{timestamp}</div>
    </div>
    <div className="xt-mp-message-body">{body}</div>
  </div>
);

const SectionHeader: React.FC<{
  eyebrow: string;
  title: string;
  detail: string;
  stats?: Array<{ label: string; value: string | number }>;
  actions?: React.ReactNode;
}> = ({ eyebrow, title, detail, stats = [], actions }) => (
  <div className="xt-mp-section-header">
    <div className="xt-mp-section-copy">
      <div className="xt-mp-section-eyebrow">{eyebrow}</div>
      <h3 className="xt-mp-section-title">{title}</h3>
      <p className="xt-mp-section-detail">{detail}</p>
    </div>
    <div className="xt-mp-section-side">
      {stats.length ? (
        <div className="xt-mp-section-stats">
          {stats.map((stat) => (
            <div key={`${stat.label}-${stat.value}`} className="xt-mp-section-stat">
              <div className="xt-mp-section-stat-label">{stat.label}</div>
              <div className="xt-mp-section-stat-value">{stat.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      {actions ? <div className="xt-mp-section-actions">{actions}</div> : null}
    </div>
  </div>
);

const formatTimeAgo = (timestamp: number) => {
  const delta = Math.max(0, Date.now() - timestamp);
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const locationLabel = (player: Player) =>
  player.location?.label || (player.location ? `${player.location.lat.toFixed(2)}, ${player.location.lng.toFixed(2)}` : 'No saved location');

const surfaceTitle: Record<SurfaceKey, { title: string; detail: string }> = {
  HQ: {
    title: 'Multiplayer HQ',
    detail: 'Triage first. Surface the work that matters before opening deeper tools.',
  },
  PEOPLE: {
    title: 'People',
    detail: 'Keep the roster understandable: one list, one selected dossier, one clear gap map.',
  },
  SPACES: {
    title: 'Spaces',
    detail: 'Collaboration lives in a few clear rooms, not scattered across duplicated controls.',
  },
  MAP: {
    title: 'Map',
    detail: 'Map tools should answer location questions fast, then expose advanced controls only when needed.',
  },
  SIGNALS: {
    title: 'Signals',
    detail: 'Communications, rank, and trace belong together because they are all live signal streams.',
  },
  OPS: {
    title: 'Operations',
    detail: 'Exports, diagnostics, viewer simulation, and risk posture stay in one controlled lane.',
  },
};

const surfaceFromTarget = (target: MultiplayerRouteTarget): SurfaceKey => {
  switch (target) {
    case 'SQUAD':
    case 'NETWORK':
      return 'PEOPLE';
    case 'COLLAB':
      return 'SPACES';
    case 'EARTH':
      return 'MAP';
    case 'COMMS':
    case 'RANK':
    case 'TRACE':
      return 'SIGNALS';
    case 'OPS':
      return 'OPS';
    case 'OVERVIEW':
    case 'INTEL':
    default:
      return 'HQ';
  }
};

const signalModeFromTarget = (target: MultiplayerRouteTarget): SignalsMode => {
  if (target === 'TRACE') return 'TRACE';
  if (target === 'RANK') return 'RANK';
  return 'COMMS';
};

export const Multiplayer: React.FC = () => {
  const { user } = useAuth();
  const { access: operatorAccess } = useAdminConsole();
  const { settings } = useXtationSettings();
  const { user: userSettings, privacy, features } = settings;

  const [surface, setSurface] = useState<SurfaceKey>('HQ');
  const [peopleMode, setPeopleMode] = useState<PeopleMode>('ROSTER');
  const [signalsMode, setSignalsMode] = useState<SignalsMode>('COMMS');
  const [traceFilter, setTraceFilter] = useState<TraceFilter>('all');
  const [playerSearch, setPlayerSearch] = useState('');

  const [players, setPlayers] = useState<Player[]>(() => {
    const value = mpStorage.loadPlayers(defaultPlayers);
    return Array.isArray(value) && value.length ? value : defaultPlayers;
  });
  const [pins, setPins] = useState<Pin[]>(() => {
    const value = mpStorage.loadPins(defaultPins);
    return Array.isArray(value) && value.length ? value : defaultPins;
  });
  const [collabs, setCollabs] = useState<Collaboration[]>(() => {
    const value = mpStorage.loadCollabs(defaultCollabs);
    return Array.isArray(value) && value.length ? value : defaultCollabs;
  });
  const [xpLogs, setXpLogs] = useState<XpLog[]>(() => {
    const value = mpStorage.loadXpLogs(defaultXpLogs);
    return Array.isArray(value) && value.length ? value : defaultXpLogs;
  });
  const [sharingByPlayer, setSharingByPlayer] = useState<Record<string, LocationShareState>>(() => {
    const value = mpStorage.loadSharingByPlayer({});
    return value && typeof value === 'object' ? value : {};
  });
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(() => mpStorage.loadMyLocation(null));
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(() => {
    const value = mpStorage.loadSavedLocations([]);
    return Array.isArray(value) ? value : [];
  });
  const [threads, setThreads] = useState<Thread[]>(() => {
    const value = messagesStorage.loadThreads(defaultThreads);
    return Array.isArray(value) && value.length ? value : defaultThreads;
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    const value = messagesStorage.loadMessages(defaultMessages);
    return Array.isArray(value) && value.length ? value : defaultMessages;
  });
  const [auditLog, setAuditLog] = useState<MultiplayerAuditEntry[]>(() => {
    const value = mpStorage.loadAuditLog([]);
    return Array.isArray(value) ? value : [];
  });

  const initialPlayer = defaultPlayers.find((player) => player.id !== 'me')?.id || defaultPlayers[0]?.id || 'me';
  const [selectedPlayerId, setSelectedPlayerId] = useState(initialPlayer);
  const [selectedCollabId, setSelectedCollabId] = useState(defaultCollabs[0]?.id || '');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(defaultThreads[0]?.id || null);
  const [viewAsId, setViewAsId] = useState(() => mpStorage.loadViewAs(defaultPlayers[0]?.id || 'me'));
  const [toast, setToast] = useState('');
  const [earthFocus, setEarthFocus] = useState<{ playerId: string; loc: { lat: number; lng: number; label?: string } } | null>(null);

  const [draftPlayerName, setDraftPlayerName] = useState('');
  const [draftPlayerRole, setDraftPlayerRole] = useState('Operator');
  const [draftCollabTitle, setDraftCollabTitle] = useState('');
  const [draftCollabGoal, setDraftCollabGoal] = useState('');
  const [draftPinTitle, setDraftPinTitle] = useState('');

  const watchId = useRef<number | null>(null);
  const liveTimer = useRef<number | null>(null);
  const threadsRef = useRef(threads);
  const messagesRef = useRef(messages);
  const myPresenceMode = userSettings.presenceMode;

  const logAudit = (
    entry: Omit<Parameters<typeof createMultiplayerAuditEntry>[0], 'severity'> & { severity?: MultiplayerAuditEntry['severity'] }
  ) => {
    setAuditLog((prev) => [createMultiplayerAuditEntry(entry), ...prev].slice(0, 180));
  };

  const hydrateUserScopedState = () => {
    const nextPlayers = mpStorage.loadPlayers(defaultPlayers);
    const nextPins = mpStorage.loadPins(defaultPins);
    const nextCollabs = mpStorage.loadCollabs(defaultCollabs);
    const nextXpLogs = mpStorage.loadXpLogs(defaultXpLogs);
    const nextSharingByPlayer = mpStorage.loadSharingByPlayer({});
    const nextMyLocation = mpStorage.loadMyLocation(null);
    const nextSavedLocations = mpStorage.loadSavedLocations([]);
    const nextThreads = messagesStorage.loadThreads(defaultThreads);
    const nextMessages = messagesStorage.loadMessages(defaultMessages);
    const nextAudit = mpStorage.loadAuditLog([]);

    setPlayers(Array.isArray(nextPlayers) && nextPlayers.length ? nextPlayers : defaultPlayers);
    setPins(Array.isArray(nextPins) && nextPins.length ? nextPins : defaultPins);
    setCollabs(Array.isArray(nextCollabs) && nextCollabs.length ? nextCollabs : defaultCollabs);
    setXpLogs(Array.isArray(nextXpLogs) && nextXpLogs.length ? nextXpLogs : defaultXpLogs);
    setSharingByPlayer(nextSharingByPlayer && typeof nextSharingByPlayer === 'object' ? nextSharingByPlayer : {});
    setMyLocation(nextMyLocation);
    setSavedLocations(Array.isArray(nextSavedLocations) ? nextSavedLocations : []);
    setThreads(Array.isArray(nextThreads) && nextThreads.length ? nextThreads : defaultThreads);
    setMessages(Array.isArray(nextMessages) && nextMessages.length ? nextMessages : defaultMessages);
    setAuditLog(Array.isArray(nextAudit) ? nextAudit : []);
    setViewAsId(mpStorage.loadViewAs(defaultPlayers[0]?.id || 'me'));
  };

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (watchId.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      if (liveTimer.current) {
        window.clearInterval(liveTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!players.find((player) => player.id === viewAsId)) {
      setViewAsId(players[0]?.id || 'me');
    }
  }, [players, viewAsId]);

  useEffect(() => {
    if (!players.find((player) => player.id === selectedPlayerId)) {
      const fallback = players.find((player) => player.id !== 'me')?.id || players[0]?.id || 'me';
      setSelectedPlayerId(fallback);
    }
  }, [players, selectedPlayerId]);

  useEffect(() => {
    if (collabs.length && !collabs.find((collab) => collab.id === selectedCollabId)) {
      setSelectedCollabId(collabs[0].id);
    }
  }, [collabs, selectedCollabId]);

  useEffect(() => {
    if (threads.length && !threads.find((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  useEffect(() => {
    setPlayers((prev) =>
      prev.map((player) =>
        player.id === 'me'
          ? {
              ...player,
              permissions: {
                ...player.permissions,
                profileLevel: privacy.profileDetailLevel,
                location: privacy.locationMode,
                pinVisibility: privacy.pinVisibility,
                rankVisibility: privacy.rankVisibility,
                appearsInRank: privacy.appearsInRank,
                closeCircle: privacy.closeCircle,
              },
            }
          : player
      )
    );
  }, [
    privacy.appearsInRank,
    privacy.closeCircle,
    privacy.locationMode,
    privacy.pinVisibility,
    privacy.profileDetailLevel,
    privacy.rankVisibility,
  ]);

  useEffect(() => {
    if (!user) return;

    setPlayers((prev) => {
      const existingMe = prev.find((player) => player.id === 'me');
      const nextName = user.name?.trim() || null;
      const nextEmail = user.email?.trim() || null;

      if (!existingMe) {
        return [
          {
            id: 'me',
            name: nextName || 'Operator',
            role: 'Operator',
            email: nextEmail,
            avatar: user.avatar || undefined,
            appUserId: user.id,
            tags: ['operator', 'core'],
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            favorite: true,
            permissions: {
              profileLevel: privacy.profileDetailLevel,
              location: privacy.locationMode,
              pinVisibility: privacy.pinVisibility,
              rankVisibility: privacy.rankVisibility,
              appearsInRank: privacy.appearsInRank,
              closeCircle: privacy.closeCircle,
            },
            accepted: true,
          },
          ...prev,
        ];
      }

      return prev.map((player) => {
        if (player.id !== 'me') return player;

        const shouldReplaceName = !player.name || player.name === 'Admin' || player.name === 'Operator';
        const shouldReplaceEmail = !player.email || player.email === 'admin@dusk.gg';

        return {
          ...player,
          name: shouldReplaceName ? nextName || player.name : player.name,
          email: shouldReplaceEmail ? nextEmail || player.email : player.email,
          avatar: player.avatar || user.avatar || undefined,
          appUserId: user.id,
          timeZone: player.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      });
    });
  }, [
    privacy.appearsInRank,
    privacy.closeCircle,
    privacy.locationMode,
    privacy.pinVisibility,
    privacy.profileDetailLevel,
    privacy.rankVisibility,
    user,
  ]);

  useEffect(() => {
    const pending = readUserScopedString('mp_focusPlayerId', null);
    if (!pending) return;
    setSurface('PEOPLE');
    setPeopleMode('ROSTER');
    setSelectedPlayerId(pending);
    removeUserScopedString('mp_focusPlayerId');
  }, []);

  useEffect(() => {
    const handleOpenPlayer = (event: Event) => {
      const detail = (event as CustomEvent<{ playerId?: string }>).detail;
      if (!detail?.playerId) return;
      setSurface('PEOPLE');
      setPeopleMode('ROSTER');
      setSelectedPlayerId(detail.playerId);
    };

    const handleStorage = (event: StorageEvent) => {
      if (isUserScopedStorageKey(event.key, messagesStorage.getThreadsBaseKey())) {
        setThreads(messagesStorage.loadThreads(defaultThreads));
      }
      if (isUserScopedStorageKey(event.key, messagesStorage.getMessagesBaseKey())) {
        setMessages(messagesStorage.loadMessages(defaultMessages));
      }
    };

    const handleMessagesStorage = (event: Event) => {
      const detail = (event as CustomEvent<{ key: 'threads' | 'messages'; value: unknown }>).detail;
      if (!detail) return;

      if (detail.key === 'threads') {
        if (detail.value === threadsRef.current) return;
        setThreads(Array.isArray(detail.value) ? (detail.value as Thread[]) : messagesStorage.loadThreads(defaultThreads));
      }

      if (detail.key === 'messages') {
        if (detail.value === messagesRef.current) return;
        setMessages(Array.isArray(detail.value) ? (detail.value as Message[]) : messagesStorage.loadMessages(defaultMessages));
      }
    };

    window.addEventListener('dusk:openPlayerDossier', handleOpenPlayer as EventListener);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('messages-storage', handleMessagesStorage as EventListener);
    window.addEventListener(USER_SCOPED_STORAGE_EVENT, hydrateUserScopedState as EventListener);

    return () => {
      window.removeEventListener('dusk:openPlayerDossier', handleOpenPlayer as EventListener);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('messages-storage', handleMessagesStorage as EventListener);
      window.removeEventListener(USER_SCOPED_STORAGE_EVENT, hydrateUserScopedState as EventListener);
    };
  }, []);

  useEffect(() => mpStorage.save('mp_players', players), [players]);
  useEffect(() => mpStorage.save('mp_pins', pins), [pins]);
  useEffect(() => mpStorage.save('mp_collabs', collabs), [collabs]);
  useEffect(() => mpStorage.save('mp_xpLogs', xpLogs), [xpLogs]);
  useEffect(() => mpStorage.save('mp_sharingByPlayer', sharingByPlayer), [sharingByPlayer]);
  useEffect(() => mpStorage.save('mp_myLocation', myLocation), [myLocation]);
  useEffect(() => mpStorage.save('mp_savedLocations', savedLocations), [savedLocations]);
  useEffect(() => mpStorage.save('mp_viewAs', viewAsId), [viewAsId]);
  useEffect(() => messagesStorage.saveThreads(threads), [threads]);
  useEffect(() => messagesStorage.saveMessages(messages), [messages]);
  useEffect(() => mpStorage.save('mp_auditLog', auditLog), [auditLog]);

  const viewer = players.find((player) => player.id === viewAsId);
  const visiblePins = useMemo(
    () => pins.filter((pin) => pinVisibleToViewer(pin, viewAsId, viewer, pin.createdBy)),
    [pins, viewAsId, viewer]
  );

  const snapshot = useMemo(
    () =>
      buildMultiplayerSnapshot({
        players,
        visiblePins,
        collabs,
        xpLogs,
        sharingByPlayer,
        myLocation,
        savedLocations,
        presenceMode: myPresenceMode,
        threads,
        messages,
        auditEntries: auditLog,
      }),
    [players, visiblePins, collabs, xpLogs, sharingByPlayer, myLocation, savedLocations, myPresenceMode, threads, messages, auditLog]
  );

  const unreadByThread = useMemo(() => {
    const map = new Map<string, number>();
    messages.forEach((message) => {
      if (message.from === 'me' || message.read) return;
      map.set(message.threadId, (map.get(message.threadId) || 0) + 1);
    });
    return map;
  }, [messages]);

  const sortedThreads = useMemo(
    () =>
      threads
        .slice()
        .sort((a, b) => {
          const unreadDelta = (unreadByThread.get(b.id) || 0) - (unreadByThread.get(a.id) || 0);
          if (unreadDelta !== 0) return unreadDelta;
          return (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt);
        }),
    [threads, unreadByThread]
  );

  const filteredPlayers = useMemo(() => {
    const query = playerSearch.trim().toLowerCase();
    const source = players.filter((player) => player.id !== 'me');
    if (!query) return source;
    return source.filter((player) => {
      const haystack = [
        player.name,
        player.role,
        player.email,
        player.phone,
        ...(player.tags || []),
        player.timeZone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [players, playerSearch]);

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) || players[0] || null;
  const selectedCollab = collabs.find((collab) => collab.id === selectedCollabId) || collabs[0] || null;
  const selectedThread =
    sortedThreads.find((thread) => thread.id === selectedThreadId) ||
    (selectedPlayer ? sortedThreads.find((thread) => thread.participantId === selectedPlayer.id) : null) ||
    sortedThreads[0] ||
    null;

  useEffect(() => {
    if (!selectedPlayer) return;
    const linkedThread = sortedThreads.find((thread) => thread.participantId === selectedPlayer.id);
    if (linkedThread) {
      setSelectedThreadId(linkedThread.id);
    }
  }, [selectedPlayer, sortedThreads]);

  const selectedThreadMessages = useMemo(
    () =>
      selectedThread
        ? messages
            .filter((message) => message.threadId === selectedThread.id)
            .slice()
            .sort((a, b) => a.ts - b.ts)
        : [],
    [messages, selectedThread]
  );

  const playerXpTotal = useMemo(
    () =>
      selectedPlayer
        ? xpLogs.filter((log) => log.playerId === selectedPlayer.id).reduce((sum, log) => sum + log.amount, 0)
        : 0,
    [selectedPlayer, xpLogs]
  );

  const playerCollabs = useMemo(
    () => (selectedPlayer ? collabs.filter((collab) => collab.members.includes(selectedPlayer.id)) : []),
    [collabs, selectedPlayer]
  );

  const tagClusters = useMemo(() => {
    const counts = new Map<string, number>();
    players.forEach((player) => {
      const tags = (player.tags || []).length ? player.tags! : ['untagged'];
      tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [players]);

  const outreachPlayers = useMemo(
    () =>
      players
        .filter((player) => player.id !== 'me')
        .map((player) => {
          const gaps: string[] = [];
          if (!player.accepted) gaps.push('invite pending');
          if (!(player.tags || []).length) gaps.push('needs tags');
          if (!player.email && !player.phone) gaps.push('missing contact');
          if (!player.location) gaps.push('no location');
          if (!player.timeZone && typeof player.utcOffsetMinutes !== 'number') gaps.push('no timezone');
          if (!sortedThreads.find((thread) => thread.participantId === player.id)) gaps.push('no thread');
          return { player, gaps };
        })
        .filter((item) => item.gaps.length > 0)
        .sort((a, b) => b.gaps.length - a.gaps.length || a.player.name.localeCompare(b.player.name)),
    [players, sortedThreads]
  );

  const collabPressure = useMemo(
    () =>
      collabs
        .map((collab) => ({
          collab,
          pending: collab.proposals.filter((proposal) => proposal.status === 'pending').length,
          openTasks: collab.tasks.filter((task) => !task.done).length,
        }))
        .sort((a, b) => b.pending - a.pending || b.openTasks - a.openTasks),
    [collabs]
  );

  const queueItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      detail: string;
      target: MultiplayerRouteTarget;
      tone: 'default' | 'alert';
      onSelect?: () => void;
    }> = [];

    snapshot.recommendations.forEach((recommendation) => {
      items.push({
        id: recommendation.id,
        title: recommendation.title,
        detail: recommendation.detail,
        target: recommendation.target,
        tone: 'default',
      });
    });

    sortedThreads
      .filter((thread) => (unreadByThread.get(thread.id) || 0) > 0)
      .slice(0, 3)
      .forEach((thread) => {
        items.push({
          id: `thread-${thread.id}`,
          title: `${thread.title} needs review`,
          detail: `${unreadByThread.get(thread.id) || 0} unread message${(unreadByThread.get(thread.id) || 0) === 1 ? '' : 's'}.`,
          target: 'COMMS',
          tone: 'default',
          onSelect: () => setSelectedThreadId(thread.id),
        });
      });

    collabPressure
      .filter((entry) => entry.pending > 0)
      .slice(0, 2)
      .forEach(({ collab, pending }) => {
        items.push({
          id: `collab-${collab.id}`,
          title: `${collab.title} has pending proposals`,
          detail: `${pending} proposal${pending === 1 ? '' : 's'} are waiting for review.`,
          target: 'COLLAB',
          tone: 'default',
          onSelect: () => setSelectedCollabId(collab.id),
        });
      });

    auditLog
      .filter((entry) => entry.severity !== 'info')
      .slice(0, 2)
      .forEach((entry) => {
        items.push({
          id: entry.id,
          title: entry.title,
          detail: entry.detail,
          target: entry.route || 'TRACE',
          tone: 'alert',
        });
      });

    return items.slice(0, 8);
  }, [auditLog, collabPressure, snapshot.recommendations, sortedThreads, unreadByThread]);

  const feedItems = useMemo(() => snapshot.recentActivity.slice(0, 8), [snapshot.recentActivity]);

  const advancedEarthView = (
    <details className="rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] shadow-sm">
      <summary className="cursor-pointer list-none px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">
        Advanced Earth Workstation
      </summary>
      <div className="border-t border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] p-4">
        <EarthView
          pins={pins}
          onAddPin={(pin) => {
            setPins((prev) => [pin, ...prev]);
            logAudit({
              action: 'pin_added',
              title: 'Added tactical pin',
              detail: `${pin.title} was added to the earth layer.`,
              entity: 'pin',
              actorId: viewAsId,
              targetId: pin.id,
              route: 'EARTH',
            });
          }}
          onUpdatePin={(id, updates) => {
            const targetPin = pins.find((pin) => pin.id === id);
            setPins((prev) => prev.map((pin) => (pin.id === id ? { ...pin, ...updates } : pin)));
            logAudit({
              action: 'pin_updated',
              title: 'Updated tactical pin',
              detail: `${updates.title || targetPin?.title || 'A pin'} was updated.`,
              entity: 'pin',
              actorId: viewAsId,
              targetId: id,
              route: 'EARTH',
            });
          }}
          onDeletePin={(id) => {
            const targetPin = pins.find((pin) => pin.id === id);
            setPins((prev) => prev.filter((pin) => pin.id !== id));
            logAudit({
              action: 'pin_removed',
              title: 'Removed tactical pin',
              detail: `${targetPin?.title || 'A pin'} was removed from the earth layer.`,
              entity: 'pin',
              severity: 'attention',
              actorId: viewAsId,
              targetId: id,
              route: 'EARTH',
            });
          }}
          myLocation={myLocation}
          setMyLocation={setMyLocation}
          sharingByPlayer={sharingByPlayer}
          setSharingByPlayer={setSharingByPlayer}
          viewAsId={viewAsId}
          players={players}
          startLive={(durationMs, playerIds) => {
            const expires = Date.now() + durationMs;
            setSharingByPlayer((prev) => {
              const next = { ...prev };
              playerIds.forEach((id) => {
                next[id] = { ...next[id], mode: 'live', liveExpiresAt: expires, lastUpdatedAt: Date.now() };
              });
              return next;
            });
            if (navigator.geolocation) {
              if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
              watchId.current = navigator.geolocation.watchPosition(
                (position) => {
                  setMyLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                },
                () => undefined,
                { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
              );
            }
          }}
          stopLive={(playerIds) => {
            if (watchId.current && navigator.geolocation) {
              navigator.geolocation.clearWatch(watchId.current);
              watchId.current = null;
            }
            setSharingByPlayer((prev) => {
              const next = { ...prev };
              playerIds.forEach((id) => {
                next[id] = { mode: 'off' };
              });
              return next;
            });
          }}
          setToast={setToast}
          focusLocation={earthFocus}
          savedLocations={savedLocations}
          setSavedLocations={setSavedLocations}
          pickPlayerId={null}
          onClearPickPlayer={() => undefined}
          onSetPlayerLocation={(playerId, loc, extras) => {
            const player = players.find((entry) => entry.id === playerId);
            setPlayers((prev) =>
              prev.map((entry) =>
                entry.id === playerId
                  ? {
                      ...entry,
                      ...(extras || {}),
                      location: loc,
                    }
                  : entry
              )
            );
            logAudit({
              action: 'player_location_updated',
              title: 'Updated player location',
              detail: `${player?.name || 'A player'} ${loc ? `was anchored to ${loc.label || 'a saved location'}` : 'had their saved location removed'}.`,
              entity: 'player',
              actorId: viewAsId,
              targetId: playerId,
              route: 'EARTH',
            });
          }}
        />
      </div>
    </details>
  );

  const openTarget = (target: MultiplayerRouteTarget) => {
    setSurface(surfaceFromTarget(target));
    if (target === 'TRACE' || target === 'RANK' || target === 'COMMS') {
      setSignalsMode(signalModeFromTarget(target));
    }
    if (target === 'NETWORK' || target === 'SQUAD') {
      setPeopleMode(target === 'NETWORK' ? 'NETWORK' : 'ROSTER');
    }
  };

  const ensureThreadForPlayer = (playerId: string, preferredTitle?: string) => {
    const player = players.find((entry) => entry.id === playerId);
    const existing = threadsRef.current.find((thread) => thread.participantId === playerId);
    if (existing) return existing;

    const thread: Thread = {
      id: `thread-${playerId}-${Date.now()}`,
      title: preferredTitle || player?.name || 'Direct Message',
      participantId: playerId,
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
    };

    setThreads((prev) => [thread, ...prev]);
    logAudit({
      action: 'thread_created',
      title: 'Opened direct message line',
      detail: `${player?.name || preferredTitle || 'A player'} was added to the communications layer.`,
      entity: 'message',
      actorId: viewAsId,
      targetId: playerId,
      route: 'COMMS',
    });
    return thread;
  };

  const openThreadForPlayer = (playerId: string, preferredTitle?: string) => {
    const thread = ensureThreadForPlayer(playerId, preferredTitle);
    setSurface('SIGNALS');
    setSignalsMode('COMMS');
    setSelectedThreadId(thread.id);
    window.dispatchEvent(
      new CustomEvent('dusk:openMessagesThread', {
        detail: {
          participantId: playerId,
          title: preferredTitle || players.find((entry) => entry.id === playerId)?.name || thread.title,
          threadId: thread.id,
        },
      })
    );
  };

  const openBriefForPlayer = (playerId: string) => {
    const player = players.find((entry) => entry.id === playerId);
    if (!player) return;
    const thread = ensureThreadForPlayer(playerId, player.name);
    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      threadId: thread.id,
      from: 'me',
      text: `Opening an XTATION comms lane for ${player.name}. Sync status, next move, and handoff notes can live here.`,
      ts: Date.now(),
      read: true,
    };
    setMessages((prev) => [message, ...prev]);
    setThreads((prev) =>
      prev.map((entry) => (entry.id === thread.id ? { ...entry, lastMessageAt: message.ts } : entry))
    );
    setSurface('SIGNALS');
    setSignalsMode('COMMS');
    setSelectedThreadId(thread.id);
    logAudit({
      action: 'briefing_seeded',
      title: 'Opened player brief',
      detail: `A briefing lane is now open for ${player.name}.`,
      entity: 'message',
      actorId: viewAsId,
      targetId: playerId,
      route: 'COMMS',
    });
    setToast('Brief ready');
  };

  const markThreadRead = (threadId: string) => {
    const unreadCount = messages.filter((message) => message.threadId === threadId && message.from !== 'me' && !message.read).length;
    if (!unreadCount) {
      setToast('Thread already clear');
      return;
    }

    const thread = threads.find((entry) => entry.id === threadId);
    setMessages((prev) =>
      prev.map((message) => (message.threadId === threadId && message.from !== 'me' ? { ...message, read: true } : message))
    );
    logAudit({
      action: 'thread_marked_read',
      title: 'Resolved unread thread',
      detail: `${thread?.title || 'A direct message thread'} was marked as reviewed.`,
      entity: 'message',
      actorId: viewAsId,
      route: 'COMMS',
    });
    setToast('Thread marked read');
  };

  const startLive = (durationMs: number, playerIds: string[]) => {
    const expires = Date.now() + durationMs;
    setSharingByPlayer((prev) => {
      const next = { ...prev };
      playerIds.forEach((id) => {
        next[id] = { ...next[id], mode: 'live', liveExpiresAt: expires, lastUpdatedAt: Date.now() };
      });
      return next;
    });
    if (navigator.geolocation) {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          setMyLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }
    if (liveTimer.current) window.clearInterval(liveTimer.current);
    liveTimer.current = window.setInterval(() => {
      setSharingByPlayer((prev) => {
        const now = Date.now();
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach((id) => {
          const state = next[id];
          if (state?.mode === 'live' && state.liveExpiresAt && state.liveExpiresAt <= now) {
            next[id] = { mode: 'off' };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    logAudit({
      action: 'live_share_started',
      title: 'Started live share',
      detail: `Live location share started with ${playerIds.length} player${playerIds.length === 1 ? '' : 's'}.`,
      entity: 'share',
      severity: 'attention',
      actorId: viewAsId,
      route: 'EARTH',
    });
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
    setSharingByPlayer((prev) => {
      const next = { ...prev };
      playerIds.forEach((id) => {
        next[id] = { mode: 'off' };
      });
      return next;
    });
    logAudit({
      action: 'live_share_stopped',
      title: 'Stopped live share',
      detail: `Location sharing was disabled for ${playerIds.length} player${playerIds.length === 1 ? '' : 's'}.`,
      entity: 'share',
      severity: 'attention',
      actorId: viewAsId,
      route: 'EARTH',
    });
  };

  const onUpdatePlayer = (id: string, updates: Partial<Player>) => {
    setPlayers((prev) => prev.map((player) => (player.id === id ? { ...player, ...updates } : player)));
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
    setPlayers((prev) => [newPlayer, ...prev]);
    setSelectedPlayerId(newPlayer.id);
    setSurface('PEOPLE');
    setPeopleMode('ROSTER');
    logAudit({
      action: 'player_added',
      title: 'Added player to squad',
      detail: `${newPlayer.name} entered the roster as ${newPlayer.role}.`,
      entity: 'player',
      actorId: viewAsId,
      targetId: newPlayer.id,
      route: 'SQUAD',
    });
    setToast('Player added');
  };

  const onDeletePlayer = (id: string) => {
    const player = players.find((entry) => entry.id === id);
    const removedThreadIds = threads.filter((thread) => thread.participantId === id).map((thread) => thread.id);
    setPlayers((prev) => prev.filter((entry) => entry.id !== id));
    setThreads((prev) => prev.filter((thread) => thread.participantId !== id));
    setMessages((prev) => prev.filter((message) => !removedThreadIds.includes(message.threadId)));
    if (selectedPlayerId === id) {
      const fallback = players.find((entry) => entry.id !== id && entry.id !== 'me')?.id || 'me';
      setSelectedPlayerId(fallback);
    }
    if (viewAsId === id) setViewAsId('me');
    logAudit({
      action: 'player_removed',
      title: 'Removed player from squad',
      detail: `${player?.name || 'A player'} was removed from the multiplayer roster.`,
      entity: 'player',
      severity: 'critical',
      actorId: viewAsId,
      targetId: id,
      route: 'SQUAD',
    });
    setToast('Player deleted');
  };

  const onAddCollab = (draft: { title: string; goal: string; members: string[] }) => {
    const uniqueMembers = Array.from(new Set(draft.members));
    const newCollab: Collaboration = {
      id: `c-${Date.now()}`,
      title: draft.title,
      goal: draft.goal,
      members: uniqueMembers,
      tasks: [],
      activity: [
        {
          id: `act-${Date.now()}`,
          action: 'collab_created',
          actorId: viewAsId,
          summary: `Created collaboration ${draft.title}`,
          ts: Date.now(),
        },
      ],
      proposals: [],
    };
    setCollabs((prev) => [newCollab, ...prev]);
    setSelectedCollabId(newCollab.id);
    setSurface('SPACES');
    logAudit({
      action: 'collaboration_created',
      title: 'Created collaboration space',
      detail: `${draft.title} was created with ${uniqueMembers.length} member${uniqueMembers.length === 1 ? '' : 's'}.`,
      entity: 'collaboration',
      actorId: viewAsId,
      targetId: newCollab.id,
      route: 'COLLAB',
    });
    setToast('Collaboration space created');
  };

  const onUpdateTask = (collabId: string, taskId: string) => {
    const collab = collabs.find((entry) => entry.id === collabId);
    const task = collab?.tasks.find((entry) => entry.id === taskId);
    setCollabs((prev) =>
      prev.map((entry) =>
        entry.id === collabId
          ? { ...entry, tasks: entry.tasks.map((taskEntry) => (taskEntry.id === taskId ? { ...taskEntry, done: !taskEntry.done } : taskEntry)) }
          : entry
      )
    );
    logAudit({
      action: 'collab_task_toggled',
      title: 'Updated collaboration task',
      detail: `${task?.title || 'A task'} inside ${collab?.title || 'a collaboration'} was toggled.`,
      entity: 'task',
      actorId: viewAsId,
      targetId: collabId,
      route: 'COLLAB',
    });
  };

  const onApprove = (collabId: string, proposalId: string, approve: boolean) => {
    const collab = collabs.find((entry) => entry.id === collabId);
    const proposal = collab?.proposals.find((entry) => entry.id === proposalId);
    setCollabs((prev) =>
      prev.map((entry) => {
        if (entry.id !== collabId) return entry;
        const targetProposal = entry.proposals.find((proposalEntry) => proposalEntry.id === proposalId);
        if (!targetProposal) return entry;
        const reviewedProposal: CollaborationProposal = {
          ...targetProposal,
          status: approve ? 'approved' : 'rejected',
          reviewedBy: viewAsId,
          reviewedAt: Date.now(),
        };

        let updated: Collaboration = {
          ...entry,
          proposals: entry.proposals.map((proposalEntry) => (proposalEntry.id === proposalId ? reviewedProposal : proposalEntry)),
          activity: [
            {
              id: `act-${Date.now()}`,
              action: approve ? 'proposal_approved' : 'proposal_rejected',
              actorId: viewAsId,
              summary: `${approve ? 'Approved' : 'Rejected'} proposal ${targetProposal.type}`,
              ts: Date.now(),
            },
            ...entry.activity,
          ],
        };

        if (approve && targetProposal.type === 'task' && targetProposal.payload?.title) {
          updated = {
            ...updated,
            tasks: [...updated.tasks, { id: `task-${Date.now()}`, title: targetProposal.payload.title, done: false }],
          };
        }

        if (approve && targetProposal.type === 'goal' && targetProposal.payload?.goal) {
          updated = {
            ...updated,
            goal: targetProposal.payload.goal,
          };
        }

        if (approve && targetProposal.type === 'pin' && targetProposal.payload?.lat && targetProposal.payload?.lng) {
          setPins((prevPins) => [
            {
              id: `pin-${Date.now()}`,
              title: targetProposal.payload.title || 'Collab Pin',
              note: targetProposal.payload.note || '',
              lat: targetProposal.payload.lat,
              lng: targetProposal.payload.lng,
              scope: targetProposal.payload.scope || 'specific',
              sharedWith: targetProposal.payload.sharedWith || [],
              createdBy: targetProposal.createdBy,
            },
            ...prevPins,
          ]);
        }

        return updated;
      })
    );

    if (proposal) {
      logAudit({
        action: approve ? 'proposal_approved' : 'proposal_rejected',
        title: approve ? 'Approved collaboration proposal' : 'Rejected collaboration proposal',
        detail: `${proposal.type} proposal in ${collab?.title || 'a collaboration'} was ${approve ? 'approved' : 'rejected'}.`,
        entity: 'proposal',
        severity: approve ? 'info' : 'attention',
        actorId: viewAsId,
        targetId: collabId,
        route: 'COLLAB',
      });
    }
  };

  const onCreateProposal = (collabId: string, type: CollaborationProposal['type'], payload: any) => {
    const collab = collabs.find((entry) => entry.id === collabId);
    setCollabs((prev) =>
      prev.map((entry) => {
        if (entry.id !== collabId) return entry;
        const proposal: CollaborationProposal = {
          id: `pr-${Date.now()}`,
          type,
          payload,
          createdBy: viewAsId,
          status: 'pending',
          createdAt: Date.now(),
        };
        return {
          ...entry,
          proposals: [proposal, ...entry.proposals],
          activity: [
            {
              id: `act-${Date.now()}`,
              action: 'proposal_created',
              actorId: viewAsId,
              summary: `Proposal: ${type}`,
              ts: Date.now(),
            },
            ...entry.activity,
          ],
        };
      })
    );
    logAudit({
      action: 'proposal_created',
      title: 'Created collaboration proposal',
      detail: `${type} proposal submitted to ${collab?.title || 'a collaboration'}.`,
      entity: 'proposal',
      actorId: viewAsId,
      targetId: collabId,
      route: 'COLLAB',
    });
    setToast('Proposal submitted');
  };

  const onAddXp = (playerId: string, amount: number, category?: string, note?: string) => {
    const player = players.find((entry) => entry.id === playerId);
    const log: XpLog = {
      id: `xp-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      playerId,
      amount,
      timestamp: Date.now(),
      tag: category,
      note,
    };
    setXpLogs((prev) => [log, ...prev]);
    logAudit({
      action: 'xp_logged',
      title: 'Logged multiplayer XP',
      detail: `${amount >= 0 ? '+' : ''}${amount} XP applied to ${player?.name || 'a player'}${category ? ` in ${category}` : ''}.`,
      entity: 'system',
      actorId: viewAsId,
      targetId: playerId,
      route: 'RANK',
    });
    setToast(`${amount >= 0 ? '+' : ''}${amount} XP added`);
  };

  const onOpenEarthFocusByPlayerId = (playerId: string) => {
    const target = players.find((player) => player.id === playerId);
    if (!target?.location) {
      setSurface('PEOPLE');
      setPeopleMode('ROSTER');
      setSelectedPlayerId(playerId);
      setToast('Selected player has no saved location');
      return;
    }
    setEarthFocus({
      playerId,
      loc: {
        lat: target.location.lat,
        lng: target.location.lng,
        label: target.location.label,
      },
    });
    setSurface('MAP');
  };

  const stopAllLiveShares = () => {
    const livePlayerIds = Object.entries(sharingByPlayer)
      .filter(([, state]) => state.mode === 'live' && (!state.liveExpiresAt || state.liveExpiresAt > Date.now()))
      .map(([playerId]) => playerId);
    if (!livePlayerIds.length) {
      setToast('No active live shares');
      return;
    }
    stopLive(livePlayerIds);
    logAudit({
      action: 'live_share_stopped_all',
      title: 'Stopped all live shares',
      detail: `${livePlayerIds.length} active live share${livePlayerIds.length === 1 ? '' : 's'} were shut down from ops.`,
      entity: 'ops',
      severity: 'attention',
      actorId: viewAsId,
      route: 'OPS',
    });
    setToast('Stopped all live shares');
  };

  const copyDiagnostics = async () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      viewer: viewer?.id || null,
      presenceMode: myPresenceMode,
      privacy,
      features,
      counts: {
        players: players.length,
        pins: pins.length,
        collabs: collabs.length,
        xpLogs: xpLogs.length,
        savedLocations: savedLocations.length,
        threads: threads.length,
        unreadMessages: snapshot.unreadMessages,
        auditEntries: auditLog.length,
      },
      sharingByPlayer,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      logAudit({
        action: 'diagnostics_copied',
        title: 'Copied multiplayer diagnostics',
        detail: 'Current multiplayer diagnostics payload was copied to the clipboard.',
        entity: 'ops',
        actorId: viewAsId,
        route: 'OPS',
      });
      setToast('Diagnostics copied');
    } catch (error) {
      console.warn('[multiplayer] Failed to copy diagnostics', error);
      setToast('Clipboard unavailable');
    }
  };

  const exportSnapshot = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      viewer: viewAsId,
      presenceMode: myPresenceMode,
      privacy,
      features,
      players,
      visiblePins,
      pins,
      collabs,
      xpLogs,
      sharingByPlayer,
      myLocation,
      savedLocations,
      threads,
      messages,
      auditLog,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `xtation-multiplayer-snapshot-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    logAudit({
      action: 'snapshot_exported',
      title: 'Exported multiplayer snapshot',
      detail: 'A multiplayer state snapshot was downloaded for review.',
      entity: 'ops',
      actorId: viewAsId,
      route: 'OPS',
    });
    setToast('Snapshot exported');
  };

  const copyTrace = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            viewer: viewAsId,
            entries: auditLog,
          },
          null,
          2
        )
      );
      logAudit({
        action: 'trace_copied',
        title: 'Copied multiplayer trace',
        detail: 'The multiplayer trace log was copied to the clipboard.',
        entity: 'ops',
        actorId: viewAsId,
        route: 'TRACE',
      });
      setToast('Trace copied');
    } catch (error) {
      console.warn('[multiplayer] Failed to copy trace', error);
      setToast('Clipboard unavailable');
    }
  };

  const addDraftPlayer = () => {
    const trimmedName = draftPlayerName.trim();
    if (!trimmedName) {
      setToast('Enter a player name');
      return;
    }
    onAddPlayer({
      name: trimmedName,
      role: draftPlayerRole.trim() || 'Operator',
      accepted: false,
      permissions: {
        profileLevel: 'basic',
        location: 'off',
        pinVisibility: 'none',
        rankVisibility: true,
        appearsInRank: true,
        closeCircle: false,
      },
    });
    setDraftPlayerName('');
    setDraftPlayerRole('Operator');
  };

  const addDraftCollab = () => {
    const title = draftCollabTitle.trim();
    const goal = draftCollabGoal.trim();
    if (!title || !goal) {
      setToast('Add a title and goal first');
      return;
    }
    const members = Array.from(new Set(['me', selectedPlayer?.id].filter(Boolean) as string[]));
    onAddCollab({ title, goal, members });
    setDraftCollabTitle('');
    setDraftCollabGoal('');
  };

  const addQuickPin = () => {
    const title = draftPinTitle.trim();
    if (!title || !myLocation) {
      setToast(myLocation ? 'Enter a pin title' : 'Set your location first');
      return;
    }
    const newPin: Pin = {
      id: `pin-${Date.now()}`,
      title,
      note: '',
      lat: myLocation.lat,
      lng: myLocation.lng,
      scope: 'specific',
      sharedWith: selectedPlayer && selectedPlayer.id !== 'me' ? [selectedPlayer.id] : [],
      createdBy: 'me',
    };
    setPins((prev) => [newPin, ...prev]);
    logAudit({
      action: 'pin_added',
      title: 'Added tactical pin',
      detail: `${title} was added near the current operator location.`,
      entity: 'pin',
      actorId: viewAsId,
      targetId: newPin.id,
      route: 'EARTH',
    });
    setDraftPinTitle('');
    setToast('Pin added');
  };

  const setShareMode = (playerId: string, mode: 'off' | 'city' | 'live') => {
    if (mode === 'live') {
      startLive(30 * 60 * 1000, [playerId]);
      return;
    }
    if (mode === 'off') {
      stopLive([playerId]);
      return;
    }
    setSharingByPlayer((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        mode: 'city',
        liveExpiresAt: null,
        lastUpdatedAt: Date.now(),
      },
    }));
    logAudit({
      action: 'city_share_enabled',
      title: 'Enabled city-level share',
      detail: `${players.find((player) => player.id === playerId)?.name || 'A player'} now has city-level sharing.`,
      entity: 'share',
      actorId: viewAsId,
      targetId: playerId,
      route: 'EARTH',
    });
  };

  const filteredTrace = useMemo(
    () => auditLog.filter((entry) => (traceFilter === 'all' ? true : entry.severity === traceFilter)),
    [auditLog, traceFilter]
  );

  const navItems: Array<{ key: SurfaceKey; label: string; icon: React.ReactNode; badge?: number }> = [
    { key: 'HQ', label: 'HQ', icon: <Compass size={15} />, badge: queueItems.length || undefined },
    { key: 'PEOPLE', label: 'People', icon: <Users size={15} />, badge: outreachPlayers.length || undefined },
    { key: 'SPACES', label: 'Spaces', icon: <Flag size={15} />, badge: snapshot.pendingProposals || undefined },
    { key: 'MAP', label: 'Map', icon: <MapIcon size={15} />, badge: snapshot.visiblePins || undefined },
    { key: 'SIGNALS', label: 'Signals', icon: <Radio size={15} />, badge: snapshot.unreadMessages + snapshot.attentionEvents || undefined },
    { key: 'OPS', label: 'Ops', icon: <Cpu size={15} /> },
  ];

  if (!features.multiplayerEnabled) {
    return (
      <MultiplayerErrorBoundary>
        <div className="h-full min-h-[40vh] flex items-center justify-center p-6 text-center text-[var(--app-text)]">
          <div className="max-w-xl border border-[color-mix(in_srgb,var(--app-accent)_40%,transparent)] bg-[var(--app-panel)] px-6 py-8 rounded shadow-sm">
            <div className="text-xs uppercase tracking-[0.32em] text-[var(--app-muted)]">Multiplayer Disabled</div>
            <div className="mt-3 text-2xl font-black uppercase tracking-[0.12em] text-[var(--app-text)]">Enable the module in Settings</div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-[var(--app-muted)]">
              Multiplayer now follows the canonical settings engine, so access and privacy are controlled from the system configuration layer.
            </p>
          </div>
        </div>
      </MultiplayerErrorBoundary>
    );
  }

  const surfaceModeStrip =
    surface === 'PEOPLE' ? (
      <div className="xt-mp-mode-strip">
        <ModeButton label="Roster" active={peopleMode === 'ROSTER'} onClick={() => setPeopleMode('ROSTER')} />
        <ModeButton label="Network" active={peopleMode === 'NETWORK'} onClick={() => setPeopleMode('NETWORK')} />
        <ModeButton label="Outreach" active={peopleMode === 'OUTREACH'} onClick={() => setPeopleMode('OUTREACH')} />
      </div>
    ) : surface === 'SIGNALS' ? (
      <div className="xt-mp-mode-strip">
        <ModeButton label="Comms" active={signalsMode === 'COMMS'} onClick={() => setSignalsMode('COMMS')} />
        <ModeButton label="Rank" active={signalsMode === 'RANK'} onClick={() => setSignalsMode('RANK')} />
        <ModeButton label="Trace" active={signalsMode === 'TRACE'} onClick={() => setSignalsMode('TRACE')} />
      </div>
    ) : null;

  return (
    <MultiplayerErrorBoundary>
      <div className="xt-mp-shell h-full overflow-y-auto text-[var(--app-text)]">
        {toast ? (
          <div className="fixed right-4 top-16 z-50 rounded-lg border border-[color-mix(in_srgb,var(--app-accent)_50%,transparent)] bg-[var(--app-panel)] px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--app-text)] shadow-lg animate-fade-in">
            {toast}
          </div>
        ) : null}

        <div className="mx-auto max-w-[1680px] px-4 pb-32 pt-4 md:px-6 lg:pb-12">
          <div className="xt-mp-layout">
            <aside className="xt-mp-sidebar lg:sticky lg:top-4 lg:self-start">
              <div className="xt-mp-brand">
                <div className="xt-mp-brand-kicker">Multiplayer / Bureau Network</div>
                <div className="xt-mp-brand-title">People ops, not dashboard sprawl.</div>
                <p className="xt-mp-brand-copy">
                  One rail for navigation. One workspace for decisions. One intel stack for pressure, signal, and posture.
                </p>
              </div>

              <div className="space-y-2">
                {navItems.map((item) => (
                  <SurfaceButton
                    key={item.key}
                    label={item.label}
                    badge={item.badge}
                    icon={item.icon}
                    active={surface === item.key}
                    onClick={() => setSurface(item.key)}
                  />
                ))}
              </div>

              <div className="xt-mp-sidebar-foot">
                <div className="xt-mp-sidebar-label">Live lane</div>
                <div className="xt-mp-sidebar-copy">Current viewer {viewer?.name || 'Unknown'} • {snapshot.readinessScore}% readiness • {snapshot.attentionEvents} attention signals</div>
              </div>
            </aside>

            <main className="xt-mp-main min-w-0">
              <section className="xt-mp-commandbar">
                <div className="xt-mp-commandbar-head">
                  <div className="min-w-0 max-w-3xl">
                    <div className="xt-mp-command-kicker">People Ops / Mission Control</div>
                    <h1 className="xt-mp-command-title">{surfaceTitle[surface].title}</h1>
                    <p className="xt-mp-command-copy">{surfaceTitle[surface].detail}</p>
                  </div>
                  <div className="xt-mp-command-tools">
                    <label className="xt-mp-command-search">
                      <div className="xt-mp-command-search-label">
                        <Search size={12} className="text-[var(--app-accent)]" />
                        Search network
                      </div>
                      <input
                        value={playerSearch}
                        onChange={(event) => setPlayerSearch(event.target.value)}
                        placeholder="Name, role, tag, timezone"
                        className="xt-mp-input"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="accent">{queueItems.length} queue</Badge>
                      <Badge>{snapshot.collaborations} spaces</Badge>
                      <Badge>{snapshot.threads} threads</Badge>
                      <Badge>{snapshot.auditEntries} trace</Badge>
                    </div>
                  </div>
                </div>
              </section>

              <div className="xt-mp-command-strip">
                <CommandStat label="Readiness" value={`${snapshot.readinessScore}%`} hint="coverage, activity, collaboration health" />
                <CommandStat label="Queue" value={queueItems.length} hint={`${snapshot.pendingPlayers} invite gaps • ${snapshot.pendingProposals} proposals`} />
                <CommandStat label="Signals" value={snapshot.unreadMessages} hint={`${snapshot.threads} threads • ${snapshot.attentionEvents} attention events`} />
                <CommandStat label="Map" value={snapshot.visiblePins} hint={`${snapshot.savedLocations} saved places • ${snapshot.liveShareCount} live shares`} />
              </div>

              {surfaceModeStrip}

              <div className="xt-mp-workspace">

              {surface === 'HQ' ? (
                <div className="space-y-6">
                  <SectionHeader
                    eyebrow="People Ops / Mission Control"
                    title="Multiplayer HQ"
                    detail="Triage first. Keep one queue, one system-shape map, and one recent signal lane before dropping into deeper workstations."
                    stats={[
                      { label: 'readiness', value: `${snapshot.readinessScore}%` },
                      { label: 'queue', value: queueItems.length },
                      { label: 'signals', value: snapshot.unreadMessages },
                    ]}
                  />
                  <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
                    <Panel title="Triage Queue" subtitle="The few things worth looking at first">
                      <div className="space-y-3">
                        {queueItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              item.onSelect?.();
                              openTarget(item.target);
                            }}
                            className={`ui-pressable flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left ${
                              item.tone === 'alert'
                                ? 'border-[color-mix(in_srgb,#ff7d69_35%,transparent)] bg-[color-mix(in_srgb,#ff7d69_10%,var(--app-panel))]'
                                : 'border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] hover:border-[color-mix(in_srgb,var(--app-accent)_30%,transparent)]'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-[12px] font-semibold text-[var(--app-text)]">{item.title}</div>
                              <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{item.detail}</div>
                            </div>
                            <ChevronRight size={14} className="shrink-0 text-[var(--app-muted)]" />
                          </button>
                        ))}
                        {!queueItems.length ? (
                          <div className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-4 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                            Queue is clear. The current local network state is stable.
                          </div>
                        ) : null}
                      </div>
                    </Panel>

                    <Panel title="System Shape" subtitle="Where to go depending on the problem">
                      <div className="grid gap-3 md:grid-cols-2">
                        <ListRow
                          title="People lane"
                          detail={`${outreachPlayers.length} player gaps • ${snapshot.taggedPlayers}/${snapshot.totalPlayers} tagged`}
                          onClick={() => setSurface('PEOPLE')}
                          badge={<Badge tone="accent">People</Badge>}
                        />
                        <ListRow
                          title="Spaces lane"
                          detail={`${snapshot.pendingProposals} pending proposals • ${snapshot.openTasks} open tasks`}
                          onClick={() => setSurface('SPACES')}
                          badge={<Badge tone="accent">Spaces</Badge>}
                        />
                        <ListRow
                          title="Map lane"
                          detail={`${snapshot.visiblePins} visible pins • ${snapshot.savedLocations} saved places`}
                          onClick={() => setSurface('MAP')}
                          badge={<Badge tone="accent">Map</Badge>}
                        />
                        <ListRow
                          title="Signals lane"
                          detail={`${snapshot.unreadMessages} unread • ${snapshot.auditEntries} trace events`}
                          onClick={() => setSurface('SIGNALS')}
                          badge={<Badge tone="accent">Signals</Badge>}
                        />
                      </div>
                    </Panel>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
                    <Panel title="Recent Activity" subtitle="Cross-system feed without leaving the command surface">
                      <div className="space-y-3">
                        {feedItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (item.kind === 'message') {
                                setSurface('SIGNALS');
                                setSignalsMode('COMMS');
                                if (item.threadId) setSelectedThreadId(item.threadId);
                                return;
                              }
                              if (item.kind === 'trace') {
                                setSurface('SIGNALS');
                                setSignalsMode('TRACE');
                                return;
                              }
                              if (item.kind === 'xp') {
                                setSurface('SIGNALS');
                                setSignalsMode('RANK');
                                return;
                              }
                              setSurface('SPACES');
                            }}
                            className="ui-pressable w-full rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-3 text-left hover:border-[color-mix(in_srgb,var(--app-accent)_30%,transparent)]"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[12px] font-semibold text-[var(--app-text)]">{item.title}</div>
                              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{formatTimeAgo(item.ts)}</div>
                            </div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">{item.detail}</div>
                          </button>
                        ))}
                      </div>
                    </Panel>

                    <Panel title="Risk Watch" subtitle="What still blocks a clean multiplayer state">
                      <div className="space-y-2">
                        {snapshot.riskFlags.map((flag, index) => (
                          <div
                            key={`${flag}-${index}`}
                            className="rounded-xl border border-[color-mix(in_srgb,var(--app-accent)_24%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel))] px-3 py-3"
                          >
                            <div className="flex items-start gap-2">
                              <AlertTriangle size={14} className="mt-0.5 text-[var(--app-accent)]" />
                              <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--app-text)]">{flag}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </div>
                </div>
              ) : null}

              {surface === 'PEOPLE' ? (
                <div className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
                    <Panel title="Roster" subtitle={`${filteredPlayers.length} visible players`}>
                      <div className="mb-4 grid gap-2 border-b border-[color-mix(in_srgb,var(--app-text)_8%,transparent)] pb-4">
                        <div className="xt-mp-panel-kicker">Draft a player record</div>
                        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr),160px,auto]">
                          <input
                            value={draftPlayerName}
                            onChange={(event) => setDraftPlayerName(event.target.value)}
                            placeholder="Add player name"
                            className="xt-mp-input px-3 py-2 text-[11px] placeholder:text-[var(--app-muted)]"
                          />
                          <input
                            value={draftPlayerRole}
                            onChange={(event) => setDraftPlayerRole(event.target.value)}
                            placeholder="Role"
                            className="xt-mp-input px-3 py-2 text-[11px] placeholder:text-[var(--app-muted)]"
                          />
                          <ActionButton label="Add Player" icon={<Plus size={12} />} onClick={addDraftPlayer} tone="accent" />
                        </div>
                      </div>
                      <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
                        {filteredPlayers.map((player) => (
                          <ListRow
                            key={player.id}
                            title={player.name}
                            detail={`${player.role} • ${(player.tags || []).join(', ') || 'untagged'}`}
                            active={selectedPlayer?.id === player.id}
                            badge={
                              <div className="flex items-center gap-2">
                                {!player.accepted ? <Badge tone="alert">pending</Badge> : null}
                                {(unreadByThread.get(sortedThreads.find((thread) => thread.participantId === player.id)?.id || '') || 0) > 0 ? (
                                  <span className="rounded-full bg-[var(--app-accent)] px-2 py-0.5 text-[9px] font-bold text-white">
                                    {unreadByThread.get(sortedThreads.find((thread) => thread.participantId === player.id)?.id || '')}
                                  </span>
                                ) : null}
                              </div>
                            }
                            onClick={() => {
                              setSelectedPlayerId(player.id);
                              setPeopleMode('ROSTER');
                            }}
                          />
                        ))}
                      </div>
                    </Panel>

                    {peopleMode === 'ROSTER' ? (
                      <div className="space-y-6">
                        <SectionHeader
                          eyebrow="People Ops / Dossier"
                          title={selectedPlayer?.name || 'Player dossier'}
                          detail={
                            selectedPlayer
                              ? 'One readable profile, one posture summary, and one gap lane before you take action.'
                              : 'Select a player to open the current dossier.'
                          }
                          stats={
                            selectedPlayer
                              ? [
                                  { label: 'status', value: selectedPlayer.accepted ? 'accepted' : 'pending' },
                                  {
                                    label: 'threads',
                                    value: sortedThreads.some((thread) => thread.participantId === selectedPlayer.id) ? 1 : 0,
                                  },
                                  { label: 'spaces', value: playerCollabs.length },
                                ]
                              : []
                          }
                          actions={
                            selectedPlayer ? (
                              <div className="flex flex-wrap gap-2">
                                {selectedPlayer.id !== 'me' ? (
                                  <ActionButton label="Message" onClick={() => openThreadForPlayer(selectedPlayer.id, selectedPlayer.name)} />
                                ) : null}
                                {selectedPlayer?.location ? (
                                  <ActionButton label="Open Map" onClick={() => onOpenEarthFocusByPlayerId(selectedPlayer.id)} />
                                ) : null}
                                {selectedPlayer?.id !== 'me' ? (
                                  <ActionButton label="Open Brief" onClick={() => openBriefForPlayer(selectedPlayer.id)} tone="accent" />
                                ) : null}
                              </div>
                            ) : null
                          }
                        />
                        <Panel
                          title="Identity + posture"
                          subtitle={selectedPlayer?.role || 'Unknown role'}
                        >
                          {selectedPlayer ? (
                            <div className="space-y-5">
                              <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
                                <div className="space-y-3">
                                  <div className="xt-mp-identity-block">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <div className="xt-mp-panel-kicker">Selected dossier</div>
                                        <div className="xt-mp-metric-value !mt-2 !text-[28px]">{selectedPlayer.name}</div>
                                        <div className="xt-mp-info-detail">{selectedPlayer.role}</div>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <Badge tone="accent">{selectedPlayer.accepted ? 'accepted' : 'pending'}</Badge>
                                        <Badge>{selectedPlayer.timeZone || 'no timezone'}</Badge>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <InfoBlock label="Contact" value={selectedPlayer.email || selectedPlayer.phone || 'No direct contact'} detail="Direct path outside XTATION" />
                                    <InfoBlock label="Location" value={selectedPlayer.location ? 'Set' : 'None'} detail={locationLabel(selectedPlayer)} />
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <div className="xt-mp-panel-kicker">Access posture</div>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge>{selectedPlayer.permissions.profileLevel} profile</Badge>
                                    <Badge>{selectedPlayer.permissions.location} location</Badge>
                                    <Badge>{selectedPlayer.permissions.pinVisibility} pins</Badge>
                                    <Badge>{selectedPlayer.permissions.rankVisibility ? 'rank visible' : 'rank hidden'}</Badge>
                                  </div>
                                  <div className="xt-mp-panel-kicker !mt-4">Tags</div>
                                  <div className="flex flex-wrap gap-2">
                                    {(selectedPlayer.tags || []).map((tag) => (
                                      <Badge key={`${selectedPlayer.id}-${tag}`}>{tag}</Badge>
                                    ))}
                                    {!(selectedPlayer.tags || []).length ? <Badge tone="alert">needs tags</Badge> : null}
                                  </div>
                                </div>
                              </div>

                              <div className="xt-mp-section-stats xt-mp-section-stats--wide">
                                <div className="xt-mp-section-stat">
                                  <div className="xt-mp-section-stat-label">XP visibility</div>
                                  <div className="xt-mp-section-stat-value">{playerXpTotal}</div>
                                </div>
                                <div className="xt-mp-section-stat">
                                  <div className="xt-mp-section-stat-label">collab spaces</div>
                                  <div className="xt-mp-section-stat-value">{playerCollabs.length}</div>
                                </div>
                                <div className="xt-mp-section-stat">
                                  <div className="xt-mp-section-stat-label">direct line</div>
                                  <div className="xt-mp-section-stat-value">
                                    {sortedThreads.some((thread) => thread.participantId === selectedPlayer.id) ? 'open' : 'missing'}
                                  </div>
                                </div>
                                <div className="xt-mp-section-stat">
                                  <div className="xt-mp-section-stat-label">map posture</div>
                                  <div className="xt-mp-section-stat-value">{selectedPlayer.location ? 'set' : 'none'}</div>
                                </div>
                              </div>

                              <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
                                <Panel title="Activity Ledger" subtitle="Recent player-specific movement only">
                                  <div className="space-y-2">
                                    {feedItems
                                      .filter((item) => item.playerId === selectedPlayer.id)
                                      .slice(0, 4)
                                      .map((item) => (
                                        <RailActivityRow
                                          key={`${selectedPlayer.id}-${item.id}`}
                                          title={item.title}
                                          detail={item.detail}
                                          meta={formatTimeAgo(item.ts)}
                                        />
                                      ))}
                                    {!feedItems.some((item) => item.playerId === selectedPlayer.id) ? (
                                      <div className="xt-mp-empty-block">No recent activity for this player.</div>
                                    ) : null}
                                  </div>
                                </Panel>

                                <Panel title="Coordination Snapshot" subtitle="What still weakens this dossier">
                                  <div className="space-y-2">
                                    {!selectedPlayer.accepted ? <RailActivityRow title="Invite pending" detail="Relationship has not been accepted into the live network yet." accent="alert" /> : null}
                                    {!selectedPlayer.email && !selectedPlayer.phone ? <RailActivityRow title="Missing direct contact" detail="No fallback email or phone path is stored." accent="alert" /> : null}
                                    {!selectedPlayer.location ? <RailActivityRow title="No saved location" detail="Map coordination remains weak until a location is known." accent="alert" /> : null}
                                    {!selectedPlayer.timeZone && typeof selectedPlayer.utcOffsetMinutes !== 'number' ? <RailActivityRow title="No timezone" detail="Scheduling pressure cannot be normalized for this player yet." accent="alert" /> : null}
                                    {!selectedPlayer.permissions.rankVisibility ? <RailActivityRow title="Rank hidden" detail="Leaderboard visibility is private for this player." /> : null}
                                  </div>
                                </Panel>
                              </div>
                            </div>
                          ) : null}
                        </Panel>
                      </div>
                    ) : null}

                    {peopleMode === 'NETWORK' ? (
                      <div className="space-y-6">
                        <SectionHeader
                          eyebrow="People Ops / Network"
                          title="Coverage matrix"
                          detail="Reduce the network to the few fields that decide whether collaboration is actually usable."
                          stats={[
                            { label: 'tagged', value: `${snapshot.taggedPlayers}/${snapshot.totalPlayers}` },
                            { label: 'contact', value: `${snapshot.playersWithContact}/${snapshot.totalPlayers}` },
                            { label: 'geo', value: `${snapshot.locatedPlayers}/${snapshot.totalPlayers}` },
                          ]}
                        />
                        <Panel title="Coverage Matrix" subtitle="The few network questions that actually matter">
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <MetricCard
                              label="Tagged"
                              value={`${snapshot.taggedPlayers}/${snapshot.totalPlayers}`}
                              detail="Tags decide if network groups are understandable."
                              icon={<Shield size={16} />}
                            />
                            <MetricCard
                              label="Contact"
                              value={`${snapshot.playersWithContact}/${snapshot.totalPlayers}`}
                              detail="Direct contact anchors outside the app."
                              icon={<MessageSquare size={16} />}
                            />
                            <MetricCard
                              label="Geo"
                              value={`${snapshot.locatedPlayers}/${snapshot.totalPlayers}`}
                              detail="Saved coordinates for routes and nearby tools."
                              icon={<MapIcon size={16} />}
                            />
                            <MetricCard
                              label="Timezone"
                              value={`${snapshot.playersWithTimezone}/${snapshot.totalPlayers}`}
                              detail="Scheduling readiness."
                              icon={<Globe size={16} />}
                            />
                          </div>
                        </Panel>

                        <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
                          <Panel title="Tag Clusters" subtitle="Keep a small number of readable network groups">
                            <div className="flex flex-wrap gap-2">
                              {tagClusters.map(([tag, count]) => (
                                <Badge key={tag} tone={count > 1 ? 'accent' : 'default'}>
                                  {tag} · {count}
                                </Badge>
                              ))}
                            </div>
                          </Panel>

                          <Panel title="Coverage Gaps" subtitle="The dossiers currently weakening the network">
                            <div className="space-y-2">
                              {outreachPlayers.map(({ player, gaps }) => (
                                <div key={`network-gap-${player.id}`} className="xt-mp-list-row">
                                  <div className="min-w-0">
                                    <div className="xt-mp-list-title">{player.name}</div>
                                    <div className="xt-mp-list-detail">{player.role}</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {gaps.map((gap) => (
                                        <Badge key={`${player.id}-${gap}`} tone="alert">
                                          {gap}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                  <ActionButton
                                    label="Open Dossier"
                                    onClick={() => {
                                      setSelectedPlayerId(player.id);
                                      setPeopleMode('ROSTER');
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </Panel>
                        </div>
                      </div>
                    ) : null}

                    {peopleMode === 'OUTREACH' ? (
                      <div className="space-y-6">
                        <SectionHeader
                          eyebrow="People Ops / Outreach"
                          title="Repair queue"
                          detail="Only surface the players who need a message, a brief, or a dossier repair right now."
                          stats={[
                            { label: 'targets', value: outreachPlayers.length },
                            { label: 'pending', value: players.filter((player) => !player.accepted).length },
                            { label: 'missing lines', value: players.filter((player) => player.id !== 'me' && player.accepted && !sortedThreads.find((thread) => thread.participantId === player.id)).length },
                          ]}
                        />
                        <Panel title="Outreach Queue" subtitle="Invite, brief, or repair only the players that need it">
                          <div className="space-y-2">
                            {outreachPlayers.map(({ player, gaps }) => (
                              <div key={`outreach-${player.id}`} className="xt-mp-list-row" data-tone="alert">
                                <div className="min-w-0">
                                  <div className="xt-mp-list-title">{player.name}</div>
                                  <div className="xt-mp-list-detail">{gaps.join(' • ')}</div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <ActionButton label="Message" onClick={() => openThreadForPlayer(player.id, player.name)} />
                                  <ActionButton label="Open Brief" onClick={() => openBriefForPlayer(player.id)} tone="accent" />
                                  <ActionButton
                                    label="Fix"
                                    onClick={() => {
                                      setSelectedPlayerId(player.id);
                                      setPeopleMode('ROSTER');
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </Panel>
                      </div>
                    ) : null}
                  </div>

                  {operatorAccess.allowed ? (
                    <details className="rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] shadow-sm">
                      <summary className="cursor-pointer list-none px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">
                        Operator Workbench
                      </summary>
                      <div className="border-t border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] p-4">
                        <Test01View
                          players={players}
                          onUpdatePlayer={onUpdatePlayer}
                          onAddPlayer={onAddPlayer}
                          onDeletePlayer={onDeletePlayer}
                          onGoToEarth={({ playerId, loc }) => {
                            setEarthFocus({ playerId, loc });
                            setSurface('MAP');
                          }}
                          setToast={setToast}
                          focusPlayerId={selectedPlayerId}
                          onClearFocusPlayer={() => undefined}
                        />
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : null}

              {surface === 'SPACES' ? (
                <div className="space-y-6">
                  <SectionHeader
                    eyebrow="People Ops / Spaces"
                    title="Collaboration rooms"
                    detail="Shared work stays inside a small number of rooms. Keep active tasks, proposals, and member posture legible."
                    stats={[
                      { label: 'spaces', value: collabs.length },
                      { label: 'pending proposals', value: snapshot.pendingProposals },
                      { label: 'open tasks', value: snapshot.openTasks },
                    ]}
                  />
                  <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
                    <Panel
                      title="Spaces"
                      subtitle={`${collabs.length} active collaboration spaces`}
                      action={
                        <ActionButton label="Create" onClick={addDraftCollab} tone="accent" icon={<Plus size={12} />} />
                      }
                    >
                      <div className="mb-3 space-y-2">
                        <input
                          value={draftCollabTitle}
                          onChange={(event) => setDraftCollabTitle(event.target.value)}
                          placeholder="Space title"
                          className="w-full rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-[11px] text-[var(--app-text)] placeholder:text-[var(--app-muted)]"
                        />
                        <input
                          value={draftCollabGoal}
                          onChange={(event) => setDraftCollabGoal(event.target.value)}
                          placeholder="Goal"
                          className="w-full rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-[11px] text-[var(--app-text)] placeholder:text-[var(--app-muted)]"
                        />
                      </div>
                      <div className="space-y-2">
                        {collabPressure.map(({ collab, pending, openTasks }) => (
                          <ListRow
                            key={collab.id}
                            title={collab.title}
                            detail={`${pending} pending proposals • ${openTasks} open tasks`}
                            active={selectedCollab?.id === collab.id}
                            badge={pending ? <Badge tone="alert">{pending}</Badge> : undefined}
                            onClick={() => setSelectedCollabId(collab.id)}
                          />
                        ))}
                      </div>
                    </Panel>

                    <div className="space-y-6">
                      <Panel
                        title={selectedCollab?.title || 'Space'}
                        subtitle={selectedCollab?.goal || 'No goal defined'}
                        action={
                          selectedCollab ? (
                            <div className="flex flex-wrap gap-2">
                              <Badge tone="accent">{selectedCollab.members.length} members</Badge>
                              <Badge>{selectedCollab.tasks.filter((task) => !task.done).length} open tasks</Badge>
                            </div>
                          ) : null
                        }
                      >
                        {selectedCollab ? (
                          <div className="space-y-5">
                            <div className="flex flex-wrap gap-2">
                              {selectedCollab.members.map((memberId) => (
                                <button
                                  key={`${selectedCollab.id}-${memberId}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPlayerId(memberId);
                                    setSurface('PEOPLE');
                                    setPeopleMode('ROSTER');
                                  }}
                                  className="ui-pressable rounded-full border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-text)]"
                                >
                                  {players.find((player) => player.id === memberId)?.name || memberId}
                                </button>
                              ))}
                            </div>

                            <div className="grid gap-4 xl:grid-cols-[1fr,0.92fr]">
                              <div className="space-y-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Tasks</div>
                                {selectedCollab.tasks.map((task) => (
                                  <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => onUpdateTask(selectedCollab.id, task.id)}
                                    className={`ui-pressable flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left ${
                                      task.done
                                        ? 'border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--app-text)_4%,var(--app-panel))]'
                                        : 'border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)]'
                                    }`}
                                  >
                                    <div className="text-[12px] font-semibold text-[var(--app-text)]">{task.title}</div>
                                    <Badge tone={task.done ? 'accent' : 'default'}>{task.done ? 'done' : 'open'}</Badge>
                                  </button>
                                ))}
                                {!selectedCollab.tasks.length ? (
                                  <div className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-4 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                                    No tasks yet.
                                  </div>
                                ) : null}
                              </div>

                              <div className="space-y-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Pending Proposals</div>
                                {selectedCollab.proposals.map((proposal) => (
                                  <div
                                    key={proposal.id}
                                    className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-3"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <div className="text-[12px] font-semibold text-[var(--app-text)]">{proposal.type}</div>
                                        <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                                          {proposal.status} • {formatTimeAgo(proposal.createdAt)}
                                        </div>
                                      </div>
                                      {proposal.status === 'pending' ? <Badge tone="alert">review</Badge> : <Badge>{proposal.status}</Badge>}
                                    </div>
                                    {proposal.status === 'pending' ? (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => onApprove(selectedCollab.id, proposal.id, true)}
                                          className="ui-pressable rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--app-text)]"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onApprove(selectedCollab.id, proposal.id, false)}
                                          className="ui-pressable rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--app-text)]"
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                                {!selectedCollab.proposals.length ? (
                                  <div className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-4 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                                    No proposals queued for this space.
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </Panel>
                    </div>
                  </div>

                  <details className="rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] shadow-sm">
                    <summary className="cursor-pointer list-none px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">
                      Advanced Collaboration Workstation
                    </summary>
                    <div className="border-t border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] p-4">
                      <CollaborationView
                        collabs={collabs}
                        players={players}
                        onAddCollab={onAddCollab}
                        onUpdateTask={onUpdateTask}
                        onApprove={onApprove}
                        onCreateProposal={onCreateProposal}
                        viewAsId={viewAsId}
                        setToast={setToast}
                      />
                    </div>
                  </details>
                </div>
              ) : null}

              {surface === 'MAP' ? (
                <div className="space-y-6">
                  <SectionHeader
                    eyebrow="People Ops / Map"
                    title="Fieldboard"
                    detail="Answer location questions fast: who is visible, what is pinned, what is saved, and where the current operator can actually route."
                    stats={[
                      { label: 'pins', value: snapshot.visiblePins },
                      { label: 'saved', value: snapshot.savedLocations },
                      { label: 'live', value: snapshot.liveShareCount },
                    ]}
                  />
                  <div className="grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
                    <Panel title="Fieldboard" subtitle="The fast location answers first">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard
                          label="Operator"
                          value={myLocation ? 'SET' : 'OFF'}
                          detail={myLocation ? `${myLocation.lat.toFixed(2)}, ${myLocation.lng.toFixed(2)}` : 'No current location'}
                          icon={<Compass size={16} />}
                        />
                        <MetricCard
                          label="Pins"
                          value={snapshot.visiblePins}
                          detail="Visible tactical markers"
                          icon={<MapIcon size={16} />}
                        />
                        <MetricCard
                          label="Saved"
                          value={snapshot.savedLocations}
                          detail="Persistent places"
                          icon={<Globe size={16} />}
                        />
                        <MetricCard
                          label="Live"
                          value={snapshot.liveShareCount}
                          detail={`${snapshot.cityShareCount} city-level shares`}
                          icon={<Radio size={16} />}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <input
                          value={draftPinTitle}
                          onChange={(event) => setDraftPinTitle(event.target.value)}
                          placeholder="Quick pin title"
                          className="w-48 rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-[11px] text-[var(--app-text)] placeholder:text-[var(--app-muted)]"
                        />
                        <ActionButton label="Add Pin" onClick={addQuickPin} tone="accent" icon={<Plus size={12} />} />
                        <ActionButton label="Stop Live Shares" onClick={stopAllLiveShares} />
                      </div>
                    </Panel>

                    <Panel title="People On Map" subtitle="Who is location-ready and what they can see">
                      <div className="space-y-2">
                        {players
                          .filter((player) => player.id !== 'me')
                          .map((player) => (
                            <div
                              key={`map-player-${player.id}`}
                              className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-4 py-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="text-[12px] font-semibold text-[var(--app-text)]">{player.name}</div>
                                  <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                                    {locationLabel(player)}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge>{sharingByPlayer[player.id]?.mode || 'off'}</Badge>
                                  {player.location ? (
                                    <button
                                      type="button"
                                      onClick={() => onOpenEarthFocusByPlayerId(player.id)}
                                      className="ui-pressable rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--app-text)]"
                                    >
                                      Focus
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShareMode(player.id, 'off')}
                                  className="ui-pressable rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-text)]"
                                >
                                  Off
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShareMode(player.id, 'city')}
                                  className="ui-pressable rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-text)]"
                                >
                                  City
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShareMode(player.id, 'live')}
                                  className="ui-pressable rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-text)]"
                                >
                                  Live 30m
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </Panel>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
                    <Panel title="Pins" subtitle="Visible tactical markers for the current viewer">
                      <div className="space-y-2">
                        {visiblePins.map((pin) => (
                          <div
                            key={pin.id}
                            className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[12px] font-semibold text-[var(--app-text)]">{pin.title}</div>
                                <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                                  {pin.note || `${pin.lat.toFixed(2)}, ${pin.lng.toFixed(2)}`}
                                </div>
                              </div>
                              <Badge>{pin.scope}</Badge>
                            </div>
                          </div>
                        ))}
                        {!visiblePins.length ? (
                          <div className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-4 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                            No visible pins yet for this viewer.
                          </div>
                        ) : null}
                      </div>
                    </Panel>

                    <Panel title="Saved Places" subtitle="Persistent anchors for the earth layer">
                      <div className="space-y-2">
                        {savedLocations.map((location) => (
                          <div
                            key={location.id}
                            className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[12px] font-semibold text-[var(--app-text)]">{location.title}</div>
                                <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--app-muted)]">
                                  {location.lat.toFixed(2)}, {location.lng.toFixed(2)}
                                </div>
                              </div>
                              {location.favorite ? <Badge tone="accent">favorite</Badge> : null}
                            </div>
                          </div>
                        ))}
                        {!savedLocations.length ? (
                          <div className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] px-3 py-4 text-[11px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                            No saved locations yet.
                          </div>
                        ) : null}
                      </div>
                    </Panel>
                  </div>

                  {advancedEarthView}
                </div>
              ) : null}

              {surface === 'SIGNALS' ? (
                <div className="space-y-6">
                  {signalsMode === 'COMMS' ? (
                    <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
                      <div className="xl:col-span-2">
                        <SectionHeader
                          eyebrow="Signals / Comms"
                          title={selectedThread?.title || 'Signal lines'}
                          detail="One transcript open at a time. Keep the line readable, route outreach from the side lane, and avoid tool clutter."
                          stats={[
                            { label: 'threads', value: sortedThreads.length },
                            { label: 'unread', value: snapshot.unreadMessages },
                            { label: 'outreach gaps', value: players.filter((player) => player.id !== 'me' && player.accepted && !sortedThreads.find((thread) => thread.participantId === player.id)).length },
                          ]}
                          actions={
                            selectedThread?.participantId ? (
                              <div className="flex flex-wrap gap-2">
                                <ActionButton label="Open Chat Dock" onClick={() => openThreadForPlayer(selectedThread.participantId!, selectedThread.title)} />
                                <ActionButton label="Mark Read" onClick={() => markThreadRead(selectedThread.id)} tone="accent" />
                              </div>
                            ) : null
                          }
                        />
                      </div>
                      <Panel title="Threads" subtitle={`${sortedThreads.length} active lines`}>
                        <div className="space-y-2">
                          {sortedThreads.map((thread) => {
                            const unread = unreadByThread.get(thread.id) || 0;
                            return (
                              <ListRow
                                key={thread.id}
                                title={thread.title}
                                detail={`${thread.participantId ? players.find((player) => player.id === thread.participantId)?.name || thread.participantId : 'external'} • ${formatTimeAgo(thread.lastMessageAt || thread.createdAt)}`}
                                active={selectedThread?.id === thread.id}
                                badge={unread ? <Badge tone="accent">{unread}</Badge> : undefined}
                                onClick={() => setSelectedThreadId(thread.id)}
                              />
                            );
                          })}
                        </div>
                      </Panel>

                      <div className="space-y-6">
                        <Panel
                          title={selectedThread?.title || 'No thread selected'}
                          subtitle={selectedThread?.participantId ? players.find((player) => player.id === selectedThread.participantId)?.role || 'Direct line' : 'Direct line'}
                        >
                          <div className="xt-mp-transcript max-h-[420px] overflow-y-auto pr-1">
                            {selectedThreadMessages.map((message) => (
                              <MessageCard
                                key={message.id}
                                own={message.from === 'me'}
                                title={
                                  message.from === 'me'
                                    ? 'You'
                                    : players.find((player) => player.id === message.from)?.name || message.from
                                }
                                timestamp={formatTimeAgo(message.ts)}
                                body={message.text}
                              />
                            ))}
                            {!selectedThreadMessages.length ? (
                              <div className="xt-mp-empty-block">No messages in this thread yet.</div>
                            ) : null}
                          </div>
                        </Panel>

                        <Panel title="Outreach" subtitle="Accepted players still missing a direct line">
                          <div className="space-y-2">
                            {players
                              .filter((player) => player.id !== 'me' && player.accepted && !sortedThreads.find((thread) => thread.participantId === player.id))
                              .map((player) => (
                                <div key={`outreach-thread-${player.id}`} className="xt-mp-list-row">
                                  <div className="min-w-0">
                                    <div className="xt-mp-list-title">{player.name}</div>
                                    <div className="xt-mp-list-detail">{player.role}</div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <ActionButton label="Open Brief" onClick={() => openBriefForPlayer(player.id)} tone="accent" />
                                    <ActionButton label="Open" onClick={() => openThreadForPlayer(player.id, player.name)} />
                                  </div>
                                </div>
                              ))}
                          </div>
                        </Panel>
                      </div>
                    </div>
                  ) : null}

                  {signalsMode === 'RANK' ? (
                    <div className="space-y-6">
                      <SectionHeader
                        eyebrow="Signals / Rank"
                        title="XP ladder"
                        detail="Keep the rank surface honest: recent motion, fast scoring, and one simple leaderboard."
                        stats={[
                          { label: 'leaders', value: snapshot.xpLeaders.length },
                          { label: 'logs', value: xpLogs.length },
                          { label: 'viewer', value: viewer?.name || 'unknown' },
                        ]}
                      />
                      <Panel title="Leaderboard" subtitle="Keep it simple: total XP and recent motion">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          {snapshot.xpLeaders.map(({ player, totalXp }) => (
                            <MetricCard
                              key={`leader-${player.id}`}
                              label={player.name}
                              value={totalXp}
                              detail={player.role}
                              icon={<Trophy size={16} />}
                            />
                          ))}
                        </div>
                      </Panel>

                      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
                        <Panel title="Recent XP Logs" subtitle="Latest multiplayer progression events">
                          <div className="space-y-2">
                            {xpLogs.slice(0, 10).map((log) => (
                              <div key={log.id} className="xt-mp-list-row">
                                <div className="min-w-0">
                                  <div className="xt-mp-list-title">{players.find((player) => player.id === log.playerId)?.name || 'Unknown'}</div>
                                  <div className="xt-mp-list-detail">{log.tag || 'general'} • {formatTimeAgo(log.timestamp)}</div>
                                </div>
                                <Badge tone="accent">
                                  {log.amount >= 0 ? '+' : ''}
                                  {log.amount} XP
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </Panel>

                        <Panel title="Quick XP" subtitle="Fast scoring without opening a heavy modal">
                          <div className="space-y-3">
                            <select
                              value={selectedPlayer?.id || ''}
                              onChange={(event) => setSelectedPlayerId(event.target.value)}
                              className="w-full rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-2 text-sm text-[var(--app-text)]"
                            >
                              {players.map((player) => (
                                <option key={player.id} value={player.id}>
                                  {player.name}
                                </option>
                              ))}
                            </select>
                            <div className="flex flex-wrap gap-2">
                              {[5, 10, 20].map((amount) => (
                                <ActionButton key={`xp-${amount}`} label={`+${amount} XP`} onClick={() => selectedPlayer && onAddXp(selectedPlayer.id, amount, 'manual')} />
                              ))}
                              <ActionButton label="-5 XP" onClick={() => selectedPlayer && onAddXp(selectedPlayer.id, -5, 'manual')} tone="accent" />
                            </div>
                          </div>
                        </Panel>
                      </div>

                      <details className="rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] shadow-sm">
                        <summary className="cursor-pointer list-none px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">
                          Advanced Rank Workstation
                        </summary>
                        <div className="border-t border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] p-4">
                          <RankView players={players} viewAsId={viewAsId} xpLogs={xpLogs} />
                        </div>
                      </details>
                    </div>
                  ) : null}

                  {signalsMode === 'TRACE' ? (
                    <div className="space-y-6">
                      <SectionHeader
                        eyebrow="Signals / Trace"
                        title="Operational trace"
                        detail="This is the event stream Lab will eventually subscribe to. Keep it readable, filterable, and easy to reopen."
                        stats={[
                          { label: 'entries', value: filteredTrace.length },
                          { label: 'audit total', value: auditLog.length },
                          { label: 'filter', value: traceFilter },
                        ]}
                      />
                      <Panel
                        title="Trace"
                        subtitle="The event surface that future Lab triggers can subscribe to"
                        action={
                          <div className="flex flex-wrap gap-2">
                            <select
                              value={traceFilter}
                              onChange={(event) => setTraceFilter(event.target.value as TraceFilter)}
                              className="rounded-lg border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-1.5 text-[11px] text-[var(--app-text)]"
                            >
                              <option value="all">All severities</option>
                              <option value="info">Info</option>
                              <option value="attention">Attention</option>
                              <option value="critical">Critical</option>
                            </select>
                            <ActionButton label="Copy Trace" onClick={copyTrace} icon={<Copy size={12} />} />
                          </div>
                        }
                      >
                        <div className="space-y-3">
                          {filteredTrace.map((entry) => (
                            <div key={entry.id} className="xt-mp-list-row" data-tone={entry.severity === 'critical' ? 'alert' : 'default'}>
                              <div className="min-w-0">
                                <div className="xt-mp-list-title">{entry.title}</div>
                                <div className="xt-mp-list-detail">
                                  {entry.entity} • {entry.action} • {formatTimeAgo(entry.ts)}
                                </div>
                                <div className="xt-mp-message-body !mt-2">{entry.detail}</div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge tone={entry.severity === 'info' ? 'default' : entry.severity === 'attention' ? 'accent' : 'alert'}>
                                  {entry.severity}
                                </Badge>
                                {entry.route ? <ActionButton label="Open" onClick={() => openTarget(entry.route!)} /> : null}
                              </div>
                            </div>
                          ))}
                          {!filteredTrace.length ? (
                            <div className="xt-mp-empty-block">No trace entries in this severity lane.</div>
                          ) : null}
                        </div>
                      </Panel>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {surface === 'OPS' ? (
                <div className="space-y-6">
                  <SectionHeader
                    eyebrow="People Ops / Operations"
                    title="Operational controls"
                    detail="Keep support actions, exports, viewer simulation, and risk posture in one strict lane instead of spreading them across the station."
                    stats={[
                      { label: 'presence', value: userSettings.presenceMode },
                      { label: 'trace', value: snapshot.auditEntries },
                      { label: 'viewer', value: viewer?.name || 'unknown' },
                    ]}
                  />
                  <Panel title="Operational Controls" subtitle="Exports, safety actions, and viewer simulation">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <MetricCard
                        label="Presence"
                        value={userSettings.presenceMode}
                        detail="Controlled by canonical settings"
                        icon={<Eye size={16} />}
                      />
                      <MetricCard
                        label="Profile"
                        value={privacy.profileDetailLevel}
                        detail={`${privacy.pinVisibility} pins • ${privacy.locationMode} location`}
                        icon={<Shield size={16} />}
                      />
                      <MetricCard
                        label="Comms"
                        value={snapshot.threads}
                        detail={`${snapshot.unreadMessages} unread • ${snapshot.orphanThreads} orphaned`}
                        icon={<MessageSquare size={16} />}
                      />
                      <MetricCard
                        label="Trace"
                        value={snapshot.auditEntries}
                        detail={`${snapshot.attentionEvents} attention-grade actions`}
                        icon={<Activity size={16} />}
                      />
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <ActionButton label="Copy Diagnostics" onClick={copyDiagnostics} icon={<Copy size={12} />} />
                      <ActionButton label="Export Snapshot" onClick={exportSnapshot} icon={<Download size={12} />} tone="accent" />
                      <ActionButton label="Stop Live Shares" onClick={stopAllLiveShares} icon={<Shield size={12} />} />
                      <select
                        value={viewAsId}
                        onChange={(event) => setViewAsId(event.target.value)}
                        className="rounded-xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel-2)] px-3 py-3 text-sm text-[var(--app-text)]"
                      >
                        {players.map((player) => (
                          <option key={player.id} value={player.id}>
                            View as {player.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Panel>

                  <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
                    <Panel title="Risk Watch" subtitle="Keep the scary things in one lane">
                      <div className="space-y-2">
                        {snapshot.riskFlags.map((flag, index) => (
                          <div
                            key={`ops-flag-${index}`}
                            className="rounded-xl border border-[color-mix(in_srgb,var(--app-accent)_24%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,var(--app-panel))] px-3 py-3 text-[11px] uppercase tracking-[0.12em] text-[var(--app-text)]"
                          >
                            {flag}
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel title="Module State" subtitle="Feature gates and viewer posture">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={features.multiplayerEnabled ? 'accent' : 'alert'}>{features.multiplayerEnabled ? 'multiplayer on' : 'multiplayer off'}</Badge>
                        <Badge tone={features.labEnabled ? 'accent' : 'default'}>{features.labEnabled ? 'lab on' : 'lab off'}</Badge>
                        <Badge tone={features.storeEnabled ? 'accent' : 'default'}>{features.storeEnabled ? 'store on' : 'store off'}</Badge>
                        <Badge>{viewer?.name || 'unknown viewer'}</Badge>
                      </div>
                    </Panel>
                  </div>

                  <details className="rounded-2xl border border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] shadow-sm">
                    <summary className="cursor-pointer list-none px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">
                      Advanced Operations Workstation
                    </summary>
                    <div className="border-t border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] p-4">
                      <OpsCenterView
                        snapshot={snapshot}
                        players={players}
                        viewAsId={viewAsId}
                        userSettings={userSettings}
                        privacy={privacy}
                        features={features}
                        onSetViewAsId={setViewAsId}
                        onOpenTarget={(target) => openTarget(target)}
                        onFocusPlayer={(playerId) => {
                          setSurface('PEOPLE');
                          setPeopleMode('ROSTER');
                          setSelectedPlayerId(playerId);
                        }}
                        onStopAllLiveShares={stopAllLiveShares}
                        onCopyDiagnostics={copyDiagnostics}
                        onExportSnapshot={exportSnapshot}
                      />
                    </div>
                  </details>
                </div>
              ) : null}
              </div>
            </main>

            <aside className="xt-mp-intel lg:sticky lg:top-4 lg:self-start">
              <Panel title="Current Posture" subtitle="Policy, viewer, and runtime stance">
                <div className="space-y-3">
                  <div className="xt-mp-identity-block">
                    <div className="xt-mp-panel-kicker">Viewer</div>
                    <div className="xt-mp-list-title">{viewer?.name || 'Unknown'}</div>
                    <div className="xt-mp-list-detail">
                      Presence {myPresenceMode} • profile {privacy.profileDetailLevel} • location {privacy.locationMode}
                    </div>
                  </div>
                  <div className="xt-mp-readiness">
                    <div className="flex items-center justify-between gap-3">
                      <span className="xt-mp-panel-kicker">Readiness index</span>
                      <span className="xt-mp-list-title">{snapshot.readinessScore}%</span>
                    </div>
                    <div className="xt-mp-readiness-bar">
                      <span style={{ width: `${Math.max(8, Math.min(100, snapshot.readinessScore))}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>profile {privacy.profileDetailLevel}</Badge>
                    <Badge>pins {privacy.pinVisibility}</Badge>
                    <Badge>location {privacy.locationMode}</Badge>
                    <Badge tone="accent">rank {privacy.rankVisibility ? 'visible' : 'private'}</Badge>
                  </div>
                </div>
              </Panel>

              <Panel title="Queue Pulse" subtitle="The few items that can actually change state now">
                <div className="space-y-2">
                  {queueItems.slice(0, 4).map((item) => (
                    <RailActivityRow
                      key={`rail-queue-${item.id}`}
                      title={item.title}
                      detail={item.detail}
                      meta={item.tone === 'alert' ? 'attention' : 'route'}
                      accent={item.tone}
                      onClick={() => {
                        item.onSelect?.();
                        openTarget(item.target);
                      }}
                    />
                  ))}
                  {!queueItems.length ? (
                    <div className="xt-mp-empty-block">Queue is stable. No urgent routing changes detected.</div>
                  ) : null}
                </div>
              </Panel>

              <Panel title="Signal Stream" subtitle="Recent movement without leaving the command lane">
                <div className="space-y-2">
                  {feedItems.slice(0, 4).map((item) => (
                    <RailActivityRow
                      key={`rail-feed-${item.id}`}
                      title={item.title}
                      detail={item.detail}
                      meta={formatTimeAgo(item.ts)}
                      onClick={() => {
                        if (item.kind === 'message') {
                          setSurface('SIGNALS');
                          setSignalsMode('COMMS');
                          if (item.threadId) setSelectedThreadId(item.threadId);
                          return;
                        }
                        if (item.kind === 'trace') {
                          setSurface('SIGNALS');
                          setSignalsMode('TRACE');
                          return;
                        }
                        if (item.kind === 'xp') {
                          setSurface('SIGNALS');
                          setSignalsMode('RANK');
                          return;
                        }
                        setSurface('SPACES');
                      }}
                    />
                  ))}
                </div>
              </Panel>

              <Panel title="Risk Watch" subtitle="Pressure that still blocks a clean station">
                <div className="space-y-2">
                  {snapshot.riskFlags.slice(0, 4).map((flag, index) => (
                    <RailActivityRow key={`risk-${index}`} title={flag} detail="Resolve in Ops, People, or Signals depending on the lane." accent="alert" />
                  ))}
                </div>
              </Panel>
            </aside>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color-mix(in_srgb,var(--app-text)_10%,transparent)] bg-[color-mix(in_srgb,var(--app-panel)_92%,transparent)] p-2 backdrop-blur lg:hidden">
          <div className="grid grid-cols-6 gap-2">
            {navItems.map((item) => (
              <button
                key={`mobile-${item.key}`}
                type="button"
                onClick={() => setSurface(item.key)}
                className={`ui-pressable rounded-xl border px-2 py-2 text-[9px] uppercase tracking-[0.14em] ${
                  surface === item.key
                    ? 'border-[color-mix(in_srgb,var(--app-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,var(--app-panel))] text-[var(--app-text)]'
                    : 'border-[color-mix(in_srgb,var(--app-text)_12%,transparent)] bg-[var(--app-panel)] text-[var(--app-muted)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </MultiplayerErrorBoundary>
  );
};
