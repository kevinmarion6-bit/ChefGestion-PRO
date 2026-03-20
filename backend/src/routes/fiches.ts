import { Router, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getRestaurantUserIds } from '../services/restaurantHelper';

const router = Router();

// GET /api/fiches — Lister les fiches
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userIds = await getRestaurantUserIds(req.userId!);
    const { data, error } = await supabase
      .from('fiches_techniques')
      .select('*')
      .in('user_id', userIds)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json({ ok: true, data: data ?? [] });
  } catch (err) {
    console.error('[/fiches GET]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// POST /api/fiches — Sauvegarder une fiche
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { nom, portions, pv_ttc, perte, progression, ingredients, total_ht, emoji } = req.body;

  if (!nom?.trim()) {
    return res.status(400).json({ ok: false, error: 'Nom du plat requis' });
  }

  try {
    const { data, error } = await supabase
      .from('fiches_techniques')
      .upsert({
        user_id: req.userId!,
        nom: nom.trim(),
        portions: portions || 4,
        pv_ttc: pv_ttc || 0,
        perte: perte || 2,
        progression: progression || '',
        ingredients: JSON.stringify(ingredients || []),
        total_ht: total_ht || 0,
        emoji: emoji || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,nom' })
      .select()
      .single();

    if (error) throw error;
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[/fiches POST]', err);
    res.status(500).json({ ok: false, error: 'Erreur sauvegarde' });
  }
});

// DELETE /api/fiches/:id — Supprimer une fiche
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('fiches_techniques')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId!);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[/fiches DELETE]', err);
    res.status(500).json({ ok: false, error: 'Erreur suppression' });
  }
});

export default router;