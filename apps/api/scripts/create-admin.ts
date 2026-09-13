import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PasswordService,
} from '../src/auth/password.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Creates or resets the local development administrator.
 *
 * Development only: it refuses to run when NODE_ENV is "production". The
 * password comes from DEV_ADMIN_PASSWORD at execution time and is never written
 * anywhere — not to .env, not to the repository, not to the console.
 *
 * Usage (the variable exists only for that one command):
 *   DEV_ADMIN_PASSWORD='<passphrase>' pnpm auth:create-admin
 *
 * Effects, and nothing else:
 *   - admin@novatec.local is created if missing; otherwise it is set ACTIVE and
 *     given the new password. Names are only set on creation.
 *   - Its membership in the "novatec" organization is created or set to ADMIN.
 *     Memberships in other organizations are left alone.
 *   - Its existing sessions are revoked, as any password reset should do.
 */

const EMAIL = 'admin@novatec.local';
const FIRST_NAME = 'Admin';
const LAST_NAME = 'NovaTec';
const ORGANIZATION_SLUG = 'novatec';

function fail(message: string): never {
  console.error(`create-admin: ${message}`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  fail('refusing to run in production.');
}

const password = process.env.DEV_ADMIN_PASSWORD;

if (!password) {
  fail('DEV_ADMIN_PASSWORD is not set. Pass it inline for this command only.');
}

if (password.length < PASSWORD_MIN_LENGTH) {
  fail(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
}

if (password.length > PASSWORD_MAX_LENGTH) {
  fail(`Password must be at most ${PASSWORD_MAX_LENGTH} characters.`);
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  fail('DATABASE_URL is not set.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

try {
  const organization = await prisma.organization.findUnique({
    where: { slug: ORGANIZATION_SLUG },
    select: { id: true, name: true },
  });

  if (!organization) {
    fail(`Organization "${ORGANIZATION_SLUG}" not found. Run "pnpm prisma:seed" first.`);
  }

  // Hashed before the transaction: Argon2 is deliberately slow, and a
  // transaction should not stay open while it works.
  const passwordHash = await new PasswordService().hash(password);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: EMAIL }, select: { id: true } });

    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { status: 'ACTIVE', passwordHash },
          select: { id: true },
        })
      : await tx.user.create({
          data: {
            email: EMAIL,
            firstName: FIRST_NAME,
            lastName: LAST_NAME,
            status: 'ACTIVE',
            passwordHash,
          },
          select: { id: true },
        });

    await tx.membership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      update: { role: 'ADMIN' },
      create: { organizationId: organization.id, userId: user.id, role: 'ADMIN' },
    });

    const revoked = await tx.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { created: !existing, revoked: revoked.count };
  });

  // Neither the password nor the hash is printed.
  console.info(
    `${result.created ? 'Created' : 'Reset'} ${EMAIL} as ADMIN of "${organization.name}" using argon2id.`,
  );

  if (result.revoked > 0) {
    console.info(`Revoked ${result.revoked} existing session(s).`);
  }
} finally {
  await prisma.$disconnect();
}
