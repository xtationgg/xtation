import React, { memo, useState, useCallback } from 'react';
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react';

interface GroupNodeData {
  label: string;
  color: string;
  [key: string]: unknown;
}

const GROUP_COLORS = [
  'rgba(220, 38, 38, 0.08)',   // red
  'rgba(245, 158, 11, 0.08)',  // amber
  'rgba(34, 197, 94, 0.08)',   // green
  'rgba(59, 130, 246, 0.08)',  // blue
  'rgba(168, 85, 247, 0.08)',  // purple
  'rgba(255, 255, 255, 0.04)', // neutral
];

export const GroupNode = memo(function GroupNode({ data, id, selected }: NodeProps) {
  const d = data as GroupNodeData;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.label || '');
  const { setNodes } = useReactFlow();

  const commitLabel = useCallback(() => {
    setEditing(false);
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, label: draft } } : n));
  }, [draft, id, setNodes]);

  return (
    <div
      className={`xt-canvas-group ${selected ? 'is-selected' : ''}`}
      style={{
        background: d.color || GROUP_COLORS[5],
        width: '100%',
        height: '100%',
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={150}
        lineClassName="xt-canvas-resizer-line"
        handleClassName="xt-canvas-resizer-handle"
      />
      <div className="xt-canvas-group-header">
        {editing ? (
          <input
            autoFocus
            className="xt-canvas-group-title-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={e => { if (e.key === 'Enter') commitLabel(); }}
            onPointerDown={e => e.stopPropagation()}
          />
        ) : (
          <div
            className="xt-canvas-group-title"
            onDoubleClick={() => { setEditing(true); setDraft(d.label || ''); }}
          >
            {d.label || 'Group'}
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) =>
  prev.id === next.id &&
  prev.selected === next.selected &&
  prev.data === next.data
);

export { GROUP_COLORS };
