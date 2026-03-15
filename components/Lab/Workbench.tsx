import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Link2,
  Pin,
  Plus,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { useLab } from '../../src/lab/LabProvider';
import { useXP } from '../XP/xpStore';
import { openDuskBrief } from '../../src/dusk/bridge';
import { buildBaselineCompareHandoff, buildBaselineProvenanceHandoff } from '../../src/lab/baselineHandoff';
import { parseBaselineNoteProvenance } from '../../src/lab/baselineProvenance';
import {
  getActiveWikiLink,
  getBacklinks,
  getWikiSuggestions,
  insertWikiLink,
} from '../../src/lab/wikiLinks';
import type { LabNote, LabNoteKind } from '../../src/lab/types';
import type { ActivePiece, NoteCollection } from './shared';
import {
  noteKindOptions,
  isBaselineNote,
  formatRelativeTime,
  commaSplit,
} from './shared';

interface WorkbenchProps {
  activePiece: ActivePiece;
  onChangePiece: (piece: ActivePiece) => void;
  noteCollection: NoteCollection;
  onChangeNoteCollection: (collection: NoteCollection) => void;
}

export const Workbench: React.FC<WorkbenchProps> = ({
  activePiece,
  onChangePiece,
  noteCollection,
  onChangeNoteCollection,
}) => {
  const {
    notes,
    addNote,
    updateNote,
    deleteNote,
  } = useLab();
  const { projects, addTask } = useXP();

  const [searchQuery, setSearchQuery] = useState('');
  const [wikiActive, setWikiActive] = useState<{ query: string; start: number; end: number } | null>(null);
  const [wikiSelectedIdx, setWikiSelectedIdx] = useState(0);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // --- Filtered notes ---
  const filteredNotes = useMemo(() => {
    let result = notes;
    switch (noteCollection) {
      case 'pinned': result = notes.filter((n) => n.pinned); break;
      case 'linked': result = notes.filter((n) => n.linkedQuestIds.length || n.linkedProjectIds.length); break;
      case 'plans': result = notes.filter((n) => n.kind === 'plan' || n.kind === 'brief'); break;
      case 'baselines': result = [...notes.filter((n) => isBaselineNote(n))].sort((a, b) => b.updatedAt - a.updatedAt); break;
      case 'research': result = notes.filter((n) => n.kind === 'research' || n.tags.includes('research')); break;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }
    return result;
  }, [notes, noteCollection, searchQuery]);

  const selectedNote = useMemo(
    () => (activePiece?.type === 'note' ? notes.find((n) => n.id === activePiece.id) ?? null : null),
    [notes, activePiece]
  );

  // --- Baseline data ---
  const baselineNotes = useMemo(
    () => notes.filter((n) => isBaselineNote(n)).sort((a, b) => b.updatedAt - a.updatedAt),
    [notes]
  );

  // --- Handlers ---
  const handleCreateNote = useCallback(() => {
    const id = addNote({
      title: 'Untitled',
      content: '',
      tags: [],
      kind: 'capture',
      linkedQuestIds: [],
    });
    onChangePiece({ type: 'note', id });
  }, [addNote, onChangePiece]);

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
    updateNote(note.id, { linkedQuestIds: Array.from(new Set([...note.linkedQuestIds, questId])) });
  }, [addTask, projects, updateNote]);

  const sendBaselineToDusk = useCallback((note: LabNote) => {
    const idx = baselineNotes.findIndex((n) => n.id === note.id);
    const prev = idx >= 0 && idx < baselineNotes.length - 1 ? baselineNotes[idx + 1] : null;
    if (prev) {
      const payload = buildBaselineCompareHandoff(note, prev);
      handoffToDusk(payload.title, payload.body, payload.tags, payload.linkedQuestIds, payload.linkedProjectIds);
    } else {
      const payload = buildBaselineProvenanceHandoff(note);
      handoffToDusk(payload.title, payload.body, payload.tags, payload.linkedQuestIds, payload.linkedProjectIds);
    }
  }, [baselineNotes, handoffToDusk]);

  // --- Collection counts ---
  const counts = useMemo(() => ({
    all: notes.length,
    pinned: notes.filter((n) => n.pinned).length,
    plans: notes.filter((n) => n.kind === 'plan' || n.kind === 'brief').length,
    baselines: notes.filter((n) => isBaselineNote(n)).length,
    research: notes.filter((n) => n.kind === 'research' || n.tags.includes('research')).length,
  }), [notes]);

  const collections: Array<{ id: NoteCollection; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'pinned', label: 'Pinned' },
    { id: 'plans', label: 'Plans' },
    { id: 'baselines', label: 'Baselines' },
    { id: 'research', label: 'Research' },
  ];

  // --- Backlinks ---
  const backlinks = useMemo(() => {
    if (!selectedNote) return [];
    return getBacklinks(selectedNote.title, notes, selectedNote.id);
  }, [selectedNote, notes]);

  return (
    <div className="xt-vault">
      {/* ===== LEFT SIDEBAR ===== */}
      <div className="xt-vault-sidebar">
        <button type="button" className="xt-vault-new-btn" onClick={handleCreateNote}>
          <Plus size={14} />
          <span>New note</span>
        </button>

        <div className="xt-vault-search">
          <Search size={13} className="xt-vault-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="xt-vault-search-input"
          />
        </div>

        <div className="xt-vault-collections">
          {collections.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`xt-vault-collection-btn ${noteCollection === c.id ? 'is-active' : ''}`}
              onClick={() => onChangeNoteCollection(c.id)}
            >
              {c.label}
              <span className="xt-vault-collection-count">{counts[c.id as keyof typeof counts] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="xt-vault-note-list">
          {filteredNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              className={`xt-vault-note-item ${activePiece?.id === note.id ? 'is-active' : ''}`}
              onClick={() => onChangePiece({ type: 'note', id: note.id })}
            >
              <div className="xt-vault-note-item-title">
                {note.pinned ? <Pin size={10} className="xt-vault-pin-icon" /> : null}
                {note.title}
              </div>
              <div className="xt-vault-note-item-meta">
                {note.kind} · {formatRelativeTime(note.updatedAt)}
              </div>
              {note.content ? (
                <div className="xt-vault-note-item-preview">{note.content.slice(0, 60)}</div>
              ) : null}
            </button>
          ))}
          {filteredNotes.length === 0 ? (
            <div className="xt-vault-empty-sidebar">No notes found.</div>
          ) : null}
        </div>
      </div>

      {/* ===== EDITOR ===== */}
      <div className="xt-vault-editor">
        {selectedNote ? (
          <>
            <input
              value={selectedNote.title}
              onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
              className="xt-vault-title"
              placeholder="Untitled"
            />

            <div className="xt-vault-meta">
              <select
                value={selectedNote.kind}
                onChange={(e) => updateNote(selectedNote.id, { kind: e.target.value as LabNoteKind })}
                className="xt-vault-meta-select"
              >
                {noteKindOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                value={selectedNote.tags.join(', ')}
                onChange={(e) => updateNote(selectedNote.id, { tags: commaSplit(e.target.value) })}
                placeholder="tags..."
                className="xt-vault-meta-tags"
              />
              <div className="xt-vault-meta-actions">
                <button
                  type="button"
                  onClick={() => updateNote(selectedNote.id, { pinned: !selectedNote.pinned })}
                  className={`xt-vault-icon-btn ${selectedNote.pinned ? 'is-active' : ''}`}
                  title={selectedNote.pinned ? 'Unpin' : 'Pin'}
                >
                  <Pin size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    isBaselineNote(selectedNote)
                      ? sendBaselineToDusk(selectedNote)
                      : handoffToDusk(selectedNote.title, selectedNote.content, selectedNote.tags, selectedNote.linkedQuestIds, selectedNote.linkedProjectIds);
                  }}
                  className="xt-vault-icon-btn"
                  title="Send to Dusk"
                >
                  <Send size={14} />
                </button>
                <button type="button" onClick={() => handleCreateQuestFromNote(selectedNote)} className="xt-vault-icon-btn" title="Create quest">
                  <Plus size={14} />
                </button>
                <button type="button" onClick={() => deleteNote(selectedNote.id)} className="xt-vault-icon-btn xt-vault-icon-btn--danger" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="xt-vault-body">
              <div className="xt-wiki-editor-wrap">
                <textarea
                  ref={editorRef}
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
                    if (e.key === 'ArrowDown') { e.preventDefault(); setWikiSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setWikiSelectedIdx((i) => Math.max(i - 1, 0)); }
                    else if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault();
                      const chosen = suggestions[wikiSelectedIdx];
                      if (chosen) {
                        const { newContent, newCursorPos } = insertWikiLink(selectedNote.content, wikiActive.start, wikiActive.end, chosen.title);
                        updateNote(selectedNote.id, { content: newContent });
                        setWikiActive(null);
                        requestAnimationFrame(() => { if (editorRef.current) { editorRef.current.selectionStart = newCursorPos; editorRef.current.selectionEnd = newCursorPos; editorRef.current.focus(); } });
                      }
                    } else if (e.key === 'Escape') { setWikiActive(null); }
                  }}
                  onBlur={() => setTimeout(() => setWikiActive(null), 200)}
                  onSelect={(e) => {
                    const ta = e.target as HTMLTextAreaElement;
                    const link = getActiveWikiLink(ta.value, ta.selectionStart);
                    if (link && !wikiActive) { setWikiActive(link); setWikiSelectedIdx(0); }
                    else if (!link && wikiActive) { setWikiActive(null); }
                  }}
                  placeholder="Start writing... Use [[Note Title]] to link notes."
                  className="xt-vault-textarea"
                />
                {wikiActive && (() => {
                  const suggestions = getWikiSuggestions(wikiActive.query, notes, selectedNote.id);
                  if (suggestions.length === 0) return null;
                  return (
                    <div className="xt-wiki-autocomplete">
                      {suggestions.map((note, idx) => (
                        <button
                          key={note.id}
                          type="button"
                          className="xt-wiki-autocomplete-item"
                          data-active={idx === wikiSelectedIdx}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const { newContent, newCursorPos } = insertWikiLink(selectedNote.content, wikiActive.start, wikiActive.end, note.title);
                            updateNote(selectedNote.id, { content: newContent });
                            setWikiActive(null);
                            requestAnimationFrame(() => { if (editorRef.current) { editorRef.current.selectionStart = newCursorPos; editorRef.current.selectionEnd = newCursorPos; editorRef.current.focus(); } });
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
            </div>

            {backlinks.length > 0 ? (
              <div className="xt-vault-backlinks">
                <div className="xt-vault-backlinks-title">
                  <Link2 size={12} />
                  {backlinks.length} backlink{backlinks.length !== 1 ? 's' : ''}
                </div>
                {backlinks.map((bl) => (
                  <button key={bl.id} type="button" className="xt-vault-backlink-item" onClick={() => onChangePiece({ type: 'note', id: bl.id })}>
                    {bl.title}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="xt-vault-timestamp">
              Last edited {new Date(selectedNote.updatedAt).toLocaleString()}
            </div>
          </>
        ) : (
          <div className="xt-vault-empty-editor">
            <FileText size={32} className="xt-vault-empty-icon" />
            <div className="xt-vault-empty-text">Select a note or create a new one</div>
          </div>
        )}
      </div>
    </div>
  );
};
