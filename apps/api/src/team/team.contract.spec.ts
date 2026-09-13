import type {
  InvitationStatus as SharedInvitationStatus,
  UserStatus as SharedUserStatus,
} from '@nexo/types';
import { InvitationStatus, MembershipRole, UserStatus } from '../generated/prisma/enums.js';
import { INVITABLE_ROLES } from './team-rules.js';

/**
 * `@nexo/types` declares these as plain unions so the frontend never depends on
 * Prisma. That is only safe while both definitions agree.
 */
describe('Team contracts', () => {
  it('UserStatus lists exactly what the database defines', () => {
    const shared: SharedUserStatus[] = ['ACTIVE', 'INACTIVE', 'INVITED'];

    expect(Object.values(UserStatus).sort()).toEqual([...shared].sort());
  });

  it('InvitationStatus lists exactly what the database defines', () => {
    const shared: SharedInvitationStatus[] = ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'];

    expect(Object.values(InvitationStatus).sort()).toEqual([...shared].sort());
  });

  it('invitable roles are database roles, minus OWNER', () => {
    expect([...INVITABLE_ROLES, 'OWNER'].sort()).toEqual(Object.values(MembershipRole).sort());
  });
});
