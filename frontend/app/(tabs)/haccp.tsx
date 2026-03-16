import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ActivityIndicator, ScrollView, 
  Alert, Modal, TextInput, TouchableOpacity 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getToken } from '../../lib/auth'; 

const API_URL = 'https://chefgestion-pro.onrender.com';

export default function HaccpScreen() {
  const [logs, setLogs]                       = useState<any[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [modalVisible, setModalVisible]       = useState(false);
  const [tempValue, setTempValue]             = useState('');
  const [selectedDate, setSelectedDate]       = useState('');
  const [selectedPeriode, setSelectedPeriode] = useState('');
  const [selectedFridgeId, setSelectedFridgeId] = useState<string | null>(null);

  const now          = new Date();
  const viewMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  useEffect(() => { fetchLogs(); }, []);

  // ─── FETCH ───────────────────────────────────────────────
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

  // ─── GROUPER PAR FRIGO ───────────────────────────────────
  function getLogsByFridge(): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    for (const log of logs) {
      const key = log.fridge_nom || 'Sans équipement';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(log);
    }
    return grouped;
  }

  // ─── COULEUR TEMPÉRATURE ─────────────────────────────────
  function getTempColor(val: number | null | undefined): string {
    if (val === null || val === undefined) return '#555';
    if (val < 0)  return '#60A5FA'; // bleu — congélateur
    if (val <= 4) return '#4ADE80'; // vert — bon
    if (val <= 8) return '#FACC15'; // orange — limite
    return '#F87171';               // rouge — hors norme
  }

  // ─── OUVRIR MODALE ───────────────────────────────────────
  const openInput = (date: string, periode: string, currentVal: any, fridgeId?: string) => {
    setSelectedDate(date);
    setSelectedPeriode(periode);
    setTempValue(currentVal !== null && currentVal !== undefined ? String(currentVal) : '');
    setSelectedFridgeId(fridgeId ?? null);
    setModalVisible(true);
  };

  // ─── ENREGISTRER ─────────────────────────────────────────
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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          date: selectedDate,
          periode: selectedPeriode,
          valeur: parseFloat(cleanValue),
          fridge_id: selectedFridgeId,
        })
      });
      const res = await response.json();
      if (res.ok) {
        setModalVisible(false);
        setTempValue('');
        fetchLogs();
      } else {
        Alert.alert('Erreur', res.error || "Impossible d'enregistrer.");
      }
    } catch {
      Alert.alert('Erreur', 'Connexion au serveur impossible.');
    }
  };

  // ─── RENDER UNE LIGNE JOUR ───────────────────────────────
  function renderDayRow(day: number, fridgeLogs: any[], fridgeId?: string) {
    const dateStr = `${viewMonthStr}-${day.toString().padStart(2, '0')}`;
    const midi    = fridgeLogs.find(l => l.date === dateStr && l.periode === 'MIDI');
    const soir    = fridgeLogs.find(l => l.date === dateStr && l.periode === 'SOIR');

    return (
      <View key={`${fridgeId ?? 'all'}-${day}`} style={styles.row}>
        <Text style={styles.dayCell}>{day}</Text>

        <TouchableOpacity
          style={styles.tempCell}
          onPress={() => openInput(dateStr, 'MIDI', midi?.valeur, midi?.fridge_id ?? fridgeId)}
        >
          <Text style={[styles.tempText, { color: getTempColor(midi?.valeur) }]}>
            {midi ? `${midi.valeur}°C` : '--'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tempCell}
          onPress={() => openInput(dateStr, 'SOIR', soir?.valeur, soir?.fridge_id ?? fridgeId)}
        >
          <Text style={[styles.tempText, { color: getTempColor(soir?.valeur) }]}>
            {soir ? `${soir.valeur}°C` : '--'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── DONNÉES ─────────────────────────────────────────────
  const grouped     = getLogsByFridge();
  const fridgeNames = Object.keys(grouped);

  // ─── RENDER ──────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>

      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.title}>Relevés HACCP</Text>
        <Text style={styles.subtitle}>{viewMonthStr.replace('-', ' / ')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#D4AF37" style={{ marginTop: 40 }} />

      ) : logs.length === 0 ? (
        /* ── État vide ─────────────────────────────────── */
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🌡️</Text>
          <Text style={styles.emptyText}>Aucun relevé ce mois-ci</Text>
          <Text style={styles.emptyHint}>
            Scannez des températures depuis{'\n'}l'onglet Scanner → Température
          </Text>
        </View>

      ) : (
        /* ── Tableau ───────────────────────────────────── */
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* En-tête colonnes */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, { flex: 1 }]}>Jour</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>Midi</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>Soir</Text>
          </View>

          {fridgeNames.length > 0 ? (
            /* ── Groupé par frigo ──────────────────────── */
            fridgeNames.map(fridgeName => {
              const fridgeLogs = grouped[fridgeName];
              const isFreezer  = fridgeName.toLowerCase().includes('congél') ||
                                 fridgeName.toLowerCase().includes('surgél');

              const daysWithData = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(day => {
                const d = `${viewMonthStr}-${day.toString().padStart(2, '0')}`;
                return fridgeLogs.some(l => l.date === d);
              });

              if (daysWithData.length === 0) return null;

              return (
                <View key={fridgeName} style={styles.fridgeSection}>
                  <View style={styles.fridgeHeader}>
                    <Text style={styles.fridgeTitle}>
                      {isFreezer ? '🧊' : '❄️'}  {fridgeName.toUpperCase()}
                    </Text>
                  </View>
                  {daysWithData.map(day => renderDayRow(day, fridgeLogs))}
                </View>
              );
            })
          ) : (
            /* ── Affichage classique sans frigos ───────── */
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

      {/* ─── MODALE DE SAISIE ────────────────────────────── */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Saisie Température</Text>
            <Text style={styles.modalSubtitle}>
              {selectedPeriode} · {selectedDate}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Ex: 3.4 ou -18"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
              value={tempValue}
              onChangeText={text => setTempValue(text.replace(',', '.'))}
              autoFocus
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#1a1a1a', flex: 1 }]}
                onPress={() => { setModalVisible(false); setTempValue(''); }}
              >
                <Text style={{ color: '#666', textAlign: 'center' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#D4AF37', flex: 2 }]}
                onPress={handleSaveTemp}
              >
                <Text style={{ color: '#000', fontWeight: 'bold', textAlign: 'center' }}>
                  ✅ Enregistrer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    padding: 20,
    backgroundColor: '#0C0C0C',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.15)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title:    { fontSize: 18, color: '#F5F5DC', fontFamily: 'Cinzel_700Bold' },
  subtitle: { fontSize: 12, color: '#D4AF37', fontFamily: 'DMSans_400Regular' },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.2)',
  },
  headerCell: {
    flex: 2,
    color: '#D4AF37',
    fontSize: 10,
    fontFamily: 'Cinzel_700Bold',
    letterSpacing: 1,
    textAlign: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  dayCell: { flex: 1, color: '#9A8060', fontSize: 13, fontFamily: 'DMSans_400Regular' },
  tempCell: { flex: 2, alignItems: 'center', paddingVertical: 4 },
  tempText: { fontSize: 15, fontFamily: 'DMSans_400Regular', color: '#555' },
  activeTemp: { color: '#4ADE80' },

  fridgeSection: { marginBottom: 4 },
  fridgeHeader: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
    marginTop: 8,
  },
  fridgeTitle: { color: '#D4AF37', fontSize: 11, fontFamily: 'Cinzel_700Bold', letterSpacing: 2 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { color: '#F5F5DC', fontSize: 16, fontFamily: 'Cinzel_400Regular', textAlign: 'center', marginBottom: 8 },
  emptyHint: { color: '#6B6050', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  modalTitle: {
    color: '#D4AF37', fontSize: 14, fontFamily: 'Cinzel_700Bold',
    letterSpacing: 1, marginBottom: 4, textAlign: 'center',
  },
  modalSubtitle: {
    color: '#9A8060', fontSize: 12, textAlign: 'center',
    marginBottom: 20, fontFamily: 'DMSans_400Regular',
  },
  input: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#D4AF37',
    borderRadius: 10,
    color: '#fff',
    fontSize: 28,
    textAlign: 'center',
    paddingVertical: 14,
    fontFamily: 'DMSans_400Regular',
  },
  modalBtn: { borderRadius: 10, paddingVertical: 14 },
});
