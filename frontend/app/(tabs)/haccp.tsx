import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ActivityIndicator, ScrollView, 
  Alert, Modal, TextInput, TouchableOpacity 
} from 'react-native';
import { getToken } from '../../lib/auth'; 

const API_URL = 'https://chefgestion-pro.onrender.com';

export default function HaccpScreen() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États pour la Modale
  const [modalVisible, setModalVisible] = useState(false);
  const [tempValue, setTempValue] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPeriode, setSelectedPeriode] = useState('');

  const now = new Date();
  const viewMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/scan/haccp-logs?year=${now.getFullYear()}&month=${(now.getMonth() + 1).toString().padStart(2, '0')}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const json = await response.json();
      if (json.ok) setLogs(json.data);
    } catch (err) {
      console.error("Erreur Fetch HACCP:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour ouvrir la saisie
  const openInput = (date: string, periode: string, currentVal: string) => {
    setSelectedDate(date);
    setSelectedPeriode(periode);
    setTempValue(currentVal.replace('°C', ''));
    setModalVisible(true);
  };

  // Fonction pour envoyer la température au Backend
  const handleSaveTemp = async () => {
  // 1. On remplace la virgule par un point immédiatement
  const cleanValue = tempValue.replace(',', '.');

  if (!cleanValue || isNaN(Number(cleanValue))) {
    Alert.alert("Erreur", "Veuillez entrer un chiffre valide.");
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
        valeur: parseFloat(cleanValue) // Envoi d'un nombre propre
      })
    });

    const res = await response.json();
    if (res.ok) {
      setModalVisible(false);
      setTempValue(''); // On vide pour la prochaine fois
      fetchLogs(); 
    } else {
      // Pour debug : on affiche l'erreur réelle du serveur si elle existe
      Alert.alert("Erreur", res.error || "Impossible d'enregistrer.");
    }
  } catch (err) {
    Alert.alert("Erreur", "Connexion au serveur impossible.");
  }
};

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Relevés HACCP - {viewMonthStr}</Text>
      
      <View style={styles.tableHeader}>
        <Text style={styles.headerCell}>Jour</Text>
        <Text style={styles.headerCell}>Midi</Text>
        <Text style={styles.headerCell}>Soir</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#D4AF37" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView>
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = `${viewMonthStr}-${day.toString().padStart(2, '0')}`;
            const midi = logs.find(l => l.date === dateStr && l.periode === 'MIDI');
            const soir = logs.find(l => l.date === dateStr && l.periode === 'SOIR');
            
            return (
              <View key={day} style={styles.row}>
                <Text style={styles.dayCell}>{day}</Text>
                
                {/* Case MIDI cliquable */}
                <TouchableOpacity 
                  style={styles.tempCell} 
                  onPress={() => openInput(dateStr, 'MIDI', midi ? midi.valeur : '')}
                >
                  <Text style={[styles.tempText, midi && styles.activeTemp]}>
                    {midi ? `${midi.valeur}°C` : '--'}
                  </Text>
                </TouchableOpacity>

                {/* Case SOIR cliquable */}
                <TouchableOpacity 
                  style={styles.tempCell} 
                  onPress={() => openInput(dateStr, 'SOIR', soir ? soir.valeur : '')}
                >
                  <Text style={[styles.tempText, soir && styles.activeTemp]}>
                    {soir ? `${soir.valeur}°C` : '--'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* --- MODALE DE SAISIE --- */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>SSaisie Température</Text>
            <Text style={styles.modalSubtitle}>{selectedPeriode} - {selectedDate}</Text>
            
           <TextInput
  style={styles.input}
  placeholder="Ex: 3.4"
  placeholderTextColor="#666"
  keyboardType="decimal-pad" // Clavier numérique avec point/virgule
  value={tempValue}
  onChangeText={(text) => setTempValue(text.replace(',', '.'))} // Force le point en temps réel
  autoFocus
/>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnText}>ANNULER</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.btnSave} onPress={handleSaveTemp}>
                <Text style={styles.btnTextBlack}>VALIDER</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#000', paddingTop: 60 },
  title: { fontSize: 22, color: '#D4AF37', marginBottom: 20, textAlign: 'center', fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#D4AF37', paddingBottom: 10, marginBottom: 10 },
  headerCell: { flex: 1, color: '#D4AF37', fontWeight: 'bold', textAlign: 'center' },
  row: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 0.5, borderColor: '#333' },
  dayCell: { flex: 1, color: '#FFF', textAlign: 'center', fontWeight: 'bold' },
  tempCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tempText: { color: '#666' },
  activeTemp: { color: '#FFF', fontWeight: 'bold' },
  
  // Styles Modale
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#1A1A1A', padding: 25, borderRadius: 15, borderWidth: 1, borderColor: '#D4AF37' },
  modalTitle: { color: '#D4AF37', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
  modalSubtitle: { color: '#FFF', textAlign: 'center', marginBottom: 20, opacity: 0.7 },
  input: { backgroundColor: '#333', color: '#FFF', padding: 15, borderRadius: 10, textAlign: 'center', fontSize: 24, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  btnCancel: { padding: 15, flex: 1, marginRight: 10, alignItems: 'center' },
  btnSave: { backgroundColor: '#D4AF37', padding: 15, flex: 1, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#D4AF37', fontWeight: 'bold' },
  btnTextBlack: { color: '#000', fontWeight: 'bold' },
});