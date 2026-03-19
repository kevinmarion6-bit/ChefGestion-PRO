// backend/src/routes/settings.ts
// ─── ROUTES RÉGLAGES UTILISATEUR ─────────────────────────
// Push token + préférences de notification

import { Router, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── POST /api/settings/push-token ───────────────────────
// Enregistre le token push Expo de l'utilisateur
router.post('/push-token', requireAuth, async (req: AuthRequest, res: Response) => {
  const { push_token } = req.body;
  const userId = req.userId!;

  if (!push_token) {
    return res.status(400).json({ ok: false, error: 'Token requis' });
  }

  try {
    await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        push_token,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    res.json({ ok: true });
  } catch (err) {
    console.error('[/settings/push-token]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/settings/push-preference ──────────────────
// Active/désactive les rappels de température
router.post('/push-preference', requireAuth, async (req: AuthRequest, res: Response) => {
  const { push_temp_reminder } = req.body;
  const userId = req.userId!;

  try {
    await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        push_temp_reminder: !!push_temp_reminder,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    res.json({ ok: true });
  } catch (err) {
    console.error('[/settings/push-preference]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── GET /api/settings ───────────────────────────────────
// Récupère les réglages de l'utilisateur
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', req.userId!)
      .single();

    res.json({ ok: true, data: data || { push_temp_reminder: false } });
  } catch (err) {
    console.error('[/settings GET]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

export default router;