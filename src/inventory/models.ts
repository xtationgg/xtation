import type { XtationSettingsState } from '../settings/SettingsProvider';
import type { XtationTheme } from '../theme/ThemeProvider';
import { findStoreItemById, findStoreThemeByThemeValue, getThemeLabel, STORE_ITEMS } from '../store/catalog';

export type InventoryCapabilityKind = 'theme' | 'sound' | 'widget' | 'module';
export type InventoryCapabilitySlotBinding = InventoryCapabilityKind | 'any';

export interface InventoryCapabilityItem {
  id: string;
  kind: InventoryCapabilityKind;
  title: string;
  description: string;
  sourceLabel: string;
  highlights: string[];
}

export interface InventoryCapabilityLoadoutSlot {
  id: string;
  label: string;
  icon: string;
  equipped: boolean;
  binding: InventoryCapabilitySlotBinding;
}

export interface InventoryCapabilityLoadoutAssignment {
  slot: InventoryCapabilityLoadoutSlot;
  item: InventoryCapabilityItem | null;
}

export interface InventoryCapabilityLoadoutSummary {
  state: 'empty' | 'partial' | 'ready';
  totalSlots: number;
  occupiedSlots: number;
  missingBindings: InventoryCapabilitySlotBinding[];
  matchedBindings: InventoryCapabilitySlotBinding[];
}

export const getActiveCapabilityItems = (
  settings: XtationSettingsState,
  theme: XtationTheme
): InventoryCapabilityItem[] => {
  const items: InventoryCapabilityItem[] = [];

  const activeThemeItem =
    findStoreItemById(settings.unlocks.activeThemeId) || findStoreThemeByThemeValue(theme);
  items.push({
    id: activeThemeItem?.id || `builtin-theme:${theme}`,
    kind: 'theme',
    title: activeThemeItem?.name || `${getThemeLabel(theme)} Theme`,
    description:
      activeThemeItem?.description ||
      'The active client skin that controls the visual shell without changing the XTATION engine underneath.',
    sourceLabel: activeThemeItem ? 'Store theme' : 'Builtin theme',
    highlights: activeThemeItem?.highlights || ['Theme shell', 'Visual identity', 'System-safe presentation'],
  });

  if (settings.unlocks.activeSoundPackId) {
    const soundPack = findStoreItemById(settings.unlocks.activeSoundPackId);
    items.push({
      id: soundPack?.id || settings.unlocks.activeSoundPackId,
      kind: 'sound',
      title: soundPack?.name || 'Active Sound Pack',
      description:
        soundPack?.description ||
        'Audio presentation layer for XTATION feedback, kept separate from gameplay logic and system state.',
      sourceLabel: soundPack ? 'Store sound pack' : 'Custom sound pack',
      highlights: soundPack?.highlights || ['Audio feedback', 'Presentation layer'],
    });
  }

  settings.unlocks.activeWidgetIds.forEach((widgetId) => {
    const widget = STORE_ITEMS.find((item) => item.install.kind === 'widget' && item.install.widgetId === widgetId);
    items.push({
      id: widget?.id || widgetId,
      kind: 'widget',
      title: widget?.name || widgetId,
      description:
        widget?.description ||
        'A UI widget installed into XTATION to keep key information visible without changing the core data model.',
      sourceLabel: 'Store widget',
      highlights: widget?.highlights || ['UI extension'],
    });
  });

  settings.unlocks.activeLabModuleIds.forEach((moduleId) => {
    const module = STORE_ITEMS.find((item) => item.install.kind === 'module' && item.install.moduleId === moduleId);
    items.push({
      id: module?.id || moduleId,
      kind: 'module',
      title: module?.name || moduleId,
      description:
        module?.description ||
        'A Lab capability module that unlocks extra structured workflows while keeping the system modular.',
      sourceLabel: 'Store module',
      highlights: module?.highlights || ['Workflow capability'],
    });
  });

  return items;
};

export const assignCapabilityItemsToLoadoutSlots = (
  slots: InventoryCapabilityLoadoutSlot[],
  items: InventoryCapabilityItem[]
): InventoryCapabilityLoadoutAssignment[] => {
  const remaining = [...items];

  return slots.map((slot) => {
    const matchIndex =
      slot.binding === 'any'
        ? 0
        : remaining.findIndex((item) => item.kind === slot.binding);

    if (matchIndex < 0 || !remaining[matchIndex]) {
      return {
        slot,
        item: null,
      };
    }

    const [item] = remaining.splice(matchIndex, 1);
    return {
      slot,
      item,
    };
  });
};

export const summarizeCapabilityLoadoutAssignments = (
  assignments: InventoryCapabilityLoadoutAssignment[]
): InventoryCapabilityLoadoutSummary => {
  const totalSlots = assignments.length;
  const occupiedSlots = assignments.filter((entry) => Boolean(entry.item)).length;
  const missingBindings = assignments
    .filter((entry) => !entry.item && entry.slot.binding !== 'any')
    .map((entry) => entry.slot.binding);
  const matchedBindings = assignments
    .filter((entry) => entry.item)
    .map((entry) => entry.slot.binding);

  const state =
    occupiedSlots === 0
      ? 'empty'
      : missingBindings.length === 0
      ? 'ready'
      : 'partial';

  return {
    state,
    totalSlots,
    occupiedSlots,
    missingBindings,
    matchedBindings,
  };
};
