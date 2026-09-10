import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { ThemedText } from '../../src/components/ThemedText';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { BrandLogo } from '../../src/components/BrandLogo';
import { theme } from '../../src/theme';
import { useLoginMutation } from '../../src/api/hooks/use-auth';
import { isDemoMode, demoLogin } from '../../src/demo';
import { useAuthStore } from '../../src/state/auth-store';
import { getErrorMessage } from '../../src/lib/error-message';

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [showDemoButton, setShowDemoButton] = useState(false);
  const [demoHint, setDemoHint] = useState(false);
  const loginMutation = useLoginMutation();

  useEffect(() => {
    const demo = isDemoMode();
    setShowDemoButton(demo);
    setDemoHint(demo);
  }, []);

  const handleSubmit = async () => {
    setFormError(null);
    if (identifier.trim().length < 3) {
      setFormError('Informe seu nome de usuário ou e-mail.');
      return;
    }
    if (password.length === 0) {
      setFormError('Informe sua senha.');
      return;
    }

    try {
      await loginMutation.mutateAsync({
        identifier: identifier.trim(),
        password,
      });
      router.replace('/(tabs)');
    } catch (error) {
      setFormError(getErrorMessage(error, 'Usuário ou senha inválidos.'));
    }
  };

  const handleDemoLogin = async () => {
    setFormError(null);
    setDemoLoading(true);
    try {
      const session = await demoLogin();
      await useAuthStore.getState().setTokens(session.accessToken, session.refreshToken);
      router.replace('/(tabs)');
    } catch (error) {
      setFormError(getErrorMessage(error, 'Não foi possível entrar em modo demonstração.'));
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* O PNG do logo já inclui o wordmark VITOLA HUB — só reforçamos a tagline. */}
          <BrandLogo size={120} showWordmark={false} style={styles.logo} />
          <ThemedText variant="caption" color="gold" style={styles.tagline}>
            COMPARTILHE · DEGUSTE · DESCUBRA
          </ThemedText>

          {demoHint ? (
            <ThemedText variant="caption" color="textSecondary" style={styles.demoHint}>
              Modo demonstração: entre com qualquer usuário e senha, ou use o botão abaixo.
            </ThemedText>
          ) : null}

          <TextField
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Nome de usuário ou e-mail"
            autoCapitalize="none"
            autoComplete="username"
          />

          <TextField
            value={password}
            onChangeText={setPassword}
            placeholder="Senha"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
            rightElement={
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
            }
          />

          <Pressable
            style={styles.forgotRow}
            onPress={() =>
              Alert.alert(
                'Recuperar senha',
                isDemoMode()
                  ? 'No modo demonstração use Entrar sem conta. A recuperação de senha entra quando o app estiver online.'
                  : 'Em breve você poderá redefinir a senha por e-mail.',
              )
            }
          >
            <ThemedText variant="caption" color="gold">
              Esqueci minha senha
            </ThemedText>
          </Pressable>

          {formError ? (
            <ThemedText variant="caption" color="alert" style={styles.formError}>
              {formError}
            </ThemedText>
          ) : null}

          <PrimaryButton
            title="ENTRAR"
            onPress={handleSubmit}
            loading={loginMutation.isPending}
            style={styles.submitButton}
          />

          {showDemoButton ? (
            <PrimaryButton
              title="ENTRAR EM MODO DEMONSTRAÇÃO"
              onPress={handleDemoLogin}
              loading={demoLoading}
              variant="outline"
              style={styles.demoButton}
            />
          ) : null}

          <View style={styles.footer}>
            <ThemedText variant="body" color="textSecondary">
              Não tem conta?{' '}
            </ThemedText>
            <Link href="/(auth)/register">
              <ThemedText variant="body" color="gold" style={styles.createLink}>
                Criar agora
              </ThemedText>
            </Link>
          </View>

          <View style={styles.ageRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.textTertiary} />
            <ThemedText variant="caption" color="textTertiary" style={styles.ageText}>
              Exclusivo para maiores de 18 anos
            </ThemedText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
  },
  logo: { marginBottom: theme.spacing.sm },
  tagline: {
    textAlign: 'center',
    letterSpacing: 2,
    fontSize: 10,
    fontFamily: theme.fonts.bodyMedium,
    marginBottom: theme.spacing.xl,
  },
  demoHint: {
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    marginTop: -theme.spacing.sm,
  },
  forgotRow: { alignSelf: 'flex-end', marginBottom: theme.spacing.md, marginTop: -theme.spacing.xs },
  formError: { marginBottom: theme.spacing.sm },
  submitButton: { marginTop: theme.spacing.sm },
  demoButton: { marginTop: theme.spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.lg },
  createLink: { fontFamily: theme.fonts.bodySemiBold },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xl,
  },
  ageText: { marginLeft: 6 },
});
