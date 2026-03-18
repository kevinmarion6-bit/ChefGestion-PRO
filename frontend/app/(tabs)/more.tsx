import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { Card, Btn, ListItem, Empty, SectionTitle } from '@/components/UI';
import { useApp } from '@/lib/context';
import { Auth, Dashboard } from '@/lib/api';
import { getToken } from '@/lib/auth';

type SubPage = null | 'suppliers' | 'haccp' | 'settings';

export default function MoreScreen() {
  const [sub, setSub] = useState<SubPage>(null);
  const { user, state, addHaccpPhoto, clearAllData, logout } = useApp();

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
    : 'C';

  function goSub(p: SubPage) { setSub(p); }
  function goBack() { setSub(null); }

  if (sub === 'suppliers') return <SuppliersPage goBack={goBack} />;
  if (sub === 'haccp')     return <HaccpPage goBack={goBack} state={state} addHaccpPhoto={addHaccpPhoto} />;
  if (sub === 'settings')  return <SettingsPage goBack={goBack} clearAllData={clearAllData} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Image
  source={require('../../assets/logo.png')}
  style={{ width: 28, height: 28, borderRadius: 6, marginRight: 10 }}
  resizeMode="contain"
/>
        <Text style={styles.headerTitle}>Plus</Text>
        <Text style={styles.headerSub}>Navigation & Configuration</Text>
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

// ─── FOURNISSEURS ─────────────────────────────────────────
// FIX 7 : Les fournisseurs sont chargés depuis l'API directement
// (state.suppliers n'existe pas dans DashboardData)
function SuppliersPage({ goBack }: any) {
  const [name, setName]           = useState('');
  const [suppliers, setSuppliers] = useState<Record<string, any>>({});
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('https://chefgestion-pro.onrender.com/api/suppliers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) setSuppliers(json.data ?? {});
    } catch (e) {
      console.error('[Suppliers]', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    try {
      const token = await getToken();
      const res = await fetch('https://chefgestion-pro.onrender.com/api/suppliers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (json.ok || json.data) {
        setName('');
        loadSuppliers();
        Alert.alert('✅ Ajouté !', `"${name.trim()}" a été créé.`);
      } else {
        Alert.alert('Erreur', json.error ?? 'Impossible d\'ajouter ce fournisseur.');
      }
    } catch (e) {
      Alert.alert('Erreur', 'Connexion impossible.');
    } finally {
      setAdding(false);
    }
  }

  function productMap() {
    const pm: Record<string, { sup: string; price: number; unit: string }[]> = {};
    Object.entries(suppliers).forEach(([sup, d]: any) => {
      (d.products ?? []).forEach((p: any) => {
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
          <TextInput
            style={[styles.addInput, { flex: 1 }]}
            value={name}
            onChangeText={setName}
            placeholder="Nom du fournisseur..."
            placeholderTextColor={Colors.muted}
            onSubmitEditing={handleAdd}
          />
          <Btn
            label={adding ? '...' : '+'}
            onPress={handleAdd}
            style={{ paddingHorizontal: 20 }}
          />
        </View>

        <SectionTitle>Mes Fournisseurs</SectionTitle>

        {loading ? (
          <ActivityIndicator color={Colors.gold} style={{ marginTop: 20 }} />
        ) : Object.keys(suppliers).length === 0 ? (
          <Empty icon="🏭" text={"Ils apparaissent automatiquement\naprès vos premiers scans"} />
        ) : (
          Object.entries(suppliers).map(([sup, d]: any) => (
            <Card key={sup}>
              <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)' }}>
                <Text style={styles.supName}>{sup}</Text>
                <Text style={styles.supCount}>{(d.products ?? []).length} produit(s)</Text>
              </View>
              {(d.products ?? []).slice(0, 5).map((p: any, i: number) => (
                <View key={i} style={styles.prodRow}>
                  <Text style={styles.prodName}>{p.name}</Text>
                  <Text style={styles.prodPrice}>{(p.price || 0).toFixed(2)}€/{p.unit || 'u'}</Text>
                </View>
              ))}
            </Card>
          ))
        )}

        {productMap().length > 0 && (
          <>
            <SectionTitle style={{ marginTop: 20 }}>Comparateur Prix</SectionTitle>
            {productMap().map(([prod, offers]) => (
              <Card key={prod} style={{ marginBottom: 8 }}>
                <Text style={{ color: Colors.cream, padding: 12, fontWeight: 'bold' }}>{prod}</Text>
                {offers.sort((a, b) => a.price - b.price).map((o, i) => (
                  <View key={i} style={styles.prodRow}>
                    <Text style={[styles.prodName, i === 0 && { color: Colors.ok }]}>{o.sup}</Text>
                    <Text style={[styles.prodPrice, i === 0 && { color: Colors.ok }]}>
                      {o.price.toFixed(2)}€/{o.unit}
                    </Text>
                  </View>
                ))}
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── HACCP ────────────────────────────────────────────────
function HaccpPage({ goBack, state, addHaccpPhoto }: any) {
  const [fridges, setFridges]           = useState<any[]>([]);
  const [loadingFridges, setLoadingFridges] = useState(true);
  const [showAddFridge, setShowAddFridge]   = useState(false);
  const [newFridgeName, setNewFridgeName]   = useState('');
  const [newFridgeType, setNewFridgeType]   = useState<'positif' | 'negatif'>('positif');

  const photos = state?.haccpPhotos || [];

  useEffect(() => {
    loadFridges();
  }, []);

  async function loadFridges() {
    setLoadingFridges(true);
    try {
      const token = await getToken();
      const res = await fetch('https://chefgestion-pro.onrender.com/api/fridges', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) setFridges(json.data ?? []);
    } catch (e) {
      console.error('[Frigos]', e);
    } finally {
      setLoadingFridges(false);
    }
  }

  async function addFridge() {
    if (!newFridgeName.trim()) {
      Alert.alert('Erreur', 'Donne un nom à cet équipement');
      return;
    }
    try {
      const token = await getToken();
      const res = await fetch('https://chefgestion-pro.onrender.com/api/fridges', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: newFridgeName.trim(), type: newFridgeType }),
      });
      const json = await res.json();
      if (json.ok) {
        setNewFridgeName('');
        setShowAddFridge(false);
        loadFridges();
        Alert.alert('✅ Ajouté !', `"${json.data.nom}" a été créé.`);
      }
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'ajouter cet équipement");
    }
  }

  async function deleteFridge(id: string, nom: string) {
    Alert.alert('Supprimer ?', `Supprimer "${nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          const token = await getToken();
          await fetch(`https://chefgestion-pro.onrender.com/api/fridges/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          loadFridges();
        },
      },
    ]);
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission requise', 'Accès caméra nécessaire.'); return; }

    Alert.alert('Source', 'Importer la photo', [
      {
        text: 'Appareil photo', onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          if (!r.canceled) addHaccpPhoto({
            name: `Étiquette_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}`,
            uri: r.assets[0].uri,
          });
        },
      },
      {
        text: 'Galerie', onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
          if (!r.canceled) addHaccpPhoto({
            name: `Photo_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}`,
            uri: r.assets[0].uri,
          });
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerSub2}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Traçabilité HACCP</Text>
          <Text style={styles.subTxt}>Sanitaire & températures</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* ─── Mes équipements froids ─── */}
        <SectionTitle>🌡️ Mes Équipements Froids</SectionTitle>
        <Text style={{ color: '#9A8060', fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
          Configure ici tes frigos et congélateurs. Ils apparaîtront lors de chaque scan.
        </Text>

        {loadingFridges ? (
          <ActivityIndicator color="#D4AF37" />
        ) : (
          <>
            {fridges.length === 0 && (
              <Card>
                <Text style={{ color: '#666', textAlign: 'center', padding: 20, fontSize: 13 }}>
                  Aucun équipement configuré.{'\n'}Ajoute ton premier frigo ci-dessous.
                </Text>
              </Card>
            )}

            {fridges.map((f: any) => (
              <Card key={f.id} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
                  <Text style={{ fontSize: 24 }}>{f.type === 'negatif' ? '🧊' : '❄️'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#E8D5A3', fontSize: 14, fontWeight: 'bold' }}>{f.nom}</Text>
                    <Text style={{ color: '#9A8060', fontSize: 11, marginTop: 2 }}>
                      {f.type === 'negatif' ? 'Congélateur' : 'Réfrigérateur'} ·
                      Cible : {f.temp_min}°C à {f.temp_max}°C
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteFridge(f.id, f.nom)}>
                    <Text style={{ color: '#F87171', fontSize: 18 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}

            {showAddFridge ? (
              <Card style={{ padding: 16, gap: 12 }}>
                <Text style={{ color: '#D4AF37', fontSize: 12, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>
                  NOUVEL ÉQUIPEMENT
                </Text>
                <TextInput
                  style={{ backgroundColor: '#111', borderWidth: 1, borderColor: '#D4AF37', borderRadius: 8, color: '#fff', padding: 12, fontSize: 14 }}
                  value={newFridgeName}
                  onChangeText={setNewFridgeName}
                  placeholder="Ex: Frigo Viandes, Congélateur N°2..."
                  placeholderTextColor="#444"
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', backgroundColor: newFridgeType === 'positif' ? '#D4AF37' : '#1a1a1a', borderWidth: 1, borderColor: '#D4AF37' }}
                    onPress={() => setNewFridgeType('positif')}
                  >
                    <Text style={{ fontSize: 20 }}>❄️</Text>
                    <Text style={{ color: newFridgeType === 'positif' ? '#000' : '#D4AF37', fontSize: 11, marginTop: 4, fontWeight: 'bold' }}>RÉFRIGÉRATEUR</Text>
                    <Text style={{ color: newFridgeType === 'positif' ? '#333' : '#666', fontSize: 10 }}>0°C à 8°C</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', backgroundColor: newFridgeType === 'negatif' ? '#D4AF37' : '#1a1a1a', borderWidth: 1, borderColor: '#D4AF37' }}
                    onPress={() => setNewFridgeType('negatif')}
                  >
                    <Text style={{ fontSize: 20 }}>🧊</Text>
                    <Text style={{ color: newFridgeType === 'negatif' ? '#000' : '#D4AF37', fontSize: 11, marginTop: 4, fontWeight: 'bold' }}>CONGÉLATEUR</Text>
                    <Text style={{ color: newFridgeType === 'negatif' ? '#333' : '#666', fontSize: 10 }}>-15°C à -25°C</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12, alignItems: 'center' }}
                    onPress={() => { setShowAddFridge(false); setNewFridgeName(''); }}
                  >
                    <Text style={{ color: '#666' }}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 2, backgroundColor: '#D4AF37', borderRadius: 8, padding: 12, alignItems: 'center' }}
                    onPress={addFridge}
                  >
                    <Text style={{ color: '#000', fontWeight: 'bold' }}>✅ Ajouter</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : (
              <Btn label="➕  Ajouter un équipement" onPress={() => setShowAddFridge(true)} style={{ marginBottom: 8 }} />
            )}
          </>
        )}

        {/* ─── Étiquettes sanitaires ─── */}
        <SectionTitle style={{ marginTop: 24 }}>Étiquettes Sanitaires</SectionTitle>
        <Btn label="📸  Ajouter une photo" onPress={pickPhoto} style={{ marginBottom: 16 }} />

        {photos.length > 0 && (
          <View style={styles.photoGrid}>
            {photos.map((p: any, i: number) => (
              <View key={i} style={styles.photoTile}>
                <Image source={{ uri: p.uri }} style={styles.photoImg} resizeMode="cover" />
                <View style={{ padding: 8 }}>
                  <Text style={styles.photoName} numberOfLines={1}>{p.name}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────
function SettingsPage({ goBack, clearAllData }: any) {
  // ✅ apiKey/setApiKey/saveKey supprimés — clé gérée côté serveur

  function handleClearData() {
    Alert.alert('Confirmer', 'Cette action est irréversible. Continuer ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Effacer', style: 'destructive', onPress: async () => {
          try {
            await Dashboard.clearData();
            clearAllData();
          } catch {
            clearAllData();
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerSub2}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
        <View><Text style={styles.headerTitle}>Paramètres</Text><Text style={styles.subTxt}>Configuration</Text></View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.settSection}>
          <Text style={styles.settLabel}>Données</Text>
          <View style={{ padding: 14 }}>
            <Btn label="🗑️  Effacer toutes les données" onPress={handleClearData} variant="danger" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.blackSoft },
  header:       { padding: Spacing.md, backgroundColor: Colors.charcoal, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)' },
  headerTitle:  { fontFamily: 'Cinzel_700SemiBold', fontSize: 18, color: Colors.cream },
  headerSub:    { fontSize: 11, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },
  headerSub2:   { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.charcoal, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)', gap: 12 },
  subTxt:       { fontSize: 11, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backArrow:    { fontSize: 28, color: Colors.gold, lineHeight: 32 },
  scroll:       { flex: 1 },
  content:      { padding: Spacing.md, paddingBottom: 90 },
  profileRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.goldDark, borderWidth: 1, borderColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:    { fontFamily: 'Cinzel_700SemiBold', fontSize: 18, color: Colors.black },
  profileName:  { fontSize: 16, color: Colors.cream, fontWeight: '600' },
  profileEmail: { fontSize: 13, color: Colors.muted, fontStyle: 'italic' },
  addRow:       { flexDirection: 'row', gap: 10, marginBottom: 16 },
  addInput:     { backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', borderRadius: Radius.sm, padding: 12, color: Colors.cream, fontSize: 15 },
  supName:      { fontFamily: 'Cinzel_400Regular', fontSize: 13, color: Colors.cream, marginBottom: 3 },
  supCount:     { fontSize: 12, color: Colors.muted, fontStyle: 'italic' },
  prodRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  prodName:     { fontSize: 13, color: Colors.creamDark },
  prodPrice:    { fontFamily: 'DMSans_400Regular', fontSize: 13, color: Colors.gold },
  photoGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoTile:    { width: '47%', backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)', borderRadius: Radius.sm, overflow: 'hidden' },
  photoImg:     { width: '100%', height: 100 },
  photoName:    { fontSize: 12, color: Colors.cream },
  settSection:  { backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)', borderRadius: Radius.md, overflow: 'hidden', marginBottom: 14 },
  settLabel:    { fontFamily: 'Cinzel_400Regular', fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: Colors.gold, padding: 12, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.08)' },
  settFieldLabel: { fontFamily: 'Cinzel_400Regular', fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: Colors.mutedLight, marginBottom: 6 },
  apiInput:     { backgroundColor: Colors.blackMid, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', borderRadius: Radius.sm, padding: 12, color: Colors.cream, fontFamily: 'DMSans_400Regular', fontSize: 14 },
});
