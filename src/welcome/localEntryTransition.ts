import { ClientView } from '../../types';
import type { LocalStationStatus } from './localStationStatus';
import { resolveLocalStationEntryView } from './localEntryView';

interface LocalEntryAccess {
  canAccessAdmin?: boolean;
  featureVisibility?: {
    lab?: boolean;
    multiplayer?: boolean;
    store?: boolean;
  };
}

export interface LocalEntryTransitionDescriptor {
  title: string;
  detail: string;
  chips: string[];
  tone: 'default' | 'accent';
  targetView: ClientView;
  workspaceLabel: string;
}

export const resolveLocalEntryTargetView = (
  status: LocalStationStatus,
  fallbackView: ClientView,
  access?: LocalEntryAccess
) => {
  if (status.targetView) return resolveLocalStationEntryView(status.targetView, access);
  if (status.eyebrow !== 'Starter loop' && status.eyebrow !== 'Latest transition') {
    return fallbackView;
  }

  const targetByLabel =
    status.workspaceLabel === 'Profile'
      ? ClientView.PROFILE
      : status.workspaceLabel === 'Lab'
        ? ClientView.LAB
        : status.workspaceLabel === 'Multiplayer'
          ? ClientView.MULTIPLAYER
          : status.workspaceLabel === 'Inventory'
            ? ClientView.INVENTORY
            : status.workspaceLabel === 'Store'
              ? ClientView.STORE
              : status.workspaceLabel === 'Settings'
                ? ClientView.SETTINGS
                : status.workspaceLabel === 'Admin'
                  ? ClientView.ADMIN
                  : status.workspaceLabel === 'Earth'
                    ? ClientView.TFT
                    : status.workspaceLabel === 'UI Kit'
                      ? ClientView.UI_KIT
                      : fallbackView;

  return resolveLocalStationEntryView(targetByLabel, access);
};

export const buildLocalEntryTransitionDescriptor = (
  status: LocalStationStatus,
  targetView: ClientView
): LocalEntryTransitionDescriptor => {
  const workspaceLabel = status.workspaceLabel;
  const resumedChip = `${workspaceLabel} reopened`;
  const baseChips = [...status.chips.filter(Boolean)];

  if (status.mode === 'relay') {
    return {
      title: 'Starter relay resumed',
      detail: `XTATION reopened the local ${workspaceLabel} station and re-armed the starter relay for ${status.relayTitle || 'your first loop'}.`,
      chips: [...baseChips, resumedChip].slice(0, 4),
      tone: 'accent',
      targetView,
      workspaceLabel,
    };
  }

  if (status.eyebrow === 'Starter loop') {
    return {
      title: 'Starter loop resumed',
      detail: `XTATION reopened the local ${workspaceLabel} station and picked back up from ${status.relayTitle || 'the latest starter milestone'}.`,
      chips: [...baseChips, resumedChip].slice(0, 4),
      tone: 'accent',
      targetView,
      workspaceLabel,
    };
  }

  if (status.mode === 'guided') {
    const entryVerb = status.entryState === 'fresh' ? 'opened' : 'resumed';
    const actionVerb = status.entryState === 'fresh' ? 'opened' : 'reopened';
    return {
      title: `Guided setup ${entryVerb}`,
      detail: `XTATION ${actionVerb} the local ${workspaceLabel} station and ${status.entryState === 'fresh' ? 'started' : 'restored'} the guided setup flow before any account sync is involved.`,
      chips: [...baseChips, resumedChip].slice(0, 4),
      tone: 'default',
      targetView,
      workspaceLabel,
    };
  }

  if (status.mode === 'fresh') {
    return {
      title: 'Local station active',
      detail: `XTATION opened a fresh offline-first ${workspaceLabel} station on this device. You can connect an account later without losing this local shell.`,
      chips: [...baseChips, resumedChip].slice(0, 4),
      tone: 'default',
      targetView,
      workspaceLabel,
    };
  }

  return {
    title: 'Local station resumed',
    detail: `XTATION reopened the offline-first ${workspaceLabel} station and restored the latest local continuity on this device.`,
    chips: [...baseChips, resumedChip].slice(0, 4),
    tone: 'default',
    targetView,
    workspaceLabel,
  };
};
