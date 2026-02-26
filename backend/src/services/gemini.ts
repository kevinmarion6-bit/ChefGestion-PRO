/**
 * Service Gemini Vision
 * - File d'attente pour éviter le rate-limiting
 * - Retry silencieux sur 429
 * - Fallback simulation si pas de clé API
 */

type Task = {
  fn: () => Promise<string>;
  resolve: (v: string) => void;
  reject: (e: unknown) => void;
};

const queue: Task[] = [];
let busy = false;

export function enqueueGemini(fn: () => Promise<string>): Promise<string> {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    drain();
  });
}

async function drain(): Promise<void> {
  if (busy || queue.length === 0) return;
  busy = true;
  const task = queue.shift()!;
  try {
    task.resolve(await task.fn());
  } catch (e) {
    task.reject(e);
  } finally {
    busy = false;
    if (queue.length > 0) setTimeout(drain, 500);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── MAIN CALL ───────────────────────────────────────────

export async function callGemini(
  apiKey: string,
  prompt: string,
  imageBase64?: string,
  mimeType = 'image/jpeg',
  retries = 4
): Promise<string> {
  if (!apiKey || !apiKey.startsWith('AIza')) {
    console.log('[Gemini] Pas de clé API — simulation');
    return simulateScan(prompt);
  }

  const parts: object[] = [];
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
  }
  parts.push({ text: prompt });

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
          }),
        }
      );

      if (res.status === 429) {
        const wait = Math.pow(2, attempt + 1) * 1000 + Math.random() * 800;
        console.log(`[Gemini] Rate limit (429) — attente ${Math.round(wait)}ms (tentative ${attempt + 1})`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) {
        const err = await res.text();
        console.error(`[Gemini] Erreur HTTP ${res.status}:`, err);
        if (attempt === retries - 1) return simulateScan(prompt);
        await sleep(1500);
        continue;
      }

      const data = await res.json() as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ?? simulateScan(prompt);
    } catch (err) {
      console.error(`[Gemini] Erreur réseau (tentative ${attempt + 1}):`, err);
      if (attempt === retries - 1) return simulateScan(prompt);
      await sleep(1500);
    }
  }

  return simulateScan(prompt);
}

// ─── PROMPTS ─────────────────────────────────────────────

export const PROMPTS = {
  invoice: `Tu es un expert OCR pour factures fournisseurs de restauration française.
Analyse cette image et extrais en JSON strict (sans markdown ni backticks):
{"fournisseur":"","numero_facture":"","date":"DD/MM/YYYY","produits":[{"nom":"","unite":"kg|L|pièce|colis","prix_ht":0,"quantite":0,"total_ht":0}],"total_ht":0,"tva":0,"total_ttc":0}
Retourne UNIQUEMENT le JSON valide.`,

 temperature: `Tu es un expert en lecture d'afficheurs LED industriels (HACCP).
L'image est un recadrage serré sur l'écran d'un thermostat de cuisine.

INSTRUCTIONS :
1. PRIORITÉ AU SIGNE : Un tiret seul à gauche est TOUJOURS un signe moins (-).
2. LOGIQUE DÉCIMALE : 
   - Si tu vois un point ou une virgule, utilise-le.
   - Si tu vois 3 chiffres sans point (ex: "185"), insère une décimale (ex: 18.5).
   - Si le résultat est incohérent pour un frigo (> 50°C), réévalue si un segment n'est pas un reflet.
3. ERREURS TYPES : Ne confonds pas le "8" avec un "0" mal formé. Vérifie les segments allumés.
4. ÉTAT SPÉCIAL : Si l'afficheur indique "Lo" ou "Hi", considère cela comme une température hors plage (null).

EXEMPLE D'ANALYSE :
Input: Image avec chiffres rouges "02.5"
Output: {"temperature": 2.5, "unite": "°C", "confiance": 98, "type_afficheur": "LED 7 segments", "analyse_visuelle": "Chiffres 0, 2 et 5 bien visibles avec point décimal."}

FORMAT JSON STRICT :
{
  "temperature": number | null,
  "unite": "°C",
  "confiance": 0-100,
  "type_afficheur": "LED 7 segments",
  "analyse_visuelle": "ex: Vu -18.4 avec point net"
}`,

  carte: `Tu es expert en analyse de cartes de restaurants français.
Extrais tous les plats et prix TTC.
JSON strict (sans markdown) :
{"etablissement":"","plats":[{"categorie":"Entrées|Plats|Desserts|Fromages|Boissons","nom":"","prix_ttc":0}]}`,

  recipes: (style: string, cat: string, products: string) =>
    `Chef expert en cuisine ${style} française.
Génère 3 idées originales de ${cat} avec ces produits disponibles : ${products}.
JSON strict (sans markdown) :
{"recettes":[{"nom":"","description":"","ingredients_principaux":[],"difficulte":"Facile|Moyen|Difficile","temps_preparation":"","suggestion_prix":0}]}`,
};

// ─── HELPERS ─────────────────────────────────────────────

export function parseGeminiJSON<T>(raw: string): T | null {
  try {
    // Cette regex cherche le premier '{' et le dernier '}' pour extraire uniquement le bloc JSON
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const cleaned = jsonMatch[0].trim();
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.error("[Gemini] Erreur de parsing JSON:", e);
    return null;
  }
}

// ─── GOOGLE CLOUD VISION ─────────────────────────────────

export async function callVision(apiKey: string, imageBase64: string): Promise<string> {
  // On s'assure que le Base64 est pur (sans le header data:image/...)
  const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
  
  console.log(`[Vision] Envoi d'une image de ${cleanBase64.length} caractères`);

  try {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: cleanBase64 },
            features: [
              { type: 'TEXT_DETECTION' },
              { type: 'DOCUMENT_TEXT_DETECTION' }
            ],
            imageContext: { languageHints: ["en", "fr"] }
          }],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Vision] Erreur API ${res.status}:`, err);
      return '';
    }

    const data = await res.json() as any;
    
    // On récupère TOUTES les annotations et on les regroupe
    // C'est crucial car parfois le "-" est séparé du "18" et du "5"
    const annotations = data?.responses?.[0]?.textAnnotations || [];
    const fullText = annotations.map((a: any) => a.description).join(' ');
    
    return fullText || '';
  } catch (err) {
    console.error('[Vision] Erreur réseau:', err);
    return '';
  }
}

// ─── SIMULATION ──────────────────────────────────────────

function simulateScan(prompt: string): string {
  if (prompt.includes('facture') || prompt.includes('invoice')) {
    const suppliers = ['METRO Cash & Carry', 'Transgourmet', 'Pomona', 'Brake France'];
    return JSON.stringify({
      fournisseur: suppliers[Math.floor(Math.random() * suppliers.length)],
      numero_facture: 'FAC-2024-' + Math.floor(Math.random() * 9000 + 1000),
      date: new Date().toLocaleDateString('fr-FR'),
      produits: [
        { nom: 'Filet de bœuf', unite: 'kg', prix_ht: 28.5, quantite: 3, total_ht: 85.5 },
        { nom: 'Crème fraîche 35%', unite: 'L', prix_ht: 3.2, quantite: 5, total_ht: 16.0 },
        { nom: 'Beurre AOP', unite: 'kg', prix_ht: 8.9, quantite: 2, total_ht: 17.8 },
        { nom: 'Échalotes', unite: 'kg', prix_ht: 2.1, quantite: 4, total_ht: 8.4 },
      ],
      total_ht: 127.7, tva: 12.77, total_ttc: 140.47,
    });
  }

  if (prompt.includes('température') || prompt.includes('LED')) {
    const vals = [-18.5, 3.2, 4.8, -22.1, 2.1, 5.5, -19.8, 6.3];
    return JSON.stringify({ temperature: vals[Math.floor(Math.random() * vals.length)], unite: '°C', type_afficheur: 'LED 7 segments', confiance: 94 });
  }

  if (prompt.includes('carte') || prompt.includes('menu')) {
    return JSON.stringify({
      etablissement: 'Bistrot du Chef',
      plats: [
        { categorie: 'Entrées', nom: 'Foie gras mi-cuit, brioche toastée', prix_ttc: 22 },
        { categorie: 'Plats', nom: 'Pavé de bœuf, sauce bordelaise', prix_ttc: 36 },
        { categorie: 'Desserts', nom: 'Soufflé chaud au Grand Marnier', prix_ttc: 16 },
      ],
    });
  }

  return JSON.stringify({
    recettes: [
      { nom: 'Pavé de bœuf rôti, jus d\'échalotes', description: 'Un classique revisité.', ingredients_principaux: ['bœuf', 'échalotes', 'beurre'], difficulte: 'Moyen', temps_preparation: '35 min', suggestion_prix: 36 },
      { nom: 'Velouté crémeux aux champignons', description: 'Entrée délicate.', ingredients_principaux: ['crème fraîche', 'champignons'], difficulte: 'Facile', temps_preparation: '25 min', suggestion_prix: 14 },
    ],
  });
}