import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { saveToken, saveUser, removeToken, getToken, getStoredUser, StoredUser } from './auth';
import { Auth, Dashboard, DashboardData, ApiError, Suppliers, Haccp } from './api';

interface AppCtx {
  user: StoredUser | null;
  dashboard: DashboardData | null;
  state: DashboardData | null;      // Alias pour more.tsx
  apiKey: string | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, apiKey?: string) => Promise<void>;
  logout: () => void;
  refreshDashboard: () => Promise<void>;
  refreshData: () => Promise<void>;       // Alias pour more.tsx
  setUser: (u: StoredUser) => void;
  setApiKey: (key: string) => Promise<void>;
  addSupplier: (name: string) => Promise<void>;
  addHaccpPhoto: (photo: { name: string; uri: string }) => Promise<void>;
  clearAllData: () => Promise<void>;
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
      } catch { /* session vide */ }
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

  const signup = useCallback(async (name: string, email: string, password: string, apiKey = '') => {
    const { token, user: u } = await Auth.signup(name, email, password, apiKey);
    await saveToken(token);
    await saveUser(u);
    setUserState(u);
  }, []);

  const setUser = useCallback((u: StoredUser) => {
    setUserState(u);
    saveUser(u);
  }, []);

  // Correction : On appelle l'API pour sauvegarder la clé Gemini
  const setApiKey = useCallback(async (key: string) => {
    if (user) {
      await Auth.updateApiKey(key);
      const updatedUser = { ...user, apiKey: key };
      setUser(updatedUser);
    }
  }, [user, setUser]);

  // Correction : Utilisation des méthodes exactes de api.ts (add et uploadPhoto)
  const addSupplier = useCallback(async (name: string) => {
    await Suppliers.add(name);
    await refreshDashboard();
  }, [refreshDashboard]);

  const addHaccpPhoto = useCallback(async (photo: { name: string; uri: string }) => {
    await Haccp.uploadPhoto(photo.uri, photo.name);
    await refreshDashboard();
  }, [refreshDashboard]);

  const clearAllData = useCallback(async () => {
    await Dashboard.clearData();
    await refreshDashboard();
  }, [refreshDashboard]);

  return (
    <Ctx.Provider value={{
      user, 
      dashboard, 
      state: dashboard, 
      apiKey: user?.apiKey || null,
      isLoading, 
      isLoggedIn: !!user,
      login, signup, logout, setUser, setApiKey,
      refreshDashboard, 
      refreshData: refreshDashboard, 
      addSupplier, addHaccpPhoto, clearAllData,
    }}>
      {children}
    </Ctx.Provider>
  );
}