export type XPMode = 'Easy' | 'Medium' | 'Hard' | 'Extreme';

export type XPSessionStatus = 'running' | 'completed' | 'canceled';
export type XPSessionImpact = 'normal' | 'medium' | 'hard';
export type XPSessionSource = 'timer' | 'manual' | 'challenge' | 'import';
export type XPCompletionSource = 'manual_done' | 'retro' | 'session';
export type XPTaskEventType =
  | 'created'
  | 'scheduled'
  | 'completed'
  | 'retro'
  | 'archived'
  | 'unarchived';

export interface XPSession {
  id: string;
  taskId?: string;
  title: string;
  tag: string;
  source: XPSessionSource;
  linkedTaskIds: string[];
  linkedChallengeId?: string;
  startAt: number;
  endAt: number;
  // Source of truth for session timing.
  durationMs: number;
  // Persisted base tracked time, used with runningStartedAt for live display.
  accumulatedMs: number;
  // Non-null only while running.
  runningStartedAt: number | null;
  // Backward-compatible derived field (floor(durationMs/60000)).
  durationMinutes: number;
  status: XPSessionStatus;
  impactRating: XPSessionImpact;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type TaskPriority = 'normal' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'active' | 'done' | 'dropped';

export interface Task {
  id: string;
  title: string;
  details: string;
  category?: string;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt?: number;
  completedDateKey?: string;
  archivedAt?: number;
  scheduledAt?: number;
  estimatedMinutes?: number;
  // Backward-compatible field used by existing UI controls.
  estimatedXP?: number;
  ruleType?: 'countdown' | 'anytime' | 'scheduled';
  countdownMin?: number;
  linkedSessionIds: string[];
  notes?: string;
  icon?: 'sword' | 'shield' | 'star' | 'zap' | 'flag';
  visibility?: 'private' | 'circles' | 'community';
  tags?: string[];
  circleIds?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface XPCompletion {
  id: string;
  taskId: string;
  createdAt: number;
  dateKey: string;
  note?: string;
  minutes: number;
  source: XPCompletionSource;
}

export interface XPTaskEvent {
  id: string;
  taskId: string;
  type: XPTaskEventType;
  createdAt: number;
  dateKey: string;
  minutes?: number;
  note?: string;
  source?: string;
}

export interface XPManualLog {
  id: string;
  taskId?: string;
  createdAt: number;
  dateKey: string;
  minutes: number;
  note?: string;
  tag?: string;
}

export type XPDayActivityKind = 'session' | 'completion' | 'manual' | 'created';

export interface XPDayActivityItem {
  kind: XPDayActivityKind;
  id: string;
  taskId?: string;
  dateKey: string;
  minutes: number;
  createdAt: number;
  statusLabel: string;
  title: string;
  note?: string;
  source?: string;
}

/** Display adapter alias for XPDayActivityItem — no DB schema change. */
export type Signal = XPDayActivityItem;

export interface XPDayActivityGroup {
  key: string;
  taskId?: string;
  dateKey: string;
  title: string;
  totalMinutes: number;
  latestAt: number;
  latestStatusLabel: string;
  hasCompletion: boolean;
  hasSession: boolean;
  hasRetro: boolean;
  hasCreated: boolean;
  hasRunning: boolean;
  entries: XPDayActivityItem[];
  archivedAt?: number;
}

export type ChallengeMode = 'solo' | 'multiplayer';
export type ChallengeStatus = 'draft' | 'queued' | 'active' | 'ended' | 'canceled';
export type ChallengePrivacy = 'public' | 'private' | 'friends';
export type ChallengeTimeType = 'countdown' | 'static' | 'scheduled';

export interface ChallengeRules {
  timeType: ChallengeTimeType;
  durationMinutes?: number;
  scheduledAt?: number;
}

export interface Challenge {
  id: string;
  mode: ChallengeMode;
  name: string;
  details: string;
  rules: ChallengeRules;
  privacy: ChallengePrivacy;
  status: ChallengeStatus;
  linkedSessionId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface XPDayConfig {
  dateKey: string;
  mode: XPMode;
  targetXP: number;
}

export interface XPSettings {
  scheduledPromptQuiet: boolean;
}

export interface XPLedgerState {
  tasks: Task[];
  sessions: XPSession[];
  completions: XPCompletion[];
  manualLogs: XPManualLog[];
  taskEvents: XPTaskEvent[];
  challenges: Challenge[];
  dayConfigs: Record<string, XPDayConfig>;
  settings: XPSettings;
  legacyXP: number;
}

export interface XPStats {
  todayEarnedXP: number;
  todayTargetXP: number;
  todayRawXP: number;
  todayRemainingXP: number;
  todayPercent: number;
  overcapPercent: number;
  evaluationLabel: XPMode;
  progressPct: number;
  rankTier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  totalEarnedXP: number;
  dailyEvaluation: string;
}
