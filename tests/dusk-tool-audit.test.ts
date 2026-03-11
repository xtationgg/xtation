import { beforeEach, describe, expect, it } from 'vitest';
import { appendDuskToolAuditEntry, readDuskToolAudit } from '../src/dusk/toolAudit';
import { clearUserScopedKey } from '../src/lib/userScopedStorage';

describe('dusk tool audit', () => {
  const userId = 'user-audit';
  let memory = new Map<string, string>();

  beforeEach(() => {
    memory = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
        setItem: (key: string, value: string) => {
          memory.set(String(key), String(value));
        },
        removeItem: (key: string) => {
          memory.delete(String(key));
        },
        clear: () => {
          memory.clear();
        },
        key: (index: number) => Array.from(memory.keys())[index] ?? null,
        get length() {
          return memory.size;
        },
      },
    });
    clearUserScopedKey('duskToolAudit.v1', userId);
  });

  it('stores newest entries first with scoped storage', () => {
    appendDuskToolAuditEntry(
      'open-primary-quest',
      'relay',
      {
        status: 'success',
        message: 'Primary quest opened',
        openedQuestId: 'task-1',
      },
      userId
    );

    appendDuskToolAuditEntry(
      'capture-station-note',
      'provider',
      {
        status: 'success',
        message: 'Station snapshot captured in Lab',
        noteId: 'note-1',
      },
      userId
    );

    const entries = readDuskToolAudit(userId);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      actionId: 'capture-station-note',
      actor: 'provider',
      noteId: 'note-1',
    });
    expect(entries[1]).toMatchObject({
      actionId: 'open-primary-quest',
      actor: 'relay',
      openedQuestId: 'task-1',
    });
  });
});
