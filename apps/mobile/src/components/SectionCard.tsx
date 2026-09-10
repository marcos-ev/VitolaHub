import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { ThemedText } from './ThemedText';
import { theme } from '../theme';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
}

// Cartão elevado usado para agrupar cada etapa de formulários mais "vivos"
// (ex.: tela de Avaliar), no lugar de títulos soltos direto no scroll — dá
// hierarquia visual mais clara e profissional, mantendo a estética discreta
// (sem sombra exagerada) da spec.
export function SectionCard({ title, subtitle, right, children, style }: SectionCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.headerTexts}>
          <ThemedText variant="title" style={styles.title}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText variant="caption" color="textTertiary">
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  headerTexts: { flex: 1 },
  title: { fontSize: 17 },
});
