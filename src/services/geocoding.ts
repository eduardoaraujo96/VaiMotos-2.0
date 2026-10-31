import type { LocationPoint } from '../types';
import {
  isMatoesAddress,
  isNearbyMunicipality,
  MATOES,
  MATOES_VIEWBOX,
  shouldBiasToMatoes,
} from '../data/region';
import { haversineKm, isValidLatLng } from '../utils/geo';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const SEARCH_LIMIT = 8;
const MIN_INTERVAL_MS = 1100;
const reverseCache = new Map<string, LocationPoint>();
const searchCache = new Map<string, LocationPoint[]>();

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  footway?: string;
  residential?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  village?: string;
  hamlet?: string;
  town?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  address?: NominatimAddress;
}

function streetFrom(address?: NominatimAddress): string | undefined {
  return address?.road || address?.pedestrian || address?.footway || address?.residential;
}

function municipalityFrom(address?: NominatimAddress): string | undefined {
  return address?.city || address?.town || address?.village || address?.municipality || address?.county;
}

function neighborhoodFrom(address?: NominatimAddress): string | undefined {
  return (
    address?.neighbourhood ||
    address?.suburb ||
    address?.city_district ||
    address?.hamlet ||
    address?.village ||
    address?.town
  );
}

function formatAddress(result: NominatimResult): string {
  const address = result.address;
  if (!address) return result.display_name;
  const street = streetFrom(address);
  const number = address.house_number;
  const area = neighborhoodFrom(address);
  const city = municipalityFrom(address);
  const parts = [street && number ? `${street}, ${number}` : street || result.name, area, city].filter(Boolean);
  return parts.length > 0 ? parts.join(' — ') : result.display_name;
}

function toLocation(result: NominatimResult): LocationPoint {
  return {
    lat: Number(result.lat),
    lng: Number(result.lon),
    address: formatAddress(result),
    neighborhood: neighborhoodFrom(result.address),
    name: result.name || streetFrom(result.address),
    street: streetFrom(result.address),
    municipality: municipalityFrom(result.address),
  };
}

function reverseKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function placeText(point: LocationPoint): string {
  return `${point.name ?? ''} ${point.address} ${point.neighborhood ?? ''} ${point.municipality ?? ''}`;
}

function rankScore(point: LocationPoint, query: string): number {
  const text = placeText(point).toLowerCase();
  const term = query.trim().toLowerCase();
  let score = 0;
  if (isMatoesAddress(text)) score += 400;
  else if (isNearbyMunicipality(text)) score += 180;
  const distance = haversineKm(point, MATOES);
  if (distance != null) {
    if (distance <= 8) score += 220;
    else if (distance <= 35) score += 90;
    else if (distance <= 80) score += 20;
    else score -= Math.min(180, Math.round(distance));
  }
  if (term && text.includes(term)) score += 50;
  if (point.name && point.name.toLowerCase().includes(term)) score += 40;
  return score;
}

function dedupe(points: LocationPoint[]): LocationPoint[] {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

let lastRequestAt = 0;
let queue: Promise<void> = Promise.resolve();

function waitForSlot(): Promise<void> {
  const run = async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, wait));
    }
    lastRequestAt = Date.now();
  };
  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function nominatim<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!navigator.onLine) {
    throw new Error('Sem conexao para buscar enderecos.');
  }
  await waitForSlot();
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
    return {
      lat,
      lng,
      address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };
  }
}

function buildSearchQuery(query: string): string {
  const trimmed = query.trim();
  if (!shouldBiasToMatoes(trimmed)) return trimmed;
  return `${trimmed}, Matões, Maranhão, Brasil`;
}

export async function searchAddresses(query: string): Promise<LocationPoint[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  const key = trimmed.toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;

  const biased = shouldBiasToMatoes(trimmed);
  const results = await nominatim<NominatimResult[]>('/search', {
    format: 'jsonv2',
    q: buildSearchQuery(trimmed),
    addressdetails: '1',
    limit: String(SEARCH_LIMIT),
    countrycodes: 'br',
    viewbox: MATOES_VIEWBOX,
    bounded: biased ? '0' : '0',
  });
  const points = dedupe(
    results
      .map(toLocation)
      .filter((point) => isValidLatLng(point.lat, point.lng))
      .sort((a, b) => rankScore(b, trimmed) - rankScore(a, trimmed))
  );
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
