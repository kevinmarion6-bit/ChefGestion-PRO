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
 *
 * Exemple : si le terminal affiche "IP LAN : http://192.168.1.42:3001"
 * → API_BASE_URL = 'http://192.168.1.42:3001/api'
 */

export const API_BASE_URL = 'http://192.168.1.122:5001/api';
// Exemple : 'http://192.168.1.42:3001/api'

export const TIMEOUT_MS = 30_000; // 30 secondes

/** Vérifie que l'URL a bien été configurée */
export function isConfigured(): boolean {
  return !API_BASE_URL.includes('VOTRE_IP_ICI');
}
