import { getUserScopedKey, readUserScopedJSON, writeUserScopedJSON } from '../src/lib/userScopedStorage';

export type Message = {
  id: string;
  threadId: string;
  from: 'me' | string;
  text: string;
  ts: number;
  read?: boolean;
};

export type Thread = {
  id: string;
  title: string;
  participantId?: string; // player id (if linked)
  createdAt: number;
  lastMessageAt?: number;
};

const KEY_THREADS = 'dusk_threads_v1';
const KEY_MESSAGES = 'dusk_messages_v1';

export const messagesStorage = {
  getThreadsBaseKey() {
    return KEY_THREADS;
  },
  getMessagesBaseKey() {
    return KEY_MESSAGES;
  },
  loadThreads(fallback: Thread[] = []) {
    return readUserScopedJSON<Thread[]>(KEY_THREADS, fallback);
  },
  saveThreads(threads: Thread[]) {
    if (typeof window === 'undefined') return;
    const saved = writeUserScopedJSON(KEY_THREADS, threads);
    if (!saved) return;
    window.dispatchEvent(
      new CustomEvent('messages-storage', {
        detail: { key: 'threads', scopedKey: getUserScopedKey(KEY_THREADS), value: threads },
      })
    );
  },
  loadMessages(fallback: Message[] = []) {
    return readUserScopedJSON<Message[]>(KEY_MESSAGES, fallback);
  },
  saveMessages(messages: Message[]) {
    if (typeof window === 'undefined') return;
    const saved = writeUserScopedJSON(KEY_MESSAGES, messages);
    if (!saved) return;
    window.dispatchEvent(
      new CustomEvent('messages-storage', {
        detail: { key: 'messages', scopedKey: getUserScopedKey(KEY_MESSAGES), value: messages },
      })
    );
  },
};
