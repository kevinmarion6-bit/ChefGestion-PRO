import { Router, Response } from 'express';
import multer from 'multer';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getRestaurantUserIds } from '../services/restaurantHelper';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/haccp/photos
router.get('/photos', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('haccp_photos')
    .select('id, name, date, storage_path, created_at')
    .in('user_id', await getRestaurantUserIds(req.userId!))
    .order('created_at', { ascending: false });

  if (error) { res.status(500).json({ ok: false, error: error.message }); return; }

  // Générer des URLs signées pour chaque photo
  const photos = await Promise.all((data ?? []).map(async (p) => {
    let uri = null;
    if (p.storage_path) {
      const { data: signedUrl } = await supabase.storage
        .from('haccp-photos')
        .createSignedUrl(p.storage_path, 3600); // valide 1h
      uri = signedUrl?.signedUrl ?? null;
    }
    return { id: p.id, name: p.name, date: p.date, uri };
  }));

  res.json({ ok: true, data: photos });
});

// POST /api/haccp/photos
router.post('/photos', requireAuth, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ ok: false, error: 'Image requise' }); return; }
  try {
    const name = (req.body.name as string) || `Étiquette_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}`;
    const storagePath = `${req.userId}/${Date.now()}.jpg`;

    // Upload dans Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from('haccp-photos')
      .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

    if (uploadErr) { res.status(500).json({ ok: false, error: uploadErr.message }); return; }

    // Enregistrer la référence en base
    const { data: photo, error: dbErr } = await supabase
      .from('haccp_photos')
      .insert({ user_id: req.userId!, name, date: new Date().toLocaleDateString('fr-FR'), storage_path: storagePath })
      .select('id, name, date')
      .single();

    if (dbErr || !photo) { res.status(500).json({ ok: false, error: dbErr?.message ?? 'Erreur insertion' }); return; }
    res.status(201).json({ ok: true, data: photo });
  } catch (err) {
    console.error('[/haccp/photos POST]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// DELETE /api/haccp/photos/:id
router.delete('/photos/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  // Récupérer le chemin storage avant suppression
  const { data: photo } = await supabase
    .from('haccp_photos').select('storage_path').eq('id', req.params.id).eq('user_id', req.userId!).single();

  if (photo?.storage_path) {
    await supabase.storage.from('haccp-photos').remove([photo.storage_path]);
  }

  const { error } = await supabase
    .from('haccp_photos').delete().eq('id', req.params.id).eq('user_id', req.userId!);

  if (error) { res.status(500).json({ ok: false, error: error.message }); return; }
  res.json({ ok: true, data: { deleted: req.params.id } });
});

// GET /api/haccp/alerts
router.get('/alerts', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('price_alerts')
    .select('*')
    .in('user_id', await getRestaurantUserIds(req.userId!))
    .order('created_at', { ascending: false });

  if (error) { res.status(500).json({ ok: false, error: error.message }); return; }
  res.json({ ok: true, data });
});

export default router;
