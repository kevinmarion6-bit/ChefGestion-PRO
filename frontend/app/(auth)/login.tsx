import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Platform, Image, Keyboard,
  KeyboardEvent, Animated, TouchableWithoutFeedback,
} from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { ApiError, Auth } from '@/lib/api';
import { isConfigured } from '@/lib/config';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const C = {
  black: '#000', blackM: '#111', charcoal: '#1A1A1A',
  gold: '#D4AF37', bronze: '#CD7F32',
  cream: '#F5F5DC', muted: '#6B6050', mutedL: '#8A7A60',
};

// ─── COMPOSANT DE CHAMP SAISIE ───────────────────────────
function Field({
  label, value, onChange, placeholder,
  secure = false, keyboard = 'default', mono = false,
  capitalize = 'none', autoComplete = 'off', textContent,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; secure?: boolean; keyboard?: any;
  mono?: boolean; capitalize?: any; autoComplete?: any; textContent?: any;
}) {
  const [isSecure, setIsSecure] = useState(secure);

  return (
    <View style={s.fieldWrap}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          style={[
            s.input,
            mono && { fontFamily: 'DMSans_400Regular' },
            secure && { paddingRight: 48 },
          ]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          secureTextEntry={isSecure}
          keyboardType={keyboard}
          autoCapitalize={capitalize}
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={textContent}
          importantForAutofill="yes"
        />
        {secure && (
          <TouchableOpacity
            onPress={() => setIsSecure(!isSecure)}
            style={{ position: 'absolute', right: 12, padding: 4 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={isSecure ? 'eye-off' : 'eye'}
              size={22}
              color={C.gold}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── ÉCRAN PRINCIPAL ─────────────────────────────────────
export default function LoginScreen() {
  const { login, signup } = useApp();
  const scrollRef = useRef<ScrollView>(null);

  const [tab, setTab]               = useState<'login' | 'signup'>('login');
  const [loading, setLoading]       = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [lEmail, setLEmail]         = useState('');
  const [lPass, setLPass]           = useState('');
  const [sName, setSName]           = useState('');
  const [sEmail, setSEmail]         = useState('');
  const [sPass, setSPass]           = useState('');
  // ✅ sApi supprimé

  const keyboardPad = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => {
      Animated.timing(keyboardPad, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? e.duration : 180,
        useNativeDriver: false,
      }).start();
    };

    const onHide = (e: KeyboardEvent) => {
      Animated.timing(keyboardPad, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration : 180,
        useNativeDriver: false,
      }).start();
    };

    const s1 = Keyboard.addListener(showEvent, onShow);
    const s2 = Keyboard.addListener(hideEvent, onHide);
    return () => { s1.remove(); s2.remove(); };
  }, []);

  function switchTab(t: 'login' | 'signup') {
    Keyboard.dismiss();
    setTab(t);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  }

  async function handleLogin() {
    Keyboard.dismiss();
    if (!lEmail || !lPass) { Alert.alert('Champs requis', 'Remplissez e-mail et mot de passe.'); return; }
    setLoading(true);
    try {
      await login(lEmail, lPass);
      router.replace('/(tabs)');
    } catch (e: any) {
      const isAuthError = e.status === 403 || e.message?.toLowerCase().includes('confirm');
      const msg = isAuthError
        ? "Confirmez d'abord votre email Chef !"
        : (e instanceof ApiError ? e.message : 'Connexion impossible. Vérifiez que le backend est lancé.');
      Alert.alert('Erreur', msg);
    } finally { setLoading(false); }
  }

  async function handleSignup() {
    Keyboard.dismiss();
    if (!sName || !sEmail || !sPass) {
      Alert.alert('Champs requis', 'Remplissez tous les champs.');
      return;
    }

    setLoading(true);
    try {
      // ✅ Plus de sApi dans l'appel
      const result = await Auth.signup(sName, sEmail, sPass) as any;

      console.log('DEBUG - Résultat Inscription:', JSON.stringify(result, null, 2));

      if (result?.confirmRequired) {
        setIsSubmitted(true);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }

      const token = result?.token || result?.data?.session?.access_token;
      const u     = result?.user  || result?.data?.user;

      if (token && u) {
        await login(sEmail, sPass);
      } else {
        await login(sEmail, sPass);
      }

    } catch (e: any) {
      console.error('Erreur Inscription:', e);
      Alert.alert('Erreur', e instanceof ApiError ? e.message : 'Inscription impossible.');
    } finally {
      setLoading(false);
    }
  }

  // ─── RENDUS CONDITIONNELS ────────────────────────────────
  if (!isConfigured()) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Text style={{ fontSize: 36, marginBottom: 16 }}>⚙️</Text>
        <Text style={s.configTitle}>Configuration requise</Text>
        <Text style={s.configText}>
          Ouvrez{' '}
          <Text style={{ color: C.gold, fontFamily: 'DMSans_400Regular' }}>frontend/lib/config.ts</Text>
          {' '}et remplacez{' '}
          <Text style={{ color: C.gold }}>VOTRE_IP_ICI</Text>
          {' '}par l'IP du backend.
        </Text>
      </View>
    );
  }

  if (isSubmitted) {
    return (
      <View style={[s.root, { justifyContent: 'center', padding: 24 }]}>
        <View style={[s.card, { padding: 30, alignItems: 'center' }]}>
          <MaterialCommunityIcons name="email-check-outline" size={60} color={C.gold} />
          <Text style={[s.configTitle, { marginTop: 20 }]}>VÉRIFIE TES MAILS</Text>
          <Text style={[s.configText, { marginBottom: 24 }]}>
            Chef, un lien de confirmation a été envoyé à :{'\n'}
            <Text style={{ color: C.cream, fontWeight: 'bold' }}>{sEmail}</Text>
          </Text>
          <TouchableOpacity
            style={[s.btn, { width: '100%' }]}
            onPress={() => { setIsSubmitted(false); setTab('login'); }}
          >
            <Text style={s.btnTxt}>RETOUR À LA CONNEXION</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── FORMULAIRE ──────────────────────────────────────────
  return (
    <View style={s.root}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <Animated.ScrollView
          ref={scrollRef as any}
          style={s.root}
          contentContainerStyle={[s.scroll, { paddingBottom: 60 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={s.logoWrap}>
            <Image
              source={require('../../assets/logo.png')}
              style={s.logoImg}
              resizeMode="contain"
            />
            <Text style={s.tagline}>⁘ SUIVI & GESTION CUISINE ⁘</Text>
          </View>

          <View style={s.card}>
            <View style={s.cardTopLine} />
            <View style={s.tabs}>
              {(['login', 'signup'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.tab, tab === t && s.tabActive]}
                  onPress={() => switchTab(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                    {t === 'login' ? 'Connexion' : 'Inscription'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.formPad}>
              {tab === 'login' ? (
                <>
                  <Field
                    label="Adresse e-mail" value={lEmail} onChange={setLEmail}
                    placeholder="exemple-chef@gmail.com" keyboard="email-address"
                    autoComplete="email" textContent="emailAddress"
                  />
                  <Field
                    label="Mot de passe" value={lPass} onChange={setLPass}
                    placeholder="••••••••" secure
                    autoComplete="current-password" textContent="password"
                  />
                  <TouchableOpacity
                    onPress={() => { Keyboard.dismiss(); router.push('/forgot-password'); }}
                    style={s.forgotLink}
                    activeOpacity={0.7}
                  >
                    <Text style={s.forgotLinkTxt}>Mot de passe oublié ?</Text>
                  </TouchableOpacity>
                  <View style={{ height: 12 }} />
                  <TouchableOpacity
                    style={[s.btn, loading && s.btnOff]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Text style={s.btnTxt}>{loading ? 'Connexion...' : 'Se Connecter'}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Field
                    label="Prénom & Nom" value={sName} onChange={setSName}
                    placeholder="Paul Bocuse" capitalize="words"
                    autoComplete="name" textContent="name"
                  />
                  <Field
                    label="Adresse e-mail" value={sEmail} onChange={setSEmail}
                    placeholder="exemple-chef@gmail.com" keyboard="email-address"
                    autoComplete="email" textContent="emailAddress"
                  />
                  <Field
                    label="Mot de passe (8 car. min.)" value={sPass} onChange={setSPass}
                    placeholder="••••••••" secure
                    autoComplete="new-password" textContent="newPassword"
                  />
                  {/* ✅ Bloc clé API Gemini supprimé */}
                  <View style={{ height: 8 }} />
                  <TouchableOpacity
                    style={[s.btn, loading && s.btnOff]}
                    onPress={handleSignup}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Text style={s.btnTxt}>{loading ? 'Création...' : 'Créer mon compte'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
          <Animated.View style={{ height: keyboardPad }} />
        </Animated.ScrollView>
      </TouchableWithoutFeedback>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.black },
  scroll:      { flexGrow: 1, padding: 24, paddingTop: 52, backgroundColor: C.black, justifyContent: 'center' },
  configTitle: { fontFamily: 'Cinzel_700SemiBold', fontSize: 16, color: C.gold, textAlign: 'center', marginBottom: 12 },
  configText:  { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 22 },
  logoWrap:    { alignItems: 'center', marginBottom: 28 },
  logoImg:     { width: 200, height: 200, marginBottom: 12 },
  tagline:     { fontFamily: 'Cinzel_400Regular', fontSize: 16, letterSpacing: 4, color: C.bronze, textTransform: 'uppercase', marginTop: 2 },
  card:        { backgroundColor: C.charcoal, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.22)', overflow: 'hidden' },
  cardTopLine: { height: 1, backgroundColor: C.gold, opacity: 0.5 },
  tabs:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.12)' },
  tab:         { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive:   { borderBottomColor: C.gold },
  tabTxt:      { fontFamily: 'Cinzel_400Regular', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.muted },
  tabTxtActive: { color: C.gold },
  formPad:     { padding: 22 },
  fieldWrap:   { marginBottom: 18 },
  fieldLabel:  { fontFamily: 'Cinzel_400Regular', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.mutedL, marginBottom: 8, fontWeight: '600' },
  input:       { backgroundColor: C.blackM, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', borderRadius: 8, padding: 14, color: C.cream, fontSize: 17, fontWeight: '500' },
  forgotLink:  { alignSelf: 'flex-end', marginTop: -4, paddingVertical: 8 },
  forgotLinkTxt: { fontFamily: 'Cinzel_400Regular', fontSize: 14, letterSpacing: 1.5, color: C.gold, textDecorationLine: 'underline' },
  // ✅ geminiBox, geminiTitle, geminiNote supprimés
  btn:    { backgroundColor: C.gold, borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 4 },
  btnOff: { opacity: 0.6 },
  btnTxt: { fontFamily: 'Cinzel_700SemiBold', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: C.black, fontWeight: '700' },
});
