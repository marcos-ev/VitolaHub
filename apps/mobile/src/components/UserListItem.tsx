import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PublicUser } from '@charuto/shared';
import { theme } from '../theme';
import { Avatar } from './Avatar';
import { ThemedText } from './ThemedText';

interface UserListItemProps {
  user: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  onPress?: () => void;
  right?: ReactNode;
}

export function UserListItem({ user, onPress, right }: UserListItemProps) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <Avatar uri={user.avatarUrl} size={44} />
      <View style={styles.texts}>
        <ThemedText variant="body" numberOfLines={1}>
          {user.displayName}
        </ThemedText>
        <ThemedText variant="caption" numberOfLines={1}>
          @{user.username}
        </ThemedText>
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  texts: { flex: 1, marginLeft: theme.spacing.sm },
});
