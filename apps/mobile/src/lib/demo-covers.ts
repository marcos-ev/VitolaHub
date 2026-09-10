import { ImageSource } from 'expo-image';

const DEMO_COVERS: Record<string, ImageSource> = {
  'cigar://partagas-d4': require('../../assets/demo/partagas-d4.png'),
  'cigar://padron-1964': require('../../assets/demo/padron-1964.png'),
  'cigar://opusx': require('../../assets/demo/opusx.png'),
  'cigar://liga-privada': require('../../assets/demo/liga-privada.png'),
  'cigar://serie-d-vs': require('../../assets/demo/serie-d-vs.png'),
};

export function demoCoverSource(url?: string | null): ImageSource | null {
  if (!url) return null;
  return DEMO_COVERS[url] ?? null;
}

export function mediaSource(url?: string | null): ImageSource | null {
  const demo = demoCoverSource(url);
  if (demo) return demo;
  if (!url || url.startsWith('cigar://') || url.includes('picsum.photos')) return null;
  return { uri: url };
}
