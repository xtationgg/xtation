import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, X, Search, Send } from 'lucide-react';
import { messagesStorage, Message, Thread } from '../../utils/messagesStorage';

interface MessagesOverlayProps {
  isOpen: boolean;
  onClose: () => void;

  /** Focus/select a thread by id */
  focusThreadId?: string | null;

  /** Or focus/select a thread by participant (player) */
  focusParticipantId?: string | null;
  focusTitle?: string | null;

  /** Called when overlay handled focus request */
  onClearFocus?: () => void;
}

export const MessagesOverlay: React.FC<MessagesOverlayProps> = ({
  isOpen,
  onClose,
  focusThreadId,
  focusParticipantId,
  focusTitle,
  onClearFocus,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [threads, setThreads] = useState<Thread[]>(() => messagesStorage.loadThreads([]));
  const [messages, setMessages] = useState<Message[]>(() => messagesStorage.loadMessages([]));

  const [query, setQuery] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => messagesStorage.saveThreads(threads), [threads]);
  useEffect(() => messagesStorage.saveMessages(messages), [messages]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isOpen) return;

      const target = event.target as Element;
      const toggleBtn = document.getElementById('messages-toggle');

      if (containerRef.current && containerRef.current.contains(target as Node)) return;
      if (toggleBtn && (toggleBtn === target || toggleBtn.contains(target as Node))) return;
      if (target.closest?.('[data-portal-ignore-outside-click]')) return;

      onClose();
    };

    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Ensure we have a selected thread
  useEffect(() => {
    if (!isOpen) return;

    // Focus by thread id
    if (focusThreadId) {
      setActiveThreadId(focusThreadId);
      onClearFocus?.();
      return;
    }

    // Focus by participant id (create thread if needed)
    if (focusParticipantId) {
      const existing = threads.find(t => t.participantId === focusParticipantId);
      if (existing) {
        setActiveThreadId(existing.id);
      } else {
        const t: Thread = {
          id: `thread-${focusParticipantId}-${Date.now()}`,
          title: focusTitle || 'Direct Message',
          participantId: focusParticipantId,
          createdAt: Date.now(),
          lastMessageAt: Date.now(),
        };
        setThreads(prev => [t, ...prev]);
        setActiveThreadId(t.id);
      }
      onClearFocus?.();
      return;
    }

    if (!activeThreadId && threads.length) setActiveThreadId(threads[0].id);
  }, [isOpen, focusThreadId, focusParticipantId, focusTitle, onClearFocus, activeThreadId, threads]);

  const filteredThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = threads
      .slice()
      .sort((a, b) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt));
    if (!q) return base;
    return base.filter(t => t.title.toLowerCase().includes(q));
  }, [threads, query]);

  const activeThread = useMemo(
    () => threads.find(t => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const activeMessages = useMemo(() => {
    if (!activeThreadId) return [];
    return messages
      .filter(m => m.threadId === activeThreadId)
      .slice()
      .sort((a, b) => a.ts - b.ts);
  }, [messages, activeThreadId]);

  const unreadCount = useMemo(() => messages.filter(m => !m.read && m.from !== 'me').length, [messages]);

  const ensureInboxSeed = () => {
    if (threads.length) return;
    const t: Thread = {
      id: `thread-inbox-${Date.now()}`,
      title: 'Inbox (local)',
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
    };
    setThreads([t]);
    setMessages([
      {
        id: `msg-${Date.now()}`,
        threadId: t.id,
        from: 'system',
        text: 'This is your local Messages inbox. Later we can connect real DMs + sync.',
        ts: Date.now(),
        read: true,
      },
    ]);
    setActiveThreadId(t.id);
  };

  useEffect(() => {
    if (isOpen) ensureInboxSeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const sendMessage = () => {
    if (!activeThread) return;
    const text = draft.trim();
    if (!text) return;

    const msg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      threadId: activeThread.id,
      from: 'me',
      text,
      ts: Date.now(),
      read: true,
    };

    setMessages(prev => [...prev, msg]);
    setThreads(prev => prev.map(t => (t.id === activeThread.id ? { ...t, lastMessageAt: msg.ts } : t)));
    setDraft('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" />

      <div
        ref={containerRef}
        className="absolute right-6 top-[72px] w-[860px] max-w-[95vw] h-[520px] bg-[var(--ui-panel)] border border-black/20 shadow-[0_25px_60px_rgba(0,0,0,0.35)]"
      >
        {/* Header */}
        <div className="h-12 px-4 border-b border-black/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} />
            <div className="text-xs font-bold tracking-widest uppercase">Messages</div>
            <div className="text-[10px] text-[var(--ui-muted)]">Unread: {unreadCount}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-[320px,1fr] h-[calc(100%-48px)]">
          {/* Thread list */}
          <div className="border-r border-black/10 p-3 flex flex-col gap-3">
            <div className="flex items-center gap-2 px-3 py-2 border border-black/15 bg-[var(--ui-panel)]">
              <Search size={14} className="text-[var(--ui-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search threads..."
                className="w-full outline-none text-sm"
              />
            </div>

            <div className="flex-1 overflow-auto">
              {filteredThreads.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveThreadId(t.id)}
                  className={
                    'w-full text-left border rounded px-3 py-2 mb-2 transition ' +
                    (t.id === activeThreadId ? 'border-[#0f1115] bg-[#f2f4f7]' : 'border-[var(--ui-border)] bg-[var(--ui-panel)] hover:border-[#0f1115]')
                  }
                >
                  <div className="text-sm font-semibold text-[#e6e8ee] truncate">{t.title}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">
                    {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleString() : '—'}
                  </div>
                </button>
              ))}
              {!filteredThreads.length && (
                <div className="text-sm text-[var(--ui-muted)] border border-dashed border-[var(--ui-border)] rounded p-3">No threads.</div>
              )}
            </div>

            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)] border border-dashed border-[var(--ui-border)] rounded px-2 py-2">
              Tip: Later, player “DM” buttons will create threads here.
            </div>
          </div>

          {/* Thread view */}
          <div className="flex flex-col">
            <div className="px-4 py-3 border-b border-black/10">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)]">Thread</div>
              <div className="text-sm font-semibold text-[#e6e8ee]">{activeThread?.title || '—'}</div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-2 bg-[#fafbfc]">
              {activeMessages.map(m => (
                <div
                  key={m.id}
                  className={
                    'max-w-[80%] border rounded px-3 py-2 text-sm ' +
                    (m.from === 'me'
                      ? 'ml-auto border-[#0f1115] bg-[var(--ui-panel)]'
                      : 'mr-auto border-[var(--ui-border)] bg-[var(--ui-panel)]')
                  }
                >
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-1">
                    {m.from} • {new Date(m.ts).toLocaleTimeString()}
                  </div>
                  <div className="text-[#e6e8ee] whitespace-pre-wrap">{m.text}</div>
                </div>
              ))}
              {!activeMessages.length && (
                <div className="text-sm text-[var(--ui-muted)]">No messages in this thread.</div>
              )}
            </div>

            <div className="p-3 border-t border-black/10 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message (local)…"
                className="flex-1 border border-black/15 rounded px-3 py-2 text-sm outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendMessage();
                }}
              />
              <button
                onClick={sendMessage}
                className="px-3 py-2 border border-[#0f1115] bg-[#0f1115] text-white hover:brightness-110 text-xs font-bold tracking-widest flex items-center gap-2"
              >
                <Send size={14} />
                SEND
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
