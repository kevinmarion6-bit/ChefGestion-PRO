import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { Btn } from '@/components/UI';
import { useApp } from '@/lib/context';
import { Scan, Restaurant, Fiches } from '@/lib/api';
import { Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

// ─── ACCORDION ───────────────────────────────────────────
function Accordion({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.acc}>
      <TouchableOpacity style={styles.accHead} onPress={() => setOpen(!open)} activeOpacity={0.8}>
        <Text style={styles.accIcon}>{icon}</Text>
        <Text style={styles.accTitle}>{title}</Text>
        <Text style={[styles.accArrow, open && styles.accArrowOpen]}>▼</Text>
      </TouchableOpacity>
      {open && <View style={styles.accBody}>{children}</View>}
    </View>
  );
}

// ─── CALC FIELD ──────────────────────────────────────────
function CalcField({ label, value, onChange, placeholder = '0', decimal = true }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; decimal?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.calcLabel}>{label}</Text>
      <TextInput
        style={styles.calcInput}
        value={value}
        onChangeText={onChange}
        keyboardType={decimal ? 'decimal-pad' : 'numeric'}
        placeholder={placeholder}
        placeholderTextColor={Colors.muted}
      />
    </View>
  );
}

// ─── RESULT BOX ──────────────────────────────────────────
function ResultBox({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View style={styles.resBox}>
      {items.map(it => (
        <View key={it.label} style={styles.resItem}>
          <Text style={styles.resLabel}>{it.label}</Text>
          <Text style={styles.resVal}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── MAIN ────────────────────────────────────────────────
export default function ToolsScreen() {
const { user } = useApp();
const [restaurantName, setRestaurantName] = useState('');

const { editFiche } = useLocalSearchParams<{ editFiche?: string }>();

React.useEffect(() => {
  Restaurant.get().then(r => { if (r?.nom) setRestaurantName(r.nom); }).catch(() => {});
}, []);

// Charger une fiche à modifier depuis le répertoire
React.useEffect(() => {
  if (editFiche === 'true' && global.__editFiche) {
    const f = global.__editFiche;
    setFNom(f.nom || '');
    setFPortions(String(f.portions || 4));
    setFPV(String(f.pv_ttc || ''));
    setFPerte(String(f.perte || 2));
    setFProg(f.progression || '');
    setFicheEmoji(f.emoji || '');
    const ings = typeof f.ingredients === 'string' ? JSON.parse(f.ingredients) : (f.ingredients || []);
    if (ings.length > 0) setFicheIngs(ings);
    global.__editFiche = null;
  }
}, [editFiche]); 
  // Marge
  const [mPV, setMPV] = useState('');
  const [mCM, setMCM] = useState('');
  const [mTVA, setMTVA] = useState('10');

  // Simulator
  const [sPrix, setSPrix] = useState('');
  const [sQte, setSQte] = useState('');
  const [sPerte, setSPerte] = useState('0');
  const [sNb, setSNb] = useState('1');

  // Fiche
  const [fNom, setFNom] = useState('');
  const [fPortions, setFPortions] = useState('4');
  const [fPV, setFPV] = useState('');
  const [fPerte, setFPerte] = useState('2');
  const [fProg, setFProg] = useState('');
  const [ficheIngs, setFicheIngs] = useState([{ d: '', u: 'kg', p: '', q: '' }]);

  // Recipes
  const [recStyle, setRecStyle] = useState('bistronomique');
  const [recCat, setRecCat] = useState('plat');
  const [recipes, setRecipes] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recShowCount, setRecShowCount] = useState(3);
  const [ficheEmoji, setFicheEmoji] = useState('');

  const FICHE_EMOJIS = [
    { emoji: '🥗', label: 'Salade' },
    { emoji: '🥩', label: 'Viande' },
    { emoji: '🐟', label: 'Poisson' },
    { emoji: '🍰', label: 'Dessert' },
    { emoji: '🍨', label: 'Glace' },
    { emoji: '🧀', label: 'Fromage' },
    { emoji: '🥚', label: 'Œuf' },
    { emoji: '🍝', label: 'Pâtes' },
  ];
  // ─── MARGE CALC ─────
  function margeCalc() {
    const pv = parseFloat(mPV) || 0;
    const cm = parseFloat(mCM) || 0;
    const tva = parseFloat(mTVA) || 10;
    const ht = pv / (1 + tva / 100);
    const mb = ht - cm;
    const tm = ht > 0 ? (mb / ht) * 100 : 0;
    const co = cm > 0 ? pv / cm : 0;
    return [
      { label: 'Prix HT', value: `${ht.toFixed(2)}€` },
      { label: 'Marge €', value: `${mb.toFixed(2)}€` },
      { label: 'Taux %', value: `${tm.toFixed(1)}%` },
      { label: 'Coefficient', value: co.toFixed(2) },
    ];
  }

  // ─── SIMULATOR CALC ─────
  function simCalc() {
    const p = parseFloat(sPrix) || 0;
    const q = parseFloat(sQte) || 0;
    const pe = parseFloat(sPerte) || 0;
    const nb = parseFloat(sNb) || 1;
    const qk = q / 1000, pf = pe / 100;
    const cb = p * qk;
    const cn = pf < 1 ? cb / (1 - pf) : 0;
    const ct = cn * nb;
    const c1 = q > 0 ? (p * 0.1) / (1 - pf) : 0;
    return [
      { label: 'Coût / portion', value: `${cb.toFixed(3)}€` },
      { label: 'Net après perte', value: `${cn.toFixed(3)}€` },
      { label: 'Total recette', value: `${ct.toFixed(2)}€` },
      { label: '€ / 100g net', value: `${c1.toFixed(3)}€` },
    ];
  }

  // ─── FICHE CALC ─────
  function ficheCalc() {
    const portions = parseFloat(fPortions) || 1;
    const pvttc = parseFloat(fPV) || 0;
    const perte = parseFloat(fPerte) || 2;
    const total = ficheIngs.reduce((s, i) => s + (parseFloat((i.p || '0').replace(',', '.')) || 0) * (parseFloat((i.q || '0').replace(',', '.')) || 0), 0);
    const pp = total / portions;
    const ppav = pp * (1 + perte / 100);
    const pvht = pvttc / 1.1;
    const mb = pvht - ppav;
    const tm = pvht > 0 ? (mb / pvht) * 100 : 0;
    return { total, pp, ppav, pvht, mb, tm };
  }

  // ─── PRINT FICHE ─────
  async function printFiche() {
    const fc = ficheCalc();
    const logoUrl = 'https://osnckjlgqqawcgduideb.supabase.co/storage/v1/object/public/assets/logo.png';
    const chefName = user?.name || 'Le Chef';
    const restName = restaurantName || '';
    const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const year = new Date().getFullYear();

    const rows = ficheIngs.map((i, idx) => {
      const prix = parseFloat((i.p || '0').replace(',', '.'));
      const qte = parseFloat((i.q || '0').replace(',', '.'));
      const total = prix * qte;
      return `<tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td>${i.d || '—'}</td>
        <td class="td-center">${i.u}</td>
        <td class="td-right">${prix.toFixed(3)} €</td>
        <td class="td-center">${qte.toFixed(3)}</td>
        <td class="td-gold">${total.toFixed(3)} €</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 0; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Helvetica, Arial, sans-serif; color: #2C2C2C; background: #FFFFFF; }
    table.layout { border: none; border-collapse: collapse; }
    table.layout td { border: none; vertical-align: middle; }

    .header-bg { background-color: #111111; padding: 20px 40px; }
    .header-logo { width: 76px; height: 76px; border-radius: 14px; border: 2px solid #D4AF37; }
    .header-brand { font-size: 14px; letter-spacing: 5px; text-transform: uppercase; color: #D4AF37; padding-bottom: 4px; }
    .header-restaurant { font-size: 24px; color: #F5F5DC; font-weight: 600; letter-spacing: 1px; }
    .header-chef { font-size: 14px; color: #F5F5DC; padding-top: 5px; }
    .header-chef-title { color: #D4AF37; font-weight: 600; }
    .header-date { font-size: 15px; color: #8A7A60; text-align: right; }
    .gold-bar { height: 3px; background-color: #D4AF37; }

    .title-section { text-align: center; padding: 14px 40px 0; }
    .title-box { border: 2px solid #D4AF37; border-radius: 8px; padding: 10px 20px; display: inline-block; }
    .title-label { font-size: 8px; letter-spacing: 4px; text-transform: uppercase; color: #A07D1C; padding-bottom: 6px; }
    .title-name { font-size: 26px; color: #1A1A1A; font-weight: 700; letter-spacing: 1px; }

    .kpi-table { width: 100%; padding: 14px 40px; }
    .kpi-cell { width: 25%; padding: 4px; }
    .kpi-box { border: 1px solid #E8E0D0; border-radius: 6px; padding: 8px 6px; text-align: center; background-color: #FAFAF7; border-top: 3px solid #D4AF37; }
    .kpi-label { font-size: 7px; letter-spacing: 2px; text-transform: uppercase; color: #8A7A60; padding-bottom: 4px; }
    .kpi-value { font-family: Helvetica, Arial, sans-serif; font-size: 20px; color: #A07D1C; font-weight: 700; }
    .kpi-icon { font-size: 16px; padding-bottom: 4px; }

    .section { padding: 0 40px; margin-bottom: 12px; }
    .section-head-table { width: 100%; margin-bottom: 10px; }
    .section-icon { font-size: 16px; width: 26px; }
    .section-title { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #1A1A1A; font-weight: 600; white-space: nowrap; padding-right: 10px; }
    .section-line { border-bottom: 1px solid #D4AF37; }

    table.ingredients { width: 100%; border-collapse: collapse; border: 1px solid #E8E0D0; }
    table.ingredients thead th { background-color: #111111; color: #D4AF37; padding: 8px 10px; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; text-align: left; }
    table.ingredients thead th:last-child { text-align: right; }
    table.ingredients td { padding: 5px 10px; font-size: 11px; border-bottom: 1px solid #EEE; }
    .td-center { text-align: center; color: #555; }
    .td-right { text-align: right; }
    .td-gold { text-align: right; color: #A07D1C; font-weight: 700; }
    .row-even { background-color: #FFFFFF; }
    .row-odd { background-color: #FAFAF7; }
    .total-row { background-color: #FBF8F0; border-top: 2px solid #D4AF37; }
    .total-row td { padding: 10px; font-weight: 700; font-size: 13px; }

    .synth-cell { width: 33.33%; padding: 4px; }

    .progression-box { background-color: #FAFAF7; border: 1px solid #E8E0D0; border-radius: 8px; padding: 14px; }
    .step-table { width: 100%; }
    .step-num { background-color: #D4AF37; color: #FFFFFF; font-size: 10px; font-weight: 700; width: 22px; height: 22px; border-radius: 50%; text-align: center; line-height: 22px; }
    .step-text { font-size: 12px; color: #333; line-height: 1.7; padding-left: 10px; }

    .footer-bg { background-color: #111111; padding: 18px 40px; margin-top: 16px; }
    .footer-left { font-size: 10px; color: #8A7A60; font-style: italic; }
    .footer-center { font-size: 10px; letter-spacing: 3px; color: #D4AF37; text-transform: uppercase; text-align: center; }
    .footer-right { font-size: 10px; color: #8A7A60; text-align: right; }
  </style>
</head>
<body>

  <!-- EN-TÊTE -->
  <div class="header-bg">
    <table class="layout" width="100%"><tr>
      <td width="80"><img src="${logoUrl}" class="header-logo" /></td>
      <td style="padding-left:24px;">
        <div class="header-brand">✦ ChefGestion Pro ✦</div>
        ${restName ? `<div class="header-restaurant">🍽️ ${restName}</div>` : ''}
        <div class="header-chef">👨‍🍳 &nbsp; <span class="header-chef-title">Chef</span> &nbsp; ${chefName}</div>
      </td>
      <td class="header-date">📅 ${today}</td>
    </tr></table>
  </div>
  <div class="gold-bar"></div>

  <!-- TITRE DU PLAT -->
  <div class="title-section">
    <div class="title-box">
      <div class="title-label">📋 Fiche Technique de Production ${year}</div>
      <div class="title-name">${fNom || 'Sans titre'}</div>
    </div>
  </div>

  <!-- KPI CARDS -->
  <div class="kpi-table">
    <table class="layout" width="100%"><tr>
      <td class="kpi-cell"><div class="kpi-box"><div class="kpi-icon">🍽️</div><div class="kpi-label">Nb Portions</div><div class="kpi-value">${fPortions}</div></div></td>
      <td class="kpi-cell"><div class="kpi-box"><div class="kpi-icon">💰</div><div class="kpi-label">Coût Total HT</div><div class="kpi-value">${fc.total.toFixed(2)}€</div></div></td>
      <td class="kpi-cell"><div class="kpi-box"><div class="kpi-icon">🏷️</div><div class="kpi-label">Prix / Portion</div><div class="kpi-value">${fc.pp.toFixed(2)}€</div></div></td>
      <td class="kpi-cell"><div class="kpi-box"><div class="kpi-icon">📊</div><div class="kpi-label">Taux Marge</div><div class="kpi-value">${fc.tm.toFixed(1)}%</div></div></td>
    </tr></table>
  </div>

  <!-- TABLEAU INGRÉDIENTS -->
  <div class="section">
    <table class="section-head-table layout"><tr>
      <td class="section-icon">🥘</td>
      <td class="section-title">Ingrédients & Valorisation</td>
      <td class="section-line" width="100%"></td>
    </tr></table>

    <table class="ingredients">
      <thead><tr>
        <th>Denrée</th>
        <th style="text-align:center;">Unité</th>
        <th style="text-align:right;">Prix Unit. HT</th>
        <th style="text-align:center;">Quantité</th>
        <th style="text-align:right;">PR HT</th>
      </tr></thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="4" style="text-align:right; color:#1A1A1A;">TOTAL COÛT MATIÈRE HT</td>
          <td class="td-gold" style="font-size:15px;">${fc.total.toFixed(2)} €</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SYNTHÈSE FINANCIÈRE -->
  <div class="section">
    <table class="section-head-table layout"><tr>
      <td class="section-icon">💶</td>
      <td class="section-title">Synthèse Financière</td>
      <td class="section-line" width="100%"></td>
    </tr></table>

    <table class="layout" width="100%"><tr>
      <td class="synth-cell"><div class="kpi-box"><div class="kpi-label">PV HT</div><div class="kpi-value">${fc.pvht.toFixed(2)}€</div></div></td>
      <td class="synth-cell"><div class="kpi-box"><div class="kpi-label">Marge Brute</div><div class="kpi-value">${fc.mb.toFixed(2)}€</div></div></td>
      <td class="synth-cell"><div class="kpi-box"><div class="kpi-label">Prix Portion Avec Perte</div><div class="kpi-value">${fc.ppav.toFixed(2)}€</div></div></td>
    </tr></table>
  </div>

  <!-- PROGRESSION -->
  <div class="section">
    <table class="section-head-table layout"><tr>
      <td class="section-icon">👨‍🍳</td>
      <td class="section-title">Progression de la Recette</td>
      <td class="section-line" width="100%"></td>
    </tr></table>

    <div class="progression-box">
      <table class="step-table">
        ${(fProg || '—').split('\\n').filter(l => l.trim()).map((line, i) =>
          `<tr><td width="32" style="vertical-align:top;padding:3px 0;"><div class="step-num">${i + 1}</div></td><td class="step-text">${line.trim()}</td></tr>`
        ).join('')}
      </table>
    </div>
  </div>

  <!-- PIED DE PAGE -->
  <div class="footer-bg">
    <table class="layout" width="100%"><tr>
      <td class="footer-left" width="33%">📄 Document généré automatiquement</td>
      <td class="footer-center" width="34%">✦ ChefGestion Pro ✦</td>
      <td class="footer-right" width="33%">© ${year} — Tous droits réservés</td>
    </tr></table>
  </div>

  <script>(function(){var b=document.body,p=1122;if(b.scrollHeight>p){var s=p/b.scrollHeight;if(s<0.7)s=0.7;b.style.transform='scale('+s+')';b.style.transformOrigin='top left';b.style.width=(100/s)+'%';}})()</script>
</body>
</html>`;

    await Print.printAsync({ html });
  }

  async function saveFiche() {
    if (!fNom.trim()) {
      Alert.alert('Erreur', 'Donnez un nom à votre plat avant de sauvegarder.');
      return;
    }
    try {
      const fc = ficheCalc();
      await Fiches.save({
        nom: fNom.trim(),
        portions: parseInt(fPortions) || 4,
        pv_ttc: parseFloat(fPV) || 0,
        perte: parseFloat(fPerte) || 2,
        progression: fProg,
        ingredients: ficheIngs,
        total_ht: fc.total,
        emoji: ficheEmoji,
      });
      Alert.alert('✅ Fiche sauvegardée !', 'Retrouvez-la dans Plus → Répertoire de Fiches Techniques');
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de sauvegarder la fiche.');
    }
  }

  // ─── GENERATE RECIPES ─────
  async function genRecipes() {
    setRecLoading(true);
    try {
      // On utilise la fonction Scan.recipes définie dans ton api.ts
      const data = await Scan.recipes(recStyle, recCat);
      setRecipes(data || []);
      setRecShowCount(3);
    } catch (err) {
      console.error(err);
      Alert.alert('Erreur', 'Impossible de générer des idées de recettes.');
    } finally {
      setRecLoading(false);
    }
  }

  const fc = ficheCalc();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Image
      source={require('../../assets/logo.png')}
      style={{ width: 34, height: 34, borderRadius: 8, marginRight: 10 }}
      resizeMode="contain"
    />
    <View>
      <Text style={styles.headerTitle}>Boîte à Outils</Text>
      <Text style={styles.headerSub}>Calculs & Fiches techniques</Text>
    </View>
  </View>
</View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* 1. Marge */}
        <Accordion icon="📐" title="Calculateur de Marge">
          <View style={styles.row}><CalcField label="Prix vente TTC (€)" value={mPV} onChange={setMPV} /><View style={{ width: 10 }} /><CalcField label="Coût matière HT (€)" value={mCM} onChange={setMCM} /></View>
          <View style={{ marginTop: 10 }}><CalcField label="TVA (%)" value={mTVA} onChange={setMTVA} placeholder="10" /></View>
          <View style={{ height: 12 }} />
          <ResultBox items={margeCalc()} />
        </Accordion>

        {/* 2. Simulateur */}
        <Accordion icon="⚖️" title="Simulateur Coût Matière">
          <View style={styles.row}><CalcField label="Prix /kg ou /L (€)" value={sPrix} onChange={setSPrix} /><View style={{ width: 10 }} /><CalcField label="Quantité / portion (g/ml)" value={sQte} onChange={setSQte} placeholder="150" decimal={false} /></View>
          <View style={[styles.row, { marginTop: 10 }]}><CalcField label="Perte (%)" value={sPerte} onChange={setSPerte} placeholder="0" /><View style={{ width: 10 }} /><CalcField label="Nb portions" value={sNb} onChange={setSNb} placeholder="1" decimal={false} /></View>
          <View style={{ height: 12 }} />
          <ResultBox items={simCalc()} />
        </Accordion>

        {/* 3. Fiche Technique */}
        <Accordion icon="📄" title="Fiche Technique de Production">
          <View style={styles.row}>
            <View style={{ flex: 2 }}>
              <Text style={styles.calcLabel}>Nom du plat</Text>
              <TextInput style={styles.calcInput} value={fNom} onChangeText={setFNom} placeholder="Filet de Bar, beurre blanc" placeholderTextColor={Colors.muted} />
            </View>
            <View style={{ width: 10 }} />
            <CalcField label="Portions" value={fPortions} onChange={setFPortions} decimal={false} />
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <CalcField label="Prix vente TTC (€)" value={fPV} onChange={setFPV} />
            <View style={{ width: 10 }} />
            <CalcField label="% Perte (max 2%)" value={fPerte} onChange={setFPerte} />
          </View>

          <View style={styles.ingHeader}>
            <Text style={styles.calcLabel}>Ingrédients</Text>
            <TouchableOpacity onPress={() => setFicheIngs([...ficheIngs, { d: '', u: 'kg', p: '', q: '' }])}>
              <Text style={styles.addBtn}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>

          {ficheIngs.map((ing, i) => (
            <View key={i} style={styles.ingRow}>
              <TextInput style={[styles.calcInput, { flex: 2 }]} value={ing.d} onChangeText={v => { const a = [...ficheIngs]; a[i] = { ...a[i], d: v }; setFicheIngs(a); }} placeholder="Denrée" placeholderTextColor={Colors.muted} />
              <TextInput style={[styles.calcInput, { width: 55, textAlign: 'center' }]} value={ing.p} onChangeText={v => { const a = [...ficheIngs]; a[i] = { ...a[i], p: v.replace(',', '.') }; setFicheIngs(a); }} placeholder="PU HT" placeholderTextColor={Colors.muted} keyboardType="decimal-pad" />
              <TextInput style={[styles.calcInput, { width: 55, textAlign: 'center' }]} value={ing.q} onChangeText={v => { const a = [...ficheIngs]; a[i] = { ...a[i], q: v.replace(',', '.') }; setFicheIngs(a); }} placeholder="Qté" placeholderTextColor={Colors.muted} keyboardType="decimal-pad" />
              <TouchableOpacity onPress={() => setFicheIngs(ficheIngs.filter((_, j) => j !== i))}><Text style={{ color: Colors.muted, fontSize: 20, paddingHorizontal: 6 }}>×</Text></TouchableOpacity>
            </View>
          ))}

          <View style={styles.ficheTotals}>
            {[
              { l: 'Total PR HT', v: `${fc.total.toFixed(2)}€` },
              { l: 'PR / portion', v: `${fc.pp.toFixed(3)}€` },
              { l: 'Marge brute', v: `${fc.mb.toFixed(2)}€` },
              { l: 'Taux marge', v: fPV ? `${fc.tm.toFixed(1)}%` : '—' },
            ].map(it => (
              <View key={it.l} style={{ alignItems: 'center' }}>
                <Text style={styles.calcLabel}>{it.l}</Text>
                <Text style={styles.resVal}>{it.v}</Text>
              </View>
            ))}
          </View>
<Text style={styles.calcLabel}>Emoji de la fiche</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {FICHE_EMOJIS.map(e => (
                <TouchableOpacity
                  key={e.emoji}
                  style={{
                    padding: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', minWidth: 50,
                    borderColor: ficheEmoji === e.emoji ? Colors.gold : 'rgba(212,175,55,0.15)',
                    backgroundColor: ficheEmoji === e.emoji ? 'rgba(212,175,55,0.15)' : 'transparent',
                  }}
                  onPress={() => setFicheEmoji(ficheEmoji === e.emoji ? '' : e.emoji)}
                >
                  <Text style={{ fontSize: 22 }}>{e.emoji}</Text>
                  <Text style={{ fontSize: 8, color: Colors.muted, marginTop: 2 }}>{e.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Text style={styles.calcLabel}>Progression de la recette</Text>
          <TextInput style={[styles.calcInput, { height: 80, textAlignVertical: 'top' }]} value={fProg} onChangeText={setFProg} placeholder="Étapes de préparation..." placeholderTextColor={Colors.muted} multiline numberOfLines={3} />

          <View style={{ height: 12 }} />
          <Btn label="🖨️  Imprimer la Fiche" onPress={printFiche} />
          <View style={{ height: 8 }} />
          <Btn label="💾  Enregistrer la Fiche" onPress={saveFiche} variant="outline" />
          <Text style={{ color: Colors.muted, fontSize: 10, fontStyle: 'italic', textAlign: 'center', marginTop: 6 }}>
            Retrouvez vos fiches dans Plus → Répertoire de Fiches Techniques
          </Text>
        </Accordion>

        {/* 4. Recettes IA */}
        <Accordion icon="🍽️" title="Générateur de Recettes IA">
          <Text style={{ fontSize: 13, color: Colors.muted, fontStyle: 'italic', marginBottom: 14 }}>
            Suggestions basées sur vos produits en stock (factures scannées)
          </Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.calcLabel}>Style</Text>
              {['bistronomique', 'gastronomique', 'brasserie', 'traditionelle'].map(s => (
                <TouchableOpacity key={s} style={[styles.selBtn, recStyle === s && styles.selBtnActive]} onPress={() => setRecStyle(s)}>
                  <Text style={[styles.selTxt, recStyle === s && styles.selTxtActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.calcLabel}>Catégorie</Text>
              {['entree', 'plat', 'dessert'].map(c => (
                <TouchableOpacity key={c} style={[styles.selBtn, recCat === c && styles.selBtnActive]} onPress={() => setRecCat(c)}>
                  <Text style={[styles.selTxt, recCat === c && styles.selTxtActive]}>{c === 'entree' ? 'Entrée' : c === 'plat' ? 'Plat' : 'Dessert'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ height: 12 }} />
          <Btn label="✨  Générer des idées" onPress={genRecipes} loading={recLoading} />

          {recipes.slice(0, recShowCount).map((r, i) => (
  <View key={i} style={styles.recipeCard}>
    <Text style={styles.recipeName}>{r.nom}</Text>
    <Text style={styles.recipeDesc}>{r.description}</Text>
    <Text style={styles.recipeIngs}>🥕 {(r.ingredients_principaux || []).join(', ')}</Text>
    <View style={styles.recipeRow}>
      <Text style={styles.recipeTime}>⏱ {r.temps_preparation} · {r.difficulte}</Text>
      <Text style={styles.recipePrice}>~{r.suggestion_prix}€</Text>
    </View>
  </View>
))}

{recipes.length > 3 && (
  <TouchableOpacity
    style={{ alignItems: 'center', paddingVertical: 12, marginTop: 8 }}
    onPress={() => setRecShowCount(recShowCount >= recipes.length ? 3 : recipes.length)}
  >
    <Text style={{ color: Colors.gold, fontSize: 11, fontFamily: 'Cinzel_400Regular', letterSpacing: 1 }}>
      {recShowCount >= recipes.length ? '▲  RÉDUIRE' : `▼  VOIR TOUT (${recipes.length} recettes)`}
    </Text>
  </TouchableOpacity>
)}
        </Accordion>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.blackSoft },
  header: { padding: Spacing.md, backgroundColor: Colors.charcoal, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)' },
  headerTitle: { fontWeight: 'bold', fontSize: 18, color: Colors.cream },
  headerSub: { fontSize: 11, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: 90 },

  acc: { backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.13)', borderRadius: Radius.md, marginBottom: 10, overflow: 'hidden' },
  accHead: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  accIcon: { fontSize: 22 },
  accTitle: { flex: 1, fontWeight: 'normal', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: Colors.gold },
  accArrow: { color: Colors.muted, fontSize: 12 },
  accArrowOpen: { transform: [{ rotate: '180deg' }] },
  accBody: { padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.08)' },

  row: { flexDirection: 'row' },
  calcLabel: { fontWeight: 'normal', fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: Colors.mutedLight, marginBottom: 6 },
  calcInput: { backgroundColor: Colors.blackMid, borderWidth: 1, borderColor: 'rgba(212,175,55,0.18)', borderRadius: Radius.sm, padding: 11, color: Colors.cream, fontSize: 15, fontFamily: 'System' },

  resBox: { backgroundColor: 'rgba(212,175,55,0.07)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', borderRadius: Radius.sm, flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  resItem: { alignItems: 'center', minWidth: '22%' },
  resLabel: { fontFamily: 'Cinzel_400Regular', fontSize: 7, letterSpacing: 1.5, textTransform: 'uppercase', color: Colors.muted, marginBottom: 3 },
  resVal: { fontFamily: 'System', fontSize: 18, color: Colors.gold },

  ingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 8 },
  addBtn: { fontFamily: 'Cinzel_400Regular', fontSize: 9, letterSpacing: 1.5, color: Colors.gold, textTransform: 'uppercase' },
  ingRow: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' },

  ficheTotals: { backgroundColor: 'rgba(212,175,55,0.06)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.18)', borderRadius: Radius.sm, flexDirection: 'row', justifyContent: 'space-around', padding: 14, marginBottom: 14, marginTop: 8 },

  selBtn: { borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', borderRadius: 6, padding: 8, marginBottom: 6 },
  selBtnActive: { borderColor: Colors.gold, backgroundColor: 'rgba(212,175,55,0.1)' },
  selTxt: { fontFamily: 'Cinzel_400Regular', fontSize: 9, letterSpacing: 1, textTransform: 'capitalize', color: Colors.muted },
  selTxtActive: { color: Colors.gold },

  recipeCard: { backgroundColor: Colors.charcoal2, borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)', borderRadius: Radius.sm, padding: 14, marginTop: 12 },
  recipeName: { fontFamily: 'Cinzel_400Regular', fontSize: 13, color: Colors.cream, marginBottom: 6 },
  recipeDesc: { fontSize: 13, color: Colors.muted, fontStyle: 'italic', marginBottom: 8, lineHeight: 18 },
  recipeIngs: { fontSize: 12, color: Colors.creamDark, marginBottom: 8 },
  recipeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  recipeTime: { fontSize: 11, color: Colors.muted },
  recipePrice: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: Colors.gold },
});