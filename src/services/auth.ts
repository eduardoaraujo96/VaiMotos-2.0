import type { User, UserRole } from '../types';
import { mockDriver, mockPassenger } from '../data/mock';
import { avatarDataUri } from '../utils/format';
import { isSupabaseConfigured, supabase } from './supabase';

const SESSION_KEY = 'vaimoto.session';

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function persistUser(user: User | null): void {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export async function loginWithRole(role: UserRole, name?: string): Promise<User> {
  const displayName = name || (role === 'driver' ? mockDriver.name : mockPassenger.name);
  const user: User =
    role === 'driver'
      ? {
          ...mockDriver,
          id: `usr_drv_${Math.random().toString(36).slice(2, 8)}`,
          name: displayName,
          avatarUrl: avatarDataUri(displayName, '#FF6B00'),
        }
      : { ...mockPassenger, name: displayName };

  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signInAnonymously().catch(() => undefined);
  }

  persistUser(user);
  return user;
}

export async function logout(): Promise<void> {
  persistUser(null);
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut().catch(() => undefined);
  }
}
