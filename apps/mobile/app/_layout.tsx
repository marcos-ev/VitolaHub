import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import {
  useFonts,
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
} from '@expo-google-fonts/public-sans';
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { Stack } from 'expo-router';
import { theme } from '../src/theme';
import { queryClient } from '../src/api/query-client';
import { wakeApi } from '../src/api/client';
import { isDemoMode } from '../src/demo';
import { useAuthStore } from '../src/state/auth-store';
import { useInviteStore } from '../src/state/invite-store';
import { LoadingState } from '../src/components/LoadingState';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Extrai o código de um deep link de convite no formato `vitolahub://convite/{codigo}`
// (ver InvitesService.getMyInvite no backend, dono do formato). Guarda em
// `invite-store` (zustand, só em memória) para `app/(auth)/register.tsx` ler.
const INVITE_LINK_PATTERN = /:\/\/convite\/([^/?#]+)/i;

function extractInviteCode(url: string | null): string | null {
  if (!url) return null;
  const match = INVITE_LINK_PATTERN.exec(url);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const [ready, setReady] = useState(false);
  const [apiWaking, setApiWaking] = useState(() => !isDemoMode());

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Deep link de convite (`vitolahub://convite/{codigo}`): captura tanto o link
  // que abriu o app pela primeira vez quanto links recebidos com o app já em
  // execução, sem interferir na navegação do expo-router (não chamamos
  // `router.push` aqui, só guardamos o código para o formulário de cadastro).
  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        const code = extractInviteCode(url);
        if (code) useInviteStore.getState().setPendingCode(code);
      })
      .catch(() => undefined);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      const code = extractInviteCode(url);
      if (code) useInviteStore.getState().setPendingCode(code);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (fontsLoaded && isHydrated) {
      setReady(true);
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, isHydrated]);

  useEffect(() => {
    if (!ready || isDemoMode()) return;
    let cancelled = false;
    wakeApi().finally(() => {
      if (!cancelled) setApiWaking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          {apiWaking ? (
            <LoadingState label="Conectando… no plano gratuito o servidor pode levar até um minuto para acordar." />
          ) : (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.background },
                animation: 'fade',
              }}
            />
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
