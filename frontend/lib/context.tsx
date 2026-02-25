import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { saveToken, saveUser, removeToken, getToken, getStoredUser, StoredUser } from './auth';
import { Auth, Dashboard, DashboardData, ApiError } from './api';

interface AppCtx {
  user: StoredUser | null;
  dashboard: DashboardData | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, apiKey?: string) => Promise<void>;
  logout: () => void;
  refreshDashboard: () => Promise<void>;
  setUser: (u: StoredUser) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<StoredUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restaurer la session au démarrage
  useEffect(() => {
    (async () => {
      try {
        const [token, storedUser] = await Promise.all([getToken(), getStoredUser()]);
        if (token && storedUser) {
          setUserState(storedUser);
          setIsLoading(false); // libère l'app immédiatement sans attendre le réseau
          Auth.me().then(fresh => {
            if (fresh) setUserState(u => ({ ...u!, ...fresh }));
          }).catch(async () => {
            await removeToken();
            setUserState(null);
          });
          return;
        }
      } catch { /* pas de session */ }
      setIsLoading(false); // pas de token sauvegardé
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: u } = await Auth.login(email, password);
    await saveToken(token);
    await saveUser(u);
    setUserState(u);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string, apiKey = '') => {
    const { token, user: u } = await Auth.signup(name, email, password, apiKey);
    await saveToken(token);
    await saveUser(u);
    setUserState(u);
  }, []);

  const logout = useCallback(async () => {
    await removeToken();
    setUserState(null);
    setDashboard(null);
  }, []);

  const setUser = useCallback((u: StoredUser) => {
    setUserState(u);
    saveUser(u);
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!user) return;
    try {
      const data = await Dashboard.get();
      setDashboard(data);
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 401) logout();
    }
  }, [user, logout]);

  useEffect(() => {
    if (user) refreshDashboard();
  }, [user?.id]);

  return (
    <Ctx.Provider value={{
      user, dashboard, isLoading, isLoggedIn: !!user,
      login, signup, logout, refreshDashboard, setUser,
    }}>
      {children}
    </Ctx.Provider>
  );
}
