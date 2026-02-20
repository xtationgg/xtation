export function googleEarthSearchUrl(lat: number, lng: number) {
  return `https://earth.google.com/web/search/${encodeURIComponent(lat + ',' + lng)}`;
}
