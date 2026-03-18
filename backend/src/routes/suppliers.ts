import { Router, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getRestaurantUserIds } from '../services/restaurantHelper';

const router = Router();

// GET /api/suppliers
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*, supplier_products(*)')
    .in('user_id', await getRestaurantUserIds(req.userId!))
    .order('name');

  if (error) { res.status(500).json({ ok: false, error: error.message }); return; }

  // Transformer en Record<name, supplier> pour compatibilité avec le frontend
  const result: Record<string, any> = {};
  (data ?? []).forEach(s => {
    result[s.name] = { name: s.name, products: s.supplier_products ?? [], createdAt: s.created_at };
  });

  res.json({ ok: true, data: result });
});

// POST /api/suppliers
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ ok: false, error: 'Nom requis' }); return; }

  const { data, error } = await supabase
    .from('suppliers')
    .upsert({ user_id: req.userId!, name }, { onConflict: 'user_id,name' })
    .select()
    .single();

  if (error) { res.status(500).json({ ok: false, error: error.message }); return; }
  res.json({ ok: true, data });
});

// DELETE /api/suppliers/:name
router.delete('/:name', requireAuth, async (req: AuthRequest, res: Response) => {
  const name = decodeURIComponent(req.params.name);
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('user_id', req.userId!)
    .eq('name', name);

  if (error) { res.status(500).json({ ok: false, error: error.message }); return; }
  res.json({ ok: true, data: { deleted: name } });
});

// GET /api/suppliers/bestprices
router.get('/bestprices', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('supplier_products')
    .select('name, unit, price, suppliers!inner(name)')
    .in('user_id', await getRestaurantUserIds(req.userId!));

  if (error) { res.status(500).json({ ok: false, error: error.message }); return; }

  // Grouper par produit
  const pm: Record<string, { sup: string; price: number; unit: string }[]> = {};
  (data ?? []).forEach((p: any) => {
    if (!pm[p.name]) pm[p.name] = [];
    pm[p.name].push({ sup: p.suppliers?.name ?? '', price: p.price, unit: p.unit });
  });

  const compared = Object.entries(pm)
    .filter(([, v]) => v.length >= 2)
    .map(([product, offers]) => ({ product, offers: offers.sort((a, b) => a.price - b.price) }));

  res.json({ ok: true, data: compared });
});

export default router;
