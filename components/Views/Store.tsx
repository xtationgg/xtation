import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Filter, Search, Sparkles, Tag, WandSparkles, X } from 'lucide-react';
import { useAuth } from '../../src/auth/AuthProvider';
import {
  CREATIVE_OPS_SYNC_EVENT,
  getCreativeSoundPackLabel,
  getCreativeSkinRuntimeLabel,
  persistCreativeActiveSkinId,
  readCreativeOpsStateSnapshot,
  resolvePublishedCreativeSkin,
} from '../../src/admin/creativeOps';
import { useXtationSettings } from '../../src/settings/SettingsProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import {
  STORE_ITEMS,
  type StoreCategory,
  type StoreItem,
  getThemeLabel,
  getThemeSlotLabel,
  includesAllStoreTargets,
} from '../../src/store/catalog';
import { resolveStoreCompanionAudioState } from '../../src/store/audioSync';

const formatPrice = (p: StoreItem['price']) => (p.kind === 'free' ? 'FREE' : `${p.currency} $${p.amount}`);
const storeCard = 'xt-store-card';
const storeStat = 'xt-store-stat';
const storeBar = 'xt-store-bar';
const storeChip = 'xt-store-chip';
const storeAction = 'xt-store-action';
const storeItemCard = 'xt-store-item';
const storeModal = 'xt-store-modal';
const storeInput = 'xt-store-input';
const storeIconBtn = 'xt-store-icon-btn';
const storeLink = 'xt-store-link';
const storeHighlight = 'xt-store-highlight';

export const Store: React.FC<{ uiTheme?: 'kpr' | 'valorant-a' | 'valorant-b' }> = () => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<StoreCategory | 'All'>('All');
  const [selected, setSelected] = useState<StoreItem | null>(null);
  const {
    settings,
    setActiveThemeId,
    setActiveSoundPackId,
    toggleActiveWidgetId,
    toggleActiveLabModuleId,
  } = useXtationSettings();
  const { theme, accent, setTheme, setAccent } = useTheme();
  const { user } = useAuth();
  const activeUserId = user?.id || null;
  const currentThemeLabel = getThemeLabel(theme);
  const activeThemeSlotLabel = getThemeSlotLabel(settings.unlocks.activeThemeId, theme);
  const [creativeState, setCreativeState] = useState(() => readCreativeOpsStateSnapshot(activeUserId));

  useEffect(() => {
    setCreativeState(readCreativeOpsStateSnapshot(activeUserId));

    const handleCreativeSync = () => {
      setCreativeState(readCreativeOpsStateSnapshot(activeUserId));
    };

    window.addEventListener(CREATIVE_OPS_SYNC_EVENT, handleCreativeSync as EventListener);
    return () => {
      window.removeEventListener(CREATIVE_OPS_SYNC_EVENT, handleCreativeSync as EventListener);
    };
  }, [activeUserId]);

  const activeSoundPackLabel = getCreativeSoundPackLabel(creativeState, settings.unlocks.activeSoundPackId);
  const activeRuntimeSkin = resolvePublishedCreativeSkin(
    creativeState,
    null,
    settings.unlocks.activeSoundPackId
  );
  const activeThemeAudioState = useMemo(
    () =>
      resolveStoreCompanionAudioState(
        {
          id: 'runtime-theme-audio',
          name: currentThemeLabel,
          category: 'Themes',
          price: { kind: 'free' },
          description: '',
          highlights: [],
          install: {
            kind: 'theme',
            themeId: settings.unlocks.activeThemeId || '',
            themeValue: theme,
          },
        },
        creativeState,
        settings.unlocks.activeThemeId,
        theme,
        settings.unlocks.activeSoundPackId
      ),
    [creativeState, currentThemeLabel, settings.unlocks.activeSoundPackId, settings.unlocks.activeThemeId, theme]
  );

  const categories: Array<StoreCategory | 'All'> = ['All', 'Themes', 'Widgets', 'Modules', 'Packs'];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STORE_ITEMS.filter((item) => {
      if (category !== 'All' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.highlights.join(' ').toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  const getItemState = (item: StoreItem) => {
    const companionAudio = resolveStoreCompanionAudioState(
      item,
      creativeState,
      settings.unlocks.activeThemeId,
      theme,
      settings.unlocks.activeSoundPackId
    );

    switch (item.install.kind) {
      case 'theme': {
        const active = settings.unlocks.activeThemeId === item.install.themeId;
        const aligned = !active && theme === item.install.themeValue;
        return {
          active,
          aligned,
          companionAudio,
          label: active ? 'Active' : aligned ? 'Using Base Theme' : 'Use',
          tone: active ? ('active' as const) : aligned ? ('secondary' as const) : ('primary' as const),
        };
      }
      case 'widget': {
        const active = settings.unlocks.activeWidgetIds.includes(item.install.widgetId);
        return { active, aligned: false, companionAudio, label: active ? 'Disable' : 'Enable', tone: active ? 'neutral' : 'primary' as const };
      }
      case 'module': {
        const active = settings.unlocks.activeLabModuleIds.includes(item.install.moduleId);
        return { active, aligned: false, companionAudio, label: active ? 'Disable' : 'Enable', tone: active ? 'neutral' : 'primary' as const };
      }
      case 'bundle': {
        const themeActive = item.install.theme
          ? settings.unlocks.activeThemeId === item.install.theme.themeId
          : true;
        const widgetsActive = includesAllStoreTargets(settings.unlocks.activeWidgetIds, item.install.widgetIds);
        const modulesActive = includesAllStoreTargets(settings.unlocks.activeLabModuleIds, item.install.moduleIds);
        const active = themeActive && widgetsActive && modulesActive;
        return { active, aligned: false, companionAudio, label: active ? 'Applied' : 'Apply Pack', tone: active ? 'active' : 'primary' as const };
      }
      default:
        return { active: false, aligned: false, companionAudio, label: 'Install', tone: 'primary' as const };
    }
  };

  const applyItem = (
    item: StoreItem,
    options?: { syncAudio?: boolean; audioOnly?: boolean; applySkin?: boolean }
  ) => {
    const companionAudio = resolveStoreCompanionAudioState(
      item,
      creativeState,
      settings.unlocks.activeThemeId,
      theme,
      settings.unlocks.activeSoundPackId
    );
    const shouldSyncAudio = options?.syncAudio && !!companionAudio.companionSoundPackId;
    const shouldApplySkin = options?.applySkin && !!companionAudio.companionSkin;

    const syncCompanionSkinRuntime = () => {
      if (!companionAudio.companionSkin || !companionAudio.companionSoundPackId) return;
      persistCreativeActiveSkinId(companionAudio.companionSkin.id, activeUserId);
      setTheme(companionAudio.companionSkin.theme);
      setAccent(companionAudio.companionSkin.accent);
      setActiveSoundPackId(companionAudio.companionSoundPackId);
    };

    if (options?.audioOnly) {
      if (companionAudio.companionSoundPackId) {
        setActiveSoundPackId(companionAudio.companionSoundPackId);
      }
      return;
    }

    switch (item.install.kind) {
      case 'theme':
        setActiveThemeId(item.install.themeId);
        setTheme(item.install.themeValue);
        if (shouldApplySkin) {
          syncCompanionSkinRuntime();
        } else if (shouldSyncAudio) {
          setActiveSoundPackId(companionAudio.companionSoundPackId!);
        }
        return;
      case 'widget':
        toggleActiveWidgetId(item.install.widgetId);
        return;
      case 'module':
        toggleActiveLabModuleId(item.install.moduleId);
        return;
      case 'bundle':
        if (item.install.theme) {
          setActiveThemeId(item.install.theme.themeId);
          setTheme(item.install.theme.themeValue);
          if (shouldApplySkin) {
            syncCompanionSkinRuntime();
          } else if (shouldSyncAudio) {
            setActiveSoundPackId(companionAudio.companionSoundPackId!);
          }
        }
        item.install.widgetIds?.forEach((widgetId) => {
          if (!settings.unlocks.activeWidgetIds.includes(widgetId)) {
            toggleActiveWidgetId(widgetId);
          }
        });
        item.install.moduleIds?.forEach((moduleId) => {
          if (!settings.unlocks.activeLabModuleIds.includes(moduleId)) {
            toggleActiveLabModuleId(moduleId);
          }
        });
        return;
    }
  };

  return (
    <div className="xt-store-shell min-h-full w-full overflow-y-auto px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        <section className="xt-store-hero p-6 md:p-7">
          <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
            <div>
              <div className="flex items-center gap-2 text-[var(--app-accent)]">
                <Sparkles size={16} />
                <div className="text-[10px] uppercase tracking-[0.28em]">Store / Expansion Layer</div>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[0.01em] text-[var(--app-text)] md:text-4xl">
                Add clean expansions, not core dependencies.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[color-mix(in_srgb,var(--app-text)_72%,var(--app-muted))]">
                Store should activate skins, widgets, and modules that enrich XTATION without making the core engine feel rented or incomplete.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className={`${storeStat} px-4 py-4`}>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Theme Slot</div>
                <div className="mt-2 text-lg font-semibold text-[var(--app-text)]">
                  {activeThemeSlotLabel}
                </div>
              </div>
              <div className={`${storeStat} px-4 py-4`}>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Widgets Enabled</div>
                <div className="mt-2 text-lg font-semibold text-[var(--app-text)]">{settings.unlocks.activeWidgetIds.length}</div>
              </div>
              <div className={`${storeStat} px-4 py-4`}>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Lab Modules</div>
                <div className="mt-2 text-lg font-semibold text-[var(--app-text)]">{settings.unlocks.activeLabModuleIds.length}</div>
              </div>
              <div className={`${storeStat} px-4 py-4`}>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Current Theme</div>
                <div className="mt-2 text-lg font-semibold text-[var(--app-text)]">{currentThemeLabel}</div>
              </div>
              <div className={`${storeStat} px-4 py-4`}>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Audio Route</div>
                <div className="mt-2 text-lg font-semibold text-[var(--app-text)]">{activeSoundPackLabel}</div>
              </div>
              <div className={`${storeStat} px-4 py-4`}>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Theme / Audio</div>
                <div className="mt-2 text-lg font-semibold text-[var(--app-text)]">
                  {activeThemeAudioState.status === 'aligned'
                    ? 'Aligned'
                    : activeThemeAudioState.status === 'split'
                      ? 'Split'
                      : 'Open'}
                </div>
              </div>
              <div className={`${storeStat} px-4 py-4 sm:col-span-2`}>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--app-muted)]">Skin Runtime</div>
                <div className="mt-2 text-lg font-semibold text-[var(--app-text)]">
                  {activeRuntimeSkin ? activeRuntimeSkin.name : 'System runtime'}
                </div>
                <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                  {activeRuntimeSkin
                    ? getCreativeSkinRuntimeLabel(activeRuntimeSkin)
                    : 'Apply a published skin package to align theme, accent, sound, and authored scene behavior.'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className={`${storeBar} flex items-center gap-2 px-4 py-3`}>
            <Search size={16} className="text-[var(--app-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skins, widgets, modules..."
              className={`${storeInput} w-full bg-transparent text-sm text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)]`}
            />
            {query ? (
              <button type="button" onClick={() => setQuery('')} className={`${storeIconBtn} inline-flex h-8 w-8 items-center justify-center text-[var(--app-muted)] hover:text-[var(--app-text)]`}>
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div className={`${storeBar} flex flex-wrap items-center gap-2 px-3 py-3`}>
            <div className="inline-flex items-center gap-2 px-2 text-[10px] uppercase tracking-[0.24em] text-[var(--app-muted)]">
              <Filter size={14} />
              Category
            </div>
            {categories.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setCategory(entry)}
                className={`${storeChip} px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] ${
                  category === entry
                    ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-text)]'
                    : 'border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)]'
                }`}
              >
                {entry}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const state = getItemState(item);
            const companionSkin = state.companionAudio.companionSkin;
            const companionStatus =
              state.companionAudio.status === 'aligned'
                ? 'Audio aligned'
                : state.companionAudio.status === 'split'
                  ? 'Audio split'
                  : state.companionAudio.status === 'inactive'
                    ? 'Audio available'
                    : null;
            return (
              <article
                key={item.id}
                className={`${storeItemCard} group p-5`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-semibold text-[var(--app-text)]">{item.name}</div>
                      {item.badge ? (
                        <span className={`${storeChip} border-[color-mix(in_srgb,var(--app-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]`}>
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">{item.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold tracking-widest text-[var(--app-text)]">{formatPrice(item.price)}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">
                      {state.active ? 'Installed' : state.aligned ? 'Theme matched' : 'Catalog'}
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-[var(--app-muted)]">{item.description}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.highlights.map((highlight) => (
                    <span
                      key={highlight}
                      className={`${storeChip} inline-flex items-center gap-1 border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-2)_72%,transparent)] px-2 py-1 text-[10px] text-[var(--app-muted)]`}
                    >
                      <Tag size={11} />
                      {highlight}
                    </span>
                  ))}
                  {companionSkin ? (
                    <span
                      className={`${storeChip} inline-flex items-center gap-1 border-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)] px-2 py-1 text-[10px] text-[var(--app-text)]`}
                    >
                      <Sparkles size={11} />
                      {companionSkin.name} Audio
                    </span>
                  ) : null}
                </div>

                {companionStatus ? (
                  <div className="mt-3 text-[11px] leading-5 text-[var(--app-muted)]">
                    {companionStatus}
                    {companionSkin ? (
                      <>
                        {' '}
                        · <span className="text-[var(--app-text)]">{getCreativeSkinRuntimeLabel(companionSkin)}</span>
                      </>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className={`${storeLink} text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-muted)] hover:text-[var(--app-text)]`}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => applyItem(item)}
                    className={`${storeAction} inline-flex items-center gap-2 border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      state.tone === 'active'
                        ? 'border-[color-mix(in_srgb,#74e2b8_38%,transparent)] bg-[color-mix(in_srgb,#74e2b8_12%,transparent)] text-[#74e2b8]'
                        : state.tone === 'secondary'
                          ? 'border-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)] text-[var(--app-text)]'
                        : state.tone === 'neutral'
                          ? 'border-[var(--app-border)] text-[var(--app-text)] hover:border-[var(--app-accent)]'
                          : 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-text)]'
                    }`}
                  >
                    {state.active ? <CheckCircle2 size={14} /> : <WandSparkles size={14} />}
                    {state.label}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          {(() => {
            const companionAudio = resolveStoreCompanionAudioState(
              selected,
              creativeState,
              settings.unlocks.activeThemeId,
              theme,
              settings.unlocks.activeSoundPackId
            );
            const companionSkin = companionAudio.companionSkin;
            const canSyncAudio = !!companionAudio.companionSoundPackId;
            const themeInstalled = companionAudio.status === 'aligned' || companionAudio.status === 'split';
            const skinAligned =
              !!companionSkin &&
              companionAudio.status === 'aligned' &&
              theme === companionSkin.theme &&
              accent === companionSkin.accent;
            return (
          <div className={`${storeModal} w-full max-w-[760px] p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--app-muted)]">{selected.category}</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--app-text)]">{selected.name}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className={`${storeIconBtn} inline-flex h-10 w-10 items-center justify-center p-0 text-[var(--app-muted)] hover:text-[var(--app-text)]`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="max-w-2xl text-sm leading-6 text-[var(--app-muted)]">{selected.description}</p>
              <div className="text-right">
                <div className="text-sm font-bold tracking-widest text-[var(--app-text)]">{formatPrice(selected.price)}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--app-muted)]">Mock commerce</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">What it changes</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {selected.highlights.map((highlight) => (
                  <div
                    key={highlight}
                    className={`${storeHighlight} px-3 py-3 text-sm text-[var(--app-text)]`}
                  >
                    {highlight}
                  </div>
                ))}
              </div>
            </div>

            {companionSkin ? (
              <div className="mt-6 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel)_78%,transparent)] px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted)]">Companion Audio Route</div>
                    <div className="mt-2 text-base font-semibold text-[var(--app-text)]">
                      {getCreativeSoundPackLabel(creativeState, companionAudio.companionSoundPackId)}
                    </div>
                    <div className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                      {getCreativeSkinRuntimeLabel(companionSkin)}
                    </div>
                  </div>
                  <span className={`${storeChip} px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                    companionAudio.status === 'aligned'
                      ? 'border-[color-mix(in_srgb,#74e2b8_38%,transparent)] bg-[color-mix(in_srgb,#74e2b8_12%,transparent)] text-[#74e2b8]'
                      : 'border-[color-mix(in_srgb,var(--app-accent)_18%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)] text-[var(--app-text)]'
                  }`}>
                    {companionAudio.status === 'aligned'
                      ? 'Aligned'
                      : companionAudio.status === 'split'
                        ? 'Theme active / audio split'
                        : 'Available to sync'}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className={`${storeAction} border border-[var(--app-border)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]`}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  applyItem(selected);
                  setSelected(null);
                }}
                className={`${storeAction} inline-flex items-center gap-2 border border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]`}
              >
                <WandSparkles size={14} />
                Apply
              </button>
              {canSyncAudio ? (
                <button
                  type="button"
                  onClick={() => {
                    if (themeInstalled) {
                      applyItem(selected, { audioOnly: true });
                    } else {
                      applyItem(selected, { syncAudio: true });
                    }
                    setSelected(null);
                  }}
                  className={`${storeAction} inline-flex items-center gap-2 border border-[var(--app-border)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)] hover:border-[var(--app-accent)]`}
                >
                  <Sparkles size={14} />
                  {themeInstalled ? 'Sync Audio' : 'Apply + Sync Audio'}
                </button>
              ) : null}
              {companionSkin ? (
                <button
                  type="button"
                  onClick={() => {
                    applyItem(selected, { applySkin: true });
                    setSelected(null);
                  }}
                  disabled={skinAligned}
                  className={`${storeAction} inline-flex items-center gap-2 border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    skinAligned
                      ? 'border-[color-mix(in_srgb,#74e2b8_30%,transparent)] bg-[color-mix(in_srgb,#74e2b8_10%,transparent)] text-[#74e2b8] opacity-80'
                      : 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_10%,transparent)] text-[var(--app-text)]'
                  }`}
                >
                  <Sparkles size={14} />
                  {skinAligned ? 'Skin Synced' : 'Apply Skin Package'}
                </button>
              ) : null}
            </div>
          </div>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
};
