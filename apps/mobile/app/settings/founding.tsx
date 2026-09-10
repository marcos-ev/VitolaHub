import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { BrandLogo } from '../../src/components/BrandLogo';
import { theme } from '../../src/theme';
import { useCurrentUserClaims } from '../../src/lib/current-user';
import { useUserProfileQuery } from '../../src/api/hooks/use-profile';
import { useSubmitContactMutation } from '../../src/api/hooks/use-contact';
import { getErrorMessage } from '../../src/lib/error-message';

const COMMITMENTS = [
  'Adesivo com QR na loja',
  'Post no Instagram da casa',
  'Indicação ao cliente na hora da venda',
];

const PERKS = [
  { title: 'Preço travado', body: '~R$ 39,90/mês em contrato — abaixo do Parceiro padrão (R$ 99,90).' },
  { title: 'Sem trial', body: 'O fundador entra comprometido desde o dia 1.' },
  { title: 'Extras', body: 'Badge de fundador, acesso antecipado e suporte prioritário.' },
];

export default function FoundingScreen() {
  const claims = useCurrentUserClaims();
  const profileQuery = useUserProfileQuery(claims?.username);
  const submitMutation = useSubmitContactMutation();

  const [tradeName, setTradeName] = useState('');
  const [city, setCity] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (prefilled || !profileQuery.data) return;
    const user = profileQuery.data;
    setName((prev) => prev || user.displayName || '');
    if (user.accountType === 'PJ') {
      setTradeName((prev) => prev || user.displayName || '');
    }
    if (user.city) {
      setCity((prev) => prev || [user.city, user.state].filter(Boolean).join(' / '));
    }
    setPrefilled(true);
  }, [profileQuery.data, prefilled]);

  const handleSubmit = async () => {
    const next: Record<string, string> = {};
    if (tradeName.trim().length < 2) next.tradeName = 'Informe o nome fantasia da loja.';
    if (city.trim().length < 2) next.city = 'Informe a cidade.';
    if (name.trim().length < 2) next.name = 'Informe o nome do responsável.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Informe um e-mail válido.';
    if (message.trim().length < 20) next.message = 'Conte um pouco mais (mín. 20 caracteres).';
    if (!agree) next.agree = 'Confirme os termos do programa fundador.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      await submitMutation.mutateAsync({
        type: 'founding',
        name: name.trim(),
        email: email.trim(),
        tradeName: tradeName.trim(),
        city: city.trim(),
        whatsapp: whatsapp.trim() || undefined,
        instagram: instagram.trim() || undefined,
        message: message.trim(),
        subject: `Fundador — ${tradeName.trim()}`,
      });
      Alert.alert(
        'Candidatura enviada',
        'Recebemos os dados da loja. Em breve a equipe entra em contato no e-mail informado.',
        [{ text: 'Ok', onPress: () => router.back() }],
      );
      setTradeName('');
      setCity('');
      setWhatsapp('');
      setInstagram('');
      setMessage('');
      setAgree(false);
    } catch (error) {
      Alert.alert('Erro', getErrorMessage(error, 'Não foi possível enviar a candidatura.'));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Programa fundador" right={<BrandLogo size={28} showWordmark={false} />} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText variant="caption" color="gold" style={styles.eyebrow}>
          PARA CHARUTARIAS
        </ThemedText>
        <ThemedText variant="display" style={styles.title}>
          Entre nas primeiras 30 a 50 lojas
        </ThemedText>
        <ThemedText variant="body" color="textSecondary" style={styles.lead}>
          Preço travado em torno de R$ 39,90/mês por contrato — sem trial. A troca é divulgação
          real: QR na loja, Instagram e indicação na venda.
        </ThemedText>

        <View style={styles.meter}>
          <ThemedText variant="caption" color="gold">
            Vagas limitadas · primeiras 30–50 lojas
          </ThemedText>
          <View style={styles.meterTrack}>
            <View style={[styles.meterFill, { width: '18%' }]} />
          </View>
        </View>

        <ThemedText variant="caption" color="gold" style={styles.sectionLabel}>
          O QUE VOCÊ LEVA
        </ThemedText>
        <View style={styles.card}>
          {PERKS.map((item, index) => (
            <View
              key={item.title}
              style={[styles.perkRow, index < PERKS.length - 1 && styles.perkDivider]}
            >
              <Ionicons name="diamond-outline" size={18} color={theme.colors.gold} />
              <View style={styles.perkTexts}>
                <ThemedText variant="body" style={styles.perkTitle}>
                  {item.title}
                </ThemedText>
                <ThemedText variant="caption" color="textSecondary">
                  {item.body}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>

        <ThemedText variant="caption" color="gold" style={styles.sectionLabel}>
          CONTRAPARTIDA
        </ThemedText>
        <View style={styles.card}>
          {COMMITMENTS.map((item) => (
            <View key={item} style={styles.commitRow}>
              <View style={styles.dot} />
              <ThemedText variant="body" color="textSecondary" style={styles.commitText}>
                {item}
              </ThemedText>
            </View>
          ))}
        </View>

        <ThemedText variant="caption" color="gold" style={styles.sectionLabel}>
          CANDIDATURA
        </ThemedText>
        <View style={styles.formCard}>
          <TextField
            label="Nome fantasia *"
            value={tradeName}
            onChangeText={setTradeName}
            placeholder="Ex.: Casa do Charuto"
            error={errors.tradeName}
            variant="elevated"
          />
          <TextField
            label="Cidade *"
            value={city}
            onChangeText={setCity}
            placeholder="Cidade / UF"
            error={errors.city}
            variant="elevated"
          />
          <TextField
            label="WhatsApp"
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder="(11) 90000-0000"
            keyboardType="phone-pad"
            variant="elevated"
          />
          <TextField
            label="Instagram"
            value={instagram}
            onChangeText={setInstagram}
            placeholder="@sualoja"
            autoCapitalize="none"
            variant="elevated"
          />
          <TextField
            label="Nome do responsável *"
            value={name}
            onChangeText={setName}
            placeholder="Quem responde pela loja"
            error={errors.name}
            variant="elevated"
          />
          <TextField
            label="E-mail *"
            value={email}
            onChangeText={setEmail}
            placeholder="contato@loja.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
            variant="elevated"
          />
          <TextField
            label="Por que quer ser fundador? *"
            value={message}
            onChangeText={setMessage}
            placeholder="Conte um pouco da loja e do interesse (mín. 20 caracteres)."
            multiline
            style={styles.messageInput}
            error={errors.message}
            variant="elevated"
          />

          <Pressable style={styles.checkRow} onPress={() => setAgree((v) => !v)}>
            <Ionicons
              name={agree ? 'checkbox' : 'square-outline'}
              size={22}
              color={agree ? theme.colors.gold : theme.colors.textTertiary}
            />
            <ThemedText variant="caption" color="textSecondary" style={styles.checkText}>
              Li e aceito o preço fundador (~R$ 39,90/mês travado em contrato), sem trial, e a
              divulgação (QR, Instagram e indicação na venda).
            </ThemedText>
          </Pressable>
          {errors.agree ? (
            <ThemedText variant="caption" color="alert" style={styles.agreeError}>
              {errors.agree}
            </ThemedText>
          ) : null}

          <PrimaryButton
            title="Enviar candidatura"
            onPress={handleSubmit}
            loading={submitMutation.isPending}
            style={styles.submit}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: theme.spacing.xl * 2,
  },
  eyebrow: {
    letterSpacing: 1.5,
    fontFamily: theme.fonts.bodySemiBold,
    marginBottom: theme.spacing.xs,
  },
  title: {
    marginBottom: theme.spacing.sm,
  },
  lead: {
    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
  meter: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.goldMuted,
    backgroundColor: theme.colors.surfaceElevated,
    gap: theme.spacing.sm,
  },
  meterTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.divider,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: theme.colors.gold,
  },
  sectionLabel: {
    letterSpacing: 1.5,
    fontFamily: theme.fonts.bodySemiBold,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  perkRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  perkDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  perkTexts: { flex: 1 },
  perkTitle: { fontFamily: theme.fonts.bodySemiBold, marginBottom: 2 },
  commitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    paddingVertical: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.gold,
    marginTop: 6,
  },
  commitText: { flex: 1 },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.goldMuted,
    padding: theme.spacing.md,
  },
  messageInput: {
    minHeight: 110,
    textAlignVertical: 'top',
    paddingTop: theme.spacing.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  checkText: { flex: 1, lineHeight: 18 },
  agreeError: { marginBottom: theme.spacing.sm },
  submit: { marginTop: theme.spacing.sm },
});
