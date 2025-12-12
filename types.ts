
export enum ClientView {
  HOME = 'HOME',
  TFT = 'EARTH',
  MULTIPLAYER = 'MULTIPLAYER',
  PROFILE = 'PROFILE',
  INVENTORY = 'INVENTORY', // Renamed from COLLECTION
  LOOT = 'LOOT',
  STORE = 'STORE',
  SETTINGS = 'SETTINGS',
  LOBBY = 'LOBBY',
  CHAMP_SELECT = 'CHAMP_SELECT',
  MATCH_FOUND = 'MATCH_FOUND'
}

export interface Friend {
  id: string;
  name: string;
  status: 'online' | 'mobile' | 'offline' | 'in-game';
  statusMessage?: string;
  iconId: number;
}

export interface Champion {
  id: string;
  name: string;
  role: string[];
  image: string;
}

export interface NewsItem {
  id: string;
  title: string;
  category: string;
  image: string;
  description: string;
}

export interface MatchHistoryItem {
  id: string;
  champion: string;
  result: 'VICTORY' | 'DEFEAT';
  kda: string;
  mode: string;
  date: string;
}

export enum Priority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export interface Mission {
  id: string;
  title: string;
  priority: Priority;
  completed: boolean;
  createdAt: number; // timestamp
  completedAt?: number; // timestamp
  deadline: number; // timestamp
  icon: 'sword' | 'shield' | 'star' | 'zap' | 'flag';
  xp: number;
}

export type RewardAnimation = 'CYBER_PULSE' | 'ORBITAL_STRIKE' | 'GLITCH_STORM' | 'GOLDEN_HEX' | 'NEON_BURST' | 'CUSTOM';
export type RewardSound = 'LEVEL_UP' | 'TECH_POWER' | 'ALARM' | 'CHIME' | 'BASS_DROP' | 'CUSTOM';

export interface RewardConfig {
  level: number;
  threshold: number;
  animation: RewardAnimation;
  sound: RewardSound;
  customVisualUrl?: string;
  customVisualType?: 'image' | 'video';
  customSoundUrl?: string;
}

// Inventory Types
export type InventoryCategory = 'OUTFIT' | 'GEAR' | 'VEHICLE' | 'TOOLS';

export interface InventoryItem {
  id: string;
  category: InventoryCategory;
  mediaUrl?: string;
  mediaType: 'image' | 'video' | 'embed' | 'model';
  name: string;
}

// Multiplayer / Social
export type PlayerRole = 'Duelist' | 'Support' | 'Strategist' | 'Recon' | 'Operator' | string;

export interface Permissions {
  profileLevel: 'basic' | 'details';
  location: 'off' | 'city' | 'live';
  pinVisibility: 'none' | 'close' | 'specific';
  rankVisibility: boolean;
  appearsInRank: boolean;
  closeCircle: boolean;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  birthday?: string;
  gender?: 'Male' | 'Female' | 'Other' | '';
  email?: string;
  phone?: string;
  socials?: Partial<Record<'instagram' | 'linkedin' | 'twitter' | 'discord', string>>;
  avatar?: string;
  notes?: string;
  permissions: Permissions;
  accepted: boolean;
}

export interface Pin {
  id: string;
  title: string;
  note?: string;
  lat: number;
  lng: number;
  scope: 'private' | 'close' | 'specific';
  sharedWith?: string[];
  createdBy: string;
}

export interface LocationShare {
  status: 'off' | 'city' | 'live';
  expiresAt?: number | null;
}

export interface CollaborationTask {
  id: string;
  title: string;
  done: boolean;
}

export interface CollaborationProposal {
  id: string;
  type: 'task' | 'goal' | 'pin';
  payload: any;
  createdBy: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
}

export interface Collaboration {
  id: string;
  title: string;
  goal: string;
  members: string[];
  tasks: CollaborationTask[];
  activity: { id: string; action: string; actorId: string; summary: string; ts: number }[];
  proposals: CollaborationProposal[];
}

export interface XpLog {
  id: string;
  playerId: string;
  amount: number;
  timestamp: number;
  tag?: string;
  note?: string;
}

export type LocationMode = 'off' | 'city' | 'live';

export interface LocationShareState {
  mode: LocationMode;
  liveExpiresAt?: number | null;
  lastUpdatedAt?: number | null;
  lat?: number;
  lng?: number;
  error?: string | null;
}
