import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ConfirmModal } from '../UI/ConfirmModal';
import { SelfTreeNode, SelfTreeBranch } from './xpTypes';

const SELF_TREE_BRANCHES: SelfTreeBranch[] = [
  'Knowledge', 'Creation', 'Systems', 'Communication', 'Physical', 'Inner',
];

interface NodeDraft {
  rootBranch: SelfTreeBranch;
  title: string;
  description: string;
  parentId?: string;
}

interface SelfTreeNodeModalProps {
  open: boolean;
  node: SelfTreeNode | null;
  /** Existing nodes for the parentId selector. */
  allNodes: SelfTreeNode[];
  /** If set, lock the rootBranch to this value. */
  defaultBranch?: SelfTreeBranch;
  onClose: () => void;
  onSave: (draft: Omit<SelfTreeNode, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: () => void;
}

const defaultDraft = (branch?: SelfTreeBranch): NodeDraft => ({
  rootBranch: branch ?? 'Knowledge',
  title: '',
  description: '',
  parentId: undefined,
});

const serialize = (draft: NodeDraft) => JSON.stringify(draft);

export const SelfTreeNodeModal: React.FC<SelfTreeNodeModalProps> = ({
  open,
  node,
  allNodes,
  defaultBranch,
  onClose,
  onSave,
  onDelete,
}) => {
  const [draft, setDraft] = useState<NodeDraft>(defaultDraft(defaultBranch));
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const initialSnapshotRef = useRef('');
  const isDirtyRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const nextDraft: NodeDraft = node
      ? {
          rootBranch: node.rootBranch,
          title: node.title,
          description: node.description ?? '',
          parentId: node.parentId,
        }
      : defaultDraft(defaultBranch);
    setDraft(nextDraft);
    initialSnapshotRef.current = serialize(nextDraft);
  }, [open, node, defaultBranch]);

  const isDirty = useMemo(
    () => open && serialize(draft) !== initialSnapshotRef.current,
    [open, draft]
  );

  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  const attemptClose = useCallback(() => {
    if (isDirtyRef.current) { setShowDiscardConfirm(true); return; }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); attemptClose(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, attemptClose]);

  const handleSave = () => {
    const title = draft.title.trim();
    if (!title) return;
    onSave({
      rootBranch: draft.rootBranch,
      title,
      description: draft.description.trim() || undefined,
      parentId: draft.parentId || undefined,
    });
  };

  // Eligible parent nodes: same branch, not the node itself or its descendants
  const eligibleParents = allNodes.filter(
    (n) => n.rootBranch === draft.rootBranch && n.id !== node?.id
  );

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[195] flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="Close node modal"
          onClick={attemptClose}
          className="absolute inset-0 bg-black/45"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={node ? 'Edit node' : 'Add node'}
          className="relative w-full max-w-[520px] rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] p-5"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">
              {node ? 'Edit Node' : 'Add Node'}
            </h2>
            <button
              type="button"
              onClick={attemptClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-2)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Branch</label>
              <select
                value={draft.rootBranch}
                disabled={!!defaultBranch}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, rootBranch: e.target.value as SelfTreeBranch, parentId: undefined }))
                }
                className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] disabled:opacity-60"
              >
                {SELF_TREE_BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Title</label>
              <input
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2.5 text-[14px] font-medium leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                placeholder="Node title"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Description</label>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                className="min-h-[64px] w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2.5 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                placeholder="Optional description"
              />
            </div>

            {eligibleParents.length > 0 ? (
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Parent Node</label>
                <select
                  value={draft.parentId ?? ''}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, parentId: e.target.value || undefined }))
                  }
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="">Root (no parent)</option>
                  {eligibleParents.map((n) => (
                    <option key={n.id} value={n.id}>{n.title}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div>
              {node && onDelete ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-lg border border-[color-mix(in_srgb,var(--app-accent)_35%,transparent)] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--app-accent)] hover:border-[var(--app-accent)]"
                >
                  Delete
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={attemptClose}
                className="rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-2)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--app-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!draft.title.trim()}
                className="rounded-lg border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-panel))] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text)] disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showDiscardConfirm}
        title="Discard changes?"
        message="You have unsaved edits in this node modal."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => { setShowDiscardConfirm(false); onClose(); }}
      />

      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete node"
        message="This will delete the node. Child nodes will be moved to root."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => { setShowDeleteConfirm(false); onDelete?.(); }}
      />
    </>
  );
};
