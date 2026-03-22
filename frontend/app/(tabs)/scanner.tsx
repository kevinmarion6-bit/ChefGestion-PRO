import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, TextInput, Alert, Modal, ActivityIndicator, useWindowDimensions, KeyboardAvoidingView, Platform, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Scan } from '@/lib/api';
import { useApp } from '@/lib/context';
import { getToken } from '@/lib/auth';
import { useNavigation } from '@react-navigation/native';
import { scheduleDlcNotification, cancelDlcNotifications } from '@/lib/notifications';

const C = {
  blackS: '#0C0C0C', charcoal: '#1A1A1A',
  gold: '#D4AF37', cream: '#F5F5DC', muted: '#6B6050',
  ok: '#4ADE80', warn: '#FACC15', bad: '#F87171'
};

type ScanType = 'factures' | 'carte' | 'temperature' | 'haccp';

const TYPES = [
  { id: 'factures'    as ScanType, icon: '🧾', label: 'Factures',    hint: 'Analysées par l\'IA et enregistrées dans Plus → Fournisseurs' },
  { id: 'carte'       as ScanType, icon: '📋', label: 'Carte',        hint: 'Scannez votre Carte ou Menu' },
  { id: 'temperature' as ScanType, icon: '🌡️', label: 'Température', hint: 'Enregistrée directement dans vos relevés HACCP' },
  { id: 'haccp'       as ScanType, icon: '🏷️', label: 'HACCP',       hint: 'Étiquettes sanitaires avec alertes DLC en temps réel. Photos stockées dans Plus → Traçabilité HACCP' },
];

function getFrameConfig(scanType: ScanType, frameWidth: number) {
  switch (scanType) {
    case 'temperature':
      return { height: 160,        borderColor: '#D4AF37',              label: "CADREZ L'AFFICHEUR DE TEMPÉRATURE" };
    case 'haccp':
      return { height: frameWidth, borderColor: '#D4AF37',              label: "CADREZ L'ÉTIQUETTE"     };
    case 'factures':
      return { height: Math.round(frameWidth * 1.414), borderColor: 'rgba(255,255,255,0.9)', label: 'CADREZ LA FACTURE' };    
    case 'carte':
      return { height: Math.round(frameWidth * 1.414), borderColor: 'rgba(255,255,255,0.9)', label: 'CADREZ LA CARTE' };  }
}

export default function ScannerScreen() {

  const { refreshDashboard } = useApp();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const FRAME_WIDTH = winWidth * 0.85;

  const [fridges, setFridges]                   = useState<any[]>([]);
  const [todayLogs, setTodayLogs]               = useState<any[]>([]);
  const [selectedFridgeId, setSelectedFridgeId] = useState<string | null>(null);
  const [scanType, setScanType]                 = useState<ScanType>('factures');
  const [loading, setLoading]                   = useState(false);
  const [loadingMsg, setLoadingMsg]             = useState('Analyse en cours, Chef...');
  const [imageUri, setImageUri]                 = useState<string | null>(null);
  const [result, setResult]                     = useState<any>(null);
  const [showCamera, setShowCamera]             = useState(false);
  const [permission, requestPermission]         = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [suppliers, setSuppliers]               = useState<Record<string, any>>({});

  const frameConfig  = getFrameConfig(scanType, FRAME_WIDTH);
  const FRAME_HEIGHT = frameConfig.height;


async function refreshTodayLogs() {
  try {
    const token = await getToken();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const logsRes = await fetch(
      `https://chefgestion-pro.onrender.com/api/scan/haccp-logs?year=${year}&month=${month}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const logsJson = await logsRes.json();
    if (logsJson.ok) setTodayLogs(logsJson.data ?? []);
  } catch (e) { console.error('[Logs refresh]', e); }
}

useEffect(() => {
  (async () => {
    const token = await getToken();

    try {
      const res = await fetch('https://chefgestion-pro.onrender.com/api/fridges', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) setFridges(json.data ?? []);
    } catch (e) { console.error('[Frigos]', e); }

    refreshTodayLogs();

    try {
      const supRes = await fetch('https://chefgestion-pro.onrender.com/api/suppliers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const supJson = await supRes.json();
      if (supJson.ok) setSuppliers(supJson.data ?? {});
    } catch {}
  })();
}, []);

const navigation = useNavigation();

useEffect(() => {
  const unsubscribe = navigation.addListener('focus', () => {
    refreshTodayLogs();
  });
  return unsubscribe;
}, [navigation]);

function isFridgeDoneForCurrentService(fridgeId: string): boolean {
  const now = new Date();
  const h = now.getHours();
  const periode = (h >= 2 && h < 16) ? 'MIDI' : 'SOIR';
  const todayStr = now.toISOString().split('T')[0];
  
  return todayLogs.some(
    l => l.fridge_id === fridgeId && l.date === todayStr && l.periode === periode
  );
}

  async function handleMainPress() {
    if (scanType === 'temperature' && fridges.length > 0 && !selectedFridgeId) {
      Alert.alert(
        '🌡️ Sélectionnez votre frigo, Chef !',
        'Choisissez un équipement dans la liste avant de scanner la température.'
      );
      return;
    }
    if (scanType === 'factures') {
      pickImage();
    } else {
      if (!permission?.granted) {
        const { granted } = await requestPermission();
        if (!granted) return Alert.alert('Erreur', 'Accès caméra requis.');
      }
      setShowCamera(true);
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
      const scaleX  = effectivePhotoWidth  / winWidth;
      const scaleY  = effectivePhotoHeight / winHeight;
      const cropW   = FRAME_WIDTH  * scaleX;
      const cropH   = FRAME_HEIGHT * scaleY;
      const originX = offsetX + (effectivePhotoWidth  - cropW) / 2;
      // Ajuster le décalage vertical selon le type de scan
      const yShift = scanType === 'temperature' ? (cropH * 0.05) : (cropH * 0.08);
      const originY = Math.max(0, offsetY + (effectivePhotoHeight - cropH) / 2 - yShift);
      const cropped = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ crop: { originX: Math.round(originX), originY: Math.round(originY), width: Math.round(cropW), height: Math.round(cropH) }}],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      setShowCamera(false);
      processImage(cropped.uri);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Échec de la capture.");
    }
  }

  function pickImage() {
    Alert.alert('Source', 'Importer depuis :', [
      { text: 'Appareil Photo', onPress: async () => {
        if (!permission?.granted) {
          const { granted } = await requestPermission();
          if (!granted) return Alert.alert('Erreur', 'Accès caméra requis.');
        }
        setShowCamera(true);
      }},
      { text: 'Galerie photos', onPress: openGallery },
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
    const msgs: Record<ScanType, string> = {
      temperature: "Un instant Chef, l'IA analyse vos températures !",
      factures:    'Analyse de la facture en cours...',
      carte:       'Lecture de la carte en cours...',
      haccp:       'Enregistrement de la photo HACCP...',
    };
    setLoadingMsg(msgs[scanType]);
    try {
      if (scanType === 'factures') {
        const data = await Scan.invoice(uri);
        setResult({ type: 'factures', ...data });
        await refreshDashboard();
      } else if (scanType === 'temperature') {
        const token = await getToken();
        const fd = new FormData();
        fd.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
        if (selectedFridgeId) fd.append('fridge_id', selectedFridgeId);
        const response = await fetch('https://chefgestion-pro.onrender.com/api/scan/temperature', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const json = await response.json();
        if (!json.ok) throw new Error(json.error ?? 'Lecture impossible');
        setResult({ type: 'temperature', data: json.data });
        await refreshDashboard();
        await refreshTodayLogs();
      } else if (scanType === 'carte') {
        const data = await Scan.carte(uri);
        setResult({ type: 'carte', data });
      } else {
        // HACCP : appel vers haccp-label pour extraction DLC par Gemini
        const token = await getToken();
        const fd = new FormData();
        fd.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
        const response = await fetch('https://chefgestion-pro.onrender.com/api/scan/haccp-label', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const json = await response.json();
        if (!json.ok) throw new Error(json.error ?? 'Lecture étiquette impossible');
        setResult({ type: 'haccp', data: json.data });
        await refreshDashboard();
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Échec de l'analyse.");
    } finally {
      setLoading(false);
    }
  }

  if (showCamera) {
    const cc = frameConfig.borderColor;
    return (
      <View style={StyleSheet.absoluteFillObject}>
        <CameraView style={StyleSheet.absoluteFillObject} ref={cameraRef} facing="back">
          <View style={s.cameraOverlay}>
            <View style={s.unfocused} />
            <View style={{ flexDirection: 'row', height: FRAME_HEIGHT }}>
              <View style={s.unfocused} />
              <View style={[s.focusZone, { width: FRAME_WIDTH }]}>
                <View style={[s.cornerTL, { borderColor: cc }]} />
                <View style={[s.cornerTR, { borderColor: cc }]} />
                <View style={[s.cornerBL, { borderColor: cc }]} />
                <View style={[s.cornerBR, { borderColor: cc }]} />
                <View style={s.focusLabel}>
                  <Text style={[s.focusText, { color: cc }]}>{frameConfig.label}</Text>
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
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Image
      source={require('../../assets/logo.png')}
      style={{ width: 34, height: 34, borderRadius: 8, marginRight: 10 }}
      resizeMode="contain"
    />
    <View>
      <Text style={s.title}>Scanner OCR</Text>
      <Text style={s.sub}>Analyse IA · Gemini Vision</Text>
    </View>
  </View>
      </View>
      <Modal visible={loading} transparent animationType="fade">
        <View style={s.overlay}>
          <ActivityIndicator color={C.gold} size="large" />
          <Text style={s.overlayTxt}>{loadingMsg}</Text>
        </View>
      </Modal>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          <View style={s.typeGrid}>
            {TYPES.map(t => (
              <TouchableOpacity key={t.id} style={[s.typeBtn, scanType === t.id && s.typeBtnA]}
                onPress={() => { setScanType(t.id); setResult(null); setImageUri(null); }}>
                <Text style={{ fontSize: 24 }}>{t.icon}</Text>
                <Text style={[s.typeLabel, scanType === t.id && { color: C.gold }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {scanType === 'temperature' && fridges.length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <Text style={s.fridgePickerLabel}>📍 ÉQUIPEMENT SCANNÉ</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
                {fridges.map((f: any) => {
  const isDone = isFridgeDoneForCurrentService(f.id);
  return (
    <TouchableOpacity key={f.id}
      style={[
        s.fridgeChip,
        selectedFridgeId === f.id && s.fridgeChipActive,
        isDone && { opacity: 0.4, borderColor: '#4ADE80' },
      ]}
      onPress={() => setSelectedFridgeId(selectedFridgeId === f.id ? null : f.id)}>
      <Text style={{ fontSize: 18 }}>{f.emoji || (f.type === 'negatif' ? '🧊' : '❄️')}</Text>
      <Text style={[
        s.fridgeChipLabel,
        selectedFridgeId === f.id && { color: '#000' },
        isDone && { color: '#4ADE80' },
      ]}>
        {f.nom}
      </Text>
      {isDone && (
        <Text style={{ fontSize: 10, color: '#4ADE80', marginTop: 2 }}>✅</Text>
      )}
    </TouchableOpacity>
  );
})}
              </ScrollView>
              {!selectedFridgeId && (
                <Text style={s.fridgeHint}>⚠️ Sélectionnez un équipement avant de scanner</Text>
              )}
            </View>
          )}

          <TouchableOpacity style={s.drop} onPress={handleMainPress}>
            <Text style={{ fontSize: 32 }}>📸</Text>
            <Text style={s.dropTitle}>
              {scanType === 'temperature' ? 'OUVRIR LE SCANNER LED' : 'LANCER LE SCAN'}
            </Text>
            {scanType === 'temperature' && (
              <Text style={s.quotaText}>{result?.data?.count ?? 0} / 33 SCANS AUJOURD'HUI</Text>
            )}
          </TouchableOpacity>

          <View style={{ backgroundColor: 'rgba(212,175,55,0.05)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)', borderRadius: 8, padding: 10, marginBottom: 14 }}>
            <Text style={{ color: C.muted, fontSize: 11, fontStyle: 'italic', textAlign: 'center', lineHeight: 16 }}>
              {TYPES.find(t => t.id === scanType)?.hint}
            </Text>
          </View>

          {imageUri && (
            <View style={s.preview}>
              <Image source={{ uri: imageUri }} style={s.previewImg} resizeMode="contain" />
            </View>
          )}

          {result && <ScanResult result={result} suppliers={suppliers} onSuppliersChanged={setSuppliers} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ScanResult({ result, suppliers, onSuppliersChanged }: { result: any; suppliers?: Record<string, any>; onSuppliersChanged?: (s: Record<string, any>) => void }) {
  const [isEditing, setIsEditing]   = useState(false);
  const [manualTemp, setManualTemp] = useState('');
  const [savedTemp, setSavedTemp]   = useState<number | null>(null);

  // ─── RÉSULTAT FACTURE ──────────────────────────────────
  if (result.type === 'factures') {
    const invoice = result.data?.invoice ?? result.invoice;
    const priceAlerts = result.data?.priceAlerts ?? result.priceAlerts ?? [];
    const products = invoice?.products ?? [];
    const supplierName = invoice?.supplier || 'Inconnu';
    const totalHT = invoice?.total_ht ?? 0;
    const totalTTC = invoice?.total_ttc ?? 0;
    const existingSuppliers = Object.keys(suppliers || {});

    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [newSupplierName, setNewSupplierName] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<string | null>(
      existingSuppliers.includes(supplierName) ? supplierName : null
    );

    async function assignSupplier(name: string) {
      try {
        const token = await getToken();
        // Créer ou récupérer le fournisseur
        await fetch('https://chefgestion-pro.onrender.com/api/suppliers', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        // Mettre à jour la facture avec le bon fournisseur
        if (invoice?.id) {
          await fetch(`https://chefgestion-pro.onrender.com/api/invoices/${invoice.id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ supplier: name }),
          });
        }
        setSelectedSupplier(name);
        setShowSupplierModal(false);
        Alert.alert('✅ Fournisseur attribué', `Facture assignée à "${name}".`);
        // Recharger les fournisseurs
        const supRes = await fetch('https://chefgestion-pro.onrender.com/api/suppliers', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const supJson = await supRes.json();
        if (supJson.ok && onSuppliersChanged) onSuppliersChanged(supJson.data ?? {});
      } catch {
        Alert.alert('Erreur', 'Impossible d\'attribuer le fournisseur.');
      }
    }

    return (
      <View style={sr.card}>
        <Text style={{ color: '#4ADE80', fontSize: 32, textAlign: 'center' }}>✅</Text>
        <Text style={sr.title}>FACTURE ANALYSÉE</Text>

        {/* Fournisseur détecté */}
        <View style={{ backgroundColor: 'rgba(212,175,55,0.08)', borderRadius: 10, padding: 14, width: '100%', marginTop: 8 }}>
          <Text style={{ color: '#8A7A60', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Fournisseur</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#F5F5DC', fontSize: 16, fontWeight: 'bold', flex: 1 }}>
              🏭 {selectedSupplier || supplierName}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
              onPress={() => setShowSupplierModal(true)}
            >
              <Text style={{ color: '#D4AF37', fontSize: 10, fontWeight: 'bold' }}>✏️ Modifier</Text>
            </TouchableOpacity>
          </View>
          {!existingSuppliers.includes(supplierName) && !selectedSupplier && (
            <Text style={{ color: '#FACC15', fontSize: 10, marginTop: 6, fontStyle: 'italic' }}>
              ⚠️ Fournisseur non reconnu — attribuez-le ci-dessus
            </Text>
          )}
        </View>

        {/* Totaux */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, width: '100%' }}>
          <View style={{ flex: 1, backgroundColor: '#111', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' }}>
            <Text style={{ color: '#8A7A60', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase' }}>Total HT</Text>
            <Text style={{ color: '#D4AF37', fontSize: 20, fontWeight: 'bold', marginTop: 4 }}>{totalHT.toFixed(2)}€</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#111', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' }}>
            <Text style={{ color: '#8A7A60', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase' }}>Total TTC</Text>
            <Text style={{ color: '#F5F5DC', fontSize: 20, fontWeight: 'bold', marginTop: 4 }}>{totalTTC.toFixed(2)}€</Text>
          </View>
        </View>

        {/* Produits */}
        {products.length > 0 && (
          <View style={{ marginTop: 12, width: '100%' }}>
            <Text style={{ color: '#8A7A60', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
              {products.length} produit{products.length > 1 ? 's' : ''} détecté{products.length > 1 ? 's' : ''}
            </Text>
            {products.slice(0, 8).map((p: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ color: '#F5F5DC', fontSize: 12 }} numberOfLines={1}>{p.nom || '—'}</Text>
                  <Text style={{ color: '#6B6050', fontSize: 10 }}>{p.quantite || 0} {p.unite || 'u'} × {(p.prix_ht || 0).toFixed(2)}€</Text>
                </View>
                <Text style={{ color: '#D4AF37', fontSize: 12, fontWeight: 'bold' }}>{(p.total_ht || 0).toFixed(2)}€</Text>
              </View>
            ))}
            {products.length > 8 && (
              <Text style={{ color: '#6B6050', fontSize: 10, fontStyle: 'italic', textAlign: 'center', marginTop: 6 }}>
                + {products.length - 8} autre{products.length - 8 > 1 ? 's' : ''} produit{products.length - 8 > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        )}

        {/* Alertes de prix */}
        {priceAlerts.length > 0 && (
          <View style={{ marginTop: 12, width: '100%', backgroundColor: 'rgba(248,113,113,0.08)', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)' }}>
            <Text style={{ color: '#F87171', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6, fontWeight: 'bold' }}>
              ⚠️ {priceAlerts.length} alerte{priceAlerts.length > 1 ? 's' : ''} de prix
            </Text>
            {priceAlerts.map((a: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ color: '#F5F5DC', fontSize: 11, flex: 1 }} numberOfLines={1}>{a.product}</Text>
                <Text style={{ color: '#6B6050', fontSize: 11, textDecorationLine: 'line-through', marginRight: 6 }}>{a.oldPrice?.toFixed(2)}€</Text>
                <Text style={{ color: '#F87171', fontSize: 11, fontWeight: 'bold' }}>{a.newPrice?.toFixed(2)}€</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={{ color: '#6B6050', fontSize: 10, textAlign: 'center', marginTop: 12, fontStyle: 'italic' }}>
          📊 Facture enregistrée · Ratios mis à jour
        </Text>

        {/* ─── MODALE CHOIX FOURNISSEUR ───── */}
        <Modal visible={showSupplierModal} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#111', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' }}>
              <Text style={{ color: '#D4AF37', fontSize: 14, fontFamily: 'Cinzel_700Bold', letterSpacing: 1, textAlign: 'center', marginBottom: 4 }}>
                ATTRIBUER UN FOURNISSEUR
              </Text>
              <Text style={{ color: '#6B6050', fontSize: 11, textAlign: 'center', marginBottom: 16 }}>
                Choisissez un fournisseur existant ou créez-en un nouveau
              </Text>

              {/* Fournisseur détecté par l'IA */}
              {supplierName && supplierName !== 'Inconnu' && (
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)', borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  onPress={() => assignSupplier(supplierName)}
                >
                  <Text style={{ fontSize: 16 }}>🤖</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#4ADE80', fontSize: 12, fontWeight: 'bold' }}>{supplierName}</Text>
                    <Text style={{ color: '#6B6050', fontSize: 10 }}>Détecté par l'IA</Text>
                  </View>
                  <Text style={{ color: '#4ADE80', fontSize: 11 }}>Utiliser →</Text>
                </TouchableOpacity>
              )}

              {/* Fournisseurs existants */}
              {existingSuppliers.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ color: '#8A7A60', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Fournisseurs existants</Text>
                  <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
                    {existingSuppliers.map(name => (
                      <TouchableOpacity
                        key={name}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }}
                        onPress={() => assignSupplier(name)}
                      >
                        <Text style={{ fontSize: 14 }}>🏭</Text>
                        <Text style={{ color: '#F5F5DC', fontSize: 13, flex: 1 }}>{name}</Text>
                        <Text style={{ color: '#D4AF37', fontSize: 11 }}>Choisir →</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Créer nouveau */}
              <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)', paddingTop: 12, marginTop: 4 }}>
                <Text style={{ color: '#8A7A60', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Ou créer un nouveau</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', borderRadius: 8, color: '#fff', fontSize: 14, padding: 10 }}
                    value={newSupplierName}
                    onChangeText={setNewSupplierName}
                    placeholder="Nom du fournisseur..."
                    placeholderTextColor="#444"
                  />
                  <TouchableOpacity
                    style={{ backgroundColor: '#D4AF37', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' }}
                    onPress={() => {
                      if (!newSupplierName.trim()) { Alert.alert('Erreur', 'Saisissez un nom.'); return; }
                      assignSupplier(newSupplierName.trim());
                      setNewSupplierName('');
                    }}
                  >
                    <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 12 }}>Créer</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Annuler */}
              <TouchableOpacity
                style={{ marginTop: 16, alignItems: 'center', paddingVertical: 10 }}
                onPress={() => setShowSupplierModal(false)}
              >
                <Text style={{ color: '#666', fontSize: 12 }}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  if (result.type === 'temperature') {
    const rawTemp     = result.data?.temperature ?? 0;
    const displayTemp = savedTemp !== null ? savedTemp : rawTemp;
    const score       = result.data?.confiance ?? 0;
    const tempColor = (() => {
      if (result.data?.fridge_temp_min !== undefined && result.data?.fridge_temp_max !== undefined) {
        const min = result.data.fridge_temp_min;
        const max = result.data.fridge_temp_max;
        if (displayTemp >= min && displayTemp <= max) return '#4ADE80';
        if (displayTemp >= min - 1 && displayTemp <= max + 1) return '#FACC15';
        return '#F87171';
      }
      // Fallback sans plage
      if (displayTemp >= 0 && displayTemp <= 4) return '#4ADE80';
      if (displayTemp >= -1 && displayTemp <= 5) return '#FACC15';
      return '#F87171';
    })();
    const scoreColor  = score >= 75 ? '#4ADE80' : score >= 65 ? '#FACC15' : '#F87171';
    const scoreLabel  = score >= 75 ? 'FIABLE' : score >= 65 ? 'À VÉRIFIER' : 'INCERTAIN';

    async function handleSaveManual() {
      const val = parseFloat(manualTemp.replace(',', '.'));
      if (isNaN(val) || val < -40 || val > 70) {
        Alert.alert('Valeur invalide', 'Entre une température entre -40°C et 70°C');
        return;
      }
      setSavedTemp(val);
      setIsEditing(false);
      Alert.alert('✅ Corrigé', `Température corrigée à ${val}°C`);
    }

    return (
      <View style={sr.card}>
        <Text style={sr.title}>TEMPÉRATURE RELEVÉE</Text>
        <Text style={[sr.tempBig, { color: tempColor }]}>{displayTemp}°C</Text>
        {savedTemp !== null && (
          <Text style={{ color: '#6B6050', fontSize: 9, textAlign: 'center', marginTop: -8 }}>✏️ VALEUR CORRIGÉE MANUELLEMENT</Text>
        )}
        <View style={{ alignItems: 'center', marginTop: 15 }}>
          <Text style={{ color: '#6B6050', fontSize: 10, fontFamily: 'Cinzel_700Bold', marginBottom: 4 }}>INDICE DE CONFIANCE</Text>
          <Text style={{ color: scoreColor, fontSize: 24, fontWeight: 'bold' }}>{score}%</Text>
          <Text style={{ color: scoreColor, fontSize: 10, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>{scoreLabel}</Text>
        </View>
        <Text style={{ color: '#444', fontSize: 10, marginTop: 15, textAlign: 'center' }}>
          Lecteur : {result.data?.type_afficheur ?? 'Inconnu'}
        </Text>
        <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.2)', paddingTop: 16 }}>
          {!isEditing ? (
            <TouchableOpacity style={sr.editBtn} onPress={() => { setManualTemp(String(displayTemp)); setIsEditing(true); }}>
              <Text style={{ fontSize: 16 }}>✏️</Text>
              <Text style={sr.editBtnTxt}>CORRIGER LA VALEUR</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ color: '#9A8060', fontSize: 11, textAlign: 'center', letterSpacing: 1 }}>SAISIR LA TEMPÉRATURE CORRECTE</Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <TextInput
                  style={sr.manualInput}
                  value={manualTemp}
                  onChangeText={setManualTemp}
                  keyboardType="numbers-and-punctuation"
                  placeholder="-18"
                  placeholderTextColor="#444"
                  autoFocus
                />
                <Text style={{ color: '#D4AF37', fontSize: 24, fontWeight: 'bold' }}>°C</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 12, alignItems: 'center' }} onPress={() => setIsEditing(false)}>
                  <Text style={{ color: '#666', fontSize: 12 }}>ANNULER</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 2, backgroundColor: '#D4AF37', borderRadius: 8, paddingVertical: 12, alignItems: 'center' }} onPress={handleSaveManual}>
                  <Text style={{ color: '#000', fontSize: 12, fontWeight: 'bold' }}>✅ VALIDER</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (result.type === 'haccp') {
    const label = result.data?.label;
    const saved = result.data?.saved;
    const photoId = result.data?.photo_id;
    const [dlcActive, setDlcActive] = useState(false);

    async function toggleDlc(newActive: boolean) {
      if (!photoId) return;
      setDlcActive(newActive);
      // Planifier ou annuler les notifications
      if (newActive && label?.dlc) {
        scheduleDlcNotification(photoId, label?.nom || 'Produit', label.dlc);
      } else if (photoId) {
        cancelDlcNotifications(photoId);
      }
      try {
        const token = await getToken();
        fetch(`https://chefgestion-pro.onrender.com/api/haccp/photos/${photoId}/toggle-dlc`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: newActive }),
        }).catch(() => {
          setDlcActive(!newActive);
          Alert.alert('Erreur', 'Impossible de modifier l\'alerte.');
        });
      } catch {}
    }

    return (
      <View style={sr.card}>
        <Text style={{ color: '#4ADE80', fontSize: 32, textAlign: 'center' }}>✅</Text>
        <Text style={sr.title}>ÉTIQUETTE ANALYSÉE</Text>
        {label?.nom ? (
          <Text style={{ color: '#F5F5DC', fontSize: 14, textAlign: 'center', marginTop: 4 }}>
            {label.nom}
          </Text>
        ) : null}
        {label?.dlc ? (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Text style={{ color: '#9A8060', fontSize: 11 }}>DLC :</Text>
            <Text style={{ color: '#D4AF37', fontSize: 16, fontWeight: 'bold' }}>{label.dlc}</Text>
          </View>
        ) : null}
        {label?.lot ? (
          <Text style={{ color: '#6B6050', fontSize: 11, textAlign: 'center', marginTop: 6 }}>
            Lot : {label.lot}
          </Text>
        ) : null}
        <Text style={{ color: '#9A8060', fontSize: 11, textAlign: 'center', marginTop: 10, fontStyle: 'italic' }}>
          {saved ? '📅 DLC détectée · Photo sauvegardée' : 'Photo sauvegardée (DLC non détectée)'}
        </Text>

        {/* ─── TOGGLE ALERTE DLC ───── */}
        {label?.dlc && photoId ? (
          <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.2)', paddingTop: 14 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              onPress={() => toggleDlc(!dlcActive)}
              activeOpacity={0.7}
            >
              <View style={{
                width: 40, height: 22, borderRadius: 11, justifyContent: 'center',
                backgroundColor: dlcActive ? '#4ADE80' : '#333',
                paddingHorizontal: 3,
              }}>
                <View style={{
                  width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFF',
                  alignSelf: dlcActive ? 'flex-end' : 'flex-start',
                }} />
              </View>
              <Text style={{ color: dlcActive ? '#4ADE80' : '#6B6050', fontSize: 12, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 }}>
                {dlcActive ? 'ALERTE DLC ACTIVÉE' : 'ACTIVER L\'ALERTE DLC'}
              </Text>
            </TouchableOpacity>
            <Text style={{ color: '#6B6050', fontSize: 10, textAlign: 'center', marginTop: 6, fontStyle: 'italic' }}>
              Notification à J-3 · Alerte sur le tableau de bord
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  return null;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#1A1A1A', borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)' },
  title: { fontSize: 20, color: '#F5F5DC', fontFamily: 'Cinzel_700Bold' },
  sub: { fontSize: 12, color: '#6B6050', fontFamily: 'DMSans_400Regular' },
  content: { padding: 16, paddingBottom: 40 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  typeBtn: { width: '47%', backgroundColor: '#0C0C0C', padding: 18, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1A1A1A' },
  typeBtnA: { borderColor: '#D4AF37', backgroundColor: '#141414' },
  typeLabel: { fontSize: 10, color: '#6B6050', marginTop: 8, fontFamily: 'Cinzel_700Bold' },
  fridgePickerLabel: { color: '#9A8060', fontSize: 10, fontFamily: 'Cinzel_700Bold', letterSpacing: 1, marginBottom: 8, textAlign: 'center' },
  fridgeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', alignItems: 'center', minWidth: 90 },
  fridgeChipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  fridgeChipLabel: { color: '#D4AF37', fontSize: 10, fontWeight: 'bold', marginTop: 4, textAlign: 'center' },
  fridgeHint: { color: '#F87171', fontSize: 10, textAlign: 'center', marginTop: 6 },
  drop: { borderStyle: 'dashed', borderWidth: 2, borderColor: '#D4AF37', borderRadius: 15, padding: 45, alignItems: 'center', marginBottom: 20 },
  dropTitle: { color: '#D4AF37', marginTop: 12, fontSize: 12, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  overlayTxt: { color: '#D4AF37', marginTop: 20, fontSize: 16, fontFamily: 'Cinzel_400Regular', textAlign: 'center', paddingHorizontal: 40 },
  preview: { height: 120, borderRadius: 12, overflow: 'hidden', marginBottom: 20, borderWidth: 2, borderColor: '#D4AF37' },
  previewImg: { width: '100%', height: '100%', backgroundColor: '#000' },
  cameraOverlay: { flex: 1 },
  unfocused: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' },
  focusZone: { position: 'relative' },
  focusLabel: { position: 'absolute', bottom: -35, width: '100%', alignItems: 'center' },
  focusText: { fontSize: 11, fontFamily: 'Cinzel_700Bold' },
  bottomBar: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  snapBtn: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#FFF' },
  snapInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#D4AF37' },
  backBtn: { marginTop: 30, padding: 10 },
  backBtnTxt: { color: '#FFF', fontFamily: 'Cinzel_400Regular', fontSize: 14 },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 4, borderRightWidth: 4 },
  quotaText: { color: '#D4AF37', fontSize: 10, fontFamily: 'DMSans_400Regular', opacity: 0.5, marginTop: 8, letterSpacing: 1 },
});

const sr = StyleSheet.create({
  card: { backgroundColor: '#0C0C0C', padding: 25, borderRadius: 15, marginTop: 10, alignItems: 'center', borderWidth: 1, borderColor: '#1A1A1A' },
  title: { color: '#D4AF37', fontSize: 11, marginBottom: 15, fontFamily: 'Cinzel_700Bold', letterSpacing: 2 },
  tempBig: { fontSize: 72, fontFamily: 'DMSans_700Bold' },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20, gap: 8 },
  editBtnTxt: { color: '#D4AF37', fontSize: 12, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 },
  manualInput: { flex: 1, backgroundColor: '#111', borderWidth: 1, borderColor: '#D4AF37', borderRadius: 8, color: '#fff', fontSize: 24, textAlign: 'center', paddingVertical: 10, fontWeight: 'bold' },
});
