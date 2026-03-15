import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeToolbar, useReactFlow, type NodeProps } from '@xyflow/react';
import { Target, Copy, Trash2 } from 'lucide-react';
import type { GoalNodeData } from '../canvasTypes';
import { NODE_COLORS, createId } from '../canvasTypes';

export const GoalNode = memo(function GoalNode({ data, id, selected }: NodeProps) {
  const d = data as GoalNodeData;
  const { setNodes, setEdges } = useReactFlow();
  const progress = d.target > 0 ? Math.min(d.current / d.target, 1) : 0;
  const percent = Math.round(progress * 100);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [draftCurrent, setDraftCurrent] = useState('');
  const [draftTarget, setDraftTarget] = useState('');
  const [draftUnit, setDraftUnit] = useState('');

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setDraft(currentValue);
  };

  const commitEdit = useCallback((field: string) => {
    setEditingField(null);
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: draft } } : n));
  }, [draft, id, setNodes]);

  const startEditGoal = () => {
    setEditingGoal(true);
    setDraftCurrent(String(d.current ?? 0));
    setDraftTarget(String(d.target ?? 10));
    setDraftUnit(d.unit ?? '');
  };

  const commitGoalEdit = useCallback(() => {
    setEditingGoal(false);
    const current = Math.max(0, parseInt(draftCurrent, 10) || 0);
    const target = Math.max(1, parseInt(draftTarget, 10) || 10);
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, current, target, unit: draftUnit } } : n));
  }, [draftCurrent, draftTarget, draftUnit, id, setNodes]);

  const increment = useCallback(() => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, current: (n.data as GoalNodeData).current + 1 } } : n));
  }, [id, setNodes]);

  return (
    <div className={`xt-canvas-node xt-canvas-node--goal ${selected ? 'is-selected' : ''}`} style={{ background: d.color || '#16161c' }}>
      <NodeToolbar isVisible={selected} position={Position.Top} className="xt-canvas-node-toolbar">
        <div className="xt-canvas-node-toolbar-colors">
          {NODE_COLORS.map(c => (
            <button key={c} className="xt-canvas-node-toolbar-color" style={{ background: c }}
              onClick={() => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, color: c } } : n))} />
          ))}
        </div>
        <button className="xt-canvas-node-toolbar-btn" onClick={() => {
          const newId = createId();
          setNodes(nds => {
            const orig = nds.find(n => n.id === id);
            if (!orig) return nds;
            return [...nds, { ...orig, id: newId, position: { x: orig.position.x + 40, y: orig.position.y + 40 }, data: { ...orig.data, label: `${(orig.data as any).label} (copy)` }, selected: false }];
          });
        }}><Copy size={12} /></button>
        <button className="xt-canvas-node-toolbar-btn xt-canvas-node-toolbar-btn--danger" onClick={() => {
          setNodes(nds => nds.filter(n => n.id !== id));
          setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
        }}><Trash2 size={12} /></button>
      </NodeToolbar>

      <Handle type="source" position={Position.Top} id="top" className="xt-canvas-handle" isConnectable />
      <Handle type="source" position={Position.Right} id="right" className="xt-canvas-handle" isConnectable />
      <Handle type="source" position={Position.Bottom} id="bottom" className="xt-canvas-handle" isConnectable />
      <Handle type="source" position={Position.Left} id="left" className="xt-canvas-handle" isConnectable />

      <div className="xt-canvas-node-header">
        <span className="xt-canvas-node-type">GOAL</span>
        <span className="xt-canvas-node-status" style={{ color: percent >= 100 ? '#74e2b8' : 'var(--app-muted)' }}>{percent}%</span>
      </div>

      <div className="xt-canvas-node-title">
        <Target size={13} style={{ flexShrink: 0 }} />
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
          <span onClick={() => startEdit('label', d.label ?? '')} style={{ cursor: 'text' }}>{d.label || 'Goal'}</span>
        )}
      </div>

      <div className="xt-canvas-goal-progress">
        <div className="xt-canvas-goal-bar">
          <div className="xt-canvas-goal-fill" style={{ width: `${percent}%` }} />
        </div>
        {editingGoal ? (
          <div className="xt-canvas-goal-count" style={{ gap: 4 }} onPointerDown={e => e.stopPropagation()}>
            <input
              autoFocus
              type="number"
              min={0}
              className="xt-canvas-node-inline-edit"
              style={{ width: 40, textAlign: 'center' }}
              value={draftCurrent}
              onChange={e => setDraftCurrent(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitGoalEdit(); if (e.key === 'Escape') setEditingGoal(false); }}
            />
            <span className="xt-canvas-goal-separator">/</span>
            <input
              type="number"
              min={1}
              className="xt-canvas-node-inline-edit"
              style={{ width: 40, textAlign: 'center' }}
              value={draftTarget}
              onChange={e => setDraftTarget(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitGoalEdit(); if (e.key === 'Escape') setEditingGoal(false); }}
            />
            <input
              type="text"
              placeholder="unit"
              className="xt-canvas-node-inline-edit"
              style={{ width: 50, textAlign: 'center' }}
              value={draftUnit}
              onChange={e => setDraftUnit(e.target.value)}
              onBlur={commitGoalEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitGoalEdit(); if (e.key === 'Escape') setEditingGoal(false); }}
            />
          </div>
        ) : (
          <div className="xt-canvas-goal-count" style={{ cursor: 'pointer' }} onClick={startEditGoal} onPointerDown={e => e.stopPropagation()}>
            <span className="xt-canvas-goal-current">{d.current}</span>
            <span className="xt-canvas-goal-separator">/</span>
            <span className="xt-canvas-goal-target">{d.target}</span>
            <span className="xt-canvas-goal-unit">{d.unit || ''}</span>
          </div>
        )}
      </div>

      <button className="xt-canvas-goal-increment" onClick={increment} onPointerDown={e => e.stopPropagation()}>
        +1
      </button>
    </div>
  );
}, (prev, next) => prev.id === next.id && prev.selected === next.selected && prev.data === next.data);
