import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CigarCover } from '../../src/components/CigarCover';
import { Stack, router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { StarRating } from '../../src/components/StarRating';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { EmptyState } from '../../src/components/EmptyState';
import { theme } from '../../src/theme';
import {
  FREE_HUMIDOR_LIMIT,
  HumidorItem,
  useHumidorEntitlements,
  useHumidorListQuery,
  useRemoveHumidorItemMutation,
  useUpdateHumidorItemMutation,
} from '../../src/api/hooks/use-humidor';
import { getErrorMessage } from '../../src/lib/error-message';
import { countryCodeToFlag } from '../../src/lib/country';

// Vitrine do umidor (padrão "Meus vinhos" do Vivino adaptado, seção de
// referências do enunciado): cartões com foto, marca+linha, país, nota da
// comunidade, quantidade e a nota pessoal em texto — ver limitação sobre
// "sua nota" documentada no resumo final do agente (o backend não tem um
// campo de nota pessoal EM ESTRELAS por item de umidor, só o texto livre
// `HumidorItem.note`, que é o que exibimos).
//
// Editar/remover (decisão de UX documentada): em vez de uma tela dedicada,
// um toque no ícone de "⋮" do cartão (ou um long-press no cartão inteiro)
// abre um modal simples de edição/remoção — mais rápido para o caso de uso
// (ajustar quantidade/nota/preço) e evita mais uma rota de navegação.
export default function HumidorScreen() {
  const listQuery = useHumidorListQuery();
  const entitlementsQuery = useHumidorEntitlements();
  const removeItem = useRemoveHumidorItemMutation();
  const updateItem = useUpdateHumidorItemMutation();

  const [editingItem, setEditingItem] = useState<HumidorItem | null>(null);

  const items = useMemo(() => listQuery.data?.pages.flatMap((page) => page.items) ?? [], [listQuery.data]);
  const total = listQuery.data?.total ?? items.length;
  const isPremium = entitlementsQuery.data?.isPremium ?? false;
  const hasReadOnlyItems = items.some((item) => item.readOnly);

  const handleOpenActions = (item: HumidorItem) => {
    Alert.alert(item.cigar.name, 'O que deseja fazer com este item?', [
      { text: 'Editar', onPress: () => setEditingItem(item) },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Remover do umidor', `Remover "${item.cigar.name}" do seu umidor?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Remover',
              style: 'destructive',
              onPress: () =>
                removeItem.mutate(item.id, {
                  onError: (error) => Alert.alert('Erro', getErrorMessage(error)),
                }),
            },
          ]);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title="Meu umidor"
        right={
          <Pressable onPress={() => router.push('/humidor/add')} hitSlop={8}>
            <Ionicons name="add-circle" size={26} color={theme.colors.gold} />
          </Pressable>
        }
      />

      {!isPremium ? (
        <View style={styles.counterRow}>
          <ThemedText variant="caption">
            {total}/{FREE_HUMIDOR_LIMIT} charutos no plano gratuito
          </ThemedText>
          {total >= FREE_HUMIDOR_LIMIT ? (
            <Pressable onPress={() => router.push('/settings/paywall')}>
              <ThemedText variant="caption" color="gold">
                Assinar Premium
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {hasReadOnlyItems ? (
        <View style={styles.readOnlyBanner}>
          <Ionicons name="lock-closed-outline" size={16} color={theme.colors.gold} />
          <ThemedText variant="caption" style={styles.readOnlyBannerText}>
            Alguns itens estão em modo somente leitura por causa do limite gratuito. Nada foi apagado — assine o
            Premium para editar todo o seu umidor.
          </ThemedText>
        </View>
      ) : null}

      {listQuery.isLoading ? (
        <LoadingState label="Carregando umidor..." />
      ) : listQuery.isError ? (
        <ErrorState message={getErrorMessage(listQuery.error)} onRetry={() => listQuery.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <HumidorCard item={item} onOpenActions={() => handleOpenActions(item)} />}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) listQuery.fetchNextPage();
          }}
          ListEmptyComponent={
            <EmptyState icon="leaf-outline" message="Seu umidor está vazio. Adicione o primeiro charuto!" />
          }
          ListFooterComponent={listQuery.isFetchingNextPage ? <LoadingState /> : null}
        />
      )}

      <EditHumidorItemModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        saving={updateItem.isPending}
        onSave={(patch) => {
          if (!editingItem) return;
          updateItem.mutate(
            { id: editingItem.id, ...patch },
            {
              onSuccess: () => setEditingItem(null),
              onError: (error) => Alert.alert('Erro', getErrorMessage(error)),
            },
          );
        }}
      />
    </Screen>
  );
}

function HumidorCard({ item, onOpenActions }: { item: HumidorItem; onOpenActions: () => void }) {
  const cigar = item.cigar;
  return (
    <Pressable
      style={[styles.card, item.readOnly && styles.cardReadOnly]}
      onPress={() => router.push(`/cigar/${cigar.id}`)}
      onLongPress={onOpenActions}
    >
      <CigarCover url={cigar.imageUrl} brand={cigar.brand.name} name={cigar.name} style={styles.cardPhoto} />

      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTexts}>
            <ThemedText variant="body" numberOfLines={1}>
              {cigar.name}
            </ThemedText>
            <ThemedText variant="caption" numberOfLines={1}>
              {cigar.brand.name}
              {cigar.line ? ` · ${cigar.line}` : ''}
            </ThemedText>
            <ThemedText variant="caption" style={styles.cardCountry}>
              {countryCodeToFlag(cigar.countryCode)} {cigar.countryCode}
            </ThemedText>
          </View>
          <Pressable onPress={onOpenActions} hitSlop={10} style={styles.cardMenuButton}>
            <Ionicons name="ellipsis-vertical" size={18} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.ratingRow}>
          <View style={styles.ratingBlock}>
            <ThemedText variant="caption" color="textTertiary">
              Comunidade
            </ThemedText>
            <View style={styles.ratingInline}>
              <StarRating rating={cigar.ratingAvg} readOnly size={12} />
              <ThemedText variant="caption" style={styles.ratingValue}>
                {cigar.ratingAvg.toFixed(1)}
              </ThemedText>
            </View>
          </View>
          <View style={styles.ratingBlock}>
            <ThemedText variant="caption" color="textTertiary">
              Quantidade
            </ThemedText>
            <ThemedText variant="body">{item.quantity}x</ThemedText>
          </View>
        </View>

        {item.note ? (
          <ThemedText variant="caption" numberOfLines={2} style={styles.note}>
            "{item.note}"
          </ThemedText>
        ) : null}

        {item.readOnly ? (
          <View style={styles.readOnlyTag}>
            <Ionicons name="lock-closed-outline" size={11} color={theme.colors.textTertiary} />
            <ThemedText variant="caption" color="textTertiary" style={styles.readOnlyTagText}>
              Somente leitura
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function EditHumidorItemModal({
  item,
  onClose,
  onSave,
  saving,
}: {
  item: HumidorItem | null;
  onClose: () => void;
  onSave: (patch: { quantity?: number; note?: string; pricePaid?: number }) => void;
  saving: boolean;
}) {
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [pricePaid, setPricePaid] = useState('');

  useEffect(() => {
    if (item) {
      setQuantity(String(item.quantity));
      setNote(item.note ?? '');
      setPricePaid(item.pricePaid != null ? String(item.pricePaid) : '');
    }
  }, [item]);

  if (!item) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ThemedText variant="title" style={styles.modalTitle}>
            Editar item
          </ThemedText>

          <TextField
            label="Quantidade"
            value={quantity}
            onChangeText={(text) => setQuantity(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            editable={!item.readOnly}
          />
          <TextField
            label="Preço pago (opcional)"
            value={pricePaid}
            onChangeText={(text) => setPricePaid(text.replace(/[^0-9.,]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="Ex.: 45.90"
            editable={!item.readOnly}
          />
          <TextField
            label="Nota pessoal"
            value={note}
            onChangeText={setNote}
            placeholder="Como foi, ocasião, harmonização..."
            multiline
            editable={!item.readOnly}
          />

          {item.readOnly ? (
            <ThemedText variant="caption" color="alert" style={styles.modalReadOnlyNotice}>
              Este item está em modo somente leitura (limite gratuito excedido). Assine o Premium para editá-lo.
            </ThemedText>
          ) : null}

          <View style={styles.modalActions}>
            <PrimaryButton title="Fechar" onPress={onClose} variant="outline" style={styles.modalButton} />
            <PrimaryButton
              title="Salvar"
              onPress={() =>
                onSave({
                  quantity: Number(quantity) || 1,
                  note: note.trim() || undefined,
                  pricePaid: pricePaid ? Number(pricePaid.replace(',', '.')) : undefined,
                })
              }
              loading={saving}
              disabled={item.readOnly}
              style={styles.modalButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  readOnlyBannerText: { flex: 1, marginLeft: theme.spacing.sm },
  listContent: { paddingBottom: theme.spacing.xl },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  cardReadOnly: { opacity: 0.6 },
  cardPhoto: { width: 72, height: 72, borderRadius: theme.radii.sm, backgroundColor: theme.colors.surfaceElevated },
  cardPhotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, marginLeft: theme.spacing.md },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTexts: { flex: 1 },
  cardCountry: { marginTop: 2 },
  cardMenuButton: { padding: 4 },
  ratingRow: { flexDirection: 'row', marginTop: theme.spacing.sm },
  ratingBlock: { marginRight: theme.spacing.lg },
  ratingInline: { flexDirection: 'row', alignItems: 'center' },
  ratingValue: { marginLeft: 4 },
  note: { marginTop: theme.spacing.xs, fontStyle: 'italic' },
  readOnlyTag: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.xs },
  readOnlyTagText: { marginLeft: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
  },
  modalTitle: { marginBottom: theme.spacing.md },
  modalActions: { flexDirection: 'row', marginTop: theme.spacing.sm },
  modalButton: { flex: 1, marginRight: theme.spacing.sm },
  modalReadOnlyNotice: { marginBottom: theme.spacing.sm },
});
