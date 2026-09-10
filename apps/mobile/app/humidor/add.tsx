import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { LoadingState } from '../../src/components/LoadingState';
import { theme } from '../../src/theme';
import { useCigarDetail, useCigarSearch } from '../../src/api/hooks/use-catalog';
import { useAddHumidorItemMutation } from '../../src/api/hooks/use-humidor';
import { CigarSearchItem } from '../../src/api/types';
import { ApiError } from '../../src/api/client';
import { getErrorMessage } from '../../src/lib/error-message';

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Formulário de "adicionar ao umidor". Reaproveita o mesmo padrão de busca
// com debounce de `app/review/new.tsx` (charuto por nome, 300ms) e o mesmo
// padrão de seletor de data de `app/(auth)/register.tsx`
// (`@react-native-community/datetimepicker`). Se vier `?cigarId=` (do botão
// da ficha do charuto), pré-seleciona esse charuto e não permite trocá-lo.
export default function AddHumidorItemScreen() {
  const params = useLocalSearchParams<{ cigarId?: string }>();
  const presetCigarQuery = useCigarDetail(params.cigarId);

  const [selectedCigar, setSelectedCigar] = useState<CigarSearchItem | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const searchQuery = useCigarSearch(debouncedSearch);

  useEffect(() => {
    if (presetCigarQuery.data) {
      setSelectedCigar({
        id: presetCigarQuery.data.id,
        name: presetCigarQuery.data.name,
        line: presetCigarQuery.data.line,
        brand: presetCigarQuery.data.brand,
        countryCode: presetCigarQuery.data.countryCode,
        vitola: presetCigarQuery.data.vitola,
        ratingAvg: presetCigarQuery.data.ratingAvg,
        ratingCount: presetCigarQuery.data.ratingCount,
        imageUrl: presetCigarQuery.data.imageUrl,
      });
    }
  }, [presetCigarQuery.data]);

  const [quantity, setQuantity] = useState('1');
  const [acquiredAt, setAcquiredAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');
  const [pricePaid, setPricePaid] = useState('');

  const addItem = useAddHumidorItemMutation();

  const canSubmit = useMemo(() => !!selectedCigar && Number(quantity) > 0, [selectedCigar, quantity]);

  const handleSubmit = async () => {
    if (!selectedCigar) {
      Alert.alert('Selecione um charuto', 'Escolha um charuto para adicionar ao seu umidor.');
      return;
    }

    try {
      await addItem.mutateAsync({
        cigarId: selectedCigar.id,
        quantity: Number(quantity) || 1,
        acquiredAt: toIsoDate(acquiredAt),
        note: note.trim() || undefined,
        pricePaid: pricePaid ? Number(pricePaid.replace(',', '.')) : undefined,
      });
      router.back();
    } catch (error) {
      // Paywall contextual (seção 6.2/6.3): o backend recusa o 26º item com
      // 403 quando o usuário não é Premium/trial — nunca bloqueamos a tela
      // inteira, só mostramos este alerta levando à assinatura.
      if (error instanceof ApiError && error.status === 403) {
        Alert.alert(
          'Limite do umidor gratuito atingido',
          getErrorMessage(error, 'Assine o Premium para adicionar charutos ilimitados ao seu umidor.'),
          [
            { text: 'Agora não', style: 'cancel' },
            { text: 'Assinar Premium', onPress: () => router.push('/settings/paywall') },
          ],
        );
        return;
      }
      Alert.alert('Erro ao adicionar', getErrorMessage(error));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Adicionar ao umidor" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <ThemedText variant="title" style={styles.sectionTitle}>
          Charuto
        </ThemedText>

        {selectedCigar ? (
          <View style={styles.selectedCigarCard}>
            <View style={styles.selectedCigarTexts}>
              <ThemedText variant="body">{selectedCigar.name}</ThemedText>
              <ThemedText variant="caption">{selectedCigar.brand.name}</ThemedText>
            </View>
            {!params.cigarId ? (
              <Pressable onPress={() => setSelectedCigar(null)} hitSlop={8}>
                <ThemedText variant="caption" color="gold">
                  Alterar
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View>
            <TextField
              placeholder="Buscar charuto pelo nome..."
              value={searchInput}
              onChangeText={setSearchInput}
              autoCapitalize="none"
            />
            {presetCigarQuery.isLoading ? <LoadingState label="Carregando charuto..." /> : null}
            {searchQuery.isLoading ? <LoadingState label="Buscando..." /> : null}
            {searchQuery.data?.items.map((item) => (
              <Pressable key={item.id} style={styles.searchResultRow} onPress={() => setSelectedCigar(item)}>
                <ThemedText variant="body">{item.name}</ThemedText>
                <ThemedText variant="caption">{item.brand.name}</ThemedText>
              </Pressable>
            ))}
            {debouncedSearch.length >= 2 && searchQuery.data?.items.length === 0 ? (
              <ThemedText variant="caption" style={styles.noResults}>
                Nenhum charuto encontrado.
              </ThemedText>
            ) : null}
          </View>
        )}

        <TextField
          label="Quantidade"
          value={quantity}
          onChangeText={(text) => setQuantity(text.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
        />

        <View style={styles.fieldWrapper}>
          <ThemedText variant="caption" color="textSecondary" style={styles.label}>
            Data de aquisição
          </ThemedText>
          <Pressable style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
            <ThemedText variant="body">{toIsoDate(acquiredAt).split('-').reverse().join('/')}</ThemedText>
          </Pressable>
        </View>

        {showDatePicker ? (
          <DateTimePicker
            value={acquiredAt}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(event, selectedDate) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (event.type === 'set' && selectedDate) setAcquiredAt(selectedDate);
              if (Platform.OS === 'android') setShowDatePicker(false);
            }}
          />
        ) : null}

        <TextField
          label="Preço pago (opcional)"
          value={pricePaid}
          onChangeText={(text) => setPricePaid(text.replace(/[^0-9.,]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="Ex.: 45.90"
        />

        <TextField
          label="Nota pessoal (opcional)"
          value={note}
          onChangeText={setNote}
          placeholder="Como foi, ocasião, harmonização..."
          multiline
        />

        <PrimaryButton
          title="Adicionar ao umidor"
          onPress={handleSubmit}
          loading={addItem.isPending}
          disabled={!canSubmit}
          style={styles.submitButton}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: theme.spacing.xl },
  sectionTitle: { marginBottom: theme.spacing.sm },
  selectedCigarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  selectedCigarTexts: { flex: 1 },
  searchResultRow: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  noResults: { marginTop: theme.spacing.sm, textAlign: 'center' },
  fieldWrapper: { marginBottom: theme.spacing.md },
  label: { marginBottom: theme.spacing.xs },
  dateInput: {
    minHeight: theme.touchable.minHeight,
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    paddingHorizontal: theme.spacing.md,
  },
  submitButton: { marginTop: theme.spacing.lg },
});
