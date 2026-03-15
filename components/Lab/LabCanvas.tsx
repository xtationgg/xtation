import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  SelectionMode,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  type EdgeProps,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  ReactFlowProvider,
  ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  FileText,
  Link2,
  Target,
  Workflow,
  CheckSquare,
  Group,
  Plus,
  X,
  Trash2,
  Copy,
  Undo2,
  Redo2,
  Check,
  Timer,
  Calendar,
  Flame,
  Search,
  Command,
  Maximize,
  Eye,
  Download,
  Upload,
  TrendingUp,
  Bell,
  Clock,
  LayoutGrid,
  GitBranch,
  Bookmark,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../src/auth/AuthProvider';
import { readUserScopedJSON, writeUserScopedJSON } from '../../src/lib/userScopedStorage';
import { logEvent } from '../../src/lab/eventLog';
import { resolveWireActions, executeWireAction } from '../../src/lab/wireEngine';
import { openPlayNavigation } from '../../src/play/bridge';
import { openDuskBrief } from '../../src/dusk/bridge';
import { TextNode } from './nodes/TextNode';
import { LinkNode } from './nodes/LinkNode';
import { QuestNode } from './nodes/QuestNode';
import { AutomationNode } from './nodes/AutomationNode';
import { ChecklistNode } from './nodes/ChecklistNode';
import { GroupNode, GROUP_COLORS } from './nodes/GroupNode';
import { TimerNode } from './nodes/TimerNode';
import { TodayNode } from './nodes/TodayNode';
import { StreakNode } from './nodes/StreakNode';
import { GoalNode } from './nodes/GoalNode';
import { NotificationNode } from './nodes/NotificationNode';
import { DateTimeNode } from './nodes/DateTimeNode';
import { ConditionNode } from './nodes/ConditionNode';
import type {
  CanvasNode,
  CanvasEdge,
  CanvasTabState,
  LabCanvasState,
  TextNodeData,
  LinkNodeData,
  QuestNodeData,
  AutomationNodeData,
  ChecklistNodeData,
  GroupNodeData,
  TimerNodeData,
  GoalNodeData,
  NotificationNodeData,
  DateTimeNodeData,
  ConditionNodeData,
} from './canvasTypes';
import { createId, createDefaultState, NODE_COLORS } from './canvasTypes';

const STORAGE_KEY = 'xtationLabCanvas';
const MAX_HISTORY = 50;
const SAVE_DEBOUNCE_MS = 600;

const nodeTypes = {
  text: TextNode,
  link: LinkNode,
  quest: QuestNode,
  automation: AutomationNode,
  checklist: ChecklistNode,
  group: GroupNode,
  timer: TimerNode,
  today: TodayNode,
  streak: StreakNode,
  goal: GoalNode,
  notification: NotificationNode,
  datetime: DateTimeNode,
  condition: ConditionNode,
};

const NODE_ADD_ITEMS = [
  { type: 'text', label: 'Text', icon: FileText },
  { type: 'link', label: 'Link', icon: Link2 },
  { type: 'quest', label: 'Quest', icon: Target },
  { type: 'automation', label: 'Circuit', icon: Workflow },
  { type: 'checklist', label: 'Checklist', icon: CheckSquare },
  { type: 'group', label: 'Group', icon: Group },
  { type: 'timer', label: 'Timer', icon: Timer },
  { type: 'today', label: 'Today', icon: Calendar },
  { type: 'streak', label: 'Streak', icon: Flame },
  { type: 'goal', label: 'Goal', icon: TrendingUp },
  { type: 'notification', label: 'Alert', icon: Bell },
  { type: 'datetime', label: 'Clock', icon: Clock },
  { type: 'condition', label: 'Condition', icon: GitBranch },
] as const;

const defaultNodeData: Record<string, () => Record<string, unknown>> = {
  text: () => ({ label: 'New note', content: '', color: '#1a1a1e' }),
  link: () => ({ label: 'New link', url: '', description: '', color: '#1a1a1e' }),
  quest: () => ({ label: 'New quest', questId: '', status: 'todo', questType: 'session', color: '#1a1a1e' }),
  automation: () => ({ label: 'New circuit', trigger: '', action: '', enabled: false, color: '#1a1a1e' }),
  checklist: () => ({ label: 'Checklist', items: [{ id: createId(), text: 'First item', done: false }], color: '#1a1a1e' }),
  group: () => ({ label: 'Group', color: 'rgba(255,255,255,0.04)' }),
  timer: () => ({ label: 'Timer', durationMinutes: 25, color: '#16161c' }),
  today: () => ({ label: 'Today', color: '#16161c' }),
  streak: () => ({ label: 'Streak', color: '#16161c' }),
  goal: () => ({ label: 'Goal', current: 0, target: 10, unit: 'tasks', color: '#16161c' }),
  notification: () => ({ label: 'Alert', message: '', sound: true, color: '#1a1a22' }),
  datetime: () => ({ label: 'Clock', targetTime: '', mode: 'clock', color: '#1a1a22' }),
  condition: () => ({ label: 'Condition', field: '', operator: '', value: '', color: '#1a1a22' }),
};

// Hoisted constants (avoid new object refs each render) [Improvement #9]
const DEFAULT_EDGE_OPTIONS = {
  style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1.5 },
  type: 'labeled' as const,
};
const PRO_OPTIONS = { hideAttribution: true };

// --- Labeled edge (memoized) [Improvement #2] ---
const LabeledEdge = memo(function LabeledEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, markerEnd,
}: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const edgeLabel = (data as Record<string, unknown>)?.label as string | undefined;
  return (
    <>
      {/* Wide invisible hit area for easier clicking/grabbing */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="20"
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {/* Glow effects — hidden by default, visible in sandbox */}
      <defs>
        <clipPath id={`clip-${id}`}>
          <path d={path} strokeWidth="24" stroke="white" fill="none" strokeLinecap="round" />
        </clipPath>
        <radialGradient id={`trav-grad-${id}`}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="30%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`junc-grad-${id}`}>
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="25%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Junction glow at endpoints */}
      <circle cx={sourceX} cy={sourceY} r="16" className="xt-glow-junction" fill={`url(#junc-grad-${id})`} />
      <circle cx={targetX} cy={targetY} r="16" className="xt-glow-junction" fill={`url(#junc-grad-${id})`} />

      {/* Traveling orb — clipped to wire stroke so it stays inside the line */}
      <g clipPath={`url(#clip-${id})`}>
        <circle r="12" className="xt-glow-traveler" fill={`url(#trav-grad-${id})`}>
          <animateMotion dur="4s" repeatCount="indefinite" path={path} />
        </circle>
      </g>
      {edgeLabel ? (
        <EdgeLabelRenderer>
          <div
            className="xt-canvas-edge-label"
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}
          >
            {edgeLabel}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});

const edgeTypes = { labeled: LabeledEdge };

// --- History entry ---
interface HistoryEntry {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const LabCanvasInner: React.FC = () => {
  const { user } = useAuth();
  const scopeId = user?.id || 'anon';
  const reactFlowInstance = useReactFlow();

  // --- Load state ---
  const [state, setState] = useState<LabCanvasState>(() => {
    const stored = readUserScopedJSON<LabCanvasState | null>(STORAGE_KEY, null, scopeId);
    return stored && stored.tabs?.length ? stored : createDefaultState();
  });

  const activeTab = state.tabs.find((t) => t.tab.id === state.activeTabId) || state.tabs[0];
  const nodes = activeTab?.nodes || [];
  const edges = activeTab?.edges || [];

  // --- Log canvas opened on mount ---
  useEffect(() => { logEvent(scopeId, 'canvas:opened'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Debounced persistence [Improvement #4] ---
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(() => {
      writeUserScopedJSON(STORAGE_KEY, state, scopeId);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, SAVE_DEBOUNCE_MS);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [state, scopeId]);

  // Flush on unmount/page close
  // BUG FIX: Use a ref to capture latest state so the listener doesn't re-register on every state change
  // and doesn't capture a stale closure.
  const stateRef = useRef(state);
  stateRef.current = state;
  const scopeIdRef = useRef(scopeId);
  scopeIdRef.current = scopeId;

  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        writeUserScopedJSON(STORAGE_KEY, stateRef.current, scopeIdRef.current);
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => { window.removeEventListener('beforeunload', flush); flush(); };
  }, []); // mount-only — reads from refs

  // --- Undo/redo with refs [Improvement #3 + #12] ---
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const undoStackRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);
  const [historyLen, setHistoryLen] = useState({ undo: 0, redo: 0 });
  const skipHistoryRef = useRef(false);

  const pushHistory = useCallback(() => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return; }
    undoStackRef.current = [...undoStackRef.current.slice(-MAX_HISTORY), { nodes: nodesRef.current, edges: edgesRef.current }];
    redoStackRef.current = [];
    setHistoryLen({ undo: undoStackRef.current.length, redo: 0 });
  }, []); // stable — reads from refs

  // --- Clipboard for copy/paste ---
  const clipboardRef = useRef<{ nodes: CanvasNode[]; edges: CanvasEdge[] } | null>(null);

  // --- Focus mode ---
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  // --- Viewport Bookmarks ---
  const [viewBookmarks, setViewBookmarks] = useState<Array<{ id: string; label: string; x: number; y: number; zoom: number }>>([]);

  // --- Reading Mode (Cmd+E) ---
  const [readingMode, setReadingMode] = useState(false);

  // --- Selected state ---
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const selectedEdge = useMemo(() => edges.find((e) => e.id === selectedEdgeId) ?? null, [edges, selectedEdgeId]);

  // --- Focus mode: compute visible node IDs ---
  const focusVisibleIds = useMemo(() => {
    if (!focusNodeId) return null;
    const ids = new Set<string>([focusNodeId]);
    for (const e of edges) {
      if (e.source === focusNodeId) ids.add(e.target);
      if (e.target === focusNodeId) ids.add(e.source);
    }
    return ids;
  }, [focusNodeId, edges]);

  // searchMatchIds is populated by Canvas Search below (hoisted ref)
  const searchMatchIdsRef = useRef<Set<string>>(new Set());

  const displayNodes = useMemo(() => {
    let result = nodes;
    if (focusVisibleIds) {
      result = result.map(n => focusVisibleIds.has(n.id) ? n : { ...n, style: { ...n.style, opacity: 0.08 } });
    }
    if (searchMatchIdsRef.current.size > 0) {
      result = result.map(n =>
        searchMatchIdsRef.current.has(n.id)
          ? { ...n, className: (n.className ? n.className + ' ' : '') + 'xt-canvas-search-match' }
          : n
      );
    }
    // Apply collapsed class
    result = result.map(n => {
      if ((n.data as any).collapsed) {
        return { ...n, className: `${n.className || ''} xt-canvas-node--collapsed`.trim() };
      }
      return n;
    });
    // Dim disabled nodes
    result = result.map(n => {
      if ((n.data as any).enabled === false) {
        return { ...n, style: { ...n.style, opacity: 0.35 } };
      }
      return n;
    });
    // Stale node detection (14+ days untouched)
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    result = result.map(n => {
      const isStale = (n.data as any).lastInteractedAt && (Date.now() - (n.data as any).lastInteractedAt > fourteenDays);
      if (isStale) {
        return { ...n, className: `${n.className || ''} xt-canvas-node--stale`.trim() };
      }
      return n;
    });
    return result;
  }, [nodes, focusVisibleIds]);

  const displayEdges = useMemo(() => {
    return edges.map(e => {
      // Focus mode dimming
      if (focusVisibleIds && !(focusVisibleIds.has(e.source) && focusVisibleIds.has(e.target))) {
        return { ...e, style: { ...e.style, opacity: 0.08 } };
      }
      // Dashed wires from disabled source nodes
      const sourceNode = nodesRef.current.find(n => n.id === e.source);
      if (sourceNode && (sourceNode.data as any).enabled === false) {
        return { ...e, style: { ...e.style, strokeDasharray: '6 4', opacity: 0.3 } };
      }
      return e;
    });
  }, [edges, focusVisibleIds]);

  // --- Update helpers ---
  const updateActiveTab = useCallback((updater: (tab: CanvasTabState) => CanvasTabState) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.tab.id === prev.activeTabId ? updater(t) : t)),
    }));
  }, []);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    redoStackRef.current = [...redoStackRef.current, { nodes: nodesRef.current, edges: edgesRef.current }];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    skipHistoryRef.current = true;
    updateActiveTab((tab) => ({ ...tab, nodes: prev.nodes, edges: prev.edges }));
    setHistoryLen({ undo: undoStackRef.current.length, redo: redoStackRef.current.length });
  }, [updateActiveTab]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current[redoStackRef.current.length - 1];
    undoStackRef.current = [...undoStackRef.current, { nodes: nodesRef.current, edges: edgesRef.current }];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    skipHistoryRef.current = true;
    updateActiveTab((tab) => ({ ...tab, nodes: next.nodes, edges: next.edges }));
    setHistoryLen({ undo: undoStackRef.current.length, redo: redoStackRef.current.length });
  }, [updateActiveTab]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    const isDrag = changes.some((c) => c.type === 'position' && c.dragging === false);
    const isRemove = changes.some((c) => c.type === 'remove');
    if (isDrag || isRemove) pushHistory();
    // BUG FIX: Clear selectedNodeId if the selected node was removed
    if (isRemove) {
      const removedIds = new Set(changes.filter((c) => c.type === 'remove').map((c) => c.id));
      setSelectedNodeId((prev) => (prev && removedIds.has(prev) ? null : prev));
    }
    updateActiveTab((tab) => ({ ...tab, nodes: applyNodeChanges(changes, tab.nodes) as CanvasNode[] }));
  }, [updateActiveTab, pushHistory]);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    const isRemove = changes.some((c) => c.type === 'remove');
    if (isRemove) pushHistory();
    // BUG FIX: Clear selectedEdgeId if the selected edge was removed
    if (isRemove) {
      const removedIds = new Set(changes.filter((c) => c.type === 'remove').map((c) => c.id));
      setSelectedEdgeId((prev) => (prev && removedIds.has(prev) ? null : prev));
    }
    updateActiveTab((tab) => ({ ...tab, edges: applyEdgeChanges(changes, tab.edges) as CanvasEdge[] }));
  }, [updateActiveTab, pushHistory]);

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    // Prevent self-connections
    if (connection.source === connection.target) return;
    pushHistory();
    updateActiveTab((tab) => ({
      ...tab,
      edges: addEdge({
        ...connection,
        id: createId(),
        type: 'labeled',
        data: { label: '' },
        style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1.5 },
      }, tab.edges) as CanvasEdge[],
    }));
    logEvent(scopeId, 'wire:created');
  }, [updateActiveTab, pushHistory, scopeId]);

  const reconnectingRef = useRef(false);

  const onReconnect = useCallback((oldEdge: any, newConnection: Connection) => {
    reconnectingRef.current = true;
    pushHistory();
    updateActiveTab((tab) => ({
      ...tab,
      edges: tab.edges.map((e) =>
        e.id === oldEdge.id
          ? { ...e, source: newConnection.source!, target: newConnection.target!, sourceHandle: newConnection.sourceHandle, targetHandle: newConnection.targetHandle }
          : e
      ),
    }));
  }, [updateActiveTab, pushHistory]);

  const onReconnectEnd = useCallback((_: MouseEvent | TouchEvent, edge: any) => {
    if (!reconnectingRef.current) {
      // Reconnect was not completed — user dropped on empty space, delete the edge
      pushHistory();
      updateActiveTab((tab) => ({
        ...tab,
        edges: tab.edges.filter((e) => e.id !== edge.id),
      }));
      logEvent(scopeId, 'wire:deleted');
    }
    reconnectingRef.current = false;
  }, [updateActiveTab, pushHistory, scopeId]);

  // BUG FIX: @xyflow/react v12 onNodeClick/onEdgeClick pass base Node/Edge types
  const onNodeClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    logEvent(scopeId, 'node:selected', { nodeId: node.id });
  }, [scopeId]);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: { id: string }) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // --- Add node ---
  const addNode = useCallback((type: string, position?: { x: number; y: number }) => {
    pushHistory();
    const id = createId();
    let pos: { x: number; y: number };
    if (position) {
      pos = position;
    } else {
      const viewport = reactFlowInstance.getViewport();
      const centerX = (-viewport.x + window.innerWidth / 2) / viewport.zoom;
      const centerY = (-viewport.y + window.innerHeight / 2) / viewport.zoom;
      pos = { x: centerX - 100 + Math.random() * 60, y: centerY - 50 + Math.random() * 60 };
    }
    const newNode: CanvasNode = {
      id,
      type,
      position: pos,
      data: { ...defaultNodeData[type](), lastInteractedAt: Date.now() },
      ...(type === 'group' ? { style: { width: 400, height: 300 } } : {}),
    };
    updateActiveTab((tab) => ({ ...tab, nodes: [...tab.nodes, newNode] }));
    setSelectedNodeId(id);
    logEvent(scopeId, 'node:created', { nodeId: id, nodeType: type });
  }, [updateActiveTab, pushHistory, reactFlowInstance, scopeId]);

  // --- Drag-to-place from toolbar ---
  const onCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/xtation-node-type');
    if (!type || !defaultNodeData[type]) return;
    const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode(type, flowPos);
  }, [reactFlowInstance, addNode]);

  // --- Delete (supports multi-select) ---
  const deleteSelectedNodes = useCallback(() => {
    const selectedIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
    if (selectedIds.size === 0 && selectedNodeId) selectedIds.add(selectedNodeId);
    if (selectedIds.size === 0) return;
    pushHistory();
    updateActiveTab(tab => ({
      ...tab,
      nodes: tab.nodes.filter(n => !selectedIds.has(n.id)),
      edges: tab.edges.filter(e => !selectedIds.has(e.source) && !selectedIds.has(e.target)),
    }));
    selectedIds.forEach(nodeId => logEvent(scopeId, 'node:deleted', { nodeId }));
    setSelectedNodeId(null);
  }, [nodes, selectedNodeId, updateActiveTab, pushHistory, scopeId]);

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    pushHistory();
    updateActiveTab((tab) => ({ ...tab, edges: tab.edges.filter((e) => e.id !== selectedEdgeId) }));
    logEvent(scopeId, 'wire:deleted');
    setSelectedEdgeId(null);
  }, [selectedEdgeId, updateActiveTab, pushHistory, scopeId]);

  // --- Duplicate ---
  const duplicateSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    pushHistory();
    const id = createId();
    const dup: CanvasNode = {
      ...selectedNode,
      id,
      position: { x: selectedNode.position.x + 40, y: selectedNode.position.y + 40 },
      data: { ...selectedNode.data, label: `${(selectedNode.data as any).label} (copy)` },
    };
    updateActiveTab((tab) => ({ ...tab, nodes: [...tab.nodes, dup] }));
    setSelectedNodeId(id);
  }, [selectedNode, updateActiveTab, pushHistory]);

  // --- Group selected nodes ---
  const groupSelectedNodes = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) return;
    const padding = 40;
    const minX = Math.min(...selectedNodes.map(n => n.position.x)) - padding;
    const minY = Math.min(...selectedNodes.map(n => n.position.y)) - padding;
    const maxX = Math.max(...selectedNodes.map(n => n.position.x + 220)) + padding;
    const maxY = Math.max(...selectedNodes.map(n => n.position.y + 100)) + padding;
    pushHistory();
    const groupId = createId();
    const groupNode: CanvasNode = {
      id: groupId,
      type: 'group',
      position: { x: minX, y: minY },
      data: { label: 'Group', color: 'rgba(255,255,255,0.04)' },
      style: { width: maxX - minX, height: maxY - minY },
    };
    updateActiveTab(tab => ({
      ...tab,
      nodes: [
        groupNode,
        ...tab.nodes.map(n => {
          if (!selectedNodes.find(s => s.id === n.id)) return n;
          return {
            ...n,
            parentId: groupId,
            position: { x: n.position.x - minX, y: n.position.y - minY },
          };
        }),
      ],
    }));
  }, [nodes, pushHistory, updateActiveTab]);

  // --- Drag-to-create connected node (Feature 1) ---
  const [dragConnectMenu, setDragConnectMenu] = useState<{
    x: number; y: number; flowX: number; flowY: number;
    sourceNodeId: string; sourceHandleId: string | null;
  } | null>(null);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: any) => {
    // Only trigger if the connection was NOT completed (dropped on empty space)
    if (connectionState.isValid) return;

    const clientX = 'changedTouches' in event ? event.changedTouches[0].clientX : (event as MouseEvent).clientX;
    const clientY = 'changedTouches' in event ? event.changedTouches[0].clientY : (event as MouseEvent).clientY;
    const flowPos = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });

    setDragConnectMenu({
      x: clientX,
      y: clientY,
      flowX: flowPos.x,
      flowY: flowPos.y,
      sourceNodeId: connectionState.fromNode?.id,
      sourceHandleId: connectionState.fromHandle?.id ?? null,
    });
  }, [reactFlowInstance]);

  // Dismiss drag-connect menu on click or Escape
  useEffect(() => {
    if (!dragConnectMenu) return;
    const handleClick = () => setDragConnectMenu(null);
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDragConnectMenu(null); };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [dragConnectMenu]);

  // --- Double-click node to jump (Feature 2) ---
  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
    const n = nodes.find(nd => nd.id === node.id);
    if (!n) return;

    if (n.type === 'quest' && (n.data as any).questId) {
      openPlayNavigation({ taskId: (n.data as any).questId, requestedBy: 'lab' });
    } else if (n.type === 'link' && (n.data as any).url) {
      window.open((n.data as any).url, '_blank', 'noopener,noreferrer');
    }
    // For text/checklist/automation — double-click already handles inline editing
  }, [nodes]);

  // --- Export/Import canvas ---
  const exportCanvas = useCallback(() => {
    const data = JSON.stringify({ nodes, edges, tab: activeTab?.tab }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvas-${activeTab?.tab.label || 'export'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, activeTab]);

  const importCanvas = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (revt) => {
        try {
          const data = JSON.parse(revt.target?.result as string);
          if (data.nodes && data.edges) {
            pushHistory();
            updateActiveTab(tab => ({
              ...tab,
              nodes: data.nodes,
              edges: data.edges,
            }));
          }
        } catch {}
      };
      reader.readAsText(file);
    };
    input.click();
  }, [pushHistory, updateActiveTab]);

  // --- Context menu ---
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; flowX: number; flowY: number; nodeId?: string } | null>(null);
  const [colorSubMenuNodeId, setColorSubMenuNodeId] = useState<string | null>(null);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    if (readingMode) return;
    const flowPos = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setContextMenu({ x: event.clientX, y: event.clientY, flowX: flowPos.x, flowY: flowPos.y });
    setColorSubMenuNodeId(null);
  }, [reactFlowInstance, readingMode]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: { id: string }) => {
    event.preventDefault();
    if (readingMode) return;
    const flowPos = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setContextMenu({ x: event.clientX, y: event.clientY, flowX: flowPos.x, flowY: flowPos.y, nodeId: node.id });
    setColorSubMenuNodeId(null);
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, [reactFlowInstance, readingMode]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setColorSubMenuNodeId(null);
  }, []);

  // Double-click on empty canvas to create text node
  const onPaneDoubleClick = useCallback((event: React.MouseEvent) => {
    const flowPos = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNode('text', flowPos);
  }, [reactFlowInstance, addNode]);

  // Duplicate a specific node by id (for context menu)
  const duplicateNodeById = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    pushHistory();
    const id = createId();
    const dup: CanvasNode = {
      ...node,
      id,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: { ...node.data, label: `${(node.data as any).label} (copy)` },
    };
    updateActiveTab((tab) => ({ ...tab, nodes: [...tab.nodes, dup] }));
    setSelectedNodeId(id);
  }, [nodes, updateActiveTab, pushHistory]);

  // Delete a specific node by id (for context menu)
  const deleteNodeById = useCallback((nodeId: string) => {
    pushHistory();
    updateActiveTab((tab) => ({
      ...tab,
      nodes: tab.nodes.filter((n) => n.id !== nodeId),
      edges: tab.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
    setSelectedNodeId((prev) => (prev === nodeId ? null : prev));
  }, [updateActiveTab, pushHistory]);

  // Close context menu on click anywhere or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu]);

  // --- Wire execution engine: listen for wire fire events ---
  useEffect(() => {
    const handleWireFire = (e: Event) => {
      const { sourceNodeId, event } = (e as CustomEvent).detail;
      const actions = resolveWireActions(sourceNodeId, event, nodesRef.current, edgesRef.current);

      for (const action of actions) {
        const targetNode = nodesRef.current.find(n => n.id === action.targetNodeId);
        if (!targetNode) continue;

        const result = executeWireAction(action, targetNode);

        if (result.updatedData) {
          updateActiveTab(tab => ({
            ...tab,
            nodes: tab.nodes.map(n =>
              n.id === action.targetNodeId
                ? { ...n, data: result.updatedData! }
                : n
            ),
          }));
        }

        if (result.sideEffect) {
          result.sideEffect();
        }

        // Log the wire execution
        logEvent(scopeId, 'wire:created', { nodeId: sourceNodeId, metadata: { event, targetId: action.targetNodeId } });
      }

      // After executing actions, check if any target was a condition node
      for (const action of actions) {
        if (action.targetNodeType === 'condition') {
          const condNode = nodesRef.current.find(n => n.id === action.targetNodeId);
          const sourceNode = nodesRef.current.find(n => n.id === sourceNodeId);
          if (condNode && sourceNode) {
            const cd = condNode.data as any;
            const sd = sourceNode.data as any;
            const fieldValue = sd[cd.field];
            let pass = false;
            const numVal = parseFloat(cd.value);
            const numField = parseFloat(fieldValue);
            switch (cd.operator) {
              case '==': pass = String(fieldValue) === cd.value; break;
              case '!=': pass = String(fieldValue) !== cd.value; break;
              case '>': pass = !isNaN(numField) && !isNaN(numVal) && numField > numVal; break;
              case '<': pass = !isNaN(numField) && !isNaN(numVal) && numField < numVal; break;
              case '>=': pass = !isNaN(numField) && !isNaN(numVal) && numField >= numVal; break;
              case '<=': pass = !isNaN(numField) && !isNaN(numVal) && numField <= numVal; break;
            }
            if (pass) {
              // Re-fire from the condition node
              const condActions = resolveWireActions(action.targetNodeId, event, nodesRef.current, edgesRef.current);
              for (const ca of condActions) {
                const tn = nodesRef.current.find(n => n.id === ca.targetNodeId);
                if (!tn) continue;
                const r = executeWireAction(ca, tn);
                if (r.updatedData) {
                  updateActiveTab(t => ({
                    ...t,
                    nodes: t.nodes.map(n => n.id === ca.targetNodeId ? { ...n, data: r.updatedData! } : n),
                  }));
                }
                if (r.sideEffect) r.sideEffect();
              }
            }
          }
        }
      }
    };

    window.addEventListener('xtation:wire:fire', handleWireFire);
    return () => window.removeEventListener('xtation:wire:fire', handleWireFire);
  }, [updateActiveTab, scopeId]);

  // --- Update node data ---
  const updateNodeData = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    updateActiveTab((tab) => ({
      ...tab,
      nodes: tab.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch, lastInteractedAt: Date.now() } } : n)),
    }));
  }, [updateActiveTab]);

  // --- Update edge ---
  const updateEdgeLabel = useCallback((edgeId: string, label: string) => {
    updateActiveTab((tab) => ({
      ...tab,
      edges: tab.edges.map((e) => (e.id === edgeId ? { ...e, data: { ...(e.data || {}), label } } : e)),
    }));
  }, [updateActiveTab]);

  // --- Tab management ---
  const addTab = useCallback(() => {
    const id = createId();
    const newTab: CanvasTabState = {
      tab: { id, label: 'New canvas', emoji: '📋' },
      nodes: [],
      edges: [],
    };
    setState((prev) => ({ ...prev, tabs: [...prev.tabs, newTab], activeTabId: id }));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryLen({ undo: 0, redo: 0 });
    logEvent(scopeId, 'tab:created');
  }, [scopeId]);

  const switchTab = useCallback((tabId: string) => {
    setState((prev) => ({ ...prev, activeTabId: tabId }));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryLen({ undo: 0, redo: 0 });
    logEvent(scopeId, 'tab:switched');
    // BUG FIX: fitView needs to fire after React renders the new tab's nodes
    requestAnimationFrame(() => {
      reactFlowInstance.fitView();
    });
  }, [reactFlowInstance, scopeId]);

  // [Improvement #7] Confirm before deleting tab with nodes
  // BUG FIX: window.confirm must happen OUTSIDE setState (setState must be pure)
  const deleteTab = useCallback((tabId: string) => {
    const tab = state.tabs.find((t) => t.tab.id === tabId);
    if (tab && tab.nodes.length > 0) {
      const ok = window.confirm(`Delete "${tab.tab.label}" and its ${tab.nodes.length} node${tab.nodes.length !== 1 ? 's' : ''}? This cannot be undone.`);
      if (!ok) return;
    }
    setState((prev) => {
      const remaining = prev.tabs.filter((t) => t.tab.id !== tabId);
      if (remaining.length === 0) return prev;
      return {
        ...prev,
        tabs: remaining,
        activeTabId: prev.activeTabId === tabId ? remaining[0].tab.id : prev.activeTabId,
      };
    });
  }, [state.tabs]);

  const renameTab = useCallback((tabId: string, label: string) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.tab.id === tabId ? { ...t, tab: { ...t.tab, label } } : t)),
    }));
  }, []);

  // --- Command Palette (Cmd+K) ---
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteSelectedIdx, setPaletteSelectedIdx] = useState(0);

  interface PaletteResult {
    id: string;
    title: string;
    hint: string;
    icon: LucideIcon;
    action: () => void;
  }

  const paletteResults = useMemo<PaletteResult[]>(() => {
    const q = paletteQuery.toLowerCase().trim();
    const results: PaletteResult[] = [];

    for (const n of nodes) {
      const label = ((n.data as any).label || '') as string;
      const content = ((n.data as any).content || '') as string;
      if (q && (label.toLowerCase().includes(q) || content.toLowerCase().includes(q))) {
        results.push({
          id: `node-${n.id}`,
          title: label || '(untitled)',
          hint: `${(n.type || 'text').toUpperCase()} node`,
          icon: Search,
          action: () => {
            setPaletteOpen(false);
            setSelectedNodeId(n.id);
            setSelectedEdgeId(null);
            reactFlowInstance.setCenter(n.position.x, n.position.y, { zoom: 1.5, duration: 300 });
          },
        });
      }
    }

    const addActions: PaletteResult[] = NODE_ADD_ITEMS.map((item) => ({
      id: `add-${item.type}`,
      title: `Add ${item.label} Node`,
      hint: 'Create a new node',
      icon: item.icon as LucideIcon,
      action: () => { setPaletteOpen(false); addNode(item.type); },
    }));

    const navActions: PaletteResult[] = [
      { id: 'nav-fitview', title: 'Fit View', hint: 'Zoom to fit all nodes', icon: Maximize, action: () => { setPaletteOpen(false); reactFlowInstance.fitView({ duration: 300 }); } },
      { id: 'nav-focus', title: 'Focus Mode', hint: 'Focus on selected node', icon: Eye, action: () => { setPaletteOpen(false); if (selectedNodeId) setFocusNodeId(selectedNodeId); } },
      { id: 'nav-undo', title: 'Undo', hint: 'Undo last action', icon: Undo2, action: () => { setPaletteOpen(false); undo(); } },
      { id: 'nav-redo', title: 'Redo', hint: 'Redo last action', icon: Redo2, action: () => { setPaletteOpen(false); redo(); } },
    ];

    const staticActions = [...addActions, ...navActions];

    if (!q) {
      results.push(...staticActions);
    } else {
      for (const a of staticActions) {
        if (a.title.toLowerCase().includes(q)) results.push(a);
      }
    }

    return results;
  }, [paletteQuery, nodes, addNode, reactFlowInstance, selectedNodeId, undo, redo]);

  useEffect(() => {
    setPaletteSelectedIdx(0);
  }, [paletteResults.length, paletteQuery]);

  const executePaletteResult = useCallback((result: PaletteResult) => {
    result.action();
  }, []);

  const onPaletteKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPaletteSelectedIdx((prev) => Math.min(prev + 1, paletteResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPaletteSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (paletteResults[paletteSelectedIdx]) {
        executePaletteResult(paletteResults[paletteSelectedIdx]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setPaletteOpen(false);
    }
  }, [paletteResults, paletteSelectedIdx, executePaletteResult]);

  // --- Auto-layout (tidy) ---
  const autoLayout = useCallback(() => {
    pushHistory();
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacingX = 300;
    const spacingY = 200;

    updateActiveTab(tab => ({
      ...tab,
      nodes: tab.nodes.map((n, i) => ({
        ...n,
        position: {
          x: (i % cols) * spacingX + 100,
          y: Math.floor(i / cols) * spacingY + 100,
        },
      })),
    }));

    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 100);
  }, [nodes.length, updateActiveTab, pushHistory, reactFlowInstance]);

  // --- Keyboard shortcuts overlay ---
  const [showShortcuts, setShowShortcuts] = useState(false);

  // --- Canvas Search (Cmd+F) ---
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [] as string[];
    const q = searchQuery.toLowerCase().trim();
    return nodes
      .filter((n) => {
        const label = ((n.data as any).label || '') as string;
        const content = ((n.data as any).content || '') as string;
        return label.toLowerCase().includes(q) || content.toLowerCase().includes(q);
      })
      .map((n) => n.id);
  }, [searchQuery, nodes]);

  // Update ref so displayNodes can highlight matches
  searchMatchIdsRef.current = new Set(searchMatches);

  useEffect(() => {
    setSearchMatchIdx(0);
  }, [searchMatches.length, searchQuery]);

  useEffect(() => {
    if (searchMatches.length > 0 && searchMatchIdx < searchMatches.length) {
      const matchId = searchMatches[searchMatchIdx];
      const node = nodes.find((n) => n.id === matchId);
      if (node) {
        reactFlowInstance.setCenter(node.position.x, node.position.y, { zoom: 1.5, duration: 300 });
        setSelectedNodeId(matchId);
      }
    }
  }, [searchMatchIdx, searchMatches]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextSearchMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    setSearchMatchIdx((prev) => (prev + 1) % searchMatches.length);
  }, [searchMatches.length]);

  const prevSearchMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    setSearchMatchIdx((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
  }, [searchMatches.length]);

  const onSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextSearchMatch();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchOpen(false);
      setSearchQuery('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nextSearchMatch();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      prevSearchMatch();
    }
  }, [nextSearchMatch, prevSearchMatch]);

  // --- Keyboard shortcuts (ref-based handler) [Improvement from Agent 2 #9] ---
  const handlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  handlerRef.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

    // Command Palette: Cmd+K
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setPaletteOpen(true);
      setPaletteQuery('');
      return;
    }
    // Canvas Search: Cmd+F
    if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setSearchOpen(true);
      setSearchQuery('');
      return;
    }
    // Reading Mode: Cmd+E
    if (e.key === 'e' && (e.metaKey || e.ctrlKey) && !isInput) {
      e.preventDefault();
      setReadingMode(prev => !prev);
      return;
    }

    // Block editing shortcuts in reading mode
    if (readingMode) return;

    if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
      if (selectedNodeId || nodes.some(n => n.selected)) { e.preventDefault(); deleteSelectedNodes(); }
      else if (selectedEdgeId) { e.preventDefault(); deleteSelectedEdge(); }
    }
    if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !isInput) { e.preventDefault(); undo(); }
    if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey && !isInput) { e.preventDefault(); redo(); }
    if (e.key === 'd' && (e.metaKey || e.ctrlKey) && !isInput && selectedNodeId) { e.preventDefault(); duplicateSelectedNode(); }
    if (e.key === 'g' && (e.metaKey || e.ctrlKey) && !isInput) {
      e.preventDefault();
      groupSelectedNodes();
    }
    // Cmd+A — select all nodes
    if (e.key === 'a' && (e.metaKey || e.ctrlKey) && !isInput) {
      e.preventDefault();
      updateActiveTab(tab => ({
        ...tab,
        nodes: tab.nodes.map(n => ({ ...n, selected: true })),
      }));
    }
    // Cmd+C — copy selected nodes and their interconnecting edges
    if (e.key === 'c' && (e.metaKey || e.ctrlKey) && !isInput) {
      const selectedNodes = nodes.filter(n => n.selected);
      if (selectedNodes.length === 0 && selectedNodeId) {
        const sn = nodes.find(n => n.id === selectedNodeId);
        if (sn) selectedNodes.push(sn);
      }
      if (selectedNodes.length === 0) return;
      const selectedIds = new Set(selectedNodes.map(n => n.id));
      const selectedEdges = edges.filter(edge => selectedIds.has(edge.source) && selectedIds.has(edge.target));
      clipboardRef.current = { nodes: selectedNodes, edges: selectedEdges };
    }
    // Cmd+V — paste from clipboard
    if (e.key === 'v' && (e.metaKey || e.ctrlKey) && !isInput) {
      if (!clipboardRef.current || clipboardRef.current.nodes.length === 0) return;
      e.preventDefault();
      pushHistory();

      const idMap = new Map<string, string>();
      const offset = 60;

      const newNodes = clipboardRef.current.nodes.map(n => {
        const newId = createId();
        idMap.set(n.id, newId);
        return {
          ...n,
          id: newId,
          position: { x: n.position.x + offset, y: n.position.y + offset },
          selected: true,
          data: { ...n.data, label: `${(n.data as any).label}` },
        };
      });

      const newEdges = clipboardRef.current.edges.map(edge => ({
        ...edge,
        id: createId(),
        source: idMap.get(edge.source) || edge.source,
        target: idMap.get(edge.target) || edge.target,
      }));

      // Deselect existing nodes
      updateActiveTab(tab => ({
        ...tab,
        nodes: [...tab.nodes.map(n => ({ ...n, selected: false })), ...newNodes],
        edges: [...tab.edges, ...newEdges],
      }));
    }
    // Focus mode: F to toggle, Escape to exit
    if (e.key === 'f' && !e.metaKey && !e.ctrlKey && !isInput) {
      if (focusNodeId) {
        setFocusNodeId(null);
      } else if (selectedNodeId) {
        setFocusNodeId(selectedNodeId);
      }
    }
    // Arrow key nudge: move selected nodes
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isInput) {
      const selectedNodes = nodes.filter(n => n.selected);
      if (selectedNodes.length === 0 && selectedNodeId) {
        const sn = nodes.find(n => n.id === selectedNodeId);
        if (sn) selectedNodes.push(sn);
      }
      if (selectedNodes.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 16;
        const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
        const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
        const selectedIds = new Set(selectedNodes.map(n => n.id));
        updateActiveTab(tab => ({
          ...tab,
          nodes: tab.nodes.map(n => selectedIds.has(n.id) ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n),
        }));
      }
    }
    if (e.key === '?' && !isInput) {
      e.preventDefault();
      setShowShortcuts(prev => !prev);
    }
    if (e.key === 'Escape' && !isInput) {
      if (showShortcuts) { setShowShortcuts(false); return; }
      if (paletteOpen) { setPaletteOpen(false); return; }
      if (searchOpen) { setSearchOpen(false); setSearchQuery(''); return; }
      if (focusNodeId) { setFocusNodeId(null); }
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handlerRef.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // mount-only, stable

  // --- Smart Paste: detect clipboard content type and create appropriate node ---
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (readingMode) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (!text) return;

      // Check if this is a canvas node paste (from Cmd+C) — skip if so
      if (clipboardRef.current && clipboardRef.current.nodes.length > 0) return;

      e.preventDefault();
      const viewport = reactFlowInstance.getViewport();
      const centerX = (-viewport.x + window.innerWidth / 2) / viewport.zoom;
      const centerY = (-viewport.y + window.innerHeight / 2) / viewport.zoom;

      const isUrl = /^https?:\/\/.+/i.test(text);

      if (isUrl) {
        addNode('link', { x: centerX, y: centerY });
        setTimeout(() => {
          updateActiveTab(tab => {
            const lastNode = tab.nodes[tab.nodes.length - 1];
            if (lastNode && lastNode.type === 'link') {
              return { ...tab, nodes: tab.nodes.map(n => n.id === lastNode.id ? { ...n, data: { ...n.data, url: text, label: text.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] } } : n) };
            }
            return tab;
          });
        }, 50);
      } else {
        addNode('text', { x: centerX, y: centerY });
        setTimeout(() => {
          updateActiveTab(tab => {
            const lastNode = tab.nodes[tab.nodes.length - 1];
            if (lastNode && lastNode.type === 'text') {
              const lines = text.split('\n');
              const title = lines[0].slice(0, 60);
              const content = lines.slice(1).join('\n');
              return { ...tab, nodes: tab.nodes.map(n => n.id === lastNode.id ? { ...n, data: { ...n.data, label: title, content } } : n) };
            }
            return tab;
          });
        }, 50);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addNode, reactFlowInstance, updateActiveTab, readingMode]);

  // --- Tab rename ---
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  return (
    <div className="xt-canvas-shell">
      {/* Tab bar */}
      <div className="xt-canvas-tabs">
        {state.tabs.map((t) => (
          <button
            key={t.tab.id}
            type="button"
            className={`xt-canvas-tab ${state.activeTabId === t.tab.id ? 'is-active' : ''}`}
            onClick={() => switchTab(t.tab.id)}
            onDoubleClick={() => { setRenamingTabId(t.tab.id); setRenameValue(t.tab.label); }}
          >
            <span className="xt-canvas-tab-emoji">{t.tab.emoji}</span>
            {renamingTabId === t.tab.id ? (
              <input
                autoFocus
                className="xt-canvas-tab-rename"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => { renameTab(t.tab.id, renameValue); setRenamingTabId(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { renameTab(t.tab.id, renameValue); setRenamingTabId(null); } }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="xt-canvas-tab-label">{t.tab.label}</span>
            )}
            {state.tabs.length > 1 ? (
              <button type="button" className="xt-canvas-tab-close" onClick={(e) => { e.stopPropagation(); deleteTab(t.tab.id); }}>
                <X size={10} />
              </button>
            ) : null}
          </button>
        ))}
        <button type="button" className="xt-canvas-tab xt-canvas-tab--add" onClick={addTab}>
          <Plus size={12} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="xt-canvas-toolbar">
        {NODE_ADD_ITEMS.map((item) => (
          <button
            key={item.type}
            type="button"
            className="xt-canvas-toolbar-btn"
            onClick={() => { if (!readingMode) addNode(item.type); }}
            draggable={!readingMode}
            onDragStart={(e) => {
              if (readingMode) { e.preventDefault(); return; }
              e.dataTransfer.setData('application/xtation-node-type', item.type);
              e.dataTransfer.effectAllowed = 'move';
            }}
            title={`Add ${item.label} — drag to place`}
            disabled={readingMode}
          >
            <item.icon size={14} />
            <span>{item.label}</span>
          </button>
        ))}
        <div className="xt-canvas-toolbar-sep" />
        <button type="button" className="xt-canvas-toolbar-btn" onClick={undo} disabled={historyLen.undo === 0} title="Undo (Cmd+Z)">
          <Undo2 size={14} />
        </button>
        <button type="button" className="xt-canvas-toolbar-btn" onClick={redo} disabled={historyLen.redo === 0} title="Redo (Cmd+Shift+Z)">
          <Redo2 size={14} />
        </button>
        <div className="xt-canvas-toolbar-sep" />
        <button type="button" className="xt-canvas-toolbar-btn" onClick={autoLayout} title="Auto-layout (tidy up)">
          <LayoutGrid size={14} />
        </button>
        <button type="button" className="xt-canvas-toolbar-btn" onClick={exportCanvas} title="Export canvas">
          <Download size={14} />
        </button>
        <button type="button" className="xt-canvas-toolbar-btn" onClick={importCanvas} title="Import canvas">
          <Upload size={14} />
        </button>
        <button type="button" className="xt-canvas-toolbar-btn" onClick={() => {
          const vp = reactFlowInstance.getViewport();
          const label = `View ${viewBookmarks.length + 1}`;
          setViewBookmarks(prev => [...prev, { id: createId(), label, x: vp.x, y: vp.y, zoom: vp.zoom }]);
        }} title="Save current view">
          <Bookmark size={14} />
        </button>
        {selectedNodeId && !readingMode ? (
          <>
            <div className="xt-canvas-toolbar-sep" />
            <button type="button" className="xt-canvas-toolbar-btn" onClick={duplicateSelectedNode} title="Duplicate (Cmd+D)">
              <Copy size={14} />
              <span>Duplicate</span>
            </button>
            <button type="button" className="xt-canvas-toolbar-btn xt-canvas-toolbar-btn--danger" onClick={deleteSelectedNodes} title="Delete">
              <Trash2 size={14} />
            </button>
          </>
        ) : null}
        {focusNodeId ? (
          <button type="button" className="xt-canvas-focus-badge" onClick={() => setFocusNodeId(null)}>
            Focus <X size={10} />
          </button>
        ) : null}
        {readingMode ? (
          <button className="xt-canvas-reading-badge" onClick={() => setReadingMode(false)}>
            Reading Mode — Click to exit
          </button>
        ) : null}
        {/* [Improvement #11] Save indicator */}
        <div className="xt-canvas-toolbar-spacer" />
        {saveStatus === 'saved' ? (
          <span className="xt-canvas-save-badge"><Check size={12} /> Saved</span>
        ) : saveStatus === 'saving' ? (
          <span className="xt-canvas-save-badge xt-canvas-save-badge--saving">Saving...</span>
        ) : null}
      </div>

      {/* Viewport Bookmarks */}
      {viewBookmarks.length > 0 ? (
        <div className="xt-canvas-bookmarks-bar">
          {viewBookmarks.map(bm => (
            <button key={bm.id} className="xt-canvas-bookmark-pill"
              onClick={() => reactFlowInstance.setViewport({ x: bm.x, y: bm.y, zoom: bm.zoom }, { duration: 300 })}
              onContextMenu={(e) => { e.preventDefault(); setViewBookmarks(prev => prev.filter(b => b.id !== bm.id)); }}
            >
              {bm.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Canvas */}
      <div className="xt-canvas-viewport" onDragOver={onCanvasDragOver} onDrop={onCanvasDrop} onDoubleClick={(e) => {
        // Only trigger on the pane itself, not on nodes
        const target = e.target as HTMLElement;
        if (target.closest('.react-flow__node')) return;
        onPaneDoubleClick(e);
      }}>
        {/* [Improvement #10] Empty state with starter templates */}
        {nodes.length === 0 ? (
          <div className="xt-canvas-empty-state">
            <div className="xt-canvas-empty-title">Start building</div>
            <div className="xt-canvas-empty-hint">Pick a template or double-click to start from scratch</div>
            <div className="xt-canvas-template-grid">
              <button className="xt-canvas-template-card" onClick={() => {
                pushHistory();
                const textId = createId();
                const checkId = createId();
                const timerId = createId();
                updateActiveTab(tab => ({
                  ...tab,
                  nodes: [
                    { id: timerId, type: 'timer', position: { x: 100, y: 100 }, data: { label: 'Focus Session', durationMinutes: 25, color: '#1a1a22' } },
                    { id: checkId, type: 'checklist', position: { x: 400, y: 80 }, data: { label: 'Morning Routine', items: [
                      { id: createId(), text: 'Review goals', done: false },
                      { id: createId(), text: 'Check calendar', done: false },
                      { id: createId(), text: 'Plan 3 priorities', done: false },
                    ], color: '#1a1a22' } },
                    { id: textId, type: 'text', position: { x: 250, y: 280 }, data: { label: 'Daily Notes', content: '', color: '#1a1a22' } },
                  ],
                  edges: [
                    { id: createId(), source: timerId, sourceHandle: 'right', target: checkId, targetHandle: 'left', type: 'labeled', data: { label: 'then' }, style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1.5 } },
                  ],
                }));
              }}>
                <div className="xt-canvas-template-icon">{'\u23F1'}</div>
                <div className="xt-canvas-template-name">Morning Routine</div>
                <div className="xt-canvas-template-desc">Timer + Checklist + Notes</div>
              </button>
              <button className="xt-canvas-template-card" onClick={() => {
                pushHistory();
                const questIds = [createId(), createId(), createId()];
                const goalId = createId();
                updateActiveTab(tab => ({
                  ...tab,
                  nodes: [
                    { id: questIds[0], type: 'quest', position: { x: 100, y: 100 }, data: { label: 'Research', questId: '', status: 'todo', questType: 'session', color: '#1a1a22' } },
                    { id: questIds[1], type: 'quest', position: { x: 400, y: 100 }, data: { label: 'Build', questId: '', status: 'todo', questType: 'session', color: '#1a1a22' } },
                    { id: questIds[2], type: 'quest', position: { x: 700, y: 100 }, data: { label: 'Ship', questId: '', status: 'todo', questType: 'session', color: '#1a1a22' } },
                    { id: goalId, type: 'goal', position: { x: 400, y: 280 }, data: { label: 'Sprint Goal', current: 0, target: 3, unit: 'quests', color: '#1a1a22' } },
                  ],
                  edges: [
                    { id: createId(), source: questIds[0], sourceHandle: 'right', target: questIds[1], targetHandle: 'left', type: 'labeled', data: { label: 'then' }, style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1.5 } },
                    { id: createId(), source: questIds[1], sourceHandle: 'right', target: questIds[2], targetHandle: 'left', type: 'labeled', data: { label: 'then' }, style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1.5 } },
                  ],
                }));
              }}>
                <div className="xt-canvas-template-icon">{'\uD83C\uDFAF'}</div>
                <div className="xt-canvas-template-name">Project Board</div>
                <div className="xt-canvas-template-desc">3 Quests + Goal Tracker</div>
              </button>
              <button className="xt-canvas-template-card" onClick={() => {
                pushHistory();
                const centerId = createId();
                const ideaIds = [createId(), createId(), createId(), createId()];
                updateActiveTab(tab => ({
                  ...tab,
                  nodes: [
                    { id: centerId, type: 'text', position: { x: 300, y: 200 }, data: { label: 'Central Idea', content: 'What are you thinking about?', color: '#2a1f10' } },
                    { id: ideaIds[0], type: 'text', position: { x: 50, y: 80 }, data: { label: 'Thought 1', content: '', color: '#1a1a22' } },
                    { id: ideaIds[1], type: 'text', position: { x: 550, y: 80 }, data: { label: 'Thought 2', content: '', color: '#1a1a22' } },
                    { id: ideaIds[2], type: 'text', position: { x: 50, y: 340 }, data: { label: 'Thought 3', content: '', color: '#1a1a22' } },
                    { id: ideaIds[3], type: 'text', position: { x: 550, y: 340 }, data: { label: 'Thought 4', content: '', color: '#1a1a22' } },
                  ],
                  edges: ideaIds.map(iid => ({
                    id: createId(), source: centerId, sourceHandle: 'right', target: iid, targetHandle: 'left',
                    type: 'labeled', data: { label: '' }, style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1.5 },
                  })),
                }));
              }}>
                <div className="xt-canvas-template-icon">{'\uD83D\uDCA1'}</div>
                <div className="xt-canvas-template-name">Brainstorm</div>
                <div className="xt-canvas-template-desc">Central idea + 4 branches</div>
              </button>
            </div>
          </div>
        ) : null}
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          connectionMode={ConnectionMode.Loose}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onConnectEnd={onConnectEnd}
          onReconnect={onReconnect}
          onReconnectEnd={onReconnectEnd}
          edgesReconnectable
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          snapToGrid
          snapGrid={[16, 16]}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          proOptions={PRO_OPTIONS}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          edgesFocusable
          nodesDraggable={!readingMode}
          nodesConnectable={!readingMode}
          elementsSelectable={!readingMode}
          multiSelectionKeyCode="Shift"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={0.8} color="rgba(128,128,128,0.12)" />
          <Controls className="xt-canvas-controls" />
          <MiniMap className="xt-canvas-minimap" nodeColor="#333" maskColor="rgba(0,0,0,0.7)" pannable zoomable />
        </ReactFlow>
        {/* Canvas Stats Bar */}
        <div className="xt-canvas-stats-bar">
          <span>{nodes.length} nodes</span>
          <span>&middot;</span>
          <span>{edges.length} connections</span>
          {nodes.filter(n => n.selected).length > 1 && (
            <>
              <span>&middot;</span>
              <span>{nodes.filter(n => n.selected).length} selected</span>
            </>
          )}
        </div>
      </div>

      {/* Inline edge label editor (replaces side panel) */}
      {selectedEdge && !selectedNode ? (
        <div className="xt-canvas-edge-edit-bar">
          <span className="xt-canvas-edge-edit-label">Connection label:</span>
          <input
            autoFocus
            className="xt-canvas-edge-edit-input"
            value={(selectedEdge.data as any)?.label || ''}
            onChange={e => updateEdgeLabel(selectedEdge.id, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setSelectedEdgeId(null); }}
            placeholder="triggers, feeds into, blocks..."
          />
          <button className="xt-canvas-edge-edit-close" onClick={() => setSelectedEdgeId(null)}>×</button>
        </div>
      ) : null}

      {/* Context menu */}
      {contextMenu ? (
        <div
          className="xt-canvas-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.nodeId ? (
            <>
              <button
                type="button"
                className="xt-canvas-context-menu-item"
                onClick={() => { duplicateNodeById(contextMenu.nodeId!); closeContextMenu(); }}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="xt-canvas-context-menu-item xt-canvas-context-menu-item--has-sub"
                onClick={(e) => { e.stopPropagation(); setColorSubMenuNodeId(colorSubMenuNodeId ? null : contextMenu.nodeId!); }}
              >
                Change Color
              </button>
              {colorSubMenuNodeId ? (
                <div className="xt-canvas-context-menu-colors">
                  {NODE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="xt-canvas-color-dot"
                      style={{ background: c }}
                      onClick={() => { updateNodeData(colorSubMenuNodeId, { color: c }); closeContextMenu(); }}
                    />
                  ))}
                </div>
              ) : null}
              <div className="xt-canvas-context-menu-stamps">
                {['\u{1F525}', '\u2705', '\u26A0\uFE0F', '\u{1F512}', '\u2753', ''].map(stamp => (
                  <button key={stamp || 'clear'} className="xt-canvas-context-menu-stamp"
                    onClick={() => {
                      updateNodeData(contextMenu.nodeId!, { stamp: stamp || undefined });
                      closeContextMenu();
                    }}>
                    {stamp || '\u2715'}
                  </button>
                ))}
              </div>
              {nodes.filter(n => n.selected).length >= 2 ? (
                <button
                  type="button"
                  className="xt-canvas-context-menu-item"
                  onClick={() => { groupSelectedNodes(); closeContextMenu(); }}
                >
                  Group selected
                </button>
              ) : null}
              <button
                type="button"
                className="xt-canvas-context-menu-item"
                onClick={() => {
                  const node = nodes.find(n => n.id === contextMenu.nodeId);
                  if (!node) { closeContextMenu(); return; }
                  const isEnabled = (node.data as any).enabled !== false;
                  updateNodeData(contextMenu.nodeId!, { enabled: !isEnabled });
                  closeContextMenu();
                }}
              >
                {(() => {
                  const node = nodes.find(n => n.id === contextMenu.nodeId);
                  return (node?.data as any)?.enabled === false ? 'Enable' : 'Disable';
                })()}
              </button>
              <button
                type="button"
                className="xt-canvas-context-menu-item"
                onClick={() => {
                  const node = nodes.find(n => n.id === contextMenu.nodeId);
                  if (!node) { closeContextMenu(); return; }
                  const d = node.data as any;
                  openDuskBrief({
                    title: d.label || 'Canvas node',
                    body: d.content || d.description || d.trigger || d.url || JSON.stringify(d, null, 2),
                    source: 'lab',
                    tags: [node.type || 'canvas'],
                    linkedQuestIds: d.questId ? [d.questId] : [],
                    linkedProjectIds: [],
                  });
                  closeContextMenu();
                }}
              >
                Send to Dusk
              </button>
              <button
                type="button"
                className="xt-canvas-context-menu-item"
                onClick={() => {
                  const node = nodes.find(n => n.id === contextMenu.nodeId);
                  if (!node) { closeContextMenu(); return; }
                  updateNodeData(contextMenu.nodeId!, { collapsed: !(node.data as any).collapsed });
                  closeContextMenu();
                }}
              >
                {(() => { const node = nodes.find(n => n.id === contextMenu.nodeId); return (node?.data as any)?.collapsed ? 'Expand' : 'Collapse'; })()}
              </button>
              <button
                type="button"
                className="xt-canvas-context-menu-item xt-canvas-context-menu-item--danger"
                onClick={() => { deleteNodeById(contextMenu.nodeId!); closeContextMenu(); }}
              >
                Delete
              </button>
            </>
          ) : (
            <>
              {nodes.filter(n => n.selected).length >= 2 ? (
                <button
                  type="button"
                  className="xt-canvas-context-menu-item"
                  onClick={() => { groupSelectedNodes(); closeContextMenu(); }}
                >
                  Group selected
                </button>
              ) : null}
              {NODE_ADD_ITEMS.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className="xt-canvas-context-menu-item"
                  onClick={() => { addNode(item.type, { x: contextMenu.flowX, y: contextMenu.flowY }); closeContextMenu(); }}
                >
                  Add {item.label}
                </button>
              ))}
            </>
          )}
        </div>
      ) : null}

      {/* Drag-connect node-type picker (Feature 1) */}
      {dragConnectMenu ? (
        <div
          className="xt-canvas-context-menu"
          style={{ left: dragConnectMenu.x, top: dragConnectMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {NODE_ADD_ITEMS.map(item => (
            <button
              key={item.type}
              type="button"
              className="xt-canvas-context-menu-item"
              onClick={() => {
                const newId = createId();
                const newNode: CanvasNode = {
                  id: newId,
                  type: item.type,
                  position: { x: dragConnectMenu.flowX, y: dragConnectMenu.flowY },
                  data: defaultNodeData[item.type](),
                  ...(item.type === 'group' ? { style: { width: 400, height: 300 } } : {}),
                };
                const newEdge: CanvasEdge = {
                  id: createId(),
                  source: dragConnectMenu.sourceNodeId,
                  sourceHandle: dragConnectMenu.sourceHandleId,
                  target: newId,
                  targetHandle: 'left',
                  type: 'labeled',
                  data: { label: '' },
                  style: { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1.5 },
                };
                pushHistory();
                updateActiveTab(tab => ({
                  ...tab,
                  nodes: [...tab.nodes, newNode],
                  edges: [...tab.edges, newEdge],
                }));
                setSelectedNodeId(newId);
                setDragConnectMenu(null);
                logEvent(scopeId, 'node:created', { nodeId: newId, nodeType: item.type });
                logEvent(scopeId, 'wire:created');
              }}
            >
              Add {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Command Palette (Cmd+K) */}
      {paletteOpen ? (
        <div className="xt-canvas-palette-overlay" onClick={() => setPaletteOpen(false)}>
          <div className="xt-canvas-palette" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              className="xt-canvas-palette-input"
              value={paletteQuery}
              onChange={e => setPaletteQuery(e.target.value)}
              placeholder="Search nodes, add items, run actions..."
              onKeyDown={onPaletteKeyDown}
            />
            <div className="xt-canvas-palette-results">
              {paletteResults.map((result, idx) => (
                <button key={result.id} className={`xt-canvas-palette-item ${idx === paletteSelectedIdx ? 'is-active' : ''}`} onClick={() => executePaletteResult(result)}>
                  <result.icon size={14} />
                  <div>
                    <div className="xt-canvas-palette-item-title">{result.title}</div>
                    <div className="xt-canvas-palette-item-hint">{result.hint}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Canvas Search (Cmd+F) */}
      {searchOpen ? (
        <div className="xt-canvas-search-bar">
          <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Find on canvas..." className="xt-canvas-search-input" onKeyDown={onSearchKeyDown} />
          <span className="xt-canvas-search-count">{searchMatches.length > 0 ? `${searchMatchIdx + 1}/${searchMatches.length}` : '0/0'}</span>
          <button type="button" onClick={nextSearchMatch} title="Next match">&#8595;</button>
          <button type="button" onClick={prevSearchMatch} title="Previous match">&#8593;</button>
          <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} title="Close search">&#215;</button>
        </div>
      ) : null}

      {/* Keyboard shortcuts overlay (? key) */}
      {showShortcuts ? (
        <div className="xt-canvas-shortcuts-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="xt-canvas-shortcuts-panel" onClick={e => e.stopPropagation()}>
            <div className="xt-canvas-shortcuts-title">Keyboard Shortcuts</div>
            <div className="xt-canvas-shortcuts-grid">
              {([
                ['Cmd+K', 'Command palette'],
                ['Cmd+F', 'Search nodes'],
                ['Cmd+Z', 'Undo'],
                ['Cmd+Shift+Z', 'Redo'],
                ['Cmd+D', 'Duplicate'],
                ['Cmd+C / V', 'Copy / Paste'],
                ['Cmd+A', 'Select all'],
                ['Cmd+G', 'Group selected'],
                ['Delete', 'Delete selected'],
                ['F', 'Focus mode'],
                ['Cmd+E', 'Reading mode'],
                ['?', 'This help'],
                ['Double-click', 'Create text node'],
                ['Right-click', 'Context menu'],
                ['Arrow keys', 'Nudge selected (Shift=1px)'],
                ['Escape', 'Deselect / Close'],
              ] as const).map(([key, desc]) => (
                <div key={key} className="xt-canvas-shortcut-row">
                  <span className="xt-canvas-shortcut-key">{key}</span>
                  <span className="xt-canvas-shortcut-desc">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const LabCanvas: React.FC = () => (
  <ReactFlowProvider>
    <LabCanvasInner />
  </ReactFlowProvider>
);
