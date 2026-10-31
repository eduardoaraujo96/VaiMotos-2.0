import { isValidCoordinate } from '../utils/geo';

export interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
  neighborhood?: string;
}

const BASE = 'https://nominatim.openstreetmap.org';
const MAX_CACHE = 100;
const searchCache = new Map<string, GeocodeResult[]>();
const reverseCache = new Map<string, GeocodeResult>();

function remember<T>(cache: Map<string, T>, key: string, value: T) {
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, value);
}

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

function toResult(item: NominatimItem): GeocodeResult | null {
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  if (!isValidCoordinate({ lat, lng })) return null;
  const a = item.address ?? {};
  return {
    lat,
    lng,
    address: item.display_name,
    neighborhood: a.suburb ?? a.neighbourhood ?? a.city_district ?? a.quarter ?? a.city ?? a.town,
  };
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Sem conexao com a internet.');
  }
  const response = await fetch(url, { signal, headers: { 'Accept-Language': 'pt-BR' } });
  if (!response.ok) throw new Error('Servico de enderecos indisponivel. Tente novamente.');
  return (await response.json()) as T;
}

export async function searchAddress(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const key = q.toLowerCase();
  const hit = searchCache.get(key);
  if (hit) return hit;
  const params = new URLSearchParams({ q, format: 'jsonv2', addressdetails: '1', limit: '5', countrycodes: 'br' });
  const items = await getJson<NominatimItem[]>(`${BASE}/search?${params}`, signal);
  const results = items.map(toResult).filter((r): r is GeocodeResult => r !== null);
  remember(searchCache, key, results);
  return results;
}

export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<GeocodeResult> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const hit = reverseCache.get(key);
  if (hit) return hit;
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', addressdetails: '1', zoom: '18' });
  const item = await getJson<NominatimItem>(`${BASE}/reverse?${params}`, signal);
  const result = toResult(item) ?? { lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  // Mantem o ponto exato escolhido pelo usuario, nao o do centro do endereco.
  const exact = { ...result, lat, lng };
  remember(reverseCache, key, exact);
  return exact;
}
