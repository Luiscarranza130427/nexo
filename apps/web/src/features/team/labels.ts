import type {
  InvitationStatus,
  MembershipRole,
  SortOrder,
  TeamSortField,
  UserStatus,
} from '@nexo/types';

/** Role order, highest authority first. Labels live with the permissions: `ROLE_LABELS`. */
export const MEMBERSHIP_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'];

/** What each role means, in a sentence people can act on. */
export const ROLE_DESCRIPTIONS: Record<MembershipRole, string> = {
  OWNER: 'Control total de la organización, incluido su equipo y sus propietarios.',
  ADMIN: 'Administra el equipo, los clientes, los proyectos y las tareas.',
  MANAGER: 'Gestiona el trabajo diario de proyectos y tareas.',
  MEMBER: 'Colabora en los proyectos en los que participa.',
};

/** The account's status, which is shared across every organization. */
export const MEMBER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  INVITED: 'Invitado',
};

export const USER_STATUSES = Object.keys(MEMBER_STATUS_LABELS) as UserStatus[];

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptada',
  EXPIRED: 'Expirada',
  REVOKED: 'Revocada',
};

export const INVITATION_STATUSES = Object.keys(INVITATION_STATUS_LABELS) as InvitationStatus[];

/** One control for sorting; the first option is the API's own default. */
export const TEAM_SORT_OPTIONS: { value: `${TeamSortField}:${SortOrder}`; label: string }[] = [
  { value: 'name:asc', label: 'Nombre (A–Z)' },
  { value: 'name:desc', label: 'Nombre (Z–A)' },
  { value: 'role:asc', label: 'Rol' },
  { value: 'joinedAt:desc', label: 'Ingreso más reciente' },
  { value: 'joinedAt:asc', label: 'Ingreso más antiguo' },
  { value: 'email:asc', label: 'Correo' },
];

export function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}
