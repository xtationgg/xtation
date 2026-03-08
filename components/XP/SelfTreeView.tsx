import React, { useState } from 'react';
import { Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { useXP } from './xpStore';
import { SelfTreeBranch, SelfTreeNode } from './xpTypes';
import { SelfTreeNodeModal } from './SelfTreeNodeModal';

const BRANCH_DESCRIPTIONS: Record<SelfTreeBranch, string> = {
  Knowledge: 'Learning, research, reading, understanding',
  Creation: 'Building, writing, art, design, making',
  Systems: 'Processes, tools, automation, organization',
  Communication: 'Speaking, writing, relationships, influence',
  Physical: 'Health, fitness, nutrition, movement',
  Inner: 'Mindset, reflection, focus, identity',
};

const BRANCHES: SelfTreeBranch[] = [
  'Knowledge', 'Creation', 'Systems', 'Communication', 'Physical', 'Inner',
];

interface BranchSectionProps {
  branch: SelfTreeBranch;
  nodes: SelfTreeNode[];
  allNodes: SelfTreeNode[];
  onAddNode: (branch: SelfTreeBranch) => void;
  onEditNode: (node: SelfTreeNode) => void;
}

const NodeRow: React.FC<{
  node: SelfTreeNode;
  children: SelfTreeNode[];
  allNodes: SelfTreeNode[];
  depth: number;
  onEdit: (node: SelfTreeNode) => void;
}> = ({ node, children, allNodes, depth, onEdit }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)] cursor-pointer group"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onEdit(node)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(node); } }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded((p) => !p); }}
            className="shrink-0 text-[var(--app-muted)] hover:text-[var(--app-text)]"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="flex-1 truncate text-[12px] leading-5 text-[var(--app-text)]">{node.title}</span>
        {node.description ? (
          <span className="hidden group-hover:inline truncate max-w-[160px] text-[10px] text-[var(--app-muted)]">
            {node.description}
          </span>
        ) : null}
      </div>
      {hasChildren && expanded ? (
        <div>
          {children.map((child) => (
            <NodeRow
              key={child.id}
              node={child}
              children={allNodes.filter((n) => n.parentId === child.id)}
              allNodes={allNodes}
              depth={depth + 1}
              onEdit={onEdit}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const BranchSection: React.FC<BranchSectionProps> = ({
  branch,
  nodes,
  allNodes,
  onAddNode,
  onEditNode,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const rootNodes = nodes.filter((n) => !n.parentId);

  return (
    <div className="rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] overflow-hidden">
      <div
        className="flex items-center justify-between gap-2 px-3 py-2.5 bg-[color-mix(in_srgb,var(--app-panel-2)_60%,transparent)] cursor-pointer"
        onClick={() => setCollapsed((p) => !p)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed((p) => !p); } }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {collapsed ? <ChevronRight size={13} className="shrink-0 text-[var(--app-muted)]" /> : <ChevronDown size={13} className="shrink-0 text-[var(--app-muted)]" />}
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-text)]">
            {branch}
          </span>
          {nodes.length > 0 ? (
            <span className="text-[9px] text-[var(--app-muted)] font-mono">{nodes.length}</span>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={`Add node to ${branch}`}
          onClick={(e) => { e.stopPropagation(); onAddNode(branch); }}
          className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>

      {!collapsed ? (
        <div className="border-t border-[var(--app-border)]">
          {rootNodes.length ? (
            <div className="py-1">
              {rootNodes.map((node) => (
                <NodeRow
                  key={node.id}
                  node={node}
                  children={nodes.filter((n) => n.parentId === node.id)}
                  allNodes={nodes}
                  depth={0}
                  onEdit={onEditNode}
                />
              ))}
            </div>
          ) : (
            <div className="px-3 py-3 text-[10px] text-[var(--app-muted)]">
              {BRANCH_DESCRIPTIONS[branch]}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export const SelfTreeView: React.FC = () => {
  const { selfTreeNodes, addSelfTreeNode, updateSelfTreeNode, deleteSelfTreeNode } = useXP();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<SelfTreeNode | null>(null);
  const [addBranch, setAddBranch] = useState<SelfTreeBranch | undefined>(undefined);

  const openAdd = (branch: SelfTreeBranch) => {
    setEditingNode(null);
    setAddBranch(branch);
    setModalOpen(true);
  };

  const openEdit = (node: SelfTreeNode) => {
    setEditingNode(node);
    setAddBranch(undefined);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingNode(null);
    setAddBranch(undefined);
  };

  const handleSave = (draft: Omit<SelfTreeNode, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingNode) {
      updateSelfTreeNode(editingNode.id, draft);
    } else {
      addSelfTreeNode(draft);
    }
    closeModal();
  };

  const handleDelete = () => {
    if (editingNode) {
      deleteSelfTreeNode(editingNode.id);
    }
    closeModal();
  };

  return (
    <div className="space-y-2">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">
            Self Tree
          </h3>
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--app-muted)]">
            {selfTreeNodes.length} nodes across 6 branches
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {BRANCHES.map((branch) => (
          <BranchSection
            key={branch}
            branch={branch}
            nodes={selfTreeNodes.filter((n) => n.rootBranch === branch)}
            allNodes={selfTreeNodes}
            onAddNode={openAdd}
            onEditNode={openEdit}
          />
        ))}
      </div>

      <SelfTreeNodeModal
        open={modalOpen}
        node={editingNode}
        allNodes={selfTreeNodes}
        defaultBranch={addBranch}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={editingNode ? handleDelete : undefined}
      />
    </div>
  );
};
