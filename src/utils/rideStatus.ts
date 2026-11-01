import type { Bid, Ride, RideStatus } from '../types';

export type RideDisplayStatus =
  | 'searching'
  | 'offered'
  | 'confirmed'
  | 'en_route'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

export function getRideDisplayStatus(
  ride: Ride,
  bids: readonly Pick<Bid, 'status'>[] = [],
  now = Date.now()
): RideDisplayStatus {
  if (ride.status === 'bidding') {
    const expiresAt = Date.parse(ride.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt <= now) return 'expired';
    return bids.some((bid) => bid.status === 'pending') ? 'offered' : 'searching';
  }
  if (ride.status === 'awarded') return 'confirmed';
  if (ride.status === 'searching' || ride.status === 'offered' || ride.status === 'confirmed' || ride.status === 'expired') {
    return ride.status;
  }
  return ride.status as RideDisplayStatus;
}

const RIDE_STATUS_LABELS: Record<RideDisplayStatus, string> = {
  searching: 'Procurando mototaxista...',
  offered: 'Você recebeu uma proposta!',
  confirmed: 'Sua corrida foi confirmada.',
  en_route: 'O mototaxista está a caminho.',
  in_progress: 'Sua corrida está em andamento.',
  completed: 'Corrida finalizada.',
  cancelled: 'Corrida cancelada.',
  expired: 'Solicitação expirada.',
};

export function rideStatusLabel(status: RideStatus | RideDisplayStatus): string {
  return RIDE_STATUS_LABELS[status as RideDisplayStatus] ?? 'Status da corrida indisponível.';
}

export function isRideActive(status: RideDisplayStatus): boolean {
  return status === 'searching' || status === 'offered' || status === 'confirmed' || status === 'en_route' || status === 'in_progress';
}

export function paymentMethodLabel(method: Ride['paymentMethod']): string {
  if (method === 'cash') return 'Dinheiro';
  if (method === 'pix') return 'Pix';
  return 'A combinar';
}
