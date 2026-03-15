import { Router, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── GET /api/fridges ── Lister les frigos de l'utilisateur
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('fridges')
      .select('*')
      .eq('user_id', req.userId!)
      .eq('actif', true)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ ok: true, data: data ?? [] });
  } catch (err) {
    console.error('[GET /fridges]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/fridges ── Créer un frigo
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { nom, type, temp_min, temp_max } = req.body;
  
  if (!nom || !type) {
    return res.status(400).json({ ok: false, error: 'Nom et type requis' });
  }

  // Valeurs par défaut selon le type
  const defaultMin = type === 'negatif' ? -25 : 0;
  const defaultMax = type === 'negatif' ? -15 : 4;

  try {
    const { data, error } = await supabase
      .from('fridges')
      .insert({
        user_id: req.userId!,
        nom,
        type,
        temp_min: temp_min ?? defaultMin,
        temp_max: temp_max ?? defaultMax,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[POST /fridges]', err);
    res.status(500).json({ ok: false, error: 'Erreur création frigo' });
  }
});

// ─── DELETE /api/fridges/:id ── Supprimer un frigo (désactivation douce)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('fridges')
      .update({ actif: false })
      .eq('id', req.params.id)
      .eq('user_id', req.userId!);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /fridges]', err);
    res.status(500).json({ ok: false, error: 'Erreur suppression' });
  }
});

export default router;