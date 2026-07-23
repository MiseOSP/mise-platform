/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Aligned to the Brand palette so the app chrome (ThemedView/useTheme)
    // renders in the tenant's identity rather than generic white/grey.
    text: '#3F332C',            // Brand.espresso
    background: '#F5EFE5',       // Brand.cream
    backgroundElement: '#FFFFFF',// Brand.surface (cards/inputs on cream)
    backgroundSelected: '#ECE3D4',// slightly deeper cream for pressed/selected
    textSecondary: '#6B5D50',    // Brand.textMuted
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Brand design tokens (v2.0 Section 43).
 *
 * The Nashville Chef Service brand palette. These are the shared, canonical
 * values for the client-facing surfaces (public landing + intake). Screens
 * MUST import from here rather than redefining hex values inline, so the
 * brand stays consistent and is changeable in exactly one place.
 *
 * Naming is semantic where a role is clear, with the source palette name in
 * a comment for designer traceability.
 */
export const Brand = {
  /** Warm paper background -- "cream" */
  cream: '#F5EFE5',
  /** Primary action / links -- "denim" */
  denim: '#46627C',
  /** Primary text on cream -- "espresso" */
  espresso: '#3F332C',
  /** Accent / errors / eyebrow -- "clay" */
  clay: '#CD7E56',
  /** Secondary / calm accent -- "sage" (from nashvillechefservice.com) */
  sage: '#88937B',

  /** Neutral surface inside cards / inputs */
  surface: '#FFFFFF',
  /** Hairline borders on cream */
  border: '#E4DACB',
  /** Muted body / helper text on cream */
  textMuted: '#6B5D50',
  /** Disabled primary button fill (desaturated denim) */
  denimDisabled: '#A9B7C4',
  /** Selected choice tint (pale denim wash) */
  denimTint: '#EAF0F5',
} as const;

export type BrandColor = keyof typeof Brand;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
