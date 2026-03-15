import React, { memo, useMemo } from 'react';
import { Handle, Position, NodeToolbar, useReactFlow, type NodeProps } from '@xyflow/react';
import { Calendar, Copy, Trash2 } from 'lucide-react';
import { NODE_COLORS, createId } from '../canvasTypes';
import { useXP } from '../../XP/xpStore';
import { useAuth } from '../../../src/auth/AuthProvider';
import { readEventLog, getEventsForDay } from '../../../src/lab/eventLog';

export const TodayNode = memo(function TodayNode({ data, id, selected }: NodeProps) {
  const { setNodes, setEdges } = useReactFlow();
  const { selectors, dateKey, now } = useXP();
  const { user } = useAuth();
  const scopeId = user?.id || 'anon';

  const todayEvents = useMemo(() => {
    const log = readEventLog(scopeId);
    return getEventsForDay(log, new Date());
  }, [scopeId]);

  const nodesCreated = todayEvents.filter((e) => e.type === 'node:created').length;
  const todayMinutes = selectors.getTrackedMinutesForDay(dateKey, now);
  const activeTasks = selectors.getActiveTasks();
  const momentum = selectors.getMomentum();
  const streak = momentum.currentStreak;

  return (
    <div className={`xt-canvas-node xt-canvas-node--today ${selected ? 'is-selected' : ''}`}>
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
        <span className="xt-canvas-node-type">TODAY</span>
        <span className="xt-canvas-node-status">
          {new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>

      <div className="xt-canvas-node-title">
        <Calendar size={13} style={{ flexShrink: 0 }} />
        Daily Brief
      </div>

      <div className="xt-canvas-today-stats">
        <div className="xt-canvas-today-stat">
          <span className="xt-canvas-today-stat-value">{activeTasks.length}</span>
          <span className="xt-canvas-today-stat-label">active quests</span>
        </div>
        <div className="xt-canvas-today-stat">
          <span className="xt-canvas-today-stat-value">{todayMinutes}</span>
          <span className="xt-canvas-today-stat-label">min tracked</span>
        </div>
        <div className="xt-canvas-today-stat">
          <span className="xt-canvas-today-stat-value">{nodesCreated}</span>
          <span className="xt-canvas-today-stat-label">nodes created</span>
        </div>
        <div className="xt-canvas-today-stat">
          <span className="xt-canvas-today-stat-value">{streak}</span>
          <span className="xt-canvas-today-stat-label">day streak</span>
        </div>
      </div>

      {activeTasks.length > 0 ? (
        <div className="xt-canvas-today-quests">
          {activeTasks.slice(0, 4).map((task) => (
            <div key={task.id} className="xt-canvas-today-quest">
              {task.title}
            </div>
          ))}
        </div>
      ) : (
        <div className="xt-canvas-node-body xt-canvas-node-body--empty">No active quests</div>
      )}
    </div>
  );
});
