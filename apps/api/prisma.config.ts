import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 reads CLI configuration from this file. The datasource URL lives
// here (not in schema.prisma) and is only ever read from the environment.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --import tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
