import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError, apiRequest } from '../lib/api';
import { stopBackgroundTracking } from '../lib/backgroundTracking';
import { AUTH_TOKEN_KEY } from '../lib/sessionKeys';
import type { User, UserRole } from '../types/domain';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isReady: boolean;
  startupError: string;
  signIn: (email: string, password: string, role: UserRole) => Promise<void>;
  signUp: (details: RegistrationDetails) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (user: User) => void;
}

export interface RegistrationDetails {
  name: string;
  email: string;
  password: string;
  role: 'customer' | 'nurse';
  phone: string;
  licenseNumber?: string;
  upiId?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [startupError, setStartupError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const restoreSession = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        if (!storedToken) return;
        const payload = await apiRequest<{ user: User }>('/auth/me', { token: storedToken });
        if (isMounted) {
          setToken(storedToken);
          setUser(payload.user);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        } else if (isMounted) {
          setStartupError(error instanceof Error ? error.message : 'Could not restore your session.');
        }
      } finally {
        if (isMounted) setIsReady(true);
      }
    };
    restoreSession();
    return () => { isMounted = false; };
  }, []);

  const saveSession = useCallback(async (sessionToken: string, sessionUser: User) => {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, sessionToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
    setToken(sessionToken);
    setUser(sessionUser);
    setStartupError('');
  }, []);

  const signIn = useCallback(async (email: string, password: string, role: UserRole) => {
    const path = role === 'admin' ? '/auth/admin/login' : '/auth/login';
    const payload = await apiRequest<{ token: string; user: User }>(path, {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password })
    });
    await saveSession(payload.token, payload.user);
  }, [saveSession]);

  const signUp = useCallback(async (details: RegistrationDetails) => {
    const payload = await apiRequest<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...details,
        name: details.name.trim(),
        email: details.email.trim().toLowerCase(),
        phone: details.phone.trim(),
        licenseNumber: details.licenseNumber?.trim(),
        upiId: details.upiId?.trim()
      })
    });
    await saveSession(payload.token, payload.user);
  }, [saveSession]);

  const signOut = useCallback(async () => {
    try {
      await stopBackgroundTracking();
      if (token) await apiRequest('/auth/logout', { method: 'POST', token });
    } finally {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      setToken(null);
      setUser(null);
    }
  }, [token]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    isReady,
    startupError,
    signIn,
    signUp,
    signOut,
    updateUser: setUser
  }), [user, token, isReady, startupError, signIn, signUp, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
};