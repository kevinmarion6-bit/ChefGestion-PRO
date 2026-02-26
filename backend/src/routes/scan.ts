import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { callGemini, callVision, enqueueGemini, PROMPTS, parseGeminiJSON } from '../services/gemini';
import { GeminiInvoice, GeminiTemperature, GeminiCarte } from '../types';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function getApiKey(userId: string): Promise<string> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const { data } = await supabase.from('profiles').select('api_key').eq('id', userId).single();
  return data?.api_key ?? '';
}

function getVisionApiKey(): string {
  return process.env.GOOGLE_VISION_KEY ?? '';
}

// ─── POST /api/scan/invoice ───────────────────────────────
router.post('/invoice', requireAuth, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ ok: false, error: 'Image requise' }); return; }
  try {
    const apiKey = await getApiKey(req.userId!);
    const b64 = req.file.buffer.toString('base64');
    const raw = await enqueueGemini(() => callGemini(apiKey, PROMPTS.invoice, b64, req.file!.mimetype));
    const data = parseGeminiJSON<GeminiInvoice>(raw);

    if (!data || data.erreur) {
      res.status(422).json({ ok: false, error: data?.erreur ?? 'OCR échoué' });
      return;
    }

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        user_id: req.userId!,
        date: data.date || new Date().toLocaleDateString('fr-FR'),
        supplier: data.fournisseur || 'Inconnu',
        total_ht: data.total_ht || 0,
        total_ttc: data.total_ttc || 0,
        tva: data.tva || 0,
      })
      .select()
      .single();

    if (invErr || !invoice) { res.status(500).json({ ok: false, error: invErr?.message ?? 'Erreur insertion facture' }); return; }

    const products = (data.produits || []).map(p => ({
      invoice_id: invoice.id,
      user_id: req.userId!,
      nom: p.nom,
      unite: p.unite,
      prix_ht: p.prix_ht,
      quantite: p.quantite,
      total_ht: p.total_ht,
    }));

    if (products.length > 0) {
      await supabase.from('invoice_products').insert(products);
    }

    const priceAlerts: any[] = [];

    for (const p of data.produits || []) {
      const key = p.nom.toLowerCase().trim();

      const { data: existing } = await supabase
        .from('price_db')
        .select('price, supplier')
        .eq('user_id', req.userId!)
        .eq('product_key', key)
        .single();

      if (existing && Math.abs(p.prix_ht - existing.price) > 0.001) {
        const { data: alert } = await supabase
          .from('price_alerts')
          .insert({
            user_id: req.userId!,
            product: p.nom,
            old_price: existing.price,
            new_price: p.prix_ht,
            supplier: data.fournisseur,
          })
          .select()
          .single();
        if (alert) priceAlerts.push({ id: alert.id, product: p.nom, oldPrice: existing.price, newPrice: p.prix_ht, supplier: data.fournisseur });
      }

      await supabase.from('price_db').upsert({
        user_id: req.userId!,
        product_key: key,
        product_nom: p.nom,
        price: p.prix_ht,
        unit: p.unite,
        supplier: data.fournisseur,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,product_key' });
    }

    if (data.fournisseur) {
      const { data: sup } = await supabase
        .from('suppliers')
        .upsert({ user_id: req.userId!, name: data.fournisseur }, { onConflict: 'user_id,name' })
        .select()
        .single();

      if (sup) {
        for (const p of data.produits || []) {
          await supabase.from('supplier_products').upsert({
            supplier_id: sup.id,
            user_id: req.userId!,
            name: p.nom,
            unit: p.unite,
            price: p.prix_ht,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'supplier_id,name' });
        }
      }
    }

    res.json({ ok: true, data: { invoice: { ...invoice, products }, priceAlerts } });
  } catch (err) {
    console.error('[/scan/invoice]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/scan/temperature ───────────────────────────
router.post('/temperature', requireAuth, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'Image requise' });

  try {
    const userId = req.userId!;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    const today = new Date().toISOString().split('T')[0];
    let currentScans = profile?.vision_scans_today || 0;
    if (profile?.last_vision_reset !== today) currentScans = 0;

    if (currentScans >= 33) {
      return res.status(429).json({ ok: false, error: 'Quota Google Vision atteint (33/33).' });
    }

    // --- ÉTAPE 1 : CRÉATION DU MONTAGE (2-en-1 pour 1 seul crédit) ---
    // On redimensionne l'originale pour limiter le poids de la requête
    const baseImg = sharp(req.file.buffer).resize(800);
    const metadata = await baseImg.metadata();
    const height = metadata.height || 600;

    // On prépare le calque HSL (Saturation pour LED Rouges/Bleues)
    const hslLayer = await sharp(req.file.buffer)
      .resize(800)
      .modulate({ brightness: 1.2 })
      .toColorspace('hsl')
      .extractChannel(1) // Saturation
      .threshold(140)
      .toBuffer();

    // On fusionne : Original en haut, HSL juste en dessous
    const compositeBuffer = await baseImg
      .extend({
        bottom: height,
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      })
      .composite([{
        input: hslLayer,
        top: height,
        left: 0
      }])
      .toBuffer();

    // --- ÉTAPE 2 : UN SEUL APPEL VISION (1 Crédit Google) ---
    const visionKey = getVisionApiKey();
    const b64 = compositeBuffer.toString('base64');
    const rawText = await callVision(visionKey, b64);
    
    console.log('[Vision] Texte extrait (Montage) :', rawText);

    let temperature: number | null = null;
    let confidence = 95;
    let method = 'Google Vision (Montage Hybride)';

    // Nettoyage et extraction
    const normalized = rawText
      .replace(/-\s+(\d)/g, '-$1') 
      .replace(/[°℃]/g, '')
      .replace(/[A-Za-z]/g, ' ') 
      .replace(/\s+/g, ' ')
      .trim();

    const allMatches = normalized.match(/-?\d+[.,]\d+|-?\d+/g) ?? [];

    const candidates = allMatches
      .map(m => {
        let v = m.replace(',', '.');
        const digitsOnly = v.replace('-', '').replace('.', '');
        // Correction "Décimale manquante" (ex: 285 -> 28.5)
        if (digitsOnly.length === 3 && !v.includes('.')) {
          v = v.slice(0, -1) + '.' + v.slice(-1);
        }
        return parseFloat(v);
      })
      .filter(n => !isNaN(n) && n >= -35 && n <= 45);

    // Priorité aux nombres avec décimales (souvent la sonde réelle)
    temperature = candidates.find(n => !Number.isInteger(n)) ?? candidates[0] ?? null;

    // --- ÉTAPE 3 : FALLBACK GEMINI (Seulement si Vision a tout raté) ---
    if (temperature === null) {
      console.log('[Scan] Vision Montage échoué, passage à Gemini...');
      method = 'Gemini 1.5 Flash (Fallback)';
      const apiKey = await getApiKey(userId);
      const originalB64 = req.file.buffer.toString('base64');

      const rawGemini = await enqueueGemini(() =>
        callGemini(apiKey, PROMPTS.temperature, originalB64, req.file!.mimetype)
      );
      const dataG = parseGeminiJSON<GeminiTemperature>(rawGemini);

      temperature = dataG?.temperature ?? null;
      confidence = dataG?.confiance ?? 50;
    }

    if (temperature === null) {
      return res.status(422).json({ ok: false, error: 'Lecture impossible.' });
    }

    // --- ÉTAPE 4 : MISE À JOUR QUOTA ---
    await supabase.from('profiles')
      .update({ vision_scans_today: currentScans + 1, last_vision_reset: today })
      .eq('id', userId);

    res.json({
      ok: true,
      data: {
        temperature,
        unite: '°C',
        type_afficheur: method,
        confiance: confidence,
        count: currentScans + 1,
      }
    });

  } catch (err) {
    console.error('[/scan/temperature]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/scan/carte ─────────────────────────────────
router.post('/carte', requireAuth, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ ok: false, error: 'Image requise' }); return; }
  try {
    const apiKey = await getApiKey(req.userId!);
    const b64 = req.file.buffer.toString('base64');
    const raw = await enqueueGemini(() => callGemini(apiKey, PROMPTS.carte, b64, req.file!.mimetype));
    const data = parseGeminiJSON<GeminiCarte>(raw);
    if (!data) { res.status(422).json({ ok: false, error: 'OCR carte échoué' }); return; }
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[/scan/carte]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/scan/recipes ───────────────────────────────
router.post('/recipes', requireAuth, async (req: AuthRequest, res: Response) => {
  const { style = 'bistronomique', categorie = 'plat' } = req.body;
  try {
    const { data: products } = await supabase
      .from('price_db').select('product_nom').eq('user_id', req.userId!).limit(15);
    const productList = (products ?? []).map((p: any) => p.product_nom).join(', ') || 'bœuf, bar, crème fraîche, beurre, échalotes';

    const apiKey = await getApiKey(req.userId!);
    const raw = await enqueueGemini(() => callGemini(apiKey, PROMPTS.recipes(style, categorie, productList)));
    const data = parseGeminiJSON<{ recettes: unknown[] }>(raw);
    if (!data) { res.status(422).json({ ok: false, error: 'Génération échouée' }); return; }
    res.json({ ok: true, data: data.recettes });
  } catch (err) {
    console.error('[/scan/recipes]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

export default router;