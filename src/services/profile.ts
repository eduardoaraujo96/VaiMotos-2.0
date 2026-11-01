import type { ProfileUpdatePayload, User } from '../types';
import { persistUser } from './authStorage';
import { AppError } from './errors';
import { isSupabaseConfigured } from './supabaseClient';
import { fetchProfileById, saveUserProfile, uploadAvatar as uploadAvatarRemote } from './supabaseService';

export { mapProfileRow as mapProfile } from './mappers';

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (isSupabaseConfigured) {
    const result = await uploadAvatarRemote(userId, file);
    if (!result.ok) throw new AppError(result.error.code, result.error.message);
    return result.data;
  }
  return URL.createObjectURL(file);
}

export async function fetchProfile(userId: string, email: string): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  const result = await fetchProfileById(userId, email);
  if (!result.ok) return null;
  return result.data;
}

export async function saveProfile(user: User, payload: ProfileUpdatePayload): Promise<User> {
  if (isSupabaseConfigured) {
    const result = await saveUserProfile(user, payload);
    if (!result.ok) throw new AppError(result.error.code, result.error.message);
    persistUser(result.data);
    return result.data;
  }

  let avatarUrl = user.avatarUrl;
  if (payload.avatarFile) {
    avatarUrl = URL.createObjectURL(payload.avatarFile);
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
  persistUser(next);
  return next;
}
