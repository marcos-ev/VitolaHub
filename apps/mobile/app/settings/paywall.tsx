import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { theme } from '../../src/theme';
import { useEntitlements } from '../../src/api/hooks/use-entitlements';

type Plan = 'yearly' | 'monthly';

const FEATURES = [
  'Umidor ilimitado',
  'Estatísticas do seu paladar',
  'Identificar charuto pela foto',
  'Histórico completo e exportação',
  'Filtros avançados na busca',
] as const;

function trialDaysLeft(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default function PaywallScreen() {
  const entitlements = useEntitlements();
  const [plan, setPlan] = useState<Plan>('yearly');

  const subtitle = useMemo(() => {
    const data = entitlements.data;
    if (data?.isPremium && !data.isTrial) return 'Você já tem acesso Premium ativo.';
    const days = trialDaysLeft(data?.trialEndsAt);
    if (data?.isTrial && days !== null) {
      return days === 0
        ? 'Seu período de teste termina hoje.'
        : `Você está no período de teste. Faltam ${days} dia${days === 1 ? '' : 's'}.`;
    }
    return 'Desbloqueie o Vitola Hub completo.';
  }, [entitlements.data]);

  const handleSubscribe = () => {
    Alert.alert(
      'Em breve',
      'Pagamentos (cartão, Apple Pay, Google Pay e PIX) chegam na próxima fase. No trial/admin o Premium já está liberado.',
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Premium" />

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} />
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Fechar">
            <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        <ThemedText variant="display" style={styles.title}>
          Vitola Hub Premium
        </ThemedText>
        <ThemedText variant="body" color="textSecondary" style={styles.subtitle}>
          {subtitle}
        </ThemedText>

        <View style={styles.features}>
          {FEATURES.map((label) => (
            <View key={label} style={styles.featureRow}>
              <View style={styles.check}>
                <Ionicons name="checkmark" size={14} color={theme.colors.background} />
              </View>
              <ThemedText variant="body" style={styles.featureLabel}>
                {label}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.plans}>
          <Pressable
            style={[styles.plan, plan === 'yearly' && styles.planSelected]}
            onPress={() => setPlan('yearly')}
          >
            <ThemedText variant="caption" color="gold" style={styles.planKind}>
              ANUAL
            </ThemedText>
            <ThemedText variant="title" style={styles.planPrice}>
              R$79
            </ThemedText>
            <ThemedText variant="caption" color="textTertiary">
              R$6,58 por mês
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.plan, plan === 'monthly' && styles.planSelected]}
            onPress={() => setPlan('monthly')}
          >
            <ThemedText variant="caption" color="gold" style={styles.planKind}>
              MENSAL
            </ThemedText>
            <ThemedText variant="title" style={styles.planPrice}>
              R$9,90
            </ThemedText>
            <ThemedText variant="caption" color="textTertiary">
              por mês
            </ThemedText>
          </Pressable>
        </View>

        <PrimaryButton title="ASSINAR" onPress={handleSubscribe} style={styles.subscribe} />
        <ThemedText variant="caption" color="textTertiary" style={styles.footer}>
          Cartão, Apple Pay, Google Pay ou PIX. Cancele quando quiser.
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.goldMuted,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  logo: { width: 40, height: 40, borderRadius: 20 },
  title: { fontSize: 26 },
  subtitle: { marginTop: theme.spacing.xs, marginBottom: theme.spacing.lg },
  features: { gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  featureRow: { flexDirection: 'row', alignItems: 'center' },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  featureLabel: { flex: 1 },
  plans: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  plan: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceElevated,
  },
  planSelected: { borderColor: theme.colors.gold },
  planKind: { fontFamily: theme.fonts.bodySemiBold, letterSpacing: 1 },
  planPrice: { marginVertical: 4 },
  subscribe: { marginTop: theme.spacing.xs },
  footer: { textAlign: 'center', marginTop: theme.spacing.md },
});
