import type { LocationPoint } from '../types';

const EARTH_RADIUS_KM = 6371;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function isValidLatLng(lat?: number | null, lng?: number | null): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function isValidLocation(point?: LocationPoint | null): point is LocationPoint {
  return Boolean(point && isValidLatLng(point.lat, point.lng) && point.address.trim());
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number | null {
  if (!isValidLatLng(a.lat, a.lng) || !isValidLatLng(b.lat, b.lng)) {
    return null;
  }
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatApproxKm(km: number): string {
  if (km < 0.1) return 'menos de 100 m (aprox.)';
  if (km < 1) return `${Math.round(km * 1000)} m (aprox.)`;
  return `${km.toFixed(1)} km (aprox.)`;
}

export function estimateTravelMinutes(distanceKm: number): number {
  return Math.max(6, Math.round(distanceKm * 3.2));
}

export const MAP_FALLBACK_CENTER = { lat: -14.235, lng: -51.9253 };
export const MAP_FALLBACK_ZOOM = 4;
export const MAP_CITY_ZOOM = 16;
