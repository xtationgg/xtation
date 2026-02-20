import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Message, Thread, messagesStorage } from '../../utils/messagesStorage';
import { mpStorage } from '../../utils/mpStorage';
import { defaultPlayers } from '../../utils/defaultPlayers';
import { Player } from '../../types';
import { MessageSquare, Minus, Send, X } from 'lucide-react';
import { isUserScopedStorageKey, USER_SCOPED_STORAGE_EVENT } from '../../src/lib/userScopedStorage';

const formatTime = (ts: number) => {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const CHAT_KEY_THREADS = messagesStorage.getThreadsBaseKey();
const CHAT_KEY_MESSAGES = messagesStorage.getMessagesBaseKey();
const MP_KEY_PLAYERS = 'mp_players';

type OpenMessageDetail = {
  participantId?: string;
  title?: string;
  threadId?: string;
};

export const ChatDock: React.FC = () => {
  const [isListCollapsed, setIsListCollapsed] = useState(true);
  const [players, setPlayers] = useState<Player[]>(() => mpStorage.loadPlayers(defaultPlayers));

  const [threads, setThreads] = useState<Thread[]>(() => messagesStorage.loadThreads([]));
  const [messages, setMessages] = useState<Message[]>(() => messagesStorage.loadMessages([]));
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [chatState, setChatState] = useState<'closed' | 'open' | 'minimized'>('closed');
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const playersRef = useRef(players);
  const threadsRef = useRef(threads);
  const messagesRef = useRef(messages);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => messagesStorage.saveThreads(threads), [threads]);
  useEffect(() => messagesStorage.saveMessages(messages), [messages]);

  const openThreadFor = useCallback((friend: Player, preferredTitle?: string) => {
    const existing = threadsRef.current.find(thread => thread.participantId === friend.id);
    if (existing) {
      setActiveThreadId(existing.id);
      setActiveFriendId(friend.id);
      setChatState('open');
      return;
    }

    const thread: Thread = {
      id: `thread-${friend.id}-${Date.now()}`,
      title: preferredTitle || friend.name,
      participantId: friend.id,
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
    };

    setThreads(prev => [thread, ...prev]);
    setActiveThreadId(thread.id);
    setActiveFriendId(friend.id);
    setChatState('open');
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (isUserScopedStorageKey(event.key, MP_KEY_PLAYERS)) {
        setPlayers(mpStorage.loadPlayers(defaultPlayers));
      }
      if (isUserScopedStorageKey(event.key, CHAT_KEY_THREADS)) {
        setThreads(messagesStorage.loadThreads([]));
      }
      if (isUserScopedStorageKey(event.key, CHAT_KEY_MESSAGES)) {
        setMessages(messagesStorage.loadMessages([]));
      }
    };

    const handleMpStorage = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; scopedKey?: string | null; value: Player[] }>).detail;
      if (detail?.key === MP_KEY_PLAYERS) {
        if (Array.isArray(detail.value)) {
          setPlayers(detail.value);
        } else {
          setPlayers(mpStorage.loadPlayers(defaultPlayers));
        }
      }
    };

    const handleMessagesStorage = (event: Event) => {
      const detail = (event as CustomEvent<{ key: 'threads' | 'messages'; scopedKey?: string | null; value: unknown }>).detail;
      if (!detail) return;

      if (detail.key === 'threads') {
        if (detail.value === threadsRef.current) return;
        if (Array.isArray(detail.value)) {
          setThreads(detail.value as Thread[]);
        } else {
          setThreads(messagesStorage.loadThreads([]));
        }
      }

      if (detail.key === 'messages') {
        if (detail.value === messagesRef.current) return;
        if (Array.isArray(detail.value)) {
          setMessages(detail.value as Message[]);
        } else {
          setMessages(messagesStorage.loadMessages([]));
        }
      }
    };

    const handleUserScopeChange = () => {
      setPlayers(mpStorage.loadPlayers(defaultPlayers));
      setThreads(messagesStorage.loadThreads([]));
      setMessages(messagesStorage.loadMessages([]));
      setActiveThreadId(null);
      setActiveFriendId(null);
      setChatState('closed');
      setDraft('');
      setIsListCollapsed(true);
    };

    const handleOpenMessages = (event: Event) => {
      const detail = (event as CustomEvent<OpenMessageDetail>).detail;
      if (!detail) return;

      setIsListCollapsed(false);

      if (detail.threadId) {
        const thread = threadsRef.current.find(item => item.id === detail.threadId);
        if (thread) {
          setActiveThreadId(thread.id);
          setActiveFriendId(thread.participantId || null);
          setChatState('open');
          return;
        }
      }

      if (detail.participantId) {
        const friend = playersRef.current.find(p => p.id === detail.participantId);
        if (friend) {
          openThreadFor(friend, detail.title);
        } else {
          const thread: Thread = {
            id: `thread-${detail.participantId}-${Date.now()}`,
            title: detail.title || 'Direct Message',
            participantId: detail.participantId,
            createdAt: Date.now(),
            lastMessageAt: Date.now(),
          };
          setThreads(prev => [thread, ...prev]);
          setActiveThreadId(thread.id);
          setActiveFriendId(detail.participantId);
          setChatState('open');
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('mp-storage', handleMpStorage as EventListener);
    window.addEventListener('messages-storage', handleMessagesStorage as EventListener);
    window.addEventListener(USER_SCOPED_STORAGE_EVENT, handleUserScopeChange as EventListener);
    window.addEventListener('dusk:openMessagesThread', handleOpenMessages as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('mp-storage', handleMpStorage as EventListener);
      window.removeEventListener('messages-storage', handleMessagesStorage as EventListener);
      window.removeEventListener(USER_SCOPED_STORAGE_EVENT, handleUserScopeChange as EventListener);
      window.removeEventListener('dusk:openMessagesThread', handleOpenMessages as EventListener);
    };
  }, [openThreadFor]);

  const friends = useMemo(() => players.filter(player => player.id !== 'me'), [players]);

  const threadToFriend = useMemo(() => {
    const map = new Map<string, string>();
    threads.forEach(thread => {
      if (thread.participantId) {
        map.set(thread.id, thread.participantId);
      }
    });
    return map;
  }, [threads]);

  const threadByParticipant = useMemo(() => {
    const map = new Map<string, Thread>();
    threads.forEach(thread => {
      if (thread.participantId) {
        map.set(thread.participantId, thread);
      }
    });
    return map;
  }, [threads]);

  const lastMessageByThread = useMemo(() => {
    const map = new Map<string, Message>();
    messages.forEach(message => {
      const prev = map.get(message.threadId);
      if (!prev || message.ts > prev.ts) {
        map.set(message.threadId, message);
      }
    });
    return map;
  }, [messages]);

  const unreadByFriend = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach(message => {
      if (message.from === 'me' || message.read) return;
      const friendId = threadToFriend.get(message.threadId);
      if (!friendId) return;
      counts[friendId] = (counts[friendId] || 0) + 1;
    });
    return counts;
  }, [messages, threadToFriend]);

  const totalUnread = useMemo(
    () => Object.values(unreadByFriend).reduce((sum, count) => sum + count, 0),
    [unreadByFriend]
  );

  const activeThread = useMemo(
    () => threads.find(thread => thread.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const activeParticipantId = activeThread?.participantId || activeFriendId;
  const activeFriend = useMemo(
    () => friends.find(friend => friend.id === activeParticipantId) || null,
    [friends, activeParticipantId]
  );

  const activeMessages = useMemo(() => {
    if (!activeThreadId) return [];
    return messages
      .filter(message => message.threadId === activeThreadId)
      .slice()
      .sort((a, b) => a.ts - b.ts);
  }, [messages, activeThreadId]);

  const markThreadRead = (threadId: string) => {
    setMessages(prev =>
      prev.map(message =>
        message.threadId === threadId && message.from !== 'me'
          ? { ...message, read: true }
          : message
      )
    );
  };

  const openPlayerProfile = (playerId: string) => {
    window.dispatchEvent(new CustomEvent('dusk:openPlayerDossier', { detail: { playerId } }));
  };

  useEffect(() => {
    if (chatState === 'open' && activeThreadId) {
      markThreadRead(activeThreadId);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [chatState, activeThreadId]);

  const sendMessage = () => {
    if (!activeThread || !draft.trim()) return;
    const msg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      threadId: activeThread.id,
      from: 'me',
      text: draft.trim(),
      ts: Date.now(),
      read: true,
    };

    setMessages(prev => [...prev, msg]);
    setThreads(prev => prev.map(t => (t.id === activeThread.id ? { ...t, lastMessageAt: msg.ts } : t)));
    setDraft('');
  };

  const minimizeChat = () => {
    if (chatState === 'open') setChatState('minimized');
  };

  const restoreChat = () => {
    if (chatState === 'minimized') setChatState('open');
  };

  const closeChat = () => {
    setChatState('closed');
    setActiveThreadId(null);
    setActiveFriendId(null);
  };

  const collapseList = () => {
    setIsListCollapsed(true);
    closeChat();
  };

  const expandList = () => {
    setIsListCollapsed(false);
    closeChat();
  };

  const minimizedUnread = useMemo(() => {
    if (!activeThreadId) return 0;
    return messages.reduce((count, message) => {
      if (message.threadId !== activeThreadId) return count;
      if (message.from === 'me' || message.read) return count;
      return count + 1;
    }, 0);
  }, [messages, activeThreadId]);

  return (
    <div className="fixed left-4 bottom-4 z-40 flex gap-3 items-end">
      {isListCollapsed ? (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={expandList}
            className="relative w-12 h-16 rounded-xl border border-white/15 bg-[#0b0b0b]/90 text-[#f3f0e8] flex items-center justify-center shadow-sm"
          >
            <MessageSquare size={16} />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#f46a2e] text-[10px] text-white flex items-center justify-center shadow-[0_6px_12px_rgba(0,0,0,0.4)]">
                {totalUnread}
              </span>
            )}
          </button>
        </div>
      ) : (
        <div className="w-[240px] h-[70vh] rounded-xl border border-white/10 bg-[#0b0b0b]/90 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-[#0f0f11] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg border border-white/10 bg-[#15151a] flex items-center justify-center">
                <MessageSquare size={14} className="text-[#f3f0e8]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-white font-semibold">Friends</span>
                <span className="text-[9px] text-[#8b847a]">{friends.length} total</span>
              </div>
            </div>
            <button
              type="button"
              onClick={collapseList}
              className="w-7 h-7 rounded-md border border-white/10 text-[#8b847a] hover:text-white hover:border-white/30 transition-colors"
              aria-label="Minimize"
            >
              <Minus size={12} className="mx-auto" />
            </button>
          </div>

          <div className="p-3 flex flex-col gap-2 overflow-y-auto custom-scrollbar h-[calc(70vh-52px)]">
            {friends.map(friend => {
              const isOnline = friend.accepted && friend.permissions?.location !== 'off';
              const unreadCount = unreadByFriend[friend.id] || 0;
              const thread = threadByParticipant.get(friend.id) || null;
              const lastMessage = thread ? lastMessageByThread.get(thread.id) : null;
              const preview = lastMessage ? lastMessage.text : 'No messages yet';
              const previewTime = lastMessage ? formatTime(lastMessage.ts) : '';
              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => openThreadFor(friend)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition ${
                    activeThread?.participantId === friend.id && chatState !== 'closed'
                      ? 'border-[#f46a2e]/60 bg-[#1a1410]'
                      : 'border-white/10 bg-[#111114] hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-9 h-9 rounded-full border border-white/10 bg-[#19191e] flex items-center justify-center overflow-hidden text-[11px] text-white">
                      {friend.avatar ? (
                        <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{friend.name.slice(0, 1)}</span>
                      )}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#0b0b0f] ${
                          isOnline ? 'bg-[#5ef48a]' : 'bg-[#666]'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#f3f0e8] truncate">{friend.name}</span>
                        <div className="flex items-center gap-2">
                          {previewTime && <span className="text-[9px] text-[#6f6a63]">{previewTime}</span>}
                          {unreadCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-[#f46a2e] text-[9px] text-white">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[9px] text-[#8b847a] truncate">{preview}</div>
                    </div>
                  </div>
                </button>
              );
            })}
            {friends.length === 0 && (
              <div className="text-[9px] uppercase tracking-[0.3em] text-[#726c64]">No friends yet.</div>
            )}
          </div>
        </div>
      )}

      {!isListCollapsed && chatState !== 'closed' && (
        <div className="w-[320px] h-[70vh] flex flex-col">
          {chatState === 'minimized' ? (
            <div
              role="button"
              tabIndex={0}
              onClick={restoreChat}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  restoreChat();
                }
              }}
              className="relative w-full h-1/2 rounded-xl border border-white/10 bg-[#0b0b0b]/90 shadow-sm flex items-center justify-between px-4 cursor-pointer"
            >
              <span className="text-[11px] text-white font-semibold">{activeThread?.title || 'Chat'}</span>
              <div className="flex items-center gap-2">
                {minimizedUnread > 0 && (
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#f46a2e] text-[10px] text-white flex items-center justify-center">
                    {minimizedUnread}
                  </span>
                )}
                <button
                  type="button"
                  onClick={event => {
                    event.stopPropagation();
                    closeChat();
                  }}
                  className="w-6 h-6 rounded-lg border border-white/10 text-[#8b847a] hover:text-white"
                >
                  <X size={12} className="mx-auto" />
                </button>
              </div>
            </div>
          ) : (
            <div
              className="flex-1 rounded-xl border border-white/10 bg-[#0b0b0b]/90 shadow-sm overflow-hidden"
              onClick={() => inputRef.current?.focus()}
            >
              <div className="px-4 py-3 border-b border-white/10 bg-[#0f0f11] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (activeFriend) openPlayerProfile(activeFriend.id);
                    }}
                    title="Open player profile"
                    className="relative w-9 h-9 rounded-full border border-white/10 bg-[#19191e] flex items-center justify-center overflow-hidden text-[11px] text-white hover:border-white/30 transition-colors"
                    disabled={!activeFriend}
                  >
                    {activeFriend?.avatar ? (
                      <img src={activeFriend.avatar} alt={activeFriend.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{activeFriend ? activeFriend.name.slice(0, 1) : '?'}</span>
                    )}
                    {activeFriend && (
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#0b0b0f] ${
                          activeFriend.accepted && activeFriend.permissions?.location !== 'off'
                            ? 'bg-[#5ef48a]'
                            : 'bg-[#666]'
                        }`}
                      />
                    )}
                  </button>
                  <div>
                    <div className="text-[9px] text-[#8b847a]">Direct</div>
                    <div className="text-[12px] text-white font-semibold">
                      {activeThread ? activeThread.title : 'Select Friend'}
                    </div>
                    {activeFriend && (
                      <div className="text-[9px] text-[#8b847a]">
                        {activeFriend.role || 'Operative'} ·{' '}
                        {activeFriend.accepted && activeFriend.permissions?.location !== 'off' ? 'Available' : 'Offline'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={minimizeChat}
                    className="w-7 h-7 rounded-lg border border-white/10 text-[#8b847a] hover:text-white hover:border-white/30 transition-colors"
                    aria-label="Minimize chat"
                  >
                    <Minus size={12} className="mx-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={closeChat}
                    className="w-7 h-7 rounded-lg border border-white/10 text-[#8b847a] hover:text-white hover:border-white/30 transition-colors"
                    aria-label="Close chat"
                  >
                    <X size={12} className="mx-auto" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col h-[calc(70vh-56px)]">
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {activeThread ? (
                    activeMessages.length ? (
                      activeMessages.map(msg => (
                        <div
                          key={msg.id}
                          className={`max-w-[85%] px-3 py-2 rounded-lg border text-[11px] leading-relaxed ${
                            msg.from === 'me'
                              ? 'ml-auto border-[#f46a2e]/50 bg-[#2a1a12] text-[#f3f0e8]'
                              : 'border-white/10 bg-[#141418] text-[#d3cec6]'
                          }`}
                        >
                          <div className="text-[9px] text-[#8b847a] mb-1">{formatTime(msg.ts)}</div>
                          {msg.text}
                        </div>
                      ))
                    ) : (
                      <div className="text-[9px] uppercase tracking-[0.3em] text-[#726c64]">No messages yet.</div>
                    )
                  ) : (
                    <div className="text-[9px] uppercase tracking-[0.3em] text-[#726c64]">Select a friend to start chat.</div>
                  )}
                </div>

                <div className="border-t border-white/10 p-3 bg-[#0b0b0b]">
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      value={draft}
                      onChange={event => setDraft(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') sendMessage();
                      }}
                      placeholder="Type message..."
                      className="flex-1 bg-[#111115] border border-white/10 text-[11px] text-white px-3 py-2 rounded-lg focus:border-white/30 outline-none placeholder:text-[#6d6860]"
                      disabled={!activeThread}
                    />
                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={!activeThread}
                      className="w-10 h-10 rounded-lg border border-white/10 bg-[#1a1a1d] text-[#f3f0e8] hover:border-white/30 hover:text-white disabled:opacity-40 transition-colors"
                    >
                      <Send size={14} className="mx-auto" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
