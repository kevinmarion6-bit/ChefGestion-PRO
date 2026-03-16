import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const REDIRECT_URL = process.env.AUTH_REDIRECT_URL || 'https://auth.expo.fyi';

// ─── SIGNUP ───────────────────────────────────────────────
router.post('/signup', async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ ok: false, error: 'Nom, e-mail et mot de passe requis' });
  }
  if (password.length < 8) {
    return res.status(400).json({ ok: false, error: 'Mot de passe : minimum 8 caractères' });
  }

  try {
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: REDIRECT_URL,
      },
    });

    if (signUpErr) {
      const msg = signUpErr.message.toLowerCase().includes('already')
        ? 'Un compte existe déjà avec cet e-mail'
        : signUpErr.message;
      return res.status(409).json({ ok: false, error: msg });
    }

    // CAS 1 : Confirmation par mail active
    if (data.user && !data.session) {
      return res.status(201).json({
        ok: true,
        data: {
          confirmRequired: true,
          message: 'Lien de confirmation envoyé par e-mail.',
          user: { id: data.user.id, name, email },
        },
      });
    }

    // CAS 2 : Inscription directe (mail désactivé dans Supabase)
    return res.status(201).json({
      ok: true,
      data: {
        token: data.session?.access_token,
        user: { id: data.user?.id, name, email },
      },
    });

  } catch (err) {
    console.error('[/auth/signup] Erreur:', err);
    return res.status(500).json({ ok: false, error: 'Erreur serveur lors de l\'inscription' });
  }
});

// ─── LOGIN ────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'E-mail et mot de passe requis' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        return res.status(403).json({ ok: false, error: 'Veuillez confirmer votre e-mail avant de vous connecter.' });
      }
      return res.status(401).json({ ok: false, error: 'E-mail ou mot de passe incorrect' });
    }

    const { data: profile } = await supabase
      .from('profiles').select('name').eq('id', data.user.id).single();

    return res.json({
      ok: true,
      data: {
        token: data.session.access_token,
        user: {
          id:    data.user.id,
          name:  profile?.name ?? '',
          email: data.user.email ?? '',
        },
      },
    });
  } catch (err) {
    console.error('[/auth/login] Erreur:', err);
    return res.status(500).json({ ok: false, error: 'Erreur serveur lors de la connexion' });
  }
});

// ─── FORGOT & RESET ──────────────────────────────────────
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, error: 'E-mail requis' });

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return res.status(400).json({ ok: false, error: error.message });
    return res.json({ ok: true, message: 'Code de récupération envoyé' });
  } catch (err) { return res.status(500).json({ ok: false, error: 'Erreur serveur' }); }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const { email, token, password } = req.body;
  if (!email || !token || !password) return res.status(400).json({ ok: false, error: 'Données manquantes' });

  try {
    const { data, error: verifyErr } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
    if (verifyErr || !data.user) return res.status(400).json({ ok: false, error: 'Code invalide ou expiré' });

    const { error: updateErr } = await supabase.auth.admin.updateUserById(data.user.id, { password });
    if (updateErr) return res.status(500).json({ ok: false, error: 'Échec de la mise à jour' });

    return res.json({ ok: true, message: 'Mot de passe mis à jour' });
  } catch (err) { return res.status(500).json({ ok: false, error: 'Erreur serveur' }); }
});

// ─── ME ──────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', req.userId!).single();
    if (!profile) return res.status(404).json({ ok: false, error: 'Profil introuvable' });
    return res.json({ ok: true, data: profile });
  } catch (err) { return res.status(500).json({ ok: false, error: 'Erreur serveur' }); }
});

export default router;
