import type { InvitableRole, MembershipRole } from '@nexo/types';

/**
 * Team rules as the interface applies them. **UX only**: the API enforces the
 * same rules and decides. This mirrors `apps/api/src/team/team-rules.ts`.
 */

type Role = MembershipRole | null | undefined;

/** Roles an actor has authority over: they may act on members holding them, and grant them. */
export function rolesUnder(actor: Role): MembershipRole[] {
  switch (actor) {
    case 'OWNER':
      return ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'];
    case 'ADMIN':
      return ['MANAGER', 'MEMBER'];
    default:
      return [];
  }
}

/** Whether an actor may change the role of, or remove, someone holding `role`. */
export function hasAuthorityOver(actor: Role, role: MembershipRole): boolean {
  return rolesUnder(actor).includes(role);
}

/** What an actor may invite someone as. Never OWNER. */
export function invitableRolesFor(actor: Role): InvitableRole[] {
  return rolesUnder(actor).filter((role): role is InvitableRole => role !== 'OWNER');
}

/** Roles to offer when changing a member's role; empty when the actor has no authority. */
export function assignableRolesFor(actor: Role, current: MembershipRole): MembershipRole[] {
  return hasAuthorityOver(actor, current) ? rolesUnder(actor) : [];
}

/** A change that grants or removes ownership deserves a warning. */
export function affectsOwnership(current: MembershipRole, next: MembershipRole): boolean {
  return current !== next && (current === 'OWNER' || next === 'OWNER');
}
