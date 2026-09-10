import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from '../theme';
import { ThemedText } from './ThemedText';

interface ScreenHeaderProps {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
}

// Cabeçalho customizado usado nas rotas empilhadas (cigar/review/user/settings)
// já que o Stack raiz roda com `headerShown: false` para manter controle
// total do tema.
export function ScreenHeader({ title, right, onBack }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onBack ?? (() => router.back())} hitSlop={10} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
      </Pressable>
      <ThemedText variant="title" style={styles.title} numberOfLines={1}>
        {title}
      </ThemedText>
      <View style={styles.right}>
        {right}
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          hitSlop={10}
          style={styles.homeButton}
          accessibilityLabel="Voltar ao início"
        >
          <Ionicons name="home-outline" size={22} color={theme.colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: theme.spacing.md,
  },
  backButton: { padding: 4, marginRight: theme.spacing.sm },
  title: { flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 24 },
  homeButton: { padding: 4 },
});
