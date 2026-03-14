/**
 * Wiki-link support for Lab Knowledge notes.
 *
 * Syntax: [[Note Title]] — links to another Lab note by title.
 * Supports autocomplete while typing inside [[ ]].
 * Computes backlinks (which notes reference a given note).
 */

import type { LabNote } from './types';

/** Extract all wiki link targets from note content. */
export function extractWikiLinks(content: string): string[] {
  const matches = content.match(/\[\[([^\]]+)\]\]/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(2, -2).trim()).filter(Boolean);
}

/** Find the active wiki-link being typed at the cursor position.
 *  Returns the partial text inside [[ if actively typing, or null. */
export function getActiveWikiLink(
  content: string,
  cursorPos: number
): { query: string; start: number; end: number } | null {
  // Look backwards from cursor for [[
  const before = content.slice(0, cursorPos);
  const openIdx = before.lastIndexOf('[[');
  if (openIdx === -1) return null;

  // Check there's no ]] between [[ and cursor
  const between = before.slice(openIdx + 2);
  if (between.includes(']]')) return null;

  // Check there's no newline between [[ and cursor (keep it single-line)
  if (between.includes('\n')) return null;

  const query = between;
  return { query, start: openIdx, end: cursorPos };
}

/** Compute autocomplete suggestions for a wiki-link query. */
export function getWikiSuggestions(
  query: string,
  notes: LabNote[],
  currentNoteId: string | null,
  limit = 8
): LabNote[] {
  const q = query.toLowerCase().trim();
  return notes
    .filter((n) => n.id !== currentNoteId)
    .filter((n) => {
      if (!q) return true; // Show all if empty query
      return (
        n.title.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      // Exact title match first
      const aExact = a.title.toLowerCase() === q ? 1 : 0;
      const bExact = b.title.toLowerCase() === q ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      // Then starts-with
      const aStarts = a.title.toLowerCase().startsWith(q) ? 1 : 0;
      const bStarts = b.title.toLowerCase().startsWith(q) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;
      // Then by updated date
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, limit);
}

/** Compute backlinks: which notes reference a given note by title. */
export function getBacklinks(
  noteTitle: string,
  allNotes: LabNote[],
  currentNoteId: string
): LabNote[] {
  if (!noteTitle.trim()) return [];
  const target = noteTitle.trim().toLowerCase();
  return allNotes.filter((n) => {
    if (n.id === currentNoteId) return false;
    const links = extractWikiLinks(n.content);
    return links.some((l) => l.toLowerCase() === target);
  });
}

/** Insert a completed wiki link into content at the given position. */
export function insertWikiLink(
  content: string,
  linkStart: number,
  cursorEnd: number,
  noteTitle: string
): { newContent: string; newCursorPos: number } {
  const before = content.slice(0, linkStart);
  const after = content.slice(cursorEnd);
  const inserted = `[[${noteTitle}]]`;
  return {
    newContent: before + inserted + after,
    newCursorPos: linkStart + inserted.length,
  };
}
