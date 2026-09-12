import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vite resolves the tsconfig path aliases natively, so no plugin is needed.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
