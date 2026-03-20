// frontend/lib/notifications.ts
// ─── SERVICE DE NOTIFICATIONS PUSH ────────────────────────
// Gère l'enregistrement du token push, la planification des rappels
// et la sauvegarde du choix toggle dans AsyncStorage + backend

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getToken } from './auth';

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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── DEMANDER LA PERMISSION ──────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Vérifier les permissions existantes
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Demander si pas encore accordé
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifs] Permission refusée');
      return null;
    }

    // Récupérer le token Expo Push
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined, // Expo le gère automatiquement
    });
    const token = tokenData.data;
    console.log('[Notifs] Token obtenu:', token);

    // Sauvegarder localement
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    // Envoyer au backend
    await savePushTokenToServer(token);

    // Config Android
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

  // Rappel MIDI n°1 → 14h30
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

  // Rappel MIDI n°2 → 15h30 (dernier rappel)
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

  // Rappel SOIR n°1 → 22h30
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

  // Rappel SOIR n°2 → 23h30 (dernier rappel)
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
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('[Notifs] Rappels température annulés');
}

// ─── SAUVEGARDER LE CHOIX DU TOGGLE ─────────────────────

export async function savePushPreference(enabled: boolean): Promise<void> {
  // 1. Sauvegarder localement (pour persistance immédiate)
  await AsyncStorage.setItem(PUSH_PREF_KEY, JSON.stringify(enabled));

  // 2. Sauvegarder côté serveur
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

  // 3. Activer ou désactiver les rappels locaux
  if (enabled) {
    await registerForPushNotifications();
    await scheduleTemperatureReminders();
  } else {
    await cancelTemperatureReminders();
  }
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