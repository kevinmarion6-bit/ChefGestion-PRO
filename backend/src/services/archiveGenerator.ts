// backend/src/services/archiveGenerator.ts
// ─── GÉNÉRATEUR D'ARCHIVES PDF MENSUELLES HACCP ──────────
// Génère un PDF compressé avec tous les relevés du mois,
// le stocke dans Supabase Storage, et gère l'expiration à 1 an

import { supabase } from './supabase';
import { getRestaurantUserIds } from './restaurantHelper';
import { Buffer } from 'buffer';

// Expo Push SDK — chargé dynamiquement pour éviter les erreurs TS
let Expo: any;
try { Expo = require('expo-server-sdk').Expo; } catch { Expo = null; }

// Expo Push pour les notifications serveur
const expo = new Expo();

// ─── GÉNÉRER LE PDF D'ARCHIVE ────────────────────────────

export async function generateArchivePdf(
  userId: string,
  year: number,
  month: number
): Promise<{ id: string; storage_path: string; is_complete: boolean }> {

  const userIds = await getRestaurantUserIds(userId);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;
  const monthLabel = new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // Récupérer les frigos
  const { data: fridges } = await supabase
    .from('fridges')
    .select('*')
    .in('user_id', userIds)
    .eq('actif', true)
    .order('created_at', { ascending: true });

  // Récupérer les relevés
  const { data: logs } = await supabase
    .from('temperature_logs')
    .select('*')
    .in('user_id', userIds)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  // Récupérer le nom du restaurant
  const { data: profile } = await supabase
    .from('profiles').select('name, restaurant_id').eq('id', userId).single();

  let restaurantName = '';
  if (profile?.restaurant_id) {
    const { data: rest } = await supabase
      .from('restaurants').select('nom').eq('id', profile.restaurant_id).single();
    restaurantName = rest?.nom ?? '';
  }

  const fridgeList = fridges ?? [];
  const logList = logs ?? [];
  const fridgeCount = fridgeList.length;
  const expectedLogs = fridgeCount * daysInMonth * 2;
  const isComplete = expectedLogs > 0 ? (logList.length / expectedLogs) >= 0.95 : false;

  const logoUrl = 'https://osnckjlgqqawcgduideb.supabase.co/storage/v1/object/public/assets/logo.png';

  // Construire le HTML pour chaque frigo
  let pagesHtml = '';

  for (const fridge of fridgeList) {
    const fridgeLogs = logList.filter(
      l => l.fridge_id === fridge.id || (l.fridge_nom && l.fridge_nom === fridge.nom)
    );
    const isFreez = fridge.type === 'negatif' || fridge.nom?.toLowerCase().includes('congél');

    let rows = '';
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const midi = fridgeLogs.find((l: any) => l.date === dateStr && l.periode === 'MIDI');
      const soir = fridgeLogs.find((l: any) => l.date === dateStr && l.periode === 'SOIR');
      const comment = (midi as any)?.commentaire || (soir as any)?.commentaire || '';

      const getTempColor = (val: number | undefined) => {
        if (val === undefined || val === null) return '#999';
        if (val > 8 || val < -30) return '#F87171';
        if (val > 4 || val < -22) return '#FACC15';
        return '#4ADE80';
      };

      rows += `<tr>
        <td>${day}</td>
        <td style="color:${getTempColor(midi?.valeur)};font-weight:bold;">${midi ? midi.valeur + '°C' : '--'}</td>
        <td style="color:${getTempColor(soir?.valeur)};font-weight:bold;">${soir ? soir.valeur + '°C' : '--'}</td>
        <td style="font-style:italic;color:#888;font-size:10px;">${comment}</td>
      </tr>`;
    }

    pagesHtml += `
      <div class="page">
        <div class="page-header">
          <img src="${logoUrl}" class="logo" />
          <div class="header-text">
            <h1>📋 ARCHIVE MENSUELLE — RELEVÉS HACCP</h1>
            ${restaurantName ? `<p class="restaurant">🍽️ ${restaurantName}</p>` : ''}
            <p class="meta">${monthLabel} — ${isComplete ? '✅ COMPLET' : '⚠️ INCOMPLET'} — Archivé le ${new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>
        <h2>${isFreez ? '🧊' : '❄️'} ${fridge.nom} <span class="fridge-type">(${fridge.type === 'negatif' ? 'Congélateur' : 'Réfrigérateur'})</span></h2>
        <table>
          <thead><tr><th>Jour</th><th>☀️ MIDI</th><th>🌙 SOIR</th><th>💬 Commentaire</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="page-footer">
          <span>✦ ChefGestion Pro ✦</span>
          <span>${fridge.nom} — ${monthLabel}</span>
          <span>Expire le ${new Date(year + 1, month - 1, 1).toLocaleDateString('fr-FR')}</span>
        </div>
      </div>`;
  }

  // Assembler le HTML complet
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      @page { margin: 15px 20px; size: A4; }
      body { font-family: Georgia, serif; margin: 0; padding: 0; color: #222; }
      .page { page-break-after: always; padding: 0; }
      .page:last-child { page-break-after: auto; }
      .page-header { display: flex; flex-direction: row; align-items: center; gap: 12px; border-bottom: 2px solid #D4AF37; padding-bottom: 10px; margin-bottom: 14px; }
      .logo { width: 44px; height: 44px; border-radius: 8px; }
      .header-text { flex: 1; }
      h1 { margin: 0; font-size: 13px; letter-spacing: 2px; color: #111; }
      .restaurant { margin: 2px 0 0; font-size: 12px; color: #D4AF37; font-weight: bold; }
      .meta { margin: 2px 0 0; color: #888; font-size: 10px; }
      h2 { color: #D4AF37; font-size: 13px; border-bottom: 1px solid #D4AF37; padding-bottom: 5px; margin: 0 0 8px; }
      .fridge-type { font-size: 10px; color: #888; font-weight: normal; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: #111; color: #D4AF37; padding: 5px; font-size: 9px; text-align: center; }
      td { padding: 4px 5px; border-bottom: 1px solid #eee; text-align: center; font-size: 11px; }
      tr:nth-child(even) { background: #f9f9f9; }
      .page-footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #D4AF37; display: flex; justify-content: space-between; font-size: 8px; color: #999; }
    </style>
  </head><body>${pagesHtml}</body></html>`;

  // Convertir le HTML en un buffer compressé (on stocke le HTML minimal, le PDF est généré côté client)
  // On minimise le HTML pour réduire la taille
  const minifiedHtml = fullHtml
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();

  const htmlBuffer = Buffer.from(minifiedHtml, 'utf-8');
  const fileSizeKB = Math.round(htmlBuffer.length / 1024);

  // Stocker dans Supabase Storage
  const storagePath = `${userId}/${year}-${String(month).padStart(2, '0')}-archive.html`;
  const expiresAt = new Date(year + 1, month - 1, 1); // Expire 1 an après

  const { error: uploadError } = await supabase.storage
    .from('haccp-archives')
    .upload(storagePath, htmlBuffer, {
      contentType: 'text/html',
      upsert: true,
    });

  if (uploadError) {
    console.error('[Archive] Erreur upload:', uploadError);
    throw new Error('Erreur stockage archive');
  }

  // Sauvegarder la référence en base
  const { data: profile2 } = await supabase
    .from('profiles').select('restaurant_id').eq('id', userId).single();

  const { data: archive, error: insertError } = await supabase
    .from('haccp_archives')
    .upsert({
      user_id: userId,
      restaurant_id: profile2?.restaurant_id || null,
      year,
      month,
      storage_path: storagePath,
      file_size: fileSizeKB,
      is_complete: isComplete,
      fridge_count: fridgeCount,
      log_count: logList.length,
      expires_at: expiresAt.toISOString(),
      warning_sent: false,
    }, { onConflict: 'user_id,year,month' })
    .select()
    .single();

  if (insertError) {
    console.error('[Archive] Erreur insert:', insertError);
    throw new Error('Erreur sauvegarde archive');
  }

  console.log(`[Archive] ✅ ${monthLabel} généré (${fileSizeKB} KB, ${logList.length} relevés, ${isComplete ? 'COMPLET' : 'INCOMPLET'})`);

  return {
    id: archive.id,
    storage_path: storagePath,
    is_complete: isComplete,
  };
}

// ─── CRON : ARCHIVER LE MOIS PRÉCÉDENT ──────────────────
// Appelé au démarrage du serveur et toutes les 6 heures

export async function runArchiveCron(): Promise<void> {
  console.log('[Cron Archive] Vérification des archives en attente...');

  const now = new Date();
  const prevMonth = now.getMonth(); // 0-based
  const prevYear = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevMonthNum = prevMonth === 0 ? 12 : prevMonth;

  try {
    // 1. Récupérer tous les utilisateurs actifs
    const { data: users } = await supabase
      .from('profiles')
      .select('id');

    for (const user of (users ?? [])) {
      // Vérifier si l'archive du mois précédent existe déjà
      const { data: existing } = await supabase
        .from('haccp_archives')
        .select('id')
        .eq('user_id', user.id)
        .eq('year', prevYear)
        .eq('month', prevMonthNum)
        .single();

      if (!existing) {
        // Vérifier qu'il y a des données à archiver
        const startDate = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}-01`;
        const daysInMonth = new Date(prevYear, prevMonthNum, 0).getDate();
        const endDate = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}-${daysInMonth}`;

        const { data: logs } = await supabase
          .from('temperature_logs')
          .select('id')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .limit(1);

        if (logs && logs.length > 0) {
          try {
            await generateArchivePdf(user.id, prevYear, prevMonthNum);
          } catch (err) {
            console.error(`[Cron Archive] Erreur pour user ${user.id}:`, err);
          }
        }
      }
    }

    // 2. Envoyer les avertissements d'expiration (7 jours avant)
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + 7);

    const { data: expiringArchives } = await supabase
      .from('haccp_archives')
      .select('*, user_id')
      .lte('expires_at', warningDate.toISOString())
      .gt('expires_at', now.toISOString())
      .eq('warning_sent', false);

    for (const archive of (expiringArchives ?? [])) {
      // Récupérer le push token de l'utilisateur
      const { data: settings } = await supabase
        .from('user_settings')
        .select('push_token')
        .eq('user_id', archive.user_id)
        .single();

      if (settings?.push_token && Expo && Expo.isExpoPushToken(settings.push_token)) {
        try {
          await expo.sendPushNotificationsAsync([{
            to: settings.push_token,
            title: '⚠️ Archive HACCP — Expiration proche',
            body: `L'archive de ${new Date(archive.year, archive.month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} sera supprimée dans 7 jours. Téléchargez-la !`,
            sound: 'default',
            data: { screen: 'archives' },
          }]);
          console.log(`[Cron] ⚠️ Avertissement envoyé pour archive ${archive.year}-${archive.month}`);
        } catch (err) {
          console.error('[Cron] Erreur envoi notif:', err);
        }
      }

      // Marquer l'avertissement comme envoyé
      await supabase
        .from('haccp_archives')
        .update({ warning_sent: true })
        .eq('id', archive.id);
    }

    // 3. Supprimer les archives expirées (> 1 an)
    const { data: expiredArchives } = await supabase
      .from('haccp_archives')
      .select('*')
      .lt('expires_at', now.toISOString());

    for (const archive of (expiredArchives ?? [])) {
      // Supprimer le fichier du storage
      await supabase.storage
        .from('haccp-archives')
        .remove([archive.storage_path]);

      // Supprimer l'entrée en base
      await supabase
        .from('haccp_archives')
        .delete()
        .eq('id', archive.id);

      console.log(`[Cron] 🗑️ Archive supprimée: ${archive.year}-${archive.month}`);

      // Notifier l'utilisateur
      const { data: settings } = await supabase
        .from('user_settings')
        .select('push_token')
        .eq('user_id', archive.user_id)
        .single();

      if (settings?.push_token && Expo && Expo.isExpoPushToken(settings.push_token)) {
        try {
          await expo.sendPushNotificationsAsync([{
            to: settings.push_token,
            title: '🗑️ Archive HACCP supprimée',
            body: `L'archive de ${new Date(archive.year, archive.month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} a été supprimée après 1 an.`,
            sound: 'default',
          }]);
        } catch {}
      }
    }

    console.log('[Cron Archive] ✅ Terminé');
  } catch (err) {
    console.error('[Cron Archive] Erreur globale:', err);
  }
}

// ─── CRON : NOTIFIER SI MOIS INCOMPLET ──────────────────
// Envoie une notification push le 1er du mois si le mois précédent est incomplet

export async function runIncompleteMonthNotification(): Promise<void> {
  const now = new Date();
  // Ne s'exécute que le 1er du mois (ou le 2 pour rattraper)
  if (now.getDate() > 2) return;

  console.log('[Cron] Vérification complétude mois précédent...');

  const prevMonth = now.getMonth();
  const prevYear = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevMonthNum = prevMonth === 0 ? 12 : prevMonth;
  const daysInPrevMonth = new Date(prevYear, prevMonthNum, 0).getDate();
  const startDate = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}-01`;
  const endDate = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}-${daysInPrevMonth}`;

  try {
    const { data: users } = await supabase
      .from('user_settings')
      .select('user_id, push_token')
      .eq('push_temp_reminder', true)
      .not('push_token', 'is', null);

    for (const user of (users ?? [])) {
      const { data: fridges } = await supabase
        .from('fridges')
        .select('id')
        .eq('user_id', user.user_id)
        .eq('actif', true);

      const fridgeCount = fridges?.length ?? 0;
      if (fridgeCount === 0) continue;

      const { data: logs } = await supabase
        .from('temperature_logs')
        .select('id')
        .eq('user_id', user.user_id)
        .gte('date', startDate)
        .lte('date', endDate);

      const logCount = logs?.length ?? 0;
      const expectedLogs = fridgeCount * daysInPrevMonth * 2;
      const completionRate = Math.round((logCount / expectedLogs) * 100);

      if (completionRate < 95 && Expo.isExpoPushToken(user.push_token)) {
        const monthLabel = new Date(prevYear, prevMonthNum - 1).toLocaleDateString('fr-FR', { month: 'long' });
        try {
          await expo.sendPushNotificationsAsync([{
            to: user.push_token,
            title: `⚠️ Relevés ${monthLabel} incomplets (${completionRate}%)`,
            body: `Il manque des relevés de température pour ${monthLabel}. Complétez-les avant l'archivage !`,
            sound: 'default',
            data: { screen: 'haccp' },
          }]);
        } catch {}
      }
    }
  } catch (err) {
    console.error('[Cron incomplete]', err);
  }
}