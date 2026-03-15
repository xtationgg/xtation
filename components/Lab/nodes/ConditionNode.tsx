import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeToolbar, useReactFlow, type NodeProps } from '@xyflow/react';
import { GitBranch, Copy, Trash2 } from 'lucide-react';
import { NODE_COLORS, createId } from '../canvasTypes';

interface ConditionNodeData {
  label: string;
  field: string;     // what to check: 'completion', 'status', 'enabled', 'current'
  operator: string;  // '==', '!=', '>', '<', '>=', '<='
  value: string;     // the value to compare against
  color: string;
  [key: string]: unknown;
}

export const ConditionNode = memo(function ConditionNode({ data, id, selected }: NodeProps) {
  const d = data as ConditionNodeData;
  const { setNodes, setEdges } = useReactFlow();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (field: string, val: string) => { setEditingField(field); setDraft(val); };
  const commitEdit = useCallback((field: string) => {
    setEditingField(null);
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: draft } } : n));
  }, [draft, id, setNodes]);

  return (
    <div className={`xt-canvas-node xt-canvas-node--condition ${selected ? 'is-selected' : ''}`} style={{ background: d.color || undefined }}>
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
        <span className="xt-canvas-node-type">CONDITION</span>
      </div>

      <div className="xt-canvas-node-title">
        <GitBranch size={14} style={{ flexShrink: 0 }} />
        {editingField === 'label' ? (
          <input autoFocus className="xt-canvas-node-inline-edit" value={draft}
            onChange={e => setDraft(e.target.value)} onBlur={() => commitEdit('label')}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit('label'); if (e.key === 'Escape') setEditingField(null); }}
            onPointerDown={e => e.stopPropagation()} />
        ) : (
          <span onClick={() => startEdit('label', d.label ?? '')} style={{ cursor: 'text' }}>{d.label || 'Condition'}</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
        <select value={d.field || ''} className="xt-canvas-node-inline-select"
          onChange={e => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, field: e.target.value } } : n))}
          onPointerDown={e => e.stopPropagation()}>
          <option value="">Field...</option>
          <option value="status">status</option>
          <option value="enabled">enabled</option>
          <option value="current">current</option>
          <option value="completion">completion</option>
        </select>
        <select value={d.operator || ''} className="xt-canvas-node-inline-select"
          onChange={e => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, operator: e.target.value } } : n))}
          onPointerDown={e => e.stopPropagation()}>
          <option value="">Op...</option>
          <option value="==">==</option>
          <option value="!=">!=</option>
          <option value=">">&gt;</option>
          <option value="<">&lt;</option>
          <option value=">=">&gt;=</option>
          <option value="<=">&lt;=</option>
        </select>
        {editingField === 'value' ? (
          <input autoFocus className="xt-canvas-node-inline-edit" value={draft} style={{ width: 60, fontSize: 11 }}
            onChange={e => setDraft(e.target.value)} onBlur={() => commitEdit('value')}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit('value'); if (e.key === 'Escape') setEditingField(null); }}
            onPointerDown={e => e.stopPropagation()} />
        ) : (
          <span onClick={() => startEdit('value', d.value ?? '')} style={{ cursor: 'text', fontSize: 11, color: 'var(--app-text)', padding: '2px 4px', border: '1px solid var(--app-border)' }}>
            {d.value || 'value'}
          </span>
        )}
      </div>
    </div>
  );
}, (prev, next) => prev.id === next.id && prev.selected === next.selected && prev.data === next.data);
