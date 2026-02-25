// ─── SHARED TYPES ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  apiKey: string;
  createdAt: string;
}

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  apiKey: string;
}

export interface Product {
  nom: string;
  unite: string;
  prix_ht: number;
  quantite: number;
  total_ht: number;
}

export interface Invoice {
  id: string;
  userId: string;
  date: string;
  supplier: string;
  products: Product[];
  total_ht: number;
  total_ttc: number;
  tva: number;
  createdAt: string;
}

export interface PriceEntry {
  price: number;
  unit: string;
  supplier: string;
  date: string;
}

export interface PriceAlert {
  id: string;
  userId: string;
  product: string;
  oldPrice: number;
  newPrice: number;
  supplier: string;
  createdAt: string;
}

export interface SupplierProduct {
  name: string;
  unit: string;
  price: number;
}

export interface Supplier {
  name: string;
  products: SupplierProduct[];
  createdAt: string;
}

export interface HaccpPhoto {
  id: string;
  userId: string;
  name: string;
  date: string;
  uri: string; // base64 data URI stocké côté serveur
}

// ─── DB structure per user ────────────────────────────────
export interface UserDB {
  invoices: Invoice[];
  priceDB: Record<string, PriceEntry>;
  alerts: PriceAlert[];
  suppliers: Record<string, Supplier>;
  haccpPhotos: HaccpPhoto[];
}

// ─── API responses ────────────────────────────────────────
export interface ApiSuccess<T = unknown> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  details?: unknown;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ─── Gemini parsed types ──────────────────────────────────
export interface GeminiInvoice {
  fournisseur: string;
  numero_facture: string;
  date: string;
  produits: Product[];
  total_ht: number;
  tva: number;
  total_ttc: number;
  erreur?: string;
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

export interface GeminiRecettes {
  recettes: {
    nom: string;
    description: string;
    ingredients_principaux: string[];
    difficulte: string;
    temps_preparation: string;
    suggestion_prix: number;
  }[];
}
