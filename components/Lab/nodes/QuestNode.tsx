import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeToolbar, useReactFlow, type NodeProps } from '@xyflow/react';
import { Target, Copy, Trash2 } from 'lucide-react';
import type { QuestNodeData } from '../canvasTypes';
import { NODE_COLORS, createId } from '../canvasTypes';

export const QuestNode = memo(function QuestNode({ data, id, selected }: NodeProps) {
  const d = data as QuestNodeData;
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const { setNodes, setEdges } = useReactFlow();

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setDraft(currentValue);
  };

  const commitEdit = useCallback((field: string) => {
    setEditingField(null);
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: draft } } : n));
  }, [draft, id, setNodes]);

  const statusColor =
    d.status === 'done' ? '#74e2b8' :
    d.status === 'in-progress' ? 'var(--app-accent)' :
    d.status === 'failed' ? '#dc2626' :
    'var(--app-muted)';

  return (
    <div
      className={`xt-canvas-node xt-canvas-node--quest ${selected ? 'is-selected' : ''}`}
      style={{ background: d.color || '#1a1a1e' }}
    >
      <NodeToolbar isVisible={selected} position={Position.Top} className="xt-canvas-node-toolbar">
        <div className="xt-canvas-node-toolbar-colors">
          {NODE_COLORS.map(c => (
            <button
              key={c}
              className="xt-canvas-node-toolbar-color"
              style={{ background: c }}
              onClick={() => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, color: c } } : n))}
            />
          ))}
        </div>
        <button className="xt-canvas-node-toolbar-btn" onClick={() => {
          const newId = createId();
          setNodes(nds => {
            const node = nds.find(n => n.id === id);
            if (!node) return nds;
            return [...nds, {
              ...node,
              id: newId,
              position: { x: node.position.x + 40, y: node.position.y + 40 },
              data: { ...node.data, label: `${(node.data as any).label} (copy)` },
            }];
          });
        }}>
          <Copy size={12} />
        </button>
        <button className="xt-canvas-node-toolbar-btn xt-canvas-node-toolbar-btn--danger" onClick={() => {
          setNodes(nds => nds.filter(n => n.id !== id));
          setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
        }}>
          <Trash2 size={12} />
        </button>
      </NodeToolbar>

      <Handle type="source" position={Position.Top} id="top" className="xt-canvas-handle" isConnectable />
      <Handle type="source" position={Position.Right} id="right" className="xt-canvas-handle" isConnectable />
      <Handle type="source" position={Position.Bottom} id="bottom" className="xt-canvas-handle" isConnectable />
      <Handle type="source" position={Position.Left} id="left" className="xt-canvas-handle" isConnectable />

      <div className="xt-canvas-node-header">
        <span className="xt-canvas-node-type">QUEST</span>
        {editingField === 'status' ? (
          <select
            autoFocus
            className="xt-canvas-node-inline-select"
            value={draft}
            onChange={e => { setDraft(e.target.value); }}
            onBlur={() => commitEdit('status')}
            onPointerDown={e => e.stopPropagation()}
          >
            <option value="todo">todo</option>
            <option value="in-progress">in-progress</option>
            <option value="done">done</option>
            <option value="failed">failed</option>
          </select>
        ) : (
          <span
            className="xt-canvas-node-status"
            style={{ color: statusColor, cursor: 'pointer' }}
            onClick={() => startEdit('status', d.status || 'todo')}
            onPointerDown={e => e.stopPropagation()}
          >
            {d.status || 'todo'}
          </span>
        )}
      </div>

      <div className="xt-canvas-node-title">
        <Target size={13} style={{ color: statusColor, flexShrink: 0 }} />
        {editingField === 'label' ? (
          <input
            autoFocus
            className="xt-canvas-node-inline-edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitEdit('label')}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit('label'); if (e.key === 'Escape') setEditingField(null); }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span onClick={() => startEdit('label', d.label ?? '')} style={{ cursor: 'text' }}>{d.label || 'Untitled quest'}</span>
        )}
      </div>

      <div className="xt-canvas-node-meta">
        {editingField === 'questType' ? (
          <select
            autoFocus
            className="xt-canvas-node-inline-select"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => commitEdit('questType')}
            onPointerDown={e => e.stopPropagation()}
          >
            <option value="session">session</option>
            <option value="instant">instant</option>
            <option value="daily">daily</option>
          </select>
        ) : (
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => startEdit('questType', d.questType || 'session')}
            onPointerDown={e => e.stopPropagation()}
          >
            {d.questType || 'session'}
          </span>
        )}
      </div>

      {editingField === 'questId' ? (
        <input
          autoFocus
          className="xt-canvas-node-inline-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitEdit('questId')}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit('questId'); if (e.key === 'Escape') setEditingField(null); }}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Quest ID..."
          style={{ fontSize: 10 }}
        />
      ) : (
        <div className="xt-canvas-node-meta" onClick={() => startEdit('questId', d.questId ?? '')} style={{ cursor: 'text' }}>
          {d.questId ? `ID: ${d.questId}` : 'Click to link quest...'}
        </div>
      )}

    </div>
  );
}, (prev, next) =>
  prev.id === next.id &&
  prev.selected === next.selected &&
  prev.data === next.data
);
