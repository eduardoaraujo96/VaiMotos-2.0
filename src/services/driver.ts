import type { Ride } from '../types';
import type { DriverEarningsSummary, PendingDriverApprovalRow } from '../types/database';
import type { RideReview } from '../types';
import { AppError } from './errors';
import { mapRideRow } from './mappers';
import {
  checkDriverApprovalAdmin as checkAdminRemote,
  fetchDriverEarningsSummary as fetchSummaryRemote,
  fetchDriverRideHistory as fetchHistoryRemote,
  fetchPendingDriverApprovals as fetchPendingRemote,
  fetchRideReviews as fetchReviewsRemote,
  insertRideReview as insertReviewRemote,
  setDriverApproval as setApprovalRemote,
  subscribeToDriverRides,
  subscribeToRideReviews,
} from './supabaseService';

export interface DriverRideRecord {
  ride: Ride;
  passengerAvatar: string | null;
  reviews: RideReview[];
}

export async function fetchDriverHistoryPage(
  driverId: string,
  offset: number,
  limit: number
): Promise<DriverRideRecord[]> {
  const result = await fetchHistoryRemote(driverId, offset, limit);
  if (!result.ok) throw new AppError(result.error.code, result.error.message);
  return result.data.map((row) => ({
    ride: mapRideRow(row),
    passengerAvatar: row.passenger?.avatar_url ?? null,
    reviews: (row.reviews ?? []).map((review) => ({
      id: review.id,
      rideId: review.ride_id,
      reviewerId: review.reviewer_id,
      reviewedUserId: review.reviewed_user_id,
      rating: Number(review.rating),
      comment: review.comment,
      createdAt: review.created_at,
    })),
  }));
}

export async function fetchEarningsSummary(): Promise<DriverEarningsSummary> {
  const result = await fetchSummaryRemote();
  if (!result.ok) throw new AppError(result.error.code, result.error.message);
  return result.data;
}

export async function fetchRideReviewList(rideId: string): Promise<RideReview[]> {
  const result = await fetchReviewsRemote(rideId);
  if (!result.ok) throw new AppError(result.error.code, result.error.message);
  return result.data;
}

export async function createRideReview(input: {
  rideId: string;
  reviewerId: string;
  reviewedUserId: string;
  rating: number;
  comment: string;
}): Promise<RideReview> {
  const result = await insertReviewRemote(input);
  if (!result.ok) throw new AppError(result.error.code, result.error.message);
  return result.data;
}

export function subscribeToDriverHistory(driverId: string, onChange: () => void): () => void {
  return subscribeToDriverRides(driverId, onChange);
}

export function subscribeToRideReviewList(rideId: string, onChange: () => void): () => void {
  return subscribeToRideReviews(rideId, onChange);
}

export async function isDriverApprovalAdmin(): Promise<boolean> {
  const result = await checkAdminRemote();
  if (!result.ok) throw new AppError(result.error.code, result.error.message);
  return result.data;
}

export async function fetchPendingDrivers(): Promise<PendingDriverApprovalRow[]> {
  const result = await fetchPendingRemote();
  if (!result.ok) throw new AppError(result.error.code, result.error.message);
  return result.data;
}

export async function reviewDriverApproval(driverId: string, status: 'approved' | 'rejected'): Promise<void> {
  const result = await setApprovalRemote(driverId, status);
  if (!result.ok) throw new AppError(result.error.code, result.error.message);
}
