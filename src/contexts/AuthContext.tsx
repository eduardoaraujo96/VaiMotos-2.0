import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ProfileUpdatePayload, SignupPayload, User } from '../types';
import { logout as logoutService, restoreSession, signIn, signUp, updateCurrentUser } from '../services/auth';
import { fetchProfileById, subscribeToDriverApproval, updateDriverAvailability } from '../services/supabaseService';
import { persistUser } from '../services/authStorage';
import { isSupabaseConfigured } from '../services/supabaseClient';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: SignupPayload) => Promise<User>;
  updateProfile: (payload: ProfileUpdatePayload) => Promise<User>;
  setDriverOnline: (isOnline: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void restoreSession()
      .then((session) => setUser(session))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'driver') return;
    let active = true;
    const refreshApproval = async () => {
      const result = await fetchProfileById(user.id, user.email);
      if (!active) return;
      if (!result.ok) {
        console.error('Unable to refresh driver approval status:', result.error.message);
        return;
      }
      if (result.data) {
        setUser(result.data);
        persistUser(result.data);
      }
    };
    const unsubscribe = subscribeToDriverApproval(user.id, () => void refreshApproval());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.email, user?.id, user?.role]);

  const login = useCallback(async (email: string, password: string) => {
    const next = await signIn(email, password);
    setUser(next);
    return next;
  }, []);

  const register = useCallback(async (payload: SignupPayload) => {
    const next = await signUp(payload);
    setUser(next);
    return next;
  }, []);

  const updateProfile = useCallback(
    async (payload: ProfileUpdatePayload) => {
      if (!user) throw new Error('not_authenticated');
      const next = await updateCurrentUser(user, payload);
      setUser(next);
      return next;
    },
    [user]
  );

  const setDriverOnline = useCallback(async (isOnline: boolean) => {
    if (!user || user.role !== 'driver') throw new Error('driver_not_authenticated');
    let next: User;
    if (isSupabaseConfigured) {
      const result = await updateDriverAvailability(user.id, user.email, isOnline);
      if (!result.ok) throw new Error(result.error.message);
      next = result.data;
    } else {
      next = { ...user, isOnline };
    }
    setUser(next);
    persistUser(next);
  }, [user]);

  const logout = useCallback(async () => {
    await logoutService();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      updateProfile,
      setDriverOnline,
      logout,
    }),
    [user, isLoading, login, register, updateProfile, setDriverOnline, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
