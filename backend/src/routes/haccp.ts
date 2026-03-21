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
    .select('id, name, date, storage_path, created_at, dlc_active, dlc_date, dlc_nom, lot')
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
    return { id: p.id, name: p.name, date: p.date, uri, dlc_active: p.dlc_active || false, dlc_date: p.dlc_date || null, dlc_nom: p.dlc_nom || null, lot: p.lot || null };
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
// Supprimer l'alerte DLC liée
  await supabase.from('dlc_products').delete().eq('photo_id', req.params.id);
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

// GET /api/haccp/dlc-alerts
router.get('/dlc-alerts', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userIds = await getRestaurantUserIds(req.userId!);
    const { data, error } = await supabase
      .from('dlc_products')
      .select('*, haccp_photos(id, name, storage_path)')
      .in('user_id', userIds)
      .order('dlc', { ascending: true });

    if (error) throw error;

    const alerts = await Promise.all((data ?? []).map(async (d: any) => {
      let photoUri = null;
      if (d.haccp_photos?.storage_path) {
        const { data: signed } = await supabase.storage
          .from('haccp-photos')
          .createSignedUrl(d.haccp_photos.storage_path, 3600);
        photoUri = signed?.signedUrl ?? null;
      }

      const dlcDate = new Date(d.dlc);
      const now = new Date();
      const diffDays = Math.ceil((dlcDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: d.id,
        nom: d.nom,
        dlc: d.dlc,
        days_left: diffDays,
        photo_id: d.photo_id,
        photo_uri: photoUri,
        photo_name: d.haccp_photos?.name || null,
      };
    }));

    res.json({ ok: true, data: alerts });
  } catch (err) {
    console.error('[/haccp/dlc-alerts]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// POST /api/haccp/photos/:id/toggle-dlc
router.post('/photos/:id/toggle-dlc', requireAuth, async (req: AuthRequest, res: Response) => {
  const { active } = req.body;
  const photoId = req.params.id;
  const userId = req.userId!;

  try {
    // Récupérer la photo
    const { data: photo, error: photoErr } = await supabase
      .from('haccp_photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (photoErr || !photo) {
      res.status(404).json({ ok: false, error: 'Photo non trouvée' });
      return;
    }

    // Mettre à jour le flag
    await supabase.from('haccp_photos').update({ dlc_active: active }).eq('id', photoId);

    if (active && photo.dlc_date) {
      // Supprimer d'abord si existe
      await supabase.from('dlc_products').delete().eq('photo_id', photoId);
      // Puis insérer
      const { error: insertErr } = await supabase.from('dlc_products').insert({
        user_id: userId,
        nom: photo.dlc_nom || photo.name || 'Produit',
        dlc: photo.dlc_date,
        lot: photo.lot || '',
        photo_id: photoId,
      });
      if (insertErr) {
        console.error('[toggle-dlc] Insert error:', insertErr);
        res.status(500).json({ ok: false, error: insertErr.message });
        return;
      }
    } else {
      const { error: delErr } = await supabase.from('dlc_products').delete().eq('photo_id', photoId);
      if (delErr) console.error('[toggle-dlc] Delete error:', delErr);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[/haccp/photos/toggle-dlc]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

export default router;
