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
  | 'projects:create'
  | 'projects:update'
  | 'projects:delete'
  | 'projects:members'
  | 'clients:create'
  | 'clients:update'
  | 'clients:delete'
  | 'tasks:create'
  | 'tasks:manage'
  | 'tasks:delete'
  | 'workspace:view';

/**
 * Mirrors the `@Roles(...)` decorators on the API, which remain the authority.
 * Reading a client needs no capability — every member of the organization may.
 */
const CAPABILITIES: Record<MembershipRole, readonly Capability[]> = {
  OWNER: [
    'organization:manage',
    'members:manage',
    'projects:create',
    'projects:update',
    'projects:delete',
    'projects:members',
    'clients:create',
    'clients:update',
    'clients:delete',
    'tasks:create',
    'tasks:manage',
    'tasks:delete',
    'workspace:view',
  ],
  ADMIN: [
    'members:manage',
    'projects:create',
    'projects:update',
    'projects:delete',
    'projects:members',
    'clients:create',
    'clients:update',
    'clients:delete',
    'tasks:create',
    'tasks:manage',
    'tasks:delete',
    'workspace:view',
  ],
  // A manager runs the work but does not destroy records.
  MANAGER: [
    'projects:create',
    'projects:update',
    'projects:members',
    'clients:create',
    'clients:update',
    'tasks:create',
    'tasks:manage',
    'workspace:view',
  ],
  // Works on the tasks assigned to them — see `canChangeTask`.
  MEMBER: ['workspace:view'],
};

/** Whether a role may do something. A missing role can do nothing. */
export function can(role: MembershipRole | null | undefined, capability: Capability): boolean {
  if (!role) {
    return false;
  }

  return CAPABILITIES[role].includes(capability);
}

type AssignedTask = { assignee: { userId: string } | null };

/**
 * Whether someone may edit or move one particular task. `tasks:manage` covers
 * every task; without it, only a task assigned to the person themselves — the
 * rule the API enforces for a MEMBER. Reassigning always needs `tasks:manage`.
 */
export function canChangeTask(
  role: MembershipRole | null | undefined,
  userId: string | null | undefined,
  task: AssignedTask,
): boolean {
  if (can(role, 'tasks:manage')) {
    return true;
  }

  return Boolean(role && userId) && task.assignee?.userId === userId;
}

/** Human wording for a role. The interface never shows `OWNER` verbatim. */
export const ROLE_LABELS: Record<MembershipRole, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  MEMBER: 'Miembro',
};
