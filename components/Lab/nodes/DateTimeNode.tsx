import React, { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position, NodeToolbar, useReactFlow, type NodeProps } from '@xyflow/react';
import { Clock, Copy, Trash2 } from 'lucide-react';
import { NODE_COLORS, createId } from '../canvasTypes';

interface DateTimeNodeData {
  label: string;
  color: string;
  targetTime: string; // HH:MM format for daily trigger, or ISO string for specific date
  mode: 'clock' | 'daily' | 'date'; // clock = just show time, daily = fire at HH:MM every day, date = fire at specific datetime
  [key: string]: unknown;
}

export const DateTimeNode = memo(function DateTimeNode({ data, id, selected }: NodeProps) {
  const d = data as DateTimeNodeData;
  const { setNodes, setEdges } = useReactFlow();
  const [now, setNow] = useState(new Date());
  const [fired, setFired] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (field: string, val: string) => { setEditingField(field); setDraft(val); };
  const commitEdit = useCallback((field: string) => {
    setEditingField(null);
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: draft } } : n));
  }, [draft, id, setNodes]);

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Check if target time is reached
  useEffect(() => {
    if (fired || !d.targetTime || d.mode === 'clock') return;

    if (d.mode === 'daily') {
      const [hours, minutes] = d.targetTime.split(':').map(Number);
      if (now.getHours() === hours && now.getMinutes() === minutes && now.getSeconds() === 0) {
        setFired(true);
        window.dispatchEvent(new CustomEvent('xtation:wire:fire', {
          detail: { sourceNodeId: id, event: 'timer:complete' }
        }));
        // Reset after 60 seconds so it can fire again tomorrow
        setTimeout(() => setFired(false), 60000);
      }
    }
  }, [now, d.targetTime, d.mode, fired, id]);

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className={`xt-canvas-node xt-canvas-node--datetime ${selected ? 'is-selected' : ''}`} style={{ background: d.color || undefined }}>
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
        <span className="xt-canvas-node-type">DATE / TIME</span>
        <span className="xt-canvas-node-status" style={{ color: fired ? '#00C878' : 'var(--app-muted)' }}>
          {d.mode === 'clock' ? 'live' : fired ? 'fired' : d.targetTime ? 'armed' : 'idle'}
        </span>
      </div>

      <div className="xt-canvas-node-title">
        <Clock size={14} style={{ flexShrink: 0 }} />
        {editingField === 'label' ? (
          <input autoFocus className="xt-canvas-node-inline-edit" value={draft}
            onChange={e => setDraft(e.target.value)} onBlur={() => commitEdit('label')}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit('label'); if (e.key === 'Escape') setEditingField(null); }}
            onPointerDown={e => e.stopPropagation()} />
        ) : (
          <span onClick={() => startEdit('label', d.label ?? '')} style={{ cursor: 'text' }}>{d.label || 'Clock'}</span>
        )}
      </div>

      <div style={{ textAlign: 'center', margin: '8px 0' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: 'var(--app-text)' }}>
          {timeStr}
        </div>
        <div style={{ fontSize: 10, color: 'var(--app-muted)', marginTop: 2 }}>{dateStr}</div>
      </div>

      {d.mode !== 'clock' && (
        <div className="xt-canvas-node-field" style={{ marginTop: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--app-muted)' }}>Trigger at:</span>
          {editingField === 'targetTime' ? (
            <input autoFocus className="xt-canvas-node-inline-edit" value={draft} type="time"
              onChange={e => setDraft(e.target.value)} onBlur={() => commitEdit('targetTime')}
              onPointerDown={e => e.stopPropagation()} style={{ fontSize: 11 }} />
          ) : (
            <span onClick={() => startEdit('targetTime', d.targetTime ?? '')} style={{ cursor: 'text', fontSize: 11, color: 'var(--app-text)' }}>
              {d.targetTime || 'Click to set...'}
            </span>
          )}
        </div>
      )}

      <div className="xt-canvas-node-meta" style={{ marginTop: 6 }}>
        <select value={d.mode || 'clock'} onChange={e => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, mode: e.target.value } } : n))}
          className="xt-canvas-node-inline-select" onPointerDown={e => e.stopPropagation()}>
          <option value="clock">Clock only</option>
          <option value="daily">Daily trigger</option>
        </select>
      </div>
    </div>
  );
}, (prev, next) => prev.id === next.id && prev.selected === next.selected && prev.data === next.data);
