import { Router, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/dashboard
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.userId!;
  try {
    const [
      { data: invoices },
      { count: alertsCount },
      { count: productsCount },
      { count: suppliersCount },
      { data: recentAlerts },
    ] = await Promise.all([
      supabase.from('invoices').select('id, supplier, date, total_ht, total_ttc, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(5),
      supabase.from('price_alerts').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('price_db').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('price_alerts').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(5),
    ]);

    // Calcul coût total et marge estimée
    const { data: allInvoices } = await supabase.from('invoices').select('total_ht').eq('user_id', uid);
    const totalCoutHT = (allInvoices ?? []).reduce((s, i) => s + (i.total_ht ?? 0), 0);
    const facturesCount = allInvoices?.length ?? 0;
    const margeEstimee = facturesCount > 0 ? Math.max(55, 75 - facturesCount * 0.3) : null;

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
