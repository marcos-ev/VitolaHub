import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { TextField } from '../../src/components/TextField';
import { LoadingState } from '../../src/components/LoadingState';
import { BrandLogo } from '../../src/components/BrandLogo';
import { theme } from '../../src/theme';
import {
  SupportTicketCategory,
  SupportTicketStatus,
  useCreateSupportTicketMutation,
  useMySupportTicketsQuery,
} from '../../src/api/hooks/use-support';
import { uploadImageAsync } from '../../src/api/hooks/use-media';
import { useCurrentUserClaims } from '../../src/lib/current-user';
import { getErrorMessage } from '../../src/lib/error-message';
import { PhotoSourceSheet } from '../../src/components/PhotoSourceSheet';

const SUBJECT_MAX = 60;
const MESSAGE_MIN = 15;

const CATEGORIES: {
  value: SupportTicketCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  hint: string;
}[] = [
  { value: 'TECHNICAL', label: 'Problema técnico', icon: 'construct-outline', hint: 'Bug, falha, login, câmera' },
  { value: 'SUGGESTION', label: 'Sugestão', icon: 'bulb-outline', hint: 'Ideia para melhorar o app' },
  { value: 'COMPLAINT', label: 'Reclamação', icon: 'alert-circle-outline', hint: 'Experiência ruim ou cobrança' },
  { value: 'OTHER', label: 'Outro', icon: 'chatbubble-ellipses-outline', hint: 'Demais assuntos' },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Não consigo entrar na minha conta',
    a: 'Confira se está usando o nome de usuário ou e-mail corretos. Se esqueceu a senha, use “Esqueci minha senha” na tela de login. Ainda com problema? Abra um chamado em Problema técnico.',
  },
  {
    q: 'A câmera não abre ao registrar um charuto',
    a: 'Autorize o acesso à câmera nas configurações do aparelho. No navegador, permita a permissão quando o app pedir. Se persistir, anexe um print e abra um chamado.',
  },
  {
    q: 'Como cancelar minha assinatura',
    a: 'Em Perfil → Configurações → Assinatura você gerencia o plano. Cancelamentos feitos na loja (Apple/Google) também refletem aqui em até algumas horas.',
  },
];

const STATUS_META: Record<
  SupportTicketStatus,
  { label: string; color: string; border: string; bg?: string }
> = {
  OPEN: { label: 'Aberto', color: theme.colors.gold, border: theme.colors.goldMuted },
  IN_PROGRESS: { label: 'Em análise', color: '#E0A060', border: '#8A5A30' },
  RESOLVED: { label: 'Resolvido', color: '#6BCF8E', border: '#2E7D4F', bg: 'rgba(46,125,79,0.18)' },
  CLOSED: { label: 'Fechado', color: theme.colors.textTertiary, border: theme.colors.divider },
};

function formatTicketDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

export default function SupportScreen() {
  const claims = useCurrentUserClaims();
  const ticketsQuery = useMySupportTicketsQuery();
  const createMutation = useCreateSupportTicketMutation();

  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [category, setCategory] = useState<SupportTicketCategory>('TECHNICAL');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const appVersion = Constants.expoConfig?.version ?? '0.1.0';
  const deviceLabel = useMemo(() => {
    const model = Device.modelName ?? Device.deviceName ?? 'Dispositivo';
    const os = Device.osName ?? (Device.osVersion ? 'OS' : 'Web');
    const osVer = Device.osVersion ?? '';
    return [model, os, osVer].filter(Boolean).join(' · ');
  }, []);

  const canSubmit = subject.trim().length >= 3 && message.trim().length >= MESSAGE_MIN && !uploading;

  const handleAddAttachment = () => {
    if (attachments.length >= 3) {
      Alert.alert('Limite', 'Você pode anexar até 3 prints.');
      return;
    }
    setPhotoSheetOpen(true);
  };

  const handlePickedAttachment = async (picked: { uri: string }) => {
    setPhotoSheetOpen(false);
    setUploading(true);
    try {
      const url = await uploadImageAsync(picked.uri, 'support');
      setAttachments((prev) => [...prev, url].slice(0, 3));
    } catch (error) {
      Alert.alert('Erro', getErrorMessage(error, 'Não foi possível anexar a imagem.'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    const next: Record<string, string> = {};
    if (subject.trim().length < 3) next.subject = 'Resuma em pelo menos 3 caracteres.';
    if (message.trim().length < MESSAGE_MIN) {
      next.message = `Descreva com mais detalhe (mín. ${MESSAGE_MIN} caracteres).`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      const ticket = await createMutation.mutateAsync({
        category,
        subject: subject.trim(),
        message: message.trim(),
        attachmentUrls: attachments,
        clientMeta: {
          appVersion,
          deviceModel: Device.modelName ?? Device.deviceName ?? undefined,
          osName: Device.osName ?? undefined,
          osVersion: Device.osVersion ?? undefined,
        },
      });
      setSubject('');
      setMessage('');
      setAttachments([]);
      setCategory('TECHNICAL');
      router.push(`/settings/support/${ticket.id}`);
    } catch (error) {
      Alert.alert('Erro', getErrorMessage(error, 'Não foi possível enviar o chamado.'));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Suporte" right={<BrandLogo size={28} showWordmark={false} />} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText variant="display" style={styles.title}>
          Como podemos ajudar?
        </ThemedText>
        <ThemedText variant="body" color="textSecondary" style={styles.subtitle}>
          Respondemos em até 1 dia útil. Assinantes Premium têm resposta em até 4 horas.
        </ThemedText>

        <ThemedText variant="caption" color="gold" style={styles.sectionLabel}>
          DÚVIDAS FREQUENTES
        </ThemedText>
        <View style={styles.faqCard}>
          {FAQ.map((item, index) => {
            const open = openFaq === index;
            const last = index === FAQ.length - 1;
            return (
              <View key={item.q} style={!last ? styles.faqDivider : undefined}>
                <Pressable onPress={() => setOpenFaq(open ? null : index)} style={styles.faqRow}>
                  <ThemedText variant="body" style={styles.faqQuestion}>
                    {item.q}
                  </ThemedText>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
                {open ? (
                  <ThemedText variant="caption" color="textSecondary" style={styles.faqAnswer}>
                    {item.a}
                  </ThemedText>
                ) : null}
              </View>
            );
          })}
        </View>

        <ThemedText variant="caption" color="gold" style={styles.sectionLabel}>
          TIPO DE SOLICITAÇÃO
        </ThemedText>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((item) => {
            const selected = category === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => setCategory(item.value)}
                style={[styles.categoryCard, selected && styles.categoryCardSelected]}
              >
                {selected ? (
                  <View style={styles.categoryCheck}>
                    <Ionicons name="checkmark" size={12} color={theme.colors.background} />
                  </View>
                ) : null}
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={selected ? theme.colors.gold : theme.colors.textSecondary}
                />
                <ThemedText
                  variant="body"
                  style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}
                  numberOfLines={1}
                >
                  {item.label}
                </ThemedText>
                <ThemedText variant="caption" color="textTertiary" numberOfLines={2}>
                  {item.hint}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.fieldHeader}>
          <ThemedText variant="caption" color="gold" style={styles.fieldLabel}>
            ASSUNTO
          </ThemedText>
          <ThemedText variant="caption" color="textTertiary">
            {subject.length}/{SUBJECT_MAX}
          </ThemedText>
        </View>
        <TextField
          value={subject}
          onChangeText={(text) => setSubject(text.slice(0, SUBJECT_MAX))}
          placeholder="Resuma em uma frase"
          maxLength={SUBJECT_MAX}
          error={errors.subject}
        />

        <View style={styles.fieldHeader}>
          <ThemedText variant="caption" color="gold" style={styles.fieldLabel}>
            MENSAGEM
          </ThemedText>
          <ThemedText variant="caption" color="gold">
            mínimo {MESSAGE_MIN}
          </ThemedText>
        </View>
        <TextField
          value={message}
          onChangeText={setMessage}
          placeholder="O que aconteceu, o que você esperava e em qual tela"
          multiline
          numberOfLines={5}
          style={styles.messageInput}
          maxLength={4000}
          error={errors.message}
        />

        <Pressable
          onPress={handleAddAttachment}
          disabled={uploading || attachments.length >= 3}
          style={styles.attachBox}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={theme.colors.gold} />
          ) : (
            <Ionicons name="attach-outline" size={22} color={theme.colors.textSecondary} />
          )}
          <ThemedText variant="caption" color="textTertiary" style={styles.attachHint}>
            Anexe até 3 prints. Ajuda muito em problema técnico.
          </ThemedText>
        </Pressable>
        {attachments.length > 0 ? (
          <View style={styles.thumbs}>
            {attachments.map((url) => (
              <Pressable
                key={url}
                onPress={() => setAttachments((prev) => prev.filter((item) => item !== url))}
                style={styles.thumbWrap}
              >
                <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" />
                <View style={styles.thumbRemove}>
                  <Ionicons name="close" size={12} color={theme.colors.background} />
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.metaBox}>
          <Ionicons name="phone-portrait-outline" size={16} color={theme.colors.goldMuted} />
          <ThemedText variant="caption" color="textTertiary" style={styles.metaText}>
            Enviado junto automaticamente{'\n'}
            Versão {appVersion} · {deviceLabel}
            {claims?.username ? ` · conta @${claims.username}` : ''}
          </ThemedText>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || createMutation.isPending}
          style={({ pressed }) => [
            styles.submitBtn,
            (!canSubmit || createMutation.isPending) && styles.submitBtnDisabled,
            pressed && canSubmit && !createMutation.isPending && styles.submitBtnPressed,
          ]}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color={theme.colors.gold} />
          ) : (
            <>
              <Ionicons name="paper-plane-outline" size={18} color={theme.colors.gold} />
              <ThemedText variant="body" style={styles.submitLabel}>
                ENVIAR CHAMADO
              </ThemedText>
            </>
          )}
        </Pressable>

        <ThemedText variant="caption" color="gold" style={styles.sectionLabel}>
          MEUS CHAMADOS
        </ThemedText>
        {ticketsQuery.isLoading ? (
          <LoadingState label="Carregando chamados..." />
        ) : (ticketsQuery.data?.length ?? 0) === 0 ? (
          <ThemedText variant="body" color="textTertiary" style={styles.empty}>
            Você ainda não abriu nenhum chamado.
          </ThemedText>
        ) : (
          ticketsQuery.data?.map((ticket) => {
            const status = STATUS_META[ticket.status];
            return (
              <Pressable
                key={ticket.id}
                style={styles.ticketCard}
                onPress={() => router.push(`/settings/support/${ticket.id}`)}
              >
                <View style={styles.ticketTop}>
                  <ThemedText variant="caption" color="gold" style={styles.ticketCode}>
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
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
                </View>
                <ThemedText variant="body" style={styles.ticketSubject} numberOfLines={1}>
                  {ticket.subject}
                </ThemedText>
                <ThemedText variant="caption" color="textTertiary">
                  {CATEGORIES.find((c) => c.value === ticket.category)?.label ?? ticket.category}
                  {' · '}
                  {formatTicketDate(ticket.createdAt)}
                </ThemedText>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      <PhotoSourceSheet
        visible={photoSheetOpen}
        title="Anexar print"
        onClose={() => setPhotoSheetOpen(false)}
        onPicked={(picked) => void handlePickedAttachment(picked)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: theme.spacing.xl },
  title: { fontSize: 28, fontFamily: theme.fonts.display },
  subtitle: { marginTop: theme.spacing.xs, marginBottom: theme.spacing.lg, lineHeight: 20 },
  sectionLabel: {
    letterSpacing: 1.2,
    fontFamily: theme.fonts.bodySemiBold,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  faqCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    overflow: 'hidden',
  },
  faqDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  faqQuestion: { flex: 1, marginRight: theme.spacing.sm, fontFamily: theme.fonts.bodyMedium },
  faqAnswer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    lineHeight: 18,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  categoryCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: theme.colors.divider,
    padding: theme.spacing.md,
    minHeight: 100,
    position: 'relative',
  },
  categoryCardSelected: { borderColor: theme.colors.gold },
  categoryCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: { marginTop: 8, fontFamily: theme.fonts.bodySemiBold, fontSize: 13 },
  categoryLabelSelected: { color: theme.colors.gold },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  fieldLabel: { letterSpacing: 1.1, fontFamily: theme.fonts.bodySemiBold },
  messageInput: { minHeight: 120, textAlignVertical: 'top', paddingTop: theme.spacing.sm },
  attachBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: 64,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.goldMuted,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  attachHint: { flex: 1, lineHeight: 18 },
  thumbs: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  thumbWrap: { width: 64, height: 64, borderRadius: theme.radii.sm, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%', backgroundColor: theme.colors.surfaceElevated },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.alert,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  metaText: { flex: 1, lineHeight: 18 },
  submitBtn: {
    minHeight: 52,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  submitBtnDisabled: { opacity: 0.45, borderColor: theme.colors.goldMuted },
  submitBtnPressed: { opacity: 0.85 },
  submitLabel: {
    color: theme.colors.gold,
    fontFamily: theme.fonts.bodySemiBold,
    letterSpacing: 0.8,
  },
  empty: { marginBottom: theme.spacing.lg },
  ticketCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  ticketTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: theme.spacing.sm },
  ticketCode: { fontFamily: theme.fonts.bodySemiBold },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 'auto',
  },
  statusText: { fontSize: 11, fontFamily: theme.fonts.bodyMedium },
  ticketSubject: { fontFamily: theme.fonts.bodySemiBold, marginBottom: 4 },
});
