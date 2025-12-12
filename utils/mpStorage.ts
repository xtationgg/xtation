import { Player, Pin, Collaboration, XpLog, LocationShareState } from '../types';

export const mpStorage = {
  loadPlayers(defaultValue: Player[]) {
    try {
      const stored = localStorage.getItem('mp_players');
      if (stored) return JSON.parse(stored) as Player[];
    } catch {}
    return defaultValue;
  },
  loadPins(defaultValue: Pin[]) {
    try {
      const stored = localStorage.getItem('mp_pins');
      if (stored) return JSON.parse(stored) as Pin[];
    } catch {}
    return defaultValue;
  },
  loadCollabs(defaultValue: Collaboration[]) {
    try {
      const stored = localStorage.getItem('mp_collabs');
      if (stored) return JSON.parse(stored) as Collaboration[];
    } catch {}
    return defaultValue;
  },
  loadXpLogs(defaultValue: XpLog[]) {
    try {
      const stored = localStorage.getItem('mp_xpLogs');
      if (stored) return JSON.parse(stored) as XpLog[];
    } catch {}
    return defaultValue;
  },
  loadLocationShare(defaultValue: LocationShareState) {
    try {
      const stored = localStorage.getItem('mp_locationShare');
      if (stored) return JSON.parse(stored) as LocationShareState;
    } catch {}
    return defaultValue;
  },
  loadSharingByPlayer(defaultValue: Record<string, LocationShareState>) {
    try {
      const stored = localStorage.getItem('mp_sharingByPlayer');
      if (stored) return JSON.parse(stored);
    } catch {}
    return defaultValue;
  },
  loadMyLocation(defaultValue: { lat: number; lng: number } | null) {
    try {
      const stored = localStorage.getItem('mp_myLocation');
      if (stored) return JSON.parse(stored);
    } catch {}
    return defaultValue;
  },
  loadViewAs(defaultValue: string) {
    try {
      const stored = localStorage.getItem('mp_viewAs');
      if (stored) return stored;
    } catch {}
    return defaultValue;
  },
  save(key: string, value: any) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};
