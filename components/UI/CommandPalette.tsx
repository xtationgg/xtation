import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClientView } from '../../types';
import { useXP } from '../XP/xpStore';

type CommandEntry = {
  id: string;
  label: string;
  group: string;
  keywords?: string;
  action: () => void;
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onChangeView: (view: ClientView) => void;
  onToggleAssistant: () => void;
  canAccessAdmin?: boolean;
  featureVisibility?: {
    lab: boolean;
    multiplayer: boolean;
    store: boolean;
  };
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onChangeView,
  onToggleAssistant,
  canAccessAdmin = false,
  featureVisibility = {
    lab: true,
    multiplayer: true,
    store: true,
  },
}) => {
  const { startSession, stopSession, selectors } = useXP();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isRunning = !!selectors.getActiveSession();

  const nav = useCallback(
    (view: ClientView) => {
      onChangeView(view);
      onClose();
    },
    [onChangeView, onClose]
  );

  const allCommands = useMemo<CommandEntry[]>(
    () => [
      { id: 'nav-play', label: 'Play', group: 'Navigate', keywords: 'action room quest session', action: () => nav(ClientView.LOBBY) },
      ...(featureVisibility.lab
        ? [{ id: 'nav-lab', label: 'Lab', group: 'Navigate', keywords: 'workspace systems notes automations', action: () => nav(ClientView.LAB) }]
        : []),
      { id: 'nav-earth', label: 'Earth', group: 'Navigate', action: () => nav(ClientView.TFT) },
      ...(featureVisibility.multiplayer
        ? [{ id: 'nav-multiplayer', label: 'Multiplayer', group: 'Navigate', action: () => nav(ClientView.MULTIPLAYER) }]
        : []),
      {
        id: 'nav-profile',
        label: 'Profile',
        group: 'Navigate',
        keywords: 'log calendar day console',
        action: () => nav(ClientView.PROFILE),
      },
      { id: 'nav-inventory', label: 'Inventory', group: 'Navigate', action: () => nav(ClientView.INVENTORY) },
      ...(featureVisibility.store
        ? [{ id: 'nav-store', label: 'Store', group: 'Navigate', action: () => nav(ClientView.STORE) }]
        : []),
      { id: 'nav-settings', label: 'Settings', group: 'Navigate', action: () => nav(ClientView.SETTINGS) },
      ...(canAccessAdmin
        ? [{ id: 'nav-admin', label: 'Admin', group: 'Navigate', keywords: 'operator console support rollout audit', action: () => nav(ClientView.ADMIN) }]
        : []),
      { id: 'nav-uikit', label: 'UI Kit', group: 'Navigate', keywords: 'developer design debug', action: () => nav(ClientView.UI_KIT) },
      {
        id: 'act-assistant',
        label: 'Toggle Dusk',
        group: 'Actions',
        keywords: 'dusk assistant bot ai relay open close',
        action: () => {
          onToggleAssistant();
          onClose();
        },
      },
      isRunning
        ? {
            id: 'act-stop',
            label: 'Stop Session',
            group: 'Actions',
            keywords: 'pause end timer running',
            action: () => {
              stopSession();
              onClose();
            },
          }
        : {
            id: 'act-start',
            label: 'Start Quick Session',
            group: 'Actions',
            keywords: 'play begin timer track',
            action: () => {
              startSession({ title: 'Quick session', tag: 'palette', source: 'timer', linkedTaskIds: [] });
              onClose();
            },
          },
    ],
    [canAccessAdmin, featureVisibility.lab, featureVisibility.multiplayer, featureVisibility.store, isRunning, nav, onClose, onToggleAssistant, startSession, stopSession]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase();
    return allCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.group.toLowerCase().includes(q) ||
        (cmd.keywords ?? '').toLowerCase().includes(q)
    );
  }, [query, allCommands]);

  // Reset active index when filtered list changes
  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length, query]);

  // Focus input and reset state when palette opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLElement>(`[data-palette-index="${activeIndex}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const runActive = useCallback(() => {
    filtered[activeIndex]?.action();
  }, [filtered, activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        runActive();
      }
    },
    [filtered.length, onClose, runActive]
  );

  if (!open) return null;

  // Build ordered group map
  const groups: Record<string, CommandEntry[]> = {};
  for (const cmd of filtered) {
    (groups[cmd.group] ??= []).push(cmd);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[14vh] px-4">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 cursor-default"
        aria-label="Close command palette"
      />

      {/* Panel */}
      <div className="xt-command-shell relative w-full max-w-xl overflow-hidden">
        {/* Search row */}
        <div className="xt-command-header flex items-center gap-3 px-4 py-3">
          <span className="xt-command-mark text-[var(--app-muted)] text-sm shrink-0 select-none">⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="xt-command-input flex-1 bg-transparent text-[var(--app-text)] text-[11px] font-mono uppercase tracking-[0.12em] placeholder:text-[var(--app-muted)] placeholder:normal-case placeholder:tracking-normal outline-none"
          />
          <kbd className="xt-command-key hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-[var(--app-muted)] font-mono shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="xt-scroll max-h-[52vh] overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">
              No commands found.
            </div>
          ) : (
            Object.entries(groups).map(([group, cmds]) => (
              <div key={group}>
                <div className="xt-command-group px-4 pt-2 pb-1 text-[9px] uppercase tracking-[0.24em] text-[var(--app-muted)]">
                  {group}
                </div>
                {cmds.map((cmd) => {
                  const idx = filtered.indexOf(cmd);
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      data-palette-index={idx}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={cmd.action}
                      className={`xt-command-item w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 ${
                        isActive ? 'is-active text-[var(--app-text)]' : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                      }`}
                    >
                      {isActive ? (
                        <span className="xt-command-dot shrink-0" />
                      ) : (
                        <span className="xt-command-dot xt-command-dot--idle shrink-0" />
                      )}
                      <span className="text-[10px] uppercase tracking-[0.14em] font-mono">{cmd.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="xt-command-footer flex items-center gap-4 px-4 py-2 text-[9px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
          <span><kbd className="font-mono">↑↓</kbd> Navigate</span>
          <span><kbd className="font-mono">↵</kbd> Select</span>
          <span><kbd className="font-mono">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
};
