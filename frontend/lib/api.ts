import { getToken } from './auth';

const BASE_URL = (() => {
  try {
    const { API_BASE_URL } = require('./config');
    return API_BASE_URL;
  } catch {
    return 'https://chefgestion-pro.onrender.com/api';
  }
})();

// ─── FETCH HELPER ────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}, isAuthAction = false): Promise<T> {
  const token = await getToken();
  const controller = new AbortController();
  const timeout = isAuthAction ? 55000 : 55000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    };

    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.body instanceof FormData) delete headers['Content-Type'];

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    const json = await res.json();

    if (res.ok || res.status === 201) {
      return (json.data ? json.data : json) as T;
    }

    throw new ApiError(json.error || json.message || 'Erreur inconnue', res.status);

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
  // ✅ apiKey supprimé — géré uniquement côté serveur via GEMINI_API_KEY
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

export interface TempAlert {
  fridge: string;
  valeur: number;
  periode: string;
  isFreezer: boolean;
}
 
export interface DlcAlert {
  id: string;
  nom: string;
  dlc: string;
  lot: string;
  joursRestants: number;
}
 
export interface TempCheckStatus {
  currentService: 'MIDI' | 'SOIR';
  totalFridges: number;
  completedFridges: number;
  isComplete: boolean;
  missingFridges: string[];
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
  tempAlerts: { fridge: string; valeur: number; periode: string; isFreezer: boolean }[];
  dlcAlerts: { id: string; nom: string; dlc: string; lot: string; joursRestants: number }[];
  tempCheckStatus: {
    currentService: 'MIDI' | 'SOIR';
    totalFridges: number;
    completedFridges: number;
    isComplete: boolean;
    missingFridges: string[];
  };
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
  // ✅ Plus de paramètre apiKey
  async signup(name: string, email: string, password: string) {
    const res = await apiFetch<any>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }, true);

    return {
      token: res?.session?.access_token || res?.token || res?.data?.session?.access_token,
      user:  res?.user || res?.data?.user,
      confirmRequired: res?.confirmRequired || res?.data?.confirmRequired || false,
    };
  },

  async login(email: string, password: string) {
    const res = await apiFetch<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, true);
    return {
      token: res?.token || res?.session?.access_token || res?.data?.session?.access_token,
      user:  res?.user || res?.data?.user,
    };
  },

  async me() {
    return apiFetch<UserPublic>('/auth/me');
  },

  async forgotPassword(email: string) {
    return apiFetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(email: string, token: string, password: string) {
    return apiFetch<{ ok: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, token, password }),
    });
  },
  // ✅ updateApiKey supprimé
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


  async haccpLabel(imageUri: string): Promise<{ label: any; saved: boolean }> {
    const fd = await uriToFormData(imageUri, 'image');
    return apiUpload('/scan/haccp-label', fd);
  },
 
  async exportHaccpPdf(year: number, month: number): Promise<{ url: string }> {
    return apiFetch('/scan/haccp-export', {
     method: 'POST',
     body: JSON.stringify({ year, month }),
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

// ─── RESTAURANT ──────────────────────────────────────────

export interface RestaurantMember {
  id: string;
  name: string;
  role: string;
  joinedAt: string;
  isMe: boolean;
}

export interface RestaurantData {
  id: string;
  nom: string;
  adresse: string;
  telephone: string;
  siret: string;
  isOwner: boolean;
  members: RestaurantMember[];
  createdAt: string;
}

export const Restaurant = {
  async get() {
    const res = await apiFetch<any>('/restaurant');
    // apiFetch retourne { ok, data } quand data est null, il faut extraire
    if (res === null || res === undefined) return null;
    if (typeof res === 'object' && 'nom' in res) return res as RestaurantData;
    if (typeof res === 'object' && res.data === null) return null;
    return res as RestaurantData | null;
  },

  async create(data: { nom: string; adresse?: string; telephone?: string; siret?: string }) {
    return apiFetch<any>('/restaurant/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async invite() {
    return apiFetch<{ code: string; expiresAt: string; restaurantName: string }>('/restaurant/invite', {
      method: 'POST',
    });
  },

  async join(code: string) {
    return apiFetch<{ restaurantId: string; restaurantName: string }>('/restaurant/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async leave() {
    return apiFetch<any>('/restaurant/leave', {
      method: 'POST',
    });
  },

  async getInviteCode() {
    return apiFetch<{ code: string }>('/restaurant/invite-code');
  },

  // C'est cette fonction précise qui corrigera ton erreur ligne 114
  async removeMember(memberId: string) {
    return apiFetch<any>(`/restaurant/members/${memberId}`, {
      method: 'DELETE',
    });
  },
};

// ─── HEALTH ──────────────────────────────────────────────

export async function checkHealth() {
  return apiFetch<{ status: string; version: string; gemini: boolean }>('/health');
}
// ═══════════════════════════════════════════════════════════
// AJOUTS POUR : frontend/lib/api.ts
// Ajouter ce bloc AVANT le commentaire "// ─── HELPERS"
// ═══════════════════════════════════════════════════════════

// ─── ARCHIVES HACCP ──────────────────────────────────────

export const Archives = {
  async list() {
    return apiFetch<any[]>('/archives');
  },

  async generate(year: number, month: number) {
    return apiFetch<any>('/archives/generate', {
      method: 'POST',
      body: JSON.stringify({ year, month }),
    });
  },

  async checkPrevious() {
    return apiFetch<{
      year: number;
      month: number;
      month_label: string;
      has_archive: boolean;
      is_complete: boolean;
      completion_rate: number;
      log_count: number;
      expected_logs: number;
      fridge_count: number;
    }>('/archives/check-previous');
  },
};

// ─── SETTINGS ────────────────────────────────────────────

export const Settings = {
  async get() {
    return apiFetch<{ push_temp_reminder: boolean; push_token?: string }>('/settings');
  },

  async savePushToken(push_token: string) {
    return apiFetch<any>('/settings/push-token', {
      method: 'POST',
      body: JSON.stringify({ push_token }),
    });
  },

  async savePushPreference(push_temp_reminder: boolean) {
    return apiFetch<any>('/settings/push-preference', {
      method: 'POST',
      body: JSON.stringify({ push_temp_reminder }),
    });
  },
};

// ─── HELPERS ─────────────────────────────────────────────

async function uriToFormData(uri: string, fieldName: string): Promise<FormData> {
  const fd = new FormData();
  const filename = uri.split('/').pop() || 'image.jpg';

  (fd as any).append(fieldName, {
    uri,
    name: filename,
    type: 'image/jpeg',
  });
  return fd;
}
