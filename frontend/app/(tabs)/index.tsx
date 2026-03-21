import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, RefreshControl, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/lib/context';
import { Restaurant } from '@/lib/api';
import { router } from 'expo-router';
import { Archives } from '@/lib/api';
import { loadPushPreference, savePushPreference } from '@/lib/notifications';
import { Modal } from 'react-native';
import { getToken } from '@/lib/auth';
import { useNavigation } from '@react-navigation/native';

const C = { black: '#000', blackS: '#0C0C0C', charcoal: '#1A1A1A', gold: '#D4AF37', goldL: '#EAD06A', goldD: '#A07D1C', bronze: '#CD7F32', cream: '#F5F5DC', creamD: '#EDE8D0', muted: '#6B6050', mutedL: '#8A7A60', ok: '#4ADE80', warn: '#FACC15', bad: '#F87171', blue: '#60A5FA' };

export default function DashboardScreen() {
  const { user, dashboard, refreshDashboard } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [archiveAlert, setArchiveAlert] = useState<any>(null);
  const [dlcPhoto, setDlcPhoto] = useState<any>(null);

  const onRefresh = async () => { setRefreshing(true); await refreshDashboard(); setRefreshing(false); };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() ?? 'C';
  const kpis = dashboard?.kpis;

  useEffect(() => {
  // Charger le nom du restaurant
  Restaurant.get().then(r => { if (r?.nom) setRestaurantName(r.nom); }).catch(() => {});
  
  // ⭐ NOUVEAU : Charger l'état sauvegardé du toggle notification
  loadPushPreference().then(enabled => setPushEnabled(enabled));
 
  // ⭐ NOUVEAU : Vérifier si le mois précédent a des relevés incomplets
  Archives.checkPrevious().then(data => {
    if (data && !data.has_archive && data.fridge_count > 0) {
      setArchiveAlert(data);
    }
  }).catch(() => {});
}, []);

const navigation = useNavigation();
  
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshDashboard();
    });
    return unsubscribe;
  }, [navigation]);

  // Données nouvelles depuis le dashboard enrichi
  const tempAlerts = (dashboard as any)?.tempAlerts ?? [];
  const dlcAlerts = (dashboard as any)?.dlcAlerts ?? [];
  const tempCheckStatus = (dashboard as any)?.tempCheckStatus ?? null;

  return (
    <SafeAreaView style={s.safe}>
      {/* ─── EN-TÊTE AVEC LOGO (Modification 5) ──────────── */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Image
            source={require('../../assets/logo.png')}
            style={s.logo}
            resizeMode="contain"
          />
          <View style={{ marginLeft: 10 }}>
            <Text style={s.title}>Tableau de Bord</Text>
            {restaurantName ? (
              <Text style={{ fontSize: 11, color: '#D4AF37', fontFamily: 'DMSans_400Regular', marginTop: 1 }}>🍽️ {restaurantName}</Text>
            ) : null}
            <Text style={s.sub}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</Text>
          </View>
        </View>
        <View style={s.avatar}><Text style={s.avatarTxt}>{initials}</Text></View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />} contentContainerStyle={s.content}>

        {/* ─── KPI ROW 1 ─────────────────────────────────── */}
        <View style={s.kpiRow}>
          <KPI icon="💶" label="Coût matière HT" value={kpis ? `${kpis.totalCoutHT.toFixed(0)}€` : '—'} hint="factures scannées" />
          <View style={{ width: 10 }} />
          <KPI icon="📈" label="Marge brute" value={kpis?.margeEstimee ? `${kpis.margeEstimee.toFixed(0)}%` : '—'} hint="objectif ≥ 65%" />
        </View>
        <View style={[s.kpiRow, { marginTop: 10 }]}>
          <KPI icon="🧾" label="Factures" value={String(kpis?.facturesCount ?? 0)} hint="scannées" />
          <View style={{ width: 10 }} />
          <KPI icon="⚠️" label="Alertes prix" value={String(kpis?.alertsCount ?? 0)} hint="détectées" />
        </View>

        {/* ─── MODULE ALERTES TEMPÉRATURE (Modification 2) ── */}
        <View style={[s.kpiRow, { marginTop: 10 }]}>
          <View style={s.alertModule}>
            <View style={s.alertModuleLine} />
            <Text style={{ fontSize: 20, marginBottom: 6 }}>🌡️</Text>
            <Text style={s.alertModuleLabel}>Alertes Température</Text>
            {tempAlerts.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 4 }}>
                <Text style={{ fontSize: 16, marginBottom: 2 }}>✅</Text>
                <Text style={s.alertOkText}>Tout est bien frais Chef !</Text>
              </View>
            ) : (
              tempAlerts.slice(0, 3).map((a: any, i: number) => (
                <TouchableOpacity
                  key={i}
                  style={s.alertTempRow}
                  activeOpacity={0.6}
                  onPress={() => {
                    router.push({
                      pathname: '/(tabs)/haccp',
                      params: a.fridge_id ? { fridgeId: a.fridge_id } : {},
                    });
                  }}
                >
                  <Text style={{ fontSize: 12 }}>{a.isFreezer ? '🧊' : '❄️'}</Text>
                  <Text style={s.alertTempName} numberOfLines={1}>{a.fridge}</Text>
                  <Text style={[s.alertTempVal, { color: C.bad }]}>{a.valeur}°C</Text>
                  <Text style={{ fontSize: 10, color: C.muted, marginLeft: 4 }}>›</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={{ width: 10 }} />

          {/* ─── MODULE ALERTES DLC (Modification 3) ────── */}
          <View style={s.alertModule}>
            <View style={s.alertModuleLine} />
            <Text style={{ fontSize: 20, marginBottom: 6 }}>🏷️</Text>
            <Text style={s.alertModuleLabel}>Alertes DLC</Text>
            {dlcAlerts.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 4 }}>
                <Text style={{ fontSize: 16, marginBottom: 2 }}>✅</Text>
                <Text style={s.alertOkText}>Aucune DLC proche</Text>
              </View>
            ) : (
              dlcAlerts.slice(0, 3).map((a: any, i: number) => (
                <TouchableOpacity key={i} style={s.alertTempRow} activeOpacity={0.6}
                  onPress={() => {
                    if (!a.photo_uri) return;
                    setDlcPhoto({
                      id: a.photo_id,
                      uri: a.photo_uri,
                      name: a.photo_name || a.nom,
                      dlc_date: a.dlc,
                      dlc_active: true,
                      lot: a.lot,
                    });
                  }}
                >
                  <Text style={{ fontSize: 12 }}>
                    {a.joursRestants === 0 ? '🔴' : a.joursRestants === 1 ? '🟠' : '🟡'}
                  </Text>
                  <Text style={s.alertTempName} numberOfLines={1}>{a.nom}</Text>
                  <Text style={[s.alertTempVal, {
                    color: a.joursRestants === 0 ? C.bad : a.joursRestants <= 1 ? C.warn : C.gold
                  }]}>
                    J-{a.joursRestants}
                  </Text>
                  <Text style={{ fontSize: 10, color: C.muted, marginLeft: 4 }}>›</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        {/* ─── DERNIÈRES FACTURES ─────────────────────────── */}
        <STitle>Dernières Factures</STitle>
        <View style={s.card}>
          {!dashboard?.recentInvoices?.length ? (
            <Empty icon="🧾" text="Aucune facture scannée" />
          ) : dashboard.recentInvoices.map(inv => (
            <View key={inv.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{inv.supplier}</Text>
                <Text style={s.rowSub}>{inv.date} · {inv.products?.length ?? 0} produits</Text>
              </View>
              <Text style={s.rowRight}>{(inv.total_ttc ?? 0).toFixed(2)}€</Text>
            </View>
          ))}
        </View>

        {/* ─── ALERTES DE PRIX ────────────────────────────── */}
        <STitle>Alertes de Prix</STitle>
        <View style={s.card}>
          {!dashboard?.recentAlerts?.length ? (
            <Empty icon="✅" text="Aucune anomalie détectée" />
          ) : dashboard.recentAlerts.map((a, i) => (
            <View key={i} style={s.row}>
              <Text style={{ fontSize: 18, marginRight: 10 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{a.product}</Text>
                <Text style={[s.rowSub, { fontFamily: 'DMSans_400Regular' }]}>
                  <Text style={{ textDecorationLine: 'line-through', color: C.muted }}>{a.oldPrice?.toFixed(2)}€</Text>
                  {' → '}
                  <Text style={{ color: C.bad }}>{a.newPrice?.toFixed(2)}€</Text>
                  {' · '}{a.supplier}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ─── RELEVÉS DE TEMPÉRATURES (Modification 4) ──── */}
        <STitle>Relevés de Températures</STitle>
        <View style={s.card}>
          <View style={{ padding: 16 }}>
            {/* Statut du service en cours */}
            <View style={s.tempCheckHeader}>
              <Text style={{ fontSize: 16 }}>
                {tempCheckStatus?.currentService === 'MIDI' ? '☀️' : '🌙'}
              </Text>
              <Text style={s.tempCheckServiceText}>
                Service {tempCheckStatus?.currentService ?? '—'}
              </Text>
              <View style={[
                s.tempCheckBadge,
                { backgroundColor: 
                  tempCheckStatus?.status === 'complete' 
                    ? 'rgba(74,222,128,0.15)' 
                    : tempCheckStatus?.status === 'in_progress'
                      ? 'rgba(250,204,21,0.15)'
                      : 'rgba(248,113,113,0.15)' 
                }
              ]}>
                <Text style={{
                  fontSize: 10, fontFamily: 'Cinzel_700Bold', letterSpacing: 1,
                  color: tempCheckStatus?.status === 'complete' 
                    ? C.ok 
                    : tempCheckStatus?.status === 'in_progress'
                      ? C.warn
                      : C.bad
                }}>
                  {tempCheckStatus?.status === 'complete' 
                    ? '✅ VALIDÉ' 
                    : tempCheckStatus?.status === 'in_progress'
                      ? '🔄 EN COURS'
                      : '⏳ EN ATTENTE'}
                </Text>
              </View>
            </View>

            {/* Progression */}
            <View style={s.tempCheckProgress}>
              <View style={s.tempCheckTrack}>
                <View style={[s.tempCheckFill, {
                  width: tempCheckStatus?.totalFridges
                    ? `${(tempCheckStatus.completedFridges / tempCheckStatus.totalFridges) * 100}%`
                    : '0%',
                  backgroundColor: tempCheckStatus?.status === 'complete' 
                    ? C.ok 
                    : tempCheckStatus?.status === 'in_progress'
                      ? C.warn
                      : C.bad
                }]} />
              </View>
              <Text style={s.tempCheckCount}>
                {tempCheckStatus?.completedFridges ?? 0}/{tempCheckStatus?.totalFridges ?? 0} frigos
              </Text>
            </View>

            {/* Frigos manquants */}
            {tempCheckStatus?.missingFridges?.length > 0 && (
              <View style={{ marginTop: 8 }}>
                {tempCheckStatus.missingFridges.map((name: string, i: number) => (
                  <View key={i} style={s.missingFridgeRow}>
                    <Text style={{ fontSize: 10, color: C.bad }}>⚠️</Text>
                    <Text style={s.missingFridgeName}>{name}</Text>
                    <Text style={s.missingFridgeHint}>non relevé</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Toggle notification push */}
            <View style={s.pushRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.pushLabel}>🔔  Notifications push</Text>
                <Text style={s.pushHint}>
  Rappels à {tempCheckStatus?.currentService === 'MIDI' ? '14h30 et 15h30' : '22h30 et 23h30'} si oubli
</Text>
              </View>
              <Switch
               value={pushEnabled}
               onValueChange={async (val) => {
               setPushEnabled(val);
               await savePushPreference(val);
               }}
               trackColor={{ false: '#333', true: 'rgba(212,175,55,0.3)' }}
               thumbColor={pushEnabled ? C.gold : '#666'}
               ios_backgroundColor="#333"
               />
            </View>
          </View>
        </View>

{archiveAlert && !archiveAlert.is_complete && (
  <View style={{ marginTop: 16 }}>
    <STitle>Archives HACCP</STitle>
    <View style={s.alertModule}>
      <View style={s.alertModuleLine} />
      <Text style={{ fontSize: 20, marginBottom: 6 }}>📋</Text>
      <Text style={s.alertModuleLabel}>Mois précédent incomplet</Text>
      
      <View style={{ alignItems: 'center', marginTop: 8, gap: 6 }}>
        <Text style={{ fontSize: 28, fontFamily: 'Cinzel_700SemiBold', color: archiveAlert.completion_rate >= 80 ? C.warn : C.bad }}>
          {archiveAlert.completion_rate}%
        </Text>
        <Text style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>
          des relevés remplis pour {archiveAlert.month_label}
        </Text>
        <Text style={{ fontSize: 11, color: C.mutedL, textAlign: 'center', marginTop: 2 }}>
          {archiveAlert.log_count} / {archiveAlert.expected_logs} relevés
        </Text>
      </View>
 
      <View style={{ marginTop: 10, backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)', borderRadius: 8, padding: 10 }}>
        <Text style={{ fontSize: 11, color: C.bad, textAlign: 'center', lineHeight: 16 }}>
          ⚠️ Complétez vos relevés avant l'archivage automatique !
        </Text>
      </View>
 
      <TouchableOpacity
        style={{ marginTop: 10, backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: C.gold, borderRadius: 8, padding: 10, alignItems: 'center' }}
        onPress={() => router.push('/(tabs)/haccp')}
      >
        <Text style={{ color: C.gold, fontSize: 11, fontFamily: 'Cinzel_700SemiBold', letterSpacing: 1 }}>
          📝 COMPLÉTER LES RELEVÉS
        </Text>
      </TouchableOpacity>
    </View>
  </View>
)}
{/* ─── MODALE PHOTO DLC ──────────── */}
        <Modal visible={!!dlcPhoto} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
              onPress={() => setDlcPhoto(null)}
            >
              <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
            {dlcPhoto?.uri && (
              <Image source={{ uri: dlcPhoto.uri }} style={{ width: '90%', height: '60%' }} resizeMode="contain" />
            )}
            {dlcPhoto?.name && (
              <Text style={{ color: '#F5F5DC', fontSize: 14, marginTop: 16, textAlign: 'center' }}>{dlcPhoto.name}</Text>
            )}
            {dlcPhoto?.dlc_date && (
              <Text style={{ color: '#D4AF37', fontSize: 13, marginTop: 6 }}>
                📅 DLC : {dlcPhoto.dlc_date?.includes('-') ? dlcPhoto.dlc_date.split('-').reverse().join('/') : dlcPhoto.dlc_date}
              </Text>
            )}
            {dlcPhoto?.lot && (
              <Text style={{ color: '#6B6050', fontSize: 11, marginTop: 2 }}>Lot : {dlcPhoto.lot}</Text>
            )}

            {dlcPhoto?.dlc_date && dlcPhoto?.id && (
              <TouchableOpacity
                style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                onPress={async () => {
                  const newActive = !dlcPhoto.dlc_active;
                  setDlcPhoto({ ...dlcPhoto, dlc_active: newActive });
                  try {
                    const token = await getToken();
                    fetch(`https://chefgestion-pro.onrender.com/api/haccp/photos/${dlcPhoto.id}/toggle-dlc`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ active: newActive }),
                    }).then(() => {
                      refreshDashboard();
                    }).catch(() => {
                      setDlcPhoto((prev: any) => prev ? { ...prev, dlc_active: !newActive } : null);
                    });
                  } catch {}
                }}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 40, height: 22, borderRadius: 11, justifyContent: 'center',
                  backgroundColor: dlcPhoto.dlc_active ? '#4ADE80' : '#333',
                  paddingHorizontal: 3,
                }}>
                  <View style={{
                    width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFF',
                    alignSelf: dlcPhoto.dlc_active ? 'flex-end' : 'flex-start',
                  }} />
                </View>
                <Text style={{ color: dlcPhoto.dlc_active ? '#4ADE80' : '#6B6050', fontSize: 12, fontWeight: 'bold' }}>
                  {dlcPhoto.dlc_active ? 'ALERTE DLC ACTIVÉE' : 'ACTIVER L\'ALERTE DLC'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Modal>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function KPI({ icon, label, value, hint }: { icon: string; label: string; value: string; hint?: string }) {
  return (
    <View style={s.kpi}>
      <View style={s.kpiLine} />
      <Text style={{ fontSize: 20, marginBottom: 6 }}>{icon}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiVal}>{value}</Text>
      {hint && <Text style={s.kpiHint}>{hint}</Text>}
    </View>
  );
}

function STitle({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 24 }}>
      <Text style={{ fontFamily: 'Cinzel_400Regular', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: C.gold, marginRight: 10 }}>{children}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: C.gold, opacity: 0.3 }} />
    </View>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ padding: 28, alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 32, opacity: 0.5 }}>{icon}</Text>
      <Text style={{ fontSize: 14, color: C.muted, fontStyle: 'italic' }}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.blackS },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: C.charcoal, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)' },
  logo: { width: 34, height: 34, borderRadius: 8 },
  title: { fontFamily: 'Cinzel_700SemiBold', fontSize: 18, color: C.cream },
  sub: { fontSize: 12, color: C.muted, fontStyle: 'italic', marginTop: 2 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.goldD, borderWidth: 1, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontFamily: 'Cinzel_700SemiBold', fontSize: 14, color: C.black },
  content: { padding: 16, paddingBottom: 90 },
  kpiRow: { flexDirection: 'row' },
  kpi: { flex: 1, backgroundColor: C.charcoal, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', padding: 14, overflow: 'hidden' },
  kpiLine: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, backgroundColor: C.gold },
  kpiLabel: { fontFamily: 'Cinzel_400Regular', fontSize: 7, letterSpacing: 1.5, textTransform: 'uppercase', color: C.mutedL, marginBottom: 4 },
  kpiVal: { fontFamily: 'DMSans_400Regular', fontSize: 22, color: C.gold, lineHeight: 26 },
  kpiHint: { fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 3 },

  alertModule: { flex: 1, backgroundColor: C.charcoal, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', padding: 14, overflow: 'hidden', minHeight: 120 },
  alertModuleLine: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, backgroundColor: C.gold },
  alertModuleLabel: { fontFamily: 'Cinzel_400Regular', fontSize: 7, letterSpacing: 1.5, textTransform: 'uppercase', color: C.mutedL, marginBottom: 6 },
  alertOkText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: C.ok, fontStyle: 'italic' },
  alertTempRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  alertTempName: { flex: 1, fontSize: 11, color: C.cream, fontFamily: 'DMSans_400Regular' },
  alertTempVal: { fontSize: 12, fontFamily: 'DMSans_400Regular', fontWeight: 'bold' },

  card: { backgroundColor: C.charcoal, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.13)', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rowTitle: { fontSize: 15, color: C.cream },
  rowSub: { fontSize: 12, color: C.muted, fontStyle: 'italic', marginTop: 2 },
  rowRight: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: C.gold },

  tempCheckHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tempCheckServiceText: { fontFamily: 'Cinzel_400Regular', fontSize: 12, color: C.cream, flex: 1, letterSpacing: 1 },
  tempCheckBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tempCheckProgress: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  tempCheckTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  tempCheckFill: { height: '100%', backgroundColor: C.gold, borderRadius: 3 },
  tempCheckCount: { fontSize: 11, color: C.muted, fontFamily: 'DMSans_400Regular', minWidth: 80 },
  missingFridgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  missingFridgeName: { flex: 1, fontSize: 11, color: C.cream, fontFamily: 'DMSans_400Regular' },
  missingFridgeHint: { fontSize: 10, color: C.bad, fontStyle: 'italic' },
  pushRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.1)' },
  pushLabel: { fontSize: 12, color: C.cream, fontFamily: 'DMSans_400Regular' },
  pushHint: { fontSize: 10, color: C.muted, fontStyle: 'italic', marginTop: 2 },
});
