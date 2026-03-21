import { Router, Response } from 'express';
import { supabase } from '../services/supabase';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getRestaurantUserIds } from '../services/restaurantHelper';

const router = Router();

// GET /api/photo-archives
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userIds = await getRestaurantUserIds(req.userId!);
    const { data, error } = await supabase
      .from('haccp_photo_archives')
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
    console.error('[/photo-archives GET]', err);
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

// POST /api/photo-archives/generate
router.post('/generate', requireAuth, async (req: AuthRequest, res: Response) => {
  const { year, month } = req.body;
  const userId = req.userId!;

  if (!year || !month) return res.status(400).json({ ok: false, error: 'Année et mois requis' });

  try {
    const { data: existing } = await supabase
      .from('haccp_photo_archives')
      .select('id').eq('user_id', userId).eq('year', year).eq('month', month).single();

    if (existing) return res.status(409).json({ ok: false, error: 'Archive déjà existante.' });

    const userIds = await getRestaurantUserIds(userId);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;
    const monthLabel = new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    // Récupérer les photos du mois
    const { data: photos } = await supabase
      .from('haccp_photos')
      .select('*')
      .in('user_id', userIds)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: true });

    const photoList = photos ?? [];
    if (photoList.length === 0) return res.status(400).json({ ok: false, error: 'Aucune photo ce mois-ci.' });

    // Récupérer nom restaurant + chef
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

    // Grouper par semaine
    const weeks: Record<string, any[]> = {};
    for (const p of photoList) {
      const d = new Date(p.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1);
      const weekKey = `Semaine du ${weekStart.getDate()} ${weekStart.toLocaleDateString('fr-FR', { month: 'long' })}`;
      if (!weeks[weekKey]) weeks[weekKey] = [];

      let imgUrl = '';
      if (p.storage_path) {
        const { data: signed } = await supabase.storage
          .from('haccp-photos')
          .createSignedUrl(p.storage_path, 86400);
        imgUrl = signed?.signedUrl ?? '';
      }
      weeks[weekKey].push({ ...p, imgUrl });
    }

    // Générer le HTML
    let pagesHtml = '';
    for (const [weekLabel, weekPhotos] of Object.entries(weeks)) {
      const photoRows = weekPhotos.map((p: any) => {
        const date = new Date(p.created_at).toLocaleDateString('fr-FR');
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #EEE;vertical-align:middle;">
            ${p.imgUrl ? `<img src="${p.imgUrl}" width="80" height="60" style="border:1px solid #E8E0D0;" />` : '📷'}
          </td>
          <td style="padding:8px;border-bottom:1px solid #EEE;font-size:12px;vertical-align:middle;">${p.name || 'Étiquette'}</td>
          <td style="padding:8px;border-bottom:1px solid #EEE;font-size:11px;color:#888;vertical-align:middle;">${date}</td>
        </tr>`;
      }).join('');

      pagesHtml += `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
          <tr><td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
              <tr>
                <td width="26" style="font-size:16px;vertical-align:middle;">📅</td>
                <td style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#1A1A1A;font-weight:bold;vertical-align:middle;padding-right:10px;">${weekLabel}</td>
                <td width="100%" style="vertical-align:middle;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-bottom:1px solid #D4AF37;height:1px;"></td></tr></table></td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;">
              <tr>
                <th style="background-color:#111;color:#D4AF37;padding:6px 8px;font-size:9px;letter-spacing:2px;text-align:left;border:1px solid #E8E0D0;">Photo</th>
                <th style="background-color:#111;color:#D4AF37;padding:6px 8px;font-size:9px;letter-spacing:2px;text-align:left;border:1px solid #E8E0D0;">Nom</th>
                <th style="background-color:#111;color:#D4AF37;padding:6px 8px;font-size:9px;letter-spacing:2px;text-align:left;border:1px solid #E8E0D0;">Date</th>
              </tr>
              ${photoRows}
            </table>
          </td></tr>
        </table>`;
    }

    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Helvetica,Arial,sans-serif;color:#2C2C2C;margin:0;padding:0;">
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
  <tr><td style="text-align:center;padding:14px 40px 0;">
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="border:2px solid #D4AF37;">
      <tr><td style="padding:10px 20px;text-align:center;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#A07D1C;text-align:center;padding-bottom:6px;">🏷️ Archive Étiquettes Sanitaires HACCP</td></tr>
          <tr><td style="font-size:22px;color:#1A1A1A;font-weight:bold;text-align:center;text-transform:capitalize;">${monthLabel}</td></tr>
          <tr><td style="font-size:11px;color:#8A7A60;text-align:center;padding-top:4px;">${photoList.length} étiquette${photoList.length > 1 ? 's' : ''} archivée${photoList.length > 1 ? 's' : ''}</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>

${pagesHtml}

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111;">
  <tr>
    <td width="33%" style="padding:14px 40px;font-size:10px;color:#8A7A60;font-style:italic;">📄 Document généré automatiquement</td>
    <td width="34%" style="padding:14px 0;font-size:10px;letter-spacing:3px;color:#D4AF37;text-transform:uppercase;text-align:center;">✦ ChefGestion Pro ✦</td>
    <td width="33%" style="padding:14px 40px;font-size:10px;color:#8A7A60;text-align:right;">© ${yearNum} — Tous droits réservés</td>
  </tr>
</table>
</body></html>`;

    const minified = fullHtml.replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><').trim();
    const htmlBuffer = Buffer.from(minified, 'utf-8');
    const fileSizeKB = Math.round(htmlBuffer.length / 1024);
    const storagePath = `${userId}/${year}-${String(month).padStart(2, '0')}-photos-archive.html`;
    const expiresAt = new Date(year + 1, month - 1, 1);

    await supabase.storage.from('haccp-archives').upload(storagePath, htmlBuffer, { contentType: 'text/html', upsert: true });

    const { data: archive, error: insertErr } = await supabase
      .from('haccp_photo_archives')
      .upsert({
        user_id: userId,
        restaurant_id: profile?.restaurant_id || null,
        year, month,
        storage_path: storagePath,
        file_size: fileSizeKB,
        photo_count: photoList.length,
        expires_at: expiresAt.toISOString(),
        warning_sent: false,
      }, { onConflict: 'user_id,year,month' })
      .select().single();

    if (insertErr) throw insertErr;

    res.json({ ok: true, data: archive });
  } catch (err) {
    console.error('[/photo-archives/generate]', err);
    res.status(500).json({ ok: false, error: 'Erreur génération' });
  }
});

export default router;