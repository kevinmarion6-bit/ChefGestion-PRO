-- ═══════════════════════════════════════════════════════════
-- ChefGestion Pro — Schéma Supabase
-- Collez ce script dans SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════

-- ─── EXTENSION UUID ──────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS (profils publics, liés à auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  api_key     TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVOICES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  supplier    TEXT NOT NULL DEFAULT '',
  total_ht    NUMERIC(10,2) DEFAULT 0,
  total_ttc   NUMERIC(10,2) DEFAULT 0,
  tva         NUMERIC(10,2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVOICE PRODUCTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id  UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  unite       TEXT DEFAULT 'kg',
  prix_ht     NUMERIC(10,4) DEFAULT 0,
  quantite    NUMERIC(10,4) DEFAULT 0,
  total_ht    NUMERIC(10,4) DEFAULT 0
);

-- ─── PRICE DATABASE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.price_db (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL,           -- nom produit en lowercase
  product_nom TEXT NOT NULL,
  price       NUMERIC(10,4) NOT NULL,
  unit        TEXT DEFAULT 'kg',
  supplier    TEXT DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_key)
);

-- ─── PRICE ALERTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product     TEXT NOT NULL,
  old_price   NUMERIC(10,4) NOT NULL,
  new_price   NUMERIC(10,4) NOT NULL,
  supplier    TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SUPPLIERS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suppliers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- ─── SUPPLIER PRODUCTS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  unit        TEXT DEFAULT 'kg',
  price       NUMERIC(10,4) DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, name)
);

-- ─── HACCP PHOTOS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.haccp_photos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  date        TEXT NOT NULL,
  storage_path TEXT,                   -- chemin dans Supabase Storage
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) — chaque user ne voit que ses données
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_db         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haccp_photos     ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles: own data" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Invoices
CREATE POLICY "invoices: own data" ON public.invoices
  FOR ALL USING (auth.uid() = user_id);

-- Invoice products
CREATE POLICY "invoice_products: own data" ON public.invoice_products
  FOR ALL USING (auth.uid() = user_id);

-- Price DB
CREATE POLICY "price_db: own data" ON public.price_db
  FOR ALL USING (auth.uid() = user_id);

-- Price alerts
CREATE POLICY "price_alerts: own data" ON public.price_alerts
  FOR ALL USING (auth.uid() = user_id);

-- Suppliers
CREATE POLICY "suppliers: own data" ON public.suppliers
  FOR ALL USING (auth.uid() = user_id);

-- Supplier products
CREATE POLICY "supplier_products: own data" ON public.supplier_products
  FOR ALL USING (auth.uid() = user_id);

-- HACCP photos
CREATE POLICY "haccp_photos: own data" ON public.haccp_photos
  FOR ALL USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- AUTO-CRÉATION DU PROFIL à l'inscription
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, api_key)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'api_key', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════
-- BUCKET STORAGE pour les photos HACCP
-- ═══════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('haccp-photos', 'haccp-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "haccp storage: own files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'haccp-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
