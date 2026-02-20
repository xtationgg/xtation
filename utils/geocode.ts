export type GeocodeResult = {
  displayName: string;
  lat: number;
  lng: number;
};

/**
 * Lightweight client-side geocoding using OpenStreetMap Nominatim.
 * Note: Nominatim has usage policies + rate limits; keep queries debounced.
 */
export async function nominatimSearch(query: string, limit = 6): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) return [];

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      // Keep it polite. (We can’t set User-Agent from browsers.)
      'Accept': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Geocode failed (${res.status})`);
  const data = (await res.json()) as any[];

  return (data || [])
    .map((r) => ({
      displayName: String(r.display_name || r.name || ''),
      lat: Number(r.lat),
      lng: Number(r.lon),
    }))
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng) && !!r.displayName);
}

export async function nominatimReverse(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) return null;
  const data = (await res.json()) as any;
  const name = String(data?.display_name || '');
  return name || null;
}
