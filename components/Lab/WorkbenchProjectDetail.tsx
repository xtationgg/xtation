import React, { useMemo } from 'react';
import { FileText, Package, Pause, PlayCircle, Plus, Send, Trash2 } from 'lucide-react';
import { useLab } from '../../src/lab/LabProvider';
import { useXP } from '../XP/xpStore';
import { openDuskBrief } from '../../src/dusk/bridge';
import type { LabProjectKind, LabAssistantProject } from '../../src/lab/types';
import {
  projectKindOptions,
  panelButton,
  detailPanel,
  iconButton,
  fieldInput,
  fieldTextarea,
  inlineChip,
  formatRelativeTime,
  toggleId,
} from './shared';

interface WorkbenchProjectDetailProps {
  projectId: string;
  onSelectNote?: (id: string) => void;
}

export const WorkbenchProjectDetail: React.FC<WorkbenchProjectDetailProps> = ({
  projectId,
  onSelectNote,
}) => {
  const {
    assistantProjects,
    notes,
    automations,
    addNote,
    updateAssistantProject,
    deleteAssistantProject,
  } = useLab();
  const { tasks, inventorySlots, updateInventorySlot } = useXP();

  const selectedProject = useMemo(
    () => assistantProjects.find((p) => p.id === projectId) ?? null,
    [assistantProjects, projectId]
  );

  const selectedProjectNotes = useMemo(
    () => notes.filter((note) => selectedProject?.linkedNoteIds.includes(note.id)),
    [notes, selectedProject]
  );
  const selectedProjectAutomations = useMemo(
    () => automations.filter((a) => selectedProject?.linkedAutomationIds.includes(a.id)),
    [automations, selectedProject]
  );
  const selectedProjectTasks = useMemo(
    () => tasks.filter((task) => selectedProject?.linkedQuestIds.includes(task.id)),
    [tasks, selectedProject]
  );
  const selectedProjectInventorySlots = useMemo(
    () =>
      inventorySlots.filter(
        (slot) => selectedProject?.linkedInventorySlotIds?.includes(slot.id) && !slot.archivedAt
      ),
    [inventorySlots, selectedProject]
  );

  if (!selectedProject) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-sm text-[var(--app-muted)]">
        No project selected.
      </div>
    );
  }

  const handoffToDusk = (
    title: string,
    body: string,
    tags: string[] = [],
    linkedQuestIds: string[] = [],
    linkedProjectIds: string[] = []
  ) => {
    openDuskBrief({ title, body, source: 'lab', tags, linkedQuestIds, linkedProjectIds });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header with title, status toggle, delete */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={selectedProject.title}
            onChange={(e) =>
              updateAssistantProject(selectedProject.id, { title: e.target.value })
            }
            className="w-full bg-transparent text-2xl font-semibold text-[var(--app-text)] outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
            <span>{selectedProject.kind}</span>
            <span>&middot;</span>
            <span>{selectedProject.status}</span>
            <span>&middot;</span>
            <span>Updated {formatRelativeTime(selectedProject.updatedAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              updateAssistantProject(selectedProject.id, {
                status: selectedProject.status === 'active' ? 'paused' : 'active',
              })
            }
            className={iconButton}
          >
            {selectedProject.status === 'active' ? (
              <Pause size={14} />
            ) : (
              <PlayCircle size={14} />
            )}
          </button>
          <button
            type="button"
            onClick={() => deleteAssistantProject(selectedProject.id)}
            className={iconButton}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Kind and Status selects */}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
          <span className="text-[10px] uppercase tracking-[0.18em]">Kind</span>
          <select
            value={selectedProject.kind}
            onChange={(e) =>
              updateAssistantProject(selectedProject.id, {
                kind: e.target.value as LabProjectKind,
              })
            }
            className={fieldInput}
          >
            {projectKindOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
          <span className="text-[10px] uppercase tracking-[0.18em]">Status</span>
          <select
            value={selectedProject.status}
            onChange={(e) =>
              updateAssistantProject(selectedProject.id, {
                status: e.target.value as LabAssistantProject['status'],
              })
            }
            className={fieldInput}
          >
            {['active', 'paused', 'draft', 'archived'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Summary */}
      <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
        <span className="text-[10px] uppercase tracking-[0.18em]">Summary</span>
        <textarea
          value={selectedProject.summary}
          onChange={(e) =>
            updateAssistantProject(selectedProject.id, { summary: e.target.value })
          }
          className={fieldTextarea}
        />
      </label>

      {/* Next Action */}
      <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
        <span className="text-[10px] uppercase tracking-[0.18em]">Next Action</span>
        <input
          value={selectedProject.nextAction}
          onChange={(e) =>
            updateAssistantProject(selectedProject.id, { nextAction: e.target.value })
          }
          className={fieldInput}
        />
      </label>

      {/* Linked entities */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${detailPanel} p-4`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
            Linked Notes
          </div>
          <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
            {notes.map((note) => (
              <label
                key={note.id}
                className="flex items-start gap-2 text-sm text-[var(--app-muted)]"
              >
                <input
                  type="checkbox"
                  checked={selectedProject.linkedNoteIds.includes(note.id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? Array.from(new Set([...selectedProject.linkedNoteIds, note.id]))
                      : selectedProject.linkedNoteIds.filter((id) => id !== note.id);
                    updateAssistantProject(selectedProject.id, { linkedNoteIds: next });
                  }}
                />
                <span className="leading-5">{note.title}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={`${detailPanel} p-4`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
            Linked Quests
          </div>
          <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
            {tasks.slice(0, 12).map((task) => (
              <label
                key={task.id}
                className="flex items-start gap-2 text-sm text-[var(--app-muted)]"
              >
                <input
                  type="checkbox"
                  checked={selectedProject.linkedQuestIds.includes(task.id)}
                  onChange={() =>
                    updateAssistantProject(selectedProject.id, {
                      linkedQuestIds: toggleId(selectedProject.linkedQuestIds, task.id),
                    })
                  }
                />
                <span className="leading-5">{task.title}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={`${detailPanel} p-4`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
            Linked Rules
          </div>
          <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
            {automations.map((automation) => (
              <label
                key={automation.id}
                className="flex items-start gap-2 text-sm text-[var(--app-muted)]"
              >
                <input
                  type="checkbox"
                  checked={selectedProject.linkedAutomationIds.includes(automation.id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? Array.from(
                          new Set([...selectedProject.linkedAutomationIds, automation.id])
                        )
                      : selectedProject.linkedAutomationIds.filter((id) => id !== automation.id);
                    updateAssistantProject(selectedProject.id, {
                      linkedAutomationIds: next,
                    });
                  }}
                />
                <span className="leading-5">{automation.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Summary panels */}
      <div className="grid gap-4 lg:grid-cols-4">
        <div className={`${detailPanel} p-4`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
            Notes In Context
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {selectedProjectNotes.length ? (
              selectedProjectNotes.map((note) => (
                <div
                  key={note.id}
                  className={`${inlineChip} px-3 py-2 text-sm text-[var(--app-text)]`}
                >
                  {note.title}
                </div>
              ))
            ) : (
              <div className="text-sm text-[var(--app-muted)]">No notes linked yet.</div>
            )}
          </div>
        </div>
        <div className={`${detailPanel} p-4`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
            Quest Links
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {selectedProjectTasks.length ? (
              selectedProjectTasks.map((task) => (
                <div
                  key={task.id}
                  className={`${inlineChip} px-3 py-2 text-sm text-[var(--app-text)]`}
                >
                  {task.title}
                </div>
              ))
            ) : (
              <div className="text-sm text-[var(--app-muted)]">No quest links yet.</div>
            )}
          </div>
        </div>
        <div className={`${detailPanel} p-4`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
            Automation Links
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {selectedProjectAutomations.length ? (
              selectedProjectAutomations.map((a) => (
                <div
                  key={a.id}
                  className={`${inlineChip} px-3 py-2 text-sm text-[var(--app-text)]`}
                >
                  {a.name}
                </div>
              ))
            ) : (
              <div className="text-sm text-[var(--app-muted)]">No automation links yet.</div>
            )}
          </div>
        </div>
        <div className={`${detailPanel} p-4`}>
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
              Gear / Inventory
            </div>
            <Package size={12} className="text-[var(--app-muted)] opacity-60" />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {selectedProjectInventorySlots.length ? (
              selectedProjectInventorySlots.map((slot) => (
                <div key={slot.id} className="xt-lab-gear-slot-chip">
                  <span className="xt-lab-gear-slot-cat">{slot.category}</span>
                  <span className="flex-1 truncate text-[12px] text-[var(--app-text)]">
                    {slot.name}
                  </span>
                  <button
                    type="button"
                    title="Unlink"
                    onClick={() => {
                      updateAssistantProject(selectedProject.id, {
                        linkedInventorySlotIds: (
                          selectedProject.linkedInventorySlotIds || []
                        ).filter((id) => id !== slot.id),
                      });
                      updateInventorySlot(slot.id, {
                        linkedProjectIds: (slot.linkedProjectIds || []).filter(
                          (id) => id !== selectedProject.id
                        ),
                      });
                    }}
                    className="xt-lab-gear-unlink-btn"
                  >
                    x
                  </button>
                </div>
              ))
            ) : (
              <div className="text-sm text-[var(--app-muted)]">No gear linked yet.</div>
            )}
            {inventorySlots.filter(
              (s) =>
                !s.archivedAt && !selectedProject.linkedInventorySlotIds?.includes(s.id)
            ).length > 0 && (
              <div className="mt-2">
                <div className="mb-[6px] text-[9px] uppercase tracking-[1.2px] text-[var(--app-muted)]">
                  Link item
                </div>
                <div className="xt-scroll flex max-h-[120px] flex-col gap-[4px] overflow-y-auto">
                  {inventorySlots
                    .filter(
                      (s) =>
                        !s.archivedAt &&
                        !selectedProject.linkedInventorySlotIds?.includes(s.id)
                    )
                    .map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => {
                          updateAssistantProject(selectedProject.id, {
                            linkedInventorySlotIds: Array.from(
                              new Set([
                                ...(selectedProject.linkedInventorySlotIds || []),
                                slot.id,
                              ])
                            ),
                          });
                          updateInventorySlot(slot.id, {
                            linkedProjectIds: Array.from(
                              new Set([...(slot.linkedProjectIds || []), selectedProject.id])
                            ),
                          });
                        }}
                        className="xt-lab-gear-add-btn"
                      >
                        <Plus size={10} />
                        <span className="truncate">{slot.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            handoffToDusk(
              selectedProject.title,
              `${selectedProject.summary}\n\nNext action: ${selectedProject.nextAction}`,
              [selectedProject.kind, 'assistant-project'],
              selectedProject.linkedQuestIds,
              [selectedProject.id]
            )
          }
          className={`${panelButton} border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)]`}
        >
          <Send size={14} />
          Hand Off To Dusk
        </button>
        <button
          type="button"
          onClick={() => {
            const noteId = addNote({
              title: `${selectedProject.title} brief`,
              content: `${selectedProject.summary}\n\nNext action: ${selectedProject.nextAction}`,
              kind: 'brief',
              tags: [selectedProject.kind, 'assistant-project'],
              linkedQuestIds: selectedProject.linkedQuestIds,
              linkedProjectIds: [selectedProject.id],
            });
            updateAssistantProject(selectedProject.id, {
              linkedNoteIds: Array.from(
                new Set([...selectedProject.linkedNoteIds, noteId])
              ),
            });
            onSelectNote?.(noteId);
          }}
          className={`${panelButton} border border-[var(--app-border)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
        >
          <FileText size={14} />
          Create Brief Note
        </button>
      </div>
    </div>
  );
};
