import 'dotenv/config';
import { defineConfig } from 'vitest/config';

const testDatabaseUrl = process.env.DATABASE_URL_TEST;

if (!testDatabaseUrl) {
  throw new Error(
    'DATABASE_URL_TEST is not set. End-to-end tests write and truncate data, so they must ' +
      'never fall back to DATABASE_URL. See docs/DATABASE.md.',
  );
}

export default defineConfig({
  // Vite resolves the tsconfig path aliases natively, so no plugin is needed.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Every worker talks to the isolated test database, never the development one.
    env: {
      DATABASE_URL: testDatabaseUrl,
      // The suite logs in many times in a few seconds on purpose; rate limiting
      // is verified separately rather than throttling the tests themselves.
      THROTTLE_DISABLED: 'true',
    },
    // The suites share one database and truncate between runs, so they must not
    // execute concurrently.
    fileParallelism: false,
  },
});
