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
      return `<tr>
        <td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #EEE;background-color:${idx % 2 === 0 ? '#FFFFFF' : '#FAFAF7'};">${i.d || '—'}</td>
        <td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #EEE;text-align:center;color:#555;background-color:${idx % 2 === 0 ? '#FFFFFF' : '#FAFAF7'};">${i.u}</td>
        <td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #EEE;text-align:right;background-color:${idx % 2 === 0 ? '#FFFFFF' : '#FAFAF7'};">${prix.toFixed(3)} €</td>
        <td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #EEE;text-align:center;background-color:${idx % 2 === 0 ? '#FFFFFF' : '#FAFAF7'};">${qte.toFixed(3)}</td>
        <td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #EEE;text-align:right;color:#A07D1C;font-weight:bold;background-color:${idx % 2 === 0 ? '#FFFFFF' : '#FAFAF7'};">${total.toFixed(3)} €</td>
      </tr>`;
    }).join('');

    const stepRows = (fProg || '—').split('\n').filter(l => l.trim()).map((line, i) =>
      `<tr>
        <td width="32" style="vertical-align:top;padding:4px 0;">
          <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#D4AF37;color:#FFFFFF;font-size:10px;font-weight:bold;width:22px;height:22px;text-align:center;">
            ${i + 1}
          </td></tr></table>
        </td>
        <td style="font-size:12px;color:#333333;line-height:1.7;padding:4px 0 4px 10px;">${line.trim()}</td>
      </tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Helvetica,Arial,sans-serif;color:#2C2C2C;margin:0;padding:0;padding-bottom:60px;">

<!-- EN-TÊTE -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111;">
  <tr>
    <td style="padding:20px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="80" style="vertical-align:middle;">
            <img src="${logoUrl}" width="90" height="90" />
          </td>
          <td style="padding-left:24px;vertical-align:middle;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr><td style="font-size:14px;letter-spacing:5px;text-transform:uppercase;color:#D4AF37;padding-bottom:4px;">✦ ChefGestion Pro ✦</td></tr>
              ${restName ? `<tr><td style="font-size:24px;color:#F5F5DC;font-weight:bold;letter-spacing:1px;">🍽️ ${restName}</td></tr>` : ''}
              <tr><td style="font-size:14px;color:#F5F5DC;padding-top:5px;">👨‍🍳 &nbsp; <span style="color:#D4AF37;font-weight:bold;">Chef</span> &nbsp; ${chefName}</td></tr>
            </table>
          </td>
          <td style="vertical-align:middle;text-align:right;">
            <span style="font-size:9px;color:#8A7A60;text-transform:uppercase;letter-spacing:1px;">Exporté le</span>
          <br/><span style="font-size:14px;color:#8A7A60;">📅 ${today}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<!-- BARRE DORÉE -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="height:3px;background-color:#D4AF37;"></td></tr>
</table>

<!-- TITRE DU PLAT -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="text-align:center;padding:14px 40px 0;">
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="border:2px solid #D4AF37;">
      <tr><td style="padding:10px 20px;text-align:center;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#A07D1C;text-align:center;padding-bottom:6px;">📋 Fiche Technique de Production ${year}</td></tr>
          <tr><td style="font-size:26px;color:#1A1A1A;font-weight:bold;letter-spacing:1px;text-align:center;">${fNom || 'Sans titre'}</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>

<!-- KPI CARDS -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:14px 40px;">
    <table width="100%" cellpadding="4" cellspacing="0" border="0">
      <tr>
        <td width="25%" style="vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;">
            <tr><td style="text-align:center;padding:8px 6px;background-color:#FAFAF7;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="font-size:16px;text-align:center;padding-bottom:4px;">🍽️</td></tr>
                <tr><td style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;text-align:center;padding-bottom:4px;">Nb Portions</td></tr>
                <tr><td style="font-size:20px;color:#A07D1C;font-weight:bold;text-align:center;">${fPortions}</td></tr>
              </table>
            </td></tr>
          </table>
        </td>
        <td width="25%" style="vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;">
            <tr><td style="text-align:center;padding:8px 6px;background-color:#FAFAF7;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="font-size:16px;text-align:center;padding-bottom:4px;">💰</td></tr>
                <tr><td style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;text-align:center;padding-bottom:4px;">Coût Total HT</td></tr>
                <tr><td style="font-size:20px;color:#A07D1C;font-weight:bold;text-align:center;">${fc.total.toFixed(2)}€</td></tr>
              </table>
            </td></tr>
          </table>
        </td>
        <td width="25%" style="vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;">
            <tr><td style="text-align:center;padding:8px 6px;background-color:#FAFAF7;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="font-size:16px;text-align:center;padding-bottom:4px;">🏷️</td></tr>
                <tr><td style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;text-align:center;padding-bottom:4px;">Prix / Portion</td></tr>
                <tr><td style="font-size:20px;color:#A07D1C;font-weight:bold;text-align:center;">${fc.pp.toFixed(2)}€</td></tr>
              </table>
            </td></tr>
          </table>
        </td>
        <td width="25%" style="vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;">
            <tr><td style="text-align:center;padding:8px 6px;background-color:#FAFAF7;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="font-size:16px;text-align:center;padding-bottom:4px;">📊</td></tr>
                <tr><td style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;text-align:center;padding-bottom:4px;">Taux Marge</td></tr>
                <tr><td style="font-size:20px;color:#A07D1C;font-weight:bold;text-align:center;">${fc.tm.toFixed(1)}%</td></tr>
              </table>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>
</table>

<!-- SECTION INGRÉDIENTS -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:0 40px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
      <tr>
        <td width="26" style="font-size:16px;vertical-align:middle;">🥘</td>
        <td style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#1A1A1A;font-weight:bold;vertical-align:middle;white-space:nowrap;padding-right:10px;">Ingrédients &amp; Valorisation</td>
        <td width="100%" style="vertical-align:middle;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-bottom:1px solid #D4AF37;height:1px;"></td></tr></table></td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-collapse:collapse;">
      <tr>
        <th style="background-color:#111111;color:#D4AF37;padding:8px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:left;border:1px solid #E8E0D0;">Denrée</th>
        <th style="background-color:#111111;color:#D4AF37;padding:8px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:center;border:1px solid #E8E0D0;">Unité</th>
        <th style="background-color:#111111;color:#D4AF37;padding:8px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:right;border:1px solid #E8E0D0;">Prix Unit. HT</th>
        <th style="background-color:#111111;color:#D4AF37;padding:8px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:center;border:1px solid #E8E0D0;">Quantité</th>
        <th style="background-color:#111111;color:#D4AF37;padding:8px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:right;border:1px solid #E8E0D0;">PR HT</th>
      </tr>
      ${rows}
      <tr>
        <td colspan="4" style="padding:10px;text-align:right;font-weight:bold;font-size:13px;color:#1A1A1A;border-top:2px solid #D4AF37;background-color:#FBF8F0;">TOTAL COÛT MATIÈRE HT</td>
        <td style="padding:10px;text-align:right;color:#A07D1C;font-weight:bold;font-size:15px;border-top:2px solid #D4AF37;background-color:#FBF8F0;">${fc.total.toFixed(2)} €</td>
      </tr>
    </table>
  </td></tr>
</table>

<!-- SECTION SYNTHÈSE FINANCIÈRE -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:0 40px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
      <tr>
        <td width="26" style="font-size:16px;vertical-align:middle;">💶</td>
        <td style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#1A1A1A;font-weight:bold;vertical-align:middle;white-space:nowrap;padding-right:10px;">Synthèse Financière</td>
        <td width="100%" style="vertical-align:middle;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-bottom:1px solid #D4AF37;height:1px;"></td></tr></table></td>
      </tr>
    </table>

    <table width="100%" cellpadding="4" cellspacing="0" border="0">
      <tr>
        <td width="33%" style="vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;">
            <tr><td style="text-align:center;padding:8px 6px;background-color:#FAFAF7;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;text-align:center;padding-bottom:4px;">PV HT</td></tr>
                <tr><td style="font-size:20px;color:#A07D1C;font-weight:bold;text-align:center;">${fc.pvht.toFixed(2)}€</td></tr>
              </table>
            </td></tr>
          </table>
        </td>
        <td width="33%" style="vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;">
            <tr><td style="text-align:center;padding:8px 6px;background-color:#FAFAF7;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;text-align:center;padding-bottom:4px;">Marge Brute</td></tr>
                <tr><td style="font-size:20px;color:#A07D1C;font-weight:bold;text-align:center;">${fc.mb.toFixed(2)}€</td></tr>
              </table>
            </td></tr>
          </table>
        </td>
        <td width="34%" style="vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;">
            <tr><td style="text-align:center;padding:8px 6px;background-color:#FAFAF7;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;text-align:center;padding-bottom:4px;">Prix Portion Avec Perte</td></tr>
                <tr><td style="font-size:20px;color:#A07D1C;font-weight:bold;text-align:center;">${fc.ppav.toFixed(2)}€</td></tr>
              </table>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>
</table>

<!-- SECTION PROGRESSION -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:0 40px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
      <tr>
        <td width="26" style="font-size:16px;vertical-align:middle;">👨‍🍳</td>
        <td style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#1A1A1A;font-weight:bold;vertical-align:middle;white-space:nowrap;padding-right:10px;">Progression de la Recette</td>
        <td width="100%" style="vertical-align:middle;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-bottom:1px solid #D4AF37;height:1px;"></td></tr></table></td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;background-color:#FAFAF7;">
      <tr><td style="padding:14px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${stepRows}
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>

<!-- PIED DE PAGE -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111;position:fixed;bottom:0;left:0;right:0;">
  <tr>
    <td width="33%" style="padding:18px 40px;font-size:10px;color:#8A7A60;font-style:italic;">📄 Document généré automatiquement</td>
    <td width="34%" style="padding:18px 0;font-size:10px;letter-spacing:3px;color:#D4AF37;text-transform:uppercase;text-align:center;">✦ ChefGestion Pro ✦</td>
    <td width="33%" style="padding:18px 40px;font-size:10px;color:#8A7A60;text-align:right;">© ${year} — Tous droits réservés</td>
  </tr>
</table>

<script>
(function(){
  var b=document.body,p=1122;
  if(b.scrollHeight>p){
    var s=p/b.scrollHeight;
    if(s<0.7)s=0.7;
    b.style.transform='scale('+s+')';
    b.style.transformOrigin='top left';
    b.style.width=(100/s)+'%';
  }
})();
</script>
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