import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'cgp_token';
const USER_KEY  = 'cgp_user';

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function removeToken(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

// ✅ apiKey supprimé de StoredUser — géré uniquement côté serveur
export interface StoredUser {
  id: string;
  name: string;
  email: string;
}

export async function saveUser(user: StoredUser): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getStoredUser(): Promise<StoredUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}
