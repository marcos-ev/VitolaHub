import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface NotificationBellProps {
  hasUnread: boolean;
  onPress: () => void;
}

export function NotificationBell({ hasUnread, onPress }: NotificationBellProps) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.wrapper}>
      <Ionicons name="notifications-outline" size={24} color={theme.colors.textPrimary} />
      {hasUnread ? <View style={styles.badge} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { padding: 4 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.colors.gold,
    borderWidth: 1,
    borderColor: theme.colors.background,
  },
});
