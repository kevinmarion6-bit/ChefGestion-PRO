import { Router, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

function generateInviteCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// ─── GET /api/restaurant ─────────────────────────────────
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.userId!;
  try {
    const { data: profile } = await supabase
      .from('profiles').select('restaurant_id').eq('id', uid).single();

    if (!profile?.restaurant_id) {
      return res.json({ ok: true, data: null });
    }

    const { data: restaurant } = await supabase
      .from('restaurants').select('*').eq('id', profile.restaurant_id).single();

    if (!restaurant) return res.json({ ok: true, data: null });

    const { data: members } = await supabase
      .from('restaurant_members').select('user_id, role, joined_at')
      .eq('restaurant_id', restaurant.id);

    const memberDetails = [];
    for (const m of (members ?? [])) {
      const { data: mp } = await supabase
        .from('profiles').select('name').eq('id', m.user_id).single();
      memberDetails.push({
        id: m.user_id,
        name: mp?.name || 'Inconnu',
        role: m.role,
        joinedAt: m.joined_at,
        isMe: m.user_id === uid,
      });
    }

    res.json({
      ok: true,
      data: {
        id: restaurant.id,
        nom: restaurant.nom,
        adresse: restaurant.adresse,
        telephone: restaurant.telephone,
        siret: restaurant.siret,
        isOwner: restaurant.owner_id === uid,
        members: memberDetails,
        createdAt: restaurant.created_at,
      },
    });
  } catch (err) {
    console.error('[/restaurant GET]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/restaurant/create ─────────────────────────
router.post('/create', requireAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.userId!;
  const { nom, adresse, telephone, siret } = req.body;

  if (!nom?.trim()) {
    return res.status(400).json({ ok: false, error: 'Le nom du restaurant est requis.' });
  }

  try {
    const { data: profile } = await supabase
      .from('profiles').select('restaurant_id').eq('id', uid).single();

    if (profile?.restaurant_id) {
      return res.status(400).json({ ok: false, error: 'Vous êtes déjà membre d\'un restaurant.' });
    }

    const { data: restaurant, error: restErr } = await supabase
      .from('restaurants')
      .insert({
        nom: nom.trim(),
        adresse: adresse?.trim() || '',
        telephone: telephone?.trim() || '',
        siret: siret?.trim() || '',
        owner_id: uid,
      })
      .select().single();

    if (restErr || !restaurant) {
      return res.status(500).json({ ok: false, error: restErr?.message || 'Erreur création' });
    }

    await supabase.from('restaurant_members').insert({
      restaurant_id: restaurant.id, user_id: uid, role: 'owner',
    });

    await supabase.from('profiles').update({ restaurant_id: restaurant.id }).eq('id', uid);

    res.status(201).json({ ok: true, data: restaurant });
  } catch (err) {
    console.error('[/restaurant/create]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/restaurant/invite ─────────────────────────
router.post('/invite', requireAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.userId!;

  try {
    const { data: profile } = await supabase
      .from('profiles').select('restaurant_id').eq('id', uid).single();

    if (!profile?.restaurant_id) {
      return res.status(400).json({ ok: false, error: 'Aucun restaurant associé.' });
    }

    const { data: membership } = await supabase
      .from('restaurant_members').select('role')
      .eq('restaurant_id', profile.restaurant_id).eq('user_id', uid).single();

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ ok: false, error: 'Seuls les propriétaires et admins peuvent inviter.' });
    }

    const code = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invite, error } = await supabase
      .from('restaurant_invites')
      .insert({
        restaurant_id: profile.restaurant_id,
        code,
        created_by: uid,
        expires_at: expiresAt.toISOString(),
      })
      .select().single();

    if (error) throw error;

    const { data: restaurant } = await supabase
      .from('restaurants').select('nom').eq('id', profile.restaurant_id).single();

    res.json({
      ok: true,
      data: {
        code: invite.code,
        expiresAt: invite.expires_at,
        restaurantName: restaurant?.nom || '',
      },
    });
  } catch (err) {
    console.error('[/restaurant/invite]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/restaurant/join ───────────────────────────
router.post('/join', requireAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.userId!;
  const { code } = req.body;

  if (!code?.trim()) {
    return res.status(400).json({ ok: false, error: 'Code d\'invitation requis.' });
  }

  try {
    const { data: profile } = await supabase
      .from('profiles').select('restaurant_id').eq('id', uid).single();

    if (profile?.restaurant_id) {
      return res.status(400).json({ ok: false, error: 'Vous êtes déjà membre d\'un restaurant.' });
    }

    const { data: invite } = await supabase
      .from('restaurant_invites').select('*')
      .eq('code', code.trim().toUpperCase()).is('used_by', null).single();

    if (!invite) {
      return res.status(404).json({ ok: false, error: 'Code invalide ou déjà utilisé.' });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ ok: false, error: 'Ce code a expiré.' });
    }

    const { error: memberErr } = await supabase
      .from('restaurant_members')
      .insert({ restaurant_id: invite.restaurant_id, user_id: uid, role: 'member' });

    if (memberErr) {
      if (memberErr.code === '23505') {
        return res.status(400).json({ ok: false, error: 'Déjà membre de ce restaurant.' });
      }
      throw memberErr;
    }

    await supabase.from('restaurant_invites')
      .update({ used_by: uid, used_at: new Date().toISOString() }).eq('id', invite.id);

    await supabase.from('profiles')
      .update({ restaurant_id: invite.restaurant_id }).eq('id', uid);

    const { data: restaurant } = await supabase
      .from('restaurants').select('nom').eq('id', invite.restaurant_id).single();

    res.json({
      ok: true,
      data: { restaurantId: invite.restaurant_id, restaurantName: restaurant?.nom || '' },
    });
  } catch (err) {
    console.error('[/restaurant/join]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/restaurant/leave ──────────────────────────
router.post('/leave', requireAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.userId!;

  try {
    const { data: profile } = await supabase
      .from('profiles').select('restaurant_id').eq('id', uid).single();

    if (!profile?.restaurant_id) {
      return res.status(400).json({ ok: false, error: 'Pas dans un restaurant.' });
    }

    const { data: restaurant } = await supabase
      .from('restaurants').select('owner_id').eq('id', profile.restaurant_id).single();

    if (restaurant?.owner_id === uid) {
      return res.status(400).json({ ok: false, error: 'Le propriétaire ne peut pas quitter. Transférez ou supprimez.' });
    }

    await supabase.from('restaurant_members').delete()
      .eq('restaurant_id', profile.restaurant_id).eq('user_id', uid);

    await supabase.from('profiles').update({ restaurant_id: null }).eq('id', uid);

    res.json({ ok: true });
  } catch (err) {
    console.error('[/restaurant/leave]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── DELETE /api/restaurant/members/:id ──────────────────
router.delete('/members/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.userId!;
  const memberId = req.params.id;

  try {
    // Vérifier que le demandeur est owner
    const { data: profile } = await supabase
      .from('profiles').select('restaurant_id').eq('id', uid).single();

    if (!profile?.restaurant_id) {
      return res.status(400).json({ ok: false, error: 'Pas dans un restaurant.' });
    }

    const { data: restaurant } = await supabase
      .from('restaurants').select('owner_id').eq('id', profile.restaurant_id).single();

    if (restaurant?.owner_id !== uid) {
      return res.status(403).json({ ok: false, error: 'Seul le Chef peut retirer un membre.' });
    }

    // Empêcher de se supprimer soi-même
    if (memberId === uid) {
      return res.status(400).json({ ok: false, error: 'Vous ne pouvez pas vous retirer vous-même.' });
    }

    // Vérifier que le membre est bien dans ce restaurant
    const { data: member } = await supabase
      .from('restaurant_members')
      .select('id')
      .eq('restaurant_id', profile.restaurant_id)
      .eq('user_id', memberId)
      .single();

    if (!member) {
      return res.status(404).json({ ok: false, error: 'Membre introuvable.' });
    }

    // Supprimer le membre
    await supabase.from('restaurant_members').delete()
      .eq('restaurant_id', profile.restaurant_id)
      .eq('user_id', memberId);

    // Retirer le restaurant_id du profil du membre
    await supabase.from('profiles').update({ restaurant_id: null }).eq('id', memberId);

    res.json({ ok: true });
  } catch (err) {
    console.error('[/restaurant/members DELETE]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

export default router;
