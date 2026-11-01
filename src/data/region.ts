export const MATOES = {
  name: 'Matões',
  state: 'Maranhão',
  stateCode: 'MA',
  lat: -5.518889,
  lng: -43.198889,
} as const;

export const MAP_DEFAULT_CENTER = { lat: MATOES.lat, lng: MATOES.lng };
export const MAP_DEFAULT_ZOOM = 14;
export const MAP_CITY_ZOOM = 16;
export const MAP_PLACE_ZOOM = 17;

export const MATOES_VIEWBOX = '-43.62,-5.10,-42.78,-5.92';

export const NEARBY_MUNICIPALITIES = [
  'matões',
  'matoes',
  'timon',
  'caxias',
  'parnarama',
  'buriti bravo',
  'colinas',
  'são joão do soter',
  'sao joao do soter',
  'teresina',
] as const;

export const QUICK_PLACE_SEARCHES = [
  { label: 'Centro', query: 'Centro' },
  { label: 'Praça', query: 'praça' },
  { label: 'Escolas', query: 'escola' },
  { label: 'Hospital', query: 'hospital' },
  { label: 'Mercado', query: 'mercado' },
  { label: 'Igreja', query: 'igreja' },
  { label: 'Posto', query: 'posto de combustível' },
  { label: 'Rodoviária', query: 'rodoviária' },
] as const;

const OTHER_CITY_HINT =
  /\b(são paulo|sao paulo|rio de janeiro|fortaleza|salvador|belém|belem|são luís|sao luis|imperatriz|caxias|timon|teresina|parnarama)\b/i;

export function queryMentionsMatoes(query: string): boolean {
  return /matões|matoes|maranhão|maranhao/i.test(query);
}

export function shouldBiasToMatoes(query: string): boolean {
  if (OTHER_CITY_HINT.test(query)) return false;
  return true;
}

export function isMatoesAddress(text: string): boolean {
  return /matões|matoes/i.test(text);
}

export function isNearbyMunicipality(text: string): boolean {
  const value = text.toLowerCase();
  return NEARBY_MUNICIPALITIES.some((name) => value.includes(name));
}
