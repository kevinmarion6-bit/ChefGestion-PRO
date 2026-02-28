/**
 * Client API — toutes les communications avec le backend Express
 * Intègre maintenant la récupération de mot de passe via Resend
 */

import { API_BASE_URL, TIMEOUT_MS } from './config';
import { getToken } from './auth';

// ─── FETCH WRAPPER ───────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const controller = new AbortController();
  
  // LOGIQUE DE MINUTEUR :
  // Si c'est l'authentification (réveil serveur), on attend 60s, sinon on garde ton TIMEOUT_MS habituel
  const isAuthAction = path.includes('/auth/forgot-password') || path.includes('/auth/signup');
  const waitTime = isAuthAction ? 60000 : TIMEOUT_MS;
  
  const timer = setTimeout(() => controller.abort(), waitTime);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const json = await res.json() as { ok: boolean; data?: T; error?: string };

    if (!json.ok) {
      throw new ApiError(json.error ?? 'Erreur inconnue', res.status);
    }

    return json.data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === 'AbortError') {
      const msg = isAuthAction 
        ? "Le Chef prépare la cuisine... (Réveil du serveur en cours). Réessaie dans 10 secondes."
        : "Délai d'attente dépassé — vérifiez votre connexion";
      throw new ApiError(msg, 408);
    }
    throw new ApiError((err as Error).message, 0);
  } finally {
    clearTimeout(timer);
  }
}

// ─── MULTIPART HELPER ────────────────────────────────────

async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: formData,
    headers: {}, 
  });
}

// ─── CUSTOM ERROR ────────────────────────────────────────

export class ApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── TYPES ───────────────────────────────────────────────

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  apiKey: string;
}

export interface Invoice {
  id: string;
  date: string;
  supplier: string;
  products: { nom: string; unite: string; prix_ht: number; quantite: number; total_ht: number }[];
  total_ht: number;
  total_ttc: number;
  tva: number;
  createdAt: string;
}

export interface PriceAlert {
  id: string;
  product: string;
  oldPrice: number;
  newPrice: number;
  supplier: string;
  createdAt: string;
}

export interface DashboardData {
  kpis: {
    totalCoutHT: number;
    margeEstimee: number | null;
    facturesCount: number;
    alertsCount: number;
    productsCount: number;
    suppliersCount: number;
  };
  recentInvoices: Invoice[];
  recentAlerts: PriceAlert[];
}

export interface GeminiTemperature {
  temperature: number | null;
  unite: string;
  type_afficheur: string;
  confiance: number;
  erreur?: string;
}

export interface GeminiCarte {
  etablissement: string;
  plats: { categorie: string; nom: string; prix_ttc: number }[];
}

export interface Recipe {
  nom: string;
  description: string;
  ingredients_principaux: string[];
  difficulte: string;
  temps_preparation: string;
  suggestion_prix: number;
}

// ─── AUTH ────────────────────────────────────────────────

export const Auth = {
  async signup(name: string, email: string, password: string, apiKey = '') {
    return apiFetch<{ token: string; user: UserPublic }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, apiKey }),
    });
  },

  async login(email: string, password: string) {
    return apiFetch<{ token: string; user: UserPublic }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async me() {
    return apiFetch<UserPublic>('/auth/me');
  },

  async updateApiKey(apiKey: string) {
    return apiFetch<{ apiKey: string }>('/auth/apikey', {
      method: 'PATCH',
      body: JSON.stringify({ apiKey }),
    });
  },

  async forgotPassword(email: string) {
    return apiFetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, password: string) {
    return apiFetch<{ ok: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }
};

// ─── DASHBOARD ───────────────────────────────────────────

export const Dashboard = {
  async get() {
    return apiFetch<DashboardData>('/dashboard');
  },

  async clearData() {
    return apiFetch<{ cleared: boolean }>('/dashboard/data', { method: 'DELETE' });
  },
};

// ─── SCAN ────────────────────────────────────────────────

export const Scan = {
  async invoice(imageUri: string): Promise<{ invoice: Invoice; priceAlerts: PriceAlert[] }> {
    const fd = await uriToFormData(imageUri, 'image');
    return apiUpload('/scan/invoice', fd);
  },

  async temperature(imageUri: string): Promise<GeminiTemperature> {
    const fd = await uriToFormData(imageUri, 'image');
    return apiUpload('/scan/temperature', fd);
  },

  async carte(imageUri: string): Promise<GeminiCarte> {
    const fd = await uriToFormData(imageUri, 'image');
    return apiUpload('/scan/carte', fd);
  },

  async recipes(style: string, categorie: string): Promise<Recipe[]> {
    return apiFetch('/scan/recipes', {
      method: 'POST',
      body: JSON.stringify({ style, categorie }),
    });
  },
};

// ─── INVOICES ────────────────────────────────────────────

export const Invoices = {
  async list() {
    return apiFetch<Invoice[]>('/invoices');
  },

  async get(id: string) {
    return apiFetch<Invoice>(`/invoices/${id}`);
  },

  async delete(id: string) {
    return apiFetch<{ deleted: string }>(`/invoices/${id}`, { method: 'DELETE' });
  },
};

// ─── SUPPLIERS ───────────────────────────────────────────

export interface Supplier {
  name: string;
  products: { name: string; unit: string; price: number }[];
  createdAt: string;
}

export const Suppliers = {
  async list() {
    return apiFetch<Record<string, Supplier>>('/suppliers');
  },

  async add(name: string) {
    return apiFetch<Supplier>('/suppliers', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async delete(name: string) {
    return apiFetch<{ deleted: string }>(`/suppliers/${encodeURIComponent(name)}`, { method: 'DELETE' });
  },

  async bestPrices() {
    return apiFetch<{ product: string; offers: { sup: string; price: number; unit: string }[] }[]>('/suppliers/bestprices');
  },
};

// ─── HACCP ───────────────────────────────────────────────

export interface HaccpPhotoMeta {
  id: string;
  name: string;
  date: string;
}

export interface HaccpPhotoFull extends HaccpPhotoMeta {
  uri: string;
}

export const Haccp = {
  async listPhotos() {
    return apiFetch<HaccpPhotoMeta[]>('/haccp/photos');
  },

  async getPhoto(id: string) {
    return apiFetch<HaccpPhotoFull>(`/haccp/photos/${id}`);
  },

  async uploadPhoto(imageUri: string, name?: string) {
    const fd = await uriToFormData(imageUri, 'image');
    if (name) fd.append('name', name);
    return apiUpload<HaccpPhotoMeta>('/haccp/photos', fd);
  },

  async deletePhoto(id: string) {
    return apiFetch<{ deleted: string }>(`/haccp/photos/${id}`, { method: 'DELETE' });
  },

  async getAlerts() {
    return apiFetch<PriceAlert[]>('/haccp/alerts');
  },
};

// ─── HEALTH ──────────────────────────────────────────────

export async function checkHealth() {
  return apiFetch<{ status: string; version: string; gemini: boolean }>('/health');
}

// ─── HELPERS ─────────────────────────────────────────────

async function uriToFormData(uri: string, fieldName: string): Promise<FormData> {
  const fd = new FormData();
  (fd as any).append(fieldName, {
    uri,
    name: 'image.jpg',
    type: 'image/jpeg',
  });
  return fd;
}