import {
  INVITABLE_ROLES,
  effectiveInvitationStatus,
  hasAuthorityOver,
  invitableRolesFor,
  leavesAnOwner,
  parseInvitationTtlDays,
} from './team-rules.js';

describe('hasAuthorityOver', () => {
  it('lets an OWNER act on and grant every role, OWNER included', () => {
    for (const role of ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'] as const) {
      expect(hasAuthorityOver('OWNER', role)).toBe(true);
    }
  });

  it('limits an ADMIN to managers and members', () => {
    expect(hasAuthorityOver('ADMIN', 'MANAGER')).toBe(true);
    expect(hasAuthorityOver('ADMIN', 'MEMBER')).toBe(true);
    expect(hasAuthorityOver('ADMIN', 'ADMIN')).toBe(false);
    expect(hasAuthorityOver('ADMIN', 'OWNER')).toBe(false);
  });

  it('gives MANAGER and MEMBER no authority over anyone', () => {
    for (const actor of ['MANAGER', 'MEMBER'] as const) {
      for (const role of ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'] as const) {
        expect(hasAuthorityOver(actor, role)).toBe(false);
      }
    }
  });
});

describe('invitableRolesFor', () => {
  it('never offers OWNER, and offers an ADMIN only the roles below them', () => {
    expect(invitableRolesFor('OWNER')).toEqual(['ADMIN', 'MANAGER', 'MEMBER']);
    expect(invitableRolesFor('ADMIN')).toEqual(['MANAGER', 'MEMBER']);
    expect(invitableRolesFor('MANAGER')).toEqual([]);
    expect(INVITABLE_ROLES).not.toContain('OWNER');
  });
});

describe('leavesAnOwner', () => {
  it('blocks removing or demoting the last active owner', () => {
    expect(leavesAnOwner(1, true)).toBe(false);
    expect(leavesAnOwner(2, true)).toBe(true);
  });

  it('does not count an inactive owner, and never makes a broken organization worse', () => {
    expect(leavesAnOwner(1, false)).toBe(true);
    expect(leavesAnOwner(0, false)).toBe(false);
  });
});

describe('effectiveInvitationStatus', () => {
  const now = new Date('2026-10-01T12:00:00.000Z');

  it('reads a pending invitation past its expiry as expired', () => {
    expect(effectiveInvitationStatus('PENDING', new Date('2026-10-01T11:59:59.000Z'), now)).toBe(
      'EXPIRED',
    );
    expect(effectiveInvitationStatus('PENDING', now, now)).toBe('EXPIRED');
    expect(effectiveInvitationStatus('PENDING', new Date('2026-10-02T00:00:00.000Z'), now)).toBe(
      'PENDING',
    );
  });

  it('leaves settled invitations alone', () => {
    const past = new Date('2026-09-01T00:00:00.000Z');

    expect(effectiveInvitationStatus('ACCEPTED', past, now)).toBe('ACCEPTED');
    expect(effectiveInvitationStatus('REVOKED', past, now)).toBe('REVOKED');
  });
});

describe('parseInvitationTtlDays', () => {
  it('defaults to seven days', () => {
    expect(parseInvitationTtlDays(undefined)).toBe(7);
    expect(parseInvitationTtlDays('')).toBe(7);
  });

  it('accepts whole days between 1 and 90', () => {
    expect(parseInvitationTtlDays('1')).toBe(1);
    expect(parseInvitationTtlDays('30')).toBe(30);
  });

  it('fails loudly on anything else', () => {
    for (const raw of ['0', '91', '2.5', 'seven', '-3']) {
      expect(() => parseInvitationTtlDays(raw)).toThrow(/INVITATION_TTL_DAYS/);
    }
  });
});
