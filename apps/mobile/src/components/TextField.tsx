import { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { theme } from '../theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  rightElement?: ReactNode;
  /** 'elevated' usa um fundo mais claro — para quando o campo já está dentro de um SectionCard (evita se misturar com o fundo do cartão). */
  variant?: 'default' | 'elevated';
}

export function TextField({ label, error, rightElement, style, variant = 'default', ...rest }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, variant === 'elevated' && styles.inputRowElevated, error ? styles.inputRowError : null]}>
        <TextInput placeholderTextColor={theme.colors.textTertiary} style={[styles.input, style]} {...rest} />
        {rightElement}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: theme.spacing.md },
  label: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    paddingHorizontal: theme.spacing.md,
  },
  inputRowElevated: { backgroundColor: theme.colors.surfaceElevated },
  inputRowError: { borderColor: theme.colors.alert },
  input: {
    flex: 1,
    minHeight: theme.touchable.minHeight,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.body,
    fontSize: 15,
  },
  errorText: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.alert,
    marginTop: theme.spacing.xs,
  },
});
