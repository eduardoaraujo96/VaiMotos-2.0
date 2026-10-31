import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Bid, LocationPoint, ProfileUpdatePayload, Ride, User } from '../types';
import type { BidRow, ProfileRow, RideRow, ServiceResult, VehicleRow } from '../types/database';
import { fail } from './errors';
import { mapBidRow, mapProfileRow, mapRideRow } from './mappers';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { isValidLatLng } from '../utils/geo';

const AVATAR_BUCKET = 'avatars';
const RIDE_SELECT =
  '*, passenger:profiles!rides_passenger_id_fkey(full_name, avatar_url)';
const BID_SELECT =
  '*, driver:profiles!bids_driver_id_fkey(full_name, rating, avatar_url)';

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

export async function createRide(input: {
  passenger: User;
  origin: LocationPoint;
  destination: LocationPoint;
  estimatedPrice: number;
  estimatedMinutes: number;
  distanceKm: number;
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
    .channel(`ride-bids:${rideId}`)
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
    .channel('driver-radar')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, onChange)
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
