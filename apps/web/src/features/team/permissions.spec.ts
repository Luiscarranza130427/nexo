import {
  affectsOwnership,
  assignableRolesFor,
  hasAuthorityOver,
  invitableRolesFor,
} from './permissions';

describe('hasAuthorityOver', () => {
  it('lets an OWNER manage everyone, owners included', () => {
    for (const role of ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'] as const) {
      expect(hasAuthorityOver('OWNER', role)).toBe(true);
    }
  });

  it('limits an ADMIN to managers and members', () => {
    expect(hasAuthorityOver('ADMIN', 'MEMBER')).toBe(true);
    expect(hasAuthorityOver('ADMIN', 'MANAGER')).toBe(true);
    expect(hasAuthorityOver('ADMIN', 'ADMIN')).toBe(false);
    expect(hasAuthorityOver('ADMIN', 'OWNER')).toBe(false);
  });

  it('gives MANAGER, MEMBER and a missing role no authority', () => {
    for (const actor of ['MANAGER', 'MEMBER', null, undefined] as const) {
      expect(hasAuthorityOver(actor, 'MEMBER')).toBe(false);
    }
  });
});

describe('invitableRolesFor', () => {
  it('never offers OWNER, and offers an ADMIN only the roles below them', () => {
    expect(invitableRolesFor('OWNER')).toEqual(['ADMIN', 'MANAGER', 'MEMBER']);
    expect(invitableRolesFor('ADMIN')).toEqual(['MANAGER', 'MEMBER']);
    expect(invitableRolesFor('MANAGER')).toEqual([]);
    expect(invitableRolesFor(undefined)).toEqual([]);
  });
});

describe('assignableRolesFor', () => {
  it('offers an OWNER every role, OWNER included', () => {
    expect(assignableRolesFor('OWNER', 'MEMBER')).toEqual(['OWNER', 'ADMIN', 'MANAGER', 'MEMBER']);
    expect(assignableRolesFor('OWNER', 'OWNER')).toEqual(['OWNER', 'ADMIN', 'MANAGER', 'MEMBER']);
  });

  it('offers an ADMIN nothing for owners and admins, and no promotion above MANAGER', () => {
    expect(assignableRolesFor('ADMIN', 'MEMBER')).toEqual(['MANAGER', 'MEMBER']);
    expect(assignableRolesFor('ADMIN', 'OWNER')).toEqual([]);
    expect(assignableRolesFor('ADMIN', 'ADMIN')).toEqual([]);
  });
});

describe('affectsOwnership', () => {
  it('flags granting or removing ownership, and nothing else', () => {
    expect(affectsOwnership('ADMIN', 'OWNER')).toBe(true);
    expect(affectsOwnership('OWNER', 'MEMBER')).toBe(true);
    expect(affectsOwnership('OWNER', 'OWNER')).toBe(false);
    expect(affectsOwnership('MEMBER', 'MANAGER')).toBe(false);
  });
});
