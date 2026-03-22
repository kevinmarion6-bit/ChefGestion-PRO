import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Alert, Modal, TextInput, TouchableOpacity, Image, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getToken } from '../../lib/auth';
import { Restaurant } from '@/lib/api';
import { Archives } from '@/lib/api';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';


const API_URL = 'https://chefgestion-pro.onrender.com';

// ─── FORMULAIRE CELLULE DE REFROIDISSEMENT ───────────────
function CelluleForm({ onSave, onCancel }: { onSave: (e: any) => void; onCancel: () => void }) {
  const [produit, setProduit] = useState('');
  const [quantite, setQuantite] = useState('');
  const [heureAvant, setHeureAvant] = useState('');
  const [tempAvant, setTempAvant] = useState('');
  const [heureApres, setHeureApres] = useState('');
  const [tempApres, setTempApres] = useState('');

  const handleSave = () => {
    if (!produit.trim()) { Alert.alert('Erreur', 'Nom du produit requis.'); return; }
    if (!tempAvant || !tempApres) { Alert.alert('Erreur', 'Températures requises.'); return; }
    const avant = parseFloat(tempAvant.replace(',', '.'));
    const apres = parseFloat(tempApres.replace(',', '.'));
    const conforme = avant >= 63 && apres <= 10;
    onSave({ produit: produit.trim(), quantite: quantite.trim() || '—', heureAvant: heureAvant.trim() || '—', tempAvant: avant, heureApres: heureApres.trim() || '—', tempApres: apres, conforme });
  };

  const fieldStyle = { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', borderRadius: 8, color: '#fff', fontSize: 15, padding: 10 };
  const labelStyle = { color: '#8A7A60', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 6, marginTop: 8 };

  return (
    <View style={{ backgroundColor: '#111', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', gap: 4 }}>
      <Text style={{ color: '#D4AF37', fontSize: 12, fontFamily: 'Cinzel_700Bold', letterSpacing: 1, marginBottom: 8 }}>NOUVEAU RELEVÉ CELLULE</Text>
      <Text style={labelStyle}>Produit *</Text>
      <TextInput style={fieldStyle} value={produit} onChangeText={setProduit} placeholder="Ex: Rôti de bœuf" placeholderTextColor="#444" />
      <Text style={labelStyle}>Quantité</Text>
      <TextInput style={fieldStyle} value={quantite} onChangeText={setQuantite} placeholder="Ex: 5 kg" placeholderTextColor="#444" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={labelStyle}>Heure début</Text>
          <TextInput style={fieldStyle} value={heureAvant} onChangeText={setHeureAvant} placeholder="14:30" placeholderTextColor="#444" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={labelStyle}>Temp. avant (&gt;63°C) *</Text>
          <TextInput style={fieldStyle} value={tempAvant} onChangeText={t => setTempAvant(t.replace(',', '.'))} placeholder="72" placeholderTextColor="#444" keyboardType="decimal-pad" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={labelStyle}>Heure fin</Text>
          <TextInput style={fieldStyle} value={heureApres} onChangeText={setHeureApres} placeholder="16:00" placeholderTextColor="#444" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={labelStyle}>Temp. après (&lt;10°C) *</Text>
          <TextInput style={fieldStyle} value={tempApres} onChangeText={t => setTempApres(t.replace(',', '.'))} placeholder="8" placeholderTextColor="#444" keyboardType="decimal-pad" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12, alignItems: 'center' }} onPress={onCancel}>
          <Text style={{ color: '#666' }}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 2, backgroundColor: '#D4AF37', borderRadius: 8, padding: 12, alignItems: 'center' }} onPress={handleSave}>
          <Text style={{ color: '#000', fontWeight: 'bold' }}>✅ Enregistrer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── FORMULAIRE HUILES DE FRITURE ────────────────────────
function HuileForm({ onSave, onCancel }: { onSave: (e: any) => void; onCancel: () => void }) {
  const [friteuse, setFriteuse] = useState('');
  const [testPolaire, setTestPolaire] = useState('');
  const [action, setAction] = useState<'OK' | 'Filtrée' | 'Changée'>('OK');

  const handleSave = () => {
    if (!friteuse.trim()) { Alert.alert('Erreur', 'Nom de la friteuse requis.'); return; }
    onSave({ friteuse: friteuse.trim(), testPolaire: testPolaire || '—', action });
  };

  const fieldStyle = { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', borderRadius: 8, color: '#fff', fontSize: 15, padding: 10 };
  const labelStyle = { color: '#8A7A60', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 6, marginTop: 8 };

  return (
    <View style={{ backgroundColor: '#111', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', gap: 4 }}>
      <Text style={{ color: '#D4AF37', fontSize: 12, fontFamily: 'Cinzel_700Bold', letterSpacing: 1, marginBottom: 8 }}>CONTRÔLE HUILE</Text>
      <Text style={labelStyle}>Friteuse *</Text>
      <TextInput style={fieldStyle} value={friteuse} onChangeText={setFriteuse} placeholder="Ex: Friteuse 1, Friteuse gauche..." placeholderTextColor="#444" />
      <Text style={labelStyle}>Test polaire (%)</Text>
      <TextInput style={fieldStyle} value={testPolaire} onChangeText={t => setTestPolaire(t.replace(',', '.'))} placeholder="Ex: 18" placeholderTextColor="#444" keyboardType="decimal-pad" />
      <Text style={labelStyle}>Action effectuée</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['OK', 'Filtrée', 'Changée'] as const).map(a => (
          <TouchableOpacity key={a} style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: action === a ? '#D4AF37' : '#1a1a1a', borderWidth: 1, borderColor: action === a ? '#D4AF37' : '#333' }} onPress={() => setAction(a)}>
            <Text style={{ color: action === a ? '#000' : '#999', fontSize: 12, fontWeight: 'bold' }}>{a === 'OK' ? '✅ OK' : a === 'Filtrée' ? '🔄 Filtrée' : '♻️ Changée'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12, alignItems: 'center' }} onPress={onCancel}>
          <Text style={{ color: '#666' }}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 2, backgroundColor: '#D4AF37', borderRadius: 8, padding: 12, alignItems: 'center' }} onPress={handleSave}>
          <Text style={{ color: '#000', fontWeight: 'bold' }}>✅ Enregistrer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HaccpScreen() {
  const navigation = useNavigation();
  const { fridgeId } = useLocalSearchParams<{ fridgeId?: string }>();
  const [logs, setLogs]                         = useState<any[]>([]);
  const [fridges, setFridges]                   = useState<any[]>([]);
  const [activeFridgeId, setActiveFridgeId]     = useState<string | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [modalVisible, setModalVisible]         = useState(false);
  const [modalMode, setModalMode]               = useState<'temperature' | 'comment'>('temperature');
  const [tempValue, setTempValue]               = useState('');
  const [commentValue, setCommentValue]         = useState('');
  const [selectedDate, setSelectedDate]         = useState('');
  const [selectedPeriode, setSelectedPeriode]   = useState('');
  const [selectedFridgeId, setSelectedFridgeId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName]     = useState('');
  const [archives, setArchives]                 = useState<any[]>([]);
  const [archivesLoading, setArchivesLoading]   = useState(false);
  const [showArchives, setShowArchives]         = useState(false);
  const [showAllDays, setShowAllDays]           = useState(false);
  const [exporting, setExporting]               = useState(false);
  const [showTemperatures, setShowTemperatures] = useState(false);
  const [showCellule, setShowCellule]           = useState(false);
  const [celluleLogs, setCelluleLogs]           = useState<any[]>([]);
  const [celluleForm, setCelluleForm]           = useState(false);
  const [showHuiles, setShowHuiles]             = useState(false);
  const [huileLogs, setHuileLogs]               = useState<any[]>([]);
  const [huileForm, setHuileForm]               = useState(false);
  const [showPMS, setShowPMS]                   = useState(false);
  const [pmsTasks, setPmsTasks]                 = useState<any[]>([]);
  const [showHotte, setShowHotte]               = useState(false);
  const [hottePhotos, setHottePhotos]           = useState<any[]>([]);
  const [showEtiquettes, setShowEtiquettes]     = useState(false);
  const [etiquettePhotos, setEtiquettePhotos]   = useState<any[]>([]);
  const [etiquetteLoading, setEtiquetteLoading] = useState(false);
  const [selectedEtiquette, setSelectedEtiquette] = useState<any>(null);
  const [showAllEtiquettes, setShowAllEtiquettes] = useState(false);
  const [exportingAll, setExportingAll]         = useState(false);  

  const now          = new Date();
  const viewMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const viewMonthLabel = `${MOIS_FR[now.getMonth()]} ${now.getFullYear()}`;
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayStr     = now.toISOString().split('T')[0];

  async function loadArchives() {
  setArchivesLoading(true);
  try {
    const data = await Archives.list();
    setArchives(data ?? []);
  } catch (err) {
    console.error('[Archives]', err);
  } finally {
    setArchivesLoading(false);
  }
}
 
async function generateCurrentArchive() {
  const now = new Date();
  const prevMonth = now.getMonth();
  const prevYear = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevMonthNum = prevMonth === 0 ? 12 : prevMonth;
  
  try {
    await Archives.generate(prevYear, prevMonthNum);
    Alert.alert('✅ Succès', 'Archive générée avec succès !');
    loadArchives();
  } catch (err: any) {
    Alert.alert('Erreur', err?.message || 'Impossible de générer l\'archive.');
  }
}

  // ─── CELLULE DE REFROIDISSEMENT ────────────────────────
  async function loadCelluleLogs() {
    try {
      const raw = await AsyncStorage.getItem('@haccp_cellule');
      if (raw) setCelluleLogs(JSON.parse(raw));
    } catch {}
  }
  async function saveCelluleLog(entry: any) {
    const updated = [{ ...entry, id: Date.now().toString(), date: new Date().toISOString().split('T')[0] }, ...celluleLogs];
    setCelluleLogs(updated);
    await AsyncStorage.setItem('@haccp_cellule', JSON.stringify(updated));
    setCelluleForm(false);
    Alert.alert('✅ Enregistré', 'Relevé cellule de refroidissement sauvegardé.');
  }
  async function deleteCelluleLog(id: string) {
    const updated = celluleLogs.filter(l => l.id !== id);
    setCelluleLogs(updated);
    await AsyncStorage.setItem('@haccp_cellule', JSON.stringify(updated));
  }

  // ─── HUILES DE FRITURE ─────────────────────────────────
  async function loadHuileLogs() {
    try {
      const raw = await AsyncStorage.getItem('@haccp_huiles');
      if (raw) setHuileLogs(JSON.parse(raw));
    } catch {}
  }
  async function saveHuileLog(entry: any) {
    const updated = [{ ...entry, id: Date.now().toString(), date: new Date().toISOString().split('T')[0] }, ...huileLogs];
    setHuileLogs(updated);
    await AsyncStorage.setItem('@haccp_huiles', JSON.stringify(updated));
    setHuileForm(false);
    Alert.alert('✅ Enregistré', 'Suivi huile de friture sauvegardé.');
  }
  async function deleteHuileLog(id: string) {
    const updated = huileLogs.filter(l => l.id !== id);
    setHuileLogs(updated);
    await AsyncStorage.setItem('@haccp_huiles', JSON.stringify(updated));
  }

  // ─── PMS (Plan de Maîtrise Sanitaire) ──────────────────
  const PMS_DEFAULT = [
    { id: 'pms1', zone: 'Plans de travail & surfaces', freq: 'Quotidien', icon: '🧹' },
    { id: 'pms2', zone: 'Sols cuisine', freq: 'Quotidien', icon: '🧽' },
    { id: 'pms3', zone: 'Chambres froides', freq: 'Hebdomadaire', icon: '❄️' },
    { id: 'pms4', zone: 'Hotte & filtres', freq: 'Mensuel', icon: '🌬️' },
    { id: 'pms5', zone: 'Four & plaques', freq: 'Hebdomadaire', icon: '🔥' },
    { id: 'pms6', zone: 'Sanitaires & vestiaires', freq: 'Quotidien', icon: '🚿' },
    { id: 'pms7', zone: 'Poubelles & déchets', freq: 'Quotidien', icon: '🗑️' },
    { id: 'pms8', zone: 'Vitres & portes', freq: 'Mensuel', icon: '🪟' },
    { id: 'pms9', zone: 'Matériel de cuisson', freq: 'Quotidien', icon: '🍳' },
    { id: 'pms10', zone: 'Réserve sèche', freq: 'Mensuel', icon: '📦' },
  ];
  async function loadPMSTasks() {
    try {
      const raw = await AsyncStorage.getItem('@haccp_pms');
      if (raw) { setPmsTasks(JSON.parse(raw)); }
      else { setPmsTasks(PMS_DEFAULT.map(t => ({ ...t, done: false, lastDone: null }))); }
    } catch { setPmsTasks(PMS_DEFAULT.map(t => ({ ...t, done: false, lastDone: null }))); }
  }
  async function togglePMSTask(id: string) {
    const updated = pmsTasks.map(t => t.id === id ? { ...t, done: !t.done, lastDone: !t.done ? new Date().toISOString().split('T')[0] : t.lastDone } : t);
    setPmsTasks(updated);
    await AsyncStorage.setItem('@haccp_pms', JSON.stringify(updated));
  }

  // ─── NETTOYAGE HOTTE ───────────────────────────────────
  async function loadHottePhotos() {
    try {
      const raw = await AsyncStorage.getItem('@haccp_hotte');
      if (raw) setHottePhotos(JSON.parse(raw));
    } catch {}
  }
  async function pickHottePhoto() {
    Alert.alert('Source', 'Importer le justificatif', [
      { text: 'Appareil photo', onPress: async () => {
        const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (!r.canceled) saveHottePhoto(r.assets[0].uri);
      }},
      { text: 'Galerie', onPress: async () => {
        const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        if (!r.canceled) saveHottePhoto(r.assets[0].uri);
      }},
      { text: 'Annuler', style: 'cancel' },
    ]);
  }
  async function saveHottePhoto(uri: string) {
    const entry = { id: Date.now().toString(), uri, date: new Date().toLocaleDateString('fr-FR'), year: new Date().getFullYear() };
    const updated = [entry, ...hottePhotos];
    setHottePhotos(updated);
    await AsyncStorage.setItem('@haccp_hotte', JSON.stringify(updated));
    Alert.alert('✅ Enregistré', 'Justificatif de nettoyage hotte sauvegardé.');
  }
  async function deleteHottePhoto(id: string) {
    const updated = hottePhotos.filter(p => p.id !== id);
    setHottePhotos(updated);
    await AsyncStorage.setItem('@haccp_hotte', JSON.stringify(updated));
  }

  // ─── ÉTIQUETTES SANITAIRES (lecture depuis serveur) ────
  async function loadEtiquettePhotos() {
    setEtiquetteLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('https://chefgestion-pro.onrender.com/api/haccp/photos', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setEtiquettePhotos(json.data.filter((p: any) => p.uri));
      }
    } catch (err) { console.error('[Etiquettes]', err); }
    finally { setEtiquetteLoading(false); }
  }

  // ─── EXPORT PDF CELLULE ────────────────────────────────
  async function exportCellulePdf() {
    let restName = ''; let chefName = 'Le Chef';
    try { const r = await Restaurant.get(); if (r?.nom) restName = r.nom; } catch {}
    try { const token = await getToken(); const meRes = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }); const meJson = await meRes.json(); if (meJson.ok && meJson.data?.name) chefName = meJson.data.name; } catch {}
    const exportDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const year = new Date().getFullYear();
    const logoUrl = 'https://osnckjlgqqawcgduideb.supabase.co/storage/v1/object/public/assets/logo.png';
    const currentHour = new Date().getHours();
    const currentService = (currentHour >= 2 && currentHour < 16) ? 'MIDI' : 'SOIR';

    const rows = celluleLogs.map((l: any, i: number) => {
      const bg = i % 2 === 0 ? '#FFFFFF' : '#FAFAF7';
      const statusColor = l.conforme ? '#4ADE80' : '#F87171';
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #EEE;background:${bg};font-size:11px;text-align:center;font-weight:bold;color:#8A7A60;">${l.date}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #EEE;background:${bg};font-size:11px;">${l.produit}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #EEE;background:${bg};font-size:11px;text-align:center;">${l.quantite}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #EEE;background:${bg};font-size:11px;text-align:center;">${l.heureAvant}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #EEE;background:${bg};font-size:12px;text-align:center;font-weight:bold;color:#A07D1C;">${l.tempAvant}°C</td>
        <td style="padding:6px 8px;border-bottom:1px solid #EEE;background:${bg};font-size:11px;text-align:center;">${l.heureApres}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #EEE;background:${bg};font-size:12px;text-align:center;font-weight:bold;color:#A07D1C;">${l.tempApres}°C</td>
        <td style="padding:6px 8px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;text-align:center;font-weight:bold;color:${statusColor};">${l.conforme ? '✅ Conforme' : '⚠️ Non conforme'}</td>
      </tr>`;
    }).join('');

    return buildHaccpPdf({ restName, chefName, exportDate, year, logoUrl, currentService, title: '🌬️ Suivi Cellule de Refroidissement Rapide', subtitle: 'Rappel : +63°C → +10°C en moins de 2 heures', tableHeaders: '<th style="background:#111;color:#D4AF37;padding:5px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:center;border:1px solid #E8E0D0;">Date</th><th style="background:#111;color:#D4AF37;padding:5px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:left;border:1px solid #E8E0D0;">Produit</th><th style="background:#111;color:#D4AF37;padding:5px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:center;border:1px solid #E8E0D0;">Qté</th><th style="background:#111;color:#D4AF37;padding:5px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:center;border:1px solid #E8E0D0;">Heure Début</th><th style="background:#111;color:#D4AF37;padding:5px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:center;border:1px solid #E8E0D0;">T° Avant</th><th style="background:#111;color:#D4AF37;padding:5px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:center;border:1px solid #E8E0D0;">Heure Fin</th><th style="background:#111;color:#D4AF37;padding:5px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:center;border:1px solid #E8E0D0;">T° Après</th><th style="background:#111;color:#D4AF37;padding:5px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:center;border:1px solid #E8E0D0;">Statut</th>', tableRows: rows });
  }

  // ─── EXPORT PDF HUILES ─────────────────────────────────
  async function exportHuilesPdf() {
    let restName = ''; let chefName = 'Le Chef';
    try { const r = await Restaurant.get(); if (r?.nom) restName = r.nom; } catch {}
    try { const token = await getToken(); const meRes = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }); const meJson = await meRes.json(); if (meJson.ok && meJson.data?.name) chefName = meJson.data.name; } catch {}
    const exportDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const year = new Date().getFullYear();
    const logoUrl = 'https://osnckjlgqqawcgduideb.supabase.co/storage/v1/object/public/assets/logo.png';
    const currentHour = new Date().getHours();
    const currentService = (currentHour >= 2 && currentHour < 16) ? 'MIDI' : 'SOIR';

    const rows = huileLogs.map((l: any, i: number) => {
      const bg = i % 2 === 0 ? '#FFFFFF' : '#FAFAF7';
      const pctColor = parseInt(l.testPolaire) > 25 ? '#F87171' : parseInt(l.testPolaire) > 20 ? '#FACC15' : '#4ADE80';
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #EEE;background:${bg};font-size:11px;text-align:center;font-weight:bold;color:#8A7A60;">${l.date}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #EEE;background:${bg};font-size:11px;">${l.friteuse}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #EEE;background:${bg};font-size:12px;text-align:center;font-weight:bold;color:${pctColor};">${l.testPolaire}%</td>
        <td style="padding:6px 8px;border-bottom:1px solid #EEE;background:${bg};font-size:11px;text-align:center;">${l.action === 'OK' ? '✅ OK' : l.action === 'Filtrée' ? '🔄 Filtrée' : '♻️ Changée'}</td>
      </tr>`;
    }).join('');

    return buildHaccpPdf({ restName, chefName, exportDate, year, logoUrl, currentService, title: '🛢️ Suivi Huiles de Friture', subtitle: 'Seuil réglementaire : 25% composés polaires maximum', tableHeaders: '<th style="background:#111;color:#D4AF37;padding:5px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:center;border:1px solid #E8E0D0;">Date</th><th style="background:#111;color:#D4AF37;padding:5px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:left;border:1px solid #E8E0D0;">Friteuse</th><th style="background:#111;color:#D4AF37;padding:5px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:center;border:1px solid #E8E0D0;">Test Polaire</th><th style="background:#111;color:#D4AF37;padding:5px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:center;border:1px solid #E8E0D0;">Action</th>', tableRows: rows });
  }

  // ─── GÉNÉRATEUR PDF HACCP RÉUTILISABLE ─────────────────
  function buildHaccpPdf({ restName, chefName, exportDate, year, logoUrl, currentService, title, subtitle, tableHeaders, tableRows, extraHtml }: any): string {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Helvetica,Arial,sans-serif;color:#2C2C2C;margin:0;padding:0;padding-bottom:60px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111;">
  <tr><td style="padding:14px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="80" style="vertical-align:middle;"><img src="${logoUrl}" width="90" height="90" /></td>
        <td style="padding-left:24px;vertical-align:middle;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr><td style="font-size:14px;letter-spacing:5px;text-transform:uppercase;color:#D4AF37;padding-bottom:4px;">✦ ChefGestion Pro ✦</td></tr>
            ${restName ? `<tr><td style="font-size:24px;color:#F5F5DC;font-weight:bold;letter-spacing:1px;">🍽️ ${restName}</td></tr>` : ''}
            <tr><td style="font-size:14px;color:#F5F5DC;padding-top:5px;">👨‍🍳 &nbsp; <span style="color:#D4AF37;font-weight:bold;">Chef</span> &nbsp; ${chefName}</td></tr>
          </table>
        </td>
        <td style="vertical-align:middle;text-align:right;">
          <span style="font-size:9px;color:#8A7A60;text-transform:uppercase;letter-spacing:1px;">Exporté le</span>
          <br/><span style="font-size:14px;color:#8A7A60;">📅 ${exportDate}</span>
          <br/><span style="font-size:11px;color:#D4AF37;">Service ${currentService}</span>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:3px;background-color:#D4AF37;"></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="text-align:center;padding:8px 40px 0;">
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="border:2px solid #D4AF37;">
      <tr><td style="padding:10px 20px;text-align:center;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#A07D1C;text-align:center;padding-bottom:6px;">${title}</td></tr>
          <tr><td style="font-size:22px;color:#1A1A1A;font-weight:bold;text-align:center;">${viewMonthLabel}</td></tr>
          ${subtitle ? `<tr><td style="font-size:10px;color:#8A7A60;text-align:center;padding-top:4px;font-style:italic;">${subtitle}</td></tr>` : ''}
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:8px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-collapse:collapse;">
      <tr>${tableHeaders}</tr>
      ${tableRows}
    </table>
  </td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111;position:fixed;bottom:0;left:0;right:0;">
  <tr>
    <td width="33%" style="padding:14px 40px;font-size:10px;color:#8A7A60;font-style:italic;">📄 Document généré automatiquement</td>
    <td width="34%" style="padding:14px 0;font-size:10px;letter-spacing:3px;color:#D4AF37;text-transform:uppercase;text-align:center;">✦ ChefGestion Pro ✦</td>
    <td width="33%" style="padding:14px 40px;font-size:10px;color:#8A7A60;text-align:right;">© ${year} — Tous droits réservés</td>
  </tr>
</table>
</body></html>`;
  }

  // ─── EXPORT PDF GLOBAL (contrôle hygiène) ──────────────
  async function exportAllHaccp() {
    if (exportingAll) return;
    setExportingAll(true);
    try {
      // Charger toutes les données si pas encore fait
      if (celluleLogs.length === 0) await loadCelluleLogs();
      if (huileLogs.length === 0) await loadHuileLogs();
      if (pmsTasks.length === 0) await loadPMSTasks();
      if (hottePhotos.length === 0) await loadHottePhotos();
      if (etiquettePhotos.length === 0) await loadEtiquettePhotos();

      let restName = ''; let chefName = 'Le Chef';
      try { const r = await Restaurant.get(); if (r?.nom) restName = r.nom; } catch {}
      try { const token = await getToken(); const meRes = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }); const meJson = await meRes.json(); if (meJson.ok && meJson.data?.name) chefName = meJson.data.name; } catch {}
      const exportDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      const year = new Date().getFullYear();
      const logoUrl = 'https://osnckjlgqqawcgduideb.supabase.co/storage/v1/object/public/assets/logo.png';
      const currentHour = new Date().getHours();
      const currentService = (currentHour >= 2 && currentHour < 16) ? 'MIDI' : 'SOIR';

      // Section températures
      let tempRows = '';
      const fridgesToShow = fridges.length > 0 ? fridges : [{ id: null, nom: 'Sans équipement', type: 'positif', temp_min: 0, temp_max: 4, emoji: '' }];
      for (const fridge of fridgesToShow) {
        const fridgeLogs = fridge.id ? logs.filter((l: any) => l.fridge_id === fridge.id || (l.fridge_nom && l.fridge_nom === fridge.nom)) : logs.filter((l: any) => !l.fridge_id);
        const isFreez = fridge.type === 'negatif';
        const emoji = fridge.emoji || (isFreez ? '🧊' : '❄️');
        tempRows += `<tr><td colspan="4" style="background:#111;color:#D4AF37;padding:8px;font-size:11px;font-weight:bold;">${emoji} ${fridge.nom} (${fridge.temp_min ?? 0}°C à ${fridge.temp_max ?? 4}°C)</td></tr>`;
        const today = new Date();
        for (let day = 1; day <= Math.min(today.getDate(), daysInMonth); day++) {
          const dateStr = `${viewMonthStr}-${day.toString().padStart(2, '0')}`;
          const midi = fridgeLogs.find((l: any) => l.date === dateStr && l.periode === 'MIDI');
          const soir = fridgeLogs.find((l: any) => l.date === dateStr && l.periode === 'SOIR');
          const bg = day % 2 === 0 ? '#FFFFFF' : '#FAFAF7';
          tempRows += `<tr><td style="padding:3px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;text-align:center;">${day}</td><td style="padding:3px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;text-align:center;font-weight:bold;color:${midi ? getTempColor(midi.valeur) : '#999'};">${midi ? midi.valeur + '°C' : '--'}</td><td style="padding:3px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;text-align:center;font-weight:bold;color:${soir ? getTempColor(soir.valeur) : '#999'};">${soir ? soir.valeur + '°C' : '--'}</td><td style="padding:3px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:9px;color:#888;">${midi?.commentaire || soir?.commentaire || ''}</td></tr>`;
        }
      }

      // Section cellule
      const cellRows = celluleLogs.map((l: any, i: number) => {
        const bg = i % 2 === 0 ? '#FFF' : '#FAFAF7'; const sc = l.conforme ? '#4ADE80' : '#F87171';
        return `<tr><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;text-align:center;">${l.date}</td><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;">${l.produit}</td><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;text-align:center;">${l.tempAvant}°C→${l.tempApres}°C</td><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:9px;text-align:center;color:${sc};font-weight:bold;">${l.conforme ? '✅' : '⚠️'}</td></tr>`;
      }).join('');

      // Section huiles
      const huileRows = huileLogs.map((l: any, i: number) => {
        const bg = i % 2 === 0 ? '#FFF' : '#FAFAF7'; const pc = parseInt(l.testPolaire) > 25 ? '#F87171' : '#4ADE80';
        return `<tr><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;text-align:center;">${l.date}</td><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;">${l.friteuse}</td><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;text-align:center;color:${pc};font-weight:bold;">${l.testPolaire}%</td><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;text-align:center;">${l.action}</td></tr>`;
      }).join('');

      // Section PMS
      const pmsRows = pmsTasks.map((t: any, i: number) => {
        const bg = i % 2 === 0 ? '#FFF' : '#FAFAF7';
        return `<tr><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;">${t.icon} ${t.zone}</td><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;text-align:center;">${t.freq}</td><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;text-align:center;color:${t.done ? '#4ADE80' : '#F87171'};font-weight:bold;">${t.done ? '✅ Fait' : '❌ Non fait'}</td><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:9px;text-align:center;color:#888;">${t.lastDone || '—'}</td></tr>`;
      }).join('');

      // Section hotte
      const hotteSection = hottePhotos.length > 0
        ? hottePhotos.map(p => `<div style="margin:4px 0;font-size:11px;">📸 Justificatif du ${p.date} (Année ${p.year})</div>`).join('')
        : '<div style="font-size:11px;color:#888;font-style:italic;">Aucun justificatif importé</div>';

      const sectionBlock = (icon: string, sTitle: string, headers: string, rows: string) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:6px 40px 4px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;"><tr>
    <td width="26" style="font-size:16px;vertical-align:middle;">${icon}</td>
    <td style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#1A1A1A;font-weight:bold;vertical-align:middle;white-space:nowrap;padding-right:8px;">${sTitle}</td>
    <td width="100%" style="vertical-align:middle;"><table width="100%"><tr><td style="border-bottom:1px solid #D4AF37;height:1px;"></td></tr></table></td>
  </tr></table>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-collapse:collapse;">
    <tr>${headers}</tr>${rows}
  </table>
</td></tr></table>`;

      const th = (t: string) => `<th style="background:#111;color:#D4AF37;padding:4px 6px;font-size:7px;letter-spacing:1px;text-transform:uppercase;text-align:center;border:1px solid #E8E0D0;">${t}</th>`;

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Helvetica,Arial,sans-serif;color:#2C2C2C;margin:0;padding:0;padding-bottom:60px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111;">
  <tr><td style="padding:14px 40px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="80" style="vertical-align:middle;"><img src="${logoUrl}" width="90" height="90" /></td>
    <td style="padding-left:24px;vertical-align:middle;"><table cellpadding="0" cellspacing="0" border="0">
      <tr><td style="font-size:14px;letter-spacing:5px;text-transform:uppercase;color:#D4AF37;padding-bottom:4px;">✦ ChefGestion Pro ✦</td></tr>
      ${restName ? `<tr><td style="font-size:24px;color:#F5F5DC;font-weight:bold;">🍽️ ${restName}</td></tr>` : ''}
      <tr><td style="font-size:14px;color:#F5F5DC;padding-top:5px;">👨‍🍳 <span style="color:#D4AF37;font-weight:bold;">Chef</span> ${chefName}</td></tr>
    </table></td>
    <td style="vertical-align:middle;text-align:right;"><span style="font-size:9px;color:#8A7A60;text-transform:uppercase;letter-spacing:1px;">Exporté le</span><br/><span style="font-size:14px;color:#8A7A60;">📅 ${exportDate}</span><br/><span style="font-size:11px;color:#D4AF37;">Service ${currentService}</span></td>
  </tr></table></td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:3px;background-color:#D4AF37;"></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="text-align:center;padding:8px 40px 0;">
  <table cellpadding="0" cellspacing="0" border="0" align="center" style="border:2px solid #D4AF37;"><tr><td style="padding:10px 20px;text-align:center;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#A07D1C;text-align:center;padding-bottom:6px;">🛡️ Dossier Justificatifs Hygiène — Contrôle HACCP</td></tr>
      <tr><td style="font-size:22px;color:#1A1A1A;font-weight:bold;text-align:center;">${viewMonthLabel}</td></tr>
    </table>
  </td></tr></table>
</td></tr></table>

<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:4px;"></td></tr></table>

${sectionBlock('🌡️', 'Relevés de Températures', `${th('Jour')}${th('☀️ Midi')}${th('🌙 Soir')}${th('💬 Comm.')}`, tempRows)}
${cellRows ? sectionBlock('🌬️', 'Cellule de Refroidissement', `${th('Date')}${th('Produit')}${th('Températures')}${th('Statut')}`, cellRows) : ''}
${etiquettePhotos.length > 0 ? sectionBlock('🏷️', 'Étiquettes Sanitaires', `${th('N°')}${th('Nom')}${th('Date')}${th('DLC')}`, etiquettePhotos.map((p: any, i: number) => { const bg = i % 2 === 0 ? '#FFF' : '#FAFAF7'; return `<tr><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;text-align:center;">${i+1}</td><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;">${p.name || 'Étiquette'}</td><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;text-align:center;">${p.date || '—'}</td><td style="padding:4px 6px;border-bottom:1px solid #EEE;background:${bg};font-size:10px;text-align:center;">${p.dlc_date || '—'}</td></tr>`; }).join('')) : ''}
${huileRows ? sectionBlock('🛢️', 'Huiles de Friture', `${th('Date')}${th('Friteuse')}${th('Test Polaire')}${th('Action')}`, huileRows) : ''}
${sectionBlock('🧹', 'Plan de Maîtrise Sanitaire', `${th('Zone')}${th('Fréquence')}${th('Statut')}${th('Dernier')}`, pmsRows)}
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:10px 40px 4px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;"><tr>
    <td width="26" style="font-size:16px;vertical-align:middle;">🌀</td>
    <td style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#1A1A1A;font-weight:bold;vertical-align:middle;padding-right:8px;">Nettoyage Hotte Aspirante</td>
    <td width="100%" style="vertical-align:middle;"><table width="100%"><tr><td style="border-bottom:1px solid #D4AF37;height:1px;"></td></tr></table></td>
  </tr></table>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-collapse:collapse;"><tr><td style="padding:10px;font-size:11px;color:#333;">${hotteSection}</td></tr></table>
</td></tr></table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111;position:fixed;bottom:0;left:0;right:0;">
  <tr>
    <td width="33%" style="padding:14px 40px;font-size:10px;color:#8A7A60;font-style:italic;">📄 Dossier généré automatiquement</td>
    <td width="34%" style="padding:14px 0;font-size:10px;letter-spacing:3px;color:#D4AF37;text-transform:uppercase;text-align:center;">✦ ChefGestion Pro ✦</td>
    <td width="33%" style="padding:14px 40px;font-size:10px;color:#8A7A60;text-align:right;">© ${year} — Tous droits réservés</td>
  </tr>
</table>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Dossier HACCP — ${viewMonthLabel}`, UTI: 'com.adobe.pdf' });
      } else { await Print.printAsync({ html }); }
    } catch (err) {
      console.error('[Export All HACCP]', err);
      Alert.alert('Erreur', `${err instanceof Error ? err.message : String(err)}`);
    } finally { setExportingAll(false); }
  }

  // ─── RE-FETCH À CHAQUE FOCUS SUR L'ONGLET ───────────────
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchFridges();
      fetchLogs();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    fetchFridges();
    fetchLogs();
    Restaurant.get().then(r => { if (r?.nom) setRestaurantName(r.nom); }).catch(() => {});
  }, []);

  // ─── Sélectionner le frigo (param URL ou 1er par défaut) ──
  useEffect(() => {
    if (fridges.length === 0) return;

    // Si on arrive depuis une alerte du dashboard avec un fridgeId
    if (fridgeId && fridges.some(f => f.id === fridgeId)) {
      setActiveFridgeId(fridgeId);
      return;
    }

    // Sinon, sélectionner le 1er frigo par défaut
    if (!activeFridgeId) {
      setActiveFridgeId(fridges[0].id);
    }
  }, [fridges, fridgeId]);

  // ─── CHARGER LES FRIGOS ─────────────────────────────────
  const fetchFridges = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/fridges?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' },
      });
      const json = await res.json();
      if (json.ok) setFridges(json.data ?? []);
    } catch (err) {
      console.error('Erreur Fetch Fridges:', err);
    }
  };

  // ─── CHARGER LES LOGS ──────────────────────────────────
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(
        `${API_URL}/api/scan/haccp-logs?year=${now.getFullYear()}&month=${(now.getMonth() + 1).toString().padStart(2, '0')}&t=${Date.now()}`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' } }
      );
      const json = await response.json();
      if (json.ok) setLogs(json.data ?? []);
    } catch (err) {
      console.error('Erreur Fetch HACCP:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── COULEUR TEMPÉRATURE ─────────────────────────────────
  function getTempColor(val: number | null | undefined): string {
    if (val === null || val === undefined) return '#555';

    if (activeFridge) {
      const min = activeFridge.temp_min ?? (activeFridge.type === 'negatif' ? -21 : 0);
      const max = activeFridge.temp_max ?? (activeFridge.type === 'negatif' ? -18 : 4);
      const tolerance = 1;

      if (val >= min && val <= max) return '#4ADE80';
      if (val >= min - tolerance && val <= max + tolerance) return '#FACC15';
      return '#F87171';
    }

    // Fallback sans frigo : plage par défaut 0-4°C
    if (val >= 0 && val <= 4) return '#4ADE80';
    if (val >= -1 && val <= 5) return '#FACC15';
    return '#F87171';
  }

  // ─── FRIGO ACTIF + LOGS FILTRÉS ──────────────────────────
  const activeFridge = fridges.find(f => f.id === activeFridgeId) || null;

  const activeLogs = activeFridgeId
    ? logs.filter(l => 
        l.fridge_id === activeFridgeId || 
        (l.fridge_nom && activeFridge && l.fridge_nom === activeFridge.nom) ||
        (!l.fridge_id && !l.fridge_nom)
      )
    : logs;

  // ─── OUVRIR MODALE TEMPÉRATURE ───────────────────────────
  const openInput = (date: string, periode: string, currentVal: any, fridgeId?: string) => {
    setSelectedDate(date);
    setSelectedPeriode(periode);
    setTempValue(currentVal !== null && currentVal !== undefined ? String(currentVal) : '');
    setCommentValue('');
    setSelectedFridgeId(fridgeId ?? activeFridgeId ?? null);
    setModalMode('temperature');
    setModalVisible(true);
  };

  // ─── OUVRIR MODALE COMMENTAIRE ───────────────────────────
  const openCommentInput = (date: string, fridgeId?: string, currentComment?: string) => {
    setSelectedDate(date);
    setSelectedPeriode('');
    setTempValue('');
    setCommentValue(currentComment || '');
    setSelectedFridgeId(fridgeId ?? activeFridgeId ?? null);
    setModalMode('comment');
    setModalVisible(true);
  };

  // ─── FERMER MODALE ───────────────────────────────────────
  const closeModal = () => {
    setModalVisible(false);
    setTempValue('');
    setCommentValue('');
  };

  // ─── ENREGISTRER ─────────────────────────────────────────
  const handleSave = async () => {
    if (modalMode === 'temperature') {
      const cleanValue = tempValue.replace(',', '.').trim();
      if (cleanValue && isNaN(Number(cleanValue))) {
        Alert.alert('Erreur', 'Veuillez entrer un chiffre valide.');
        return;
      }
    }
    if (modalMode === 'comment' && !commentValue.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un commentaire.');
      return;
    }

    try {
      const token = await getToken();
      const payload: any = {
        date: selectedDate,
        fridge_id: selectedFridgeId,
      };

      if (modalMode === 'temperature') {
        payload.periode = selectedPeriode;
        payload.valeur = tempValue.trim() === '' ? null : parseFloat(tempValue.replace(',', '.'));
        payload.commentaire = '';
      } else {
        // Commentaire : on cherche s'il y a un log existant pour récupérer sa période
        const existing = activeLogs.find(l => l.date === selectedDate);
        payload.periode = existing?.periode || 'MIDI';
        payload.valeur = existing?.valeur ?? null;
        payload.commentaire = commentValue.trim();
      }

      const response = await fetch(`${API_URL}/api/scan/haccp-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const res = await response.json();
      if (res.ok) {
        closeModal();
        fetchLogs();
      } else {
        Alert.alert('Erreur', res.error || "Impossible d'enregistrer.");
      }
    } catch {
      Alert.alert('Erreur', 'Connexion au serveur impossible.');
    }
  };

  // ─── EXPORT PDF ──────────────────────────────────────────
  const exportPdf = async () => {
    if (exporting) return; 
    setExporting(true); 
    let restName = restaurantName;
    let chefName = 'Le Chef';
    if (!restName) {
      try { const r = await Restaurant.get(); if (r?.nom) restName = r.nom; } catch {}
    }
    try {
      const token = await getToken();
      const meRes = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const meJson = await meRes.json();
      if (meJson.ok && meJson.data?.name) chefName = meJson.data.name;
    } catch {}

    const currentHour = new Date().getHours();
    const currentService = (currentHour >= 2 && currentHour < 16) ? 'MIDI' : 'SOIR';
    const exportDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const year = new Date().getFullYear();
    const logoUrl = 'https://osnckjlgqqawcgduideb.supabase.co/storage/v1/object/public/assets/logo.png';

    const fridgesToShow = fridges.length > 0 ? fridges : [{ id: null, nom: 'Sans équipement', type: 'positif', temp_min: 0, temp_max: 4, emoji: '' }];

    let pagesHtml = '';

    for (const fridge of fridgesToShow) {
      const fridgeLogs = fridge.id
        ? logs.filter(l => l.fridge_id === fridge.id || (l.fridge_nom && l.fridge_nom === fridge.nom))
        : logs.filter(l => !l.fridge_id);
      const isFreez = fridge.type === 'negatif' || fridge.nom?.toLowerCase().includes('congél') || fridge.nom?.toLowerCase().includes('surgél');
      const tempMin = fridge.temp_min ?? (isFreez ? -21 : 0);
      const tempMax = fridge.temp_max ?? (isFreez ? -18 : 4);
      const fridgeEmoji = fridge.emoji || (isFreez ? '🧊' : '❄️');

      let dataRows = '';
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${viewMonthStr}-${day.toString().padStart(2, '0')}`;
        const midi = fridgeLogs.find(l => l.date === dateStr && l.periode === 'MIDI');
        const soir = fridgeLogs.find(l => l.date === dateStr && l.periode === 'SOIR');
        const comment = midi?.commentaire || soir?.commentaire || '';
        const bgColor = day % 2 === 0 ? '#FFFFFF' : '#FAFAF7';

        const colorMidi = midi?.valeur != null ? getTempColor(midi.valeur) : '#999';
        const colorSoir = soir?.valeur != null ? getTempColor(soir.valeur) : '#999';

        dataRows += `<tr>
          <td style="padding:4px 8px;font-size:11px;border-bottom:1px solid #EEE;text-align:center;background-color:${bgColor};font-weight:bold;color:#8A7A60;">${day}</td>
          <td style="padding:4px 8px;font-size:12px;border-bottom:1px solid #EEE;text-align:center;background-color:${bgColor};color:${colorMidi};font-weight:bold;">${midi ? midi.valeur + '°C' : '--'}</td>
          <td style="padding:4px 8px;font-size:12px;border-bottom:1px solid #EEE;text-align:center;background-color:${bgColor};color:${colorSoir};font-weight:bold;">${soir ? soir.valeur + '°C' : '--'}</td>
          <td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #EEE;background-color:${bgColor};color:#888;font-style:italic;">${comment}</td>
        </tr>`;
      }

      pagesHtml += `
<!-- PAGE ${fridge.nom} -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111;">
  <tr><td style="padding:14px 40px;">
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
          <br/><span style="font-size:14px;color:#8A7A60;">📅 ${exportDate}</span>
          <br/><span style="font-size:11px;color:#D4AF37;">Service ${currentService}</span>
        </td>
      </tr>
    </table>
  </td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="height:3px;background-color:#D4AF37;"></td></tr>
</table>

<!-- TITRE -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="text-align:center;padding:8px 40px 0;">
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="border:2px solid #D4AF37;">
      <tr><td style="padding:10px 20px;text-align:center;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#A07D1C;text-align:center;padding-bottom:6px;">🌡️ Relevés de Températures HACCP — ${viewMonthLabel}</td></tr>
          <tr><td style="font-size:22px;color:#1A1A1A;font-weight:bold;text-align:center;">${fridgeEmoji} ${fridge.nom}</td></tr>
          <tr><td style="font-size:11px;color:#8A7A60;text-align:center;padding-top:4px;">Plage autorisée : ${tempMin}°C à ${tempMax}°C</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>

<!-- TABLEAU RELEVÉS -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:8px 40px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
      <tr>
        <td width="26" style="font-size:16px;vertical-align:middle;">📊</td>
        <td style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#1A1A1A;font-weight:bold;vertical-align:middle;white-space:nowrap;padding-right:10px;">Relevés du mois</td>
        <td width="100%" style="vertical-align:middle;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-bottom:1px solid #D4AF37;height:1px;"></td></tr></table></td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-collapse:collapse;">
      <tr>
        <th style="background-color:#111111;color:#D4AF37;padding:6px 8px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:center;border:1px solid #E8E0D0;">Jour</th>
        <th style="background-color:#111111;color:#D4AF37;padding:6px 8px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:center;border:1px solid #E8E0D0;">☀️ MIDI</th>
        <th style="background-color:#111111;color:#D4AF37;padding:6px 8px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:center;border:1px solid #E8E0D0;">🌙 SOIR</th>
        <th style="background-color:#111111;color:#D4AF37;padding:6px 8px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:left;border:1px solid #E8E0D0;">💬 Commentaire</th>
      </tr>
      ${dataRows}
    </table>
  </td></tr>
</table>

<div style="page-break-after:always;"></div>
`;
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Helvetica,Arial,sans-serif;color:#2C2C2C;margin:0;padding:0;padding-bottom:60px;">
${pagesHtml}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111;position:fixed;bottom:0;left:0;right:0;">
  <tr>
    <td width="33%" style="padding:14px 40px;font-size:10px;color:#8A7A60;font-style:italic;">📄 Document généré automatiquement</td>
    <td width="34%" style="padding:14px 0;font-size:10px;letter-spacing:3px;color:#D4AF37;text-transform:uppercase;text-align:center;">✦ ChefGestion Pro ✦</td>
    <td width="33%" style="padding:14px 40px;font-size:10px;color:#8A7A60;text-align:right;">© ${year} — Tous droits réservés</td>
  </tr>
</table>
</body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Relevés HACCP — ${viewMonthLabel}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ html });
      }
    } catch (err) {
      console.error('[Export PDF]', err);
      Alert.alert('Erreur PDF', `Détail : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  };

  // ─── COMPTEUR DE RELEVÉS POUR UN FRIGO ───────────────────
  // ─── COMPTEUR DE RELEVÉS POUR UN FRIGO ───────────────────
  function getFridgeLogCount(fridgeId: string) {
    return logs.filter(l => l.fridge_id === fridgeId || (l.fridge_nom && fridges.find(f => f.id === fridgeId)?.nom === l.fridge_nom)).length;
  }

  // ─── SEMAINE EN COURS ────────────────────────────────────
  function getCurrentWeekDays(): number[] {
    const today = now.getDate();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = today + mondayOffset;
    
    const days: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = monday + i;
      if (d >= 1 && d <= daysInMonth) {
        days.push(d);
      }
    }
    return days;
  }

  const weekDays = getCurrentWeekDays();

  // ─── RENDER UNE LIGNE JOUR ───────────────────────────────
  function renderDayRow(day: number) {
    const dateStr = `${viewMonthStr}-${day.toString().padStart(2, '0')}`;
    const fridgeId = activeFridgeId;

    const midi = activeLogs.find(l => l.date === dateStr && l.periode === 'MIDI');
    const soir = activeLogs.find(l => l.date === dateStr && l.periode === 'SOIR');
    const hasComment = midi?.commentaire || soir?.commentaire;
    const isToday = dateStr === todayStr;

    return (
      <View key={`${fridgeId ?? 'all'}-${day}`} style={[st.row, isToday && st.rowToday]}>
        <Text style={[st.dayCell, isToday && { color: '#D4AF37', fontWeight: 'bold' }]}>{day}</Text>

        <TouchableOpacity
          style={st.tempCell}
          onPress={() => openInput(dateStr, 'MIDI', midi?.valeur, fridgeId ?? undefined)}
        >
          <Text style={[st.tempText, { color: getTempColor(midi?.valeur) }]}>
            {midi ? `${midi.valeur}°C` : '--'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={st.tempCell}
          onPress={() => openInput(dateStr, 'SOIR', soir?.valeur, fridgeId ?? undefined)}
        >
          <Text style={[st.tempText, { color: getTempColor(soir?.valeur) }]}>
            {soir ? `${soir.valeur}°C` : '--'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[st.tempCell, { flex: 1.5 }]}
          onPress={() => openCommentInput(dateStr, fridgeId ?? undefined, midi?.commentaire || soir?.commentaire)}
        >
          <Text style={st.commentIcon}>
            {hasComment ? '💬' : '＋'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── RENDER ──────────────────────────────────────────────
  return (
    <SafeAreaView style={st.container}>
      {/* En-tête */}
      <View style={st.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Image source={require('../../assets/logo.png')} style={{ width: 34, height: 34, borderRadius: 8, marginRight: 10 }} resizeMode="contain" />
          <View>
            <Text style={st.title}>HACCP</Text>
            <Text style={st.subtitle}>Traçabilité & Hygiène</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[st.exportBtn, exportingAll && { opacity: 0.4 }]}
          onPress={exportAllHaccp}
          disabled={exportingAll}
        >
          <Text style={st.exportBtnTxt}>{exportingAll ? '⏳...' : '🛡️ Contrôle'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#D4AF37" style={{ marginTop: 40 }} />

      ) : fridges.length === 0 && logs.length === 0 ? (
        <View style={st.emptyContainer}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🌡️</Text>
          <Text style={st.emptyText}>Aucun relevé ce mois-ci</Text>
          <Text style={st.emptyHint}>
            Ajoutez des frigos dans Plus → HACCP{'\n'}puis scannez depuis Scanner → Température
          </Text>
        </View>

      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* ═══ MODULE : RELEVÉS DE TEMPÉRATURES ═══ */}
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: '#1A1A1A', padding: 16,
              borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)',
            }}
            onPress={() => setShowTemperatures(!showTemperatures)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 22 }}>🌡️</Text>
              <View>
                <Text style={{ color: '#F5F5DC', fontSize: 14, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>
                  Relevés de Températures
                </Text>
                <Text style={{ color: '#6B6050', fontSize: 11, marginTop: 2 }}>
                  {viewMonthLabel} · {fridges.length} équipement{fridges.length > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                style={[st.exportBtn, exporting && { opacity: 0.4 }]}
                onPress={(e) => { e.stopPropagation(); exportPdf(); }}
                disabled={exporting}
              >
                <Text style={st.exportBtnTxt}>{exporting ? '⏳...' : '📄 PDF'}</Text>
              </TouchableOpacity>
              <Text style={{ color: '#D4AF37', fontSize: 16 }}>{showTemperatures ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>

          {showTemperatures && (
            <><View>
              {/* ─── ONGLETS FRIGOS (scroll horizontal) ──────── */}
              {fridges.length > 0 && (
                <View style={st.tabsContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabsScroll}>
                    {fridges.map(fridge => {
                      const isActive = activeFridgeId === fridge.id;
                      const isFreez = fridge.type === 'negatif' || fridge.nom?.toLowerCase().includes('congél') || fridge.nom?.toLowerCase().includes('surgél');
                      const logCount = getFridgeLogCount(fridge.id);

                      return (
                        <TouchableOpacity
                          key={fridge.id}
                          style={[st.tab, isActive && st.tabActive]}
                          onPress={() => setActiveFridgeId(fridge.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 16 }}>{fridge.emoji || (isFreez ? '🧊' : '❄️')}</Text>
                          <Text style={[st.tabLabel, isActive && st.tabLabelActive]} numberOfLines={1}>
                            {fridge.nom}
                          </Text>
                          {logCount > 0 && (
                            <View style={[st.tabBadge, isActive && st.tabBadgeActive]}>
                              <Text style={[st.tabBadgeText, isActive && { color: '#000' }]}>{logCount}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* ─── EN-TÊTE COLONNES ───────────────────── */}
              <View style={st.tableHeader}>
                <Text style={[st.headerCell, { flex: 1 }]}>Jour</Text>
                <Text style={[st.headerCell, { flex: 2 }]}>Midi</Text>
                <Text style={[st.headerCell, { flex: 2 }]}>Soir</Text>
                <Text style={[st.headerCell, { flex: 1.5 }]}>Comm.</Text>
              </View>

              {/* Indicateur semaine en cours */}
              {!showAllDays && (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(212,175,55,0.05)' }}>
                  <Text style={{ fontSize: 12 }}>📅</Text>
                  <Text style={{ color: '#D4AF37', fontSize: 10, fontFamily: 'Cinzel_700Bold', letterSpacing: 1, marginLeft: 6 }}>
                    SEMAINE DU {weekDays[0]} AU {weekDays[weekDays.length - 1]} {MOIS_FR[now.getMonth()].toUpperCase()}
                  </Text>
                </View>
              )}

              {/* Jours affichés */}
              {(showAllDays
                ? Array.from({ length: daysInMonth }, (_, i) => i + 1)
                : weekDays
              ).map(day => renderDayRow(day))}

              {/* Bouton voir plus / voir moins */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  paddingVertical: 14, gap: 8,
                  borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.1)',
                  backgroundColor: 'rgba(212,175,55,0.04)',
                }}
                onPress={() => setShowAllDays(!showAllDays)}
              >
                <Text style={{ color: '#D4AF37', fontSize: 11, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>
                  {showAllDays ? '▲  SEMAINE EN COURS' : `▼  VOIR TOUT LE MOIS (${daysInMonth} jours)`}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ═══ ARCHIVES MENSUELLES ═══ */}
          <View style={{ marginTop: 2 }}>
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: '#1A1A1A', padding: 16,
                borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)',
              }}
              onPress={() => {
                if (!showArchives) loadArchives();
                setShowArchives(!showArchives);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 22 }}>📦</Text>
                <View>
                  <Text style={{ color: '#F5F5DC', fontSize: 14, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>
                    Archives Mensuelles
                  </Text>
                  <Text style={{ color: '#6B6050', fontSize: 11, marginTop: 2 }}>
                    PDF automatiques · Conservation 1 an
                  </Text>
                </View>
              </View>
              <Text style={{ color: '#D4AF37', fontSize: 16 }}>{showArchives ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showArchives && (
              <View style={{ padding: 16, gap: 10 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: '#D4AF37',
                    borderRadius: 10, padding: 14, alignItems: 'center',
                  }}
                  onPress={generateCurrentArchive}
                >
                  <Text style={{ color: '#D4AF37', fontSize: 12, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>
                    📄 GÉNÉRER L'ARCHIVE DU MOIS PRÉCÉDENT
                  </Text>
                </TouchableOpacity>

                {archivesLoading ? (
                  <ActivityIndicator color="#D4AF37" style={{ marginTop: 16 }} />
                ) : archives.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, opacity: 0.5 }}>📭</Text>
                    <Text style={{ color: '#6B6050', fontSize: 12, fontStyle: 'italic', marginTop: 6 }}>
                      Aucune archive disponible
                    </Text>
                  </View>
                ) : (
                  archives.map((a: any) => (
                    <View
                      key={a.id}
                      style={{
                        backgroundColor: '#111', borderRadius: 10, padding: 14,
                        borderWidth: 1,
                        borderColor: a.is_expiring_soon ? 'rgba(248,113,113,0.4)' : 'rgba(212,175,55,0.1)',
                      }}
                    >
                      {a.is_expiring_soon && (
                        <View style={{
                          backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 6,
                          padding: 8, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6,
                        }}>
                          <Text style={{ fontSize: 12 }}>⚠️</Text>
                          <Text style={{ color: '#F87171', fontSize: 10, fontWeight: 'bold' }}>
                            EXPIRE DANS {a.days_until_expiry} JOUR{a.days_until_expiry > 1 ? 'S' : ''} — Téléchargez-la !
                          </Text>
                        </View>
                      )}

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#F5F5DC', fontSize: 14, fontFamily: 'Cinzel_400Regular', textTransform: 'capitalize' }}>
                            📅 {a.month_label}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                            <Text style={{ color: '#6B6050', fontSize: 10 }}>
                              {a.is_complete ? '✅ Complet' : '⚠️ Incomplet'}
                            </Text>
                            <Text style={{ color: '#6B6050', fontSize: 10 }}>
                              🌡️ {a.log_count} relevés
                            </Text>
                            <Text style={{ color: '#6B6050', fontSize: 10 }}>
                              ❄️ {a.fridge_count} frigos
                            </Text>
                            <Text style={{ color: '#6B6050', fontSize: 10 }}>
                              📦 {a.file_size} KB
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={{ backgroundColor: '#D4AF37', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}
                          onPress={async () => {
                            if (!a.download_url) return;
                            try {
                              const response = await fetch(a.download_url);
                              const html = await response.text();
                              const { uri } = await Print.printToFileAsync({ html });
                              if (await Sharing.isAvailableAsync()) {
                                await Sharing.shareAsync(uri, {
                                  mimeType: 'application/pdf',
                                  dialogTitle: `Archive HACCP — ${a.month_label}`,
                                  UTI: 'com.adobe.pdf',
                                });
                              } else {
                                await Print.printAsync({ html });
                              }
                            } catch (err) {
                              Alert.alert('Erreur', 'Impossible de générer le PDF.');
                              console.error('[Archive PDF]', err);
                            }
                          }}
                        >
                          <Text style={{ color: '#000', fontSize: 11, fontWeight: 'bold' }}>📥 PDF</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
          </>
          )}

          {/* ═══ MODULE : CELLULE DE REFROIDISSEMENT RAPIDE ═══ */}
          <View style={{ marginTop: 2 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1A1A', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)' }}
              onPress={() => { if (!showCellule) loadCelluleLogs(); setShowCellule(!showCellule); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 22 }}>🌬️</Text>
                <View>
                  <Text style={{ color: '#F5F5DC', fontSize: 14, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>Cellule Refroidissement</Text>
                  <Text style={{ color: '#6B6050', fontSize: 11, marginTop: 2 }}>Suivi +63°C → +10°C en 2h max</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity style={{ backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }} onPress={async (e) => {
                  e.stopPropagation();
                  if (celluleLogs.length === 0) await loadCelluleLogs();
                  if (celluleLogs.length === 0) { Alert.alert('Aucun relevé', 'Ajoutez un relevé de cellule avant d\'exporter.'); return; }
                  try {
                    const html = await exportCellulePdf();
                    const { uri } = await Print.printToFileAsync({ html });
                    if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Cellule de Refroidissement', UTI: 'com.adobe.pdf' }); }
                    else { await Print.printAsync({ html }); }
                  } catch (err) { Alert.alert('Erreur', 'Impossible de générer le PDF.'); }
                }}>
                  <Text style={{ color: '#D4AF37', fontSize: 11, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>📄 PDF</Text>
                </TouchableOpacity>
                <Text style={{ color: '#D4AF37', fontSize: 16 }}>{showCellule ? '▲' : '▼'}</Text>
              </View>
            </TouchableOpacity>

            {showCellule && (
              <View style={{ padding: 16, gap: 10 }}>
                <View style={{ backgroundColor: 'rgba(212,175,55,0.06)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', borderRadius: 10, padding: 12, flexDirection: 'row', gap: 8 }}>
                  <Text style={{ fontSize: 14 }}>💡</Text>
                  <Text style={{ flex: 1, color: '#8A7A60', fontSize: 11, lineHeight: 16 }}>Un produit doit refroidir de +63°C à +10°C en moins de 2 heures (arrêté du 21/12/2009).</Text>
                </View>

                {!celluleForm ? (
                  <TouchableOpacity style={{ backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: '#D4AF37', borderRadius: 10, padding: 14, alignItems: 'center' }} onPress={() => setCelluleForm(true)}>
                    <Text style={{ color: '#D4AF37', fontSize: 12, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>➕ NOUVEAU RELEVÉ</Text>
                  </TouchableOpacity>
                ) : (
                  <CelluleForm onSave={saveCelluleLog} onCancel={() => setCelluleForm(false)} />
                )}

                {celluleLogs.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, opacity: 0.5 }}>🌬️</Text>
                    <Text style={{ color: '#6B6050', fontSize: 12, fontStyle: 'italic', marginTop: 6 }}>Aucun relevé enregistré</Text>
                  </View>
                ) : celluleLogs.slice(0, 5).map((l: any) => (
                  <View key={l.id} style={{ backgroundColor: '#111', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: '#F5F5DC', fontSize: 13, fontWeight: 'bold' }}>📅 {l.date} — {l.produit}</Text>
                      <TouchableOpacity onPress={() => Alert.alert('Supprimer ?', `Supprimer ce relevé ?`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => deleteCelluleLog(l.id) }])}>
                        <Text style={{ color: '#F87171', fontSize: 14 }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ color: '#8A7A60', fontSize: 11, marginTop: 4 }}>Qté: {l.quantite} · Avant: {l.tempAvant}°C ({l.heureAvant}) · Après: {l.tempApres}°C ({l.heureApres})</Text>
                    {l.conforme === false && <Text style={{ color: '#F87171', fontSize: 10, fontWeight: 'bold', marginTop: 4 }}>⚠️ NON CONFORME — Durée &gt; 2h ou temp &gt; 10°C</Text>}
                    {l.conforme === true && <Text style={{ color: '#4ADE80', fontSize: 10, fontWeight: 'bold', marginTop: 4 }}>✅ CONFORME</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ═══ MODULE : ÉTIQUETTES SANITAIRES ═══ */}
          <View style={{ marginTop: 2 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1A1A', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)' }}
              onPress={() => { if (!showEtiquettes) loadEtiquettePhotos(); setShowEtiquettes(!showEtiquettes); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 22 }}>🏷️</Text>
                <View>
                  <Text style={{ color: '#F5F5DC', fontSize: 14, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>Étiquettes Sanitaires</Text>
                  <Text style={{ color: '#6B6050', fontSize: 11, marginTop: 2 }}>Photos DLC & traçabilité du mois</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity style={{ backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }} onPress={async (e) => {
                  e.stopPropagation();
                  let photos = etiquettePhotos;
                  if (photos.length === 0) { await loadEtiquettePhotos(); photos = etiquettePhotos; }
                  if (photos.length === 0) { Alert.alert('Aucune étiquette', 'Scannez des étiquettes depuis Scanner → HACCP.'); return; }
                  try {
                    let restName = ''; let chefName = 'Le Chef';
                    try { const r = await Restaurant.get(); if (r?.nom) restName = r.nom; } catch {}
                    try { const token = await getToken(); const meRes = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }); const meJson = await meRes.json(); if (meJson.ok && meJson.data?.name) chefName = meJson.data.name; } catch {}
                    const logoUrl = 'https://osnckjlgqqawcgduideb.supabase.co/storage/v1/object/public/assets/logo.png';
                    const exportDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
                    const monthLbl = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                    const yr = new Date().getFullYear();
                    const currentHour = new Date().getHours();
                    const svc = (currentHour >= 2 && currentHour < 16) ? 'MIDI' : 'SOIR';
                    const photoRows = photos.map((p: any, idx: number) => {
                      const bg = idx % 2 === 0 ? '#FFFFFF' : '#FAFAF7';
                      return `<tr><td style="padding:8px 10px;border-bottom:1px solid #EEE;background:${bg};font-size:12px;font-weight:bold;color:#1A1A1A;text-align:center;">${idx + 1}</td><td style="padding:8px 10px;border-bottom:1px solid #EEE;background:${bg};">${p.uri ? `<img src="${p.uri}" width="70" height="50" style="border:1px solid #E8E0D0;" />` : '📷'}</td><td style="padding:8px 10px;border-bottom:1px solid #EEE;background:${bg};font-size:12px;color:#333;">${p.name || 'Étiquette'}</td><td style="padding:8px 10px;border-bottom:1px solid #EEE;background:${bg};font-size:11px;color:#888;">${p.date || '—'}</td><td style="padding:8px 10px;border-bottom:1px solid #EEE;background:${bg};font-size:11px;color:#A07D1C;font-weight:bold;text-align:center;">${p.estampille || '—'}</td></tr>`;
                    }).join('');
                    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Helvetica,Arial,sans-serif;color:#2C2C2C;margin:0;padding:0;padding-bottom:60px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111;"><tr><td style="padding:14px 40px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="80" style="vertical-align:middle;"><img src="${logoUrl}" width="90" height="90" /></td><td style="padding-left:24px;vertical-align:middle;"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="font-size:14px;letter-spacing:5px;text-transform:uppercase;color:#D4AF37;padding-bottom:4px;">✦ ChefGestion Pro ✦</td></tr>${restName ? `<tr><td style="font-size:24px;color:#F5F5DC;font-weight:bold;letter-spacing:1px;">🍽️ ${restName}</td></tr>` : ''}<tr><td style="font-size:14px;color:#F5F5DC;padding-top:5px;">👨‍🍳 &nbsp; <span style="color:#D4AF37;font-weight:bold;">Chef</span> &nbsp; ${chefName}</td></tr></table></td><td style="vertical-align:middle;text-align:right;"><span style="font-size:9px;color:#8A7A60;text-transform:uppercase;letter-spacing:1px;">Exporté le</span><br/><span style="font-size:14px;color:#8A7A60;">📅 ${exportDate}</span><br/><span style="font-size:11px;color:#D4AF37;">Service ${svc}</span></td></tr></table></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:3px;background-color:#D4AF37;"></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="text-align:center;padding:8px 40px 0;"><table cellpadding="0" cellspacing="0" border="0" align="center" style="border:2px solid #D4AF37;"><tr><td style="padding:10px 20px;text-align:center;"><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#A07D1C;text-align:center;padding-bottom:6px;">🏷️ Étiquettes Sanitaires HACCP</td></tr><tr><td style="font-size:22px;color:#1A1A1A;font-weight:bold;text-align:center;text-transform:capitalize;">${monthLbl}</td></tr><tr><td style="font-size:11px;color:#8A7A60;text-align:center;padding-top:4px;">${photos.length} étiquette${photos.length > 1 ? 's' : ''}</td></tr></table></td></tr></table></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:8px 40px;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-collapse:collapse;"><tr><th style="background:#111;color:#D4AF37;padding:6px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:center;border:1px solid #E8E0D0;">N°</th><th style="background:#111;color:#D4AF37;padding:6px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:center;border:1px solid #E8E0D0;">Photo</th><th style="background:#111;color:#D4AF37;padding:6px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:left;border:1px solid #E8E0D0;">Nom</th><th style="background:#111;color:#D4AF37;padding:6px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:left;border:1px solid #E8E0D0;">Date</th><th style="background:#111;color:#D4AF37;padding:6px 10px;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;text-align:center;border:1px solid #E8E0D0;">Estampille</th></tr>${photoRows}</table></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111;position:fixed;bottom:0;left:0;right:0;"><tr><td width="33%" style="padding:14px 40px;font-size:10px;color:#8A7A60;font-style:italic;">📄 Document généré automatiquement</td><td width="34%" style="padding:14px 0;font-size:10px;letter-spacing:3px;color:#D4AF37;text-transform:uppercase;text-align:center;">✦ ChefGestion Pro ✦</td><td width="33%" style="padding:14px 40px;font-size:10px;color:#8A7A60;text-align:right;">© ${yr} — Tous droits réservés</td></tr></table>
</body></html>`;
                    const { uri } = await Print.printToFileAsync({ html });
                    if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Étiquettes — ${monthLbl}`, UTI: 'com.adobe.pdf' }); }
                    else { await Print.printAsync({ html }); }
                  } catch { Alert.alert('Erreur', 'Impossible de générer le PDF.'); }
                }}>
                  <Text style={{ color: '#D4AF37', fontSize: 11, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>📄 PDF</Text>
                </TouchableOpacity>
                <Text style={{ color: '#D4AF37', fontSize: 16 }}>{showEtiquettes ? '▲' : '▼'}</Text>
              </View>
            </TouchableOpacity>

            {showEtiquettes && (
              <View style={{ padding: 16, gap: 10 }}>
                {etiquetteLoading ? (
                  <ActivityIndicator color="#D4AF37" style={{ marginTop: 10 }} />
                ) : etiquettePhotos.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, opacity: 0.5 }}>🏷️</Text>
                    <Text style={{ color: '#6B6050', fontSize: 12, fontStyle: 'italic', marginTop: 6 }}>Aucune étiquette ce mois-ci</Text>
                    <Text style={{ color: '#6B6050', fontSize: 10, marginTop: 4 }}>Scannez depuis Scanner → HACCP</Text>
                  </View>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                      {(showAllEtiquettes ? etiquettePhotos : etiquettePhotos.slice(0, 6)).map((p: any, i: number) => (
                        <TouchableOpacity key={i} style={{ width: '47%', backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)', borderRadius: 8, overflow: 'hidden' }} onPress={() => setSelectedEtiquette(p)} activeOpacity={0.8}>
                          <Image source={{ uri: p.uri }} style={{ width: '100%', height: 90 }} resizeMode="cover" />
                          <View style={{ padding: 6 }}>
                            <Text style={{ color: '#F5F5DC', fontSize: 11 }} numberOfLines={1}>{p.name || 'Étiquette'}</Text>
                            {p.date && <Text style={{ color: '#6B6050', fontSize: 9 }}>{p.date}</Text>}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {etiquettePhotos.length > 6 && (
                      <TouchableOpacity
                        style={{ alignItems: 'center', paddingVertical: 10, marginTop: 4 }}
                        onPress={() => setShowAllEtiquettes(!showAllEtiquettes)}
                      >
                        <Text style={{ color: '#D4AF37', fontSize: 11, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>
                          {showAllEtiquettes ? '▲  RÉDUIRE' : `▼  VOIR TOUT (${etiquettePhotos.length} photos)`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Modal plein écran étiquette */}
            <Modal visible={!!selectedEtiquette} transparent animationType="fade">
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
                <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }} onPress={() => setSelectedEtiquette(null)}>
                  <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
                {selectedEtiquette?.uri && <Image source={{ uri: selectedEtiquette.uri }} style={{ width: '90%', height: '70%' }} resizeMode="contain" />}
                {selectedEtiquette?.name && <Text style={{ color: '#F5F5DC', fontSize: 14, marginTop: 16, textAlign: 'center' }}>{selectedEtiquette.name}</Text>}
                {selectedEtiquette?.date && <Text style={{ color: '#6B6050', fontSize: 12, marginTop: 4 }}>{selectedEtiquette.date}</Text>}
              </View>
            </Modal>
          </View>

          {/* ═══ MODULE : SUIVI HUILES DE FRITURE ═══ */}
          <View style={{ marginTop: 2 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1A1A', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)' }}
              onPress={() => { if (!showHuiles) loadHuileLogs(); setShowHuiles(!showHuiles); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 22 }}>🛢️</Text>
                <View>
                  <Text style={{ color: '#F5F5DC', fontSize: 14, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>Huiles de Friture</Text>
                  <Text style={{ color: '#6B6050', fontSize: 11, marginTop: 2 }}>Suivi renouvellement & test polaire</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity style={{ backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }} onPress={async (e) => {
                  e.stopPropagation();
                  if (huileLogs.length === 0) await loadHuileLogs();
                  if (huileLogs.length === 0) { Alert.alert('Aucun contrôle', 'Ajoutez un contrôle d\'huile avant d\'exporter.'); return; }
                  try {
                    const html = await exportHuilesPdf();
                    const { uri } = await Print.printToFileAsync({ html });
                    if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Huiles de Friture', UTI: 'com.adobe.pdf' }); }
                    else { await Print.printAsync({ html }); }
                  } catch (err) { Alert.alert('Erreur', 'Impossible de générer le PDF.'); }
                }}>
                  <Text style={{ color: '#D4AF37', fontSize: 11, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>📄 PDF</Text>
                </TouchableOpacity>
                <Text style={{ color: '#D4AF37', fontSize: 16 }}>{showHuiles ? '▲' : '▼'}</Text>
              </View>
            </TouchableOpacity>

            {showHuiles && (
              <View style={{ padding: 16, gap: 10 }}>
                {!huileForm ? (
                  <TouchableOpacity style={{ backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: '#D4AF37', borderRadius: 10, padding: 14, alignItems: 'center' }} onPress={() => setHuileForm(true)}>
                    <Text style={{ color: '#D4AF37', fontSize: 12, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>➕ NOUVEAU CONTRÔLE</Text>
                  </TouchableOpacity>
                ) : (
                  <HuileForm onSave={saveHuileLog} onCancel={() => setHuileForm(false)} />
                )}

                {huileLogs.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, opacity: 0.5 }}>🛢️</Text>
                    <Text style={{ color: '#6B6050', fontSize: 12, fontStyle: 'italic', marginTop: 6 }}>Aucun contrôle enregistré</Text>
                  </View>
                ) : huileLogs.slice(0, 5).map((l: any) => (
                  <View key={l.id} style={{ backgroundColor: '#111', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: '#F5F5DC', fontSize: 13, fontWeight: 'bold' }}>📅 {l.date} — {l.friteuse}</Text>
                      <TouchableOpacity onPress={() => Alert.alert('Supprimer ?', '', [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => deleteHuileLog(l.id) }])}>
                        <Text style={{ color: '#F87171', fontSize: 14 }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ color: '#8A7A60', fontSize: 11, marginTop: 4 }}>Test polaire: {l.testPolaire}% · Action: {l.action}</Text>
                    {parseInt(l.testPolaire) > 25 && <Text style={{ color: '#F87171', fontSize: 10, fontWeight: 'bold', marginTop: 4 }}>⚠️ HUILE À CHANGER ({l.testPolaire}% &gt; 25%)</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ═══ MODULE : PLAN DE MAÎTRISE SANITAIRE ═══ */}
          <View style={{ marginTop: 2 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1A1A', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)' }}
              onPress={() => { if (!showPMS) loadPMSTasks(); setShowPMS(!showPMS); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 22 }}>🧹</Text>
                <View>
                  <Text style={{ color: '#F5F5DC', fontSize: 14, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>Plan de Maîtrise Sanitaire</Text>
                  <Text style={{ color: '#6B6050', fontSize: 11, marginTop: 2 }}>Checklist nettoyage & désinfection</Text>
                </View>
              </View>
              <Text style={{ color: '#D4AF37', fontSize: 16 }}>{showPMS ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showPMS && (
              <View style={{ padding: 16, gap: 6 }}>
                <View style={{ backgroundColor: 'rgba(212,175,55,0.06)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', borderRadius: 10, padding: 12, flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                  <Text style={{ fontSize: 14 }}>💡</Text>
                  <Text style={{ flex: 1, color: '#8A7A60', fontSize: 11, lineHeight: 16 }}>Cochez chaque zone après nettoyage. Le plan se réinitialise selon la fréquence indiquée.</Text>
                </View>

                {pmsTasks.map((t: any) => (
                  <TouchableOpacity key={t.id} onPress={() => togglePMSTask(t.id)} style={{ backgroundColor: '#111', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: t.done ? 'rgba(74,222,128,0.3)' : 'rgba(212,175,55,0.1)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontSize: 22 }}>{t.done ? '✅' : '⬜'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.done ? '#4ADE80' : '#F5F5DC', fontSize: 13, fontWeight: 'bold' }}>{t.icon} {t.zone}</Text>
                      <Text style={{ color: '#6B6050', fontSize: 10, marginTop: 2 }}>Fréquence : {t.freq}{t.lastDone ? ` · Dernier : ${t.lastDone}` : ''}</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 4 }}>
                  <Text style={{ color: '#4ADE80', fontSize: 11 }}>✅ {pmsTasks.filter((t: any) => t.done).length}/{pmsTasks.length} complétés</Text>
                  <TouchableOpacity onPress={async () => {
                    const reset = pmsTasks.map((t: any) => ({ ...t, done: false }));
                    setPmsTasks(reset);
                    await AsyncStorage.setItem('@haccp_pms', JSON.stringify(reset));
                  }}>
                    <Text style={{ color: '#D4AF37', fontSize: 11, fontFamily: 'Cinzel_700Bold' }}>🔄 RÉINITIALISER</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* ═══ MODULE : NETTOYAGE HOTTE ASPIRANTE ═══ */}
          <View style={{ marginTop: 2 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1A1A', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)' }}
              onPress={() => { if (!showHotte) loadHottePhotos(); setShowHotte(!showHotte); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 22 }}>🌀</Text>
                <View>
                  <Text style={{ color: '#F5F5DC', fontSize: 14, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>Nettoyage Hotte Aspirante</Text>
                  <Text style={{ color: '#6B6050', fontSize: 11, marginTop: 2 }}>Justificatif annuel obligatoire</Text>
                </View>
              </View>
              <Text style={{ color: '#D4AF37', fontSize: 16 }}>{showHotte ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showHotte && (
              <View style={{ padding: 16, gap: 10 }}>
                <View style={{ backgroundColor: 'rgba(212,175,55,0.06)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', borderRadius: 10, padding: 12, flexDirection: 'row', gap: 8 }}>
                  <Text style={{ fontSize: 14 }}>💡</Text>
                  <Text style={{ flex: 1, color: '#8A7A60', fontSize: 11, lineHeight: 16 }}>Importez le justificatif de nettoyage de votre hotte aspirante (1 fois par an minimum, obligatoire).</Text>
                </View>

                <TouchableOpacity style={{ backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: '#D4AF37', borderRadius: 10, padding: 14, alignItems: 'center' }} onPress={pickHottePhoto}>
                  <Text style={{ color: '#D4AF37', fontSize: 12, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>📸 IMPORTER UN JUSTIFICATIF</Text>
                </TouchableOpacity>

                {hottePhotos.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, opacity: 0.5 }}>🌀</Text>
                    <Text style={{ color: '#6B6050', fontSize: 12, fontStyle: 'italic', marginTop: 6 }}>Aucun justificatif importé</Text>
                  </View>
                ) : hottePhotos.map((p: any) => (
                  <View key={p.id} style={{ backgroundColor: '#111', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' }}>
                    <Image source={{ uri: p.uri }} style={{ width: '100%', height: 160 }} resizeMode="cover" />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
                      <View>
                        <Text style={{ color: '#F5F5DC', fontSize: 12 }}>📅 {p.date}</Text>
                        <Text style={{ color: '#6B6050', fontSize: 10, marginTop: 2 }}>Année {p.year}</Text>
                      </View>
                      <TouchableOpacity onPress={() => Alert.alert('Supprimer ?', '', [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => deleteHottePhoto(p.id) }])}>
                        <Text style={{ color: '#F87171', fontSize: 14 }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ─── MODALE DE SAISIE ────────────────────────────── */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={st.modalOverlay}>
            <View style={st.modalContent}>
            <Text style={st.modalTitle}>
              {modalMode === 'temperature' ? 'Saisie Température' : 'Saisie Commentaire'}
            </Text>
            <Text style={st.modalSubtitle}>
              {modalMode === 'temperature' ? `${selectedPeriode} · ${selectedDate}` : selectedDate}
            </Text>

            {modalMode === 'temperature' && (
              <TextInput
                style={st.input}
                placeholder="Ex: 3.4 ou -18"
                placeholderTextColor="#555"
                keyboardType="decimal-pad"
                value={tempValue}
                onChangeText={text => setTempValue(text.replace(',', '.'))}
                autoFocus
              />
            )}

            {modalMode === 'comment' && (
              <TextInput
                style={st.commentInput}
                placeholder="Saisissez votre commentaire..."
                placeholderTextColor="#555"
                value={commentValue}
                onChangeText={setCommentValue}
                multiline
                numberOfLines={3}
                autoFocus
              />
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[st.modalBtn, { backgroundColor: '#1a1a1a', flex: 1 }]} onPress={closeModal}>
                <Text style={{ color: '#666', textAlign: 'center' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.modalBtn, { backgroundColor: '#D4AF37', flex: 2 }]} onPress={handleSave}>
                <Text style={{ color: '#000', fontWeight: 'bold', textAlign: 'center' }}>✅ Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: { padding: 16, backgroundColor: '#1A1A1A', borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, color: '#F5F5DC', fontFamily: 'Cinzel_700Bold' },
  subtitle: { fontSize: 12, color: '#D4AF37', fontFamily: 'DMSans_400Regular' },

  exportBtn: { backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  exportBtnTxt: { color: '#D4AF37', fontSize: 11, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 },

  tabsContainer: { backgroundColor: '#0C0C0C', borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)', paddingVertical: 10 },
  tabsScroll: { paddingHorizontal: 12, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(212,175,55,0.08)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', minWidth: 90 },
  tabActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  tabLabel: { color: '#D4AF37', fontSize: 11, fontFamily: 'Cinzel_700Bold', letterSpacing: 0.5 },
  tabLabelActive: { color: '#000' },
  tabBadge: { backgroundColor: 'rgba(212,175,55,0.2)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  tabBadgeActive: { backgroundColor: 'rgba(0,0,0,0.2)' },
  tabBadgeText: { fontSize: 9, fontWeight: 'bold', color: '#D4AF37' },

  tableHeader: { flexDirection: 'row', backgroundColor: '#111', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.2)' },
  headerCell: { flex: 2, color: '#D4AF37', fontSize: 10, fontFamily: 'Cinzel_700Bold', letterSpacing: 1, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rowToday: { backgroundColor: 'rgba(212,175,55,0.06)' },
  dayCell: { flex: 1, color: '#9A8060', fontSize: 13, fontFamily: 'DMSans_400Regular' },
  tempCell: { flex: 2, alignItems: 'center', paddingVertical: 4 },
  tempText: { fontSize: 15, fontFamily: 'DMSans_400Regular', color: '#555' },
  commentIcon: { fontSize: 12, color: '#6B6050' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { color: '#F5F5DC', fontSize: 16, fontFamily: 'Cinzel_400Regular', textAlign: 'center', marginBottom: 8 },
  emptyHint: { color: '#6B6050', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#111', borderRadius: 16, padding: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  modalTitle: { color: '#D4AF37', fontSize: 14, fontFamily: 'Cinzel_700Bold', letterSpacing: 1, marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { color: '#9A8060', fontSize: 12, textAlign: 'center', marginBottom: 20, fontFamily: 'DMSans_400Regular' },
  input: { backgroundColor: '#000', borderWidth: 1, borderColor: '#D4AF37', borderRadius: 10, color: '#fff', fontSize: 28, textAlign: 'center', paddingVertical: 14, fontFamily: 'DMSans_400Regular' },
  commentInput: { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 10, color: '#fff', fontSize: 14, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12, fontFamily: 'DMSans_400Regular', textAlignVertical: 'top', minHeight: 80 },
  modalBtn: { borderRadius: 10, paddingVertical: 14 },
});