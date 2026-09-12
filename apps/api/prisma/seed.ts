import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Minimal development seed.
 *
 * Idempotent: every write is an upsert keyed on a unique constraint, so running
 * it repeatedly never creates duplicates. It holds no credentials — passwords
 * arrive with authentication in phase 4.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main(): Promise<void> {
  const organization = await prisma.organization.upsert({
    where: { slug: 'novatec' },
    update: {},
    create: {
      name: 'NovaTec',
      slug: 'novatec',
      status: 'ACTIVE',
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'dev@novatec.local' },
    update: {},
    create: {
      email: 'dev@novatec.local',
      firstName: 'Luis',
      lastName: 'Carranza',
      status: 'ACTIVE',
    },
  });

  const membership = await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      userId: user.id,
      role: 'OWNER',
    },
  });

  console.info(
    `Seeded: organization "${organization.slug}", user "${user.email}", role ${membership.role}.`,
  );
}

try {
  await main();
} catch (error) {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
