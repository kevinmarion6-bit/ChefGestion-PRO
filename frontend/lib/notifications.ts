// frontend/lib/notifications.ts
// ─── SERVICE DE NOTIFICATIONS PUSH ────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getToken } from './auth';

// Chargement sécurisé — ne crash pas si le module natif n'existe pas
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

const PUSH_PREF_KEY = 'cgp_push_temp_reminder';
const PUSH_TOKEN_KEY = 'cgp_push_token';

const API_URL = (() => {
  try {
    const { API_BASE_URL } = require('./config');
    return API_BASE_URL;
  } catch {
    return 'https://chefgestion-pro.onrender.com/api';
  }
})();

// ─── CONFIGURATION NOTIFICATIONS ─────────────────────────

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ─── DEMANDER LA PERMISSION ──────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications) return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifs] Permission refusée');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined,
    });
    const token = tokenData.data;
    console.log('[Notifs] Token obtenu:', token);

    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    await savePushTokenToServer(token);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('temp-reminders', {
        name: 'Rappels Température',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4AF37',
      });
    }

    return token;
  } catch (err) {
    console.error('[Notifs] Erreur enregistrement:', err);
    return null;
  }
}

// ─── SAUVEGARDER TOKEN SUR LE SERVEUR ────────────────────

async function savePushTokenToServer(pushToken: string): Promise<void> {
  try {
    const authToken = await getToken();
    if (!authToken) return;

    await fetch(`${API_URL}/settings/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ push_token: pushToken }),
    });
  } catch (err) {
    console.error('[Notifs] Erreur sauvegarde token serveur:', err);
  }
}

// ─── PLANIFIER LES RAPPELS DE TEMPÉRATURE ────────────────

export async function scheduleTemperatureReminders(): Promise<void> {
  if (!Notifications) return;
  
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🌡️ Relevé MIDI en attente',
      body: 'Chef, n\'oubliez pas de relever les températures du service MIDI !',
      sound: 'default',
      data: { screen: 'haccp' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 14,
      minute: 30,
    },
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Dernier rappel MIDI !',
      body: 'Chef, les relevés MIDI ne sont toujours pas complets. Scannez vos frigos maintenant !',
      sound: 'default',
      data: { screen: 'haccp' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 15,
      minute: 30,
    },
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🌡️ Relevé SOIR en attente',
      body: 'Chef, n\'oubliez pas de relever les températures du service SOIR !',
      sound: 'default',
      data: { screen: 'haccp' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 22,
      minute: 30,
    },
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Dernier rappel SOIR !',
      body: 'Chef, les relevés SOIR ne sont toujours pas complets. Scannez vos frigos maintenant !',
      sound: 'default',
      data: { screen: 'haccp' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 23,
      minute: 30,
    },
  });

  console.log('[Notifs] Rappels planifiés (14h30, 15h30, 22h30, 23h30)');
}

// ─── ANNULER LES RAPPELS ────────────────────────────────

export async function cancelTemperatureReminders(): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('[Notifs] Rappels température annulés');
}

// ─── SAUVEGARDER LE CHOIX DU TOGGLE ─────────────────────

export async function savePushPreference(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PUSH_PREF_KEY, JSON.stringify(enabled));

  try {
    const authToken = await getToken();
    if (!authToken) return;

    await fetch(`${API_URL}/settings/push-preference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ push_temp_reminder: enabled }),
    });
  } catch (err) {
    console.error('[Notifs] Erreur sauvegarde préférence serveur:', err);
  }

  if (enabled) {
    await registerForPushNotifications();
    await scheduleTemperatureReminders();
  } else {
    await cancelTemperatureReminders();
  }
}

// ─── NOTIFICATIONS DLC ───────────────────────────────────

export async function scheduleDlcNotification(photoId: string, productName: string, dlcDate: string): Promise<void> {
  if (!Notifications) return;

  const dlc = new Date(dlcDate);
  if (isNaN(dlc.getTime())) return;

  const now = new Date();

  // J-3 MIDI (11h)
  const j3 = new Date(dlc);
  j3.setDate(j3.getDate() - 3);
  j3.setHours(11, 0, 0, 0);

  // J-3 SOIR (18h)
  const j3soir = new Date(dlc);
  j3soir.setDate(j3soir.getDate() - 3);
  j3soir.setHours(18, 0, 0, 0);

  // J-0 MIDI (11h)
  const j0 = new Date(dlc);
  j0.setHours(11, 0, 0, 0);

  // J-0 SOIR (18h)
  const j0soir = new Date(dlc);
  j0soir.setHours(18, 0, 0, 0);

  const notifications = [
    { id: `dlc-j3-midi-${photoId}`, date: j3, title: `🏷️ ${productName}`, body: 'Expire dans 3 jours' },
    { id: `dlc-j3-soir-${photoId}`, date: j3soir, title: `🏷️ ${productName}`, body: 'Expire dans 3 jours' },
    { id: `dlc-j0-midi-${photoId}`, date: j0, title: `🔴 ${productName}`, body: 'Expire AUJOURD\'HUI !' },
    { id: `dlc-j0-soir-${photoId}`, date: j0soir, title: `🔴 ${productName}`, body: 'Expire AUJOURD\'HUI !' },
  ];

  for (const notif of notifications) {
    if (notif.date > now) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: notif.id,
          content: {
            title: notif.title,
            body: notif.body,
            sound: 'default',
            data: { screen: 'haccp', photoId },
          },
          trigger: { date: notif.date },
        });
        console.log(`[DLC Notif] Planifiée: ${notif.id} pour ${notif.date.toLocaleString()}`);
      } catch (err) {
        console.error(`[DLC Notif] Erreur planification ${notif.id}:`, err);
      }
    }
  }
}

export async function cancelDlcNotifications(photoId: string): Promise<void> {
  if (!Notifications) return;

  const ids = [
    `dlc-j3-midi-${photoId}`,
    `dlc-j3-soir-${photoId}`,
    `dlc-j0-midi-${photoId}`,
    `dlc-j0-soir-${photoId}`,
  ];

  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  }
  console.log(`[DLC Notif] Annulées pour photo ${photoId}`);
}

// ─── CHARGER LE CHOIX SAUVEGARDÉ ─────────────────────────

export async function loadPushPreference(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PUSH_PREF_KEY);
    return raw ? JSON.parse(raw) : false;
  } catch {
    return false;
  }
}