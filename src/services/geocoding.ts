import type { LocationPoint } from '../types';
import { isValidLatLng } from '../utils/geo';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const SEARCH_LIMIT = 6;
const reverseCache = new Map<string, LocationPoint>();
const searchCache = new Map<string, LocationPoint[]>();

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  state?: string;
  postcode?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

function neighborhoodFrom(address?: NominatimAddress): string | undefined {
  return (
    address?.neighbourhood ||
    address?.suburb ||
    address?.city_district ||
    address?.village ||
    address?.town ||
    address?.city ||
    address?.municipality
  );
}

function formatAddress(result: NominatimResult): string {
  const address = result.address;
  if (!address) return result.display_name;
  const street = address.road || address.pedestrian;
  const number = address.house_number;
  const area = neighborhoodFrom(address);
  const city = address.city || address.town || address.village || address.municipality;
  const parts = [street && number ? `${street}, ${number}` : street, area, city].filter(Boolean);
  return parts.length > 0 ? parts.join(' — ') : result.display_name;
}

function toLocation(result: NominatimResult): LocationPoint {
  return {
    lat: Number(result.lat),
    lng: Number(result.lon),
    address: formatAddress(result),
    neighborhood: neighborhoodFrom(result.address),
  };
}

function reverseKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

async function nominatim<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!navigator.onLine) {
    throw new Error('Sem conexao para buscar enderecos.');
  }
  const url = new URL(path, NOMINATIM);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'pt-BR',
    },
  });
  if (!response.ok) {
    throw new Error('Falha ao consultar o servico de enderecos.');
  }
  return (await response.json()) as T;
}

export async function reverseGeocode(lat: number, lng: number): Promise<LocationPoint> {
  if (!isValidLatLng(lat, lng)) {
    throw new Error('Coordenadas invalidas.');
  }
  const key = reverseKey(lat, lng);
  const cached = reverseCache.get(key);
  if (cached) return cached;

  try {
    const result = await nominatim<NominatimResult>('/reverse', {
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      zoom: '18',
      addressdetails: '1',
    });
    const point = {
      ...toLocation(result),
      lat,
      lng,
    };
    reverseCache.set(key, point);
    return point;
  } catch {
    const fallback: LocationPoint = {
      lat,
      lng,
      address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };
    return fallback;
  }
}

export async function searchAddresses(query: string): Promise<LocationPoint[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  const key = trimmed.toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;

  const results = await nominatim<NominatimResult[]>('/search', {
    format: 'jsonv2',
    q: trimmed,
    addressdetails: '1',
    limit: String(SEARCH_LIMIT),
    countrycodes: 'br',
  });
  const points = results
    .map(toLocation)
    .filter((point) => isValidLatLng(point.lat, point.lng));
  searchCache.set(key, points);
  return points;
}

export function pointFromCoords(lat: number, lng: number, address?: string): LocationPoint {
  return {
    lat,
    lng,
    address: address?.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
  };
}
