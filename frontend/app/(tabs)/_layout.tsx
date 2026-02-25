import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
const C = { charcoal: '#1A1A1A', gold: '#D4AF37', muted: '#6B6050' };
function TabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 10, gap: 3 }}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={{ fontFamily: 'Cinzel_400Regular', fontSize: 7, letterSpacing: 0.5, textTransform: 'uppercase', color: focused ? C.gold : C.muted }}>{label}</Text>
    </View>
  );
}
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: C.charcoal, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)', height: 70 }, tabBarShowLabel: false }}>
      <Tabs.Screen name="index"   options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label="Accueil"  focused={focused} /> }} />
      <Tabs.Screen name="scanner" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📷" label="Scanner"  focused={focused} /> }} />
      <Tabs.Screen name="ratios"  options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📊" label="Ratios"   focused={focused} /> }} />
      <Tabs.Screen name="tools"   options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🔧" label="Outils"   focused={focused} /> }} />
      <Tabs.Screen name="more"    options={{ tabBarIcon: ({ focused }) => <TabIcon icon="⋯"  label="Plus"     focused={focused} /> }} />
    </Tabs>
  );
}
