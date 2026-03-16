import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { saveToken, saveUser, removeToken, getToken, getStoredUser, StoredUser } from './auth';
import { Auth, Dashboard, DashboardData, ApiError, Suppliers, Haccp } from './api';

interface AppCtx {
  user: StoredUser | null;
  dashboard: DashboardData | null;
  state: DashboardData | null;
  // ✅ apiKey et setApiKey supprimés — clé gérée côté serveur via GEMINI_API_KEY sur Render
  isLoading: boolean;
  isLoggedIn: boolean;
  login:  (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshDashboard: () => Promise<void>;
  refreshData:      () => Promise<void>;
  setUser: (u: StoredUser) => void;
  requestPasswordReset: (email: string) => Promise<void>;
  addSupplier:   (name: string) => Promise<void>;
  addHaccpPhoto: (photo: { name: string; uri: string }) => Promise<void>;
  clearAllData:  () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState]       = useState<StoredUser | null>(null);
  const [dashboard, setDashboard]  = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading]  = useState(true);

  const refreshDashboard = useCallback(async () => {
    if (!user) return;
    try {
      const data = await Dashboard.get();
      setDashboard(data);
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 401) logout();
    }
  }, [user]);

  const logout = useCallback(async () => {
    await removeToken();
    setUserState(null);
    setDashboard(null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [token, storedUser] = await Promise.all([getToken(), getStoredUser()]);
        if (token && storedUser) {
          setUserState(storedUser);
          setIsLoading(false);
          Auth.me().then(fresh => {
            if (fresh) {
              const updated = { ...storedUser, ...fresh };
              setUserState(updated);
              saveUser(updated);
            }
          }).catch(() => logout());
          return;
        }
      } catch { }
      setIsLoading(false);
    })();
  }, [logout]);

  useEffect(() => {
    if (user) refreshDashboard();
  }, [user?.id, refreshDashboard]);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: u } = await Auth.login(email, password);
    await saveToken(token);
    await saveUser(u);
    setUserState(u);
  }, []);

  // ✅ Plus de paramètre apiKey
  const signup = useCallback(async (name: string, email: string, password: string) => {
    try {
      const response = await Auth.signup(name, email, password) as any;

      const token    = response?.token || response?.data?.session?.access_token || response?.data?.token;
      const userData = response?.user  || response?.data?.user;

      if (token && userData) {
        await saveToken(token);
        await saveUser(userData);
        setUserState(userData);
        return;
      }

      console.log('Inscription réussie, attente de confirmation mail...');
    } catch (error) {
      throw error;
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await Auth.forgotPassword(email);
  }, []);

  // ✅ setApiKey supprimé

  const addSupplier   = useCallback(async (name: string) => { await Suppliers.add(name); await refreshDashboard(); }, [refreshDashboard]);
  const addHaccpPhoto = useCallback(async (photo: { name: string; uri: string }) => { await Haccp.uploadPhoto(photo.uri, photo.name); await refreshDashboard(); }, [refreshDashboard]);
  const clearAllData  = useCallback(async () => { await Dashboard.clearData(); await refreshDashboard(); }, [refreshDashboard]);

  return (
    <Ctx.Provider value={{
      user, dashboard, state: dashboard,
      // ✅ apiKey retiré du contexte
      isLoading, isLoggedIn: !user,
      login, signup, logout, setUser: setUserState,
      refreshDashboard, refreshData: refreshDashboard,
      requestPasswordReset,
      addSupplier, addHaccpPhoto, clearAllData,
    }}>
      {children}
    </Ctx.Provider>
  );
}
