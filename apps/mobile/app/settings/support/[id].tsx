import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../../src/components/Screen';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { ThemedText } from '../../../src/components/ThemedText';
import { TextField } from '../../../src/components/TextField';
import { LoadingState } from '../../../src/components/LoadingState';
import { ErrorState } from '../../../src/components/ErrorState';
import { theme } from '../../../src/theme';
import {
  SupportMessage,
  SupportTicketStatus,
  useAddSupportMessageMutation,
  useSupportFeedbackMutation,
  useSupportTicketQuery,
} from '../../../src/api/hooks/use-support';
import { getErrorMessage } from '../../../src/lib/error-message';

const STATUS_META: Record<
  SupportTicketStatus,
  { label: string; color: string; border: string; bg?: string }
> = {
  OPEN: { label: 'Aberto', color: theme.colors.gold, border: theme.colors.goldMuted },
  IN_PROGRESS: { label: 'Em análise', color: '#E0A060', border: '#8A5A30' },
  RESOLVED: { label: 'Resolvido', color: '#6BCF8E', border: '#2E7D4F', bg: 'rgba(46,125,79,0.18)' },
  CLOSED: { label: 'Fechado', color: theme.colors.textTertiary, border: theme.colors.divider },
};

const CATEGORY_LABEL: Record<string, string> = {
  TECHNICAL: 'Problema técnico',
  SUGGESTION: 'Sugestão',
  COMPLAINT: 'Reclamação',
  OTHER: 'Outro',
};

function formatOpenedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

export default function SupportTicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketQuery = useSupportTicketQuery(id);
  const sendMessage = useAddSupportMessageMutation(id!);
  const feedback = useSupportFeedbackMutation(id!);
  const [draft, setDraft] = useState('');

  const messages = useMemo(() => ticketQuery.data?.messages ?? [], [ticketQuery.data]);

  const handleSend = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    sendMessage.mutate(body, {
      onError: (error) => Alert.alert('Erro', getErrorMessage(error, 'Não foi possível enviar.')),
    });
  };

  if (ticketQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Chamado" />
        <LoadingState label="Carregando chamado..." />
      </Screen>
    );
  }

  if (ticketQuery.isError || !ticketQuery.data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Chamado" />
        <ErrorState message={getErrorMessage(ticketQuery.error)} onRetry={() => ticketQuery.refetch()} />
      </Screen>
    );
  }

  const ticket = ticketQuery.data;
  const status = STATUS_META[ticket.status];
  const resolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
  const canReply = ticket.status !== 'CLOSED';

  const renderMessage = ({ item }: { item: SupportMessage }) => {
    const mine = item.authorType === 'USER';
    return (
      <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapStaff]}>
        <ThemedText variant="caption" color="textTertiary" style={styles.authorLabel}>
          {item.authorLabel}
        </ThemedText>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleStaff]}>
          {/* Camada clara para simular o gradiente dourado do mockup (sem dependência extra). */}
          {mine ? <View style={styles.bubbleMineSheen} pointerEvents="none" /> : null}
          <ThemedText variant="body" style={mine ? styles.bubbleTextMine : styles.bubbleTextStaff}>
            {item.body}
          </ThemedText>
        </View>
      </View>
    );
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.codeRow}>
        <ThemedText variant="caption" color="gold" style={styles.code}>
          {ticket.code}
        </ThemedText>
        <View
          style={[
            styles.statusPill,
            { borderColor: status.border, backgroundColor: status.bg ?? 'transparent' },
          ]}
        >
          <ThemedText variant="caption" style={[styles.statusText, { color: status.color }]}>
            {status.label}
          </ThemedText>
        </View>
      </View>
      <ThemedText variant="title" style={styles.subject}>
        {ticket.subject}
      </ThemedText>
      <View style={styles.metaPill}>
        <ThemedText variant="caption" color="textTertiary">
          {CATEGORY_LABEL[ticket.category] ?? ticket.category} · aberto em {formatOpenedAt(ticket.createdAt)}
        </ThemedText>
      </View>
    </View>
  );

  const listFooter =
    resolved && ticket.helpful == null ? (
      <View style={styles.feedbackCard}>
        <ThemedText variant="body" style={styles.feedbackTitle}>
          Este chamado foi resolvido
        </ThemedText>
        <ThemedText variant="caption" color="textSecondary" style={styles.feedbackHint}>
          O atendimento ajudou?
        </ThemedText>
        <View style={styles.feedbackRow}>
          <Pressable
            style={styles.feedbackBtn}
            onPress={() =>
              feedback.mutate(true, {
                onError: (error) => Alert.alert('Erro', getErrorMessage(error)),
              })
            }
          >
            <ThemedText variant="body" style={styles.feedbackBtnText}>
              Sim
            </ThemedText>
          </Pressable>
          <Pressable
            style={styles.feedbackBtn}
            onPress={() =>
              feedback.mutate(false, {
                onError: (error) => Alert.alert('Erro', getErrorMessage(error)),
              })
            }
          >
            <ThemedText variant="body" style={styles.feedbackBtnText}>
              Não
            </ThemedText>
          </Pressable>
        </View>
      </View>
    ) : ticket.helpful != null ? (
      <ThemedText variant="caption" color="textTertiary" style={styles.thanks}>
        Obrigado pelo feedback.
      </ThemedText>
    ) : null;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />

        {canReply ? (
          <View style={styles.composer}>
            <TextField
              value={draft}
              onChangeText={setDraft}
              placeholder="Escreva uma mensagem..."
              style={styles.composerInput}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || sendMessage.isPending}
              hitSlop={8}
              style={[styles.sendBtn, draft.trim() ? styles.sendBtnActive : null]}
            >
              <Ionicons
                name="send"
                size={18}
                color={draft.trim() ? theme.colors.background : theme.colors.textTertiary}
              />
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: theme.spacing.lg },
  headerBlock: { marginBottom: theme.spacing.lg },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  code: { fontFamily: theme.fonts.bodySemiBold, letterSpacing: 0.5 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontFamily: theme.fonts.bodyMedium },
  subject: {
    marginTop: theme.spacing.sm,
    fontSize: 24,
    fontFamily: theme.fonts.bodySemiBold,
  },
  metaPill: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  bubbleWrap: { marginBottom: theme.spacing.md, maxWidth: '88%' },
  bubbleWrapMine: { alignSelf: 'flex-end' },
  bubbleWrapStaff: { alignSelf: 'flex-start' },
  authorLabel: { marginBottom: 4, marginHorizontal: 4 },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  bubbleMine: {
    backgroundColor: '#B8893A',
  },
  bubbleMineSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(232, 201, 120, 0.45)',
    // “gradiente” horizontal aproximado: faixa clara à esquerda
    width: '55%',
  },
  bubbleStaff: { backgroundColor: theme.colors.surfaceElevated },
  bubbleTextMine: { color: '#1A120A', fontFamily: theme.fonts.bodyMedium },
  bubbleTextStaff: { color: theme.colors.textPrimary },
  feedbackCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  feedbackTitle: { fontFamily: theme.fonts.bodySemiBold, textAlign: 'center' },
  feedbackHint: { textAlign: 'center', marginTop: theme.spacing.xs, marginBottom: theme.spacing.md },
  feedbackRow: { flexDirection: 'row', gap: theme.spacing.sm },
  feedbackBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  feedbackBtnText: { color: theme.colors.textPrimary, fontFamily: theme.fonts.bodyMedium },
  thanks: { textAlign: 'center', marginTop: theme.spacing.lg },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  composerInput: { flex: 1, marginBottom: 0 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.divider,
  },
  sendBtnActive: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
  },
});
