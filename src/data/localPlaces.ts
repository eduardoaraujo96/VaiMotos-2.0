import type { LocationPoint } from '../types';
import { MATOES } from './region';

export interface LocalPlace {
  id: string;
  name: string;
  aliases: string[];
  reference: string;
  location: LocationPoint;
}

export const LOCAL_PLACES: LocalPlace[] = [
  {
    id: 'matoes-center',
    name: 'Centro de Matões',
    aliases: ['centro', 'centro de matoes', 'matões', 'matoes'],
    reference: 'Matões — MA',
    location: {
      lat: MATOES.lat,
      lng: MATOES.lng,
      address: 'Centro de Matões — Matões — MA',
      name: 'Centro de Matões',
      municipality: 'Matões',
    },
  },
];

export function normalizePlaceText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findLocalPlaces(query: string): LocalPlace[] {
  const normalizedQuery = normalizePlaceText(query);
  if (!normalizedQuery) return [];
  const tokens = normalizedQuery.split(' ');

  return LOCAL_PLACES.filter((place) => {
    const searchable = normalizePlaceText(`${place.name} ${place.reference} ${place.aliases.join(' ')}`);
    return tokens.every((token) => searchable.includes(token));
  });
}
