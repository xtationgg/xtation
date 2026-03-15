import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FileText, Link2, Pin, Plus, Send, Trash2 } from 'lucide-react';
import { useLab } from '../../src/lab/LabProvider';
import { useXP } from '../XP/xpStore';
import { openDuskBrief } from '../../src/dusk/bridge';
import { diffBaselineNote, summarizeBaselineDrift } from '../../src/lab/baselineDiff';
import { buildBaselineCompareHandoff, buildBaselineProvenanceHandoff } from '../../src/lab/baselineHandoff';
import {
  buildBaselineDecisionAnchor,
  formatBaselineProvenanceProvider,
  parseBaselineNoteProvenance,
} from '../../src/lab/baselineProvenance';
import {
  extractWikiLinks,
  getActiveWikiLink,
  getBacklinks,
  getWikiSuggestions,
  insertWikiLink,
} from '../../src/lab/wikiLinks';
import type { LabNote, LabNoteKind } from '../../src/lab/types';
import {
  noteKindOptions,
  panelButton,
  detailPanel,
  iconButton,
  fieldInput,
  fieldTextarea,
  inlineChip,
  formatRelativeTime,
  shortText,
  commaSplit,
  toggleId,
  isBaselineNote,
} from './shared';

interface WorkbenchNoteEditorProps {
  noteId: string;
  onSelectNote: (id: string) => void;
}

export const WorkbenchNoteEditor: React.FC<WorkbenchNoteEditorProps> = ({
  noteId,
  onSelectNote,
}) => {
  const {
    notes,
    assistantProjects,
    updateNote,
    deleteNote,
    addNote,
    updateAssistantProject,
  } = useLab();
  const { tasks, projects, addTask } = useXP();

  const [wikiActive, setWikiActive] = useState<{ query: string; start: number; end: number } | null>(null);
  const [wikiSelectedIdx, setWikiSelectedIdx] = useState(0);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === noteId) ?? null,
    [notes, noteId]
  );

  const baselineNotes = useMemo(
    () => notes.filter((n) => isBaselineNote(n)).sort((a, b) => b.updatedAt - a.updatedAt),
    [notes]
  );

  const baselineProvenanceById = useMemo(
    () => new Map(baselineNotes.map((n) => [n.id, parseBaselineNoteProvenance(n)] as const)),
    [baselineNotes]
  );

  const selectedBaselineIndex = selectedNote && isBaselineNote(selectedNote)
    ? baselineNotes.findIndex((n) => n.id === selectedNote.id)
    : -1;
  const newerBaseline = selectedBaselineIndex > 0 ? baselineNotes[selectedBaselineIndex - 1] : null;
  const olderBaseline = selectedBaselineIndex >= 0 && selectedBaselineIndex < baselineNotes.length - 1
    ? baselineNotes[selectedBaselineIndex + 1]
    : null;
  const baselineDriftFromPrevious = selectedNote && isBaselineNote(selectedNote) && olderBaseline
    ? diffBaselineNote(selectedNote, olderBaseline)
    : null;
  const selectedBaselineProvenance = selectedNote && isBaselineNote(selectedNote)
    ? baselineProvenanceById.get(selectedNote.id) || null
    : null;
  const selectedBaselineDecisionAnchor = buildBaselineDecisionAnchor(selectedBaselineProvenance);
  const newerBaselineProvenance = newerBaseline ? baselineProvenanceById.get(newerBaseline.id) || null : null;
  const olderBaselineProvenance = olderBaseline ? baselineProvenanceById.get(olderBaseline.id) || null : null;
  const latestBaselineNote = baselineNotes[0] ?? null;

  const handoffToDusk = useCallback((title: string, body: string, tags: string[] = [], linkedQuestIds: string[] = [], linkedProjectIds: string[] = []) => {
    openDuskBrief({ title, body, source: 'lab', tags, linkedQuestIds, linkedProjectIds });
  }, []);

  const handleCreateQuestFromNote = useCallback((note: LabNote) => {
    const questId = addTask({
      title: (note?.title ?? '').trim() || 'Lab quest',
      details: note.content,
      priority: 'normal',
      status: 'todo',
      questType: note.kind === 'capture' ? 'instant' : 'session',
      level: note.kind === 'brief' ? 2 : 1,
      selfTreePrimary: 'Systems',
      projectId: projects[0]?.id,
    });
    updateNote(note.id, {
      linkedQuestIds: Array.from(new Set([...note.linkedQuestIds, questId])),
    });
  }, [addTask, projects, updateNote]);

  const sendBaselineCompareToDusk = useCallback((current: LabNote, previous: LabNote) => {
    const payload = buildBaselineCompareHandoff(current, previous);
    handoffToDusk(payload.title, payload.body, payload.tags, payload.linkedQuestIds, payload.linkedProjectIds);
  }, [handoffToDusk]);

  const sendBaselineToDusk = useCallback((note: LabNote) => {
    const noteIndex = baselineNotes.findIndex((entry) => entry.id === note.id);
    const previousBaseline = noteIndex >= 0 && noteIndex < baselineNotes.length - 1 ? baselineNotes[noteIndex + 1] : null;
    if (previousBaseline) {
      sendBaselineCompareToDusk(note, previousBaseline);
      return;
    }
    const payload = buildBaselineProvenanceHandoff(note);
    handoffToDusk(payload.title, payload.body, payload.tags, payload.linkedQuestIds, payload.linkedProjectIds);
  }, [baselineNotes, handoffToDusk, sendBaselineCompareToDusk]);

  const syncProjectNoteLink = useCallback((projectId: string, noteTargetId: string, shouldLink: boolean) => {
    const project = assistantProjects.find((p) => p.id === projectId);
    const note = notes.find((n) => n.id === noteTargetId);
    if (!project || !note) return;
    updateAssistantProject(projectId, {
      linkedNoteIds: shouldLink
        ? Array.from(new Set([...project.linkedNoteIds, noteTargetId]))
        : project.linkedNoteIds.filter((id) => id !== noteTargetId),
    });
    updateNote(noteTargetId, {
      linkedProjectIds: shouldLink
        ? Array.from(new Set([...note.linkedProjectIds, projectId]))
        : note.linkedProjectIds.filter((id) => id !== projectId),
    });
  }, [assistantProjects, notes, updateAssistantProject, updateNote]);

  if (!selectedNote) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-sm text-[var(--app-muted)]">
        No note selected.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <input
          value={selectedNote.title}
          onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-[var(--app-text)] outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => updateNote(selectedNote.id, { pinned: !selectedNote.pinned })}
            className={`${iconButton} ${
              selectedNote.pinned
                ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)]'
                : 'border-[var(--app-border)] text-[var(--app-muted)]'
            }`}
          >
            <Pin size={14} />
          </button>
          <button type="button" onClick={() => deleteNote(selectedNote.id)} className={iconButton}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Baseline provenance (if baseline note) */}
      {isBaselineNote(selectedNote) ? (
        <div className={`${detailPanel} px-4 py-3`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-accent)]">Baseline Note</div>
          <div className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
            This note is a promoted Dusk baseline. Use it as a stable operating record, send it back to Dusk, or turn it into a concrete quest.
          </div>
        </div>
      ) : null}
      {isBaselineNote(selectedNote) && selectedBaselineProvenance ? (
        <div className={`${detailPanel} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Baseline Provenance</div>
              <div className="mt-1 text-sm text-[var(--app-muted)]">
                Accepted Dusk plan and compare-anchor context preserved with this record.
              </div>
            </div>
            <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
              {selectedBaselineProvenance.model || 'provider'}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Accepted Plan</div>
              <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                {selectedBaselineProvenance.providerLabel
                  ? `${selectedBaselineProvenance.providerLabel}${selectedBaselineProvenance.model ? ` / ${selectedBaselineProvenance.model}` : ''}`
                  : 'Provider unavailable'}
                <br />
                {selectedBaselineProvenance.acceptedLabel
                  ? `Accepted: ${selectedBaselineProvenance.acceptedLabel}`
                  : 'Accepted stamp unavailable'}
                <br />
                {selectedBaselineProvenance.nextAction
                  ? `Next action: ${selectedBaselineProvenance.nextAction}`
                  : 'Next action unavailable'}
              </div>
            </div>
            <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Compare Anchor</div>
              <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                {selectedBaselineProvenance.compareCurrentTitle
                  ? `Current: ${selectedBaselineProvenance.compareCurrentTitle}`
                  : 'Current baseline unavailable'}
                <br />
                {selectedBaselineProvenance.comparePreviousTitle
                  ? `Previous: ${selectedBaselineProvenance.comparePreviousTitle}`
                  : 'Previous baseline unavailable'}
                <br />
                {selectedBaselineProvenance.compareDriftSummary
                  ? `Drift: ${selectedBaselineProvenance.compareDriftSummary}`
                  : 'Drift summary unavailable'}
              </div>
            </div>
            {selectedBaselineProvenance.revisionNote ? (
              <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3 md:col-span-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Accepted Revision Note</div>
                <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">{selectedBaselineProvenance.revisionNote}</div>
              </div>
            ) : null}
            {selectedBaselineDecisionAnchor ? (
              <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Decision Anchor</div>
                  <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
                    {selectedBaselineDecisionAnchor.status}
                  </div>
                </div>
                <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                  {selectedBaselineDecisionAnchor.summary}
                  <br />
                  {selectedBaselineDecisionAnchor.recommendation}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Baseline timeline (newer/older navigation) */}
      {isBaselineNote(selectedNote) ? (
        <div className={`${detailPanel} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Baseline Timeline</div>
              <div className="mt-1 text-sm text-[var(--app-muted)]">
                Record {selectedBaselineIndex + 1} of {baselineNotes.length} in the promoted Dusk operating history.
              </div>
            </div>
            <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
              updated {formatRelativeTime(selectedNote.updatedAt)}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Newer baseline</div>
              {newerBaseline ? (
                <>
                  <div className="mt-2 text-sm font-medium text-[var(--app-text)]">{newerBaseline.title}</div>
                  <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                    {shortText(newerBaseline.content, 'Newer baseline ready for reuse.')}
                  </div>
                  {newerBaselineProvenance ? (
                    <div className="mt-2 text-[11px] leading-5 text-[var(--app-muted)]">
                      {formatBaselineProvenanceProvider(newerBaselineProvenance) || 'Provider unavailable'}
                      {newerBaselineProvenance.acceptedLabel ? ` · ${newerBaselineProvenance.acceptedLabel}` : ''}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onSelectNote(newerBaseline.id)}
                    className={`${panelButton} mt-4 border border-[var(--app-border)] px-3 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                  >
                    <FileText size={14} />
                    Open Newer
                  </button>
                </>
              ) : (
                <div className="mt-3 text-sm text-[var(--app-muted)]">This is the newest promoted baseline.</div>
              )}
            </div>
            <div className="rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Older baseline</div>
              {olderBaseline ? (
                <>
                  <div className="mt-2 text-sm font-medium text-[var(--app-text)]">{olderBaseline.title}</div>
                  <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                    {shortText(olderBaseline.content, 'Earlier baseline kept for comparison.')}
                  </div>
                  {olderBaselineProvenance ? (
                    <div className="mt-2 text-[11px] leading-5 text-[var(--app-muted)]">
                      {formatBaselineProvenanceProvider(olderBaselineProvenance) || 'Provider unavailable'}
                      {olderBaselineProvenance.acceptedLabel ? ` · ${olderBaselineProvenance.acceptedLabel}` : ''}
                    </div>
                  ) : null}
                  <div className="mt-2 text-[11px] text-[var(--app-muted)]">
                    {summarizeBaselineDrift(baselineDriftFromPrevious || diffBaselineNote(selectedNote, olderBaseline))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectNote(olderBaseline.id)}
                    className={`${panelButton} mt-4 border border-[var(--app-border)] px-3 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                  >
                    <FileText size={14} />
                    Open Older
                  </button>
                </>
              ) : (
                <div className="mt-3 text-sm text-[var(--app-muted)]">No earlier baseline exists in this timeline yet.</div>
              )}
            </div>
          </div>
          {latestBaselineNote && latestBaselineNote.id !== selectedNote.id ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_68%,transparent)] px-4 py-3">
              <div className="text-sm text-[var(--app-muted)]">
                Latest promoted baseline:
                <span className="ml-2 font-medium text-[var(--app-text)]">{latestBaselineNote.title}</span>
              </div>
              <button
                type="button"
                onClick={() => onSelectNote(latestBaselineNote.id)}
                className={`${panelButton} border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] px-3 py-2 text-[10px] font-semibold text-[var(--app-text)]`}
              >
                <FileText size={14} />
                Jump To Latest
              </button>
            </div>
          ) : null}
          {baselineDriftFromPrevious ? (
            <div className="mt-4 rounded-[18px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_68%,transparent)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Change From Previous Record</div>
                  <div className="mt-1 text-sm text-[var(--app-muted)]">{summarizeBaselineDrift(baselineDriftFromPrevious)}</div>
                </div>
                <div className={`${inlineChip} px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]`}>
                  previous accepted
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Structure</div>
                  <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                    Title {baselineDriftFromPrevious.titleChanged ? 'changed' : 'unchanged'} · Content{' '}
                    {baselineDriftFromPrevious.contentChanged ? 'changed' : 'unchanged'}
                  </div>
                </div>
                <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Linked Scope</div>
                  <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                    {baselineDriftFromPrevious.addedProjectIds.length || baselineDriftFromPrevious.removedProjectIds.length
                      ? `${baselineDriftFromPrevious.addedProjectIds.length} project added · ${baselineDriftFromPrevious.removedProjectIds.length} removed`
                      : 'Project links unchanged'}
                    <br />
                    {baselineDriftFromPrevious.addedQuestIds.length || baselineDriftFromPrevious.removedQuestIds.length
                      ? `${baselineDriftFromPrevious.addedQuestIds.length} quest added · ${baselineDriftFromPrevious.removedQuestIds.length} removed`
                      : 'Quest links unchanged'}
                  </div>
                </div>
                <div className="rounded-[16px] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_74%,transparent)] px-4 py-3 md:col-span-2">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-muted)]">Tag Drift</div>
                  <div className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
                    {baselineDriftFromPrevious.addedTags.length
                      ? `Added: ${baselineDriftFromPrevious.addedTags.join(' · ')}`
                      : 'No tags added'}
                    <br />
                    {baselineDriftFromPrevious.removedTags.length
                      ? `Removed: ${baselineDriftFromPrevious.removedTags.join(' · ')}`
                      : 'No tags removed'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Kind, Status, Tags */}
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
          <span className="text-[10px] uppercase tracking-[0.18em]">Kind</span>
          <select
            value={selectedNote.kind}
            onChange={(e) => updateNote(selectedNote.id, { kind: e.target.value as LabNoteKind })}
            className={fieldInput}
          >
            {noteKindOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
          <span className="text-[10px] uppercase tracking-[0.18em]">Status</span>
          <select
            value={selectedNote.status}
            onChange={(e) => updateNote(selectedNote.id, { status: e.target.value as LabNote['status'] })}
            className={fieldInput}
          >
            {['active', 'draft', 'archived'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-[var(--app-muted)]">
          <span className="text-[10px] uppercase tracking-[0.18em]">Tags</span>
          <input
            value={selectedNote.tags.join(', ')}
            onChange={(e) => updateNote(selectedNote.id, { tags: commaSplit(e.target.value) })}
            placeholder="lab, architecture"
            className={fieldInput}
          />
        </label>
      </div>

      {/* Wiki-link-aware editor */}
      <div className="xt-wiki-editor-wrap">
        <textarea
          ref={noteTextareaRef}
          value={selectedNote.content}
          onChange={(e) => {
            updateNote(selectedNote.id, { content: e.target.value });
            const pos = e.target.selectionStart;
            const link = getActiveWikiLink(e.target.value, pos);
            setWikiActive(link);
            setWikiSelectedIdx(0);
          }}
          onKeyDown={(e) => {
            if (!wikiActive) return;
            const suggestions = getWikiSuggestions(wikiActive.query, notes, selectedNote.id);
            if (suggestions.length === 0) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setWikiSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setWikiSelectedIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              const chosen = suggestions[wikiSelectedIdx];
              if (chosen) {
                const { newContent, newCursorPos } = insertWikiLink(
                  selectedNote.content, wikiActive.start, wikiActive.end, chosen.title
                );
                updateNote(selectedNote.id, { content: newContent });
                setWikiActive(null);
                requestAnimationFrame(() => {
                  if (noteTextareaRef.current) {
                    noteTextareaRef.current.selectionStart = newCursorPos;
                    noteTextareaRef.current.selectionEnd = newCursorPos;
                    noteTextareaRef.current.focus();
                  }
                });
              }
            } else if (e.key === 'Escape') {
              setWikiActive(null);
            }
          }}
          onBlur={() => {
            setTimeout(() => setWikiActive(null), 200);
          }}
          onSelect={(e) => {
            const ta = e.target as HTMLTextAreaElement;
            const link = getActiveWikiLink(ta.value, ta.selectionStart);
            if (link && !wikiActive) {
              setWikiActive(link);
              setWikiSelectedIdx(0);
            } else if (!link && wikiActive) {
              setWikiActive(null);
            }
          }}
          placeholder="Write notes… Use [[Note Title]] to link to other notes."
          className={`${fieldTextarea} min-h-[260px] w-full`}
        />
        {wikiActive && (() => {
          const suggestions = getWikiSuggestions(wikiActive.query, notes, selectedNote.id);
          if (suggestions.length === 0) return null;
          return (
            <div className="xt-wiki-autocomplete" style={{ top: '100%', marginTop: 4 }}>
              {suggestions.map((note, idx) => (
                <button
                  key={note.id}
                  type="button"
                  className="xt-wiki-autocomplete-item"
                  data-active={idx === wikiSelectedIdx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const { newContent, newCursorPos } = insertWikiLink(
                      selectedNote.content, wikiActive.start, wikiActive.end, note.title
                    );
                    updateNote(selectedNote.id, { content: newContent });
                    setWikiActive(null);
                    requestAnimationFrame(() => {
                      if (noteTextareaRef.current) {
                        noteTextareaRef.current.selectionStart = newCursorPos;
                        noteTextareaRef.current.selectionEnd = newCursorPos;
                        noteTextareaRef.current.focus();
                      }
                    });
                  }}
                >
                  <FileText size={12} />
                  <span className="flex-1 truncate">{note.title}</span>
                  <span className="xt-wiki-autocomplete-kind">{note.kind}</span>
                </button>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Backlinks */}
      {(() => {
        const backlinks = getBacklinks(selectedNote.title, notes, selectedNote.id);
        if (backlinks.length === 0) return null;
        return (
          <div className="xt-wiki-backlinks">
            <div className="xt-wiki-backlinks-title">
              {backlinks.length} backlink{backlinks.length !== 1 ? 's' : ''}
            </div>
            {backlinks.map((bl) => (
              <button key={bl.id} type="button" className="xt-wiki-backlink-item" onClick={() => onSelectNote(bl.id)}>
                <Link2 size={10} />
                {bl.title}
              </button>
            ))}
          </div>
        );
      })()}

      {/* Linked Projects and Quests */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${detailPanel} p-4`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Linked Assistant Projects</div>
          <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
            {assistantProjects.map((project) => (
              <label key={project.id} className="flex items-start gap-2 text-sm text-[var(--app-muted)]">
                <input
                  type="checkbox"
                  checked={selectedNote.linkedProjectIds.includes(project.id)}
                  onChange={(e) => syncProjectNoteLink(project.id, selectedNote.id, e.target.checked)}
                />
                <span>{project.title}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={`${detailPanel} p-4`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Linked Quests</div>
          <div className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
            {tasks.slice(0, 14).map((task) => (
              <label key={task.id} className="flex items-start gap-2 text-sm text-[var(--app-muted)]">
                <input
                  type="checkbox"
                  checked={selectedNote.linkedQuestIds.includes(task.id)}
                  onChange={() =>
                    updateNote(selectedNote.id, {
                      linkedQuestIds: toggleId(selectedNote.linkedQuestIds, task.id),
                    })
                  }
                />
                <span>{task.title}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => handleCreateQuestFromNote(selectedNote)}
          className={`${panelButton} border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)]`}
        >
          <Plus size={14} />
          {isBaselineNote(selectedNote) ? 'Create Quest From Baseline' : 'Create Quest From Note'}
        </button>
        <button
          type="button"
          onClick={() =>
            isBaselineNote(selectedNote)
              ? sendBaselineToDusk(selectedNote)
              : handoffToDusk(
                  selectedNote.title,
                  selectedNote.content,
                  selectedNote.tags,
                  selectedNote.linkedQuestIds,
                  selectedNote.linkedProjectIds
                )
          }
          className={`${panelButton} border border-[var(--app-border)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
        >
          <Send size={14} />
          {isBaselineNote(selectedNote) ? 'Send Baseline To Dusk' : 'Hand Off To Dusk'}
        </button>
        {isBaselineNote(selectedNote) && olderBaseline ? (
          <button
            type="button"
            onClick={() => sendBaselineCompareToDusk(selectedNote, olderBaseline)}
            className={`${panelButton} border border-[var(--app-border)] px-4 py-2 text-[10px] font-semibold text-[var(--app-text)] hover:border-[var(--app-accent)]`}
          >
            <Link2 size={14} />
            Compare In Dusk
          </button>
        ) : null}
      </div>

      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
        Updated {new Date(selectedNote.updatedAt).toLocaleString()}
      </div>
    </div>
  );
};
