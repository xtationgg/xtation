import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import { ConfirmModal } from '../UI/ConfirmModal';
import {
  Project,
  Milestone,
  ProjectType,
  ProjectStatus,
  QuestLevel,
  SelfTreeBranch,
} from '../XP/xpTypes';

interface ProjectDraft {
  title: string;
  description: string;
  type: ProjectType;
  level: QuestLevel;
  status: ProjectStatus;
  selfTreePrimary: SelfTreeBranch;
  selfTreeSecondary?: SelfTreeBranch;
  dueDate?: number;
}

interface MilestoneDraft {
  id: string;
  title: string;
  rewardXP?: number;
  isCompleted: boolean;
}

interface ProjectModalProps {
  open: boolean;
  project: Project | null;
  milestones: Milestone[];
  onClose: () => void;
  onSave: (draft: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: () => void;
  onAddMilestone: (title: string, rewardXP?: number) => void;
  onDeleteMilestone: (id: string) => void;
  onCompleteMilestone: (id: string) => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const PROJECT_TYPES: ProjectType[] = ['Learning', 'Build', 'Business', 'Health', 'Personal'];
const PROJECT_STATUSES: ProjectStatus[] = ['Draft', 'Active', 'OnHold', 'Completed', 'Archived'];
const SELF_TREE_BRANCHES: SelfTreeBranch[] = [
  'Knowledge', 'Creation', 'Systems', 'Communication', 'Physical', 'Inner',
];

const defaultDraft: ProjectDraft = {
  title: '',
  description: '',
  type: 'Personal',
  level: 1,
  status: 'Draft',
  selfTreePrimary: 'Knowledge',
  selfTreeSecondary: undefined,
  dueDate: undefined,
};

const serializeDraft = (draft: ProjectDraft, milestones: MilestoneDraft[]) =>
  JSON.stringify({ ...draft, milestones: milestones.map((m) => m.title) });

const toDateInputValue = (ts?: number) => {
  if (!ts) return '';
  const d = new Date(ts);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(ts - offset).toISOString().slice(0, 10);
};

const fromDateInputValue = (value: string): number | undefined => {
  if (!value) return undefined;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : undefined;
};

export const ProjectModal: React.FC<ProjectModalProps> = ({
  open,
  project,
  milestones,
  onClose,
  onSave,
  onDelete,
  onAddMilestone,
  onDeleteMilestone,
  onCompleteMilestone,
}) => {
  const [draft, setDraft] = useState<ProjectDraft>(defaultDraft);
  const [newMilestoneText, setNewMilestoneText] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const initialSnapshotRef = useRef('');
  const isDirtyRef = useRef(false);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const projectMilestones = useMemo(
    () => milestones.filter((m) => m.projectId === project?.id),
    [milestones, project?.id]
  );

  useEffect(() => {
    if (!open) return;
    const nextDraft: ProjectDraft = project
      ? {
          title: project.title,
          description: project.description ?? '',
          type: project.type,
          level: project.level,
          status: project.status,
          selfTreePrimary: project.selfTreePrimary,
          selfTreeSecondary: project.selfTreeSecondary,
          dueDate: project.dueDate,
        }
      : { ...defaultDraft };
    setDraft(nextDraft);
    setNewMilestoneText('');
    initialSnapshotRef.current = serializeDraft(nextDraft, []);
  }, [open, project]);

  const isDirty = useMemo(() => {
    if (!open) return false;
    return serializeDraft(draft, []) !== initialSnapshotRef.current;
  }, [open, draft]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const attemptClose = useCallback(() => {
    if (isDirtyRef.current) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        attemptClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, attemptClose]);

  const handleSave = () => {
    const title = draft.title.trim();
    if (!title) return;
    onSave({
      title,
      description: draft.description.trim() || undefined,
      type: draft.type,
      level: draft.level,
      status: draft.status,
      selfTreePrimary: draft.selfTreePrimary,
      selfTreeSecondary: draft.selfTreeSecondary,
      dueDate: draft.dueDate,
    });
  };

  const addMilestone = () => {
    const text = newMilestoneText.trim();
    if (!text || !project) return;
    onAddMilestone(text);
    setNewMilestoneText('');
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="Close project modal"
          onClick={attemptClose}
          className="absolute inset-0 bg-black/45"
        />

        <div
          ref={surfaceRef}
          role="dialog"
          aria-modal="true"
          aria-label={project ? 'Edit project' : 'Create project'}
          className="relative w-full max-w-[640px] rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] p-5 transition-all duration-200 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">
              {project ? 'Edit Project' : 'New Project'}
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
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Title</label>
              <input
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2.5 text-[14px] font-medium leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                placeholder="Project title"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Description</label>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                className="min-h-[72px] w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2.5 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                placeholder="Optional description"
              />
            </div>

            {/* Type + Level */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Type</label>
                <select
                  value={draft.type}
                  onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value as ProjectType }))}
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                >
                  {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Level</label>
                <select
                  value={draft.level}
                  onChange={(e) => setDraft((p) => ({ ...p, level: Number(e.target.value) as QuestLevel }))}
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value={1}>L1 — Standard</option>
                  <option value={2}>L2 — Focused</option>
                  <option value={3}>L3 — Priority</option>
                  <option value={4}>L4 — Critical</option>
                </select>
              </div>
            </div>

            {/* Status + Due Date */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Status</label>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value as ProjectStatus }))}
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                >
                  {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Due Date</label>
                <input
                  type="date"
                  value={toDateInputValue(draft.dueDate)}
                  onChange={(e) => setDraft((p) => ({ ...p, dueDate: fromDateInputValue(e.target.value) }))}
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>
            </div>

            {/* Self Tree Primary + Secondary */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Primary Branch</label>
                <select
                  value={draft.selfTreePrimary}
                  onChange={(e) => setDraft((p) => ({ ...p, selfTreePrimary: e.target.value as SelfTreeBranch }))}
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                >
                  {SELF_TREE_BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Secondary Branch</label>
                <select
                  value={draft.selfTreeSecondary ?? ''}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      selfTreeSecondary: e.target.value ? (e.target.value as SelfTreeBranch) : undefined,
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-2 text-[13px] leading-5 text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="">None</option>
                  {SELF_TREE_BRANCHES.filter((b) => b !== draft.selfTreePrimary).map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Milestones — only shown when editing an existing project */}
            {project ? (
              <div className="space-y-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-2)] p-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Milestones</div>
                <div className="flex gap-2">
                  <input
                    value={newMilestoneText}
                    onChange={(e) => setNewMilestoneText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMilestone(); } }}
                    className="flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1.5 text-[12px] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)]"
                    placeholder="Add milestone"
                  />
                  <button
                    type="button"
                    onClick={addMilestone}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-text)] hover:border-[var(--app-accent)]"
                    aria-label="Add milestone"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {projectMilestones.length ? (
                  <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                    {projectMilestones.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1 text-xs text-[var(--app-text)]"
                      >
                        <input
                          type="checkbox"
                          checked={m.isCompleted}
                          onChange={() => onCompleteMilestone(m.id)}
                          className="h-3.5 w-3.5"
                        />
                        <span className={`flex-1 leading-4 ${m.isCompleted ? 'line-through opacity-60' : ''}`}>
                          {m.title}
                        </span>
                        <button
                          type="button"
                          aria-label="Delete milestone"
                          onClick={() => onDeleteMilestone(m.id)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--app-border)] text-[var(--app-muted)] hover:text-[var(--app-accent)]"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div>
              {project && onDelete ? (
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
        message="You have unsaved edits in this project modal."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => { setShowDiscardConfirm(false); onClose(); }}
      />

      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete project"
        message="This action removes the project. Quests linked to it will be unlinked."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => { setShowDeleteConfirm(false); onDelete?.(); }}
      />
    </>
  );
};
