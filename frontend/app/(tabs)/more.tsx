import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Image, StyleSheet, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { Card, Btn, ListItem, Empty, SectionTitle } from '@/components/UI';
import { useApp } from '@/lib/context';
import { Auth, Suppliers, Haccp, Dashboard } from '@/lib/api';

type SubPage = null | 'suppliers' | 'haccp' | 'settings';

export default function MoreScreen() {
  const [sub, setSub] = useState<SubPage>(null);
  const { user, state, apiKey, setApiKey, addSupplier, addHaccpPhoto, clearAllData, logout } = useApp();

  const initials = user?.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() ?? 'C';

  function goSub(p: SubPage) { setSub(p); }
  function goBack() { setSub(null); }

  if (sub === 'suppliers') return <SuppliersPage goBack={goBack} state={state} addSupplier={addSupplier} />;
  if (sub === 'haccp')     return <HaccpPage goBack={goBack} state={state} addHaccpPhoto={addHaccpPhoto} />;
  if (sub === 'settings')  return <SettingsPage goBack={goBack} user={user} apiKey={apiKey} setApiKey={setApiKey} clearAllData={clearAllData} state={state} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Plus</Text>
        <Text style={styles.headerSub}>Navigation</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <SectionTitle>Modules</SectionTitle>
        <Card>
          <ListItem icon="🏭" title="Fournisseurs" subtitle="Catalogue produits & comparateur prix" onPress={() => goSub('suppliers')} />
          <ListItem icon="🌡️" title="Traçabilité HACCP" subtitle="Étiquettes & relevés températures" onPress={() => goSub('haccp')} />
          <ListItem icon="⚙️" title="Paramètres" subtitle="Clé API, compte, données" onPress={() => goSub('settings')} />
        </Card>

        <SectionTitle>Mon compte</SectionTitle>
        <Card>
          <View style={styles.profileRow}>
            <View style={styles.avatar}><Text style={styles.avatarTxt}>{initials}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user?.name}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </View>
          <View style={{ padding: 14, paddingTop: 0 }}>
            <Btn label="Se déconnecter" onPress={() => { logout(); router.replace('/(auth)/login'); }} variant="outline" />
          </View>
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── SUPPLIERS ───────────────────────────────────────────
function SuppliersPage({ goBack, state, addSupplier }: any) {
  const [name, setName] = useState('');

  function productMap() {
    const pm: Record<string, { sup: string; price: number; unit: string }[]> = {};
    Object.entries(state.suppliers).forEach(([sup, d]: any) => {
      d.products.forEach((p: any) => {
        if (!pm[p.name]) pm[p.name] = [];
        pm[p.name].push({ sup, price: p.price, unit: p.unit });
      });
    });
    return Object.entries(pm).filter(([, v]) => v.length >= 2);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerSub2}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
        <View><Text style={styles.headerTitle}>Fournisseurs</Text><Text style={styles.subTxt}>Catalogue & comparateur</Text></View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.addRow}>
          <TextInput style={[styles.addInput, { flex: 1 }]} value={name} onChangeText={setName} placeholder="Nom du fournisseur..." placeholderTextColor={Colors.muted} />
          <Btn label="+" onPress={() => { if (name) { addSupplier(name); setName(''); } }} style={{ paddingHorizontal: 20 }} />
        </View>

        <SectionTitle>Mes Fournisseurs</SectionTitle>
        {Object.keys(state.suppliers).length === 0 ? (
          <Empty icon="🏭" text={"Ils apparaissent automatiquement\naprès vos premiers scans"} />
        ) : (
          Object.entries(state.suppliers).map(([sup, d]: any) => (
            <Card key={sup}>
              <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)' }}>
                <Text style={styles.supName}>{sup}</Text>
                <Text style={styles.supCount}>{d.products.length} produit(s)</Text>
              </View>
              {d.products.slice(0, 5).map((p: any, i: number) => (
                <View key={i} style={styles.prodRow}>
                  <Text style={styles.prodName}>{p.name}</Text>
                  <Text style={styles.prodPrice}>{(p.price || 0).toFixed(2)}€/{p.unit || 'u'}</Text>
                </View>
              ))}
              {d.products.length > 5 && <Text style={styles.more}>+{d.products.length - 5} produits...</Text>}
            </Card>
          ))
        )}

        <SectionTitle>🏆 Meilleur Prix / Produit</SectionTitle>
        {productMap().length === 0 ? (
          <Empty icon="💰" text="Comparez 2+ fournisseurs pour le même produit" />
        ) : (
          productMap().map(([prod, offers]) => {
            const sorted = [...offers].sort((a, b) => a.price - b.price);
            return (
              <Card key={prod}>
                <View style={{ padding: 14 }}>
                  <Text style={styles.supName}>{prod}</Text>
                  {sorted.map((o, i) => (
                    <View key={o.sup} style={[styles.offerRow, i === 0 && styles.offerBest]}>
                      <Text style={[styles.offerSup, i === 0 && { color: Colors.ok }]}>{o.sup}</Text>
                      <Text style={[styles.offerPrice, i === 0 && { color: Colors.ok }]}>{o.price.toFixed(2)}€/{o.unit}{i === 0 ? ' 🏆' : ''}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── HACCP ───────────────────────────────────────────────
function HaccpPage({ goBack, state, addHaccpPhoto }: any) {
  const EQUIPS = ['Chambre froide 1', 'Chambre froide 2', 'Vitrine poisson', 'Congélateur'];
  const [temps, setTemps] = useState<Record<string, string>>({});

  async function pickPhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission requise', 'Accès caméra nécessaire.'); return; }
    Alert.alert('Source', 'Importer la photo', [
      { text: 'Appareil photo', onPress: async () => { const r = await ImagePicker.launchCameraAsync({ quality: 0.7 }); if (!r.canceled) { const uri = r.assets[0].uri; addHaccpPhoto({ name: `Étiquette_${new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')}`, uri }); } } },
      { text: 'Galerie', onPress: async () => { const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 }); if (!r.canceled) { const uri = r.assets[0].uri; addHaccpPhoto({ name: `Photo_${new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')}`, uri }); } } },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }

  function getColor(v: string) {
    const n = parseFloat(v);
    return isNaN(n) ? Colors.cream : n <= 4 ? Colors.ok : n <= 6 ? Colors.warn : Colors.bad;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerSub2}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
        <View><Text style={styles.headerTitle}>Traçabilité HACCP</Text><Text style={styles.subTxt}>Sanitaire & températures</Text></View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <SectionTitle>Étiquettes Sanitaires</SectionTitle>
        <Btn label="📸  Ajouter une photo" onPress={pickPhoto} style={{ marginBottom: 16 }} />

        {state.haccpPhotos.length === 0 ? (
          <Empty icon="🏷️" text="Aucune étiquette enregistrée" />
        ) : (
          <View style={styles.photoGrid}>
            {state.haccpPhotos.map((p: any) => (
              <View key={p.id} style={styles.photoTile}>
                <Image source={{ uri: p.uri }} style={styles.photoImg} />
                <View style={{ padding: 8 }}>
                  <Text style={styles.photoName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.photoDate}>{p.date}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <SectionTitle>Fiche Relevés de Températures</SectionTitle>
        <Card>
          <View style={{ padding: 14 }}>
            {EQUIPS.map(eq => (
              <View key={eq} style={styles.tempRow}>
                <Text style={styles.tempEquip}>{eq}</Text>
                <View style={styles.tempInputs}>
                  {['Matin', 'Soir'].map(moment => {
                    const k = `${eq}_${moment}`;
                    return (
                      <View key={moment} style={{ alignItems: 'center', gap: 3 }}>
                        <Text style={styles.tempMoment}>{moment}</Text>
                        <TextInput
                          style={[styles.tempInput, { color: getColor(temps[k] || '') }]}
                          value={temps[k] || ''}
                          onChangeText={v => setTemps({ ...temps, [k]: v })}
                          keyboardType="decimal-pad"
                          placeholder="—"
                          placeholderTextColor={Colors.muted}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
            <Text style={{ fontSize: 11, color: Colors.muted, fontStyle: 'italic', marginTop: 12 }}>🟢 ≤4°C · 🟡 4–6°C · 🔴 {'>'}6°C non conforme</Text>
          </View>
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── SETTINGS ────────────────────────────────────────────
function SettingsPage({ goBack, user, apiKey, setApiKey, clearAllData, state }: any) {
  const [key, setKey] = useState(apiKey || '');

  async function saveKey() {
    try {
      await Auth.updateApiKey(key);
      setApiKey(key);
      if (user) setUser({ ...user, apiKey: key });
      Alert.alert('✅ Enregistrée', 'Clé API Gemini activée sur tous les scanners.');
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder la clé API.');
    }
  }

  function confirmClear() {
    Alert.alert('Effacer les données', 'Cette action est irréversible. Continuer ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: async () => {
        try { await Dashboard.clearData(); clearAllData(); }
        catch { clearAllData(); }
      }},
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerSub2}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
        <View><Text style={styles.headerTitle}>Paramètres</Text><Text style={styles.subTxt}>Configuration</Text></View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.settSection}>
          <Text style={styles.settLabel}>Intelligence Artificielle</Text>
          <View style={{ padding: 14 }}>
            <Text style={styles.settFieldLabel}>Clé API Google Gemini</Text>
            <Text style={{ fontSize: 11, color: Colors.muted, fontStyle: 'italic', marginBottom: 10 }}>Modèle : gemini-1.5-pro (vision)</Text>
            <TextInput style={styles.apiInput} value={key} onChangeText={setKey} placeholder="AIzaSy..." placeholderTextColor={Colors.muted} autoCapitalize="none" autoCorrect={false} />
            <View style={{ height: 10 }} />
            <Btn label="Enregistrer la clé" onPress={saveKey} />
          </View>
        </View>

        <View style={styles.settSection}>
          <Text style={styles.settLabel}>Statistiques</Text>
          <ListItem icon="📊" title="Factures scannées" subtitle={`${state.invoices.length} facture(s)`} chevron={false} />
          <ListItem icon="🏷️" title="Produits indexés" subtitle={`${Object.keys(state.priceDB).length} produit(s)`} chevron={false} />
          <ListItem icon="🏭" title="Fournisseurs" subtitle={`${Object.keys(state.suppliers).length} fournisseur(s)`} chevron={false} />
        </View>

        <View style={styles.settSection}>
          <Text style={styles.settLabel}>Données</Text>
          <View style={{ padding: 14 }}>
            <Btn label="🗑️  Effacer toutes les données" onPress={confirmClear} variant="danger" />
          </View>
        </View>

        <View style={styles.settSection}>
          <Text style={styles.settLabel}>À propos</Text>
          <ListItem icon="👨‍🍳" title="ChefGestion Pro" subtitle="v1.0 · Gestion cuisine française" chevron={false} />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.blackSoft },
  header: { padding: Spacing.md, backgroundColor: Colors.charcoal, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)' },
  headerTitle: { fontFamily: 'Cinzel_700SemiBold', fontSize: 18, color: Colors.cream },
  headerSub: { fontSize: 11, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },
  headerSub2: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.charcoal, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)', gap: 12 },
  subTxt: { fontSize: 11, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 28, color: Colors.gold, lineHeight: 32 },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: 90 },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.goldDark, borderWidth: 1, borderColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontFamily: 'Cinzel_700SemiBold', fontSize: 18, color: Colors.black },
  profileName: { fontSize: 16, color: Colors.cream, fontWeight: '600' },
  profileEmail: { fontSize: 13, color: Colors.muted, fontStyle: 'italic' },

  addRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  addInput: { backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', borderRadius: Radius.sm, padding: 12, color: Colors.cream, fontSize: 15 },

  supName: { fontFamily: 'Cinzel_400Regular', fontSize: 13, color: Colors.cream, marginBottom: 3 },
  supCount: { fontSize: 12, color: Colors.muted, fontStyle: 'italic' },
  prodRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  prodName: { fontSize: 13, color: Colors.creamDark },
  prodPrice: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: Colors.gold },
  more: { fontSize: 11, color: Colors.muted, fontStyle: 'italic', padding: 12 },
  offerRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 6, borderRadius: 6, marginTop: 6 },
  offerBest: { backgroundColor: 'rgba(74,222,128,0.08)' },
  offerSup: { fontSize: 13, color: Colors.muted },
  offerPrice: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: Colors.muted },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoTile: { width: '47%', backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)', borderRadius: Radius.sm, overflow: 'hidden' },
  photoImg: { width: '100%', height: 100 },
  photoName: { fontSize: 12, color: Colors.cream },
  photoDate: { fontFamily: 'DMSans_400Regular', fontSize: 10, color: Colors.muted, marginTop: 2 },

  tempRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', paddingBottom: 12 },
  tempEquip: { flex: 1, fontSize: 13, color: Colors.creamDark },
  tempInputs: { flexDirection: 'row', gap: 12 },
  tempMoment: { fontFamily: 'Cinzel_400Regular', fontSize: 7, letterSpacing: 1, textTransform: 'uppercase', color: Colors.muted },
  tempInput: { width: 52, backgroundColor: Colors.blackMid, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', borderRadius: 6, padding: 7, textAlign: 'center', fontFamily: 'DMSans_400Regular', fontSize: 14 },

  settSection: { backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)', borderRadius: Radius.md, overflow: 'hidden', marginBottom: 14 },
  settLabel: { fontFamily: 'Cinzel_400Regular', fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: Colors.gold, padding: 12, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.08)' },
  settFieldLabel: { fontFamily: 'Cinzel_400Regular', fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: Colors.mutedLight, marginBottom: 6 },
  apiInput: { backgroundColor: Colors.blackMid, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', borderRadius: Radius.sm, padding: 12, color: Colors.cream, fontFamily: 'DMSans_400Regular', fontSize: 14 },
});
