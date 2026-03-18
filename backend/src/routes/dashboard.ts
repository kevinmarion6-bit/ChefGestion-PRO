import { Router, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getRestaurantUserIds } from '../services/restaurantHelper';

const router = Router();

// GET /api/dashboard
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.userId!;
  const userIds = await getRestaurantUserIds(uid);
  try {
    const [
      { data: invoices },
      { count: alertsCount },
      { count: productsCount },
      { count: suppliersCount },
      { data: recentAlerts },
    ] = await Promise.all([
      supabase.from('invoices').select('id, supplier, date, total_ht, total_ttc, created_at').in('user_id', userIds).order('created_at', { ascending: false }).limit(5),
      supabase.from('price_alerts').select('*', { count: 'exact', head: true }).in('user_id', userIds),
      supabase.from('price_db').select('*', { count: 'exact', head: true }).in('user_id', userIds),
      supabase.from('suppliers').select('*', { count: 'exact', head: true }).in('user_id', userIds),
      supabase.from('price_alerts').select('*').in('user_id', userIds).order('created_at', { ascending: false }).limit(5),
    ]);

    // Calcul coût total et marge estimée
    const { data: allInvoices } = await supabase.from('invoices').select('total_ht').in('user_id', userIds);
    const totalCoutHT = (allInvoices ?? []).reduce((s, i) => s + (i.total_ht ?? 0), 0);
    const facturesCount = allInvoices?.length ?? 0;
    const margeEstimee = facturesCount > 0 ? Math.max(55, 75 - facturesCount * 0.3) : null;

    // ─── ALERTES TEMPÉRATURE (aujourd'hui) ─────────────────
    const today = new Date().toISOString().split('T')[0];
    const { data: todayTemps } = await supabase
      .from('temperature_logs')
      .select('*')
      .in('user_id', userIds)
      .eq('date', today);

    const tempAlerts: any[] = [];
    for (const log of (todayTemps ?? [])) {
      const val = log.valeur;
      if (val === null || val === undefined) continue;
      const fridgeName = log.fridge_nom || 'Sans équipement';
      const isFreezer = fridgeName.toLowerCase().includes('congél') ||
                        fridgeName.toLowerCase().includes('surgél') ||
                        fridgeName.toLowerCase().includes('négatif');
      
      let isNonConforme = false;
      if (isFreezer) {
        // Congélateur : doit être ≤ -18°C
        isNonConforme = val > -18;
      } else {
        // Frigo positif : doit être entre 0°C et 4°C
        isNonConforme = val < 0 || val > 4;
      }
      
      if (isNonConforme) {
        tempAlerts.push({
          fridge: fridgeName,
          valeur: val,
          periode: log.periode,
          isFreezer,
        });
      }
    }

    // ─── ALERTES DLC (J-3) ─────────────────────────────────
    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    const threeDaysStr = inThreeDays.toISOString().split('T')[0];

    let dlcAlerts: any[] = [];
    try {
      const { data: dlcProducts } = await supabase
        .from('dlc_products')
        .select('*')
        .in('user_id', userIds)
        .lte('dlc', threeDaysStr)
        .gte('dlc', today)
        .order('dlc', { ascending: true });
      dlcAlerts = (dlcProducts ?? []).map(p => ({
        id: p.id,
        nom: p.nom,
        dlc: p.dlc,
        lot: p.lot || '',
        joursRestants: Math.ceil((new Date(p.dlc).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)),
      }));
    } catch (e) {
      // Table peut ne pas encore exister
      console.log('[Dashboard] dlc_products table not found, skipping');
    }

    // ─── STATUT RELEVÉS TEMPÉRATURE ────────────────────────
    const now = new Date();
    const currentHour = now.getHours();
    let currentService: 'MIDI' | 'SOIR';
    if (currentHour >= 7 && currentHour < 16) {
      currentService = 'MIDI';
    } else {
      currentService = 'SOIR';
    }

    const { data: fridges } = await supabase
      .from('fridges')
      .select('id, nom')
      .in('user_id', userIds);

    const fridgeCount = (fridges ?? []).length;
    const todayLogs = (todayTemps ?? []).filter(l => l.periode === currentService);
    const fridgesWithTemp = new Set(todayLogs.map(l => l.fridge_id).filter(Boolean));
    const tempCheckStatus = {
      currentService,
      totalFridges: fridgeCount,
      completedFridges: fridgesWithTemp.size,
      isComplete: fridgeCount > 0 ? fridgesWithTemp.size >= fridgeCount : todayLogs.length > 0,
      missingFridges: (fridges ?? [])
        .filter(f => !fridgesWithTemp.has(f.id))
        .map(f => f.nom),
    };

    res.json({
      ok: true,
      data: {
        kpis: {
          totalCoutHT,
          margeEstimee,
          facturesCount,
          alertsCount: alertsCount ?? 0,
          productsCount: productsCount ?? 0,
          suppliersCount: suppliersCount ?? 0,
        },
        recentInvoices: (invoices ?? []).map(inv => ({ ...inv, products: [] })),
        recentAlerts: (recentAlerts ?? []).map(a => ({
          id: a.id, product: a.product,
          oldPrice: a.old_price, newPrice: a.new_price,
          supplier: a.supplier, createdAt: a.created_at,
        })),
        // ─── NOUVELLES DONNÉES ───────────────────────────
        tempAlerts,
        dlcAlerts,
        tempCheckStatus,
      },
    });
  } catch (err) {
    console.error('[/dashboard]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// DELETE /api/dashboard/data — effacer toutes les données utilisateur
router.delete('/data', requireAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.userId!;
  try {
    await Promise.all([
      supabase.from('invoices').delete().eq('user_id', uid),
      supabase.from('price_db').delete().eq('user_id', uid),
      supabase.from('price_alerts').delete().eq('user_id', uid),
      supabase.from('suppliers').delete().eq('user_id', uid),
      supabase.from('haccp_photos').delete().eq('user_id', uid),
    ]);
    res.json({ ok: true, data: { cleared: true } });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

export default router;
