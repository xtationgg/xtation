import React, { useEffect, useMemo, useState } from 'react';
import { Player } from '../../../types';
import { getEffectivePermissions } from '../../../utils/permissions';
import { readFileAsDataUrl, readImageCompressedDataUrl } from '../../../utils/fileUtils';
import { nominatimSearch } from '../../../utils/geocode';
import { googleEarthSearchUrl } from '../../../utils/googleEarth';
import { timeZoneFromLatLng, utcOffsetMinutesForTimeZone } from '../../../utils/timezone';

export interface PlayersViewProps {
  players: Player[];
  onUpdatePlayer: (id: string, updates: Partial<Player>) => void;
  onAddPlayer: (data: Omit<Player, 'id'>) => void;
  viewAsId: string;
  onSetViewAs: (id: string) => void;
  onAddXp: (playerId: string, amount: number, category?: string, note?: string) => void;
  setToast: (msg: string) => void;
  onGoToEarth?: (focus: { playerId: string; loc: { lat: number; lng: number; label?: string } } | null) => void;

  focusPlayerId?: string | null;
  onClearFocusPlayer?: () => void;
}

const normalizeTag = (t: string) => t.trim().toLowerCase().replace(/\s+/g, '-');

const utcNowForOffset = (utcOffsetMinutes: number) => {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + utcOffsetMinutes * 60000);
};

const splitPlace = (displayName: string) => {
  const parts = displayName.split(',').map(s => s.trim()).filter(Boolean);
  return {
    title: parts[0] || displayName,
    subtitle: parts.slice(1, 4).join(', '),
    full: displayName,
  };
};

const LocationSearchSection: React.FC<{
  player: Player;
  onUpdate: (updates: Partial<Player>) => void;
  onToast: (msg: string) => void;
}> = ({ player, onUpdate, onToast }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [results, setResults] = useState<{ displayName: string; lat: number; lng: number }[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError('');
      return;
    }

    const t = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await nominatimSearch(q, 6);
        setResults(res);
      } catch (e: any) {
        setError(e?.message || 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => window.clearTimeout(t);
  }, [query]);

  const openInGoogleEarth = () => {
    if (!player.location) {
      onToast('No location set');
      return;
    }
    window.open(googleEarthSearchUrl(player.location.lat, player.location.lng), '_blank');
  };

  return (
    <div className="border border-[var(--ui-border)] rounded p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Location</div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('dusk:pickPlayerLocation', { detail: { playerId: player.id } }));
            }}
            className="px-3 py-1 border border-[#0f1115] text-[#e6e8ee] rounded text-[11px] uppercase tracking-[0.15em] hover:bg-[#0f1115] hover:text-white"
            title="Pick location on map"
          >
            Pick on map
          </button>

          {player.location && (
            <button
              type="button"
              onClick={openInGoogleEarth}
              className="px-3 py-1 border border-[#0f1115] text-[#e6e8ee] rounded text-[11px] uppercase tracking-[0.15em] hover:bg-[#0f1115] hover:text-white"
              title="Open in Google Earth"
            >
              Open Earth
            </button>
          )}
          {player.location && (
            <button
              type="button"
              onClick={() => {
                onUpdate({ location: undefined, timeZone: undefined, utcOffsetMinutes: undefined });
                onToast('Location cleared');
              }}
              className="px-3 py-1 border border-[var(--ui-border)] text-[var(--ui-muted)] rounded text-[11px] uppercase tracking-[0.15em] hover:border-[#0f1115]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search place (e.g. Dubai Mall, Ubud Bali, Tokyo Station)"
          className="w-full border border-[var(--ui-border)] rounded px-2 py-2 text-sm"
        />
        <div className="text-[11px] text-[var(--ui-muted)]">Type a place name, then pick the correct result.</div>
      </div>

      {loading && <div className="text-[11px] text-[var(--ui-muted)]">Searching…</div>}
      {error && <div className="text-[11px] text-[var(--ui-accent)]">{error}</div>}

      {!!results.length && (
        <div className="border border-[var(--ui-border)] rounded overflow-hidden">
          {results.map((r, idx) => {
            const s = splitPlace(r.displayName);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const tz = timeZoneFromLatLng(r.lat, r.lng);
                  const offset = tz ? utcOffsetMinutesForTimeZone(tz) : null;
                  onUpdate({
                    location: { lat: r.lat, lng: r.lng, label: r.displayName },
                    timeZone: tz || undefined,
                    utcOffsetMinutes: typeof offset === 'number' ? offset : undefined,
                  });
                  onToast('Location set');
                }}
                className="w-full text-left px-3 py-2 border-b border-[var(--ui-border)] hover:bg-[#171b22]"
              >
                <div className="text-sm font-semibold text-[#e6e8ee]">{s.title}</div>
                {s.subtitle && <div className="text-xs text-[var(--ui-muted)]">{s.subtitle}</div>}
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">
                  {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {player.location && (
        <div className="border border-dashed border-[var(--ui-border)] rounded p-3">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-1">Current</div>
          <div className="text-sm text-[#e6e8ee] font-semibold">{player.location.label || 'Saved location'}</div>
          <div className="text-[11px] text-[var(--ui-muted)]">
            {player.location.lat.toFixed(5)}, {player.location.lng.toFixed(5)}
          </div>
        </div>
      )}
    </div>
  );
};

export const PlayersView: React.FC<PlayersViewProps> = ({
  players,
  onUpdatePlayer,
  onAddPlayer,
  viewAsId,
  onSetViewAs,
  onAddXp,
  setToast,
  onGoToEarth,
  focusPlayerId,
  onClearFocusPlayer,
}) => {
  const viewer = players.find(p => p.id === viewAsId);
  const effective = getEffectivePermissions(viewer);

  const [selectedId, setSelectedId] = useState(players[0]?.id ?? '');
  const selected = players.find(p => p.id === selectedId);

  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const [newPlayer, setNewPlayer] = useState<{ name: string; role: string; email?: string; accepted: boolean; tags: string }>(
    { name: '', role: '', email: '', accepted: true, tags: '' }
  );

  // XP quick add
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  // Tag draft for selected player
  const [tagDraft, setTagDraft] = useState('');

  useEffect(() => {
    if (!selected && players.length) setSelectedId(players[0].id);
  }, [players, selected]);

  // External focus (from Earth panel)
  useEffect(() => {
    if (!focusPlayerId) return;
    setSelectedId(focusPlayerId);
    onClearFocusPlayer?.();
  }, [focusPlayerId, onClearFocusPlayer]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    players.forEach(p => (p.tags || []).forEach(t => s.add(normalizeTag(t))));
    return Array.from(s).sort();
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = players.slice().sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite));
    if (!q) return base;
    return base.filter(p => {
      const hay = [p.name, p.role, p.email || '', ...(p.tags || [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [players, search]);

  const canSeeDetails = selected
    ? (selected.permissions?.profileLevel === 'details' || viewer?.id === selected.id || viewer?.id === 'me')
    : false;

  const applyXp = (amount: number) => {
    if (!selected) return;
    onAddXp(selected.id, amount, category || undefined, note || undefined);
    setToast(`${amount >= 0 ? '+' : ''}${amount} XP added`);
    if (customAmount === amount) setCustomAmount(0);
  };

  const submitNewPlayer = () => {
    if (!newPlayer.name.trim() || !newPlayer.role.trim()) {
      setToast('Name and role required');
      return;
    }

    const tags = newPlayer.tags
      .split(',')
      .map(t => normalizeTag(t))
      .filter(Boolean);

    onAddPlayer({
      name: newPlayer.name.trim(),
      role: newPlayer.role.trim(),
      email: newPlayer.email?.trim(),
      tags,
      favorite: false,
      permissions: {
        profileLevel: 'basic',
        location: 'off',
        pinVisibility: 'none',
        rankVisibility: true,
        appearsInRank: true,
        closeCircle: false,
      },
      accepted: newPlayer.accepted,
    });

    setNewPlayer({ name: '', role: '', email: '', accepted: true, tags: '' });
    setShowAdd(false);
  };

  const addTagToSelected = () => {
    if (!selected) return;
    const t = normalizeTag(tagDraft);
    if (!t) return;
    const prev = selected.tags || [];
    if (prev.includes(t)) return;
    onUpdatePlayer(selected.id, { tags: [t, ...prev] });
    setTagDraft('');
  };

  const removeTagFromSelected = (t: string) => {
    if (!selected) return;
    onUpdatePlayer(selected.id, { tags: (selected.tags || []).filter(x => x !== t) });
  };

  const toggleFavorite = (p: Player) => {
    onUpdatePlayer(p.id, { favorite: !p.favorite });
  };

  const pngHasTransparency = async (file: File) => {
    try {
      // createImageBitmap is fast and works for PNG
      const bmp = await createImageBitmap(file);
      const w = Math.min(256, bmp.width);
      const h = Math.min(256, bmp.height);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true } as any);
      if (!ctx) return false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      // Sample alpha channel (every ~4px) for speed
      const step = 4 * 4;
      for (let i = 3; i < data.length; i += step) {
        if (data[i] < 255) return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const onUpload = async (kind: 'avatar' | 'fullBody' | 'gallery', file: File | null) => {
    if (!selected || !file) return;

    const type = (file.type || '').toLowerCase();
    const isPng = type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    const isJpeg = type === 'image/jpeg' || type === 'image/jpg' || /\.(jpe?g)$/i.test(file.name);
    const isGif = type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
    const isMp4 = type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');

    if (!(isPng || isJpeg || isGif || isMp4)) {
      setToast('Unsupported file. Use PNG/JPG/GIF/MP4');
      return;
    }

    // NOTE: Storing MP4/GIF as base64 in localStorage will often crash the app (quota/memory).
    // For now we use a blob: URL (fast + stable) and keep it lightweight.

    let url: string | null = null;

    if (isPng) {
      // Preserve alpha. Do NOT convert to JPEG.
      const hasAlpha = await pngHasTransparency(file);
      if (!hasAlpha) {
        setToast('PNG must be transparent (no background). Please export as PNG with alpha.');
        return;
      }
      url = await readFileAsDataUrl(file);
    } else if (isGif || isMp4) {
      // Use blob URL to avoid huge base64 strings and localStorage quota crashes.
      url = URL.createObjectURL(file);
      setToast('Uploaded (note: video/gif may not persist after refresh yet)');
    } else if (isJpeg) {
      // Compress to avoid freezing / black screen from huge data URLs + localStorage quota issues
      url = await readImageCompressedDataUrl(file, {
        maxSize: kind === 'avatar' ? 512 : 1024,
        quality: kind === 'avatar' ? 0.85 : 0.82,
        mimeType: 'image/jpeg',
      });
    }

    if (!url) {
      setToast('Failed to read file');
      return;
    }

    if (kind === 'avatar') {
      onUpdatePlayer(selected.id, { avatar: url });
      setToast('Avatar updated');
    } else if (kind === 'fullBody') {
      onUpdatePlayer(selected.id, { fullBodyImage: url });
      setToast('Full-body updated');
    } else {
      onUpdatePlayer(selected.id, { gallery: [url, ...(selected.gallery || [])] });
      setToast('Added');
    }
  };

  const removeGalleryImage = (idx: number) => {
    if (!selected) return;
    const next = (selected.gallery || []).slice();
    next.splice(idx, 1);
    onUpdatePlayer(selected.id, { gallery: next });
  };

  const openMessageFor = (player: Player) => {
    window.dispatchEvent(
      new CustomEvent('dusk:openMessagesThread', {
        detail: { participantId: player.id, title: player.name },
      })
    );
  };

  const openMessage = () => {
    if (!selected) return;
    openMessageFor(selected);
  };

  return (
    <div className="grid lg:grid-cols-[420px,1fr] gap-6 items-start">
      {/* Roster */}
      <div className="bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded shadow-sm p-4 space-y-3 max-h-[calc(100vh-220px)] overflow-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Roster</div>
            <div className="text-sm font-semibold text-[#e6e8ee]">People OS</div>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="px-3 py-1 border border-[#0f1115] text-[#e6e8ee] rounded text-[11px] uppercase tracking-[0.15em] hover:bg-[#0f1115] hover:text-white"
          >
            {showAdd ? 'Close' : 'Add'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name / role / email / tags"
            className="w-full border border-[var(--ui-border)] rounded px-2 py-2 text-sm"
          />
        </div>

        {showAdd && (
          <div className="border border-dashed border-[var(--ui-border)] rounded p-3 space-y-2 animate-fade-in">
            <div className="grid gap-2 text-sm">
              <input
                value={newPlayer.name}
                onChange={e => setNewPlayer(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Name"
                className="border border-[var(--ui-border)] rounded px-2 py-2"
              />
              <input
                value={newPlayer.role}
                onChange={e => setNewPlayer(prev => ({ ...prev, role: e.target.value }))}
                placeholder="Role"
                className="border border-[var(--ui-border)] rounded px-2 py-2"
              />
              <input
                value={newPlayer.email}
                onChange={e => setNewPlayer(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Email (optional)"
                className="border border-[var(--ui-border)] rounded px-2 py-2"
              />
              <input
                value={newPlayer.tags}
                onChange={e => setNewPlayer(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="Tags (comma-separated) e.g. family, friend"
                className="border border-[var(--ui-border)] rounded px-2 py-2"
              />
              <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)]">
                <input
                  type="checkbox"
                  checked={newPlayer.accepted}
                  onChange={e => setNewPlayer(prev => ({ ...prev, accepted: e.target.checked }))}
                />
                Accepted member
              </label>
            </div>
            <button
              type="button"
              onClick={submitNewPlayer}
              className="px-3 py-2 border border-[#0f1115] bg-[#0f1115] text-white rounded text-[11px] uppercase tracking-[0.15em]"
            >
              Save
            </button>
          </div>
        )}

        {/* Quick filters */}
        <div className="border border-[var(--ui-border)] rounded p-3">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-2">Filters</div>
          <div className="flex flex-wrap gap-2">
            {allTags.slice(0, 14).map(t => (
              <div key={t} className="text-[11px] px-2 py-1 rounded border border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-muted)]">
                {t}
              </div>
            ))}
            {allTags.length === 0 && <div className="text-[11px] text-[var(--ui-muted)]">No tags yet.</div>}
            {allTags.length > 14 && (
              <div className="text-[11px] text-[var(--ui-muted)]">+{allTags.length - 14} more</div>
            )}
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {filteredPlayers.map(p => {
            const limited = p.permissions?.profileLevel === 'basic' && viewer?.id !== 'me' && viewer?.id !== p.id;
            const nowThere = typeof p.utcOffsetMinutes === 'number' ? utcNowForOffset(p.utcOffsetMinutes) : null;
            const offsetLabel = typeof p.utcOffsetMinutes === 'number'
              ? `GMT${p.utcOffsetMinutes >= 0 ? '+' : ''}${(p.utcOffsetMinutes / 60).toFixed(0)}`
              : null;

            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={
                  'w-full text-left border rounded px-3 py-2 transition ' +
                  (selectedId === p.id
                    ? 'border-[#0f1115] bg-[#f2f4f7]'
                    : 'border-[var(--ui-border)] bg-[var(--ui-panel)] hover:border-[#0f1115]')
                }
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 border border-[var(--ui-border)] bg-[#fafbfc] rounded overflow-hidden flex items-center justify-center text-xs text-[var(--ui-muted)]">
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{p.name.slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm text-[#e6e8ee] truncate">{p.name}</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openMessageFor(p); }}
                          className="text-[10px] uppercase tracking-[0.2em] border rounded px-2 py-1 border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-white hover:border-[#0f1115]"
                        >
                          Msg
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(p); }}
                          className={
                            'text-[10px] uppercase tracking-[0.2em] border rounded px-2 py-1 ' +
                            (p.favorite ? 'border-[var(--ui-accent)] text-[var(--ui-accent)]' : 'border-[var(--ui-border)] text-[var(--ui-muted)]')
                          }
                          title="Favorite"
                        >
                          {p.favorite ? 'Fav' : '—'}
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] truncate">{p.role}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">
                        {limited ? 'Basic view' : 'Details'}
                      </div>
                      {nowThere && (
                        <div className="text-[10px] text-[var(--ui-muted)]">
                          {nowThere.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {offsetLabel}
                        </div>
                      )}
                      {!!(p.tags || []).length && (
                        <div className="text-[10px] text-[var(--ui-muted)] truncate">{(p.tags || []).slice(0, 3).join(' • ')}</div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {filteredPlayers.length === 0 && (
            <div className="text-sm text-[var(--ui-muted)] border border-dashed border-[var(--ui-border)] rounded p-3">
              No matching people.
            </div>
          )}
        </div>

        <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] border border-dashed border-[var(--ui-border)] rounded px-2 py-2">
          Perms: {effective.profileLevel} • {effective.locationMode} • pins:{effective.pinVisibility} • rank:{effective.rankVisible ? 'on' : 'off'}
        </div>
      </div>

      {/* Dossier */}
      {selected && (
        <div className="bg-[var(--ui-panel)] border border-[var(--ui-border)] rounded shadow-sm p-4 space-y-4 max-h-[calc(100vh-220px)] overflow-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Dossier</div>
              <div className="text-lg font-semibold text-[#e6e8ee]">{selected.name}</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">{selected.role}</div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={openMessage}
                className="px-3 py-2 border border-[#0f1115] bg-[#0f1115] text-white rounded text-[11px] uppercase tracking-[0.15em]"
              >
                Message
              </button>
              {selected.location && (
                <button
                  type="button"
                  onClick={() => {
                    onGoToEarth?.(selected.location ? { playerId: selected.id, loc: selected.location } : null);
                    setToast('Opened map');
                  }}
                  className="px-3 py-2 border border-[var(--ui-border)] text-[var(--ui-muted)] rounded text-[11px] uppercase tracking-[0.15em] hover:border-[#0f1115]"
                >
                  View on map
                </button>
              )}
            </div>
          </div>

          {!canSeeDetails && (
            <div className="text-sm text-[var(--ui-muted)] border border-dashed border-[var(--ui-border)] rounded p-3">
              Basic profile only. Details hidden by permissions.
            </div>
          )}

          {canSeeDetails && (
            <>
              {/* Identity */}
              <div className="border border-[var(--ui-border)] rounded p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-3">Identity</div>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-1">Email</div>
                    <input
                      value={selected.email || ''}
                      onChange={e => onUpdatePlayer(selected.id, { email: e.target.value })}
                      className="w-full border border-[var(--ui-border)] rounded px-2 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-1">Phone</div>
                    <input
                      value={selected.phone || ''}
                      onChange={e => onUpdatePlayer(selected.id, { phone: e.target.value })}
                      className="w-full border border-[var(--ui-border)] rounded px-2 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Body + Time */}
              <div className="border border-[var(--ui-border)] rounded p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-3">Body + Timezone</div>
                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-1">Height (cm)</div>
                    <input
                      type="number"
                      value={selected.heightCm ?? ''}
                      onChange={e => onUpdatePlayer(selected.id, { heightCm: e.target.value === '' ? undefined : Number(e.target.value) })}
                      className="w-full border border-[var(--ui-border)] rounded px-2 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-1">Weight (kg)</div>
                    <input
                      type="number"
                      value={selected.weightKg ?? ''}
                      onChange={e => onUpdatePlayer(selected.id, { weightKg: e.target.value === '' ? undefined : Number(e.target.value) })}
                      className="w-full border border-[var(--ui-border)] rounded px-2 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-1">Timezone</div>

                    {selected.timeZone ? (
                      <div className="border border-[var(--ui-border)] rounded px-2 py-2 bg-[var(--ui-panel)] text-sm">
                        <div className="font-semibold text-[#e6e8ee]">{selected.timeZone}</div>
                        <div className="text-[11px] text-[var(--ui-muted)]">
                          Now:{' '}
                          {new Date().toLocaleTimeString([], {
                            timeZone: selected.timeZone,
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {typeof selected.utcOffsetMinutes === 'number' ? ` • GMT${selected.utcOffsetMinutes >= 0 ? '+' : ''}${Math.round(selected.utcOffsetMinutes / 60)}` : ''}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[var(--ui-muted)] border border-dashed border-[var(--ui-border)] rounded px-2 py-2">
                        No timezone yet. Set a location to auto-detect.
                      </div>
                    )}

                    <div className="mt-2">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-1">Manual UTC Offset (override)</div>
                      <select
                        value={typeof selected.utcOffsetMinutes === 'number' ? String(selected.utcOffsetMinutes) : ''}
                        onChange={e => onUpdatePlayer(selected.id, { utcOffsetMinutes: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className="w-full border border-[var(--ui-border)] rounded px-2 py-2 text-sm bg-[var(--ui-panel)]"
                      >
                        <option value="">—</option>
                        {Array.from({ length: 27 }).map((_, i) => {
                          const h = i - 12; // -12..+14
                          const min = h * 60;
                          const label = `GMT${h >= 0 ? '+' : ''}${h}`;
                          return (
                            <option key={h} value={String(min)}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                      {typeof selected.utcOffsetMinutes === 'number' && !selected.timeZone && (
                        <div className="text-[11px] text-[var(--ui-muted)] mt-1">
                          Now: {utcNowForOffset(selected.utcOffsetMinutes).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags + Favorite */}
              <div className="border border-[var(--ui-border)] rounded p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Tags + Favorites</div>
                  <button
                    type="button"
                    onClick={() => onUpdatePlayer(selected.id, { favorite: !selected.favorite })}
                    className={
                      'px-3 py-1 border rounded text-[11px] uppercase tracking-[0.15em] ' +
                      (selected.favorite ? 'border-[var(--ui-accent)] text-[var(--ui-accent)]' : 'border-[var(--ui-border)] text-[var(--ui-muted)]')
                    }
                  >
                    {selected.favorite ? 'Favorite' : 'Not favorite'}
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={tagDraft}
                    onChange={e => setTagDraft(e.target.value)}
                    placeholder="Add tag (e.g. family, friend, work)"
                    className="flex-1 border border-[var(--ui-border)] rounded px-2 py-2 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTagToSelected();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addTagToSelected}
                    className="px-3 py-2 border border-[#0f1115] text-[#e6e8ee] rounded text-[11px] uppercase tracking-[0.15em] hover:bg-[#0f1115] hover:text-white"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(selected.tags || []).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => removeTagFromSelected(t)}
                      className="text-[11px] px-2 py-1 rounded border border-[var(--ui-border)] bg-[var(--ui-panel)] text-[var(--ui-muted)] hover:border-[var(--ui-accent)] hover:text-[var(--ui-accent)]"
                      title="Click to remove"
                    >
                      {t}
                    </button>
                  ))}
                  {(selected.tags || []).length === 0 && <div className="text-[11px] text-[var(--ui-muted)]">No tags yet.</div>}
                </div>
              </div>

              {/* Socials */}
              <div className="border border-[var(--ui-border)] rounded p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-3">Social links</div>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  {(['instagram', 'linkedin', 'twitter', 'discord'] as const).map(k => (
                    <div key={k}>
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-1">{k}</div>
                      <input
                        value={selected.socials?.[k] || ''}
                        onChange={e => onUpdatePlayer(selected.id, { socials: { ...(selected.socials || {}), [k]: e.target.value } })}
                        className="w-full border border-[var(--ui-border)] rounded px-2 py-2 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Location */}
              <LocationSearchSection
                player={selected}
                onUpdate={(updates) => onUpdatePlayer(selected.id, updates)}
                onToast={setToast}
              />

              {/* Media */}
              <div className="border border-[var(--ui-border)] rounded p-4 space-y-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">Media</div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-2">Avatar</div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-20 border border-[var(--ui-border)] bg-white rounded overflow-hidden flex items-center justify-center text-xs text-[var(--ui-muted)]">
                        {selected.avatar ? (
                          selected.avatar.startsWith('blob:') || selected.avatar.startsWith('data:video') ? (
                            <video src={selected.avatar} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                          ) : (
                            <img src={selected.avatar} alt="avatar" className="w-full h-full object-cover" />
                          )
                        ) : (
                          '—'
                        )}
                      </div>
                      <input type="file" accept="image/png,image/jpeg,image/jpg,image/gif,video/mp4" onChange={e => onUpload('avatar', e.target.files?.[0] || null)} />
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-2">Full-body / Standing</div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-20 border border-[var(--ui-border)] bg-white rounded overflow-hidden flex items-center justify-center text-xs text-[var(--ui-muted)]">
                        {selected.fullBodyImage ? (
                          selected.fullBodyImage.startsWith('blob:') || selected.fullBodyImage.startsWith('data:video') ? (
                            <video src={selected.fullBodyImage} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                          ) : (
                            <img src={selected.fullBodyImage} alt="full" className="w-full h-full object-cover" />
                          )
                        ) : (
                          '—'
                        )}
                      </div>
                      <input type="file" accept="image/png,image/jpeg,image/jpg,image/gif,video/mp4" onChange={e => onUpload('fullBody', e.target.files?.[0] || null)} />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-2">Gallery</div>
                  <input type="file" accept="image/png,image/jpeg,image/jpg,image/gif,video/mp4" onChange={e => onUpload('gallery', e.target.files?.[0] || null)} />
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {(selected.gallery || []).slice(0, 12).map((src, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => removeGalleryImage(idx)}
                        className="border border-[var(--ui-border)] rounded overflow-hidden bg-[var(--ui-panel)] hover:border-[var(--ui-accent)]"
                        title="Click to remove"
                      >
                        {src.startsWith('blob:') || src.startsWith('data:video') ? (
                          <video src={src} className="w-full h-20 object-cover" autoPlay loop muted playsInline />
                        ) : (
                          <img src={src} alt={`gallery-${idx}`} className="w-full h-20 object-cover" />
                        )}
                      </button>
                    ))}
                    {(selected.gallery || []).length === 0 && (
                      <div className="col-span-4 text-[11px] text-[var(--ui-muted)]">No gallery images yet.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="border border-[var(--ui-border)] rounded p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] mb-3">Notes</div>
                <textarea
                  value={selected.notes || ''}
                  onChange={e => onUpdatePlayer(selected.id, { notes: e.target.value })}
                  className="w-full border border-[var(--ui-border)] rounded px-2 py-2 text-sm"
                  rows={4}
                />
              </div>

              {/* XP */}
              <div className="border border-[var(--ui-border)] rounded p-4 space-y-2">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)]">XP / Score</div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {[10, 50, 100, -10].map(val => (
                    <button
                      key={val}
                      onClick={() => applyXp(val)}
                      className="px-2 py-1 border border-[var(--ui-border)] rounded hover:border-[#0f1115] hover:text-[#e6e8ee]"
                    >
                      {val > 0 ? `+${val}` : val} XP
                    </button>
                  ))}
                </div>
                <div className="grid md:grid-cols-3 gap-2 text-sm">
                  <input
                    type="number"
                    value={customAmount}
                    onChange={e => setCustomAmount(parseInt(e.target.value) || 0)}
                    placeholder="Custom amount"
                    className="border border-[var(--ui-border)] rounded px-2 py-2"
                  />
                  <input
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="Category"
                    className="border border-[var(--ui-border)] rounded px-2 py-2"
                  />
                  <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Note"
                    className="border border-[var(--ui-border)] rounded px-2 py-2"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => customAmount !== 0 && applyXp(customAmount)}
                  className="px-3 py-2 border border-[#0f1115] text-[#e6e8ee] rounded text-[11px] uppercase tracking-[0.15em] hover:bg-[#0f1115] hover:text-white"
                  disabled={customAmount === 0}
                >
                  Apply XP
                </button>
              </div>
            </>
          )}

          <div className="border-t border-[var(--ui-border)] pt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--ui-muted)] flex-wrap">
            <span>Viewing as:</span>
            <select
              value={viewAsId}
              onChange={e => onSetViewAs(e.target.value)}
              className="border border-[var(--ui-border)] rounded px-2 py-1 text-[11px] bg-[var(--ui-panel)]"
            >
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
