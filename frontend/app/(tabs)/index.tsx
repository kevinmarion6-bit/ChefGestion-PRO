import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/lib/context';

const C = { black: '#000', blackS: '#0C0C0C', charcoal: '#1A1A1A', gold: '#D4AF37', goldL: '#EAD06A', goldD: '#A07D1C', bronze: '#CD7F32', cream: '#F5F5DC', creamD: '#EDE8D0', muted: '#6B6050', mutedL: '#8A7A60', ok: '#4ADE80', warn: '#FACC15', bad: '#F87171' };

export default function DashboardScreen() {
  const { user, dashboard, refreshDashboard, isLoggedIn } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => { setRefreshing(true); await refreshDashboard(); setRefreshing(false); };

  const initials = user?.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() ?? 'C';
  const kpis = dashboard?.kpis;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Tableau de Bord</Text>
          <Text style={s.sub}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</Text>
        </View>
        <View style={s.avatar}><Text style={s.avatarTxt}>{initials}</Text></View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />} contentContainerStyle={s.content}>

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
  card: { backgroundColor: C.charcoal, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.13)', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rowTitle: { fontSize: 15, color: C.cream },
  rowSub: { fontSize: 12, color: C.muted, fontStyle: 'italic', marginTop: 2 },
  rowRight: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: C.gold },
});
