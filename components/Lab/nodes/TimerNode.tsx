import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position, NodeToolbar, useReactFlow, type NodeProps } from '@xyflow/react';
import { Play, Pause, RotateCcw, Copy, Trash2 } from 'lucide-react';
import { NODE_COLORS, createId } from '../canvasTypes';

interface TimerNodeData {
  label: string;
  color: string;
  durationMinutes: number; // default 25
  [key: string]: unknown;
}

export const TimerNode = memo(function TimerNode({ data, id, selected }: NodeProps) {
  const d = data as TimerNodeData;
  const { setNodes, setEdges } = useReactFlow();
  const [editingDuration, setEditingDuration] = useState(false);
  const [draftDuration, setDraftDuration] = useState('');
  const duration = (d.durationMinutes || 25) * 60; // seconds
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer logic
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          setRunning(false);
          setCompleted(true);
          if (intervalRef.current) clearInterval(intervalRef.current);
          // Fire wire event
          window.dispatchEvent(new CustomEvent('xtation:wire:fire', {
            detail: { sourceNodeId: id, event: 'timer:complete' }
          }));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  // Reset when duration changes
  useEffect(() => {
    setSecondsLeft(duration);
    setCompleted(false);
    setRunning(false);
  }, [duration]);

  const toggleTimer = useCallback(() => {
    if (completed) {
      // Reset
      setSecondsLeft(duration);
      setCompleted(false);
      setRunning(false);
    } else {
      setRunning(prev => !prev);
    }
  }, [completed, duration]);

  const resetTimer = useCallback(() => {
    setSecondsLeft(duration);
    setCompleted(false);
    setRunning(false);
  }, [duration]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progress = 1 - secondsLeft / duration;

  return (
    <div
      className={`xt-canvas-node xt-canvas-node--timer ${selected ? 'is-selected' : ''} ${running ? 'is-running' : ''} ${completed ? 'is-completed' : ''}`}
      style={{ background: d.color || '#16161c' }}
    >
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
        <span className="xt-canvas-node-type">TIMER</span>
        <span className="xt-canvas-node-status" style={{ color: running ? '#74e2b8' : completed ? 'var(--app-accent)' : 'var(--app-muted)' }}>
          {running ? 'running' : completed ? 'done' : 'ready'}
        </span>
      </div>

      <div className="xt-canvas-timer-display">
        <span className="xt-canvas-timer-time">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
      </div>

      {/* Progress bar */}
      <div className="xt-canvas-timer-progress">
        <div className="xt-canvas-timer-progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Controls */}
      <div className="xt-canvas-timer-controls">
        <button
          type="button"
          className="xt-canvas-timer-btn"
          onClick={toggleTimer}
          onPointerDown={e => e.stopPropagation()}
        >
          {completed ? <RotateCcw size={14} /> : running ? <Pause size={14} /> : <Play size={14} />}
        </button>
        {!completed && (running || secondsLeft < duration) ? (
          <button
            type="button"
            className="xt-canvas-timer-btn"
            onClick={resetTimer}
            onPointerDown={e => e.stopPropagation()}
          >
            <RotateCcw size={12} />
          </button>
        ) : null}
      </div>

      <div className="xt-canvas-node-meta">
        {editingDuration ? (
          <input
            autoFocus
            type="number"
            min={1}
            max={240}
            className="xt-canvas-node-inline-edit"
            style={{ width: 48, textAlign: 'center' }}
            value={draftDuration}
            onChange={e => setDraftDuration(e.target.value)}
            onBlur={() => {
              setEditingDuration(false);
              const val = Math.max(1, Math.min(240, parseInt(draftDuration, 10) || 25));
              setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, durationMinutes: val } } : n));
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditingDuration(false);
            }}
            onPointerDown={e => e.stopPropagation()}
          />
        ) : (
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => { setEditingDuration(true); setDraftDuration(String(d.durationMinutes || 25)); }}
            onPointerDown={e => e.stopPropagation()}
          >
            {d.durationMinutes || 25} min
          </span>
        )}
      </div>
    </div>
  );
}, (prev, next) => prev.id === next.id && prev.selected === next.selected && prev.data === next.data);
