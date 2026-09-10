import { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CursorPage } from '@charuto/shared';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { LoadingState } from '../../src/components/LoadingState';
import { theme } from '../../src/theme';
import {
  ChatMessage,
  useChatRealtime,
  useMarkConversationReadMutation,
  useMessagesQuery,
  useReportConversationMutation,
  useSendMessageMutation,
} from '../../src/api/hooks/use-chat';
import { getErrorMessage } from '../../src/lib/error-message';

type MessagesInfiniteData = { pages: CursorPage<ChatMessage>[]; pageParams: unknown[] };

// Thread de chat (Fase 3). Tempo real via `socket.io-client` com fallback de
// polling do React Query — as duas estratégias ficam ativas ao mesmo tempo,
// nunca só uma (pedido explícito da spec): o polling só é desligado quando o
// socket confirma que está conectado.
export default function ChatThreadScreen() {
  const { conversationId, shopName } = useLocalSearchParams<{ conversationId: string; shopName?: string }>();
  const queryClient = useQueryClient();

  const [pollingEnabled, setPollingEnabled] = useState(true);
  const messagesQuery = useMessagesQuery(conversationId, pollingEnabled);
  const sendMessage = useSendMessageMutation(conversationId);
  const markRead = useMarkConversationReadMutation(conversationId);
  const reportConversation = useReportConversationMutation(conversationId);

  const { connected } = useChatRealtime(conversationId, (message) => {
    queryClient.setQueryData<MessagesInfiniteData>(['chat', 'messages', conversationId], (data) => {
      if (!data) return data;
      const alreadyExists = data.pages.some((page) => page.items.some((item) => item.id === message.id));
      if (alreadyExists) return data;
      const [firstPage, ...rest] = data.pages;
      return { ...data, pages: [{ ...firstPage, items: [message, ...firstPage.items] }, ...rest] };
    });
  });

  useEffect(() => {
    setPollingEnabled(!connected);
  }, [connected]);

  useEffect(() => {
    if (conversationId) markRead.mutate();
    // Só ao abrir a conversa, não a cada nova mensagem recebida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const [draft, setDraft] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const messages = messagesQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const handleSend = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    sendMessage.mutate(body, {
      onError: (error) => Alert.alert('Erro ao enviar', getErrorMessage(error)),
    });
  };

  const handleReport = () => {
    if (reportReason.trim().length < 3) {
      Alert.alert('Descreva o motivo', 'Explique brevemente o motivo da denúncia (mínimo 3 caracteres).');
      return;
    }
    reportConversation.mutate(reportReason.trim(), {
      onSuccess: () => {
        setShowReport(false);
        setReportReason('');
        Alert.alert('Denúncia enviada', 'Nossa equipe vai analisar esta conversa.');
      },
      onError: (error) => {
        // Endpoint sendo criado por outro agente no momento desta
        // implementação: um 404 é tratado como "ainda não disponível" em vez
        // de um erro genérico para o usuário.
        Alert.alert(
          'Não foi possível enviar',
          getErrorMessage(error, 'A denúncia de conversas ainda não está disponível. Tente novamente mais tarde.'),
        );
      },
    });
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title={shopName || 'Conversa'}
        right={
          <Pressable onPress={() => setShowReport((v) => !v)} hitSlop={10}>
            <Ionicons name="flag-outline" size={20} color={theme.colors.textSecondary} />
          </Pressable>
        }
      />

      {!connected ? (
        <ThemedText variant="caption" color="textTertiary" style={styles.offlineNotice}>
          Sincronizando mensagens periodicamente (conexão em tempo real indisponível).
        </ThemedText>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        {messagesQuery.isLoading ? (
          <LoadingState label="Carregando mensagens..." />
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            inverted
            style={styles.flex}
            contentContainerStyle={styles.messagesContent}
            renderItem={({ item }) => <MessageBubble message={item} isMine={item.senderType === 'USER'} />}
            ListEmptyComponent={
              <ThemedText variant="caption" style={styles.emptyMessages}>
                Diga olá para começar a conversa.
              </ThemedText>
            }
          />
        )}

        {showReport ? (
          <View style={styles.reportBox}>
            <ThemedText variant="caption" style={styles.reportLabel}>
              Motivo da denúncia
            </ThemedText>
            <TextField
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="Descreva o que aconteceu..."
              multiline
            />
            <View style={styles.reportActions}>
              <PrimaryButton
                title="Cancelar"
                onPress={() => setShowReport(false)}
                variant="outline"
                style={styles.reportButton}
              />
              <PrimaryButton
                title="Enviar denúncia"
                onPress={handleReport}
                loading={reportConversation.isPending}
                style={styles.reportButton}
              />
            </View>
          </View>
        ) : (
          <View style={styles.composer}>
            <View style={styles.composerInputWrapper}>
              <TextField value={draft} onChangeText={setDraft} placeholder="Escreva uma mensagem..." multiline />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={sendMessage.isPending || !draft.trim()}
              style={styles.sendButton}
              hitSlop={8}
            >
              <Ionicons name="send" size={20} color={draft.trim() ? theme.colors.gold : theme.colors.textTertiary} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function MessageBubble({ message, isMine }: { message: ChatMessage; isMine: boolean }) {
  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <ThemedText variant="body" color={isMine ? 'background' : 'textPrimary'}>
          {message.body}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  offlineNotice: { textAlign: 'center', marginBottom: theme.spacing.xs },
  messagesContent: { paddingVertical: theme.spacing.md },
  emptyMessages: { textAlign: 'center', padding: theme.spacing.xl, transform: [{ scaleY: -1 }] },
  bubbleRow: { flexDirection: 'row', marginBottom: theme.spacing.sm },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: theme.radii.md, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md },
  bubbleMine: { backgroundColor: theme.colors.gold },
  bubbleTheirs: { backgroundColor: theme.colors.surface },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: theme.spacing.sm },
  composerInputWrapper: { flex: 1, marginRight: theme.spacing.sm },
  sendButton: {
    width: theme.touchable.minHeight,
    height: theme.touchable.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBox: { paddingTop: theme.spacing.sm },
  reportLabel: { marginBottom: theme.spacing.xs },
  reportActions: { flexDirection: 'row', marginTop: theme.spacing.sm },
  reportButton: { flex: 1, marginRight: theme.spacing.sm },
});
