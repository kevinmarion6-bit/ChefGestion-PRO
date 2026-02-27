import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';

const C = { 
  charcoal: '#1A1A1A', 
  gold: '#D4AF37', 
  muted: '#6B6050' 
};

function TabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  return (
    <View style={{ 
      alignItems: 'center', 
      justifyContent: 'flex-start',
      width: 60,
      height: 52,
      paddingTop: 8, // ← était 4, on descend un peu
    }}>
      <Text style={{ fontSize: 24, lineHeight: 28 }}>{icon}</Text>
      <Text 
        numberOfLines={1}
        ellipsizeMode="clip"
        style={{ 
          fontFamily: focused ? 'Cinzel_700Bold' : 'Cinzel_400Regular',
          fontSize: 10, // ← était 9
          letterSpacing: 0.5, 
          textTransform: 'uppercase', 
          color: focused ? C.gold : C.muted,
          fontWeight: focused ? '800' : '600', // ← plus gras
          textAlign: 'center',
          width: 60,
          marginTop: 6, // espacement inchangé
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ 
        headerShown: false, 
        tabBarStyle: { 
          backgroundColor: C.charcoal, 
          borderTopWidth: 1, 
          borderTopColor: 'rgba(212,175,55,0.15)', 
          height: Platform.OS === 'ios' ? 85 : 80,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          elevation: 0,
        }, 
        tabBarItemStyle: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          padding: 0,
          overflow: 'visible',
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index"   options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏛️"  label="Accueil" focused={focused} /> }} />
      <Tabs.Screen name="scanner" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👁️‍🗨️" label="Scanner" focused={focused} /> }} />
      <Tabs.Screen name="ratios"  options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📊"  label="Ratios"  focused={focused} /> }} />
      <Tabs.Screen name="tools"   options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🛠️"  label="Outils"  focused={focused} /> }} />
      <Tabs.Screen name="haccp"   options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🧪"  label="HACCP"   focused={focused} /> }} />
      <Tabs.Screen name="more"    options={{ tabBarIcon: ({ focused }) => <TabIcon icon="⚙️"  label="Plus"    focused={focused} /> }} />
    </Tabs>
  );
}