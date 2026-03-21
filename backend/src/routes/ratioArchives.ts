import { Router, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getRestaurantUserIds } from '../services/restaurantHelper';

const router = Router();

// GET /api/ratio-archives
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userIds = await getRestaurantUserIds(req.userId!);
    const { data, error } = await supabase
      .from('ratio_archives')
      .select('*')
      .in('user_id', userIds)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw error;

    const archives = (data ?? []).map(a => {
      const { data: urlData } = supabase.storage
        .from('haccp-archives')
        .getPublicUrl(a.storage_path);
      const expiresAt = new Date(a.expires_at);
      const now = new Date();
      const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        ...a,
        download_url: urlData.publicUrl,
        days_until_expiry: daysLeft,
        is_expiring_soon: daysLeft <= 7,
        month_label: new Date(a.year, a.month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      };
    });

    res.json({ ok: true, data: archives });
  } catch (err) {
    console.error('[/ratio-archives GET]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// POST /api/ratio-archives/generate
router.post('/generate', requireAuth, async (req: AuthRequest, res: Response) => {
  const { year, month } = req.body;
  const userId = req.userId!;

  if (!year || !month) return res.status(400).json({ ok: false, error: 'Année et mois requis' });

  try {
    const userIds = await getRestaurantUserIds(userId);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;
    const monthLabel = new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    // Récupérer les factures du mois
    const { data: invoices } = await supabase
      .from('invoices')
      .select('*, invoice_products(*)')
      .in('user_id', userIds)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: true });

    const invoiceList = invoices ?? [];
    const totalHT = invoiceList.reduce((s, inv) => s + (inv.total_ht || 0), 0);
    const totalTTC = invoiceList.reduce((s, inv) => s + (inv.total_ttc || 0), 0);
    const totalTVA = invoiceList.reduce((s, inv) => s + (inv.tva || 0), 0);
    const totalProducts = invoiceList.reduce((s, inv) => s + (inv.invoice_products?.length || 0), 0);

    // Récupérer alertes prix du mois
    const { data: alerts } = await supabase
      .from('price_alerts')
      .select('*')
      .in('user_id', userIds)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`);

    // Infos restaurant + chef
    let restName = '';
    let chefName = 'Le Chef';
    const { data: profile } = await supabase.from('profiles').select('name, restaurant_id').eq('id', userId).single();
    if (profile?.name) chefName = profile.name;
    if (profile?.restaurant_id) {
      const { data: rest } = await supabase.from('restaurants').select('nom').eq('id', profile.restaurant_id).single();
      if (rest?.nom) restName = rest.nom;
    }

    const logoUrl = 'https://osnckjlgqqawcgduideb.supabase.co/storage/v1/object/public/assets/logo.png';
    const exportDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const yearNum = new Date().getFullYear();

    // Tableau factures
    const invoiceRows = invoiceList.map((inv, idx) => {
      const bgColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAF7';
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #EEE;background-color:${bgColor};font-size:11px;">${inv.date || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #EEE;background-color:${bgColor};font-size:11px;">${inv.supplier || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #EEE;background-color:${bgColor};font-size:11px;text-align:center;">${inv.invoice_products?.length || 0}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #EEE;background-color:${bgColor};font-size:11px;text-align:right;color:#A07D1C;font-weight:bold;">${(inv.total_ht || 0).toFixed(2)} €</td>
        <td style="padding:6px 10px;border-bottom:1px solid #EEE;background-color:${bgColor};font-size:11px;text-align:right;">${(inv.total_ttc || 0).toFixed(2)} €</td>
      </tr>`;
    }).join('');

    // Alertes prix
    const alertRows = (alerts ?? []).map((a, idx) => {
      const bgColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFAF7';
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #EEE;background-color:${bgColor};font-size:11px;">${a.product || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #EEE;background-color:${bgColor};font-size:11px;">${a.supplier || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #EEE;background-color:${bgColor};font-size:11px;text-align:right;text-decoration:line-through;color:#888;">${(a.old_price || 0).toFixed(2)} €</td>
        <td style="padding:6px 10px;border-bottom:1px solid #EEE;background-color:${bgColor};font-size:11px;text-align:right;color:#F87171;font-weight:bold;">${(a.new_price || 0).toFixed(2)} €</td>
      </tr>`;
    }).join('');

    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Helvetica,Arial,sans-serif;color:#2C2C2C;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="height:1122px;"><tr><td style="vertical-align:top;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111;">
  <tr><td style="padding:14px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="90" style="vertical-align:middle;"><img src="${logoUrl}" width="90" height="90" /></td>
        <td style="padding-left:24px;vertical-align:middle;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr><td style="font-size:14px;letter-spacing:5px;text-transform:uppercase;color:#D4AF37;padding-bottom:4px;">✦ ChefGestion Pro ✦</td></tr>
            ${restName ? `<tr><td style="font-size:24px;color:#F5F5DC;font-weight:bold;">🍽️ ${restName}</td></tr>` : ''}
            <tr><td style="font-size:14px;color:#F5F5DC;padding-top:5px;">👨‍🍳 &nbsp; <span style="color:#D4AF37;font-weight:bold;">Chef</span> &nbsp; ${chefName}</td></tr>
          </table>
        </td>
        <td style="vertical-align:middle;text-align:right;">
          <span style="font-size:9px;color:#8A7A60;text-transform:uppercase;letter-spacing:1px;">Exporté le</span>
          <br/><span style="font-size:14px;color:#8A7A60;">📅 ${exportDate}</span>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:3px;background-color:#D4AF37;"></td></tr></table>

<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="text-align:center;padding:10px 40px 0;">
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="border:2px solid #D4AF37;">
      <tr><td style="padding:10px 20px;text-align:center;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#A07D1C;text-align:center;padding-bottom:6px;">📊 Ratios & Indicateurs Financiers</td></tr>
          <tr><td style="font-size:22px;color:#1A1A1A;font-weight:bold;text-align:center;text-transform:capitalize;">${monthLabel}</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:12px 40px;">
    <table width="100%" cellpadding="4" cellspacing="0" border="0">
      <tr>
        <td width="25%" style="vertical-align:top;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;"><tr><td style="text-align:center;padding:8px 6px;background-color:#FAFAF7;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;text-align:center;padding-bottom:4px;">Factures</td></tr><tr><td style="font-size:20px;color:#A07D1C;font-weight:bold;text-align:center;">🧾 ${invoiceList.length}</td></tr></table></td></tr></table></td>
        <td width="25%" style="vertical-align:top;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;"><tr><td style="text-align:center;padding:8px 6px;background-color:#FAFAF7;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;text-align:center;padding-bottom:4px;">Total HT</td></tr><tr><td style="font-size:20px;color:#A07D1C;font-weight:bold;text-align:center;">💶 ${totalHT.toFixed(0)}€</td></tr></table></td></tr></table></td>
        <td width="25%" style="vertical-align:top;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;"><tr><td style="text-align:center;padding:8px 6px;background-color:#FAFAF7;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;text-align:center;padding-bottom:4px;">Produits</td></tr><tr><td style="font-size:20px;color:#A07D1C;font-weight:bold;text-align:center;">📦 ${totalProducts}</td></tr></table></td></tr></table></td>
        <td width="25%" style="vertical-align:top;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;"><tr><td style="text-align:center;padding:8px 6px;background-color:#FAFAF7;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;text-align:center;padding-bottom:4px;">Alertes Prix</td></tr><tr><td style="font-size:20px;color:#A07D1C;font-weight:bold;text-align:center;">⚠️ ${(alerts ?? []).length}</td></tr></table></td></tr></table></td>
      </tr>
    </table>
  </td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:0 40px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
      <tr>
        <td width="26" style="font-size:16px;vertical-align:middle;">🧾</td>
        <td style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#1A1A1A;font-weight:bold;vertical-align:middle;white-space:nowrap;padding-right:10px;">Factures du mois</td>
        <td width="100%" style="vertical-align:middle;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-bottom:1px solid #D4AF37;height:1px;"></td></tr></table></td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-collapse:collapse;">
      <tr>
        <th style="background-color:#111;color:#D4AF37;padding:6px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:left;border:1px solid #E8E0D0;">Date</th>
        <th style="background-color:#111;color:#D4AF37;padding:6px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:left;border:1px solid #E8E0D0;">Fournisseur</th>
        <th style="background-color:#111;color:#D4AF37;padding:6px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:center;border:1px solid #E8E0D0;">Produits</th>
        <th style="background-color:#111;color:#D4AF37;padding:6px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:right;border:1px solid #E8E0D0;">HT</th>
        <th style="background-color:#111;color:#D4AF37;padding:6px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:right;border:1px solid #E8E0D0;">TTC</th>
      </tr>
      ${invoiceRows}
      <tr><td colspan="3" style="padding:8px 10px;text-align:right;font-weight:bold;font-size:12px;border-top:2px solid #D4AF37;background-color:#FBF8F0;">TOTAL</td>
        <td style="padding:8px 10px;text-align:right;color:#A07D1C;font-weight:bold;font-size:13px;border-top:2px solid #D4AF37;background-color:#FBF8F0;">${totalHT.toFixed(2)} €</td>
        <td style="padding:8px 10px;text-align:right;font-size:12px;border-top:2px solid #D4AF37;background-color:#FBF8F0;">${totalTTC.toFixed(2)} €</td>
      </tr>
    </table>
  </td></tr>
</table>

${(alerts ?? []).length > 0 ? `
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:0 40px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
      <tr>
        <td width="26" style="font-size:16px;vertical-align:middle;">⚠️</td>
        <td style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#1A1A1A;font-weight:bold;vertical-align:middle;white-space:nowrap;padding-right:10px;">Alertes de prix</td>
        <td width="100%" style="vertical-align:middle;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-bottom:1px solid #D4AF37;height:1px;"></td></tr></table></td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-collapse:collapse;">
      <tr>
        <th style="background-color:#111;color:#D4AF37;padding:6px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;text-align:left;border:1px solid #E8E0D0;">Produit</th>
        <th style="background-color:#111;color:#D4AF37;padding:6px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;text-align:left;border:1px solid #E8E0D0;">Fournisseur</th>
        <th style="background-color:#111;color:#D4AF37;padding:6px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;text-align:right;border:1px solid #E8E0D0;">Ancien</th>
        <th style="background-color:#111;color:#D4AF37;padding:6px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;text-align:right;border:1px solid #E8E0D0;">Nouveau</th>
      </tr>
      ${alertRows}
    </table>
  </td></tr>
</table>` : ''}

</td></tr>
<tr><td style="vertical-align:bottom;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111;">
  <tr>
    <td width="33%" style="padding:14px 40px;font-size:10px;color:#8A7A60;font-style:italic;">📄 Document généré automatiquement</td>
    <td width="34%" style="padding:14px 0;font-size:10px;letter-spacing:3px;color:#D4AF37;text-transform:uppercase;text-align:center;">✦ ChefGestion Pro ✦</td>
    <td width="33%" style="padding:14px 40px;font-size:10px;color:#8A7A60;text-align:right;">© ${yearNum} — Tous droits réservés</td>
  </tr>
</table>
</td></tr>
</table>
</body></html>`;

    const htmlBuffer = Buffer.from(fullHtml, 'utf-8');
    const storagePath = `${userId}/${year}-${String(month).padStart(2, '0')}-ratios-archive.html`;
    const expiresAt = new Date(year + 1, month - 1, 1);

    await supabase.storage.from('haccp-archives').upload(storagePath, htmlBuffer, { contentType: 'text/html', upsert: true });

    const { data: archive, error: insertErr } = await supabase
      .from('ratio_archives')
      .upsert({
        user_id: userId,
        restaurant_id: profile?.restaurant_id || null,
        year, month,
        storage_path: storagePath,
        file_size: Math.round(htmlBuffer.length / 1024),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'user_id,year,month' })
      .select().single();

    if (insertErr) throw insertErr;
    res.json({ ok: true, data: archive });
  } catch (err) {
    console.error('[/ratio-archives/generate]', err);
    res.status(500).json({ ok: false, error: 'Erreur génération' });
  }
});

export default router;