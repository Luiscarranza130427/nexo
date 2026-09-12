import { defineConfig } from 'vitest/config';

/**
 * Unit tests for pure frontend logic: validation schemas, error normalization
 * and the permission helper.
 *
 * No jsdom or testing-library yet — component tests need that tooling, and
 * standing up a browser-like environment is a decision for when there is
 * component behaviour worth asserting.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    include: ['src/**/*.spec.ts'],
  },
});
