import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Player, Pin, LocationShareState } from '../../../types';
import { pinVisibleToViewer } from '../../../utils/permissions';

const round2 = (val: number) => Math.round(val * 100) / 100;

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
}

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
}) => {
  const viewer = players.find(p => p.id === viewAsId);
  const [mapCenter] = React.useState<[number, number]>([pins[0]?.lat || 37.7749, pins[0]?.lng || -122.4194]);
  const modeState = sharingByPlayer[viewAsId] || { mode: 'off' as const };
  const approx = modeState.mode === 'city' && myLocation ? { lat: round2(myLocation.lat), lng: round2(myLocation.lng) } : null;
  const liveVisible = modeState.mode === 'live' && myLocation && (!modeState.liveExpiresAt || modeState.liveExpiresAt > Date.now());
  const isViewingSelf = viewAsId === 'me';
  const [scopeFilter, setScopeFilter] = React.useState<'all' | Pin['scope']>('all');

  const visiblePins = React.useMemo(
    () => pins.filter(p => pinVisibleToViewer(p, viewAsId, viewer, p.createdBy)).filter(p => scopeFilter === 'all' || p.scope === scopeFilter),
    [pins, viewAsId, viewer, scopeFilter]
  );

  const handleMapClick = (e: any) => {
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
    <div className="grid lg:grid-cols-[1.2fr,1fr] gap-6 items-start">
      <div className="bg-white border border-[#e2e4ea] rounded-lg shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#666]">
          <span>Map / Pins</span>
          <div className="flex gap-2">
            <button
          onClick={() => handleQuickMode('live', 15 * 60 * 1000)}
          type="button"
          className="text-[11px] border border-[#ff2a3a] text-[#ff2a3a] px-2 py-1 rounded"
        >
          Live 15m
        </button>
        <button
          onClick={() => handleQuickMode('live', 60 * 60 * 1000)}
          type="button"
          className="text-[11px] border border-[#ff2a3a] text-[#ff2a3a] px-2 py-1 rounded"
        >
          Live 1h
        </button>
        <button
          onClick={() => handleQuickMode('city')}
          type="button"
          className="text-[11px] border border-[#d8dae0] text-[#555] px-2 py-1 rounded"
        >
          City
        </button>
        <button
          onClick={() => handleQuickMode('off')}
          type="button"
          className="text-[11px] border border-[#d8dae0] text-[#555] px-2 py-1 rounded"
        >
          Off
        </button>
      </div>
        </div>
        <div className="h-[320px] border border-dashed border-[#d8dae0] rounded overflow-hidden">
          <MapContainer center={mapCenter} zoom={5} style={{ width: '100%', height: '100%' }} whenCreated={map => map.on('click', handleMapClick)}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {isViewingSelf && myLocation && (
              <Marker position={[myLocation.lat, myLocation.lng]}>
                <Popup>My location (private view)</Popup>
              </Marker>
            )}
            {liveVisible && myLocation && (
              <Marker position={[myLocation.lat, myLocation.lng]}>
                <Popup>Live location</Popup>
              </Marker>
            )}
            {approx && (
              <Marker position={[approx.lat, approx.lng]}>
                <Popup>Approx area</Popup>
              </Marker>
            )}
            {approx && (
              <Circle center={[approx.lat, approx.lng]} radius={3000} pathOptions={{ color: '#ff2a3a', fillColor: '#ff2a3a', fillOpacity: 0.08, opacity: 0.3 }} />
            )}
            {visiblePins.map(pin => (
              <Marker key={pin.id} position={[pin.lat, pin.lng]}>
                <Popup>
                  <div className="space-y-1">
                    <div className="font-semibold text-sm">{pin.title}</div>
                    <div className="text-xs text-[#555]">{pin.note || 'No note'}</div>
                    <div className="text-[10px] uppercase text-[#777]">Scope: {pin.scope}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
          {visiblePins.map(pin => (
            <div key={pin.id} className="border border-[#e2e4ea] rounded p-2 text-sm space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={pin.title}
                  onChange={e => onUpdatePin(pin.id, { title: e.target.value })}
                  className="border border-[#d8dae0] rounded px-2 py-1 text-sm flex-1"
                />
              </div>
              <textarea
                value={pin.note || ''}
                onChange={e => onUpdatePin(pin.id, { note: e.target.value })}
                className="w-full border border-[#d8dae0] rounded px-2 py-1 text-sm"
                rows={2}
                placeholder="Note"
              />
              <div className="grid grid-cols-2 gap-2 text-xs text-[#555]">
                <input
                  type="number"
                  value={pin.lat}
                  onChange={e => onUpdatePin(pin.id, { lat: parseFloat(e.target.value) || 0 })}
                  className="border border-[#d8dae0] rounded px-2 py-1"
                />
                <input
                  type="number"
                  value={pin.lng}
                  onChange={e => onUpdatePin(pin.id, { lng: parseFloat(e.target.value) || 0 })}
                  className="border border-[#d8dae0] rounded px-2 py-1"
                />
              </div>
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.15em] text-[#777]">
                <span className="px-2 py-0.5 rounded bg-[#f3f5f8] border border-[#d8dae0] text-[10px]">
                  {pin.scope}
                </span>
                <select
                  value={pin.scope}
                  onChange={e => onUpdatePin(pin.id, { scope: e.target.value as Pin['scope'] })}
                  className="border border-[#d8dae0] rounded px-2 py-1 text-[11px]"
                >
                  <option value="private">Private</option>
                  <option value="close">Close Circle</option>
                  <option value="specific">Specific</option>
                </select>
                <button
                  onClick={() => onDeletePin(pin.id)}
                  className="text-[#ff2a3a] border border-[#ff2a3a] px-2 py-1 rounded text-[11px]"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!visiblePins.length && (
            <div className="col-span-full text-sm text-[#777] border border-dashed border-[#d8dae0] rounded p-3">
              No pins available. Click the map to add one.
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <div className="bg-white border border-[#e2e4ea] rounded-lg shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#666]">
            <span>My Location</span>
            <button
              type="button"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    pos => {
                      setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                      setToast('Location set');
                    },
                    () => setToast('Location permission denied')
                  );
                } else {
                  setToast('Geolocation not available');
                }
              }}
              className="flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] border border-[#d8dae0] px-2 py-1 rounded"
            >
              Set Current
            </button>
          </div>
          <div className="text-sm text-[#555]">
            {modeState.mode === 'city' && 'Approx area (city only)'}
            {modeState.mode === 'live' && liveVisible && myLocation && `Live: ${myLocation.lat.toFixed(4)}, ${myLocation.lng.toFixed(4)}`}
            {modeState.mode === 'off' && 'Not sharing'}
          </div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#777] border border-dashed border-[#d8dae0] rounded px-2 py-1">
            Mode: {modeState.mode.toUpperCase()} {modeState.liveExpiresAt ? `(expires in ${Math.max(0, modeState.liveExpiresAt - Date.now()) / 1000 | 0}s)` : ''}
          </div>
        </div>
        <div className="bg-white border border-[#e2e4ea] rounded-lg shadow-sm p-4 space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-[#666] mb-2">Per-player sharing</div>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {players.map(p => (
              <div key={p.id} className="border border-[#e2e4ea] rounded px-3 py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold text-[#0f1115]">{p.name}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#777]">
                    Mode: {sharingByPlayer[p.id]?.mode ?? 'off'}
                  </div>
                </div>
                <div className="flex gap-1 text-[11px]">
                  <button type="button" onClick={() => startLive(15 * 60 * 1000, [p.id])} className="border border-[#ff2a3a] text-[#ff2a3a] px-2 py-1 rounded">Live 15m</button>
                  <button type="button" onClick={() => setSharingByPlayer(prev => ({ ...prev, [p.id]: { mode: 'city' } }))} className="border border-[#d8dae0] px-2 py-1 rounded">City</button>
                  <button type="button" onClick={() => { stopLive([p.id]); setSharingByPlayer(prev => ({ ...prev, [p.id]: { mode: 'off' } })); }} className="border border-[#d8dae0] px-2 py-1 rounded">Off</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-[#e2e4ea] rounded-lg shadow-sm p-4 space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-[#666] mb-2">Filter Pins</div>
          <div className="flex gap-2 text-[11px]">
            {(['all', 'private', 'close', 'specific'] as const).map(scope => (
              <button
                key={scope}
                type="button"
                onClick={() => setScopeFilter(scope)}
                className={`px-2 py-1 border rounded ${scopeFilter === scope ? 'border-[#ff2a3a] text-[#ff2a3a]' : 'border-[#d8dae0] text-[#555]'}`}
              >
                {scope}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
