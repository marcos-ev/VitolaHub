import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { theme } from '../theme';

export interface ActionSheetItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  items: ActionSheetItem[];
  onClose: () => void;
  /** Só backdrop e Cancelar. Item selecionado chama só onClose (fecha o modal). */
  onDismiss?: () => void;
}

// Menu de ações (3 pontinhos). Usa Modal em vez de Alert.alert — no Web o
// Alert nativo do RN não mostra botões de forma confiável, então o menu
// simplesmente "não fazia nada".
export function ActionSheet({ visible, title, items, onClose, onDismiss }: ActionSheetProps) {
  const dismiss = onDismiss ?? onClose;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {title ? (
            <ThemedText variant="caption" color="textTertiary" style={styles.title}>
              {title}
            </ThemedText>
          ) : null}
          {items.map((item) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={() => {
                // Fecha o Modal primeiro. No Android, câmera nativa e
                // launchCameraAsync falham se outro Modal ainda estiver aberto.
                onClose();
                setTimeout(() => item.onPress(), Platform.OS === 'android' ? 350 : 50);
              }}
            >
              {item.icon ? (
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.destructive ? theme.colors.alert : theme.colors.textPrimary}
                  style={styles.itemIcon}
                />
              ) : null}
              <ThemedText
                variant="body"
                color={item.destructive ? 'alert' : 'textPrimary'}
                style={styles.itemLabel}
              >
                {item.label}
              </ThemedText>
            </Pressable>
          ))}
          <Pressable
            style={({ pressed }) => [styles.cancel, pressed && styles.itemPressed]}
            onPress={dismiss}
          >
            <ThemedText variant="body" color="textSecondary" style={styles.cancelLabel}>
              Cancelar
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    padding: theme.spacing.md,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    paddingBottom: theme.spacing.sm,
  },
  title: {
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.touchable.minHeight,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  itemPressed: { backgroundColor: theme.colors.surfaceElevated },
  itemIcon: { marginRight: theme.spacing.md },
  itemLabel: { fontFamily: theme.fonts.bodyMedium },
  cancel: {
    marginTop: theme.spacing.xs,
    minHeight: theme.touchable.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  cancelLabel: { fontFamily: theme.fonts.bodySemiBold },
});
