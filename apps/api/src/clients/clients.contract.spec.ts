import type { ClientStatus as SharedStatus, ClientType as SharedType } from '@nexo/types';
import {
  ClientStatus as PrismaStatus,
  ClientType as PrismaType,
} from '../generated/prisma/enums.js';

/**
 * `@nexo/types` declares these as plain unions so the frontend never depends on
 * Prisma. That decoupling is only safe while both definitions agree, so this
 * guards the seam — the same way `auth.contract.spec.ts` guards MembershipRole.
 */
describe('Client enum contracts', () => {
  it('ClientType lists exactly what the database defines', () => {
    const shared: SharedType[] = ['PERSON', 'COMPANY'];

    expect(Object.values(PrismaType).sort()).toEqual([...shared].sort());
  });

  it('ClientStatus lists exactly what the database defines', () => {
    const shared: SharedStatus[] = ['ACTIVE', 'INACTIVE', 'PROSPECT'];

    expect(Object.values(PrismaStatus).sort()).toEqual([...shared].sort());
  });

  it('type-checks each value against the Prisma enum', () => {
    // A compile error here means a union drifted from the database.
    const person: SharedType = PrismaType.PERSON;
    const company: SharedType = PrismaType.COMPANY;
    const active: SharedStatus = PrismaStatus.ACTIVE;
    const inactive: SharedStatus = PrismaStatus.INACTIVE;
    const prospect: SharedStatus = PrismaStatus.PROSPECT;

    expect([person, company, active, inactive, prospect]).toHaveLength(5);
  });
});
