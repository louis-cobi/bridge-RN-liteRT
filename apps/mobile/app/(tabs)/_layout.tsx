import { Tabs } from 'expo-router';
import { theme } from '../../lib/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Chat' }} />
      <Tabs.Screen name="tools" options={{ title: 'Outils' }} />
      <Tabs.Screen name="settings" options={{ title: 'Réglages' }} />
      <Tabs.Screen
        name="debug"
        options={{ title: 'Debug', href: __DEV__ ? undefined : null }}
      />
    </Tabs>
  );
}
