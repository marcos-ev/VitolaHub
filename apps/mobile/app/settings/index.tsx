import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Stack, router } from 'expo-router';
import { FeatureKey } from '@charuto/shared';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ThemedText } from '../../src/components/ThemedText';
import { SettingsRow } from '../../src/components/SettingsRow';
import { LoadingState } from '../../src/components/LoadingState';
import { theme } from '../../src/theme';
import { useCurrentUserClaims } from '../../src/lib/current-user';
import { useDeleteAccountMutation, useUpdatePrivacyMutation, useUserProfileQuery } from '../../src/api/hooks/use-profile';
import { useLogoutMutation } from '../../src/api/hooks/use-auth';
import { useEntitlements, hasFeature } from '../../src/api/hooks/use-entitlements';
import { getStatsExportRequest } from '../../src/api/hooks/use-stats';
import { getErrorMessage } from '../../src/lib/error-message';
import { useAuthStore } from '../../src/state/auth-store';
import { isDemoMode } from '../../src/demo';

export default function SettingsScreen() {
  const claims = useCurrentUserClaims();
  const profileQuery = useUserProfileQuery(claims?.username);
  const updatePrivacy = useUpdatePrivacyMutation();
  const deleteAccount = useDeleteAccountMutation();
  const logoutMutation = useLogoutMutation();
  const entitlementsQuery = useEntitlements();
  const [isExporting, setIsExporting] = useState(false);

  // Placeholders visuais (seção 7.7): ainda sem endpoint de preferências de
  // notificação no backend, então o estado só vive no cliente por enquanto.
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  const handleTogglePrivacy = (value: boolean) => {
    updatePrivacy.mutate(value, {
      onError: (error) => Alert.alert('Erro', getErrorMessage(error, 'Não foi possível atualizar a privacidade.')),
    });
  };

  // Edição cirúrgica (Fase 4): se o usuário tem EXPORT_CSV_PDF, exporta de
  // verdade (GET /stats/export?format=csv → download autenticado → compartilhar
  // via expo-sharing). O endpoint devolve o CSV cru no corpo (não uma URL
  // pré-assinada), então baixamos direto da API com o token de acesso no
  // header. Caso contrário, decidimos direcionar para o paywall em vez de
  // manter o placeholder antigo, já que a ação é claramente premium.
  const handleExportData = async () => {
    if (isExporting) return;

    const canExport = hasFeature(entitlementsQuery.data, FeatureKey.EXPORT_CSV_PDF);
    if (!canExport) {
      router.push('/settings/paywall');
      return;
    }

    setIsExporting(true);
    try {
      if (isDemoMode()) {
        const localUri = `${FileSystem.documentDirectory}avaliacoes.csv`;
        await FileSystem.writeAsStringAsync(
          localUri,
          'charuto,marca,nota\nSerie D No.4,Partagás,4.5\n1964 Anniversary,Padron,5\n',
        );
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(localUri);
        } else {
          Alert.alert('Exportação concluída', 'Arquivo salvo no aparelho.');
        }
        return;
      }

      const { url, headers, filename } = getStatsExportRequest('csv');
      const localUri = `${FileSystem.documentDirectory}${filename}`;
      const download = await FileSystem.downloadAsync(url, localUri, { headers });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(download.uri);
      } else {
        Alert.alert('Exportação concluída', `Arquivo salvo em: ${download.uri}`);
      }
    } catch (error) {
      Alert.alert('Erro ao exportar', getErrorMessage(error, 'Não foi possível exportar seus dados agora.'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Excluir conta',
      'Esta ação é permanente e remove seus dados, publicações e sessão neste aparelho.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            deleteAccount.mutate(undefined, {
              onSuccess: async () => {
                await useAuthStore.getState().clear();
                router.replace('/(auth)/login');
              },
              onError: (error) =>
                Alert.alert('Erro', getErrorMessage(error, 'Não foi possível excluir a conta agora.')),
            });
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert('Sair da conta', 'Deseja mesmo sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logoutMutation.mutateAsync();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Configurações" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <ThemedText variant="caption" style={styles.sectionLabel}>
          PRIVACIDADE
        </ThemedText>
        {profileQuery.isLoading ? (
          <LoadingState label="Carregando..." />
        ) : (
          <SettingsRow
            icon="lock-closed-outline"
            label="Perfil fechado"
            description="Novos seguidores precisam da sua aprovação"
            right={
              <Switch
                value={profileQuery.data?.isPrivate ?? false}
                onValueChange={handleTogglePrivacy}
                disabled={updatePrivacy.isPending}
                trackColor={{ false: theme.colors.divider, true: theme.colors.goldMuted }}
                thumbColor={theme.colors.gold}
              />
            }
          />
        )}

        <ThemedText variant="caption" style={styles.sectionLabel}>
          NOTIFICAÇÕES
        </ThemedText>
        <SettingsRow
          icon="notifications-outline"
          label="Notificações push"
          right={
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: theme.colors.divider, true: theme.colors.goldMuted }}
              thumbColor={theme.colors.gold}
            />
          }
        />
        <SettingsRow
          icon="mail-outline"
          label="E-mails"
          right={
            <Switch
              value={emailEnabled}
              onValueChange={setEmailEnabled}
              trackColor={{ false: theme.colors.divider, true: theme.colors.goldMuted }}
              thumbColor={theme.colors.gold}
            />
          }
        />

        <ThemedText variant="caption" style={styles.sectionLabel}>
          SUPORTE
        </ThemedText>
        <SettingsRow
          icon="help-buoy-outline"
          label="Central de suporte"
          description="Problema técnico, sugestão ou reclamação"
          onPress={() => router.push('/settings/support')}
        />
        <SettingsRow
          icon="ribbon-outline"
          label="Programa fundador"
          description="Para charutarias · preço travado nas primeiras vagas"
          onPress={() => router.push('/settings/founding')}
        />

        <ThemedText variant="caption" style={styles.sectionLabel}>
          CONTA
        </ThemedText>
        <SettingsRow
          icon="star-outline"
          label="Assinatura"
          description="Recursos premium do Vitola Hub"
          onPress={() => router.push('/settings/paywall')}
        />
        <SettingsRow icon="gift-outline" label="Convidar amigos" onPress={() => router.push('/invite')} />
        <SettingsRow icon="ban-outline" label="Bloqueados" onPress={() => router.push('/settings/blocked')} />
        <SettingsRow
          icon="download-outline"
          label="Exportar dados"
          description={isExporting ? 'Preparando arquivo...' : undefined}
          onPress={handleExportData}
        />
        <SettingsRow icon="trash-outline" label="Excluir conta" onPress={handleDeleteAccount} destructive />

        <View style={styles.logoutWrapper}>
          <SettingsRow icon="log-out-outline" label="Sair da conta" onPress={handleLogout} destructive />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: theme.spacing.lg, marginBottom: theme.spacing.xs },
  logoutWrapper: { marginTop: theme.spacing.lg, marginBottom: theme.spacing.xl },
});
