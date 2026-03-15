import type { Node, Edge } from '@xyflow/react';

// --- Canvas tab ---
export interface CanvasTab {
  id: string;
  label: string;
  emoji: string;
}

// --- Node data types ---
export interface TextNodeData {
  label: string;
  content: string;
  color: string;
  [key: string]: unknown;
}

export interface LinkNodeData {
  label: string;
  url: string;
  description: string;
  color: string;
  [key: string]: unknown;
}

export interface QuestNodeData {
  label: string;
  questId: string;
  status: string;
  questType: string;
  color: string;
  [key: string]: unknown;
}

export interface AutomationNodeData {
  label: string;
  trigger: string;
  action: string;
  enabled: boolean;
  color: string;
  [key: string]: unknown;
}

export interface DuskNodeData {
  label: string;
  prompt: string;
  response: string;
  color: string;
  [key: string]: unknown;
}

export interface ChecklistNodeData {
  label: string;
  items: Array<{ id: string; text: string; done: boolean }>;
  color: string;
  [key: string]: unknown;
}

export interface GroupNodeData {
  label: string;
  color: string;
  [key: string]: unknown;
}

export interface TimerNodeData {
  label: string;
  color: string;
  durationMinutes: number;
  [key: string]: unknown;
}

export interface GoalNodeData {
  label: string;
  color: string;
  current: number;
  target: number;
  unit: string;
  [key: string]: unknown;
}

export interface NotificationNodeData {
  label: string;
  message: string;
  sound: boolean;
  color: string;
  [key: string]: unknown;
}

export interface DateTimeNodeData {
  label: string;
  color: string;
  targetTime: string;
  mode: 'clock' | 'daily' | 'date';
  [key: string]: unknown;
}

export interface ConditionNodeData {
  label: string;
  field: string;
  operator: string;
  value: string;
  color: string;
  [key: string]: unknown;
}

export type CanvasNodeData =
  | TextNodeData
  | LinkNodeData
  | QuestNodeData
  | AutomationNodeData
  | DuskNodeData
  | ChecklistNodeData
  | GroupNodeData
  | TimerNodeData
  | GoalNodeData
  | NotificationNodeData
  | DateTimeNodeData
  | ConditionNodeData;

export type CanvasNode = Node<CanvasNodeData>;
export type CanvasEdge = Edge & { label?: string };

// --- Per-tab state ---
export interface CanvasTabState {
  tab: CanvasTab;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

// --- Full persisted state ---
export interface LabCanvasState {
  activeTabId: string;
  tabs: CanvasTabState[];
}

// --- Colors ---
export const NODE_COLORS = [
  '#1a1a22', // default (neutral dark)
  '#2a1f10', // warm amber/brown
  '#0f1a2a', // deep blue
  '#241028', // rich purple
  '#0f2a18', // forest green
  '#2a1015', // deep red
  '#2a2510', // dark gold
  '#0f2828', // dark teal
] as const;

export const EDGE_COLORS = [
  'var(--app-border)',
  'var(--app-accent)',
  '#74e2b8',
  '#f0c45a',
  '#ff8ea6',
] as const;

// Monotonic counter prevents collisions when multiple IDs are created in the same millisecond
// (e.g. duplicating a checklist node also creates item IDs in the same call stack).
let _idCounter = 0;
export const createId = () => `${Date.now()}-${(_idCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const DEFAULT_TABS: CanvasTab[] = [
  { id: 'main', label: 'Workspace', emoji: '🧠' },
];

export const createDefaultState = (): LabCanvasState => ({
  activeTabId: 'main',
  tabs: [
    {
      tab: DEFAULT_TABS[0],
      nodes: [],
      edges: [],
    },
  ],
});
