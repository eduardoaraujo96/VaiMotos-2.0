import type { Ride } from '../types';
import { mockRideHistory } from '../data/mock';
import { listOpenRides } from './bidding';
import { isSupabaseConfigured } from './supabaseClient';
import { fetchOpenRides, fetchRideHistory as fetchRideHistoryRemote } from './supabaseService';

export async function fetchPendingRides(): Promise<Ride[]> {
  if (isSupabaseConfigured) {
    const result = await fetchOpenRides();
    if (result.ok) return result.data;
  }
  return listOpenRides();
}

export async function fetchRideHistory(userId: string): Promise<Ride[]> {
  if (isSupabaseConfigured) {
    const result = await fetchRideHistoryRemote(userId);
    if (result.ok) return result.data;
  }
  return mockRideHistory.filter(
    (ride) => ride.passengerId === userId || ride.driverId === userId
  );
}

export function estimateFare(distanceKm: number): { price: number; minutes: number } {
  const base = 6.5;
  const perKm = 2.4;
  const price = Math.round((base + distanceKm * perKm) * 10) / 10;
  const minutes = Math.max(6, Math.round(distanceKm * 3.2));
  return { price, minutes };
}
