import type { CanvasNode, CanvasEdge } from '../../components/Lab/canvasTypes';

export type WireEvent =
  | 'timer:complete'
  | 'checklist:complete'
  | 'quest:status-changed'
  | 'automation:toggled'
  | 'goal:reached';

export interface WireAction {
  targetNodeId: string;
  targetNodeType: string;
  action: string; // what to do on the target
}

/**
 * Given a source node that fired an event, find all target nodes
 * connected via outgoing wires and determine what actions to take.
 */
export function resolveWireActions(
  sourceNodeId: string,
  event: WireEvent,
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): WireAction[] {
  const sourceNode = nodes.find(n => n.id === sourceNodeId);
  // Skip if source is disabled
  if (sourceNode && (sourceNode.data as any).enabled === false) return [];

  // Find all edges where this node is the source
  const outgoing = edges.filter(e => e.source === sourceNodeId);
  const actions: WireAction[] = [];

  for (const edge of outgoing) {
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!targetNode) continue;
    // Skip disabled targets
    if ((targetNode.data as any).enabled === false) continue;

    const action = getActionForTarget(event, targetNode.type || 'text', targetNode.data as any);
    if (action) {
      actions.push({
        targetNodeId: targetNode.id,
        targetNodeType: targetNode.type || 'text',
        action,
      });
    }
  }

  return actions;
}

/**
 * Determine what action to execute on a target node based on the event type
 * and the target node type.
 */
function getActionForTarget(
  event: WireEvent,
  targetType: string,
  _targetData: Record<string, unknown>
): string | null {
  switch (targetType) {
    case 'link':
      return 'open-url'; // open the URL in a new tab
    case 'text':
      return 'highlight'; // briefly highlight the text node
    case 'quest':
      if (event === 'timer:complete') return 'mark-in-progress';
      return 'highlight';
    case 'automation':
      return 'toggle-on'; // enable the automation
    case 'checklist':
      return 'highlight';
    case 'timer':
      return 'start'; // start the connected timer
    case 'goal':
      return 'increment'; // increment the goal counter
    case 'notification':
      return 'fire'; // fire the notification
    case 'condition':
      return 'evaluate'; // evaluate the condition gate
    default:
      return 'highlight';
  }
}

/**
 * Execute a resolved wire action on a target node.
 * Returns updated node data if the node was modified, or null if only a side effect.
 */
export function executeWireAction(
  action: WireAction,
  targetNode: CanvasNode,
): { updatedData?: Record<string, unknown>; sideEffect?: () => void } {
  const data = targetNode.data as Record<string, unknown>;

  switch (action.action) {
    case 'open-url': {
      const url = data.url as string;
      if (url) {
        return { sideEffect: () => window.open(url, '_blank', 'noopener,noreferrer') };
      }
      return {};
    }
    case 'mark-in-progress':
      return { updatedData: { ...data, status: 'in-progress' } };
    case 'toggle-on':
      return { updatedData: { ...data, enabled: true } };
    case 'start':
      // Timer start is handled by the component's local state, not data
      return { sideEffect: () => {} }; // placeholder
    case 'increment': {
      const current = (data.current as number) || 0;
      return { updatedData: { ...data, current: current + 1 } };
    }
    case 'fire':
      return { sideEffect: () => {
        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('XTATION Lab', { body: (data.label as string) || 'Circuit fired' });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      }};
    case 'evaluate':
      return {}; // condition evaluation handled by the caller
    case 'highlight':
      return {}; // visual highlight handled by the caller
    default:
      return {};
  }
}
