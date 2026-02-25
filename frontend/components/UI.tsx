import React from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, ViewStyle, TextStyle,
} from 'react-native';
import { Colors, Spacing, Radius } from '@/constants/Theme';

// ─── GOLD LINE SEPARATOR ─────────────────────────────────
export function GoldLine({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.goldLine, style]}>
      <View style={styles.goldLineFade} />
      <View style={styles.goldLineDot} />
      <View style={[styles.goldLineFade, { transform: [{ scaleX: -1 }] }]} />
    </View>
  );
}

// ─── SECTION TITLE ───────────────────────────────────────
export function SectionTitle({ children, style }: { children: string; style?: ViewStyle }) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={styles.sectionText}>{children}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

// ─── CARD ────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardTopLine} />
      {children}
    </View>
  );
}

// ─── FIELD ───────────────────────────────────────────────
interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: any;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  multiline?: boolean;
  numberOfLines?: number;
}

export function Field({
  label, value, onChangeText, placeholder, secureTextEntry,
  keyboardType = 'default', autoCapitalize = 'none',
  autoComplete, style, inputStyle, multiline, numberOfLines,
}: FieldProps) {
  return (
    <View style={[styles.fieldWrap, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, inputStyle, multiline && { height: (numberOfLines || 3) * 24, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        multiline={multiline}
        numberOfLines={numberOfLines}
      />
    </View>
  );
}

// ─── BUTTON ──────────────────────────────────────────────
interface BtnProps {
  label: string;
  onPress: () => void;
  variant?: 'gold' | 'outline' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: string;
  size?: 'sm' | 'md';
}

export function Btn({ label, onPress, variant = 'gold', loading, disabled, style, icon, size = 'md' }: BtnProps) {
  const s = styles;
  const btnStyle = variant === 'gold' ? s.btnGold :
    variant === 'outline' ? s.btnOutline :
    variant === 'ghost' ? s.btnGhost :
    s.btnDanger;
  const txtStyle = variant === 'gold' ? s.btnTxtGold : s.btnTxtOutline;

  return (
    <TouchableOpacity
      style={[s.btn, btnStyle, size === 'sm' && s.btnSm, (disabled || loading) && s.btnDisabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'gold' ? Colors.black : Colors.gold} size="small" />
      ) : (
        <Text style={[s.btnTxt, txtStyle, size === 'sm' && s.btnTxtSm]}>
          {icon ? `${icon}  ` : ''}{label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── PILL ────────────────────────────────────────────────
export function Pill({ label, type = 'gold' }: { label: string; type?: 'ok' | 'warn' | 'bad' | 'gold' }) {
  const colors = {
    ok:   { bg: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.3)',  text: Colors.ok },
    warn: { bg: 'rgba(250,204,21,0.15)',  border: 'rgba(250,204,21,0.3)',  text: Colors.warn },
    bad:  { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.3)', text: Colors.bad },
    gold: { bg: 'rgba(212,175,55,0.12)',  border: 'rgba(212,175,55,0.25)', text: Colors.gold },
  };
  const c = colors[type];
  return (
    <View style={{ backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontFamily: 'Cinzel_400Regular', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: c.text }}>{label}</Text>
    </View>
  );
}

// ─── KPI CARD ────────────────────────────────────────────
export function KpiCard({ icon, label, value, hint }: { icon: string; label: string; value: string; hint?: string }) {
  return (
    <View style={styles.kpi}>
      <View style={styles.kpiTopLine} />
      <Text style={styles.kpiIcon}>{icon}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {hint && <Text style={styles.kpiHint}>{hint}</Text>}
    </View>
  );
}

// ─── LIST ITEM ───────────────────────────────────────────
export function ListItem({
  icon, title, subtitle, right, onPress, chevron = true,
}: {
  icon?: string; title: string; subtitle?: string; right?: React.ReactNode;
  onPress?: () => void; chevron?: boolean;
}) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap style={styles.listItem} onPress={onPress} activeOpacity={0.7}>
      {icon && <Text style={styles.listIcon}>{icon}</Text>}
      <View style={styles.listBody}>
        <Text style={styles.listTitle}>{title}</Text>
        {subtitle && <Text style={styles.listSub}>{subtitle}</Text>}
      </View>
      {right || (chevron && onPress && <Text style={styles.listChevron}>›</Text>)}
    </Wrap>
  );
}

// ─── EMPTY STATE ─────────────────────────────────────────
export function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────
const styles = StyleSheet.create({
  goldLine: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  goldLineFade: { flex: 1, height: 1, backgroundColor: Colors.gold, opacity: 0.4 },
  goldLineDot: { width: 6, height: 6, backgroundColor: Colors.gold, transform: [{ rotate: '45deg' }], marginHorizontal: 8 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 24 },
  sectionText: { fontFamily: 'Cinzel_400Regular', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: Colors.gold, marginRight: 10 },
  sectionLine: { flex: 1, height: 1, backgroundColor: Colors.gold, opacity: 0.3 },

  card: {
    backgroundColor: Colors.charcoal, borderRadius: Radius.md,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)',
    overflow: 'hidden', marginBottom: 12,
  },
  cardTopLine: { height: 1, backgroundColor: Colors.gold, opacity: 0.35, marginHorizontal: 20 },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontFamily: 'Cinzel_400Regular', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: Colors.mutedLight, marginBottom: 7 },
  fieldInput: {
    backgroundColor: Colors.blackMid, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: Radius.sm, padding: 13, color: Colors.cream, fontSize: 16,
  },

  btn: { borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btnGold: { backgroundColor: Colors.gold, padding: 15 },
  btnOutline: { borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', padding: 13 },
  btnGhost: { backgroundColor: 'rgba(212,175,55,0.1)', padding: 13 },
  btnDanger: { backgroundColor: 'rgba(192,64,64,0.15)', borderWidth: 1, borderColor: 'rgba(192,64,64,0.3)', padding: 13 },
  btnSm: { padding: 9, paddingHorizontal: 16 },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { fontFamily: 'Cinzel_700SemiBold', letterSpacing: 2, textTransform: 'uppercase' },
  btnTxtSm: { fontSize: 9 },
  btnTxtGold: { color: Colors.black, fontSize: 11 },
  btnTxtOutline: { color: Colors.gold, fontSize: 10 },

  kpi: { flex: 1, backgroundColor: Colors.charcoal, borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', padding: 14, overflow: 'hidden' },
  kpiTopLine: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, backgroundColor: Colors.gold },
  kpiIcon: { fontSize: 20, marginBottom: 6 },
  kpiLabel: { fontFamily: 'Cinzel_400Regular', fontSize: 7, letterSpacing: 1.5, textTransform: 'uppercase', color: Colors.mutedLight, marginBottom: 4 },
  kpiValue: { fontFamily: 'DMSans_400Regular', fontSize: 22, color: Colors.gold, lineHeight: 26 },
  kpiHint: { fontSize: 11, color: Colors.muted, fontStyle: 'italic', marginTop: 3 },

  listItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  listIcon: { fontSize: 22, marginRight: 12 },
  listBody: { flex: 1 },
  listTitle: { fontSize: 15, color: Colors.cream },
  listSub: { fontSize: 12, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },
  listChevron: { fontSize: 22, color: Colors.muted },

  empty: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyIcon: { fontSize: 36, opacity: 0.5 },
  emptyText: { fontSize: 14, color: Colors.muted, fontStyle: 'italic', textAlign: 'center' },
});
