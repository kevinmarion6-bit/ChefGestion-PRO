import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── SIGNUP ──────────────────────────────────────────────
router.post('/signup', async (req: Request, res: Response) => {
  const { name, email, password, apiKey = '' } = req.body;
  if (!name || !email || !password) { 
    return res.status(400).json({ ok: false, error: 'Nom, e-mail et mot de passe requis' }); 
  }
  if (password.length < 8) { 
    return res.status(400).json({ ok: false, error: 'Mot de passe : minimum 8 caractères' }); 
  }

  try {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email, 
      password,
      email_confirm: true,
      user_metadata: { name, api_key: apiKey },
    });
    
    if (createErr) {
      const msg = createErr.message.toLowerCase().includes('already')
        ? 'Un compte existe déjà avec cet e-mail'
        : createErr.message;
      return res.status(409).json({ ok: false, error: msg });
    }

    const { data: session, error: sessErr } = await supabase.auth.signInWithPassword({ email, password });
    if (sessErr || !session.session) { 
      return res.status(500).json({ ok: false, error: 'Compte créé mais connexion échouée' }); 
    }

    res.status(201).json({
      ok: true,
      data: {
        token: session.session.access_token,
        user: { id: created.user!.id, name, email, apiKey },
      },
    });
  } catch (err) {
    console.error('[/auth/signup] Erreur:', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur lors de l\'inscription' });
  }
});

// ─── LOGIN ───────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) { 
    return res.status(400).json({ ok: false, error: 'E-mail et mot de passe requis' }); 
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) { 
      return res.status(401).json({ ok: false, error: 'E-mail ou mot de passe incorrect' }); 
    }

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
    console.error('[/auth/login] Erreur:', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur lors de la connexion' });
  }
});

// ─── FORGOT PASSWORD ─────────────────────────────────────
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) { return res.status(400).json({ ok: false, error: 'E-mail requis' }); }

  try {
    // Demande à Supabase d'envoyer le code OTP (recovery)
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    
    if (error) {
      console.error('[Supabase Forgot] Error:', error.message);
      return res.status(400).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, data: { message: 'Code de récupération envoyé' } });
  } catch (err) {
    console.error('[/auth/forgot-password] Erreur:', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── RESET PASSWORD (OPTIMISÉ) ───────────────────────────
router.post('/reset-password', async (req: Request, res: Response) => {
  const { email, token, password } = req.body; 
  
  if (!email || !token || !password) { 
    return res.status(400).json({ ok: false, error: 'E-mail, code et nouveau mot de passe requis' }); 
  }

  try {
    // 1. On vérifie le code OTP pour cet email précis
    const { data, error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'recovery' // Obligatoire pour le reset password
    });

    if (verifyErr || !data.user) { 
      console.error('[OTP Verify Error] Email:', email, 'Error:', verifyErr?.message);
      return res.status(400).json({ ok: false, error: 'Code invalide ou expiré' }); 
    }

    // 2. On met à jour le mot de passe via l'Admin API pour plus de fiabilité
    const { error: updateErr } = await supabase.auth.admin.updateUserById(
      data.user.id, 
      { password }
    );
    
    if (updateErr) {
      console.error('[Update Password Error]', updateErr.message);
      return res.status(500).json({ ok: false, error: 'Échec de la mise à jour du mot de passe' });
    }

    res.json({ ok: true, data: { ok: true, message: 'Mot de passe mis à jour' } });
  } catch (err: any) {
    console.error('[/auth/reset-password] Erreur:', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur interne' });
  }
});

// ─── ME & API KEY ────────────────────────────────────────
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [{ data: profile }, { data: userInfo }] = await Promise.all([
      supabase.from('profiles').select('name, api_key').eq('id', req.userId!).single(),
      supabase.auth.admin.getUserById(req.userId!),
    ]);
    if (!profile) { return res.status(404).json({ ok: false, error: 'Profil introuvable' }); }
    
    res.json({ 
      ok: true, 
      data: { 
        id: req.userId, 
        name: profile.name, 
        email: userInfo?.user?.email ?? '', 
        apiKey: profile.api_key ?? '' 
      } 
    });
  } catch (err) { 
    res.status(500).json({ ok: false, error: 'Erreur serveur' }); 
  }
});

router.patch('/apikey', requireAuth, async (req: AuthRequest, res: Response) => {
  const { apiKey } = req.body;
  if (typeof apiKey !== 'string') { return res.status(400).json({ ok: false, error: 'apiKey requis' }); }
  
  const { error } = await supabase.from('profiles').update({ api_key: apiKey }).eq('id', req.userId!);
  if (error) { return res.status(500).json({ ok: false, error: error.message }); }
  
  res.json({ ok: true, data: { apiKey } });
});

export default router;