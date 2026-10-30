import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ProfileUpdatePayload, SignupPayload, User } from '../types';
import { logout as logoutService, restoreSession, signIn, signUp, updateCurrentUser } from '../services/auth';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: SignupPayload) => Promise<User>;
  updateProfile: (payload: ProfileUpdatePayload) => Promise<User>;
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
      logout,
    }),
    [user, isLoading, login, register, updateProfile, logout]
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
