import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { callGemini, callVision, enqueueGemini, PROMPTS, parseGeminiJSON } from '../services/gemini';
import { GeminiInvoice, GeminiTemperature, GeminiCarte } from '../types';
import { getRestaurantUserIds } from '../services/restaurantHelper';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ✅ Simplifié : uniquement la clé Render, plus de fallback utilisateur
function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY ?? '';
  if (!key) console.warn('[WARN] GEMINI_API_KEY manquante dans les variables d\'environnement Render !');
  return key;
}

function getVisionApiKey(): string {
  return process.env.GOOGLE_VISION_KEY ?? '';
}

// ─── POST /api/scan/invoice ───────────────────────────────
router.post('/invoice', requireAuth, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ ok: false, error: 'Image requise' }); return; }
  try {
    const apiKey = getApiKey();
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

    // --- ÉTAPE 1 : MONTAGE MULTI-TRAITEMENTS ---
    const baseImg = sharp(req.file.buffer).resize(1000);
    const metadata = await baseImg.metadata();
    const h = metadata.height || 600;
    const w = metadata.width || 600;

    // Version A : Négatif + Seuil (idéal pour LED rouge/orange sur fond noir)
    const thresholdLayer = await sharp(req.file.buffer)
      .resize(1000)
      .grayscale()
      .negate()
      .threshold(140)
      .toBuffer();

    // Version B : Contraste fort (pour LED bleue/blanche)
    const contrastLayer = await sharp(req.file.buffer)
      .resize(1000)
      .grayscale()
      .linear(2.5, -80)
      .toBuffer();

    // Version C : Extraction du signe moins (bord gauche agrandi)
    const leftCrop = await sharp(req.file.buffer)
      .resize(1000)
      .extract({ left: 0, top: 0, width: Math.floor(w * 0.35), height: h })
      .resize(400, h)
      .grayscale()
      .negate()
      .threshold(120)
      .toBuffer();

    const compositeBuffer = await baseImg
      .extend({
        bottom: h * 3,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .composite([
        { input: thresholdLayer, top: h, left: 0 },
        { input: contrastLayer, top: h * 2, left: 0 },
        { input: leftCrop, top: h * 3, left: 0 },
      ])
      .toBuffer();

    // --- ÉTAPE 2 : APPEL VISION ---
    const visionKey = getVisionApiKey();
    const b64 = compositeBuffer.toString('base64');
    const rawText = await callVision(visionKey, b64);

    console.log('[Vision] Texte extrait :', rawText);

    let temperature: number | null = null;
    let confidence = 95;
    let method = 'Google Vision (Montage Hybride)';

    // --- ÉTAPE 3 : LOGIQUE DE PARSING AMÉLIORÉE ---
    const normalized = rawText
      .replace(/,/g, '.')
      .replace(/[°℃]/g, '')
      .replace(/(\d)\s+(\d)/g, '$1.$2')
      .trim();

    console.log('[Parsing] Texte normalisé :', normalized);

    const cleanedForParsing = normalized
      .replace(/-\s*0+(\d+)/g, '-$1')
      .replace(/[^0-9.\-]/g, ' ')
      .trim();

    console.log('[Parsing] Après nettoyage :', cleanedForParsing);

    const matches = cleanedForParsing.match(/-?\d+\.\d+|-?\d+/g) ?? [];

    const candidates = matches
      .map(m => {
        let v = m;
        const isNeg = v.startsWith('-');
        const digitsOnly = v.replace('-', '').replace('.', '');

        if (digitsOnly.length === 3 && !v.includes('.')) {
          const withDecimal = parseFloat((isNeg ? '-' : '') + digitsOnly.substring(0, 2) + '.' + digitsOnly[2]);
          const withoutDecimal = parseFloat(v);

          if (withoutDecimal >= 10 && withoutDecimal <= 35) {
            v = String(withoutDecimal);
          } else if (!isNaN(withDecimal) && withDecimal >= -40 && withDecimal <= 70) {
            v = String(withDecimal);
          }
        }

        return parseFloat(v);
      })
      .filter(n => !isNaN(n) && n >= -40 && n <= 70);

    console.log('[Parsing] Candidats valides :', candidates);

    const negatives = candidates.filter(n => n < 0);
    const decimals  = candidates.filter(n => !Number.isInteger(n) && n >= 0);
    const integers  = candidates.filter(n => Number.isInteger(n) && n >= 0);

    temperature = negatives[0] ?? decimals[0] ?? integers[0] ?? null;

    // --- ÉTAPE 4 : FALLBACK GEMINI (Si Vision a échoué) ---
    if (temperature === null) {
      console.log('[Scan] Vision Montage échoué, passage à Gemini...');
      method = 'Gemini 1.5 Flash (Fallback)';
      const apiKey = getApiKey();
      const originalB64 = req.file.buffer.toString('base64');

      const rawGemini = await enqueueGemini(() =>
        callGemini(apiKey, PROMPTS.temperature, originalB64, req.file!.mimetype)
      );
      const dataG = parseGeminiJSON<GeminiTemperature>(rawGemini);

      temperature = dataG?.temperature ?? null;
      confidence  = dataG?.confiance ?? 50;
    }

    if (temperature === null) {
      return res.status(422).json({ ok: false, error: 'Lecture impossible.' });
    }

    // --- ÉTAPE 5 : MISE À JOUR QUOTA & ENREGISTREMENT ---
    const { fridge_id } = req.body;

    await supabase.from('profiles')
      .update({ vision_scans_today: currentScans + 1, last_vision_reset: today })
      .eq('id', userId);

    // Calcul de la date et de la période de service
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const currentHour = now.getHours();
    let serviceDate = new Date(now);
    let periode: 'MIDI' | 'SOIR';

    if (currentHour >= 2 && currentHour < 16) {
  periode = 'MIDI';
} else {
  periode = 'SOIR';
  if (currentHour >= 0 && currentHour < 2) {
    serviceDate.setDate(serviceDate.getDate() - 1);
  }
}

    const dateString = serviceDate.toISOString().split('T')[0];

    // Récupère le nom du frigo si fourni
    let fridge_nom = '';
    if (fridge_id) {
      const { data: fridge } = await supabase
        .from('fridges')
        .select('nom')
        .eq('id', fridge_id)
        .single();
      fridge_nom = fridge?.nom ?? '';
    }

    await supabase
      .from('temperature_logs')
      .upsert({
        user_id:       userId,
        date:          dateString,
        periode:       periode,
        valeur:        temperature,
        fridge_id:     fridge_id || null,
        fridge_nom:    fridge_nom,
      }, { onConflict: 'user_id,fridge_id,date,periode' });

    let fridge_temp_min: number | undefined;
    let fridge_temp_max: number | undefined;
    if (fridge_id) {
      const { data: fridgeData } = await supabase
        .from('fridges')
        .select('temp_min, temp_max')
        .eq('id', fridge_id)
        .single();
      if (fridgeData) {
        fridge_temp_min = fridgeData.temp_min;
        fridge_temp_max = fridgeData.temp_max;
      }
    }

    res.json({
      ok: true,
      data: {
        temperature,
        unite: '°C',
        confiance: confidence,
        count: currentScans + 1,
        fridge_temp_min,
        fridge_temp_max,
      }
    });

  } catch (err) {
    console.error('[/scan/temperature]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/scan/haccp-update ───────────────────────────
router.post('/haccp-update', requireAuth, async (req: AuthRequest, res: Response) => {
  const { date, periode, valeur, fridge_id, commentaire } = req.body;
  const userId = req.userId!;
 
  try {
    // Récupère le nom du frigo si fourni
    let fridge_nom = '';
    if (fridge_id) {
      const { data: fridge } = await supabase
        .from('fridges')
        .select('nom')
        .eq('id', fridge_id)
        .single();
      fridge_nom = fridge?.nom ?? '';
    }
 
    const { error } = await supabase
      .from('temperature_logs')
      .upsert({
        user_id: userId,
        date,
        periode,
        valeur,
        fridge_id: fridge_id || null,
        fridge_nom,
        commentaire: commentaire || '',
      }, { onConflict: 'user_id,fridge_id,date,periode' });
 
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erreur mise à jour' });
  }
});

// ─── POST /api/scan/carte ─────────────────────────────────
router.post('/carte', requireAuth, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ ok: false, error: 'Image requise' }); return; }
  try {
    const apiKey = getApiKey();
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
      .from('price_db').select('product_nom').in('user_id', await getRestaurantUserIds(req.userId!)).limit(15);
    const productList = (products ?? []).map((p: any) => p.product_nom).join(', ') || 'bœuf, bar, crème fraîche, beurre, échalotes';

    const apiKey = getApiKey();
    const raw = await enqueueGemini(() => callGemini(apiKey, PROMPTS.recipes(style, categorie, productList)));
console.log('[/scan/recipes] Réponse brute Gemini:', raw?.substring(0, 500));
const data = parseGeminiJSON<{ recettes: unknown[] }>(raw);
if (!data) {
  console.error('[/scan/recipes] Parsing échoué. Réponse complète:', raw);
  res.status(422).json({ ok: false, error: 'Génération échouée' });
  return;
}
    res.json({ ok: true, data: data.recettes });
  } catch (err) {
    console.error('[/scan/recipes]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── GET /api/scan/haccp-logs ───────────────────────────────
router.get('/haccp-logs', requireAuth, async (req: AuthRequest, res: Response) => {
  const { year, month } = req.query;

  if (!year || !month) {
    return res.status(400).json({ ok: false, error: 'Année et mois requis' });
  }

  try {
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const endDate = `${year}-${month}-${lastDay}`;

    const { data, error } = await supabase
      .from('temperature_logs')
      .select('*')
      .in('user_id', await getRestaurantUserIds(req.userId!))
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[/haccp-logs]', err);
    res.status(500).json({ ok: false, error: 'Erreur récupération logs' });
  }
});

// ─── POST /api/scan/haccp-label ────────────────────────────
// Scan d'étiquette HACCP avec extraction DLC par Gemini
router.post('/haccp-label', requireAuth, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ ok: false, error: 'Image requise' }); return; }
  try {
    const apiKey = getApiKey();
    const b64 = req.file.buffer.toString('base64');
 
    const prompt = `Tu es un expert en lecture d'étiquettes alimentaires HACCP.
Analyse cette image d'étiquette et extrais les informations suivantes.
Réponds UNIQUEMENT en JSON valide (sans markdown) :
{"nom":"nom du produit","dlc":"YYYY-MM-DD","lot":"numéro de lot si visible","fournisseur":"si visible"}
Si la DLC n'est pas lisible, mets null pour dlc.`;
 
    const raw = await enqueueGemini(() => callGemini(apiKey, prompt, b64, req.file!.mimetype));
    const data = parseGeminiJSON<{ nom: string; dlc: string | null; lot: string; fournisseur: string }>(raw);
 
    if (!data) {
      res.status(422).json({ ok: false, error: 'Lecture étiquette échouée' });
      return;
    }
 
    // Sauvegarder le produit DLC si une date est extraite
    if (data.dlc) {
      await supabase.from('dlc_products').insert({
        user_id: req.userId!,
        nom: data.nom || 'Produit inconnu',
        dlc: data.dlc,
        lot: data.lot || '',
      });
    }
 
    // Aussi uploader la photo HACCP comme avant
    const storagePath = `${req.userId}/${Date.now()}.jpg`;
    await supabase.storage
      .from('haccp-photos')
      .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
 
    await supabase
      .from('haccp_photos')
      .insert({
        user_id: req.userId!,
        name: data.nom || `Étiquette_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}`,
        date: new Date().toLocaleDateString('fr-FR'),
        storage_path: storagePath,
      });
 
    res.json({
      ok: true,
      data: {
        label: data,
        saved: !!data.dlc,
      },
    });
  } catch (err) {
    console.error('[/scan/haccp-label]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

export default router;
