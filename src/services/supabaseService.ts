import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Bid, LocationPoint, ProfileUpdatePayload, Ride, RideReview, User } from '../types';
import type {
  BidRow,
  DriverEarningsSummary,
  PendingDriverApprovalRow,
  ProfileRow,
  RideMessageRow,
  RideReviewRow,
  RideRow,
  ServiceResult,
  VehicleRow,
} from '../types/database';
import { fail } from './errors';
import { mapBidRow, mapProfileRow, mapRideRow } from './mappers';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { isValidLatLng } from '../utils/geo';

const AVATAR_BUCKET = 'avatars';
const RIDE_SELECT =
  '*, passenger:profiles!rides_passenger_id_fkey(full_name, avatar_url)';
const BID_SELECT =
  '*, driver:profiles!bids_driver_id_fkey(full_name, rating, avatar_url)';
const DRIVER_RIDE_SELECT =
  '*, passenger:profiles!rides_passenger_id_fkey(full_name, avatar_url), reviews:ride_reviews(id, ride_id, reviewer_id, reviewed_user_id, rating, comment, created_at)';

function mapRideReview(row: RideReviewRow): RideReview {
  return {
    id: row.id,
    rideId: row.ride_id,
    reviewerId: row.reviewer_id,
    reviewedUserId: row.reviewed_user_id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

function clientOrThrow() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }
  return client;
}

export async function uploadAvatar(userId: string, file: File): Promise<ServiceResult<string>> {
  try {
    const client = clientOrThrow();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${userId}/avatar.${ext}`;
    const { error } = await client.storage.from(AVATAR_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });
    if (error) return fail(error, 'Falha ao enviar a foto de perfil.');
    const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    return { ok: true, data: `${data.publicUrl}?t=${Date.now()}` };
  } catch (error) {
    return fail(error, 'Falha ao enviar a foto de perfil.');
  }
}

export async function fetchProfileById(userId: string, email = ''): Promise<ServiceResult<User | null>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) return fail(error, 'Nao foi possivel carregar o perfil.');
    if (!data) return { ok: true, data: null };
    const profile = data as ProfileRow;

    let vehicle: VehicleRow | null = null;
    if (profile.role === 'driver') {
      const { data: vehicleData, error: vehicleError } = await client
        .from('vehicle_details')
        .select('*')
        .eq('driver_id', userId)
        .maybeSingle();
      if (vehicleError) return fail(vehicleError, 'Nao foi possivel carregar o veiculo.');
      vehicle = (vehicleData as VehicleRow | null) ?? null;
    }
    return { ok: true, data: mapProfileRow(profile, email, vehicle) };
  } catch (error) {
    return fail(error, 'Nao foi possivel carregar o perfil.');
  }
}

export async function saveUserProfile(user: User, payload: ProfileUpdatePayload): Promise<ServiceResult<User>> {
  try {
    const client = clientOrThrow();
    let avatarUrl = user.avatarUrl;
    if (payload.avatarFile) {
      const uploaded = await uploadAvatar(user.id, payload.avatarFile);
      if (!uploaded.ok) return uploaded;
      avatarUrl = uploaded.data;
    }

    const next: User = {
      ...user,
      name: payload.name.trim(),
      phone: payload.phone,
      homeAddress: payload.homeAddress ?? '',
      workAddress: payload.workAddress ?? '',
      plate: payload.plate ?? user.plate,
      vehicleModel: payload.vehicleModel ?? user.vehicleModel,
      vehicleColor: payload.vehicleColor ?? user.vehicleColor,
      cnhNumber: payload.cnhNumber ?? user.cnhNumber,
      avatarUrl,
    };

    const { error } = await client.from('profiles').upsert({
      id: user.id,
      full_name: next.name,
      phone: next.phone,
      role: next.role,
      avatar_url: next.avatarUrl,
      home_address: next.homeAddress || null,
      work_address: next.workAddress || null,
      cnh_number: next.role === 'driver' ? next.cnhNumber || null : null,
      cnh_status: next.role === 'driver' ? next.cnhStatus ?? 'pending' : null,
      updated_at: new Date().toISOString(),
    });
    if (error) return fail(error, 'Nao foi possivel salvar o perfil.');

    if (next.role === 'driver') {
      const { error: vehicleError } = await client.from('vehicle_details').upsert({
        driver_id: user.id,
        plate: next.plate ?? '',
        vehicle_model: next.vehicleModel ?? '',
        color: next.vehicleColor || null,
        status: next.vehicleStatus ?? 'pending',
        updated_at: new Date().toISOString(),
      });
      if (vehicleError) return fail(vehicleError, 'Nao foi possivel salvar os dados da moto.');
    }

    return { ok: true, data: next };
  } catch (error) {
    return fail(error, 'Nao foi possivel salvar o perfil.');
  }
}

export async function updateDriverAvailability(
  userId: string,
  email: string,
  isOnline: boolean
): Promise<ServiceResult<User>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client
      .from('profiles')
      .update({ is_online: isOnline, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .eq('role', 'driver')
      .select('*')
      .single();
    if (error || !data) return fail(error ?? new Error('driver_profile_not_found'), 'Não foi possível atualizar sua disponibilidade.');
    const profile = data as ProfileRow;
    let vehicle: VehicleRow | null = null;
    const { data: vehicleData, error: vehicleError } = await client
      .from('vehicle_details')
      .select('*')
      .eq('driver_id', userId)
      .maybeSingle();
    if (vehicleError) return fail(vehicleError, 'Não foi possível atualizar a disponibilidade do veículo.');
    vehicle = (vehicleData as VehicleRow | null) ?? null;
    return { ok: true, data: mapProfileRow(profile, email, vehicle) };
  } catch (error) {
    return fail(error, 'Não foi possível atualizar sua disponibilidade.');
  }
}

export async function createRide(input: {
  passenger: User;
  origin: LocationPoint;
  destination: LocationPoint;
  estimatedPrice: number;
  estimatedMinutes: number;
  distanceKm: number;
  paymentMethod: Ride['paymentMethod'];
}): Promise<ServiceResult<Ride>> {
  try {
    if (!isValidLatLng(input.origin.lat, input.origin.lng) || !isValidLatLng(input.destination.lat, input.destination.lng)) {
      return fail(new Error('invalid_coordinates'), 'Escolha embarque e destino validos no mapa.');
    }
    const client = clientOrThrow();
    const expiresAt = new Date(Date.now() + 90_000).toISOString();
    const { data, error } = await client
      .from('rides')
      .insert({
        passenger_id: input.passenger.id,
        origin_lat: input.origin.lat,
        origin_lng: input.origin.lng,
        origin_address: input.origin.address,
        origin_neighborhood: input.origin.neighborhood ?? null,
        dest_lat: input.destination.lat,
        dest_lng: input.destination.lng,
        dest_address: input.destination.address,
        dest_neighborhood: input.destination.neighborhood ?? null,
        suggested_price: input.estimatedPrice,
        estimated_minutes: input.estimatedMinutes,
        distance_km: input.distanceKm,
        payment_method: input.paymentMethod,
        status: 'bidding',
        expires_at: expiresAt,
      })
      .select(RIDE_SELECT)
      .single();
    if (error || !data) return fail(error ?? new Error('insert_failed'), 'Nao foi possivel criar a corrida.');
    const ride = mapRideRow(data as RideRow);
    ride.passengerName = input.passenger.name;
    return { ok: true, data: ride };
  } catch (error) {
    return fail(error, 'Nao foi possivel criar a corrida.');
  }
}

export async function fetchOpenRides(): Promise<ServiceResult<Ride[]>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client
      .from('rides')
      .select(RIDE_SELECT)
      .eq('status', 'bidding')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error) return fail(error, 'Nao foi possivel carregar o radar.');
    return { ok: true, data: (data as RideRow[]).map(mapRideRow) };
  } catch (error) {
    return fail(error, 'Nao foi possivel carregar o radar.');
  }
}

export async function fetchRideById(rideId: string): Promise<ServiceResult<Ride | null>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client.from('rides').select(RIDE_SELECT).eq('id', rideId).maybeSingle();
    if (error) return fail(error, 'Nao foi possivel carregar a corrida.');
    return { ok: true, data: data ? mapRideRow(data as RideRow) : null };
  } catch (error) {
    return fail(error, 'Nao foi possivel carregar a corrida.');
  }
}

export async function fetchRideHistory(userId: string): Promise<ServiceResult<Ride[]>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client
      .from('rides')
      .select(RIDE_SELECT)
      .or(`passenger_id.eq.${userId},driver_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) return fail(error, 'Nao foi possivel carregar o historico.');
    return { ok: true, data: (data as RideRow[]).map(mapRideRow) };
  } catch (error) {
    return fail(error, 'Nao foi possivel carregar o historico.');
  }
}

export async function fetchDriverRideHistory(
  driverId: string,
  offset: number,
  limit: number
): Promise<ServiceResult<RideRow[]>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client
      .from('rides')
      .select(DRIVER_RIDE_SELECT)
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return fail(error, 'Nao foi possivel carregar o historico do mototaxista.');
    return { ok: true, data: (data ?? []) as RideRow[] };
  } catch (error) {
    return fail(error, 'Nao foi possivel carregar o historico do mototaxista.');
  }
}

export async function fetchDriverEarningsSummary(): Promise<ServiceResult<DriverEarningsSummary>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client.rpc('driver_earnings_summary');
    if (error || !data) return fail(error ?? new Error('earnings_summary_unavailable'), 'Nao foi possivel carregar seus ganhos.');
    return { ok: true, data: data as DriverEarningsSummary };
  } catch (error) {
    return fail(error, 'Nao foi possivel carregar seus ganhos.');
  }
}

export async function fetchRideReviews(rideId: string): Promise<ServiceResult<RideReview[]>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client
      .from('ride_reviews')
      .select('id, ride_id, reviewer_id, reviewed_user_id, rating, comment, created_at')
      .eq('ride_id', rideId)
      .order('created_at', { ascending: true });
    if (error) return fail(error, 'Nao foi possivel carregar as avaliacoes da corrida.');
    return { ok: true, data: ((data ?? []) as RideReviewRow[]).map(mapRideReview) };
  } catch (error) {
    return fail(error, 'Nao foi possivel carregar as avaliacoes da corrida.');
  }
}

export async function insertRideReview(input: {
  rideId: string;
  reviewerId: string;
  reviewedUserId: string;
  rating: number;
  comment: string;
}): Promise<ServiceResult<RideReview>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client
      .from('ride_reviews')
      .insert({
        ride_id: input.rideId,
        reviewer_id: input.reviewerId,
        reviewed_user_id: input.reviewedUserId,
        rating: input.rating,
        comment: input.comment.trim() || null,
      })
      .select('id, ride_id, reviewer_id, reviewed_user_id, rating, comment, created_at')
      .single();
    if (error || !data) return fail(error ?? new Error('review_insert_failed'), 'Nao foi possivel enviar a avaliacao.');
    return { ok: true, data: mapRideReview(data as RideReviewRow) };
  } catch (error) {
    return fail(error, 'Nao foi possivel enviar a avaliacao.');
  }
}

export async function checkDriverApprovalAdmin(): Promise<ServiceResult<boolean>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client.rpc('is_driver_approval_admin');
    if (error) return fail(error, 'Nao foi possivel verificar a autorizacao do Desenvolvedor.');
    return { ok: true, data: Boolean(data) };
  } catch (error) {
    return fail(error, 'Nao foi possivel verificar a autorizacao do Desenvolvedor.');
  }
}

export async function fetchPendingDriverApprovals(): Promise<ServiceResult<PendingDriverApprovalRow[]>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client.rpc('list_pending_driver_approvals');
    if (error) return fail(error, 'Nao foi possivel carregar os cadastros pendentes.');
    return { ok: true, data: (data ?? []) as PendingDriverApprovalRow[] };
  } catch (error) {
    return fail(error, 'Nao foi possivel carregar os cadastros pendentes.');
  }
}

export async function setDriverApproval(
  driverId: string,
  status: 'approved' | 'rejected'
): Promise<ServiceResult<null>> {
  try {
    const client = clientOrThrow();
    const { error } = await client.rpc('set_driver_approval', {
      p_driver_id: driverId,
      p_status: status,
    });
    if (error) return fail(error, 'Nao foi possivel atualizar a aprovacao do cadastro.');
    return { ok: true, data: null };
  } catch (error) {
    return fail(error, 'Nao foi possivel atualizar a aprovacao do cadastro.');
  }
}

export async function fetchBidsForRides(rideIds: string[]): Promise<ServiceResult<Bid[]>> {
  if (rideIds.length === 0) return { ok: true, data: [] };
  try {
    const client = clientOrThrow();
    const { data, error } = await client
      .from('bids')
      .select(BID_SELECT)
      .in('ride_id', rideIds)
      .order('created_at', { ascending: false });
    if (error) return fail(error, 'Nao foi possivel carregar as propostas das corridas.');
    return { ok: true, data: (data as BidRow[]).map(mapBidRow) };
  } catch (error) {
    return fail(error, 'Nao foi possivel carregar as propostas das corridas.');
  }
}

export async function fetchRideMessages(rideId: string): Promise<ServiceResult<RideMessageRow[]>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client
      .from('ride_messages')
      .select('id, ride_id, sender_id, message, created_at, read_at')
      .eq('ride_id', rideId)
      .order('created_at', { ascending: true });
    if (error) return fail(error, 'Nao foi possivel carregar as mensagens da corrida.');
    return { ok: true, data: (data ?? []) as RideMessageRow[] };
  } catch (error) {
    return fail(error, 'Nao foi possivel carregar as mensagens da corrida.');
  }
}

export async function fetchUnreadRideMessageCount(): Promise<ServiceResult<number>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client.rpc('unread_ride_message_count');
    if (error) return fail(error, 'Não foi possível consultar as mensagens não lidas.');
    const count = Number(data ?? 0);
    if (!Number.isSafeInteger(count) || count < 0) {
      return fail(new Error('invalid_unread_message_count'), 'O Supabase retornou uma contagem de mensagens inválida.');
    }
    return { ok: true, data: count };
  } catch (error) {
    return fail(error, 'Não foi possível consultar as mensagens não lidas.');
  }
}

export async function markRideMessagesRead(
  rideId: string,
  userId: string
): Promise<ServiceResult<number>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client
      .from('ride_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('ride_id', rideId)
      .neq('sender_id', userId)
      .is('read_at', null)
      .select('id');
    if (error) return fail(error, 'Não foi possível marcar as mensagens como lidas.');
    return { ok: true, data: data?.length ?? 0 };
  } catch (error) {
    return fail(error, 'Não foi possível marcar as mensagens como lidas.');
  }
}

export function subscribeToUnreadRideMessages(onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => undefined;
  const client = getSupabaseClient();
  if (!client) return () => undefined;
  const channel: RealtimeChannel = client
    .channel(`unread-ride-messages:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_messages' }, onChange)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onChange();
    });
  return () => {
    void client.removeChannel(channel);
  };
}

export async function insertRideMessage(
  rideId: string,
  senderId: string,
  message: string
): Promise<ServiceResult<RideMessageRow>> {
  const text = message.trim();
  if (!text || text.length > 280) {
    return fail(new Error('invalid_message'), 'A mensagem deve ter entre 1 e 280 caracteres.');
  }
  try {
    const client = clientOrThrow();
    const { data, error } = await client
      .from('ride_messages')
      .insert({ ride_id: rideId, sender_id: senderId, message: text })
      .select('id, ride_id, sender_id, message, created_at, read_at')
      .single();
    if (error || !data) return fail(error ?? new Error('message_insert_failed'), 'Nao foi possivel enviar a mensagem.');
    return { ok: true, data: data as RideMessageRow };
  } catch (error) {
    return fail(error, 'Nao foi possivel enviar a mensagem.');
  }
}

export async function transitionRide(
  rideId: string,
  nextStatus: 'en_route' | 'in_progress' | 'completed' | 'cancelled'
): Promise<ServiceResult<Ride>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client.rpc('transition_ride', {
      p_ride_id: rideId,
      p_next_status: nextStatus,
    });
    if (error || !data) return fail(error ?? new Error('ride_transition_failed'), 'Nao foi possivel atualizar o status da corrida.');
    return { ok: true, data: mapRideRow(data as unknown as RideRow) };
  } catch (error) {
    return fail(error, 'Nao foi possivel atualizar o status da corrida.');
  }
}

export function subscribeToPassengerRides(passengerId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => undefined;
  const client = getSupabaseClient();
  if (!client) return () => undefined;
  const channel: RealtimeChannel = client
    .channel(`passenger-rides:${passengerId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rides', filter: `passenger_id=eq.${passengerId}` },
      onChange
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, onChange)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onChange();
    });
  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToDriverRides(driverId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => undefined;
  const client = getSupabaseClient();
  if (!client) return () => undefined;
  const channel: RealtimeChannel = client
    .channel(`driver-history:${driverId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rides', filter: `driver_id=eq.${driverId}` },
      onChange
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToDriverApproval(userId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => undefined;
  const client = getSupabaseClient();
  if (!client) return () => undefined;
  const channel: RealtimeChannel = client
    .channel(`driver-approval:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
      onChange
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToRideReviews(rideId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => undefined;
  const client = getSupabaseClient();
  if (!client) return () => undefined;
  const channel: RealtimeChannel = client
    .channel(`ride-reviews:${rideId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ride_reviews', filter: `ride_id=eq.${rideId}` },
      onChange
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToRideMessages(
  rideId: string,
  onMessage: (row: RideMessageRow) => void,
  onReconnect: () => void,
  onError: (message: string) => void
): () => void {
  if (!isSupabaseConfigured) return () => undefined;
  const client = getSupabaseClient();
  if (!client) return () => undefined;
  const channel: RealtimeChannel = client
    .channel(`ride-messages:${rideId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ride_messages', filter: `ride_id=eq.${rideId}` },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as RideMessageRow;
          if (row.ride_id === rideId) onMessage(row);
        } else if (payload.eventType === 'UPDATE') {
          onReconnect();
        }
      }
    )
    .subscribe((status, error) => {
      if (status === 'SUBSCRIBED') onReconnect();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError(error?.message ?? 'Conexao do chat indisponivel. Tentando recuperar mensagens.');
      }
    });
  return () => {
    void client.removeChannel(channel);
  };
}

export async function fetchBidsForRide(rideId: string, viewer?: User): Promise<ServiceResult<Bid[]>> {
  try {
    const client = clientOrThrow();
    let query = client.from('bids').select(BID_SELECT).eq('ride_id', rideId).order('amount', { ascending: true });
    if (viewer?.role === 'driver') {
      query = query.eq('driver_id', viewer.id);
    }
    const { data, error } = await query;
    if (error) return fail(error, 'Nao foi possivel carregar as ofertas.');
    return { ok: true, data: (data as BidRow[]).map(mapBidRow) };
  } catch (error) {
    return fail(error, 'Nao foi possivel carregar as ofertas.');
  }
}

export async function fetchBidsForDriver(driverId: string): Promise<ServiceResult<Bid[]>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client
      .from('bids')
      .select(BID_SELECT)
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });
    if (error) return fail(error, 'Nao foi possivel carregar suas ofertas.');
    return { ok: true, data: (data as BidRow[]).map(mapBidRow) };
  } catch (error) {
    return fail(error, 'Nao foi possivel carregar suas ofertas.');
  }
}

export async function submitBlindBid(input: {
  rideId: string;
  driver: User;
  amount: number;
  etaMinutes: number;
}): Promise<ServiceResult<Bid>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client
      .from('bids')
      .upsert(
        {
          ride_id: input.rideId,
          driver_id: input.driver.id,
          amount: input.amount,
          eta_minutes: input.etaMinutes,
          status: 'pending',
        },
        { onConflict: 'ride_id,driver_id' }
      )
      .select(BID_SELECT)
      .single();
    if (error || !data) return fail(error ?? new Error('bid_failed'), 'Nao foi possivel enviar a oferta.');
    const bid = mapBidRow(data as BidRow);
    bid.driverName = input.driver.name;
    bid.driverRating = input.driver.rating;
    bid.driverPhoto = input.driver.avatarUrl ?? bid.driverPhoto;
    return { ok: true, data: bid };
  } catch (error) {
    return fail(error, 'Nao foi possivel enviar a oferta.');
  }
}

export async function acceptDriverBid(bidId: string, fallbackRide: Ride, fallbackBid: Bid): Promise<ServiceResult<Ride>> {
  try {
    const client = clientOrThrow();
    const { data, error } = await client.rpc('accept_bid', { p_bid_id: bidId });
    if (error) return fail(error, 'Nao foi possivel aceitar a oferta.');
    if (data) {
      return { ok: true, data: mapRideRow(data as unknown as RideRow) };
    }
    return {
      ok: true,
      data: {
        ...fallbackRide,
        status: 'awarded',
        driverId: fallbackBid.driverId,
        acceptedBidId: fallbackBid.id,
        finalPrice: fallbackBid.amount,
      },
    };
  } catch (error) {
    return fail(error, 'Nao foi possivel aceitar a oferta.');
  }
}

export function subscribeToRideBids(
  rideId: string,
  onChange: (payload: { eventType: string; bid?: Bid }) => void
): () => void {
  if (!isSupabaseConfigured) return () => undefined;
  const client = getSupabaseClient();
  if (!client) return () => undefined;

  const channel: RealtimeChannel = client
    .channel(`ride-bids:${rideId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bids', filter: `ride_id=eq.${rideId}` },
      (payload) => {
        const row = (payload.new ?? payload.old) as BidRow | undefined;
        onChange({
          eventType: payload.eventType,
          bid: row ? mapBidRow(row) : undefined,
        });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` },
      () => onChange({ eventType: 'ride' })
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToRadar(onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => undefined;
  const client = getSupabaseClient();
  if (!client) return () => undefined;

  const channel: RealtimeChannel = client
    .channel(`driver-radar:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, onChange)
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
