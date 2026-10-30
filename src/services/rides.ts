import type { Ride } from '../types';
import { mockRideHistory } from '../data/mock';
import { listOpenRides } from './bidding';
import { isSupabaseConfigured, supabase } from './supabase';

export async function fetchPendingRides(): Promise<Ride[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('status', 'bidding')
      .order('created_at', { ascending: false });
    if (!error && data) {
      return data as Ride[];
    }
  }
  return listOpenRides();
}

export async function fetchRideHistory(userId: string): Promise<Ride[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .or(`passenger_id.eq.${userId},driver_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (!error && data) {
      return data as Ride[];
    }
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
