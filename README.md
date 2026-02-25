# ChefGestion Pro — Application Mobile

Application de gestion pour chefs de cuisine français.
Stack : React Native + Expo SDK 51 + Expo Router + Gemini Vision AI

---

## 🚀 Installation rapide

### 1. Décompresser et installer les dépendances

```bash
cd ChefGestion
npm install
```

### 2. Installer les polices Google Fonts

```bash
npx expo install @expo-google-fonts/cinzel @expo-google-fonts/eb-garamond @expo-google-fonts/dm-sans
```

### 3. Lancer en mode développement (Expo Go)

```bash
npx expo start
```

Scannez le QR code avec **Expo Go** (iOS) ou directement avec l'appli Appareil photo (Android).

---

## 📦 Build APK Android (installation directe)

### Option A — Build local (sans compte Expo)

```bash
# Installer EAS CLI
npm install -g eas-cli

# Build APK local (nécessite Android Studio + JDK 17)
npx expo run:android --variant release
```

### Option B — Build cloud EAS (recommandé, plus simple)

```bash
# 1. Créer un compte gratuit sur expo.dev
eas login

# 2. Configurer le projet
eas build:configure

# 3. Lancer le build APK
eas build --platform android --profile preview
```

Le build prend ~10 minutes. Vous recevez un lien de téléchargement direct de l'APK.

---

## 🍎 Build IPA iOS (installation directe)

```bash
# Nécessite un compte Apple Developer (99€/an)
eas build --platform ios --profile preview
```

Pour installer sans l'App Store : utilisez **TestFlight** ou **AltStore**.

---

## ⚙️ Configuration de votre clé API Gemini

1. Obtenez votre clé sur [aistudio.google.com](https://aistudio.google.com)
2. Lancez l'app → **Plus** → **Paramètres** → collez votre clé `AIzaSy...`
3. Tous les scanners (factures, températures, carte) s'activent immédiatement

---

## 📱 Fonctionnalités

| Module | Description |
|--------|-------------|
| 🏠 Dashboard | KPIs en temps réel, alertes prix |
| 📷 Scanner OCR | Factures, cartes restaurant, températures LED |
| 📊 Ratios | Performance vs moyennes nationales FR |
| 🔧 Outils | Calculateur marge, simulateur coût, fiche technique |
| 🌡️ HACCP | Étiquettes sanitaires, relevés températures |
| 🏭 Fournisseurs | Base produits, comparateur meilleur prix |
| 🍽️ Recettes IA | Suggestions basées sur votre stock |

---

## 🗂️ Structure du projet

```
ChefGestion/
├── app/
│   ├── _layout.tsx          # Root layout + fonts + AppProvider
│   ├── index.tsx            # Redirect auth/tabs
│   ├── (auth)/
│   │   └── login.tsx        # Login & Signup
│   └── (tabs)/
│       ├── _layout.tsx      # Bottom tab navigator
│       ├── index.tsx        # Dashboard
│       ├── scanner.tsx      # Scanner OCR
│       ├── ratios.tsx       # Indicateurs
│       ├── tools.tsx        # Boîte à outils
│       └── more.tsx         # Fournisseurs, HACCP, Paramètres
├── components/
│   └── UI.tsx               # Composants partagés
├── lib/
│   ├── context.tsx          # Global state (React Context)
│   ├── gemini.ts            # API Gemini + queue + retry
│   └── storage.ts           # AsyncStorage persistence
├── constants/
│   └── Theme.ts             # Couleurs, typography, spacing
├── app.json                 # Config Expo
├── eas.json                 # Config builds EAS
└── package.json
```

---

## 🔧 Dépannage

**Erreur "fonts not loaded"**
```bash
npx expo install @expo-google-fonts/cinzel @expo-google-fonts/eb-garamond @expo-google-fonts/dm-sans
```

**Erreur "expo-router not found"**
```bash
npm install expo-router
npx expo install react-native-safe-area-context react-native-screens
```

**Le scanner ne s'ouvre pas**
→ Vérifiez les permissions caméra dans les paramètres de votre téléphone.

**L'IA retourne des données simulées**
→ Votre clé API Gemini n'est pas configurée ou invalide. Allez dans Plus → Paramètres.
