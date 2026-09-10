import { Alert, Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

export type PickImageSource = 'camera' | 'library';

let inFlight: Promise<PickedImage | null> | null = null;

async function persistLocalUri(uri: string): Promise<string> {
  if (uri.startsWith(FileSystem.documentDirectory ?? 'file://') || uri.startsWith(FileSystem.cacheDirectory ?? 'file://')) {
    return uri;
  }
  const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase();
  const safeExt = ext && ext.length <= 4 ? ext : 'jpg';
  const dest = `${FileSystem.cacheDirectory}pick-${Date.now()}.${safeExt}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

async function toPicked(result: ImagePicker.ImagePickerResult): Promise<PickedImage | null> {
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const uri = await persistLocalUri(asset.uri);
  return { uri, width: asset.width, height: asset.height };
}

async function waitForModalToClose(): Promise<void> {
  // Modal/ActionSheet ainda aberto faz a câmera e a galeria falharem ou reabrirem no Android.
  if (Platform.OS === 'android') {
    await new Promise((resolve) => setTimeout(resolve, 450));
  }
}

async function ensureCameraPermission(): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  const status = current.granted ? current : await ImagePicker.requestCameraPermissionsAsync();
  if (status.granted) return true;

  Alert.alert(
    'Precisamos da câmera',
    'Autorize o acesso à câmera para fotografar o charuto ou sua foto de perfil.',
    [
      { text: 'Agora não', style: 'cancel' },
      { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
    ],
  );
  return false;
}

async function launchCamera(waitForModal = true): Promise<PickedImage | null> {
  if (!(await ensureCameraPermission())) return null;
  if (waitForModal) await waitForModalToClose();

  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
      exif: false,
    });
    return await toPicked(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível abrir a câmera.';
    Alert.alert('Câmera', message);
    return null;
  }
}

async function launchLibrary(waitForModal = true): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Acesso às fotos',
      'Autorize o acesso à galeria para escolher uma imagem.',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
      ],
    );
    return null;
  }

  if (waitForModal) await waitForModalToClose();

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      // Crop nativo no Android reabre a galeria em loop. Recorte fica no app, se precisar.
      allowsEditing: false,
      selectionLimit: 1,
      exif: false,
    });
    return await toPicked(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível abrir a galeria.';
    Alert.alert('Galeria', message);
    return null;
  }
}

function withPickLock(task: () => Promise<PickedImage | null>): Promise<PickedImage | null> {
  if (inFlight) return inFlight;
  inFlight = task().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Abre câmera ou galeria uma vez só (use com ActionSheet no UI). */
export function pickImageFrom(
  source: PickImageSource,
  options?: { waitForModal?: boolean },
): Promise<PickedImage | null> {
  const wait = options?.waitForModal !== false;
  return withPickLock(() => (source === 'camera' ? launchCamera(wait) : launchLibrary(wait)));
}

/** Atalho: só galeria, sem Alert extra (Alert + picker era um dos loops). */
export function pickImage(): Promise<PickedImage | null> {
  return pickImageFrom('library');
}
