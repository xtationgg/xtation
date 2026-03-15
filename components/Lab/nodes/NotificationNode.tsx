import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeToolbar, useReactFlow, type NodeProps } from '@xyflow/react';
import { Bell, Copy, Trash2 } from 'lucide-react';
import { NODE_COLORS, createId } from '../canvasTypes';

interface NotificationNodeData {
  label: string;
  message: string;
  sound: boolean;
  color: string;
  [key: string]: unknown;
}

export const NotificationNode = memo(function NotificationNode({ data, id, selected }: NodeProps) {
  const d = data as NotificationNodeData;
  const { setNodes, setEdges } = useReactFlow();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (field: string, val: string) => { setEditingField(field); setDraft(val); };
  const commitEdit = useCallback((field: string) => {
    setEditingField(null);
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: draft } } : n));
  }, [draft, id, setNodes]);

  return (
    <div className={`xt-canvas-node xt-canvas-node--notification ${selected ? 'is-selected' : ''}`} style={{ background: d.color || undefined }}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="xt-canvas-node-toolbar">
        <div className="xt-canvas-node-toolbar-colors">
          {NODE_COLORS.map(c => (
            <button key={c} className="xt-canvas-node-toolbar-color" style={{ background: c }}
              onClick={() => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, color: c } } : n))} />
          ))}
        </div>
        <button className="xt-canvas-node-toolbar-btn" onClick={() => {
          const newId = createId();
          setNodes(nds => { const orig = nds.find(n => n.id === id); if (!orig) return nds;
            return [...nds, { ...orig, id: newId, position: { x: orig.position.x + 40, y: orig.position.y + 40 }, data: { ...orig.data }, selected: false }]; });
        }}><Copy size={12} /></button>
        <button className="xt-canvas-node-toolbar-btn xt-canvas-node-toolbar-btn--danger" onClick={() => {
          setNodes(nds => nds.filter(n => n.id !== id)); setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
        }}><Trash2 size={12} /></button>
      </NodeToolbar>

      <Handle type="source" position={Position.Top} id="top" className="xt-canvas-handle" isConnectable />
      <Handle type="source" position={Position.Right} id="right" className="xt-canvas-handle" isConnectable />
      <Handle type="source" position={Position.Bottom} id="bottom" className="xt-canvas-handle" isConnectable />
      <Handle type="source" position={Position.Left} id="left" className="xt-canvas-handle" isConnectable />

      <div className="xt-canvas-node-header">
        <span className="xt-canvas-node-type">NOTIFICATION</span>
      </div>

      <div className="xt-canvas-node-title">
        <Bell size={16} style={{ flexShrink: 0 }} />
        {editingField === 'label' ? (
          <input autoFocus className="xt-canvas-node-inline-edit" value={draft}
            onChange={e => setDraft(e.target.value)} onBlur={() => commitEdit('label')}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit('label'); if (e.key === 'Escape') setEditingField(null); }}
            onPointerDown={e => e.stopPropagation()} />
        ) : (
          <span onClick={() => startEdit('label', d.label ?? '')} style={{ cursor: 'text' }}>{d.label || 'Notification'}</span>
        )}
      </div>

      {editingField === 'message' ? (
        <textarea autoFocus className="xt-canvas-node-inline-edit" value={draft}
          onChange={e => setDraft(e.target.value)} onBlur={() => commitEdit('message')}
          onKeyDown={e => { if (e.key === 'Escape') setEditingField(null); }}
          onPointerDown={e => e.stopPropagation()} style={{ minHeight: 40 }} />
      ) : (
        <div className="xt-canvas-node-body" onClick={() => startEdit('message', d.message ?? '')}>
          {d.message || 'Click to set message...'}
        </div>
      )}

      <div className="xt-canvas-node-meta" style={{ marginTop: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10 }}
          onPointerDown={e => e.stopPropagation()}>
          <input type="checkbox" checked={d.sound ?? false}
            onChange={e => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, sound: e.target.checked } } : n))} />
          Play sound
        </label>
      </div>
    </div>
  );
}, (prev, next) => prev.id === next.id && prev.selected === next.selected && prev.data === next.data);
