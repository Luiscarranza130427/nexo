import type { InvitationStatus, MembershipRole } from '@nexo/types';

/**
 * Pure team rules. No database access, so every case is cheap to test, and
 * the interface can mirror them exactly.
 */

/** Roles an invitation may grant. Ownership is granted later, explicitly, by an owner. */
export const INVITABLE_ROLES = ['ADMIN', 'MANAGER', 'MEMBER'] as const;

/**
 * Roles an actor has authority over: they may act on members holding these
 * roles, and grant these roles to others. There is no implicit hierarchy
 * elsewhere in the API; this is the one place where one exists.
 */
export function rolesUnder(actor: MembershipRole): readonly MembershipRole[] {
  switch (actor) {
    case 'OWNER':
      return ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'];
    case 'ADMIN':
      return ['MANAGER', 'MEMBER'];
    default:
      return [];
  }
}

export function hasAuthorityOver(actor: MembershipRole, role: MembershipRole): boolean {
  return rolesUnder(actor).includes(role);
}

/** What an actor may invite someone as. */
export function invitableRolesFor(actor: MembershipRole): MembershipRole[] {
  return rolesUnder(actor).filter((role) => role !== 'OWNER');
}

/**
 * Whether an organization keeps at least one active owner once the target
 * stops being one. Blocks at zero, including an organization that has
 * somehow already lost its last active owner.
 */
export function leavesAnOwner(activeOwners: number, targetIsActiveOwner: boolean): boolean {
  return activeOwners - (targetIsActiveOwner ? 1 : 0) >= 1;
}

/** A pending invitation past its expiry is expired, whatever the stored status says. */
export function effectiveInvitationStatus(
  status: InvitationStatus,
  expiresAt: Date,
  now: Date = new Date(),
): InvitationStatus {
  return status === 'PENDING' && expiresAt <= now ? 'EXPIRED' : status;
}

/**
 * Parses `INVITATION_TTL_DAYS`. A bad value fails at startup rather than
 * silently issuing links that never expire or expire at once.
 */
export function parseInvitationTtlDays(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return 7;
  }

  const days = Number(raw);

  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error(
      `Invalid INVITATION_TTL_DAYS "${raw}". Expected a whole number of days between 1 and 90.`,
    );
  }

  return days;
}
