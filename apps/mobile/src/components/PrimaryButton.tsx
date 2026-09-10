import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { theme } from '../theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  icon,
  style,
}: PrimaryButtonProps) {
  const isBlocked = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isBlocked}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.filled,
        variant === 'outline' && styles.outline,
        variant === 'ghost' && styles.ghost,
        isBlocked && styles.disabled,
        pressed && !isBlocked && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.colors.background : theme.colors.gold} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            style={[
              styles.text,
              variant === 'primary' ? styles.textFilled : styles.textOutline,
              icon ? { marginLeft: theme.spacing.sm } : null,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: theme.touchable.minHeight,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  content: { flexDirection: 'row', alignItems: 'center' },
  filled: { backgroundColor: theme.colors.gold },
  outline: { borderWidth: 1, borderColor: theme.colors.goldMuted, backgroundColor: 'transparent' },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  text: { fontFamily: theme.fonts.bodySemiBold, fontSize: 16 },
  textFilled: { color: theme.colors.background },
  textOutline: { color: theme.colors.textPrimary },
});
