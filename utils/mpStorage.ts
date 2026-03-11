import { Player, Pin, Collaboration, XpLog, LocationShareState, SavedLocation } from '../types';
import { MultiplayerAuditEntry } from '../src/multiplayer/audit';
import { getUserScopedKey, readUserScopedJSON, readUserScopedString, writeUserScopedJSON } from '../src/lib/userScopedStorage';

export const mpStorage = {
  loadPlayers(defaultValue: Player[]) {
    return readUserScopedJSON<Player[]>('mp_players', defaultValue);
  },
  loadPins(defaultValue: Pin[]) {
    return readUserScopedJSON<Pin[]>('mp_pins', defaultValue);
  },
  loadCollabs(defaultValue: Collaboration[]) {
    return readUserScopedJSON<Collaboration[]>('mp_collabs', defaultValue);
  },
  loadXpLogs(defaultValue: XpLog[]) {
    return readUserScopedJSON<XpLog[]>('mp_xpLogs', defaultValue);
  },
  loadLocationShare(defaultValue: LocationShareState) {
    return readUserScopedJSON<LocationShareState>('mp_locationShare', defaultValue);
  },
  loadSharingByPlayer(defaultValue: Record<string, LocationShareState>) {
    return readUserScopedJSON<Record<string, LocationShareState>>('mp_sharingByPlayer', defaultValue);
  },
  loadMyLocation(defaultValue: { lat: number; lng: number } | null) {
    return readUserScopedJSON<{ lat: number; lng: number } | null>('mp_myLocation', defaultValue);
  },
  loadSavedLocations(defaultValue: SavedLocation[]) {
    return readUserScopedJSON<SavedLocation[]>('mp_savedLocations', defaultValue);
  },
  loadAuditLog(defaultValue: MultiplayerAuditEntry[]) {
    return readUserScopedJSON<MultiplayerAuditEntry[]>('mp_auditLog', defaultValue);
  },
  loadViewAs(defaultValue: string) {
    return readUserScopedString('mp_viewAs', defaultValue) || defaultValue;
  },
  save(key: string, value: any) {
    try {
      const saved = writeUserScopedJSON(key, value);
      if (!saved) return;
      const scopedKey = getUserScopedKey(key);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mp-storage', { detail: { key, scopedKey, value } }));
      }
    } catch (e) {
      // QuotaExceededError or serialization issues shouldn't crash the whole app
      console.warn('[mpStorage] Failed to save', key, e);
    }
  },
};
