import type { MembershipRole } from '@nexo/types';

/**
 * Capabilities the interface adapts to.
 *
 * **This is UX, not security.** Hiding a button does not protect anything: the
 * NestJS API re-reads the membership from the database and enforces `@Roles(...)`
 * on every request. This only spares people from options they cannot use.
 *
 * Named `resource:action` so a new module extends the list rather than growing
 * a parallel set of `canDoX` helpers.
 */
export type Capability =
  | 'organization:manage'
  | 'members:manage'
  | 'projects:manage'
  | 'clients:create'
  | 'clients:update'
  | 'clients:delete'
  | 'workspace:view';

/**
 * Mirrors the `@Roles(...)` decorators on the API, which remain the authority.
 * Reading a client needs no capability — every member of the organization may.
 */
const CAPABILITIES: Record<MembershipRole, readonly Capability[]> = {
  OWNER: [
    'organization:manage',
    'members:manage',
    'projects:manage',
    'clients:create',
    'clients:update',
    'clients:delete',
    'workspace:view',
  ],
  ADMIN: [
    'members:manage',
    'projects:manage',
    'clients:create',
    'clients:update',
    'clients:delete',
    'workspace:view',
  ],
  // A manager runs the work but does not destroy records.
  MANAGER: ['projects:manage', 'clients:create', 'clients:update', 'workspace:view'],
  MEMBER: ['workspace:view'],
};

/** Whether a role may do something. A missing role can do nothing. */
export function can(role: MembershipRole | null | undefined, capability: Capability): boolean {
  if (!role) {
    return false;
  }

  return CAPABILITIES[role].includes(capability);
}

/** Human wording for a role. The interface never shows `OWNER` verbatim. */
export const ROLE_LABELS: Record<MembershipRole, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  MEMBER: 'Miembro',
};
