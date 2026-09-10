import { StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { ThemedText } from './ThemedText';
import { mediaSource } from '../lib/demo-covers';

interface CigarCoverProps {
  url?: string | null;
  brand?: string;
  name?: string;
  style?: ViewStyle;
}

/** Foto real do charuto quando existir; fallback só se a URL for inválida. */
export function CigarCover({ url, brand, name, style }: CigarCoverProps) {
  const source = mediaSource(url);
  const sized = hasExplicitBox(style);
  const boxStyle = [styles.frame, sized ? null : styles.square, style];

  if (source) {
    return (
      <View style={boxStyle}>
        <Image source={source} style={styles.fill} contentFit="cover" transition={200} />
      </View>
    );
  }

  return (
    <View style={[boxStyle, styles.fallback]}>
      <View style={styles.glow} />
      <Ionicons name="leaf" size={28} color={theme.colors.gold} />
      {brand ? (
        <ThemedText variant="caption" color="gold" style={styles.brand} numberOfLines={1}>
          {brand.toUpperCase()}
        </ThemedText>
      ) : null}
      {name ? (
        <ThemedText variant="caption" style={styles.name} numberOfLines={2}>
          {name}
        </ThemedText>
      ) : null}
    </View>
  );
}

function hasExplicitBox(style?: ViewStyle): boolean {
  if (!style) return false;
  return style.height != null || style.aspectRatio != null;
}

export function isCigarCoverUrl(url?: string | null): boolean {
  return !mediaSource(url);
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceElevated,
  },
  square: {
    width: '100%',
    aspectRatio: 1,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  glow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(201,162,74,0.12)',
  },
  brand: { marginTop: theme.spacing.sm, letterSpacing: 1.2, fontFamily: theme.fonts.bodySemiBold },
  name: { marginTop: 4, textAlign: 'center' },
});
