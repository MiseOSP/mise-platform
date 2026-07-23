import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useBranding } from '@/hooks/use-branding';

// Mise is a branded, light-first app; we intentionally do NOT follow the OS
// dark-mode setting. The base palette (Colors.light) is overlaid with the
// current tenant's branding so each organization renders in its own colors.
export function useTheme() {
  useColorScheme(); // kept for hook parity
  const b = useBranding();
  return {
    ...Colors.light,
    text: b.text,
    background: b.background,
    backgroundElement: b.surface,
    textSecondary: b.textMuted,
  };
}
