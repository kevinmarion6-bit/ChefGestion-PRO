import { Router, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/invoices
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_products(*)')
    .eq('user_id', req.userId!)
    .order('created_at', { ascending: false });

  if (error) { res.status(500).json({ ok: false, error: error.message }); return; }

  // Reformater pour correspondre à l'ancienne interface
  const invoices = (data ?? []).map(inv => ({
    ...inv,
    products: inv.invoice_products ?? [],
  }));

  res.json({ ok: true, data: invoices });
});

// GET /api/invoices/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_products(*)')
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)
    .single();

  if (error || !data) { res.status(404).json({ ok: false, error: 'Facture introuvable' }); return; }
  res.json({ ok: true, data: { ...data, products: data.invoice_products ?? [] } });
});

// DELETE /api/invoices/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId!);

  if (error) { res.status(500).json({ ok: false, error: error.message }); return; }
  res.json({ ok: true, data: { deleted: req.params.id } });
});

export default router;
