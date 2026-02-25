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

    // --- ÉTAPE 1 : PRÉ-TRAITEMENT SHARP ---
    // On prépare l'image pour que les LED deviennent noires sur fond blanc
    const processedBuffer = await sharp(req.file.buffer)
      .resize(800) // On réduit pour la vitesse
      .greyscale() // Noir et blanc
      .negate()    // Inversion (LED rouges/vertes deviennent foncées sur fond clair)
      .threshold(140) // On élimine les reflets gris pour ne garder que le texte
      .toBuffer();

    // --- ÉTAPE 2 : APPEL GOOGLE VISION ---
    const visionKey = getVisionApiKey();
    const b64 = processedBuffer.toString('base64');
    const rawText = await callVision(visionKey, b64);
    
    let temperature: number | null = null;
    let confidence = 95;
    let method = 'Google Vision (Optimisé)';

    // Nettoyage et extraction Vision
    const cleanText = rawText.replace(/\s+/g, '').replace(',', '.');
    const candidates = (cleanText.match(/-?\d+\.\d+|-?\d{2,3}/g) ?? []).map(val => {
      let v = val;
      if (/^-?\d{3}$/.test(v)) v = v.slice(0, -1) + '.' + v.slice(-1); // ex: 285 -> 28.5
      return parseFloat(v);
    }).filter(n => n >= -40 && n <= 60);

    temperature = candidates[0] ?? null;

    // --- ÉTAPE 3 : FALLBACK GEMINI (si Vision a échoué) ---
    if (temperature === null) {
      console.log("[Scan] Vision a échoué, basculement sur Gemini...");
      method = 'Gemini 1.5 Flash (Fallback)';
      const apiKey = await getApiKey(userId);
      const originalB64 = req.file.buffer.toString('base64'); // On envoie l'image originale à Gemini
      
      const rawGemini = await enqueueGemini(() => 
        callGemini(apiKey, PROMPTS.temperature, originalB64, req.file!.mimetype)
      );
      const dataG = parseGeminiJSON<GeminiTemperature>(rawGemini);
      
      temperature = dataG?.temperature ?? null;
      confidence = dataG?.confiance ?? 50;
    }

    if (temperature === null) {
      return res.status(422).json({ ok: false, error: 'Lecture impossible, même avec Gemini.' });
    }

    // --- ÉTAPE 4 : UPDATE QUOTA & RÉPONSE ---
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