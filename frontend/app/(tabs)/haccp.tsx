import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView,
  Alert, Modal, TextInput, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import { getToken } from '../../lib/auth';

const API_URL = 'https://chefgestion-pro.onrender.com';

export default function HaccpScreen() {
  const [logs, setLogs]                         = useState<any[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [modalVisible, setModalVisible]         = useState(false);
  const [tempValue, setTempValue]               = useState('');
  const [commentValue, setCommentValue]         = useState('');
  const [selectedDate, setSelectedDate]         = useState('');
  const [selectedPeriode, setSelectedPeriode]   = useState('');
  const [selectedFridgeId, setSelectedFridgeId] = useState<string | null>(null);

  const now          = new Date();
  const viewMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  useEffect(() => { fetchLogs(); }, []);

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

  function getLogsByFridge(): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    for (const log of logs) {
      const key = log.fridge_nom || 'Sans équipement';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(log);
    }
    return grouped;
  }

  function getTempColor(val: number | null | undefined): string {
    if (val === null || val === undefined) return '#555';
    if (val < 0)  return '#60A5FA';
    if (val <= 4) return '#4ADE80';
    if (val <= 8) return '#FACC15';
    return '#F87171';
  }

  const openInput = (date: string, periode: string, currentVal: any, fridgeId?: string, currentComment?: string) => {
    setSelectedDate(date);
    setSelectedPeriode(periode);
    setTempValue(currentVal !== null && currentVal !== undefined ? String(currentVal) : '');
    setCommentValue(currentComment || '');
    setSelectedFridgeId(fridgeId ?? null);
    setModalVisible(true);
  };

  const handleSaveTemp = async () => {
    const cleanValue = tempValue.replace(',', '.');
    if (!cleanValue || isNaN(Number(cleanValue))) {
      Alert.alert('Erreur', 'Veuillez entrer un chiffre valide.');
      return;
    }
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/scan/haccp-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          date: selectedDate,
          periode: selectedPeriode,
          valeur: parseFloat(cleanValue),
          fridge_id: selectedFridgeId,
          commentaire: commentValue.trim(),
        })
      });
      const res = await response.json();
      if (res.ok) {
        setModalVisible(false);
        setTempValue('');
        setCommentValue('');
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
    const grouped = getLogsByFridge();
    const monthLabel = viewMonthStr.replace('-', ' / ');
    let tableHtml = '';

    for (const fridgeName of Object.keys(grouped)) {
      const fridgeLogs = grouped[fridgeName];
      const isFreezer = fridgeName.toLowerCase().includes('congél') || fridgeName.toLowerCase().includes('surgél');
      tableHtml += `<h2 style="color:#D4AF37;border-bottom:2px solid #D4AF37;padding-bottom:6px;margin-top:24px;">${isFreezer ? '🧊' : '❄️'} ${fridgeName}</h2>`;
      tableHtml += `<table><thead><tr><th>Jour</th><th>MIDI</th><th>SOIR</th><th>Commentaire</th></tr></thead><tbody>`;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${viewMonthStr}-${day.toString().padStart(2, '0')}`;
        const midi = fridgeLogs.find(l => l.date === dateStr && l.periode === 'MIDI');
        const soir = fridgeLogs.find(l => l.date === dateStr && l.periode === 'SOIR');
        if (!midi && !soir) continue;
        const comment = midi?.commentaire || soir?.commentaire || '';
        tableHtml += `<tr><td>${day}</td><td style="color:${getTempColor(midi?.valeur)};font-weight:bold;">${midi ? midi.valeur + '°C' : '--'}</td><td style="color:${getTempColor(soir?.valeur)};font-weight:bold;">${soir ? soir.valeur + '°C' : '--'}</td><td style="font-style:italic;color:#888;">${comment}</td></tr>`;
      }
      tableHtml += `</tbody></table>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Georgia,serif;max-width:740px;margin:24px auto;color:#222;}h1{text-align:center;font-size:18px;letter-spacing:3px;border-bottom:2px solid #D4AF37;padding-bottom:12px;}.meta{text-align:center;color:#888;font-size:12px;margin-bottom:20px;}table{width:100%;border-collapse:collapse;margin-bottom:20px;}th{background:#111;color:#D4AF37;padding:8px;font-size:11px;text-align:center;}td{padding:6px 8px;border-bottom:1px solid #eee;text-align:center;font-size:13px;}tr:nth-child(even){background:#f9f9f9;}</style></head><body><h1>RELEVÉS DE TEMPÉRATURES HACCP</h1><p class="meta">Mois : ${monthLabel} — Exporté le ${new Date().toLocaleDateString('fr-FR')}</p>${tableHtml || '<p style="text-align:center;color:#999;">Aucun relevé ce mois-ci</p>'}</body></html>`;

    try { await Print.printAsync({ html }); } catch { Alert.alert('Erreur', "Impossible d'exporter en PDF."); }
  };

  function renderDayRow(day: number, fridgeLogs: any[], fridgeId?: string) {
    const dateStr = `${viewMonthStr}-${day.toString().padStart(2, '0')}`;
    const midi = fridgeLogs.find(l => l.date === dateStr && l.periode === 'MIDI');
    const soir = fridgeLogs.find(l => l.date === dateStr && l.periode === 'SOIR');
    const hasComment = midi?.commentaire || soir?.commentaire;

    return (
      <View key={`${fridgeId ?? 'all'}-${day}`}>
        <View style={st.row}>
          <Text style={st.dayCell}>{day}</Text>
          <TouchableOpacity style={st.tempCell} onPress={() => openInput(dateStr, 'MIDI', midi?.valeur, midi?.fridge_id ?? fridgeId, midi?.commentaire)}>
            <Text style={[st.tempText, { color: getTempColor(midi?.valeur) }]}>{midi ? `${midi.valeur}°C` : '--'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.tempCell} onPress={() => openInput(dateStr, 'SOIR', soir?.valeur, soir?.fridge_id ?? fridgeId, soir?.commentaire)}>
            <Text style={[st.tempText, { color: getTempColor(soir?.valeur) }]}>{soir ? `${soir.valeur}°C` : '--'}</Text>
          </TouchableOpacity>
        </View>
        {hasComment ? (
          <View style={st.commentRow}>
            <Text style={st.commentText}>💬 {midi?.commentaire || soir?.commentaire}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  const grouped = getLogsByFridge();
  const fridgeNames = Object.keys(grouped);

  return (
    <SafeAreaView style={st.container}>
      <View style={st.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Image source={require('../../assets/logo.png')} style={{ width: 28, height: 28, borderRadius: 6, marginRight: 10 }} resizeMode="contain" />
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
      ) : logs.length === 0 ? (
        <View style={st.emptyContainer}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🌡️</Text>
          <Text style={st.emptyText}>Aucun relevé ce mois-ci</Text>
          <Text style={st.emptyHint}>Scannez des températures depuis{'\n'}l'onglet Scanner → Température</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={st.tableHeader}>
            <Text style={[st.headerCell, { flex: 1 }]}>Jour</Text>
            <Text style={[st.headerCell, { flex: 2 }]}>Midi</Text>
            <Text style={[st.headerCell, { flex: 2 }]}>Soir</Text>
          </View>

          {fridgeNames.length > 0 ? (
            fridgeNames.map(fridgeName => {
              const fridgeLogs = grouped[fridgeName];
              const isFreezer = fridgeName.toLowerCase().includes('congél') || fridgeName.toLowerCase().includes('surgél');
              const daysWithData = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(day => {
                const d = `${viewMonthStr}-${day.toString().padStart(2, '0')}`;
                return fridgeLogs.some(l => l.date === d);
              });
              if (daysWithData.length === 0) return null;
              return (
                <View key={fridgeName} style={st.fridgeSection}>
                  <View style={st.fridgeHeader}>
                    <Text style={st.fridgeTitle}>{isFreezer ? '🧊' : '❄️'}  {fridgeName.toUpperCase()}</Text>
                  </View>
                  {daysWithData.map(day => renderDayRow(day, fridgeLogs))}
                </View>
              );
            })
          ) : (
            Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = `${viewMonthStr}-${day.toString().padStart(2, '0')}`;
              const midi = logs.find(l => l.date === dateStr && l.periode === 'MIDI');
              const soir = logs.find(l => l.date === dateStr && l.periode === 'SOIR');
              if (!midi && !soir) return null;
              return renderDayRow(day, logs);
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>Saisie Température</Text>
            <Text style={st.modalSubtitle}>{selectedPeriode} · {selectedDate}</Text>
            <TextInput style={st.input} placeholder="Ex: 3.4 ou -18" placeholderTextColor="#555" keyboardType="decimal-pad" value={tempValue} onChangeText={text => setTempValue(text.replace(',', '.'))} autoFocus />
            <TextInput style={st.commentInput} placeholder="Commentaire (optionnel)" placeholderTextColor="#555" value={commentValue} onChangeText={setCommentValue} multiline numberOfLines={2} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[st.modalBtn, { backgroundColor: '#1a1a1a', flex: 1 }]} onPress={() => { setModalVisible(false); setTempValue(''); setCommentValue(''); }}>
                <Text style={{ color: '#666', textAlign: 'center' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.modalBtn, { backgroundColor: '#D4AF37', flex: 2 }]} onPress={handleSaveTemp}>
                <Text style={{ color: '#000', fontWeight: 'bold', textAlign: 'center' }}>✅ Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 20, backgroundColor: '#0C0C0C', borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, color: '#F5F5DC', fontFamily: 'Cinzel_700Bold' },
  subtitle: { fontSize: 12, color: '#D4AF37', fontFamily: 'DMSans_400Regular' },
  exportBtn: { backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  exportBtnTxt: { color: '#D4AF37', fontSize: 11, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#111', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.2)' },
  headerCell: { flex: 2, color: '#D4AF37', fontSize: 10, fontFamily: 'Cinzel_700Bold', letterSpacing: 1, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  dayCell: { flex: 1, color: '#9A8060', fontSize: 13, fontFamily: 'DMSans_400Regular' },
  tempCell: { flex: 2, alignItems: 'center', paddingVertical: 4 },
  tempText: { fontSize: 15, fontFamily: 'DMSans_400Regular', color: '#555' },
  commentRow: { paddingHorizontal: 20, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  commentText: { fontSize: 10, color: '#8A7A60', fontStyle: 'italic' },
  fridgeSection: { marginBottom: 4 },
  fridgeHeader: { backgroundColor: 'rgba(212,175,55,0.08)', paddingHorizontal: 16, paddingVertical: 10, borderLeftWidth: 3, borderLeftColor: '#D4AF37', marginTop: 8 },
  fridgeTitle: { color: '#D4AF37', fontSize: 11, fontFamily: 'Cinzel_700Bold', letterSpacing: 2 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { color: '#F5F5DC', fontSize: 16, fontFamily: 'Cinzel_400Regular', textAlign: 'center', marginBottom: 8 },
  emptyHint: { color: '#6B6050', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#111', borderRadius: 16, padding: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  modalTitle: { color: '#D4AF37', fontSize: 14, fontFamily: 'Cinzel_700Bold', letterSpacing: 1, marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { color: '#9A8060', fontSize: 12, textAlign: 'center', marginBottom: 20, fontFamily: 'DMSans_400Regular' },
  input: { backgroundColor: '#000', borderWidth: 1, borderColor: '#D4AF37', borderRadius: 10, color: '#fff', fontSize: 28, textAlign: 'center', paddingVertical: 14, fontFamily: 'DMSans_400Regular' },
  commentInput: { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 10, color: '#fff', fontSize: 14, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12, fontFamily: 'DMSans_400Regular', textAlignVertical: 'top', minHeight: 50 },
  modalBtn: { borderRadius: 10, paddingVertical: 14 },
});
