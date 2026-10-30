import type { SignupPayload, User } from '../types';
import { avatarDataUri } from '../utils/format';
import {
  findLocalAccount,
  getStoredUser,
  persistUser,
  upsertLocalAccount,
} from './authStorage';
import { fetchProfile, mapProfile, saveProfile, uploadAvatar } from './profile';
import { isSupabaseConfigured, supabase } from './supabase';

export { getStoredUser, persistUser };

function localUserFromSignup(payload: SignupPayload, avatarUrl?: string): User {
  const id = `usr_${payload.role}_${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone,
    role: payload.role,
    avatarUrl:
      avatarUrl ??
      avatarDataUri(payload.name.trim(), payload.role === 'driver' ? '#FF6B00' : '#1A1A2E'),
    rating: 5,
    homeAddress: payload.homeAddress ?? '',
    workAddress: payload.workAddress ?? '',
    plate: payload.plate ?? '',
    vehicleModel: payload.vehicleModel ?? '',
    vehicleStatus: payload.role === 'driver' ? 'pending' : undefined,
    cnhNumber: payload.cnhNumber ?? '',
    cnhStatus: payload.role === 'driver' ? 'pending' : undefined,
    isOnline: payload.role === 'driver',
    color: payload.role === 'driver' ? '#FF6B00' : '#1A1A2E',
  };
}

export async function signUp(payload: SignupPayload): Promise<User> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email.trim(),
      password: payload.password,
      options: {
        data: {
          full_name: payload.name.trim(),
          role: payload.role,
          phone: payload.phone,
        },
      },
    });
    if (error) throw error;
    const sessionUser = data.user;
    if (!sessionUser) {
      throw new Error('Confirme o e-mail enviado pelo Supabase para concluir o cadastro.');
    }

    let avatarUrl: string | undefined;
    if (payload.avatarFile) {
      avatarUrl = await uploadAvatar(sessionUser.id, payload.avatarFile);
    }

    const base = localUserFromSignup(payload, avatarUrl);
    const saved = await saveProfile(
      { ...base, id: sessionUser.id, email: sessionUser.email ?? payload.email },
      {
        name: payload.name,
        phone: payload.phone,
        homeAddress: payload.homeAddress,
        workAddress: payload.workAddress,
        plate: payload.plate,
        vehicleModel: payload.vehicleModel,
        cnhNumber: payload.cnhNumber,
      }
    );
    persistUser(saved);
    return saved;
  }

  if (findLocalAccount(payload.email)) {
    throw new Error('Este e-mail ja esta cadastrado.');
  }

  let avatarUrl: string | undefined;
  if (payload.avatarFile) {
    avatarUrl = URL.createObjectURL(payload.avatarFile);
  }
  const user = localUserFromSignup(payload, avatarUrl);
  upsertLocalAccount({
    email: user.email,
    password: payload.password,
    user,
  });
  persistUser(user);
  return user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const normalized = email.trim().toLowerCase();

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    });
    if (error) throw error;
    if (!data.user) throw new Error('Nao foi possivel entrar.');
    const profile = await fetchProfile(data.user.id, data.user.email ?? normalized);
    if (profile) {
      persistUser(profile);
      return profile;
    }
    const meta = data.user.user_metadata ?? {};
    const fallback: User = {
      id: data.user.id,
      name: String(meta.full_name ?? 'VaiMoto'),
      email: data.user.email ?? normalized,
      phone: String(meta.phone ?? ''),
      role: meta.role === 'driver' ? 'driver' : 'passenger',
      rating: 5,
      avatarUrl: avatarDataUri(String(meta.full_name ?? 'VaiMoto'), '#FF6B00'),
    };
    persistUser(fallback);
    return fallback;
  }

  const account = findLocalAccount(normalized);
  if (!account || account.password !== password) {
    throw new Error('E-mail ou senha invalidos.');
  }
  persistUser(account.user);
  return account.user;
}

export async function restoreSession(): Promise<User | null> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.auth.getSession();
    const sessionUser = data.session?.user;
    if (sessionUser) {
      const profile = await fetchProfile(sessionUser.id, sessionUser.email ?? '');
      if (profile) {
        persistUser(profile);
        return profile;
      }
    }
  }
  return getStoredUser();
}

export async function updateCurrentUser(user: User, payload: Parameters<typeof saveProfile>[1]): Promise<User> {
  const next = await saveProfile(user, payload);
  if (!isSupabaseConfigured) {
    const account = findLocalAccount(next.email);
    if (account) {
      upsertLocalAccount({ ...account, user: next });
    }
  }
  return next;
}

export async function logout(): Promise<void> {
  persistUser(null);
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut().catch(() => undefined);
  }
}

export { mapProfile };
