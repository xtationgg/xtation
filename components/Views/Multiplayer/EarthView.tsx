import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Player, Pin, LocationShareState, SavedLocation } from '../../../types';
import { pinVisibleToViewer } from '../../../utils/permissions';
import { nominatimReverse, nominatimSearch } from '../../../utils/geocode';
import { timeZoneFromLatLng, utcOffsetMinutesForTimeZone } from '../../../utils/timezone';

const round2 = (val: number) => Math.round(val * 100) / 100;

type MapContextMenuTarget =
  | { kind: 'map' }
  | { kind: 'player'; playerId: string }
  | { kind: 'pin'; pinId: string };

type MapContextMenuState =
  | { open: false }
  | {
      open: true;
      x: number;
      y: number;
      lat: number;
      lng: number;
      target: MapContextMenuTarget;
    };

export interface EarthViewProps {
  pins: Pin[];
  onAddPin: (pin: Pin) => void;
  onUpdatePin: (id: string, updates: Partial<Pin>) => void;
  onDeletePin: (id: string) => void;
  myLocation: { lat: number; lng: number } | null;
  setMyLocation: (loc: { lat: number; lng: number } | null) => void;
  sharingByPlayer: Record<string, LocationShareState>;
  setSharingByPlayer: (updater: (prev: Record<string, LocationShareState>) => Record<string, LocationShareState>) => void;
  viewAsId: string;
  players: Player[];
  startLive: (durationMs: number, playerIds: string[]) => void;
  stopLive: (playerIds: string[]) => void;
  setToast: (msg: string) => void;
  focusLocation?: { playerId: string; loc: { lat: number; lng: number; label?: string } } | null;

  savedLocations: SavedLocation[];
  setSavedLocations: React.Dispatch<React.SetStateAction<SavedLocation[]>>;

  pickPlayerId: string | null;
  onClearPickPlayer: () => void;
  onSetPlayerLocation: (playerId: string, loc: Player['location'] | undefined, extras?: Partial<Player>) => void;
}

const FlyTo: React.FC<{ loc: { lat: number; lng: number } | null; zoom?: number }> = ({ loc, zoom }) => {
  const map = useMap();
  React.useEffect(() => {
    if (!loc) return;
    map.flyTo([loc.lat, loc.lng], typeof zoom === 'number' ? zoom : Math.max(map.getZoom(), 6), { duration: 0.8 });
  }, [loc, zoom, map]);
  return null;
};

// Leaflet often renders gray areas if the container size changes after mount.
// This forces a re-measure so tiles fill the full visible area.
const MapSizer: React.FC<{ bump: any }> = ({ bump }) => {
  const map = useMap();
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 50);
    return () => window.clearTimeout(t);
  }, [map, bump]);
  return null;
};

export const EarthView: React.FC<EarthViewProps> = ({
  pins,
  onAddPin,
  onUpdatePin,
  onDeletePin,
  myLocation,
  setMyLocation,
  sharingByPlayer,
  setSharingByPlayer,
  viewAsId,
  players,
  startLive,
  stopLive,
  setToast,
  focusLocation,
  savedLocations,
  setSavedLocations,
  pickPlayerId,
  onClearPickPlayer,
  onSetPlayerLocation,
}) => {
  const [focusedPlayerId, setFocusedPlayerId] = React.useState<string | null>(focusLocation?.playerId || null);
  const mapWrapRef = React.useRef<HTMLDivElement | null>(null);
  const leafletMapRef = React.useRef<any>(null);
  const lastCtxOpenAtRef = React.useRef<number>(0);
  const [ctxMenu, setCtxMenu] = React.useState<MapContextMenuState>({ open: false });

  // Sync focus from external navigation (e.g., "View on map")
  React.useEffect(() => {
    if (focusLocation?.playerId) setFocusedPlayerId(focusLocation.playerId);
  }, [focusLocation?.playerId]);

  const focusPlayer = focusedPlayerId ? players.find(p => p.id === focusedPlayerId) : null;

  const viewer = players.find(p => p.id === viewAsId);
  const [mapCenter] = React.useState<[number, number]>([pins[0]?.lat || 37.7749, pins[0]?.lng || -122.4194]);

  // Ops Map controls
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<{ displayName: string; lat: number; lng: number }[]>([]);
  const [flyTarget, setFlyTarget] = React.useState<{ lat: number; lng: number } | null>(null);
  const [locateTick, setLocateTick] = React.useState(0);
  const [mapLayer, setMapLayer] = React.useState<'dark' | 'osm'>('dark');

  const myLocationIcon = React.useMemo(() => {
    return L.divIcon({
      className: 'earth-mypos-icon',
      html: '<div class="earth-mypos-pulse"></div><div class="earth-mypos-dot"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }, []);
  const [showPeople, setShowPeople] = React.useState(true);
  const [peopleFilter, setPeopleFilter] = React.useState<'all' | 'favorites'>('all');
  const [tagFilter, setTagFilter] = React.useState<string>('');
  const [nearRadiusKm, setNearRadiusKm] = React.useState<number>(5);
  const [addPinMode, setAddPinMode] = React.useState(false);

  const [savedTagFilter, setSavedTagFilter] = React.useState<string>('');
  const [savedOnlyFav, setSavedOnlyFav] = React.useState(false);

  const modeState = sharingByPlayer[viewAsId] || { mode: 'off' as const };
  const approx = modeState.mode === 'city' && myLocation ? { lat: round2(myLocation.lat), lng: round2(myLocation.lng) } : null;
  const liveVisible = modeState.mode === 'live' && myLocation && (!modeState.liveExpiresAt || modeState.liveExpiresAt > Date.now());
  const isViewingSelf = viewAsId === 'me';
  const visiblePins = React.useMemo(
    () => pins.filter(p => pinVisibleToViewer(p, viewAsId, viewer, p.createdBy)),
    [pins, viewAsId, viewer]
  );

  const allTags = React.useMemo(() => {
    const s = new Set<string>();
    players.forEach(p => (p.tags || []).forEach(t => s.add(String(t))));
    return Array.from(s).sort();
  }, [players]);

  const filteredPeople = React.useMemo(() => {
    return players
      .filter(p => !!p.location)
      .filter(p => (peopleFilter === 'favorites' ? !!p.favorite : true))
      .filter(p => (tagFilter ? (p.tags || []).includes(tagFilter) : true));
  }, [players, peopleFilter, tagFilter]);

  const savedTags = React.useMemo(() => {
    const s = new Set<string>();
    savedLocations.forEach(l => (l.tags || []).forEach(t => s.add(String(t))));
    return Array.from(s).sort();
  }, [savedLocations]);

  const filteredSavedLocations = React.useMemo(() => {
    return savedLocations
      .filter(l => (savedOnlyFav ? !!l.favorite : true))
      .filter(l => (savedTagFilter ? (l.tags || []).includes(savedTagFilter) : true))
      .slice();
  }, [savedLocations, savedOnlyFav, savedTagFilter]);

  const nearPeople = React.useMemo(() => {
    if (!myLocation) return [] as { player: Player; km: number }[];
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const distKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const s1 = Math.sin(dLat / 2);
      const s2 = Math.sin(dLng / 2);
      const aa = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
      const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
      return R * c;
    };

    return filteredPeople
      .map(p => ({ player: p, km: distKm(myLocation, p.location!) }))
      .filter(x => x.km <= nearRadiusKm)
      .sort((a, b) => a.km - b.km);
  }, [myLocation, filteredPeople, nearRadiusKm]);

  // Search (debounced)
  React.useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchError('');
      return;
    }

    const t = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError('');
      try {
        const res = await nominatimSearch(q, 6);
        setSearchResults(res);
      } catch (e: any) {
        setSearchError(e?.message || 'Search failed');
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 450);

    return () => window.clearTimeout(t);
  }, [searchQuery]);

  const closeCtxMenu = React.useCallback(() => setCtxMenu({ open: false }), []);

  // Close context menu on outside click / escape
  React.useEffect(() => {
    if (!ctxMenu.open) return;
    const onDown = (ev: MouseEvent) => {
      // If click is inside the menu itself, don't close here; menu items will close explicitly.
      const el = ev.target as HTMLElement | null;
      if (el && el.closest('[data-earth-ctxmenu]')) return;
      closeCtxMenu();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') closeCtxMenu();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [ctxMenu.open, closeCtxMenu]);

  const openCtxMenu = React.useCallback(
    (opts: { x: number; y: number; lat: number; lng: number; target: MapContextMenuTarget }) => {
      lastCtxOpenAtRef.current = Date.now();
      setCtxMenu({ open: true, x: opts.x, y: opts.y, lat: opts.lat, lng: opts.lng, target: opts.target });
    },
    []
  );

  // Native capturing listener: fixes cases where Leaflet stops bubbling of `contextmenu`.
  React.useEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;

    const onCtx = (ev: MouseEvent) => {
      // Always block browser menu
      ev.preventDefault();

      const map = leafletMapRef.current;
      if (!map) return;

      // If Leaflet handler already opened it, avoid double-open flicker
      const now = Date.now();
      if (now - lastCtxOpenAtRef.current < 50) return;

      try {
        const rect = el.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        const latlng = map.mouseEventToLatLng(ev);
        openCtxMenu({ x, y, lat: latlng.lat, lng: latlng.lng, target: { kind: 'map' } });
      } catch {}
    };

    // capture=true so we still get the event even if Leaflet stopsPropagation
    el.addEventListener('contextmenu', onCtx, { capture: true });
    return () => el.removeEventListener('contextmenu', onCtx, { capture: true } as any);
  }, [openCtxMenu]);

  const handleMapClick = async (e: any) => {
    // Any normal click closes menu
    if (ctxMenu.open) closeCtxMenu();
    // Pick-person-location mode
    if (pickPlayerId) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      const label = (await nominatimReverse(lat, lng)) || 'Picked location';
      const tz = timeZoneFromLatLng(lat, lng);
      const offset = tz ? utcOffsetMinutesForTimeZone(tz) : null;
      onSetPlayerLocation(
        pickPlayerId,
        { lat, lng, label },
        { timeZone: tz || undefined, utcOffsetMinutes: typeof offset === 'number' ? offset : undefined }
      );
      setToast('Player location set');
      onClearPickPlayer();
      return;
    }

    // Add-pin mode
    if (!addPinMode) return;
    onAddPin({
      id: `pin-${Date.now()}`,
      title: 'New Pin',
      note: '',
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      scope: 'close',
      sharedWith: [],
      createdBy: viewer?.id || 'me',
    });
    setToast('Pin added');
  };

  const handleQuickMode = (mode: LocationShareState['mode'], durationMs?: number) => {
    if (mode === 'live') {
      if (!navigator.geolocation) {
        setToast('Geolocation not available');
        return;
      }
      startLive(durationMs || 15 * 60 * 1000, Object.keys(sharingByPlayer));
      setToast('Live sharing started');
    } else {
      stopLive(Object.keys(sharingByPlayer));
      setSharingByPlayer(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(id => {
          next[id] = { mode };
        });
        return next;
      });
      setToast(mode === 'city' ? 'City sharing enabled' : 'Sharing off');
    }
  };

  return (
    <div className="grid lg:grid-cols-[320px,1fr,360px] gap-6 items-start text-[#e6e8ee]">
      {/* Ops Sidebar */}
      <div className="bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded-lg shadow-sm p-4 space-y-4 max-h-[calc(100vh-220px)] overflow-auto">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)]">Ops Map</div>

        {/* Search */}
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Search</div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search location…"
            className="w-full border border-[var(--ui-border)] rounded px-2 py-2 text-sm"
          />
          {searchLoading && <div className="text-[11px] text-[var(--ui-muted)]">Searching…</div>}
          {searchError && <div className="text-[11px] text-[var(--ui-accent)]">{searchError}</div>}

          {!!searchResults.length && (
            <div className="border border-[var(--ui-border)] rounded overflow-hidden">
              {searchResults.map((r, idx) => {
                const parts = r.displayName.split(',').map(s => s.trim()).filter(Boolean);
                const title = parts[0] || r.displayName;
                const subtitle = parts.slice(1, 4).join(', ');
                return (
                  <div key={idx} className="border-b border-[var(--ui-border)]">
                    <button
                      type="button"
                      onClick={() => {
                        setFlyTarget({ lat: r.lat, lng: r.lng });
                        setToast('Centered map');
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-[#171b22]"
                    >
                      <div className="text-sm font-semibold text-[#e6e8ee] truncate">{title}</div>
                      {subtitle && <div className="text-xs text-[var(--ui-muted)] truncate">{subtitle}</div>}
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">{r.lat.toFixed(4)}, {r.lng.toFixed(4)}</div>
                    </button>
                    <div className="px-3 pb-2 flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          const name = window.prompt('Save location name?', title);
                          if (!name) return;
                          const item: SavedLocation = {
                            id: `loc-${Date.now()}`,
                            title: name,
                            lat: r.lat,
                            lng: r.lng,
                            createdAt: Date.now(),
                            lastVisitedAt: Date.now(),
                          };
                          setSavedLocations(prev => [item, ...prev]);
                          setToast('Saved location');
                        }}
                        className="text-[11px] uppercase tracking-[0.2em] border border-[#0f1115] px-2 py-1 rounded hover:bg-[#0f1115] hover:text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onAddPin({
                            id: `pin-${Date.now()}`,
                            title,
                            note: subtitle,
                            lat: r.lat,
                            lng: r.lng,
                            scope: 'close',
                            sharedWith: [],
                            createdBy: viewer?.id || 'me',
                          });
                          setToast('Pin created from search');
                        }}
                        className="text-[11px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-2 py-1 rounded hover:border-[#0f1115]"
                      >
                        Drop pin
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pick mode banner */}
        {pickPlayerId && (
          <div className="border border-[var(--ui-accent)] bg-[#fff5f6] rounded p-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-accent)] font-semibold">Pick mode</div>
            <div className="text-sm text-[#e6e8ee]">Click on the map to set location for: <span className="font-semibold">{players.find(p => p.id === pickPlayerId)?.name || pickPlayerId}</span></div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => { onClearPickPlayer(); setToast('Pick mode cancelled'); }}
                className="text-[11px] uppercase tracking-[0.2em] border border-[var(--ui-accent)] text-[var(--ui-accent)] px-2 py-1 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Pin tool */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Pin tool</div>
            <button
              type="button"
              onClick={() => {
                setAddPinMode(v => !v);
                setToast(!addPinMode ? 'Add-pin mode ON (click map)' : 'Add-pin mode OFF');
              }}
              className={
                'text-[11px] uppercase tracking-[0.2em] border px-2 py-1 rounded ' +
                (addPinMode ? 'border-[var(--ui-accent)] text-[var(--ui-accent)]' : 'border-[var(--ui-border)] text-[var(--ui-muted)]')
              }
            >
              {addPinMode ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="text-[11px] text-[var(--ui-muted)]">When ON: clicking the map creates a pin.</div>
        </div>

        {/* Saved Locations */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Saved locations</div>
            <button
              type="button"
              onClick={() => {
                const title = window.prompt('Save location name?', 'Saved Place');
                if (!title) return;
                const tagsRaw = window.prompt('Tags / folders? (comma separated)', '');
                const tags = (tagsRaw || '')
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean);
                const loc = flyTarget || (focusLocation?.loc ?? null) || (myLocation ?? null) || { lat: mapCenter[0], lng: mapCenter[1] };
                const item: SavedLocation = {
                  id: `loc-${Date.now()}`,
                  title,
                  lat: loc.lat,
                  lng: loc.lng,
                  tags,
                  createdAt: Date.now(),
                  lastVisitedAt: Date.now(),
                };
                setSavedLocations(prev => [item, ...prev]);
                setToast('Saved location');
              }}
              className="text-[11px] uppercase tracking-[0.2em] border border-[#0f1115] px-2 py-1 rounded hover:bg-[#0f1115] hover:text-white"
            >
              Save
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={savedTagFilter}
              onChange={(e) => setSavedTagFilter(e.target.value)}
              className="flex-1 border border-[var(--ui-border)] rounded px-2 py-2 text-sm bg-[var(--ui-panel)]"
            >
              <option value="">All folders</option>
              {savedTags.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <label className="text-[11px] text-[var(--ui-muted)] flex items-center gap-2">
              <input type="checkbox" checked={savedOnlyFav} onChange={(e) => setSavedOnlyFav(e.target.checked)} />
              Fav
            </label>
          </div>

          {filteredSavedLocations.map(loc => (
            <div key={loc.id} className="border border-[var(--ui-border)] rounded overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setFlyTarget({ lat: loc.lat, lng: loc.lng });
                  setSavedLocations(prev => prev.map(x => (x.id === loc.id ? { ...x, lastVisitedAt: Date.now() } : x)));
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#171b22]"
              >
                <div className="text-sm font-semibold text-[#e6e8ee] truncate">{loc.title}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">{loc.lat.toFixed(3)}, {loc.lng.toFixed(3)}</div>
              </button>
              <div className="px-3 pb-2 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const name = window.prompt('Rename saved location', loc.title);
                    if (!name) return;
                    setSavedLocations(prev => prev.map(x => (x.id === loc.id ? { ...x, title: name } : x)));
                    setToast('Renamed');
                  }}
                  className="text-[11px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-2 py-1 rounded hover:border-[#0f1115]"
                >
                  Rename
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSavedLocations(prev => prev.map(x => (x.id === loc.id ? { ...x, favorite: !x.favorite } : x)));
                  }}
                  className={
                    'text-[11px] uppercase tracking-[0.2em] border px-2 py-1 rounded ' +
                    (loc.favorite ? 'border-[var(--ui-accent)] text-[var(--ui-accent)]' : 'border-[var(--ui-border)] text-[var(--ui-muted)]')
                  }
                >
                  {loc.favorite ? 'Fav' : 'Fav'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const tagsRaw = window.prompt('Edit tags/folders (comma separated)', (loc.tags || []).join(', '));
                    if (tagsRaw === null) return;
                    const tags = tagsRaw.split(',').map(s => s.trim()).filter(Boolean);
                    setSavedLocations(prev => prev.map(x => (x.id === loc.id ? { ...x, tags } : x)));
                    setToast('Tags updated');
                  }}
                  className="text-[11px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-2 py-1 rounded hover:border-[#0f1115]"
                >
                  Tags
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm('Delete this saved location?')) return;
                    setSavedLocations(prev => prev.filter(x => x.id !== loc.id));
                    setToast('Deleted');
                  }}
                  className="text-[11px] uppercase tracking-[0.2em] border border-[var(--ui-accent)] text-[var(--ui-accent)] px-2 py-1 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!savedLocations.length && <div className="text-[11px] text-[var(--ui-muted)]">No saved locations yet.</div>}
        </div>

        {/* People */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">People</div>
            <label className="text-[11px] text-[var(--ui-muted)] flex items-center gap-2">
              <input type="checkbox" checked={showPeople} onChange={(e) => setShowPeople(e.target.checked)} />
              Show
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPeopleFilter('all')}
              className={
                'text-[11px] px-2 py-1 rounded border ' +
                (peopleFilter === 'all' ? 'border-[#0f1115] bg-[#0f1115] text-white' : 'border-[var(--ui-border)] text-[var(--ui-muted)]')
              }
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setPeopleFilter('favorites')}
              className={
                'text-[11px] px-2 py-1 rounded border ' +
                (peopleFilter === 'favorites' ? 'border-[#0f1115] bg-[#0f1115] text-white' : 'border-[var(--ui-border)] text-[var(--ui-muted)]')
              }
            >
              Favorites
            </button>
          </div>

          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="w-full border border-[var(--ui-border)] rounded px-2 py-2 text-sm bg-[var(--ui-panel)]"
          >
            <option value="">All tags</option>
            {allTags.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <div className="space-y-2">
            {filteredPeople.slice(0, 12).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setFocusedPlayerId(p.id);
                  setFlyTarget({ lat: p.location!.lat, lng: p.location!.lng });
                }}
                className="w-full text-left border border-[var(--ui-border)] rounded px-3 py-2 hover:border-[#0f1115]"
              >
                <div className="text-sm font-semibold text-[#e6e8ee] truncate">{p.name}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)] truncate">{p.location?.label || ''}</div>
              </button>
            ))}
            {filteredPeople.length > 12 && <div className="text-[11px] text-[var(--ui-muted)]">+{filteredPeople.length - 12} more</div>}
            {!filteredPeople.length && <div className="text-[11px] text-[var(--ui-muted)]">No people with location.</div>}
          </div>
        </div>

        {/* Near me */}
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Near me</div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                if (!navigator.geolocation) {
                  setToast('Geolocation not available');
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  pos => {
                    setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setToast('My location set');
                  },
                  () => setToast('Location permission denied')
                );
              }}
              className="text-[11px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-2 py-1 rounded"
            >
              Set my location
            </button>
            <select
              value={String(nearRadiusKm)}
              onChange={(e) => setNearRadiusKm(Number(e.target.value))}
              className="border border-[var(--ui-border)] rounded px-2 py-1 text-[11px] bg-[var(--ui-panel)]"
            >
              {[1, 5, 10, 50].map(km => (
                <option key={km} value={String(km)}>{km}km</option>
              ))}
            </select>
          </div>
          {myLocation ? (
            <div className="text-[11px] text-[var(--ui-muted)]">{nearPeople.length} people within {nearRadiusKm}km</div>
          ) : (
            <div className="text-[11px] text-[var(--ui-muted)]">Set your location to see nearby people.</div>
          )}
          <div className="space-y-2">
            {nearPeople.slice(0, 8).map(x => (
              <button
                key={x.player.id}
                type="button"
                onClick={() => {
                  setFocusedPlayerId(x.player.id);
                  setFlyTarget({ lat: x.player.location!.lat, lng: x.player.location!.lng });
                }}
                className="w-full text-left border border-[var(--ui-border)] rounded px-3 py-2 hover:border-[#0f1115]"
              >
                <div className="text-sm font-semibold text-[#e6e8ee]">{x.player.name}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">{x.km.toFixed(1)} km</div>
              </button>
            ))}
            {myLocation && !nearPeople.length && <div className="text-[11px] text-[var(--ui-muted)]">No one nearby.</div>}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded-lg shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)]">
          <span>Map</span>
          <div className="text-[11px] text-[var(--ui-muted)]">Ops Map</div>
        </div>

        <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Pins: {visiblePins.length}</div>
        <div
          ref={mapWrapRef}
          className="relative h-[720px] bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded overflow-hidden"
          onContextMenu={(e) => {
            // Always block the browser context menu inside the map area
            e.preventDefault();
          }}
        >
          {/* Floating map controls */}
          <div className="pointer-events-none absolute z-[900] right-4 top-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setMapLayer(v => (v === 'dark' ? 'osm' : 'dark'));
                setToast(mapLayer === 'dark' ? 'Map: standard' : 'Map: dark');
              }}
              className="pointer-events-auto px-3 h-10 rounded bg-[var(--ui-panel)] border border-[#3a3f4b] shadow-sm hover:bg-[#171b22] text-[11px] uppercase tracking-[0.2em] text-[#e6e8ee]"
              title="Switch map layer"
            >
              {mapLayer === 'dark' ? 'Dark' : 'Standard'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!navigator.geolocation) {
                  setToast('Geolocation not available');
                  return;
                }

                setToast('Getting current location…');
                let didFinish = false;
                const safety = window.setTimeout(() => {
                  if (!didFinish) setToast('Location request timed out (no response)');
                }, 13000);

                navigator.geolocation.getCurrentPosition(
                  pos => {
                    didFinish = true;
                    window.clearTimeout(safety);

                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setMyLocation(loc);
                    setFlyTarget(loc);
                    setLocateTick(t => t + 1);

                    // Force a center immediately using Leaflet map instance as well
                    try {
                      leafletMapRef.current?.flyTo([loc.lat, loc.lng], Math.max(13, leafletMapRef.current?.getZoom?.() || 0), { duration: 0.8 });
                    } catch {}

                    setToast('Centered on my location');
                  },
                  (err) => {
                    didFinish = true;
                    window.clearTimeout(safety);

                    const code = (err as any)?.code;
                    const msg = (err as any)?.message;
                    setToast(`Location error${code ? ` (${code})` : ''}: ${msg || 'Unknown error'}`);
                  },
                  { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
                );
              }}
              className="pointer-events-auto w-10 h-10 rounded bg-[var(--ui-panel)] border border-[#3a3f4b] shadow-sm hover:bg-[#171b22] text-sm font-semibold text-[#e6e8ee]"
              title="My location"
            >
              ⦿
            </button>
          </div>
          <MapContainer
            center={mapCenter}
            zoom={5}
            style={{ width: '100%', height: '100%' }}
            whenCreated={(map) => {
              leafletMapRef.current = map;
              map.on('click', handleMapClick);
              map.on('contextmenu', (e: any) => {
                try {
                  e?.originalEvent?.preventDefault?.();
                } catch {}
                const pt = e?.containerPoint;
                const x = typeof pt?.x === 'number' ? pt.x : (e?.originalEvent?.clientX ?? 0);
                const y = typeof pt?.y === 'number' ? pt.y : (e?.originalEvent?.clientY ?? 0);
                openCtxMenu({ x, y, lat: e.latlng.lat, lng: e.latlng.lng, target: { kind: 'map' } });
              });
            }}
          >
            {mapLayer === 'dark' ? (
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
            ) : (
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
            )}
            <MapSizer bump={String(pickPlayerId || '') + '|' + String(flyTarget?.lat || '') + '|' + String(flyTarget?.lng || '')} />
            <FlyTo loc={flyTarget || focusLocation?.loc || null} zoom={locateTick ? 13 : undefined} />

            {/* People markers */}
            {showPeople && filteredPeople.map(p => (
              <Marker
                key={`person-${p.id}`}
                position={[p.location!.lat, p.location!.lng] as LatLngExpression}
                eventHandlers={{
                  click: () => setFocusedPlayerId(p.id),
                  contextmenu: (e: any) => {
                    try {
                      e?.originalEvent?.preventDefault?.();
                    } catch {}
                    const pt = e?.containerPoint;
                    const x = typeof pt?.x === 'number' ? pt.x : (e?.originalEvent?.clientX ?? 0);
                    const y = typeof pt?.y === 'number' ? pt.y : (e?.originalEvent?.clientY ?? 0);
                    openCtxMenu({ x, y, lat: e.latlng.lat, lng: e.latlng.lng, target: { kind: 'player', playerId: p.id } });
                  },
                }}
              >
                <Popup>
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-[var(--ui-muted)]">{p.location?.label || ''}</div>
                </Popup>
              </Marker>
            ))}
            {myLocation && (
              <Marker position={[myLocation.lat, myLocation.lng] as LatLngExpression} icon={myLocationIcon}>
                <Popup>{liveVisible ? 'Live location' : 'My location'}</Popup>
              </Marker>
            )}
            {approx && (
              <Marker position={[approx.lat, approx.lng] as LatLngExpression}>
                <Popup>Approx area</Popup>
              </Marker>
            )}
            {approx && (
              <Circle center={[approx.lat, approx.lng]} radius={3000} pathOptions={{ color: '#ff2a3a', fillColor: '#ff2a3a', fillOpacity: 0.08, opacity: 0.3 }} />
            )}
            {visiblePins.map(pin => (
              <Marker
                key={pin.id}
                position={[pin.lat, pin.lng] as LatLngExpression}
                eventHandlers={{
                  contextmenu: (e: any) => {
                    try {
                      e?.originalEvent?.preventDefault?.();
                    } catch {}
                    const pt = e?.containerPoint;
                    const x = typeof pt?.x === 'number' ? pt.x : (e?.originalEvent?.clientX ?? 0);
                    const y = typeof pt?.y === 'number' ? pt.y : (e?.originalEvent?.clientY ?? 0);
                    openCtxMenu({ x, y, lat: e.latlng.lat, lng: e.latlng.lng, target: { kind: 'pin', pinId: pin.id } });
                  },
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <div className="font-semibold text-sm">{pin.title}</div>
                    <div className="text-xs text-[var(--ui-muted)]">{pin.note || 'No note'}</div>
                    <div className="text-[10px] uppercase text-[var(--ui-muted)]">Scope: {pin.scope}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Custom right-click menu */}
          {ctxMenu.open && (
            <div
              data-earth-ctxmenu
              className="absolute z-[9999] min-w-[220px] bg-[var(--ui-panel)] border border-[#3a3f4b] rounded shadow-lg overflow-hidden"
              style={{ left: ctxMenu.x, top: ctxMenu.y }}
            >
              <div className="px-3 py-2 border-b border-[var(--ui-border)]">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Map options</div>
                <div className="text-xs text-[var(--ui-muted)]">
                  {ctxMenu.lat.toFixed(5)}, {ctxMenu.lng.toFixed(5)}
                </div>
              </div>

              {/* Map empty-space menu */}
              {ctxMenu.target.kind === 'map' && (
                <div className="p-2 space-y-1">
                  <button
                    type="button"
                    onClick={async () => {
                      // If you're picking a player's location, right-click can also set it
                      if (pickPlayerId) {
                        const lat = ctxMenu.lat;
                        const lng = ctxMenu.lng;
                        const label = (await nominatimReverse(lat, lng)) || 'Picked location';
                        const tz = timeZoneFromLatLng(lat, lng);
                        const offset = tz ? utcOffsetMinutesForTimeZone(tz) : null;
                        onSetPlayerLocation(
                          pickPlayerId,
                          { lat, lng, label },
                          { timeZone: tz || undefined, utcOffsetMinutes: typeof offset === 'number' ? offset : undefined }
                        );
                        setToast('Player location set');
                        onClearPickPlayer();
                        closeCtxMenu();
                        return;
                      }

                      const name = window.prompt('Save location name?', 'Saved Place');
                      if (!name) return;
                      const item: SavedLocation = {
                        id: `loc-${Date.now()}`,
                        title: name,
                        lat: ctxMenu.lat,
                        lng: ctxMenu.lng,
                        createdAt: Date.now(),
                        lastVisitedAt: Date.now(),
                      };
                      setSavedLocations(prev => [item, ...prev]);
                      setToast('Saved location');
                      closeCtxMenu();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[#171b22] text-sm"
                  >
                    {pickPlayerId ? 'Set player location here' : 'Save location here'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onAddPin({
                        id: `pin-${Date.now()}`,
                        title: 'New Pin',
                        note: '',
                        lat: ctxMenu.lat,
                        lng: ctxMenu.lng,
                        scope: 'close',
                        sharedWith: [],
                        createdBy: viewer?.id || 'me',
                      });
                      setToast('Pin added');
                      closeCtxMenu();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[#171b22] text-sm"
                  >
                    Drop pin here
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFlyTarget({ lat: ctxMenu.lat, lng: ctxMenu.lng });
                      setToast('Centered map');
                      closeCtxMenu();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[#171b22] text-sm"
                  >
                    Center here
                  </button>
                </div>
              )}

              {/* Player menu */}
              {ctxMenu.target.kind === 'player' && (
                <div className="p-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFocusedPlayerId(ctxMenu.target.playerId);
                      setFlyTarget({ lat: ctxMenu.lat, lng: ctxMenu.lng });
                      setToast('Focused player');
                      closeCtxMenu();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[#171b22] text-sm"
                  >
                    Focus player
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`${ctxMenu.lat},${ctxMenu.lng}`);
                        setToast('Coords copied');
                      } catch {
                        setToast('Copy failed');
                      }
                      closeCtxMenu();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[#171b22] text-sm"
                  >
                    Copy coords
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const p = players.find(pp => pp.id === ctxMenu.target.playerId);
                      const item: SavedLocation = {
                        id: `loc-${Date.now()}`,
                        title: `${p?.name || 'Player'} — Location`,
                        lat: ctxMenu.lat,
                        lng: ctxMenu.lng,
                        tags: ['people'],
                        createdAt: Date.now(),
                        lastVisitedAt: Date.now(),
                      };
                      setSavedLocations(prev => [item, ...prev]);
                      setToast('Saved location');
                      closeCtxMenu();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[#171b22] text-sm"
                  >
                    Save this player location
                  </button>
                </div>
              )}

              {/* Pin menu (practical actions) */}
              {ctxMenu.target.kind === 'pin' && (
                <div className="p-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFlyTarget({ lat: ctxMenu.lat, lng: ctxMenu.lng });
                      setToast('Centered map');
                      closeCtxMenu();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[#171b22] text-sm"
                  >
                    Focus / center here
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      // Shareable link (Google Maps)
                      const url = `https://www.google.com/maps?q=${ctxMenu.lat},${ctxMenu.lng}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        setToast('Map link copied');
                      } catch {
                        setToast('Copy failed');
                      }
                      closeCtxMenu();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[#171b22] text-sm"
                  >
                    Copy map link
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      // Convert pin -> saved location (useful library)
                      const pin = visiblePins.find(p => p.id === ctxMenu.target.pinId);
                      const title = window.prompt('Save as location name?', pin?.title || 'Saved Place');
                      if (!title) return;
                      const item: SavedLocation = {
                        id: `loc-${Date.now()}`,
                        title,
                        lat: ctxMenu.lat,
                        lng: ctxMenu.lng,
                        tags: ['pins'],
                        createdAt: Date.now(),
                        lastVisitedAt: Date.now(),
                      };
                      setSavedLocations(prev => [item, ...prev]);
                      setToast('Saved to locations');
                      closeCtxMenu();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[#171b22] text-sm"
                  >
                    Save pin as location
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      // Practical sharing control right from the map
                      const scope = window.prompt('Pin visibility? (private / close / specific)', visiblePins.find(p => p.id === ctxMenu.target.pinId)?.scope || 'close');
                      if (!scope) return;
                      if (!['private', 'close', 'specific'].includes(scope)) {
                        setToast('Invalid scope');
                        return;
                      }
                      onUpdatePin(ctxMenu.target.pinId, { scope: scope as Pin['scope'] });
                      setToast('Pin visibility updated');
                      closeCtxMenu();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[#171b22] text-sm"
                  >
                    Change visibility
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      // Keep destructive actions, but not as the main vibe.
                      if (!window.confirm('Delete this pin?')) return;
                      onDeletePin(ctxMenu.target.pinId);
                      setToast('Pin deleted');
                      closeCtxMenu();
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-[#fff5f6] text-sm text-[var(--ui-accent)]"
                  >
                    Delete pin
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
          {visiblePins.map(pin => (
            <div key={pin.id} className="border border-[var(--ui-border)] rounded p-2 text-sm space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={pin.title}
                  onChange={e => onUpdatePin(pin.id, { title: e.target.value })}
                  className="border border-[var(--ui-border)] rounded px-2 py-1 text-sm flex-1"
                />
              </div>
              <textarea
                value={pin.note || ''}
                onChange={e => onUpdatePin(pin.id, { note: e.target.value })}
                className="w-full border border-[var(--ui-border)] rounded px-2 py-1 text-sm"
                rows={2}
                placeholder="Note"
              />
              <div className="grid grid-cols-2 gap-2 text-xs text-[var(--ui-muted)]">
                <input
                  type="number"
                  value={pin.lat}
                  onChange={e => onUpdatePin(pin.id, { lat: parseFloat(e.target.value) || 0 })}
                  className="border border-[var(--ui-border)] rounded px-2 py-1"
                />
                <input
                  type="number"
                  value={pin.lng}
                  onChange={e => onUpdatePin(pin.id, { lng: parseFloat(e.target.value) || 0 })}
                  className="border border-[var(--ui-border)] rounded px-2 py-1"
                />
              </div>
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.15em] text-[var(--ui-muted)]">
                <span className="px-2 py-0.5 rounded bg-[#f3f5f8] border border-[var(--ui-border)] text-[10px]">
                  {pin.scope}
                </span>
                <select
                  value={pin.scope}
                  onChange={e => onUpdatePin(pin.id, { scope: e.target.value as Pin['scope'] })}
                  className="border border-[var(--ui-border)] rounded px-2 py-1 text-[11px]"
                >
                  <option value="private">Private</option>
                  <option value="close">Close Circle</option>
                  <option value="specific">Specific</option>
                </select>
                <button
                  onClick={() => onDeletePin(pin.id)}
                  className="text-[var(--ui-accent)] border border-[var(--ui-accent)] px-2 py-1 rounded text-[11px]"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!visiblePins.length && (
            <div className="col-span-full text-sm text-[var(--ui-muted)] border border-dashed border-[var(--ui-border)] rounded p-3">
              No pins available. Click the map to add one.
            </div>
          )}
        </div>
      </div>
      {/* Focus / Tools panel */}
      <div className="space-y-4 max-h-[calc(100vh-220px)] overflow-auto">
        {focusPlayer && focusPlayer.location && (
          <div className="bg-[var(--ui-panel)] border border-[#3a3f4b] rounded-lg shadow-sm p-4 space-y-2">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)]">Focused person</div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 border border-[var(--ui-border)] rounded overflow-hidden bg-[#fafbfc] flex items-center justify-center text-xs text-[var(--ui-muted)]">
                {focusPlayer.avatar ? (
                  <img src={focusPlayer.avatar} alt={focusPlayer.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{focusPlayer.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#e6e8ee] truncate">{focusPlayer.name}</div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] truncate">{focusPlayer.role}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('dusk:openMessagesThread', { detail: { participantId: focusPlayer.id, title: focusPlayer.name } }));
                }}
                className="text-[11px] uppercase tracking-[0.2em] border border-[#0f1115] px-2 py-1 rounded hover:bg-[#0f1115] hover:text-white"
              >
                Message
              </button>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('dusk:openPlayerDossier', { detail: { playerId: focusPlayer.id } }));
                }}
                className="text-[11px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-2 py-1 rounded hover:border-[#0f1115]"
              >
                Open dossier
              </button>
              <button
                type="button"
                onClick={async () => {
                  const text = `${focusPlayer.location!.lat},${focusPlayer.location!.lng}`;
                  try {
                    await navigator.clipboard.writeText(text);
                    setToast('Coords copied');
                  } catch {
                    setToast('Copy failed');
                  }
                }}
                className="text-[11px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-2 py-1 rounded hover:border-[#0f1115]"
              >
                Copy coords
              </button>
              <button
                type="button"
                onClick={() => {
                  const item: SavedLocation = {
                    id: `loc-${Date.now()}`,
                    title: `${focusPlayer.name} — ${focusPlayer.location?.label || 'Location'}`,
                    lat: focusPlayer.location!.lat,
                    lng: focusPlayer.location!.lng,
                    tags: ['people'],
                    createdAt: Date.now(),
                    lastVisitedAt: Date.now(),
                  };
                  setSavedLocations(prev => [item, ...prev]);
                  setToast('Saved location from person');
                }}
                className="text-[11px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-2 py-1 rounded hover:border-[#0f1115]"
              >
                Save location
              </button>
            </div>

            <div className="text-sm text-[#e6e8ee] font-semibold">{focusPlayer.location.label || 'Saved location'}</div>
            <div className="text-[11px] text-[var(--ui-muted)]">{focusPlayer.location.lat.toFixed(5)}, {focusPlayer.location.lng.toFixed(5)}</div>
            {!!(focusPlayer.tags || []).length && (
              <div className="text-[11px] text-[var(--ui-muted)]">Tags: {(focusPlayer.tags || []).slice(0, 6).join(' • ')}</div>
            )}
          </div>
        )}
        <div className="bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded-lg shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)]">
            <span>My Location</span>
            <button
              type="button"
              onClick={() => {
                if (!navigator.geolocation) {
                  setToast('Geolocation not available');
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  pos => {
                    setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setToast('My location set');
                  },
                  () => setToast('Location permission denied')
                );
              }}
              className="flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] border border-[var(--ui-border)] px-2 py-1 rounded"
            >
              Set Current
            </button>
          </div>
          {myLocation ? (
            <div className="text-sm text-[var(--ui-muted)]">{myLocation.lat.toFixed(4)}, {myLocation.lng.toFixed(4)}</div>
          ) : (
            <div className="text-sm text-[var(--ui-muted)]">Not set yet.</div>
          )}
          <div className="text-[11px] text-[var(--ui-muted)]">Used for Near Me calculations only.</div>
        </div>
      </div>
    </div>
  );
};
