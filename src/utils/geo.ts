export interface Coordinates {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371.0088;

export function isValidCoordinate(point?: Partial<Coordinates> | null): point is Coordinates {
  return (
    !!point &&
    typeof point.lat === 'number' &&
    typeof point.lng === 'number' &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distancia em linha reta (Haversine), em km. Retorna null se faltar coordenada valida. */
export function haversineKm(a?: Partial<Coordinates> | null, b?: Partial<Coordinates> | null): number | null {
  if (!isValidCoordinate(a) || !isValidCoordinate(b)) return null;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatApproxDistance(km: number | null): string {
  if (km === null) return 'Distancia indisponivel';
  if (km < 1) return `~${Math.max(10, Math.round((km * 1000) / 10) * 10)} m em linha reta`;
  return `~${km.toFixed(1).replace('.', ',')} km em linha reta`;
}

/** Tempo aproximado de moto (media urbana de 25 km/h) a partir da distancia em linha reta. */
export function approxMinutes(km: number | null, speedKmh = 25): number | null {
  if (km === null) return null;
  return Math.max(1, Math.round((km / speedKmh) * 60));
}
