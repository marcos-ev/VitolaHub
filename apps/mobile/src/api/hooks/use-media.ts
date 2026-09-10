import { useMutation } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import { apiFetch } from '../client';
import { isDemoMode } from '../../demo';
import { MediaFolder, PresignResponse } from '../types';

function guessContentType(uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase().split('?')[0];
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Faz upload de uma imagem local (uri do expo-image-picker) via URL
 * pré-assinada: POST /media/presign para obter a URL, depois PUT direto para
 * o storage com o binário do arquivo. Retorna a URL pública final.
 */
export async function uploadImageAsync(localUri: string, folder: MediaFolder): Promise<string> {
  // No APK demo não há S3: copia para o armazenamento do app para a foto persistir.
  if (isDemoMode()) {
    const dest = `${FileSystem.documentDirectory}${folder}-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: localUri, to: dest });
    return dest;
  }

  const contentType = guessContentType(localUri);

  const presign = await apiFetch<PresignResponse>('/media/presign', {
    method: 'POST',
    body: { folder, contentType },
  });

  const fileResponse = await fetch(localUri);
  const blob = await fileResponse.blob();

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error('Falha ao enviar a imagem. Tente novamente.');
  }

  return presign.publicUrl;
}

export function useImageUpload() {
  return useMutation({
    mutationFn: ({ uri, folder }: { uri: string; folder: MediaFolder }) => uploadImageAsync(uri, folder),
  });
}

/**
 * Mesmo fluxo de `uploadImageAsync`, mas também devolve o `objectKey` do
 * presign — necessário para telas que chamam outro endpoint depois do upload
 * (ex.: `POST /recognition/scan`) referenciando o arquivo enviado. Não
 * alteramos `uploadImageAsync`/`useImageUpload` para não quebrar os
 * chamadores existentes, que só esperam a `publicUrl` de volta.
 */
export async function uploadImageWithKeyAsync(
  localUri: string,
  folder: MediaFolder,
): Promise<{ publicUrl: string; objectKey: string }> {
  if (isDemoMode()) {
    const dest = `${FileSystem.documentDirectory}${folder}-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: localUri, to: dest });
    return { publicUrl: dest, objectKey: `demo/${folder}/${Date.now()}.jpg` };
  }

  const contentType = guessContentType(localUri);

  const presign = await apiFetch<PresignResponse>('/media/presign', {
    method: 'POST',
    body: { folder, contentType },
  });

  const fileResponse = await fetch(localUri);
  const blob = await fileResponse.blob();

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error('Falha ao enviar a imagem. Tente novamente.');
  }

  return { publicUrl: presign.publicUrl, objectKey: presign.objectKey };
}

export function useImageUploadWithKey() {
  return useMutation({
    mutationFn: ({ uri, folder }: { uri: string; folder: MediaFolder }) => uploadImageWithKeyAsync(uri, folder),
  });
}
