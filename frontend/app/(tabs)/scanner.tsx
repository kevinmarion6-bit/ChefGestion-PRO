import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Alert, Modal, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Scan } from '@/lib/api';
import { useApp } from '@/lib/context';

const C = { 
  blackS: '#0C0C0C', charcoal: '#1A1A1A', 
  gold: '#D4AF37', cream: '#F5F5DC', muted: '#6B6050', 
  ok: '#4ADE80', warn: '#FACC15', bad: '#F87171' 
};

type ScanType = 'factures' | 'carte' | 'temperature' | 'haccp';

const TYPES: { id: ScanType, icon: string, label: string }[] = [
  { id: 'factures',    icon: '🧾', label: 'Factures' },
  { id: 'carte',       icon: '📋', label: 'Carte' },
  { id: 'temperature', icon: '🌡️', label: 'Température' },
  { id: 'haccp',       icon: '🏷️', label: 'HACCP' },
];

const FRAME_HEIGHT = 160;

export default function ScannerScreen() {
  const { refreshDashboard } = useApp();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const FRAME_WIDTH = winWidth * 0.85;

  const [scanType, setScanType]     = useState<ScanType>('factures');
  const [loading, setLoading]       = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Analyse en cours, Chef...');
  const [imageUri, setImageUri]     = useState<string | null>(null);
  const [result, setResult]         = useState<any>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  async function handleMainPress() {
    if (scanType === 'temperature') {
      if (!permission?.granted) {
        const { granted } = await requestPermission();
        if (!granted) return Alert.alert("Erreur", "Caméra requise");
      }
      setShowCamera(true);
    } else {
      pickImage();
    }
  }

  async function takeAndCropPicture() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
      if (!photo) return;

      const photoRatio  = photo.width / photo.height;
      const screenRatio = winWidth / winHeight;

      let effectivePhotoWidth  = photo.width;
      let effectivePhotoHeight = photo.height;
      let offsetX = 0;
      let offsetY = 0;

      if (photoRatio > screenRatio) {
        effectivePhotoWidth = photo.height * screenRatio;
        offsetX = (photo.width - effectivePhotoWidth) / 2;
      } else {
        effectivePhotoHeight = photo.width / screenRatio;
        offsetY = (photo.height - effectivePhotoHeight) / 2;
      }

      const scaleX = effectivePhotoWidth  / winWidth;
      const scaleY = effectivePhotoHeight / winHeight;

      const cropWidth  = FRAME_WIDTH  * scaleX;
      const cropHeight = FRAME_HEIGHT * scaleY;
      const originX    = offsetX + (effectivePhotoWidth  - cropWidth)  / 2;
      const originY    = offsetY + (effectivePhotoHeight - cropHeight) / 2 - (cropHeight * 0.15);

      const cropped = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{
          crop: {
            originX: Math.round(originX),
            originY: Math.round(originY),
            width:   Math.round(cropWidth),
            height:  Math.round(cropHeight),
          }
        }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      setShowCamera(false);
      processImage(cropped.uri);
    } catch {
      Alert.alert("Erreur", "Problème lors du découpage.");
    }
  }

  async function pickImage() {
    Alert.alert('Source', 'Importer depuis :', [
      { text: 'Appareil Photo', onPress: () => setShowCamera(true) },
      { text: 'Galerie photos',  onPress: openGallery },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }

  async function openGallery() {
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
    if (!r.canceled) processImage(r.assets[0].uri);
  }

  async function processImage(uri: string) {
    setImageUri(uri);
    setResult(null);
    setLoading(true);

    if (scanType === 'temperature') {
      setLoadingMsg("Un instant Chef, l'IA analyse vos températures !");
    } else if (scanType === 'factures') {
      setLoadingMsg('Analyse de la facture en cours...');
    } else if (scanType === 'carte') {
      setLoadingMsg('Lecture de la carte en cours...');
    } else {
      setLoadingMsg('Enregistrement de la photo HACCP...');
    }

    try {
      if (scanType === 'factures') {
        const data = await Scan.invoice(uri);
        setResult({ type: 'factures', ...data });
        await refreshDashboard();
      } else if (scanType === 'temperature') {
        const data = await Scan.temperature(uri);
        setResult({ type: 'temperature', data });
      } else if (scanType === 'carte') {
        const data = await Scan.carte(uri);
        setResult({ type: 'carte', data });
      } else {
        const { Haccp } = await import('@/lib/api');
        await Haccp.uploadPhoto(uri);
        setResult({ type: 'haccp' });
      }
    } catch {
      Alert.alert('Erreur', "Échec de l'analyse.");
    } finally {
      setLoading(false);
    }
  }

  if (showCamera) {
    return (
      <View style={StyleSheet.absoluteFillObject}>
        <CameraView style={StyleSheet.absoluteFillObject} ref={cameraRef} facing="back">
          <View style={s.cameraOverlay}>
            <View style={s.unfocused} />

            <View style={{ flexDirection: 'row', height: FRAME_HEIGHT }}>
              <View style={s.unfocused} />
              <View style={[s.focusZone, { width: FRAME_WIDTH }]}>
                <View style={s.cornerTL} />
                <View style={s.cornerTR} />
                <View style={s.cornerBL} />
                <View style={s.cornerBR} />
                <View style={s.focusLabel}>
                  <Text style={s.focusText}>CADREZ L'AFFICHEUR LED</Text>
                </View>
              </View>
              <View style={s.unfocused} />
            </View>

            <View style={s.bottomBar}>
              <TouchableOpacity style={s.snapBtn} onPress={takeAndCropPicture}>
                <View style={s.snapInner} />
              </TouchableOpacity>
              <TouchableOpacity style={s.backBtn} onPress={() => setShowCamera(false)}>
                <Text style={s.backBtnTxt}>ANNULER</Text>
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>

        {loading && (
          <View style={s.overlay}>
            <ActivityIndicator color={C.gold} size="large" />
            <Text style={s.overlayTxt}>{loadingMsg}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Scanner OCR</Text>
        <Text style={s.sub}>Analyse IA · Gemini Vision</Text>
      </View>

      <Modal visible={loading} transparent animationType="fade">
        <View style={s.overlay}>
          <ActivityIndicator color={C.gold} size="large" />
          <Text style={s.overlayTxt}>{loadingMsg}</Text>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.typeGrid}>
          {TYPES.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[s.typeBtn, scanType === t.id && s.typeBtnA]}
              onPress={() => setScanType(t.id)}
            >
              <Text style={{ fontSize: 24 }}>{t.icon}</Text>
              <Text style={[s.typeLabel, scanType === t.id && { color: C.gold }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

       <TouchableOpacity style={s.drop} onPress={handleMainPress}>
  <Text style={{ fontSize: 32 }}>📸</Text>
  <Text style={s.dropTitle}>
    {scanType === 'temperature' ? 'OUVRIR LE SCANNER LED' : 'LANCER LE SCAN'}
  </Text>
  
  {/* AJOUT DU DÉCOMPTE DISCRET ICI */}
  {scanType === 'temperature' && (
    <Text style={s.quotaText}>
      {result?.data?.count ?? 0} / 33 SCANS AUJOURD'HUI
    </Text>
  )}
</TouchableOpacity>

        {imageUri && (
          <View style={s.preview}>
            <Image source={{ uri: imageUri }} style={s.previewImg} resizeMode="contain" />
          </View>
        )}

        {result && <ScanResult result={result} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function ScanResult({ result }: { result: any }) {
  if (result.type === 'temperature') {
    const t = result.data?.temperature ?? 0;
    const score = result.data?.confiance ?? 0;

    // 1. Couleur de la température (HACCP)
    const tempColor = t <= 4 ? '#4ADE80' : t <= 6 ? '#FACC15' : '#F87171';

    // 2. Couleur de la confiance (Ta nouvelle logique)
    // Vert >= 75%, Orange >= 65%, Rouge < 65%
    const scoreColor = score >= 75 ? '#4ADE80' : score >= 65 ? '#FACC15' : '#F87171';
    
    // Libellé d'état pour le Chef
    const scoreLabel = score >= 75 ? 'FIABLE' : score >= 65 ? 'À VÉRIFIER' : 'INCERTAIN';

    return (
      <View style={sr.card}>
        <Text style={sr.title}>TEMPÉRATURE RELEVÉE</Text>
        
        <Text style={[sr.tempBig, { color: tempColor }]}>{t}°C</Text>
        
        <View style={{ alignItems: 'center', marginTop: 15 }}>
          <Text style={{ color: '#6B6050', fontSize: 10, fontFamily: 'Cinzel_700Bold', marginBottom: 4 }}>
            INDICE DE CONFIANCE
          </Text>
          
          <Text style={{ color: scoreColor, fontSize: 24, fontWeight: 'bold' }}>
            {score}%
          </Text>
          
          <Text style={{ color: scoreColor, fontSize: 10, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>
            {scoreLabel}
          </Text>
        </View>

        <Text style={{ color: '#444', fontSize: 10, marginTop: 15 }}>
          Lecteur : {result.data?.type_afficheur ?? 'Standard'}
        </Text>

        {result.data?.erreur && (
          <Text style={{ color: '#F87171', fontSize: 11, marginTop: 5 }}>{result.data.erreur}</Text>
        )}
      </View>
    );
  }
  
  return (
    <View style={sr.card}>
      <Text style={sr.title}>ANALYSE TERMINÉE ✅</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#000' },
  header:    { padding: 20, backgroundColor: '#0C0C0C', borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  title:     { fontSize: 20, color: '#F5F5DC', fontFamily: 'Cinzel_700Bold' },
  sub:       { fontSize: 12, color: '#6B6050', fontFamily: 'DMSans_400Regular' },
  content:   { padding: 16 },

  typeGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  typeBtn:   { width: '47%', backgroundColor: '#0C0C0C', padding: 18, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1A1A1A' },
  typeBtnA:  { borderColor: '#D4AF37', backgroundColor: '#141414' },
  typeLabel: { fontSize: 10, color: '#6B6050', marginTop: 8, fontFamily: 'Cinzel_700Bold' },

  drop:      { borderStyle: 'dashed', borderWidth: 2, borderColor: '#D4AF37', borderRadius: 15, padding: 45, alignItems: 'center', marginBottom: 20 },
  dropTitle: { color: '#D4AF37', marginTop: 12, fontSize: 12, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 },

  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  overlayTxt: { color: '#D4AF37', marginTop: 20, fontSize: 16, fontFamily: 'Cinzel_400Regular', textAlign: 'center', paddingHorizontal: 40 },

  preview:    { height: 120, borderRadius: 12, overflow: 'hidden', marginBottom: 20, borderWidth: 2, borderColor: '#D4AF37' },
  previewImg: { width: '100%', height: '100%', backgroundColor: '#000' },

  cameraOverlay: { flex: 1 },
  unfocused:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' },
  focusZone:     { height: FRAME_HEIGHT, position: 'relative' },
  focusLabel:    { position: 'absolute', bottom: -35, width: '100%', alignItems: 'center' },
  focusText:     { color: '#D4AF37', fontSize: 11, fontFamily: 'Cinzel_700Bold' },

  bottomBar:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  snapBtn:    { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#FFF' },
  snapInner:  { width: 64, height: 64, borderRadius: 32, backgroundColor: '#D4AF37' },
  backBtn:    { marginTop: 30, padding: 10 },
  backBtnTxt: { color: '#FFF', fontFamily: 'Cinzel_400Regular', fontSize: 14 },

  cornerTL: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#D4AF37' },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#D4AF37' },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#D4AF37' },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#D4AF37' },
  quotaText: { 
    color: '#D4AF37', 
    fontSize: 10, 
    fontFamily: 'DMSans_400Regular', 
    opacity: 0.5, 
    marginTop: 8, 
    letterSpacing: 1 
  },
}); // Fin de StyleSheet s

const sr = StyleSheet.create({
  card:    { backgroundColor: '#0C0C0C', padding: 25, borderRadius: 15, marginTop: 10, alignItems: 'center', borderWidth: 1, borderColor: '#1A1A1A' },
  title:   { color: '#D4AF37', fontSize: 11, marginBottom: 15, fontFamily: 'Cinzel_700Bold', letterSpacing: 2 },
  tempBig: { fontSize: 72, fontFamily: 'DMSans_700Bold' },
});