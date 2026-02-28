import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── SIGNUP ──────────────────────────────────────────────
router.post('/signup', async (req: Request, res: Response) => {
  const { name, email, password, apiKey = '' } = req.body;
  if (!name || !email || !password) { res.status(400).json({ ok: false, error: 'Nom, e-mail et mot de passe requis' }); return; }
  if (password.length < 8) { res.status(400).json({ ok: false, error: 'Mot de passe : minimum 8 caractères' }); return; }

  try {
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

// ─── LOGIN ───────────────────────────────────────────────
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

// ─── FORGOT PASSWORD (NOUVEAU) ───────────────────────────
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ ok: false, error: 'E-mail requis' }); return; }

  try {
    // Demande à Supabase d'envoyer le mail de récup (Lien ou Code selon tes réglages)
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    
    if (error) {
      // Pour éviter le "user enumeration", on pourrait renvoyer OK même si l'email n'existe pas
      res.status(400).json({ ok: false, error: error.message });
      return;
    }

    res.json({ ok: true, data: { message: 'Lien de récupération envoyé' } });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── RESET PASSWORD (NOUVEAU) ─────────────────────────────
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, password } = req.body; // 'token' peut être le code reçu par mail
  if (!token || !password) { res.status(400).json({ ok: false, error: 'Données manquantes' }); return; }

  try {
    // 1. On vérifie le code/token et on crée une session temporaire
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email: req.body.email, // Optionnel selon ta config Supabase
      token,
      type: 'recovery'
    });

    if (verifyErr) { res.status(400).json({ ok: false, error: 'Code invalide ou expiré' }); return; }

    // 2. On met à jour le mot de passe
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    
    if (updateErr) throw updateErr;

    res.json({ ok: true, data: { ok: true } });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── ME & API KEY ────────────────────────────────────────
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

router.patch('/apikey', requireAuth, async (req: AuthRequest, res: Response) => {
  const { apiKey } = req.body;
  if (typeof apiKey !== 'string') { res.status(400).json({ ok: false, error: 'apiKey requis' }); return; }
  const { error } = await supabase.from('profiles').update({ api_key: apiKey }).eq('id', req.userId!);
  if (error) { res.status(500).json({ ok: false, error: error.message }); return; }
  res.json({ ok: true, data: { apiKey } });
});

export default router;