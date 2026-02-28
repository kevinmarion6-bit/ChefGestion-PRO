import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import { Auth } from '@/lib/api';

const C = {
  black: '#000', blackM: '#111', charcoal: '#1A1A1A',
  gold: '#D4AF37', bronze: '#CD7F32',
  cream: '#F5F5DC', muted: '#6B6050', mutedL: '#8A7A60',
};

// On réutilise ton composant de champ pour la cohérence
function Field({ label, value, onChange, placeholder }: any) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        autoCapitalize="none"
        keyboardType="email-address"
      />
    </View>
  );
}

import { TextInput } from 'react-native';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgot = async () => {
    if (!email) { Alert.alert('Champ requis', 'Saisis ton adresse e-mail.'); return; }
    setLoading(true);
    try {
      await Auth.forgotPassword(email);
      Alert.alert(
        'Vérifie tes mails 📧',
        'Si un compte existe, tu vas recevoir un code à 6 chiffres.',
        [{ text: 'OK', onPress: () => router.push('/reset-password') }]
      );
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <View style={s.logoWrap}>
        <Text style={s.tagline}>🔒 RÉCUPÉRATION</Text>
      </View>

      <View style={s.card}>
        <View style={s.cardTopLine} />
        <View style={s.formPad}>
          <Text style={s.instr}>Saisis l'e-mail associé à ton compte pour recevoir ton code d'accès.</Text>
          
          <Field 
            label="Adresse e-mail" 
            value={email} 
            onChange={setEmail} 
            placeholder="exemple-chef@gmail.com" 
          />

          <TouchableOpacity style={[s.btn, loading && s.btnOff]} onPress={handleForgot} disabled={loading}>
            <Text style={s.btnTxt}>{loading ? 'Envoi...' : 'Envoyer le code'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={s.backTxt}>Retour à la connexion</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.black, justifyContent: 'center', padding: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 28 },
  tagline: { fontFamily: 'Cinzel_400Regular', fontSize: 22, letterSpacing: 4, color: C.gold, textTransform: 'uppercase' },
  card: { backgroundColor: C.charcoal, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.22)', overflow: 'hidden' },
  cardTopLine: { height: 1, backgroundColor: C.gold, opacity: 0.5 },
  formPad: { padding: 22 },
  instr: { color: C.mutedL, fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  fieldWrap: { marginBottom: 18 },
  fieldLabel: { fontFamily: 'Cinzel_400Regular', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: C.mutedL, marginBottom: 8 },
  input: { backgroundColor: C.blackM, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', borderRadius: 8, padding: 14, color: C.cream, fontSize: 17 },
  btn: { backgroundColor: C.gold, borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 10 },
  btnOff: { opacity: 0.6 },
  btnTxt: { fontFamily: 'Cinzel_700SemiBold', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: C.black },
  backTxt: { fontFamily: 'Cinzel_400Regular', fontSize: 12, color: C.muted, letterSpacing: 1, textDecorationLine: 'underline' }
});