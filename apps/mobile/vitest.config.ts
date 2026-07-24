import { defineConfig } from 'vitest/config';

// Unit tests target the pure domain logic (financial calculations, etc.).
// They run in a plain Node environment; no React Native or Expo runtime.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
