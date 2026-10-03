import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, loadAuth, setCsrfToken } from './api';
import type { AuthState } from './types';

type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ user: null, guilds: [], loading: true, csrfToken: '' });

  const refresh = async () => {
    try {
      const session = await loadAuth();
      setAuth({ ...session, loading: false });
    } catch {
      setCsrfToken('');
      setAuth({ user: null, guilds: [], csrfToken: '', loading: false });
    }
  };

  useEffect(() => { void refresh(); }, []);

  const signOut = async () => {
    try { await api('/auth/logout', { method: 'POST', body: '{}' }); } finally {
      setCsrfToken('');
      setAuth({ user: null, guilds: [], csrfToken: '', loading: false });
    }
  };

  return <AuthContext.Provider value={{ ...auth, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}