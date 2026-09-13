import type { PrismaService } from '../database/prisma.service.js';

type LockClient = Pick<PrismaService, '$queryRaw'>;

/**
 * Locks the organization row for the rest of the transaction.
 *
 * Role changes, removals and new invitations in one organization queue behind
 * each other, so two owners demoting each other cannot both pass the
 * last-owner check, and two identical invitations cannot both pass the
 * duplicate check. Other organizations never wait. A row lock has no
 * equivalent in Prisma's query API, hence the raw query.
 */
export async function lockOrganization(tx: LockClient, organizationId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
}
