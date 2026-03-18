import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView,
  Alert, Modal, TextInput, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import { getToken } from '../../lib/auth';

const API_URL = 'https://chefgestion-pro.onrender.com';

export default function HaccpScreen() {
  const navigation = useNavigation();
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

  const now          = new Date();
  const viewMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayStr     = now.toISOString().split('T')[0];

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
  }, []);

  // ─── Sélectionner automatiquement le 1er frigo ──────────
  useEffect(() => {
    if (fridges.length > 0 && !activeFridgeId) {
      setActiveFridgeId(fridges[0].id);
    }
  }, [fridges]);

  // ─── CHARGER LES FRIGOS ─────────────────────────────────
  const fetchFridges = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/fridges`, {
        headers: { 'Authorization': `Bearer ${token}` },
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
        `${API_URL}/api/scan/haccp-logs?year=${now.getFullYear()}&month=${(now.getMonth() + 1).toString().padStart(2, '0')}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
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
    if (val < 0)  return '#60A5FA';
    if (val <= 4) return '#4ADE80';
    if (val <= 8) return '#FACC15';
    return '#F87171';
  }

  // ─── FRIGO ACTIF + LOGS FILTRÉS ──────────────────────────
  const activeFridge = fridges.find(f => f.id === activeFridgeId) || null;

  const activeLogs = activeFridgeId
    ? logs.filter(l => l.fridge_id === activeFridgeId || (l.fridge_nom && activeFridge && l.fridge_nom === activeFridge.nom))
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
      const cleanValue = tempValue.replace(',', '.');
      if (!cleanValue || isNaN(Number(cleanValue))) {
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
        payload.valeur = parseFloat(tempValue.replace(',', '.'));
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
    const monthLabel = viewMonthStr.replace('-', ' / ');
    let tableHtml = '';

    const fridgesToShow = fridges.length > 0 ? fridges : [{ id: null, nom: 'Sans équipement', type: 'positif' }];

    for (const fridge of fridgesToShow) {
      const fridgeLogs = fridge.id
        ? logs.filter(l => l.fridge_id === fridge.id || (l.fridge_nom && l.fridge_nom === fridge.nom))
        : logs.filter(l => !l.fridge_id);
      const isFreez = fridge.type === 'negatif' || fridge.nom?.toLowerCase().includes('congél') || fridge.nom?.toLowerCase().includes('surgél');

      tableHtml += `<h2 style="color:#D4AF37;border-bottom:2px solid #D4AF37;padding-bottom:6px;margin-top:24px;">${isFreez ? '🧊' : '❄️'} ${fridge.nom}</h2>`;
      tableHtml += `<table><thead><tr><th>Jour</th><th>MIDI</th><th>SOIR</th><th>Commentaire</th></tr></thead><tbody>`;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${viewMonthStr}-${day.toString().padStart(2, '0')}`;
        const midi = fridgeLogs.find(l => l.date === dateStr && l.periode === 'MIDI');
        const soir = fridgeLogs.find(l => l.date === dateStr && l.periode === 'SOIR');
        const comment = midi?.commentaire || soir?.commentaire || '';
        tableHtml += `<tr><td>${day}</td><td style="color:${getTempColor(midi?.valeur)};font-weight:bold;">${midi ? midi.valeur + '°C' : '--'}</td><td style="color:${getTempColor(soir?.valeur)};font-weight:bold;">${soir ? soir.valeur + '°C' : '--'}</td><td style="font-style:italic;color:#888;">${comment}</td></tr>`;
      }
      tableHtml += `</tbody></table>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Georgia,serif;max-width:740px;margin:24px auto;color:#222;}h1{text-align:center;font-size:18px;letter-spacing:3px;border-bottom:2px solid #D4AF37;padding-bottom:12px;}.meta{text-align:center;color:#888;font-size:12px;margin-bottom:20px;}table{width:100%;border-collapse:collapse;margin-bottom:20px;}th{background:#111;color:#D4AF37;padding:8px;font-size:11px;text-align:center;}td{padding:6px 8px;border-bottom:1px solid #eee;text-align:center;font-size:13px;}tr:nth-child(even){background:#f9f9f9;}</style></head><body><h1>RELEVÉS DE TEMPÉRATURES HACCP</h1><p class="meta">Mois : ${monthLabel} — Exporté le ${new Date().toLocaleDateString('fr-FR')}</p>${tableHtml}</body></html>`;

    try { await Print.printAsync({ html }); } catch { Alert.alert('Erreur', "Impossible d'exporter en PDF."); }
  };

  // ─── COMPTEUR DE RELEVÉS POUR UN FRIGO ───────────────────
  function getFridgeLogCount(fridgeId: string) {
    return logs.filter(l => l.fridge_id === fridgeId || (l.fridge_nom && fridges.find(f => f.id === fridgeId)?.nom === l.fridge_nom)).length;
  }

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
            <Text style={st.title}>Relevés HACCP</Text>
            <Text style={st.subtitle}>{viewMonthStr.replace('-', ' / ')}</Text>
          </View>
        </View>
        <TouchableOpacity style={st.exportBtn} onPress={exportPdf}>
          <Text style={st.exportBtnTxt}>📄 PDF</Text>
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
        <View style={{ flex: 1 }}>

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
                      <Text style={{ fontSize: 16 }}>{isFreez ? '🧊' : '❄️'}</Text>
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

          {/* ─── EN-TÊTE COLONNES FIXE ───────────────────── */}
          <View style={st.tableHeader}>
            <Text style={[st.headerCell, { flex: 1 }]}>Jour</Text>
            <Text style={[st.headerCell, { flex: 2 }]}>Midi</Text>
            <Text style={[st.headerCell, { flex: 2 }]}>Soir</Text>
            <Text style={[st.headerCell, { flex: 1.5 }]}>Comm.</Text>
          </View>

          {/* ─── TABLEAU SCROLLABLE ──────────────────────── */}
          <ScrollView showsVerticalScrollIndicator={false}>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day =>
              renderDayRow(day)
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      )}

      {/* ─── MODALE DE SAISIE ────────────────────────────── */}
      <Modal visible={modalVisible} transparent animationType="fade">
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
