import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/Theme';
import { SectionTitle } from '@/components/UI';
import { useApp } from '@/lib/context';

const NATIONAL = {
  coutMatiere:    { lbl: 'Ratio Coût Matière',   nat: 30, unit: '%', min: 25, max: 35 },
  masseSalariale: { lbl: 'Masse Salariale',       nat: 36, unit: '%', min: 30, max: 42 },
  chargesExt:     { lbl: 'Charges Externes',      nat: 15, unit: '%', min: 10, max: 20 },
  ebe:            { lbl: 'EBE',                   nat: 12, unit: '%', min: 8,  max: 18 },
  tauxMarge:      { lbl: 'Taux de Marge Brute',   nat: 70, unit: '%', min: 65, max: 75 },
  ticketMoyen:    { lbl: 'Ticket Moyen',          nat: 32, unit: '€', min: 25, max: 45 },
};

export default function RatiosScreen() {
  const { state } = useApp();
  const hasData = state.invoices.length > 0;

  const userV: Record<string, number | null> = {
    coutMatiere:    hasData ? 28.5 : null,
    masseSalariale: null,
    chargesExt:     null,
    ebe:            null,
    tauxMarge:      hasData ? 71.5 : null,
    ticketMoyen:    null,
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Indicateurs & Ratios</Text>
        <Text style={styles.headerSub}>Performance vs moyennes nationales</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.gold }]} /><Text style={styles.legendTxt}>Votre restaurant</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.bronze }]} /><Text style={styles.legendTxt}>Moyenne nationale</Text></View>
        </View>

        {Object.entries(NATIONAL).map(([key, cfg]) => {
          const mine = userV[key];
          const natPct = ((cfg.nat - cfg.min) / (cfg.max - cfg.min) * 100);
          const minePct = mine !== null ? ((Math.max(cfg.min, Math.min(mine, cfg.max)) - cfg.min) / (cfg.max - cfg.min) * 100) : 0;

          return (
            <View key={key} style={styles.ratioCard}>
              <Text style={styles.ratioName}>{cfg.lbl}</Text>

              {/* Bar */}
              <View style={styles.track}>
                {mine !== null && (
                  <View style={[styles.fill, { width: `${minePct}%` }]} />
                )}
                <View style={[styles.needle, { left: `${natPct}%` }]} />
              </View>

              <View style={styles.ratioRow}>
                <Text style={styles.ratioVal}>
                  {mine !== null ? `${mine.toFixed(1)}${cfg.unit}` : 'N/D'}
                </Text>
                <Text style={styles.ratioNat}>
                  Nationale : <Text style={{ color: Colors.bronze }}>{cfg.nat}{cfg.unit}</Text>
                </Text>
              </View>
            </View>
          );
        })}

        <SectionTitle style={{ marginTop: 24 }}>Évolution Coût Matière</SectionTitle>
        <View style={styles.chartCard}>
          <SimpleBarChart data={state.invoices} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SimpleBarChart({ data }: { data: any[] }) {
  const months = ['Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév'];
  const vals = [2800, 3100, 2950, 3400, 3200, data.reduce((s, i) => s + (i.total_ht || 0), 0) || 2850];
  const maxV = Math.max(...vals);

  return (
    <View style={styles.chart}>
      {vals.map((v, i) => (
        <View key={i} style={styles.barWrap}>
          <View style={styles.barTrack}>
            <View style={[styles.bar, { height: `${(v / maxV) * 100}%` }]} />
          </View>
          <Text style={styles.barLabel}>{months[i]}</Text>
          <Text style={styles.barVal}>{(v / 1000).toFixed(1)}k</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.blackSoft },
  header: { padding: Spacing.md, backgroundColor: Colors.charcoal, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)' },
  headerTitle: { fontFamily: 'Cinzel_700SemiBold', fontSize: 18, color: Colors.cream },
  headerSub: { fontSize: 11, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: 90 },

  legend: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 12, color: Colors.muted },

  ratioCard: { backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)', borderRadius: 12, padding: 16, marginBottom: 10 },
  ratioName: { fontFamily: 'Cinzel_400Regular', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: Colors.mutedLight, marginBottom: 12 },
  track: { height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 8, position: 'relative' },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: Colors.gold, borderRadius: 3, opacity: 0.85 },
  needle: { position: 'absolute', top: -4, bottom: -4, width: 2, backgroundColor: Colors.bronze, borderRadius: 1 },
  ratioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  ratioVal: { fontFamily: 'DMSans_400Regular', fontSize: 24, color: Colors.gold },
  ratioNat: { fontSize: 12, color: Colors.muted, fontStyle: 'italic' },

  chartCard: { backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)', borderRadius: 12, padding: 16 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, gap: 6 },
  barWrap: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: Colors.gold, borderRadius: 3, opacity: 0.85 },
  barLabel: { fontFamily: 'DMSans_400Regular', fontSize: 9, color: Colors.muted },
  barVal: { fontFamily: 'DMSans_400Regular', fontSize: 9, color: Colors.gold },
});
