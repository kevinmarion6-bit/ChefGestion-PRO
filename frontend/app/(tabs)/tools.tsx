import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { Btn } from '@/components/UI';
import { useApp } from '@/lib/context';
import { Scan } from '@/lib/api';
import { Image } from 'react-native';
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
    const total = ficheIngs.reduce((s, i) => s + (parseFloat(i.p) || 0) * (parseFloat(i.q) || 0), 0);
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
    const rows = ficheIngs.map(i =>
      `<tr><td>${i.d}</td><td>${i.u}</td><td>${parseFloat(i.p || '0').toFixed(3)}€</td><td>${parseFloat(i.q || '0').toFixed(3)}</td><td>${((parseFloat(i.p || '0')) * (parseFloat(i.q || '0'))).toFixed(3)}€</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>body{font-family:Georgia,serif;max-width:740px;margin:32px auto;}h1{text-align:center;font-size:20px;border-bottom:2px solid #D4AF37;padding-bottom:10px;letter-spacing:2px;}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0;}.meta div{border:1px solid #ddd;padding:10px;}
      .meta label{font-size:9px;text-transform:uppercase;color:#666;display:block;}.meta span{font-size:18px;color:#A07D1C;font-weight:bold;}
      table{width:100%;border-collapse:collapse;}th{background:#111;color:#D4AF37;padding:8px;font-size:11px;text-align:left;}
      td{padding:7px 8px;border-bottom:1px solid #eee;}h2{font-size:13px;letter-spacing:2px;border-bottom:1px solid #D4AF37;margin:18px 0 10px;}
      pre{white-space:pre-wrap;font-size:13px;line-height:1.6;}</style></head><body>
      <h1>FICHE TECHNIQUE DE PRODUCTION 2024</h1>
      <div class="meta"><div><label>Nom du plat</label><span>${fNom || 'Sans titre'}</span></div><div><label>Nb portions</label><span>${fPortions}</span></div>
      <div><label>Total PR HT</label><span>${fc.total.toFixed(2)}€</span></div><div><label>PV HT / Taux marge</label><span>${fc.pvht.toFixed(2)}€ / ${fc.tm.toFixed(1)}%</span></div></div>
      <table><thead><tr><th>Denrée</th><th>Unité</th><th>Prix HT</th><th>Qté</th><th>PR HT</th></tr></thead><tbody>${rows}</tbody></table>
      <h2>PROGRESSION DE LA RECETTE</h2><pre>${fProg || '—'}</pre></body></html>`;
    await Print.printAsync({ html });
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
      style={{ width: 28, height: 28, borderRadius: 6, marginRight: 10 }}
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
              <TextInput style={[styles.calcInput, { width: 55, textAlign: 'center' }]} value={ing.p} onChangeText={v => { const a = [...ficheIngs]; a[i] = { ...a[i], p: v }; setFicheIngs(a); }} placeholder="PU HT" placeholderTextColor={Colors.muted} keyboardType="decimal-pad" />
              <TextInput style={[styles.calcInput, { width: 55, textAlign: 'center' }]} value={ing.q} onChangeText={v => { const a = [...ficheIngs]; a[i] = { ...a[i], q: v }; setFicheIngs(a); }} placeholder="Qté" placeholderTextColor={Colors.muted} keyboardType="decimal-pad" />
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

          <Text style={styles.calcLabel}>Progression de la recette</Text>
          <TextInput style={[styles.calcInput, { height: 80, textAlignVertical: 'top' }]} value={fProg} onChangeText={setFProg} placeholder="Étapes de préparation..." placeholderTextColor={Colors.muted} multiline numberOfLines={3} />

          <View style={{ height: 12 }} />
          <Btn label="🖨️  Imprimer la Fiche" onPress={printFiche} />
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

{recipes.length > recShowCount && (
  <TouchableOpacity
    style={{
      borderWidth: 1,
      borderColor: 'rgba(212,175,55,0.3)',
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 12,
      backgroundColor: 'rgba(212,175,55,0.06)',
    }}
    onPress={() => setRecShowCount(prev => Math.min(prev + 3, recipes.length))}
  >
    <Text style={{
      color: Colors.gold,
      fontFamily: 'Cinzel_400Regular',
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    }}>
      ✨ Voir Plus ({recipes.length - recShowCount} restantes)
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
