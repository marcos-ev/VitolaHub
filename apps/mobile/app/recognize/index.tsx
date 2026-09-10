import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { pickImageFrom } from '../../src/lib/pick-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeatureKey } from '@charuto/shared';
import { Screen } from '../../src/components/Screen';
import { ThemedText } from '../../src/components/ThemedText';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { theme } from '../../src/theme';
import { useEntitlements, hasFeature } from '../../src/api/hooks/use-entitlements';
import { useImageUploadWithKey } from '../../src/api/hooks/use-media';
import { useScanRecognition } from '../../src/api/hooks/use-recognition';
import { useRecognitionStore } from '../../src/state/recognition-store';
import { getErrorMessage } from '../../src/lib/error-message';

const FRAME_SIZE = 260;

export default function RecognizeCameraScreen() {
  const entitlements = useEntitlements();

  if (entitlements.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingState label="Verificando seu plano..." />
      </Screen>
    );
  }

  if (entitlements.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorState message={getErrorMessage(entitlements.error)} onRetry={() => entitlements.refetch()} />
      </Screen>
    );
  }

  // MVP free: a câmera sempre abre. A análise por IA continua Premium;
  // sem o recurso, a foto segue para a avaliação manual.
  return <CameraCaptureFlow canAnalyze={hasFeature(entitlements.data, FeatureKey.PHOTO_RECOGNITION)} />;
}

function CameraCaptureFlow({ canAnalyze }: { canAnalyze: boolean }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploadImage = useImageUploadWithKey();
  const scanRecognition = useScanRecognition();
  const setLastScan = useRecognitionStore((s) => s.setLastScan);

  const processPhoto = async (uri: string) => {
    if (!canAnalyze) {
      router.replace({ pathname: '/review/new', params: { photoUri: uri } });
      return;
    }
    setErrorMessage(null);
    setProcessing(true);
    try {
      const { objectKey } = await uploadImage.mutateAsync({ uri, folder: 'recognition' });
      const result = await scanRecognition.mutateAsync({ objectKey });
      setLastScan(result);
      router.replace('/recognize/results');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Não foi possível analisar a foto. Tente novamente.'));
    } finally {
      setProcessing(false);
    }
  };

  const handleShutterPress = async () => {
    if (!cameraRef.current || processing) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) await processPhoto(photo.uri);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Não foi possível capturar a foto. Tente novamente.'));
    }
  };

  const handlePickFromGallery = async () => {
    const picked = await pickImageFrom('library', { waitForModal: false });
    if (picked) await processPhoto(picked.uri);
  };

  if (!permission) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingState label="Preparando câmera..." />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.permissionWrapper}>
          <Ionicons name="camera-outline" size={40} color={theme.colors.gold} />
          <ThemedText variant="title" style={styles.permissionTitle}>
            Precisamos da câmera
          </ThemedText>
          <ThemedText variant="body" color="textSecondary" style={styles.permissionMessage}>
            Autorize o acesso à câmera para fotografar a anilha do charuto e identificá-lo automaticamente.
          </ThemedText>
          <PrimaryButton title="Permitir acesso à câmera" onPress={requestPermission} style={styles.permissionButton} />
          <PrimaryButton title="Cancelar" onPress={() => router.back()} variant="ghost" />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.fullScreen}>
      <Stack.Screen options={{ headerShown: false }} />
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      <Pressable
        style={[styles.closeButton, { top: insets.top + theme.spacing.sm }]}
        onPress={() => router.back()}
        hitSlop={10}
      >
        <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
      </Pressable>

      <View style={styles.overlayCenter} pointerEvents="none">
        <View style={styles.instructionPill}>
          <ThemedText variant="caption" style={styles.instructionText}>
            Centralize a anilha do charuto no quadro
          </ThemedText>
        </View>
        <FrameGuide />
      </View>

      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <Pressable style={styles.galleryButton} onPress={handlePickFromGallery} hitSlop={10}>
          <Ionicons name="images-outline" size={26} color={theme.colors.textPrimary} />
        </Pressable>

        <Pressable style={styles.shutterButton} onPress={handleShutterPress} disabled={processing}>
          <View style={styles.shutterInner} />
        </Pressable>

        <View style={styles.galleryButton} />
      </View>

      {errorMessage ? (
        <View style={[styles.errorBanner, { bottom: insets.bottom + 120 }]}>
          <ThemedText variant="caption" style={styles.errorText}>
            {errorMessage}
          </ThemedText>
          <View style={styles.errorActionsRow}>
            <PrimaryButton title="Tentar de novo" onPress={() => setErrorMessage(null)} style={styles.errorButton} />
            <PrimaryButton
              title="Buscar manualmente"
              onPress={() => router.replace('/review/new')}
              variant="outline"
              style={styles.errorButton}
            />
          </View>
        </View>
      ) : null}

      {processing ? (
        <View style={styles.processingOverlay}>
          <ActivityIndicator color={theme.colors.gold} size="large" />
          <ThemedText variant="body" style={styles.processingText}>
            Analisando a anilha...
          </ThemedText>
          <ThemedText variant="caption" color="textSecondary" style={styles.processingHint}>
            Isso pode levar alguns segundos.
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function FrameGuide() {
  return (
    <View style={styles.frame}>
      <View style={[styles.corner, styles.cornerTopLeft]} />
      <View style={[styles.corner, styles.cornerTopRight]} />
      <View style={[styles.corner, styles.cornerBottomLeft]} />
      <View style={[styles.corner, styles.cornerBottomRight]} />
    </View>
  );
}

const CORNER_SIZE = 32;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: theme.colors.background },
  permissionWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl },
  permissionTitle: { marginTop: theme.spacing.md, textAlign: 'center' },
  permissionMessage: { marginTop: theme.spacing.sm, textAlign: 'center' },
  permissionButton: { marginTop: theme.spacing.lg, alignSelf: 'stretch', marginBottom: theme.spacing.sm },
  closeButton: {
    position: 'absolute',
    left: theme.spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    zIndex: 2,
  },
  overlayCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  instructionPill: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  instructionText: { color: theme.colors.textPrimary },
  frame: { width: FRAME_SIZE, height: FRAME_SIZE },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: theme.colors.gold },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: theme.radii.sm,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: theme.radii.sm,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: theme.radii.sm,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: theme.radii.sm,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: theme.spacing.lg,
  },
  galleryButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: theme.colors.surfaceElevated,
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.gold },
  errorBanner: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.alert,
  },
  errorText: { color: theme.colors.textPrimary, marginBottom: theme.spacing.sm },
  errorActionsRow: { flexDirection: 'row' },
  errorButton: { flex: 1, marginRight: theme.spacing.sm },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: { marginTop: theme.spacing.md },
  processingHint: { marginTop: theme.spacing.xs },
});
