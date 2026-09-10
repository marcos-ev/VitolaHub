import { createElement, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { AccountType } from '@charuto/shared';
import { Screen } from '../../src/components/Screen';
import { ThemedText } from '../../src/components/ThemedText';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Checkbox } from '../../src/components/Checkbox';
import { BrandLogo } from '../../src/components/BrandLogo';
import { theme } from '../../src/theme';
import { useRegisterMutation } from '../../src/api/hooks/use-auth';
import { getErrorMessage } from '../../src/lib/error-message';
import { getInstallationId } from '../../src/lib/installation-id';
import { useInviteStore } from '../../src/state/invite-store';
import { formatCnpj, formatCpf, isValidCnpj, isValidCpf, onlyDigits } from '../../src/lib/cpf';

const TERMS_URL = 'https://vitolahub.example.com/termos';
const PRIVACY_URL = 'https://vitolahub.example.com/privacidade';

function isValidUsername(value: string): boolean {
  return /^[a-z0-9._]{3,30}$/i.test(value);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateAge(birthDate: Date, at: Date = new Date()): number {
  let age = at.getFullYear() - birthDate.getFullYear();
  const monthDiff = at.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

const DEFAULT_BIRTH_DATE = new Date(2000, 0, 1);

function WebDateInput({ value, onChange }: { value: Date | null; onChange: (date: Date) => void }) {
  return createElement('input', {
    type: 'date',
    value: value ? toIsoDate(value) : '',
    max: toIsoDate(new Date()),
    onChange: (event: { target: { value: string } }) => {
      const raw = event.target.value;
      if (!raw) return;
      const [year, month, day] = raw.split('-').map(Number);
      onChange(new Date(year, month - 1, day));
    },
    style: {
      minHeight: theme.touchable.minHeight,
      width: '100%',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.sm,
      borderWidth: 1,
      borderColor: theme.colors.divider,
      borderStyle: 'solid',
      paddingLeft: theme.spacing.md,
      paddingRight: theme.spacing.md,
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontFamily: 'inherit',
      boxSizing: 'border-box',
    },
  });
}

type Step = 'type' | 'data';

export default function RegisterScreen() {
  const [step, setStep] = useState<Step>('type');
  const [accountType, setAccountType] = useState<AccountType>('PF');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [installationId, setInstallationId] = useState<string | undefined>(undefined);
  const [inviteCode, setInviteCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const registerMutation = useRegisterMutation();
  const pendingInviteCode = useInviteStore((s) => s.pendingCode);
  const isShop = accountType === 'PJ';

  useEffect(() => {
    getInstallationId().then(setInstallationId).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (pendingInviteCode) setInviteCode(pendingInviteCode);
  }, [pendingInviteCode]);

  const handleTaxIdChange = (raw: string) => {
    setTaxId(isShop ? formatCnpj(raw) : formatCpf(raw));
  };

  const handleSubmit = async () => {
    setFormError(null);
    const nextErrors: Record<string, string> = {};
    const digits = onlyDigits(taxId);

    if (password.length < 8) nextErrors.password = 'A senha deve ter ao menos 8 caracteres.';
    if (!isValidUsername(username)) {
      nextErrors.username = 'Use 3-30 letras minúsculas, números, ponto ou underscore.';
    }
    if (displayName.trim().length < 2) nextErrors.displayName = 'Informe seu nome completo.';
    if (isShop) {
      if (!isValidCnpj(digits)) nextErrors.taxId = 'Informe um CNPJ válido.';
    } else if (!isValidCpf(digits)) {
      nextErrors.taxId = 'Informe um CPF válido.';
    }
    if (!birthDate) {
      nextErrors.birthDate = 'Informe sua data de nascimento.';
    } else if (calculateAge(birthDate) < 18) {
      nextErrors.birthDate = 'É necessário ter 18 anos ou mais para usar o Vitola Hub.';
    }
    if (!acceptedTerms) nextErrors.terms = 'É necessário aceitar os Termos de Uso e a Política de Privacidade.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !birthDate) return;

    try {
      await registerMutation.mutateAsync({
        password,
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        birthDate: toIsoDate(birthDate),
        taxId: digits,
        accountType,
        acceptedTerms,
        installationId,
        inviteCode: inviteCode.trim() || undefined,
      });
      router.replace('/(tabs)');
    } catch (error) {
      setFormError(getErrorMessage(error, 'Não foi possível criar sua conta.'));
    }
  };

  if (step === 'type') {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <BrandLogo size={72} showWordmark={false} style={styles.logoSmall} />
          <ThemedText variant="display" style={styles.typeTitle}>
            Como você vai usar o Vitola Hub?
          </ThemedText>
          <ThemedText variant="body" color="textSecondary" style={styles.typeSubtitle}>
            Dá para mudar depois nas configurações.
          </ThemedText>

          <AccountTypeCard
            selected={accountType === 'PF'}
            icon="person-outline"
            title="Pessoa física"
            description="Registre, avalie e compartilhe suas experiências. Monte seu umidor e conquiste selos."
            badge="7 dias de Premium para experimentar"
            onPress={() => setAccountType('PF')}
          />
          <AccountTypeCard
            selected={accountType === 'PJ'}
            icon="storefront-outline"
            title="Sou lojista"
            description="Charutaria, lounge, restaurante ou clube. Perfil verificado e canal direto com o cliente."
            footer="Pessoa jurídica · requer CNPJ e verificação"
            onPress={() => setAccountType('PJ')}
          />

          <PrimaryButton title="CONTINUAR" onPress={() => setStep('data')} style={styles.submitButton} />

          <View style={styles.footer}>
            <ThemedText variant="body" color="textSecondary">
              Já tem conta?{' '}
            </ThemedText>
            <Link href="/(auth)/login">
              <ThemedText variant="body" color="gold">
                Entrar
              </ThemedText>
            </Link>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => setStep('type')} hitSlop={10} style={styles.backRow}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.textPrimary} />
          <ThemedText variant="body" color="textSecondary">
            Voltar
          </ThemedText>
        </Pressable>

        <View style={styles.header}>
          <ThemedText variant="title" color="gold">
            Criar conta
          </ThemedText>
          <ThemedText variant="display" style={styles.dataTitle}>
            Seus dados
          </ThemedText>
          <ThemedText variant="caption" color="textTertiary">
            {isShop
              ? 'CNPJ será usado para verificação do negócio.'
              : 'CPF é usado só para verificação de identidade e maioridade.'}
          </ThemedText>
        </View>

        <TextField
          label="Nome completo"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Como aparece no seu documento"
          error={errors.displayName}
        />

        <TextField
          label="Nome de usuário"
          value={username}
          onChangeText={setUsername}
          placeholder="seu_usuario"
          autoCapitalize="none"
          error={errors.username}
        />
        <ThemedText variant="caption" color="textTertiary" style={styles.hint}>
          Letras minúsculas, números, ponto e underline
        </ThemedText>

        <TextField
          label="Senha"
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo de 8 caracteres"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          error={errors.password}
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

        <TextField
          label={isShop ? 'CNPJ' : 'CPF'}
          value={taxId}
          onChangeText={handleTaxIdChange}
          placeholder={isShop ? '00.000.000/0000-00' : '000.000.000-00'}
          keyboardType="number-pad"
          error={errors.taxId}
        />

        <View style={styles.fieldWrapper}>
          <ThemedText variant="caption" color="textSecondary" style={styles.label}>
            Data de nascimento
          </ThemedText>
          {Platform.OS === 'web' ? (
            <WebDateInput value={birthDate} onChange={setBirthDate} />
          ) : (
            <Pressable style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
              <ThemedText variant="body" color={birthDate ? 'textPrimary' : 'textTertiary'}>
                {birthDate ? toIsoDate(birthDate).split('-').reverse().join('/') : 'dd/mm/aaaa'}
              </ThemedText>
              <Ionicons name="calendar-outline" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          )}
          {errors.birthDate ? (
            <ThemedText variant="caption" color="alert" style={styles.fieldError}>
              {errors.birthDate}
            </ThemedText>
          ) : null}
        </View>

        {showDatePicker && Platform.OS !== 'web' ? (
          <DateTimePicker
            value={birthDate ?? DEFAULT_BIRTH_DATE}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(event, selectedDate) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (event.type === 'set' && selectedDate) setBirthDate(selectedDate);
              if (Platform.OS === 'android') setShowDatePicker(false);
            }}
          />
        ) : null}

        <TextField
          label="Código de convite (opcional)"
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="Ex.: AMIGO123"
          autoCapitalize="characters"
        />

        <Checkbox checked={acceptedTerms} onToggle={() => setAcceptedTerms((v) => !v)}>
          <ThemedText variant="caption" color="textSecondary">
            Li e aceito os{' '}
            <ThemedText variant="caption" color="gold" onPress={() => Linking.openURL(TERMS_URL)}>
              termos de uso
            </ThemedText>{' '}
            e a{' '}
            <ThemedText variant="caption" color="gold" onPress={() => Linking.openURL(PRIVACY_URL)}>
              política de privacidade
            </ThemedText>
            .
          </ThemedText>
        </Checkbox>
        {errors.terms ? (
          <ThemedText variant="caption" color="alert" style={styles.fieldError}>
            {errors.terms}
          </ThemedText>
        ) : null}

        {formError ? (
          <ThemedText variant="caption" color="alert" style={styles.formError}>
            {formError}
          </ThemedText>
        ) : null}

        <PrimaryButton
          title="CRIAR CONTA"
          onPress={handleSubmit}
          loading={registerMutation.isPending}
          style={styles.submitButton}
        />
      </ScrollView>
    </Screen>
  );
}

function AccountTypeCard({
  selected,
  icon,
  title,
  description,
  badge,
  footer,
  onPress,
}: {
  selected: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  badge?: string;
  footer?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.typeCard, selected && styles.typeCardSelected]}>
      <View style={styles.typeCardTop}>
        <Ionicons name={icon} size={22} color={theme.colors.gold} />
        {selected ? (
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={14} color={theme.colors.background} />
          </View>
        ) : (
          <View style={styles.checkCircleEmpty} />
        )}
      </View>
      <ThemedText variant="title" style={styles.typeCardTitle}>
        {title}
      </ThemedText>
      <ThemedText variant="caption" color="textSecondary" style={styles.typeCardDesc}>
        {description}
      </ThemedText>
      {badge ? (
        <View style={styles.badgeRow}>
          <Ionicons name="star" size={12} color={theme.colors.gold} />
          <ThemedText variant="caption" color="gold" style={styles.badgeText}>
            {badge}
          </ThemedText>
        </View>
      ) : null}
      {footer ? (
        <ThemedText variant="caption" color="textTertiary" style={styles.typeCardFooter}>
          {footer}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingVertical: theme.spacing.xl },
  logoSmall: { alignSelf: 'flex-start', marginBottom: theme.spacing.md },
  typeTitle: { fontSize: 28, marginBottom: theme.spacing.sm },
  typeSubtitle: { marginBottom: theme.spacing.lg },
  typeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  typeCardSelected: { borderColor: theme.colors.gold },
  typeCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: theme.colors.divider,
  },
  typeCardTitle: { marginTop: theme.spacing.sm },
  typeCardDesc: { marginTop: theme.spacing.xs, lineHeight: 18 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.md },
  badgeText: { marginLeft: 6, fontFamily: theme.fonts.bodyMedium },
  typeCardFooter: { marginTop: theme.spacing.md },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  header: { marginBottom: theme.spacing.lg },
  dataTitle: { marginTop: theme.spacing.xs, marginBottom: theme.spacing.xs },
  hint: { marginTop: -theme.spacing.sm, marginBottom: theme.spacing.md },
  fieldWrapper: { marginBottom: theme.spacing.md },
  label: { marginBottom: theme.spacing.xs },
  dateInput: {
    minHeight: theme.touchable.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    paddingHorizontal: theme.spacing.md,
  },
  fieldError: { marginTop: theme.spacing.xs },
  formError: { marginTop: theme.spacing.md },
  submitButton: { marginTop: theme.spacing.lg },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.lg },
});
