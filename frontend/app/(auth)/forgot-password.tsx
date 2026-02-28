import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useApp } from '../../lib/context'; // <--- Vérifie le nombre de "../" ici !
import { useRouter } from 'expo-router';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { requestPasswordReset } = useApp();
  const router = useRouter();

  const handleReset = async () => {
    if (!email) return Alert.alert("Erreur", "Saisis ton email.");
    
    setLoading(true);
    try {
      await requestPasswordReset(email);
      Alert.alert(
        "Lien envoyé", 
        "Si cet email existe dans notre base, un lien de réinitialisation a été envoyé.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Impossible d'envoyer l'email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Récupération</Text>
      <Text style={styles.subtitle}>Saisis l'email utilisé pour la Cabana del tío.</Text>
      
      <TextInput
        placeholder="Email professionnel"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <TouchableOpacity 
        onPress={handleReset} 
        disabled={loading}
        style={[styles.button, loading && { opacity: 0.7 }]}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Envoyer le lien Resend</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Retour à la connexion</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 10, color: '#1a1a1a' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 30 },
  input: { backgroundColor: '#f5f5f5', padding: 18, borderRadius: 12, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#eee' },
  button: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  backButton: { marginTop: 25, alignItems: 'center' },
  backText: { color: '#666', fontSize: 14 }
});