import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { TextField } from '../../src/components/TextField';
import { StarRating } from '../../src/components/StarRating';
import { ScaleSelector } from '../../src/components/ScaleSelector';
import { Chip } from '../../src/components/Chip';
import { SectionCard } from '../../src/components/SectionCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { LoadingState } from '../../src/components/LoadingState';
import { theme } from '../../src/theme';
import { useCigarDetail, useCigarSearch } from '../../src/api/hooks/use-catalog';
import { useCreateReviewPost } from '../../src/api/hooks/use-reviews';
import { useImageUploadWithKey } from '../../src/api/hooks/use-media';
import { CigarSearchItem } from '../../src/api/types';
import { FLAVOR_NOTE_GROUPS } from '../../src/constants/flavor-notes';
import { getErrorMessage } from '../../src/lib/error-message';
import { PickedImage } from '../../src/lib/pick-image';
import { PhotoSourceSheet } from '../../src/components/PhotoSourceSheet';

const MAX_FLAVOR_NOTES = 6;

export default function NewReviewScreen() {
  const params = useLocalSearchParams<{ cigarId?: string; photoUri?: string }>();
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

  const [rating, setRating] = useState(0);
  const [strength, setStrength] = useState<number | null>(null);
  const [smokeMinutes, setSmokeMinutes] = useState('');
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [draw, setDraw] = useState<number | null>(null);
  const [burn, setBurn] = useState<number | null>(null);
  const [pairedWith, setPairedWith] = useState('');
  const [comment, setComment] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FRIENDS'>('PUBLIC');
  const [photo, setPhoto] = useState<PickedImage | null>(
    params.photoUri ? { uri: Array.isArray(params.photoUri) ? params.photoUri[0] : params.photoUri, width: 800, height: 800 } : null,
  );
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);

  const uploadImage = useImageUploadWithKey();
  const createReviewPost = useCreateReviewPost();

  const toggleFlavor = (note: string) => {
    setSelectedFlavors((current) => {
      if (current.includes(note)) return current.filter((n) => n !== note);
      if (current.length >= MAX_FLAVOR_NOTES) return current;
      return [...current, note];
    });
  };

  const handlePickPhoto = () => setPhotoSheetOpen(true);

  const canPublish = useMemo(
    () => !!selectedCigar && rating > 0 && !!strength,
    [selectedCigar, rating, strength],
  );

  const handlePublish = async () => {
    if (!selectedCigar || rating === 0 || !strength) {
      Alert.alert('Faltam informações', 'Selecione um charuto, uma nota e a fortaleza percebida.');
      return;
    }

    try {
      let media: { objectKey: string; url: string; thumbUrl: string; width: number; height: number }[] | undefined;
      if (photo) {
        const uploaded = await uploadImage.mutateAsync({ uri: photo.uri, folder: 'posts' });
        media = [
          {
            objectKey: uploaded.objectKey,
            url: uploaded.publicUrl,
            thumbUrl: uploaded.publicUrl,
            width: photo.width,
            height: photo.height,
          },
        ];
      }

      await createReviewPost.mutateAsync({
        body: comment.trim() || null,
        visibility,
        cigarId: selectedCigar.id,
        media,
        review: {
          cigarId: selectedCigar.id,
          rating,
          perceivedStrength: strength,
          smokeMinutes: smokeMinutes ? Number(smokeMinutes) : undefined,
          draw: draw ?? undefined,
          burn: burn ?? undefined,
          pairedWith: pairedWith.trim() || undefined,
          flavorNotes: selectedFlavors,
        },
      });

      Alert.alert('Avaliação publicada', 'Sua avaliação foi publicada com sucesso.');
      router.back();
    } catch (error) {
      Alert.alert('Erro ao publicar', getErrorMessage(error));
    }
  };

  const isSubmitting = uploadImage.isPending || createReviewPost.isPending;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Avaliar" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        <SectionCard title="Charuto" subtitle="Qual você está fumando?">
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
                variant="elevated"
              />
              <PrimaryButton
                title="Avaliar por foto"
                onPress={() => router.push('/recognize')}
                variant="outline"
                icon={<Ionicons name="camera-outline" size={18} color={theme.colors.textPrimary} />}
                style={styles.recognizeButton}
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
                  Nenhum charuto encontrado. Você poderá sugeri-lo ao catálogo em breve.
                </ThemedText>
              ) : null}
            </View>
          )}
        </SectionCard>

        <SectionCard title="Sua nota" subtitle="Toque nas estrelas — metade de estrela também vale">
          <StarRating rating={rating} onChange={setRating} size={34} showValue />
        </SectionCard>

        <SectionCard
          title="Fortaleza percebida"
          right={strength ? <ValuePill value={strength} max={5} /> : null}
        >
          <ScaleSelector value={strength} onChange={setStrength} endLabels={['Suave', 'Intensa']} />
        </SectionCard>

        <SectionCard title="Notas de sabor" subtitle={`Escolha até ${MAX_FLAVOR_NOTES} — ${selectedFlavors.length} selecionada${selectedFlavors.length === 1 ? '' : 's'}`}>
          {FLAVOR_NOTE_GROUPS.map((group) => (
            <View key={group.category} style={styles.flavorGroup}>
              <View style={styles.flavorGroupHeader}>
                <Ionicons name={group.icon} size={14} color={theme.colors.textTertiary} style={styles.flavorGroupIcon} />
                <ThemedText variant="caption" color="textTertiary">
                  {group.category}
                </ThemedText>
              </View>
              <View style={styles.chipsRow}>
                {group.notes.map((note) => (
                  <Chip key={note} label={note} selected={selectedFlavors.includes(note)} onPress={() => toggleFlavor(note)} />
                ))}
              </View>
            </View>
          ))}
        </SectionCard>

        <SectionCard title="Tiragem" right={draw ? <ValuePill value={draw} max={5} /> : null}>
          <ScaleSelector value={draw} onChange={setDraw} endLabels={['Apertada', 'Solta']} />
        </SectionCard>

        <SectionCard title="Queima" right={burn ? <ValuePill value={burn} max={5} /> : null}>
          <ScaleSelector value={burn} onChange={setBurn} endLabels={['Irregular', 'Perfeita']} />
        </SectionCard>

        <SectionCard title="Detalhes" subtitle="Opcional, mas ajuda outros fumantes">
          <TextField
            label="Tempo de fumo (minutos)"
            value={smokeMinutes}
            onChangeText={(text) => setSmokeMinutes(text.replace(/[^0-9]/g, ''))}
            placeholder="Ex.: 45"
            keyboardType="number-pad"
            variant="elevated"
          />
          <TextField
            label="Harmonização"
            value={pairedWith}
            onChangeText={setPairedWith}
            placeholder="Ex.: Café, uísque, rum..."
            variant="elevated"
          />
          <View style={styles.fieldWrapper}>
            <ThemedText variant="caption" color="textSecondary" style={styles.label}>
              Comentário
            </ThemedText>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Notas, queima, empate, harmonização..."
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />
          </View>
        </SectionCard>

        <SectionCard title="Foto">
          {photo ? (
            <View style={styles.photoPreviewOuter}>
              <View style={styles.photoPreviewWrapper}>
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} contentFit="cover" />
              </View>
              <Pressable
                style={styles.removePhotoButton}
                onPress={() => setPhoto(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Remover foto"
              >
                <Ionicons name="close" size={16} color={theme.colors.background} />
              </Pressable>
            </View>
          ) : (
            <PrimaryButton
              title="Adicionar foto"
              onPress={handlePickPhoto}
              variant="outline"
              icon={<Ionicons name="camera-outline" size={18} color={theme.colors.textPrimary} />}
            />
          )}
        </SectionCard>

        <SectionCard title="Visibilidade">
          <View style={styles.visibilityRow}>
            <PrimaryButton
              title="Público"
              onPress={() => setVisibility('PUBLIC')}
              variant={visibility === 'PUBLIC' ? 'primary' : 'outline'}
              style={styles.visibilityButton}
            />
            <PrimaryButton
              title="Amigos"
              onPress={() => setVisibility('FRIENDS')}
              variant={visibility === 'FRIENDS' ? 'primary' : 'outline'}
              style={styles.visibilityButton}
            />
          </View>
        </SectionCard>

        {canPublish ? <ReviewSummary rating={rating} strength={strength} cigarName={selectedCigar?.name} flavorCount={selectedFlavors.length} /> : null}

        <PrimaryButton
          title="Publicar"
          onPress={handlePublish}
          loading={isSubmitting}
          disabled={!canPublish}
          style={styles.publishButton}
        />
      </ScrollView>
      </KeyboardAvoidingView>
      <PhotoSourceSheet
        visible={photoSheetOpen}
        onClose={() => setPhotoSheetOpen(false)}
        onPicked={(picked) => {
          setPhoto(picked);
          setPhotoSheetOpen(false);
        }}
      />
    </Screen>
  );
}

function ValuePill({ value, max }: { value: number; max: number }) {
  return (
    <View style={styles.valuePill}>
      <ThemedText variant="caption" color="gold" style={styles.valuePillText}>
        {value}/{max}
      </ThemedText>
    </View>
  );
}

function ReviewSummary({
  rating,
  strength,
  cigarName,
  flavorCount,
}: {
  rating: number;
  strength: number | null;
  cigarName?: string;
  flavorCount: number;
}) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name="sparkles-outline" size={18} color={theme.colors.gold} />
      <View style={styles.summaryTexts}>
        <ThemedText variant="body" numberOfLines={1}>
          {cigarName}
        </ThemedText>
        <ThemedText variant="caption" color="textTertiary">
          Nota {rating.toFixed(1)} · Fortaleza {strength}/5{flavorCount > 0 ? ` · ${flavorCount} sabor${flavorCount === 1 ? '' : 'es'}` : ''}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: theme.spacing.xl },
  selectedCigarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  },
  selectedCigarTexts: { flex: 1 },
  recognizeButton: { marginTop: theme.spacing.sm },
  searchResultRow: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  noResults: { marginTop: theme.spacing.sm, textAlign: 'center' },
  flavorGroup: { marginBottom: theme.spacing.sm },
  flavorGroupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  flavorGroupIcon: { marginRight: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  fieldWrapper: { marginBottom: theme.spacing.md },
  label: { marginBottom: theme.spacing.xs },
  textArea: {
    minHeight: 96,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  photoPreviewOuter: {
    width: 132,
    height: 132,
    alignSelf: 'flex-start',
  },
  photoPreviewWrapper: {
    width: 120,
    height: 120,
    marginTop: 6,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceElevated,
  },
  photoPreview: {
    width: 120,
    height: 120,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.alert,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visibilityRow: { flexDirection: 'row' },
  visibilityButton: { flex: 1, marginRight: theme.spacing.sm },
  valuePill: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: theme.colors.gold,
  },
  valuePillText: { fontFamily: theme.fonts.bodySemiBold },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.goldMuted,
  },
  summaryTexts: { flex: 1, marginLeft: theme.spacing.sm },
  publishButton: { marginTop: theme.spacing.sm },
});
