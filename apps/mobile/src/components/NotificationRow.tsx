import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { NotificationItem } from '../api/types';
import { getNotificationIcon, getNotificationMessage } from '../lib/notification-text';
import { Avatar } from './Avatar';
import { ThemedText } from './ThemedText';
import { PrimaryButton } from './PrimaryButton';

interface NotificationRowProps {
  notification: NotificationItem;
  onPress: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  actionsLoading?: boolean;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function NotificationRow({ notification, onPress, onAccept, onReject, actionsLoading }: NotificationRowProps) {
  const isUnread = !notification.readAt;

  return (
    <Pressable style={[styles.row, isUnread && styles.rowUnread]} onPress={onPress}>
      {notification.actor ? (
        <Avatar uri={notification.actor.avatarUrl} size={40} />
      ) : (
        <View style={styles.iconWrapper}>
          <Ionicons name={getNotificationIcon(notification.type)} size={20} color={theme.colors.gold} />
        </View>
      )}
      <View style={styles.texts}>
        <ThemedText variant="body">{getNotificationMessage(notification)}</ThemedText>
        <ThemedText variant="caption" style={styles.time}>
          {timeAgo(notification.createdAt)}
        </ThemedText>

        {notification.type === 'FOLLOW_REQUEST' && onAccept && onReject ? (
          <View style={styles.actionsRow}>
            <PrimaryButton title="Aceitar" onPress={onAccept} loading={actionsLoading} style={styles.actionButton} />
            <PrimaryButton
              title="Recusar"
              onPress={onReject}
              variant="outline"
              disabled={actionsLoading}
              style={styles.actionButton}
            />
          </View>
        ) : null}
      </View>
      {isUnread ? <View style={styles.unreadDot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.sm,
  },
  rowUnread: { backgroundColor: theme.colors.surfaceElevated },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, marginLeft: theme.spacing.sm },
  time: { marginTop: 2 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.gold,
    marginLeft: theme.spacing.sm,
    marginTop: 6,
  },
  actionsRow: { flexDirection: 'row', marginTop: theme.spacing.sm },
  actionButton: { marginRight: theme.spacing.sm, minHeight: 36, paddingHorizontal: theme.spacing.md },
});
