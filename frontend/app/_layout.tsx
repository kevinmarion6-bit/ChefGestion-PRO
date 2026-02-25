import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { View, ActivityIndicator } from 'react-native';
import { AppProvider, useApp } from '@/lib/context';

import { 
  useFonts, 
  Cinzel_400Regular, 
  Cinzel_700Bold 
} from '@expo-google-fonts/cinzel';
import { 
  DMSans_400Regular, 
  DMSans_700Bold 
} from '@expo-google-fonts/dm-sans';

SplashScreen.preventAutoHideAsync();

// 1. On crée un composant de navigation séparé pour accéder au contexte useApp
function NavigationGuard() {
  const { user, isLoading } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return; // On attend que la lecture du storage soit finie

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Pas de session -> direction Login
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Session trouvée alors qu'on est sur le Login -> direction Scanner
      router.replace('/(tabs)/scanner');
    }
  }, [user, isLoading, segments]);

  // Si on charge encore la session, on peut laisser le Splash ou mettre un spinner
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ 
      headerShown: false, 
      animation: 'fade', 
      contentStyle: { backgroundColor: '#000000' } 
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

// 2. Le Layout principal reste propre
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cinzel_400Regular,
    Cinzel_700Bold,
    DMSans_400Regular,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <AppProvider>
      <StatusBar style="light" backgroundColor="#000000" />
      <NavigationGuard />
    </AppProvider>
  );
}