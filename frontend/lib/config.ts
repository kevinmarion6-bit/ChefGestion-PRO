/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  CONFIGURATION RÉSEAU — À modifier avant de lancer Expo  ║
 * ╠═══════════════════════════════════════════════════════════╣
 * ║  1. Lancez le backend : cd backend && npm run dev         ║
 * ║  2. Copiez l'IP LAN affichée dans le terminal            ║
 * ║  3. Collez-la dans API_BASE_URL ci-dessous               ║
 * ║  4. Votre téléphone ET votre PC doivent être sur le      ║
 * ║     même réseau Wi-Fi                                     ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

export const API_BASE_URL = 'https://chefgestion-pro.onrender.com/api';
export const TIMEOUT_MS = 30_000;

export function isConfigured(): boolean {
  return !API_BASE_URL.includes('VOTRE_IP_ICI');
}