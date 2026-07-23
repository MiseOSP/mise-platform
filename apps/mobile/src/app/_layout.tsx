import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import AppStripeProvider from '@/components/stripe-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { DevRoleSwitcher } from '@/components/dev-role-switcher';
import { Brand } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
// Mise white-label navigation theme. Built from the active Brand tokens so the
// whole app shell (nav bar, screen backgrounds, text) matches the tenant brand
// instead of React Navigation's stock light/dark palette. NCS is tenant #1;
// per-tenant runtime override will layer on top of this later.
const MiseNavTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: Brand.denim,
    background: Brand.cream,
    card: Brand.cream,
    text: Brand.espresso,
    border: Brand.border,
    notification: Brand.clay,
  },
};

  const colorScheme = useColorScheme();
  return (
    <AuthProvider>
      <AppStripeProvider>
        <ThemeProvider value={MiseNavTheme}>
          <AnimatedSplashOverlay />
          <AppTabs />
        <DevRoleSwitcher />
        </ThemeProvider>
      </AppStripeProvider>
    </AuthProvider>
  );
}
