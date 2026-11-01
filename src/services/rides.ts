import type { Bid, Ride, User } from '../types';
import { listOpenRides } from './bidding';
import { biddingStore } from './biddingStore';
import { AppError } from './errors';
import { mockDrivers, mockPassenger, mockRideHistory } from '../data/mock';
import { isSupabaseConfigured } from './supabaseClient';
import { fetchProfileById } from './supabaseService';
import {
  fetchBidsForRides,
  fetchOpenRides,
  fetchRideHistory as fetchRideHistoryRemote,
  subscribeToPassengerRides,
  transitionRide as transitionRideRemote,
} from './supabaseService';

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
    if (!result.ok) throw new AppError(result.error.code, result.error.message);
    return result.data;
  }
  const storedRides = biddingStore.snapshot().rides;
  const storedIds = new Set(storedRides.map((ride) => ride.id));
  const rides = [...storedRides, ...mockRideHistory.filter((ride) => !storedIds.has(ride.id))];
  return rides
    .filter((ride) => ride.passengerId === userId || ride.driverId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function fetchRideBids(rideIds: string[]): Promise<Bid[]> {
  if (isSupabaseConfigured) {
    const result = await fetchBidsForRides(rideIds);
    if (!result.ok) throw new AppError(result.error.code, result.error.message);
    return result.data;
  }
  return biddingStore.snapshot().bids.filter((bid) => rideIds.includes(bid.rideId));
}

export function subscribeToPassengerRideUpdates(passengerId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) {
    return biddingStore.subscribe((event, state) => {
      const ride = event.type === 'ride.created' || event.type === 'ride.updated'
        ? event.ride
        : state.rides.find((item) => item.id === event.bid.rideId);
      if (ride?.passengerId === passengerId) onChange();
    });
  }
  return subscribeToPassengerRides(passengerId, onChange);
}

export async function updateRideStatus(
  ride: Ride,
  status: 'en_route' | 'in_progress' | 'completed' | 'cancelled'
): Promise<Ride> {
  if (isSupabaseConfigured) {
    const result = await transitionRideRemote(ride.id, status);
    if (!result.ok) throw new AppError(result.error.code, result.error.message);
    biddingStore.publish({ type: 'ride.updated', ride: result.data });
    return result.data;
  }
  const updated = { ...ride, status };
  biddingStore.publish({ type: 'ride.updated', ride: updated });
  return updated;
}

export async function fetchRideParticipant(userId: string): Promise<User | null> {
  if (isSupabaseConfigured) {
    const result = await fetchProfileById(userId);
    if (!result.ok) throw new AppError(result.error.code, result.error.message);
    return result.data;
  }
  return [...mockDrivers, mockPassenger].find((participant) => participant.id === userId) ?? null;
}

export function estimateFare(distanceKm: number): { price: number; minutes: number } {
  const base = 6.5;
  const perKm = 2.4;
  const price = Math.round((base + distanceKm * perKm) * 10) / 10;
  const minutes = Math.max(6, Math.round(distanceKm * 3.2));
  return { price, minutes };
}
