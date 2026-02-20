export type ChallengeWidgetState =
  | 'collapsed'
  | 'menu'
  | 'solo'
  | 'multiplayer'
  | 'explore'
  | 'runningSolo'
  | 'runningMulti';

export type TaskPriority = 'Normal' | 'High' | 'Urgent';
export type TaskRuleType = 'countdown' | 'anytime' | 'scheduled';

export interface SoloTask {
  id: string;
  title: string;
  notes: string;
  priority: TaskPriority;
  ruleType: TaskRuleType;
  countdownMin?: number;
  scheduledAt?: string;
  completed?: boolean;
}

export type MultiplayerVisibility = 'public' | 'private';
export type MultiplayerTimeType = 'countdown' | 'period';

export interface MultiplayerDraft {
  name: string;
  rules: string;
  timeType: MultiplayerTimeType;
  durationMin: number;
  visibility: MultiplayerVisibility;
  inviteFriendIds: string[];
}

export interface FriendOption {
  id: string;
  name: string;
}

export type ExploreScope = 'public' | 'friends';
export type ExploreRuleType = 'countdown' | 'period' | 'static' | 'scheduled';

export interface ExploreFilters {
  scope: ExploreScope;
  country: string;
  nearMe: boolean;
  ruleType: ExploreRuleType | 'all';
}

export interface ExploreChallenge {
  id: string;
  name: string;
  creator: string;
  ruleSummary: string;
  country: string;
  scope: ExploreScope;
  ruleType: ExploreRuleType;
}

export interface MultiplayerMessage {
  id: string;
  from: string;
  text: string;
  ts: number;
}

export interface RunningConfig {
  title: string;
  mode: 'up' | 'down';
  seconds: number;
  scheduledAt?: string;
  afterStartMode?: 'up' | 'down';
  afterStartSeconds?: number;
  label?: string;
}
