import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { ThemedText } from './ThemedText';
import { theme } from '../theme';

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
  tagline?: boolean;
  style?: ViewStyle;
}

export function BrandLogo({ size = 96, showWordmark = true, tagline = false, style }: BrandLogoProps) {
  return (
    <View style={[styles.wrap, style]}>
      <Image
        source={require('../../assets/logo.png')}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
        accessibilityLabel="Vitola Hub"
      />
      {showWordmark ? (
        <View style={styles.wordmark}>
          <ThemedText variant="display" style={styles.vitola}>
            VITOLA
          </ThemedText>
          <View style={styles.hubRow}>
            <View style={styles.hubLine} />
            <ThemedText variant="caption" color="gold" style={styles.hub}>
              HUB
            </ThemedText>
            <View style={styles.hubLine} />
          </View>
          {tagline ? (
            <ThemedText variant="caption" color="gold" style={styles.tagline}>
              COMPARTILHE · DEGUSTE · DESCUBRA
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  wordmark: { alignItems: 'center', marginTop: theme.spacing.md },
  vitola: {
    letterSpacing: 6,
    fontSize: 28,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.brand,
  },
  hubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  hubLine: { width: 28, height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.gold },
  hub: { letterSpacing: 8, marginHorizontal: theme.spacing.sm, fontFamily: theme.fonts.bodyMedium },
  tagline: {
    marginTop: theme.spacing.sm,
    letterSpacing: 2,
    fontSize: 10,
    fontFamily: theme.fonts.bodyMedium,
  },
});
