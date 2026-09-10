import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { SectionCard } from '../../src/components/SectionCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { theme } from '../../src/theme';
import { useCreateReviewPost } from '../../src/api/hooks/use-reviews';
import { useImageUploadWithKey } from '../../src/api/hooks/use-media';
import { getErrorMessage } from '../../src/lib/error-message';
import { PickedImage } from '../../src/lib/pick-image';
import { PhotoSourceSheet } from '../../src/components/PhotoSourceSheet';

export default function NewPostScreen() {
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FRIENDS'>('PUBLIC');
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const uploadImage = useImageUploadWithKey();
  const createPost = useCreateReviewPost();

  const handlePublish = async () => {
    if (!photo) {
      Alert.alert('Falta a foto', 'Uma publicação precisa de pelo menos uma foto.');
      return;
    }

    try {
      const uploaded = await uploadImage.mutateAsync({ uri: photo.uri, folder: 'posts' });
      await createPost.mutateAsync({
        body: caption.trim() || null,
        visibility,
        media: [
          {
            objectKey: uploaded.objectKey,
            url: uploaded.publicUrl,
            thumbUrl: uploaded.publicUrl,
            width: photo.width,
            height: photo.height,
          },
        ],
      });
      Alert.alert('Publicado', 'Sua foto foi publicada no feed.');
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Erro ao publicar', getErrorMessage(error, 'Não foi possível publicar agora.'));
    }
  };

  const isSubmitting = uploadImage.isPending || createPost.isPending;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Publicar" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <SectionCard title="Foto" subtitle="Tire agora ou escolha da galeria">
          {photo ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" />
              <Pressable style={styles.remove} onPress={() => setPhoto(null)} accessibilityLabel="Remover foto">
                <Ionicons name="close" size={16} color={theme.colors.background} />
              </Pressable>
            </View>
          ) : (
            <PrimaryButton
              title="Adicionar foto"
              onPress={() => setPhotoSheetOpen(true)}
              variant="outline"
              icon={<Ionicons name="camera-outline" size={18} color={theme.colors.textPrimary} />}
            />
          )}
        </SectionCard>

        <SectionCard title="Legenda" subtitle="Nome da vitola, o que sentiu e com o que harmonizou">
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Vitola, notas, harmonização… o que você está fumando?"
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            style={styles.caption}
          />
        </SectionCard>

        <SectionCard title="Visibilidade">
          <View style={styles.row}>
            <PrimaryButton
              title="Público"
              onPress={() => setVisibility('PUBLIC')}
              variant={visibility === 'PUBLIC' ? 'primary' : 'outline'}
              style={styles.half}
            />
            <PrimaryButton
              title="Amigos"
              onPress={() => setVisibility('FRIENDS')}
              variant={visibility === 'FRIENDS' ? 'primary' : 'outline'}
              style={styles.half}
            />
          </View>
        </SectionCard>

        <PrimaryButton
          title={isSubmitting ? 'Publicando...' : 'Publicar'}
          onPress={handlePublish}
          disabled={!photo || isSubmitting}
        />
        <ThemedText variant="caption" color="textTertiary" style={styles.hint}>
          Foto do charuto + uma nota de fumo. Assim o feed vira um lounge, não um álbum.
        </ThemedText>
      </ScrollView>
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

const styles = StyleSheet.create({
  scroll: { paddingBottom: theme.spacing.xl },
  previewWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  preview: { width: '100%', height: '100%' },
  remove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    minHeight: 96,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.body,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  half: { flex: 1 },
  hint: { marginTop: theme.spacing.sm, textAlign: 'center' },
});
