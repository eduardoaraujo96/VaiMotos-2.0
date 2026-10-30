import type { Bid, Ride, User } from '../types';
import { mockDrivers } from '../data/mock';
import { avatarDataUri } from '../utils/format';
import { biddingStore } from './biddingStore';
import { AppError } from './errors';
import { isSupabaseConfigured } from './supabaseClient';
import {
  acceptDriverBid,
  createRide,
  fetchBidsForDriver,
  fetchBidsForRide,
  fetchOpenRides,
  submitBlindBid,
} from './supabaseService';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function createRideRequest(input: {
  passenger: User;
  origin: Ride['origin'];
  destination: Ride['destination'];
  estimatedPrice: number;
  estimatedMinutes: number;
  distanceKm: number;
}): Promise<Ride> {
  if (isSupabaseConfigured) {
    const result = await createRide(input);
    if (!result.ok) throw new AppError(result.error.code, result.error.message);
    biddingStore.publish({ type: 'ride.created', ride: result.data });
    return result.data;
  }

  const ride: Ride = {
    id: uid('ride'),
    passengerId: input.passenger.id,
    passengerName: input.passenger.name,
    origin: input.origin,
    destination: input.destination,
    estimatedPrice: input.estimatedPrice,
    estimatedMinutes: input.estimatedMinutes,
    distanceKm: input.distanceKm,
    status: 'bidding',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90_000).toISOString(),
  };
  biddingStore.publish({ type: 'ride.created', ride });
  simulateIncomingBids(ride);
  return ride;
}

function simulateIncomingBids(ride: Ride): void {
  mockDrivers
    .filter((driver) => driver.id !== 'usr_drv_01')
    .forEach((driver, index) => {
      window.setTimeout(() => {
        const current = biddingStore.snapshot().rides.find((item) => item.id === ride.id);
        if (!current || current.status !== 'bidding') return;
        const factor = 0.84 + index * 0.11 + Math.random() * 0.08;
        void submitBid({
          ride: current,
          driver,
          amount: Math.round(ride.estimatedPrice * factor * 10) / 10,
          etaMinutes: Math.max(3, Math.round(3 + index * 2 + Math.random() * 2)),
        });
      }, 1100 + index * 1500);
    });
}

export async function submitBid(input: {
  ride: Ride;
  driver: User;
  amount: number;
  etaMinutes: number;
}): Promise<Bid> {
  if (isSupabaseConfigured) {
    const result = await submitBlindBid({
      rideId: input.ride.id,
      driver: input.driver,
      amount: input.amount,
      etaMinutes: input.etaMinutes,
    });
    if (!result.ok) throw new AppError(result.error.code, result.error.message);
    biddingStore.publish({ type: 'bid.created', bid: result.data });
    return result.data;
  }

  const driverMeta =
    mockDrivers.find((item) => item.id === input.driver.id) ??
    ({
      rating: input.driver.rating,
      color: '#FF6B00',
      avatarUrl: input.driver.avatarUrl ?? avatarDataUri(input.driver.name, '#FF6B00'),
    } as const);

  const existing = biddingStore
    .snapshot()
    .bids.find((bid) => bid.rideId === input.ride.id && bid.driverId === input.driver.id);

  const bid: Bid = {
    id: existing?.id ?? uid('bid'),
    rideId: input.ride.id,
    driverId: input.driver.id,
    driverName: input.driver.name,
    driverRating: driverMeta.rating,
    driverPhoto: driverMeta.avatarUrl ?? avatarDataUri(input.driver.name, '#FF6B00'),
    driverColor: 'color' in driverMeta ? driverMeta.color : '#FF6B00',
    amount: input.amount,
    etaMinutes: input.etaMinutes,
    status: 'pending',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  biddingStore.publish({ type: existing ? 'bid.updated' : 'bid.created', bid });
  return bid;
}

export async function acceptBid(ride: Ride, bid: Bid): Promise<Ride> {
  if (isSupabaseConfigured) {
    const result = await acceptDriverBid(bid.id, ride, bid);
    if (!result.ok) throw new AppError(result.error.code, result.error.message);
    biddingStore.publish({ type: 'ride.updated', ride: result.data });
    return result.data;
  }

  biddingStore
    .snapshot()
    .bids.filter((item) => item.rideId === ride.id)
    .forEach((item) => {
      biddingStore.publish({
        type: 'bid.updated',
        bid: { ...item, status: item.id === bid.id ? 'accepted' : 'rejected' },
      });
    });

  const awarded: Ride = {
    ...ride,
    status: 'awarded',
    driverId: bid.driverId,
    acceptedBidId: bid.id,
    finalPrice: bid.amount,
  };
  biddingStore.publish({ type: 'ride.updated', ride: awarded });
  return awarded;
}

export function listOpenRides(): Ride[] {
  return biddingStore
    .snapshot()
    .rides.filter((ride) => ride.status === 'bidding' && new Date(ride.expiresAt).getTime() > Date.now());
}

export function listBidsForRide(rideId: string, viewer: User): Bid[] {
  const bids = biddingStore.snapshot().bids.filter((bid) => bid.rideId === rideId);
  if (viewer.role === 'driver') {
    return bids.filter((bid) => bid.driverId === viewer.id);
  }
  return bids;
}

export function listBidsForDriver(driverId: string): Bid[] {
  return biddingStore.snapshot().bids.filter((bid) => bid.driverId === driverId);
}

export async function loadOpenRides(): Promise<Ride[]> {
  if (!isSupabaseConfigured) return listOpenRides();
  const result = await fetchOpenRides();
  if (!result.ok) return listOpenRides();
  return result.data;
}

export async function loadBidsForRide(rideId: string, viewer: User): Promise<Bid[]> {
  if (!isSupabaseConfigured) return listBidsForRide(rideId, viewer);
  const result = await fetchBidsForRide(rideId, viewer);
  if (!result.ok) return listBidsForRide(rideId, viewer);
  return result.data;
}

export async function loadBidsForDriver(driverId: string): Promise<Bid[]> {
  if (!isSupabaseConfigured) return listBidsForDriver(driverId);
  const result = await fetchBidsForDriver(driverId);
  if (!result.ok) return listBidsForDriver(driverId);
  return result.data;
}
