import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeToolbar, useReactFlow, type NodeProps } from '@xyflow/react';
import { ExternalLink, Copy, Trash2 } from 'lucide-react';
import type { LinkNodeData } from '../canvasTypes';
import { NODE_COLORS, createId } from '../canvasTypes';

export const LinkNode = memo(function LinkNode({ data, id, selected }: NodeProps) {
  const d = data as LinkNodeData;
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

  return (
    <div
      className={`xt-canvas-node xt-canvas-node--link ${selected ? 'is-selected' : ''}`}
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
        <span className="xt-canvas-node-type">LINK</span>
        {d.url ? (
          <a
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="xt-canvas-node-action"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ExternalLink size={11} />
          </a>
        ) : null}
      </div>

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
        <div className="xt-canvas-node-title" onClick={() => startEdit('label', d.label ?? '')}>{d.label || 'Untitled link'}</div>
      )}

      {editingField === 'url' ? (
        <input
          autoFocus
          className="xt-canvas-node-inline-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitEdit('url')}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit('url'); if (e.key === 'Escape') setEditingField(null); }}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="https://..."
        />
      ) : (
        <div className="xt-canvas-node-url" onClick={() => startEdit('url', d.url ?? '')}>{d.url || 'Click to add URL...'}</div>
      )}

      {editingField === 'description' ? (
        <textarea
          autoFocus
          className="xt-canvas-node-inline-edit"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => commitEdit('description')}
          onKeyDown={e => { if (e.key === 'Escape') setEditingField(null); }}
          onPointerDown={e => e.stopPropagation()}
          style={{ minHeight: 30 }}
        />
      ) : (
        <div className="xt-canvas-node-body" onClick={() => startEdit('description', d.description ?? '')}>
          {d.description ? d.description.slice(0, 80) : 'Click to add description...'}
        </div>
      )}

    </div>
  );
}, (prev, next) =>
  prev.id === next.id &&
  prev.selected === next.selected &&
  prev.data === next.data
);
