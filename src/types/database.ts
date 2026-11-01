import type { BidStatus, CnhStatus, DriverApprovalStatus, RidePaymentMethod, RideStatus, UserRole, VehicleStatus } from './index';

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
  driver_approval_status: DriverApprovalStatus | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleRow {
  driver_id: string;
  plate: string;
  vehicle_model: string;
  color: string | null;
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
  payment_method: RidePaymentMethod | null;
  accepted_bid_id: string | null;
  status: RideStatus;
  expires_at: string;
  completed_at: string | null;
  created_at: string;
  passenger?: { full_name: string; avatar_url: string | null } | null;
  reviews?: RideReviewRow[] | null;
}

export interface RideReviewRow {
  id: string;
  ride_id: string;
  reviewer_id: string;
  reviewed_user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface PendingDriverApprovalRow {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  plate: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
}

export interface DriverEarningsSummary {
  today_amount: number;
  week_amount: number;
  month_amount: number;
  total_amount: number;
  today_rides: number;
  week_rides: number;
  month_rides: number;
  total_rides: number;
  average_amount: number;
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

export interface RideMessageRow {
  id: string;
  ride_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow> & { id: string; full_name: string }; Update: Partial<ProfileRow> };
      vehicle_details: { Row: VehicleRow; Insert: Partial<VehicleRow> & { driver_id: string; plate: string; vehicle_model: string }; Update: Partial<VehicleRow> };
      rides: { Row: RideRow; Insert: Partial<RideRow> & { passenger_id: string; origin_lat: number; origin_lng: number; origin_address: string; dest_lat: number; dest_lng: number; dest_address: string; suggested_price: number; estimated_minutes: number; distance_km: number }; Update: Partial<RideRow> };
      bids: { Row: BidRow; Insert: Partial<BidRow> & { ride_id: string; driver_id: string; amount: number; eta_minutes: number }; Update: Partial<BidRow> };
      ride_messages: { Row: RideMessageRow; Insert: Partial<RideMessageRow> & { ride_id: string; sender_id: string; message: string }; Update: Partial<RideMessageRow> };
      ride_reviews: { Row: RideReviewRow; Insert: Partial<RideReviewRow> & { ride_id: string; reviewer_id: string; reviewed_user_id: string; rating: number }; Update: Partial<RideReviewRow> };
      driver_approval_admins: { Row: { user_id: string; created_at: string }; Insert: { user_id: string }; Update: never };
    };
    Functions: {
      accept_bid: { Args: { p_bid_id: string }; Returns: RideRow };
      transition_ride: { Args: { p_ride_id: string; p_next_status: string }; Returns: RideRow };
      is_driver_approval_admin: { Args: Record<string, never>; Returns: boolean };
      list_pending_driver_approvals: { Args: Record<string, never>; Returns: PendingDriverApprovalRow[] };
      set_driver_approval: { Args: { p_driver_id: string; p_status: string }; Returns: undefined };
      driver_earnings_summary: { Args: Record<string, never>; Returns: DriverEarningsSummary };
      unread_ride_message_count: { Args: Record<string, never>; Returns: number };
    };
  };
}

export type ServiceError = { code: string; message: string };

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ServiceError };
