import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PasswordService,
} from '../src/auth/password.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Sets the initial password for the bootstrap OWNER.
 *
 * Nexo has no public registration, and the seed deliberately creates the owner
 * without a password. This script is the one safe way to give that account
 * credentials: the password comes from the environment, is never written to the
 * repository, and is never printed.
 *
 * Usage:
 *   1. Put BOOTSTRAP_OWNER_EMAIL and BOOTSTRAP_OWNER_PASSWORD in apps/api/.env
 *   2. pnpm auth:bootstrap-owner
 *   3. Clear BOOTSTRAP_OWNER_PASSWORD from .env
 */

function fail(message: string): never {
  console.error(`bootstrap-owner: ${message}`);
  process.exit(1);
}

const email = process.env.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_OWNER_PASSWORD;

if (!email) {
  fail('BOOTSTRAP_OWNER_EMAIL is not set.');
}

if (!password) {
  fail('BOOTSTRAP_OWNER_PASSWORD is not set. Set it in apps/api/.env, then clear it afterwards.');
}

if (password.length < PASSWORD_MIN_LENGTH) {
  fail(`Password must be at least ${PASSWORD_MIN_LENGTH} characters. A passphrase works well.`);
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
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    fail(`No user found with that email. Run "pnpm prisma:seed" first.`);
  }

  if (user.status !== 'ACTIVE') {
    fail(`That user is not ACTIVE.`);
  }

  const ownership = await prisma.membership.findFirst({
    where: { userId: user.id, role: 'OWNER' },
    select: { organization: { select: { slug: true } } },
  });

  if (!ownership) {
    // Guard rail: this script exists to bootstrap an owner, not to reset
    // arbitrary passwords. User management arrives with invitations later.
    fail('That user is not an OWNER of any organization.');
  }

  const passwordHash = await new PasswordService().hash(password);

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  // Neither the password nor the hash is printed.
  console.info(
    `Password set for ${email} (owner of "${ownership.organization.slug}") using argon2id.`,
  );
  console.info('Now clear BOOTSTRAP_OWNER_PASSWORD from apps/api/.env.');
} finally {
  await prisma.$disconnect();
}
