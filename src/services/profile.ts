import type { ProfileUpdatePayload, User, UserRole, VehicleStatus } from '../types';
import { avatarDataUri } from '../utils/format';
import { persistUser } from './authStorage';
import { isSupabaseConfigured, supabase } from './supabase';

const AVATAR_BUCKET = 'avatars';

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
  cnh_status: User['cnhStatus'] | null;
  is_online: boolean | null;
}

export interface VehicleRow {
  plate: string;
  vehicle_model: string;
  status: VehicleStatus;
}

export function mapProfile(row: ProfileRow, email: string, vehicle?: VehicleRow | null): User {
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

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (isSupabaseConfigured && supabase) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${userId}/avatar.${ext}`;
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });
    if (error) throw error;
    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  }
  return URL.createObjectURL(file);
}

export async function fetchProfile(userId: string, email: string): Promise<User | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  let vehicle: VehicleRow | null = null;
  if (data.role === 'driver') {
    const { data: vehicleData } = await supabase
      .from('vehicle_details')
      .select('plate, vehicle_model, status')
      .eq('driver_id', userId)
      .maybeSingle();
    vehicle = vehicleData as VehicleRow | null;
  }
  return mapProfile(data as ProfileRow, email, vehicle);
}

export async function saveProfile(user: User, payload: ProfileUpdatePayload): Promise<User> {
  let avatarUrl = user.avatarUrl;
  if (payload.avatarFile) {
    avatarUrl = await uploadAvatar(user.id, payload.avatarFile);
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

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('profiles').upsert({
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
    if (error) throw error;

    if (next.role === 'driver') {
      const { error: vehicleError } = await supabase.from('vehicle_details').upsert({
        driver_id: user.id,
        plate: next.plate ?? '',
        vehicle_model: next.vehicleModel ?? '',
        status: next.vehicleStatus ?? 'pending',
        updated_at: new Date().toISOString(),
      });
      if (vehicleError) throw vehicleError;
    }
  }

  persistUser(next);
  return next;
}
