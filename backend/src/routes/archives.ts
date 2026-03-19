// backend/src/routes/archives.ts
// ─── ROUTES ARCHIVES MENSUELLES HACCP ────────────────────
// Génération PDF, listing, téléchargement, suppression auto 1 an

import { Router, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getRestaurantUserIds } from '../services/restaurantHelper';
import { generateArchivePdf } from '../services/archiveGenerator';

const router = Router();

// ─── GET /api/archives ───────────────────────────────────
// Liste toutes les archives de l'utilisateur
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userIds = await getRestaurantUserIds(req.userId!);

    const { data, error } = await supabase
      .from('haccp_archives')
      .select('*')
      .in('user_id', userIds)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw error;

    // Ajouter l'URL de téléchargement pour chaque archive
    const archives = (data ?? []).map(a => {
      const { data: urlData } = supabase.storage
        .from('haccp-archives')
        .getPublicUrl(a.storage_path);

      const expiresAt = new Date(a.expires_at);
      const now = new Date();
      const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isExpiringSoon = daysLeft <= 7;

      return {
        ...a,
        download_url: urlData.publicUrl,
        days_until_expiry: daysLeft,
        is_expiring_soon: isExpiringSoon,
        month_label: new Date(a.year, a.month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      };
    });

    res.json({ ok: true, data: archives });
  } catch (err) {
    console.error('[/archives GET]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// ─── POST /api/archives/generate ─────────────────────────
// Génère l'archive du mois précédent (appelé auto ou manuellement)
router.post('/generate', requireAuth, async (req: AuthRequest, res: Response) => {
  const { year, month } = req.body;
  const userId = req.userId!;

  if (!year || !month) {
    return res.status(400).json({ ok: false, error: 'Année et mois requis' });
  }

  try {
    // Vérifier si l'archive existe déjà
    const { data: existing } = await supabase
      .from('haccp_archives')
      .select('id')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .single();

    if (existing) {
      return res.status(409).json({ ok: false, error: 'Archive déjà existante pour ce mois.' });
    }

    // Générer le PDF
    const result = await generateArchivePdf(userId, year, month);

    res.json({ ok: true, data: result });
  } catch (err) {
    console.error('[/archives/generate]', err);
    res.status(500).json({ ok: false, error: 'Erreur génération archive' });
  }
});

// ─── GET /api/archives/check-previous ────────────────────
// Vérifie si le mois précédent est complet et si une archive existe
router.get('/check-previous', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const prevMonth = now.getMonth(); // 0-based, donc c'est déjà le mois précédent
    const prevYear = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevMonthNum = prevMonth === 0 ? 12 : prevMonth;

    const userIds = await getRestaurantUserIds(req.userId!);

    // 1. Vérifier si archive existe
    const { data: archive } = await supabase
      .from('haccp_archives')
      .select('id')
      .eq('user_id', req.userId!)
      .eq('year', prevYear)
      .eq('month', prevMonthNum)
      .single();

    // 2. Compter les relevés du mois précédent
    const daysInPrevMonth = new Date(prevYear, prevMonthNum, 0).getDate();
    const startDate = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}-01`;
    const endDate = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}-${daysInPrevMonth}`;

    const { data: fridges } = await supabase
      .from('fridges')
      .select('id')
      .in('user_id', userIds)
      .eq('actif', true);

    const fridgeCount = fridges?.length ?? 0;

    const { data: logs } = await supabase
      .from('temperature_logs')
      .select('id')
      .in('user_id', userIds)
      .gte('date', startDate)
      .lte('date', endDate);

    const logCount = logs?.length ?? 0;
    // Relevés attendus : nb frigos × nb jours × 2 services (MIDI + SOIR)
    const expectedLogs = fridgeCount * daysInPrevMonth * 2;
    const completionRate = expectedLogs > 0 ? Math.round((logCount / expectedLogs) * 100) : 0;
    const isComplete = completionRate >= 95; // tolérance 5%

    const monthLabel = new Date(prevYear, prevMonthNum - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    res.json({
      ok: true,
      data: {
        year: prevYear,
        month: prevMonthNum,
        month_label: monthLabel,
        has_archive: !!archive,
        is_complete: isComplete,
        completion_rate: completionRate,
        log_count: logCount,
        expected_logs: expectedLogs,
        fridge_count: fridgeCount,
      },
    });
  } catch (err) {
    console.error('[/archives/check-previous]', err);
    res.status(500).json({ ok: false, error: 'Erreur vérification' });
  }
});

export default router;