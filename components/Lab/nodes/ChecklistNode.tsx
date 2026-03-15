import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeToolbar, NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react';
import { CheckSquare, Plus, Copy, Trash2 } from 'lucide-react';
import type { ChecklistNodeData } from '../canvasTypes';
import { NODE_COLORS, createId } from '../canvasTypes';

export const ChecklistNode = memo(function ChecklistNode({ data, id, selected }: NodeProps) {
  const d = data as ChecklistNodeData;
  const { setNodes, setEdges } = useReactFlow();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const doneCount = d.items?.filter((i) => i.done).length ?? 0;
  const totalCount = d.items?.length ?? 0;

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setDraft(currentValue);
  };

  const commitEdit = useCallback((field: string) => {
    setEditingField(null);
    if (field.startsWith('item-')) {
      const idx = parseInt(field.replace('item-', ''), 10);
      setNodes(nds => nds.map(n => {
        if (n.id !== id) return n;
        const items = [...(n.data as ChecklistNodeData).items];
        items[idx] = { ...items[idx], text: draft };
        return { ...n, data: { ...n.data, items } };
      }));
    } else {
      setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: draft } } : n));
    }
  }, [draft, id, setNodes]);

  const handleToggle = (itemIdx: number) => {
    setNodes(nds => {
      const updated = nds.map(n => {
        if (n.id !== id) return n;
        const items = [...(n.data as ChecklistNodeData).items];
        items[itemIdx] = { ...items[itemIdx], done: !items[itemIdx].done };
        return { ...n, data: { ...n.data, items } };
      });
      // Check if all items are now complete
      const node = updated.find(n => n.id === id);
      if (node) {
        const items = (node.data as ChecklistNodeData).items;
        if (items.length > 0 && items.every(i => i.done)) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('xtation:wire:fire', {
              detail: { sourceNodeId: id, event: 'checklist:complete' }
            }));
          }, 100);
        }
      }
      return updated;
    });
  };

  const addItem = () => {
    setNodes(nds => nds.map(n => {
      if (n.id !== id) return n;
      const items = [...(n.data as ChecklistNodeData).items, { id: `item-${Date.now()}`, text: 'New item', done: false }];
      return { ...n, data: { ...n.data, items } };
    }));
  };

  return (
    <div
      className={`xt-canvas-node xt-canvas-node--checklist ${selected ? 'is-selected' : ''}`}
      style={{
        background: d.color || '#1a1a1e',
        width: (d as any).width || undefined,
        height: (d as any).height || undefined,
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={80}
        lineClassName="xt-canvas-resizer-line"
        handleClassName="xt-canvas-resizer-handle"
      />
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
        <span className="xt-canvas-node-type">CHECKLIST</span>
        <span className="xt-canvas-node-status" style={{ color: doneCount === totalCount && totalCount > 0 ? '#74e2b8' : 'var(--app-muted)' }}>
          {doneCount}/{totalCount}
        </span>
      </div>

      <div className="xt-canvas-node-title">
        <CheckSquare size={13} style={{ flexShrink: 0 }} />
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
          <span onClick={() => startEdit('label', d.label ?? '')} style={{ cursor: 'text' }}>{d.label || 'Checklist'}</span>
        )}
      </div>

      <div className="xt-canvas-checklist" style={{ maxHeight: 160, overflowY: 'auto' }}>
        {(d.items || []).map((item, idx) => (
          <div key={item.id} className={`xt-canvas-checklist-item ${item.done ? 'is-done' : ''}`}>
            <input
              type="checkbox"
              className="xt-canvas-checklist-box"
              checked={item.done}
              onChange={() => handleToggle(idx)}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
            {editingField === `item-${idx}` ? (
              <input
                autoFocus
                className="xt-canvas-node-inline-edit"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commitEdit(`item-${idx}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(`item-${idx}`); if (e.key === 'Escape') setEditingField(null); }}
                onPointerDown={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                onClick={() => startEdit(`item-${idx}`, item.text)}
                style={{ cursor: 'text' }}
              >
                {item.text}
              </span>
            )}
          </div>
        ))}
      </div>

      <div
        className="xt-canvas-checklist-add"
        onClick={addItem}
        onPointerDown={e => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', cursor: 'pointer', color: 'var(--app-muted)', fontSize: 11 }}
      >
        <Plus size={12} /> Add item
      </div>

    </div>
  );
}, (prev, next) =>
  prev.id === next.id &&
  prev.selected === next.selected &&
  prev.data === next.data
);
