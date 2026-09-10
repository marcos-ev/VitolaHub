import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { ActionSheet } from '../../src/components/ActionSheet';
import { theme } from '../../src/theme';

/**
 * Aba fantasma do botão "+" central. Ao focar, abre o menu de criação
 * e sai desta rota — o conteúdo nunca fica visível.
 */
export default function CreateTabScreen() {
  const [open, setOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setOpen(true);
      return () => setOpen(false);
    }, []),
  );

  const goHome = () => {
    setOpen(false);
    router.replace('/(tabs)');
  };

  const openRoute = (href: '/post/new' | '/recognize' | '/review/new' | '/humidor') => {
    setOpen(false);
    router.replace('/(tabs)');
    setTimeout(() => router.push(href), Platform.OS === 'android' ? 120 : 40);
  };

  return (
    <View style={styles.blank}>
      <ActionSheet
        visible={open}
        title="O que você quer fazer?"
        onClose={goHome}
        onDismiss={goHome}
        items={[
          {
            label: 'Publicar foto',
            icon: 'image-outline',
            onPress: () => openRoute('/post/new'),
          },
          {
            label: 'Tirar foto da anilha',
            icon: 'camera-outline',
            onPress: () => openRoute('/recognize'),
          },
          {
            label: 'Avaliar um charuto',
            icon: 'star-outline',
            onPress: () => openRoute('/review/new'),
          },
          {
            label: 'Meu umidor',
            icon: 'cube-outline',
            onPress: () => openRoute('/humidor'),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: theme.colors.background },
});
