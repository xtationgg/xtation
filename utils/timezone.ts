import tzlookup from 'tz-lookup';

export function timeZoneFromLatLng(lat: number, lng: number): string | null {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return tzlookup(lat, lng);
  } catch {
    return null;
  }
}

/**
 * Get current UTC offset (minutes) for an IANA timezone at "now".
 * Positive means ahead of UTC (e.g., GMT+8 => 480).
 */
export function utcOffsetMinutesForTimeZone(timeZone: string, at: Date = new Date()): number | null {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = dtf.formatToParts(at);
    const get = (type: string) => parts.find(p => p.type === type)?.value;

    const y = Number(get('year'));
    const mo = Number(get('month'));
    const d = Number(get('day'));
    const h = Number(get('hour'));
    const mi = Number(get('minute'));
    const s = Number(get('second'));

    if (![y, mo, d, h, mi, s].every(Number.isFinite)) return null;

    // Interpret the timezone-local wall clock as if it were UTC to derive offset
    const asUTC = Date.UTC(y, mo - 1, d, h, mi, s);
    const realUTC = at.getTime();
    const offsetMs = asUTC - realUTC;
    return Math.round(offsetMs / 60000);
  } catch {
    return null;
  }
}
