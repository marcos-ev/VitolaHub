import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { LoadingState } from '../../src/components/LoadingState';
import { EmptyState } from '../../src/components/EmptyState';
import { theme } from '../../src/theme';
import { ChatConversationSummary, useConversationsQuery } from '../../src/api/hooks/use-chat';

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// Lista de conversas com charutarias (Fase 3). Ponto de entrada a partir de
// outra tela (decisão documentada no resumo final): um ícone de balão no
// cabeçalho de `app/(tabs)/shops.tsx`, já que a spec pede poucas abas e o
// chat não deve virar uma 6ª aba fixa.
export default function ChatListScreen() {
  const conversationsQuery = useConversationsQuery();

  const conversations = useMemo(() => {
    const items = conversationsQuery.data ?? [];
    return [...items].sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [conversationsQuery.data]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Conversas" />

      {conversationsQuery.isLoading ? (
        <LoadingState label="Carregando conversas..." />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <ConversationRow conversation={item} />}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              message={
                conversationsQuery.isError
                  ? 'Não foi possível carregar suas conversas agora.'
                  : 'Você ainda não iniciou nenhuma conversa. Toque em "Conversar" na ficha de uma charutaria.'
              }
            />
          }
        />
      )}
    </Screen>
  );
}

function ConversationRow({ conversation }: { conversation: ChatConversationSummary }) {
  const unread = conversation.unreadCount > 0;
  return (
    <Pressable
      style={styles.row}
      onPress={() =>
        router.push({
          pathname: '/chat/[conversationId]',
          params: { conversationId: conversation.id, shopName: conversation.shop?.tradeName ?? '' },
        })
      }
    >
      <View style={styles.iconWrapper}>
        <Ionicons name="storefront-outline" size={20} color={theme.colors.gold} />
      </View>
      <View style={styles.texts}>
        <ThemedText variant="body" numberOfLines={1}>
          {conversation.shop?.tradeName ?? 'Charutaria'}
        </ThemedText>
        <ThemedText variant="caption" numberOfLines={1} color={unread ? 'textPrimary' : 'textSecondary'}>
          {conversation.lastMessage?.body ?? 'Conversa iniciada'}
        </ThemedText>
      </View>
      <View style={styles.rightColumn}>
        <ThemedText variant="caption">{timeAgo(conversation.lastMessageAt)}</ThemedText>
        {unread ? <View style={styles.unreadDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, marginLeft: theme.spacing.sm },
  rightColumn: { alignItems: 'flex-end', marginLeft: theme.spacing.sm },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.gold, marginTop: 4 },
});
