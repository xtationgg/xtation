import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeToolbar, useReactFlow, type NodeProps } from '@xyflow/react';
import { Workflow, Zap, Copy, Trash2 } from 'lucide-react';
import type { AutomationNodeData } from '../canvasTypes';
import { NODE_COLORS, createId } from '../canvasTypes';

export const AutomationNode = memo(function AutomationNode({ data, id, selected }: NodeProps) {
  const d = data as AutomationNodeData;
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

  const toggleEnabled = () => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, enabled: !d.enabled } } : n));
  };

  return (
    <div
      className={`xt-canvas-node xt-canvas-node--automation ${selected ? 'is-selected' : ''} ${d.enabled ? 'is-enabled' : ''}`}
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
        <span className="xt-canvas-node-type">CIRCUIT</span>
        {d.enabled ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={toggleEnabled} onPointerDown={e => e.stopPropagation()}>
            <span className="xt-canvas-circuit-dot" />
            <span style={{ color: '#00C878', fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>on</span>
          </span>
        ) : (
          <span
            className="xt-canvas-node-status"
            style={{ color: 'rgba(255,255,255,0.25)', cursor: 'pointer' }}
            onClick={toggleEnabled}
            onPointerDown={e => e.stopPropagation()}
          >
            off
          </span>
        )}
      </div>

      <div className="xt-canvas-node-title">
        <Workflow size={13} style={{ flexShrink: 0 }} />
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
          <span onClick={() => startEdit('label', d.label ?? '')} style={{ cursor: 'text' }}>{d.label || 'Untitled circuit'}</span>
        )}
      </div>

      <div className="xt-canvas-node-field">
        <Zap size={10} />
        {editingField === 'trigger' ? (
          <input
            autoFocus
            className="xt-canvas-node-inline-edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitEdit('trigger')}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit('trigger'); if (e.key === 'Escape') setEditingField(null); }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span onClick={() => startEdit('trigger', d.trigger ?? '')} style={{ cursor: 'text' }}>{d.trigger || 'Click to set trigger...'}</span>
        )}
      </div>

      <div className="xt-canvas-node-field">
        <span className="xt-canvas-node-field-arrow">→</span>
        {editingField === 'action' ? (
          <input
            autoFocus
            className="xt-canvas-node-inline-edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitEdit('action')}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit('action'); if (e.key === 'Escape') setEditingField(null); }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span onClick={() => startEdit('action', d.action ?? '')} style={{ cursor: 'text' }}>{d.action || 'Click to set action...'}</span>
        )}
      </div>

    </div>
  );
}, (prev, next) =>
  prev.id === next.id &&
  prev.selected === next.selected &&
  prev.data === next.data
);
