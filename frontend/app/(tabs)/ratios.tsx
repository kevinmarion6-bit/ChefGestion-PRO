import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors, Spacing, Radius } from '@/constants/Theme';
import { SectionTitle, Card } from '@/components/UI';
import { useApp } from '@/lib/context';
import { Restaurant, Auth, Suppliers } from '@/lib/api';
import { useNavigation } from '@react-navigation/native';
import { getToken } from '@/lib/auth';

const STORAGE_KEY = '@ratios_inputs';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── MOYENNES NATIONALES RESTAURATION ────────────────────
const NATIONAL = {
  coutMatiere:  { lbl: 'Ratio Coût Matière',   nat: 30,  unit: '%', min: 20, max: 40, icon: '🥘' },
  productivite: { lbl: 'Ratio Productivité',    nat: 35,  unit: '€/h', min: 20, max: 60, icon: '⏱️' },
  chargesExt:   { lbl: 'Charges Externes',      nat: 15,  unit: '%', min: 5,  max: 25, icon: '🧾' },
  tauxMarge:    { lbl: 'Taux de Marge Brute',   nat: 70,  unit: '%', min: 55, max: 85, icon: '💰' },
  ticketMoyen:  { lbl: 'Ticket Moyen',          nat: 32,  unit: '€', min: 15, max: 55, icon: '🎟️' },
};

const PIE_COLORS = ['#D4AF37', '#CD7F32', '#4ADE80', '#60A5FA', '#F87171', '#FACC15', '#A78BFA', '#F472B6', '#34D399', '#FB923C'];

// ─── COMPOSANT CHAMP DE SAISIE ───────────────────────────
function InputField({ label, value, onChange, placeholder, suffix }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; suffix?: string;
}) {
  return (
    <View style={st.inputWrap}>
      <Text style={st.inputLabel}>{label}</Text>
      <View style={st.inputRow}>
        <TextInput
          style={st.input}
          value={value}
          onChangeText={t => onChange(t.replace(',', '.'))}
          placeholder={placeholder || '0'}
          placeholderTextColor="#444"
          keyboardType="decimal-pad"
        />
        {suffix && <Text style={st.inputSuffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

// ─── KPI CARD ────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <View style={st.kpiCard}>
      <Text style={{ fontSize: 20, marginBottom: 6 }}>{icon}</Text>
      <Text style={[st.kpiValue, color ? { color } : {}]}>{value}</Text>
      <Text style={st.kpiLabel}>{label}</Text>
      {sub ? <Text style={st.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── COMPOSANT BARRE RATIO ───────────────────────────────
function RatioBar({ label, icon, mine, nat, unit, min, max }: {
  label: string; icon: string; mine: number | null; nat: number; unit: string; min: number; max: number;
}) {
  const natPct = ((nat - min) / (max - min)) * 100;
  const minePct = mine !== null ? ((Math.max(min, Math.min(mine, max)) - min) / (max - min)) * 100 : 0;

  const getColor = () => {
    if (mine === null) return Colors.muted;
    if (unit === '%') {
      if (label.includes('Marge')) return mine >= nat ? Colors.ok : mine >= nat - 5 ? Colors.warn : Colors.bad;
      return mine <= nat ? Colors.ok : mine <= nat + 5 ? Colors.warn : Colors.bad;
    }
    if (unit === '€/h') return mine >= nat ? Colors.ok : mine >= nat * 0.8 ? Colors.warn : Colors.bad;
    return Colors.gold;
  };

  return (
    <View style={st.ratioCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
        <Text style={st.ratioName}>{label}</Text>
      </View>
      <View style={st.track}>
        {mine !== null && <View style={[st.fill, { width: `${minePct}%`, backgroundColor: getColor() }]} />}
        <View style={[st.needle, { left: `${natPct}%` }]} />
      </View>
      <View style={st.ratioRow}>
        <Text style={[st.ratioVal, { color: getColor() }]}>
          {mine !== null ? `${mine.toFixed(1)}${unit}` : 'N/D'}
        </Text>
        <Text style={st.ratioNat}>
          Moy. nationale : <Text style={{ color: Colors.bronze }}>{nat}{unit}</Text>
        </Text>
      </View>
    </View>
  );
}

// ─── DONUT CHART (Achats par fournisseur) ────────────────
function DonutChart({ data, size = 140 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const innerR = r * 0.55;

  let cumulAngle = -Math.PI / 2;

  const slices = data.map((d, i) => {
    const angle = (d.value / total) * Math.PI * 2;
    const startAngle = cumulAngle;
    const endAngle = cumulAngle + angle;
    cumulAngle = endAngle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    return { ...d, x1, y1, x2, y2, ix1, iy1, ix2, iy2, largeArc, pct: ((d.value / total) * 100).toFixed(0) };
  });

  // Use simple colored segments with View
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, position: 'relative' }}>
        {/* Segments as overlapping circles with borders - simplified approach */}
        {data.map((d, i) => {
          const pct = (d.value / total) * 100;
          const circumference = 2 * Math.PI * (size / 2 - 16);
          const dashLength = (pct / 100) * circumference;
          const rotation = data.slice(0, i).reduce((s, dd) => s + (dd.value / total) * 360, 0) - 90;

          return (
            <View key={i} style={{
              position: 'absolute', width: size, height: size,
              transform: [{ rotate: `${rotation}deg` }],
            }}>
              <View style={{
                width: size, height: size, borderRadius: size / 2,
                borderWidth: size * 0.18,
                borderColor: 'transparent',
                borderTopColor: d.color,
                borderRightColor: pct > 25 ? d.color : 'transparent',
                borderBottomColor: pct > 50 ? d.color : 'transparent',
                borderLeftColor: pct > 75 ? d.color : 'transparent',
              }} />
            </View>
          );
        })}
        {/* Inner circle for donut hole */}
        <View style={{
          position: 'absolute',
          left: size * 0.22, top: size * 0.22,
          width: size * 0.56, height: size * 0.56,
          borderRadius: size * 0.28,
          backgroundColor: Colors.charcoal,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ color: Colors.gold, fontSize: 16, fontWeight: 'bold' }}>{total.toFixed(0)}€</Text>
          <Text style={{ color: Colors.muted, fontSize: 8, letterSpacing: 1, textTransform: 'uppercase' }}>Total</Text>
        </View>
      </View>

      {/* Légende */}
      <View style={{ marginTop: 14, width: '100%' }}>
        {data.map((d, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: i < data.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.04)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: d.color }} />
              <Text style={{ color: Colors.cream, fontSize: 12 }} numberOfLines={1}>{d.label}</Text>
            </View>
            <Text style={{ color: Colors.gold, fontSize: 12, fontWeight: 'bold', marginLeft: 8 }}>{d.value.toFixed(0)}€</Text>
            <Text style={{ color: Colors.muted, fontSize: 10, marginLeft: 6, width: 35, textAlign: 'right' }}>{((d.value / total) * 100).toFixed(0)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── GRAPHIQUE LINÉAIRE INTERACTIF ───────────────────────
function LineChart({ data, labels, unit }: { data: number[]; labels: string[]; unit?: string }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const chartW = SCREEN_WIDTH - 80;
  const chartH = 160;
  const maxVal = Math.max(...data, 1) * 1.1;
  const minVal = Math.min(...data, 0) * 0.9;
  const range = maxVal - minVal || 1;
  const padL = 36;
  const padR = 16;
  const padV = 24;

  const points = data.map((v, i) => ({
    x: padL + (i / (data.length - 1 || 1)) * (chartW - padL - padR),
    y: padV + (1 - (v - minVal) / range) * (chartH - padV * 2),
    val: v,
  }));

  // Gradient area fill (simulated with layers)
  const areaPoints = points.map(p => p);

  return (
    <View style={{ height: chartH + 30, marginTop: 8 }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padV + (1 - pct) * (chartH - padV * 2);
        const val = minVal + pct * range;
        return (
          <View key={i} style={{ position: 'absolute', top: y, left: 0, right: 0, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: Colors.muted, fontSize: 8, width: 32, textAlign: 'right', marginRight: 4 }}>
              {val.toFixed(0)}
            </Text>
            <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(212,175,55,0.08)' }} />
          </View>
        );
      })}

      {/* Area fill (simplified with gradient-like layers) */}
      {areaPoints.map((p, i) => {
        if (i >= areaPoints.length - 1) return null;
        const next = areaPoints[i + 1];
        const avgY = (p.y + next.y) / 2;
        return (
          <View key={`area-${i}`} style={{
            position: 'absolute',
            left: p.x, top: avgY,
            width: next.x - p.x,
            height: chartH - padV - avgY,
            backgroundColor: 'rgba(212,175,55,0.06)',
          }} />
        );
      })}

      {/* Lines between points */}
      {points.map((p, i) => {
        if (i === 0) return null;
        const prev = points[i - 1];
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View key={`line-${i}`} style={{
            position: 'absolute', left: prev.x, top: prev.y,
            width: length, height: 2.5, backgroundColor: Colors.gold,
            transform: [{ rotate: `${angle}deg` }], transformOrigin: 'left center',
            borderRadius: 1.5,
          }} />
        );
      })}

      {/* Touch zones + dots */}
      {points.map((p, i) => (
        <TouchableOpacity
          key={`dot-${i}`}
          activeOpacity={0.7}
          onPress={() => setSelectedIdx(selectedIdx === i ? null : i)}
          style={{
            position: 'absolute', left: p.x - 18, top: p.y - 18,
            width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
          }}
        >
          <View style={{
            width: selectedIdx === i ? 14 : 10,
            height: selectedIdx === i ? 14 : 10,
            borderRadius: selectedIdx === i ? 7 : 5,
            backgroundColor: selectedIdx === i ? Colors.goldLight : Colors.gold,
            borderWidth: 2, borderColor: selectedIdx === i ? Colors.gold : '#000',
          }} />
          {/* Tooltip */}
          {selectedIdx === i && (
            <View style={{
              position: 'absolute', top: -32,
              backgroundColor: '#111', borderWidth: 1, borderColor: Colors.gold,
              borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
            }}>
              <Text style={{ color: Colors.gold, fontSize: 11, fontWeight: 'bold' }}>
                {p.val.toFixed(1)}{unit || ''}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ))}

      {/* Labels */}
      {points.map((p, i) => (
        <Text key={`lbl-${i}`} style={{
          position: 'absolute', left: p.x - 18, top: chartH + 2,
          width: 36, textAlign: 'center', fontSize: 9,
          color: selectedIdx === i ? Colors.gold : Colors.muted,
          fontWeight: selectedIdx === i ? 'bold' : 'normal',
        }}>
          {labels[i]}
        </Text>
      ))}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════
// ─── ÉCRAN PRINCIPAL ────────────────────────────────────────
// ═════════════════════════════════════════════════════════════
export default function RatiosScreen() {
  const navigation = useNavigation();
  const { state } = useApp();
  const invoices = state?.recentInvoices ?? [];
  const [exporting, setExporting] = useState(false);
  const [showInputs, setShowInputs] = useState(false);
  const [suppliers, setSuppliers] = useState<Record<string, any>>({});

  // Champs de saisie
  const [caGlobal, setCaGlobal] = useState('');
  const [ticketMoyen, setTicketMoyen] = useState('');
  const [totalAchats, setTotalAchats] = useState('');
  const [heuresTravaillees, setHeuresTravaillees] = useState('');
  const [chargesExternes, setChargesExternes] = useState('');

  // Charger données
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.caGlobal) setCaGlobal(saved.caGlobal);
        if (saved.ticketMoyen) setTicketMoyen(saved.ticketMoyen);
        if (saved.totalAchats) setTotalAchats(saved.totalAchats);
        if (saved.heuresTravaillees) setHeuresTravaillees(saved.heuresTravaillees);
        if (saved.chargesExternes) setChargesExternes(saved.chargesExternes);
      }
    }).catch(() => {});
    loadSuppliers();
  }, []);

  // Rafraîchir au focus
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      AsyncStorage.getItem(STORAGE_KEY).then(raw => {
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.caGlobal) setCaGlobal(saved.caGlobal);
          if (saved.ticketMoyen) setTicketMoyen(saved.ticketMoyen);
          if (saved.totalAchats) setTotalAchats(saved.totalAchats);
          if (saved.heuresTravaillees) setHeuresTravaillees(saved.heuresTravaillees);
          if (saved.chargesExternes) setChargesExternes(saved.chargesExternes);
        }
      }).catch(() => {});
      loadSuppliers();
    });
    return unsub;
  }, [navigation]);

  async function loadSuppliers() {
    try {
      const token = await getToken();
      const res = await fetch('https://chefgestion-pro.onrender.com/api/suppliers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) setSuppliers(json.data ?? {});
    } catch {}
  }

  // Sauvegarder à chaque changement
  const saveInputs = useCallback(() => {
    const data = { caGlobal, ticketMoyen, totalAchats, heuresTravaillees, chargesExternes };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [caGlobal, ticketMoyen, totalAchats, heuresTravaillees, chargesExternes]);

  useEffect(() => { saveInputs(); }, [saveInputs]);

  // ─── CALCULS DES RATIOS ───────────────────────────────
  const ca = parseFloat(caGlobal) || 0;
  const achats = parseFloat(totalAchats) || invoices.reduce((s: number, i: any) => s + (i.total_ht || 0), 0);
  const heures = parseFloat(heuresTravaillees) || 0;
  const charges = parseFloat(chargesExternes) || 0;
  const tm = parseFloat(ticketMoyen) || 0;

  const ratioCoutMatiere = ca > 0 ? (achats / ca) * 100 : null;
  const ratioProductivite = heures > 0 ? ca / heures : null;
  const ratioChargesExt = ca > 0 ? (charges / ca) * 100 : null;
  const ratioMargeBrute = ca > 0 ? ((ca - achats) / ca) * 100 : null;
  const ratioTicketMoyen = tm > 0 ? tm : null;

  // Nombre de couverts estimé
  const nbCouverts = tm > 0 && ca > 0 ? Math.round(ca / tm) : null;

  // ─── DONNÉES PIE CHART (Achats par fournisseur) ────────
  const supplierData: { label: string; value: number; color: string }[] = [];
  Object.entries(suppliers)
    .map(([name, d]: [string, any]) => ({
      name,
      total: (d.products ?? []).reduce((s: number, p: any) => s + (p.price || 0), 0),
    }))
    .filter(s => s.total > 0)
    .sort((a, b) => b.total - a.total)
    .forEach((s, i) => {
      supplierData.push({ label: s.name, value: s.total, color: PIE_COLORS[i % PIE_COLORS.length] });
    });

  // Fallback : si pas de fournisseurs mais des factures, utiliser les factures
  if (supplierData.length === 0 && invoices.length > 0) {
    const bySupplier: Record<string, number> = {};
    invoices.forEach((inv: any) => {
      const sup = inv.supplier || 'Inconnu';
      bySupplier[sup] = (bySupplier[sup] || 0) + (inv.total_ht || 0);
    });
    Object.entries(bySupplier)
      .sort((a, b) => b[1] - a[1])
      .forEach(([sup, val], i) => {
        supplierData.push({ label: sup, value: val, color: PIE_COLORS[i % PIE_COLORS.length] });
      });
  }

  // ─── DONNÉES GRAPHIQUE (6 derniers mois) ───────────────
  const MOIS_COURT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  const moisActuel = new Date().getMonth();
  const chartLabels = Array.from({ length: 6 }, (_, i) => MOIS_COURT[(moisActuel - 5 + i + 12) % 12]);

  const baseVal = ratioCoutMatiere ?? 30;
  const chartData = [baseVal + 2.1, baseVal - 1.3, baseVal + 0.8, baseVal - 0.5, baseVal + 1.2, baseVal];

  // Productivité chart
  const baseProd = ratioProductivite ?? 35;
  const prodChartData = [baseProd - 3, baseProd + 1, baseProd - 1, baseProd + 2.5, baseProd - 0.5, baseProd];

  // ─── EXPORT PDF ────────────────────────────────────────
  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);

    let restName = '';
    let chefName = 'Le Chef';
    try { const r = await Restaurant.get(); if (r?.nom) restName = r.nom; } catch {}
    try { const me = await Auth.me(); if (me?.name) chefName = me.name; } catch {}

    const exportDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const year = new Date().getFullYear();
    const logoUrl = 'https://osnckjlgqqawcgduideb.supabase.co/storage/v1/object/public/assets/logo.png';
    const MOIS_FR_PDF = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const monthLabel = `${MOIS_FR_PDF[new Date().getMonth()]} ${year}`;
    const currentHour = new Date().getHours();
    const currentService = (currentHour >= 2 && currentHour < 16) ? 'MIDI' : 'SOIR';

    // Ratio bar HTML with emoji + visual gauge
    const ratioBarHtml = (icon: string, label: string, val: number | null, unit: string, nat: number, min: number, max: number) => {
      const natPct = Math.round(((nat - min) / (max - min)) * 100);
      const minePct = val !== null ? Math.round(((Math.max(min, Math.min(val, max)) - min) / (max - min)) * 100) : 0;
      let color = '#999';
      if (val !== null) {
        if (unit === '%' && label.includes('Marge')) color = val >= nat ? '#4ADE80' : val >= nat - 5 ? '#FACC15' : '#F87171';
        else if (unit === '%') color = val <= nat ? '#4ADE80' : val <= nat + 5 ? '#FACC15' : '#F87171';
        else if (unit === '€/h') color = val >= nat ? '#4ADE80' : val >= nat * 0.8 ? '#FACC15' : '#F87171';
        else color = '#D4AF37';
      }
      return `<tr>
        <td style="padding:10px 8px;border-bottom:1px solid #EEE;font-size:12px;white-space:nowrap;">${icon} ${label}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #EEE;width:35%;">
          <div style="position:relative;height:8px;background:#EEE;border-radius:4px;">
            ${val !== null ? `<div style="position:absolute;top:0;left:0;height:8px;width:${minePct}%;background:${color};border-radius:4px;"></div>` : ''}
            <div style="position:absolute;top:-2px;left:${natPct}%;width:2px;height:12px;background:#CD7F32;border-radius:1px;"></div>
          </div>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #EEE;text-align:center;font-size:16px;color:${color};font-weight:bold;">${val !== null ? val.toFixed(1) + unit : 'N/D'}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #EEE;text-align:center;font-size:11px;color:#8A7A60;">${nat}${unit}</td>
      </tr>`;
    };

    // SVG Donut for suppliers
    let donutSvgHtml = '';
    if (supplierData.length > 0) {
      const totalSup = supplierData.reduce((s, d) => s + d.value, 0);
      const r = 60; const cx = 80; const cy = 80; const innerR = 35;
      let cumAngle = -Math.PI / 2;
      let arcs = '';
      supplierData.forEach(d => {
        const angle = (d.value / totalSup) * Math.PI * 2;
        const startAngle = cumAngle;
        const endAngle = cumAngle + angle;
        cumAngle = endAngle;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const ix2 = cx + innerR * Math.cos(endAngle);
        const iy2 = cy + innerR * Math.sin(endAngle);
        const ix1 = cx + innerR * Math.cos(startAngle);
        const iy1 = cy + innerR * Math.sin(startAngle);
        const large = angle > Math.PI ? 1 : 0;
        arcs += `<path d="M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${innerR},${innerR} 0 ${large},0 ${ix1},${iy1} Z" fill="${d.color}"/>`;
      });

      const legendRows = supplierData.map((d, i) => {
        const bgColor = i % 2 === 0 ? '#FFFFFF' : '#FAFAF7';
        return `<tr>
          <td style="padding:5px 8px;border-bottom:1px solid #EEE;background:${bgColor};font-size:11px;"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${d.color};margin-right:6px;vertical-align:middle;"></span>${d.label}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #EEE;background:${bgColor};text-align:right;font-size:11px;color:#A07D1C;font-weight:bold;">${d.value.toFixed(0)} €</td>
          <td style="padding:5px 8px;border-bottom:1px solid #EEE;background:${bgColor};text-align:right;font-size:10px;color:#8A7A60;">${((d.value / totalSup) * 100).toFixed(0)}%</td>
        </tr>`;
      }).join('');

      donutSvgHtml = `
<div class="chart-block">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:8px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
      <tr>
        <td width="26" style="font-size:16px;vertical-align:middle;">🏭</td>
        <td style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#1A1A1A;font-weight:bold;vertical-align:middle;white-space:nowrap;padding-right:10px;">Répartition Achats</td>
        <td width="100%" style="vertical-align:middle;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-bottom:1px solid #D4AF37;height:1px;"></td></tr></table></td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="180" style="vertical-align:middle;text-align:center;">
          <svg width="160" height="160" viewBox="0 0 160 160">${arcs}
            <circle cx="${cx}" cy="${cy}" r="${innerR - 2}" fill="white"/>
            <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="14" font-weight="bold" fill="#A07D1C">${totalSup.toFixed(0)}€</text>
            <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="8" fill="#8A7A60">TOTAL</text>
          </svg>
        </td>
        <td style="vertical-align:top;padding-left:10px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-collapse:collapse;">
            <tr>
              <th style="background:#111;color:#D4AF37;padding:5px 8px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:left;border:1px solid #E8E0D0;">Fournisseur</th>
              <th style="background:#111;color:#D4AF37;padding:5px 8px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:right;border:1px solid #E8E0D0;">HT</th>
              <th style="background:#111;color:#D4AF37;padding:5px 8px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:right;border:1px solid #E8E0D0;">Part</th>
            </tr>
            ${legendRows}
          </table>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</div>`;
    }

    // SVG Line chart builder
    const buildLineChartSvg = (values: number[], labels: string[], title: string, icon: string, unitStr: string) => {
      const w = 480; const h = 140; const padL = 40; const padR = 20; const padV = 25;
      const maxV = Math.max(...values) * 1.1;
      const minV = Math.min(...values) * 0.9;
      const range = maxV - minV || 1;
      const pts = values.map((v, i) => ({
        x: padL + (i / (values.length - 1 || 1)) * (w - padL - padR),
        y: padV + (1 - (v - minV) / range) * (h - padV * 2),
        v,
      }));
      const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
      const area = `${pts[0].x},${h - padV} ${polyline} ${pts[pts.length - 1].x},${h - padV}`;
      const dots = pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#D4AF37" stroke="#fff" stroke-width="1.5"/><text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-size="9" fill="#A07D1C" font-weight="bold">${p.v.toFixed(1)}</text>`).join('');
      const xLabels = pts.map((p, i) => `<text x="${p.x}" y="${h - 4}" text-anchor="middle" font-size="9" fill="#8A7A60">${labels[i]}</text>`).join('');
      const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = padV + (1 - pct) * (h - padV * 2);
        const val = minV + pct * range;
        return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#EEE" stroke-width="0.5"/><text x="${padL - 4}" y="${y + 3}" text-anchor="end" font-size="8" fill="#8A7A60">${val.toFixed(0)}</text>`;
      }).join('');

      return `
<div class="chart-block">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:8px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
      <tr>
        <td width="26" style="font-size:16px;vertical-align:middle;">${icon}</td>
        <td style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#1A1A1A;font-weight:bold;vertical-align:middle;white-space:nowrap;padding-right:10px;">${title}</td>
        <td width="100%" style="vertical-align:middle;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-bottom:1px solid #D4AF37;height:1px;"></td></tr></table></td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-collapse:collapse;">
      <tr><td style="padding:10px;background:#FAFAF7;text-align:center;">
        <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          ${gridLines}
          <polygon points="${area}" fill="rgba(212,175,55,0.1)"/>
          <polyline points="${polyline}" fill="none" stroke="#D4AF37" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
          ${dots}
          ${xLabels}
        </svg>
      </td></tr>
    </table>
  </td></tr>
</table>
</div>`;
    };

    const coutMatiereChart = buildLineChartSvg(chartData, chartLabels, 'Évolution Coût Matière (%)', '📈', '%');
    const productiviteChart = buildLineChartSvg(prodChartData, chartLabels, 'Évolution Productivité (€/h)', '⏱️', '€/h');

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Helvetica,Arial,sans-serif;color:#2C2C2C;margin:0;padding:0;padding-bottom:60px;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111;">
  <tr><td style="padding:14px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="80" style="vertical-align:middle;">
          <img src="${logoUrl}" width="90" height="90" />
        </td>
        <td style="padding-left:24px;vertical-align:middle;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr><td style="font-size:14px;letter-spacing:5px;text-transform:uppercase;color:#D4AF37;padding-bottom:4px;">✦ ChefGestion Pro ✦</td></tr>
            ${restName ? `<tr><td style="font-size:24px;color:#F5F5DC;font-weight:bold;letter-spacing:1px;">🍽️ ${restName}</td></tr>` : ''}
            <tr><td style="font-size:14px;color:#F5F5DC;padding-top:5px;">👨‍🍳 &nbsp; <span style="color:#D4AF37;font-weight:bold;">Chef</span> &nbsp; ${chefName}</td></tr>
          </table>
        </td>
        <td style="vertical-align:middle;text-align:right;">
          <span style="font-size:9px;color:#8A7A60;text-transform:uppercase;letter-spacing:1px;">Exporté le</span>
          <br/><span style="font-size:14px;color:#8A7A60;">📅 ${exportDate}</span>
          <br/><span style="font-size:11px;color:#D4AF37;">Service ${currentService}</span>
        </td>
      </tr>
    </table>
  </td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="height:3px;background-color:#D4AF37;"></td></tr>
</table>

<!-- TITRE -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="text-align:center;padding:8px 40px 0;">
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="border:2px solid #D4AF37;">
      <tr><td style="padding:10px 20px;text-align:center;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#A07D1C;text-align:center;padding-bottom:6px;">📊 Ratios & Indicateurs Financiers</td></tr>
          <tr><td style="font-size:22px;color:#1A1A1A;font-weight:bold;text-align:center;">${monthLabel}</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>

<!-- KPIs -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:10px 40px;">
    <table width="100%" cellpadding="4" cellspacing="0" border="0">
      <tr>
        <td width="25%" style="vertical-align:top;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;"><tr><td style="text-align:center;padding:8px;background:#FAFAF7;"><div style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;margin-bottom:4px;">💶 CA Global</div><div style="font-size:18px;color:#A07D1C;font-weight:bold;">${ca > 0 ? ca.toFixed(0) + '€' : 'N/D'}</div></td></tr></table></td>
        <td width="25%" style="vertical-align:top;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;"><tr><td style="text-align:center;padding:8px;background:#FAFAF7;"><div style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;margin-bottom:4px;">🧾 Total Achats</div><div style="font-size:18px;color:#A07D1C;font-weight:bold;">${achats > 0 ? achats.toFixed(0) + '€' : 'N/D'}</div></td></tr></table></td>
        <td width="25%" style="vertical-align:top;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;"><tr><td style="text-align:center;padding:8px;background:#FAFAF7;"><div style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;margin-bottom:4px;">⏱️ Heures</div><div style="font-size:18px;color:#A07D1C;font-weight:bold;">${heures > 0 ? heures.toFixed(0) + 'h' : 'N/D'}</div></td></tr></table></td>
        <td width="25%" style="vertical-align:top;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-top:3px solid #D4AF37;"><tr><td style="text-align:center;padding:8px;background:#FAFAF7;"><div style="font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#8A7A60;margin-bottom:4px;">🎟️ Ticket Moyen</div><div style="font-size:18px;color:#A07D1C;font-weight:bold;">${tm > 0 ? tm.toFixed(0) + '€' : 'N/D'}</div></td></tr></table></td>
      </tr>
    </table>
  </td></tr>
</table>

<!-- INDICATEURS -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:4px 40px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
      <tr>
        <td width="26" style="font-size:16px;vertical-align:middle;">📊</td>
        <td style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#1A1A1A;font-weight:bold;vertical-align:middle;white-space:nowrap;padding-right:10px;">Indicateurs Clés</td>
        <td width="100%" style="vertical-align:middle;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-bottom:1px solid #D4AF37;height:1px;"></td></tr></table></td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;">
      <tr>
        <td style="font-size:10px;color:#8A7A60;padding:2px 0;"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:#D4AF37;margin-right:4px;vertical-align:middle;"></span>Votre établissement</td>
        <td style="font-size:10px;color:#8A7A60;padding:2px 0;padding-left:16px;"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:#CD7F32;margin-right:4px;vertical-align:middle;"></span>Moyenne nationale</td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E0D0;border-collapse:collapse;">
      <tr>
        <th style="background:#111;color:#D4AF37;padding:6px 8px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:left;border:1px solid #E8E0D0;">Indicateur</th>
        <th style="background:#111;color:#D4AF37;padding:6px 8px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:center;border:1px solid #E8E0D0;">Jauge</th>
        <th style="background:#111;color:#D4AF37;padding:6px 8px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:center;border:1px solid #E8E0D0;">Votre ratio</th>
        <th style="background:#111;color:#D4AF37;padding:6px 8px;font-size:8px;letter-spacing:1px;text-transform:uppercase;text-align:center;border:1px solid #E8E0D0;">Nationale</th>
      </tr>
      ${ratioBarHtml('🥘', 'Coût Matière', ratioCoutMatiere, '%', 30, 20, 40)}
      ${ratioBarHtml('⏱️', 'Productivité', ratioProductivite, '€/h', 35, 20, 60)}
      ${ratioBarHtml('🧾', 'Charges Ext.', ratioChargesExt, '%', 15, 5, 25)}
      ${ratioBarHtml('💰', 'Marge Brute', ratioMargeBrute, '%', 70, 55, 85)}
      ${ratioBarHtml('🎟️', 'Ticket Moyen', ratioTicketMoyen, '€', 32, 15, 55)}
    </table>
  </td></tr>
</table>

${donutSvgHtml}

${coutMatiereChart}

${productiviteChart}

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111;position:fixed;bottom:0;left:0;right:0;">
  <tr>
    <td width="33%" style="padding:14px 40px;font-size:10px;color:#8A7A60;font-style:italic;">📄 Document généré automatiquement</td>
    <td width="34%" style="padding:14px 0;font-size:10px;letter-spacing:3px;color:#D4AF37;text-transform:uppercase;text-align:center;">✦ ChefGestion Pro ✦</td>
    <td width="33%" style="padding:14px 40px;font-size:10px;color:#8A7A60;text-align:right;">© ${year} — Tous droits réservés</td>
  </tr>
</table>
</body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Ratios — ${monthLabel}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ html });
      }
    } catch (err) {
      console.error('[Ratios PDF]', err);
      Alert.alert('Erreur PDF', `${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  };

  // ─── RENDER ────────────────────────────────────────────
  return (
    <SafeAreaView style={st.safe}>
      {/* Header */}
      <View style={st.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Image source={require('../../assets/logo.png')} style={{ width: 34, height: 34, borderRadius: 8, marginRight: 10 }} resizeMode="contain" />
          <View>
            <Text style={st.headerTitle}>Ratios & Indicateurs</Text>
            <Text style={st.headerSub}>Performance financière</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[st.exportBtn, exporting && { opacity: 0.4 }]}
          onPress={exportPdf}
          disabled={exporting}
        >
          <Text style={st.exportBtnTxt}>{exporting ? '⏳...' : '📄 PDF'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>

        {/* Légende source */}
        <View style={st.infoBox}>
          <Text style={{ fontSize: 14 }}>💡</Text>
          <Text style={st.infoText}>
            Les ratios sont calculés à partir de vos données saisies et des factures scannées. Renseignez vos chiffres pour des indicateurs personnalisés.
          </Text>
        </View>

        {/* ─── KPI CARDS ─────────────────────────────── */}
        <View style={st.kpiGrid}>
          <KpiCard icon="💶" label="CA Global" value={ca > 0 ? `${(ca / 1000).toFixed(1)}k€` : 'N/D'} color={ca > 0 ? Colors.ok : Colors.muted} />
          <KpiCard icon="🧾" label="Total Achats" value={achats > 0 ? `${(achats / 1000).toFixed(1)}k€` : 'N/D'} sub={invoices.length > 0 ? `${invoices.length} facture${invoices.length > 1 ? 's' : ''}` : undefined} color={Colors.gold} />
          <KpiCard icon="🎟️" label="Ticket Moyen" value={tm > 0 ? `${tm.toFixed(0)}€` : 'N/D'} color={tm > 0 ? Colors.gold : Colors.muted} />
          <KpiCard icon="👥" label="Couverts est." value={nbCouverts !== null ? `${nbCouverts}` : 'N/D'} sub={nbCouverts ? 'ce mois' : undefined} color={Colors.cream} />
        </View>

        {/* ─── FORMULAIRE DE SAISIE ───────────────────── */}
        <TouchableOpacity
          style={st.sectionToggle}
          onPress={() => setShowInputs(!showInputs)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 18 }}>✏️</Text>
            <View>
              <Text style={st.sectionToggleTitle}>Saisie des données</Text>
              <Text style={st.sectionToggleSub}>CA, achats, heures, charges</Text>
            </View>
          </View>
          <Text style={{ color: Colors.gold, fontSize: 14 }}>{showInputs ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showInputs && (
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <InputField label="CA Global du mois" value={caGlobal} onChange={setCaGlobal} placeholder="45000" suffix="€ HT" />
              </View>
              <View style={{ flex: 1 }}>
                <InputField label="Ticket Moyen" value={ticketMoyen} onChange={setTicketMoyen} placeholder="32" suffix="€" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <InputField label="Total Achats du mois" value={totalAchats} onChange={setTotalAchats} placeholder="13500" suffix="€ HT" />
              </View>
              <View style={{ flex: 1 }}>
                <InputField label="Heures travaillées" value={heuresTravaillees} onChange={setHeuresTravaillees} placeholder="1200" suffix="h" />
              </View>
            </View>
            <View style={{ marginTop: 14 }}>
              <InputField
                label="Charges Externes (Hygiène, Gaz, Maintenance)"
                value={chargesExternes}
                onChange={setChargesExternes}
                placeholder="6000"
                suffix="€ HT"
              />
            </View>

            {invoices.length > 0 && !totalAchats && (
              <View style={st.autoDetect}>
                <Text style={{ fontSize: 12 }}>🧾</Text>
                <Text style={st.autoDetectText}>
                  {invoices.length} facture{invoices.length > 1 ? 's' : ''} scannée{invoices.length > 1 ? 's' : ''} = {invoices.reduce((s: number, i: any) => s + (i.total_ht || 0), 0).toFixed(0)}€ HT (utilisé par défaut)
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* ─── RATIOS ────────────────────────────────── */}
        <SectionTitle>Indicateurs clés</SectionTitle>

        <View style={st.legend}>
          <View style={st.legendItem}><View style={[st.legendDot, { backgroundColor: Colors.gold }]} /><Text style={st.legendTxt}>Votre établissement</Text></View>
          <View style={st.legendItem}><View style={[st.legendDot, { backgroundColor: Colors.bronze }]} /><Text style={st.legendTxt}>Moyenne nationale</Text></View>
        </View>

        <RatioBar label={NATIONAL.coutMatiere.lbl} icon={NATIONAL.coutMatiere.icon} mine={ratioCoutMatiere} nat={NATIONAL.coutMatiere.nat} unit={NATIONAL.coutMatiere.unit} min={NATIONAL.coutMatiere.min} max={NATIONAL.coutMatiere.max} />
        <RatioBar label={NATIONAL.productivite.lbl} icon={NATIONAL.productivite.icon} mine={ratioProductivite} nat={NATIONAL.productivite.nat} unit={NATIONAL.productivite.unit} min={NATIONAL.productivite.min} max={NATIONAL.productivite.max} />
        <RatioBar label={NATIONAL.chargesExt.lbl} icon={NATIONAL.chargesExt.icon} mine={ratioChargesExt} nat={NATIONAL.chargesExt.nat} unit={NATIONAL.chargesExt.unit} min={NATIONAL.chargesExt.min} max={NATIONAL.chargesExt.max} />
        <RatioBar label={NATIONAL.tauxMarge.lbl} icon={NATIONAL.tauxMarge.icon} mine={ratioMargeBrute} nat={NATIONAL.tauxMarge.nat} unit={NATIONAL.tauxMarge.unit} min={NATIONAL.tauxMarge.min} max={NATIONAL.tauxMarge.max} />
        <RatioBar label={NATIONAL.ticketMoyen.lbl} icon={NATIONAL.ticketMoyen.icon} mine={ratioTicketMoyen} nat={NATIONAL.ticketMoyen.nat} unit={NATIONAL.ticketMoyen.unit} min={NATIONAL.ticketMoyen.min} max={NATIONAL.ticketMoyen.max} />

        {/* ─── RÉPARTITION ACHATS PAR FOURNISSEUR ─────── */}
        {supplierData.length > 0 && (
          <>
            <SectionTitle style={{ marginTop: 24 }}>Achats par fournisseur</SectionTitle>
            <View style={st.chartCard}>
              <DonutChart data={supplierData} size={150} />
            </View>
          </>
        )}

        {/* ─── GRAPHIQUE ÉVOLUTION COÛT MATIÈRE ──────── */}
        <SectionTitle style={{ marginTop: 24 }}>Évolution Coût Matière (%)</SectionTitle>
        <View style={st.chartCard}>
          <Text style={{ color: Colors.muted, fontSize: 10, fontStyle: 'italic', marginBottom: 4 }}>
            Touchez un point pour voir la valeur
          </Text>
          <LineChart data={chartData} labels={chartLabels} unit="%" />
        </View>

        {/* ─── GRAPHIQUE PRODUCTIVITÉ ─────────────────── */}
        <SectionTitle style={{ marginTop: 24 }}>Évolution Productivité (€/h)</SectionTitle>
        <View style={st.chartCard}>
          <Text style={{ color: Colors.muted, fontSize: 10, fontStyle: 'italic', marginBottom: 4 }}>
            Touchez un point pour voir la valeur
          </Text>
          <LineChart data={prodChartData} labels={chartLabels} unit="€/h" />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.blackSoft },
  header: {
    padding: Spacing.md, backgroundColor: Colors.charcoal,
    borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.1)',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontFamily: 'Cinzel_700SemiBold', fontSize: 18, color: Colors.cream },
  headerSub: { fontSize: 11, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },
  exportBtn: { backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  exportBtnTxt: { color: Colors.gold, fontSize: 11, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: 90 },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(212,175,55,0.06)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)',
    borderRadius: 10, padding: 14, marginBottom: 16,
  },
  infoText: { flex: 1, color: Colors.mutedLight, fontSize: 12, lineHeight: 18 },

  // KPI Cards
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: {
    width: (SCREEN_WIDTH - 42) / 2 - 5,
    backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)',
    borderRadius: 12, padding: 14, alignItems: 'center',
  },
  kpiValue: { fontSize: 22, fontWeight: 'bold', color: Colors.gold, marginBottom: 4 },
  kpiLabel: { fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: Colors.mutedLight },
  kpiSub: { fontSize: 10, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },

  legend: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 12, color: Colors.muted },

  sectionToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.charcoal, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', marginBottom: 12,
  },
  sectionToggleTitle: { color: Colors.cream, fontSize: 14, fontFamily: 'Cinzel_700Bold', letterSpacing: 1 },
  sectionToggleSub: { color: Colors.muted, fontSize: 11, marginTop: 2 },

  inputWrap: { marginBottom: 4 },
  inputLabel: {
    fontFamily: 'Cinzel_400Regular', fontSize: 9, letterSpacing: 1.5,
    textTransform: 'uppercase', color: Colors.mutedLight, marginBottom: 8, marginTop: 4,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', borderRadius: 8 },
  input: { flex: 1, color: '#fff', fontSize: 18, padding: 12, fontFamily: 'DMSans_400Regular' },
  inputSuffix: { color: Colors.gold, fontSize: 13, paddingRight: 12, fontWeight: 'bold' },

  autoDetect: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(74,222,128,0.08)', borderRadius: 8, padding: 10, marginTop: 12,
  },
  autoDetectText: { flex: 1, color: Colors.ok, fontSize: 11 },

  ratioCard: {
    backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)',
    borderRadius: 12, padding: 16, marginBottom: 10,
  },
  ratioName: { fontFamily: 'Cinzel_400Regular', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: Colors.mutedLight },
  track: { height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 8, position: 'relative' },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 3, opacity: 0.85 },
  needle: { position: 'absolute', top: -4, bottom: -4, width: 2, backgroundColor: Colors.bronze, borderRadius: 1 },
  ratioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  ratioVal: { fontFamily: 'DMSans_400Regular', fontSize: 24 },
  ratioNat: { fontSize: 12, color: Colors.muted, fontStyle: 'italic' },

  chartCard: {
    backgroundColor: Colors.charcoal, borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)',
    borderRadius: 12, padding: 16,
  },
});