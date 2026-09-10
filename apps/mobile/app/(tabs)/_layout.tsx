import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../src/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.gold,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: theme.fonts.bodyMedium,
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.divider,
          height: 56 + bottom,
          paddingTop: 4,
          paddingBottom: bottom,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.replace('/(tabs)');
          },
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Criar',
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Publicar foto ou avaliar"
              onPress={() => {
                router.replace('/(tabs)');
                setTimeout(() => router.navigate('/(tabs)/create'), 40);
              }}
              style={styles.fabHit}
            >
              <View style={styles.fab}>
                <Ionicons name="add" color={theme.colors.background} size={28} />
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="shops"
        options={{
          title: 'Parceiros',
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
      {/* Notificações ficam no sino do feed — fora da tab bar (como nos mockups). */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fabHit: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    top: -16,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.subtle,
  },
});
