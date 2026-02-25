import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  const { name, email, password, apiKey = '' } = req.body;
  if (!name || !email || !password) { res.status(400).json({ ok: false, error: 'Nom, e-mail et mot de passe requis' }); return; }
  if (password.length < 8) { res.status(400).json({ ok: false, error: 'Mot de passe : minimum 8 caractères' }); return; }

  try {
    // Créer le compte
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email, password,
      email_confirm: true,
      user_metadata: { name, api_key: apiKey },
    });
    if (createErr) {
      const msg = createErr.message.toLowerCase().includes('already')
        ? 'Un compte existe déjà avec cet e-mail'
        : createErr.message;
      res.status(409).json({ ok: false, error: msg });
      return;
    }

    // Connexion immédiate pour obtenir le token
    const { data: session, error: sessErr } = await supabase.auth.signInWithPassword({ email, password });
    if (sessErr || !session.session) { res.status(500).json({ ok: false, error: 'Compte créé mais connexion échouée' }); return; }

    res.status(201).json({
      ok: true,
      data: {
        token: session.session.access_token,
        user: { id: created.user!.id, name, email, apiKey },
      },
    });
  } catch (err) {
    console.error('[/auth/signup]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ ok: false, error: 'E-mail et mot de passe requis' }); return; }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) { res.status(401).json({ ok: false, error: 'E-mail ou mot de passe incorrect' }); return; }

    const { data: profile } = await supabase
      .from('profiles').select('name, api_key').eq('id', data.user.id).single();

    res.json({
      ok: true,
      data: {
        token: data.session.access_token,
        user: {
          id: data.user.id,
          name: profile?.name ?? '',
          email: data.user.email ?? '',
          apiKey: profile?.api_key ?? '',
        },
      },
    });
  } catch (err) {
    console.error('[/auth/login]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [{ data: profile }, { data: userInfo }] = await Promise.all([
      supabase.from('profiles').select('name, api_key').eq('id', req.userId!).single(),
      supabase.auth.admin.getUserById(req.userId!),
    ]);
    if (!profile) { res.status(404).json({ ok: false, error: 'Profil introuvable' }); return; }
    res.json({ ok: true, data: { id: req.userId, name: profile.name, email: userInfo?.user?.email ?? '', apiKey: profile.api_key ?? '' } });
  } catch { res.status(500).json({ ok: false, error: 'Erreur serveur' }); }
});

// PATCH /api/auth/apikey
router.patch('/apikey', requireAuth, async (req: AuthRequest, res: Response) => {
  const { apiKey } = req.body;
  if (typeof apiKey !== 'string') { res.status(400).json({ ok: false, error: 'apiKey requis' }); return; }
  const { error } = await supabase.from('profiles').update({ api_key: apiKey }).eq('id', req.userId!);
  if (error) { res.status(500).json({ ok: false, error: error.message }); return; }
  res.json({ ok: true, data: { apiKey } });
});

export default router;
