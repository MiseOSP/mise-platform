/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  // Mise is a branded light-first app; we intentionally do NOT follow the OS
  // dark-mode setting, so the tenant palette always renders as designed.
  useColorScheme(); // kept for hook parity / future per-tenant override
  const theme = 'light' as const;

  return Colors[theme];
}
