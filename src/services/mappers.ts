import type { BidRow, ProfileRow, RideRow, VehicleRow } from '../types/database';
import type { Bid, Ride, User } from '../types';
import { avatarDataUri } from '../utils/format';

export function mapProfileRow(row: ProfileRow, email: string, vehicle?: VehicleRow | null): User {
  return {
    id: row.id,
    name: row.full_name,
    email,
    phone: row.phone ?? '',
    role: row.role,
    avatarUrl: row.avatar_url ?? avatarDataUri(row.full_name, row.role === 'driver' ? '#FF6B00' : '#1A1A2E'),
    rating: Number(row.rating ?? 5),
    homeAddress: row.home_address ?? '',
    workAddress: row.work_address ?? '',
    cnhNumber: row.cnh_number ?? '',
    cnhStatus: row.cnh_status ?? (row.role === 'driver' ? 'pending' : undefined),
    plate: vehicle?.plate ?? '',
    vehicleModel: vehicle?.vehicle_model ?? '',
    vehicleStatus: vehicle?.status,
    isOnline: Boolean(row.is_online),
    color: row.role === 'driver' ? '#FF6B00' : '#1A1A2E',
  };
}

export function mapRideRow(row: RideRow): Ride {
  return {
    id: row.id,
    passengerId: row.passenger_id,
    passengerName: row.passenger?.full_name ?? 'Passageiro',
    driverId: row.driver_id ?? undefined,
    origin: {
      lat: row.origin_lat ?? Number.NaN,
      lng: row.origin_lng ?? Number.NaN,
      address: row.origin_address,
      neighborhood: row.origin_neighborhood ?? undefined,
    },
    destination: {
      lat: row.dest_lat ?? Number.NaN,
      lng: row.dest_lng ?? Number.NaN,
      address: row.dest_address,
      neighborhood: row.dest_neighborhood ?? undefined,
    },
    estimatedPrice: Number(row.suggested_price),
    estimatedMinutes: row.estimated_minutes,
    distanceKm: Number(row.distance_km),
    finalPrice: row.final_price === null ? undefined : Number(row.final_price),
    acceptedBidId: row.accepted_bid_id ?? undefined,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function mapBidRow(row: BidRow): Bid {
  const name = row.driver?.full_name ?? 'Mototaxista';
  return {
    id: row.id,
    rideId: row.ride_id,
    driverId: row.driver_id,
    driverName: name,
    driverRating: Number(row.driver?.rating ?? 5),
    driverPhoto: row.driver?.avatar_url ?? avatarDataUri(name, '#FF6B00'),
    driverColor: '#FF6B00',
    amount: Number(row.amount),
    etaMinutes: row.eta_minutes,
    status: row.status,
    createdAt: row.created_at,
  };
}
