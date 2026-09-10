import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface AvatarProps {
  uri?: string | null;
  size?: number;
}

export function Avatar({ uri, size = 48 }: AvatarProps) {
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        key={uri}
        source={{ uri }}
        style={[styles.base, dimensionStyle]}
        contentFit="cover"
        cachePolicy="none"
        transition={150}
      />
    );
  }

  return (
    <View style={[styles.base, styles.placeholder, dimensionStyle]}>
      <Ionicons name="person" size={size * 0.5} color={theme.colors.textTertiary} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: theme.colors.surfaceElevated },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
