import { BUILTIN_THEME_PACK_PREFIX, XTATION_THEME_OPTIONS, type XtationTheme } from '../theme/ThemeProvider';

export type StoreCategory = 'Themes' | 'Widgets' | 'Modules' | 'Packs';
export type StorePrice = { kind: 'free' } | { kind: 'one-time'; amount: number; currency: 'USD' };

export type StoreInstallTarget =
  | { kind: 'theme'; themeId: string; themeValue: XtationTheme }
  | { kind: 'widget'; widgetId: string }
  | { kind: 'module'; moduleId: string }
  | {
      kind: 'bundle';
      theme?: { themeId: string; themeValue: XtationTheme };
      widgetIds?: string[];
      moduleIds?: string[];
    };

export interface StoreItem {
  id: string;
  name: string;
  category: StoreCategory;
  price: StorePrice;
  description: string;
  highlights: string[];
  badge?: 'New' | 'Popular' | 'Limited';
  install: StoreInstallTarget;
}

export const STORE_ITEMS: StoreItem[] = [
  {
    id: 'theme-control',
    name: 'CONTROL',
    category: 'Themes',
    price: { kind: 'one-time', amount: 15, currency: 'USD' },
    description: 'The Oldest House. Pure black, zero radius, zero shadows. Brutalist government-facility UI — flat, clinical, silent. Red section headers. White inversion on selection.',
    highlights: ['Pure #000 black — zero effects', 'Zero border-radius on everything', 'Red (#d6453e) section headers only', 'White-bg + black-text selection inversion', 'Inter sans-serif — no decorative type'],
    badge: 'New',
    install: { kind: 'theme', themeId: 'theme-control', themeValue: 'control' },
  },
  {
    id: 'theme-void-command',
    name: 'Void Command',
    category: 'Themes',
    price: { kind: 'one-time', amount: 12, currency: 'USD' },
    description: 'High-contrast command skin for night sessions, tactical layouts, and calmer dark surfaces.',
    highlights: ['Uses Void theme', 'Sharper accent glow', 'Best for ops-heavy workflows'],
    badge: 'Popular',
    install: { kind: 'theme', themeId: 'theme-void-command', themeValue: 'void' },
  },
  {
    id: 'theme-bureau-warm',
    name: 'Bureau Warm',
    category: 'Themes',
    price: { kind: 'one-time', amount: 9, currency: 'USD' },
    description: 'A cleaner daylight skin with warmer neutrals and reduced visual pressure.',
    highlights: ['Uses Bureau theme', 'Warmer surfaces', 'Good for long planning sessions'],
    badge: 'New',
    install: { kind: 'theme', themeId: 'theme-bureau-warm', themeValue: 'bureau' },
  },
  {
    id: 'widget-focus-pulse',
    name: 'Focus Pulse Widget',
    category: 'Widgets',
    price: { kind: 'free' },
    description: 'A compact pulse widget for quick session state, streak heat, and next action visibility.',
    highlights: ['Compact Play widget', 'Fast glance metrics', 'Good default starter widget'],
    install: { kind: 'widget', widgetId: 'widget-focus-pulse' },
  },
  {
    id: 'widget-brief-stack',
    name: 'Brief Stack Widget',
    category: 'Widgets',
    price: { kind: 'one-time', amount: 5, currency: 'USD' },
    description: 'A stacked widget for Dusk briefs, pinned notes, and fast return-to-context actions.',
    highlights: ['Works with Dusk briefs', 'Pins linked notes', 'Good for Lab and Play'],
    install: { kind: 'widget', widgetId: 'widget-brief-stack' },
  },
  {
    id: 'module-knowledge-graph',
    name: 'Knowledge Graph Module',
    category: 'Modules',
    price: { kind: 'one-time', amount: 7, currency: 'USD' },
    description: 'Unlocks graph and relationship views for Lab knowledge links and note structure.',
    highlights: ['Graph-ready Lab mode', 'Better link discovery', 'Built for Knowledge expansion'],
    install: { kind: 'module', moduleId: 'lab-knowledge-graph' },
  },
  {
    id: 'module-media-ops',
    name: 'Media Ops Module',
    category: 'Modules',
    price: { kind: 'one-time', amount: 10, currency: 'USD' },
    description: 'Enables a stronger Media Ops lane for planning, publishing queues, and campaign control.',
    highlights: ['Media Ops lane', 'Campaign planning', 'Future publishing hooks'],
    install: { kind: 'module', moduleId: 'lab-media-ops' },
    badge: 'Limited',
  },
  {
    id: 'pack-operator-starter',
    name: 'Operator Starter Pack',
    category: 'Packs',
    price: { kind: 'one-time', amount: 18, currency: 'USD' },
    description: 'A clean starter bundle: one command skin, one focus widget, and the knowledge graph module.',
    highlights: ['Theme + widget + module', 'Fast setup', 'Best first expansion'],
    install: {
      kind: 'bundle',
      theme: { themeId: 'theme-void-command', themeValue: 'void' },
      widgetIds: ['widget-focus-pulse'],
      moduleIds: ['lab-knowledge-graph'],
    },
  },
];

export const findStoreItemById = (id: string | undefined | null) =>
  (id ? STORE_ITEMS.find((item) => item.id === id) : undefined) || null;

export const findStoreThemeByThemeValue = (theme: XtationTheme) =>
  STORE_ITEMS.find((item) => item.install.kind === 'theme' && item.install.themeValue === theme) || null;

export const includesAllStoreTargets = (source: string[], targets: string[] = []) =>
  targets.every((target) => source.includes(target));

export const getThemeLabel = (value: XtationTheme) =>
  XTATION_THEME_OPTIONS.find((option) => option.value === value)?.label || value;

export const getThemeSlotLabel = (themeId: string | undefined, themeValue: XtationTheme) => {
  if (!themeId) return `System • ${getThemeLabel(themeValue)}`;
  if (themeId.startsWith(BUILTIN_THEME_PACK_PREFIX)) {
    return `Builtin • ${getThemeLabel(themeId.slice(BUILTIN_THEME_PACK_PREFIX.length) as XtationTheme)}`;
  }
  return findStoreItemById(themeId)?.name || themeId;
};
