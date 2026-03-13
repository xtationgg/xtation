export type XPMode = 'Easy' | 'Medium' | 'Hard' | 'Extreme';

// ─── Xtation Core Engine types ────────────────────────────────────────────────
export type QuestType = 'instant' | 'session' | 'scheduled';
export type QuestLevel = 1 | 2 | 3 | 4;
export type SelfTreeBranch =
  | 'Knowledge'
  | 'Creation'
  | 'Systems'
  | 'Communication'
  | 'Physical'
  | 'Inner';

export type XPSessionStatus = 'running' | 'completed' | 'paused' | 'canceled';
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
export type TaskStatus = 'todo' | 'active' | 'paused' | 'done' | 'dropped';

// ─── Project ──────────────────────────────────────────────────────────────────
export type ProjectType = 'Learning' | 'Build' | 'Business' | 'Health' | 'Personal';
export type ProjectStatus = 'Draft' | 'Active' | 'OnHold' | 'Completed' | 'Archived';

export interface Project {
  id: string;
  title: string;
  description?: string;
  type: ProjectType;
  level: QuestLevel;
  status: ProjectStatus;
  dueDate?: number;
  selfTreePrimary: SelfTreeBranch;
  selfTreeSecondary?: SelfTreeBranch;
  createdAt: number;
  updatedAt: number;
}

// ─── Milestone ────────────────────────────────────────────────────────────────
export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  order: number;
  rewardXP?: number;
  isCompleted: boolean;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ─── Self Tree ────────────────────────────────────────────────────────────────
export interface SelfTreeNode {
  id: string;
  parentId?: string;
  rootBranch: SelfTreeBranch;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

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
  // ─── Xtation Core Engine fields ───────────────────────────────────────────
  /** Execution style: instant task, timed session, or pre-scheduled slot. */
  questType?: QuestType;
  /** Importance/complexity level (L1–L4). Influences XP multiplier. */
  level?: QuestLevel;
  /** Primary Self Tree branch this quest develops. */
  selfTreePrimary?: SelfTreeBranch;
  /** Optional secondary Self Tree branch. */
  selfTreeSecondary?: SelfTreeBranch;
  /** Parent project this quest belongs to (optional). */
  projectId?: string;
  /** Timestamp when the quest was first activated. */
  startedAt?: number;
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
  // ─── Phase 2: Xtation Core Engine foundations ────────────────────────────
  projects: Project[];
  milestones: Milestone[];
  selfTreeNodes: SelfTreeNode[];
  // ─── Phase 8: Inventory Data Model ───────────────────────────────────────
  inventorySlots: InventorySlot[];
}

/** Detailed XP breakdown for a completed quest. */
export interface XPBreakdown {
  /** Minutes-based XP from linked sessions (session quests). */
  sessionXP: number;
  /** Bonus XP earned from deep focus sessions. */
  deepBonus: number;
  /** Base XP for instant quest completion (0 for session quests). */
  instantBaseXP: number;
  /** XP from completed steps, capped by quest level. */
  stepXP: number;
  /** Flat completion bonus scaled by level multiplier. */
  completionBonus: number;
  /** Bonus for completing on or near schedule. */
  scheduleBonus: number;
  /** Sum of all components. */
  total: number;
}

// ─── Phase 5: Momentum / Streak System ───────────────────────────────────────
export interface MomentumState {
  /** Consecutive active days ending at today. */
  currentStreak: number;
  /** All-time longest streak. */
  longestStreak: number;
  /** Most recent day with any XP activity (dateKey). */
  lastActiveDateKey: string;
  /** Active days in the current ISO week (Mon–Sun). */
  weeklyActiveDays: number;
  /** Current ISO week identifier, e.g. '2026-W10'. */
  weekKey: string;
  /** Multiplier applied to today's XP based on streak. */
  streakMultiplier: number;
  /** Flat weekly bonus XP for the current week (earned at 3/5/7 active days). */
  weeklyBonus: number;
}

// ─── Phase 8: Inventory Data Model ────────────────────────────────────────────
export type InventoryCategory = 'OUTFIT' | 'GEAR' | 'VEHICLE' | 'TOOLS';

export interface InventorySlot {
  id: string;
  category: InventoryCategory;
  name: string;
  details?: string;
  importance?: 'low' | 'medium' | 'high' | 'critical';
  /** Reference to a Supabase user_files row (optional). */
  fileId?: string;
  /** Self Tree branch this item belongs to — connects inventory to identity system. */
  selfTreeBranch?: SelfTreeBranch;
  /** Lab project IDs this item is linked to — same pattern as LabNote.linkedProjectIds. */
  linkedProjectIds?: string[];
  /** Soft-delete timestamp. Set to archive, clear to restore, null means active. */
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
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
  /** Permanent player level derived from totalEarnedXP using curve 100 × N^1.35. */
  playerLevel: number;
  /** Momentum / streak state derived from ledger data. */
  momentum: MomentumState;
}
