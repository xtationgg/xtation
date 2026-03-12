import { Message, Thread } from '../../utils/messagesStorage';
import { Collaboration, LocationShareState, Pin, Player, SavedLocation, XpLog } from '../../types';
import { MultiplayerAuditEntry } from './audit';
import { MultiplayerRouteTarget } from './routes';

export type MultiplayerActivityKind = 'xp' | 'collab' | 'message' | 'trace';

export interface MultiplayerActivityItem {
  id: string;
  kind: MultiplayerActivityKind;
  ts: number;
  title: string;
  detail: string;
  playerId?: string;
  collabId?: string;
  threadId?: string;
}

export interface MultiplayerRoleSlice {
  role: string;
  count: number;
}

export interface MultiplayerTagSlice {
  tag: string;
  count: number;
}

export interface MultiplayerTimezoneSlice {
  label: string;
  count: number;
}

export interface MultiplayerXpLeader {
  player: Player;
  totalXp: number;
}

export interface MultiplayerNearbyPlayer {
  player: Player;
  km: number;
}

export interface MultiplayerRecommendation {
  id: string;
  title: string;
  detail: string;
  target: MultiplayerRouteTarget;
}

export interface MultiplayerSnapshot {
  totalPlayers: number;
  acceptedPlayers: number;
  pendingPlayers: number;
  favoritePlayers: number;
  closeCirclePlayers: number;
  taggedPlayers: number;
  playersWithContact: number;
  playersWithTimezone: number;
  visiblePins: number;
  collaborations: number;
  pendingProposals: number;
  openTasks: number;
  completedTasks: number;
  liveShareCount: number;
  cityShareCount: number;
  savedLocations: number;
  locatedPlayers: number;
  threads: number;
  linkedThreads: number;
  externalThreads: number;
  orphanThreads: number;
  unreadMessages: number;
  auditEntries: number;
  attentionEvents: number;
  readinessScore: number;
  riskFlags: string[];
  roleBreakdown: MultiplayerRoleSlice[];
  tagBreakdown: MultiplayerTagSlice[];
  timezoneBreakdown: MultiplayerTimezoneSlice[];
  xpLeaders: MultiplayerXpLeader[];
  nearbyPlayers: MultiplayerNearbyPlayer[];
  recentActivity: MultiplayerActivityItem[];
  recommendations: MultiplayerRecommendation[];
}

interface BuildMultiplayerSnapshotInput {
  players: Player[];
  visiblePins: Pin[];
  collabs: Collaboration[];
  xpLogs: XpLog[];
  sharingByPlayer: Record<string, LocationShareState>;
  myLocation: { lat: number; lng: number } | null;
  savedLocations: SavedLocation[];
  presenceMode: 'active' | 'hidden';
  threads: Thread[];
  messages: Message[];
  auditEntries: MultiplayerAuditEntry[];
}

const toRad = (value: number) => (value * Math.PI) / 180;

const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const radius = 6371;
  const deltaLat = toRad(b.lat - a.lat);
  const deltaLng = toRad(b.lng - a.lng);
  const latA = toRad(a.lat);
  const latB = toRad(b.lat);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const value = sinLat * sinLat + Math.cos(latA) * Math.cos(latB) * sinLng * sinLng;
  const arc = 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  return radius * arc;
};

const sortObjectEntries = <T extends string>(counts: Record<T, number>) =>
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));

const describeCount = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const beVerb = (count: number) => (count === 1 ? 'is' : 'are');

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const timeZoneLabelForPlayer = (player: Player) => {
  if (player.timeZone) return player.timeZone;
  if (typeof player.utcOffsetMinutes === 'number') {
    const sign = player.utcOffsetMinutes >= 0 ? '+' : '-';
    const absolute = Math.abs(player.utcOffsetMinutes);
    const hours = String(Math.floor(absolute / 60)).padStart(2, '0');
    const minutes = String(absolute % 60).padStart(2, '0');
    return `UTC${sign}${hours}:${minutes}`;
  }
  return 'Unknown';
};

export const buildMultiplayerSnapshot = ({
  players,
  visiblePins,
  collabs,
  xpLogs,
  sharingByPlayer,
  myLocation,
  savedLocations,
  presenceMode,
  threads,
  messages,
  auditEntries,
}: BuildMultiplayerSnapshotInput): MultiplayerSnapshot => {
  const playerById = new Map(players.map((player) => [player.id, player]));
  const acceptedPlayers = players.filter((player) => player.accepted);
  const pendingPlayers = players.length - acceptedPlayers.length;
  const favoritePlayers = players.filter((player) => player.favorite).length;
  const closeCirclePlayers = players.filter((player) => player.permissions?.closeCircle).length;
  const taggedPlayers = players.filter((player) => (player.tags || []).length > 0).length;
  const playersWithContact = players.filter(
    (player) =>
      !!player.email ||
      !!player.phone ||
      Object.values(player.socials || {}).some(Boolean) ||
      (player.links || []).length > 0
  ).length;
  const playersWithTimezone = players.filter(
    (player) => !!player.timeZone || typeof player.utcOffsetMinutes === 'number'
  ).length;
  const pendingProposals = collabs.reduce(
    (sum, collab) => sum + collab.proposals.filter((proposal) => proposal.status === 'pending').length,
    0
  );
  const completedTasks = collabs.reduce(
    (sum, collab) => sum + collab.tasks.filter((task) => task.done).length,
    0
  );
  const openTasks = collabs.reduce(
    (sum, collab) => sum + collab.tasks.filter((task) => !task.done).length,
    0
  );

  let liveShareCount = 0;
  let cityShareCount = 0;
  Object.values(sharingByPlayer).forEach((state) => {
    if (state.mode === 'live' && (!state.liveExpiresAt || state.liveExpiresAt > Date.now())) {
      liveShareCount += 1;
      return;
    }
    if (state.mode === 'city') {
      cityShareCount += 1;
    }
  });

  const roleCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  const timezoneCounts: Record<string, number> = {};

  players.forEach((player) => {
    roleCounts[player.role || 'Unknown'] = (roleCounts[player.role || 'Unknown'] || 0) + 1;
    (player.tags || []).forEach((tag) => {
      const normalized = String(tag).trim();
      if (!normalized) return;
      tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
    });

    const zoneLabel = timeZoneLabelForPlayer(player);
    timezoneCounts[zoneLabel] = (timezoneCounts[zoneLabel] || 0) + 1;
  });

  const xpByPlayer = new Map<string, number>();
  xpLogs.forEach((log) => {
    xpByPlayer.set(log.playerId, (xpByPlayer.get(log.playerId) || 0) + log.amount);
  });

  const xpLeaders = players
    .map((player) => ({
      player,
      totalXp: xpByPlayer.get(player.id) || 0,
    }))
    .sort((a, b) => b.totalXp - a.totalXp)
    .slice(0, 5);

  const nearbyPlayers = myLocation
    ? players
        .filter((player) => !!player.location)
        .map((player) => ({
          player,
          km: distanceKm(myLocation, player.location!),
        }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 5)
    : [];

  const unreadMessages = messages.filter((message) => message.from !== 'me' && !message.read).length;
  const linkedThreads = threads.filter((thread) => !!thread.participantId).length;
  const externalThreads = threads.filter((thread) => !thread.participantId).length;
  const orphanThreads = threads.filter(
    (thread) => !!thread.participantId && !playerById.has(thread.participantId)
  ).length;
  const attentionEvents = auditEntries.filter((entry) => entry.severity !== 'info').length;

  const xpActivity: MultiplayerActivityItem[] = xpLogs.slice(0, 10).map((log) => ({
    id: log.id,
    kind: 'xp',
    ts: log.timestamp,
    title: `${log.amount >= 0 ? '+' : ''}${log.amount} XP`,
    detail: `${playerById.get(log.playerId)?.name || 'Unknown'}${log.tag ? ` • ${log.tag}` : ''}`,
    playerId: log.playerId,
  }));

  const collabActivity: MultiplayerActivityItem[] = collabs.flatMap((collab) =>
    collab.activity.slice(0, 10).map((activity) => ({
      id: activity.id,
      kind: 'collab',
      ts: activity.ts,
      title: collab.title,
      detail: activity.summary,
      playerId: activity.actorId,
      collabId: collab.id,
    }))
  );

  const threadById = new Map(threads.map((thread) => [thread.id, thread]));
  const messageActivity: MultiplayerActivityItem[] = messages.slice(0, 10).map((message) => {
    const thread = threadById.get(message.threadId);
    const player = message.from === 'me' ? thread?.participantId && playerById.get(thread.participantId) : playerById.get(message.from);
    return {
      id: message.id,
      kind: 'message',
      ts: message.ts,
      title: thread?.title || 'Direct Message',
      detail: `${player?.name || (message.from === 'me' ? 'You' : 'Unknown')} • ${message.text.slice(0, 56) || 'Message update'}`,
      playerId: thread?.participantId,
      threadId: message.threadId,
    };
  });

  const traceActivity: MultiplayerActivityItem[] = auditEntries.slice(0, 10).map((entry) => ({
    id: entry.id,
    kind: 'trace',
    ts: entry.ts,
    title: entry.title,
    detail: entry.detail,
    playerId: entry.targetId && playerById.has(entry.targetId) ? entry.targetId : entry.actorId,
  }));

  const recentActivity = [...xpActivity, ...collabActivity, ...messageActivity, ...traceActivity]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 14);

  const riskFlags: string[] = [];
  if (presenceMode === 'hidden') {
    riskFlags.push('Presence is hidden. Squad activity is intentionally obscured.');
  }
  if (!myLocation) {
    riskFlags.push('Your location is not set. Nearby and route-aware tools are limited.');
  }
  if (!visiblePins.length) {
    riskFlags.push('No visible pins are available for this viewer profile.');
  }
  if (!savedLocations.length) {
    riskFlags.push('No saved locations yet. Earth tools have no persistent bookmarks.');
  }
  if (!collabs.length) {
    riskFlags.push('No collaboration spaces exist yet.');
  }
  if (pendingPlayers > 0) {
    riskFlags.push(`${pendingPlayers} player invite${pendingPlayers === 1 ? '' : 's'} still pending acceptance.`);
  }
  if (pendingProposals > 0) {
    riskFlags.push(`${pendingProposals} collaboration proposal${pendingProposals === 1 ? '' : 's'} awaiting review.`);
  }
  if (!threads.length) {
    riskFlags.push('No direct message threads exist yet. Multiplayer coordination is isolated from chat.');
  }
  if (orphanThreads > 0) {
    riskFlags.push(
      `${describeCount(orphanThreads, 'message thread')} ${orphanThreads === 1 ? 'no longer maps' : 'no longer map'} to an active player.`
    );
  }
  if (attentionEvents > 0) {
    riskFlags.push(`${describeCount(attentionEvents, 'operator trace event')} ${attentionEvents === 1 ? 'needs' : 'need'} review.`);
  }

  const recommendations: MultiplayerRecommendation[] = [];
  if (pendingPlayers > 0) {
    recommendations.push({
      id: 'pending-invites',
      title: 'Resolve pending squad invites',
      detail: `${describeCount(pendingPlayers, 'player invitation')} ${beVerb(pendingPlayers)} still waiting for acceptance.`,
      target: 'SQUAD',
    });
  }
  if (!myLocation) {
    recommendations.push({
      id: 'set-location',
      title: 'Set your map position',
      detail: 'Earth tools cannot generate nearby intelligence until your own location is established.',
      target: 'EARTH',
    });
  }
  if (!visiblePins.length) {
    recommendations.push({
      id: 'seed-pins',
      title: 'Seed the earth layer with visible pins',
      detail: 'There are no visible tactical pins for the current viewer perspective.',
      target: 'EARTH',
    });
  }
  if (pendingProposals > 0) {
    recommendations.push({
      id: 'review-proposals',
      title: 'Review pending collaboration proposals',
      detail: `${describeCount(pendingProposals, 'proposal')} ${beVerb(pendingProposals)} queued inside collaboration spaces.`,
      target: 'COLLAB',
    });
  }
  if (!xpLogs.length) {
    recommendations.push({
      id: 'seed-rank',
      title: 'Create XP activity',
      detail: 'Rank boards are empty until the squad generates multiplayer XP logs.',
      target: 'RANK',
    });
  }
  if (presenceMode === 'hidden') {
    recommendations.push({
      id: 'presence-hidden',
      title: 'Review hidden presence mode',
      detail: 'The network is currently being observed in hidden presence mode, which reduces social visibility.',
      target: 'OPS',
    });
  }
  if (!savedLocations.length) {
    recommendations.push({
      id: 'save-places',
      title: 'Create saved locations',
      detail: 'Persistent place bookmarks make the earth layer much more useful for repeat operations.',
      target: 'EARTH',
    });
  }
  if (!threads.length) {
    recommendations.push({
      id: 'seed-comms',
      title: 'Open your first squad thread',
      detail: 'The communications layer is empty. Seed direct message lines for coordination and planning.',
      target: 'COMMS',
    });
  }
  if (players.some((player) => !(player.tags || []).length || (!player.email && !player.phone))) {
    recommendations.push({
      id: 'network-coverage',
      title: 'Strengthen network coverage',
      detail: 'Some players are missing tags or contact data, which weakens topology and routing.',
      target: 'NETWORK',
    });
  }
  if (attentionEvents > 0) {
    recommendations.push({
      id: 'trace-review',
      title: 'Review operator trace events',
      detail: `${attentionEvents} multiplayer action${attentionEvents === 1 ? '' : 's'} were flagged for attention inside the trace log.`,
      target: 'TRACE',
    });
  }

  const readinessRaw =
    (acceptedPlayers.length > 0 ? 14 : 0) +
    clamp(visiblePins.length * 5, 0, 15) +
    clamp(collabs.length * 8, 0, 16) +
    clamp(savedLocations.length * 4, 0, 12) +
    clamp(recentActivity.length * 1.5, 0, 12) +
    clamp(threads.length * 4, 0, 12) +
    clamp((taggedPlayers / Math.max(players.length, 1)) * 8, 0, 8) +
    clamp((playersWithContact / Math.max(players.length, 1)) * 6, 0, 6) +
    (myLocation ? 7 : 0) +
    (liveShareCount > 0 || cityShareCount > 0 ? 8 : 0);

  return {
    totalPlayers: players.length,
    acceptedPlayers: acceptedPlayers.length,
    pendingPlayers,
    favoritePlayers,
    closeCirclePlayers,
    taggedPlayers,
    playersWithContact,
    playersWithTimezone,
    visiblePins: visiblePins.length,
    collaborations: collabs.length,
    pendingProposals,
    openTasks,
    completedTasks,
    liveShareCount,
    cityShareCount,
    savedLocations: savedLocations.length,
    locatedPlayers: players.filter((player) => !!player.location).length,
    threads: threads.length,
    linkedThreads,
    externalThreads,
    orphanThreads,
    unreadMessages,
    auditEntries: auditEntries.length,
    attentionEvents,
    readinessScore: clamp(Math.round(readinessRaw), 0, 100),
    riskFlags,
    roleBreakdown: sortObjectEntries(roleCounts)
      .slice(0, 6)
      .map(({ key, count }) => ({ role: key, count })),
    tagBreakdown: sortObjectEntries(tagCounts)
      .slice(0, 8)
      .map(({ key, count }) => ({ tag: key, count })),
    timezoneBreakdown: sortObjectEntries(timezoneCounts)
      .slice(0, 6)
      .map(({ key, count }) => ({ label: key, count })),
    xpLeaders,
    nearbyPlayers,
    recentActivity,
    recommendations,
  };
};
