import { Text, TextProps } from 'react-native';
import { theme } from '../theme';

interface ThemedTextProps extends TextProps {
  variant?: 'display' | 'title' | 'body' | 'caption';
  color?: keyof typeof theme.colors;
}

const variantStyles = {
  display: { fontFamily: theme.fonts.displayBold, fontSize: 24, letterSpacing: 0.3, color: theme.colors.textPrimary },
  title: { fontFamily: theme.fonts.display, fontSize: 18, letterSpacing: 0.2, color: theme.colors.textPrimary },
  body: { fontFamily: theme.fonts.body, fontSize: 15, lineHeight: 22, color: theme.colors.textPrimary },
  caption: { fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 16, color: theme.colors.textSecondary },
} as const;

export function ThemedText({ variant = 'body', color, style, ...rest }: ThemedTextProps) {
  return (
    <Text
      style={[variantStyles[variant], color ? { color: theme.colors[color] } : null, style]}
      {...rest}
    />
  );
}
