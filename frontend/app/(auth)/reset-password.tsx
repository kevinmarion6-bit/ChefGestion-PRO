import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Auth } from '@/lib/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const C = {
  black: '#000', blackM: '#111', charcoal: '#1A1A1A',
  gold: '#D4AF37', bronze: '#CD7F32',
  cream: '#F5F5DC', muted: '#6B6050', mutedL: '#8A7A60',
};

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSecure, setIsSecure] = useState(true);

  const handleReset = async () => {
    if (!email || !code || !password) { 
      Alert.alert('Champs requis', 'Remplis tous les champs.'); 
      return; 
    }
    if (password.length < 8) { 
      Alert.alert('Sécurité', 'Le mot de passe doit faire 8 caractères min.'); 
      return; 
    }

    setLoading(true);
    try {
      // On envoie les 3 infos : email, code (token) et password
      await Auth.resetPassword(email, code, password);
      
      Alert.alert(
        'Succès ! 👨‍🍳', 
        'Ton mot de passe a été mis à jour avec succès.',
        [{ text: 'Se connecter', onPress: () => router.replace('/login') }]
      );
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Code invalide ou expiré. Réessaie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.root} bounces={false}>
      <View style={s.logoWrap}>
        <Text style={s.tagline}>🔒 NOUVEL ACCÈS</Text>
      </View>

      <View style={s.card}>
        <View style={s.cardTopLine} />
        <View style={s.formPad}>
          
          <Text style={s.fieldLabel}>Ton adresse e-mail</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="exemple-chef@gmail.com"
            placeholderTextColor={C.muted}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={{ height: 18 }} />

          <Text style={s.fieldLabel}>Code de validation (6 chiffres)</Text>
          <TextInput
            style={[s.input, s.codeInput]}
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor={C.muted}
            keyboardType="number-pad"
            maxLength={6}
          />

          <View style={{ height: 18 }} />

          <Text style={s.fieldLabel}>Nouveau mot de passe</Text>
          <View style={s.passWrap}>
            <TextInput
              style={[s.input, { flex: 1, paddingRight: 50 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={C.muted}
              secureTextEntry={isSecure}
            />
            <TouchableOpacity 
              style={s.eye} 
              onPress={() => setIsSecure(!isSecure)}
            >
              <MaterialCommunityIcons 
                name={isSecure ? "eye-off" : "eye"} 
                size={20} 
                color={C.gold} 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[s.btn, loading && s.btnOff]} 
            onPress={handleReset} 
            disabled={loading}
          >
            <Text style={s.btnTxt}>{loading ? 'Mise à jour...' : 'Valider le changement'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={s.backTxt}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flexGrow: 1, backgroundColor: C.black, justifyContent: 'center', padding: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 28 },
  tagline: { fontFamily: 'Cinzel_400Regular', fontSize: 22, letterSpacing: 4, color: C.gold, textTransform: 'uppercase' },
  card: { backgroundColor: C.charcoal, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.22)', overflow: 'hidden' },
  cardTopLine: { height: 1, backgroundColor: C.gold, opacity: 0.5 },
  formPad: { padding: 22 },
  fieldLabel: { fontFamily: 'Cinzel_400Regular', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: C.mutedL, marginBottom: 8 },
  input: { backgroundColor: C.blackM, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', borderRadius: 8, padding: 14, color: C.cream, fontSize: 17 },
  passWrap: { flexDirection: 'row', alignItems: 'center' },
  eye: { position: 'absolute', right: 14, padding: 4 },
  codeInput: { 
    textAlign: 'center', 
    letterSpacing: 8, 
    fontSize: 22, 
    fontFamily: 'DMSans_700Bold', 
    color: C.gold 
  },
  btn: { backgroundColor: C.gold, borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 20 },
  btnOff: { opacity: 0.6 },
  btnTxt: { fontFamily: 'Cinzel_700SemiBold', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: C.black },
  backTxt: { fontFamily: 'Cinzel_400Regular', fontSize: 14, color: C.muted, letterSpacing: 1, textDecorationLine: 'underline' }
});