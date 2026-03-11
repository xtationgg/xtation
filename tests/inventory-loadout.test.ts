import { describe, expect, it } from 'vitest';

import {
  assignCapabilityItemsToLoadoutSlots,
  summarizeCapabilityLoadoutAssignments,
  type InventoryCapabilityItem,
  type InventoryCapabilityLoadoutSlot,
} from '../src/inventory/models';

describe('inventory loadout assignment', () => {
  it('maps authored slot bindings onto matching capability kinds first', () => {
    const slots: InventoryCapabilityLoadoutSlot[] = [
      { id: 'shell', label: 'shell', icon: '⚙', equipped: true, binding: 'theme' },
      { id: 'audio', label: 'audio', icon: '🔊', equipped: true, binding: 'sound' },
      { id: 'widget', label: 'widget', icon: '✦', equipped: true, binding: 'widget' },
      { id: 'module', label: 'module', icon: '🧰', equipped: true, binding: 'module' },
      { id: 'relay', label: 'relay', icon: '📶', equipped: false, binding: 'any' },
    ];
    const items: InventoryCapabilityItem[] = [
      { id: 'theme-1', kind: 'theme', title: 'Bureau Theme', description: '', sourceLabel: 'Store', highlights: [] },
      { id: 'sound-1', kind: 'sound', title: 'Amber Tones', description: '', sourceLabel: 'Store', highlights: [] },
      { id: 'widget-1', kind: 'widget', title: 'Brief Stack', description: '', sourceLabel: 'Store', highlights: [] },
      { id: 'module-1', kind: 'module', title: 'Media Ops', description: '', sourceLabel: 'Store', highlights: [] },
    ];

    const assigned = assignCapabilityItemsToLoadoutSlots(slots, items);
    expect(assigned[0]?.item?.kind).toBe('theme');
    expect(assigned[1]?.item?.kind).toBe('sound');
    expect(assigned[2]?.item?.kind).toBe('widget');
    expect(assigned[3]?.item?.kind).toBe('module');
    expect(assigned[4]?.item).toBeNull();
  });

  it('uses remaining items for any-bound slots after explicit bindings are satisfied', () => {
    const slots: InventoryCapabilityLoadoutSlot[] = [
      { id: 'signal', label: 'signal', icon: '✦', equipped: true, binding: 'widget' },
      { id: 'reserve', label: 'reserve', icon: '◇', equipped: false, binding: 'any' },
    ];
    const items: InventoryCapabilityItem[] = [
      { id: 'widget-1', kind: 'widget', title: 'Focus Pulse', description: '', sourceLabel: 'Store', highlights: [] },
      { id: 'module-1', kind: 'module', title: 'Automation Rack', description: '', sourceLabel: 'Store', highlights: [] },
    ];

    const assigned = assignCapabilityItemsToLoadoutSlots(slots, items);
    expect(assigned[0]?.item?.title).toBe('Focus Pulse');
    expect(assigned[1]?.item?.title).toBe('Automation Rack');
  });

  it('summarizes an empty authored loadout as empty', () => {
    const slots: InventoryCapabilityLoadoutSlot[] = [
      { id: 'shell', label: 'shell', icon: '⚙', equipped: true, binding: 'theme' },
      { id: 'signal', label: 'signal', icon: '✦', equipped: true, binding: 'widget' },
    ];

    const summary = summarizeCapabilityLoadoutAssignments(assignCapabilityItemsToLoadoutSlots(slots, []));

    expect(summary.state).toBe('empty');
    expect(summary.totalSlots).toBe(2);
    expect(summary.occupiedSlots).toBe(0);
    expect(summary.missingBindings).toEqual(['theme', 'widget']);
  });

  it('summarizes a partially satisfied authored loadout as partial', () => {
    const slots: InventoryCapabilityLoadoutSlot[] = [
      { id: 'shell', label: 'shell', icon: '⚙', equipped: true, binding: 'theme' },
      { id: 'protocol', label: 'protocol', icon: '🧰', equipped: true, binding: 'module' },
    ];
    const items: InventoryCapabilityItem[] = [
      { id: 'theme-1', kind: 'theme', title: 'Bureau Theme', description: '', sourceLabel: 'Store', highlights: [] },
    ];

    const summary = summarizeCapabilityLoadoutAssignments(assignCapabilityItemsToLoadoutSlots(slots, items));

    expect(summary.state).toBe('partial');
    expect(summary.occupiedSlots).toBe(1);
    expect(summary.missingBindings).toEqual(['module']);
    expect(summary.matchedBindings).toEqual(['theme']);
  });

  it('summarizes a fully matched authored loadout as ready', () => {
    const slots: InventoryCapabilityLoadoutSlot[] = [
      { id: 'shell', label: 'shell', icon: '⚙', equipped: true, binding: 'theme' },
      { id: 'audio', label: 'audio', icon: '🔊', equipped: true, binding: 'sound' },
      { id: 'relay', label: 'relay', icon: '📶', equipped: false, binding: 'any' },
    ];
    const items: InventoryCapabilityItem[] = [
      { id: 'theme-1', kind: 'theme', title: 'Bureau Theme', description: '', sourceLabel: 'Store', highlights: [] },
      { id: 'sound-1', kind: 'sound', title: 'Amber Tones', description: '', sourceLabel: 'Store', highlights: [] },
      { id: 'module-1', kind: 'module', title: 'Media Ops', description: '', sourceLabel: 'Store', highlights: [] },
    ];

    const summary = summarizeCapabilityLoadoutAssignments(assignCapabilityItemsToLoadoutSlots(slots, items));

    expect(summary.state).toBe('ready');
    expect(summary.occupiedSlots).toBe(3);
    expect(summary.missingBindings).toEqual([]);
    expect(summary.matchedBindings).toEqual(['theme', 'sound', 'any']);
  });
});
