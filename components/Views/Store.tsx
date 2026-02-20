import React, { useMemo, useState } from 'react';
import { Search, ShoppingCart, X, Sparkles, Tag, Filter } from 'lucide-react';

type StoreCategory = 'Themes' | 'Widgets' | 'Icons' | 'Packs';

type Price = { kind: 'free' } | { kind: 'one-time'; amount: number; currency: 'USD' };

type StoreItem = {
  id: string;
  name: string;
  category: StoreCategory;
  price: Price;
  description: string;
  highlights: string[];
  badge?: 'New' | 'Popular' | 'Limited';
};

const MOCK_ITEMS: StoreItem[] = [
  {
    id: 'theme-obsidian',
    name: 'Obsidian Neon Theme',
    category: 'Themes',
    price: { kind: 'one-time', amount: 12, currency: 'USD' },
    description: 'A dark, high-contrast theme with neon accents for the Dusk dashboard.',
    highlights: ['High contrast', 'Neon accents', 'Optimized for night use'],
    badge: 'Popular',
  },
  {
    id: 'theme-sand',
    name: 'Sandstorm Minimal Theme',
    category: 'Themes',
    price: { kind: 'one-time', amount: 9, currency: 'USD' },
    description: 'Warm neutral tones with clean typography. Calm, readable, and fast.',
    highlights: ['Minimal UI', 'Warm palette', 'Extra readable'],
    badge: 'New',
  },
  {
    id: 'widget-focus',
    name: 'Focus Timer Widget',
    category: 'Widgets',
    price: { kind: 'free' },
    description: 'Pomodoro timer with streaks and quick presets. Lightweight and clean.',
    highlights: ['Pomodoro presets', 'Streak tracking', 'One-click start'],
  },
  {
    id: 'widget-notes',
    name: 'Sticky Notes Widget',
    category: 'Widgets',
    price: { kind: 'one-time', amount: 5, currency: 'USD' },
    description: 'Pin short notes, checklists, and reminders right on your dashboard.',
    highlights: ['Markdown-lite', 'Quick checklists', 'Pin to sections'],
  },
  {
    id: 'icons-carbon',
    name: 'Carbon Icon Set',
    category: 'Icons',
    price: { kind: 'one-time', amount: 7, currency: 'USD' },
    description: 'A compact icon pack that matches the client aesthetic.',
    highlights: ['120 icons', 'Sharp lines', 'Perfect for dark UI'],
  },
  {
    id: 'pack-starter',
    name: 'Starter UI Pack',
    category: 'Packs',
    price: { kind: 'one-time', amount: 18, currency: 'USD' },
    description: 'A curated bundle: theme + widgets + icons to bootstrap your dashboard.',
    highlights: ['Theme + widgets + icons', 'Consistent look', 'Best value'],
    badge: 'Limited',
  },
];

function formatPrice(p: Price) {
  if (p.kind === 'free') return 'FREE';
  return `${p.currency} $${p.amount}`;
}

export const Store: React.FC<{ uiTheme?: 'kpr' | 'valorant-a' | 'valorant-b' }> = ({ uiTheme = 'kpr' }) => {
  const isValorantB = uiTheme === 'valorant-b';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<StoreCategory | 'All'>('All');
  const [selected, setSelected] = useState<StoreItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartIds, setCartIds] = useState<string[]>([]);

  const categories: (StoreCategory | 'All')[] = ['All', 'Themes', 'Widgets', 'Icons', 'Packs'];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_ITEMS.filter((it) => {
      if (category !== 'All' && it.category !== category) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q) ||
        it.highlights.join(' ').toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  const cartItems = useMemo(() => MOCK_ITEMS.filter((i) => cartIds.includes(i.id)), [cartIds]);
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, it) => (it.price.kind === 'one-time' ? sum + it.price.amount : sum), 0);
  }, [cartItems]);

  const addToCart = (id: string) => {
    setCartIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setCartOpen(true);
  };
  const removeFromCart = (id: string) => setCartIds((prev) => prev.filter((x) => x !== id));

  return (
    <div className={(isValorantB ? 'p-10 ui-font ' : 'p-6 ') + 'h-full w-full'}>
      {/* Header */}
      {isValorantB ? (
        <div className="mb-8 ui-panel clip-cut-corner border border-white/15 bg-black/20 overflow-hidden">
          <div className="p-8 flex items-end justify-between gap-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-white/60">ARMORY</div>
              <div className="ui-heading text-4xl text-white leading-none">STORE</div>
              <div className="mt-2 text-[12px] text-white/65 max-w-[720px]">
                Mock store (static data). Next step: wire payments + real catalog, or connect to your dashboard content.
              </div>
            </div>

            <button
              onClick={() => setCartOpen(true)}
              className="h-10 px-4 clip-cut-corner border border-white/12 bg-black/25 text-white uppercase tracking-[0.25em] text-[10px] flex items-center gap-3 hover:border-white/25 transition-colors"
            >
              <ShoppingCart size={16} />
              CART
              <span className="px-2 py-1 clip-cut-corner bg-[var(--ui-accent)] text-black font-bold">{cartItems.length}</span>
            </button>
          </div>
          <div className="h-[1px] bg-[linear-gradient(90deg,transparent,rgba(255,70,85,0.7),transparent)]" />
        </div>
      ) : (
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[var(--ui-accent)]" />
              <h1 className="text-xl font-bold tracking-widest uppercase">Store</h1>
            </div>
            <p className="text-xs text-[var(--ui-muted)] mt-1 max-w-[720px]">
              Mock store (static data). Next step: wire payments + real catalog, or connect to your dashboard content.
            </p>
          </div>

          <button
            onClick={() => setCartOpen(true)}
            className="flex items-center gap-2 px-3 py-2 border border-black/20 bg-[var(--ui-panel)]/60 hover:bg-[var(--ui-panel)] transition-colors"
          >
            <ShoppingCart size={16} />
            <span className="text-xs font-bold tracking-widest">CART</span>
            <span className="text-xs text-[var(--ui-muted)]">({cartItems.length})</span>
          </button>
        </div>
      )}

      {/* Controls */}
      {isValorantB ? (
        <div className="grid grid-cols-12 gap-6 mb-8">
          {/* search */}
          <div className="col-span-12 xl:col-span-7">
            <div className="ui-panel clip-cut-corner border border-white/12 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 clip-cut-corner bg-white/5 border border-white/10 flex items-center justify-center">
                  <Search size={16} className="text-white/80" />
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search themes, widgets, icons…"
                  className="flex-1 h-10 bg-transparent outline-none text-sm text-white placeholder-white/50"
                />
                {query ? (
                  <button
                    onClick={() => setQuery('')}
                    className="h-10 w-10 clip-cut-corner border border-white/10 bg-black/20 text-white/70 hover:text-white hover:border-white/25"
                    title="Clear"
                  >
                    <X size={16} className="mx-auto" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* categories */}
          <div className="col-span-12 xl:col-span-5">
            <div className="ui-panel clip-cut-corner border border-white/12 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-white/60">
                  <Filter size={14} className="text-[var(--ui-accent)]" /> CATEGORY
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={
                        'h-10 px-4 clip-cut-corner border uppercase tracking-[0.25em] text-[10px] transition-colors ' +
                        (category === c
                          ? 'bg-[var(--ui-accent)] border-[var(--ui-accent)] text-black font-bold'
                          : 'bg-black/20 border-white/10 text-white/70 hover:text-white hover:border-white/25')
                      }
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-2 w-full md:w-[520px]">
            <div className="flex items-center gap-2 px-3 py-2 border border-black/20 bg-[var(--ui-panel)]/60 w-full">
              <Search size={16} className="text-[var(--ui-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search themes, widgets, icons..."
                className="bg-transparent outline-none text-sm w-full"
              />
              {query ? (
                <button onClick={() => setQuery('')} className="text-[var(--ui-muted)] hover:text-black">
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-[var(--ui-muted)]">
              <Filter size={14} />
              <span className="tracking-widest">CATEGORY</span>
            </div>
            <div className="flex items-center gap-1">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={
                    "px-3 py-2 text-xs font-bold tracking-widest border transition-colors " +
                    (category === c
                      ? 'bg-[var(--ui-surface)] text-white border-[var(--ui-surface)]'
                      : 'bg-[var(--ui-panel)]/60 border-black/20 hover:bg-[var(--ui-panel)]')
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className={isValorantB ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'}>
        {filtered.map((it) => (
          <div
            key={it.id}
            className={
              isValorantB
                ? 'ui-card clip-cut-corner border border-white/12 bg-black/20 overflow-hidden group'
                : 'group border border-black/15 bg-[var(--ui-panel)]/60 hover:bg-[var(--ui-panel)] transition-colors p-4 relative'
            }
          >
            {isValorantB ? (
              <>
                <div className="relative h-40 overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,70,85,0.22),transparent_45%)]" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.75))]" />

                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-3 py-1 text-[10px] uppercase tracking-[0.25em] bg-white/10 border border-white/15 clip-cut-corner text-white">
                      {it.category}
                    </span>
                    {it.badge ? (
                      <span className="px-3 py-1 text-[10px] uppercase tracking-[0.25em] bg-[var(--ui-accent)] text-black clip-cut-corner font-bold">
                        {it.badge.toUpperCase()}
                      </span>
                    ) : null}
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                    <div className="ui-heading text-2xl text-white leading-tight line-clamp-2">{it.name}</div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.35em] text-white/60">PRICE</div>
                      <div className="ui-heading text-xl text-white">{formatPrice(it.price)}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-[12px] text-white/70 leading-relaxed line-clamp-2">{it.description}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {it.highlights.slice(0, 3).map((h) => (
                      <span
                        key={h}
                        className="text-[10px] px-3 py-1 clip-cut-corner border border-white/10 bg-black/20 text-white/70 flex items-center gap-2"
                      >
                        <Tag size={12} className="text-white/50" />
                        {h}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <button
                      onClick={() => setSelected(it)}
                      className="text-[10px] uppercase tracking-[0.35em] text-white/70 hover:text-white"
                    >
                      DETAILS
                    </button>
                    <button
                      onClick={() => addToCart(it.id)}
                      className="h-10 px-4 clip-cut-corner border border-[var(--ui-accent)] bg-[var(--ui-accent)] text-black uppercase tracking-[0.25em] text-[10px] font-bold"
                    >
                      ADD
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold tracking-wide">{it.name}</h3>
                      {it.badge ? (
                        <span className="text-[10px] px-2 py-1 border border-black/20 bg-[var(--ui-panel)]/70 tracking-widest">
                          {it.badge.toUpperCase()}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[10px] text-[var(--ui-muted)] tracking-widest uppercase mt-1">{it.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold tracking-widest">{formatPrice(it.price)}</div>
                    <div className="text-[10px] text-[var(--ui-muted)] mt-1">One-time</div>
                  </div>
                </div>

                <p className="text-sm text-[var(--ui-border)] mt-3 line-clamp-2">{it.description}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {it.highlights.slice(0, 3).map((h) => (
                    <span
                      key={h}
                      className="text-[10px] px-2 py-1 border border-black/15 bg-[var(--ui-panel)]/70 text-[var(--ui-border)] flex items-center gap-1"
                    >
                      <Tag size={12} className="text-[var(--ui-muted)]" />
                      {h}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => setSelected(it)}
                    className="text-xs font-bold tracking-widest underline underline-offset-4"
                  >
                    DETAILS
                  </button>
                  <button
                    onClick={() => addToCart(it.id)}
                    className="px-3 py-2 text-xs font-bold tracking-widest bg-[var(--ui-accent)] text-white hover:brightness-110 transition"
                  >
                    ADD
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Details Modal */}
      {selected ? (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className={
            (isValorantB
              ? 'w-full max-w-[780px] ui-panel clip-cut-corner border border-white/15 bg-black/30 overflow-hidden'
              : 'w-full max-w-[720px] bg-[var(--ui-panel)] border border-black/20')
          }>
            <div className={isValorantB ? "p-6 flex items-center justify-between border-b border-white/10" : "flex items-center justify-between p-4 border-b border-black/10"}>
              <div>
                <div className="text-[10px] tracking-widest uppercase text-[var(--ui-muted)]">{selected.category}</div>
                <div className="text-lg font-bold tracking-wide">{selected.name}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className={
                  isValorantB
                    ? 'h-10 w-10 clip-cut-corner border border-white/12 bg-black/20 text-white/70 hover:text-white hover:border-white/25'
                    : 'p-2 hover:bg-black/5'
                }
              >
                <X size={18} className={isValorantB ? 'mx-auto' : ''} />
              </button>
            </div>
            <div className={isValorantB ? "p-6" : "p-4"}>
              <div className="flex items-center justify-between">
                <div className="text-sm text-[var(--ui-border)]">{selected.description}</div>
                <div className="text-right">
                  <div className="text-sm font-bold tracking-widest">{formatPrice(selected.price)}</div>
                  <div className="text-[10px] text-[var(--ui-muted)]">Mock checkout</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-[10px] tracking-widest text-[var(--ui-muted)] uppercase">What you get</div>
                <ul className={"mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 " + (isValorantB ? '' : '')}>
                  {selected.highlights.map((h) => (
                    <li
                      key={h}
                      className={
                        isValorantB
                          ? 'text-sm clip-cut-corner border border-white/10 bg-black/20 px-3 py-2 text-white/80'
                          : 'text-sm border border-black/10 bg-[var(--ui-panel)]/60 px-3 py-2'
                      }
                    >
                      {h}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={() => setSelected(null)}
                  className={
                    isValorantB
                      ? 'h-10 px-4 clip-cut-corner border border-white/12 bg-black/20 text-white/80 uppercase tracking-[0.25em] text-[10px] hover:text-white hover:border-white/25'
                      : 'px-3 py-2 border border-black/20 bg-[var(--ui-panel)] hover:bg-black/5 text-xs font-bold tracking-widest'
                  }
                >
                  CLOSE
                </button>
                <button
                  onClick={() => {
                    addToCart(selected.id);
                    setSelected(null);
                  }}
                  className={
                    isValorantB
                      ? 'h-10 px-5 clip-cut-corner border border-[var(--ui-accent)] bg-[var(--ui-accent)] text-black uppercase tracking-[0.25em] text-[10px] font-bold'
                      : 'px-4 py-2 bg-[var(--ui-accent)] text-white hover:brightness-110 text-xs font-bold tracking-widest'
                  }
                >
                  ADD TO CART
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Cart Drawer */}
      {cartOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCartOpen(false)} />
          <div
            className={
              'absolute right-0 top-0 h-full w-full max-w-[420px] flex flex-col ' +
              (isValorantB
                ? 'ui-panel border-l border-white/15 bg-black/35'
                : 'bg-[var(--ui-panel)] border-l border-black/20')
            }
          >
            <div className={isValorantB ? "p-6 border-b border-white/10 flex items-center justify-between" : "p-4 border-b border-black/10 flex items-center justify-between"}>
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} />
                <div className="font-bold tracking-widest uppercase">Cart</div>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className={
                  isValorantB
                    ? 'h-10 w-10 clip-cut-corner border border-white/12 bg-black/20 text-white/70 hover:text-white hover:border-white/25'
                    : 'p-2 hover:bg-black/5'
                }
              >
                <X size={18} className={isValorantB ? 'mx-auto' : ''} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-auto">
              {cartItems.length === 0 ? (
                <div className="text-sm text-[var(--ui-muted)]">Your cart is empty.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {cartItems.map((it) => (
                    <div key={it.id} className="border border-black/10 bg-[var(--ui-panel)]/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold">{it.name}</div>
                          <div className="text-[10px] text-[var(--ui-muted)] tracking-widest uppercase mt-1">{it.category}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold tracking-widest">{formatPrice(it.price)}</div>
                          <button
                            onClick={() => removeFromCart(it.id)}
                            className="mt-2 text-[10px] tracking-widest text-[var(--ui-accent)] underline"
                          >
                            REMOVE
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-black/10">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[var(--ui-muted)] tracking-widest uppercase">Total</div>
                <div className="text-sm font-bold tracking-widest">USD ${cartTotal}</div>
              </div>
              <button
                onClick={() => alert('Mock checkout: connect payments later.')} 
                disabled={cartItems.length === 0}
                className={
                  'mt-3 w-full px-4 py-3 text-xs font-bold tracking-widest transition ' +
                  (cartItems.length === 0
                    ? 'bg-black/10 text-black/40 cursor-not-allowed'
                    : 'bg-[var(--ui-surface)] text-white hover:brightness-110')
                }
              >
                CHECKOUT
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
