import { describe, expect, it } from 'vitest';
import { ClientView } from '../types';
import {
  isRestorableXtationView,
  readStoredXtationLastView,
  resolveXtationLastView,
  writeStoredXtationLastView,
} from '../src/navigation/lastView';

const installMemoryStorage = () => {
  const memory = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
  });
};

describe('xtation last view storage', () => {
  it('stores and reads a guest restorable view', () => {
    installMemoryStorage();
    window.localStorage.removeItem('xtation_last_view_v1:guest');
    writeStoredXtationLastView(ClientView.PROFILE);
    expect(readStoredXtationLastView()).toBe(ClientView.PROFILE);
  });

  it('ignores non-restorable views', () => {
    installMemoryStorage();
    expect(isRestorableXtationView(ClientView.MATCH_FOUND)).toBe(false);
    writeStoredXtationLastView(ClientView.MATCH_FOUND);
    expect(readStoredXtationLastView()).not.toBe(ClientView.MATCH_FOUND);
  });

  it('falls back to lobby when the stored view is hidden by feature access', () => {
    expect(resolveXtationLastView(ClientView.ADMIN, { canAccessAdmin: false })).toBe(ClientView.LOBBY);
    expect(resolveXtationLastView(ClientView.STORE, { featureVisibility: { store: false } })).toBe(ClientView.LOBBY);
    expect(resolveXtationLastView(ClientView.PROFILE, { canAccessAdmin: false })).toBe(ClientView.PROFILE);
  });
});
