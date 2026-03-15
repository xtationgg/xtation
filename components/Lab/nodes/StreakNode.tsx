import React, { memo, useMemo } from 'react';
import { Handle, Position, NodeToolbar, useReactFlow, type NodeProps } from '@xyflow/react';
import { Flame, Copy, Trash2 } from 'lucide-react';
import { NODE_COLORS, createId } from '../canvasTypes';
import { useAuth } from '../../../src/auth/AuthProvider';
import { readEventLog, getStreakDays } from '../../../src/lab/eventLog';
import type { LabEventType } from '../../../src/lab/eventLog';

const ACTIVITY_TYPES: LabEventType[] = [
  'node:created',
  'node:edited',
  'wire:created',
  'checklist:toggled',
  'quest:completed',
  'session:started',
  'canvas:opened',
];

export const StreakNode = memo(function StreakNode({ data, id, selected }: NodeProps) {
  const { setNodes, setEdges } = useReactFlow();
  const { user } = useAuth();
  const scopeId = user?.id || 'anon';

  const { streak, dayCells } = useMemo(() => {
    const log = readEventLog(scopeId);
    const streakCount = getStreakDays(log, ACTIVITY_TYPES);

    // Build 30-day grid
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const cells: { key: string; active: boolean; isToday: boolean }[] = [];

    // Collect active days from log
    const activeDaySet = new Set<string>();
    for (const e of log) {
      if (ACTIVITY_TYPES.includes(e.type)) {
        const d = new Date(e.timestamp);
        activeDaySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    }

    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      cells.push({
        key,
        active: activeDaySet.has(key),
        isToday: i === 0,
      });
    }

    return { streak: streakCount, dayCells: cells };
  }, [scopeId]);

  return (
    <div className={`xt-canvas-node xt-canvas-node--streak ${selected ? 'is-selected' : ''}`}>
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
        <span className="xt-canvas-node-type">STREAK</span>
      </div>

      <div className="xt-canvas-node-title">
        <Flame size={13} style={{ flexShrink: 0 }} />
        Activity Streak
      </div>

      <div className="xt-canvas-streak-number">{streak}</div>
      <div className="xt-canvas-streak-label">day streak</div>

      <div className="xt-canvas-streak-grid">
        {dayCells.map((cell) => (
          <div
            key={cell.key}
            className={`xt-canvas-streak-cell${cell.active ? ' is-active' : ''}${cell.isToday ? ' is-today' : ''}`}
          />
        ))}
      </div>
    </div>
  );
});
