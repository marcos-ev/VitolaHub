import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { StarRating } from '../../src/components/StarRating';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Avatar } from '../../src/components/Avatar';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { theme } from '../../src/theme';
import { useCreateShopReviewMutation, useShopDetailQuery } from '../../src/api/hooks/use-shops';
import { useOpenConversationMutation } from '../../src/api/hooks/use-chat';
import { getErrorMessage } from '../../src/lib/error-message';

// Ficha da charutaria (Fase 3). O destaque é o botão "Conversar" — a spec
// proíbe explicitamente um link de WhatsApp, então ele sempre abre/cria uma
// conversa no chat interno (`POST /chat/conversations`) e navega para a
// thread. Fotos da loja não existem no schema atual (ver limitação
// documentada em `use-shops.ts`), então a ficha não tem galeria.
export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shopQuery = useShopDetailQuery(id);
  const openConversation = useOpenConversationMutation();

  const [reviewRating, setReviewRating] = useState(0);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const createReview = useCreateShopReviewMutation(id);

  const handleOpenChat = async () => {
    if (!id) return;
    try {
      const conversation = await openConversation.mutateAsync(id);
      router.push({
        pathname: '/chat/[conversationId]',
        params: { conversationId: conversation.id, shopName: shopQuery.data?.tradeName ?? '' },
      });
    } catch (error) {
      Alert.alert('Erro ao abrir conversa', getErrorMessage(error));
    }
  };

  if (shopQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Charutaria" />
        <LoadingState label="Carregando charutaria..." />
      </Screen>
    );
  }

  if (shopQuery.isError || !shopQuery.data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Charutaria" />
        <ErrorState message={getErrorMessage(shopQuery.error)} onRetry={() => shopQuery.refetch()} />
      </Screen>
    );
  }

  const shop = shopQuery.data;
  const hours = normalizeHours(shop.hours);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={shop.tradeName} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <ThemedText variant="display" style={styles.name}>
            {shop.tradeName}
          </ThemedText>
          {shop.isVerified ? <Ionicons name="checkmark-circle" size={20} color={theme.colors.gold} /> : null}
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
          <ThemedText variant="caption" style={styles.metaText}>
            {shop.address}
          </ThemedText>
        </View>

        <View style={styles.ratingSection}>
          <ThemedText variant="display">{shop.ratingAvg.toFixed(1)}</ThemedText>
          <View style={styles.ratingHeaderTexts}>
            <StarRating rating={shop.ratingAvg} readOnly size={16} />
            <ThemedText variant="caption">{shop.ratingCount} avaliações</ThemedText>
          </View>
        </View>

        {hours ? (
          <View style={styles.section}>
            <ThemedText variant="title" style={styles.sectionTitle}>
              Horário de funcionamento
            </ThemedText>
            {hours.map(([day, value]) => (
              <View key={day} style={styles.hoursRow}>
                <ThemedText variant="caption">{day}</ThemedText>
                <ThemedText variant="caption">{value}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        <PrimaryButton
          title="Conversar"
          onPress={handleOpenChat}
          loading={openConversation.isPending}
          icon={<Ionicons name="chatbubbles-outline" size={18} color={theme.colors.background} />}
          style={styles.chatButton}
        />

        <View style={styles.divider} />

        <View style={styles.reviewsHeader}>
          <ThemedText variant="title">Avaliações</ThemedText>
          <ThemedText variant="caption" color="gold" onPress={() => setShowReviewForm((v) => !v)}>
            Avaliar
          </ThemedText>
        </View>

        {showReviewForm ? (
          <View style={styles.reviewForm}>
            <StarRating rating={reviewRating} onChange={setReviewRating} size={26} />
            <PrimaryButton
              title="Enviar avaliação"
              onPress={() => {
                if (reviewRating === 0) {
                  Alert.alert('Escolha uma nota', 'Toque nas estrelas para avaliar esta charutaria.');
                  return;
                }
                createReview.mutate(
                  { rating: reviewRating },
                  {
                    onSuccess: () => setShowReviewForm(false),
                    onError: (error) => Alert.alert('Erro', getErrorMessage(error)),
                  },
                );
              }}
              loading={createReview.isPending}
              style={styles.reviewSubmit}
            />
          </View>
        ) : null}

        {shop.recentReviews.length === 0 ? (
          <ThemedText variant="caption" style={styles.emptyReviews}>
            Nenhuma avaliação ainda.
          </ThemedText>
        ) : (
          shop.recentReviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Avatar uri={review.user?.avatarUrl} size={32} />
                <View style={styles.reviewHeaderTexts}>
                  <ThemedText variant="body">{review.user?.displayName ?? 'Usuário'}</ThemedText>
                  <StarRating rating={review.rating} readOnly size={13} />
                </View>
              </View>
              {review.body ? (
                <ThemedText variant="body" style={styles.reviewBody}>
                  {review.body}
                </ThemedText>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

// SUPOSIÇÃO: `hours` é um JSON livre sem formato documentado no schema
// (`Json?`). Tratamos como `Record<string,string>` (ex.: { "seg-sex":
// "09:00-19:00" }) quando possível; qualquer outro formato é simplesmente
// omitido em vez de quebrar a tela.
function normalizeHours(hours: unknown): [string, string][] | null {
  if (!hours || typeof hours !== 'object' || Array.isArray(hours)) return null;
  const entries = Object.entries(hours as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return entries.length > 0 ? entries : null;
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: theme.spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  name: { flexShrink: 1, marginRight: theme.spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.xs },
  metaText: { marginLeft: theme.spacing.xs, flexShrink: 1 },
  ratingSection: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.lg },
  ratingHeaderTexts: { marginLeft: theme.spacing.md },
  section: { marginTop: theme.spacing.lg },
  sectionTitle: { marginBottom: theme.spacing.sm },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xs },
  chatButton: { marginTop: theme.spacing.lg },
  divider: { height: 1, backgroundColor: theme.colors.divider, marginVertical: theme.spacing.lg },
  reviewsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewForm: { marginTop: theme.spacing.md },
  reviewSubmit: { marginTop: theme.spacing.md },
  emptyReviews: { textAlign: 'center', paddingVertical: theme.spacing.lg },
  reviewCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center' },
  reviewHeaderTexts: { marginLeft: theme.spacing.sm },
  reviewBody: { marginTop: theme.spacing.sm },
});
