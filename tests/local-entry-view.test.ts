import { describe, expect, it } from 'vitest';
import { ClientView } from '../types';
import { resolveLocalStationEntryView } from '../src/welcome/localEntryView';

describe('local station entry view', () => {
  it('restores a normal guest workspace directly', () => {
    expect(resolveLocalStationEntryView(ClientView.PROFILE)).toBe(ClientView.PROFILE);
  });

  it('falls back when the stored guest workspace is no longer allowed', () => {
    expect(
      resolveLocalStationEntryView(ClientView.ADMIN, {
        canAccessAdmin: false,
      })
    ).toBe(ClientView.LOBBY);
  });

  it('falls back when the stored guest workspace is behind a disabled feature', () => {
    expect(
      resolveLocalStationEntryView(ClientView.STORE, {
        featureVisibility: { store: false },
      })
    ).toBe(ClientView.LOBBY);
  });
});
