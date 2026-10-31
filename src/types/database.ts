import type { BidStatus, CnhStatus, RideStatus, UserRole, VehicleStatus } from './index';

export interface ProfileRow {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  rating: number | string | null;
  avatar_url: string | null;
  home_address: string | null;
  work_address: string | null;
  cnh_number: string | null;
  cnh_status: CnhStatus | null;
  is_online: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleRow {
  driver_id: string;
  plate: string;
  vehicle_model: string;
  status: VehicleStatus;
  created_at: string;
  updated_at: string;
}

export interface RideRow {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  origin_address: string;
  origin_neighborhood: string | null;
  dest_lat: number | null;
  dest_lng: number | null;
  dest_address: string;
  dest_neighborhood: string | null;
  suggested_price: number | string;
  estimated_minutes: number;
  distance_km: number | string;
  final_price: number | string | null;
  accepted_bid_id: string | null;
  status: RideStatus;
  expires_at: string;
  created_at: string;
  passenger?: { full_name: string; avatar_url: string | null } | null;
}

export interface BidRow {
  id: string;
  ride_id: string;
  driver_id: string;
  amount: number | string;
  eta_minutes: number;
  status: BidStatus;
  created_at: string;
  driver?: {
    full_name: string;
    rating: number | string | null;
    avatar_url: string | null;
  } | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow> & { id: string; full_name: string }; Update: Partial<ProfileRow> };
      vehicle_details: { Row: VehicleRow; Insert: Partial<VehicleRow> & { driver_id: string; plate: string; vehicle_model: string }; Update: Partial<VehicleRow> };
      rides: { Row: RideRow; Insert: Partial<RideRow> & { passenger_id: string; origin_lat: number; origin_lng: number; origin_address: string; dest_lat: number; dest_lng: number; dest_address: string; suggested_price: number; estimated_minutes: number; distance_km: number }; Update: Partial<RideRow> };
      bids: { Row: BidRow; Insert: Partial<BidRow> & { ride_id: string; driver_id: string; amount: number; eta_minutes: number }; Update: Partial<BidRow> };
    };
    Functions: {
      accept_bid: { Args: { p_bid_id: string }; Returns: RideRow };
    };
  };
}

export type ServiceError = { code: string; message: string };

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ServiceError };
