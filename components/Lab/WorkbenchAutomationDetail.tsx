import React, { useMemo } from 'react';
import { Pause, PlayCircle, Send, Trash2 } from 'lucide-react';
import { useLab } from '../../src/lab/LabProvider';
import { openDuskBrief } from '../../src/dusk/bridge';
import type { LabAutomationScope, LabAutomationMode } from '../../src/lab/types';
import {
  automationScopeOptions,
  automationModeOptions,
  panelButton,
  detailPanel,
  iconButton,
  fieldInput,
  fieldTextarea,
  inlineChip,
  formatRelativeTime,
  toggleId,
} from './shared';

interface WorkbenchAutomationDetailProps {
  automationId: string;
}

export const WorkbenchAutomationDetail: React.FC<WorkbenchAutomationDetailProps> = ({
  automationId,
}) => {
  const {
    automations,
    notes,
    assistantProjects,
    updateAutomation,
    toggleAutomation,
    runAutomation,
    deleteAutomation,
  } = useLab();

  const selectedAutomation = useMemo(
    () => automations.find((a) => a.id === automationId) ?? null,
    [automations, automationId]
  );

  if (!selectedAutomation) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-sm text-[var(--app-muted)]">
        No automation selected.
      </div>
    );
  }

  const handoffToDusk = (title: string, body: string, tags: string[] = [], linkedQuestIds: string[] = [], linkedProjectIds: string[] = []) => {
    openDuskBrief({ title, body, source: 'lab', tags, linkedQuestIds, linkedProjectIds });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <input
          value={selectedAutomation.name}
          onChange={(e) => updateAutomation(selectedAutomation.id, { name: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-[var(--app-text)] outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleAutomation(selectedAutomation.id)}
            className={`${iconButton} ${
              selectedAutomation.enabled
                ? 'border-[color-mix(in_srgb,#74e2b8_40%,transparent)] bg-[color-mix(in_srgb,#74e2b8_12%,transparent)] text-[#74e2b8]'
                : 'border-[var(--app-border)] text-[var(--app-muted)]'
            }`}
          >
            {selectedAutomation.enabled ? <Pause size={14} /> : <PlayCircle size={14} />}
          </button>
          <button type="button" onClick={() => deleteAutomation(selectedAutomation.id)} className={iconButton}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Scope, Mode, Last Run */}
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
          <span className="text-[10px] uppercase tracking-[0.18em]">Scope</span>
          <select
            value={selectedAutomation.scope}
            onChange={(e) => updateAutomation(selectedAutomation.id, { scope: e.target.value as LabAutomationScope })}
            className={fieldInput}
          >
            {automationScopeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
          <span className="text-[10px] uppercase tracking-[0.18em]">Mode</span>
          <select
            value={selectedAutomation.mode}
            onChange={(e) => updateAutomation(selectedAutomation.id, { mode: e.target.value as LabAutomationMode })}
            className={fieldInput}
          >
            {automationModeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <div className={`${detailPanel} px-3 py-3`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Last Run</div>
          <div className="mt-2 text-sm text-[var(--app-text)]">{formatRelativeTime(selectedAutomation.lastRunAt)}</div>
        </div>
      </div>

      {/* Description */}
      <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
        <span className="text-[10px] uppercase tracking-[0.18em]">Description</span>
        <textarea
          value={selectedAutomation.description}
          onChange={(e) => updateAutomation(selectedAutomation.id, { description: e.target.value })}
          className={`${fieldTextarea} min-h-[90px]`}
        />
      </label>

      {/* Trigger and Action */}
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
          <span className="text-[10px] uppercase tracking-[0.18em]">Trigger</span>
          <textarea
            value={selectedAutomation.triggerSummary}
            onChange={(e) => updateAutomation(selectedAutomation.id, { triggerSummary: e.target.value })}
            className={`${fieldTextarea} min-h-[90px]`}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
          <span className="text-[10px] uppercase tracking-[0.18em]">Action</span>
          <textarea
            value={selectedAutomation.actionSummary}
            onChange={(e) => updateAutomation(selectedAutomation.id, { actionSummary: e.target.value })}
            className={`${fieldTextarea} min-h-[90px]`}
          />
        </label>
      </div>

      {/* Linked Notes and Projects */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${detailPanel} p-4`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Linked Notes</div>
          <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
            {notes.map((note) => (
              <label key={note.id} className="flex items-start gap-2 text-sm text-[var(--app-muted)]">
                <input
                  type="checkbox"
                  checked={selectedAutomation.linkedNoteIds.includes(note.id)}
                  onChange={() =>
                    updateAutomation(selectedAutomation.id, {
                      linkedNoteIds: toggleId(selectedAutomation.linkedNoteIds, note.id),
                    })
                  }
                />
                <span>{note.title}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={`${detailPanel} p-4`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Linked Projects</div>
          <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
            {assistantProjects.map((project) => (
              <label key={project.id} className="flex items-start gap-2 text-sm text-[var(--app-muted)]">
                <input
                  type="checkbox"
                  checked={selectedAutomation.linkedProjectIds.includes(project.id)}
                  onChange={() =>
                    updateAutomation(selectedAutomation.id, {
                      linkedProjectIds: toggleId(selectedAutomation.linkedProjectIds, project.id),
                    })
                  }
                />
                <span>{project.title}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => runAutomation(selectedAutomation.id)}
          className={`${panelButton} border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)]`}
        >
          <PlayCircle size={14} />
          Run Now
        </button>
        <button
          type="button"
          onClick={() =>
            handoffToDusk(
              selectedAutomation.name,
              `${selectedAutomation.description}\n\nTrigger: ${selectedAutomation.triggerSummary}\nAction: ${selectedAutomation.actionSummary}`,
              [selectedAutomation.scope, selectedAutomation.mode, 'automation'],
              [],
              selectedAutomation.linkedProjectIds
            )
          }
          className={`${panelButton} border border-[var(--app-border)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
        >
          <Send size={14} />
          Hand Off To Dusk
        </button>
      </div>
    </div>
  );
};
