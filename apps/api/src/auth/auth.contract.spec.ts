import type { MembershipRole as SharedRole } from '@nexo/types';
import { MembershipRole as PrismaRole } from '../generated/prisma/enums.js';

/**
 * `@nexo/types` deliberately declares MembershipRole as a plain union so the
 * frontend never depends on Prisma. That decoupling is only safe while the two
 * definitions agree, so this guards the seam.
 */
describe('MembershipRole contract', () => {
  it('lists exactly the roles the database defines', () => {
    const shared: SharedRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'];

    expect(Object.values(PrismaRole).sort()).toEqual([...shared].sort());
  });

  it('type-checks each shared value against the Prisma enum', () => {
    // A compile error here means the union drifted from the database enum.
    const owner: SharedRole = PrismaRole.OWNER;
    const admin: SharedRole = PrismaRole.ADMIN;
    const manager: SharedRole = PrismaRole.MANAGER;
    const member: SharedRole = PrismaRole.MEMBER;

    expect([owner, admin, manager, member]).toHaveLength(4);
  });
});
